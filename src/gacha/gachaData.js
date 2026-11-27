// 卵ガチャの定義（データと計算だけ）。全体の設計は docs/monetization.md
import { CREATURES } from '../expedition/creatureData.js';
import { GACHA_PLANNED } from './gachaSpecies.js';

/** 区分 */
export const CATS = {
  fish: { name: '魚類・古代魚', egg: '#e8c070', text: '太古の姿を残す古代魚たち' },
  amphibian: { name: '両生類', egg: '#9ad08a', text: '水と陸を行き来するイモリやカエル' },
  reptile: { name: '爬虫類', egg: '#d8c8a0', text: 'カメ・ワニ・ウミヘビ' },
  bird: { name: '鳥類', egg: '#c8dcf0', text: 'ペンギンや水辺の鳥' },
};
export const CAT_IDS = Object.keys(CATS);

/** レア度ごとの出る確率（%）。出る種がないレア度は除いて割り直す */
export const RATES = { 1: 60, 2: 28, 3: 10, 4: 2 };
export const PRICE = { one: 100, ten: 900 };
/** 10連は★3以上が1つ確定。100回で★4確定（★4が出たら数え直し） */
export const TEN_MIN_RARITY = 3;
export const PITY = 100;
/** 卵がかえるまでの時間（秒） */
export const HATCH_SECONDS = { 1: 600, 2: 3600, 3: 6 * 3600, 4: 24 * 3600 };
/** 区分に、モデルのある種がこの数そろったらガチャに並ぶ */
export const MIN_SPECIES = 3;

/**
 * 並ぶ2台の入れ替わり。3日ごとに片方ずつ交代する（各台は6日間並ぶ）。
 * 12日で一巡：（魚類・両生類）→（爬虫類・両生類）→（爬虫類・鳥類）→（魚類・鳥類）
 * 区切りは日本時間の 2026-11-30 0時から3日ごと。
 */
const EPOCH = Date.UTC(2026, 10, 29, 15); // 2026-11-30 0:00 JST
const PERIOD = 3 * 86400000;
export function machinesAt(now = Date.now()) {
  const k = Math.floor((now - EPOCH) / PERIOD);
  const slot0 = Math.floor((k + 1) / 2) % 2 === 0 ? 'fish' : 'reptile';
  const slot1 = Math.floor(k / 2) % 2 === 0 ? 'amphibian' : 'bird';
  const end = EPOCH + (k + 1) * PERIOD;
  // それぞれの台が次に入れ替わる時刻（交互に交代するので片方は3日後、もう片方は6日後）
  const slot0Ends = (k + 1) % 2 === 1 ? end : end + PERIOD;
  const slot1Ends = (k + 1) % 2 === 0 ? end : end + PERIOD;
  return [{ cat: slot0, until: slot0Ends }, { cat: slot1, until: slot1Ends }];
}

/** その区分でガチャに出る種（モデルのある種） */
export const poolOf = (cat) => CREATURES.filter((c) => c.gacha === cat);
/** モデル待ちの種の数 */
export const waitingOf = (cat) => GACHA_PLANNED.filter((p) => p.gacha === cat && !CREATURES.some((c) => c.id === p.id)).length;
export const isOpen = (cat) => poolOf(cat).length >= MIN_SPECIES;

/** 出る確率の表（画面に表示する）：[{ rarity, rate, species: [{ id, name, rate }] }] */
export function oddsOf(cat) {
  const pool = poolOf(cat);
  const tiers = Object.keys(RATES).map(Number).filter((r) => pool.some((c) => c.rarity === r));
  const total = tiers.reduce((s, r) => s + RATES[r], 0);
  return tiers.map((r) => {
    const list = pool.filter((c) => c.rarity === r);
    const rate = (RATES[r] / total) * 100;
    return { rarity: r, rate, species: list.map((c) => ({ id: c.id, name: c.name, rate: rate / list.length })) };
  });
}
