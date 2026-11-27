import * as THREE from 'three';
import { clamp01, lerp } from './gearKit.js';
import { anchor, bake, bulb, cube, live, part, rod, skin, transom, tube } from './surveyKit.js';

/** 合同調査の船の部品：船体・上部構造・窓・マスト・クレーン・救命艇・ウインチ。船首は +X、右舷は +Z、喫水線は y=0（1 ≒ 1.35m） */

export const smooth = (a, b, x) => {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const US = [0, 0.03, 0.08, 0.16, 0.24, 0.32, 0.4, 0.5, 0.6, 0.66, 0.72, 0.78, 0.83, 0.88, 0.92, 0.95, 0.975, 0.99, 1];
const BULWARK = 0.55;
export const GLASS = 0x18262f;

// L 全長・B 幅・D 甲板の高さ・T 喫水・fc 船首楼の高さ（fcAt から前）・rake 船首の傾き・foot 船首の船底が上がり始める位置
export const FORMS = {
  research: { L: 36, B: 7.6, D: 2.1, T: 2.2, fc: 1.7, fcAt: 0.5, rake: 1.5, foot: 0.16, fine: 2.3, flare: 0.3, hull: 0x1d3f6e, band: 0xf2f4f3, boot: 0x9a2f28, deck: 0x47695c, house: 0xf4f5f2 },
  icebreaker: { L: 44, B: 10.4, D: 3, T: 3, fc: 1.8, fcAt: 0.42, rake: 3.4, foot: 0.36, fine: 1.9, flare: 0.1, hull: 0xd6561f, band: 0xd6561f, boot: 0x5c211d, deck: 0x7d4534, house: 0xf1e7cf },
};

/** 船体：断面を船尾から船首へつないだ外板（舷の立ち上がり・船腹・船底）と、甲板・船尾の面 */
export function hull(g, f) {
  const { L, B, D, T } = f;
  const us = [...US, f.fcAt, f.fcAt + 0.012].sort((a, b) => a - b);
  const half = (u) => (B / 2) * lerp(0.84, 1, smooth(0, 0.22, u)) * Math.max(0.014, 1 - clamp01((u - 0.58) / 0.42) ** f.fine);
  const deckY = (u) => D + f.fc * smooth(f.fcAt, f.fcAt + 0.012, u) + 0.5 * clamp01((u - 0.7) / 0.3) ** 2;
  const keel = (u) => T * lerp(0.35, 1, smooth(0, 0.24, u)) * (1 - smooth(1 - f.foot, 1, u));
  const X = (u, y) => (u - 0.5) * L + f.rake * (y / D) * smooth(0.72, 1, u);
  const wl = (u) => half(u) * (1 - f.flare * smooth(0.6, 1, u)) * lerp(0.92, 1, smooth(0, 0.2, u));
  const top = (u) => deckY(u) + BULWARK;
  const strake = (u) => deckY(u) - 0.3;
  const above = (y) => (u) => {
    const yy = typeof y === 'function' ? y(u) : y;
    return [X(u, yy), yy, lerp(half(u), wl(u), (1 - yy / top(u)) ** 1.4)];
  };
  const below = (q) => (u) => {
    const a = (q * Math.PI) / 2;
    const y = -keel(u) * Math.sin(a);
    return [X(u, y), y, wl(u) * Math.cos(a) ** 0.55];
  };
  const upper = [above(top), above(strake)];
  const mid = [above(strake), above((u) => (strake(u) + 0.45) / 2), above(0.45)];
  const low = [above(0.45), above(0), below(0.35), below(0.7), below(0.92), below(1)];
  skin(g, us, upper, f.band, true);
  skin(g, us, mid, f.hull);
  skin(g, us, low, f.boot);
  transom(g, [...upper, ...mid].map((row) => row(0)), f.hull);
  transom(g, low.map((row) => row(0)), f.boot);
  skin(g, us, [(u) => [X(u, deckY(u)), deckY(u), 0], (u) => [X(u, deckY(u)), deckY(u), half(u) * 0.985]], f.deck);
  return { half, deckY, X };
}

/** 上部構造の1段。win は舷側の窓の数（窓は wins にためて、あとで1つにまとめる） */
export function tier(g, wins, x0, x1, y0, h, w, color, win = 0) {
  cube(g, x1 - x0, h, w, color, (x0 + x1) / 2, y0 + h / 2, 0);
  cube(g, x1 - x0 + 0.16, 0.07, w + 0.16, 0xd9dedc, (x0 + x1) / 2, y0 + h, 0); // 縁
  for (let i = 0; i < win; i++) wins.push([lerp(x0 + 0.55, x1 - 0.55, win > 1 ? i / (win - 1) : 0.5), y0 + h * 0.6, 0, 0.44, 0.36, w + 0.05]);
}

/** 窓をまとめて1つに描く。夜は内側の灯りがともる */
export function windows(g, wins) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: GLASS }), wins.length);
  const o = new THREE.Object3D();
  wins.forEach(([x, y, z, w, h, d], i) => {
    o.position.set(x, y, z);
    o.scale.set(w, h, d);
    o.updateMatrix();
    mesh.setMatrixAt(i, o.matrix);
  });
  g.add(mesh);
  return mesh;
}

/** マスト：レーダー（回る）・ヤード・アンテナ・航海灯 */
export function mast(g, x, y, h) {
  tube(g, 0.16, h, 0xf1f3f2, x, y + h / 2, 0, 'y', 8, 0.09);
  rod(g, [x, y + h * 0.62, -1.3], [x, y + h * 0.62, 1.3], 0.045, 0xf1f3f2);
  rod(g, [x, y + h * 0.86, -0.7], [x, y + h * 0.86, 0.7], 0.035, 0xf1f3f2);
  cube(g, 0.7, 0.08, 0.7, 0xdde2e0, x + 0.3, y + h * 0.42, 0);
  rod(g, [x, y + h, 0], [x, y + h + 1.1, 0], 0.02, 0x3a4046, 4);
  const radar = live(g, x + 0.3, y + h * 0.42 + 0.22, 0);
  cube(radar, 1.9, 0.14, 0.22, 0xf4f4f0);
  tube(radar, 0.07, 0.3, 0x6b7479, 0, -0.12, 0);
  bake(radar);
  bulb(g, x + 0.22, y + h * 0.95, 0, 0xffffff, 0.09);
  return radar;
}

/** デッキクレーン（旋回 + 起伏）。aim(dx, dz) で腕の先を台座から水平に (dx, dz) の所へ向け、先端の位置を返す */
export function crane(g, x, y, z, len, color = 0xe8b21e) {
  tube(g, 0.42, 1.9, 0xe9ebe8, x, y + 0.95, z, 'y', 10, 0.34);
  const yaw = live(g, x, y + 1.9, z);
  cube(yaw, 1.1, 0.8, 1, color, 0, 0.4, 0);
  cube(yaw, 0.7, 0.6, 0.6, GLASS, 0.1, 0.95, 0.45);
  const boom = live(yaw, 0.2, 0.7, 0);
  cube(boom, len, 0.34, 0.36, color, len / 2, 0, 0);
  cube(boom, len * 0.5, 0.2, 0.22, 0x3b4248, len * 0.28, -0.3, 0);
  tube(boom, 0.2, 0.44, 0x30363c, len, 0, 0, 'z', 8);
  const tip = anchor(boom, len, -0.2, 0);
  bake(boom);
  bake(yaw);
  const aim = (dx, dz) => {
    yaw.rotation.y = Math.atan2(-dz, dx);
    boom.rotation.z = Math.acos(clamp01((Math.hypot(dx, dz) - 0.2) / len));
    return tip.at();
  };
  aim(len * 0.5, 0);
  return { aim, tip };
}

/** 救命艇とダビット */
export function lifeboat(g, x, y, z) {
  const s = Math.sign(z);
  part(g, new THREE.CapsuleGeometry(0.45, 1.7, 3, 8).rotateZ(Math.PI / 2), 0xf07a1f, x, y + 0.55, z);
  cube(g, 1.1, 0.3, 0.6, 0xf39a3c, x, y + 0.95, z);
  for (const dx of [-1, 1]) rod(g, [x + dx, y, z - s * 0.6], [x + dx, y + 1.5, z + s * 0.05], 0.06, 0xe9ebe8);
}

/** ウインチ（ドラムと台） */
export function winch(g, x, y, z, r = 0.55, w = 1.6) {
  cube(g, r * 2.6, 0.24, w + 0.5, 0x3b4248, x, y + 0.12, z);
  tube(g, r, w, 0x2f6f9f, x, y + r + 0.3, z, 'z', 12);
  tube(g, r * 0.8, w * 0.92, 0x4a4f54, x, y + r + 0.3, z, 'z', 12);
  for (const s of [-1, 1]) tube(g, r * 1.45, 0.1, 0x2f6f9f, x, y + r + 0.3, z + (s * w) / 2, 'z', 14);
}
