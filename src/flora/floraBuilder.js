import * as THREE from 'three';
import { SPECS } from './floraSpecs.js';
import { rng } from './floraKit.js';
import { floraMaterial } from './floraMaterial.js';

/**
 * 生き物オブジェの本体。1個体の形（種・成長の段ごとに1つだけ作って共有）を、InstancedMesh で繰り返して描く。
 * growth = { p: [x, y, z, n, ...], s }
 *   p … 個体の付く点（オブジェのローカル座標を mm の整数で）と、その面の法線 n（緯度16×経度32 の番号）
 *   s … 成長の度合い 0〜1（grow：群体の大きさ、海藻：高さ）
 */
export const LEVELS = 12;
const UP = new THREE.Vector3(0, 1, 0);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export const specOf = (def) => SPECS[def.id] ?? null;
export const levelOf = (s) => Math.round(clamp(s) * (LEVELS - 1));
/** 成長の度合い s のときの大きさ（m）。大きさを持たない種は null */
export function sizeAt(spec, s) {
  if (!spec.size) return null;
  const [a, b] = spec.size;
  return a + (b - a) * (levelOf(s) / (LEVELS - 1));
}

/** 高さで測る種（海藻・トサカ・ヤギなど）を置くとき、水深 maxH に収まる成長の度合いまで下げる */
export function fitToDepth(spec, maxH) {
  if (!spec.size || spec.dim !== '高さ') return spec.s0;
  let lv = levelOf(spec.s0);
  while (lv > 0 && sizeAt(spec, lv / (LEVELS - 1)) > maxH) lv--;
  return lv / (LEVELS - 1);
}

// ---- 点の符号化 -------------------------------------------------------------

export const encodeNormal = (n) => Math.round((Math.acos(clamp(n.y, -1, 1)) / Math.PI) * 15) * 32 + (Math.round(((Math.atan2(n.z, n.x) + Math.PI) / (Math.PI * 2)) * 32) % 32);
export function decodeNormal(code, out = new THREE.Vector3()) {
  const th = (Math.floor(code / 32) / 15) * Math.PI;
  const ph = ((code % 32) / 32) * Math.PI * 2 - Math.PI;
  return out.set(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
}
export const pointCount = (g) => Math.floor((g?.p?.length ?? 0) / 4);
/** 点 i の位置（m） */
export const pointAt = (p, i, out = new THREE.Vector3()) => out.set(p[i * 4] / 1000, p[i * 4 + 1] / 1000, p[i * 4 + 2] / 1000);
export const pushPoint = (p, pos, n) => p.push(Math.round(pos.x * 1000), Math.round(pos.y * 1000), Math.round(pos.z * 1000), encodeNormal(n));

/** 置いたときの個体の並び（ひまわりの種の並びで原点の周りに init 個） */
function initialPoints(spec) {
  const p = [0, 0, 0, 0];
  if (spec.kind !== 'cover') return p;
  for (let k = 1; k < spec.init; k++) {
    const a = k * 2.4;
    const d = spec.gap * 1.05 * Math.sqrt(k);
    p.push(Math.round(Math.cos(a) * d * 1000), 0, Math.round(Math.sin(a) * d * 1000), 0);
  }
  return p;
}

/**
 * 保存値を今の形式にそろえる。以前の形式（ext：伸ばした向き、density、nodes：パーツ）は、伸ばした線に沿った点に読み替える。
 * 戻り値 { growth, legacy }。legacy のときは置いた後で地形に沿わせ直す（floraSurface.js）
 */
export function normalizeFlora(def, g) {
  const spec = specOf(def);
  const s = Number.isFinite(g?.s) ? clamp(g.s) : spec.s0;
  if (Array.isArray(g?.p) && g.p.length >= 4) return { growth: { p: g.p.slice(0, Math.floor(g.p.length / 4) * 4).map((v) => Math.round(v) || 0), s }, legacy: false };
  const p = initialPoints(spec);
  const L = Math.hypot(g?.ext?.x ?? 0, g?.ext?.z ?? 0);
  if (spec.kind === 'cover' && L > spec.gap) {
    for (let d = spec.gap, k = 0; d <= L && p.length / 4 < spec.max; d += spec.gap, k++) {
      const side = (k % 3) - 1;
      p.push(Math.round(((g.ext.x * d) / L - (g.ext.z / L) * side * spec.gap * 0.9) * 1000), 0, Math.round(((g.ext.z * d) / L + (g.ext.x / L) * side * spec.gap * 0.9) * 1000), 0);
    }
  }
  return { growth: { p, s }, legacy: !!g && (g.ext !== undefined || g.nodes !== undefined) };
}

// ---- 形（共有） -------------------------------------------------------------

const GEO = new Map();
const hashStr = (str) => [...str].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

function unitGeo(def, spec, s, pal) {
  const lv = spec.size ? levelOf(s) : 0;
  const key = `${def.id}|${lv}|${pal}`;
  let g = GEO.get(key);
  if (!g) {
    g = spec.unit(sizeAt(spec, s), lv / (LEVELS - 1), rng(hashStr(def.id) + lv * 131 + pal * 977), pal).build();
    GEO.set(key, g);
  }
  return g;
}

/** 形の三角形の数（開発用の計測） */
export const unitTriangles = (def, s = specOf(def).s0, pal = 0) => unitGeo(def, specOf(def), s, pal).index.count / 3;

// ---- 組み立て ---------------------------------------------------------------

const _p = new THREE.Vector3();
const _n = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _c = new THREE.Color();
const _ax = new THREE.Vector3();
const hash3 = (x, y, z) => {
  let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return h ^ (h >>> 12);
};

export function buildFlora(body, def, { seed = 1, growth }) {
  const spec = specOf(def);
  const pal = Math.abs(seed) % (spec.pals ?? 1);
  const geo = unitGeo(def, spec, growth.s, pal);
  const n = pointCount(growth);
  const mesh = new THREE.InstancedMesh(geo, floraMaterial({ sway: geo.userData.sway, flat: !!spec.flat }), n);
  const p = growth.p;
  for (let i = 0; i < n; i++) {
    pointAt(p, i, _p);
    decodeNormal(p[i * 4 + 3], _n);
    const r = rng(hash3(p[i * 4], p[i * 4 + 1], p[i * 4 + 2]) + seed);
    // 生える向き：面の法線と真上の間（種ごと）。そこから少し傾け、軸まわりに好きな角度で回す
    _n.lerp(UP, spec.up).normalize();
    _q.setFromUnitVectors(UP, _n);
    _ax.set(r() - 0.5, 0, r() - 0.5).normalize();
    _q.multiply(_q2.setFromAxisAngle(_ax, r() * spec.tilt)).multiply(_q2.setFromAxisAngle(UP, r() * Math.PI * 2));
    _s.setScalar(1 + (r() - 0.5) * 2 * spec.sv);
    mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    // 個体ごとにわずかな色むら
    mesh.setColorAt(i, _c.setScalar(0.88 + r() * 0.2));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  body.add(mesh);
}
