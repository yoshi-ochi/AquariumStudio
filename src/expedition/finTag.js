import * as THREE from 'three';

/**
 * ひれの部位を頂点に記録する（泳ぎのシェーダーで部位ごとに動かすため）。
 *   aFin  … 0 体・その他 / 1 背びれ / 2 尻びれ（腹側の正中のひれ） / 3 尾びれ / 4 胸びれ / 5 腹びれ
 *   aFinT … ひれの付け根 0 → 先端 1（付け根から離れるほど大きく動く）
 */
export const FIN = { BODY: 0, DORSAL: 1, ANAL: 2, CAUDAL: 3, PAIRED: 4, PELVIC: 5 };

/** base: 付け根の点列 [[x, y, z], ...]（体の座標） */
export function tagFin(g, kind, base) {
  const pos = g.attributes.position;
  const n = pos.count;
  const t = new Float32Array(n);
  let max = 1e-6;
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    let d = Infinity;
    for (const [bx, by, bz] of base) d = Math.min(d, Math.hypot(x - bx, y - by, z - bz));
    t[i] = d;
    max = Math.max(max, d);
  }
  for (let i = 0; i < n; i++) t[i] /= max;
  g.setAttribute('aFin', new THREE.Float32BufferAttribute(new Float32Array(n).fill(kind), 1));
  g.setAttribute('aFinT', new THREE.Float32BufferAttribute(t, 1));
  return g;
}

/** 印の無い部品（体・目など）は 0 で埋める（まとめるとき属性をそろえる） */
export function ensureFinAttrs(g) {
  const n = g.attributes.position.count;
  if (!g.attributes.aFin) g.setAttribute('aFin', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  if (!g.attributes.aFinT) g.setAttribute('aFinT', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  return g;
}

/** 付け根の点列から、背びれ・尻びれ・尾びれを見分ける（対になったひれは呼び出し側で決める） */
export function finKindOf(base) {
  const xs = base.map((p) => p[0]);
  const ys = base.map((p) => p[1]);
  const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
  const my = ys.reduce((s, v) => s + v, 0) / ys.length;
  const spanY = Math.max(...ys) - Math.min(...ys);
  const spanX = Math.max(...xs) - Math.min(...xs);
  if (mx < -0.32 && spanY >= spanX * 0.6) return FIN.CAUDAL;
  return my >= 0 ? FIN.DORSAL : FIN.ANAL;
}

const avg = (pts, i) => pts.reduce((s, p) => s + p[i], 0) / pts.length;

/**
 * 対になったひれ（lift 付き）のうち、腹びれを見分ける。fins は写真の点列、P は写真→モデル座標。
 *   2枚以上あるとき：低く（腹側）・後ろにあるほど腹びれ（タイ類は胸びれの下、イワシ・サメ類は後ろ、タラ類は前でも低い）
 *   1枚だけのとき：腹の深い位置から下へ垂れるひれは腹びれ（チョウチョウウオ・スズメダイ類は胸びれが透明で描かない）
 *   f.pelvic（true / false）で個別に指定できる
 */
export function pelvicSet(fins, P) {
  const lifts = fins.filter((f) => f.lift);
  const info = lifts.map((f) => {
    const b = f.base.map((p) => P(p));
    const o = f.outer.map((p) => P(p));
    return { f, x: avg(b, 0), y: avg(b, 1), dx: avg(o, 0) - avg(b, 0), dy: avg(o, 1) - avg(b, 1) };
  });
  const out = new Set();
  if (info.length >= 2) {
    const low = info.reduce((a, b) => (b.y + 0.3 * b.x < a.y + 0.3 * a.x ? b : a));
    out.add(low.f);
  } else if (info.length === 1) {
    const [i] = info;
    if (i.y < -0.12 && -i.dy >= -i.dx * 0.9) out.add(i.f);
  }
  for (const f of lifts) if (f.pelvic === true) out.add(f);
  else if (f.pelvic === false) out.delete(f);
  return out;
}
