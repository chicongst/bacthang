# Ranking — Thiết kế

Ngày: 2026-09-17 · Trạng thái: đã duyệt phần kiến trúc, các phần còn lại chốt theo mặc định (xem "Quyết định")

## Mục tiêu

Bảng xếp hạng cho một nhóm chơi — không gắn với môn nào, tên bảng đặt được lúc build. Người chơi đăng nhập
bằng Discord qua một Chrome extension, tự ghi kết quả trận, xem thứ hạng và trình độ của mình và mọi người.

## Kiến trúc

```
Trình duyệt ─────────► Caddy ──┬── /api/*  ──► API (Fastify + Drizzle) ──► PostgreSQL
Chrome extension ─────►        └── còn lại ──► web (nginx, trang tĩnh)
        │                                │
        └── chrome.identity              └── chuyển hướng trang
                    └──────► Discord OAuth ◄──── đổi code (client secret giữ ở API)
```

- `server/` — TypeScript, Fastify 5, Drizzle ORM, node-postgres, Vitest.
- `app/` — toàn bộ giao diện React, không biết mình chạy ở web hay extension.
- `web/` — vỏ web: đăng nhập bằng chuyển hướng trang, phiên lưu trong `localStorage`, khung co giãn.
- `extension/` — vỏ extension: `chrome.identity`, `chrome.storage`, popup cố định 380×580.
- `deploy/` — Docker Compose (caddy, web, api, postgres), Caddyfile.

Hai vỏ nối vào giao diện chung qua một interface `Platform` (lấy/xóa token, đăng nhập, workspace đang mở).
Thêm một nền tảng mới chỉ cần viết thêm một `Platform`.

API đặt dưới `/api` ở tầng Caddy nên web và API chung một tên miền — không cần CORS, không phải trỏ
thêm bản ghi DNS. Extension cấu hình `VITE_API_BASE=https://<tên miền>/api`.
- Không backup ở giai đoạn này (quyết định của chủ dự án).

Nguyên tắc: extension chỉ hiển thị và gửi yêu cầu. Mọi luật (điểm, giới hạn ngày, trình độ) chạy ở API,
trong transaction Postgres.

## Workspace

Mỗi nhóm chơi là một **workspace**. Người tạo là **owner**. Điểm, hạng, bảng xếp hạng, lịch sử trận và
giới hạn 3 trận/ngày đều tính riêng trong từng workspace — đánh ở CLB A không ăn vào lượt ở CLB B.

Một tài khoản Discord vào được nhiều workspace, đổi qua lại bằng nút trên đầu popup.

| Chế độ | Vào bằng cách nào |
|---|---|
| Công khai | Search thấy là vào được ngay |
| Riêng tư | Search vẫn thấy, nhưng bấm là gửi yêu cầu, owner duyệt mới vào được |

Owner bật/tắt chế độ này bất cứ lúc nào trong tab Nhóm.

Quyền của owner trong workspace của mình: duyệt/từ chối yêu cầu, đuổi thành viên, xóa trận, đổi tên,
đổi công khai/riêng tư. Owner không tự rời và không bị đuổi khỏi workspace của mình.

**Đuổi rồi vào lại**: người bị đuổi muốn quay lại luôn phải xin duyệt, kể cả workspace đang công khai —
nếu không thì đuổi xong họ vào lại ngay. Người *tự rời* thì không bị vướng điều này.

**Điểm không bao giờ được đặt lại.** Dòng thành viên không bị xóa khi rời nhóm, chỉ đổi trạng thái
(`removed`, kèm `removed_by` để phân biệt tự rời hay bị đuổi). Vào lại là điểm cũ, số thắng/thua và
số lượt đã dùng trong ngày quay về nguyên vẹn. Bản đầu tiên xóa hẳn dòng thành viên khi rời nhóm, và
người thua chỉ cần rời rồi vào lại là xóa sạch điểm bị trừ.

`ADMIN_DISCORD_IDS` giờ là admin máy chủ: có quyền như owner ở mọi workspace, dành cho người vận hành.

Tìm workspace bỏ qua dấu tiếng Việt: gõ "quan" ra "CLB Quận 1". Tên đã bỏ dấu lưu sẵn ở cột
`name_folded`, không cần extension `unaccent` của Postgres.

## Luật chơi

| Luật | Giá trị |
|---|---|
| Điểm khởi đầu | 1000 |
| Thắng | +20 |
| Thua | −20 |
| Giới hạn | 3 trận / cặp đấu / ngày |
| "Một ngày" | 00:00–23:59 giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7) |
| Sàn điểm | Không có (điểm có thể xuống dưới 0, thực tế gần như không xảy ra) |

Giới hạn tính theo **cặp đấu**, không theo người. A và B đánh với nhau tối đa 3 trận mỗi ngày; A đánh
với C là hạn mức riêng, không liên quan.

Bản đầu tính theo người (5 trận/ngày) và có lỗ hổng: A với B đánh hết lượt của nhau thì B không còn ghi
được trận với C nữa, dù hai người đó chưa đánh với nhau lần nào. Đếm theo cặp thì không còn chuyện đó.

Thắng và thua bằng nhau (+20 / −20) nên tổng điểm toàn nhóm không đổi: muốn lên hạng phải lấy điểm của
người khác, đánh nhiều mà thắng thua ngang nhau thì đứng yên.

### Trình độ

Mỗi 100 điểm là một hạng:

| Trình độ | Điểm |
|---|---|
| Đồng | < 1000 |
| Bạc | 1000 – 1099 |
| Vàng | 1100 – 1199 |
| Bạch Kim | 1200 – 1299 |
| Kim Cương | 1300 – 1399 |
| Cao Thủ | ≥ 1400 |

Hạng thấp nhất và cao nhất để mở. Ở hạng cao nhất, điểm vẫn tăng tiếp và luôn hiển thị kèm tên hạng.

Huy hiệu là SVG tự vẽ (khiên theo màu hạng), không dùng tài sản của trò chơi khác.

## Ghi kết quả

- Tự ghi, không cần đối thủ xác nhận (quyết định của chủ dự án).
- Người ghi phải là một trong hai người chơi. Không tự đấu với chính mình.
- Đối thủ phải đã đăng nhập ít nhất một lần.
- Mỗi trận lưu lại số điểm đã cộng/trừ, để xóa trận hoàn lại chính xác kể cả khi luật đổi sau này.
- Admin (danh sách Discord ID trong biến môi trường `ADMIN_DISCORD_IDS`) xóa được trận. Xóa là xóa mềm,
  điểm được hoàn lại, trận không còn tính vào giới hạn ngày.
- Tab "Gần đây" hiện mọi trận vừa ghi, để trận ghi bậy dễ bị phát hiện.

Chống ghi đồng thời: transaction khóa hai dòng user (`SELECT … FOR UPDATE`, theo thứ tự id để tránh
deadlock), đếm trận trong ngày, rồi mới ghi. Hai request song song không vượt được giới hạn.

## Đăng nhập

1. Popup gửi message cho service worker (popup tự đóng khi cửa sổ Discord chiếm focus, nên không
   chạy OAuth trong popup được).
2. Service worker gọi `launchWebAuthFlow` tới Discord authorize, scope `identify`, có `state`.
3. Nhận `code`, gửi `POST /auth/discord { code, redirectUri }`.
4. API đổi code bằng client secret, gọi `/users/@me`, upsert user, tạo phiên.
5. Phiên: token ngẫu nhiên 32 byte, DB chỉ lưu SHA-256 của token, hết hạn sau 30 ngày.
   Extension lưu token trong `chrome.storage.local`, gửi `Authorization: Bearer`.

## Cập nhật trực tiếp

Mỗi workspace có một kênh sự kiện SSE: `GET /workspaces/:id/events`. Sau mỗi thay đổi (ghi trận, xóa
trận, tham gia, duyệt, đuổi, đổi cài đặt), API phát một sự kiện `{ scope: "board" | "members" }` cho
mọi người đang mở workspace đó. Máy khách **không nhận dữ liệu trong sự kiện** mà chỉ gọi lại
`/board` — vì thứ hạng và phần "của tôi" khác nhau theo từng người, gửi sẵn sẽ sai.

Vài lựa chọn kỹ thuật:

- **SSE chứ không WebSocket**: luồng dữ liệu chỉ đi một chiều từ máy chủ, WebSocket là thừa.
- **fetch + ReadableStream chứ không EventSource**: EventSource không gắn được header `Authorization`,
  dùng nó sẽ phải nhét token vào URL, nơi token dễ lọt vào log của máy chủ.
- Xác thực xong mới mở dòng dữ liệu, nên lỗi quyền vẫn trả về 401/403 bình thường.
- Nhịp tim 25 giây giữ kết nối sống qua proxy; Caddy đặt `flush_interval -1` để không gom dữ liệu.
- Máy khách tự kết nối lại, giãn dần 1s → 15s.

Kênh nằm trong bộ nhớ của tiến trình API nên **chỉ đúng khi chạy một bản API duy nhất**. Muốn chạy
nhiều bản thì thay bằng Postgres `LISTEN/NOTIFY` hoặc Redis pub/sub — sửa đúng một file `events.ts`.

## API

| Method | Path | Ai dùng |
|---|---|---|
| POST | `/auth/discord` · `/auth/logout` | mọi người |
| GET | `/me` | tài khoản + danh sách workspace của tôi |
| GET | `/workspaces/search?q=` | tìm workspace (bỏ dấu) |
| POST | `/workspaces` | tạo, người tạo thành owner |
| POST | `/workspaces/:id/join` | trả về `active` hoặc `pending` |
| POST | `/workspaces/:id/leave` | thành viên (owner không rời được) |
| GET | `/workspaces/:id/board` | bảng + thông tin của tôi + luật điểm + lượt còn lại với từng người, gộp một lần gọi |
| GET · POST | `/workspaces/:id/matches` | thành viên |
| DELETE | `/workspaces/:id/matches/:matchId` | owner |
| GET | `/workspaces/:id/members` | owner (gồm cả người chờ duyệt) |
| POST | `/workspaces/:id/members/:userId/approve` | owner |
| DELETE | `/workspaces/:id/members/:userId` | owner (từ chối hoặc đuổi) |
| GET | `/workspaces/:id/events` | thành viên — kênh sự kiện SSE |
| PATCH | `/workspaces/:id` | owner (đổi tên, công khai/riêng tư) |

Lỗi trả về `{ error: { code, message } }`, message tiếng Việt để hiện thẳng lên UI. Mã lỗi:
`UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION`, `NOT_FOUND`, `SELF_MATCH`, `OPPONENT_NOT_FOUND`,
`DAILY_LIMIT_REACHED`, `OPPONENT_DAILY_LIMIT_REACHED`, `DISCORD_AUTH_FAILED`, `WORKSPACE_NOT_FOUND`,
`NOT_MEMBER`, `PENDING_APPROVAL`, `OWNER_CANNOT_LEAVE`.

Xếp hạng: điểm giảm dần, hòa điểm thì ai đạt số điểm đó trước xếp trên.

## Extension

Popup 380×580. Chưa ở workspace nào thì vào thẳng màn hình tìm/tạo workspace. Sau đó là bốn tab,
với nút đổi workspace trên đầu:

- **Bảng** — thẻ "của tôi" (hạng #, trình độ, điểm, số trận hôm nay), top 3 nổi bật, rồi danh sách.
  Rê chuột vào ảnh đại diện hiện thẻ thông tin: tỉ lệ thắng, thành tích, trận gần nhất, lượt còn lại với mình.
- **Ghi trận** — chọn đối thủ (có tìm kiếm), hai nút thắng/thua. Số điểm trên nút lấy từ API, không ghi cứng ở UI.
- **Gần đây** — trận vừa ghi, owner có nút xóa.
- **Nhóm** — owner: duyệt yêu cầu (có chấm đếm trên tab), đuổi thành viên, đổi tên, đổi công khai/riêng tư.
  Thành viên thường: xem danh sách và rời workspace.

## Ngôn ngữ

Tiếng Việt và tiếng Anh, chọn bằng nút cờ (SVG tự vẽ, vì emoji cờ không hiện trên Windows). Thứ tự ưu
tiên: `?lang=` trên URL → lựa chọn đã lưu → ngôn ngữ trình duyệt. Tên trình độ dịch theo `tier.id` chứ
không lấy chữ máy chủ gửi xuống; lỗi từ API dịch theo mã lỗi, mã nào chưa có bản dịch thì hiện nguyên
văn của máy chủ.

## Kiểm thử

- Unit: tính trình độ, ranh giới ngày giờ VN, bỏ dấu tiếng Việt.
- Tích hợp (Postgres thật trong Docker): ghi trận, giới hạn 3 trận cho cả hai phía, ranh giới nửa đêm,
  5 request song song, xóa trận hoàn điểm, luồng đăng nhập với Discord giả lập.
- Workspace: tạo/tìm/tham gia công khai và riêng tư, duyệt, đuổi, đuổi rồi vào lại phải xin duyệt,
  rời rồi vào lại thì không, phân quyền owner, và điểm/lượt/lịch sử tách biệt giữa các workspace.
- Giới hạn theo cặp: hết lượt với người này vẫn ghi được với người khác, đổi vai người ghi vẫn tính
  chung một cặp, và 8 request song song cùng một cặp chỉ lọt đúng 3 trận.
- Sự kiện: chỉ gửi đúng workspace, một người nghe lỗi không chặn người khác, và một bài kiểm tra
  mở kênh HTTP thật rồi ghi trận để xác nhận sự kiện tới nơi.
