-- Aquarium Studio（アクスタ）：プレイヤー・セーブ・フレンド（Supabase 無料プラン用）
-- Supabase ダッシュボード → SQL Editor にこのファイルを貼り付けて Run。何度実行しても安全。

-- ---- プロフィール（表示名とフレンドコード） ---------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default 'プレイヤー' check (char_length(name) between 1 and 24),
  friend_code text not null unique default upper(substr(md5(random()::text), 1, 8)),
  created_at timestamptz not null default now()
);

-- サインアップ時にプロフィールを自動作成
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'name', ''), 'プレイヤー'))
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---- フレンド（申請 → 承認） ------------------------------------------------
create table if not exists public.friendships (
  requester uuid not null references public.profiles on delete cascade,
  addressee uuid not null references public.profiles on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester = a and addressee = b) or (requester = b and addressee = a))
  );
$$;

-- ---- セーブデータ（1人1件、JSON） -------------------------------------------
create table if not exists public.saves (
  user_id uuid primary key references public.profiles on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---- 行レベルセキュリティ（他人のデータは書けない・フレンドだけ読める） -----------
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.saves enable row level security;

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "friendships read own" on public.friendships;
create policy "friendships read own" on public.friendships for select to authenticated
  using (auth.uid() in (requester, addressee));
drop policy if exists "friendships request" on public.friendships;
create policy "friendships request" on public.friendships for insert to authenticated
  with check (requester = auth.uid() and status = 'pending');
drop policy if exists "friendships accept" on public.friendships;
create policy "friendships accept" on public.friendships for update to authenticated
  using (addressee = auth.uid()) with check (addressee = auth.uid() and status = 'accepted');
drop policy if exists "friendships remove" on public.friendships;
create policy "friendships remove" on public.friendships for delete to authenticated
  using (auth.uid() in (requester, addressee));

drop policy if exists "saves own" on public.saves;
create policy "saves own" on public.saves for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "saves friends read" on public.saves;
create policy "saves friends read" on public.saves for select to authenticated
  using (public.are_friends(auth.uid(), user_id));

-- ---- テーブル権限（行の制限は上の RLS。未ログイン anon には与えない） ---------------
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.friendships to authenticated;
grant select, insert, update, delete on public.saves to authenticated;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
