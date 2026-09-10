# Hộ chiếu đi đâu?

Bản đồ tương tác chính sách nhập cảnh: chọn **hộ chiếu** → xem 199 nước đến tô màu
theo **mức thủ tục** (miễn thị thực · eTA · eVisa · cấp tại cửa khẩu · xin visa
trước). Lọc theo **loại visa**, tìm theo **nước đến**, xem dạng bản đồ hoặc bảng.

Chuyển từ artifact HTML một-file sang **Next.js 16 (App Router) + TypeScript**.
Chưa nối Supabase — data đọc từ file tĩnh, lớp truy cập đã tách sẵn.

## Chạy

```bash
npm install
npm run dev        # http://localhost:3000
```

## Bộ lọc

| Lọc | Cách dùng |
|---|---|
| **Hộ chiếu** | `<select>` 199 nước — đổi là recolor toàn bản đồ |
| **Nước đến** | ô tìm kiếm có gợi ý — gõ tên rồi chọn |
| **Loại visa** | `<select>` hoặc bấm thẳng vào chú giải bên dưới bản đồ |

## Cấu trúc

| Đường dẫn | Việc |
|---|---|
| `app/page.tsx` | Server component — render `<PassportMap />` |
| `components/passport-map.tsx` | Client — bản đồ SVG: pan/zoom, hover, chọn nước, 3 bộ lọc, bảng, thẻ kết luận, dải MRZ |
| `lib/visa.ts` | **Lớp dữ liệu duy nhất** — `destinationsFor(passport)`. Đổi sang Supabase ở đây |
| `lib/tiers.ts` | 6 mức + thang màu + `decodeRequirement()` |
| `data/requirements.json` | Ma trận 199×199, giá trị nén 1 ký tự (`R`/`O`/`E`/`T`/`F`/`N`/`H`/số ngày) |
| `data/nations.json` | 199 nước `{code, name}` — dùng cho cả 2 dropdown |
| `data/geo.json` | Hình học 176 nước (Natural Earth 110m, Equal Earth) + `iso3` |
| `supabase/schema.sql` · `scripts/seed-supabase.mjs` · `.env.example` | Giữ sẵn cho bước nối Supabase |

## Nguồn dữ liệu

**[passport-index-dataset](https://github.com/ilyankou/passport-index-dataset)**
(ilyankou, giấy phép MIT) — tổng hợp thông tin công khai, cập nhật vài lần/năm,
**không phải real-time**. Không có lệ phí / thời gian xử lý.

Muốn real-time / có phí + thời gian xử lý: cần nguồn trả phí —
[Travel Buddy Visa API](https://travel-buddy.ai/api/) (có free tier, cập nhật hàng
ngày), [Sherpa](https://www.joinsherpa.com/), hoặc IATA Timatic. Nguồn gốc chính
thức để gắn `officialUrl`: trang immigration/MOFA của từng nước đến; với hộ chiếu
VN có [xuatnhapcanh.gov.vn](https://xuatnhapcanh.gov.vn) + danh sách hiệp định
miễn thị thực song phương của Bộ Ngoại giao.

## Bước sau — nối Supabase

1. Tạo project trên [supabase.com](https://supabase.com), copy key vào `.env.local`
   (mẫu `.env.example`).
2. Chạy `supabase/schema.sql` trong SQL Editor.
3. `npm i @supabase/supabase-js` rồi `node --env-file=.env.local scripts/seed-supabase.mjs`.
4. Trong `lib/visa.ts`, đổi `destinationsFor()` sang truy vấn
   `supabase.from("requirements").select().eq("passport", passport)`.
   Hình học vẫn lấy từ `data/geo.json` theo `iso3`. UI không phải sửa gì.

## Cập nhật dữ liệu định kỳ

Tải lại 2 file CSV mới nhất từ repo passport-index rồi build lại
`data/requirements.json` + `data/nations.json` (script build ở lịch sử commit,
thư mục `scratchpad` lúc chuyển đổi).
