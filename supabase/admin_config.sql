-- 管理者と、管理者が編集するゲーム設定（生物のレア度・採取地・経験値など）。SQL Editor で Run。何度実行しても安全。
-- 管理者の登録（自分のアカウントを管理者にする例）：
--   insert into public.admins (user_id) select id from auth.users where email = 'あなたのメールアドレス' on conflict do nothing;

create table if not exists public.admins (
  user_id uuid primary key references public.profiles on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- 設定は誰でも読める（ログイン前の起動時にも読む）。書けるのは管理者だけ
create table if not exists public.game_config (
  key text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles on delete set null
);

alter table public.admins enable row level security;
alter table public.game_config enable row level security;

drop policy if exists "admins read self" on public.admins;
create policy "admins read self" on public.admins for select to authenticated using (user_id = auth.uid());

drop policy if exists "config read" on public.game_config;
create policy "config read" on public.game_config for select to anon, authenticated using (true);
drop policy if exists "config insert admin" on public.game_config;
create policy "config insert admin" on public.game_config for insert to authenticated with check (public.is_admin());
drop policy if exists "config update admin" on public.game_config;
create policy "config update admin" on public.game_config for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "config delete admin" on public.game_config;
create policy "config delete admin" on public.game_config for delete to authenticated using (public.is_admin());

grant select on public.game_config to anon, authenticated;
grant insert, update, delete on public.game_config to authenticated;
grant select on public.admins to authenticated;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
