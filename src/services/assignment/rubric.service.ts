import { Rubric, IRubric } from '../../models/Rubric';

class RubricService {
  async listRubrics(tutorId: string, subjectId?: string) {
    const query: any = {
      $or: [{ ownerId: tutorId }, { isPublic: true }],
    };

    if (subjectId) {
      query.subjectId = subjectId;
    }

    const rubrics = await Rubric.find(query).sort({ updatedAt: -1 }).lean();

    return {
      success: true,
      data: rubrics,
    };
  }

  async getRubric(tutorId: string, rubricId: string) {
    const rubric = await Rubric.findById(rubricId).lean();
    if (!rubric) {
      throw new Error('Không tìm thấy rubric');
    }

    if (!rubric.isPublic && rubric.ownerId !== tutorId) {
      throw new Error('Bạn không có quyền xem rubric này');
    }

    return {
      success: true,
      data: rubric,
    };
  }

  async createRubric(tutorId: string, payload: Partial<IRubric>) {
    console.log('🔍 [DEBUG] rubricService.createRubric - tutorId:', tutorId);
    console.log('🔍 [DEBUG] rubricService.createRubric - payload:', JSON.stringify(payload, null, 2));

    const rubricData = {
      ...payload,
      ownerId: tutorId,
    };
    
    console.log('🔍 [DEBUG] rubricService.createRubric - rubricData:', JSON.stringify(rubricData, null, 2));

    const rubric = await Rubric.create(rubricData);

    console.log('🔍 [DEBUG] rubricService.createRubric - created rubric:', rubric);

    return {
      success: true,
      message: 'Tạo rubric thành công',
      data: rubric.toJSON(),
    };
  }

  async updateRubric(
    tutorId: string,
    rubricId: string,
    payload: Partial<IRubric>
  ) {
    const rubric = await Rubric.findById(rubricId);
    if (!rubric) {
      throw new Error('Không tìm thấy rubric');
    }

    if (rubric.ownerId !== tutorId) {
      throw new Error('Bạn không có quyền chỉnh sửa rubric này');
    }

    Object.assign(rubric, payload);
    await rubric.save();

    return {
      success: true,
      message: 'Cập nhật rubric thành công',
      data: rubric.toJSON(),
    };
  }

  async deleteRubric(tutorId: string, rubricId: string) {
    const rubric = await Rubric.findById(rubricId);
    if (!rubric) {
      throw new Error('Không tìm thấy rubric');
    }

    if (rubric.ownerId !== tutorId) {
      throw new Error('Bạn không có quyền xóa rubric này');
    }

    await rubric.deleteOne();

    return {
      success: true,
      message: 'Đã xóa rubric',
    };
  }
}

export const rubricService = new RubricService();


