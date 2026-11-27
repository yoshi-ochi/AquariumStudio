import { DESTINATIONS, getCreature } from './creatureData.js';
import { getDef } from '../tanks/tankData.js';
import { crowding, shallowSpecies } from './tankLife.js';

/** バックヤードの飼育設備（冷凍庫など）の効果。lifeSystems が毎秒更新する */
const facilities = { freezer: 0, liveFeed: 0, foodPrep: 0 };
export const setCareFacilities = (counts) => Object.assign(facilities, counts);
const has = (id) => facilities[id] > 0;
export function facilityBonus() {
  return (has('freezer') ? 0.05 : 0) + (has('liveFeed') ? 0.08 : 0) + (has('foodPrep') ? 0.04 : 0);
}
const feedInterval = () => FEED_INTERVAL * (has('foodPrep') ? 1.5 : 1);

/** 飼育：エサ・水温・混泳の相性。tank.userData.care = { fed, water } */
const H = 3600 * 1000;
export const FEED_INTERVAL = 8 * H;
export const WATER = {
  tropical: { label: '熱帯 26℃' },
  temperate: { label: '温帯 18℃' },
  cold: { label: '冷水 8℃' },
};

export const REGION_ZONE = { iso: 'temperate', sanriku: 'temperate', reef: 'tropical', gbr: 'tropical', ocean: 'tropical', galapagos: 'tropical', okhotsk: 'cold', deep: 'cold' };
export const JOINT_ZONE = { seela: 'cold', demenigisu: 'cold', daiou: 'cold', greenland: 'cold' };
const PREDATOR_FORMS = new Set(['shark', 'hammer', 'eel', 'squid', 'whale']);

export function zoneOf(id) {
  const z = getCreature(id)?.zone; // 管理者が設定した生息環境
  if (WATER[z]) return z;
  if (JOINT_ZONE[id]) return JOINT_ZONE[id];
  const d = DESTINATIONS.find((x) => x.pool.includes(id));
  return (WATER[d?.zone] && d.zone) || REGION_ZONE[d?.id] || 'temperate';
}

const speciesIn = (tank) => Object.entries(tank.userData.creatures ?? {}).filter(([id, n]) => n > 0 && getCreature(id));
export const hasLife = (tank) => speciesIn(tank).length > 0;

export function ensureCare(tank, now = Date.now()) {
  const list = speciesIn(tank);
  tank.userData.care ??= { fed: now, water: list.length ? zoneOf(list[0][0]) : 'tropical' };
  return tank.userData.care;
}

/** 水温が合わない生物の割合 */
export function waterMismatch(tank) {
  const list = speciesIn(tank);
  const total = list.reduce((s, [, n]) => s + n, 0);
  if (!total) return 0;
  const { water } = ensureCare(tank);
  return list.reduce((s, [id, n]) => s + (zoneOf(id) === water ? 0 : n), 0) / total;
}

/** 大型の捕食者と、食べられてしまう小さな生物が同居しているか */
export function predatorConflict(tank) {
  const list = speciesIn(tank).map(([id]) => getCreature(id));
  const hunters = list.filter((c) => PREDATOR_FORMS.has(c.form) && !c.plankton); // ジンベエザメなどプランクトン食は除く
  return hunters.some((h) => list.some((c) => c !== h && c.len < h.len / 4));
}

export const isHungry = (tank, now = Date.now()) => hasLife(tank) && now - ensureCare(tank, now).fed >= feedInterval();
export const nextFeedIn = (tank, now = Date.now()) => Math.max(0, feedInterval() - (now - ensureCare(tank, now).fed)) / 1000;

/** 過密による低下。収容枠の目安を超えると下がり、2倍で6割 */
export function crowdFactor(tank) {
  const r = crowding(tank, getDef(tank.userData.defId));
  return r <= 1 ? 1 : Math.max(0.3, 1 - (r - 1) * 0.4);
}

/** 水深が体高より浅い個体の割合で下げる（全部なら 0.5 倍） */
export function depthFactor(tank) {
  const low = new Set(shallowSpecies(tank));
  if (!low.size) return 1;
  const list = speciesIn(tank);
  const total = list.reduce((s, [, n]) => s + n, 0);
  return 1 - 0.5 * (list.reduce((s, [id, n]) => s + (low.has(id) ? n : 0), 0) / total);
}

/** 幸福度 0.3〜1.17。エサ・水温・混泳・過密・水深・飼育設備で決まり、展示生物の魅力に掛かる */
export function tankHealth(tank, now = Date.now()) {
  if (!hasLife(tank)) return 1;
  const over = (now - ensureCare(tank, now).fed) / feedInterval();
  const food = over <= 1 ? 1 : Math.max(0.3, 1 - (over - 1) * 0.5);
  const temp = 1 - waterMismatch(tank) * 0.6;
  return Math.max(0.3, food * temp * (predatorConflict(tank) ? 0.7 : 1) * crowdFactor(tank) * depthFactor(tank) * (1 + facilityBonus()));
}
export const tankHappiness = tankHealth;

export const feedCost = (tank) => Math.round(speciesIn(tank).reduce((s, [id, n]) => s + getCreature(id).slots * n * 30, 0) * (has('freezer') ? 0.8 : 1));

export function feed(tank, now = Date.now()) {
  ensureCare(tank, now).fed = now;
}

