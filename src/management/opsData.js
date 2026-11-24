// 運営のバランス定義（データのみ）

const H = 3600;

/**
 * 水槽ごとの掃除。interval: 掃除の間隔(秒)。
 * staff: 必要な清掃員の人数と消耗品費（null は職員では不可）。diver: 外部ダイバーの費用（null は依頼不可）。
 * 水量が少ない水槽ほど水が汚れやすく、間隔が短い。
 */
export const CLEANING = {
  cube30: { interval: 4 * H, staff: { crew: 1, cost: 200, seconds: 15 }, diver: null },
  tank45: { interval: 5 * H, staff: { crew: 1, cost: 300, seconds: 20 }, diver: null },
  tank60: { interval: 6 * H, staff: { crew: 1, cost: 500, seconds: 30 }, diver: null },
  tank120: { interval: 10 * H, staff: { crew: 2, cost: 1500, seconds: 60 }, diver: { cost: 8000, seconds: 40 } },
  tank180: { interval: 12 * H, staff: { crew: 3, cost: 3000, seconds: 90 }, diver: { cost: 15000, seconds: 60 } },
  round: { interval: 12 * H, staff: { crew: 3, cost: 3000, seconds: 90 }, diver: { cost: 15000, seconds: 60 } },
  tunnel: { interval: 24 * H, staff: null, diver: { cost: 80000, seconds: 180 } },
  atriumTank: { interval: 24 * H, staff: null, diver: { cost: 200000, seconds: 240 } },
  mammal: { interval: 18 * H, staff: null, diver: { cost: 120000, seconds: 240 } },
};

/** 職種。wage: 1人あたりの賃金(円/秒)。weight: 満足度への影響の大きさ */
export const ROLES = [
  { id: 'guide', name: '案内', wage: 3, weight: 25, text: '来館者の案内' },
  { id: 'keeper', name: '飼育', wage: 4, weight: 30, text: '生き物の世話' },
  { id: 'cleaner', name: '清掃', wage: 3, weight: 20, text: '館内と水槽の掃除' },
  { id: 'research', name: '研究', wage: 8, weight: 5, text: '展示の研究' },
  { id: 'show', name: 'ショー', wage: 6, weight: 10, text: '大型水槽のショー' },
  { id: 'shop', name: '店舗', wage: 3, weight: 10, text: 'お土産店の接客' },
];

export const STARTING_STAFF = { guide: 1, keeper: 1, cleaner: 1, research: 0, show: 0, shop: 0 };
/** 案内係の上限。大水槽や生け簀で集客が大きくなっても、案内は館内の要所に50人いれば足りる */
export const GUIDE_MAX = 50;

/** 水族館の規模から必要な人数を求める */
export function requiredStaff({ potential, tanks, creatures, level, showTanks, shops, labs = 0 }) {
  return {
    guide: Math.min(GUIDE_MAX, Math.max(1, Math.ceil(potential / 80))),
    keeper: Math.max(1, Math.ceil(tanks / 4) + Math.floor(creatures / 25)),
    cleaner: Math.max(1, Math.ceil(tanks / 6)),
    research: Math.max(level - 1, labs),
    show: showTanks,
    shop: shops,
  };
}

// ---- お土産店 ----------------------------------------------------------------
/** カフェ：来館者のうち1秒あたりに利用する割合と客単価 */
export const CAFE_RATE = 0.004;
export const CAFE_PRICE = 800;
export const LOT_SIZE = 20;
/** 店員1人が1秒に接客できる客数 */
export const SALES_PER_STAFF = 0.4;
/** 来館者のうち1秒あたりに購入する割合 */
export const BUY_RATE = 0.01;

export const PRODUCTS = [
  { id: 'postcard', name: 'ポストカード', cost: 80, price: 200, weight: 5, stage: 1 },
  { id: 'keyholder', name: 'キーホルダー', cost: 200, price: 500, weight: 3, stage: 1 },
  { id: 'plush', name: 'ぬいぐるみ', cost: 900, price: 2000, weight: 2, stage: 1 },
  { id: 'book', name: '海の生き物図鑑', cost: 1200, price: 2800, weight: 1, stage: 2 },
  { id: 'model', name: '精密フィギュア', cost: 4000, price: 9000, weight: 0.5, stage: 3 },
];

/** 価格設定。factor: 定価への倍率、demand: 売れやすさ */
export const PRICE_TIERS = {
  low: { label: '安い', factor: 0.8, demand: 1.4 },
  std: { label: '定価', factor: 1, demand: 1 },
  high: { label: '高い', factor: 1.4, demand: 0.55 },
};
