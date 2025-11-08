import { Router } from 'express';
import { authenticateToken } from '../../middlewares/auth.middleware';
import { uploadAny, uploadToCloudinaryGeneric } from '../../config/cloudinary';
import { Request, Response } from 'express';
import { logger } from '../../utils/logger';

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    status: string;
  };
}

/**
 * Upload file to Cloudinary (for homework, assignments, etc.)
 */
router.post(
  '/file',
  authenticateToken,
  uploadAny.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Không có file nào được upload'
        });
      }

      const userId = req.user!.id;
      const userRole = req.user!.role;
      
      // Create folder structure: homework/{role}/{userId}
      const folder = `skillbridge/homework/${userRole.toLowerCase()}/${userId}`;
      
      // Sanitize filename
      const originalName = req.file.originalname || 'file';
      const sanitizedName = originalName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_')
        .replace(/[^\w.-]/g, '_');
      
      const safeName = `${Date.now()}-${sanitizedName}`;

      // Actually upload to Cloudinary
      const fileUrl = await uploadToCloudinaryGeneric(req.file.buffer, folder, safeName);

      logger.info('Upload homework file success:', { userId, fileUrl });

      return res.json({
        success: true,
        message: 'Upload file thành công',
        data: {
          url: fileUrl,
          fileName: sanitizedName,
          fileSize: req.file.size,
          mimeType: req.file.mimetype
        }
      });
    } catch (error: any) {
      logger.error('Upload file error:', error);
      return res.status(500).json({
        success: false,
        message: 'Upload file thất bại',
        error: error.message
      });
    }
  }
);

export default router;
