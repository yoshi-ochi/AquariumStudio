import { ANATOMY } from './creatureAnatomy.js';
import { SPECIES_METHODS } from './fishingData.js';
import { NOTES } from './creatureNotes.js';
import { PLANNED, NEW_PLACES, MIN_POOL } from './speciesRoster.js';
import { RELEASES } from './speciesReleases.js';

/**
 * モデルが出来た予定種を本番の魚種に加え、新しい採取地を捕れる種がそろったものだけ公開する。
 * creatureData.js の読み込み時に1回だけ呼ぶ（管理者設定の反映より前）。
 */
export const isModeled = (p) => !!ANATOMY[p.id] || p.model === true;

export function releaseModeled({ creatures, places, hidden }) {
  for (const p of PLANNED) {
    if (!isModeled(p) || creatures.some((c) => c.id === p.id)) continue;
    const { methods, note, model, ...c } = p;
    creatures.push(c);
    if (methods?.length && !SPECIES_METHODS[p.id]) SPECIES_METHODS[p.id] = [...methods];
    if (note && !NOTES[p.id]) NOTES[p.id] = note;
  }
  for (const c of creatures) if (RELEASES[c.id]) c.released = RELEASES[c.id];

  for (const d of NEW_PLACES) if (!places.some((x) => x.id === d.id)) places.push(structuredClone(d));
  const alive = new Set(creatures.map((c) => c.id));
  for (const d of places) d.pool = d.pool.filter((id) => alive.has(id));
  // 捕れる種が少ない採取地は地図に出さない（予定種のモデルがそろったら出る）
  for (let i = places.length - 1; i >= 0; i--) if (places[i].pool.length < MIN_POOL) hidden.push(...places.splice(i, 1));
}

/** 予定種の状況（開発用：tools/species-release.mjs が使う） */
export const plannedStatus = () => PLANNED.map((p) => ({ id: p.id, name: p.name, modeled: isModeled(p), released: RELEASES[p.id] ?? null, places: NEW_PLACES.filter((d) => d.pool.includes(p.id)).map((d) => d.name) }));
