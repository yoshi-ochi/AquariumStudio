import * as THREE from 'three';
import { MATERIALS, RENDER_ORDER } from './materials.js';
import { waterSurfaceMesh } from '../water/waterSurface.js';
import { markWater, markSurface } from './waterLevel.js';

/**
 * 上から見た輪郭を描いて作る水槽（建造）。def.poly = [[x, z], ...]（m、中心が原点）。
 * 水槽内の配置・クリップは輪郭を囲む箱で扱う（凹んだ形でも箱の内側まで置ける）。
 */
const RIM_H = 0.025;

/** 平面の Shape（XY）。rotateX(-π/2) で XZ に寝かせる（z = -y） */
function shapeOf(poly, inset = 0) {
  const cx = 0;
  const pts = poly.map(([x, z]) => {
    if (!inset) return new THREE.Vector2(x, -z);
    const len = Math.hypot(x - cx, z) || 1;
    const k = Math.max(0, (len - inset) / len);
    return new THREE.Vector2(x * k, -z * k);
  });
  return new THREE.Shape(pts);
}

function slab(shape, depth, material, y) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, material);
  m.position.y = y;
  if (material === MATERIALS.water) m.renderOrder = RENDER_ORDER.WATER;
  else m.receiveShadow = true;
  return m;
}

export function buildPolyTank(g, def) {
  const { h } = def.size;
  const poly = def.poly;
  const t = 0.012;
  // ガラス壁：辺ごとの板
  for (let i = 0; i < poly.length; i++) {
    const [x0, z0] = poly[i];
    const [x1, z1] = poly[(i + 1) % poly.length];
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 1e-3) continue;
    const ang = Math.atan2(-(z1 - z0), x1 - x0);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(len, h, t), MATERIALS.glass);
    panel.renderOrder = RENDER_ORDER.GLASS;
    panel.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
    panel.rotation.y = ang;
    g.add(panel);
    for (const y of [RIM_H / 2, h - RIM_H / 2]) {
      const rim = new THREE.Mesh(new THREE.BoxGeometry(len + t, RIM_H, t * 1.6), MATERIALS.frame);
      rim.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
      rim.rotation.y = ang;
      rim.castShadow = true;
      rim.userData.rim = true;
      g.add(rim);
    }
  }
  const outer = shapeOf(poly);
  const inner = shapeOf(poly, t);
  const bottom = slab(outer, t, MATERIALS.glass, 0);
  bottom.renderOrder = RENDER_ORDER.GLASS;
  g.add(bottom);
  const sandH = h * 0.07;
  const sand = slab(inner, sandH, MATERIALS.sand, t);
  sand.name = 'sand';
  sand.userData.sandBase = { y0: t, h: sandH, centered: false };
  g.userData.bottom = { kind: 'shape', shape: inner };
  g.add(sand);
  const waterH = h * 0.9 - t;
  g.add(markWater(slab(inner, waterH, MATERIALS.water, t), t, waterH, false));
  const surf = new THREE.ShapeGeometry(inner);
  surf.rotateX(-Math.PI / 2);
  const s = waterSurfaceMesh(surf);
  s.position.y = t + waterH + 0.001;
  g.add(markSurface(s));
  g.userData.waterSpan = { hi: h - RIM_H, def: t + waterH }; // 水位の範囲（waterLevel.js）
  const xs = poly.map((p) => p[0]);
  const zs = poly.map((p) => p[1]);
  g.userData.interior = {
    shape: 'box',
    floorY: t + sandH,
    halfW: Math.max(...xs.map(Math.abs)) - t,
    halfD: Math.max(...zs.map(Math.abs)) - t,
    waterTop: t + waterH,
    poly: true,
  };
}

/** 多角形の面積（m²）と、辺が交差しないか */
export function polyArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, z0] = poly[i];
    const [x1, z1] = poly[(i + 1) % poly.length];
    a += x0 * z1 - x1 * z0;
  }
  return Math.abs(a) / 2;
}

const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
function segHit(p1, p2, p3, p4) {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

export function isSimplePoly(poly) {
  const n = poly.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      if (segHit(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) return false;
    }
  }
  return polyArea(poly) > 0.01;
}
