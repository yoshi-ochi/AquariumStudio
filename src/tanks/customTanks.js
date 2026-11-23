/**
 * 水槽建造：プレイヤーが形と寸法を決めて作る水槽。
 * 定義の ID に形と寸法（cm）を埋め込むので、セーブには ID だけ残せば復元できる。
 *   例: cx_box_150_60_45（幅150・高さ60・奥行45cm） / cx_cylinder_120_150_120
 *   描いた形: cx_poly_<高さcm>_<頂点>（頂点は10cm単位の x.z を36進で '-' 区切り）
 */
import { addDef, hasDef, getDef } from './tankData.js';
import { polyArea, isSimplePoly } from './polyTank.js';

/** 描いた形の範囲（10cm単位） */
export const DRAW_GRID = { w: 100, d: 100, unit: 10 };

/**
 * 寸法の上限（cm）。世界の大型水族館の主水槽のうち上位約5%（約20基）の平均は約1,200万L（約12,000m³）で、
 * 沖縄美ら海水族館「黒潮の海」（7,500m³）級より一回り大きい。そこで幅40m×奥行30m を上限にする（高さは以前のセーブとの互換のため15mのまま）。
 */
export const BUILD_SHAPES = {
  box: { label: '四角', limits: { w: [20, 4000], h: [20, 1500], d: [20, 3000] } },
  cylinder: { label: '円形', limits: { w: [30, 3500], h: [30, 1500] } },
  poly: { label: '自由に描く', limits: { h: [20, 1500] } },
};
const ID_RE = /^cx_(box|cylinder)_(\d+)_(\d+)_(\d+)$/;
const POLY_RE = /^cx_poly_(\d+)_([0-9a-z]+\.[0-9a-z]+(?:-[0-9a-z]+\.[0-9a-z]+){2,39})$/;
const H = 3600;

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, Math.round(Number(v) || lo)));

/** 寸法（cm）を範囲内に丸める。円柱は奥行＝直径 */
export function normalizeSpec({ shape, w, h, d, pts }) {
  if (shape === 'poly') {
    // 頂点を格子に合わせ、左上を原点へ寄せる
    const q = (pts ?? []).map(([x, z]) => [Math.round(x), Math.round(z)]).filter(([x, z], i, a) => i === 0 || x !== a[i - 1][0] || z !== a[i - 1][1]);
    const mx = Math.min(...q.map((p) => p[0]));
    const mz = Math.min(...q.map((p) => p[1]));
    const norm = q.map(([x, z]) => [Math.min(DRAW_GRID.w, x - mx), Math.min(DRAW_GRID.d, z - mz)]);
    return { shape: 'poly', h: clamp(h, BUILD_SHAPES.poly.limits.h), pts: norm };
  }
  const s = BUILD_SHAPES[shape] ? shape : 'box';
  const L = BUILD_SHAPES[s].limits;
  const W = clamp(w, L.w);
  return { shape: s, w: W, h: clamp(h, L.h), d: s === 'cylinder' ? W : clamp(d, L.d) };
}

export const customId = (spec) =>
  spec.shape === 'poly' ? `cx_poly_${spec.h}_${spec.pts.map(([x, z]) => `${x.toString(36)}.${z.toString(36)}`).join('-')}` : `cx_${spec.shape}_${spec.w}_${spec.h}_${spec.d}`;

/** 描いた形が水槽にできるか（3点以上・辺が交差しない） */
export const validPoly = (spec) => spec.shape !== 'poly' || (spec.pts.length >= 3 && isSimplePoly(spec.pts));

/** 頂点（10cm単位）→ 中心を原点にした m 単位 */
function polyMeters(pts) {
  const u = DRAW_GRID.unit / 100;
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  return pts.map(([x, z]) => [(x - cx) * u, (z - cz) * u]);
}

export function parseCustomId(id) {
  const p = POLY_RE.exec(id ?? '');
  if (p) return normalizeSpec({ shape: 'poly', h: +p[1], pts: p[2].split('-').map((s) => s.split('.').map((v) => parseInt(v, 36))) });
  const m = ID_RE.exec(id ?? '');
  return m ? normalizeSpec({ shape: m[1], w: +m[2], h: +m[3], d: +m[4] }) : null;
}

/** 水量（m³） */
export function volumeOf(spec) {
  if (spec.shape === 'poly') return spec.pts.length >= 3 ? polyArea(polyMeters(spec.pts)) * (spec.h / 100) : 0;
  const [w, h, d] = [spec.w / 100, spec.h / 100, spec.d / 100];
  return spec.shape === 'cylinder' ? Math.PI * (w / 2) ** 2 * h : w * h * d;
}

/** 特注なので既製品より2割高い。集客は水量に応じる */
export const buildPrice = (spec) => Math.round((1.2 * (3000 + 140000 * volumeOf(spec) ** 0.9)) / 100) * 100;
export const buildAppeal = (spec) => Math.max(1, Math.round(22 * volumeOf(spec) ** 0.8 * 10) / 10);

export function customDef(spec) {
  const s = normalizeSpec(spec);
  if (s.shape === 'poly') {
    const poly = polyMeters(s.pts);
    const w = Math.max(...poly.map((p) => p[0])) * 2;
    const d = Math.max(...poly.map((p) => p[1])) * 2;
    // 描いた形は手間がかかるので、さらに1割高い
    return { id: customId(s), name: `特注 自由形 ${s.pts.length}角・高さ${s.h}cm`, shape: 'poly', poly, size: { w, h: s.h / 100, d }, volume: volumeOf(s), price: Math.round((buildPrice(s) * 1.1) / 100) * 100, appeal: buildAppeal(s), custom: true };
  }
  const name = s.shape === 'cylinder' ? `特注円形 Φ${s.w}×高さ${s.h}cm` : `特注 ${s.w}×${s.d}×${s.h}cm`;
  return { id: customId(s), name, shape: s.shape, size: { w: s.w / 100, h: s.h / 100, d: s.d / 100 }, price: buildPrice(s), appeal: buildAppeal(s), custom: true };
}

let onNew = () => {};
/** 新しく定義を加えたとき（サムネイル撮影など）の処理 */
export const setCustomHandler = (fn) => (onNew = fn);

/** 定義へ登録して返す（登録済みならそのまま） */
export function registerCustom(spec) {
  const def = customDef(spec);
  if (hasDef(def.id)) return getDef(def.id);
  const d = addDef(def);
  onNew(d);
  return d;
}

/** ID 一覧のうち建造水槽を登録する（セーブの読込前に呼ぶ） */
export function registerCustomIds(ids) {
  for (const id of ids) {
    const spec = parseCustomId(id);
    if (spec) registerCustom(spec);
  }
}

/** 掃除の間隔と費用。小さい水槽は職員、大きい水槽はダイバー */
export function customCleanSpec(def) {
  const v = def.volume ?? def.size.w * def.size.h * def.size.d * (def.shape === 'cylinder' ? Math.PI / 4 : 1);
  const crew = v < 0.1 ? 1 : v < 0.5 ? 2 : v < 2 ? 3 : 0;
  return {
    interval: Math.round((4 + 20 * Math.min(1, Math.sqrt(v / 4))) * H),
    staff: crew ? { crew, cost: Math.round((300 + 2500 * v ** 0.8) / 10) * 10, seconds: Math.round(15 + 80 * v ** 0.6) } : null,
    diver: v >= 0.2 ? { cost: Math.round((8000 + 12000 * v ** 0.8) / 100) * 100, seconds: Math.round(40 + 60 * Math.sqrt(v)) } : null,
  };
}
