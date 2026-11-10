# FF Debugger Tools - Quản Lý Trận Đấu & Người chơi

## � Cách Chạy

### ✅ Phương pháp 1: Chạy Backend Server (Khuyến Nghị)

Để sử dụng tất cả tính năng (bao gồm xem chi tiết trận đấu):

```bash
# Cài dependencies (lần đầu)
npm install

# Chạy development
npm run dev

# Hoặc production
npm start
```

Server sẽ khởi động tại:
- 🌐 **Giao diện**: http://localhost:3000
- 📊 **API Match Stats**: http://localhost:3000/api/match-stats?matchId=<id>
- 🔍 **API Batch**: http://localhost:3000/api/match-stats/batch
- ✅ **Health Check**: http://localhost:3000/api/health

### 📄 Phương pháp 2: Mở File Trực Tiếp (Offline Mode)

Nếu không muốn chạy server, mở file trong trình duyệt:
```
file:///c:/Users/CKFF3/Downloads/ff-debugger-tools/src/ui/index.html
```

⚠️ **Lưu ý**: Ở chế độ này, nút **"Xem"** (View match stats) sẽ không hoạt động vì không thể gọi API backend. Dữ liệu vẫn được lưu ở localStorage.

---

## 📖 Hướng Dẫn Sử Dụng

### 2. **Tab Trận Đấu (📋 Trận Đấu)**

#### Thêm Trận Đấu Thủ Công
- Nhập **MatchID** (bắt buộc)
- Nhập **Ghi chú** (tùy chọn)
- Nhấn "Thêm vào danh sách"
- Dữ liệu sẽ lưu vào localStorage tự động

#### Nhập CSV Trận Đấu
- Chuẩn bị file CSV với định dạng:
  ```
  matchId,note
  341223341200011,Vòng 2
  341223341200012,Bảng B
  ```
- Chọn file → Nhấn "Nhập CSV"
- Chỉ chấp nhận cột: `matchId`, `note` (dòng đầu là tiêu đề)

#### Tính Năng Khác
- **Tìm kiếm**: Tìm theo MatchID hoặc ghi chú
- **Sắp xếp**: Mới nhất, Cũ nhất, A-Z, Z-A
- **Xem**: Xem chi tiết trận đấu (gọi backend API)
- **Sửa**: Cập nhật ghi chú
- **Xóa**: Xóa trận đấu
- **Xuất CSV**: Tải danh sách về máy
- **Xóa tất cả**: Xóa toàn bộ dữ liệu

### 3. **Tab Người chơi (👥 Người chơi)**

#### Thêm Người chơi Thủ Công
- **Player ID** (bắt buộc)
- **Tên Người chơi** (bắt buộc)
- **Đội tuyển** (bắt buộc)
- **Ảnh Người chơi** (tùy chọn - chọn file ảnh từ máy)
- **Ảnh Đội** (tùy chọn - chọn file ảnh từ máy)
- Nhấn "Thêm Người chơi"

**⚠️ Lưu ý về Ảnh:**
- Ảnh được chuyển thành **Base64** và lưu vào localStorage
- Hỗ trợ các định dạng: PNG, JPG, GIF, WebP
- Ảnh sẽ hiển thị trong bảng dưới dạng thumbnail

#### Nhập CSV Người chơi
- Chuẩn bị file CSV với định dạng:
  ```
  playerID,playerName,teamName
  123456789,HyperGT,PDL Jaguars
  123456790,Solyc,Lions
  ```
- Chọn file → Nhấn "Nhập CSV Người chơi"
- Chỉ chấp nhận cột: `playerID`, `playerName`, `teamName` (dòng đầu là tiêu đề)

#### Tính Năng Khác
- **Tìm kiếm**: Tìm theo Player ID, Tên hoặc Đội
- **Sắp xếp**: Mới nhất, Cũ nhất, Tên A-Z, Z-A, Đội A-Z
- **Sửa**: Cập nhật tên Người chơi
- **Xóa**: Xóa Người chơi
- **Xuất CSV**: Tải danh sách về máy (ảnh sẽ hiển thị là "có ảnh" hoặc "")
- **Xóa tất cả**: Xóa toàn bộ danh sách Người chơi

### 4. **Lưu Trữ Dữ Liệu**

#### localStorage Keys
- **Trận Đấu**: `ff-debugger-match-list-v1`
- **Người chơi**: `ff-debugger-player-list-v1`

Dữ liệu được lưu trữ dưới dạng JSON trong trình duyệt. Để xóa dữ liệu:
```javascript
localStorage.removeItem('ff-debugger-match-list-v1');
localStorage.removeItem('ff-debugger-player-list-v1');
```

### 5. **Thư Mục Ảnh**

Tạo ra để chuẩn bị:
```
src/ui/assets/images/
```

Bạn có thể copy các file ảnh vào folder này để tham khảo. Tuy nhiên, app hiện tại **lưu ảnh dưới dạng Base64** trong localStorage, nên không cần copy file.

Nếu muốn dùng ảnh từ file local:
1. Copy ảnh vào folder `src/ui/assets/images/`
2. Sửa app.js để đọc từ path: `playerImage: "./assets/images/player1.jpg"`

### 6. **Modal Chi Tiết Trận Đấu**

Khi nhấn nút **"Xem"** trong tab Trận Đấu:
- App sẽ gọi endpoint: `GET /api/match-stats?matchId=<id>`
- Backend cần return dữ liệu theo định dạng `MatchStatsAPIResponse`
- Nếu backend chưa sẵn sàng, bạn sẽ thấy thông báo lỗi

### 7. **Thông Báo Toast**

Mỗi tác vụ sẽ hiển thị thông báo tự động ở góc trên phải:
- ✅ Thành công: "Đã thêm Người chơi"
- ❌ Lỗi: "Player ID đã tồn tại"
- ⚠️ Cảnh báo: "Hãy chọn file CSV trước"

### 8. **Tính Năng Tiếp Theo**

Hiện đang chuẩn bị:
- [ ] Liên kết Match ↔ Players (many-to-many)
- [x] Hiển thị thống kê chi tiết từ API (xem tại `API.md`)
- [ ] Export dữ liệu kết hợp
- [ ] Dark mode

---

## 🗂️ Cấu Trúc Thư Mục

```
src/ui/
├── index.html          # Giao diện chính
├── app.js             # Logic ứng dụng (JS)
├── styles.css         # Styling
├── README.md          # Hướng dẫn này
└── assets/
    └── images/        # Folder cho ảnh local (nếu cần)
```

---

## 📝 Ghi Chú Kỹ Thuật

### Base64 Image Storage
- Ảnh được encode thành Base64 khi upload
- Lưu trực tiếp vào localStorage (có thể làm dung lượng tăng)
- Hiển thị bằng `<img src="data:image/jpeg;base64,..." />`

### CSV Format
- Dòng đầu **bắt buộc** phải là header
- Phân cách cột bằng dấu **phẩy** (,)
- Dòng trống sẽ bị bỏ qua
- Header không phân biệt chữ hoa/thường

### Browser Compatibility
- Yêu cầu: Chrome, Firefox, Safari, Edge (phiên bản mới)
- Không hỗ trợ IE11 trở xuống 
- File API & localStorage bắt buộc

---

## 🐛 Troubleshooting

### "Không thể tải dữ liệu" khi nhấn "Xem"
→ Backend API `/api/match-stats` chưa sẵn sàng

### Ảnh không hiển thị
→ File ảnh chưa được select hoặc không đúng định dạng

### Dữ liệu mất khi reload
→ Xóa localStorage hoặc browser bị xóa dữ liệu tạm

### localStorage full
→ Xóa ảnh hoặc dữ liệu cũ, hoặc sử dụng IndexedDB

---

**Phiên bản**: 1.0  
**Cập nhật cuối**: March 2026
