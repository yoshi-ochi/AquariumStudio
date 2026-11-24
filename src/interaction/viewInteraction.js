import * as THREE from 'three';
import { CATEGORY } from '../tanks/tankData.js';

const TAP_TOLERANCE = 8; // px
/** 床の長押しとみなす時間(ms) */
const LONG_PRESS_MS = 550;

/**
 * 閲覧モード（ホーム）：タップした水槽を onTankTap、階段を onStairsTap で知らせる。ドラッグはカメラ操作に任せる。
 * 水槽などのない床を長押しすると onFloorLongPress（部屋の中のプレビュー）
 */
export class ViewInteraction {
  constructor({ sceneMgr, manager, onTankTap, onStairsTap = () => {}, onFloorLongPress = () => {}, extraTargets = () => [] }) {
    this.sceneMgr = sceneMgr;
    this.manager = manager;
    this.onTankTap = onTankTap;
    this.onStairsTap = onStairsTap;
    this.onFloorLongPress = onFloorLongPress;
    this.extraTargets = extraTargets; // 水槽以外の展示 [[Object3D, onTap], ...]
    this.enabled = false;
    this.dom = sceneMgr.renderer.domElement;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.down = null;

    this.dom.addEventListener('pointerdown', (e) => {
      clearTimeout(this.pressTimer);
      if (this.enabled && e.isPrimary) {
        const d = (this.down = { x: e.clientX, y: e.clientY, t: performance.now(), cx: e.clientX, cy: e.clientY });
        // 動かさずに押し続けたら、何もない床の長押し
        this.pressTimer = setTimeout(() => {
          if (this.down !== d || Math.hypot(d.cx - d.x, d.cy - d.y) > TAP_TOLERANCE) return;
          this.down = null;
          if (!this._hitsSomething(d.x, d.y)) this.onFloorLongPress({ clientX: d.x, clientY: d.y });
        }, LONG_PRESS_MS);
      } else this.down = null; // 2本指はタップではない
    });
    window.addEventListener('pointermove', (e) => {
      if (this.down && e.isPrimary) [this.down.cx, this.down.cy] = [e.clientX, e.clientY];
    });
    window.addEventListener('pointerup', (e) => {
      const d = this.down;
      this.down = null;
      clearTimeout(this.pressTimer);
      if (!this.enabled || !d || !e.isPrimary) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_TOLERANCE || performance.now() - d.t > 500) return;
      const root = this._pickRoot(e);
      if (root && this.manager.defOf(root).category === CATEGORY.TANK) return this.onTankTap(root);
      if (root && this.manager.defOf(root).stairs) return this.onStairsTap(root, e);
      // 水槽に当たらなければ、プール・生け簀など水槽以外の展示
      for (const [obj, onTap] of this.extraTargets()) {
        if (this.raycaster.intersectObject(obj, true).length) return onTap();
      }
    });
  }

  /** その点に水槽・オブジェ・プールなどがあるか */
  _hitsSomething(x, y) {
    if (this._pickRoot({ clientX: x, clientY: y })) return true;
    return this.extraTargets().some(([obj]) => this.raycaster.intersectObject(obj, true).length);
  }

  _pickRoot(e) {
    const r = this.dom.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.sceneMgr.camera);
    for (const h of this.raycaster.intersectObjects(this.manager.getPickables(), true)) {
      const root = this.manager.findRoot(h.object);
      if (root) return root;
    }
    return null;
  }
}
