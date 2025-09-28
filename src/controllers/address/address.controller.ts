import { Request, Response } from 'express';
import { Province } from '../../models/Province';
import { District } from '../../models/District';
import { Ward } from '../../models/Ward';
import { sendSuccess, sendError } from '../../utils/response';

export class AddressController {
  // Lấy danh sách tất cả tỉnh/thành phố
  static async getProvinces(req: Request, res: Response) {
    try {
      const provinces = await Province.find({}).sort({ name: 1 });
      sendSuccess(res, 'Lấy danh sách tỉnh/thành phố thành công', provinces);
    } catch (error) {
      console.error('Error getting provinces:', error);
      sendError(res, 'Lỗi khi lấy danh sách tỉnh/thành phố', undefined, 500);
    }
  }

  // Lấy danh sách quận/huyện theo tỉnh/thành phố
  static async getDistrictsByProvince(req: Request, res: Response) {
    try {
      const { provinceCode } = req.params;

      if (!provinceCode) {
        return sendError(
          res,
          'Mã tỉnh/thành phố không được để trống',
          undefined,
          400
        );
      }

      const districts = await District.find({
        province_code: provinceCode,
      }).sort({ name: 1 });
      sendSuccess(res, 'Lấy danh sách quận/huyện thành công', districts);
    } catch (error) {
      console.error('Error getting districts:', error);
      sendError(res, 'Lỗi khi lấy danh sách quận/huyện', undefined, 500);
    }
  }

  // Lấy danh sách phường/xã theo quận/huyện
  static async getWardsByDistrict(req: Request, res: Response) {
    try {
      const { districtCode } = req.params;

      if (!districtCode) {
        return sendError(
          res,
          'Mã quận/huyện không được để trống',
          undefined,
          400
        );
      }

      const wards = await Ward.find({ district_code: districtCode }).sort({
        name: 1,
      });
      sendSuccess(res, 'Lấy danh sách phường/xã thành công', wards);
    } catch (error) {
      console.error('Error getting wards:', error);
      sendError(res, 'Lỗi khi lấy danh sách phường/xã', undefined, 500);
    }
  }

  // Lấy thông tin địa chỉ đầy đủ theo mã
  static async getAddressInfo(req: Request, res: Response) {
    try {
      const { provinceCode, districtCode, wardCode } = req.query;

      const result: any = {};

      if (provinceCode) {
        const province = await Province.findOne({ code: provinceCode });
        result.province = province;
      }

      if (districtCode) {
        const district = await District.findOne({ code: districtCode });
        result.district = district;
      }

      if (wardCode) {
        const ward = await Ward.findOne({ code: wardCode });
        result.ward = ward;
      }

      sendSuccess(res, 'Lấy thông tin địa chỉ thành công', result);
    } catch (error) {
      console.error('Error getting address info:', error);
      sendError(res, 'Lỗi khi lấy thông tin địa chỉ', undefined, 500);
    }
  }

  // Lấy thông tin địa chỉ đầy đủ theo structured address
  static async getFullAddressInfo(req: Request, res: Response) {
    try {
      const { provinceCode, districtCode, wardCode } = req.query;

      if (!provinceCode || !districtCode || !wardCode) {
        return sendError(res, 'Thiếu thông tin mã địa chỉ', undefined, 400);
      }

      const [province, district, ward] = await Promise.all([
        Province.findOne({ code: provinceCode }),
        District.findOne({ code: districtCode }),
        Ward.findOne({ code: wardCode }),
      ]);

      if (!province || !district || !ward) {
        return sendError(
          res,
          'Không tìm thấy thông tin địa chỉ',
          undefined,
          404
        );
      }

      const fullAddress = {
        province,
        district,
        ward,
        full_address: `${ward.name}, ${district.name}, ${province.name}`,
      };

      sendSuccess(res, 'Lấy thông tin địa chỉ đầy đủ thành công', fullAddress);
    } catch (error) {
      console.error('Error getting full address info:', error);
      sendError(res, 'Lỗi khi lấy thông tin địa chỉ đầy đủ', undefined, 500);
    }
  }
}
