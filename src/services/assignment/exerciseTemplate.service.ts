import { ExerciseTemplate, IExerciseTemplate } from '../../models/ExerciseTemplate';

export interface ExerciseTemplateFilters {
  subjectId?: string;
  gradeLevel?: string;
  type?: string;
  search?: string;
  mineOnly?: boolean;
}

class ExerciseTemplateService {
  async listTemplates(tutorId: string, filters: ExerciseTemplateFilters) {
    const query: any = {};

    if (filters.mineOnly) {
      query.ownerId = tutorId;
    } else {
      // Show own templates + public ones
      query.$or = [{ ownerId: tutorId }, { isPublic: true }];
    }

    if (filters.subjectId) {
      query.subjectId = filters.subjectId;
    }

    if (filters.gradeLevel) {
      query.gradeLevels = filters.gradeLevel;
    }

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.search) {
      const regex = new RegExp(filters.search, 'i');
      query.$and = [
        ...(query.$and || []),
        {
          $or: [{ title: regex }, { description: regex }, { tags: regex }],
        },
      ];
    }

    const templates = await ExerciseTemplate.find(query)
      .sort({ updatedAt: -1 })
      .lean();

    return {
      success: true,
      data: templates,
    };
  }

  async getTemplate(tutorId: string, templateId: string) {
    const template = await ExerciseTemplate.findById(templateId).lean();
    if (!template) {
      throw new Error('Không tìm thấy bài tập mẫu');
    }

    if (!template.isPublic && template.ownerId !== tutorId) {
      throw new Error('Bạn không có quyền xem bài tập này');
    }

    return {
      success: true,
      data: template,
    };
  }

  async createTemplate(tutorId: string, payload: Partial<IExerciseTemplate>) {
    const template = await ExerciseTemplate.create({
      ...payload,
      ownerId: tutorId,
    });

    return {
      success: true,
      message: 'Tạo bài tập mẫu thành công',
      data: template.toJSON(),
    };
  }

  async updateTemplate(
    tutorId: string,
    templateId: string,
    payload: Partial<IExerciseTemplate>
  ) {
    const template = await ExerciseTemplate.findById(templateId);
    if (!template) {
      throw new Error('Không tìm thấy bài tập mẫu');
    }

    if (template.ownerId !== tutorId) {
      throw new Error('Bạn không có quyền chỉnh sửa bài tập này');
    }

    Object.assign(template, payload);
    await template.save();

    return {
      success: true,
      message: 'Cập nhật bài tập mẫu thành công',
      data: template.toJSON(),
    };
  }

  async deleteTemplate(tutorId: string, templateId: string) {
    const template = await ExerciseTemplate.findById(templateId);
    if (!template) {
      throw new Error('Không tìm thấy bài tập mẫu');
    }

    if (template.ownerId !== tutorId) {
      throw new Error('Bạn không có quyền xóa bài tập này');
    }

    await template.deleteOne();

    return {
      success: true,
      message: 'Đã xóa bài tập mẫu',
    };
  }

  async incrementUsage(templateId: string) {
    await ExerciseTemplate.findByIdAndUpdate(templateId, {
      $inc: { usageCount: 1 },
    }).exec();
  }
}

export const exerciseTemplateService = new ExerciseTemplateService();


