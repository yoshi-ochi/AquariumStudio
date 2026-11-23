-- 合同調査の出資：目標額を超えた分は次の回に繰り越し、続けて調査を始める。同じ調査は同時に99回まで。
-- alliance.sql（と joint_all_members.sql）の後に SQL Editor で Run。何度実行しても安全。
-- 戻り値は実際に受け付けた金額（99回分が調査中で受け付けられない分は、アプリが返金する）。

create or replace function public.fund_joint(p_project text, p_amount bigint) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_ally uuid := my_alliance();
  v_p record;
  v_xp bigint;
  v_run joint_runs;
  v_left bigint := p_amount;
  v_total bigint := 0;
  v_take bigint;
  v_running int;
begin
  if v_ally is null then raise exception '同盟に入っていません'; end if;
  if p_amount <= 0 or p_amount > 100000000 then raise exception '出資額が正しくありません'; end if;
  select * into v_p from joint_project(p_project);
  -- 同盟の行をロックして、同時の出資を1件ずつ処理する
  select xp into v_xp from alliances where id = v_ally for update;
  if alliance_level(v_xp) < v_p.need_level then raise exception '同盟レベルが足りません'; end if;

  while v_left > 0 loop
    select count(*) into v_running from joint_runs
      where alliance_id = v_ally and project = p_project and done_at > now();
    exit when v_running >= 99; -- 同時に調査できるのは99回まで
    insert into joint_runs (alliance_id, project) values (v_ally, p_project) on conflict do nothing;
    select * into v_run from joint_runs
      where alliance_id = v_ally and project = p_project and done_at is null for update;
    v_take := least(v_left, v_p.cost - v_run.funded);
    update joint_runs set funded = funded + v_take,
      done_at = case when funded + v_take >= v_p.cost then now() + make_interval(hours => v_p.hours) end
      where id = v_run.id;
    insert into joint_contribs (run_id, user_id, amount) values (v_run.id, auth.uid(), v_take)
      on conflict (run_id, user_id) do update set amount = joint_contribs.amount + excluded.amount;
    v_left := v_left - v_take;
    v_total := v_total + v_take;
  end loop;

  update alliances set xp = xp + floor(v_total / 100000) where id = v_ally;
  return v_total;
end $$;

revoke all on function public.fund_joint(text, bigint) from public, anon;
grant execute on function public.fund_joint(text, bigint) to authenticated;
