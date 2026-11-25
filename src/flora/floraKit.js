import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * 水槽内の生き物オブジェ（サンゴ・ソフトコーラル・イソギンチャク・海藻・水草）の「1個体の形」を作る部品。
 * 1個体は付け根が原点・+Y が生える向き・単位は m。頂点カラーで塗り、頂点ごとに揺れの大きさ（aSway, m）を持つ。
 * 同じ形を InstancedMesh で向き・大きさを変えて繰り返すので、ここで作る形は小さく（数十〜数百三角形）保つ。
 */
const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _c = new THREE.Color();
const _v = new THREE.Vector3();

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const rgb = (hex, k = 1) => {
  _c.set(hex);
  return [Math.min(1, _c.r * k), Math.min(1, _c.g * k), Math.min(1, _c.b * k)];
};
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** 再現できる乱数（0〜1） */
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 位置・向き・拡大の行列。dir は +Y を向ける方向（Vector3）か Euler [rx, ry, rz, 順序] */
export function at(pos, dir = UP, scale = 1) {
  const p = Array.isArray(pos) ? V(...pos) : pos;
  if (Array.isArray(dir)) _q.setFromEuler(_e.set(dir[0], dir[1], dir[2], dir[3] ?? 'YXZ'));
  else _q.setFromUnitVectors(UP, _v.copy(dir).normalize());
  const s = typeof scale === 'number' ? V(scale, scale, scale) : Array.isArray(scale) ? V(...scale) : scale;
  return new THREE.Matrix4().compose(p, _q, s);
}

/** 部品を集めて1個体の BufferGeometry にする */
export class Unit {
  pos = [];
  col = [];
  sway = [];

  /**
   * geo を行列 m で置く。color：[r,g,b] か (i, position, 置いた後の座標 Vector3) → [r,g,b]。
   * sway：この部品の揺れ（m）。数値なら全頂点同じ、関数なら (置いた後の座標) → m
   */
  add(geo, color, m, sway = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position;
    const fn = typeof color === 'function' ? color : null;
    const sf = typeof sway === 'function' ? sway : null;
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i);
      if (m) _v.applyMatrix4(m);
      this.pos.push(_v.x, _v.y, _v.z);
      const c = fn ? fn(i, p, _v) : color;
      this.col.push(c[0], c[1], c[2]);
      this.sway.push(sf ? sf(_v) : sway);
    }
    if (g !== geo) g.dispose();
    return this;
  }

  /** 三角形ごとに1色で塗る（少ない頂点でも模様の境目がくっきり出る）。fn(置いた後の三角形の中心) → [r,g,b] */
  addFaces(geo, fn, m, sway = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position;
    const tri = [V(), V(), V()];
    const mid = V();
    for (let i = 0; i < p.count; i += 3) {
      for (let k = 0; k < 3; k++) {
        tri[k].fromBufferAttribute(p, i + k);
        if (m) tri[k].applyMatrix4(m);
      }
      const c = fn(mid.copy(tri[0]).add(tri[1]).add(tri[2]).multiplyScalar(1 / 3));
      for (const v of tri) {
        this.pos.push(v.x, v.y, v.z);
        this.col.push(c[0], c[1], c[2]);
        this.sway.push(typeof sway === 'function' ? sway(v) : sway);
      }
    }
    if (g !== geo) g.dispose();
    return this;
  }

  /** 同じ位置・色の頂点をまとめて軽くする。sway が全部 0 なら aSway は付けない */
  build() {
    let g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    const moving = this.sway.some((s) => s !== 0);
    if (moving) g.setAttribute('aSway', new THREE.Float32BufferAttribute(this.sway, 1));
    g = mergeVertices(g, 1e-5);
    g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();
    g.userData.shared = true; // 種類ごとに共有するので、オブジェを消しても捨てない
    g.userData.sway = moving;
    return g;
  }
}

// ---- 形の部品（どれも原点が付け根、+Y へ伸びる） -----------------------------

/** 先細りの筒（r0 根元・r1 先端・側面 seg 角形、ふた無し） */
export const stick = (r0, r1, h, seg = 4) => new THREE.CylinderGeometry(r1, r0, h, seg, 1, true).translate(0, h / 2, 0);

/** 点列をたどる筒。radius は数値か (t 0〜1) → 半径 */
export function tube(pts, radius, seg = 4) {
  const n = pts.length;
  const rad = typeof radius === 'function' ? radius : () => radius;
  const pos = [];
  const side = V();
  const up = V();
  const tan = V();
  const ring = [];
  for (let i = 0; i < n; i++) {
    tan.copy(pts[Math.min(n - 1, i + 1)]).sub(pts[Math.max(0, i - 1)]).normalize();
    side.set(1, 0, 0);
    if (Math.abs(tan.x) > 0.9) side.set(0, 0, 1);
    side.cross(tan).normalize();
    up.crossVectors(tan, side);
    const r = rad(i / (n - 1));
    ring.push(Array.from({ length: seg }, (_, k) => {
      const a = (k / seg) * Math.PI * 2;
      return pts[i].clone().addScaledVector(side, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r);
    }));
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < seg; k++) {
    const a = ring[i][k], b = ring[i][(k + 1) % seg], c = ring[i + 1][k], d = ring[i + 1][(k + 1) % seg];
    for (const v of [a, b, c, b, d, c]) pos.push(v.x, v.y, v.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/**
 * 細長い葉（XY 平面、根元が原点）。taper：'tip' 先細り / 'oval' 楕円 / 'none' 帯。bend：先が +Z へしなる。
 * ruffle：縁の波打ち（m）。cross：幅方向の分割（2 にすると中央に折り目ができる）
 */
export function blade(len, width, { bend = 0, taper = 'tip', segs = 4, ruffle = 0, cross = 1, fold = 0 } = {}) {
  const g = new THREE.PlaneGeometry(width, len, cross, segs).translate(0, len / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / len;
    const k = taper === 'tip' ? 1 - t * 0.9 : taper === 'oval' ? Math.sin(Math.PI * Math.min(0.97, Math.max(0.06, t))) : 1;
    const x = p.getX(i) * k;
    const edge = Math.abs(p.getX(i)) / (width / 2);
    p.setXYZ(i, x, p.getY(i), bend * t * t * len + Math.sin(t * 11 + (x > 0 ? 1.7 : 0)) * ruffle * edge + edge * fold * width);
  }
  return g;
}

/**
 * 円盤（XZ 平面・法線 +Y）。rings 段・seg 角形。fn(t 中心0〜縁1, 角度) → 高さ。inner > 0 で穴あき。
 * arc で扇形にする。center：扇の中心を +X に向ける（Euler [0, -向き, 起こす角] で外側の縁を持ち上げられる）
 */
export function disc(r, seg, rings, fn = () => 0, { inner = 0, arc = Math.PI * 2, oval = 1, center = false } = {}) {
  const g = new THREE.RingGeometry(Math.max(1e-4, inner * r), r, seg, rings, center ? -arc / 2 : 0, arc).rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    p.setXYZ(i, x, fn(Math.hypot(x, z) / r, Math.atan2(z, x)), z * oval);
  }
  return g;
}

/** 多面体の塊（detail 0：20面、1：80面） */
export const blob = (detail = 0) => new THREE.IcosahedronGeometry(1, detail);
/** 8面体（小さな粒・ポリプ） */
export const bead = () => new THREE.OctahedronGeometry(1, 0);

/** 高さに応じた揺れ：根元 0 → 高さ H で amp（しなやかなものほど pow を小さく） */
export const swayBy = (H, amp, pow = 2) => (p) => amp * Math.pow(Math.max(0, Math.min(1.2, p.y / H)), pow);
