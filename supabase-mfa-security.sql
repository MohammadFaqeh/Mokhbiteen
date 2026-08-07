-- شغّل هذا الملف مرة واحدة من Supabase > SQL Editor بعد رفع تحديث المصادقة الثنائية.
-- يفرض AAL2 على جميع عمليات الإدارة، وليس على واجهة تسجيل الدخول فقط.

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

drop policy if exists "Admin can insert honor board archives" on public.honor_board_archives;
create policy "Admin can insert honor board archives"
on public.honor_board_archives for insert to authenticated
with check (
  auth.uid() = '837e6aba-b0f4-4ed4-bba0-18660fb0ccd1'::uuid
  and (select auth.jwt()->>'aal') = 'aal2'
);

drop policy if exists "Admin can update honor board archives" on public.honor_board_archives;
create policy "Admin can update honor board archives"
on public.honor_board_archives for update to authenticated
using (
  auth.uid() = '837e6aba-b0f4-4ed4-bba0-18660fb0ccd1'::uuid
  and (select auth.jwt()->>'aal') = 'aal2'
)
with check (
  auth.uid() = '837e6aba-b0f4-4ed4-bba0-18660fb0ccd1'::uuid
  and (select auth.jwt()->>'aal') = 'aal2'
);

drop policy if exists "Admin can delete honor board archives" on public.honor_board_archives;
create policy "Admin can delete honor board archives"
on public.honor_board_archives for delete to authenticated
using (
  auth.uid() = '837e6aba-b0f4-4ed4-bba0-18660fb0ccd1'::uuid
  and (select auth.jwt()->>'aal') = 'aal2'
);

-- اسم سياسة site_settings القديمة قد يختلف؛ نحذف سياسات التعديل فقط ونبقي القراءة العامة كما هي.
do $$
declare policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_settings'
      and cmd in ('UPDATE', 'ALL')
  loop
    execute format('drop policy if exists %I on public.site_settings', policy_row.policyname);
  end loop;
end $$;

alter table public.site_settings enable row level security;
grant select on table public.site_settings to anon, authenticated;
grant update on table public.site_settings to authenticated;

drop policy if exists "Public can read site settings" on public.site_settings;
create policy "Public can read site settings"
on public.site_settings for select to anon, authenticated
using (true);

create policy "MFA admin can update site settings"
on public.site_settings for update to authenticated
using (
  auth.uid() = '837e6aba-b0f4-4ed4-bba0-18660fb0ccd1'::uuid
  and (select auth.jwt()->>'aal') = 'aal2'
)
with check (
  auth.uid() = '837e6aba-b0f4-4ed4-bba0-18660fb0ccd1'::uuid
  and (select auth.jwt()->>'aal') = 'aal2'
);
