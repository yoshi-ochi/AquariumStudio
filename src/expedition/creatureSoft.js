import * as THREE from 'three';
import { leafSlug } from './creatureSlug.js';

/** 魚以外の体形（カニ・エビ・タコ・ヒラメ・タツノオトシゴ・チンアナゴ）。全長1に正規化 */
const at = (x, y, z, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));

/** a から b へ伸びる細い円柱 */
function rod(solid, r0, r1, a, b, hex) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const d = B.clone().sub(A);
  const len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  const m = new THREE.Matrix4().compose(A.clone().lerp(B, 0.5), q, new THREE.Vector3(1, 1, 1));
  return solid(new THREE.CylinderGeometry(r1, r0, len, 6, 1), hex, m);
}

function eyes(solid, x, y, z, r) {
  return [-1, 1].map((s) => solid(new THREE.SphereGeometry(r, 7, 5), 0x0c1014, at(x, y, s * z)));
}

function crab(c, { solid }) {
  const { body, belly, fin } = c.colors;
  const parts = [solid(new THREE.SphereGeometry(0.2, 14, 8).scale(1, 0.5, 1.15), body, at(0, 0.18, 0)), solid(new THREE.SphereGeometry(0.17, 10, 6).scale(1, 0.3, 1.1), belly, at(0, 0.12, 0))];
  for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const x = 0.1 - k * 0.08;
      const reach = c.longLegs ? 0.62 : 0.34;
      const knee = [x - 0.05, 0.3, s * (0.2 + reach * 0.55)];
      const foot = [x - 0.12, 0, s * (0.2 + reach)];
      parts.push(rod(solid, 0.022, 0.018, [x, 0.17, s * 0.17], knee, fin), rod(solid, 0.018, 0.006, knee, foot, fin));
    }
    const elbow = [0.3, 0.22, s * 0.24];
    parts.push(rod(solid, 0.03, 0.03, [0.13, 0.17, s * 0.14], elbow, body));
    parts.push(solid(new THREE.SphereGeometry(0.075, 8, 6).scale(1.5, 0.8, 0.8), belly, at(0.4, 0.22, s * 0.24)));
  }
  parts.push(...eyes(solid, 0.19, 0.25, 0.06, 0.018));
  return parts;
}

function lobster(c, { grid, fin: finSheet, solid }) {
  const { body, belly, fin } = c.colors;
  const parts = [grid(10, 16, (u, v) => {
    const a = u * Math.PI * 2;
    const r = 0.1 * (1 - v * 0.55) * Math.min(1, v * 7 + 0.3);
    const ring = Math.floor(v * 8) % 2 === 0;
    return [0.32 - v * 0.72, 0.1 + Math.cos(a) * r * 0.8, Math.sin(a) * r, Math.cos(a) < -0.3 ? belly : ring ? body : fin];
  })];
  for (const s of [-1, 1]) {
    parts.push(finSheet((u) => [-0.4, 0.09, s * u * 0.05], (u) => [-0.54, 0.08, s * (0.03 + u * 0.13)], fin, 5));
    parts.push(rod(solid, 0.012, 0.003, [0.3, 0.14, s * 0.05], [0.72, 0.3, s * 0.42], fin));
    for (let k = 0; k < 4; k++) {
      const x = 0.2 - k * 0.09;
      parts.push(rod(solid, 0.014, 0.006, [x, 0.06, s * 0.08], [x + 0.02, 0, s * 0.27], fin));
    }
  }
  parts.push(...eyes(solid, 0.3, 0.17, 0.05, 0.022));
  return parts;
}

function octopus(c, { grid, solid }) {
  const { body, belly, fin } = c.colors;
  const parts = [solid(new THREE.SphereGeometry(0.17, 14, 10).scale(1.1, 1.3, 1), body, at(-0.04, 0.28, 0))];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.3;
    parts.push(grid(5, 10, (u, v) => {
      const r = 0.1 + v * 0.42;
      const ang = a + Math.sin(v * 5 + k) * 0.28;
      const w = 0.042 * (1 - v * 0.9);
      const t = u * Math.PI * 2;
      return [Math.cos(ang) * r + Math.cos(t) * w, 0.14 - v * 0.1 + Math.sin(v * 8 + k) * 0.02 + Math.sin(t) * w, Math.sin(ang) * r + Math.sin(t) * w, Math.sin(t) < 0 ? belly : fin];
    }));
  }
  // イイダコ：腕の付け根の両側に金色の輪（眼状紋）
  if (c.ocelli) for (const s of [-1, 1]) parts.push(solid(new THREE.TorusGeometry(0.03, 0.01, 5, 12), c.ocelli, at(0.15, 0.165, s * 0.15, Math.PI / 2 - s * 0.6)));
  parts.push(...eyes(solid, 0.1, 0.3, 0.09, 0.03));
  return parts;
}

function flat(c, { grid, solid }) {
  const { body, belly, fin } = c.colors;
  const outline = (v) => 0.3 * Math.pow(Math.sin(Math.min(1, v) * Math.PI), 0.65) * (1 - v * 0.3);
  const parts = [];
  for (const side of [1, -1]) {
    parts.push(grid(12, 16, (u, v) => {
      const z = (u * 2 - 1) * outline(v);
      const spot = side > 0 && Math.sin(v * 31 + u * 17) * Math.cos(u * 23) > 0.55;
      return [0.5 - v, 0.05 + side * 0.035 * (1 - (z / 0.3) ** 2), z, side > 0 ? (spot ? fin : body) : belly];
    }));
  }
  parts.push(solid(new THREE.SphereGeometry(0.03, 8, 6), 0x0c1014, at(0.32, 0.1, 0.07)), solid(new THREE.SphereGeometry(0.03, 8, 6), 0x0c1014, at(0.25, 0.1, -0.02)));
  return parts;
}

function seahorse(c, { grid, fin: finSheet, solid }) {
  const { body, belly, fin } = c.colors;
  const spine = (v) => {
    const a = v * Math.PI * 1.45;
    return v < 0.62 ? [0.04 + Math.sin(v * 5) * 0.1, 0.42 - v * 1.0, 0] : [0.16 + Math.cos(a * 2.6) * 0.1, -0.2 + Math.sin(a * 2.6) * 0.1, 0];
  };
  const parts = [grid(8, 28, (u, v) => {
    const [x, y] = spine(v);
    const r = 0.09 * (1 - v * 0.85) * Math.min(1, v * 7 + 0.5);
    const a = u * Math.PI * 2;
    return [x + Math.cos(a) * r, y, Math.sin(a) * r, Math.floor(v * 16) % 2 ? body : belly];
  })];
  parts.push(rod(solid, 0.045, 0.022, [0.05, 0.42, 0], [0.26, 0.38, 0], body));
  parts.push(finSheet((u) => [-0.06, 0.2 - u * 0.15, 0], (u) => [-0.17, 0.2 - u * 0.15, 0], fin, 5));
  parts.push(...eyes(solid, 0.09, 0.44, 0.05, 0.02));
  return parts;
}

/** チンアナゴ：砂から体を出して揺れる */
function garden(c, { grid, solid }) {
  const { body, belly, fin } = c.colors;
  const parts = [grid(8, c.ringBands ? 45 : 20, (u, v) => {
    const a = u * Math.PI * 2;
    const r = 0.035;
    const lean = Math.sin(v * 2.4) * 0.14;
    // ringBands：ニシキアナゴのように体を一周する帯。それ以外はチンアナゴの片側の斑
    const spot = c.ringBands ? Math.floor(v * 33) % 3 === 0 && v < 0.93 : Math.floor(v * 14) % 3 === 0 && Math.cos(a) > 0;
    return [lean + Math.cos(a) * r, v * 0.8, Math.sin(a) * r, spot ? fin : !c.ringBands && Math.cos(a) < -0.2 ? belly : body];
  })];
  parts.push(solid(new THREE.SphereGeometry(0.045, 8, 6).scale(1.3, 1, 1), body, at(Math.sin(2.4) * 0.14 + 0.02, 0.82, 0)));
  parts.push(...eyes(solid, Math.sin(2.4) * 0.14 + 0.06, 0.84, 0.03, 0.013));
  return parts;
}

/**
 * コウイカ：楕円の外套膜とそれを縁どるひれ、背中の細かな縞、8本の腕と2本の長い触腕。
 * 参考画像（上から見た標本）の比率：外套長に対して幅0.73、腕は外套長の半分ほど
 */
function cuttle(c, { grid, solid }) {
  const { body, belly, fin } = c.colors;
  const stripe = c.mark ?? body;
  const L = 0.46; // 外套膜の長さ（x: 0.5 → 0.04）
  // 盾形：頭側は幅広く平ら、尾側は丸くすぼまる
  const half = (v) => 0.17 * Math.pow(Math.max(0, 1 - Math.abs(2 * v - 1) ** 3), 0.45) * (0.82 + 0.18 * v);
  const parts = [grid(16, 14, (u, v) => {
    const a = u * Math.PI * 2;
    const r = half(v);
    const x = 0.5 - v * L;
    const z = Math.sin(a) * r;
    const top = Math.cos(a) > -0.1;
    const zebra = Math.floor(x * 46 + Math.abs(z) * 18) % 2 === 0;
    return [x, Math.cos(a) * r * 0.42, z, top ? (zebra ? stripe : body) : belly];
  })];
  // 外套膜のまわりのひれ（左右）
  for (const s of [-1, 1]) {
    parts.push(grid(2, 14, (u, v) => [0.5 - v * L, 0, s * (half(v) + 0.004 + u * 0.035 * Math.sin(Math.PI * Math.min(1, v * 1.1))), fin]));
  }
  parts.push(solid(new THREE.SphereGeometry(0.075, 10, 7).scale(1, 0.75, 1.05), body, at(0.01, 0, 0)));
  parts.push(...eyes(solid, 0.01, 0.035, 0.068, 0.022));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const len = i % 5 === 0 ? 0.48 : 0.28; // 2本の触腕は長い
    const r0 = 0.05;
    // 腕は扇のように広がる
    const tip = [-0.04 - len * 0.85, Math.cos(a) * 0.07, Math.sin(a) * (i % 5 === 0 ? 0.28 : 0.2)];
    parts.push(rod(solid, i % 5 === 0 ? 0.012 : 0.024, 0.005, [-0.04, Math.cos(a) * r0 * 0.6, Math.sin(a) * r0], tip, i % 5 === 0 ? belly : body));
  }
  return parts;
}

/**
 * カブトガニ：馬蹄形の頭胸甲（両脇が後ろへ伸びる）、縁に棘が並ぶ六角形の腹甲、長い剣状の尾。
 * 参考画像（上から見た標本）の比率：全長に対して頭胸甲の長さ0.38・幅0.45、腹甲0.25、尾0.52
 */
function horseshoe(c, { grid, solid }) {
  const { body, belly, fin } = c.colors;
  const ridge = c.mark ?? belly;
  // 頭胸甲：前は半円、両脇は後ろへ角のように伸びる。中央の隆起と左右の隆起線
  const parts = [grid(28, 6, (u, v) => {
    const a = u * Math.PI * 2;
    const r = v;
    // 前は半円、後ろは中央がくぼみ両脇が角のように後ろへ伸びる
    const back = Math.cos(a) < 0 ? -Math.cos(a) * Math.abs(Math.sin(a)) * 0.62 - 0.02 : 0;
    const x = 0.2 + (Math.cos(a) >= 0 ? Math.cos(a) * 0.2 : -back) * r;
    const z = Math.sin(a) * 0.225 * r;
    const y = 0.07 * (1 - r * r) + 0.004;
    const onRidge = Math.abs(z) < 0.015 || Math.abs(Math.abs(z) - 0.08) < 0.012;
    return [x, y, z, onRidge && r < 0.85 ? ridge : body];
  })];
  // 腹甲：六角形のふくらみと、縁に並ぶ棘
  parts.push(solid(new THREE.SphereGeometry(0.15, 6, 5).scale(1, 0.32, 1.05), body, at(0.02, 0.025, 0)));
  parts.push(solid(new THREE.BoxGeometry(0.22, 0.01, 0.012), ridge, at(0.02, 0.072, 0)));
  for (const s of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      const x = 0.1 - k * 0.035;
      const zz = 0.15 - k * 0.014;
      parts.push(rod(solid, 0.006, 0.001, [x, 0.02, s * zz], [x - 0.03, 0.01, s * (zz + 0.035)], fin));
    }
  }
  // 剣状の尾
  parts.push(rod(solid, 0.014, 0.003, [-0.12, 0.02, 0], [-0.68, 0.005, 0], fin));
  // 複眼と、腹側の脚
  for (const s of [-1, 1]) parts.push(solid(new THREE.SphereGeometry(0.012, 6, 4).scale(1.6, 0.6, 1), 0x2a2018, at(0.2, 0.06, s * 0.12)));
  for (const s of [-1, 1]) for (let k = 0; k < 5; k++) parts.push(rod(solid, 0.008, 0.004, [0.2 - k * 0.04, 0.005, s * 0.04], [0.18 - k * 0.04, -0.02, s * 0.12], belly));
  return parts;
}

const BUILDERS = { crab, lobster, octopus, flat, seahorse, garden, cuttle, horseshoe, leafslug: leafSlug };

/** 該当する体形なら { parts, mode } を返す（mode 3 = 体をくねらせない） */
export function extraSoftParts(c, helpers) {
  const build = BUILDERS[c.form];
  return build ? { parts: build(c, helpers), mode: 3 } : null;
}

/** 水槽の底付近で暮らす体形 */
export const BENTHIC_FORMS = new Set(['crab', 'lobster', 'octopus', 'flat', 'garden', 'horseshoe', 'leafslug']);
/** その場からあまり動かない体形 */
export const STATIONARY_FORMS = new Set(['seahorse', 'garden']);
