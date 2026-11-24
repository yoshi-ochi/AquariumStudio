import * as THREE from 'three';
import { BASEMENT, PLAN_FLOORS, floorLabel, floorOrder, isWing, WING_BASE, WING_GRID_CENTER, CELL_SIZE } from './blueprint.js';
import { buildFloorModel } from './floorModel.js';
import { Exterior, wingCenter } from './exterior.js';

/** フロアを上下に離して並べる全館ビューの階の間隔(m) */
const STACK_GAP = 24;
/** 敷地の広さに合わせてカメラを引く倍率（間取りを広げる前の敷地 64.8m を1とする） */
const SITE_SCALE = (128 * CELL_SIZE) / 64.8; // 本館の敷地（128マス）基準。左右の屋外を広げても引きすぎない
const TWEEN = 0.8;
const ease = (t) => t * t * (3 - 2 * t);

/**
 * 表示の切り替え：floor（各階の編集画面）/ stack（全館を上下に分解した模型）/ exterior（外観）。
 * 全館ビューでは階をタップするとその階へ移動する。
 */
export class ViewModes {
  constructor({ sceneMgr, cameraCtl, room, manager, labels, pool, scenery, railEl, getFloor, getUnlocked, onFloor, onModeChange }) {
    Object.assign(this, { sceneMgr, cameraCtl, room, manager, labels, pool, scenery, railEl, getFloor, getUnlocked, onFloor, onModeChange });
    this.mode = 'floor';
    this.exterior = new Exterior(sceneMgr.scene);
    this.stack = new THREE.Group();
    this.stack.visible = false;
    sceneMgr.scene.add(this.stack);
    this.tween = null;
    this.slide = 0;
    this.raycaster = new THREE.Raycaster();
    // プレイヤーアイコンの下の小さなボタンに今の表示を出し、タップで一覧（プルダウン）を開く
    railEl.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.classList.contains('vr-cur')) return this._openList(this.railEl.querySelector('.vr-list').hidden);
      // 本館・別館の切り替えは一覧を開いたまま、その建物の階を並べ直す
      if (b.dataset.bld) {
        this.bld = b.dataset.bld;
        this.railKey = null;
        this._rail();
        this._openList(true);
        return this.syncRail();
      }
      this._openList(false);
      if (b.dataset.view) this.setMode(b.dataset.view);
      else this.goFloor(+b.dataset.floor);
    });
    document.addEventListener('pointerdown', (e) => !e.target.closest('#view-rail') && this._openList(false));
    const dom = sceneMgr.renderer.domElement;
    dom.addEventListener('pointerdown', (e) => (this.down = [e.clientX, e.clientY]));
    dom.addEventListener('pointerup', (e) => this._tapStack(e));
    this.syncRail();
  }

  /**
   * 表示の一覧：全館・外観 ／ 本館・別館の切り替え ／ 選んだ建物の各階（別館は解放済みの階だけ）。
   * 建物や階が変わったときだけ作り直す
   */
  _rail() {
    const all = floorOrder(this.getUnlocked()).reverse();
    const hasWing = all.some(isWing);
    this.bld ??= isWing(this.getFloor()) ? 'wing' : 'main';
    if (!hasWing) this.bld = 'main';
    const floors = all.filter((f) => (this.bld === 'wing') === isWing(f));
    const key = `${this.bld}:${all.join(',')}`;
    if (key === this.railKey) return;
    this.railKey = key;
    const bld = (id, label, off) => `<button data-bld="${id}" class="vr-bld ${this.bld === id ? 'on' : ''}" ${off ? 'disabled' : ''}>${label}</button>`;
    this.railEl.innerHTML = `<button class="vr-cur" aria-haspopup="listbox" aria-label="表示の切り替え"></button>
      <div class="vr-list" role="listbox" hidden><button data-view="stack">全館</button><button data-view="exterior">外観</button>
      <div class="vr-seg">${bld('main', '本館')}${bld('wing', '別館', !hasWing)}</div>
      ${floors.map((f) => `<button data-floor="${f}" class="${isWing(f) ? 'wing' : ''}">${floorLabel(f)}</button>`).join('')}</div>`;
  }

  _openList(open) {
    const list = this.railEl.querySelector('.vr-list');
    if (!list) return;
    list.hidden = !open;
    this.railEl.classList.toggle('open', open);
  }

  syncRail() {
    // 今いる階の建物に合わせる（一覧で別館を選んだだけのときは、そのまま）
    if (this.mode === 'floor' && !this.railEl.classList.contains('open')) this.bld = isWing(this.getFloor()) ? 'wing' : 'main';
    this._rail();
    let label = '';
    this.railEl.querySelectorAll('.vr-list button').forEach((b) => {
      const on = b.dataset.view ? b.dataset.view === this.mode : this.mode === 'floor' && +b.dataset.floor === this.getFloor();
      b.classList.toggle('active', on);
      if (on) label = b.textContent;
    });
    this.railEl.querySelector('.vr-cur').innerHTML = `<span>${label}</span><i>▾</i>`;
  }

  /** 階を移動する（上下にスライドして切り替える） */
  goFloor(floor) {
    const from = this.getFloor();
    if (this.mode !== 'floor') this.setMode('floor');
    if (floor !== from) {
      this.onFloor(floor);
      this.slide = Math.max(-4.8, Math.min(4.8, (floor - from) * 2.4));
    }
    this.syncRail();
  }

  setMode(mode) {
    if (mode === this.mode) return;
    if (this.mode === 'floor') this.saved = this._camera();
    this.mode = mode;
    const floor = mode === 'floor';
    this.room.group.visible = floor;
    this.room.built.visible = floor;
    this.manager.group.visible = floor;
    this.labels.group.visible = floor;
    const wings = floorOrder(this.getUnlocked()).filter(isWing);
    this.exterior.show(mode === 'exterior', wings.length);
    this.stack.visible = mode === 'stack';
    // 引きの表示では霞ませない
    const scene = this.sceneMgr.scene;
    if (!floor && scene.fog) [this.fog, scene.fog] = [scene.fog, null];
    else if (floor && this.fog) [scene.fog, this.fog] = [this.fog, null];
    const under = floor && this.getFloor() === BASEMENT;
    const away = under || (floor && isWing(this.getFloor())); // 地下と別館では本館の屋外を出さない
    this.room.setUnderground(under);
    this.pool.group.visible = mode !== 'stack' && !away && this.getUnlocked().has('pool');
    this.scenery.group.visible = mode !== 'stack' && !away;
    if (mode === 'stack') this._buildStack();
    const c = this.cameraCtl.controls;
    c.maxDistance = floor ? this.saved?.maxDistance ?? c.maxDistance : 260 * SITE_SCALE;
    c.maxPolarAngle = Math.PI / 2 - 0.03;
    if (floor && this.saved) this._fly(this.saved.pos, this.saved.target);
    else if (mode === 'stack') {
      // 別館があるときは、本館の裏に並ぶ別館の階も入るよう引いて斜めから見る
      if (wings.length) this._fly(this._away(70, 96 + wings.length * 8, 70, 10), new THREE.Vector3(0, 10, wingCenter().z / 2));
      else this._fly(this._away(16, 84, 74, 4), new THREE.Vector3(0, 4, 0));
    } else if (mode === 'exterior') {
      // 別館は本館の裏なので、大屋根に隠れないよう高い位置から見下ろす
      if (wings.length) this._fly(this._away(-55, 66 + wings.length * 3, 48, 6), new THREE.Vector3(0, 6, wingCenter().z / 2));
      else this._fly(this._away(-34, 20, 62, 5), new THREE.Vector3(0, 5, 4));
    }
    this.syncRail();
    this.onModeChange(mode);
  }

  /** 縦長の画面でも建物全体が収まるようカメラを引く */
  _away(x, y, z, targetY) {
    const k = Math.max(1, 0.72 / this.cameraCtl.camera.aspect) * SITE_SCALE;
    return new THREE.Vector3(x * k, targetY + (y - targetY) * k, z * k);
  }

  _camera() {
    const c = this.cameraCtl.controls;
    return { pos: this.cameraCtl.camera.position.clone(), target: c.target.clone(), maxDistance: c.maxDistance };
  }

  _fly(pos, target) {
    const c = this.cameraCtl.controls;
    this.tween = { t: 0, pos, target, fromPos: this.cameraCtl.camera.position.clone(), fromTarget: c.target.clone() };
  }

  /** 毎フレーム：カメラの移動と、階を切り替えたときのスライド */
  update(dt) {
    if (this.tween) {
      const w = this.tween;
      w.t = Math.min(1, w.t + dt / TWEEN);
      const k = ease(w.t);
      this.cameraCtl.camera.position.lerpVectors(w.fromPos, w.pos, k);
      this.cameraCtl.controls.target.lerpVectors(w.fromTarget, w.target, k);
      if (w.t >= 1) this.tween = null;
    }
    this.slide *= Math.exp(-dt * 9);
    if (Math.abs(this.slide) < 0.01) this.slide = 0;
    this.room.built.position.y = this.manager.group.position.y = -this.slide;
    this.room.lightGroup.position.y = -this.slide;
  }

  // ---- 全館ビュー --------------------------------------------------------------

  _buildStack() {
    this.stack.traverse((o) => {
      o.geometry?.dispose();
      o.material?.map?.dispose();
      o.material?.dispose();
    });
    this.stack.clear();
    this.slabs = [];
    const unlocked = this.getUnlocked();
    for (const f of [...PLAN_FLOORS, ...floorOrder(unlocked).filter(isWing)]) this.stack.add(this._floorModel(f, unlocked));
  }

  _floorModel(floor, unlocked) {
    const g = buildFloorModel({ floor, unlocked, manager: this.manager });
    g.position.y = floor === BASEMENT ? -STACK_GAP : isWing(floor) ? (floor - WING_BASE) * STACK_GAP : floor * STACK_GAP;
    // 別館の階は、外観と同じく本館の裏に並べる（各階の模型は敷地の格子のままなので、別館の区画を裏へずらす）
    if (isWing(floor)) {
      const c = wingCenter();
      g.position.set(c.x - WING_GRID_CENTER.x, g.position.y, c.z - WING_GRID_CENTER.z);
    }
    this.slabs.push(g.userData.slab);
    return g;
  }

  _tapStack(e) {
    if (this.mode !== 'stack' || !this.down || Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) > 8) return;
    const r = e.target.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.cameraCtl.camera);
    const hit = this.raycaster.intersectObjects(this.slabs, false)[0];
    if (hit) this.goFloor(hit.object.userData.floor);
  }
}
