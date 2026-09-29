# Code Audit — ranking/

Ngày: 2026-09-29 · Phạm vi: toàn bộ `server/`, `app/`, `web/`, `extension/`, `deploy/`

**Verdict: NEEDS WORK** — không có BLOCKER, nhưng có 4 MAJOR phải xử lý trước khi mở mã nguồn.

**Blast radius**: hỏng ở đây thì nhóm mất bảng xếp hạng và lịch sử trận. Không có tiền, không có dữ liệu
nhạy cảm ngoài tên và ảnh đại diện Discord. Tuy nhiên mã nguồn sắp công khai và máy chủ đang chạy thật
trên Internet, nên lỗ hổng dạng lạm dụng tài nguyên là rủi ro thực.

**Coverage**: đọc toàn bộ `server/src` (1.150 dòng) và `app/src` (~1.600 dòng); đọc lướt `web/`,
`extension/`, `deploy/`; không đọc CSS và dữ liệu mẫu.

## Bảng điểm

| # | Tiêu chí | Điểm | Ghi chú |
|---|---|---|---|
| 1 | Architecture | 6 | Tầng rõ (route → service → db), nhưng `app.ts` 356 dòng gom hết mọi route; `RankingApp.tsx` 354 dòng ôm toàn bộ trạng thái |
| 2 | Clean Code | 6 | Hàm ngắn, ít lồng nhau; nhưng comment giải thích cái đã rõ, và `emit()` là lớp bọc thừa |
| 3 | SOLID | 7 | Service là hàm thuần nhận `db`; `Platform` là seam tốt cho web/extension |
| 4 | Design Patterns | 7 | EventBus, Platform adapter, factory `createApi` đều đúng chỗ; không có abstraction thừa |
| 5 | Performance | 4 | **MAJOR**: N+1 trong `getBoard` trên đường nóng nhất |
| 6 | Security | 4 | **MAJOR**: không có rate limit ở bất kỳ đâu; SSE không giới hạn số kết nối |
| 7 | Naming | 8 | Tên hàm và biến nói đúng ý định, thống nhất tiếng Anh |
| 8 | Folder Structure | 5 | **MAJOR**: `release/bang-xep-hang-v1.0.0/` là thư mục build lọt vào repo; thiếu LICENSE, CI, .gitignore gốc |
| 9 | Dependency Injection | 7 | `db`, `discord`, `now`, `bus` đều tiêm vào; còn `onServerChanged` là biến toàn cục |
| 10 | Async/Await | 8 | Await đầy đủ, có timeout khi gọi Discord, transaction dùng đúng |
| 11 | Error Handling | 6 | `AppError` thống nhất; nhưng mọi lỗi 4xx lạ đều bị gán `VALIDATION`, và 404 route trả sai khuôn |
| 12 | Logging | 5 | Chỉ log lỗi 500; không có log cho hành động của admin (đuổi người, xóa trận) |
| 13 | Validation | 7 | Có schema ở mọi biên; nhưng giới hạn tên workspace khai hai nơi lệch nhau (1–60 vs 2–40) |
| 14 | Testability | 6 | 84 test ở server, chạy trên Postgres thật; **giao diện không có test nào** |
| 15 | Maintainability | 6 | Đọc hiểu được, nhưng hai file god và comment nhiễu làm chậm người mới |
| 16 | Scalability | 6 | Stateless trừ EventBus trong tiến trình (đã ghi chú); chưa có dọn session hết hạn |
| 17 | Database Design | 7 | Khóa ngoại, unique, check đầy đủ; thiếu index cho truy vấn đếm theo cặp |
| 18 | API Design | 6 | REST nhất quán, mã lỗi rõ; thiếu phân trang, 404 sai khuôn, không có versioning |
| 19 | Domain Modeling | 7 | Luật điểm tập trung ở `domain/rules.ts`; trạng thái thành viên là chuỗi rời rạc, `removedBy = null` mang nghĩa ngầm |
| 20 | Overall | 6 | median 15 điểm = 6,5 → làm tròn xuống 6; có MAJOR nên trần là 6 |

## MAJOR

**M1 · Performance · `server/src/services/workspaces.ts:277`**
`getBoard` chạy một truy vấn COUNT cho **từng** người chơi để tính `remainingWithMe`. Nhóm 20 người
là 20 truy vấn mỗi lần mở bảng. Nặng hơn nhiều vì realtime: mỗi trận ghi xong, **mọi** máy đang mở
đều nạp lại bảng — 20 người xem × 24 truy vấn = ~500 truy vấn cho một trận.
*Sửa*: gộp thành một truy vấn `GROUP BY` đối thủ.

**M2 · Security · `server/src/app.ts` (toàn bộ)**
Không có rate limit ở bất kỳ route nào. `/auth/discord` có thể bị dội để dò mã, `POST /matches` và
`POST /workspaces` có thể bị spam để bơm phồng database.
*Sửa*: `@fastify/rate-limit`, siết riêng nhóm auth.

**M3 · Security · `server/src/app.ts:241`**
Kênh SSE không giới hạn số kết nối. Một tài khoản hợp lệ mở vài nghìn kết nối là hết file descriptor
và bộ nhớ của tiến trình API.
*Sửa*: giới hạn số kênh mở đồng thời cho mỗi người.

**M4 · Folder Structure · `release/bang-xep-hang-v1.0.0/`**
Thư mục build đã giải nén nằm trong repo. Mở mã nguồn là đẩy luôn cả file build lên GitHub.
Ngoài ra chưa có `.gitignore` ở gốc, chưa có LICENSE, chưa có CI.

## MINOR (rút gọn)

- `app.ts:74` — mọi lỗi có `statusCode` 4xx đều bị gán `VALIDATION`, kể cả 405/415.
- Route không tồn tại trả khuôn lỗi mặc định của Fastify, khác khuôn `{error:{code,message}}`.
- `workspaces.ts:47` giới hạn tên 2–40 nhưng schema route khai 1–60 — hai nguồn sự thật.
- Không có log cho hành động admin (đuổi thành viên, xóa trận) — không truy vết được.
- Session hết hạn không bao giờ được dọn.
- Thiếu index cho truy vấn đếm trận theo cặp.
- `app/src/api.ts` — `record()` gọi thêm `board()` chỉ để lấy `workspace` và `rules`, tốn một vòng mạng.
- `onServerChanged` là biến toàn cục trong module, không tiêm được, khó test.
- `POST /workspaces` không giới hạn số workspace mỗi người tạo.
- Giao diện không có bài test nào.
- Comment giải thích những chỗ đã tự rõ (vi phạm chính quy ước sắp đặt ra).

## Điểm tốt cần giữ

- Luật điểm tập trung một chỗ và **được API gửi xuống** cho giao diện, không viết cứng hai nơi.
- Transaction có khóa `FOR UPDATE` theo thứ tự id cố định — chống cả ghi đè lẫn deadlock, có test chứng minh.
- Token phiên chỉ lưu hash trong DB.
- `Platform` tách web và extension gọn gàng, dùng chung 100% giao diện.
- 84 test chạy trên Postgres thật, có test song song và test ranh giới nửa đêm.
