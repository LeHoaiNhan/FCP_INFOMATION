-- ─────────────────────────────────────────────────────────────
-- Ma trận yêu cầu visa: (hộ chiếu × nước đến) → mức thủ tục.
-- CHƯA DÙNG — giữ sẵn cho bước nối Supabase.
-- Nguồn seed: data/requirements.json (passport-index-dataset).
-- Chạy trong Supabase → SQL Editor, hoặc `supabase db push` nếu dùng CLI.
-- ─────────────────────────────────────────────────────────────

-- 199 nước: vừa là hộ chiếu, vừa là điểm đến
create table if not exists public.nations (
  code text primary key,            -- ISO-3166 alpha-3
  name text not null
);

create table if not exists public.requirements (
  passport      text not null references public.nations (code),
  destination   text not null references public.nations (code),
  tier          text not null
                  check (tier in ('free','eta','evisa','voa','visa','home','noadmission','nodata')),
  stay          integer,            -- ngày lưu trú tối đa khi miễn thị thực
  fee           integer,            -- lệ phí nhà nước, USD (dataset không có → null)
  processing    integer,            -- ngày làm việc (dataset không có → null)
  official_url  text,               -- cổng chính thức của cơ quan cấp
  last_verified date,               -- ngày kiểm chứng gần nhất
  updated_at    timestamptz not null default now(),
  primary key (passport, destination)
);

create index if not exists requirements_passport_idx
  on public.requirements (passport);

-- Đọc công khai; ghi chỉ qua service role (seed / trang admin sau này).
alter table public.nations enable row level security;
alter table public.requirements enable row level security;

create policy "nations: public read"      on public.nations      for select using (true);
create policy "requirements: public read"  on public.requirements for select using (true);
