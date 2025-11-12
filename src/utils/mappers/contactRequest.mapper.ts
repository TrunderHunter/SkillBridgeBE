import { IContactRequest } from '../../models/ContactRequest';

/**
 * Transform contact request from backend format to frontend format
 * Maps: tutorId -> tutor, tutorPostId -> tutorPost, subject -> subjectInfo
 */
export const mapContactRequestToResponse = (request: any): any => {
    // Handle both Mongoose documents and plain objects (from .lean())
    const mapped: any = {
        ...(request.toObject ? request.toObject() : request),
    };

    // Normalize id (ensure all consumers can rely on `id`)
    if (!mapped.id && mapped._id) {
        mapped.id = mapped._id.toString();
    }

    // Map tutorId -> tutor
    // Also ensure tutorId is always a string for comparison
    if (mapped.tutorId) {
        if (typeof mapped.tutorId === 'object' && mapped.tutorId !== null) {
            const tutorIdString = mapped.tutorId._id || mapped.tutorId.id || mapped.tutorId;
            mapped.tutor = {
                id: tutorIdString,
                full_name: mapped.tutorId.full_name || '',
                avatar_url: mapped.tutorId.avatar_url,
                phone_number: mapped.tutorId.phone_number,
                email: mapped.tutorId.email,
            };
            // Keep tutorId as string for comparison
            mapped.tutorId = tutorIdString;
        } else {
            // If tutorId is just a string, keep it but also add tutor as null
            mapped.tutor = null;
        }
    }

    // Map studentId -> student (if populated)
    // Also ensure studentId is always a string for comparison
    if (mapped.studentId && typeof mapped.studentId === 'object' && mapped.studentId !== null) {
        const studentIdString = mapped.studentId._id || mapped.studentId.id || mapped.studentId;
        mapped.student = {
            id: studentIdString,
            full_name: mapped.studentId.full_name || '',
            avatar_url: mapped.studentId.avatar_url,
            phone_number: mapped.studentId.phone_number,
            email: mapped.studentId.email,
        };
        // Keep studentId as string for comparison
        mapped.studentId = studentIdString;
    }

    // Map tutorPostId -> tutorPost
    if (mapped.tutorPostId) {
        if (typeof mapped.tutorPostId === 'object' && mapped.tutorPostId !== null) {
            mapped.tutorPost = {
                id: mapped.tutorPostId._id || mapped.tutorPostId.id || mapped.tutorPostId,
                title: mapped.tutorPostId.title || '',
                description: mapped.tutorPostId.description,
                pricePerSession: mapped.tutorPostId.pricePerSession,
                sessionDuration: mapped.tutorPostId.sessionDuration,
            };
        } else {
            mapped.tutorPost = null;
        }
    }

    // Map studentPostId -> studentPost (when tutor initiates request)
    if (mapped.studentPostId) {
        if (typeof mapped.studentPostId === 'object' && mapped.studentPostId !== null) {
            mapped.studentPost = {
                id: mapped.studentPostId._id || mapped.studentPostId.id || mapped.studentPostId,
                title: mapped.studentPostId.title || '',
                content: mapped.studentPostId.content,
                subjects: mapped.studentPostId.subjects || [],
                grade_levels: mapped.studentPostId.grade_levels || [],
                hourly_rate: mapped.studentPostId.hourly_rate,
                is_online: mapped.studentPostId.is_online,
            };
        } else {
            mapped.studentPost = null;
        }
    }

    // Map subject -> subjectInfo
    if (mapped.subject) {
        if (typeof mapped.subject === 'object' && mapped.subject !== null) {
            mapped.subjectInfo = {
                id: mapped.subject._id || mapped.subject.id || mapped.subject,
                name: mapped.subject.name || '',
            };
        } else {
            mapped.subjectInfo = null;
        }
    }

    return mapped;
};

