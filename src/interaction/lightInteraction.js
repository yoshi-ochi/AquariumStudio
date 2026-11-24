import * as THREE from 'three';
import { CELL } from '../room/floorPlan.js';
import { ZONES, ZONE_TYPE } from '../building/blueprint.js';

/** 指で掴みやすいよう、ハンドルの近く（画面上の距離）を押しても掴めるようにする */
const GRAB_PX = 44;
const TAP_PX = 8;
const TAP_MS = 450;

/**
 * 室内ライトの操作（部屋 > 照明 を開いている間だけ有効）。
 * - 部屋の外から部屋をタップ → その部屋の中に入って照明を編集する（onEnterRoom）
 * - 部屋の中で床か天井をタップ → その場所に照明を追加（真下を照らす）
 * - 床のリング、または電球をドラッグ → 照明を移動（照らす向きはそのまま）
 * - リングの中央の ● をドラッグ → 照らす場所（向き）を変える
 * ハンドルは画面上で少し離れた所を押しても掴める。掴んだ位置からずらすので、押した瞬間に飛ばない。
 * ハンドルを掴んだときは他の操作（オブジェ選択・カメラ）にイベントを渡さない。
 */
export class LightInteraction {
  constructor({ sceneMgr, cameraCtl, room, manager, getSettings, onSelect, onChanged, onAdd, onEnterRoom }) {
    Object.assign(this, { sceneMgr, cameraCtl, room, manager, getSettings, onSelect, onChanged, onAdd, onEnterRoom });
    this.enabled = false;
    this.dom = sceneMgr.renderer.domElement;
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.drag = null;
    this.tap = null;

    this.dom.addEventListener('pointerdown', this._onDown, { capture: true });
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onUp);
  }

  _ray(e) {
    const r = this.dom.getBoundingClientRect();
    const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(p, this.sceneMgr.camera);
  }

  /** 高さ y の水平面と、指の下の視線の交点 */
  _onPlane(y) {
    this.plane.constant = -y;
    return this.raycaster.ray.intersectPlane(this.plane, new THREE.Vector3());
  }

  /** そのマスの部屋（館内・バックヤードのエリア）の id */
  _zoneAt(x, z) {
    const plan = this.room.plan;
    const [i, j] = plan.cellOf(x, z);
    const t = plan.at(i, j);
    if (t !== CELL.FLOOR && t !== CELL.YARD) return null;
    const zone = ZONES[plan.zoneIds[plan.idx(i, j)]];
    return zone && zone.type !== ZONE_TYPE.OUTDOOR ? zone.id : null;
  }

  /** 指の下のハンドル。直接当たらなければ、画面上で一番近いハンドル（GRAB_PX 以内） */
  _pick(e) {
    const hit = this.raycaster.intersectObjects(this.room.handles, false)[0];
    if (hit) return hit.object.userData;
    const r = this.dom.getBoundingClientRect();
    const cam = this.sceneMgr.camera;
    let best = null;
    let bestD = GRAB_PX;
    const v = new THREE.Vector3();
    for (const h of this.room.handles) {
      h.getWorldPosition(v).project(cam);
      if (v.z > 1) continue; // カメラの後ろ
      const d = Math.hypot(r.left + ((v.x + 1) / 2) * r.width - e.clientX, r.top + ((1 - v.y) / 2) * r.height - e.clientY);
      // 同じくらいの距離なら、選択中のライトと向きのハンドルを優先
      const bias = (h.userData.lightIndex === this.room.selectedLight ? -6 : 0) + (h.userData.handle === 'aim' ? -2 : 0);
      if (d + bias < bestD) {
        bestD = d + bias;
        best = h.userData;
      }
    }
    return best;
  }

  _onDown = (e) => {
    if (!this.enabled || !e.isPrimary || e.button !== 0) return;
    this._ray(e);
    const picked = this._pick(e);
    if (!picked) {
      // ハンドル以外：短いタップなら照明を追加（カメラ操作はそのまま）
      this.tap = { x: e.clientX, y: e.clientY, t: performance.now() };
      return;
    }
    const { lightIndex, handle } = picked;
    const l = this.getSettings().lights[lightIndex];
    if (!l) return;
    e.stopImmediatePropagation(); // 選択・カメラ操作に渡さない
    this.cameraCtl.setEnabled(false);
    // 掴んだ点とライト（または照射点）のずれを保つ
    const y = handle === 'bulb' ? l.height : 0;
    const p = this._onPlane(y) ?? new THREE.Vector3(l.x, y, l.z);
    const [ax, az] = handle === 'aim' ? [l.tx, l.tz] : [l.x, l.z];
    this.drag = { lightIndex, handle, y, dx: ax - p.x, dz: az - p.z };
    this.onSelect?.(lightIndex);
  };

  _onMove = (e) => {
    if (this.tap && Math.hypot(e.clientX - this.tap.x, e.clientY - this.tap.y) > TAP_PX) this.tap = null;
    if (!this.drag || !e.isPrimary) return;
    const l = this.getSettings().lights[this.drag.lightIndex];
    this._ray(e);
    const p = this._onPlane(this.drag.y);
    if (!p) return;
    const x = p.x + this.drag.dx;
    const z = p.z + this.drag.dz;
    if (this._zoneAt(x, z) !== l.zone) return; // 照明は置いた部屋の中だけ
    if (this.drag.handle === 'aim') {
      l.tx = x;
      l.tz = z;
    } else {
      // 照射点も一緒に平行移動（向きを保つ）
      l.tx += x - l.x;
      l.tz += z - l.z;
      l.x = x;
      l.z = z;
    }
    this.room.updateLight(this.drag.lightIndex, l);
  };

  _onUp = (e) => {
    if (!e.isPrimary) return;
    const tap = this.tap;
    this.tap = null;
    if (this.drag) {
      this.drag = null;
      this.cameraCtl.setEnabled(true);
      this.onChanged?.();
      return;
    }
    if (!this.enabled || !tap || performance.now() - tap.t > TAP_MS || Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > TAP_PX) return;
    if (e.target !== this.dom) return;
    this._ray(e);
    const focus = this.room.focusZone;
    if (!focus) {
      // 部屋の外：タップした部屋の中に入る
      const p = this._onPlane(0);
      const zone = p && this._zoneAt(p.x, p.z);
      if (zone) this.onEnterRoom?.(zone);
      return;
    }
    // 水槽やオブジェをタップしたときは追加しない
    if (this.raycaster.intersectObjects(this.manager.getPickables(), true).length) return;
    // 部屋の中：視線が先に当たる床か天井の位置に追加
    const ray = this.raycaster.ray;
    const hits = [0, this.room.ceilingHeight]
      .map((y) => (Math.abs(ray.direction.y) > 1e-4 ? (y - ray.origin.y) / ray.direction.y : -1))
      .filter((t) => t > 0)
      .sort((a, b) => a - b);
    if (!hits.length) return;
    const p = ray.at(hits[0], new THREE.Vector3());
    if (this._zoneAt(p.x, p.z) === focus) this.onAdd?.(p.x, p.z);
  };
}
