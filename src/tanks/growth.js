/**
 * 流木の編集データ。growth.parts = [{ pts: [[x, y, z], ...], r }]（幹と枝。interiorBuilder.js）
 * サンゴ・海藻などの生き物オブジェは src/flora/（floraBuilder.js の normalizeFlora）
 */
export function normalizeGrowth(g = {}) {
  const out = {};
  if (Array.isArray(g.parts)) out.parts = g.parts.map((p) => ({ pts: p.pts.map((q) => [...q]), r: p.r }));
  return out;
}
