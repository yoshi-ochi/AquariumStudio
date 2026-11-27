// 建築にかかる時間（秒）。データと計算だけ
const H = 3600;

/** 水族館の昇格：Lv2 6時間／Lv3 24時間／Lv4 48時間／Lv5 3日／Lv6 5日 */
const STAGE_HOURS = { 2: 6, 3: 24, 4: 48, 5: 72, 6: 120 };
export const stageSeconds = (level) => (STAGE_HOURS[level] ?? 0) * H;

/** 屋外生け簀：解放に2日、区画は1マス5分 */
export const PEN_UNLOCK_SECONDS = 48 * H;
export const PEN_CELL_SECONDS = 300;

/**
 * エリアの建築時間
 * - 別館：1F 24時間 → 10F 240時間（10日）を等比で
 * - 地下展示室：1室目 1時間 → 8室目 12時間を等比で
 * - そのほか：費用に応じて10分〜12時間（無料のエリアは0）
 */
export function zoneSeconds(z) {
  if (!z || z.auto) return 0;
  const n = Number(/\d+$/.exec(z.id)?.[0] ?? 1);
  if (z.wing) return Math.round(24 * 10 ** ((n - 1) / 9)) * H;
  if (z.annex) return Math.round(10 * 12 ** ((n - 1) / 7)) * H / 10;
  if (!(z.cost > 0)) return 0;
  return Math.round(Math.min(12 * H, Math.max(600, 600 * (z.cost / 150000) ** 1.07)) / 60) * 60;
}

/** 残り時間の表示（例：2日3時間・5時間12分・8分30秒） */
export function fmtLeft(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}日${h ? `${h}時間` : ''}`;
  if (h) return `${h}時間${m ? `${m}分` : ''}`;
  if (m) return `${m}分${s % 60 ? `${s % 60}秒` : ''}`;
  return `${s % 60}秒`;
}
