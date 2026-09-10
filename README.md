# Hộ chiếu Việt Nam đi đâu?

Bản đồ tương tác chính sách nhập cảnh cho **hộ chiếu phổ thông Việt Nam** — 176
quốc gia & vùng lãnh thổ, tô màu theo mức thủ tục phải làm trước chuyến đi.

Chuyển từ artifact HTML một-file sang **Next.js (App Router) + TypeScript**.
Chưa nối Supabase — data đang đọc từ file tĩnh, nhưng lớp truy cập đã tách sẵn để
bước sau chỉ đổi một hàm.

## Chạy

```bash
npm install
npm run dev        # http://localhost:3000
```

## Cấu trúc

| Đường dẫn | Việc |
|---|---|
| `app/page.tsx` | Server component — gọi `getCountries()`, truyền xuống bản đồ |
| `components/passport-map.tsx` | Client component — bản đồ SVG: pan/zoom, hover, chọn nước, lọc theo mức, bảng, thẻ kết luận |
| `lib/countries.ts` | **Lớp dữ liệu duy nhất.** Đổi sang Supabase ở đây |
| `lib/tiers.ts` | 5 mức thủ tục + thang màu |
| `data/geo.json` | Hình học 176 nước (Natural Earth 110m, phép chiếu Equal Earth) |
| `data/policy.json` | Chính sách mẫu: `[mức, lưu trú, phí, xử lý]` mỗi nước |
| `app/globals.css` | Style chuyển nguyên từ artifact, theme-aware (light/dark) |

## Bước sau — nối Supabase

1. Tạo project trên [supabase.com](https://supabase.com), copy key vào `.env.local`
   (mẫu ở `.env.example`).
2. Tạo bảng `countries` (xem `supabase/schema.sql`) và seed từ `data/policy.json`.
3. Trong `lib/countries.ts`, thay thân `getCountries()`:

   ```ts
   import { createClient } from "@supabase/supabase-js";
   const supabase = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
   );
   const { data } = await supabase.from("countries").select("*");
   // map data -> Country[]  (hình học vẫn lấy từ data/geo.json theo id/name)
   ```

   UI không phải sửa gì.

## Dữ liệu

Số phí / lưu trú / xử lý hiện là **mẫu minh hoạ**, chưa đối chiếu nguồn chính
thức. Bản chạy thật cần gắn `officialUrl` + `lastVerified` cho từng dòng —
`Country` đã có sẵn hai trường này (đang `null`).
