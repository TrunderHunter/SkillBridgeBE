import crypto from 'crypto';
import { OTP } from '../../models/OTP';
import { Contract } from '../../models/Contract';
import { OTPType } from '../../types/user.types';
import { emailService } from '../email/email.service';
import { logger } from '../../utils/logger';
import { ApiError } from '../../utils/response';

interface GenerateContractOTPParams {
  contractId: string;
  email: string;
  recipientName: string;
  contractCode: string;
  role: 'student' | 'tutor';
}

interface VerifyContractOTPParams {
  contractId: string;
  email: string;
  otpCode: string;
  role: 'student' | 'tutor';
}

class ContractOTPService {
  // Rate limiting constants
  private readonly MAX_ATTEMPTS = 5; // Max OTP verification attempts
  private readonly RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_OTP_REQUESTS_PER_WINDOW = 3; // Max 3 OTP requests per 15 min

  /**
   * Generate 6-digit OTP code
   */
  private generateOTPCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Hash OTP code for secure storage in audit trail
   */
  private hashOTP(otpCode: string): string {
    return crypto.createHash('sha256').update(otpCode).digest('hex');
  }

  /**
   * Check rate limiting for OTP requests
   */
  private async checkRateLimit(
    email: string,
    contractId: string
  ): Promise<void> {
    const windowStart = new Date(Date.now() - this.RATE_LIMIT_WINDOW);

    const recentOTPs = await OTP.countDocuments({
      email,
      reference_id: contractId,
      otp_type: OTPType.CONTRACT_SIGNING,
      created_at: { $gte: windowStart },
    });

    if (recentOTPs >= this.MAX_OTP_REQUESTS_PER_WINDOW) {
      throw new ApiError(
        429,
        'Quá nhiều yêu cầu OTP. Vui lòng thử lại sau 15 phút.'
      );
    }
  }

  /**
   * Generate and send OTP for contract signing
   */
  async generateContractOTP(
    params: GenerateContractOTPParams
  ): Promise<{ success: boolean; expiresAt: Date }> {
    const { contractId, email, recipientName, contractCode, role } = params;

    try {
      // Check rate limiting
      await this.checkRateLimit(email, contractId);

      // Verify contract exists and is in correct status
      const contract = await Contract.findById(contractId);
      if (!contract) {
        throw new ApiError(404, 'Hợp đồng không tồn tại');
      }

      if (contract.isLocked) {
        throw new ApiError(400, 'Hợp đồng đã được ký và không thể thay đổi');
      }

      // Allow signing for non-rejected contracts (remove strict approval requirement)
      if (contract.status === 'REJECTED') {
        throw new ApiError(400, 'Không thể ký hợp đồng đã bị từ chối');
      }

      // Check if already signed by this role
      if (role === 'student' && contract.studentSignedAt) {
        throw new ApiError(400, 'Học viên đã ký hợp đồng này');
      }
      if (role === 'tutor' && contract.tutorSignedAt) {
        throw new ApiError(400, 'Gia sư đã ký hợp đồng này');
      }

      // Invalidate any existing OTPs for this contract and email
      await OTP.updateMany(
        {
          email,
          reference_id: contractId,
          otp_type: OTPType.CONTRACT_SIGNING,
          is_used: false,
        },
        { is_used: true }
      );

      // Generate new OTP
      const otpCode = this.generateOTPCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Save OTP to database
      await OTP.create({
        email,
        otp_code: otpCode,
        expires_at: expiresAt,
        is_used: false,
        otp_type: OTPType.CONTRACT_SIGNING,
        reference_id: contractId,
        metadata: {
          contractCode,
          role,
          recipientName,
        },
      });

      // Send OTP via email
      const emailSent = await this.sendContractSigningOTPEmail(
        email,
        otpCode,
        recipientName,
        contractCode,
        role
      );

      if (!emailSent) {
        throw new ApiError(500, 'Không thể gửi email OTP. Vui lòng thử lại.');
      }

      logger.info(
        `Contract OTP generated for ${role} - Contract: ${contractCode}, Email: ${email}`
      );

      return { success: true, expiresAt };
    } catch (error) {
      logger.error('Generate contract OTP error:', error);
      throw error;
    }
  }

  /**
   * Send contract signing OTP email
   */
  private async sendContractSigningOTPEmail(
    email: string,
    otpCode: string,
    recipientName: string,
    contractCode: string,
    role: 'student' | 'tutor'
  ): Promise<boolean> {
    const roleText = role === 'student' ? 'Học viên' : 'Gia sư';
    const subject = `SkillBridge - Mã xác thực ký hợp đồng ${contractCode}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Xác thực ký hợp đồng</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
          .otp-code { font-size: 32px; font-weight: bold; color: #10B981; text-align: center; padding: 20px; background: white; border-radius: 8px; margin: 20px 0; letter-spacing: 4px; }
          .contract-info { background: #E0F2FE; padding: 15px; border-left: 4px solid #0284C7; margin: 15px 0; border-radius: 4px; }
          .warning { background: #FEF3C7; padding: 15px; border-left: 4px solid #F59E0B; margin: 15px 0; border-radius: 4px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .highlight { color: #10B981; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 SkillBridge</h1>
            <p>Xác thực chữ ký điện tử</p>
          </div>
          <div class="content">
            <p>Xin chào <strong>${recipientName}</strong> (${roleText}),</p>
            <p>Bạn đang thực hiện <strong>ký điện tử</strong> cho hợp đồng. Để hoàn tất quá trình ký, vui lòng sử dụng mã OTP dưới đây:</p>
            
            <div class="contract-info">
              <strong>Mã hợp đồng:</strong> ${contractCode}
            </div>

            <div class="otp-code">${otpCode}</div>
            
            <div class="warning">
              <p><strong>⚠️ Lưu ý quan trọng:</strong></p>
              <ul style="margin: 5px 0;">
                <li>Mã OTP có hiệu lực trong <span class="highlight">5 phút</span></li>
                <li><strong>TUYỆT ĐỐI KHÔNG chia sẻ</strong> mã này với bất kỳ ai</li>
                <li>Việc nhập OTP có ý nghĩa <strong>chữ ký điện tử hợp pháp</strong></li>
                <li>Sau khi ký, hợp đồng sẽ <strong>không thể thay đổi</strong></li>
              </ul>
            </div>

            <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email và liên hệ ngay với chúng tôi.</p>
            
            <p>Trân trọng,<br>Đội ngũ SkillBridge</p>
          </div>
          <div class="footer">
            <p>© 2025 SkillBridge. Chữ ký điện tử tuân thủ Luật Giao dịch điện tử.</p>
            <p>Email này được gửi tự động, vui lòng không trả lời.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Xin chào ${recipientName} (${roleText}),
      
      Bạn đang ký điện tử cho hợp đồng: ${contractCode}
      Mã OTP của bạn là: ${otpCode}
      
      Mã này có hiệu lực trong 5 phút.
      TUYỆT ĐỐI KHÔNG chia sẻ mã này với bất kỳ ai.
      
      Trân trọng,
      Đội ngũ SkillBridge
    `;

    return emailService.sendEmail({ to: email, subject, html, text });
  }

  /**
   * Verify OTP for contract signing
   */
  async verifyContractOTP(
    params: VerifyContractOTPParams
  ): Promise<{ success: boolean; otpHash: string }> {
    const { contractId, email, otpCode, role } = params;

    try {
      // Find valid OTP
      const otpRecord = await OTP.findOne({
        email,
        reference_id: contractId,
        otp_type: OTPType.CONTRACT_SIGNING,
        is_used: false,
        expires_at: { $gt: new Date() },
      }).sort({ created_at: -1 });

      if (!otpRecord) {
        throw new ApiError(400, 'Mã OTP không hợp lệ hoặc đã hết hạn');
      }

      // Verify OTP code
      if (otpRecord.otp_code !== otpCode) {
        throw new ApiError(400, 'Mã OTP không đúng');
      }

      // Mark OTP as used
      otpRecord.is_used = true;
      await otpRecord.save();

      // Generate hash for audit trail
      const otpHash = this.hashOTP(otpCode);

      logger.info(
        `Contract OTP verified for ${role} - Contract: ${contractId}, Email: ${email}`
      );

      return { success: true, otpHash };
    } catch (error) {
      logger.error('Verify contract OTP error:', error);
      throw error;
    }
  }

  /**
   * Resend OTP (wrapper around generateContractOTP with same params)
   */
  async resendContractOTP(
    params: GenerateContractOTPParams
  ): Promise<{ success: boolean; expiresAt: Date }> {
    logger.info(
      `Resending contract OTP for ${params.role} - Contract: ${params.contractCode}`
    );
    return this.generateContractOTP(params);
  }
}

export const contractOTPService = new ContractOTPService();
