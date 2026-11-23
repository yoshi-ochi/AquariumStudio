import * as THREE from 'three';
import { getCreature } from '../expedition/creatureData.js';
import { buildCreature } from '../expedition/creatureBuilder.js';
import { sizeOf, speciesPieces } from '../expedition/growth.js';
import { disposeObject } from '../tanks/tankBuilder.js';
import { mulberry32 } from '../tanks/random.js';
import { PEN, sectionSize } from './seaPen.js';
import { GRID_X, CELL_SIZE } from './blueprint.js';

/**
 * 生け簀の3D表示。本館の右手の海に、100m 四方の浮き桟橋と網の区画を並べる。
 * 区画の中の生き物は実寸（成長に応じた大きさ）で泳がせる。
 */
/** 生け簀の中心（ワールド座標）。敷地の右端から桟橋を渡った先 */
export const PEN_CENTER = { x: (GRID_X * CELL_SIZE) / 2 + 10 + PEN.size / 2, z: 0 };
const WATER_Y = -0.3;
const MAX_PER_SPECIES = 8;

const MAT = {
  water: new THREE.MeshStandardMaterial({ color: 0x1d6f8f, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide }),
  sea: new THREE.MeshStandardMaterial({ color: 0x0f4d6a, roughness: 0.6 }),
  deck: new THREE.MeshStandardMaterial({ color: 0xc8b48c, roughness: 0.85 }),
  float: new THREE.MeshStandardMaterial({ color: 0xe8edf0, roughness: 0.7 }),
  net: new THREE.MeshBasicMaterial({ color: 0x23343e, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }),
};
const box = (w, h, d, x, y, z, mat) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
};
/** マス番号 → 生け簀の中心からの位置(m) */
const cx = (i) => -PEN.size / 2 + i * PEN.cell;

export class SeaPenScene {
  constructor(scene, pen) {
    this.pen = pen;
    this.group = new THREE.Group();
    this.group.name = 'sea-pen';
    this.group.position.set(PEN_CENTER.x, 0, PEN_CENTER.z);
    this.group.visible = false;
    scene.add(this.group);
    this.base = this._base();
    this.group.add(this.base);
    this.sections = new THREE.Group();
    this.group.add(this.sections);
    this.fish = [];
    this.shown = true;
    pen.addEventListener('change', () => this.rebuild());
  }

  /** 外周の桟橋・海面・本館からの桟橋（区画によらない部分） */
  _base() {
    const g = new THREE.Group();
    const S = PEN.size;
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(S + 40, S + 40).rotateX(-Math.PI / 2), MAT.sea);
    sea.position.y = -PEN.depth - 0.5;
    g.add(sea);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(S + 40, S + 40).rotateX(-Math.PI / 2), MAT.water);
    water.position.y = WATER_Y;
    water.renderOrder = 2;
    g.add(water);
    const rim = 2;
    g.add(box(S + rim * 2, 0.4, rim, 0, 0, -S / 2 - rim / 2, MAT.deck), box(S + rim * 2, 0.4, rim, 0, 0, S / 2 + rim / 2, MAT.deck));
    g.add(box(rim, 0.4, S, -S / 2 - rim / 2, 0, 0, MAT.deck), box(rim, 0.4, S, S / 2 + rim / 2, 0, 0, MAT.deck));
    // 本館側から渡る桟橋
    g.add(box(10, 0.4, 3, -S / 2 - rim - 5, 0, 0, MAT.deck));
    return g;
  }

  /** 表示の切り替え（解放済みで、本館の地上階を見ているときだけ） */
  setVisible(on) {
    this.shown = on;
    this.group.visible = on && this.pen.unlocked;
  }

  /** 区画と生き物を作り直す */
  rebuild() {
    this.group.visible = this.shown && this.pen.unlocked;
    disposeObject(this.sections);
    this.group.remove(this.sections);
    this.sections = new THREE.Group();
    this.group.add(this.sections);
    this.fish = [];
    for (const s of this.pen.sections) this._section(s);
    this._key = this._growthKey();
  }

  _section(s) {
    const g = new THREE.Group();
    const { w, d } = sectionSize(s);
    const x0 = cx(s.x0);
    const z0 = cx(s.z0);
    const mx = x0 + w / 2;
    const mz = z0 + d / 2;
    const walk = 0.8;
    // 区画の縁の浮き桟橋と、水中へ垂らした網
    for (const [len, x, z, rot] of [[w, mx, z0, 0], [w, mx, z0 + d, 0], [d, x0, mz, 1], [d, x0 + w, mz, 1]]) {
      g.add(rot ? box(walk, 0.3, len, x, 0.02, z, MAT.float) : box(len, 0.3, walk, x, 0.02, z, MAT.float));
      const net = new THREE.Mesh(new THREE.PlaneGeometry(len, PEN.depth), MAT.net);
      net.position.set(x, WATER_Y - PEN.depth / 2, z);
      if (rot) net.rotation.y = Math.PI / 2;
      g.add(net);
    }
    // 生き物（種ごとに最大8匹を表示）
    const rand = mulberry32(s.id * 7919);
    for (const [id, n] of Object.entries(s.creatures)) {
      const c = getCreature(id);
      if (!c) continue;
      for (let k = 0; k < Math.min(n, MAX_PER_SPECIES); k++) {
        const f = buildCreature(c);
        const scale = sizeOf(speciesPieces(id));
        f.scale.setScalar(scale);
        const len = c.len * scale;
        const ax = Math.max(0.5, (w / 2 - len / 2 - 1) * (0.45 + rand() * 0.5));
        const az = Math.max(0.5, (d / 2 - len / 2 - 1) * (0.45 + rand() * 0.5));
        const depth = Math.min(PEN.depth / 2, Math.max(0.6, len * 0.3));
        f.userData.swim = { cx: mx, cz: mz, ax, az, cy: WATER_Y - 0.4 - depth / 2 - rand() * 2, speed: (0.6 + rand() * 0.6) / Math.max(ax, az), p: rand() * Math.PI * 2, dir: rand() < 0.5 ? -1 : 1, tempo: 0.6 + rand() * 0.6 };
        g.add(f);
        this.fish.push(f);
      }
    }
    this.sections.add(g);
  }

  /** 展示中の魚種の成長（ピース）。変わったら大きさを作り直す */
  _growthKey() {
    return this.pen.sections.map((s) => Object.keys(s.creatures).map((id) => `${id}:${speciesPieces(id)}`).join(',')).join('|');
  }

  update(time) {
    if (!this.group.visible) return;
    if (time - (this._checked ?? 0) > 2) {
      this._checked = time;
      const key = this._growthKey();
      if (this._key !== undefined && key !== this._key) this.rebuild();
      this._key = key;
    }
    for (const f of this.fish) {
      const s = f.userData.swim;
      const a = time * s.speed * s.dir + s.p;
      f.position.set(s.cx + Math.cos(a) * s.ax, s.cy + Math.sin(a * 0.7) * 0.4, s.cz + Math.sin(a) * s.az);
      f.rotation.y = Math.atan2(-Math.cos(a) * s.az * s.dir, -Math.sin(a) * s.ax * s.dir);
      f.userData.uni.uTime.value = time * s.tempo + s.p;
    }
  }

  /** カメラで生け簀全体を映す範囲 */
  bounds() {
    const S = PEN.size + 8;
    return { cx: PEN_CENTER.x, cz: PEN_CENTER.z, w: S, d: S };
  }
}

