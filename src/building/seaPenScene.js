import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getCreature } from '../expedition/creatureData.js';
import { behaviorOf } from '../expedition/behaviorData.js';
import { buildCreature } from '../expedition/creatureBuilder.js';
import { sizeOf, speciesPieces } from '../expedition/growth.js';
import { disposeObject } from '../tanks/tankBuilder.js';
import { mulberry32 } from '../tanks/random.js';
import { PEN, sectionSize } from './seaPen.js';
import { GRID_X, GRID_Z, GRID_Z0, CELL_SIZE, FLOOR_COUNT, ZONES, ZONE_TYPE } from './blueprint.js';

/**
 * 生け簀の3D表示。本館の右手に離して、地面に掘り込んだ 100m 四方の堀を作り、ブイの列で仕切った網の区画を並べる。
 * 区画の中の生き物は実寸（成長に応じた大きさ）で泳がせる。
 */
/** 生け簀の中心（ワールド座標）。本館の右から小道を歩いた先の堀（間取りで変わるので setLayout で決める） */
export const PEN_CENTER = { x: 0, z: 0 };
const wx = (i) => (i - GRID_X / 2) * CELL_SIZE;
const wz = (j) => (j - GRID_Z0) * CELL_SIZE;
/** 堀の水面（地面より下） */
const WATER_Y = -1.2;
const MAX_PER_SPECIES = 8;

const MAT = {
  water: new THREE.MeshStandardMaterial({ color: 0x1d6f8f, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  pitWall: new THREE.MeshStandardMaterial({ color: 0x8f9893, roughness: 0.95, side: THREE.BackSide }),
  pitFloor: new THREE.MeshStandardMaterial({ color: 0x24505c, roughness: 0.9, side: THREE.BackSide }),
  hidden: new THREE.MeshBasicMaterial({ visible: false }),
  coping: new THREE.MeshStandardMaterial({ color: 0xc9c6bc, roughness: 0.9 }),
  float: new THREE.MeshStandardMaterial({ color: 0xeef1f2, roughness: 0.5 }),
  net: new THREE.MeshBasicMaterial({ color: 0x23343e, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }),
  rail: new THREE.MeshStandardMaterial({ color: 0xd8dde0, roughness: 0.35, metalness: 0.6 }),
  buoy: new THREE.MeshStandardMaterial({ color: 0xf28a1c, roughness: 0.45 }),
  rope: new THREE.MeshBasicMaterial({ color: 0x3a3a32 }),
};
/** 堀の縁（笠木）の幅と、本館から堀までの距離(m) */
const RIM = 2.5;
const GAP = 30;
const sphere = (r, x, y, z, mat) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), mat);
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
    // 解放前は区画のない真っ暗な海（ブラックアウト）
    this.blackout = new THREE.Mesh(new THREE.PlaneGeometry(PEN.size + 4, PEN.size + 4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x05080b }));
    this.blackout.position.y = 0.05;
    this.group.add(this.blackout);
    this.setLayout();
    scene.add(this.group);
    this.base = this._base();
    this.group.add(this.base);
    this.sections = new THREE.Group();
    this.group.add(this.sections);
    this.fish = [];
    this.shown = true;
    this._showParts();
    pen.addEventListener('change', () => this.rebuild());
  }

  /** 堀・水面・縁の柵・本館からの小道（区画によらない部分） */
  _base() {
    const g = new THREE.Group();
    const S = PEN.size;
    // 地面を掘り込んだ堀：内側の面だけを描く上面のない箱（外から見た手前の壁は消え、奥の壁と底が見える）
    const D = PEN.depth - WATER_Y + 0.5;
    const pit = new THREE.Mesh(new THREE.BoxGeometry(S, D, S).translate(0, -D / 2, 0), [MAT.pitWall, MAT.pitWall, MAT.hidden, MAT.pitFloor, MAT.pitWall, MAT.pitWall]);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(S, S).rotateX(-Math.PI / 2), MAT.water);
    water.position.y = WATER_Y;
    water.renderOrder = 2;
    g.add(pit, water);
    // 堀の縁：地面と同じ高さのコンクリートの笠木と、外周の柵（支柱 5m おき、手すり2段）
    const parts = [];
    const fence = [];
    for (const [w, d, x, z] of [[S + RIM * 2, RIM, 0, -S / 2 - RIM / 2], [S + RIM * 2, RIM, 0, S / 2 + RIM / 2], [RIM, S, -S / 2 - RIM / 2, 0], [RIM, S, S / 2 + RIM / 2, 0]]) {
      parts.push(new THREE.BoxGeometry(w, 0.3, d).translate(x, 0.0, z));
    }
    const E = S / 2 + 0.3;
    for (const [rot, x, z] of [[0, 0, -E], [0, 0, E], [1, -E, 0], [1, E, 0]]) {
      const len = S + 0.6;
      for (let k = 0; k <= len / 5; k++) {
        const t = -len / 2 + k * 5;
        fence.push(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6).translate(rot ? x : x + t, 0.7, rot ? z + t : z));
      }
      for (const y of [0.7, 1.2]) {
        const bar = new THREE.CylinderGeometry(0.03, 0.03, len, 6).rotateZ(Math.PI / 2);
        fence.push((rot ? bar.rotateY(Math.PI / 2) : bar).translate(x, y, z));
      }
    }
    g.add(new THREE.Mesh(mergeGeometries(parts), MAT.coping), new THREE.Mesh(mergeGeometries(fence), MAT.rail));
    // 本館から堀まで歩く舗装の小道
    const path = new THREE.Mesh(new THREE.PlaneGeometry(GAP, 4).rotateX(-Math.PI / 2), MAT.coping);
    path.position.set(-S / 2 - RIM - GAP / 2, 0.012, 0);
    g.add(path);
    return g;
  }

  /** 表示の切り替え（解放済みで、本館の地上階を見ているときだけ） */
  /** 本館の右端から GAP 先に、堀の縁が来るよう置き直す（奥行きは本館の中央） */
  setLayout() {
    const main = ZONES.filter((z) => z.floor < FLOOR_COUNT && z.type !== ZONE_TYPE.OUTDOOR && !z.facility && !z.wing && !z.auto && z.id !== 'yard0' && z.id !== 'poolyard').flatMap((z) => z.rects ?? []);
    const right = main.length ? Math.max(...main.map((r) => r[2])) + 1 : GRID_X;
    const z0 = main.length ? Math.min(...main.map((r) => r[1])) : 0;
    const z1 = main.length ? Math.max(...main.map((r) => r[3])) + 1 : GRID_Z;
    PEN_CENTER.x = wx(right) + GAP + RIM + PEN.size / 2;
    PEN_CENTER.z = (wz(z0) + wz(z1)) / 2;
    this.group.position.set(PEN_CENTER.x, 0, PEN_CENTER.z);
  }

  setVisible(on) {
    this.shown = on;
    this.group.visible = on;
    this._showParts();
  }

  /** 区画と生き物を作り直す */
  rebuild() {
    this.group.visible = this.shown;
    this._showParts();
    disposeObject(this.sections);
    this.group.remove(this.sections);
    this.sections = new THREE.Group();
    this.group.add(this.sections);
    this.fish = [];
    for (const s of this.pen.sections) this._section(s);
    this._key = this._growthKey();
  }

  /** 解放前はブラックアウトだけ、解放後は堀・水面・区画 */
  _showParts() {
    const on = this.pen.unlocked;
    this.blackout.visible = !on;
    this.base.visible = on;
    this.sections.visible = on;
  }

  _section(s) {
    const g = new THREE.Group();
    const { w, d } = sectionSize(s);
    const x0 = cx(s.x0);
    const z0 = cx(s.z0);
    const mx = x0 + w / 2;
    const mz = z0 + d / 2;
    // 区画の仕切り：水面に浮かべたブイの列とロープ（4つに1つは目立つ橙）、水中へ垂らした網。四隅に大きめのブイ
    const floats = { white: [], orange: [] };
    const ropes = [];
    for (const [len, x, z, rot] of [[w, mx, z0, 0], [w, mx, z0 + d, 0], [d, x0, mz, 1], [d, x0 + w, mz, 1]]) {
      const n = Math.max(2, Math.round(len / 1.25));
      for (let k = 0; k <= n; k++) {
        const t = -len / 2 + (k / n) * len;
        floats[k % 4 === 0 ? 'orange' : 'white'].push(new THREE.SphereGeometry(0.2, 8, 6).translate(rot ? x : x + t, WATER_Y + 0.06, rot ? z + t : z));
      }
      const rope = new THREE.CylinderGeometry(0.025, 0.025, len, 4).rotateZ(Math.PI / 2);
      ropes.push((rot ? rope.rotateY(Math.PI / 2) : rope).translate(x, WATER_Y + 0.03, z));
      const net = new THREE.Mesh(new THREE.PlaneGeometry(len, PEN.depth), MAT.net);
      net.position.set(x, WATER_Y - PEN.depth / 2, z);
      if (rot) net.rotation.y = Math.PI / 2;
      g.add(net);
    }
    g.add(new THREE.Mesh(mergeGeometries(floats.white), MAT.float), new THREE.Mesh(mergeGeometries(floats.orange), MAT.buoy), new THREE.Mesh(mergeGeometries(ropes), MAT.rope));
    for (const [bx, bz] of [[x0, z0], [x0 + w, z0], [x0, z0 + d], [x0 + w, z0 + d]]) g.add(sphere(0.4, bx, WATER_Y + 0.15, bz, MAT.buoy));
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
        f.userData.swim = { cx: mx, cz: mz, ax, az, cy: WATER_Y - 0.4 - depth / 2 - rand() * 2, speed: (Math.min(3, Math.max(0.15, behaviorOf(c).cruise * len)) * (0.8 + rand() * 0.4)) / Math.max(ax, az), p: rand() * Math.PI * 2, dir: rand() < 0.5 ? -1 : 1, tempo: 0.6 + rand() * 0.6 };
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

