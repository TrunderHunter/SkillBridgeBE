import mongoose from 'mongoose';
import { Province } from '../models/Province';
import { District } from '../models/District';
import { Ward } from '../models/Ward';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const API_BASE_URL = 'https://provinces.open-api.vn/api';

interface ProvinceData {
  name: string;
  code: number;
  division_type: string;
  codename: string;
  phone_code: number;
  districts: any[];
}

interface DistrictData {
  name: string;
  code: number;
  division_type: string;
  codename: string;
  province_code: number;
  wards: any[];
}

interface WardData {
  name: string;
  code: number;
  division_type: string;
  codename: string;
  district_code: number;
}

async function importProvinces() {
  try {
    console.log('Importing provinces...');
    const response = await fetch(`${API_BASE_URL}/p/`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const provinces = (await response.json()) as ProvinceData[];

    // Clear existing data
    await Province.deleteMany({});
    console.log('Cleared existing provinces data');

    // Insert new data
    const provinceDocs = provinces.map((province) => ({
      _id: province.code.toString(),
      code: province.code.toString(),
      name: province.name,
      name_en: province.name, // Use name as fallback
      full_name: province.name,
      full_name_en: province.name, // Use name as fallback
      code_name: province.codename,
      administrative_unit_id: 1, // Default value
      administrative_region_id: 1, // Default value
    }));

    await Province.insertMany(provinceDocs);
    console.log(`✅ Imported ${provinces.length} provinces successfully`);
  } catch (error) {
    console.error('❌ Error importing provinces:', error);
    throw error;
  }
}

async function importDistricts() {
  try {
    console.log('Importing districts...');
    const response = await fetch(`${API_BASE_URL}/d/`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const districts = (await response.json()) as DistrictData[];

    // Clear existing data
    await District.deleteMany({});
    console.log('Cleared existing districts data');

    // Insert new data
    const districtDocs = districts.map((district) => ({
      _id: district.code.toString(),
      code: district.code.toString(),
      name: district.name,
      name_en: district.name, // Use name as fallback
      full_name: district.name,
      full_name_en: district.name, // Use name as fallback
      code_name: district.codename,
      province_code: district.province_code.toString(),
      administrative_unit_id: 2, // Default value
    }));

    await District.insertMany(districtDocs);
    console.log(`✅ Imported ${districts.length} districts successfully`);
  } catch (error) {
    console.error('❌ Error importing districts:', error);
    throw error;
  }
}

async function importWards() {
  try {
    console.log('Importing wards...');
    const response = await fetch(`${API_BASE_URL}/w/`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const wards = (await response.json()) as WardData[];

    // Clear existing data
    await Ward.deleteMany({});
    console.log('Cleared existing wards data');

    // Insert new data
    const wardDocs = wards.map((ward) => ({
      _id: ward.code.toString(),
      code: ward.code.toString(),
      name: ward.name,
      name_en: ward.name, // Use name as fallback
      full_name: ward.name,
      full_name_en: ward.name, // Use name as fallback
      code_name: ward.codename,
      district_code: ward.district_code.toString(),
      administrative_unit_id: 3, // Default value
    }));

    await Ward.insertMany(wardDocs);
    console.log(`✅ Imported ${wards.length} wards successfully`);
  } catch (error) {
    console.error('❌ Error importing wards:', error);
    throw error;
  }
}

async function importAllAddressData() {
  try {
    console.log('🚀 Starting address data import...');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('✅ Connected to database');

    // Import data in order
    await importProvinces();
    await importDistricts();
    await importWards();

    console.log('🎉 All address data imported successfully!');

    // Verify data
    const provinceCount = await Province.countDocuments();
    const districtCount = await District.countDocuments();
    const wardCount = await Ward.countDocuments();

    console.log(`📊 Final counts:`);
    console.log(`   - Provinces: ${provinceCount}`);
    console.log(`   - Districts: ${districtCount}`);
    console.log(`   - Wards: ${wardCount}`);
  } catch (error) {
    console.error('💥 Error importing address data:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from database');
  }
}

// Run the import if this file is executed directly
if (require.main === module) {
  importAllAddressData();
}

export { importAllAddressData };
