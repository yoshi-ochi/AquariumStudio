-- App内課金の付与（RevenueCat の Webhook → Edge Function revenuecat → iap_apply）。
-- wallet.sql・gacha.sql の実行後に SQL Editor で Run。何度実行しても安全。
-- このプロジェクトはテーブルの権限を明示する必要があるため、wallet.sql・gacha.sql のテーブルの読み取り権限もここで付ける。

-- 本人が自分の残高・権利・記録を読めるようにする（書き込みは関数だけ）
grant select on public.wallets, public.entitlements, public.wallet_log, public.gacha_log to authenticated;
-- Edge Function（service_role）が付与に使う
grant select, insert, update on public.wallets, public.entitlements, public.wallet_log to service_role;

-- 受け取った購入の知らせ（同じ知らせを二重に付与しない）
create table if not exists public.iap_events (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  product text not null,
  kind text not null,
  result text not null default '',
  created_at timestamptz not null default now()
);
alter table public.iap_events enable row level security;
revoke all on public.iap_events from anon, authenticated;
grant select, insert, update on public.iap_events to service_role;

/** 有償ダイヤを増やす・減らす（減らすときは0未満にしない）。記録も残す */
create or replace function public.iap_add_paid(p_user uuid, p_amount integer, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.wallets (user_id, paid) values (p_user, greatest(0, p_amount))
    on conflict (user_id) do update set paid = greatest(0, public.wallets.paid + p_amount), updated_at = now();
  insert into public.wallet_log (user_id, amount, reason) values (p_user, p_amount, left(p_reason, 60));
end $$;

/** 権利の数を変える（調査隊・大型流木・パスの採取倍カード） */
create or replace function public.iap_set_count(p_user uuid, p_product text, p_count integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.entitlements (user_id, product, count) values (p_user, p_product, greatest(0, p_count))
    on conflict (user_id, product) do update set count = greatest(0, p_count), updated_at = now();
end $$;

/**
 * 購入（p_kind = 'grant'）または返金（'revoke'）を反映する。p_product は App Store の商品ID（src/management/walletData.js の STORE_IDS）。
 * 同じ p_event_id は1回だけ。結果の文字列を返す
 */
create or replace function public.iap_apply(p_event_id text, p_user uuid, p_product text, p_kind text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_sign integer := case when p_kind = 'revoke' then -1 else 1 end;
  v_dia integer;
  v_cur integer;
  v_result text;
begin
  if p_kind not in ('grant', 'revoke') then raise exception 'kind が正しくありません'; end if;
  insert into public.iap_events (id, user_id, product, kind) values (p_event_id, p_user, p_product, p_kind) on conflict (id) do nothing;
  if not found then return 'duplicate'; end if;

  v_dia := case p_product
    when 'aquastu.dia300' then 300 when 'aquastu.dia900' then 900 when 'aquastu.dia1900' then 1900
    when 'aquastu.dia3200' then 3200 when 'aquastu.dia6200' then 6200 when 'aquastu.dia10500' then 10500
    when 'aquastu.dia22000' then 22000 else null end;

  if v_dia is not null then
    perform public.iap_add_paid(p_user, v_sign * v_dia, 'iap:' || p_product);
    v_result := 'dia ' || (v_sign * v_dia);
  elsif p_product = 'aquastu.pass30' then
    -- 館長パス：30日（買い足すと期限から延長）・5,000ダイヤ・採取倍カード10枚
    if v_sign > 0 then
      insert into public.entitlements (user_id, product, count, expires_at) values (p_user, 'pass30', 1, now() + interval '30 days')
        on conflict (user_id, product) do update set count = public.entitlements.count + 1,
          expires_at = greatest(now(), coalesce(public.entitlements.expires_at, now())) + interval '30 days', updated_at = now();
      select count into v_cur from public.entitlements where user_id = p_user and product = 'pass_cards';
      perform public.iap_set_count(p_user, 'pass_cards', coalesce(v_cur, 0) + 10);
    else
      update public.entitlements set expires_at = greatest(now(), expires_at - interval '30 days'), updated_at = now()
        where user_id = p_user and product = 'pass30';
    end if;
    perform public.iap_add_paid(p_user, v_sign * 5000, 'iap:' || p_product);
    v_result := 'pass ' || v_sign;
  elsif p_product in ('aquastu.unlock.team1', 'aquastu.unlock.team2') then
    -- 調査隊の永久解放（非消耗型）：1隊目・2隊目を別に記録し、合計を team に入れる（復元で二重にならない）
    -- 旧ID aquastu.team1・team2 は消耗型で作ってしまったため使わない
    perform public.iap_set_count(p_user, replace(p_product, 'aquastu.unlock.', ''), greatest(0, v_sign));
    select count(*) filter (where count > 0) into v_cur from public.entitlements where user_id = p_user and product in ('team1', 'team2');
    perform public.iap_set_count(p_user, 'team', v_cur);
    v_result := 'team ' || v_cur;
  elsif p_product = 'aquastu.unlock.bigwood' then
    perform public.iap_set_count(p_user, 'bigwoodSet', greatest(0, v_sign));
    v_result := 'bigwood ' || v_sign;
  else
    v_result := 'unknown product';
  end if;

  update public.iap_events set result = v_result where id = p_event_id;
  return v_result;
end $$;

revoke all on function public.iap_add_paid(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.iap_set_count(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.iap_apply(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.iap_apply(text, uuid, text, text) to service_role;

/** 館長パスの採取倍カードを受け取る（ゲームの持ち物へ移すので、サーバーの数は0に戻す）。受け取った枚数を返す */
create or replace function public.claim_pass_cards() returns integer
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_n integer;
begin
  if v_uid is null then raise exception 'ログインが必要です'; end if;
  select count into v_n from public.entitlements where user_id = v_uid and product = 'pass_cards' for update;
  if coalesce(v_n, 0) <= 0 then return 0; end if;
  update public.entitlements set count = 0, updated_at = now() where user_id = v_uid and product = 'pass_cards';
  return v_n;
end $$;

revoke all on function public.claim_pass_cards() from public, anon;
grant execute on function public.claim_pass_cards() to authenticated;
