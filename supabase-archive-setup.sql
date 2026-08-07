-- شغّل هذا الملف مرة واحدة من Supabase > SQL Editor
create table if not exists public.honor_board_archives (
  id uuid primary key default gen_random_uuid(),
  archive_key text not null unique,
  month_label text not null,
  year integer not null,
  title text not null,
  data jsonb not null,
  archived_at timestamptz not null default now(),
  archived_by uuid not null default auth.uid()
);

alter table public.honor_board_archives enable row level security;

-- الصلاحيات الأساسية للواجهة العامة ولحساب الإدارة
grant select on table public.honor_board_archives to anon, authenticated;
grant insert, update, delete on table public.honor_board_archives to authenticated;

drop policy if exists "Public can read honor board archives" on public.honor_board_archives;
create policy "Public can read honor board archives"
on public.honor_board_archives for select
to anon, authenticated
using (true);

drop policy if exists "Admin can insert honor board archives" on public.honor_board_archives;
create policy "Admin can insert honor board archives"
on public.honor_board_archives for insert
to authenticated
with check (auth.uid() = '837e6aba-b0f4-4ed4-bba0-18660fb0ccd1'::uuid);

drop policy if exists "Admin can update honor board archives" on public.honor_board_archives;
create policy "Admin can update honor board archives"
on public.honor_board_archives for update
to authenticated
using (auth.uid() = '837e6aba-b0f4-4ed4-bba0-18660fb0ccd1'::uuid)
with check (auth.uid() = '837e6aba-b0f4-4ed4-bba0-18660fb0ccd1'::uuid);

drop policy if exists "Admin can delete honor board archives" on public.honor_board_archives;
create policy "Admin can delete honor board archives"
on public.honor_board_archives for delete
to authenticated
using (auth.uid() = '837e6aba-b0f4-4ed4-bba0-18660fb0ccd1'::uuid);

create index if not exists honor_board_archives_year_month_idx
on public.honor_board_archives (year desc, archived_at desc);
