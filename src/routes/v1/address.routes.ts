import { Router } from 'express';
import { AddressController } from '../../controllers/address/address.controller';

const router = Router();

// GET /api/v1/address/provinces - Lấy danh sách tỉnh/thành phố
router.get('/provinces', AddressController.getProvinces);

// GET /api/v1/address/provinces/:provinceCode/districts - Lấy danh sách quận/huyện theo tỉnh
router.get(
  '/provinces/:provinceCode/districts',
  AddressController.getDistrictsByProvince
);

// GET /api/v1/address/districts/:districtCode/wards - Lấy danh sách phường/xã theo quận/huyện
router.get(
  '/districts/:districtCode/wards',
  AddressController.getWardsByDistrict
);

// GET /api/v1/address/info - Lấy thông tin địa chỉ đầy đủ
router.get('/info', AddressController.getAddressInfo);

// GET /api/v1/address/full-info - Lấy thông tin địa chỉ đầy đủ với tên
router.get('/full-info', AddressController.getFullAddressInfo);

export default router;
