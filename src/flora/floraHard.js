import * as THREE from 'three';
import { Unit, V, at, rgb, mix, stick, tube, disc, blob, bead } from './floraKit.js';

/**
 * 硬い骨格を持つサンゴ・シャコガイの1個体（1群体）の形。S は大きさ（m）、lv は成長の度合い（0 若い〜1 最大）、
 * r は乱数、pal は色の型。成長は種ごとの実際の育ち方に合わせる：
 *   ミドリイシ（テーブル状）… 柄から主枝が水平に放射し、その上に小枝が立ち並んで卓になる。育つと卓が広がる
 *   ウミエダミドリイシ（枝状）… 二又の分岐を繰り返して上と外へ伸びる。育つと分岐の段が増える
 *   コモンサンゴ … 固着点から薄い板が渦を巻きながら外へ重なる。育つと板の枚数と径が増える
 *   ハマサンゴ … 塊状。こぶ（葉片）を増やしながら半球に育つ
 *   ハナヤサイサンゴ … 太く短い枝が半球状に分かれる。枝先は平たくつぶれる
 *   スリバチサンゴ … すり鉢から、縁が巻いた板を何段も重ねる形へ
 *   ノウサンゴ … 迷路状の溝を持つ半球
 *   面に広げる種（キクメイシ・ウスカミサンゴ・イボヤギ・クサビライシ・ナガレハナサンゴ）は floraEncrust.js
 */
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/** 高さ y0→y1 で色 c0→c1 */
const grad = (c0, c1, y0, y1) => (i, p, v) => mix(c0, c1, clamp((v.y - y0) / (y1 - y0)));

export function acropora(S, lv, r, pal) {
  const u = new Unit();
  const R = S / 2;
  const base = rgb([0x9a9a6a, 0x6f95a8, 0xb09070][pal]);
  const tip = rgb([0x9a7ae0, 0xb8e0f4, 0xf2d0a8][pal]);
  const H = 0.015 + R * 0.22;
  u.add(stick(R * 0.16 + 0.006, R * 0.11 + 0.005, H, 5), base);
  const twig = stick(0.0042, 0.0026, 1, 4);
  const nMain = Math.round(8 + 12 * lv);
  for (let i = 0; i < nMain; i++) {
    const a = (i / nMain) * TAU + r() * 0.4;
    const len = R * (0.7 + r() * 0.3);
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const P = (t) => V(dx * len * t, H + R * 0.07 * t * t, dz * len * t);
    u.add(tube([P(0), P(0.5), P(1)], (t) => (0.007 + R * 0.02) * (1 - t * 0.6), 4), base);
    // 主枝の上に立つ小枝（卓の面）。外側ほど外へ傾く
    const nT = clamp(Math.round(len / 0.022), 3, 8);
    for (let k = 1; k <= nT; k++) {
      const t = k / nT;
      const p = P(t);
      const h = (0.016 + r() * 0.014) * (0.8 + lv * 0.5);
      const dir = V(dx * t * 0.5 + (r() - 0.5) * 0.3, 1, dz * t * 0.5 + (r() - 0.5) * 0.3);
      u.add(twig, grad(base, tip, p.y, p.y + h), at(p, dir, [1, h, 1]));
      if (r() < 0.6) u.add(twig, grad(base, tip, p.y, p.y + h * 0.8), at(p.clone().add(V((r() - 0.5) * 0.012, 0, (r() - 0.5) * 0.012)), V(dir.x + (r() - 0.5) * 0.8, 1, dir.z + (r() - 0.5) * 0.8), [0.8, h * 0.8, 0.8]));
    }
  }
  return u;
}

export function umieda(S, lv, r, pal) {
  const u = new Unit();
  const base = rgb([0xb8a070, 0x8aa8b0, 0xa8b878][pal]);
  const tip = rgb([0xf0e6c0, 0xc8e8f8, 0xe8f4b0][pal]);
  const depth = 2 + Math.round(lv * 3);
  const len0 = S / (1.9 - Math.pow(0.78, depth)); // 段を重ねた高さがおよそ S になる長さ
  const seg = stick(1, 0.8, 1, 4);
  const grow = (p, dir, len, rad, d) => {
    const end = p.clone().addScaledVector(dir, len);
    u.add(seg, d === depth ? grad(base, tip, p.y, end.y + 1e-4) : base, at(p, dir, [rad, len, rad]));
    if (d === depth) return;
    const n = r() < 0.25 ? 3 : 2;
    const side = V(-dir.z, 0, dir.x).normalize().applyAxisAngle(dir, r() * TAU);
    for (let k = 0; k < n; k++) {
      const nd = dir.clone().addScaledVector(side.clone().applyAxisAngle(dir, (k / n) * TAU), 0.55 + r() * 0.2).add(V(0, 0.25, 0)).normalize();
      grow(end, nd, len * (0.7 + r() * 0.16), rad * 0.8, d + 1);
    }
  };
  grow(V(), V((r() - 0.5) * 0.2, 1, (r() - 0.5) * 0.2).normalize(), len0 * 0.45, 0.004 + S * 0.022, 0);
  return u;
}

export function montipora(S, lv, r, pal) {
  const u = new Unit();
  const R = S / 2;
  const lo = rgb([0x6a3c66, 0x4a6638, 0x8a5230][pal]);
  const hi = rgb([0xc890d8, 0xa8dc78, 0xf0b470][pal]);
  const n = 3 + Math.round(12 * lv);
  u.add(stick(R * 0.12 + 0.004, R * 0.1 + 0.004, R * 0.2 + 0.006, 5), lo);
  for (let k = 0; k < n; k++) {
    const f = (k + 1) / n;
    const a = k * 2.4;
    const pr = R * (0.42 + 0.3 * f);
    // 固着点から渦を巻いて外へ。外の板ほど低く広く、縁は反り上がる
    const plate = disc(pr, 8, 2, (t, an) => t * t * pr * 0.3 + Math.sin(an * 3 + k) * pr * 0.04 * t, { arc: Math.PI * (1.1 + 0.4 * r()), inner: 0.06, center: true });
    const d = R * 0.32 * Math.sqrt(f);
    const y = R * 0.2 + R * 0.45 * (1 - f) + 0.004;
    const px = Math.cos(a) * d;
    const pz = Math.sin(a) * d;
    u.add(plate, (i, p, v) => mix(lo, hi, clamp(Math.hypot(v.x - px, v.z - pz) / pr) ** 2), at([px, y, pz], [0, -a, 0.12 + 0.3 * (1 - f)]));
    plate.dispose();
  }
  return u;
}

export function porites(S, lv, r, pal) {
  const u = new Unit();
  const R = S / 2;
  const g = blob(3);
  const c0 = rgb([0xc8ae6e, 0x9aa880, 0xb89a9a][pal]);
  const c1 = rgb([0xe8d8a0, 0xc8d4a8, 0xe0c8c0][pal]);
  // こぶ（葉片）は育つほど増える
  const lobes = Array.from({ length: 4 + Math.round(10 * lv) }, () => V(r() - 0.5, r() * 0.9 + 0.1, r() - 0.5).normalize());
  const p = g.attributes.position;
  const n = V();
  const bump = [];
  for (let i = 0; i < p.count; i++) {
    n.fromBufferAttribute(p, i).normalize();
    let f = 0;
    for (const l of lobes) f = Math.max(f, (n.dot(l) - 0.72) / 0.28);
    f = Math.max(0, f);
    bump.push(f);
    const k = 0.8 + 0.28 * Math.sqrt(f);
    p.setXYZ(i, n.x * R * k, Math.max(0, n.y) * R * 0.75 * k + Math.min(0, n.y) * R * 0.08, n.z * R * k);
  }
  u.add(g, (i) => mix(c0, c1, bump[i] * (i % 3 === 0 ? 0.6 : 1)), at([0, R * 0.04, 0]));
  g.dispose();
  return u;
}

export function pocillopora(S, lv, r, pal) {
  const u = new Unit();
  const R = S / 2;
  const c0 = rgb([0x9a6a70, 0x8a7458, 0x7a8a60][pal]);
  const c1 = rgb([0xf0b4c4, 0xe8c8a0, 0xcfe0a0][pal]);
  const n = 5 + Math.round(14 * lv);
  const stub = stick(1, 0.85, 1, 5);
  const knob = bead();
  for (let i = 0; i < n; i++) {
    // 上半球に均等に向ける
    const y = 1 - (i + 0.5) / n * 0.85;
    const a = i * 2.4;
    const dir = V(Math.cos(a) * Math.sqrt(1 - y * y), y, Math.sin(a) * Math.sqrt(1 - y * y));
    const len = R * (0.5 + r() * 0.15);
    const rad = R * 0.1 + 0.003;
    u.add(stub, c0, at(V(), dir, [rad, len, rad]));
    const end = dir.clone().multiplyScalar(len);
    for (let k = 0; k < 3; k++) {
      const d2 = dir.clone().add(V(r() - 0.5, r() - 0.3, r() - 0.5).multiplyScalar(0.9)).normalize();
      d2.y = Math.max(d2.y, 0.1); // 下へは伸びない
      const l2 = R * (0.3 + r() * 0.15);
      u.add(stub, grad(c0, c1, end.y, end.y + l2 * Math.max(0.2, d2.y)), at(end, d2, [rad * 0.85, l2, rad * 0.85]));
      // 枝先は平たくつぶれる
      u.add(knob, c1, at(end.clone().addScaledVector(d2, l2), d2, [rad * 1.25, rad * 0.5, rad * 0.8]));
    }
  }
  return u;
}

export function turbinaria(S, lv, r, pal) {
  const u = new Unit();
  const R = S / 2;
  const c0 = rgb([0x8a8a30, 0x6a7a4a, 0x9a7a3a][pal]);
  const c1 = rgb([0xd8d860, 0xb0c878, 0xe0c070][pal]);
  const tiers = 1 + Math.round(3 * lv);
  u.add(stick(R * 0.16 + 0.005, R * 0.22 + 0.006, R * 0.25, 6), c0);
  for (let k = 0; k < tiers; k++) {
    const f = k / Math.max(1, tiers - 1);
    const pr = R * (1 - 0.3 * f);
    const yaw = k * 2.1 + r();
    // すり鉢：縁へ向かって立ち上がり、ゆるく波打つ。上の段ほど小さく、切れ目のある巻いた板になる
    const cup = disc(pr, 12, 3, (t, a) => Math.pow(t, 1.4) * pr * 0.55 + Math.sin(a * 3 + k) * pr * 0.05 * t, { inner: 0.12, arc: k === 0 ? TAU : Math.PI * (1.3 + 0.4 * r()) });
    u.add(cup, (i, p, v) => mix(c0, c1, clamp(Math.hypot(v.x, v.z) / pr) ** 1.5), at([(r() - 0.5) * R * 0.2 * f, R * 0.22 + k * R * 0.16, (r() - 0.5) * R * 0.2 * f], [0.12 * f, yaw, 0]));
    cup.dispose();
  }
  return u;
}

export function brain(S, lv, r, pal) {
  const u = new Unit();
  const R = S / 2;
  const ridge = rgb([0xa8b870, 0xc8a878, 0x88b0a0][pal]);
  const groove = rgb([0x4a6a38, 0x7a5a38, 0x3a6a68][pal]);
  const g = new THREE.SphereGeometry(1, 28, 11, 0, TAU, 0, Math.PI / 2);
  const ph = r() * 6;
  const k = 11; // 溝の細かさ（群体の大きさに比例させ、少ない頂点でも迷路模様が見えるようにする）
  const wave = (x, z) => Math.sin(x * k + Math.sin(z * k * 0.6 + ph) * 2.2) * Math.cos(z * k * 0.8 + Math.sin(x * k * 0.5) * 1.8);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const f = 1 + (wave(x, z) > 0 ? 0.04 : -0.025); // うねは盛り上がり、溝はくぼむ
    p.setXYZ(i, x * R * f, p.getY(i) * R * 0.72 * f, z * R * f);
  }
  u.addFaces(g, (c) => (wave(c.x / R, c.z / R) > 0 ? ridge : groove));
  g.dispose();
  return u;
}

export function shakogai(S, lv, r, pal) {
  const u = new Unit();
  const L = S;
  const shell = rgb(0xe8e2d0);
  const shellD = rgb(0xb8ae98);
  const m0 = rgb([0x2a5ac8, 0x2a8a5a, 0x7a4a2a][pal]);
  const m1 = rgb([0x58d0e8, 0xc8e060, 0xe8c070][pal]);
  // 2枚の殻：ちょうつがい（下）から波打つ縁（上）へ。縁には5本の大きなひだ
  for (const s of [-1, 1]) {
    const g = new THREE.PlaneGeometry(1, 1, 10, 3);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const uu = p.getX(i) + 0.5;
      const vv = p.getY(i) + 0.5;
      const prof = Math.sin(Math.PI * clamp(uu, 0.02, 0.98)) ** 0.6;
      const fold = Math.abs(Math.sin(uu * Math.PI * 5)) * vv;
      p.setXYZ(i, (uu - 0.5) * L, (Math.sin(vv * Math.PI * 0.5) * 0.36 + fold * 0.07) * L * prof, s * (0.04 + 0.2 * vv * vv + fold * 0.03) * L * prof);
    }
    u.add(g, (i) => (Math.floor(i / 11) % 2 ? shell : shellD));
    g.dispose();
  }
  // 殻の間からのぞく外套膜（鮮やかな色と斑）
  const mantle = new THREE.PlaneGeometry(1, 1, 10, 2);
  const q = mantle.attributes.position;
  for (let i = 0; i < q.count; i++) {
    const uu = q.getX(i) + 0.5;
    const vv = q.getY(i);
    const prof = Math.sin(Math.PI * clamp(uu, 0.03, 0.97)) ** 0.6;
    q.setXYZ(i, (uu - 0.5) * L * 0.92, (0.33 + Math.abs(Math.sin(uu * Math.PI * 5)) * 0.06 - Math.abs(vv) * 0.05) * L * prof, vv * 0.44 * L * prof);
  }
  u.add(mantle, (i) => (i % 3 === 0 ? m1 : m0), null, 0.004 * L);
  mantle.dispose();
  return u;
}
