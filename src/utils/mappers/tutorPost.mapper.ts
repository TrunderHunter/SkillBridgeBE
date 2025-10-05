import { ITutorPost } from '../../models/TutorPost';
import { IPostResponse } from '../../types/post.types';

export const mapTutorPostToResponse = (tutorPost: ITutorPost): IPostResponse => {
    return {
        id: tutorPost._id,
        title: tutorPost.title,
        content: tutorPost.description, 
        type: 'TUTOR_POST' as any, // ✅ Fix: Use string literal since TUTOR_POST doesn't exist in PostType enum
        author_id: {
            _id: typeof tutorPost.tutorId === 'object' ? (tutorPost.tutorId as any)._id : tutorPost.tutorId,
            full_name: typeof tutorPost.tutorId === 'object' ? (tutorPost.tutorId as any).full_name || '' : '',
            avatar: typeof tutorPost.tutorId === 'object' ? (tutorPost.tutorId as any).avatar_url || '' : ''
        },
        subjects: tutorPost.subjects,
        grade_levels: tutorPost.studentLevel, // ✅ Fix: ITutorPost có 'studentLevel', không có 'grade_levels'
        location: tutorPost.address?.province || tutorPost.address?.specificAddress || '', // ✅ Fix: ITutorPost có 'address', không có 'location'
        is_online: tutorPost.teachingMode === 'ONLINE' || tutorPost.teachingMode === 'BOTH', // ✅ Fix: Map từ 'teachingMode'
        hourly_rate: { min: tutorPost.pricePerSession, max: tutorPost.pricePerSession }, // ✅ Fix: ITutorPost có 'pricePerSession', không có 'hourly_rate'
        availability: tutorPost.teachingSchedule ? JSON.stringify(tutorPost.teachingSchedule) : '',
        requirements: tutorPost.description || '',
        status: tutorPost.status as any, // Map tutor post status to PostStatus
        admin_note: undefined,
        reviewed_at: undefined,
        reviewed_by: undefined,
        expiry_date: undefined,
        created_at: tutorPost.createdAt, // ✅ Fix: Sử dụng 'created_at' thay vì 'createdAt'
        updated_at: tutorPost.updatedAt, // ✅ Fix: Sử dụng 'updated_at' thay vì 'updatedAt'
    };
};

// Additional mapping functions can be added here as needed.