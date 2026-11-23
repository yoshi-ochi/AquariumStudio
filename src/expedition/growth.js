import { getCreature } from './creatureData.js';
import { LEGACY_STARS } from './legacyStars.js';

/**
 * 生き物の成長（魚種ごと）。在庫の同じ魚種を使うと、6つの8角星形のピース（各8ピース・計48）が順に埋まる。
 * 1ピースに要る匹数は星形ごとに増える（1つ目 15匹 … 6つ目 300匹。管理者ツールで変更可）。
 * ピースが埋まるほど体が大きくなり（成魚の60%→100%）、集客力も上がる。
 * セーブの expeditions.xp[id] には、成長に使った匹数（累計）を入れる。
 */
export const STAR_COUNT = 6;
export const PIECES_PER_STAR = 8;
export const MAX_PIECES = STAR_COUNT * PIECES_PER_STAR;
/** 星形ごとの1ピースの匹数（管理者の設定で上書き。creatureConfig.js） */
export const PIECE_FISH = [15, 30, 50, 80, 150, 300];
export const BASE_PIECE_FISH = [...PIECE_FISH];

/** CUM[p] = p ピース埋めるまでに使う匹数（累計） */
let CUM = [0];
export function rebuildGrowth() {
  const cum = [0];
  for (let p = 0; p < MAX_PIECES; p++) cum.push(cum[p] + Math.max(1, Math.round(PIECE_FISH[Math.floor(p / PIECES_PER_STAR)] || 1)));
  CUM = cum;
}
rebuildGrowth();

/** p ピース埋めるまでの累計匹数 */
export const fishForPieces = (p) => CUM[Math.min(MAX_PIECES, Math.max(0, p))];
/** 全部のピースを埋めるのに要る匹数 */
export const maxFish = () => CUM[MAX_PIECES];

/** 使った匹数から、埋まったピースの数（0〜48） */
export function piecesOf(used = 0) {
  let p = 0;
  while (p < MAX_PIECES && CUM[p + 1] <= used) p++;
  return p;
}
/** 次のピースまでの進み具合 { pieces, have, need }（匹） */
export function progressOf(used = 0) {
  const pieces = piecesOf(used);
  if (pieces >= MAX_PIECES) return { pieces, have: 0, need: 0 };
  return { pieces, have: used - CUM[pieces], need: CUM[pieces + 1] - CUM[pieces] };
}
/** 次のピースまでに要る匹数（全部埋まっていれば Infinity） */
export function fishToNext(used = 0) {
  const p = progressOf(used);
  return p.need ? p.need - p.have : Infinity;
}

/** 体の大きさの倍率（0ピースで 0.6、48ピースで 1） */
export const sizeOf = (pieces) => 0.6 + 0.4 * Math.sqrt(Math.min(MAX_PIECES, pieces) / MAX_PIECES);
/** 集客力の倍率（0ピースで 1、48ピースで 1.5） */
export const appealOf = (pieces) => 1 + 0.5 * (Math.min(MAX_PIECES, pieces) / MAX_PIECES);

/** ランキングでレア度にかける倍率（緑1・青3・紫5・金10） */
export const RANK_WEIGHT = { 1: 1, 2: 3, 3: 5, 4: 10 };
/** 魚種の点数：埋まったピースの数×レア度の倍率 */
export const speciesPoints = (id, pieces) => pieces * RANK_WEIGHT[getCreature(id)?.rarity ?? 1];

/** 総合レベル：展示している魚種ごとの点数の合計（同じ魚種は何匹でも1回） */
export function totalScore(tanks, piecesOfId) {
  const ids = new Set();
  for (const t of tanks) for (const [id, n] of Object.entries(t.userData.creatures ?? {})) if (n > 0 && getCreature(id)) ids.add(id);
  let s = 0;
  for (const id of ids) s += speciesPoints(id, piecesOfId(id));
  return Math.round(s);
}

/** 旧版（経験値）のセーブを匹数に直す：旧版の星ごとの1匹の経験値で割る */
const LEGACY_XP = { 1: 50, 2: 75, 3: 150, 4: 250, 5: 500, 6: 800 };
export const legacyXpToFish = (id, xp) => Math.round((xp || 0) / (LEGACY_XP[LEGACY_STARS[id]] ?? 50));

// 展示の大きさ・集客の計算から参照するピース数（main で在庫と結びつける。訪問先の水族館も同じ仕組み）
let source = () => 0;
export const setGrowthSource = (fn) => (source = fn);
export const speciesPieces = (id) => source(id);
