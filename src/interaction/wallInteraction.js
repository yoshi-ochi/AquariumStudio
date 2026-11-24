import * as THREE from 'three';
import { TankManager } from '../tanks/tankManager.js';
import { WALL_EDITS } from '../building/blueprint.js';
import { WALKABLE } from '../room/floorPlan.js';

const TAP_PX = 8;

/**
 * 壁の自由編集（レベル4以降）。マス目の交点を2回タップして、その間に壁を足す／撤去する。
 * 歩ける範囲を分断する壁や、物の下を通る壁は作れない。
 */
export class WallInteraction {
  constructor({ sceneMgr, room, manager, toast, getBrush, onChanged }) {
    Object.assign(this, { sceneMgr, room, manager, toast, getBrush, onChanged });
    this.enabled = false;
    this.start = null;
    this.dom = sceneMgr.renderer.domElement;
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.marker = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd36b, depthTest: false }));
    this.marker.renderOrder = 960;
    this.marker.visible = false;
    sceneMgr.scene.add(this.marker);
    this.dom.addEventListener('pointerdown', (e) => (this.down = this.enabled && e.isPrimary ? [e.clientX, e.clientY] : null));
    window.addEventListener('pointerup', (e) => {
      const d = this.down;
      this.down = null;
      if (this.enabled && d && e.isPrimary && Math.hypot(e.clientX - d[0], e.clientY - d[1]) <= TAP_PX) this._tap(e);
    });
  }

  setEnabled(v) {
    this.enabled = v;
    this.start = null;
    this.marker.visible = false;
  }

  _tap(e) {
    const r = this.dom.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.sceneMgr.camera);
    const hit = this.raycaster.ray.intersectPlane(this.plane, new THREE.Vector3());
    if (!hit) return;
    const plan = this.room.plan;
    const vertex = [Math.round(hit.x / plan.cell + plan.GX / 2), Math.round(hit.z / plan.cell + plan.Z0)];
    if (!this.start) {
      this.start = vertex;
      const [x, z] = plan.cellMin(vertex[0], vertex[1]);
      this.marker.position.set(x, 0.25, z);
      this.marker.visible = true;
      return;
    }
    const from = this.start;
    this.start = null;
    this.marker.visible = false;
    this._apply(from, vertex);
  }

  /** 2つの交点を結ぶ直線上の境目（縦か横の長い方向にそろえる） */
  _edges([i0, j0], [i1, j1]) {
    const out = [];
    if (Math.abs(i1 - i0) >= Math.abs(j1 - j0)) {
      for (let i = Math.min(i0, i1); i < Math.max(i0, i1); i++) out.push([i, j0 - 1, i, j0]);
    } else {
      for (let j = Math.min(j0, j1); j < Math.max(j0, j1); j++) out.push([i0 - 1, j, i0, j]);
    }
    return out;
  }

  _underObject(plan, [a, b, c, d]) {
    const [x, z] = plan.cellMin(c, d);
    const vertical = a !== c;
    const mid = vertical ? [x, z + plan.cell / 2] : [x + plan.cell / 2, z];
    return [...this.manager.objects.values()].some((o) => {
      if (o.userData.floor !== plan.floor || o.userData.embed) return false;
      const { hx, hz } = TankManager.footprintHalf(this.manager.defOf(o), o.rotation.y);
      return Math.abs(o.position.x - mid[0]) < hx && Math.abs(o.position.z - mid[1]) < hz;
    });
  }

  _apply(from, to) {
    const plan = this.room.plan;
    const adding = this.getBrush() === 'add';
    const edits = (WALL_EDITS[plan.floor] ??= { add: [], remove: [] });
    const before = { add: [...edits.add], remove: [...edits.remove] };
    const parts = plan.componentCount();
    let changed = 0;
    for (const e of this._edges(from, to)) {
      const [a, b, c, d] = e;
      if (!WALKABLE(plan.at(a, b)) || !WALKABLE(plan.at(c, d))) continue;
      const key = plan.edge(a, b, c, d);
      const open = plan.passable(a, b, c, d);
      if (adding === !open) continue; // すでに希望の状態
      if (adding && this._underObject(plan, e)) return this._fail(edits, before, '物が置かれている場所には壁を作れません');
      this._toggle(edits, key, adding);
      changed++;
    }
    if (!changed) return this.toast(adding ? '壁を作れる場所がありません' : '撤去できる壁がありません', { error: true });
    this.onChanged();
    if (this.room.plan.componentCount() > parts) {
      this._fail(edits, before, '館内が行き止まりで分断されるため、この壁は作れません');
      this.onChanged();
    }
  }

  _toggle(edits, key, adding) {
    const [on, off] = adding ? [edits.add, edits.remove] : [edits.remove, edits.add];
    const at = off.indexOf(key);
    if (at >= 0) off.splice(at, 1);
    else on.push(key);
  }

  _fail(edits, before, message) {
    edits.add = before.add;
    edits.remove = before.remove;
    this.toast(message, { error: true });
  }
}
