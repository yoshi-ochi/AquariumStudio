import * as THREE from 'three';
import { CELL } from '../room/floorPlan.js';

/** 指で掴みやすいよう、ハンドルの近く（画面上の距離）を押しても掴めるようにする */
const GRAB_PX = 44;
const TAP_PX = 8;
const TAP_MS = 450;

/**
 * 室内ライトの操作（部屋 > 照明 を開いている間だけ有効）。
 * - 床（館内・バックヤード）をタップ → その場所に照明を追加（真下を照らす）
 * - 床のリング、または電球をドラッグ → 照明を移動（照らす向きはそのまま）
 * - リングの中央の ● をドラッグ → 照らす場所（向き）を変える
 * ハンドルは画面上で少し離れた所を押しても掴める。掴んだ位置からずらすので、押した瞬間に飛ばない。
 * ハンドルを掴んだときは他の操作（オブジェ選択・カメラ）にイベントを渡さない。
 */
export class LightInteraction {
  constructor({ sceneMgr, cameraCtl, room, manager, getSettings, onSelect, onChanged, onAdd }) {
    Object.assign(this, { sceneMgr, cameraCtl, room, manager, getSettings, onSelect, onChanged, onAdd });
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
    const b = this.room.plan.bounds();
    const x = THREE.MathUtils.clamp(p.x + this.drag.dx, b.x0, b.x1);
    const z = THREE.MathUtils.clamp(p.z + this.drag.dz, b.z0, b.z1);
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
    // 水槽やオブジェをタップしたときは追加しない
    if (this.raycaster.intersectObjects(this.manager.getPickables(), true).length) return;
    const p = this._onPlane(0);
    const t = p && this.room.plan.typeAt(p.x, p.z);
    if (t === CELL.FLOOR || t === CELL.YARD) this.onAdd?.(p.x, p.z);
  };
}
