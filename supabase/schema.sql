-- ─────────────────────────────────────────────────────────────
-- Bảng chính sách nhập cảnh theo hộ chiếu Việt Nam.
-- CHƯA DÙNG — giữ sẵn cho bước nối Supabase.
-- Chạy trong Supabase → SQL Editor, hoặc `supabase db push` nếu dùng CLI.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.countries (
  id            text primary key,                    -- ISO-3166 numeric, khớp data/geo.json
  name          text not null unique,
  tier          text not null
                  check (tier in ('free','eta','evisa','voa','visa','home','nodata')),
  stay          integer,                             -- ngày lưu trú tối đa
  fee           integer,                             -- lệ phí nhà nước, USD (0 = miễn phí)
  processing    integer,                             -- thời gian xử lý, ngày làm việc
  official_url  text,                                -- cổng chính thức của cơ quan cấp
  last_verified date,                                -- ngày kiểm chứng gần nhất
  updated_at    timestamptz not null default now()
);

-- Đọc công khai, ghi chỉ qua service role (seed / trang admin sau này).
alter table public.countries enable row level security;

create policy "countries: public read"
  on public.countries for select
  using (true);
