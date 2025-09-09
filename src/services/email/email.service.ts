import nodemailer from 'nodemailer';
import { logger } from '../../utils/logger';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      // secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: `"SkillBridge" <${process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully to ${options.to}`, {
        messageId: result.messageId,
      });
      return true;
    } catch (error) {
      logger.error('Failed to send email:', error);
      return false;
    }
  }

  async sendOTPEmail(
    email: string,
    otpCode: string,
    fullName: string
  ): Promise<boolean> {
    const subject = 'SkillBridge - Mã xác thực đăng ký tài khoản';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Xác thực tài khoản SkillBridge</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
          .otp-code { font-size: 24px; font-weight: bold; color: #4F46E5; text-align: center; padding: 15px; background: white; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>SkillBridge</h1>
            <p>Xác thực tài khoản của bạn</p>
          </div>
          <div class="content">
            <p>Xin chào <strong>${fullName}</strong>,</p>
            <p>Cảm ơn bạn đã đăng ký tài khoản tại SkillBridge. Để hoàn tất quá trình đăng ký, vui lòng sử dụng mã OTP dưới đây:</p>
            
            <div class="otp-code">${otpCode}</div>
            
            <p><strong>Lưu ý:</strong></p>
            <ul>
              <li>Mã OTP có hiệu lực trong 5 phút</li>
              <li>Không chia sẻ mã này với bất kỳ ai</li>
              <li>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email</li>
            </ul>
            
            <p>Trân trọng,<br>Đội ngũ SkillBridge</p>
          </div>
          <div class="footer">
            <p>© 2025 SkillBridge. Tất cả quyền được bảo lưu.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Xin chào ${fullName},
      
      Cảm ơn bạn đã đăng ký tài khoản tại SkillBridge.
      Mã OTP của bạn là: ${otpCode}
      
      Mã này có hiệu lực trong 5 phút.
      
      Trân trọng,
      Đội ngũ SkillBridge
    `;

    return this.sendEmail({ to: email, subject, html, text });
  }

  async sendPasswordResetOTP(
    email: string,
    otpCode: string,
    fullName: string
  ): Promise<boolean> {
    const subject = 'SkillBridge - Mã xác thực đặt lại mật khẩu';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Đặt lại mật khẩu SkillBridge</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #DC2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
          .otp-code { font-size: 24px; font-weight: bold; color: #DC2626; text-align: center; padding: 15px; background: white; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .warning { background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 15px; margin: 20px 0; color: #991B1B; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>SkillBridge</h1>
            <p>Đặt lại mật khẩu</p>
          </div>
          <div class="content">
            <p>Xin chào <strong>${fullName}</strong>,</p>
            <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Để tiếp tục, vui lòng sử dụng mã OTP dưới đây:</p>
            
            <div class="otp-code">${otpCode}</div>
            
            <div class="warning">
              <p><strong>⚠️ Lưu ý quan trọng:</strong></p>
              <ul>
                <li>Mã OTP có hiệu lực trong 10 phút</li>
                <li>Không chia sẻ mã này với bất kỳ ai</li>
                <li>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email và liên hệ hỗ trợ</li>
                <li>Sau khi sử dụng mã này, mật khẩu cũ sẽ không còn hiệu lực</li>
              </ul>
            </div>
            
            <p>Trân trọng,<br>Đội ngũ SkillBridge</p>
          </div>
          <div class="footer">
            <p>© 2025 SkillBridge. Tất cả quyền được bảo lưu.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Xin chào ${fullName},
      
      Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.
      Mã OTP của bạn là: ${otpCode}
      
      Mã này có hiệu lực trong 10 phút.
      Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.
      
      Trân trọng,
      Đội ngũ SkillBridge
    `;

    return this.sendEmail({ to: email, subject, html, text });
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('Email service connection verified successfully');
      return true;
    } catch (error) {
      logger.error('Email service connection failed:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
