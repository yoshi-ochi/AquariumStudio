-- ダイヤの財布（有償ダイヤ）と購入済みの権利。schema.sql の実行後に SQL Editor で Run。何度実行しても安全。
-- 無償ダイヤはセーブ（saves.data.wallet.free）に入る。有償ダイヤは資金決済法のため、ここで別に記録する。
-- 書き込みは関数だけ（本人は読むだけ）。付与は App内課金の購入確認（第7段階・Edge Function が service_role で実行）から行う。

create table if not exists public.wallets (
  user_id uuid primary key references auth.users on delete cascade,
  paid integer not null default 0 check (paid >= 0),
  updated_at timestamptz not null default now()
);

-- 権利：館長パス（product = 'pass30'、expires_at まで有効）・調査隊の永久解放（product = 'team'、count 隊）
create table if not exists public.entitlements (
  user_id uuid not null references auth.users on delete cascade,
  product text not null,
  count integer not null default 1,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, product)
);

-- 有償ダイヤの増減の記録（購入・消費）。未使用残高の集計（資金決済法の基準日）に使う
create table if not exists public.wallet_log (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  amount integer not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists wallet_log_user on public.wallet_log (user_id, created_at desc);

alter table public.wallets enable row level security;
alter table public.entitlements enable row level security;
alter table public.wallet_log enable row level security;

drop policy if exists "wallets: 本人が読む" on public.wallets;
create policy "wallets: 本人が読む" on public.wallets for select using (auth.uid() = user_id);
drop policy if exists "entitlements: 本人が読む" on public.entitlements;
create policy "entitlements: 本人が読む" on public.entitlements for select using (auth.uid() = user_id);
drop policy if exists "wallet_log: 本人が読む" on public.wallet_log;
create policy "wallet_log: 本人が読む" on public.wallet_log for select using (auth.uid() = user_id);

revoke insert, update, delete on public.wallets, public.entitlements, public.wallet_log from anon, authenticated;

-- 有償ダイヤを使う。足りなければ例外
create or replace function public.spend_paid(p_amount integer, p_reason text default '') returns integer
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_left integer;
begin
  if v_uid is null then raise exception 'ログインが必要です'; end if;
  if p_amount is null or p_amount <= 0 then raise exception '数が正しくありません'; end if;
  update public.wallets set paid = paid - p_amount, updated_at = now()
    where user_id = v_uid and paid >= p_amount
    returning paid into v_left;
  if v_left is null then raise exception '有償ダイヤが足りません'; end if;
  insert into public.wallet_log (user_id, amount, reason) values (v_uid, -p_amount, left(coalesce(p_reason, ''), 60));
  return v_left;
end $$;

revoke all on function public.spend_paid(integer, text) from public, anon;
grant execute on function public.spend_paid(integer, text) to authenticated;
