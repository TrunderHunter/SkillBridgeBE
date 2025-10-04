# Tóm tắt sửa lỗi chức năng địa chỉ Việt Nam

## Lỗi đã sửa

### 1. Lỗi "sendErrorResponse is not a function"

**Nguyên nhân**: Sử dụng sai tên function trong address controller
**Giải pháp**:

- Thay `sendErrorResponse` → `sendError`
- Thay `sendSuccessResponse` → `sendSuccess`
- Cập nhật tham số cho đúng signature của function

### 2. Lỗi import dữ liệu địa chỉ

**Nguyên nhân**:

- Thiếu dotenv config
- Interface không khớp với dữ liệu thực tế từ API
- Cấu trúc dữ liệu từ provinces.open-api.vn khác với interface đã định nghĩa

**Giải pháp**:

- Thêm `dotenv.config()` vào script
- Cập nhật interface để phù hợp với dữ liệu thực tế
- Map dữ liệu từ API sang format của database

## Cấu trúc dữ liệu thực tế từ API

### Province

```json
{
  "name": "Thành phố Hà Nội",
  "code": 1,
  "division_type": "tỉnh",
  "codename": "thanh_pho_ha_noi",
  "phone_code": 24,
  "districts": []
}
```

### District

```json
{
  "name": "Huyện Ba Vì",
  "code": 271,
  "division_type": "huyện",
  "codename": "huyen_ba_vi",
  "province_code": 1,
  "wards": []
}
```

### Ward

```json
{
  "name": "Thị trấn Tây Đằng",
  "code": 9619,
  "division_type": "thị trấn",
  "codename": "thi_tran_tay_dang",
  "district_code": 271
}
```

## API Endpoints hoạt động

### 1. Lấy danh sách tỉnh/thành phố

```
GET /api/v1/address/provinces
```

**Response**: 63 tỉnh/thành phố

### 2. Lấy danh sách quận/huyện theo tỉnh

```
GET /api/v1/address/provinces/{provinceCode}/districts
```

**Example**: `GET /api/v1/address/provinces/1/districts`
**Response**: Danh sách quận/huyện của Hà Nội

### 3. Lấy danh sách phường/xã theo quận/huyện

```
GET /api/v1/address/districts/{districtCode}/wards
```

**Example**: `GET /api/v1/address/districts/271/wards`
**Response**: Danh sách phường/xã của Huyện Ba Vì

## Dữ liệu đã import

- **Provinces**: 63 tỉnh/thành phố
- **Districts**: 691 quận/huyện
- **Wards**: 10,051 phường/xã

## Cách test

### 1. Import dữ liệu

```bash
cd SkillBridgeBE
npm run import:address
```

### 2. Chạy backend

```bash
npm run dev
```

### 3. Test API

```bash
# Lấy danh sách tỉnh/thành phố
curl http://localhost:3000/api/v1/address/provinces

# Lấy quận/huyện của Hà Nội
curl http://localhost:3000/api/v1/address/provinces/1/districts

# Lấy phường/xã của Huyện Ba Vì
curl http://localhost:3000/api/v1/address/districts/271/wards
```

## Frontend đã sẵn sàng

Frontend đã được cập nhật để sử dụng các API này:

- AddressSelector component
- Address service
- Types definitions
- Integration với TutorPersonalProfilePage

## Lưu ý

1. **Province codes**: Sử dụng số (1, 2, 3...) thay vì chuỗi ("01", "02", "03...")
2. **District codes**: Tương tự, sử dụng số
3. **Ward codes**: Tương tự, sử dụng số
4. **Database**: Dữ liệu được lưu dưới dạng string trong database để dễ query

## Troubleshooting

### Nếu API trả về lỗi 500

- Kiểm tra backend có chạy không
- Kiểm tra database có kết nối không
- Kiểm tra dữ liệu có được import không

### Nếu không có dữ liệu

- Chạy lại script import: `npm run import:address`
- Kiểm tra console để xem lỗi chi tiết

### Nếu Frontend không load được dữ liệu

- Kiểm tra API endpoints có hoạt động không
- Kiểm tra CORS settings
- Kiểm tra network tab trong browser dev tools
