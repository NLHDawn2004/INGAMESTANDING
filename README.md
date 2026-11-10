# FF Debugger Tools

Bộ công cụ theo dõi log trận đấu Free Fire theo thời gian thực, đồng thời cung cấp API lấy dữ liệu thống kê trận để hiển thị trên giao diện web.

## Bảng điều khiển một màn hình

Mở trang chủ của tool (cổng 4000 nếu dùng cấu hình hiện tại). Trong phần dữ liệu ngày thi đấu:

1. Dán đường dẫn đầy đủ đến file debug đang được game ghi. Có thể dùng **Copy as path** trong File Explorer.
2. Chọn `PlayerNameOverwrite.json`. Tên dạng `GHE.SAMASS` được gán mã đội `GHE`.
3. Nhập Match ID và bấm **Thêm trận** để cộng điểm của trận trước. Khi trận đang hiển thị kết thúc, bấm **Chốt trận đang hiển thị** để thay điểm live của trận đó bằng kết quả chính thức. Điểm cập nhật ngay trong phiên theo dõi. Dùng **Xem thống kê** để mở chi tiết hoặc **Xóa** để bỏ trận khỏi tổng điểm.

File debug, danh sách người chơi và danh sách trận được nhớ trên trình duyệt. Khi mở một ngày thi đấu khác, chọn dữ liệu mới và xóa các trận cũ khỏi danh sách.

Phần **Theo dõi trực tiếp** có nhật ký và ba bản xem trước. Dùng liên kết **Nguồn OBS** nếu cần đưa overlay lên livestream. Phần quản lý Group, người chơi và CSV nằm dưới cùng.

## Tính năng chính

- Theo dõi file log và phân tích các sự kiện trong trận đấu.
- Phát sự kiện realtime qua WebSocket (điểm số, knockdown, dead, revive, team eliminated, winrate).
- Cung cấp REST API để lấy thống kê 1 trận hoặc nhiều trận từ nguồn dữ liệu FF Esports.
- Giao diện web để quản lý match/player và xem chi tiết dữ liệu trận.

## Công nghệ sử dụng

- TypeScript + Node.js
- Express
- WebSocket (`ws`)
- Axios

## Yêu cầu môi trường

- Node.js 18+ (khuyến nghị dùng Node.js bản LTS mới)
- npm

## Cài đặt

```bash
npm install
```

## Chạy dự án

### Chế độ development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Chạy production

```bash
npm start
```

### Kiểm tra type

```bash
npm run typecheck
```

Server mặc định chạy tại `http://localhost:3000`.

## REST API

### `GET /api/health`

Kiểm tra trạng thái server.

### `GET /api/match-stats?matchId=<id>`

Lấy thống kê chi tiết của 1 trận.

### `GET /api/match-stats/batch?matchIds=<id1>,<id2>,...`

Lấy thống kê nhiều trận cùng lúc (tối đa 8 trận/request).

Chi tiết request/response xem thêm tại file `API.md`.

## WebSocket Realtime

Dự án mở 3 WebSocket server:

- `ws://localhost:11019`: luồng standing/event chính
- `ws://localhost:11020`: luồng team eliminated
- `ws://localhost:11021`: luồng cập nhật winrate

Các loại event chính:

- `team_data_inited`
- `altered_event`
- `score_change`
- `knockdown_event`
- `dead_event`
- `rescue_event`
- `revive_event`
- `team_eliminated`
- `winrate_update`

Định nghĩa type event nằm trong `src/types/log-events.d.ts`.

## Giao diện web

UI được phục vụ static từ thư mục `src/ui`.

- Trang chính: `http://localhost:3000`
- Tài liệu UI: `src/ui/README.md`

## Cấu trúc thư mục chính

```text
src/
  index.ts                # Entry Express server + API
  core/debugger.ts        # Log tailer + realtime event processing
  handlers/               # Bộ xử lý từng loại log event
  services/Stats.ts       # Gọi API match stats
  types/log-events.d.ts   # Type cho websocket event
  ui/                     # Frontend static
```

## Ghi chú

- CORS đã được bật để hỗ trợ gọi API từ frontend.
- Dữ liệu batch match stats giới hạn tối đa 8 trận mỗi request.
