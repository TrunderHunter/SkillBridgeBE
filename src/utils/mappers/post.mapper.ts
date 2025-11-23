import { IPostResponse, IAuthorResponse } from '../../types/post.types';
import { PostType, PostStatus } from '../../models/Post';

export const mapPostToResponse = (post: any): IPostResponse => {
  // Safely handle author_id - can be null/undefined or populated object
  let authorId: string = '';
  if (post.author_id) {
    if (typeof post.author_id === 'object' && post.author_id._id) {
      authorId = post.author_id._id.toString();
    } else if (typeof post.author_id === 'string' || post.author_id.toString) {
      authorId = post.author_id.toString();
    }
  }

  const author: IAuthorResponse = {
    _id: authorId || 'unknown',
    full_name: post.author_id?.full_name || 'N/A',
    avatar: post.author_id?.avatar || ''
  };

  return {
    id: post._id?.toString() || post._id || '',
    title: post.title || '',
    content: post.content || '',
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