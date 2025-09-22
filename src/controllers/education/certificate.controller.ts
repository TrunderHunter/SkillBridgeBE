import { Request, Response, NextFunction } from 'express';
import {
  CertificateService,
  CreateCertificateData,
  UpdateCertificateData,
} from '../../services/education';
import { sendSuccess, sendError } from '../../utils/response';

export class CertificateController {
  /**
   * Create certificate record
   */
  static async createCertificate(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const { name, description, issued_by, issue_date, expiry_date } =
        req.body;

      const certificateData: CreateCertificateData = {
        tutor_id: tutorId,
        name,
        description,
        issued_by,
        issue_date: issue_date ? new Date(issue_date) : undefined,
        expiry_date: expiry_date ? new Date(expiry_date) : undefined,
      };

      const certificateImageFile = req.file;

      const certificate = await CertificateService.createCertificate(
        certificateData,
        certificateImageFile
      );

      sendSuccess(res, 'Certificate created successfully', certificate, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get tutor's certificates
   */
  static async getCertificates(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const certificates =
        await CertificateService.getCertificatesByTutorId(tutorId);

      sendSuccess(res, 'Certificates retrieved successfully', certificates);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get certificate by ID
   */
  static async getCertificateById(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const { certificateId } = req.params;

      const certificate = await CertificateService.getCertificateById(
        certificateId,
        tutorId
      );

      if (!certificate) {
        return sendError(res, 'Certificate not found', undefined, 404);
      }

      sendSuccess(res, 'Certificate retrieved successfully', certificate);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update certificate record
   */
  static async updateCertificate(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const { certificateId } = req.params;
      const { name, description, issued_by, issue_date, expiry_date } =
        req.body;

      const updateData: UpdateCertificateData = {};

      if (name) updateData.name = name;
      if (description) updateData.description = description;
      if (issued_by) updateData.issued_by = issued_by;
      if (issue_date !== undefined)
        updateData.issue_date = issue_date ? new Date(issue_date) : undefined;
      if (expiry_date !== undefined)
        updateData.expiry_date = expiry_date
          ? new Date(expiry_date)
          : undefined;

      const certificateImageFile = req.file;

      const certificate = await CertificateService.updateCertificate(
        certificateId,
        tutorId,
        updateData,
        certificateImageFile
      );

      sendSuccess(res, 'Certificate updated successfully', certificate);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete certificate record
   */
  static async deleteCertificate(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const { certificateId } = req.params;

      await CertificateService.deleteCertificate(certificateId, tutorId);

      sendSuccess(res, 'Certificate deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}
