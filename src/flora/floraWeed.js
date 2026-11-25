import * as THREE from 'three';
import { Unit, V, at, rgb, mix, stick, tube, blade, disc, blob, bead, swayBy } from './floraKit.js';

/**
 * 海藻・海草・水草の1株の形（S は高さ m）。高さを上げると、葉を引き伸ばすのではなく節・葉の枚数が増える。
 *   アマモ … 地下茎から立つ1株に帯状の葉が4〜5枚
 *   カジメ … 円柱の茎の先に、羽状に分かれた葉が広がって垂れる
 *   ジャイアントケルプ … 長い茎に沿って、付け根に浮き袋を持つ葉が左右交互に並ぶ。先端は若い葉の束
 *   ホンダワラ … 主枝から出る側枝に、小さな葉と丸い気胞が付く
 *   コンブ … 付着器・短い茎・縁の波打つ帯状の葉1枚（中央の帯が厚く濃い）
 *   ミル … 円柱の枝が二又に分かれ続ける。フェルトのような濃い緑
 *   サボテングサ … 石灰質の平たい節が鎖のようにつながる
 *   ウミブドウ・アオサ・テングサ・ウミウチワ・水草（アマゾンソード・バリスネリア）、川原の玉石
 */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const TAU = Math.PI * 2;
/** 葉の向き：tilt だけ倒し、yaw だけ回す */
const lean = (tilt, yaw) => [tilt, yaw, 0, 'YXZ'];

export function amamo(S, lv, r) {
  const u = new Unit();
  const sw = swayBy(S, S * 0.2, 1.6);
  for (let k = 0, n = 4 + Math.round(r()); k < n; k++) {
    const len = S * (0.55 + 0.45 * r());
    const g = blade(len, 0.007 + r() * 0.003, { bend: 0.08 + r() * 0.2, taper: 'none', segs: 5 });
    u.add(g, rgb(r() < 0.3 ? 0x7a9a3a : 0x3f8a3a, 0.9 + r() * 0.2), at([(r() - 0.5) * 0.008, 0, (r() - 0.5) * 0.008], lean(0.04 + r() * 0.1, k * 1.4 + r())), sw);
    g.dispose();
  }
  return u;
}

export function kajime(S, lv, r) {
  const u = new Unit();
  const sw = swayBy(S, S * 0.1, 2);
  const sh = S * 0.68;
  u.add(stick(0.016 + S * 0.01, 0.006, 0.012 + S * 0.02, 6), rgb(0x4a3418));
  u.add(stick(0.004 + S * 0.006, 0.003 + S * 0.004, sh, 5), rgb(0x5a3e1a), null, sw);
  // 茎の先から羽状に分かれた葉が広がり、先は重みで垂れる
  const n = 7 + Math.round(4 * lv);
  for (let b = 0; b < n; b++) {
    const g = blade(S * (0.34 + r() * 0.12), S * 0.09 + 0.01, { bend: 0.75 + r() * 0.3, taper: 'oval', segs: 4, ruffle: S * 0.012 });
    u.add(g, rgb(b % 3 ? 0x7a5420 : 0x8c6426, 0.9 + r() * 0.2), at([0, sh * 0.97, 0], lean(0.2 + r() * 0.45, (b / n) * TAU + r() * 0.3)), sw);
    g.dispose();
  }
  return u;
}

export function kelp(S, lv, r) {
  const u = new Unit();
  const sw = swayBy(S, S * 0.16, 1.5);
  const ph = r() * 6;
  const lx = (r() - 0.5) * 0.2;
  const lz = (r() - 0.5) * 0.2;
  const P = (t) => V((lx * t + Math.sin(t * 5 + ph) * 0.03) * S, t * S, (lz * t + Math.cos(t * 4 + ph) * 0.03) * S);
  u.add(tube([0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1].map(P), (t) => 0.004 + S * 0.0012 * (1 - t), 3), rgb(0x6a5020), null, sw);
  u.add(stick(0.02 + S * 0.004, 0.006, 0.02 + S * 0.006, 6), rgb(0x4a3a18));
  // 節ごとに浮き袋と葉。背が高いほど節が増える（葉の大きさは変えない）
  const nodes = 5 + Math.round(S / 0.22);
  const bl = clamp(0.1 + S * 0.08, 0.12, 0.42);
  const float = bead();
  for (let k = 0; k < nodes; k++) {
    const t = 0.1 + 0.88 * (k / nodes);
    const p = P(t);
    const yaw = k * 2.4 + r();
    const out = V(Math.cos(yaw), 0.4, -Math.sin(yaw)).normalize();
    u.add(float, rgb(0xa88a38), at(p.clone().addScaledVector(out, bl * 0.07), out, [bl * 0.05, bl * 0.09, bl * 0.05]), sw);
    const g = blade(bl * (0.8 + r() * 0.4), bl * 0.26, { bend: 0.3 + r() * 0.3, taper: 'oval', segs: 3, ruffle: bl * 0.02 });
    u.add(g, rgb(0x8a6a28, 0.9 + r() * 0.25), at(p.clone().addScaledVector(out, bl * 0.12), lean(0.9 + r() * 0.5, yaw + Math.PI / 2)), (v) => sw(v) + bl * 0.05);
    g.dispose();
  }
  return u;
}

export function hondawara(S, lv, r) {
  const u = new Unit();
  const sw = swayBy(S, S * 0.14, 1.6);
  const P = (t) => V(Math.sin(t * 3) * S * 0.04, t * S, Math.cos(t * 2.3) * S * 0.03);
  u.add(tube([0, 0.25, 0.5, 0.75, 1].map(P), (t) => 0.003 + S * 0.004 * (1 - t), 3), rgb(0x5a4418), null, sw);
  const n = 6 + Math.round(S / 0.16);
  const leafG = blade(0.03 + S * 0.02, 0.01 + S * 0.006, { taper: 'oval', segs: 2 });
  const ves = new THREE.TetrahedronGeometry(1, 0);
  for (let k = 0; k < n; k++) {
    const t = 0.12 + 0.85 * (k / n);
    const p = P(t);
    const a = k * 2.4;
    const bl = S * 0.16 * (1.15 - t);
    const dir = V(Math.cos(a), 0.7, Math.sin(a)).normalize();
    u.add(stick(0.0018, 0.0012, bl, 3), rgb(0x6a5220), at(p, dir), sw);
    // 側枝に小さな葉と丸い気胞（浮き）
    for (let s = 1; s <= 3; s++) {
      const q = p.clone().addScaledVector(dir, (bl * s) / 3);
      u.add(leafG, rgb(0x8a6a24, 0.85 + r() * 0.3), at(q, lean(0.6 + r() * 0.8, r() * TAU)), sw);
      if (s < 3) u.add(ves, rgb(0xa08030), at(q.clone().add(V(0, 0.006, 0)), V(0, 1, 0), 0.0045 + S * 0.002), sw);
    }
  }
  leafG.dispose();
  return u;
}

export function konbu(S, lv, r) {
  const u = new Unit();
  const sw = swayBy(S, S * 0.18, 1.7);
  const dark = rgb(0x4a3614);
  const pale = rgb(0x8a6a2a);
  u.add(stick(0.012 + S * 0.004, 0.004, 0.012, 6), rgb(0x3a2a14));
  const sh = 0.02 + S * 0.03;
  u.add(stick(0.004, 0.0035, sh, 4), rgb(0x4a3418), null, sw);
  // 帯状の葉：中央の帯は厚く濃く、縁は薄く波打つ。若い葉を1枚添える
  for (const [k, w] of [[1, 1], [0.6, 0.7]]) {
    const len = S * 0.96 * k;
    const width = clamp(S * 0.11, 0.03, 0.28) * w;
    const g = blade(len, width, { bend: 0.1 + r() * 0.16, taper: 'oval', segs: 8, cross: 2, ruffle: width * 0.18 });
    u.add(g, (i, p) => (Math.abs(p.getX(i)) < width * 0.1 ? dark : pale), at([0, sh, 0], lean(0.06 + r() * 0.1, r() * TAU)), sw);
    g.dispose();
  }
  return u;
}

export function miru(S, lv, r) {
  const u = new Unit();
  const sw = swayBy(S, S * 0.06, 1.5);
  const depth = S > 0.22 ? 4 : 3;
  const seg = stick(1, 1, 1, 4);
  const len0 = S / (depth + 1) * 1.25;
  const rad = 0.0035 + S * 0.006;
  const fork = (p, dir, len, d) => {
    u.add(seg, rgb(0x2f5a2a, 0.85 + r() * 0.3), at(p, dir, [rad, len, rad]), sw);
    const end = p.clone().addScaledVector(dir, len);
    if (d === depth) return u.add(bead(), rgb(0x3a6a34), at(end, dir, rad * 1.1), sw);
    const side = V(-dir.z, 0, dir.x).normalize().applyAxisAngle(dir, r() * Math.PI);
    for (const s of [-1, 1]) fork(end, dir.clone().addScaledVector(side, s * 0.5).normalize(), len * 0.85, d + 1);
  };
  fork(V(), V((r() - 0.5) * 0.3, 1, (r() - 0.5) * 0.3).normalize(), len0, 0);
  return u;
}

export function saboten(S, lv, r) {
  const u = new Unit();
  const sw = swayBy(S, S * 0.05, 1.5);
  const seg = new THREE.CircleGeometry(1, 5, 0, Math.PI).translate(0, 0.05, 0); // 腎臓形の平たい節（立てて使う）
  const size = 0.009 + S * 0.03;
  for (let c = 0; c < 4; c++) {
    let p = V((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.02);
    const dir = V((r() - 0.5) * 0.8, 1, (r() - 0.5) * 0.8).normalize();
    const n = Math.max(3, Math.round(S / (size * 1.05)));
    for (let k = 0; k < n; k++) {
      u.add(seg, rgb(k % 2 ? 0x7ab85a : 0x8ac868, 0.9 + r() * 0.2), at(p, lean(Math.atan2(Math.hypot(dir.x, dir.z), dir.y), k * 1.3 + c), size), sw);
      p = p.clone().addScaledVector(dir, size * 1.02);
      dir.add(V((r() - 0.5) * 0.4, 0.1, (r() - 0.5) * 0.4)).normalize();
    }
  }
  seg.dispose();
  return u;
}

export function umibudou(S, lv, r) {
  const u = new Unit();
  const sw = swayBy(S, S * 0.08, 1.5);
  // 砂・岩の上を這う匍匐枝（となりの株と spec.link でつながる）から、1〜2cm おきに粒の付いた直立枝が立つ
  u.add(blob(0), rgb(0x4a8a38), at([0, 0.002, 0], V(0, 1, 0), [0.004, 0.002, 0.004]));
  const grain = bead();
  for (let k = 0; k < 2; k++) {
    const h = S * (0.6 + r() * 0.4);
    const x = (k - 0.5) * 0.014;
    const z = (r() - 0.5) * 0.006;
    u.add(stick(0.0018, 0.0014, h, 3), rgb(0x4a8a38), at([x, 0, z], V((r() - 0.5) * 0.2, 1, (r() - 0.5) * 0.2)), sw);
    for (let y = h * 0.18, i = 0; y < h; y += 0.008, i++) {
      const a = i * 2.4;
      u.add(grain, rgb(0x4cb850, 0.85 + r() * 0.3), at([x + Math.cos(a) * 0.0052, y, z + Math.sin(a) * 0.0052], V(0, 1, 0), 0.0042), sw);
    }
  }
  return u;
}

export function aosa(S, lv, r) {
  const u = new Unit();
  const sw = swayBy(S, S * 0.15, 1.3);
  // 薄く波打つシートを根元から3枚
  for (let k = 0; k < 3; k++) {
    const R = S * (0.55 + r() * 0.3);
    const ph = r() * 6;
    const g = disc(R, 8, 2, (t, a) => Math.sin(a * 3 + ph) * R * 0.12 * t, { inner: 0.05, arc: Math.PI * 0.95, center: true });
    u.add(g, rgb(k % 2 ? 0x7ccf5a : 0x9ade6a, 0.9 + r() * 0.2), at([0, 0.002, 0], [0, k * 2.1 + r(), 0.5 + r() * 0.7]), sw);
    g.dispose();
  }
  return u;
}

export function tengusa(S, lv, r) {
  const u = new Unit();
  const sw = swayBy(S, S * 0.08, 1.5);
  // 平たい主枝の左右に細い小枝が羽のように並ぶ葉状体を5本
  for (let f = 0; f < 5; f++) {
    const len = S * (0.7 + r() * 0.3);
    const m = at([(r() - 0.5) * 0.012, 0, (r() - 0.5) * 0.012], lean(0.15 + r() * 0.45, f * 1.3 + r()));
    const c = rgb([0xa0303c, 0x7a2028, 0xc0505a][f % 3]);
    const axis = blade(len, len * 0.035 + 0.0015, { taper: 'tip', segs: 2, bend: 0.2 });
    u.add(axis, c, m, sw);
    axis.dispose();
    for (let k = 1; k <= 7; k++) {
      const t = k / 8;
      const side = k % 2 ? 1 : -1;
      const twig = blade(len * 0.32 * (1.1 - t), len * 0.025 + 0.0012, { taper: 'tip', segs: 1 });
      const local = new THREE.Matrix4().makeTranslation(0, len * t, 0.2 * t * t * len).multiply(new THREE.Matrix4().makeRotationZ(-side * 0.95));
      u.add(twig, c, m.clone().multiply(local), sw);
      twig.dispose();
    }
  }
  return u;
}

export function umiuchiwa(S, lv, r) {
  const u = new Unit();
  const sw = swayBy(S, S * 0.05, 1.5);
  const base = rgb(0xa07848);
  const chalk = rgb(0xe0d4b8);
  // 扇形の葉。同心円状に白い石灰の縞が入り、縁は内へ巻く
  for (let k = 0; k < 3; k++) {
    const R = S * (0.7 + r() * 0.3);
    const g = disc(R, 6, 4, (t) => t * t * R * 0.22, { inner: 0.06, arc: Math.PI * 0.8, center: true });
    const m = at([(r() - 0.5) * 0.01, 0, (r() - 0.5) * 0.01], [0, k * 2.2 + r(), Math.PI / 2 - 0.25 - r() * 0.3]);
    u.add(g, (i, p) => (Math.round((Math.hypot(p.getX(i), p.getZ(i)) / R) * 4) % 2 ? chalk : base), m, sw);
    g.dispose();
  }
  return u;
}

export function plants(S, lv, r) {
  const u = new Unit();
  const sw = swayBy(S, S * 0.12, 1.6);
  const greens = [0x3f9b3a, 0x5fbf4a, 0x2f7a3a, 0x8fcf4f];
  for (let k = 0; k < 6; k++) {
    const g = blade(S * (0.5 + r() * 0.5), 0.01 + S * 0.03, { taper: 'tip', segs: 2, bend: 0.2 + r() * 0.3 });
    u.add(g, rgb(greens[k % 4], 0.9 + r() * 0.2), at([(r() - 0.5) * 0.015, 0, (r() - 0.5) * 0.015], lean(0.1 + r() * 0.35, k * 1.1 + r())), sw);
    g.dispose();
  }
  return u;
}

export function amazonSword(S, lv, r) {
  const u = new Unit();
  const sw = swayBy(S, S * 0.07, 1.8);
  // 根元から、長い葉柄の付いた披針形の葉がロゼット状に広がる。外側の古い葉ほど開く
  const n = 8 + Math.round(4 * lv);
  for (let k = 0; k < n; k++) {
    const a = k * 2.4 + r() * 0.3;
    const tilt = 0.15 + (k / n) * 0.6;
    const pet = S * (0.25 + r() * 0.1);
    const col = rgb(k < n / 2 ? 0x4a9a30 : 0x35782a, 0.9 + r() * 0.2);
    u.add(stick(0.0022, 0.0016, pet, 3), col, at(V(), lean(tilt, a)), sw);
    const tip = V(0, pet, 0).applyEuler(new THREE.Euler(tilt, a, 0, 'YXZ'));
    const g = blade(S * (0.55 + r() * 0.25), S * 0.13 + 0.01, { bend: 0.35, taper: 'oval', segs: 4, cross: 2, fold: -0.12 });
    u.add(g, col, at(tip, lean(tilt * 1.15, a)), sw);
    g.dispose();
  }
  return u;
}

export function vallisneria(S, lv, r) {
  const u = new Unit();
  const sw = swayBy(S, S * 0.18, 1.6);
  for (let k = 0; k < 6; k++) {
    const g = blade(S * (0.6 + r() * 0.4), 0.007 + r() * 0.003, { bend: 0.08 + r() * 0.2, taper: 'none', segs: 6 });
    u.add(g, rgb(r() < 0.4 ? 0x6aa83a : 0x4a9030, 0.9 + r() * 0.2), at([(r() - 0.5) * 0.01, 0, (r() - 0.5) * 0.01], lean(0.05 + r() * 0.15, k * 1.1 + r())), sw);
    g.dispose();
  }
  return u;
}

export function cobble(S, lv, r) {
  const u = new Unit();
  const cols = [0x8a8580, 0x6a6560, 0xa09888, 0x7a6a58, 0x9a9a96];
  const stone = blob(0);
  for (let k = 0; k < 3; k++) {
    const R = 0.014 + r() * 0.016;
    const a = k * 2.1 + r();
    const d = k === 0 ? 0 : 0.028;
    const sy = R * (0.45 + r() * 0.2);
    u.add(stone, rgb(cols[Math.floor(r() * cols.length)], 0.9 + r() * 0.2), at([Math.cos(a) * d, sy * 0.7, Math.sin(a) * d], [r() * 0.3, r() * 6, r() * 0.3], [R * (1 + r() * 0.5), sy, R]));
  }
  return u;
}
