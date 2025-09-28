// Enum cho trạng thái xác thực của từng thông tin
export enum VerificationStatus {
  DRAFT = 'DRAFT', // Bản nháp (mới thêm)
  PENDING = 'PENDING', // Đang chờ xác thực
  VERIFIED = 'VERIFIED', // Đã được xác thực
  REJECTED = 'REJECTED', // Đã bị từ chối
  MODIFIED_PENDING = 'MODIFIED_PENDING', // Thông tin đã được xác thực trước đó đang chờ xác thực thay đổi
  MODIFIED_AFTER_REJECTION = 'MODIFIED_AFTER_REJECTION', // Thông tin bị từ chối đã được sửa đổi và cần xác thực lại
}

// Enum cho trạng thái yêu cầu xác thực
export enum RequestStatus {
  PENDING = 'PENDING', // Đang chờ xác thực
  APPROVED = 'APPROVED', // Đã được chấp nhận hoàn toàn
  PARTIALLY_APPROVED = 'PARTIALLY_APPROVED', // Chấp nhận một phần, từ chối một phần
  REJECTED = 'REJECTED', // Đã bị từ chối hoàn toàn
}

// Enum cho loại yêu cầu xác thực
export enum RequestType {
  NEW = 'NEW', // Thêm mới
  UPDATE = 'UPDATE', // Cập nhật
}

// Enum cho trình độ học vấn
export enum EducationLevel {
  HIGH_SCHOOL = 'HIGH_SCHOOL', // Trung học phổ thông
  BACHELOR = 'BACHELOR', // Cử nhân
  UNIVERSITY = 'UNIVERSITY', // Đại học
  ENGINEER = 'ENGINEER', // Kỹ sư
  DOCTOR = 'DOCTOR', // Tiến sĩ
  MASTER = 'MASTER', // Thạc sĩ
  OTHER = 'OTHER', // Khác
}

// Enum cho cấp độ thành tích
export enum AchievementLevel {
  INTERNATIONAL = 'INTERNATIONAL', // Quốc tế
  NATIONAL = 'NATIONAL', // Quốc gia
  REGIONAL = 'REGIONAL', // Khu vực
  LOCAL = 'LOCAL', // Địa phương
  INSTITUTIONAL = 'INSTITUTIONAL', // Cơ sở
}

// Enum cho loại thành tích
export enum AchievementType {
  COMPETITION = 'COMPETITION', // Cuộc thi
  AWARD = 'AWARD', // Giải thưởng
  RECOGNITION = 'RECOGNITION', // Công nhận
  SCHOLARSHIP = 'SCHOLARSHIP', // Học bổng
  OTHER = 'OTHER', // Khác
}
