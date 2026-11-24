import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getCreature } from '../expedition/creatureData.js';
import { buildCreature } from '../expedition/creatureBuilder.js';
import { sizeOf, speciesPieces } from '../expedition/growth.js';
import { disposeObject } from '../tanks/tankBuilder.js';
import { mulberry32 } from '../tanks/random.js';
import { PEN, sectionSize } from './seaPen.js';
import { GRID_X, GRID_Z, CELL_SIZE, FLOOR_COUNT, ZONES, ZONE_TYPE } from './blueprint.js';

/**
 * 生け簀の3D表示。本館の右手の海に、100m 四方の浮き桟橋と網の区画を並べる。
 * 区画の中の生き物は実寸（成長に応じた大きさ）で泳がせる。
 */
/** 生け簀の中心（ワールド座標）。本館の右から桟橋を渡った先の海（間取りで変わるので setLayout で決める） */
export const PEN_CENTER = { x: 0, z: 0 };
const wx = (i) => (i - GRID_X / 2) * CELL_SIZE;
const wz = (j) => (j - GRID_Z / 2) * CELL_SIZE;
const WATER_Y = -0.3;
const MAX_PER_SPECIES = 8;

const MAT = {
  water: new THREE.MeshStandardMaterial({ color: 0x1d6f8f, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide }),
  sea: new THREE.MeshStandardMaterial({ color: 0x0f4d6a, roughness: 0.6 }),
  deck: new THREE.MeshStandardMaterial({ color: 0xc8b48c, roughness: 0.85 }),
  float: new THREE.MeshStandardMaterial({ color: 0xe8edf0, roughness: 0.7 }),
  net: new THREE.MeshBasicMaterial({ color: 0x23343e, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }),
  pipe: new THREE.MeshStandardMaterial({ color: 0x1d2226, roughness: 0.4 }), // 黒い HDPE の浮きパイプ
  grate: new THREE.MeshStandardMaterial({ color: 0x9aa3a8, roughness: 0.7, metalness: 0.3 }),
  rail: new THREE.MeshStandardMaterial({ color: 0xd8dde0, roughness: 0.35, metalness: 0.6 }),
  buoy: new THREE.MeshStandardMaterial({ color: 0xf28a1c, roughness: 0.45 }),
  mooring: new THREE.MeshStandardMaterial({ color: 0xf2d02c, roughness: 0.45 }),
  rope: new THREE.MeshBasicMaterial({ color: 0x3a3a32 }),
};
/** 1辺ぶんの浮き：水面に浮く2本の HDPE パイプ、その上の歩廊（グレーチング）、2.5m おきの支柱と手すり */
function collarEdge(len, rot) {
  const parts = { pipe: [], grate: [], rail: [] };
  const along = (geo, x, y, z) => (rot ? geo.rotateY(Math.PI / 2) : geo).translate(rot ? z : x, y, rot ? x : z);
  for (const off of [-0.45, 0.45]) parts.pipe.push(along(new THREE.CylinderGeometry(0.22, 0.22, len, 10).rotateZ(Math.PI / 2), 0, 0.02, off));
  parts.grate.push(along(new THREE.BoxGeometry(len, 0.06, 0.9), 0, 0.26, 0));
  const n = Math.max(1, Math.round(len / 2.5));
  for (let i = 0; i <= n; i++) {
    const x = -len / 2 + (i / n) * len;
    parts.rail.push(along(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), x, 0.76, 0.45));
  }
  parts.rail.push(along(new THREE.CylinderGeometry(0.035, 0.035, len, 6).rotateZ(Math.PI / 2), 0, 1.24, 0.45));
  parts.rail.push(along(new THREE.CylinderGeometry(0.025, 0.025, len, 6).rotateZ(Math.PI / 2), 0, 0.78, 0.45));
  return parts;
}
const sphere = (r, x, y, z, mat) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), mat);
  m.position.set(x, y, z);
  return m;
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
    // 外周の係留ブイ（12.5m おき）と、海底のアンカーへ斜めに張る係留索
    const moor = [];
    const ropes = [];
    for (let i = 0; i <= 8; i++) {
      const t = -S / 2 + (i / 8) * S;
      for (const [x, z, dx, dz] of [[t, -S / 2 - 9, 0, 1], [t, S / 2 + 9, 0, -1], [-S / 2 - 9, t, 1, 0], [S / 2 + 9, t, -1, 0]]) {
        moor.push(new THREE.SphereGeometry(0.6, 10, 8).translate(x, 0.1, z));
        const a = new THREE.Vector3(x, 0, z);
        const b = new THREE.Vector3(x + dx * 7, 0.1, z + dz * 7);
        const mid = a.clone().add(b).multiplyScalar(0.5);
        const rope = new THREE.CylinderGeometry(0.03, 0.03, a.distanceTo(b), 4).rotateZ(Math.PI / 2);
        rope.rotateY(-Math.atan2(b.z - a.z, b.x - a.x)).translate(mid.x, mid.y, mid.z);
        ropes.push(rope);
      }
    }
    g.add(new THREE.Mesh(mergeGeometries(moor), MAT.mooring), new THREE.Mesh(mergeGeometries(ropes), MAT.rope));
    // 本館側から渡る桟橋
    g.add(box(10, 0.4, 3, -S / 2 - rim - 5, 0, 0, MAT.deck));
    return g;
  }

  /** 表示の切り替え（解放済みで、本館の地上階を見ているときだけ） */
  /** 売店・食堂の左端から10m 先に、生け簀の右端が来るよう置き直す */
  /** 本館の右端から10m 先に、生け簀の左端が来るよう置き直す（奥行きは本館の中央） */
  setLayout() {
    const main = ZONES.filter((z) => z.floor < FLOOR_COUNT && z.type !== ZONE_TYPE.OUTDOOR && !z.facility && z.id !== 'yard0').flatMap((z) => z.rects ?? []);
    const right = main.length ? Math.max(...main.map((r) => r[2])) + 1 : GRID_X;
    const z0 = main.length ? Math.min(...main.map((r) => r[1])) : 0;
    const z1 = main.length ? Math.max(...main.map((r) => r[3])) + 1 : GRID_Z;
    PEN_CENTER.x = wx(right) + 10 + PEN.size / 2;
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

  /** 解放前はブラックアウトだけ、解放後は桟橋・海面・区画 */
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
    // 区画の縁：HDPE の二重パイプの浮き・歩廊・手すり（外向き）と、水中へ垂らした網。四隅に目印のブイ
    const kit = { pipe: [], grate: [], rail: [] };
    for (const [len, x, z, rot, flip] of [[w, mx, z0, 0, -1], [w, mx, z0 + d, 0, 1], [d, x0, mz, 1, -1], [d, x0 + w, mz, 1, 1]]) {
      const e = collarEdge(len, rot);
      for (const k of Object.keys(kit)) for (const geo of e[k]) kit[k].push((flip < 0 ? geo.rotateY(Math.PI) : geo).translate(x, 0, z));
      const net = new THREE.Mesh(new THREE.PlaneGeometry(len, PEN.depth), MAT.net);
      net.position.set(x, WATER_Y - PEN.depth / 2, z);
      if (rot) net.rotation.y = Math.PI / 2;
      g.add(net);
    }
    g.add(new THREE.Mesh(mergeGeometries(kit.pipe), MAT.pipe), new THREE.Mesh(mergeGeometries(kit.grate), MAT.grate), new THREE.Mesh(mergeGeometries(kit.rail), MAT.rail));
    for (const [bx, bz] of [[x0, z0], [x0 + w, z0], [x0, z0 + d], [x0 + w, z0 + d]]) g.add(sphere(0.45, bx, 0.35, bz, MAT.buoy));
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

