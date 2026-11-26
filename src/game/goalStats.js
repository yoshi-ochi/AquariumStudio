import { DESTINATIONS, getCreature } from '../expedition/creatureData.js';
import { PIECES_PER_STAR } from '../expedition/growth.js';

/**
 * 中盤以降の目標（gameData.js の GOALS）の判定に使う数。LifeSystems.stats() に混ぜて毎秒計算する。
 *   layoutTanks 水槽内オブジェ（岩・サンゴ・海藻など）を5個以上置いた水槽の数
 *   embedded    壁に埋め込んだ水槽の数
 *   themeTanks  テーマ水槽の数：展示中の生き物が3種以上で、全部が同じ1つの採取地で捕れる
 *   placesDone  捕れる生き物を全種発見した採取地の数（地図に出ている採取地）
 *   rareShown   展示中の、レア度4の生き物の種数
 *   maxStars    いちばん育てた種の★の数（ピース8つで★1）
 */
export const LAYOUT_ITEMS = 5;
export const THEME_MIN = 3;

export function goalStats(manager, expeditions) {
  const tanks = manager.tanks;
  const shown = new Set();
  let layoutTanks = 0;
  let embedded = 0;
  let themeTanks = 0;
  for (const t of tanks) {
    if (t.userData.embed) embedded++;
    if (manager.interiorItems(t).length >= LAYOUT_ITEMS) layoutTanks++;
    const ids = Object.entries(t.userData.creatures ?? {}).filter(([id, n]) => n > 0 && getCreature(id)).map(([id]) => id);
    ids.forEach((id) => shown.add(id));
    if (ids.length >= THEME_MIN && DESTINATIONS.some((d) => ids.every((id) => d.pool.includes(id)))) themeTanks++;
  }
  let placesDone = 0;
  for (const d of DESTINATIONS) {
    const pool = d.pool.filter((id) => getCreature(id) && !getCreature(id).retired);
    if (pool.length && pool.every((id) => expeditions.seenCount(id) > 0)) placesDone++;
  }
  let maxStars = 0;
  for (const id of Object.keys(expeditions.xp ?? {})) maxStars = Math.max(maxStars, Math.floor(expeditions.pieces(id) / PIECES_PER_STAR));
  const rareShown = [...shown].filter((id) => getCreature(id).rarity === 4).length;
  return { layoutTanks, embedded, themeTanks, placesDone, rareShown, maxStars };
}
