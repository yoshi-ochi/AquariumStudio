-- 合同調査の成果を、出資していない同盟メンバーも受け取れるようにする。alliance.sql の後に SQL Editor で Run。何度実行しても安全。
-- 受け取れるのは、調査が完了した時点で同盟に入っていたメンバー（完了後に加入した人は対象外）。1人1回。

create or replace function public.claim_joint(p_run uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_run joint_runs; v_joined timestamptz;
begin
  if auth.uid() is null then return false; end if;
  select * into v_run from joint_runs where id = p_run;
  if v_run.done_at is null or v_run.done_at > now() then return false; end if;
  select joined_at into v_joined from alliance_members where user_id = auth.uid() and alliance_id = v_run.alliance_id;
  if v_joined is null or v_joined > v_run.done_at then return false; end if;
  insert into joint_contribs (run_id, user_id, amount, claimed) values (p_run, auth.uid(), 0, true)
    on conflict (run_id, user_id) do update set claimed = true where joint_contribs.claimed = false;
  return found;
end $$;

revoke all on function public.claim_joint(uuid) from public, anon;
grant execute on function public.claim_joint(uuid) to authenticated;
