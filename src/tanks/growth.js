import * as THREE from 'three';
import { mulberry32 } from './random.js';

/**
 * 方向つきの成長。growth.ext = { x, z }（オブジェのローカル XZ, m）。
 * 群体の範囲は「原点から ext まで伸びたカプセル」（半径 R は種ごとに一定）。
 * ドラッグした方向にだけ範囲が伸び、反対側は広がらない。
 * growth.density は個体の密度の倍率（0.25〜3、標準1）。範囲の広さはそのままで、枝・ポリプ・株の数が変わる。
 */
export const MAX_EXT = 0.8;
export const DENSITY = { min: 0.25, max: 3 };
/** 密度の倍率（保存値が無い・壊れているときは1） */
export const densityOf = (g) => Math.min(DENSITY.max, Math.max(DENSITY.min, Number.isFinite(g?.density) ? g.density : 1));

export function normalizeGrowth(g = {}) {
  const ext = g.ext ?? { x: 0, z: 0 };
  const out = { ext: { x: ext.x ?? 0, z: ext.z ?? 0 } };
  if (g.density != null && densityOf(g) !== 1) out.density = densityOf(g);
  if (Array.isArray(g.parts)) out.parts = g.parts.map((p) => ({ pts: p.pts.map((q) => [...q]), r: p.r })); // 流木の各パーツ
  if (Array.isArray(g.nodes)) out.nodes = g.nodes.map((n) => ({ a: [...n.a], b: [...n.b], r: n.r, p: n.p })); // パーツ編集サンゴ
  return out;
}

export function capsule(R, ext) {
  const bx = ext.x;
  const bz = ext.z;
  const L2 = bx * bx + bz * bz;
  const nearest = (x, z) => {
    const t = L2 > 0 ? Math.min(1, Math.max(0, (x * bx + z * bz) / L2)) : 0;
    return [t * bx, t * bz];
  };
  return {
    R,
    ext,
    length: Math.sqrt(L2),
    nearest,
    inside(x, z, margin = 0) {
      const [px, pz] = nearest(x, z);
      return Math.hypot(x - px, z - pz) <= R - margin;
    },
    bounds: { x0: Math.min(0, bx) - R, x1: Math.max(0, bx) + R, z0: Math.min(0, bz) - R, z1: Math.max(0, bz) + R },
  };
}

function hashInt(seed, i, j) {
  let h = (seed ^ Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return (h ^ (h >>> 12)) >>> 0;
}

/**
 * 格子点 + ゆらぎで個体の位置を決める。各個体は格子セル固有の乱数を持つので、
 * 範囲が伸びても既存の個体は動かず、新しいセルにだけ個体が増える。
 */
export function lattice(seed, density, region, margin = 0, growth) {
  const cell = 1 / Math.sqrt(density * densityOf(growth));
  const { x0, x1, z0, z1 } = region.bounds;
  const out = [];
  for (let i = Math.floor(x0 / cell); i <= Math.ceil(x1 / cell); i++) {
    for (let j = Math.floor(z0 / cell); j <= Math.ceil(z1 / cell); j++) {
      const rand = mulberry32(hashInt(seed, i, j));
      const x = (i + 0.15 + rand() * 0.7) * cell;
      const z = (j + 0.15 + rand() * 0.7) * cell;
      if (region.inside(x, z, margin)) out.push({ p: new THREE.Vector2(x, z), rand });
    }
  }
  // 最低1個体
  if (!out.length) out.push({ p: new THREE.Vector2(0, 0), rand: mulberry32(hashInt(seed, 0, 0)) });
  return out;
}

/** 平たいカプセル形の Shape（XZ 平面用：shape の y = -z） */
export function capsuleShape(region, R, wobbleSeed = 0) {
  const { x: bx, z: bz } = region.ext;
  const th = Math.atan2(-bz, bx);
  const s = new THREE.Shape();
  s.absarc(0, 0, R, th + Math.PI / 2, th + (Math.PI * 3) / 2, false);
  s.absarc(bx, -bz, R, th - Math.PI / 2, th + Math.PI / 2, false);
  s.closePath();
  const geo = new THREE.ShapeGeometry(s, 16);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const a = Math.atan2(pos.getY(i), pos.getX(i));
    const f = 1 + 0.05 * Math.sin(a * 7 + wobbleSeed);
    pos.setXY(i, pos.getX(i) * f, pos.getY(i) * f);
  }
  geo.rotateX(-Math.PI / 2);
  return geo;
}


/** 平らなジオメトリ（XZ 平面）の各頂点を、下の表面の高さ＋lift に沿わせる */
export function drape(geo, surface, lift = 0) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + surface(pos.getX(i), pos.getZ(i)) + lift);
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}
