# Hướng dẫn thiết lập chức năng địa chỉ Việt Nam

## Tổng quan

Hệ thống địa chỉ Việt Nam được thiết kế để hỗ trợ việc chọn địa chỉ thông qua các combo box cho:

- Tỉnh/Thành phố
- Quận/Huyện
- Phường/Xã
- Địa chỉ chi tiết

## Cấu trúc dữ liệu

### Models

- **Province**: Lưu trữ thông tin tỉnh/thành phố
- **District**: Lưu trữ thông tin quận/huyện
- **Ward**: Lưu trữ thông tin phường/xã

### User Model

Đã được cập nhật để hỗ trợ `structured_address`:

```typescript
structured_address: {
  province_code: string;
  district_code: string;
  ward_code: string;
  detail_address: string;
}
```

## API Endpoints

### 1. Lấy danh sách tỉnh/thành phố

```
GET /api/v1/address/provinces
```

### 2. Lấy danh sách quận/huyện theo tỉnh

```
GET /api/v1/address/provinces/:provinceCode/districts
```

### 3. Lấy danh sách phường/xã theo quận/huyện

```
GET /api/v1/address/districts/:districtCode/wards
```

### 4. Lấy thông tin địa chỉ đầy đủ

```
GET /api/v1/address/info?provinceCode=01&districtCode=001&wardCode=00001
```

### 5. Lấy thông tin địa chỉ đầy đủ với tên

```
GET /api/v1/address/full-info?provinceCode=01&districtCode=001&wardCode=00001
```

## Cài đặt và chạy

### 1. Import dữ liệu địa chỉ

```bash
cd SkillBridgeBE
npm run import:address
```

Script này sẽ:

- Kết nối đến database
- Xóa dữ liệu cũ (nếu có)
- Import dữ liệu từ provinces.open-api.vn
- Hiển thị số lượng records đã import

### 2. Kiểm tra dữ liệu

Sau khi import, bạn có thể kiểm tra:

- Số lượng tỉnh/thành phố: ~63
- Số lượng quận/huyện: ~700+
- Số lượng phường/xã: ~11000+

### 3. Test API

```bash
# Lấy danh sách tỉnh/thành phố
curl http://localhost:3000/api/v1/address/provinces

# Lấy danh sách quận/huyện của Hà Nội
curl http://localhost:3000/api/v1/address/provinces/01/districts

# Lấy danh sách phường/xã của quận Ba Đình
curl http://localhost:3000/api/v1/address/districts/001/wards
```

## Cấu trúc dữ liệu trả về

### Province

```json
{
  "code": "01",
  "name": "Hà Nội",
  "name_en": "Ha Noi",
  "full_name": "Thành phố Hà Nội",
  "full_name_en": "Ha Noi City",
  "code_name": "ha_noi",
  "administrative_unit_id": 1,
  "administrative_region_id": 3
}
```

### District

```json
{
  "code": "001",
  "name": "Ba Đình",
  "name_en": "Ba Dinh",
  "full_name": "Quận Ba Đình",
  "full_name_en": "Ba Dinh District",
  "code_name": "ba_dinh",
  "province_code": "01",
  "administrative_unit_id": 2
}
```

### Ward

```json
{
  "code": "00001",
  "name": "Phúc Xá",
  "name_en": "Phuc Xa",
  "full_name": "Phường Phúc Xá",
  "full_name_en": "Phuc Xa Ward",
  "code_name": "phuc_xa",
  "district_code": "001",
  "administrative_unit_id": 3
}
```

## Lưu ý

1. **Dữ liệu nguồn**: Sử dụng API từ provinces.open-api.vn
2. **Performance**: Đã tạo indexes cho các trường thường xuyên query
3. **Validation**: Các API endpoints đã có validation cơ bản
4. **Error handling**: Có xử lý lỗi và trả về response chuẩn

## Troubleshooting

### Lỗi kết nối database

- Kiểm tra file `.env` có đúng thông tin database
- Đảm bảo MongoDB đang chạy

### Lỗi import dữ liệu

- Kiểm tra kết nối internet
- Kiểm tra API provinces.open-api.vn có hoạt động không
- Xem log chi tiết trong console

### Lỗi API không trả về dữ liệu

- Kiểm tra đã chạy script import chưa
- Kiểm tra database có dữ liệu không
- Kiểm tra logs server

## Phát triển tiếp

### Phase 2: Tích hợp bản đồ

- Sử dụng Google Maps API
- Thêm chức năng chọn địa chỉ trên bản đồ
- Geocoding để chuyển đổi tọa độ thành địa chỉ

### Cải tiến

- Cache dữ liệu địa chỉ
- Tìm kiếm địa chỉ theo tên
- Validation địa chỉ chi tiết hơn
