import * as THREE from 'three';
import { Parts, colony, place, stem, tone } from './colonyKit.js';
import { leaf, M } from './seaweedBuilder.js';

/**
 * 追加の海藻と、淡水の水草（アマゾン・河川の展示）。群落として広がり、密度を変えられる。
 *   コンブ（Saccharina japonica）… 根（付着器）・短い茎から、縁の波打つ帯状の長い葉が1枚伸びる。黄褐色〜黒褐色。北の海の展示
 *   ミル（Codium fragile）… 太さ数mmの円柱状の枝が二又に何度も分かれる。濃い緑でスポンジのような質感
 *   サボテングサ（Halimeda）… 石灰質の腎臓形の節が鎖のようにつながる緑藻。サンゴ礁の砂地・岩の間
 *   アマゾンソード（Echinodorus）… 根元から長い葉柄の付いた披針形の葉がロゼット状に広がる
 *   バリスネリア（Vallisneria）… ランナーで増え、リボン状の長い葉が密生して水面へ伸びる
 */

export function buildKonbu(g, def, opt) {
  const { h } = def.size;
  const P = new Parts();
  for (const c of colony(opt, 0.07, 260)) {
    P.add(new THREE.SphereGeometry(0.008, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), tone(0x3a2a14, c.rand), M(c.x, c.y, c.z)); // 付着器
    const sh = 0.02 + c.rand() * 0.02;
    P.add(stem(0.003, 0.0025, sh, 5), tone(0x4a3418, c.rand), M(c.x, c.y, c.z));
    const len = h * (0.6 + c.rand() * 0.4);
    const blade = leaf(len, 0.035 + c.rand() * 0.02, { bend: 0.3 + c.rand() * 0.3, wave: 0.006, taper: 'oval', segs: 16 });
    const dark = tone(0x5a4218, c.rand, 0.08);
    const pale = tone(0x8a6a2a, c.rand, 0.08);
    // 中央の帯は厚く濃く、縁は薄く明るい
    const shade = (i, p) => (Math.abs(p.getX(i)) < 0.006 ? dark : pale);
    P.add(blade, shade, M(c.x, c.y + sh, c.z, 0.15, c.rand() * 6.3, (c.rand() - 0.5) * 0.3));
    blade.dispose();
  }
  P.into(g, { flat: false, double: true, roughness: 0.6 });
}

export function buildMiru(g, def, opt) {
  const { h } = def.size;
  const P = new Parts();
  const tipGeo = new THREE.SphereGeometry(1, 5, 4);
  const fork = (c, at, dir, len, depth) => {
    const r = 0.0045 * (1 - depth * 0.08);
    const geo = stem(r, r, len, 5);
    const col = tone(0x2f5a2a, c.rand, 0.08);
    P.add(geo, col, place(at, dir));
    geo.dispose();
    const end = at.clone().addScaledVector(dir, len);
    if (depth >= 4) return P.add(tipGeo, col, place(end, dir, r));
    // 二又に分かれる（左右へ開く）
    const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize().applyAxisAngle(dir, c.rand() * Math.PI);
    for (const s of [-1, 1]) fork(c, end, dir.clone().addScaledVector(side, s * 0.55).normalize(), len * (0.8 + c.rand() * 0.15), depth + 1);
  };
  for (const c of colony(opt, 0.06, 260, 0, 150)) fork(c, new THREE.Vector3(c.x, c.y, c.z), new THREE.Vector3((c.rand() - 0.5) * 0.3, 1, (c.rand() - 0.5) * 0.3).normalize(), h * 0.22, 0);
  tipGeo.dispose();
  P.into(g, { flat: false, roughness: 0.95 });
}

export function buildSaboten(g, def, opt) {
  const { h } = def.size;
  const P = new Parts();
  // 腎臓形の平たい節
  const seg = new THREE.CircleGeometry(1, 9).scale(1, 0.8, 1);
  const chain = (c, at, dir, n, size, depth) => {
    let p = at.clone();
    for (let k = 0; k < n; k++) {
      const s = size * (0.85 + c.rand() * 0.3);
      P.add(seg, tone(k % 2 ? 0x7ab85a : 0x8ac868, c.rand, 0.08), place(p.clone().addScaledVector(dir, s * 0.8), [0, Math.atan2(dir.x, dir.z) + Math.PI / 2, 0], new THREE.Vector3(s, s, s)));
      p.addScaledVector(dir, s * 1.5);
      if (depth < 2 && c.rand() < 0.3) chain(c, p.clone(), dir.clone().add(new THREE.Vector3((c.rand() - 0.5) * 0.9, 0, (c.rand() - 0.5) * 0.9)).normalize(), n - k - 1, size * 0.9, depth + 1);
      dir.add(new THREE.Vector3((c.rand() - 0.5) * 0.5, 0, (c.rand() - 0.5) * 0.5)).normalize();
    }
  };
  for (const c of colony(opt, 0.06, 420)) {
    P.add(stem(0.0025, 0.002, 0.008, 5), tone(0xd8dcc8, c.rand), M(c.x, c.y, c.z)); // 白い根元
    chain(c, new THREE.Vector3(c.x, c.y + 0.008, c.z), new THREE.Vector3((c.rand() - 0.5) * 0.6, 1, (c.rand() - 0.5) * 0.6).normalize(), Math.max(3, Math.round((h / 0.013) * (0.5 + c.rand() * 0.5))), 0.0065, 0);
  }
  seg.dispose();
  P.into(g, { double: true, roughness: 0.8 });
}

export function buildAmazonSword(g, def, opt) {
  const { h } = def.size;
  const P = new Parts();
  for (const c of colony(opt, 0.07, 70)) {
    const n = 9 + Math.floor(c.rand() * 6);
    for (let k = 0; k < n; k++) {
      const a = k * 2.4 + c.rand() * 0.3;
      const tilt = 0.25 + (k / n) * 0.75; // 外側の古い葉ほど開く
      const pet = h * (0.15 + c.rand() * 0.1);
      const len = h * (0.45 + c.rand() * 0.3);
      const col = tone(k < n / 2 ? 0x3f8a2a : 0x5aa83a, c.rand, 0.08);
      // 傾けてから向きを変える（YXZ）。葉は葉柄の先から外へ弓なりに垂れる
      P.add(stem(0.0018, 0.0014, pet, 4), col, place([c.x, c.y, c.z], [tilt, a, 0, 'YXZ']));
      const blade = leaf(len, 0.025 + c.rand() * 0.012, { bend: 0.7, taper: 'oval', segs: 8 });
      const base = new THREE.Vector3(0, pet, 0).applyEuler(new THREE.Euler(tilt, a, 0, 'YXZ'));
      P.add(blade, col, place([c.x + base.x, c.y + base.y, c.z + base.z], [tilt * 1.15, a, 0, 'YXZ']));
      blade.dispose();
    }
  }
  P.into(g, { flat: false, double: true, roughness: 0.55 });
}

export function buildVallisneria(g, def, opt) {
  const { h } = def.size;
  const P = new Parts();
  for (const c of colony(opt, 0.07, 380, 0.004)) {
    const ry = c.rand() * Math.PI * 2;
    for (let k = 0, n = 4 + Math.floor(c.rand() * 3); k < n; k++) {
      const len = h * (0.55 + c.rand() * 0.45);
      const lf = leaf(len, 0.006 + c.rand() * 0.003, { bend: 0.3 + c.rand() * 0.4, wave: 0.002, taper: 'none', segs: 12 });
      P.add(lf, tone(c.rand() < 0.4 ? 0x6aa83a : 0x4a9030, c.rand, 0.08), M(c.x, c.y, c.z, 0, ry + k * 0.7, (c.rand() - 0.5) * 0.2));
      lf.dispose();
    }
  }
  P.into(g, { flat: false, double: true, roughness: 0.6 });
}

export const MORE_FLORA_BUILDERS = { konbu: buildKonbu, miru: buildMiru, saboten: buildSaboten, amazonSword: buildAmazonSword, vallisneria: buildVallisneria };
