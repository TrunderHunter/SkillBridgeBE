import { IPostResponse, IAuthorResponse } from '../../types/post.types';
import { PostType, PostStatus } from '../../models/Post';

export const mapPostToResponse = (post: any): IPostResponse => {
  const author: IAuthorResponse = {
    _id: post.author_id?._id?.toString() || post.author_id.toString(),
    full_name: post.author_id?.full_name || 'N/A',
    avatar: post.author_id?.avatar || ''
  };

  return {
    id: post._id.toString(),
    title: post.title,
    content: post.content,
    type: post.type as PostType,
    author_id: author,
    subjects: post.subjects || [],
    grade_levels: post.grade_levels || [],
    location: post.location,
    is_online: post.is_online ?? false,
    hourly_rate: post.hourly_rate,
    availability: post.availability,
    requirements: post.requirements,
    status: post.status as PostStatus,
    admin_note: post.admin_note,
    reviewed_at: post.reviewed_at,
    reviewed_by: post.reviewed_by,
    expiry_date: post.expiry_date,
    created_at: post.created_at,
    updated_at: post.updated_at,
  };
};