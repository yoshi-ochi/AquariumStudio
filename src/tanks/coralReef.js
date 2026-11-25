import * as THREE from 'three';
import { Parts, colony, place, stem, tone, flat } from './colonyKit.js';

/**
 * 造礁サンゴ（硬い骨格を持つイシサンゴ類）。美ら海水族館「サンゴの海」（約80種・400群体）や海外の公立水族館の
 * サンゴ礁展示で群体の骨組みになる種類。どれも growth.ext の方向へ群体が伸び、growth.density で個体の数が変わる。
 *   コモンサンゴ（Montipora capricornis など）… 薄い板が渦を巻くように重なる。縁ほど明るい紫〜緑
 *   ハマサンゴ（Porites lobata）… 塊状。丸いこぶが盛り上がって巨大な岩のようになる。黄土色〜クリーム
 *   ハナヤサイサンゴ（Pocillopora damicornis）… 太く短い枝が密に分かれ、表面にいぼ（ベルカエ）。淡い桃〜褐色
 *   スリバチサンゴ（Turbinaria reniformis / mesenterina）… すり鉢・巻いた葉のような板。黄緑。ポリプは点状
 *   クサビライシ（Fungia）… 固着しない単体サンゴ。楕円の円盤に放射状の隔壁。砂の上に散らばる
 *   イボヤギ（Tubastraea coccinea）… 光合成しない。橙色の筒状の個体が密集し、黄色い触手を開く。陰になる岩の下面に付く
 */

/** コモンサンゴ：板（扇形の薄い円盤）を高さを変えて重ねる。中心から外へ段々に低く広がる */
function montipora(g, def, opt) {
  const P = new Parts();
  const pal = [[0x6c3e66, 0xb880c8], [0x4f6a3a, 0x9ad070], [0x8a5030, 0xe0a060]][opt.seed % 3];
  for (const c of colony(opt, 0.07, 950)) {
    const r = 0.02 + c.rand() * 0.018;
    const plate = new THREE.CircleGeometry(r, 12, 0, Math.PI * (1.2 + c.rand() * 0.6));
    const pos = plate.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const a = Math.atan2(y, x);
      pos.setZ(i, Math.sin(a * 4 + c.rand()) * 0.003 + (x * x + y * y) * 2.5); // 縁がわずかに波打ち、反り返る
    }
    const lo = tone(pal[0], c.rand, 0.08);
    const hi = tone(pal[1], c.rand, 0.08);
    const grad = (i, p) => {
      const t = Math.min(1, Math.hypot(p.getX(i), p.getY(i)) / r);
      return lo.map((v, k) => v + (hi[k] - v) * t * t);
    };
    const h = 0.004 + (1 - c.t) * (0.03 + c.rand() * 0.025);
    // 板を支える骨格（下の板・岩とつながる）
    const leg = stem(0.004, 0.003, h, 5);
    P.add(leg, lo.map((v) => v * 0.85), place([c.x, c.y, c.z]));
    leg.dispose();
    // 板を水平に寝かせ、外へ向けて少し傾ける
    P.add(plate, grad, place([c.x, c.y + h, c.z], flat((c.rand() - 0.5) * 0.3 - c.t * 0.25, c.rand() * Math.PI * 2)));
    plate.dispose();
  }
  P.into(g, { double: true, roughness: 0.65 });
}

/** ハマサンゴ：中心ほど高いこぶを重ねた塊。表面に細かなポリプの斑 */
function porites(g, def, opt) {
  const P = new Parts();
  const lump = new THREE.IcosahedronGeometry(1, 1);
  for (const c of colony(opt, 0.075, 1500, 0, 160)) {
    const r = 0.015 + c.rand() * 0.01;
    const h = (1 - c.t * c.t) * 0.04 + c.rand() * 0.006;
    const base = tone(c.rand() < 0.7 ? 0xc8ae6e : 0xa88c58, c.rand, 0.06);
    const speck = (i, p) => (Math.sin(p.getX(i) * 900) * Math.sin(p.getZ(i) * 900) > 0.6 ? base.map((v) => v * 0.82) : base);
    P.add(lump, speck, place([c.x, c.y + h * 0.5, c.z], [0, c.rand() * 6, 0], new THREE.Vector3(r, r * 0.7 + h * 0.5, r)));
  }
  lump.dispose();
  P.into(g, { roughness: 0.85 });
}

/** ハナヤサイサンゴ：太く短い枝が2〜3回分かれ、表面にいぼ */
function pocillopora(g, def, opt) {
  const P = new Parts();
  const wart = new THREE.IcosahedronGeometry(0.0032, 0);
  const tipC = 0xe2a4b6;
  const bodyC = [0xb88a8c, 0x9a7a62, 0xc89aa2][opt.seed % 3];
  const branch = (c, from, dir, len, r, depth) => {
    const geo = stem(r, r * 0.8, len, 6);
    P.add(geo, tone(depth > 1 ? tipC : bodyC, c.rand, 0.06), place(from, dir));
    geo.dispose();
    const end = from.clone().addScaledVector(dir, len);
    for (let k = 0; k < 2; k++) P.add(wart, tone(bodyC, c.rand, 0.1), place(from.clone().addScaledVector(dir, len * (0.3 + k * 0.35)).add(new THREE.Vector3((c.rand() - 0.5) * r * 2.2, 0, (c.rand() - 0.5) * r * 2.2))));
    if (depth >= 2) return;
    const n = 2 + (c.rand() < 0.4 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const d = dir.clone().add(new THREE.Vector3((c.rand() - 0.5) * 1.1, 0.35, (c.rand() - 0.5) * 1.1)).normalize();
      branch(c, end, d, len * 0.75, r * 0.82, depth + 1);
    }
  };
  for (const c of colony(opt, 0.055, 1300, 0, 90)) {
    const dir = new THREE.Vector3((c.rand() - 0.5) * 0.5 * (0.4 + c.t), 1, (c.rand() - 0.5) * 0.5 * (0.4 + c.t)).normalize();
    branch(c, new THREE.Vector3(c.x, c.y, c.z), dir, 0.013 + c.rand() * 0.007, 0.0075, 0);
  }
  wart.dispose();
  P.into(g, { roughness: 0.7 });
}

/** スリバチサンゴ：すり鉢形（ろうと）の板。外側の個体ほど開いて傾く */
function turbinaria(g, def, opt) {
  const P = new Parts();
  for (const c of colony(opt, 0.06, 380)) {
    const r = 0.02 + c.rand() * 0.018;
    const depth = r * (0.35 + c.rand() * 0.3);
    const prof = [];
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      prof.push(new THREE.Vector2(0.004 + r * Math.pow(t, 0.75), depth * t * t + 0.008));
    }
    const cup = new THREE.LatheGeometry(prof, 14, c.rand(), Math.PI * (1.4 + c.rand() * 0.6));
    const col = tone(c.rand() < 0.8 ? 0xb8b83e : 0x8a9a3a, c.rand, 0.08);
    const dots = (i, p) => ((i * 7) % 11 === 0 ? col.map((v) => Math.min(1, v * 1.25)) : col); // 点状のポリプ
    const tilt = c.t * 0.6 + (c.rand() - 0.5) * 0.3;
    P.add(cup, dots, place([c.x, c.y, c.z], [tilt * Math.sin(c.rand() * 6), c.rand() * 6, tilt * Math.cos(c.rand() * 6)]));
    cup.dispose();
  }
  P.into(g, { double: true, roughness: 0.7 });
}

/** クサビライシ：楕円の円盤に放射状の隔壁。砂の上にばらばらに置かれる */
function fungia(g, def, opt) {
  const P = new Parts();
  for (const c of colony(opt, 0.06, 140)) {
    const r = 0.025 + c.rand() * 0.025;
    const n = 36;
    const disc = new THREE.CircleGeometry(r, n * 2, 0, Math.PI * 2);
    const pos = disc.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const t = Math.hypot(x, y) / r;
      const a = Math.atan2(y, x);
      pos.setZ(i, r * 0.35 * (1 - t * t) + (Math.cos(a * n) > 0 ? 0.0016 : 0) * (1 - t * 0.5)); // 中央が盛り上がり、隔壁が放射状に並ぶ
      pos.setY(i, y * 0.72); // 楕円
    }
    const body = tone([0xb09060, 0x6e8a5a, 0x9a6a5a][Math.floor(c.rand() * 3)], c.rand, 0.08);
    const mouth = body.map((v) => v * 0.6);
    const shade = (i, p) => (Math.hypot(p.getX(i), p.getY(i) / 0.72) < r * 0.12 ? mouth : Math.cos(Math.atan2(p.getY(i), p.getX(i)) * n) > 0 ? body : body.map((v) => v * 0.82));
    P.add(disc, shade, place([c.x, c.y + 0.002, c.z], flat((c.rand() - 0.5) * 0.15, c.rand() * 6)));
    disc.dispose();
  }
  P.into(g, { roughness: 0.7 });
}

/** イボヤギ：橙色の筒状の個体が密集し、先に黄色い触手の輪 */
function tubastraea(g, def, opt) {
  const P = new Parts();
  const tent = new THREE.ConeGeometry(0.0013, 0.007, 4).translate(0, 0.0035, 0);
  for (const c of colony(opt, 0.04, 2600)) {
    const h = 0.008 + c.rand() * 0.012;
    const r = 0.0035 + c.rand() * 0.0015;
    const cup = stem(r, r * 1.1, h, 7);
    const lean = new THREE.Vector3((c.rand() - 0.5) * 0.6, 1, (c.rand() - 0.5) * 0.6).normalize();
    const base = new THREE.Vector3(c.x, c.y, c.z);
    P.add(cup, tone(0xe0602a, c.rand, 0.08), place(base, lean));
    cup.dispose();
    const top = base.clone().addScaledVector(lean, h);
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      P.add(tent, tone(0xf6c63a, c.rand, 0.06), place(top, new THREE.Vector3(Math.cos(a), 0.7, Math.sin(a)).add(lean).normalize()));
    }
  }
  tent.dispose();
  P.into(g, { roughness: 0.6 });
}

export const REEF_BUILDERS = { montipora, porites, pocillopora, turbinaria, fungia, tubastraea };
