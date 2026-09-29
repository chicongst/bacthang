# Quy ước dự án

## Comment: mặc định là KHÔNG

Code phải tự nói được nó làm gì. Đặt tên đúng, tách hàm nhỏ, kiểu dữ liệu chặt — đó là tài liệu.
Comment kể lại việc code đang làm là **nhiễu**: nó lặp lại thông tin, và tới lúc code đổi mà comment
không đổi thì nó thành lời nói dối.

Chỉ viết comment trong bốn trường hợp:

1. **Mẹo hoặc cách làm lách quy tắc thông thường** — người đọc sẽ tưởng là sai và "sửa" nó.
   ```ts
   // Khóa theo thứ tự id tăng dần, nếu không hai giao dịch chéo nhau sẽ deadlock.
   .orderBy(asc(memberships.userId)).for("update")
   ```
2. **Ràng buộc từ bên ngoài** — giới hạn của thư viện, trình duyệt, hay dịch vụ bên thứ ba.
   ```ts
   // EventSource không gắn được header Authorization, nên phải tự đọc luồng bằng fetch.
   ```
3. **Quyết định đánh đổi** — vì sao chọn cách dở hơn cách hiển nhiên.
4. **Lý do nghiệp vụ không suy ra được từ code** — một con số, một luật do người dùng đặt ra.

Không viết: `// lấy danh sách người chơi` đứng trên `getPlayers()`. Không viết tiêu đề chia khối
(`// ---- đăng nhập ----`) — nếu một file cần chia khối thì nó nên là hai file.

JSDoc chỉ viết cho những gì xuất ra ngoài module và có hành vi không đoán được từ chữ ký hàm.

## Ngôn ngữ

- Định danh (biến, hàm, kiểu, tên file): **tiếng Anh**.
- Comment, thông báo lỗi trả về người dùng, tài liệu: **tiếng Việt**.
- Giao diện: mọi chuỗi đi qua `app/src/i18n.tsx`, không viết cứng chuỗi trong view.

## Kiến trúc

- `server/src/domain/` thuần, không import db hay http. Luật nghiệp vụ nằm ở đây.
- `server/src/services/` nhận `db` qua tham số, không tự tạo kết nối, không biết gì về HTTP.
- `server/src/routes/` chỉ làm: xác thực → kiểm tra dữ liệu vào → gọi service → phát sự kiện.
- `app/src/` là giao diện dùng chung, **không** được import `chrome.*` hay API riêng của trình duyệt.
  Phần khác nhau giữa web và extension đi qua interface `Platform`.

## Luật bất biến

- Mọi con số của luật chơi lấy từ `server/src/domain/rules.ts` và gửi xuống giao diện qua API.
  Không viết cứng ở hai nơi.
- Điểm không bao giờ bị đặt lại. Rời nhóm chỉ đổi trạng thái, không xóa dòng thành viên.
- Mỗi thay đổi dữ liệu trong workspace phải phát sự kiện để các máy khác cập nhật.

## Kiểm thử

- Luật nghiệp vụ mới phải có test ở `server/test/`, chạy trên Postgres thật (`npm run db:test`).
- Sửa lỗi thì viết test tái hiện lỗi **trước**, rồi mới sửa.
- Không dùng `it.skip` hay `--reporter=dot` để giấu test đỏ.

## Trước khi commit

```bash
cd server && npm run typecheck && npm test
cd ../web && npm run typecheck
cd ../extension && npm run typecheck
```
