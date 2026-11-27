-- 卵ガチャの抽選（有償ダイヤを使う回）。wallet.sql の実行後に SQL Editor で Run。何度実行しても安全。
-- 有償ダイヤを減らし、抽選の乱数（1回に2つ）をサーバーで作って返す。記録は wallet_log と gacha_log に残す。
-- 無償ダイヤだけで引く回は端末で抽選する（purchases.js の gachaRandom）。

create table if not exists public.gacha_log (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  machine text not null,
  count integer not null,
  paid integer not null,
  rand double precision[] not null,
  created_at timestamptz not null default now()
);
create index if not exists gacha_log_user on public.gacha_log (user_id, created_at desc);
alter table public.gacha_log enable row level security;
drop policy if exists "gacha_log: 本人が読む" on public.gacha_log;
create policy "gacha_log: 本人が読む" on public.gacha_log for select using (auth.uid() = user_id);
revoke insert, update, delete on public.gacha_log from anon, authenticated;

create or replace function public.gacha_draw(p_machine text, p_count integer, p_paid integer) returns double precision[]
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_left integer; v_rand double precision[];
begin
  if v_uid is null then raise exception 'ログインが必要です'; end if;
  if p_machine not in ('fish', 'amphibian', 'reptile', 'bird') then raise exception 'ガチャが見つかりません'; end if;
  if p_count not in (1, 10) then raise exception '回数が正しくありません'; end if;
  -- 1回100・10連900ダイヤのうち、有償で払う分（無償の残りは端末で減らす）
  if p_paid is null or p_paid <= 0 or p_paid > (case when p_count = 10 then 900 else 100 end) then raise exception '数が正しくありません'; end if;
  update public.wallets set paid = paid - p_paid, updated_at = now()
    where user_id = v_uid and paid >= p_paid
    returning paid into v_left;
  if v_left is null then raise exception '有償ダイヤが足りません'; end if;
  select array_agg(random()) into v_rand from generate_series(1, p_count * 2);
  insert into public.wallet_log (user_id, amount, reason) values (v_uid, -p_paid, 'gacha:' || p_machine);
  insert into public.gacha_log (user_id, machine, count, paid, rand) values (v_uid, p_machine, p_count, p_paid, v_rand);
  return v_rand;
end $$;

revoke all on function public.gacha_draw(text, integer, integer) from public, anon;
grant execute on function public.gacha_draw(text, integer, integer) to authenticated;
