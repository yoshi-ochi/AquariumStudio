import * as THREE from 'three';
import { CELL_SIZE, GRID_X, GRID_Z, GRID_Z0, ZONES, getZone } from './blueprint.js';

/**
 * 屋外エリアの地面と、売店・食堂の作り付けの設備。
 * 売店：商品の並ぶ棚とレジ。食堂：料理の提供口とテーブル・椅子。タップで補充・提供の画面を開く（facilities）。
 */
const wx = (i) => (i - GRID_X / 2) * CELL_SIZE;
const wz = (j) => (j - GRID_Z0) * CELL_SIZE;
// 同じ色の材質は使い回す（商品の箱が多いため）
const MATS = new Map();
const mat = (color, roughness = 0.85) => {
  const k = `${color}:${roughness}`;
  if (!MATS.has(k)) MATS.set(k, Object.assign(new THREE.MeshStandardMaterial({ color, roughness }), { userData: { shared: true } }));
  return MATS.get(k);
};
const GROUND = { marine: 0xcfd6d6 };
const GOODS = [0xe8554e, 0xf2b84b, 0x4fa3e0, 0x63c08a, 0xb57be0, 0xf08cb0];

function mesh(group, geo, material, x, y, z) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  group.add(m);
  return m;
}

const rectInfo = ([x0, z0, x1, z1]) => ({ x: (wx(x0) + wx(x1 + 1)) / 2, z: (wz(z0) + wz(z1 + 1)) / 2, w: wx(x1 + 1) - wx(x0), d: wz(z1 + 1) - wz(z0), x0: wx(x0), z0: wz(z0), x1: wx(x1 + 1), z1: wz(z1 + 1) });

/** 売店：奥から並ぶ商品棚（3段に色とりどりの商品）と、入口側（右）のレジ */
function buildStore(group, rect) {
  const r = rectInfo(rect);
  const shelf = mat(0xf2efe8);
  const frame = mat(0x6b5a48);
  for (let k = 0; k < 4; k++) {
    const z = r.z0 + 3 + k * 3.6;
    const len = r.w - 8;
    const x = r.x - 1.5;
    mesh(group, new THREE.BoxGeometry(len, 1.7, 0.7), shelf, x, 0.85, z);
    mesh(group, new THREE.BoxGeometry(len + 0.1, 0.06, 0.74), frame, x, 1.72, z);
    for (let lv = 0; lv < 3; lv++) {
      for (let n = 0; n < Math.floor(len / 0.6); n++) {
        const gx = x - len / 2 + 0.3 + n * 0.6;
        const c = GOODS[(n + lv + k) % GOODS.length];
        for (const side of [-1, 1]) mesh(group, new THREE.BoxGeometry(0.4, 0.3, 0.18), mat(c, 0.6), gx, 0.35 + lv * 0.5, z + side * 0.42);
      }
    }
  }
  // レジ
  mesh(group, new THREE.BoxGeometry(1, 1, 3.2), mat(0x2b6f96), r.x1 - 2.2, 0.5, r.z1 - 4);
  mesh(group, new THREE.BoxGeometry(0.4, 0.3, 0.4), mat(0x22272b), r.x1 - 2.2, 1.15, r.z1 - 4.6);
}

/** 食堂：奥の壁沿いの料理の提供口と、4人掛けのテーブル */
function buildDiner(group, rect) {
  const r = rectInfo(rect);
  const counter = mat(0xd8d3c8);
  mesh(group, new THREE.BoxGeometry(r.w - 4, 1.05, 1), counter, r.x, 0.53, r.z0 + 1.2);
  mesh(group, new THREE.BoxGeometry(r.w - 4, 0.06, 1.2), mat(0x8a5a3a), r.x, 1.08, r.z0 + 1.2);
  // 提供口の上のメニューと、並んだ料理
  mesh(group, new THREE.BoxGeometry(r.w - 6, 1, 0.08), mat(0x23343e, 0.5), r.x, 2.4, r.z0 + 0.4);
  for (let k = 0; k < 5; k++) mesh(group, new THREE.BoxGeometry(0.5, 0.5, 0.5), mat(GOODS[k], 0.6), r.x - 4 + k * 2, 1.35, r.z0 + 1.2);
  const top = mat(0xf4efe4);
  const leg = mat(0x55483c);
  const chair = mat(0x3f7fb0);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const x = r.x0 + 4 + i * ((r.w - 8) / 2);
      const z = r.z0 + 6 + j * ((r.d - 9) / 2);
      mesh(group, new THREE.CylinderGeometry(0.7, 0.7, 0.06, 20), top, x, 0.74, z);
      mesh(group, new THREE.CylinderGeometry(0.08, 0.12, 0.72, 8), leg, x, 0.36, z);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) mesh(group, new THREE.BoxGeometry(0.45, 0.45, 0.45), chair, x + dx * 1.05, 0.23, z + dz * 1.05);
    }
  }
}

export class OutdoorScenery {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'outdoor-scenery';
    scene.add(this.group);
    this.facilities = []; // [[Object3D, 'store' | 'diner']]（タップの判定）
    this.key = '';
  }

  /** 解放済みの屋外エリアと売店・食堂に合わせて作り直す */
  sync(layoutId, unlocked) {
    const open = ZONES.filter((z) => z.open && unlocked.has(z.id));
    const rooms = ZONES.filter((z) => z.facility && unlocked.has(z.id));
    const key = `${layoutId}:${[...open, ...rooms].map((z) => z.id).join(',')}`;
    if (key === this.key) return;
    this.key = key;
    this.group.traverse((o) => o.geometry?.dispose());
    this.group.clear();
    this.facilities = [];
    for (const zone of open) {
      const r = rectInfo(zone.rects[0]);
      const ground = mesh(this.group, new THREE.PlaneGeometry(r.w, r.d).rotateX(-Math.PI / 2), mat(GROUND[zone.id] ?? 0xd3cbb9, 0.95), r.x, -0.008, r.z);
      ground.raycast = () => {};
    }
    for (const zone of rooms) {
      const g = new THREE.Group();
      (zone.facility === 'store' ? buildStore : buildDiner)(g, getZone(zone.id).rects[0]);
      this.group.add(g);
      this.facilities.push([g, zone.facility]);
    }
  }

  update() {}
}
