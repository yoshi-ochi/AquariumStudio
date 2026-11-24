import * as THREE from 'three';
import { getDef, hasDef, CATEGORY } from './tankData.js';
import { buildObject, disposeObject } from './tankBuilder.js';
import { createClipUniforms, updateClipUniforms, applyClip, floorAt } from './tankClip.js';
import { encodePositions, applyEncodedPositions, rememberBase } from '../interior/sculpt.js';
import { applyTankLook, normalizeLook } from './tankLook.js';
import { applySand } from './sandLook.js';
import { updateBubbles } from './aeration.js';
import { syncLife, updateLife, lifeAppeal } from '../expedition/tankLife.js';
import { cleanAppealFactor, updateCareVisual } from './tankCleaning.js';
import { tankHealth } from '../expedition/husbandry.js';
import { FLOOR_COUNT, STORY_H } from '../building/blueprint.js';

/**
 * 館内に配置されたオブジェクトの管理。
 * 全階のオブジェクトを保持し、現在の階のものだけを表示する。
 */
export class TankManager {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'placed-objects';
    scene.add(this.group);
    this.objects = new Map(); // uid -> root
    this.currentFloor = 0;
    this.nextUid = 1;
    this.extraAppeal = 0; // 屋外プールなど建物の魅力
    this.extraExhibitAppeal = () => 0; // 屋外生け簀などの展示の魅力
    this.extraExhibits = () => []; // 水槽以外の展示（{ userData: { creatures } }。ランキング・成長の判定用）
    this.themeBonus = () => 1; // エリアのテーマに合った展示のボーナス
  }

  // ---- 追加・削除 ---------------------------------------------------------

  add(defId, { x = 0, z = 0, rotY = 0, floor = this.currentFloor, uid, contents = [], embed = null, look = null, creatures = null, clean = null, care = null, name = null } = {}) {
    const def = getDef(defId);
    const obj = buildObject(def);
    obj.userData.uid = uid ?? this.nextUid++;
    this.nextUid = Math.max(this.nextUid, obj.userData.uid + 1);
    obj.userData.floor = floor;
    obj.position.set(x, 0, z);
    obj.rotation.y = rotY;
    obj.visible = this._visibleOn(obj, this.currentFloor);
    if (embed && (def.category === CATEGORY.TANK || def.wallMount)) obj.userData.embed = { ...embed };
    if (def.category === CATEGORY.TANK) {
      obj.userData.clip = createClipUniforms(obj.userData.interior);
      obj.userData.clean = clean ? { ...clean } : { last: Date.now() };
      if (name) obj.userData.name = String(name).slice(0, 20);
      if (look) applyTankLook(obj, def, look);
      else applySand(obj, normalizeLook()); // 底砂（標準）と底の光の模様
    }
    this.group.add(obj);
    this.objects.set(obj.userData.uid, obj);
    this.refreshElevations(floor);
    for (const item of contents) {
      if (hasDef(item.defId)) this.createInterior(obj, item.defId, item);
    }
    if (creatures && obj.userData.clip) {
      obj.userData.creatures = { ...creatures };
      if (care) obj.userData.care = { ...care };
      syncLife(obj);
    }
    return obj;
  }

  // ---- 水槽内オブジェ（水槽の 'contents' グループのローカル子要素） -------

  contentsOf(tank) {
    return tank.getObjectByName('contents');
  }

  /** 確定済みの水槽内オブジェ（配置中のゴーストを除く） */
  interiorItems(tank) {
    return this.contentsOf(tank).children.filter((c) => !c.userData.ghost);
  }

  /** 水槽内オブジェを生成してクリップを適用する（座標は水槽ローカル） */
  createInterior(tank, defId, { x = 0, y = 0, z = 0, rotY = 0, seed, sculpt, growth, bubbles, locked } = {}) {
    const def = getDef(defId);
    const surface = def.growth === 'colony' ? this.surfaceSampler(tank, null, { x, y, z, rotY }) : undefined;
    const item = buildObject(def, { seed: seed ?? Math.floor(Math.random() * 2 ** 31), growth, surface });
    if (bubbles !== undefined) item.userData.bubbles = bubbles;
    if (locked) item.userData.locked = true;
    const rock = item.getObjectByName('rock');
    if (rock) rememberBase(rock.geometry);
    if (sculpt && rock && applyEncodedPositions(rock.geometry, sculpt)) item.userData.sculpted = true;
    item.position.set(x, y, z);
    item.rotation.y = rotY;
    applyClip(item, tank.userData.clip);
    this.contentsOf(tank).add(item);
    return item;
  }

  /** 成長パラメータを変えて水槽内オブジェの形を作り直す（seed は同じ） */
  regrowInterior(item, growth) {
    const tank = item.parent?.parent;
    const def = getDef(item.userData.defId);
    const surface =
      def.growth === 'colony' && tank
        ? this.surfaceSampler(tank, item, { x: item.position.x, y: item.position.y, z: item.position.z, rotY: item.rotation.y })
        : undefined;
    const fresh = buildObject(def, { seed: item.userData.seed, growth, surface });
    const oldBody = item.getObjectByName('body');
    const newBody = fresh.getObjectByName('body');
    item.remove(oldBody);
    disposeObject(oldBody);
    item.add(newBody);
    item.userData.growth = fresh.userData.growth;
    if (tank?.userData.clip) applyClip(newBody, tank.userData.clip);
  }

  /**
   * 群体を下の地形（岩・他のオブジェ・底砂）に沿わせるための高さ関数。
   * 引数はオブジェのローカル (x, z)、戻り値はオブジェの原点からの高さ。
   * 真上から下へレイを飛ばして当たった面の高さを使う（1cm 単位でキャッシュ）。
   */
  surfaceSampler(tank, self, { x, y, z, rotY }) {
    const targets = this.interiorItems(tank).filter((o) => o !== self && !o.userData.ghost);
    const I = tank.userData.interior;
    const ray = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const cache = new Map();
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    tank.updateWorldMatrix(true, true);
    return (lx, lz) => {
      const key = `${Math.round(lx * 100)},${Math.round(lz * 100)}`;
      if (cache.has(key)) return cache.get(key);
      // オブジェのローカル → 水槽のローカル（Y 軸回転＋平行移動）→ ワールド
      const tx = x + lx * c + lz * s;
      const tz = z - lx * s + lz * c;
      const origin = tank.localToWorld(new THREE.Vector3(tx, y + 1.5, tz));
      ray.set(origin, down);
      const floorY = floorAt(I, tx);
      let top = floorY;
      const hit = targets.length ? ray.intersectObjects(targets, true)[0] : null;
      if (hit) top = Math.max(floorY, tank.worldToLocal(hit.point.clone()).y);
      const h = Math.max(0, top - y);
      cache.set(key, h);
      return h;
    };
  }

  removeInterior(item) {
    item.parent?.remove(item);
    disposeObject(item);
  }

  findInteriorRoot(object3D) {
    let o = object3D;
    while (o && !o.userData.interiorItem) o = o.parent;
    return o ?? null;
  }

  /** 水槽内オブジェの価格合計 */
  contentsValue(tank) {
    return this.interiorItems(tank).reduce((s, c) => s + getDef(c.userData.defId).price, 0);
  }

  /** 水槽の見た目（バックスクリーン・フレーム・ライト）を部分的に変更 */
  setTankLook(tank, patch) {
    const cur = tank.userData.look ?? {};
    const next = { ...cur, ...patch, light: { ...(cur.light ?? {}), ...(patch.light ?? {}) } };
    applyTankLook(tank, this.defOf(tank), next);
  }

  /** 壁に埋め込まれたオブジェ（水槽・ドア）の一覧（現在の階） */
  embeddedObjects(floor = this.currentFloor) {
    return [...this.objects.values()].filter((o) => o.userData.embed && o.userData.floor === floor);
  }

  /** 現在の階のエアレーションの泡を動かす */
  updateAeration(time) {
    for (const tank of this.objects.values()) {
      if (!tank.userData.clip || !tank.visible) continue;
      const top = tank.userData.interior.waterTop;
      for (const item of this.contentsOf(tank).children) {
        if (getDef(item.userData.defId).bubbles) updateBubbles(item, time, top - item.position.y);
      }
    }
  }

  /** 吹き抜けの大水槽は、吹き抜けの下に置いてあれば2階からも見える（他の場所では2階の床に隠れる） */
  _visibleOn(o, floor) {
    if (o.userData.floor === floor) return true;
    return this._pierces(o, floor);
  }

  /** 下の階の背の高い水槽（大水槽など）が、この階まで突き抜けているか（地上の本館の階どうし） */
  _pierces(o, floor) {
    const from = o.userData.floor;
    if (floor >= FLOOR_COUNT || from >= FLOOR_COUNT || from >= floor) return false;
    const def = this.defOf(o);
    if (def.category !== CATEGORY.TANK) return false;
    const base = o.position.y + (o.userData.drop ?? 0);
    return base + def.size.h > (floor - from) * STORY_H;
  }

  /** 全水槽（配置順） */
  get tanks() {
    return [...this.objects.values()].filter((o) => o.userData.clip);
  }

  /** 現在の階の水槽の汚れ表示を更新 */
  updateCare(now) {
    for (const t of this.tanks) if (t.visible) updateCareVisual(t, now);
  }

  /** 現在の階の展示生物を泳がせる */
  updateLife(time) {
    for (const tank of this.objects.values()) if (tank.userData.clip && tank.visible) updateLife(tank, time);
  }

  /** 全水槽のクリップ用逆行列を更新（水槽の移動・回転に追従） */
  updateClips() {
    for (const o of this.objects.values()) {
      if (o.userData.clip && o.visible) updateClipUniforms(o);
    }
  }

  remove(obj) {
    if (!this.objects.has(obj.userData.uid)) return;
    this.objects.delete(obj.userData.uid);
    this.group.remove(obj);
    disposeObject(obj);
    this.refreshElevations(obj.userData.floor);
  }

  clear() {
    for (const obj of [...this.objects.values()]) {
      this.group.remove(obj);
      disposeObject(obj);
    }
    this.objects.clear();
    this.nextUid = 1;
  }

  // ---- 参照 -----------------------------------------------------------------

  defOf(obj) {
    return getDef(obj.userData.defId);
  }

  /** レイキャスト対象（現在の階のオブジェクト） */
  getPickables() {
    return [...this.objects.values()].filter((o) => this._visibleOn(o, this.currentFloor));
  }

  /** メッシュから配置オブジェクトのルートを辿る */
  findRoot(object3D) {
    let o = object3D;
    while (o && !o.userData.placeable) o = o.parent;
    return o && this.objects.has(o.userData.uid) ? o : null;
  }

  countByCategory(category) {
    let n = 0;
    for (const o of this.objects.values()) if (this.defOf(o).category === category) n++;
    return n;
  }

  /** 水槽と、それ以外の展示（屋外生け簀など） */
  get exhibits() {
    return [...this.tanks, ...this.extraExhibits()];
  }

  totalAppeal() {
    let sum = this.extraAppeal + this.extraExhibitAppeal();
    for (const o of this.objects.values()) {
      let value = this.defOf(o).appeal ?? 0;
      if (o.userData.clip) {
        for (const c of this.interiorItems(o)) value += getDef(c.userData.defId).appeal ?? 0;
        value = (value + lifeAppeal(o) * tankHealth(o) * this.themeBonus(o)) * cleanAppealFactor(o); // 汚れた水槽は魅力が下がる
      }
      sum += value;
    }
    return sum;
  }

  // ---- 階 -------------------------------------------------------------------

  setFloor(floor) {
    this.currentFloor = floor;
    for (const o of this.objects.values()) {
      // 上の階を見ているときは地面ごと下げて表示するので、突き抜けた水槽も同じだけ下げる
      o.position.y += o.userData.drop ?? 0;
      o.userData.drop = 0;
      o.visible = this._visibleOn(o, floor);
      if (o.visible && o.userData.floor !== floor) {
        o.userData.drop = (floor - o.userData.floor) * STORY_H;
        o.position.y -= o.userData.drop;
      }
    }
  }

  // ---- 幾何計算 -------------------------------------------------------------

  /** 回転を考慮した XZ 半径（AABB） */
  static footprintHalf(def, rotY) {
    const c = Math.abs(Math.cos(rotY));
    const s = Math.abs(Math.sin(rotY));
    const { w, d } = def.size;
    return { hx: (c * w + s * d) / 2, hz: (s * w + c * d) / 2 };
  }

  /** 点 (x,z) が水槽台の天板の上にあるか */
  static isOnStand(stand, x, z) {
    const def = getDef(stand.userData.defId);
    const dx = x - stand.position.x;
    const dz = z - stand.position.z;
    const c = Math.cos(-stand.rotation.y);
    const s = Math.sin(-stand.rotation.y);
    const lx = dx * c + dz * s;
    const lz = -dx * s + dz * c;
    return Math.abs(lx) <= def.size.w / 2 && Math.abs(lz) <= def.size.d / 2;
  }

  /** 水槽を (x,z) に置いたときの床からの高さ */
  elevationAt(def, x, z, floor) {
    if (def.atrium) return floor * 0;
    if (def.category !== CATEGORY.TANK) return 0;
    // 水槽台は床の上（埋め込み水槽は対象外）
    let y = 0;
    for (const o of this.objects.values()) {
      if (o.userData.floor !== floor) continue;
      const od = this.defOf(o);
      if (od.supportsTanks && TankManager.isOnStand(o, x, z)) y = Math.max(y, od.size.h);
    }
    return y;
  }

  refreshElevations(floor = this.currentFloor) {
    for (const o of this.objects.values()) {
      if (o.userData.floor !== floor || o.userData.embed || this.defOf(o).atrium) continue;
      o.position.y = this.elevationAt(this.defOf(o), o.position.x, o.position.z, floor);
    }
  }

  /** 水槽台の上に載っている水槽 */
  getRiders(stand) {
    if (!this.defOf(stand).supportsTanks) return [];
    return [...this.objects.values()].filter(
      (o) =>
        o !== stand &&
        !o.userData.embed &&
        o.userData.floor === stand.userData.floor &&
        this.defOf(o).category === CATEGORY.TANK &&
        TankManager.isOnStand(stand, o.position.x, o.position.z),
    );
  }

  // ---- 保存・復元 -----------------------------------------------------------

  serialize() {
    return [...this.objects.values()].map((o) => ({
      uid: o.userData.uid,
      defId: o.userData.defId,
      floor: o.userData.floor,
      x: round(o.position.x),
      z: round(o.position.z),
      rotY: round(o.rotation.y),
      ...(o.userData.embed && { embed: { ...o.userData.embed } }),
      ...(o.userData.name && { name: o.userData.name }),
      ...(o.userData.look && { look: o.userData.look }),
      ...(o.userData.creatures && { creatures: { ...o.userData.creatures } }),
      ...(o.userData.clean && { clean: { ...o.userData.clean } }),
      ...(o.userData.care && { care: { ...o.userData.care } }),
      ...(o.userData.clip && {
        contents: this.interiorItems(o).map((c) => ({
          defId: c.userData.defId,
          seed: c.userData.seed,
          x: round(c.position.x),
          y: round(c.position.y),
          z: round(c.position.z),
          rotY: round(c.rotation.y),
          ...(c.userData.growth && { growth: roundGrowth(c.userData.growth) }),
          ...(c.userData.locked && { locked: true }),
          ...(c.userData.bubbles !== undefined && { bubbles: c.userData.bubbles }),
          ...(c.userData.sculpted && { sculpt: encodePositions(c.getObjectByName('rock').geometry) }),
        })),
      }),
    }));
  }

  deserialize(list) {
    this.clear();
    const floors = new Set();
    for (const item of list) {
      if (!hasDef(item.defId)) {
        console.warn('Skip unknown object', item.defId);
        continue;
      }
      this.add(item.defId, item);
      floors.add(item.floor);
    }
    for (const f of floors) this.refreshElevations(f);
  }
}

const round = (v) => Math.round(v * 1000) / 1000;
const roundGrowth = (g) => ({
  ...g,
  ...(g.nodes && { nodes: g.nodes.map((n) => ({ a: n.a.map(round), b: n.b.map(round), r: Math.round(n.r * 1e4) / 1e4, p: n.p })) }),
  ...(g.parts && { parts: g.parts.map((p) => ({ pts: p.pts.map((q) => q.map(round)), r: round(p.r) })) }),
});
