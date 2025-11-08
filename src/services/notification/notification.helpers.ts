import NotificationService from './notification.service';

/**
 * Helper functions to send notifications for specific events
 */

export const notifyContactRequestSent = async (tutorId: string, studentName: string, requestId: string) => {
  await NotificationService.sendNotification({
    type: 'socket',
    userId: tutorId,
    notificationType: 'CONTACT_REQUEST',
    title: 'Yêu cầu học mới',
    message: `${studentName} đã gửi yêu cầu học cho bạn`,
    priority: 'high',
    actionUrl: `/tutor/contact-requests`,
    data: { requestId, studentName },
  });
};

export const notifyContactRequestResponded = async (
  studentId: string,
  tutorName: string,
  action: 'ACCEPT' | 'REJECT',
  requestId: string
) => {
  const message = action === 'ACCEPT' 
    ? `${tutorName} đã chấp nhận yêu cầu học của bạn`
    : `${tutorName} đã từ chối yêu cầu học của bạn`;

  await NotificationService.sendNotification({
    type: 'socket',
    userId: studentId,
    notificationType: 'CONTACT_REQUEST',
    title: action === 'ACCEPT' ? 'Yêu cầu được chấp nhận' : 'Yêu cầu bị từ chối',
    message,
    priority: 'high',
    actionUrl: `/student/contact-requests`,
    data: { requestId, tutorName, action },
  });
};

export const notifyClassCreated = async (
  studentId: string,
  tutorName: string,
  className: string,
  classId: string
) => {
  await NotificationService.sendNotification({
    type: 'socket',
    userId: studentId,
    notificationType: 'CLASS_CREATED',
    title: 'Lớp học mới được tạo',
    message: `${tutorName} đã tạo lớp học "${className}"`,
    priority: 'high',
    actionUrl: `/student/classes/${classId}`,
    data: { classId, className, tutorName },
  });
};

export const notifyAttendanceMarked = async (
  recipientId: string,
  markerName: string,
  className: string,
  sessionNumber: number,
  classId: string
) => {
  await NotificationService.sendNotification({
    type: 'socket',
    userId: recipientId,
    notificationType: 'ATTENDANCE_MARKED',
    title: 'Điểm danh buổi học',
    message: `${markerName} đã điểm danh buổi ${sessionNumber} - ${className}`,
    priority: 'normal',
    actionUrl: `/schedule/calendar`,
    data: { classId, sessionNumber, className, markerName },
  });
};

export const notifyHomeworkAssigned = async (
  studentId: string,
  tutorName: string,
  className: string,
  homeworkTitle: string,
  deadline: string,
  classId: string,
  sessionNumber: number
) => {
  await NotificationService.sendNotification({
    type: 'socket',
    userId: studentId,
    notificationType: 'HOMEWORK_ASSIGNED',
    title: 'Bài tập mới',
    message: `${tutorName} đã giao bài tập "${homeworkTitle}" cho lớp ${className}`,
    priority: 'high',
    actionUrl: `/schedule/calendar`,
    data: { classId, sessionNumber, className, homeworkTitle, deadline },
  });
};

export const notifyHomeworkSubmitted = async (
  tutorId: string,
  studentName: string,
  className: string,
  classId: string,
  sessionNumber: number
) => {
  await NotificationService.sendNotification({
    type: 'socket',
    userId: tutorId,
    notificationType: 'HOMEWORK_SUBMITTED',
    title: 'Bài tập mới được nộp',
    message: `${studentName} đã nộp bài tập buổi ${sessionNumber} - ${className}`,
    priority: 'normal',
    actionUrl: `/schedule/calendar`,
    data: { classId, sessionNumber, className, studentName },
  });
};

export const notifyHomeworkGraded = async (
  studentId: string,
  tutorName: string,
  className: string,
  score: number,
  classId: string,
  sessionNumber: number
) => {
  await NotificationService.sendNotification({
    type: 'socket',
    userId: studentId,
    notificationType: 'HOMEWORK_GRADED',
    title: 'Bài tập đã được chấm',
    message: `${tutorName} đã chấm bài tập buổi ${sessionNumber} - ${className}. Điểm: ${score}/10`,
    priority: 'high',
    actionUrl: `/schedule/calendar`,
    data: { classId, sessionNumber, className, score },
  });
};

export const notifyCancellationRequested = async (
  recipientId: string,
  requesterName: string,
  className: string,
  sessionNumber: number,
  reason: string,
  classId: string
) => {
  await NotificationService.sendNotification({
    type: 'socket',
    userId: recipientId,
    notificationType: 'CANCELLATION_REQUESTED',
    title: 'Yêu cầu huỷ buổi học',
    message: `${requesterName} yêu cầu huỷ buổi ${sessionNumber} - ${className}`,
    priority: 'high',
    actionUrl: `/schedule/calendar`,
    data: { classId, sessionNumber, className, reason },
  });
};

export const notifyCancellationResponded = async (
  requesterId: string,
  responderName: string,
  action: 'APPROVED' | 'REJECTED',
  className: string,
  sessionNumber: number,
  classId: string
) => {
  const message = action === 'APPROVED'
    ? `${responderName} đã chấp nhận huỷ buổi ${sessionNumber} - ${className}`
    : `${responderName} đã từ chối huỷ buổi ${sessionNumber} - ${className}`;

  await NotificationService.sendNotification({
    type: 'socket',
    userId: requesterId,
    notificationType: 'CANCELLATION_RESPONDED',
    title: action === 'APPROVED' ? 'Yêu cầu được chấp nhận' : 'Yêu cầu bị từ chối',
    message,
    priority: 'high',
    actionUrl: `/schedule/calendar`,
    data: { classId, sessionNumber, className, action },
  });
};

export const notifyNewMessage = async (
  recipientId: string,
  senderName: string,
  messagePreview: string,
  conversationId: string
) => {
  await NotificationService.sendNotification({
    type: 'socket',
    userId: recipientId,
    notificationType: 'MESSAGE',
    title: `Tin nhắn từ ${senderName}`,
    message: messagePreview.length > 50 ? messagePreview.substring(0, 50) + '...' : messagePreview,
    priority: 'normal',
    actionUrl: `/messages/${conversationId}`,
    data: { conversationId, senderName },
  });
};
