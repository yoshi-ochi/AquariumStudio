// バックヤードの研究と繁殖の定義（データのみ）

/** 研究の最大レベルと、1レベルごとの効果（最大レベルで50%） */
export const MAX_RESEARCH = 100;
export const RESEARCH_STEP = 0.005;
/** 研究レベルの効果の割合（0〜0.5） */
export const researchBonus = (level) => Math.min(MAX_RESEARCH, Math.max(0, level)) * RESEARCH_STEP;

export const RESEARCH = [
  { id: 'display', name: '展示解説', text: '1レベルごとに来館者+0.5%（Lv100で+50%）' },
  { id: 'field', name: '採取技術', text: '1レベルごとに遠征費用-0.5%（Lv100で-50%）' },
  { id: 'breeding', name: '繁殖技術', text: '1レベルごとに産卵（妊娠）の時間-0.5%（Lv100で-50%）、アルビノ・変色個体の確率+0.01%（0.5%→Lv100で1.5%）。Lv2で紫・金も繁殖可能' },
  { id: 'welfare', name: '労務管理', text: '1レベルごとに賃金-0.5%（Lv100で-50%）' },
];

/** 次のレベルに必要なポイント（最大なら null）。10pt から1レベルごとに6%ずつ増える（Lv99→100 は約3,200pt） */
export const researchCost = (level) => (level >= MAX_RESEARCH ? null : Math.round(10 * 1.06 ** level));

/** 以前の研究（最大Lv3：展示+5%・採取-10%・繁殖-25%・労務-5% /Lv）の効果を、新しいレベルに直す */
const OLD_STEP = { display: 0.05, field: 0.1, breeding: 0.25, welfare: 0.05 };
export const migrateResearchLevel = (id, level) => Math.min(MAX_RESEARCH, Math.ceil(((OLD_STEP[id] ?? 0) * level) / RESEARCH_STEP - 1e-9));

/** 研究員1人・研究室1室あたりの毎分ポイント */
export const POINTS_PER_MIN = 1;
export const ARCHIVE_BONUS = 1.5;

/** レア度ごとの繁殖時間（時間） */
export const BREED_HOURS = { 1: 2, 2: 6, 3: 24, 4: 48 };
/** 繁殖技術 Lv2 が要るレア度（紫・金） */
export const BREED_HARD_RARITY = 3;
export const breedHours = (rarity, level) => Math.round(BREED_HOURS[rarity] * (1 - researchBonus(level)) * 10) / 10;

// ---- 魚の保持 ------------------------------------------------------------------
/** 建物のレベルごとの基本の保持枠 */
export const HOLD_BY_LEVEL = [30, 60, 100, 160, 240];
/** 地下の予備水槽1基あたりの保持枠 */
export const HOLD_PER_TANK = 30;
/** 拡張工事は建物が最大レベルでも同じ金額で続けられる */
export const EXPAND_COST = 500000;
export const EXPAND_SLOTS = 20;
