import * as THREE from 'three';
import { Parts, colony, place, stem, tone } from './colonyKit.js';

/**
 * 海藻・海草。どれも群落として growth.ext の方向へ広がり、growth.density で株の数が変わる。下の岩・砂に沿って生える。
 *   アマモ（海草）… 砂地から伸びる細長いリボン状の葉。1株に3〜5枚
 *   カジメ … 短い茎の先から、しわのある葉が何枚も出る褐藻（海中林）
 *   ジャイアントケルプ … 長い茎に沿って葉が並び、葉の付け根に浮き袋がある大型褐藻（モントレーベイ水族館のケルプの森）
 *   ホンダワラ … 枝分かれした茎に小さな葉と丸い気胞が付く褐藻（ガラモ場）
 *   ウミブドウ … 砂の上を這う茎から立つ枝に、粒状の小枝がブドウのように付く緑藻
 *   アオサ … 薄く波打つ明るい緑のシート状の緑藻
 *   テングサ … 細かく枝分かれする赤い紅藻
 *   ウミウチワ … 白っぽい縞のある扇形の褐藻
 * 新しい海藻・水草は seaweedMore.js
 */

/** 細長い葉：根元から先へ、幅を taper で細め、bend で前へしならせ、wave で縁を波打たせる */
export function leaf(len, width, { bend = 0, wave = 0, taper = 'tip', segs = 8 } = {}) {
  const g = new THREE.PlaneGeometry(width, len, 2, segs);
  g.translate(0, len / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / len;
    const shape = taper === 'tip' ? 1 - t * 0.85 : taper === 'oval' ? Math.sin(Math.PI * Math.min(0.98, Math.max(0.04, t))) : 1;
    const x = p.getX(i) * shape;
    p.setXYZ(i, x, p.getY(i), bend * t * t * len + Math.sin(t * 9 + x * 60) * wave);
  }
  return g;
}

/** 葉を置く行列（根元 at、傾き rx・向き ry・横倒し rz） */
export const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => place([x, y, z], [rx, ry, rz]);

const SOFT = { flat: false, double: true };

export function buildAmamo(g, def, opt) {
  const { h } = def.size;
  const P = new Parts();
  for (const c of colony(opt, 0.1, 260, 0.005)) {
    const ry = c.rand() * Math.PI * 2;
    for (let k = 0, n = 3 + Math.floor(c.rand() * 3); k < n; k++) {
      const len = h * (0.45 + c.rand() * 0.55);
      const lf = leaf(len, 0.007 + c.rand() * 0.004, { bend: 0.25 + c.rand() * 0.35, taper: 'none', segs: 10 });
      P.add(lf, tone(c.rand() < 0.3 ? 0x7a9a3a : 0x3f8a3a, c.rand), M(c.x, c.y, c.z, 0, ry + (k - n / 2) * 0.25, (c.rand() - 0.5) * 0.25));
      lf.dispose();
    }
  }
  P.into(g, { ...SOFT, roughness: 0.85 });
}

export function buildKajime(g, def, opt) {
  const { h } = def.size;
  const P = new Parts();
  for (const c of colony(opt, 0.1, 140)) {
    const sh = h * (0.35 + c.rand() * 0.15);
    P.add(new THREE.ConeGeometry(0.012, 0.015, 6).translate(0, 0.0075, 0), tone(0x4a3418, c.rand), M(c.x, c.y, c.z));
    P.add(stem(0.006, 0.004, sh, 6), tone(0x5a3e1a, c.rand), M(c.x, c.y, c.z));
    // 茎の先から長い葉が広がり、先は重みで垂れる
    const n = 5 + Math.floor(c.rand() * 3);
    for (let b = 0; b < n; b++) {
      const a = (b / n) * Math.PI * 2 + c.rand() * 0.4;
      const lf = leaf(h * (0.5 + c.rand() * 0.2), 0.055 + c.rand() * 0.02, { bend: 1.1, wave: 0.009, taper: 'oval', segs: 12 });
      P.add(lf, tone(b % 3 ? 0x7a5420 : 0x8c6426, c.rand), M(c.x, c.y + sh * 0.95, c.z, 0.75 + c.rand() * 0.35, a, 0));
      lf.dispose();
    }
  }
  P.into(g, SOFT);
}

export function buildKelp(g, def, opt) {
  const { h } = def.size;
  const P = new Parts();
  for (const c of colony(opt, 0.08, 150)) {
    const lean = new THREE.Vector3((c.rand() - 0.5) * 0.25, 1, (c.rand() - 0.5) * 0.25);
    const k = c.rand() * 6;
    const curve = new THREE.CatmullRomCurve3([0, 0.35, 0.7, 1].map((t) => new THREE.Vector3(c.x + lean.x * t * h + Math.sin(t * 4 + k) * 0.02, c.y + t * h * (0.8 + c.rand() * 0.2), c.z + lean.z * t * h)));
    P.add(new THREE.TubeGeometry(curve, 16, 0.003, 5, false), tone(0x6a5020, c.rand));
    for (let t = 0.08; t < 0.98; t += 0.07 + c.rand() * 0.03) {
      const p = curve.getPoint(t);
      const side = c.rand() < 0.5 ? -1 : 1;
      // 葉の付け根の浮き袋
      P.add(new THREE.SphereGeometry(0.007, 6, 4), tone(0x9a7a30, c.rand), M(p.x, p.y, p.z));
      const lf = leaf(h * (0.14 + c.rand() * 0.06), 0.028, { bend: 0.4, wave: 0.003, taper: 'oval' });
      P.add(lf, tone(0x8a6a28, c.rand), M(p.x, p.y, p.z, 0.2, c.rand() * Math.PI * 2, side * (0.9 + c.rand() * 0.4)));
      lf.dispose();
    }
  }
  P.into(g, SOFT);
}

export function buildHondawara(g, def, opt) {
  const { h } = def.size;
  const P = new Parts();
  const bladder = new THREE.SphereGeometry(0.0045, 6, 4);
  const small = leaf(0.025, 0.008, { taper: 'oval', segs: 3 });
  for (const c of colony(opt, 0.08, 150, 0, 120)) {
    const sh = h * (0.7 + c.rand() * 0.3);
    P.add(stem(0.004, 0.0025, sh, 5), tone(0x5a4418, c.rand), M(c.x, c.y, c.z, 0, 0, (c.rand() - 0.5) * 0.15));
    for (let t = 0.15; t < 1; t += 0.12) {
      const y = c.y + sh * t;
      const a = c.rand() * Math.PI * 2;
      const bl = h * 0.12 * (1.1 - t);
      const bx = Math.cos(a) * bl;
      const bz = Math.sin(a) * bl;
      P.add(stem(0.002, 0.0015, bl, 4), tone(0x6a5220, c.rand), M(c.x, y, c.z, Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1));
      for (let s = 0.3; s <= 1; s += 0.35) {
        const px = c.x + bx * s;
        const pz = c.z + bz * s;
        const py = y + bl * s * 0.45;
        P.add(small, tone(0x8a6a24, c.rand), M(px, py, pz, c.rand(), c.rand() * 6.3, c.rand()));
        P.add(bladder, tone(0xa08030, c.rand), M(px + 0.006, py + 0.004, pz));
      }
    }
  }
  bladder.dispose();
  small.dispose();
  P.into(g, SOFT);
}

export function buildUmibudou(g, def, opt) {
  const { h } = def.size;
  const P = new Parts();
  const bead = new THREE.IcosahedronGeometry(0.0042, 0);
  for (const c of colony(opt, 0.08, 450, 0.005, 70)) {
    // 砂の上を這う茎（となりの株へ向かう）から、粒の付いた直立枝が立つ
    const a = c.rand() * Math.PI * 2;
    const run = 0.03 + c.rand() * 0.02;
    P.add(stem(0.0025, 0.0025, run, 5), tone(0x5a9a40, c.rand), place([c.x, c.y + 0.003, c.z], new THREE.Vector3(Math.cos(a), 0.05, Math.sin(a))));
    const sh = h * (0.45 + c.rand() * 0.55);
    const tilt = (c.rand() - 0.5) * 0.3;
    P.add(stem(0.0022, 0.0018, sh, 4), tone(0x4a8a38, c.rand), M(c.x, c.y, c.z, 0, 0, tilt));
    for (let y = sh * 0.15; y < sh; y += 0.007) {
      for (let k = 0; k < 3; k++) {
        const ang = k * 2.1 + y * 90;
        P.add(bead, tone(0x4cb850, c.rand, 0.15), M(c.x + Math.cos(ang) * 0.005 - Math.sin(tilt) * y, c.y + y, c.z + Math.sin(ang) * 0.005));
      }
    }
  }
  bead.dispose();
  P.into(g, { flat: false, roughness: 0.35 });
}

export function buildAosa(g, def, opt) {
  const P = new Parts();
  // 縁が不規則に波打つ丸いシートを、根元から重ねて広げる
  for (const c of colony(opt, 0.07, 800)) {
    const s = 0.035 + c.rand() * 0.03;
    const sheet = new THREE.CircleGeometry(s, 18, 0, Math.PI * 2);
    const p = sheet.attributes.position;
    const ph = c.rand() * 6;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const r = Math.hypot(x, y) / s;
      const a = Math.atan2(y, x);
      const edge = 1 + Math.sin(a * 5 + ph) * 0.18 + Math.sin(a * 11 + ph * 2) * 0.08;
      p.setXYZ(i, x * edge, y * edge * 1.25 + s, Math.sin(a * 7 + ph) * 0.008 * r * r + r * r * 0.01);
    }
    P.add(sheet, tone(c.rand() < 0.66 ? 0x7ccf5a : 0x9ade6a, c.rand, 0.12), M(c.x, c.y + 0.004, c.z, -0.3 - c.rand() * 0.9, c.rand() * 6.3, (c.rand() - 0.5) * 0.5));
    sheet.dispose();
  }
  P.into(g, { ...SOFT, roughness: 0.6 });
}

export function buildTengusa(g, def, opt) {
  const { h } = def.size;
  const P = new Parts();
  const branch = (c, base, dir, len, r, depth) => {
    const end = base.clone().addScaledVector(dir, len);
    const geo = stem(r, r * 0.7, len, 4);
    P.add(geo, tone(depth > 3 ? 0xc0505a : depth > 1 ? 0xa0303c : 0x7a2028, c.rand), place(base, dir));
    geo.dispose();
    if (depth >= 4) return;
    for (let k = 0; k < 2 + (c.rand() < 0.5 ? 1 : 0); k++) {
      const nd = dir.clone().add(new THREE.Vector3((c.rand() - 0.5) * 1.3, 0.2 + c.rand() * 0.4, (c.rand() - 0.5) * 1.3)).normalize();
      branch(c, end, nd, len * (0.6 + c.rand() * 0.2), r * 0.7, depth + 1);
    }
  };
  for (const c of colony(opt, 0.06, 500, 0, 50)) branch(c, new THREE.Vector3(c.x, c.y, c.z), new THREE.Vector3((c.rand() - 0.5) * 0.6, 1, (c.rand() - 0.5) * 0.6).normalize(), h * 0.3, 0.003, 0);
  P.into(g, { roughness: 0.7 });
}

export function buildUmiuchiwa(g, def, opt) {
  const { h } = def.size;
  const P = new Parts();
  for (const c of colony(opt, 0.06, 500)) {
    const r = h * (0.55 + c.rand() * 0.4);
    const fan = new THREE.CircleGeometry(r, 14, Math.PI * 0.15, Math.PI * 0.7);
    const p = fan.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(Math.atan2(p.getY(i), p.getX(i)) * 6) * 0.004 + (p.getX(i) ** 2 + p.getY(i) ** 2) * 1.2);
    // 中心からの距離で白っぽい縞を入れる
    const base = tone(0xa07848, c.rand);
    const band = (i, pos) => (Math.sin((Math.hypot(pos.getX(i), pos.getY(i)) / r) * 22) > 0.55 ? base.map((v) => Math.min(1, v * 1.45)) : base);
    P.add(fan, band, M(c.x, c.y, c.z, 0, c.rand() * Math.PI, 0));
    fan.dispose();
  }
  P.into(g, { ...SOFT, roughness: 0.8 });
}

export const SEAWEED_BUILDERS = {
  amamo: buildAmamo,
  kajime: buildKajime,
  kelp: buildKelp,
  hondawara: buildHondawara,
  umibudou: buildUmibudou,
  aosa: buildAosa,
  tengusa: buildTengusa,
  umiuchiwa: buildUmiuchiwa,
};
