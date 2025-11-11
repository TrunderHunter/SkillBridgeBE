/**
 * Utility để lọc và kiểm tra nội dung tin nhắn có chứa thông tin liên lạc bên ngoài
 * Mục đích: Ngăn chặn học viên và gia sư trao đổi thông tin liên lạc để dạy riêng
 */

// Danh sách từ khóa nhạy cảm cần lọc
const SENSITIVE_KEYWORDS = [
    // Số điện thoại (các biến thể)
    'sđt', 'sdt', 'số điện thoại', 'phone', 'tel', 'mobile',
    'điện thoại', 'hotline', 'call me', 'gọi cho', 'gọi tôi',
    'số của', 'số mình', 'số em', 'số anh', 'số chị', 'số bạn',
    'số tôi', 'số ta', 'số của tôi', 'số của mình', 'số của em',
    'cho xin số', 'xin số', 'cho số', 'gửi số', 'share số',

    // Thông tin liên lạc
    'thông tin liên lạc', 'thông tin em liên lạc', 'thông tin mình liên lạc',
    'thông tin liên hệ', 'thông tin em liên hệ', 'thông tin mình liên hệ',
    'cho xin thông tin', 'xin thông tin', 'cho thông tin', 'gửi thông tin',
    'liên lạc', 'liên hệ', 'contact info', 'contact information',

    // Zalo
    'zalo', 'zaloo', 'zalo id', 'zalo id:', 'zalo:', 'id zalo',
    'số zalo', 'zalo của', 'zalo tôi', 'zalo mình', 'zalo em', 'zalo anh',
    'zalo chị', 'zalo bạn', 'cho xin zalo', 'xin zalo', 'gửi zalo',

    // Facebook
    'facebook', 'fb', 'fb.com', 'facebook.com', 'facebook:', 'fb:',
    'facebook id', 'fb id', 'tìm trên fb', 'tìm facebook',
    'facebook của', 'fb của', 'cho xin fb', 'xin fb', 'gửi fb',

    // Email
    'email', 'e-mail', 'mail', 'gmail', 'gmail.com', 'yahoo.com',
    'outlook.com', 'email của', 'email tôi', 'mail của', 'email em',
    'email mình', 'cho xin email', 'xin email', 'gửi email',

    // Telegram, Viber, Line
    'telegram', 'tele', 'viber', 'line', 'line id', 'telegram id',
    'cho xin telegram', 'xin telegram', 'gửi telegram',

    // Instagram, TikTok
    'instagram', 'ig', 'tiktok', 'tik tok', 'instagram id',

    // WeChat, QQ
    'wechat', 'we chat', 'qq', 'qq id',

    // Skype
    'skype', 'skype id',

    // Các từ khóa về trao đổi bên ngoài
    'liên hệ trực tiếp', 'liên hệ ngoài', 'liên lạc ngoài', 'liên lạc riêng',
    'liên hệ riêng', 'liên lạc trực tiếp', 'liên hệ bên ngoài',
    'dạy riêng', 'dạy ngoài', 'dạy bên ngoài', 'dạy trực tiếp',
    'học riêng', 'học ngoài', 'học bên ngoài', 'học trực tiếp',
    'ngoài hệ thống', 'bên ngoài', 'ngoài app', 'ngoài platform',
    'trao đổi ngoài', 'trao đổi riêng', 'trao đổi trực tiếp',
    'làm việc ngoài', 'làm việc riêng', 'hợp tác ngoài',
    'contact me', 'contact', 'reach me', 'reach out', 'get in touch',
    'private contact', 'direct contact', 'outside contact',

    // Các từ khóa yêu cầu/xin
    'cho xin', 'xin', 'cho em xin', 'cho mình xin', 'cho tôi xin',
    'gửi cho', 'gửi em', 'gửi mình', 'share', 'chia sẻ',
];

// Pattern để phát hiện số điện thoại Việt Nam (10-11 chữ số)
// Hỗ trợ nhiều định dạng: 0865982103, 0865-982-103, 0865.982.103, 0865 982 103, +84865982103
// Pattern 1: Số điện thoại có dấu phân cách (gạch ngang, chấm, khoảng trắng)
const PHONE_PATTERN_FORMATTED = /(?:0|\+84)[\s\-\.]?[3-9][\s\-\.]?\d{2,4}[\s\-\.]?\d{2,4}[\s\-\.]?\d{2,4}/g;

// Pattern 2: Số điện thoại liền (không có dấu phân cách)
const PHONE_PATTERN_PLAIN = /(?:0|\+84)[3-9]\d{8,9}/g;

// Pattern 3: Số điện thoại có thể thiếu số 0 đầu (9-10 chữ số)
const PHONE_PATTERN_NO_ZERO = /\b[3-9]\d{8,9}\b/g;

// Pattern để phát hiện email
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Pattern để phát hiện URL (facebook.com, zalo.me, v.v.)
const URL_PATTERN = /(?:https?:\/\/)?(?:www\.)?(?:facebook|zalo|telegram|viber|line|instagram|tiktok|wechat|skype)\.(?:com|me|net|org|vn)[^\s]*/gi;

// Pattern để phát hiện ID số (zalo id, telegram id, v.v.)
const ID_PATTERN = /(?:zalo|telegram|viber|line|instagram|facebook|fb|skype|wechat|qq)\s*(?:id|số|number)?\s*:?\s*\d{6,}/gi;

export interface ContentFilterResult {
    isValid: boolean;
    violations: string[];
    sanitizedContent?: string;
}

/**
 * Kiểm tra và lọc nội dung tin nhắn
 * @param content Nội dung tin nhắn cần kiểm tra
 * @param strictMode Nếu true, từ chối hoàn toàn. Nếu false, chỉ cảnh báo (có thể dùng để sanitize)
 * @returns Kết quả kiểm tra
 */
export function filterSensitiveContent(
    content: string,
    strictMode: boolean = true
): ContentFilterResult {
    const violations: string[] = [];
    const normalizedContent = content.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Loại bỏ dấu để so sánh tốt hơn

    // 1. Kiểm tra từ khóa nhạy cảm
    for (const keyword of SENSITIVE_KEYWORDS) {
        const normalizedKeyword = keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (normalizedContent.includes(normalizedKeyword)) {
            violations.push(`Chứa từ khóa nhạy cảm: "${keyword}"`);
        }
    }

    // 1.1. Kiểm tra các cụm từ kết hợp (ví dụ: "liên lạc" + "ngoài", "cho xin" + "số")
    const contactOutsidePatterns = [
        /liên\s*lạc\s+(?:ngoài|riêng|trực\s*tiếp|bên\s*ngoài)/gi,
        /liên\s*hệ\s+(?:ngoài|riêng|trực\s*tiếp|bên\s*ngoài)/gi,
        /(?:cho\s*xin|xin)\s+(?:số|thông\s*tin|zalo|fb|facebook|email|telegram|viber|line)/gi,
        /(?:gửi|share|chia\s*sẻ)\s+(?:số|thông\s*tin|zalo|fb|facebook|email|telegram|viber|line)/gi,
        /(?:dạy|học|trao\s*đổi|hợp\s*tác)\s+(?:riêng|ngoài|bên\s*ngoài|trực\s*tiếp)/gi,
    ];

    for (const pattern of contactOutsidePatterns) {
        if (pattern.test(content)) {
            violations.push(`Chứa cụm từ nhạy cảm về trao đổi bên ngoài`);
            break; // Chỉ thêm một lần
        }
    }

    // 2. Kiểm tra số điện thoại (nhiều pattern để bắt các trường hợp)
    const phoneMatches1 = content.match(PHONE_PATTERN_FORMATTED);
    const phoneMatches2 = content.match(PHONE_PATTERN_PLAIN);
    const phoneMatches3 = content.match(PHONE_PATTERN_NO_ZERO);

    // Lọc và hợp nhất các kết quả, loại bỏ trùng lặp
    const allPhoneMatches = new Set<string>();

    // Hàm kiểm tra và thêm số điện thoại hợp lệ
    const addIfValidPhone = (match: string) => {
        const cleaned = match.replace(/[\s\-\.\+]/g, '');
        // Kiểm tra số điện thoại Việt Nam hợp lệ
        if (cleaned.startsWith('0') && cleaned.length === 10 && /^0[3-9]/.test(cleaned)) {
            allPhoneMatches.add(match.trim());
        } else if (cleaned.startsWith('84') && cleaned.length === 11 && /^84[3-9]/.test(cleaned)) {
            allPhoneMatches.add(match.trim());
        } else if (cleaned.length === 9 && /^[3-9]/.test(cleaned)) {
            // Số điện thoại thiếu số 0 đầu (9 chữ số, bắt đầu bằng 3-9)
            allPhoneMatches.add(match.trim());
        }
    };

    if (phoneMatches1) phoneMatches1.forEach(addIfValidPhone);
    if (phoneMatches2) phoneMatches2.forEach(addIfValidPhone);
    if (phoneMatches3) phoneMatches3.forEach(addIfValidPhone);

    if (allPhoneMatches.size > 0) {
        violations.push(`Chứa số điện thoại: ${Array.from(allPhoneMatches).join(', ')}`);
    }

    // 3. Kiểm tra email
    const emailMatches = content.match(EMAIL_PATTERN);
    if (emailMatches && emailMatches.length > 0) {
        violations.push(`Chứa địa chỉ email: ${emailMatches.join(', ')}`);
    }

    // 4. Kiểm tra URL nhạy cảm
    const urlMatches = content.match(URL_PATTERN);
    if (urlMatches && urlMatches.length > 0) {
        violations.push(`Chứa liên kết mạng xã hội: ${urlMatches.join(', ')}`);
    }

    // 5. Kiểm tra ID số
    const idMatches = content.match(ID_PATTERN);
    if (idMatches && idMatches.length > 0) {
        violations.push(`Chứa ID liên hệ: ${idMatches.join(', ')}`);
    }

    // Nếu có vi phạm và ở chế độ strict, từ chối
    if (violations.length > 0 && strictMode) {
        return {
            isValid: false,
            violations,
        };
    }

    // Nếu không strict, có thể sanitize (thay thế bằng ký tự đặc biệt)
    let sanitizedContent = content;
    if (violations.length > 0 && !strictMode) {
        // Thay thế số điện thoại (tất cả các pattern)
        sanitizedContent = sanitizedContent.replace(PHONE_PATTERN_FORMATTED, '***');
        sanitizedContent = sanitizedContent.replace(PHONE_PATTERN_PLAIN, '***');
        sanitizedContent = sanitizedContent.replace(PHONE_PATTERN_NO_ZERO, (match) => {
            const cleaned = match.replace(/[\s\-\.]/g, '');
            if (cleaned.length === 9 && /^[3-9]/.test(cleaned)) {
                return '***';
            }
            return match;
        });
        // Thay thế email
        sanitizedContent = sanitizedContent.replace(EMAIL_PATTERN, '***');
        // Thay thế URL
        sanitizedContent = sanitizedContent.replace(URL_PATTERN, '***');
        // Thay thế ID
        sanitizedContent = sanitizedContent.replace(ID_PATTERN, (match) => {
            return match.replace(/\d+/g, '***');
        });
    }

    return {
        isValid: violations.length === 0,
        violations,
        sanitizedContent: violations.length > 0 ? sanitizedContent : undefined,
    };
}

/**
 * Kiểm tra nhanh xem nội dung có vi phạm không (không trả về chi tiết)
 */
export function hasSensitiveContent(content: string): boolean {
    const result = filterSensitiveContent(content, true);
    return !result.isValid;
}

/**
 * Lấy thông báo lỗi thân thiện cho người dùng
 */
export function getFilterErrorMessage(violations: string[]): string {
    if (violations.length === 0) {
        return '';
    }

    return 'Tin nhắn của bạn chứa thông tin liên lạc không được phép. Vui lòng không chia sẻ số điện thoại, email, Zalo, Facebook hoặc các thông tin liên hệ bên ngoài hệ thống.';
}

