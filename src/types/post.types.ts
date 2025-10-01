import { PostStatus, PostType } from '../models/Post';

export interface IPostInput {
  title: string;
  content: string;
  subjects: string[];
  grade_levels: string[];
  location?: string;
  is_online?: boolean;
  hourly_rate?: {
    min: number;
    max: number;
  };
  availability?: string;
  requirements?: string;
  expiry_date?: Date;
}

export interface IAuthorResponse {
  _id: string;
  full_name: string;
  avatar: string;
}

export interface IPostResponse {
  id: string;
  title: string;
  content: string;
  type: PostType;
  author_id: IAuthorResponse;
  subjects: string[];
  grade_levels: string[];
  location?: string;
  is_online: boolean;
  hourly_rate?: {
    min: number;
    max: number;
  };
  availability?: string;
  requirements?: string;
  status: PostStatus;
  admin_note?: string;
  reviewed_at?: Date;
  reviewed_by?: string;
  expiry_date?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface IPostUpdateInput {
  title?: string;
  content?: string;
  subjects?: string[];
  grade_levels?: string[];
  location?: string;
  is_online?: boolean;
  hourly_rate?: {
    min: number;
    max: number;
  };
  availability?: string;
  requirements?: string;
  expiry_date?: Date;
}

export interface IPostReviewInput {
  status: PostStatus.APPROVED | PostStatus.REJECTED;
  admin_note?: string;
}

export interface IPostFilterOptions {
  status?: PostStatus;
  subjects?: string[];
  grade_levels?: string[];
  is_online?: boolean;
  author_id?: string;
  search_term?: string;
}

export interface IPostPaginationOptions {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}