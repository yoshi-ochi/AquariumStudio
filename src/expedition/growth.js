import { CREATURES, DESTINATIONS, JOINT_PROJECTS, CATCH_WEIGHT, DEFAULT_HOME, travelPlan, getCreature } from './creatureData.js';
import { SPECIES_METHODS, METHODS } from './fishingData.js';

/**
 * 生き物の成長（魚種ごとのレベル 1〜999）。在庫の同じ魚種を使うと経験値が入り、レベルが上がる。
 * レベルが上がるほど体が大きくなり（成魚の60%→100%）、集客力も上がる。
 *
 * 目安：やり込む人（調査隊10隊・1日8時間ほど遊ぶ）が1つの魚種に集中して、Lv300 まで約30日。
 *   1匹あたりの経験値は星の数ごとに揃える（GROWTH_RULES.xpFixed。管理者ツールで変更可。0 なら捕れやすさから自動計算）。
 *   1日に得られる経験値が DAILY_XP、Lv300 までの累計が DAILY_XP×30 になるよう、全魚種共通の曲線を作る。
 *   星2までの魚は、Lv1→2 でも2匹分以上の経験値が要るように、1レベルの経験値に下限を設ける。
 */
export const MAX_LEVEL = 999;
const DAILY_XP = 10000;
const DAYS_TO_300 = 30;
const CURVE = 1.5; // 次のレベルまでの経験値 ∝ Lv^1.5（後半ほどゆっくり。Lv999 は約20か月）
const MIN_FISH = 2; // 星2までの魚で、1レベルに最低何匹ぶん要るか

// やり込みの想定（調査隊は最大の10隊）
const TEAMS = 10;
const ACTIVE_HOURS = 8;
const CHECK_SEC = 20 * 60; // 遊んでいる間、約20分ごとに受け取って出し直す（短い遠征もこれより速くは回らない）
const FISH_PER_TRIP = 3; // 1回の遠征で2〜4匹

/** やり込んだときに1日に手に入る匹数（その魚種がいちばん捕れる採取地・漁法で） */
function perDay(id) {
  let best = 0;
  for (const d of DESTINATIONS) {
    if (!d.pool.includes(id)) continue;
    const trip = travelPlan(d, DEFAULT_HOME).seconds;
    for (const m of [null, ...METHODS]) {
      if (m && !SPECIES_METHODS[id]?.includes(m.id)) continue;
      const usable = m ? d.pool.filter((x) => SPECIES_METHODS[x]?.includes(m.id)) : d.pool;
      const total = usable.reduce((s, x) => s + CATCH_WEIGHT[getCreature(x).stars], 0);
      const share = CATCH_WEIGHT[getCreature(id).stars] / total;
      const trips = (ACTIVE_HOURS * 3600) / Math.max(trip, CHECK_SEC) + 1; // 寝ている間に1回
      best = Math.max(best, TEAMS * trips * FISH_PER_TRIP * share);
    }
  }
  // 合同調査でしか捕れない生き物（同盟で数時間ごとに数匹）
  for (const p of JOINT_PROJECTS) if (p.pool.includes(id)) best = Math.max(best, (16 / p.hours) * (FISH_PER_TRIP / p.pool.length));
  return best || 1;
}

/**
 * 星の数ごとの調整（管理者の設定で上書き。creatureConfig.js）。キーは星の数 1〜6
 *   xpFixed  … 1匹の経験値（星の数ごとに揃える。0 にすると捕れやすさからの自動計算）
 *   xpMul    … 1匹の経験値（自動計算）にかける倍率
 *   xpMin    … 1匹の経験値の下限（捕りやすい漁法がある星の多い魚が、星の少ない魚より安くならないように）
 *   levelMul … レベルアップに要る経験値にかける倍率
 */
export const GROWTH_RULES = {
  xpMul: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 },
  xpMin: { 1: 1, 2: 1, 3: 50, 4: 50, 5: 250, 6: 250 },
  xpFixed: { 1: 50, 2: 75, 3: 150, 4: 250, 5: 500, 6: 800 },
  levelMul: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 },
};
/** 魚種ごとに固定した1匹の経験値（管理者の設定。無ければ星の数の規則で決める） */
export const XP_OVERRIDE = {};

const starsOf = (id) => getCreature(id)?.stars ?? 1;
const rule = (key, id) => {
  const v = GROWTH_RULES[key][starsOf(id)] ?? (key === 'xpMul' || key === 'levelMul' ? 1 : 0);
  return key === 'levelMul' ? Math.max(0.05, v) : v; // 0 にすると全レベルが一度に上がるため下限を置く
};

/** 1匹を成長に使ったときの経験値（自動計算は捕れやすさから。rebuildGrowth で作り直す） */
export const XP_AUTO = {};
export const XP_PER_FISH = {};
export const xpPerFish = (id) => XP_PER_FISH[id] ?? 1;

/** 累計の表。CUM[lv] = Lv1 から lv までに必要な経験値（星の数の倍率をかける前） */
let CUM = [0, 0];

/** 経験値の表を作り直す（起動時と、管理者の設定を反映したとき） */
export function rebuildGrowth() {
  for (const k of Object.keys(XP_PER_FISH)) delete XP_PER_FISH[k];
  for (const c of CREATURES) {
    XP_AUTO[c.id] = Math.max(1, Math.min(50000, Math.round(DAILY_XP / perDay(c.id))));
    const fixed = XP_OVERRIDE[c.id] || rule('xpFixed', c.id);
    XP_PER_FISH[c.id] = fixed > 0 ? Math.round(fixed) : Math.max(1, Math.min(50000, Math.max(rule('xpMin', c.id), Math.round(XP_AUTO[c.id] * rule('xpMul', c.id)))));
  }
  // 1レベルの経験値の下限：星2までの魚の「1匹の経験値」の最大×2
  const low = CREATURES.filter((c) => c.stars <= 2 && !c.retired).map((c) => XP_PER_FISH[c.id]);
  const floor = MIN_FISH * Math.max(1, ...low);
  // Lv300 までの累計が DAILY_XP×30 になる a を探す
  const step = (a, k) => Math.max(floor, Math.round(a * k ** CURVE));
  const total = (a) => {
    let s = 0;
    for (let k = 1; k < 300; k++) s += step(a, k);
    return s;
  };
  const target = DAILY_XP * DAYS_TO_300;
  let lo = 0;
  let hi = 10;
  while (total(hi) < target) hi *= 2;
  for (let n = 0; n < 50; n++) {
    const mid = (lo + hi) / 2;
    if (total(mid) < target) lo = mid;
    else hi = mid;
  }
  const cum = [0, 0];
  for (let lv = 1; lv < MAX_LEVEL; lv++) cum.push(cum[lv] + step(hi, lv));
  CUM = cum;
}
rebuildGrowth();

/** 魚種 id の Lv に達するまでの累計経験値（id を省くと倍率1の基準） */
const cumAt = (lv, id) => Math.round(CUM[Math.min(MAX_LEVEL, Math.max(1, lv))] * (id ? rule('levelMul', id) : 1));
export const xpForLevel = (lv, id) => cumAt(lv, id);
/** 星 n の魚が Lv に達するまでの累計経験値（管理者ツールのグラフ用） */
export const xpForStarLevel = (lv, r) => Math.round(CUM[Math.min(MAX_LEVEL, Math.max(1, lv))] * Math.max(0.05, GROWTH_RULES.levelMul[r] ?? 1));
export function levelOf(xp = 0, id) {
  let lo = 1;
  let hi = MAX_LEVEL;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cumAt(mid, id) <= xp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
/** 今のレベルの中での進み具合 { lv, have, need }（経験値） */
export function progressOf(xp = 0, id) {
  const lv = levelOf(xp, id);
  if (lv >= MAX_LEVEL) return { lv, have: 0, need: 0 };
  return { lv, have: xp - cumAt(lv, id), need: cumAt(lv + 1, id) - cumAt(lv, id) };
}
/** 次のレベルまでに要る匹数（最大レベルなら Infinity） */
export function fishToNext(id, xp = 0) {
  const p = progressOf(xp, id);
  return p.need ? Math.ceil((p.need - p.have) / xpPerFish(id)) : Infinity;
}
/** 体の大きさの倍率（Lv1 で 0.6、Lv999 で 1） */
export const sizeOf = (lv) => 0.6 + 0.4 * Math.sqrt((lv - 1) / (MAX_LEVEL - 1));
/** 集客力の倍率（Lv1 で 1、Lv300 で約1.15、Lv999 で 1.5） */
export const appealOf = (lv) => 1 + 0.5 * ((lv - 1) / (MAX_LEVEL - 1));

/** 総合レベルで星の数にかける重み */
export const STAR_WEIGHT = { 1: 1, 2: 1.5, 3: 2.5, 4: 4, 5: 6, 6: 10 };

/** 総合レベル：展示している魚種ごとの「レベル×星の重み」の合計（同じ魚種は何匹でも1回） */
export function totalScore(tanks, levelOfId) {
  const ids = new Set();
  for (const t of tanks) for (const [id, n] of Object.entries(t.userData.creatures ?? {})) if (n > 0 && getCreature(id)) ids.add(id);
  let s = 0;
  for (const id of ids) s += levelOfId(id) * STAR_WEIGHT[getCreature(id).stars];
  return Math.round(s);
}

// 展示の大きさ・集客の計算から参照するレベル（main で在庫と結びつける。訪問先の水族館も同じ仕組み）
let source = () => 1;
export const setLevelSource = (fn) => (source = fn);
export const speciesLevel = (id) => source(id);
