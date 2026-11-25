import { Unit, V, at, rgb, mix, stick, tube, disc, bead } from './floraKit.js';

/**
 * 面に広げる硬いサンゴの1個体（被覆・群生）。ブラシでなぞった岩・壁の面に、この形を向きを変えて繰り返す。
 *   キクメイシ … こんもりした塊に丸い個体（莢）が並ぶ。岩を覆って広がる
 *   ウスカミサンゴ … 面から張り出す薄い板。壁では棚のように重なる
 *   イボヤギ … 橙色の筒が寄り集まり、黄色い触手を開く。光合成しないので岩陰・壁に付く
 *   クサビライシ … 固着しない円盤形の単体サンゴ。砂の上に散らばる
 *   ナガレハナサンゴ … 骨格の上に、先の淡い触手がふさふさと流れになびく
 */
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export function kikumeishi(S, lv, r, pal) {
  const u = new Unit();
  const wall = rgb([0xb8a070, 0x9aa888, 0xa89088][pal]);
  const pit = rgb([0x4a7a48, 0x3a6a70, 0x7a4a58][pal]);
  // こんもりした塊の上に、丸い個体（莢）が並ぶ
  u.add(disc(0.04, 8, 2, (t) => 0.02 * (1 - t * t)), wall);
  const cup = disc(0.0085, 6, 1, (t) => (t < 0.5 ? -0.002 : 0.001), { inner: 0.05 });
  for (let k = 0; k < 7; k++) {
    const d = k === 0 ? 0 : 0.022;
    const a = k * (TAU / 6);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const t = d / 0.04;
    u.add(cup, (i, p, v) => (Math.hypot(v.x - x, v.z - z) < 0.005 ? pit : wall), at([x, 0.02 * (1 - t * t) + 0.0015, z], V(x * 8, 1, z * 8)));
  }
  return u;
}

export function usukami(S, lv, r, pal) {
  const u = new Unit();
  const c0 = rgb([0x7a5a3a, 0x5a6a4a, 0x7a4a5a][pal]);
  const c1 = rgb([0xe0c890, 0xc8dca0, 0xe8b8c8][pal]);
  // 面から張り出す薄い半円の板を2〜3枚ずらして重ねる（壁では棚のようになる）
  for (let k = 0; k < 3; k++) {
    const pr = 0.045 - k * 0.008;
    const plate = disc(pr, 7, 2, (t, a) => t * t * 0.012 + Math.sin(a * 4 + k) * 0.003 * t, { arc: Math.PI * 1.15, inner: 0.05 });
    u.add(plate, (i, p, v) => mix(c0, c1, clamp(Math.hypot(v.x, v.z) / pr) ** 2), at([(r() - 0.5) * 0.012, 0.004 + k * 0.011, (r() - 0.5) * 0.012], [0.1, k * 2.3 + r(), 0]));
    plate.dispose();
  }
  return u;
}

export function tubastraea(S, lv, r, pal) {
  const u = new Unit();
  const cupC = rgb([0xe0602a, 0xd84828, 0x3a3a3a][pal]);
  const tentC = rgb([0xf8c838, 0xf6a030, 0x7a9a3a][pal]);
  for (let k = 0; k < 4; k++) {
    const a = k * 1.7 + r();
    const d = k === 0 ? 0 : 0.011;
    const h = 0.012 + r() * 0.014;
    const dir = V(Math.cos(a) * d * 22, 1, Math.sin(a) * d * 22);
    const base = V(Math.cos(a) * d, 0, Math.sin(a) * d);
    u.add(stick(0.0058, 0.0066, h, 6), cupC, at(base, dir));
    // 触手の冠（開いた花のような円錐）
    const top = base.clone().addScaledVector(dir.clone().normalize(), h);
    u.add(disc(0.012, 8, 1, (t) => t * 0.007, { inner: 0.3 }), (i, p, v) => tentC, at(top, dir), 0.0015);
  }
  return u;
}

export function fungia(S, lv, r, pal) {
  const u = new Unit();
  const R = 0.05;
  const c0 = rgb([0xb09060, 0x6e8a5a, 0x9a6a8a][pal]);
  const c1 = mix(c0, [1, 1, 1], 0.35);
  const mouth = mix(c0, [0, 0, 0], 0.5);
  // 楕円の円盤。中央が盛り上がり、口から縁へ隔壁が放射状に走る
  u.add(disc(R, 20, 2, (t) => R * 0.32 * (1 - t * t) + 0.003, { inner: 0.08, oval: 0.74 }), (i, p, v) => {
    const t = Math.hypot(v.x, v.z / 0.74) / R;
    if (t < 0.12) return mouth;
    return Math.round((Math.atan2(v.z, v.x) / TAU) * 20) % 2 ? c0 : c1;
  });
  return u;
}

export function euphyllia(S, lv, r, pal) {
  const u = new Unit();
  const skel = rgb(0xd8d2c0);
  const tent = rgb([0x5fb07a, 0xb09a6a, 0x7a9ac0][pal]);
  const tipC = rgb([0xf4ecb0, 0xf0d0e0, 0xe8f4f8][pal]);
  u.add(stick(0.012, 0.015, 0.02, 6), skel);
  const tip = bead();
  for (let k = 0; k < 10; k++) {
    const a = k * 2.4;
    const d = 0.011 * Math.sqrt((k + 0.5) / 10);
    const out = V(Math.cos(a), 0, Math.sin(a));
    const p0 = V(out.x * d, 0.02, out.z * d);
    const len = 0.03 + r() * 0.02;
    const p1 = p0.clone().add(V(out.x * len * 0.35, len * 0.55, out.z * len * 0.35));
    const p2 = p1.clone().add(V(out.x * len * 0.45, len * 0.4, out.z * len * 0.45));
    const sw = (v) => 0.016 * clamp((v.y - 0.02) / 0.05) ** 1.3;
    u.add(tube([p0, p1, p2], 0.0034, 3), tent, null, sw);
    u.add(tip, tipC, at(p2, V(0, 1, 0), 0.0052), sw);
  }
  return u;
}
