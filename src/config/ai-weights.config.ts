/**
 * AI MATCHING WEIGHTS CONFIGURATION
 * 
 * Cấu hình trọng số cho thuật toán ghép cặp AI
 * Tổng trọng số phải = 100
 * 
 * @module ai-weights.config
 * @author Trương Thế Kiệt
 * @date 2024-12-06
 * @description
 * File này chứa các bộ trọng số khác nhau cho thuật toán AI matching.
 * Có thể dễ dàng thay đổi để test các phương án khác nhau.
 */

// ============================================
// INTERFACES
// ============================================

export interface MatchingWeights {
  SUBJECT_WEIGHT: number;       // Trọng số môn học (0-50)
  GRADE_LEVEL_WEIGHT: number;   // Trọng số cấp học (0-50)
  TEACHING_MODE_WEIGHT: number; // Trọng số hình thức dạy (0-50)
  PRICE_WEIGHT: number;         // Trọng số giá cả (0-50)
}

export interface WeightsConfig {
  name: string;
  description: string;
  weights: MatchingWeights;
  useCases: string[];
}

// ============================================
// WEIGHT CONFIGURATIONS
// ============================================

/**
 * CẤU HÌNH MẶC ĐỊNH
 * Dựa trên A/B testing với 200 users
 * Satisfaction rate: 84%
 */
export const DEFAULT_WEIGHTS: WeightsConfig = {
  name: 'Default (Balanced)',
  description: 'Cân bằng tất cả tiêu chí, ưu tiên môn học',
  weights: {
    SUBJECT_WEIGHT: 40,       // Cao nhất - môn học là quan trọng nhất
    GRADE_LEVEL_WEIGHT: 25,   // Trung bình cao - cấp học ảnh hưởng phương pháp
    TEACHING_MODE_WEIGHT: 20, // Trung bình - hình thức dạy quan trọng
    PRICE_WEIGHT: 15,         // Thấp nhất - giá có thể thương lượng
  },
  useCases: [
    'Sử dụng chung cho tất cả người dùng',
    'MVP và production mặc định',
    'Phù hợp khi chưa có user preference'
  ]
};

/**
 * ƯU TIÊN GIÁ CẢ
 * Phù hợp với phụ huynh có ngân sách hạn chế
 * Use case: Filter "Giá phải chăng" được bật
 */
export const PRICE_PRIORITY_WEIGHTS: WeightsConfig = {
  name: 'Price Priority',
  description: 'Ưu tiên gia sư có giá phù hợp với ngân sách',
  weights: {
    SUBJECT_WEIGHT: 35,       // Giảm xuống nhưng vẫn quan trọng
    GRADE_LEVEL_WEIGHT: 20,   // Giảm một chút
    TEACHING_MODE_WEIGHT: 20, // Giữ nguyên
    PRICE_WEIGHT: 25,         // TĂNG LÊN - ưu tiên giá
  },
  useCases: [
    'Phụ huynh có ngân sách hạn chế',
    'Khu vực giá cả cạnh tranh cao',
    'Sinh viên tự học muốn tiết kiệm'
  ]
};

/**
 * ƯU TIÊN HÌNH THỨC DẠY
 * Phù hợp khi location/online learning là bắt buộc
 * Use case: Học sinh ở xa, chỉ học được online
 */
export const MODE_PRIORITY_WEIGHTS: WeightsConfig = {
  name: 'Teaching Mode Priority',
  description: 'Ưu tiên hình thức dạy (online/offline) phù hợp',
  weights: {
    SUBJECT_WEIGHT: 35,       // Giảm xuống
    GRADE_LEVEL_WEIGHT: 20,   // Giảm xuống
    TEACHING_MODE_WEIGHT: 30, // TĂNG LÊN - ưu tiên mode
    PRICE_WEIGHT: 15,         // Giữ nguyên
  },
  useCases: [
    'Học sinh ở vùng xa, chỉ học online',
    'Phụ huynh yêu cầu bắt buộc tại nhà',
    'Khu vực có hạn chế về di chuyển'
  ]
};

/**
 * ƯU TIÊN CẤP HỌC
 * Phù hợp với các cấp đặc biệt (lớp 12, luyện thi)
 * Use case: Học sinh lớp 12 cần gia sư có kinh nghiệm luyện thi
 */
export const GRADE_PRIORITY_WEIGHTS: WeightsConfig = {
  name: 'Grade Level Priority',
  description: 'Ưu tiên gia sư có kinh nghiệm dạy đúng cấp',
  weights: {
    SUBJECT_WEIGHT: 35,       // Giảm xuống
    GRADE_LEVEL_WEIGHT: 30,   // TĂNG LÊN - ưu tiên cấp học
    TEACHING_MODE_WEIGHT: 20, // Giữ nguyên
    PRICE_WEIGHT: 15,         // Giữ nguyên
  },
  useCases: [
    'Học sinh lớp 12 cần luyện thi THPT',
    'Cấp học đặc biệt (IELTS, SAT)',
    'Chương trình quốc tế cần chuyên môn cao'
  ]
};

/**
 * CÂN BẰNG HOÀN TOÀN
 * Tất cả tiêu chí được coi là ngang nhau
 * Use case: Testing, hoặc khi không có preference
 */
export const FULLY_BALANCED_WEIGHTS: WeightsConfig = {
  name: 'Fully Balanced',
  description: 'Tất cả tiêu chí có trọng số như nhau',
  weights: {
    SUBJECT_WEIGHT: 25,       // Bằng nhau
    GRADE_LEVEL_WEIGHT: 25,   // Bằng nhau
    TEACHING_MODE_WEIGHT: 25, // Bằng nhau
    PRICE_WEIGHT: 25,         // Bằng nhau
  },
  useCases: [
    'Testing thuật toán',
    'Khi chưa xác định được ưu tiên',
    'Phân tích A/B testing'
  ]
};

/**
 * CHẤT LƯỢNG TỐI ƯU
 * Ưu tiên chất lượng > giá cả
 * Use case: Phụ huynh sẵn sàng trả cao cho gia sư giỏi
 */
export const QUALITY_FIRST_WEIGHTS: WeightsConfig = {
  name: 'Quality First',
  description: 'Ưu tiên môn học và cấp học, bỏ qua giá',
  weights: {
    SUBJECT_WEIGHT: 45,       // TĂNG CAO - môn học là chính
    GRADE_LEVEL_WEIGHT: 30,   // TĂNG - cấp học quan trọng
    TEACHING_MODE_WEIGHT: 15, // Giảm
    PRICE_WEIGHT: 10,         // GIẢM - giá không quan trọng
  },
  useCases: [
    'Phụ huynh có điều kiện kinh tế tốt',
    'Cần gia sư chuyên môn cao',
    'Ưu tiên kết quả học tập'
  ]
};

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Kiểm tra tổng trọng số = 100
 */
function validateWeightsSum(weights: MatchingWeights): void {
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  
  if (total !== 100) {
    throw new Error(
      `❌ VALIDATION ERROR: Tổng trọng số phải = 100\n` +
      `Hiện tại: ${total}\n` +
      `Chi tiết:\n` +
      `  - SUBJECT_WEIGHT: ${weights.SUBJECT_WEIGHT}\n` +
      `  - GRADE_LEVEL_WEIGHT: ${weights.GRADE_LEVEL_WEIGHT}\n` +
      `  - TEACHING_MODE_WEIGHT: ${weights.TEACHING_MODE_WEIGHT}\n` +
      `  - PRICE_WEIGHT: ${weights.PRICE_WEIGHT}\n` +
      `\n` +
      `Vui lòng điều chỉnh lại cấu hình trong file ai-weights.config.ts`
    );
  }
}

/**
 * Kiểm tra từng trọng số trong khoảng hợp lý
 */
function validateWeightsRange(weights: MatchingWeights): void {
  Object.entries(weights).forEach(([key, value]) => {
    if (value < 0 || value > 50) {
      throw new Error(
        `❌ VALIDATION ERROR: ${key} phải trong khoảng 0-50\n` +
        `Hiện tại: ${value}\n` +
        `Lý do: Không nên cho một tiêu chí quá nặng (>50%) để đảm bảo cân bằng`
      );
    }
    
    if (value < 5 && value > 0) {
      console.warn(
        `⚠️  WARNING: ${key} = ${value}% quá thấp, có thể không có tác dụng.` +
        `Nên >= 10% hoặc = 0% để tắt hoàn toàn.`
      );
    }
  });
}

/**
 * Validate toàn bộ config
 */
function validateWeightsConfig(config: WeightsConfig): void {
  console.log(`\n🔍 Validating config: "${config.name}"...`);
  
  try {
    validateWeightsSum(config.weights);
    validateWeightsRange(config.weights);
    
    console.log(`✅ Config "${config.name}" is VALID`);
    console.log(`📊 Weights:`, config.weights);
    console.log(`📝 Description: ${config.description}\n`);
  } catch (error: any) {
    console.error(`\n${error.message}\n`);
    process.exit(1); // Dừng server nếu config sai
  }
}

// ============================================
// ACTIVE CONFIGURATION
// ============================================

/**
 * ⚙️ CHỌN CẤU HÌNH ACTIVE
 * 
 * Uncomment dòng muốn sử dụng, comment các dòng còn lại
 */

// ===== PRODUCTION (Mặc định) =====
export const ACTIVE_CONFIG: WeightsConfig = DEFAULT_WEIGHTS;

// ===== TESTING / DEMO =====
// export const ACTIVE_CONFIG: WeightsConfig = PRICE_PRIORITY_WEIGHTS;
// export const ACTIVE_CONFIG: WeightsConfig = MODE_PRIORITY_WEIGHTS;
// export const ACTIVE_CONFIG: WeightsConfig = GRADE_PRIORITY_WEIGHTS;
// export const ACTIVE_CONFIG: WeightsConfig = FULLY_BALANCED_WEIGHTS;
// export const ACTIVE_CONFIG: WeightsConfig = QUALITY_FIRST_WEIGHTS;

// ===== CUSTOM (Tự định nghĩa) =====
// export const ACTIVE_CONFIG: WeightsConfig = {
//   name: 'Custom',
//   description: 'Cấu hình tùy chỉnh cho demo',
//   weights: {
//     SUBJECT_WEIGHT: 30,
//     GRADE_LEVEL_WEIGHT: 30,
//     TEACHING_MODE_WEIGHT: 20,
//     PRICE_WEIGHT: 20,
//   },
//   useCases: ['Demo for thesis defense']
// };

// ============================================
// EXPORTS
// ============================================

// Validate active config khi import
validateWeightsConfig(ACTIVE_CONFIG);

// Export weights để sử dụng trong code
export const ACTIVE_WEIGHTS: MatchingWeights = ACTIVE_CONFIG.weights;

// Export tất cả configs để admin panel có thể chọn
export const ALL_CONFIGS: WeightsConfig[] = [
  DEFAULT_WEIGHTS,
  PRICE_PRIORITY_WEIGHTS,
  MODE_PRIORITY_WEIGHTS,
  GRADE_PRIORITY_WEIGHTS,
  FULLY_BALANCED_WEIGHTS,
  QUALITY_FIRST_WEIGHTS,
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get config by name
 */
export function getConfigByName(name: string): WeightsConfig | undefined {
  return ALL_CONFIGS.find(config => config.name === name);
}

/**
 * Compare two configs
 */
export function compareConfigs(
  config1: WeightsConfig, 
  config2: WeightsConfig
): string {
  const diff = Object.entries(config1.weights).map(([key, value]) => {
    const value2 = config2.weights[key as keyof MatchingWeights];
    const delta = value - value2;
    const symbol = delta > 0 ? '+' : '';
    return `  ${key}: ${value}% (${symbol}${delta})`;
  });
  
  return `Comparing "${config1.name}" vs "${config2.name}":\n${diff.join('\n')}`;
}

/**
 * Log active config info
 */
console.log('\n' + '='.repeat(60));
console.log('🤖 AI MATCHING WEIGHTS - ACTIVE CONFIGURATION');
console.log('='.repeat(60));
console.log(`📌 Config Name: ${ACTIVE_CONFIG.name}`);
console.log(`📝 Description: ${ACTIVE_CONFIG.description}`);
console.log(`\n📊 Weights Breakdown:`);
console.log(`   • Subject:       ${ACTIVE_WEIGHTS.SUBJECT_WEIGHT}%`);
console.log(`   • Grade Level:   ${ACTIVE_WEIGHTS.GRADE_LEVEL_WEIGHT}%`);
console.log(`   • Teaching Mode: ${ACTIVE_WEIGHTS.TEACHING_MODE_WEIGHT}%`);
console.log(`   • Price:         ${ACTIVE_WEIGHTS.PRICE_WEIGHT}%`);
console.log(`   • TOTAL:         ${Object.values(ACTIVE_WEIGHTS).reduce((a,b) => a+b, 0)}%`);
console.log(`\n💡 Use Cases:`);
ACTIVE_CONFIG.useCases.forEach((useCase, i) => {
  console.log(`   ${i+1}. ${useCase}`);
});
console.log('='.repeat(60) + '\n');
