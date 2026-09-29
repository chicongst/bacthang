# Các bước nộp lên Chrome Web Store

## Trước khi nộp

- [ ] **Tài khoản nhà phát triển**: đăng ký tại <https://chrome.google.com/webstore/devconsole>, đóng phí một lần **5 USD**. Xác minh danh tính có thể mất vài ngày, làm sớm.
- [ ] **Email liên hệ đã xác minh** trong Account settings — thiếu cái này không nộp được.
- [ ] Mở thử `https://103.101.163.42.sslip.io/privacy.html` để chắc trang chính sách riêng tư còn sống.

## Nộp

1. **New Item** → tải lên `release/bang-xep-hang-v1.0.0.zip`
2. Tab **Store listing**: dán tên, mô tả ngắn, mô tả chi tiết từ [`LISTING.md`](LISTING.md). Tải 5 ảnh chụp và 2 ảnh quảng bá. Chọn danh mục **Productivity**, ngôn ngữ **Tiếng Việt**.
3. Tab **Privacy practices**: dán mục đích duy nhất, giải trình từng quyền, tick khai báo dữ liệu, dán URL chính sách riêng tư. Trả lời **Không** cho câu hỏi về remote code.
4. Tab **Distribution**: chọn **Public** (hoặc **Unlisted** nếu chỉ muốn gửi link cho nhóm mình — xem mục cuối).
5. **Submit for review**. Thường 1–3 ngày làm việc, có khi lâu hơn nếu extension xin quyền nhạy cảm.

## Việc bắt buộc làm NGAY SAU KHI store cấp ID

Đây là chỗ dễ hỏng nhất.

Extension đăng nhập Discord bằng địa chỉ `https://<ID>.chromiumapp.org/discord`, mà **ID do store cấp có thể khác ID hiện tại** (`mcmikoacjkhdeaomjhkmbgliccahmbba`). Nếu khác mà không khai báo, mọi người cài từ store sẽ **không đăng nhập được**.

Sau khi tải gói lên, dashboard hiện **Item ID**. Đối chiếu:

- **Trùng** `mcmikoacjkhdeaomjhkmbgliccahmbba` → không phải làm gì.
- **Khác** → làm hai việc, không cần build lại gói (extension tự tính địa chỉ lúc chạy):
  1. Discord Developer Portal → OAuth2 → Redirects → thêm `https://<ID mới>.chromiumapp.org/discord` → Save
  2. Trên máy chủ, thêm địa chỉ đó vào `DISCORD_REDIRECT_URIS` trong `/opt/ranking/deploy/.env` (cách nhau bằng dấu phẩy) rồi chạy `docker compose up -d api`

Nên **cài thử bản đã duyệt từ store và đăng nhập một lần** trước khi bảo cả nhóm cài.

## Người duyệt có thể hỏi thêm

- **Tài khoản demo**: extension bắt đăng nhập mới dùng được, nên người duyệt hay xin tài khoản thử. Chuẩn bị sẵn một tài khoản Discord phụ đã tham gia một workspace công khai, và ghi thông tin vào ô "Notes for reviewer".
- **Vì sao cần quyền `identity`**: đã có câu trả lời sẵn trong `LISTING.md`.

## Hai điểm tôi khuyên xử lý sớm

1. **Tên miền dạng IP.** `103.101.163.42.sslip.io` chạy tốt về kỹ thuật, nhưng người duyệt nhìn một extension trỏ về IP trần thường soi kỹ hơn, và người dùng cũng khó tin tưởng. Mua một tên miền thật rồi đổi `API_DOMAIN` là xong, mọi thứ khác giữ nguyên.
2. **Cân nhắc "Unlisted" thay vì "Public".** Extension này chỉ hữu ích với người dùng chung máy chủ của bạn — người lạ cài vào sẽ không có nhóm nào để tham gia, dễ đánh giá một sao. Chọn Unlisted thì vẫn cài được qua link, không bị tìm thấy lung tung. Muốn SEO thật thì để Public, nhưng nên mở sẵn một workspace công khai để người lạ có chỗ vào thử.

## Khi cập nhật phiên bản sau

Sửa `version` trong `vite.config.ts` (mục `manifest`), build lại, nén lại, rồi **Upload new package** ở item cũ. Số phiên bản phải lớn hơn lần trước.
