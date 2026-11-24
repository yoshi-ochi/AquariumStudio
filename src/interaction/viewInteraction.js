import * as THREE from 'three';
import { CATEGORY } from '../tanks/tankData.js';

const TAP_TOLERANCE = 8; // px

/** 閲覧モード（ホーム）：タップした水槽を onTankTap、階段を onStairsTap で知らせる。ドラッグはカメラ操作に任せる */
export class ViewInteraction {
  constructor({ sceneMgr, manager, onTankTap, onStairsTap = () => {}, onFloorTap = () => {}, extraTargets = () => [] }) {
    this.sceneMgr = sceneMgr;
    this.manager = manager;
    this.onTankTap = onTankTap;
    this.onStairsTap = onStairsTap;
    this.onFloorTap = onFloorTap;
    this.extraTargets = extraTargets; // 水槽以外の展示 [[Object3D, onTap], ...]
    this.enabled = false;
    this.dom = sceneMgr.renderer.domElement;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.down = null;

    this.dom.addEventListener('pointerdown', (e) => {
      if (this.enabled && e.isPrimary) this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
      else this.down = null; // 2本指はタップではない
    });
    window.addEventListener('pointerup', (e) => {
      const d = this.down;
      this.down = null;
      if (!this.enabled || !d || !e.isPrimary) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_TOLERANCE || performance.now() - d.t > 500) return;
      const root = this._pickRoot(e);
      if (root && this.manager.defOf(root).category === CATEGORY.TANK) return this.onTankTap(root);
      if (root && this.manager.defOf(root).stairs) return this.onStairsTap(root, e);
      // 水槽に当たらなければ、プール・生け簀など水槽以外の展示
      for (const [obj, onTap] of this.extraTargets()) {
        if (this.raycaster.intersectObject(obj, true).length) return onTap();
      }
      this.onFloorTap(e);
    });
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
