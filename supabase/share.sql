-- 水槽の共有（URL を知っている人は、ログインしなくても1つの水槽を見られる）。SQL Editor で Run。何度実行しても安全。
-- 共有は押した時点の写し。1人3件まで、1分に1回まで。90日だれも見ていない共有は、新しく共有したときに消す。
-- 写しが小さければ表に入れ（data、64KB まで）、大きければ（岩を削った水槽など）公開ストレージにファイルで置く（data_path、2MB まで）。
-- 一覧は誰にも見せない（id を知っている人だけが get_shared_tank で1件読める）。画像は公開ストレージ share-img。

create table if not exists public.shared_tanks (
  id text primary key check (id ~ '^[A-Za-z0-9]{10}$'),
  owner uuid not null references public.profiles on delete cascade,
  tank_uid integer not null,
  title text not null default '' check (char_length(title) <= 40),
  owner_name text not null default '' check (char_length(owner_name) <= 40),
  data text check (octet_length(data) <= 65536), -- 水槽の写し（gzip を base64 にしたもの）。大きいときは null でファイルに置く
  data_path text, -- ストレージ share-img の写しのファイル（<owner>/<id>.dat）
  has_image boolean not null default false,
  views integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  unique (owner, tank_uid)
);
-- 以前の版から：大きな写しをファイルに置けるようにする
alter table public.shared_tanks alter column data drop not null;
alter table public.shared_tanks add column if not exists data_path text;
create index if not exists shared_tanks_owner on public.shared_tanks (owner);
create index if not exists shared_tanks_viewed on public.shared_tanks (last_viewed_at);

alter table public.shared_tanks enable row level security;
drop policy if exists "share own read" on public.shared_tanks;
create policy "share own read" on public.shared_tanks for select to authenticated using (owner = auth.uid());
drop policy if exists "share own insert" on public.shared_tanks;
create policy "share own insert" on public.shared_tanks for insert to authenticated with check (owner = auth.uid());
drop policy if exists "share own update" on public.shared_tanks;
create policy "share own update" on public.shared_tanks for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "share own delete" on public.shared_tanks;
create policy "share own delete" on public.shared_tanks for delete to authenticated using (owner = auth.uid());
revoke all on public.shared_tanks from anon;
grant select, insert, update, delete on public.shared_tanks to authenticated;

-- 件数・頻度の上限と、古い共有の片付け
create or replace function public.shared_tanks_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare last_at timestamptz;
begin
  select max(updated_at) into last_at from shared_tanks where owner = new.owner;
  if last_at is not null and last_at > now() - interval '60 seconds' and not exists (select 1 from admins where user_id = new.owner) then
    raise exception 'share_too_fast';
  end if;
  if tg_op = 'INSERT' then
    if (select count(*) from shared_tanks where owner = new.owner) >= 3 then raise exception 'share_limit'; end if;
    delete from shared_tanks where last_viewed_at < now() - interval '90 days';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists shared_tanks_guard on public.shared_tanks;
create trigger shared_tanks_guard before insert or update on public.shared_tanks for each row execute function public.shared_tanks_guard();

-- 閲覧ページ用：1件だけ返し、見られた回数と日時を記録する
drop function if exists public.get_shared_tank(text);
create or replace function public.get_shared_tank(share_id text) returns table (title text, owner_name text, data text, data_path text, has_image boolean, updated_at timestamptz)
language sql volatile security definer set search_path = public as $$
  update shared_tanks s set views = s.views + 1, last_viewed_at = now() where s.id = share_id
  returning s.title, s.owner_name, s.data, s.data_path, s.has_image, s.updated_at;
$$;
-- リンクの絵（Cloudflare Worker）用：見られた回数は数えず、題名と画像の有無だけ返す
drop function if exists public.get_shared_meta(text);
create or replace function public.get_shared_meta(share_id text) returns table (title text, owner_name text, img text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.title, s.owner_name, case when s.has_image then s.owner::text || '/' || s.id || '.jpg' end, s.updated_at from shared_tanks s where s.id = share_id;
$$;
revoke all on function public.get_shared_tank(text) from public;
revoke all on function public.get_shared_meta(text) from public;
grant execute on function public.get_shared_tank(text) to anon, authenticated;
grant execute on function public.get_shared_meta(text) to anon, authenticated;

-- 共有の画像（1200×630 の JPEG）と大きな写し（.dat、2MB まで）。誰でも URL で見られ、書けるのは本人のフォルダ（<user id>/<share id>.*）だけ
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('share-img', 'share-img', true, 2097152, array['image/jpeg', 'application/octet-stream'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "share-img own insert" on storage.objects;
create policy "share-img own insert" on storage.objects for insert to authenticated with check (bucket_id = 'share-img' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "share-img own update" on storage.objects;
create policy "share-img own update" on storage.objects for update to authenticated using (bucket_id = 'share-img' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "share-img own delete" on storage.objects;
create policy "share-img own delete" on storage.objects for delete to authenticated using (bucket_id = 'share-img' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "share-img own read" on storage.objects;
create policy "share-img own read" on storage.objects for select to authenticated using (bucket_id = 'share-img' and (storage.foldername(name))[1] = auth.uid()::text);
