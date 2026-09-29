# Chuẩn bị đưa lên Chrome Web Store

- [`LISTING.md`](LISTING.md) — toàn bộ chữ nghĩa để dán vào trang quản trị: tên, mô tả, giải trình quyền, khai báo dữ liệu.
- [`CHECKLIST.md`](CHECKLIST.md) — các bước nộp, theo thứ tự.
- `screenshots/` — 5 ảnh 1280×800.
- `promo/` — ảnh quảng bá 440×280 và 1400×560.

Gói tải lên nằm ở `../../release/bang-xep-hang-v1.0.0.zip`.

## Dựng lại gói

```bash
cd extension
npm install
npm run build        # cần extension/.env, xem .env.example
cd dist && zip -qr ../../release/bang-xep-hang-v1.0.0.zip . -x ".*"
```

Ảnh chụp được tạo tự động từ giao diện thật (chế độ dữ liệu mẫu), không phải dựng tay.
