import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { capsule, lattice } from './growth.js';

/**
 * 群体（サンゴ・イソギンチャク・海藻・水草・玉石）を作る共通部品。
 * 個体の置き場所は growth.js の lattice（範囲は growth.ext へ伸びるカプセル、数は growth.density 倍）。
 * 部品は頂点カラーで塗って最後に1つのメッシュにまとめる（たくさん置いても描画が重くならない）。
 */
const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

/** 色の明るさをばらつかせた [r, g, b] */
export function tone(hex, rand, k = 0.1) {
  const c = new THREE.Color(hex);
  const f = 1 + (rand() - 0.5) * k * 2;
  return [Math.min(1, c.r * f), Math.min(1, c.g * f), Math.min(1, c.b * f)];
}

/** 位置・向き（+Y を dir へ）・拡大の行列。dir の代わりに Euler [rx, ry, rz, 順序] も渡せる */
export function place(pos, dir = UP, scale = 1) {
  const p = Array.isArray(pos) ? new THREE.Vector3(...pos) : pos;
  if (Array.isArray(dir)) _q.setFromEuler(_e.set(dir[0], dir[1], dir[2], dir[3] ?? 'XYZ'));
  else _q.setFromUnitVectors(UP, dir.clone().normalize());
  const s = typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : scale;
  return new THREE.Matrix4().compose(p, _q, s);
}

/** 底が原点の円柱（r0 根元・r1 先端） */
/** 寝かせた円盤（XY 平面の円盤を水平にしてから）を、tilt だけ傾け、ry だけ回す */
export const flat = (rx, ry, rz = 0) => [rx - Math.PI / 2, ry, rz, 'YXZ'];

export const stem = (r0, r1, h, seg = 5) => new THREE.CylinderGeometry(r1, r0, h, seg, 1).translate(0, h / 2, 0);

export class Parts {
  list = [];

  /** geo（使い回してよい）に色を塗り、行列 m で置く。color は [r,g,b]・THREE.Color・(頂点番号, position) → [r,g,b] */
  add(geo, color, m) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of ['uv', 'normal']) if (g.attributes[k]) g.deleteAttribute(k);
    if (m) g.applyMatrix4(m);
    const pos = g.attributes.position;
    const c = new Float32Array(pos.count * 3);
    const fixed = color?.isColor ? [color.r, color.g, color.b] : typeof color === 'function' ? null : color;
    for (let i = 0; i < pos.count; i++) c.set(fixed ?? color(i, pos), i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    this.list.push(g);
  }

  /** 1つのメッシュにして g に加える。flat：面ごとに陰影（サンゴ・岩）／なめらか（海藻・イソギンチャク） */
  into(g, { flat = true, roughness = 0.75, double = false } = {}) {
    if (!this.list.length) return;
    const geo = mergeGeometries(this.list, false);
    this.list.forEach((x) => x.dispose());
    this.list = [];
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: flat, roughness, side: double ? THREE.DoubleSide : THREE.FrontSide }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
}

/**
 * 群体の個体の一覧。R はドラッグする前の群体の半径（m）、base は標準の密度（個体/m²）。
 * max は個体数の上限（1個体の部品が多い種は小さくする）。返す各個体：{ x, z, y（下の地形の高さ）, rand, t（群体の軸からの距離 0 中心〜1 縁） }
 */
export const MAX_INDIVIDUALS = 600; // 広げて密度を上げても重くなりすぎないよう、これを超えたら間引く

export function colony({ seed, growth, surface }, R, base, margin = 0, max = MAX_INDIVIDUALS) {
  const region = capsule(R, growth?.ext ?? { x: 0, z: 0 });
  let list = lattice(seed, base, region, margin, growth);
  if (list.length > max) {
    const step = list.length / max;
    list = Array.from({ length: max }, (_, i) => list[Math.floor(i * step)]);
  }
  return list.map(({ p, rand }) => {
    const [ax, az] = region.nearest(p.x, p.y);
    return { x: p.x, z: p.y, y: surface(p.x, p.y), rand, t: Math.min(1, Math.hypot(p.x - ax, p.y - az) / R) };
  });
}
