import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { capsule, lattice, capsuleShape, drape } from './growth.js';

/**
 * サンゴ（ローポリ・頂点カラー・1メッシュに結合）。
 * growth.ext の方向へ群体の範囲（カプセル）が伸び、そこに個体（枝・ポリプ・頭）が増える。
 * 個体1つの大きさ・細かさは変わらない → ドラッグした方向へ大型コロニーになる。
 */

const C = (hex) => new THREE.Color(hex);
const UP = new THREE.Vector3(0, 1, 0);

/** 部品を頂点カラー付きで集めて最後に1つのメッシュにする */
class Parts {
  constructor() {
    this.list = [];
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3(1, 1, 1);
  }

  /** geo を pos に置き、+Y を dir に向けて追加 */
  add(geo, color, pos, dir = UP) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (g.attributes.uv) g.deleteAttribute('uv');
    this._q.setFromUnitVectors(UP, dir.clone().normalize());
    g.applyMatrix4(this._m.compose(pos, this._q, this._s));
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) color.toArray(col, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.list.push(g);
  }

  mesh() {
    const geo = mergeGeometries(this.list, false);
    this.list.forEach((g) => g.dispose());
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.7 }));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
}

const cyl = (r0, r1, h, seg = 5) => {
  const g = new THREE.CylinderGeometry(r1, r0, h, seg, 1);
  g.translate(0, h / 2, 0);
  return g;
};

/** 群体の軸から外へ向かう水平方向（外側の個体ほど外へ傾ける用） */
function outward(region, p) {
  const [ax, az] = region.nearest(p.x, p.y);
  const v = new THREE.Vector2(p.x - ax, p.y - az);
  return { dir: v.lengthSq() > 0 ? v.normalize() : v, t: Math.min(1, Math.hypot(p.x - ax, p.y - az) / region.R) };
}

// ---------------------------------------------------------------------------

/** ミドリイシ：外側ほど寝る枝状群体。枝先は紫 */
function acropora(g, def, { seed, growth, surface }) {
  const region = capsule(0.07, growth.ext);
  const p = new Parts();
  const base = C(0x9a9a6a);
  const crust = C(0x7f7f58);
  const tip = C(0x8f6fd8);
  const tipGeo = new THREE.IcosahedronGeometry(0.0055, 0);
  const pad = new THREE.SphereGeometry(0.016, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  pad.scale(1, 0.5, 1);
  for (const { p: pt, rand } of lattice(seed, 2400, region, 0, growth)) {
    const { dir: od, t } = outward(region, pt);
    const dir = new THREE.Vector3(od.x * t, 1.4 - t, od.y * t).normalize();
    const len = 0.035 + rand() * 0.035;
    const sy = surface(pt.x, pt.y); // 下にある岩などの表面に沿わせる
    const start = new THREE.Vector3(pt.x, sy + 0.004, pt.y);
    p.add(pad, crust, new THREE.Vector3(pt.x, sy, pt.y));
    const b = cyl(0.006, 0.004, len);
    p.add(b, base, start, dir);
    b.dispose();
    p.add(tipGeo, tip, start.clone().addScaledVector(dir, len));
    if (rand() > 0.4) {
      const sd = dir.clone().add(new THREE.Vector3(rand() - 0.5, 0.2, rand() - 0.5)).normalize();
      const sp = start.clone().addScaledVector(dir, len * 0.55);
      const sb = cyl(0.004, 0.003, len * 0.45);
      p.add(sb, base, sp, sd);
      sb.dispose();
      p.add(tipGeo, tip, sp.clone().addScaledVector(sd, len * 0.45));
    }
  }
  g.add(p.mesh());
}

/** トサカ：半透明ピンクの幹から枝分かれし、枝先にポリプの房（赤・橙） */
function tosaka(g, def, { seed, growth, surface }) {
  const region = capsule(0.045, growth.ext);
  const p = new Parts();
  const stalk = C(0xf2b8c2);
  const polypCols = [C(0xe8463c), C(0xf07a2a), C(0xd8344a)];
  const polyp = new THREE.IcosahedronGeometry(0.006, 0);
  for (const { p: pt, rand } of lattice(seed, 700, region, 0, growth)) {
    const h = 0.05 + rand() * 0.05;
    const s = cyl(0.009, 0.006, h, 6);
    const base = new THREE.Vector3(pt.x, surface(pt.x, pt.y), pt.y);
    p.add(s, stalk, base);
    s.dispose();
    const pc = polypCols[Math.floor(rand() * polypCols.length)];
    for (let k = 0; k < 4; k++) {
      const dir = new THREE.Vector3(rand() - 0.5, 0.8, rand() - 0.5).normalize();
      const from = base.clone().add(new THREE.Vector3(0, h * (0.5 + rand() * 0.4), 0));
      const bl = 0.02 + rand() * 0.02;
      const b = cyl(0.004, 0.003, bl, 5);
      p.add(b, stalk, from, dir);
      b.dispose();
      const tipPos = from.clone().addScaledVector(dir, bl);
      for (let q = 0; q < 5; q++) {
        p.add(polyp, pc, tipPos.clone().add(new THREE.Vector3((rand() - 0.5) * 0.014, (rand() - 0.2) * 0.01, (rand() - 0.5) * 0.014)));
      }
    }
  }
  g.add(p.mesh());
}

/**
 * ノウサンゴ：迷路状の溝のドーム。カプセル形の範囲に高さ場として作るので、
 * ext 方向へ伸ばすとドームが細長く伸びる。溝の幅（空間周波数）と格子の細かさは一定。
 */
function brain(g, def, { seed, growth, surface }) {
  const R = 0.06;
  const region = capsule(R, growth.ext);
  const step = 0.0045;
  const { x0, x1, z0, z1 } = region.bounds;
  const nx = Math.ceil((x1 - x0) / step);
  const nz = Math.ceil((z1 - z0) / step);
  const ph = (seed % 1000) / 100;
  const k = 220; // 溝の空間周波数（rad/m）
  const ridge = C(0x9fae6a);
  const groove = C(0x4f6a3a);

  // 格子点の高さ（範囲外は null）
  const H = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = x0 + i * step;
    const z = z0 + j * step;
    const [ax, az] = region.nearest(x, z);
    const d = Math.hypot(x - ax, z - az);
    if (d > R) { H.push(null); continue; }
    const wave = Math.sin(x * k + Math.sin(z * k * 0.6 + ph) * 2.2) * Math.cos(z * k * 0.8 + Math.sin(x * k * 0.5) * 1.8);
    const dome = Math.sqrt(Math.max(0, R * R - d * d)) * 0.65;
    H.push({ x, z, y: surface(x, z) + dome * (wave > 0 ? 1 : 0.93), wave });
  }
  const pos = [];
  const col = [];
  const tri = (a, b, c) => {
    for (const v of [a, b, c]) pos.push(v.x, v.y, v.z);
    const cc = (a.wave + b.wave + c.wave) > 0 ? ridge : groove;
    for (let q = 0; q < 3; q++) col.push(cc.r, cc.g, cc.b);
  };
  const at = (i, j) => H[j * (nx + 1) + i];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    if (a && c && b) tri(a, c, b);
    if (b && c && d) tri(b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.75, side: THREE.DoubleSide }));
  m.castShadow = m.receiveShadow = true;
  g.add(m);
}

/** ナガレハナサンゴ：骨格の上にふさふさの触手の頭。触手の先は淡い黄色 */
function euphyllia(g, def, { seed, growth, surface }) {
  const region = capsule(0.045, growth.ext);
  const p = new Parts();
  const skel = C(0xd8d2c0);
  const tent = C(0x5fb07a);
  const tipC = C(0xf2e6a0);
  const tipGeo = new THREE.IcosahedronGeometry(0.0045, 0);
  for (const { p: pt, rand } of lattice(seed, 500, region, 0, growth)) {
    const base = new THREE.Vector3(pt.x, surface(pt.x, pt.y), pt.y);
    const sh = 0.025 + rand() * 0.015;
    const s = cyl(0.008, 0.01, sh, 6);
    p.add(s, skel, base);
    s.dispose();
    const head = base.clone().add(new THREE.Vector3(0, sh, 0));
    for (let t = 0; t < 14; t++) {
      const a = (t / 14) * Math.PI * 2 + rand();
      const dir = new THREE.Vector3(Math.cos(a) * 0.6, 1, Math.sin(a) * 0.6).normalize();
      const len = 0.025 + rand() * 0.015;
      const tg = cyl(0.0035, 0.003, len, 5);
      p.add(tg, tent, head, dir);
      tg.dispose();
      p.add(tipGeo, tipC, head.clone().addScaledVector(dir, len));
    }
  }
  g.add(p.mesh());
}

/** スターポリプ：紫のマットに緑のポリプ。マットが伸びた方向へ広がる */
function gsp(g, def, { seed, growth, surface }) {
  const R = 0.07;
  const region = capsule(R, growth.ext);
  const p = new Parts();
  const matC = C(0x6a3f8a);
  const polypC = [C(0x7af07a), C(0x5ad86a)];
  const mat = capsuleShape(region, R, seed % 7);
  drape(mat, surface, 0.003);
  p.add(mat, matC, new THREE.Vector3());
  mat.dispose();
  const polyp = new THREE.ConeGeometry(0.003, 0.01, 5);
  polyp.translate(0, 0.005, 0);
  const star = new THREE.IcosahedronGeometry(0.003, 0);
  for (const { p: pt, rand } of lattice(seed, 9000, region, 0.006, growth)) {
    const base = new THREE.Vector3(pt.x, surface(pt.x, pt.y) + 0.003, pt.y);
    p.add(polyp, matC, base);
    p.add(star, polypC[Math.floor(rand() * 2)], base.clone().add(new THREE.Vector3(0, 0.01, 0)));
  }
  g.add(p.mesh());
}

/** ウミアザミ：白い柄の先に花びら状の触手の冠 */
function xenia(g, def, { seed, growth, surface }) {
  const region = capsule(0.04, growth.ext);
  const p = new Parts();
  const stem = C(0xeae6e0);
  const petal = C(0xf4c4d6);
  const petalGeo = new THREE.ConeGeometry(0.003, 0.016, 4);
  petalGeo.translate(0, 0.008, 0);
  for (const { p: pt, rand } of lattice(seed, 1500, region, 0, growth)) {
    const h = 0.03 + rand() * 0.025;
    const s = cyl(0.005, 0.004, h, 6);
    const base = new THREE.Vector3(pt.x, surface(pt.x, pt.y), pt.y);
    p.add(s, stem, base);
    s.dispose();
    const top = base.clone().add(new THREE.Vector3(0, h, 0));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      p.add(petalGeo, petal, top, new THREE.Vector3(Math.cos(a), 0.9, Math.sin(a)));
    }
  }
  g.add(p.mesh());
}

export const CORAL_BUILDERS = { acropora, tosaka, brain, euphyllia, gsp, xenia };
