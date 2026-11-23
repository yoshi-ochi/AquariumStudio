-- β版の生物データのリセット（サーバー側）。SQL Editor で Run。元に戻せないので、先に控えを取る。
-- プレイヤーのセーブ（捕まえた生き物・図鑑・成長）は、アプリが次に読み込んだときに1回だけ消す（src/online/betaReset.js）。
-- ここでは、セーブの外にある合同調査の記録と、生き物から計算したランキングを消す。同盟（名前・メンバー・同盟レベル）は残す。

-- 1) 控え（同じ日に2回実行するときは、先に drop table してから）
create table if not exists public.backup_joint_runs_20261123 as select * from public.joint_runs;
create table if not exists public.backup_joint_contribs_20261123 as select * from public.joint_contribs;
create table if not exists public.backup_rankings_20261123 as select * from public.rankings;
create table if not exists public.backup_saves_20261123 as select * from public.saves;
-- 控えはアプリから読めないようにする
alter table public.backup_joint_runs_20261123 enable row level security;
alter table public.backup_joint_contribs_20261123 enable row level security;
alter table public.backup_rankings_20261123 enable row level security;
alter table public.backup_saves_20261123 enable row level security;

-- 2) 合同調査の記録（資金集め中・調査中・完了済みのすべて。出資の記録は連鎖して消える）
delete from public.joint_runs;

-- 3) ランキング（各プレイヤーが次に遊んだときに、新しい点数で送り直される）
delete from public.rankings;

-- 確認
select (select count(*) from public.joint_runs) as joint_runs,
       (select count(*) from public.joint_contribs) as joint_contribs,
       (select count(*) from public.rankings) as rankings,
       (select count(*) from public.alliances) as alliances_kept,
       (select count(*) from public.backup_saves_20261123) as saves_backup;
