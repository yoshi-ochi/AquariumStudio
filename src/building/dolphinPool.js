import * as THREE from 'three';
import { buildCreature } from '../expedition/creatureBuilder.js';
import { getCreature } from '../expedition/creatureData.js';
import { appealOf, sizeOf, speciesPieces } from '../expedition/growth.js';
import { disposeObject } from '../tanks/tankBuilder.js';
import { buildStadium, buildBackdrop } from './stadium.js';
import { CELL_SIZE, GRID_X, GRID_Z0, POOL_SEAT_REACH, STORY_H, getZone } from './blueprint.js';

/**
 * 屋外イルカプール：楕円のプールと、2階建ての高さまで段になった半円形の観客席。
 * 水槽と同じく、在庫の生き物を入れて展示する（はじめは空）。creatures = { id: 匹数 }
 */
const SEAT_REACH = POOL_SEAT_REACH;
const TIERS = 12;
const SEAT_TOP = STORY_H * 2;
/** 収容枠（水面 約18m×9.6m の楕円 ≒ 135m²） */
export const POOL_SLOTS = 130;
const MAX_PER_SPECIES = 4;
const JUMPERS = new Set(['whale', 'dolphin']);

export class DolphinPool extends EventTarget {
  constructor(scene) {
    super();
    this.group = new THREE.Group();
    this.group.name = 'dolphin-pool';
    this.group.visible = false;
    scene.add(this.group);
    this._buildPool();
    this._buildSeats();
    this.creatures = {};
    this.life = new THREE.Group();
    this.group.add(this.life);
    this.swimmers = [];
  }

  // ---- 展示（水槽と同じ形：在庫との出し入れ） ----------------------------------
  get capacity() {
    return POOL_SLOTS;
  }

  get used() {
    return Object.entries(this.creatures).reduce((s, [id, n]) => s + (getCreature(id)?.slots ?? 0) * n, 0);
  }

  room(id) {
    const c = getCreature(id);
    return c ? Math.max(0, Math.floor((this.capacity - this.used) / c.slots)) : 0;
  }

  add(id, n) {
    this.creatures[id] = (this.creatures[id] ?? 0) + n;
    this._changed();
  }

  take(id, n) {
    const k = Math.min(this.creatures[id] ?? 0, n);
    if (k <= 0) return 0;
    this.creatures[id] -= k;
    if (!this.creatures[id]) delete this.creatures[id];
    this._changed();
    return k;
  }

  /** ランキング・成長の「展示中」の判定用（水槽と同じ形） */
  get exhibit() {
    return { userData: { creatures: this.creatures } };
  }

  /** 集客力（プール自体の魅力は館の設定で別に足す） */
  appeal() {
    if (!(this.isOpen?.() ?? this.unlocked)) return 0;
    return Object.entries(this.creatures).reduce((s, [id, n]) => {
      const c = getCreature(id);
      return c && n > 0 ? s + c.appeal * n ** 0.75 * appealOf(speciesPieces(id)) : s;
    }, 0);
  }

  toJSON() {
    return { creatures: { ...this.creatures } };
  }

  fromJSON(data) {
    this.creatures = Object.fromEntries(Object.entries(data?.creatures ?? {}).filter(([id, n]) => n > 0 && getCreature(id)));
    this._changed();
  }

  _changed() {
    this.rebuild();
    this.dispatchEvent(new Event('change'));
  }

  /** 展示中の生き物のモデルを作り直す（種ごとに最大4匹。大きい種はプールに収まるよう縮める） */
  rebuild() {
    disposeObject(this.life);
    this.group.remove(this.life);
    this.life = new THREE.Group();
    this.group.add(this.life);
    this.swimmers = [];
    let k = 0;
    const total = Object.values(this.creatures).reduce((s, n) => s + Math.min(n, MAX_PER_SPECIES), 0) || 1;
    for (const [id, n] of Object.entries(this.creatures)) {
      const c = getCreature(id);
      if (!c) continue;
      for (let i = 0; i < Math.min(n, MAX_PER_SPECIES); i++) {
        const obj = buildCreature(c);
        obj.scale.setScalar(Math.min(1, 7 / c.len) * sizeOf(speciesPieces(id)));
        this.life.add(obj);
        this.swimmers.push({ obj, phase: (k++ / total) * Math.PI * 2, jump: JUMPERS.has(c.form), lane: 0.7 + (k % 3) * 0.12 });
      }
    }
    this._key = this._growthKey();
  }

  _growthKey() {
    return Object.keys(this.creatures).map((id) => `${id}:${speciesPieces(id)}`).join(',');
  }

  _buildPool() {
    const concrete = new THREE.MeshStandardMaterial({ color: 0xd9dcd8, roughness: 0.9 });
    // 水の中が見えるよう、縁（筒の外壁と上面の縁取り）と青い底でプールを作る
    const deck = new THREE.Group();
    // 客席側（南）の壁はアクリルの観覧窓、残りはコンクリート
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.2, 48, 1, true, Math.PI * 0.3, Math.PI * 1.4), new THREE.MeshStandardMaterial({ color: 0xd9dcd8, roughness: 0.9, side: THREE.DoubleSide }));
    wall.scale.set(10, 1, 5.6);
    wall.position.y = 0.6;
    const acrylic = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.1, 24, 1, true, -Math.PI * 0.3, Math.PI * 0.6), new THREE.MeshStandardMaterial({ color: 0xbfe8f5, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
    acrylic.scale.set(10, 1, 5.6);
    acrylic.position.y = 0.6;
    deck.add(acrylic);
    const lip = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2), concrete);
    lip.scale.set(10, 1, 5.6);
    lip.position.y = 1.2;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1d7ea6, roughness: 0.6 }));
    floor.scale.set(10, 1, 5.6);
    floor.position.y = 0.03;
    deck.add(wall, lip, floor);
    const water = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: 0x2f9fc8, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.55, depthWrite: false }));
    water.renderOrder = 2;
    water.rotation.x = -Math.PI / 2;
    water.scale.set(9, 4.8, 1);
    water.position.y = 1.12;
    this.water = water; // タップで展示の画面を開く
    // ステージ：トレーナーが立つ張り出し（スライドアウト）と昇降の段、奥の大型ビジョン
    const stage = new THREE.Mesh(new THREE.BoxGeometry(7, 1.2, 1.6), new THREE.MeshStandardMaterial({ color: 0x2b6f96, roughness: 0.7 }));
    stage.position.set(0, 0.6, -5.6);
    stage.castShadow = true;
    const slide = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 1.4), new THREE.MeshStandardMaterial({ color: 0xe6eef1, roughness: 0.6 }));
    slide.position.set(0, 1.12, -4.4);
    const stairs = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.35), concrete);
      st.position.set(4.2, 0.15 + k * 0.3, -6.6 + k * 0.35);
      stairs.add(st);
    }
    this.group.add(deck, water, stage, slide, stairs, buildBackdrop({ width: 16, z: -6.8 }));
  }

  /** 客席は南（建物側）へ向かって高くなる */
  _buildSeats() {
    this.group.add(buildStadium({ tiers: TIERS, seatTop: SEAT_TOP, r0: 5.7, step: 0.45, xScale: 1.55 }));
  }


  /** 間取りのプール区画に合わせて置き直す（客席の背が建物側に接する） */
  setLayout() {
    const [x0, , x1, z1] = getZone('pool').rects[0];
    this.group.position.set(((x0 + x1 + 1) / 2 - GRID_X / 2) * CELL_SIZE, 0, (z1 + 1 - GRID_Z0) * CELL_SIZE - SEAT_REACH);
  }

  setUnlocked(v) {
    this.unlocked = v;
    this.group.visible = v;
  }

  /** プールの中を周回する。イルカ・クジラの仲間は順番にジャンプする */
  update(time) {
    if (!this.group.visible) return;
    if (time - (this._checked ?? 0) > 2) {
      this._checked = time;
      if (this._growthKey() !== this._key) this.rebuild(); // 成長で大きさが変わった
    }
    for (const d of this.swimmers) {
      const a = time * 0.45 + d.phase;
      const jump = d.jump ? Math.max(0, Math.sin(a * 2.5)) : 0;
      const y = 0.6 + Math.pow(jump, 3) * 3;
      d.obj.position.set(Math.cos(a) * 6.8 * d.lane, y, Math.sin(a) * 3.1 * d.lane);
      d.obj.rotation.y = -a - Math.PI / 2 + Math.PI;
      d.obj.rotation.z = Math.cos(a * 2.5) * jump * 0.8;
      d.obj.userData.uni.uTime.value = time * 1.4;
    }
  }
}
