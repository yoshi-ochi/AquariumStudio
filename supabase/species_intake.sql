-- モデル制作待ちの魚種の参考画像（管理者ツールの「モデル待ち」タブ）。SQL Editor で Run。何度実行しても安全。
-- 先に admin_config.sql（admins / is_admin）を実行しておくこと。
-- 画像は非公開のストレージ species-ref に置き、管理者だけが読み書きできる。PC へは npm run species:pull で取り込む。

create table if not exists public.species_intake (
  id text primary key,                 -- 追加予定種の id（speciesRoster.js）。リスト外の種は c_ で始まる
  name text not null,                  -- 和名（reference/fish/<和名>/ のフォルダ名になる）
  status text not null default 'draft' check (status in ('draft', 'requested', 'modeling')),
  images jsonb not null default '[]'::jsonb, -- [{ kind: side|top|front|ref, path, w, h }]
  memo text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles on delete set null
);

alter table public.species_intake enable row level security;
drop policy if exists "intake admin" on public.species_intake;
create policy "intake admin" on public.species_intake for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.species_intake to authenticated;
grant select, insert, update, delete on public.species_intake to service_role; -- PC への取り込み（npm run species:pull）

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('species-ref', 'species-ref', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "species-ref admin read" on storage.objects;
create policy "species-ref admin read" on storage.objects for select to authenticated using (bucket_id = 'species-ref' and public.is_admin());
drop policy if exists "species-ref admin insert" on storage.objects;
create policy "species-ref admin insert" on storage.objects for insert to authenticated with check (bucket_id = 'species-ref' and public.is_admin());
drop policy if exists "species-ref admin update" on storage.objects;
create policy "species-ref admin update" on storage.objects for update to authenticated using (bucket_id = 'species-ref' and public.is_admin());
drop policy if exists "species-ref admin delete" on storage.objects;
create policy "species-ref admin delete" on storage.objects for delete to authenticated using (bucket_id = 'species-ref' and public.is_admin());
