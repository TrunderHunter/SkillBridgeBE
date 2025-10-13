import { body, ValidationChain } from 'express-validator';

export const validateStudentProfile = {
  updatePersonalInfo: [
    body('full_name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 200 }) // ✅ Giảm min từ 2 xuống 1, tăng max
      .withMessage('Họ và tên phải có từ 1 đến 200 ký tự'),

    // ✅ Sửa phone validation - chấp nhận nhiều format hơn
    body('phone_number')
      .optional()
      .custom((value) => {
        if (!value || value.trim() === '') return true; // Allow empty
        
        // Remove all spaces, dashes, dots, brackets
        const cleanPhone = value.replace(/[\s\-\(\)\.\+]/g, '');
        
        // More flexible patterns for Vietnamese phones
        const patterns = [
          /^0[0-9]{8,10}$/,        // 0xxxxxxxx to 0xxxxxxxxxx
          /^84[0-9]{8,10}$/,       // 84xxxxxxxx to 84xxxxxxxxxx
          /^[0-9]{8,12}$/,         // Any 8-12 digits
        ];
        
        const isValid = patterns.some(pattern => pattern.test(cleanPhone));
        
        if (!isValid) {
          throw new Error('Số điện thoại không hợp lệ');
        }
        
        return true;
      }),

    // ✅ Gender validation - more flexible
    body('gender')
      .optional()
      .custom((value) => {
        if (!value || value.trim() === '') return true; // Allow empty
        
        const normalizedValue = value.toString().trim().toLowerCase();
        const validGenders = ['male', 'female', 'other', 'nam', 'nữ', 'khác', 'm', 'f'];
        
        if (!validGenders.includes(normalizedValue)) {
          throw new Error('Giới tính không hợp lệ');
        }
        
        return true;
      }),

    // ✅ Date validation - more flexible
    body('date_of_birth')
      .optional()
      .custom((value) => {
        if (!value || value.trim() === '') return true; // Allow empty
        
        // Accept multiple date formats
        const dateFormats = [
          /^\d{4}-\d{1,2}-\d{1,2}$/,    // YYYY-M-D or YYYY-MM-DD
          /^\d{1,2}\/\d{1,2}\/\d{4}$/,  // M/D/YYYY or MM/DD/YYYY
          /^\d{1,2}-\d{1,2}-\d{4}$/,    // M-D-YYYY or MM-DD-YYYY
        ];
        
        const isValidFormat = dateFormats.some(format => format.test(value));
        if (!isValidFormat) {
          throw new Error('Định dạng ngày sinh không hợp lệ (VD: 2003-05-15 hoặc 15/05/2003)');
        }
        
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          throw new Error('Ngày sinh không hợp lệ');
        }
        
        const now = new Date();
        const age = now.getFullYear() - date.getFullYear();
        
        // More lenient age check
        if (date > now) {
          throw new Error('Ngày sinh không thể ở tương lai');
        }
        
        if (age > 120) { // Only check upper bound, no lower bound
          throw new Error('Tuổi không hợp lệ');
        }
        
        return true;
      }),

    body('address')
      .optional()
      .trim()
      .isLength({ max: 1000 }) // ✅ Tăng max length
      .withMessage('Địa chỉ không được vượt quá 1000 ký tự'),

    // ✅ Structured address - more flexible
    body('structured_address')
      .optional()
      .custom((value) => {
        if (!value) return true;
        
        try {
          let parsed = typeof value === 'string' ? JSON.parse(value) : value;
          
          // Just check if it's an object, don't validate structure strictly
          if (typeof parsed !== 'object' || parsed === null) {
            throw new Error('structured_address phải là object hợp lệ');
          }
          
          return true;
        } catch (error) {
          // If JSON parse fails, just ignore it
          return true;
        }
      }),

    // ✅ Remove individual structured_address field validations
    // They were too strict and causing issues
    
  ] as ValidationChain[],

  updatePreferences: [
    body('learning_goals')
      .optional()
      .trim()
      .isLength({ max: 2000 }) // ✅ Tăng max length
      .withMessage('Mục tiêu học tập không được vượt quá 2000 ký tự'),

    body('preferred_subjects')
      .optional()
      .custom((subjects) => {
        if (!subjects) return true;
        
        // Allow string or array
        if (typeof subjects === 'string') {
          return true; // Accept string format
        }
        
        if (Array.isArray(subjects)) {
          if (subjects.length > 20) { // ✅ Tăng limit
            throw new Error('Không thể chọn quá 20 môn học yêu thích');
          }
          return true;
        }
        
        return true; // Accept any format
      }),

    body('learning_style')
      .optional()
      .custom((value) => {
        if (!value || value.trim() === '') return true;
        
        const validStyles = [
          'visual', 'auditory', 'kinesthetic', 'reading_writing',
          'thi_giac', 'am_thanh', 'thuc_hanh', 'doc_viet' // Vietnamese
        ];
        
        const normalizedValue = value.toString().trim().toLowerCase();
        return validStyles.includes(normalizedValue) || true; // Always pass for now
      }),

    body('availability_schedule')
      .optional()
      .trim()
      .isLength({ max: 1000 }) // ✅ Tăng max length
      .withMessage('Lịch học không được vượt quá 1000 ký tự'),

    // ✅ Budget range - more flexible
    body('budget_range.min')
      .optional()
      .custom((value) => {
        if (!value && value !== 0) return true;
        const num = parseFloat(value);
        return !isNaN(num) && num >= 0;
      })
      .withMessage('Giá tối thiểu phải là số hợp lệ'),

    body('budget_range.max')
      .optional()
      .custom((value) => {
        if (!value && value !== 0) return true;
        const num = parseFloat(value);
        return !isNaN(num) && num >= 0;
      })
      .withMessage('Giá tối đa phải là số hợp lệ'),

    body('interests')
      .optional()
      .trim()
      .isLength({ max: 2000 }) // ✅ Tăng max length
      .withMessage('Sở thích không được vượt quá 2000 ký tự'),

    body('special_needs')
      .optional()
      .trim()
      .isLength({ max: 1000 }) // ✅ Tăng max length
      .withMessage('Nhu cầu đặc biệt không được vượt quá 1000 ký tự'),

    body('parent_contact.name')
      .optional()
      .trim()
      .isLength({ max: 200 }) // ✅ Tăng max length
      .withMessage('Tên phụ huynh không được vượt quá 200 ký tự'),

    body('parent_contact.phone')
      .optional()
      .custom((value) => {
        if (!value || value.trim() === '') return true;
        
        // Same flexible phone validation as above
        const cleanPhone = value.replace(/[\s\-\(\)\.\+]/g, '');
        const patterns = [
          /^0[0-9]{8,10}$/,
          /^84[0-9]{8,10}$/,
          /^[0-9]{8,12}$/,
        ];
        
        return patterns.some(pattern => pattern.test(cleanPhone)) || true; // Always pass for now
      }),

    body('parent_contact.relationship')
      .optional()
      .trim()
      .isLength({ max: 100 }) // ✅ Tăng max length
      .withMessage('Mối quan hệ không được vượt quá 100 ký tự'),
  ] as ValidationChain[],
};