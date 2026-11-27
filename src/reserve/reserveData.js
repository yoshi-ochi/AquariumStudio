// 環境保護区の定義（データと計算だけ）。全体の設計は docs/monetization.md（段階6）
import { getCreature } from '../expedition/creatureData.js';

/** 水族館レベル6（環境保護区をもつ水族館）で解放 */
export const RESERVE_LEVEL = 6;
/** 区画の整備にかかる時間（建築の工事として進む） */
export const PARCEL_BUILD_SECONDS = 24 * 3600;

/**
 * 区画。kind: sea＝海域（クジラ・サメ・エイ・ウミガメなど大型の海の生き物）、land＝陸域（陸と水辺の動物・ウミガメの産卵浜）。
 * cost は整備費（コイン）、upkeep は毎時の維持費（コイン）。海域は4列×2段、陸域は4区画を地図の下に並べる
 */
export const PARCELS = [
  { id: 'bay', kind: 'sea', name: '入り江', text: '波の静かな浅い湾。イルカの子育てに向く', cost: 100_000_000, upkeep: 3_000_000 },
  { id: 'reef', kind: 'sea', name: 'サンゴ礁の海', text: 'ウミガメやマンタが集まる暖かい海', cost: 150_000_000, upkeep: 3_500_000 },
  { id: 'kelp', kind: 'sea', name: '海藻の森', text: '海藻が茂る冷たい沿岸', cost: 180_000_000, upkeep: 3_500_000 },
  { id: 'offshore', kind: 'sea', name: '外洋', text: '大型の回遊魚やサメが行き交う深く広い海', cost: 250_000_000, upkeep: 4_500_000 },
  { id: 'seamount', kind: 'sea', name: '海山', text: '深海から立ち上がる海の山。プランクトンが湧く', cost: 320_000_000, upkeep: 5_000_000 },
  { id: 'whale', kind: 'sea', name: 'クジラの回廊', text: 'クジラ類が回遊する広大な海域', cost: 450_000_000, upkeep: 6_000_000 },
  { id: 'icefloe', kind: 'sea', name: '流氷の海', text: '冬に流氷が寄る極寒の海', cost: 550_000_000, upkeep: 6_500_000 },
  { id: 'trench', kind: 'sea', name: '海溝の縁', text: '深い海溝に面した、巨大な生き物の通り道', cost: 700_000_000, upkeep: 8_000_000 },
  { id: 'beach', kind: 'land', name: '産卵の浜', text: 'ウミガメが上陸して卵を産む砂浜', cost: 80_000_000, upkeep: 2_000_000 },
  { id: 'mangrove', kind: 'land', name: 'マングローブ', text: '海と川が混じる林。水辺の生き物が暮らす', cost: 160_000_000, upkeep: 2_800_000 },
  { id: 'wetland', kind: 'land', name: '湿原', text: '水鳥や両生類が集まる広い湿地', cost: 240_000_000, upkeep: 3_500_000 },
  { id: 'cliff', kind: 'land', name: '海鳥の断崖', text: '海鳥が巣を作る切り立った海岸', cost: 360_000_000, upkeep: 4_500_000 },
];
export const getParcel = (id) => PARCELS.find((p) => p.id === id);

/** 区画の収容枠（水槽と同じ単位。大型の生き物は1匹10枠） */
export const PARCEL_CAPACITY = 200;
/** 保護している生き物の毎時の世話代（収容枠1つあたり） */
export const ANIMAL_UPKEEP_PER_SLOT = 50_000;
/** エコツアーの毎時の収入（集客力1あたり）。維持費の一部を取り戻せる */
export const ECO_PER_APPEAL = 5_000; // 区画をいっぱいにしても維持費の半分ほどにとどまる（保護区は持ち出しになる）
/** 保護の貢献度：集客力の合計の1/10。5ポイントごとに水族館の来館者+1%（最大+60%） */
export const CONTRIBUTION_PER_PCT = 5;
export const MAX_BONUS = 0.6;
/** 初めて保護した種ごとのダイヤ */
export const FIRST_PROTECT_DIA = { 1: 30, 2: 60, 3: 100, 4: 200 };

const SEA_FORMS = new Set(['whale', 'shark', 'hammer', 'ray', 'turtle', 'mola']); // マグロ型などは体長1.5m以上だけ
const LAND_FORMS = new Set(['turtle', 'amphibian', 'reptile', 'bird']);

/** その区画で保護できる生き物か（海域は大型の海の生き物、陸域は陸・水辺の生き物とウミガメ） */
export function canProtect(parcel, id) {
  const c = getCreature(id);
  if (!c) return false;
  if (parcel.kind === 'land') return LAND_FORMS.has(c.form) || c.habitat === 'land' || c.habitat === 'shore';
  return c.habitat !== 'land' && (c.len >= 1.5 || SEA_FORMS.has(c.form)) && c.form !== 'bird';
}
