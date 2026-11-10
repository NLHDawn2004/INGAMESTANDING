# Git Commit Message Conventions
Hãy tạo commit message tuân thủ các quy tắc sau:

## 1. Cấu trúc định dạng
- Mỗi commit phải bắt đầu bằng một emoji phù hợp từ danh sách bên dưới.
- Định dạng: `<emoji> <title>`
- Nếu nội dung vượt quá 70 ký tự, phải tách phần chi tiết xuống phần `description` (cách phần title một dòng trống).

## 2. Danh sách Emoji (Gitmoji)
- ✨ `:sparkles:` - Tính năng mới (New Feature)
- 🐛 `:bug:` - Sửa lỗi (Bug Fix)
- 📝 `:memo:` - Cập nhật tài liệu (Documentation)
- ♻️ `:recycle:` - Tái cấu trúc mã nguồn (Refactor)
- ⚡ `:zap:` - Cải thiện hiệu suất (Performance)
- 🔥 `:fire:` - Xóa code hoặc file thừa
- 🎨 `:art:` - Cải thiện cấu trúc/định dạng code (Style)
- ✅ `:white_check_mark:` - Thêm/Cập nhật tests
- 🔧 `:wrench:` - Thay đổi cấu hình (Configuration)
- 📦 `:package:` - Cập nhật dependencies/thư viện
- 🚀 `:rocket:` - Triển khai/Deploy
- 💄 `:lipstick:` - Cập nhật UI/UX & CSS
- 🔒 `:lock:` - Bảo mật (Security)
- 🚨 `:rotating_light:` - Fix compiler/linter warnings
- 🚧 `:construction:` - Công việc đang dở dang (WIP)

## 3. Quy tắc viết nội dung
- **Ngôn ngữ:** Luôn sử dụng tiếng Việt 100% cho cả Title và Description.
- **Định dạng:** `<emoji> <title>`
- **Quy tắc Title:** - Ngắn gọn, không quá 70 ký tự.
  - Sử dụng các động từ hành động (thêm, sửa, xóa, tối ưu, cập nhật).
- **Quy tắc Description:** - Nếu thay đổi phức tạp, hãy giải thích chi tiết bằng các gạch đầu dòng tiếng Việt.