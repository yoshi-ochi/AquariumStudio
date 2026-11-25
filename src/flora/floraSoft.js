import * as THREE from 'three';
import { Unit, V, at, rgb, mix, stick, tube, disc, blob, bead, swayBy } from './floraKit.js';

/**
 * ソフトコーラル・イソギンチャクの1個体の形。骨格が無く水流でなびくので、どれも揺れ（aSway）を持つ。
 *   トサカ（Dendronephthya）… 半透明の幹から枝が分かれ、枝先にポリプの房。野生では高さ1m超（最大1.8m）
 *   ヤギ（ウミウチワ状）… 1平面の中で枝分かれを繰り返す扇。流れに直角に広がる
 *   ムチヤギ（Junceella）… 枝分かれしない鞭状の群体が根元から束になって立つ
 *   ウミキノコ（Sarcophyton）… 太い柄と縁の波打つ傘。傘の上面にポリプ。径は60cm〜1mに達する
 *   センジュイソギンチャク … 口盤は普通30〜50cm・最大1m。鮮やかな体壁と指状の触手
 *   ハタゴイソギンチャク … 口盤は50cmを超えることはまれ。縁が深く波打ち、短い触手が絨毯状に覆う
 *   スターポリプ・ウミアザミ・イソギンチャクモドキ・スナギンチャク・タマイタダキ（クローン）… 面に広がる（被覆・群生）
 */
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export function tosaka(S, lv, r, pal) {
  const u = new Unit();
  const trunk = rgb(0xf4d6dc);
  const poly = [rgb([0xe8463c, 0xf08a2a, 0xd84a9a][pal]), rgb([0xf07a2a, 0xf8c040, 0xf090c8][pal])];
  const sw = swayBy(S, S * 0.07, 1.6);
  const H = S * 0.5;
  u.add(tube([V(), V(S * 0.02, H * 0.5, 0), V(0, H, S * 0.02)], (t) => S * (0.075 - 0.03 * t) + 0.003, 6), trunk, null, sw);
  const n = 4 + Math.round(6 * lv);
  const tuft = blob(0);
  for (let i = 0; i < n; i++) {
    const a = i * 2.4 + r();
    const y0 = H * (0.45 + 0.55 * (i / n));
    const out = V(Math.cos(a), 0.9 + r() * 0.6, Math.sin(a)).normalize();
    const len = S * (0.2 + r() * 0.12);
    const p0 = V(0, y0, 0);
    const p1 = p0.clone().addScaledVector(out, len);
    u.add(tube([p0, p1], (t) => S * (0.035 - 0.012 * t) + 0.002, 5), trunk, null, sw);
    // 枝先のポリプの房（とげとげした塊）
    for (let k = 0; k < 3; k++) {
      const c = p1.clone().add(V(r() - 0.5, r() * 0.6, r() - 0.5).multiplyScalar(S * 0.11));
      u.add(tuft, poly[k % 2], at(c, V(r() - 0.5, 1, r() - 0.5), S * (0.05 + r() * 0.02)), sw);
    }
  }
  return u;
}

export function akayagi(S, lv, r, pal) {
  const u = new Unit();
  const c = rgb([0xc83228, 0xe87a28, 0xe8c838][pal]);
  const c2 = mix(c, [1, 1, 1], 0.3);
  const depth = 3 + Math.round(lv * 3);
  const sw = swayBy(S, S * 0.05, 2);
  const len0 = S / (1.7 - Math.pow(0.8, depth));
  const seg = stick(1, 0.75, 1, 3);
  // 1平面（XY）の中で二又に分かれ続ける。枝どうしは重ならないよう外へ開く
  const grow = (p, ang, len, rad, d) => {
    const dir = V(Math.sin(ang), Math.cos(ang), (r() - 0.5) * 0.12);
    u.add(seg, d >= depth - 1 ? c2 : c, at(p, dir, [rad, len, rad]), sw);
    if (d === depth) return;
    const end = p.clone().addScaledVector(dir.normalize(), len);
    const spread = 0.42 + r() * 0.15;
    grow(end, ang - spread * (0.6 + r() * 0.5), len * (0.72 + r() * 0.12), rad * 0.78, d + 1);
    grow(end, ang + spread * (0.6 + r() * 0.5), len * (0.72 + r() * 0.12), rad * 0.78, d + 1);
  };
  grow(V(), 0, len0 * 0.42, 0.0028 + S * 0.012, 0);
  return u;
}

export function junceella(S, lv, r, pal) {
  const u = new Unit();
  const c0 = rgb([0xd88a4a, 0xe8d8b8, 0xc85a4a][pal]);
  const c1 = rgb([0xf4e8d0, 0xfaf4e8, 0xf0c0a8][pal]);
  const n = 3 + Math.round(9 * lv);
  const sw = swayBy(S, S * 0.1, 2);
  for (let i = 0; i < n; i++) {
    const a = i * 2.4 + r();
    const h = S * (0.55 + r() * 0.45);
    const lean = 0.08 + r() * 0.16;
    const d = 0.01 + S * 0.02 * Math.sqrt(i / n);
    const pts = [0, 0.3, 0.65, 1].map((t) => V(Math.cos(a) * (d + lean * h * t * t), h * t, Math.sin(a) * (d + lean * h * t * t)));
    u.add(tube(pts, (t) => (0.003 + S * 0.006) * (1 - t * 0.5), 3), (i2, p, v) => mix(c0, c1, clamp(v.y / h)), null, sw);
  }
  return u;
}

export function sarcophyton(S, lv, r, pal) {
  const u = new Unit();
  const R = S / 2;
  const stalk = rgb([0xe6dcc6, 0xd8c8a8, 0xe8d8d0][pal]);
  const cap = rgb([0xc8b480, 0xa89868, 0xc8a8a0][pal]);
  const pol = rgb([0xf0e8b8, 0xd8e0a0, 0xf8e8e0][pal]);
  const H = S * 0.42;
  const sw = swayBy(H * 1.3, S * 0.03, 2);
  u.add(stick(R * 0.42 + 0.004, R * 0.34 + 0.003, H, 8), stalk, null, sw);
  const ph = r() * 6;
  const top = (t, a) => H + Math.sin(a * 4 + ph) * R * 0.14 * t * t - t * t * R * 0.08;
  u.add(disc(R, 14, 3, top, { inner: 0.02 }), cap, null, sw);
  // 傘の上面に開いたポリプ（中央の禿げた部分を残す）
  const polyp = new THREE.ConeGeometry(1, 1, 3, 1, true).translate(0, 0.5, 0);
  const n = 40 + Math.round(80 * lv);
  for (let k = 0; k < n; k++) {
    const t = 0.25 + 0.72 * Math.sqrt((k + 0.5) / n);
    const a = k * 2.4;
    const p = V(Math.cos(a) * t * R, top(t, a), Math.sin(a) * t * R);
    const h = 0.006 + R * 0.05;
    u.add(polyp, pol, at(p, V((r() - 0.5) * 0.5, 1, (r() - 0.5) * 0.5), [h * 0.22, h, h * 0.22]), (v) => sw(v) + 0.25 * h);
  }
  polyp.dispose();
  return u;
}

export function heteractis(S, lv, r, pal) {
  const u = new Unit();
  const R = S / 2;
  const column = rgb([0xc8283a, 0x7a3aa8, 0x3a5ac8][pal]);
  const disk = rgb(0xb8a468);
  const tc = [rgb(0xb8c468), rgb(0xd8cc90)];
  const H = S * 0.3;
  u.add(stick(R * 0.6, R * 0.82, H, 10), column);
  u.add(disc(R, 12, 1, (t, a) => H + Math.sin(a * 3) * R * 0.04 * t), disk);
  const n = 70 + Math.round(90 * lv);
  const len = 0.03 + 0.05 * lv;
  const rad = 0.0034 + 0.0045 * lv;
  const sw = (v) => 0.3 * len * clamp((v.y - H) / len) ** 1.4;
  for (let k = 0; k < n; k++) {
    const a = k * 2.4;
    const d = Math.sqrt((k + 0.5) / n) * R * 0.96;
    const out = V(Math.cos(a), 0, Math.sin(a));
    const lean = 0.25 + (d / R) * 1.1;
    // 指状の触手：根元は外へ、先は上へ曲がる
    const p0 = V(out.x * d, H, out.z * d);
    const p1 = p0.clone().add(V(out.x * lean, 1, out.z * lean).normalize().multiplyScalar(len * 0.5));
    const p2 = p1.clone().add(V(out.x * lean * 0.35 + (r() - 0.5) * 0.3, 1, out.z * lean * 0.35 + (r() - 0.5) * 0.3).normalize().multiplyScalar(len * 0.5));
    u.add(tube([p0, p1, p2], (t) => rad * (1 - t * 0.25), 3), tc[k % 2], null, sw);
  }
  return u;
}

export function stichodactyla(S, lv, r, pal) {
  const u = new Unit();
  const R = S / 2;
  const base = rgb([0x5a8a4a, 0x8a6a4a, 0x7a4a8a][pal]);
  const tent = rgb([0x9ad070, 0xd0a878, 0xc098e0][pal]);
  const ph = r() * 6;
  // 縁が深く波打つ平らな口盤
  const H = 0.015 + R * 0.24;
  const top = (t, a) => H + Math.sin(a * 5 + ph) * R * 0.2 * t * t * t;
  u.add(stick(R * 0.35, R * 0.45, H, 8), base);
  u.add(disc(R, 16, 4, top, { inner: 0.04 }), base);
  const nub = new THREE.ConeGeometry(1, 1, 3, 1, true).translate(0, 0.5, 0);
  const n = 120 + Math.round(200 * lv);
  const h = 0.005 + 0.004 * lv;
  for (let k = 0; k < n; k++) {
    const t = 0.1 + 0.88 * Math.sqrt((k + 0.5) / n);
    const a = k * 2.4;
    u.add(nub, k % 5 ? tent : base, at([Math.cos(a) * t * R, top(t, a), Math.sin(a) * t * R], V(0, 1, 0), [h * 0.35, h, h * 0.35]), 0.002);
  }
  nub.dispose();
  return u;
}

/** 以下は面に広げる小さな個体（被覆・群生） */

export function gsp(S, lv, r, pal) {
  const u = new Unit();
  const mat = rgb(0x6a3f8a);
  const pol = [rgb([0x7af07a, 0xb8f0e0, 0xe8e070][pal]), rgb([0x4ac85a, 0x88d8c8, 0xc8c050][pal])];
  // 紫のマット（となりの個体と重なって岩を覆う）と、その上に開く星形のポリプ
  u.add(disc(0.04, 8, 1, (t) => 0.004 * (1 - t)), mat);
  const star = disc(0.0095, 5, 1, (t) => t * 0.003, { inner: 0.12 });
  const stalk = stick(0.0011, 0.0011, 1, 3);
  for (let k = 0; k < 9; k++) {
    const a = k * 2.4 + r();
    const d = 0.034 * Math.sqrt((k + 0.5) / 9);
    const h = 0.004 + r() * 0.004;
    const p = V(Math.cos(a) * d, 0.003, Math.sin(a) * d);
    u.add(stalk, mat, at(p, V(0, 1, 0), [1, h, 1]), (v) => 0.004 * clamp((v.y - 0.003) / h));
    u.add(star, pol[k % 2], at(p.clone().add(V(0, h, 0)), V((r() - 0.5) * 0.5, 1, (r() - 0.5) * 0.5)), 0.004);
  }
  return u;
}

export function xenia(S, lv, r, pal) {
  const u = new Unit();
  const stem = rgb(0xeae6e0);
  const pet = rgb([0xf4c4d6, 0xc8dcf0, 0xf0e8c8][pal]);
  u.add(stick(0.008, 0.0065, 0.022, 5), stem);
  // 柄の先から5本のポリプ。羽状の触手が花のように開く（実物は開閉を繰り返す）
  const crown = disc(0.012, 8, 1, (t) => t * t * 0.006, { inner: 0.15 });
  for (let k = 0; k < 5; k++) {
    const a = k * (TAU / 5) + r();
    const out = V(Math.cos(a) * 0.7, 1, Math.sin(a) * 0.7).normalize();
    const p0 = V(Math.cos(a) * 0.003, 0.02, Math.sin(a) * 0.003);
    const len = 0.022 + r() * 0.012;
    const p1 = p0.clone().addScaledVector(out, len);
    const sw = (v) => 0.008 * clamp((v.y - 0.02) / 0.03);
    u.add(tube([p0, p1], 0.0016, 3), stem, null, sw);
    u.add(crown, pet, at(p1, out), 0.009);
  }
  crown.dispose();
  return u;
}

export function discosoma(S, lv, r, pal) {
  const u = new Unit();
  const c0 = rgb([0xb03a4a, 0x3a5ab0, 0x3a8a5a, 0x8a3a9a][pal]);
  const c1 = rgb([0xf07a8a, 0x8ab0f0, 0x9ae07a, 0xe090f0][pal]);
  const R = 0.032;
  u.add(stick(R * 0.35, R * 0.45, 0.006, 6), c0);
  // 皿のようにくぼんだ円盤。中央に口、放射状の筋
  u.add(disc(R, 12, 2, (t, a) => 0.006 + t * t * R * 0.3 + Math.sin(a * 3) * 0.002 * t, { inner: 0.1 }), (i, p, v) => {
    const t = Math.hypot(v.x, v.z) / R;
    if (t < 0.15) return c1;
    return Math.round((Math.atan2(v.z, v.x) / TAU) * 12) % 2 && t > 0.4 ? c1 : c0;
  }, null, (v) => 0.003 * clamp(Math.hypot(v.x, v.z) / R));
  return u;
}

export function tama(S, lv, r, pal) {
  const u = new Unit();
  const mat = rgb(0x7a6a4a);
  const c0 = rgb([0x3ac86a, 0xf08a3a, 0xe04a7a, 0x4ab8d8][pal]);
  const c1 = rgb([0xf0a03a, 0x58d0a0, 0xf8e060, 0xf0f0a0][pal]);
  // 共肉（ポリプをつなぐ薄い膜）のマットの上に、径1cmほどのポリプが7つ六角形にすき間なく並ぶ。
  // マットは隣の個体と重なり、つなぎの帯（spec.link）と合わせて岩を一面に覆う
  u.add(disc(0.019, 8, 1, (t) => 0.003 * (1 - t * t)), mat);
  const crown = disc(0.0062, 7, 1, (t) => t * 0.0028, { inner: 0.35 });
  const oral = disc(0.0042, 6, 1, () => 0.0004);
  for (let k = 0; k < 7; k++) {
    const a = k * (TAU / 6) + 0.3;
    const d = k === 0 ? 0 : 0.0115;
    const h = 0.006 + r() * 0.005;
    const p = V(Math.cos(a) * d, 0.002, Math.sin(a) * d);
    u.add(stick(0.0042, 0.0052, h, 6), mat, at(p));
    const top = [p.x, p.y + h, p.z];
    u.add(crown, c0, at(top), 0.0012);
    u.add(oral, c1, at(top));
  }
  crown.dispose();
  oral.dispose();
  return u;
}

export function entacmaea(S, lv, r, pal) {
  const u = new Unit();
  const column = rgb(0xb8305a);
  const body = rgb([0x9a7a4a, 0x6a8a4a, 0xb85a4a][pal]);
  const tipC = rgb(0xe858a8);
  const R = 0.034;
  const H = 0.025;
  u.add(stick(R * 0.75, R * 0.92, H, 8), column);
  u.add(disc(R, 8, 1, () => H), body);
  const bulb = bead();
  // 触手は褐色〜緑。先端近くが球状に膨らみ、先は桃〜紫
  for (let k = 0; k < 16; k++) {
    const a = k * 2.4;
    const d = Math.sqrt((k + 0.5) / 16) * R * 0.9;
    const dir = V(Math.cos(a) * (d / R) * 0.9, 1, Math.sin(a) * (d / R) * 0.9).normalize();
    const len = 0.022 + r() * 0.014;
    const p0 = V(Math.cos(a) * d, H, Math.sin(a) * d);
    const sw = (v) => 0.01 * clamp((v.y - H) / 0.05);
    u.add(stick(0.0036, 0.0042, len * 0.6, 3), body, at(p0, dir), sw);
    const bp = p0.clone().addScaledVector(dir, len * 0.68);
    u.add(bulb, (i, q, v) => (v.y > bp.y + 0.003 ? tipC : body), at(bp, dir, [0.0085, 0.0085, 0.0085]), sw);
  }
  return u;
}
