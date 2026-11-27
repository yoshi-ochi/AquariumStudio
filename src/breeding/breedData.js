// 繁殖の定義（データと計算だけ）：雌雄比・繁殖のしかた・段階の時間・世話・生まれる数・アルビノの確率
import { getCreature, DESTINATIONS, JOINT_PROJECTS } from '../expedition/creatureData.js';
import { researchBonus } from '../building/backyardData.js';

const H = 3600;

/**
 * メスの割合（0〜1）。書いていない種は 0.5（1:1）。
 * ハーレムを作る種は、オス1匹に多くのメスがいるため群れのメスの割合が高い。
 */
const FEMALE_RATIO = {
  kingyohana: 0.85, hanagoi: 0.85, napoleon: 0.8, kobudai: 0.75, budai: 0.7, kyusen: 0.6,
  akahata: 0.7, kijihata: 0.7, tamakai: 0.65, deba: 0.6, misuji: 0.6,
  kakure: 0.5, kumanomi: 0.5, tatsu: 0.5,
};

/**
 * 性転換する種。protogyny＝メスからオスへ（ハタ・ベラ・ハナダイなど）、protandry＝オスからメスへ（クマノミ）。
 * 2匹いれば大きい方が性を変えてペアになれる。
 */
const SEX_CHANGE = {
  kakure: 'protandry', kumanomi: 'protandry',
  kingyohana: 'protogyny', hanagoi: 'protogyny', napoleon: 'protogyny', kobudai: 'protogyny', budai: 'protogyny', kyusen: 'protogyny',
  akahata: 'protogyny', kijihata: 'protogyny', tamakai: 'protogyny', deba: 'protogyny', misuji: 'protogyny',
};

/**
 * 繁殖のしかた。egg＝卵を産む、live＝お腹で育てて産む（胎生・卵胎生）、
 * brood＝卵を抱えて守る（エビ・カニ）、polyp＝ポリプから増える（クラゲ）
 */
const MODE_BY_FORM = { shark: 'live', hammer: 'live', ray: 'live', whale: 'live', seahorse: 'live', lobster: 'brood', crab: 'brood', horseshoe: 'egg', jelly: 'polyp' };
const MODE = { nekozame: 'egg', kasago: 'live', kurosoi: 'live', hanamino: 'egg', ogusoku: 'brood' };
export const modeOf = (id) => MODE[id] ?? MODE_BY_FORM[getCreature(id)?.form] ?? 'egg';

/** 段階の名前（しかたごと） */
const STAGE_NAMES = {
  egg: ['産卵', 'ふ化', '保育'],
  live: ['妊娠', '出産', '保育'],
  brood: ['抱卵', 'ふ化', '幼生の保育'],
  polyp: ['ポリプ', 'ストロビラ', 'エフィラの保育'],
};
export const stageNames = (id) => STAGE_NAMES[modeOf(id)];
/** タツノオトシゴはオスのお腹の袋で卵を育てる */
export const stageNote = (id) => (id === 'tatsu' ? 'オスのお腹の袋で卵を育てます' : '');

/** 段階の時間（時間）。0＝産卵（妊娠）だけ研究で短くなる（ふ化・保育は世話の期限を保つため短くしない） */
const STAGE_HOURS = [{ 1: 2, 2: 6, 3: 24, 4: 48 }, { 1: 4, 2: 6, 3: 8, 4: 12 }, { 1: 12, 2: 24, 3: 36, 4: 48 }];
export function stageSeconds(stage, rarity, level = 0) {
  const h = STAGE_HOURS[stage][rarity] ?? STAGE_HOURS[stage][1];
  return Math.round(h * H * (stage === 0 ? 1 - researchBonus(level) : 1));
}

/**
 * 世話の間隔（秒）と内容。世話は間隔ごとに現れ、次の世話が現れるまでが期限。
 * 0＝産卵：段階の半ばに1回（期限は段階の終わり） / 1＝ふ化：段階を3回に分けた間隔（3時間以上） / 2＝保育：6時間ごと
 * 3時間おきに見に来れば保育成功、8時間以上あくと失敗しやすい、くらいの厳しさ
 */
export const CARE = [
  { what: ['ペアの様子と水温を確かめる'], miss: 'pair' },
  { what: ['卵に酸素を送り、カビを取る', '水流と水温を整える'], miss: 'die', death: 0.4 },
  { what: ['稚魚にエサ（ワムシ・アルテミア）をあげる', '水換えをする', '水温と水質を確かめる'], miss: 'die', death: 0.35, interval: 6 * H },
];
/** 世話をしても起こる自然の減り（1回の世話ごと、1匹あたり） */
export const BASE_DEATH = 0.03;
/** ふ化の段階の世話の最短の間隔（秒） */
export const MIN_CARE_INTERVAL = 3 * H;
/** 産卵の段階：世話をしたときと逃したときに、産卵（妊娠）しない確率 */
export const SPAWN_FAIL = { done: 0.1, missed: 0.6 };
/** 保育成功に必要な、期限内に済ませた世話の割合 */
export const SUCCESS_RATIO = 0.8;

/** 生まれる数（全部うまく育ったとき） */
const BROOD = { egg: { 1: 6, 2: 4, 3: 3, 4: 2 }, brood: { 1: 6, 2: 4, 3: 3, 4: 2 }, polyp: { 1: 6, 2: 4, 3: 3, 4: 2 }, live: { 1: 4, 2: 3, 3: 2, 4: 1 } };
export const broodOf = (id) => BROOD[modeOf(id)][getCreature(id)?.rarity ?? 1] ?? 1;

/** アルビノ・変色個体の確率：0.5% から、繁殖技術の研究で最大 1.5% まで（アルビノ7割・変色3割） */
export const morphChance = (level) => 0.005 + 0.01 * (Math.min(100, Math.max(0, level)) / 100);
export const MORPHS = { albino: 'アルビノ', morph: '変色個体' };

/** 深海の種：繁殖水槽を深海繁殖装置に改造しないと繁殖できない */
export const DEEP_DEVICE_PRICE = 2000;
export function isDeepSea(id) {
  const c = getCreature(id);
  if (!c) return false;
  if (c.deep || ['barreleye', 'dumbo'].includes(c.form)) return true;
  return !!DESTINATIONS.find((d) => d.id === 'deep')?.pool.includes(id) || JOINT_PROJECTS.some((p) => p.pool.includes(id));
}

// ---- 雌雄 ------------------------------------------------------------------------

export const sexChangeOf = (id) => SEX_CHANGE[id] ?? null;
export const femaleRatio = (id) => FEMALE_RATIO[id] ?? 0.5;

/** 種 id と個体の番号から決まる 0〜1 の値（同じ在庫数なら毎回同じ雌雄になる） */
function hash01(id, k) {
  let h = 2166136261;
  for (const ch of `${id}#${k}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 2 ** 32;
}

/**
 * n 匹のときのオス・メスの数。個体ごとに雌雄比で決まり、在庫が増えても減っても同じ順で並ぶ。
 * 性転換する種は ♂♀の区別をせず、2匹いればペアになれる。
 */
export function sexCount(id, n) {
  const r = femaleRatio(id);
  let f = 0;
  for (let k = 0; k < n; k++) if (hash01(id, k) < r) f++;
  return { m: n - f, f };
}

/** ペアを作れるか */
export function hasPair(id, n) {
  if (sexChangeOf(id)) return n >= 2;
  const { m, f } = sexCount(id, n);
  return m >= 1 && f >= 1;
}

export function sexLabel(id, n) {
  const sc = sexChangeOf(id);
  if (sc) return `性転換する種（${sc === 'protandry' ? 'オス→メス' : 'メス→オス'}）・${n}匹`;
  const { m, f } = sexCount(id, n);
  return `♂${m} ♀${f}`;
}
