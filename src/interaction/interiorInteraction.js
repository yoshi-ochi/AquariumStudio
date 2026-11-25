import * as THREE from 'three';
import { isFloraMode, floraItem, floraHit, floraStroke, brushRadius, resetFloraTargets } from './floraBrush.js';
import { conformFlora } from '../flora/floraSurface.js';
import { specOf, fitToDepth } from '../flora/floraBuilder.js';
import { floorAt } from '../tanks/tankClip.js';
import { getDef } from '../tanks/tankData.js';
import { REFUND_RATE } from '../management/stageData.js';
import { BRUSH_DEFAULTS, sculptAt, createBrushCursor } from '../interior/sculpt.js';

const CLICK_TOLERANCE = 5; // px
const ROTATE_STEP = Math.PI / 4;
const EMBED = 0.12; // 岩などを他のオブジェの上に積むとき、少し沈めてかみ合わせる割合（高さ比）

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

    // 編集モード：生き物オブジェは 'paint'（ブラシで広げる）/ 'erase'（消す）、流木は 'branch' / 'extend' / 'trunk'
    this.growMode = null;
    this.growing = null; // { item, flora | wood, dirty }
    this.floraRadius = 0.06; // ブラシの半径（m）

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
    // 床（底砂を敷いていれば砂の上面）に置くときは、その面から立ち上げる（砂の中・ガラスの下へ沈めない）。
    // 他の岩などの上に積むときだけ少し沈めてかみ合わせる。生き物は面の上に付く
    const floor = floorAt(I, x);
    const stacked = local.y > floor + 0.002;
    const y = stacked && !def.flora ? Math.max(floor, local.y - def.size.h * EMBED) : Math.max(local.y, floor);
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
    this.cursor.visible = false;
    if (mode) this.setBrush('mode', null);
    this.onGrowChange?.(mode);
    this.customizer.renderPanel();
  }

  /** 生き物オブジェの成長の度合い（群体の大きさ・海藻の高さ）を変えて作り直す */
  setFloraSize(item, s) {
    if (!item?.userData.interiorItem || item.userData.locked || !getDef(item.userData.defId).flora) return;
    this.manager.regrowInterior(item, { ...item.userData.growth, s });
    this.onChanged?.();
  }

  /** ブラシで広げられる生き物オブジェを選んでいて、ブラシのモード中か */
  _floraTarget() {
    const sel = this.customizer.selected;
    return isFloraMode(this.growMode) && !sel?.userData.locked ? floraItem(sel) : null;
  }

  /** ブラシの輪を面に沿わせて表示する */
  _floraCursor(item, hit) {
    if (!hit) return (this.cursor.visible = false);
    const wp = this.tank.localToWorld(hit.p.clone());
    const wn = this.tank.localToWorld(hit.p.clone().add(hit.n)).sub(wp).normalize();
    this.cursor.position.copy(wp).addScaledVector(wn, 0.003);
    this.cursor.lookAt(wp.clone().add(wn));
    this.cursor.scale.setScalar(brushRadius(this, item));
    this.cursor.material.color.set(this.growMode === 'erase' ? 0xff8a8a : 0x8affc1);
    this.cursor.visible = true;
  }

  /** ブラシ1回ぶん（押している間、ポインタが動くたび） */
  _floraBrush(item) {
    const hit = floraHit(this, item);
    this._floraCursor(item, hit);
    if (hit && floraStroke(this, item, hit)) this.growing.dirty = true;
  }

  /** 流木の編集モード中に、選択中の流木に触れたか（触ったパーツも返す） */
  _growTarget() {
    const sel = this.customizer.selected;
    if (!this.growMode || !sel?.userData.interiorItem || sel.userData.locked || getDef(sel.userData.defId).growth !== 'driftwood') return null;
    if (!['branch', 'extend', 'trunk'].includes(this.growMode)) return null;
    const hit = this.raycaster.intersectObject(sel, true)[0];
    return hit ? { item: sel, hit } : null;
  }

  /** 毎フレーム：成長の再生成（重いのでドラッグ中も1フレーム1回まで） */
  _updateGrowth() {
    const g = this.growing;
    if (!g?.dirty) return;
    g.dirty = false;
    if (g.wood) this.manager.regrowInterior(g.item, { ...g.item.userData.growth, parts: g.wood.parts });
    else this.manager.regrowInterior(g.item, g.item.userData.growth);
  }

  /** 生き物オブジェを置いた・動かした・回したあと、個体を近くの面（岩・砂・壁）に沿わせ直す */
  _conform(item) {
    if (!getDef(item.userData.defId).flora) return;
    conformFlora(this.manager, this.tank, item);
    this.manager.regrowInterior(item, item.userData.growth);
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
    // 海藻などは、この水槽の水深に収まる高さで置く（あとから「高さ」で伸ばせる）
    const I = this.tank.userData.interior;
    const growth = def.flora ? { s: fitToDepth(specOf(def), (I.waterTop ?? 1) - I.floorY) } : undefined;
    const ghost = this.manager.createInterior(this.tank, defId, { growth });
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
    this._conform(item);
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

    const flora = this._floraTarget();
    if (flora) {
      // ブラシ：なぞった面に個体を足す／消す
      this.cameraCtl.setEnabled(false);
      resetFloraTargets(this);
      this.floraFull = null;
      this.growing = { item: flora, flora: true, dirty: false };
      this._floraBrush(flora);
      return;
    }
    const growHit = this._growTarget();
    if (growHit) {
      this.cameraCtl.setEnabled(false);
      this.growing = { item: growHit.item, wood: this._startWoodEdit(growHit.item, growHit.hit, e), dirty: true };
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
      if (g.wood) {
        if (this._moveWoodEdit(g.wood, e)) g.dirty = true;
      } else {
        this._setPointer(e);
        this._floraBrush(g.item);
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
    if (e.buttons === 0 && e.target === this.dom && this._floraTarget()) {
      // ブラシの輪をポインタの下の面に出す
      this._setPointer(e);
      resetFloraTargets(this);
      this._floraCursor(this._floraTarget(), floraHit(this, this._floraTarget()));
      this.dom.style.cursor = this.cursor.visible ? 'crosshair' : '';
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
      if (this.growing.flora) {
        resetFloraTargets(this);
        if (this.floraFull) this.toast(this.floraFull);
        this.onChanged?.();
      }
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
