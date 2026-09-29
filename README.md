# Ranking

Bảng xếp hạng cho các nhóm chơi — bida, cầu lông, cờ, game gì cũng dùng được. Chạy dưới dạng Chrome
extension, đăng nhập bằng Discord.

Mỗi nhóm là một **workspace** riêng, có bảng xếp hạng riêng. Đăng nhập xong thì tìm workspace để vào
hoặc tự tạo một cái mới; người tạo là **chủ workspace**. Một tài khoản vào được nhiều workspace và đổi
qua lại ngay trong popup.

Luật: bắt đầu **1000** điểm · thắng **+20** · thua **−20** · tối đa **3 trận cho mỗi cặp đấu mỗi ngày** (theo giờ Việt Nam).
Cứ **100 điểm là lên một hạng**: Đồng (<1000) · Bạc (1000) · Vàng (1100) · Bạch Kim (1200) · Kim Cương (1300) · Cao Thủ (1400+).
Hạng cao nhất để mở, điểm cứ chạy tiếp và luôn hiện kèm tên hạng.

| Chế độ workspace | Vào bằng cách nào |
|---|---|
| Công khai | Search thấy là vào được ngay |
| Riêng tư | Search vẫn thấy, bấm là gửi yêu cầu, chủ workspace duyệt mới vào |

Giao diện có **tiếng Việt và tiếng Anh**, đổi bằng nút cờ ở góc trên. Gửi link kèm `?lang=en` hoặc
`?lang=vi` để mở thẳng theo ngôn ngữ mong muốn.

Giới hạn tính theo **cặp đấu**, không theo người: A đánh với B tối đa 3 trận mỗi ngày, còn A đánh với C
là hạn mức riêng. Tính theo người thì hai người đánh nhau nhiều sẽ chặn mất cơ hội đánh với người khác.

Điểm gắn với từng cặp (workspace, người chơi) và **không bao giờ được đặt lại** — rời nhóm rồi vào lại
vẫn giữ nguyên điểm cũ, kể cả điểm âm.

Bảng cập nhật **trực tiếp**: ai đó ghi trận thì thứ hạng trên máy mọi người tự đổi theo, không cần tải
lại trang. Chấm nhỏ cạnh tên workspace sáng xanh khi đang kết nối.

Chủ workspace: duyệt hoặc từ chối yêu cầu, đuổi thành viên, xóa trận ghi sai, đổi tên, đổi chế độ
công khai/riêng tư. Người bị đuổi muốn vào lại phải xin duyệt, kể cả workspace đang công khai.

Tên hiện trên extension đặt trong `extension/.env` qua `VITE_BOARD_NAME`, không gắn với môn nào.
Chi tiết thiết kế: [`docs/plans/2026-09-17-ranking-design.md`](docs/plans/2026-09-17-ranking-design.md).

```
server/     API Node.js (Fastify + Drizzle + PostgreSQL)
app/        Giao diện dùng chung, web và extension xài chung một bộ
web/        Bản web (React) — dùng ngay, không phải chờ ai duyệt
extension/  Chrome extension (Manifest V3) — cùng giao diện, khác cách đăng nhập
deploy/     Docker Compose cho VPS (Caddy tự lo HTTPS)
```

Bản web và extension chỉ khác nhau hai chỗ: đăng nhập Discord (web chuyển hướng trang, extension dùng
`chrome.identity`) và nơi lưu phiên. Toàn bộ màn hình nằm trong `app/`, sửa một lần là cả hai cùng đổi.

## Bản đang chạy

<https://103.101.163.42.sslip.io> — VPS Ubuntu 24.04, mã nguồn ở `/opt/ranking`, cấu hình ở
`/opt/ranking/deploy/.env`. `sslip.io` là tên miền tự trỏ về IP, dùng tạm để có HTTPS thật khi chưa có
tên miền riêng; có tên miền rồi thì đổi `API_DOMAIN` trong `.env`, trỏ bản ghi A về IP, rồi
`docker compose up -d`.

Cập nhật sau khi sửa code: chép lên rồi dựng lại.

```bash
rsync -az --delete --exclude node_modules --exclude dist --exclude .env --exclude .keys \
  ranking/ root@103.101.163.42:/opt/ranking/
ssh root@103.101.163.42 'cd /opt/ranking/deploy && docker compose up -d --build'
```

## Đưa extension lên Chrome Web Store

Mọi thứ đã chuẩn bị sẵn trong [`extension/store/`](extension/store): nội dung đăng, ảnh chụp 1280×800,
ảnh quảng bá, giải trình quyền. Các bước nộp nằm ở [`extension/store/CHECKLIST.md`](extension/store/CHECKLIST.md).
Gói tải lên: `release/bang-xep-hang-v1.0.0.zip`.

Chính sách riêng tư (bắt buộc với store) đang chạy tại <https://103.101.163.42.sslip.io/privacy.html>,
mã nguồn ở `web/public/privacy.html`.

## ID của extension

Extension có khóa cố định trong manifest, nên **máy nào cài cũng ra cùng ID**:

```
mcmikoacjkhdeaomjhkmbgliccahmbba
```

Redirect URI dùng cho Discord:

```
https://mcmikoacjkhdeaomjhkmbgliccahmbba.chromiumapp.org/discord
```

Khóa bí mật tương ứng nằm ở `extension/.keys/private.pem`. **Giữ riêng, không gửi cho ai.** Chỉ cần tới nó
nếu sau này đưa extension lên Chrome Web Store. Mất khóa này cũng không làm hỏng bản đang dùng.

## Cài đặt lần đầu

### 1. Tạo ứng dụng Discord

1. Vào <https://discord.com/developers/applications> → **New Application**, đặt tên (ví dụ "Bida Ranking").
2. Tab **OAuth2**:
   - Chép **Client ID**.
   - Bấm **Reset Secret**, chép **Client Secret**. Chỉ đưa vào `.env` trên VPS, không đưa vào extension.
   - Mục **Redirects** → **Add Redirect** → thêm **cả hai** rồi **Save Changes**:
     - cho bản web: `https://<tên miền của bạn>/` — nhớ dấu `/` ở cuối
     - cho extension (nếu dùng): redirect URI ở mục trên

### 2. Dựng server trên VPS

Cần: một VPS có Docker, và một tên miền (hoặc tên miền con) có bản ghi **A** trỏ về IP của VPS. Cổng 80 và 443 phải mở.

```bash
# chép thư mục ranking/ lên VPS, rồi:
cd ranking/deploy
cp .env.example .env
nano .env          # điền API_DOMAIN, POSTGRES_PASSWORD, DISCORD_*, ADMIN_DISCORD_IDS
docker compose up -d --build
curl https://<API_DOMAIN>/health     # → {"ok":true}
```

Lần đầu Caddy cần khoảng nửa phút để xin chứng chỉ HTTPS. Bảng trong database được tạo tự động khi API khởi động.

**`ADMIN_DISCORD_IDS` là admin máy chủ**, không phải chủ workspace — người trong danh sách này có quyền
như chủ ở mọi workspace, dùng khi cần dọn dẹp. Bình thường để trống cũng được, vì mỗi workspace đã có
chủ riêng. Lấy ID: Discord → Cài đặt → Nâng cao → bật **Chế độ nhà phát triển**, rồi chuột phải vào tên
mình → **Sao chép ID người dùng**. Nhiều người thì cách nhau bằng dấu phẩy, đổi xong chạy
`docker compose up -d` để áp dụng.

### 3. Xong — mở trang web

Vào `https://<API_DOMAIN>` là dùng được ngay. Trang chạy tốt trên cả điện thoại và máy tính, thêm vào
màn hình chính của điện thoại thì gần như một ứng dụng.

### 4. Extension (tuỳ chọn)

Chỉ làm bước này nếu bạn muốn bản cài vào Chrome. Bản web đã đủ dùng.

```bash
cd ranking/extension
cp .env.example .env
nano .env          # VITE_API_BASE=https://<API_DOMAIN>/api  (chú ý phần /api)
                   # VITE_DISCORD_CLIENT_ID, VITE_BOARD_NAME
npm install
npm run build      # ra thư mục dist/
```

Rồi cài vào Chrome:

1. Mở `chrome://extensions` → bật **Developer mode** (góc phải trên).
2. **Load unpacked** → chọn thư mục `extension/dist`.
3. Ghim icon extension lên thanh công cụ, bấm vào → **Đăng nhập bằng Discord**.

**Gửi cho bạn bè**: nén thư mục `dist/` thành file zip và gửi đi. Người nhận giải nén rồi làm bước 4. Vì ID cố định
nên đăng nhập chạy được trên mọi máy.

Popup sẽ tự đóng khi cửa sổ Discord mở ra, đó là hành vi bình thường của Chrome. Đăng nhập xong thì bấm lại icon.

## Cập nhật

- **Server và web**: chép code mới lên VPS → `cd deploy && docker compose up -d --build`. Migration tự chạy,
  trang web build lại luôn trong cùng lệnh đó.
- **Extension**: `npm run build` → vào `chrome://extensions` bấm nút tải lại ở thẻ extension. Gửi lại zip cho bạn bè.

## Phát triển

```bash
cd server
npm install
npm run db:test    # bật Postgres test trong Docker (cổng 54329)
npm test           # 83 test: luật điểm, giới hạn ngày, ghi song song, đăng nhập,
                   #          workspace công khai/riêng tư, duyệt, đuổi, phân quyền,
                   #          kênh sự kiện realtime
npm run typecheck
docker stop bida-ranking-testdb   # xong thì tắt
```

Xem thử giao diện với dữ liệu mẫu, không cần server hay Discord: chạy `npx vite` trong `web/` (hoặc
`extension/`), rồi mở

| Màn hình | Địa chỉ |
|---|---|
| Bảng xếp hạng | `http://localhost:5173/?mock` |
| Ghi trận | `http://localhost:5173/?mock&tab=record` |
| Gần đây | `http://localhost:5173/?mock&tab=recent` |
| Nhóm (quản lý) | `http://localhost:5173/?mock&tab=group` |
| Chọn workspace | `http://localhost:5173/?mock&view=workspaces` |
| Đăng nhập | `http://localhost:5173/?mock&view=login` |

(Với `extension/` thì đường dẫn là `/popup.html?mock…`)

Ảnh chụp sẵn nằm trong [`docs/screenshots/`](docs/screenshots). Dữ liệu mẫu và các tham số `?mock` không vào bản build.
