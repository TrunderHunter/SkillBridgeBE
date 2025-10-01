import mongoose from 'mongoose';
import { Subject } from '../models/Subject';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const initialSubjects = [
  {
    name: 'Toán',
    category: 'TOAN_HOC',
    description: 'Môn Toán học cơ bản và nâng cao',
  },
  {
    name: 'Vật lý',
    category: 'KHOA_HOC_TU_NHIEN',
    description: 'Môn Vật lý từ cơ bản đến nâng cao',
  },
  {
    name: 'Hóa học',
    category: 'KHOA_HOC_TU_NHIEN',
    description: 'Môn Hóa học từ cơ bản đến nâng cao',
  },
  {
    name: 'Sinh học',
    category: 'KHOA_HOC_TU_NHIEN',
    description: 'Môn Sinh học từ cơ bản đến nâng cao',
  },
  {
    name: 'Ngữ văn',
    category: 'VAN_HOC_XA_HOI',
    description: 'Môn Ngữ văn Việt Nam',
  },
  {
    name: 'Lịch sử',
    category: 'VAN_HOC_XA_HOI',
    description: 'Môn Lịch sử Việt Nam và thế giới',
  },
  {
    name: 'Địa lý',
    category: 'VAN_HOC_XA_HOI',
    description: 'Môn Địa lý tự nhiên và kinh tế xã hội',
  },
  {
    name: 'Giáo dục công dân',
    category: 'VAN_HOC_XA_HOI',
    description: 'Môn Giáo dục công dân và pháp luật',
  },
  {
    name: 'Tiếng Anh (IELTS/TOEFL/TOEIC)',
    category: 'NGOAI_NGU',
    description: 'Tiếng Anh giao tiếp và các chứng chỉ quốc tế',
  },
  {
    name: 'Tiếng Trung',
    category: 'NGOAI_NGU',
    description: 'Tiếng Trung Quốc cơ bản và nâng cao',
  },
  {
    name: 'Tiếng Nhật',
    category: 'NGOAI_NGU',
    description: 'Tiếng Nhật cơ bản và nâng cao',
  },
  {
    name: 'Tiếng Hàn',
    category: 'NGOAI_NGU',
    description: 'Tiếng Hàn Quốc cơ bản và nâng cao',
  },
  {
    name: 'Tiếng Pháp',
    category: 'NGOAI_NGU',
    description: 'Tiếng Pháp cơ bản và nâng cao',
  },
  {
    name: 'Tiếng Đức',
    category: 'NGOAI_NGU',
    description: 'Tiếng Đức cơ bản và nâng cao',
  },
  {
    name: 'Tiếng Nga',
    category: 'NGOAI_NGU',
    description: 'Tiếng Nga cơ bản và nâng cao',
  },
];

async function seedSubjects() {
  try {
    // Kết nối database
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected to MongoDB');

    // Xóa tất cả môn học cũ (nếu có)
    await Subject.deleteMany({});
    console.log('Cleared existing subjects');

    // Thêm các môn học mới
    await Subject.insertMany(initialSubjects);
    console.log('Successfully seeded subjects');

    // Hiển thị danh sách môn học đã tạo
    const subjects = await Subject.find({}).sort({ category: 1, name: 1 });
    console.log('\nCreated subjects:');
    subjects.forEach((subject) => {
      console.log(`- ${subject.name} (${subject.category})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error seeding subjects:', error);
    process.exit(1);
  }
}

// Chạy script nếu được gọi trực tiếp
if (require.main === module) {
  seedSubjects();
}

export { seedSubjects };
