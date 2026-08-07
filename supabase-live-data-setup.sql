-- شغّل هذا الملف مرة واحدة من Supabase > SQL Editor
create table if not exists public.live_board (
  id text primary key default 'main',
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

alter table public.live_board enable row level security;
grant select on table public.live_board to anon, authenticated;
grant insert, update on table public.live_board to authenticated;

drop policy if exists "Public can read live board" on public.live_board;
create policy "Public can read live board"
on public.live_board for select to anon, authenticated using (true);

drop policy if exists "Admin can insert live board" on public.live_board;
create policy "Admin can insert live board"
on public.live_board for insert to authenticated
with check (
  auth.uid() = '837e6aba-b0f4-4ed4-bba0-18660fb0ccd1'::uuid
  and (select auth.jwt()->>'aal') = 'aal2'
);

drop policy if exists "Admin can update live board" on public.live_board;
create policy "Admin can update live board"
on public.live_board for update to authenticated
using (
  auth.uid() = '837e6aba-b0f4-4ed4-bba0-18660fb0ccd1'::uuid
  and (select auth.jwt()->>'aal') = 'aal2'
)
with check (
  auth.uid() = '837e6aba-b0f4-4ed4-bba0-18660fb0ccd1'::uuid
  and (select auth.jwt()->>'aal') = 'aal2'
);

-- أول تعبئة تتم من زر "حفظ التعديلات على الموقع" في لوحة التحكم.
