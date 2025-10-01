import { Subject, ISubject } from '../../models/Subject';
import { Types } from 'mongoose';

export interface ICreateSubjectInput {
  name: string;
  description?: string;
  category: string;
}

export interface IUpdateSubjectInput {
  name?: string;
  description?: string;
  category?: string;
  isActive?: boolean;
}

export interface ISubjectQuery {
  category?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export class SubjectService {
  async createSubject(data: ICreateSubjectInput): Promise<ISubject> {
    try {
      const subject = new Subject(data);
      return await subject.save();
    } catch (error) {
      if (error instanceof Error && error.message.includes('duplicate key')) {
        throw new Error('Subject name already exists');
      }
      throw error;
    }
  }

  async getAllSubjects(query: ISubjectQuery = {}) {
    try {
      const { category, isActive = true, search, page = 1, limit = 50 } = query;

      // Build filter
      const filter: any = { isActive };

      if (category) {
        filter.category = category;
      }

      if (search) {
        filter.$text = { $search: search };
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Execute query
      const subjects = await Subject.find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit);

      const total = await Subject.countDocuments(filter);

      return {
        subjects,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async getSubjectById(id: string): Promise<ISubject | null> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new Error('Invalid subject ID');
      }
      return await Subject.findById(id);
    } catch (error) {
      throw error;
    }
  }

  async updateSubject(
    id: string,
    data: IUpdateSubjectInput
  ): Promise<ISubject | null> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new Error('Invalid subject ID');
      }

      const subject = await Subject.findByIdAndUpdate(
        id,
        { $set: data },
        { new: true, runValidators: true }
      );

      return subject;
    } catch (error) {
      if (error instanceof Error && error.message.includes('duplicate key')) {
        throw new Error('Subject name already exists');
      }
      throw error;
    }
  }

  async deleteSubject(id: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new Error('Invalid subject ID');
      }

      // Soft delete - set isActive to false
      const result = await Subject.findByIdAndUpdate(
        id,
        { $set: { isActive: false } },
        { new: true }
      );

      return result !== null;
    } catch (error) {
      throw error;
    }
  }

  async getActiveSubjects(): Promise<ISubject[]> {
    try {
      return await Subject.find({ isActive: true }).sort({
        category: 1,
        name: 1,
      });
    } catch (error) {
      throw error;
    }
  }

  async getSubjectsByCategory(category: string): Promise<ISubject[]> {
    try {
      return await Subject.find({ category, isActive: true }).sort({ name: 1 });
    } catch (error) {
      throw error;
    }
  }

  async searchSubjects(searchTerm: string): Promise<ISubject[]> {
    try {
      return await Subject.find({
        $text: { $search: searchTerm },
        isActive: true,
      }).sort({ score: { $meta: 'textScore' } });
    } catch (error) {
      throw error;
    }
  }
}

export const subjectService = new SubjectService();
