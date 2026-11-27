import * as THREE from 'three';
import { buildObject, disposeObject } from '../tanks/tankBuilder.js';
import { BUILD_SHAPES, customDef, normalizeSpec, registerCustom, validPoly, volumeOf } from '../tanks/customTanks.js';
import { tankCapacity } from '../expedition/tankLife.js';
import { coin as yen } from '../ui/currency.js';

/**
 * 館内でその場に水槽を設計して建造する。
 *   四角：床をドラッグして範囲を決める / 円形：中心からドラッグして半径を決める / 自由形：床をタップして角を置く
 * 10cm の格子に合わせ、高さはパネルで決める。確定するとその位置に設置する。
 */
const GRID = 0.1; // m
const snap = (v) => Math.round(v / GRID) * GRID;

export class BuildInPlace {
  constructor({ sceneMgr, cameraCtl, manager, economy, hall, toast, panelEl, onPlaced }) {
    Object.assign(this, { sceneMgr, cameraCtl, manager, economy, hall, toast, panelEl, onPlaced });
    this.dom = sceneMgr.renderer.domElement;
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.active = false;
    this.shape = 'box';
    this.height = 60;
    this.rect = null; // { a: [x,z], b: [x,z] }
    this.pts = []; // 自由形の角（ワールド座標）
    this.ghost = null;
    this.helper = new THREE.Box3Helper(new THREE.Box3(), 0x4cd18a);
    this.helper.material.depthTest = false;
    this.helper.renderOrder = 999;
    this.helper.visible = false;
    this.marks = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xff8a1f, depthTest: false }));
    this.marks.renderOrder = 999;
    this.marks.visible = false;
    sceneMgr.scene.add(this.helper, this.marks);

    this.dom.addEventListener('pointerdown', this._onDown);
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    panelEl.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (b) this._act(b.dataset.act, b.dataset.v);
    });
    panelEl.addEventListener('input', (e) => {
      if (e.target.dataset.field !== 'bip-height') return;
      this.height = Number(e.target.value);
      e.target.parentElement.querySelector('output').textContent = `${this.height}cm`;
      this._update(false);
    });
  }

  setActive(v) {
    this.active = v;
    this.panelEl.hidden = !v;
    if (!v) {
      this._clear();
      this._endDrag();
    } else this.render();
  }

  // ---- 設計中の水槽 -----------------------------------------------------------

  /** 今の入力の仕様と設置位置。形になっていなければ null */
  get _plan() {
    if (this.shape === 'box') {
      if (!this.rect) return null;
      const [ax, az] = this.rect.a;
      const [bx, bz] = this.rect.b;
      const w = Math.round(Math.abs(bx - ax) * 100);
      const d = Math.round(Math.abs(bz - az) * 100);
      if (w < 20 || d < 20) return null;
      const spec = normalizeSpec({ shape: 'box', w, d, h: this.height });
      return { spec, x: (ax + bx) / 2, z: (az + bz) / 2 };
    }
    if (this.shape === 'cylinder') {
      if (!this.rect) return null;
      const [ax, az] = this.rect.a;
      const [bx, bz] = this.rect.b;
      const dia = Math.round((2 * Math.hypot(bx - ax, bz - az)) / GRID) * GRID;
      if (dia < 0.3) return null;
      return { spec: normalizeSpec({ shape: 'cylinder', w: Math.round(dia * 100), h: this.height }), x: ax, z: az };
    }
    if (this.pts.length < 3) return null;
    const units = this.pts.map(([x, z]) => [Math.round(x / GRID), Math.round(z / GRID)]);
    const spec = normalizeSpec({ shape: 'poly', h: this.height, pts: units });
    if (!validPoly(spec)) return null;
    const xs = units.map((p) => p[0]);
    const zs = units.map((p) => p[1]);
    return { spec, x: ((Math.min(...xs) + Math.max(...xs)) / 2) * GRID, z: ((Math.min(...zs) + Math.max(...zs)) / 2) * GRID };
  }

  _clear() {
    this.rect = null;
    this.pts = [];
    this._setGhost(null);
    this.marks.visible = false;
  }

  _setGhost(def, x = 0, z = 0) {
    if (this.ghost) {
      this.sceneMgr.scene.remove(this.ghost);
      disposeObject(this.ghost);
      this.ghost = null;
    }
    this.helper.visible = false;
    if (!def) return;
    this.ghost = buildObject(def);
    this.ghost.position.set(x, 0, z);
    this.sceneMgr.scene.add(this.ghost);
    this.helper.box.setFromObject(this.ghost);
    this.helper.material.color.set(this._valid(def, x, z) ? 0x4cd18a : 0xff6b6b);
    this.helper.visible = true;
  }

  _valid(def, x, z) {
    return this.hall._fits(def, 0, x, z) && this.economy.canAfford(def.price);
  }

  /** 入力が変わったら見本とパネルを更新（rebuild=false でも見本は作り直す） */
  _update(rerender = true) {
    const plan = this._plan;
    this._setGhost(plan ? customDef(plan.spec) : null, plan?.x, plan?.z);
    // 自由形の途中は、置いた角を線で見せる
    if (this.shape === 'poly' && this.pts.length) {
      const p = this.pts.map(([x, z]) => new THREE.Vector3(x, 0.03, z));
      if (this.pts.length >= 3) p.push(p[0]);
      this.marks.geometry.dispose();
      this.marks.geometry = new THREE.BufferGeometry().setFromPoints(p.length > 1 ? p : [p[0], p[0].clone().setY(0.4)]);
      this.marks.visible = true;
    } else this.marks.visible = false;
    if (rerender) this.render();
    else this._renderInfo();
  }

  // ---- パネル -----------------------------------------------------------------

  render() {
    const seg = [['box', '四角'], ['cylinder', '円形'], ['poly', '自由形']].map(([k, l]) => `<button data-act="shape" data-v="${k}" class="${this.shape === k ? 'active' : ''}">${l}</button>`).join('');
    const how = {
      box: '床をドラッグして水槽の範囲を決めます（10cm単位）。視点は2本指で動かせます。',
      cylinder: '水槽の中心から外へドラッグして、円の大きさを決めます（直径10cm単位）。視点は2本指で動かせます。',
      poly: '床をタップして水槽の角を順に置きます（10cm単位）。最後の角と最初の角は自動でつながります。',
    }[this.shape];
    const L = BUILD_SHAPES[this.shape].limits.h;
    const max = BUILD_SHAPES[this.shape].limits.w;
    const size = max ? `<p class="note">最大 ${max[1] / 100}m${this.shape === 'cylinder' ? '（直径）' : `×${BUILD_SHAPES.box.limits.d[1] / 100}m`}・高さ ${L[1] / 100}m まで</p>` : `<p class="note">最大 10m×10m・高さ ${L[1] / 100}m まで</p>`;
    this.panelEl.innerHTML = `<div class="seg">${seg}</div>
      <p class="note">${how}</p>${size}
      <label class="slider">高さ<input type="range" data-field="bip-height" min="${L[0]}" max="${L[1]}" step="5" value="${this.height}"><output>${this.height}cm</output></label>
      <div class="bip-info"></div>
      <div class="seg">${this.shape === 'poly' ? `<button data-act="undo" ${this.pts.length ? '' : 'disabled'}>1つ戻す</button>` : ''}<button data-act="clear">やり直す</button><button data-act="build" class="primary">建造して設置</button></div>`;
    this._renderInfo();
  }

  _renderInfo() {
    const info = this.panelEl.querySelector('.bip-info');
    const btn = this.panelEl.querySelector('[data-act="build"]');
    if (!info) return;
    const plan = this._plan;
    if (!plan) {
      info.innerHTML = `<p class="note">${this.shape === 'poly' && this.pts.length >= 3 ? '辺が交差しています。1つ戻すかやり直してください' : 'まだ形が決まっていません'}</p>`;
      btn.disabled = true;
      return;
    }
    const def = customDef(plan.spec);
    const fits = this.hall._fits(def, 0, plan.x, plan.z);
    const money = this.economy.canAfford(def.price);
    info.innerHTML = `<p class="note"><b>${def.name}</b> ・ 水量 ${Math.round(volumeOf(plan.spec) * 1000).toLocaleString('ja-JP')}L ・ 収容枠 ${tankCapacity(def)} ・ 集客 ${def.appeal}<br>建造費 <b>${yen(def.price)}</b>${fits ? '' : ' ・ <b class="bip-ng">床からはみ出しています</b>'}${money ? '' : ' ・ <b class="bip-ng">資金が足りません</b>'}</p>`;
    btn.disabled = !fits || !money;
  }

  _act(act, v) {
    if (act === 'shape') {
      this.shape = v;
      this._clear();
    } else if (act === 'clear') this._clear();
    else if (act === 'undo') this.pts.pop();
    else if (act === 'build') return this._build();
    this._update();
  }

  _build() {
    const plan = this._plan;
    if (!plan) return;
    const def = customDef(plan.spec);
    if (!this.hall._fits(def, 0, plan.x, plan.z)) return this.toast('床からはみ出しています', { error: true });
    if (!this.economy.spend(def.price)) return this.toast('コインが足りません', { error: true });
    registerCustom(plan.spec);
    const obj = this.manager.add(def.id, { x: plan.x, z: plan.z });
    this.manager.refreshElevations();
    this.toast(`${def.name} を建造して設置しました`);
    this._clear();
    this.render();
    this.onPlaced?.(obj);
  }

  // ---- 床の操作 ---------------------------------------------------------------

  _hit(e) {
    const r = this.dom.getBoundingClientRect();
    const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(p, this.sceneMgr.camera);
    const out = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.plane, out) ? [snap(out.x), snap(out.z)] : null;
  }

  _endDrag() {
    if (!this.dragging) return;
    this.dragging = false;
    this.cameraCtl.setEnabled(true);
  }

  _onDown = (e) => {
    if (!this.active || !e.isPrimary || e.button !== 0) return;
    this.down = { x: e.clientX, y: e.clientY };
    if (this.shape === 'poly') return;
    const h = this._hit(e);
    if (!h) return;
    this.cameraCtl.setEnabled(false);
    this.dragging = true;
    this.rect = { a: h, b: h };
    this._update(false);
  };

  _onMove = (e) => {
    if (!this.active || !this.dragging || !e.isPrimary) return;
    const h = this._hit(e);
    if (!h || (h[0] === this.rect.b[0] && h[1] === this.rect.b[1])) return;
    this.rect.b = h;
    this._update(false);
  };

  _onUp = (e) => {
    if (!this.active || !e.isPrimary) return;
    const down = this.down;
    this.down = null;
    if (this.dragging) {
      this._endDrag();
      return this._update();
    }
    // 自由形：タップ（ほぼ動かさずに離した）で角を置く
    if (this.shape === 'poly' && down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && e.target === this.dom) {
      const h = this._hit(e);
      const last = this.pts[this.pts.length - 1];
      if (!h || (last && last[0] === h[0] && last[1] === h[1]) || this.pts.length >= 40) return;
      this.pts.push(h);
      this._update();
    }
  };
}
