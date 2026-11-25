import * as THREE from 'three';
import { startCoralEdit, moveCoralEdit } from './coralEdit.js';
import { floorAt } from '../tanks/tankClip.js';
import { getDef } from '../tanks/tankData.js';
import { REFUND_RATE } from '../management/stageData.js';
import { BRUSH_DEFAULTS, sculptAt, createBrushCursor } from '../interior/sculpt.js';
import { MAX_EXT } from '../tanks/growth.js';

const CLICK_TOLERANCE = 5; // px
const ROTATE_STEP = Math.PI / 4;
const EMBED = 0.12; // 岩などを接地面に少し沈める割合（高さ比）

/**
 * 水槽内モードの操作。座標はすべて水槽ローカルで扱う。
 * - 移動先は「他の水槽内オブジェの表面」または「底砂の面」へのレイキャスト → 積み上げ可能
 * - 中心点は水槽の内側にクランプするが、はみ出した部分はシェーダーでクリップされる
 * - 高さ（Y）は制限しない
 */
export class InteriorInteraction {
  constructor({ sceneMgr, cameraCtl, manager, economy, customizer, toast, onPlacementChange, onChanged, onExitRequest, onBrushChange, onGrowChange }) {
    Object.assign(this, { sceneMgr, cameraCtl, manager, economy, customizer, toast, onPlacementChange, onChanged, onExitRequest, onBrushChange, onGrowChange });
    this.dom = sceneMgr.renderer.domElement;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.plane = new THREE.Plane();
    this.tank = null;
    this.placing = null; // { def, ghost, helper, valid }
    this.drag = null;
    this.down = null;

    // 岩肌ブラシ
    this.brush = { ...BRUSH_DEFAULTS };
    this.sculpting = null; // { item }
    this.cursor = createBrushCursor();
    sceneMgr.scene.add(this.cursor);
    this._n = new THREE.Vector3();

    // 成長（サンゴ・流木・海藻）：モードをオンにして本体を上下ドラッグ
    this.growMode = null; // null | 'extend'（ドラッグ方向へ伸ばす）| 'trunk'（流木の幹を太く）
    this.growing = null; // { item, plane, startLocal, startExt, startY, startTrunk, value, dirty }

    this.dom.addEventListener('pointerdown', this._onDown, { capture: true });
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onUp);
    window.addEventListener('keydown', this._onKey);
  }

  get enabled() {
    return !!this.tank;
  }

  attach(tank) {
    this.tank = tank;
  }

  detach() {
    this.setBrush('mode', null);
    this.setGrowMode(null);
    this.cancelPlacement();
    this.customizer.deselect();
    this.tank = null;
  }

  // ---- 幾何 -----------------------------------------------------------------

  _setPointer(e) {
    const r = this.dom.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.sceneMgr.camera);
  }

  _items(exclude) {
    return this.manager.interiorItems(this.tank).filter((c) => c !== exclude);
  }

  /** ポインタ下の設置面（水槽ローカル座標）。他オブジェの表面 > 底砂の面 */
  _surfaceHit(exclude) {
    const hits = this.raycaster.intersectObjects(this._items(exclude), true);
    let world = hits[0]?.point ?? null;
    if (!world && this.tank.userData.interior.tunnel) {
      // トンネルのアーチ（ガラス上面）
      const glass = [];
      this.tank.getObjectByName('body').traverse((o) => o.userData.tunnelGlass && glass.push(o));
      world = this.raycaster.intersectObjects(glass, false)[0]?.point ?? null;
    }
    if (!world) {
      const I = this.tank.userData.interior;
      const p0 = this.tank.localToWorld(new THREE.Vector3(0, I.floorY, 0));
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.tank.getWorldQuaternion(new THREE.Quaternion()));
      this.plane.setFromNormalAndCoplanarPoint(up, p0);
      world = this.raycaster.ray.intersectPlane(this.plane, new THREE.Vector3());
    }
    return world ? this.tank.worldToLocal(world.clone()) : null;
  }

  /** 中心を水槽の内側にクランプして配置（はみ出しは許可・クリップで処理） */
  _placeAt(obj, local) {
    const I = this.tank.userData.interior;
    const def = getDef(obj.userData.defId);
    let { x, z } = local;
    if (I.shape === 'cylinder') {
      const len = Math.hypot(x, z);
      if (len > I.radius) {
        x *= I.radius / len;
        z *= I.radius / len;
      }
    } else {
      x = THREE.MathUtils.clamp(x, -I.halfW, I.halfW);
      z = THREE.MathUtils.clamp(z, -I.halfD, I.halfD);
    }
    const y = Math.max(local.y, floorAt(I, x)) - def.size.h * EMBED;
    obj.position.set(x, y, z);
  }

  _pick() {
    // ロック中は奥にある未ロックを優先。未ロックが無ければロック物（選択のみ）
    const hits = this.raycaster.intersectObjects(this._items(), true);
    let locked = null;
    for (const h of hits) {
      const root = this.manager.findInteriorRoot(h.object);
      if (!root) continue;
      if (!root.userData.locked) return root;
      locked ??= root;
    }
    return locked;
  }

  // ---- 岩肌スカルプト -------------------------------------------------------

  setBrush(key, value) {
    if (this.brush[key] === value) return;
    this.brush[key] = value;
    if (key === 'mode') {
      if (value) {
        this.cancelPlacement();
        this.growMode = null;
      }
      this.cursor.visible = false;
      this.onBrushChange?.(value);
      this.customizer.renderPanel();
    }
  }

  /** 選択中のライブロックで、そのサイズに収まるブラシ半径 */
  _brushRadius(item) {
    const { w, d } = getDef(item.userData.defId).size;
    return Math.min(this.brush.radius, Math.max(0.03, Math.min(w, d) * 0.5));
  }

  /** ブラシ有効時、選択中のライブロック表面へのヒット */
  _rockHit() {
    const sel = this.customizer.selected;
    if (!this.brush.mode || !sel?.userData.interiorItem || sel.userData.locked) return null;
    const rock = sel.getObjectByName('rock');
    if (!rock) return null;
    return this.raycaster.intersectObject(rock, false)[0] ?? null;
  }

  _updateCursor(hit) {
    if (!hit) {
      this.cursor.visible = false;
      return;
    }
    const n = this._n.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    this.cursor.position.copy(hit.point).addScaledVector(n, 0.002);
    this.cursor.lookAt(hit.point.clone().add(n));
    this.cursor.scale.setScalar(this._brushRadius(this.customizer.selected));
    this.cursor.material.color.set(this.brush.mode === 'deflate' ? 0xff8a8a : 0x8affc1);
    this.cursor.visible = true;
  }

  _stroke(hit) {
    const mesh = hit.object;
    const center = mesh.worldToLocal(hit.point.clone());
    const normal = hit.face.normal.clone(); // ジオメトリ（メッシュローカル）空間の法線
    sculptAt(mesh, center, normal, {
      mode: this.brush.mode,
      radius: this._brushRadius(this.customizer.selected),
      strength: this.brush.strength,
    });
    this._updateCursor(hit);
  }

  // ---- 成長 -----------------------------------------------------------------

  setGrowMode(mode) {
    if (this.growMode === mode) return;
    this.growMode = mode;
    if (mode) this.setBrush('mode', null);
    this.onGrowChange?.(mode);
    this.customizer.renderPanel();
  }

  /** 群体の密度（枝・ポリプ・株・石の数の倍率）を変えて作り直す */
  setDensity(item, density) {
    if (!item?.userData.interiorItem || item.userData.locked || getDef(item.userData.defId).growth !== 'colony') return;
    this.manager.regrowInterior(item, { ...item.userData.growth, density });
    this.onChanged?.();
  }

  /** 成長モード中に、選択中のオブジェ本体に触れたか（流木は触ったパーツも返す） */
  _growTarget() {
    const sel = this.customizer.selected;
    if (!this.growMode || !sel?.userData.interiorItem || sel.userData.locked || !getDef(sel.userData.defId).growth) return null;
    // 種類に合わないモード（別のオブジェで選んだまま）は無視
    const modular = getDef(sel.userData.defId).growth === 'modular';
    if (modular !== ['add', 'remove'].includes(this.growMode) && !(modular && this.growMode === 'extend')) return null;
    const hit = this.raycaster.intersectObject(sel, true)[0];
    return hit ? { item: sel, hit } : null;
  }

  /** 毎フレーム：成長の再生成（重いのでドラッグ中も1フレーム1回まで） */
  _updateGrowth() {
    const g = this.growing;
    if (!g?.dirty) return;
    g.dirty = false;
    if (g.mod) this.manager.regrowInterior(g.item, { ...g.item.userData.growth, nodes: g.mod.nodes });
    else if (g.wood) this.manager.regrowInterior(g.item, { ...g.item.userData.growth, parts: g.wood.parts });
    else this.manager.regrowInterior(g.item, { ...g.item.userData.growth, ...g.value });
  }

  /** 群体（サンゴ・海藻）を置いた場所の地形に沿わせ直す */
  _conform(item) {
    if (getDef(item.userData.defId).growth === 'colony') this.manager.regrowInterior(item, item.userData.growth);
  }

  /** 流木の編集を開始：枝を増やす / 触ったパーツを伸ばす / 触ったパーツを太くする */
  _startWoodEdit(item, hit, e) {
    const parts = item.userData.growth.parts.map((p) => ({ pts: p.pts.map((q) => [...q]), r: p.r }));
    const idx = hit.object.userData.partIndex ?? 0;
    const hitLocal = item.worldToLocal(hit.point.clone());
    // 画面に平行な面の上でドラッグ量を測る（奥行き方向にも自然に伸びる）
    const camDir = this.sceneMgr.camera.getWorldDirection(new THREE.Vector3());
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, hit.point);
    const wood = { parts, idx, hitLocal, plane, startY: e.clientY };
    if (this.growMode === 'branch') {
      parts.push({ pts: [hitLocal.toArray(), hitLocal.toArray()], r: Math.max(0.003, parts[idx].r * 0.55) });
      wood.idx = parts.length - 1;
    }
    wood.startTip = [...parts[wood.idx].pts[parts[wood.idx].pts.length - 1]];
    wood.startR = parts[wood.idx].r;
    return wood;
  }

  _moveWoodEdit(wood, e) {
    const part = wood.parts[wood.idx];
    if (this.growMode === 'trunk') {
      // 太くする：上へドラッグで太く、下へで細く（触ったパーツだけ）
      const f = 1 + (wood.startY - e.clientY) / (window.innerHeight / 3);
      part.r = Math.min(0.08, Math.max(0.002, wood.startR * f));
      return true;
    }
    this._setPointer(e);
    const p = this.raycaster.ray.intersectPlane(wood.plane, new THREE.Vector3());
    if (!p) return false;
    const d = this.growing.item.worldToLocal(p).sub(wood.hitLocal);
    const tip = new THREE.Vector3(...wood.startTip).add(d);
    const pts = part.pts;
    const prev = new THREE.Vector3(...pts[pts.length - 2]);
    // 伸ばした軌跡に沿って曲がるよう、一定以上離れたら制御点を足す
    if (this.growMode === 'extend' && prev.distanceTo(tip) > 0.12 && pts.length < 16) pts.push(tip.toArray());
    else pts[pts.length - 1] = tip.toArray();
    return true;
  }

  /** 毎フレーム：ボタンを押している間はポインタ位置を盛り続ける／削り続ける */
  update() {
    this._updateGrowth();
    if (!this.sculpting) return;
    this._setPointer(this.sculpting.event);
    const hit = this._rockHit();
    if (hit) this._stroke(hit);
    else this.cursor.visible = false;
  }

  // ---- 新規配置 -------------------------------------------------------------

  startPlacement(defId) {
    this.cancelPlacement();
    this.customizer.deselect();
    const def = getDef(defId);
    const ghost = this.manager.createInterior(this.tank, defId);
    ghost.userData.ghost = true;
    ghost.visible = false;
    const helper = new THREE.Box3Helper(new THREE.Box3(), 0x4cd18a);
    helper.material.depthTest = false;
    helper.renderOrder = 999;
    helper.visible = false;
    this.sceneMgr.scene.add(helper);
    this.placing = { def, ghost, helper, valid: false };
    this.onPlacementChange?.(defId);
  }

  cancelPlacement() {
    if (!this.placing) return;
    const { ghost, helper } = this.placing;
    this.manager.removeInterior(ghost);
    this.sceneMgr.scene.remove(helper);
    helper.dispose();
    this.placing = null;
    this.onPlacementChange?.(null);
  }

  _updateGhost() {
    const p = this.placing;
    const local = this._surfaceHit(p.ghost);
    if (!local) return;
    this._placeAt(p.ghost, local);
    p.ghost.visible = true;
    p.valid = this.economy.canAfford(p.def.price);
    p.helper.box.setFromObject(p.ghost);
    p.helper.material.color.set(p.valid ? 0x4cd18a : 0xff6b6b);
    p.helper.visible = true;
  }

  _commitPlacement(e) {
    const p = this.placing;
    if (!p.ghost.visible) return;
    if (!p.valid) {
      this.toast('資金が足りません', { error: true });
      return;
    }
    this.economy.spend(p.def.price);
    // ゴーストをそのまま確定オブジェにする（形の seed も引き継がれる）
    const item = p.ghost;
    item.userData.ghost = false;
    this._conform(item);
    this.sceneMgr.scene.remove(p.helper);
    p.helper.dispose();
    this.placing = null;
    this.toast(`${p.def.name} を配置しました`);
    if (e.shiftKey) {
      this.startPlacement(p.def.id);
      this._updateGhost();
    } else {
      this.onPlacementChange?.(null);
      this.customizer.select(item);
    }
    this.onChanged?.();
  }

  // ---- 選択オブジェ操作 -----------------------------------------------------

  rotate(item, dir) {
    item.rotation.y = (item.rotation.y + dir * ROTATE_STEP) % (Math.PI * 2);
    this.customizer.renderPanel();
  }

  remove(item) {
    this.setBrush('mode', null);
    this.setGrowMode(null);
    const def = getDef(item.userData.defId);
    this.customizer.deselect();
    this.manager.removeInterior(item);
    this.economy.earn(Math.floor(def.price * REFUND_RATE));
    this.toast(`${def.name} を撤去しました`);
    this.onChanged?.();
  }

  // ---- イベント -------------------------------------------------------------

  _abortGesture() {
    if (this.drag || this.sculpting || this.growing) this.cameraCtl.setEnabled(true);
    this.drag = null;
    this.sculpting = null;
    this.growing = null;
    this.down = null;
  }

  _onDown = (e) => {
    if (!this.enabled) return;
    if (!e.isPrimary) return this._abortGesture(); // 2本指 → カメラ操作
    if (this.placing && e.button === 2) {
      this.cancelPlacement();
      return;
    }
    if (e.button !== 0) return;
    this._setPointer(e);
    this.down = { x: e.clientX, y: e.clientY };
    if (this.placing) return;

    const growHit = this._growTarget();
    if (growHit) {
      const growItem = growHit.item;
      this.cameraCtl.setEnabled(false);
      const gr = growItem.userData.growth;
      if (getDef(growItem.userData.defId).growth === 'modular') {
        const mod = startCoralEdit(this, growItem, growHit.hit);
        if (!mod) return this.cameraCtl.setEnabled(true);
        this.growing = { item: growItem, mod, dirty: true };
        return;
      }
      if (getDef(growItem.userData.defId).growth === 'driftwood') {
        this.growing = { item: growItem, wood: this._startWoodEdit(growItem, growHit.hit, e), dirty: true };
        return;
      }
      // 本体の高さの水平面上でドラッグ量を測る（オブジェのローカル座標に変換）
      const wp = growItem.getWorldPosition(new THREE.Vector3());
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -wp.y);
      const hit = this.raycaster.ray.intersectPlane(plane, new THREE.Vector3());
      this.growing = {
        item: growItem,
        plane,
        startLocal: hit ? growItem.worldToLocal(hit.clone()) : null,
        startExt: { ...gr.ext },
        startY: e.clientY,
        value: null,
        dirty: false,
      };
      return;
    }

    const rockHit = this._rockHit();
    if (rockHit) {
      this.cameraCtl.setEnabled(false);
      this.sculpting = { item: this.customizer.selected, event: e };
      return;
    }

    const item = this._pick();
    if (!item) return;
    this.customizer.select(item);
    if (item.userData.locked) return; // ロック中は選択のみ
    this.cameraCtl.setEnabled(false);
    this.drag = { obj: item, moved: false };
    this.dom.style.cursor = 'grabbing';
  };

  _onMove = (e) => {
    if (!this.enabled || !e.isPrimary) return;
    if (this.growing) {
      const g = this.growing;
      let value;
      if (g.wood) {
        if (this._moveWoodEdit(g.wood, e)) g.dirty = true;
        return;
      }
      if (g.mod) {
        if (moveCoralEdit(this, g.mod, e)) g.dirty = true;
        return;
      }
      {
        // 伸ばす：ドラッグした方向へ ext を動かす（逆へ戻すと縮む）
        this._setPointer(e);
        const hit = g.startLocal && this.raycaster.ray.intersectPlane(g.plane, new THREE.Vector3());
        if (!hit) return;
        const cur = g.item.worldToLocal(hit);
        let x = g.startExt.x + (cur.x - g.startLocal.x);
        let z = g.startExt.z + (cur.z - g.startLocal.z);
        const L = Math.hypot(x, z);
        if (L > MAX_EXT) {
          x *= MAX_EXT / L;
          z *= MAX_EXT / L;
        }
        value = { ext: { x: Math.round(x * 200) / 200, z: Math.round(z * 200) / 200 } };
      }
      if (JSON.stringify(value) !== JSON.stringify(g.value)) {
        g.value = value;
        g.dirty = true;
      }
      return;
    }
    if (this.placing) {
      if (e.target !== this.dom && !this.down) return;
      this._setPointer(e);
      this._updateGhost();
      return;
    }
    if (this.sculpting) {
      this.sculpting.event = e; // 実際の変形は update() で毎フレーム
      return;
    }
    if (this.brush.mode && e.buttons === 0 && e.target === this.dom) {
      this._setPointer(e);
      this._updateCursor(this._rockHit());
      this.dom.style.cursor = this.cursor.visible ? 'crosshair' : '';
      return;
    }
    if (this.drag) {
      this._setPointer(e);
      const local = this._surfaceHit(this.drag.obj);
      if (local) {
        this._placeAt(this.drag.obj, local);
        this.drag.moved = true;
      }
      return;
    }
    if (e.buttons === 0 && e.target === this.dom) {
      this._setPointer(e);
      {
        const p = this._pick();
        this.dom.style.cursor = p ? (p.userData.locked ? 'not-allowed' : 'grab') : '';
      }
    }
  };

  _onUp = (e) => {
    if (!this.enabled || !e.isPrimary) return;
    if (this.growing) {
      this._updateGrowth();
      if (this.growing.mod) this.onChanged?.();
      this.growing = null;
      this.cameraCtl.setEnabled(true);
      this.customizer.renderPanel();
      this.down = null;
      return;
    }
    const down = this.down;
    this.down = null;
    const clicked = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < CLICK_TOLERANCE;
    if (this.placing) {
      if (clicked && e.button === 0) {
        this._setPointer(e);
        this._updateGhost();
        this._commitPlacement(e);
      }
      return;
    }
    if (this.sculpting) {
      this.sculpting.item.userData.sculpted = true;
      this.sculpting = null;
      this.cameraCtl.setEnabled(true);
      return;
    }
    if (this.drag) {
      const moved = this.drag.obj;
      this.drag = null;
      this.cameraCtl.setEnabled(true);
      this._conform(moved);
      this.dom.style.cursor = 'grab';
      this.customizer.renderPanel();
      return;
    }
    if (clicked) {
      this.setBrush('mode', null);
      this.setGrowMode(null);
      this.customizer.deselect();
    }
  };

  _onKey = (e) => {
    if (!this.enabled || e.target instanceof HTMLInputElement) return;
    const sel = this.customizer.selected;
    if (e.key === 'Escape') {
      if (this.brush.mode) this.setBrush('mode', null);
      else if (this.growMode) this.setGrowMode(null);
      else if (this.placing) this.cancelPlacement();
      else if (sel) this.customizer.deselect();
      else this.onExitRequest?.();
    } else if (e.key === 'r' || e.key === 'R') {
      const dir = e.shiftKey ? 1 : -1;
      if (this.placing) this.placing.ghost.rotation.y += dir * ROTATE_STEP;
      else if (sel) this.rotate(sel, dir);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !this.placing) {
      this.remove(sel);
    }
  };
}
