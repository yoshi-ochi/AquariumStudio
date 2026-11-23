/**
 * β版の生物データのリセット（レベル廃止・レア度の変更で整合しなくなった捕獲データを消す）。
 * セーブを読み込んだときに1回だけ行い、セーブに creatureReset の版を記録する。
 * 残すもの：レイアウト（水槽・設備・部屋）・資金・在庫の物品・スタッフ・調査隊の数・同盟の所属。
 * 消すもの：在庫と展示中の生き物・図鑑の発見記録・成長・航海中の調査隊・繁殖中の生き物・採集と合同調査のメール。
 * 合同調査の回と出資の記録は、サーバー側で消す（supabase/beta_reset_creatures.sql）。
 */
export const CREATURE_RESET = 1;

/** 消すメールの種類（採集の報告・漁の結果・合同調査） */
const MAIL_KINDS = new Set(['trip', 'catch', 'allyrun']);

/** data（セーブ）を書き換える。リセットしたら true */
export function applyCreatureReset(data) {
  if (!data || (data.creatureReset ?? 0) >= CREATURE_RESET) return false;
  const ex = data.expedition ?? {};
  data.expedition = { extraTeams: ex.extraTeams ?? 0, trips: [], creatures: {}, seen: {}, xp: {}, xpv: 4 };
  for (const o of data.objects ?? []) delete o.creatures;
  const life = data.life;
  if (life) {
    if (life.backyard) life.backyard.jobs = {};
    if (life.mail) {
      life.mail.items = (life.mail.items ?? []).filter((m) => !MAIL_KINDS.has(m.kind));
      life.mail.keys = (life.mail.keys ?? []).filter((k) => !String(k).startsWith('allyrun:'));
    }
  }
  data.creatureReset = CREATURE_RESET;
  return true;
}
