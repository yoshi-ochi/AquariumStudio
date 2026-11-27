import * as THREE from 'three';
import { anchor, bake, beam, bulb, cube, live, part, rod, tube } from './surveyKit.js';

/** 合同調査の観測機器：ROV・CTD採水器・中層トロールの枠・氷上の観測点 */

const ALU = 0xb7bfc3;
const DARK = 0x23292d;

/**
 * 作業型ROV（全長2.8、前が +X）。浮力材・フレーム・スラスタ・カメラ・投光器・マニピュレータ・採集容器。
 * reach(k) で右のマニピュレータを伸ばし（先に吸引管）、lights(k) で投光器をともす。
 */
export function buildRov(group) {
  const g = new THREE.Group();
  // フレーム
  for (const z of [-0.9, 0.9]) {
    for (const y of [-0.85, 0.22]) rod(g, [-1.3, y, z], [1.3, y, z], 0.05, ALU);
    for (const x of [-1.3, 0, 1.3]) rod(g, [x, -0.85, z], [x, 0.22, z], 0.05, ALU);
  }
  for (const x of [-1.3, 1.3]) for (const y of [-0.85, 0.22]) rod(g, [x, y, -0.9], [x, y, 0.9], 0.05, ALU);
  // 浮力材（黄色）と縁どり
  cube(g, 2.8, 0.5, 1.94, 0xf3c21b, 0, 0.5, 0);
  cube(g, 2.5, 0.14, 1.64, 0xf3c21b, 0, 0.82, 0);
  cube(g, 0.34, 0.52, 1.96, 0xe8622c, 1.24, 0.5, 0);
  cube(g, 1.2, 0.02, 0.5, 0x1d3f6e, -0.2, 0.9, 0);
  // 垂直スラスタ（浮力材を貫く）と水平スラスタ（四すみ、斜め向き）
  for (const x of [-0.72, 0.72]) {
    tube(g, 0.3, 0.72, DARK, x, 0.56, 0, 'y', 12);
    cube(g, 0.5, 0.03, 0.06, ALU, x, 0.93, 0);
    cube(g, 0.06, 0.03, 0.5, ALU, x, 0.93, 0);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const t = tube(g, 0.21, 0.5, DARK, sx * 0.98, -0.3, sz * 0.7, 'x', 10);
    t.rotation.y = sx * sz * 0.7;
    const ring = tube(g, 0.24, 0.12, 0xe8622c, sx * 0.98, -0.3, sz * 0.7, 'x', 10);
    ring.rotation.y = sx * sz * 0.7;
  }
  // 耐圧容器（電子機器）
  for (const z of [-0.36, 0.36]) {
    tube(g, 0.19, 1.5, 0x8d979c, -0.3, -0.5, z, 'x', 10);
    for (const x of [-1.07, 0.47]) tube(g, 0.21, 0.06, DARK, x, -0.5, z, 'x', 10);
  }
  // カメラ（旋回台つき）・ソナー・投光器
  tube(g, 0.2, 0.34, 0xf1f3f2, 1.3, -0.02, 0, 'x', 10);
  part(g, new THREE.SphereGeometry(0.19, 10, 8), 0x0f1c24, 1.48, -0.02, 0);
  cube(g, 0.12, 0.3, 0.5, DARK, 1.18, -0.02, 0);
  tube(g, 0.13, 0.2, 0xc8402f, 0.95, 1, 0, 'y', 10);
  const lamps = [];
  for (const [y, z] of [[0.12, 0.62], [0.12, -0.62], [-0.3, 0.3], [-0.3, -0.3]]) {
    tube(g, 0.12, 0.2, DARK, 1.32, y, z, 'x', 8);
    lamps.push(bulb(g, 1.42, y, z, 0xeaf6ff, 0.085));
  }
  // 採集用の台：吸引式の採集容器（回転式に並ぶ）と保冷箱
  cube(g, 1.9, 0.08, 1.7, 0x4a5258, 0.2, -0.93, 0);
  for (let i = 0; i < 4; i++) {
    tube(g, 0.15, 0.42, 0xcfe6ea, 0.25 + (i % 2) * 0.36, -0.68, -0.25 - Math.floor(i / 2) * 0.36, 'y', 10);
    tube(g, 0.16, 0.05, DARK, 0.25 + (i % 2) * 0.36, -0.45, -0.25 - Math.floor(i / 2) * 0.36, 'y', 10);
  }
  cube(g, 0.62, 0.36, 0.5, 0xf1f3f2, -0.55, -0.7, 0.45);
  cube(g, 0.64, 0.05, 0.52, 0x2f73a8, -0.55, -0.5, 0.45);
  // 左のマニピュレータ（たたんだまま）
  rod(g, [1.25, -0.6, -0.6], [1.55, -0.3, -0.6], 0.06, DARK);
  rod(g, [1.55, -0.3, -0.6], [1.35, -0.72, -0.5], 0.05, DARK);
  // 右のマニピュレータ（肩 → ひじ → 手先）
  const shoulder = live(g, 1.25, -0.6, 0.6);
  tube(shoulder, 0.09, 0.16, 0xe8622c, 0, 0, 0, 'z', 8);
  rod(shoulder, [0, 0, 0], [0.75, 0, 0], 0.06, DARK, 6);
  const elbow = live(shoulder, 0.75, 0, 0);
  tube(elbow, 0.08, 0.14, 0xe8622c, 0, 0, 0, 'z', 8);
  rod(elbow, [0, 0, 0], [0.7, 0, 0], 0.05, DARK, 6);
  for (const s of [-1, 1]) cube(elbow, 0.22, 0.04, 0.05, ALU, 0.8, 0, s * 0.07);
  tube(elbow, 0.07, 0.34, 0xdfe7ea, 0.84, 0.1, 0, 'x', 8, 0.1); // 吸引管の口
  const nozzle = anchor(elbow, 1.02, 0.1, 0);
  bake(elbow);
  bake(shoulder);
  const tether = anchor(g, -0.85, 0.92, 0);
  const jar = anchor(g, 0.43, -0.4, -0.43);
  bake(g);
  // 投光器の光（海底を照らす1灯と、水中に見える光のすじ）
  const spot = new THREE.SpotLight(0xdcefff, 0, 46, 0.62, 0.7, 1.1);
  spot.position.set(1.4, 0.1, 0);
  spot.target.position.set(9, -3.2, 0);
  g.add(spot, spot.target);
  const ray = beam(g, 15, 4, 0xbfe2ff, 0);
  ray.position.set(1.45, 0, 0);
  ray.rotation.z = -0.3;
  ray.material.depthTest = false; // 海底のでこぼこで光のすじが欠けないようにする
  g.reach = (k) => {
    shoulder.rotation.set(0, -0.5 * k, 1.9 - 2.0 * k);
    elbow.rotation.z = -2.5 + 2.3 * k;
  };
  g.lights = (k) => {
    spot.intensity = k * 70;
    ray.material.opacity = k * 0.17;
    lamps.forEach((m) => m.material.color.setScalar(0.25 + k * 0.75));
  };
  g.reach(0);
  g.lights(0);
  Object.assign(g, { tether, nozzle, jar });
  group.add(g);
  return g;
}

/** CTD採水器（原点が吊り点）。輪に並べた採水ボトルと、中心のセンサー */
export function buildCtd(group) {
  const g = new THREE.Group();
  for (const y of [-0.55, -1.35, -2.15]) part(g, new THREE.TorusGeometry(0.72, 0.04, 5, 18).rotateX(Math.PI / 2), 0xe9ebe8, 0, y, 0);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = Math.cos(a) * 0.54;
    const z = Math.sin(a) * 0.54;
    tube(g, 0.1, 1.05, 0x8f9aa0, x, -1.3, z, 'y', 7);
    tube(g, 0.11, 0.07, 0x23292d, x, -0.76, z, 'y', 7);
    tube(g, 0.11, 0.07, 0x23292d, x, -1.84, z, 'y', 7);
    if (i % 2 === 0) rod(g, [Math.cos(a) * 0.72, -0.55, Math.sin(a) * 0.72], [Math.cos(a) * 0.72, -2.15, Math.sin(a) * 0.72], 0.035, 0xe9ebe8, 4);
  }
  tube(g, 0.2, 0.9, 0xf1f3f2, 0, -1.75, 0, 'y', 10);
  tube(g, 0.09, 0.5, 0x2f73a8, 0.2, -2.05, 0.2, 'y', 7);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    rod(g, [Math.cos(a) * 0.72, -0.55, Math.sin(a) * 0.72], [0, 0, 0], 0.03, 0x3b4248, 4);
  }
  bake(g);
  group.add(g);
  return g;
}

/** 中層トロールの枠（原点が網口の中心、+X へ曳く）。4本の手綱と、網を沈めておく潜航板 */
export function buildFrameNet(group, size = 3.2) {
  const g = new THREE.Group();
  const h = size / 2;
  for (const s of [-1, 1]) {
    rod(g, [0, s * h, -h], [0, s * h, h], 0.07, 0xdfe5e8, 6);
    rod(g, [0, -h, s * h], [0, h, s * h], 0.07, 0xdfe5e8, 6);
    for (const t of [-1, 1]) rod(g, [0, s * h, t * h], [3.4, 0.3, 0], 0.025, 0x30363c, 4);
  }
  const vane = cube(g, 1.1, 0.08, size, 0xe8622c, 0.1, -h - 0.25, 0);
  vane.rotation.z = -0.4;
  tube(g, 0.16, 0.5, 0x3b4248, 3.4, 0.3, 0, 'x', 8);
  g.tow = anchor(g, 3.65, 0.3, 0);
  bake(g);
  group.add(g);
  return g;
}

/** 氷上の観測点：三脚とウインチ・テント・そり・旗。原点が氷の穴（幅 w・奥行き d）の中心で、氷の上面 */
export function buildCamp(group, w = 4.6, d = 2) {
  const g = new THREE.Group();
  // 三脚と滑車
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    rod(g, [Math.cos(a) * 2.4, 0, Math.sin(a) * 2.4], [0, 3.3, 0], 0.07, 0xe8b21e, 5);
  }
  tube(g, 0.2, 0.14, 0x30363c, 0, 2.95, 0, 'z', 10);
  // 手巻きのウインチ
  cube(g, 0.9, 0.5, 0.8, 0x3b4248, -3.4, 0.25, 0.6);
  tube(g, 0.3, 0.7, 0x2f73a8, -3.4, 0.75, 0.6, 'z', 10);
  // 切り出した氷のブロックと、穴のふち
  for (const [x, y, z, s] of [[1.9, 0.28, -1.6, 0.8], [2.7, 0.21, -1.1, 0.6], [2, 0.74, -1.55, 0.5]]) cube(g, s, s * 0.7, s, 0xcfeaf4, x, y, z);
  for (const s of [-1, 1]) {
    cube(g, w + 0.4, 0.14, 0.2, 0xf4fbfd, 0, 0.07, s * (d / 2 + 0.1));
    cube(g, 0.2, 0.14, d, 0xf4fbfd, s * (w / 2 + 0.1), 0.07, 0);
  }
  // テント
  const tent = part(g, new THREE.ConeGeometry(1.9, 2.1, 4).rotateY(Math.PI / 4), 0xf07a1f, -5.6, 1.05, 2.6);
  tent.scale.z = 1.25;
  cube(g, 0.06, 1.1, 0.8, 0x3b2a1a, -4.25, 0.55, 2.6);
  // そりと荷物
  for (const s of [-1, 1]) cube(g, 2.6, 0.08, 0.1, 0x30363c, 4.4, 0.06, 2.4 + s * 0.5);
  cube(g, 2.3, 0.1, 1.1, 0x9a7445, 4.4, 0.18, 2.4);
  cube(g, 0.9, 0.6, 0.8, 0x2f73a8, 3.9, 0.53, 2.4);
  cube(g, 0.8, 0.45, 0.7, 0xf0c22c, 4.9, 0.45, 2.4);
  // 旗
  rod(g, [-3.2, 0, -2.4], [-3.2, 2.6, -2.4], 0.035, 0x3a3026, 4);
  cube(g, 0.8, 0.5, 0.02, 0xe5412d, -2.8, 2.3, -2.4);
  g.pulley = anchor(g, 0, 2.85, 0);
  g.winch = anchor(g, -3.4, 0.9, 0.6);
  bake(g);
  group.add(g);
  return g;
}

/** 熱水の噴き出すチムニー（海底から立つ煙突状の岩）。先端の位置（煙の出る所）を返す */
export function buildChimneys(group, x, bedY, z) {
  const g = new THREE.Group();
  const tips = [];
  for (const [dx, dz, h, r] of [[0, 0, 5.2, 1], [2.1, 1.3, 3.4, 0.75], [-1.6, 1.8, 2.3, 0.6], [1, -1.9, 1.6, 0.5]]) {
    let y = 0;
    for (let i = 0; i < 4; i++) {
      const hh = h * [0.4, 0.28, 0.2, 0.12][i];
      const m = part(g, new THREE.CylinderGeometry(r * (0.78 - i * 0.17), r * (1 - i * 0.17), hh, 7), i % 2 ? 0x5b4a3a : 0x6a5642, dx + Math.sin(i * 2.1) * 0.12, y + hh / 2, dz + Math.cos(i * 1.7) * 0.12);
      m.rotation.y = i * 0.9;
      y += hh;
    }
    tips.push([x + dx, bedY + y, z + dz]);
  }
  // ふもとの岩と、白い細菌のマット
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9;
    const m = part(g, new THREE.DodecahedronGeometry(0.7 + (i % 3) * 0.3, 0), i % 3 ? 0x4c453c : 0xb9b7a6, Math.cos(a) * (2.6 + (i % 2)), 0.2, Math.sin(a) * (2.4 + (i % 3) * 0.5));
    m.scale.y = 0.55;
  }
  bake(g);
  g.position.set(x, bedY, z);
  group.add(g);
  // チューブワーム（白い管の先に赤いえら）
  const N = 46;
  const worms = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.05, 1, 5).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0xe9e2d0, roughness: 0.8 }), N);
  const gills = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 5, 4), new THREE.MeshStandardMaterial({ color: 0xc23a2c, roughness: 0.6 }), N);
  const o = new THREE.Object3D();
  for (let i = 0; i < N; i++) {
    const a = i * 2.4;
    const d = 1.3 + ((i * 7) % 10) * 0.16;
    const h = 0.5 + ((i * 13) % 7) * 0.12;
    o.position.set(x + Math.cos(a) * d, bedY + 0.1, z + Math.sin(a) * d);
    o.rotation.set(Math.sin(i) * 0.25, 0, Math.cos(i * 1.3) * 0.25);
    o.scale.set(1, h, 1);
    o.updateMatrix();
    worms.setMatrixAt(i, o.matrix);
    o.position.y += h * Math.cos(o.rotation.x) * Math.cos(o.rotation.z);
    o.position.x -= Math.sin(o.rotation.z) * h;
    o.position.z += Math.sin(o.rotation.x) * h;
    o.scale.set(1, 1, 1);
    o.updateMatrix();
    gills.setMatrixAt(i, o.matrix);
  }
  group.add(worms, gills);
  return tips;
}
