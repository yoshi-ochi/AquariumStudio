import * as THREE from 'three';
import { anchor, bake, bulb, cube, live, part, person, prism, railings, rod, tube } from './surveyKit.js';
import { FORMS, GLASS, crane, hull, lifeboat, mast, smooth, tier, winch, windows } from './surveyShipParts.js';

/** 合同調査の船：海洋調査船と砕氷船（部品は surveyShipParts.js） */

/** 海洋調査船（全長36）。船尾にAフレームとウインチ、右舷にCTDのガントリー */
function research() {
  const f = FORMS.research;
  const g = new THREE.Group();
  const { half } = hull(g, f);
  const D = f.D;
  const F = D + f.fc; // 船首楼甲板
  const wins = [];
  const rails = railings();
  // 居住区とブリッジ
  tier(g, wins, -3.6, 0.4, D, F - D + 1.7, 6.2, f.house, 4);
  tier(g, wins, 0, 11.2, F, 1.7, 6.5, f.house, 9);
  tier(g, wins, -2.6, 9.6, F + 1.7, 1.6, 5.8, f.house, 10);
  const BY = F + 3.3;
  prism(g, [[3.4, BY], [9, BY], [9.4, BY + 1.75], [3.4, BY + 1.75]], 7, f.house);
  cube(g, 5.9, 0.6, 7.06, GLASS, 6.45, BY + 1.05, 0); // ブリッジの窓
  cube(g, 0.1, 0.6, 6.2, GLASS, 9.28, BY + 1.05, 0);
  cube(g, 6.6, 0.1, 7.4, 0xd9dedc, 6.4, BY + 1.8, 0);
  rails.add([[-2.5, F + 3.3, 2.8], [3.3, F + 3.3, 2.8]]);
  rails.add([[-2.5, F + 3.3, -2.8], [3.3, F + 3.3, -2.8]]);
  rails.add([[3.5, BY + 1.85, 3.6], [9.3, BY + 1.85, 3.6], [9.3, BY + 1.85, -3.6], [3.5, BY + 1.85, -3.6], [3.5, BY + 1.85, 3.6]]);
  rails.add([[11.3, F, 3], [16.2, F + 0.2, half(0.95) * 0.9]]);
  rails.add([[11.3, F, -3], [16.2, F + 0.2, -half(0.95) * 0.9]]);
  const radar = mast(g, 5, BY + 1.8, 4.2);
  for (const z of [-2, 2]) part(g, new THREE.SphereGeometry(0.55, 10, 8), 0xf7f8f6, 7.6, BY + 2.5, z); // 衛星通信のドーム
  for (const z of [-2, 2]) tube(g, 0.2, 0.5, 0xe9ebe8, 7.6, BY + 2, z);
  // 煙突
  prism(g, [[-2.2, F + 3.3], [0.5, F + 3.3], [0.1, F + 5.6], [-2.5, F + 5.6]], 2, 0x1f5fa8);
  prism(g, [[-2.5, F + 5.6], [0.1, F + 5.6], [0.03, F + 6], [-2.56, F + 6]], 2.04, 0x22272b);
  cube(g, 2.5, 0.28, 2.04, 0xf4f5f2, -1.15, F + 4.7, 0);
  lifeboat(g, 1.6, F + 1.7, 3.6);
  lifeboat(g, 1.6, F + 1.7, -3.6);
  // 船首楼：揚錨機・ハッチ・旗竿
  cube(g, 1.5, 0.7, 2.4, 0x3b4248, 13.6, F + 0.4, 0);
  for (const z of [-0.9, 0.9]) tube(g, 0.4, 0.7, 0x2b3035, 13.6, F + 0.85, z, 'z', 10);
  cube(g, 1.6, 0.3, 1.6, 0x5e7f72, 11.9, F + 0.15, 0);
  rod(g, [18.6, F + 0.6, 0], [18.9, F + 2.6, 0], 0.035, 0xf1f3f2, 4);
  // 作業甲板：ウインチ・コンテナ研究室・ボラード
  winch(g, -8.4, D, 0);
  winch(g, -5.4, D, 1.9, 0.36, 0.9);
  cube(g, 4, 1.6, 1.7, 0x2f73a8, -9.6, D + 0.8, -2.6);
  cube(g, 4.04, 0.1, 1.74, 0xe9ebe8, -9.6, D + 1.62, -2.6);
  cube(g, 2.4, 1.5, 1.6, 0xf4f5f2, -12.9, D + 0.75, -2.6);
  for (const [x, z] of [[-17, 2.6], [-17, -2.6], [-11, 3.2], [-4.4, -3.3]]) tube(g, 0.14, 0.42, 0x2b3035, x, D + 0.21, z);
  // 右舷のCTDガントリー（腕を舷外へ張り出す）
  const gx = -5.4;
  rod(g, [gx - 0.5, D, 3.3], [gx - 0.5, D + 3.1, 3.5], 0.11, 0xe8b21e);
  rod(g, [gx + 0.5, D, 3.3], [gx + 0.5, D + 3.1, 3.5], 0.11, 0xe8b21e);
  rod(g, [gx - 0.5, D + 3.1, 3.5], [gx, D + 3.4, 5.5], 0.1, 0xe8b21e);
  rod(g, [gx + 0.5, D + 3.1, 3.5], [gx, D + 3.4, 5.5], 0.1, 0xe8b21e);
  tube(g, 0.2, 0.16, 0x30363c, gx, D + 3.3, 5.5, 'x', 8);
  // 人
  person(g, -4.2, D, 2.6, 0xe8622c);
  person(g, -6.6, D, 2.9, 0xf0c22c);
  person(g, -12.6, D, 1.6, 0xe8622c);
  person(g, -14.6, D, -1.9, 0x2f73a8, 0xf0c22c);
  person(g, 7.4, BY + 1.85, 3.1, 0x27323c, 0xf4f4f0);
  rails.build(g);
  // 船尾のAフレーム（swing で舷外へ倒す）
  const aframe = live(g, -16.9, D, 0);
  for (const s of [-1, 1]) {
    rod(aframe, [0, 0, s * 2.9], [0, 5.4, s * 2.3], 0.17, 0xe8b21e, 6);
    cube(aframe, 0.6, 0.5, 0.5, 0x3b4248, 0, 0.25, s * 2.9);
  }
  rod(aframe, [0, 5.4, -2.5], [0, 5.4, 2.5], 0.19, 0xe8b21e, 6);
  tube(aframe, 0.3, 0.2, 0x30363c, 0, 5, 0, 'z', 10);
  const block = anchor(aframe, 0, 4.72, 0);
  bake(aframe);
  bake(g);
  const lit = windows(g, wins);
  bulb(g, 6.4, BY + 1.5, 3.56, 0x2fd46a, 0.1);
  bulb(g, 6.4, BY + 1.5, -3.56, 0xe5412d, 0.1);
  const ctd = anchor(g, gx, D + 3.1, 5.5);
  const drum = anchor(g, -8.4, D + 1.4, 0);
  const flood = new THREE.PointLight(0xffe6b0, 0, 26, 1.4);
  flood.position.set(-10, D + 7, 0);
  g.add(flood);
  return { g, radar, lit, flood, aframe, block, ctd, drum, deck: D, len: f.L, beam: f.B / 2 };
}

/** ヘリコプター（ヘリ甲板に駐機） */
function helicopter(g, x, y, z) {
  part(g, new THREE.CapsuleGeometry(0.62, 1.5, 3, 8).rotateZ(Math.PI / 2), 0xd4302a, x, y + 0.95, z);
  part(g, new THREE.SphereGeometry(0.56, 8, 6), GLASS, x + 0.95, y + 1, z);
  rod(g, [x - 1, y + 1.1, z], [x - 3.6, y + 1.5, z], 0.12, 0xd4302a, 6);
  cube(g, 0.5, 0.9, 0.06, 0xf4f4f0, x - 3.7, y + 1.85, z);
  tube(g, 0.1, 0.4, 0x30363c, x, y + 1.75, z);
  for (const a of [0.3, 0.3 + Math.PI / 2]) part(g, new THREE.BoxGeometry(5.6, 0.04, 0.2).rotateY(a), 0x30363c, x, y + 1.97, z);
  for (const s of [-1, 1]) {
    rod(g, [x - 1, y + 0.06, z + s * 0.7], [x + 1.1, y + 0.06, z + s * 0.7], 0.05, 0x30363c, 4);
    rod(g, [x, y + 0.06, z + s * 0.7], [x, y + 0.5, z + s * 0.4], 0.04, 0x30363c, 4);
  }
}

/** 砕氷船（全長44）。丸く傾いた船首で氷に乗り上げる。船尾にヘリ甲板、右舷に吊り上げ用のクレーン */
function icebreaker() {
  const f = FORMS.icebreaker;
  const g = new THREE.Group();
  const { half } = hull(g, f);
  const D = f.D;
  const F = D + f.fc;
  const wins = [];
  const rails = railings();
  // ヘリ甲板と格納庫
  const H = D + 1.9;
  cube(g, 11, 1.9, 8.4, f.house, -15.4, D + 0.95, 0);
  cube(g, 11.6, 0.14, 9.4, 0x3f6a58, -15.4, H + 0.07, 0);
  part(g, new THREE.RingGeometry(2.5, 2.8, 28).rotateX(-Math.PI / 2), 0xf7f8f6, -15.8, H + 0.16, 0);
  for (const dz of [-0.7, 0.7]) cube(g, 1.8, 0.02, 0.26, 0xf7f8f6, -15.8, H + 0.16, dz);
  cube(g, 0.26, 0.02, 1.4, 0xf7f8f6, -15.8, H + 0.16, 0);
  helicopter(g, -15.6, H + 0.14, 0);
  tier(g, wins, -9.8, -3.4, D, 4.6, 8.2, f.house, 0);
  cube(g, 0.1, 2.6, 5, 0xc9c2ad, -9.84, H + 1.5, 0); // 格納庫の扉
  // 居住区とブリッジ（船幅いっぱいのウイング）
  tier(g, wins, -3.6, 12.4, F, 1.8, 9, f.house, 12);
  tier(g, wins, -3, 11.4, F + 1.8, 1.7, 8.4, f.house, 11);
  tier(g, wins, -0.4, 10.4, F + 3.5, 1.6, 7.6, f.house, 8);
  const BY = F + 5.1;
  prism(g, [[3.6, BY], [10.2, BY], [10.7, BY + 1.85], [3.6, BY + 1.85]], 10.6, f.house);
  cube(g, 6.9, 0.64, 10.66, GLASS, 7.2, BY + 1.1, 0);
  cube(g, 0.1, 0.64, 9.6, GLASS, 10.55, BY + 1.1, 0);
  cube(g, 7.8, 0.1, 11, 0xd9dedc, 7.1, BY + 1.9, 0);
  rails.add([[3.7, BY + 1.95, 5.3], [10.5, BY + 1.95, 5.3], [10.5, BY + 1.95, -5.3], [3.7, BY + 1.95, -5.3], [3.7, BY + 1.95, 5.3]]);
  rails.add([[-21, H + 0.14, 4.7], [-9.9, H + 0.14, 4.7]], 0.4);
  rails.add([[-21, H + 0.14, -4.7], [-9.9, H + 0.14, -4.7]], 0.4);
  rails.add([[-21, H + 0.14, -4.7], [-21, H + 0.14, 4.7]], 0.4);
  rails.add([[12.6, F, 4.2], [19.6, F + 0.25, half(0.95) * 0.9]]);
  rails.add([[12.6, F, -4.2], [19.6, F + 0.25, -half(0.95) * 0.9]]);
  const radar = mast(g, 5.4, BY + 1.9, 5.4);
  part(g, new THREE.SphereGeometry(0.8, 10, 8), 0xf7f8f6, 8.4, BY + 2.9, 0);
  tube(g, 0.3, 0.6, 0xe9ebe8, 8.4, BY + 2.2, 0);
  tube(g, 0.12, 3.4, 0xf1f3f2, -8, D + 4.6 + 1.7, 0, 'y', 6, 0.07); // 後部マスト
  // 煙突
  prism(g, [[-3.2, F + 3.5], [-0.4, F + 3.5], [-0.8, F + 6.9], [-3.5, F + 6.9]], 3, f.hull);
  prism(g, [[-3.5, F + 6.9], [-0.8, F + 6.9], [-0.86, F + 7.4], [-3.56, F + 7.4]], 3.04, 0x22272b);
  lifeboat(g, 1.4, F + 1.8, 5.1);
  lifeboat(g, 1.4, F + 1.8, -5.1);
  lifeboat(g, 5.6, F + 1.8, 5.1);
  lifeboat(g, 5.6, F + 1.8, -5.1);
  // 船首楼：ハッチ・揚錨機・船首のクレーン
  cube(g, 3, 0.4, 3.4, 0x8a5343, 14.6, F + 0.2, 0);
  cube(g, 1.7, 0.8, 3, 0x3b4248, 18.4, F + 0.6, 0);
  const bowCrane = crane(g, 16.6, F, 0, 5.4);
  bowCrane.aim(-4.6, 0.4);
  rod(g, [23.4, F + 0.7, 0], [23.9, F + 2.8, 0], 0.04, 0xf1f3f2, 4);
  // 船上の水槽（冷たい海水を張って生き物を運ぶ）
  const tank = [-12.6, H + 0.14, 2.9];
  cube(g, 5.2, 0.12, 1.9, 0x2f73a8, tank[0], tank[1] + 0.06, tank[2]);
  for (const dz of [-0.95, 0.95]) cube(g, 5.2, 1.1, 0.12, 0x2f73a8, tank[0], tank[1] + 0.55, tank[2] + dz);
  for (const dx of [-2.6, 2.6]) cube(g, 0.12, 1.1, 1.9, 0x2f73a8, tank[0] + dx, tank[1] + 0.55, tank[2]);
  cube(g, 5, 0.06, 1.7, 0x6fc3d8, tank[0], tank[1] + 0.86, tank[2]);
  // 人
  person(g, -19.6, H + 0.14, 3.6, 0xe8622c);
  person(g, -11, H + 0.14, -3.4, 0xf0c22c);
  person(g, 7.6, BY + 1.95, 4.6, 0x27323c);
  person(g, 15.4, F, 2.6, 0xe8622c);
  rails.build(g);
  // 吊り上げ用のクレーン（右舷・ヘリ甲板の前）
  const lift = crane(g, -8.8, D + 4.6, 3.3, 12.4);
  bake(g);
  const lit = windows(g, wins);
  bulb(g, 7, BY + 1.6, 5.36, 0x2fd46a, 0.11);
  bulb(g, 7, BY + 1.6, -5.36, 0xe5412d, 0.11);
  const flood = new THREE.PointLight(0xffe6b0, 0, 30, 1.4);
  flood.position.set(-12, H + 6, 4);
  g.add(flood);
  return { g, radar, lit, flood, lift, tank, deck: D, len: f.L, beam: f.B / 2 };
}

const DARK = new THREE.Color(GLASS);
const WARM = new THREE.Color(0xffd98a);

/**
 * 船を作って舞台に置く。舞台の波に合わせて揺れ、走ると航跡を引く（fishingStage.js の boats）。
 * 返り値の root を動かす。night(k) で窓と甲板の灯りをともし、spin(t) でレーダーを回す。
 */
export function buildShip(stage, kind) {
  const ship = kind === 'icebreaker' ? icebreaker() : research();
  const root = new THREE.Group();
  root.add(ship.g);
  root.userData = { len: ship.len, beam: ship.beam };
  root.place = (x, z = 0, yaw = 0) => {
    root.position.x = x;
    root.position.z = z;
    root.rotation.y = yaw;
  };
  stage.group.add(root);
  stage.boats.push(root);
  ship.root = root;
  ship.night = (k) => {
    const on = smooth(0.35, 0.7, k);
    ship.lit.material.color.copy(DARK).lerp(WARM, on);
    ship.flood.intensity = on * 60;
  };
  ship.spin = (t) => (ship.radar.rotation.y = t * 2.2);
  return ship;
}
