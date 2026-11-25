import * as THREE from 'three';
import { getDef, CATEGORY } from '../tanks/tankData.js';
import { buildObject, disposeObject } from '../tanks/tankBuilder.js';
import { TankManager } from '../tanks/tankManager.js';
import { REFUND_RATE } from '../management/stageData.js';
import { CELL } from '../room/floorPlan.js';
import { BASEMENT, zoneAt } from '../building/blueprint.js';
import { findNearestRun, findRunByKey, placeEmbedded, alongOf, EMBED_RATIO_MAX } from '../room/embed.js';
import { AlignGuides } from './alignGuides.js';

const CLICK_TOLERANCE = 6; // px
const SNAP = 0.05; // m（Shift で無効）
const ROTATE_STEP = Math.PI / 2;

/**
 * 館内編集モードの操作：選択・ドラッグ移動・カタログからの新規配置・壁への埋め込み。
 * 配置できる範囲は床のマス（FloorPlan）。埋め込み水槽は壁に沿ってのみ動く。
 */
export class HallInteraction {
  constructor({ sceneMgr, cameraCtl, manager, economy, inventory, customizer, room, toast, onPlacementChange, onChanged, onWallsChanged, onTankRemoved, getUnlocked, onClipboard }) {
    this.onClipboard = onClipboard;
    this.clipboard = null; // 水槽のコピー（サイズ・見た目・水槽内レイアウト。展示生物は含めない）
    Object.assign(this, { sceneMgr, cameraCtl, manager, economy, inventory, customizer, room, toast, onPlacementChange, onChanged, onWallsChanged, onTankRemoved, getUnlocked });
    this.guides = new AlignGuides(sceneMgr.scene, manager);
    this.dom = sceneMgr.renderer.domElement;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.enabled = false;
    this.placing = null;
    this.drag = null;
    this.down = null;

    this.dom.addEventListener('pointerdown', this._onDown, { capture: true });
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onUp);
    window.addEventListener('keydown', this._onKey);
    this.dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setEnabled(v) {
    if (!v) {
      this.cancelPlacement();
      this._endDrag();
    }
    this.enabled = v;
    this.guides.hide();
    this.refreshCenters();
    this.onClipboard?.(v && !!this.clipboard);
  }

  // ---- 水槽のコピー・貼り付け ------------------------------------------------

  /** 水槽をコピーする（水槽の種類・向き・見た目・水槽内レイアウト。展示生物と名前は含めない）。続けて貼り付けを始める */
  copy(tank) {
    if (!tank?.userData.clip) return;
    this.clipboard = {
      defId: tank.userData.defId,
      rotY: tank.rotation.y,
      look: tank.userData.look ? structuredClone(tank.userData.look) : null,
      contents: this.manager.dumpInterior(tank),
    };
    this.onClipboard?.(this.enabled);
    this.toast(`${getDef(tank.userData.defId).name} をコピーしました。貼り付ける場所をタップ（Shift で続けて）`);
    this.paste();
  }

  /** コピーした水槽を置き始める */
  paste() {
    const c = this.clipboard;
    if (!c || !this.enabled) return;
    this.startPlacement(c.defId);
    this.placing.copy = c;
    this.placing.rotY = c.rotY;
  }

  /** 水槽内レイアウトの代金 */
  _copyValue(copy) {
    return copy.contents.reduce((s, it) => s + (getDef(it.defId)?.price ?? 0), 0);
  }

  /** エリア中央の十字線を今の階・解放状況で描き直す */
  refreshCenters() {
    this.guides.showCenters(this.room.plan, this.getUnlocked(), this.enabled);
    this.guides.showWallCenters(this.room.plan.runs(), this.enabled);
  }

  /**
   * グリッド（5cm）と整列ガイドを合わせた位置。Shift で両方無効。
   * 吸着した軸は相手の縁に揃え、吸着を解除した軸はグリッドに合わせず細かく動かせる
   */
  _align(def, rotY, x, z, e, exclude) {
    if (e?.shiftKey) {
      this.guides.hide();
      return { x, z };
    }
    const s = this.guides.snap(def, rotY, x, z, exclude);
    return {
      x: s.snap.x ? s.x : s.free.x ? x : this._snap(x, e),
      z: s.snap.z ? s.z : s.free.z ? z : this._snap(z, e),
    };
  }

  // ---- ユーティリティ -------------------------------------------------------

  _setPointer(e) {
    const r = this.dom.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.sceneMgr.camera);
  }

  _floorHit() {
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.floorPlane, p) ? p : null;
  }

  _snap(v, e) {
    return e?.shiftKey ? v : Math.round(v / SNAP) * SNAP;
  }

  _pick() {
    const hits = this.raycaster.intersectObjects(this.manager.getPickables(), true);
    for (const h of hits) {
      const root = this.manager.findRoot(h.object);
      if (root) return root;
    }
    return null;
  }

  /** 床のマスに収まるか（self は動かしている本人。大水槽との重なり判定から外す） */
  _fits(def, rotY, x, z, self = null) {
    const { hx, hz } = TankManager.footprintHalf(def, rotY);
    const plan = this.room.plan;
    if (!plan.containsRect(x, z, hx, hz)) return false;
    if (def.yardOnly && plan.typeAt(x, z) !== CELL.YARD) return false;
    // 売店・食堂は作り付けの設備で埋まっているので置けない
    if (zoneAt(plan.floor, x, z)?.facility) return false;
    // 地下は設備専用。予備水槽などは地下にだけ置ける
    if (!def.stairs && (plan.floor === BASEMENT ? !def.yardOnly : def.basement)) return false;
    // 大水槽は2階分の高さがあるので1階にだけ置ける
    if (def.atrium && plan.floor !== 0) return false;
    // 大水槽には重ねて置けない
    return ![...this.manager.objects.values()].some((o) => {
      if (o === self || !this.manager.defOf(o).atrium || plan.floor !== 0) return false;
      const b = TankManager.footprintHalf(this.manager.defOf(o), o.rotation.y);
      return Math.abs(o.position.x - x) < b.hx + hx && Math.abs(o.position.z - z) < b.hz + hz;
    });
  }

  // ---- 新規配置 -------------------------------------------------------------

  /** 水槽は在庫から、それ以外は資金で設置する。不足時は理由を返す */
  _lack(def, copy) {
    // 貼り付け：水槽本体は在庫から、水槽内レイアウトは資金で買い直す
    if (copy) {
      if (this.inventory.count(def.id) < 1) return `${def.name} の在庫がありません（水槽建造で作ってください）`;
      return this.economy.canAfford(this._copyValue(copy)) ? '' : `水槽内レイアウトの代金 ¥${this._copyValue(copy).toLocaleString('ja-JP')} が足りません`;
    }
    if (this.inventory.count(def.id) > 0) return '';
    if (def.category === CATEGORY.TANK) return '在庫がありません';
    return this.economy.canAfford(def.price) ? '' : '資金が足りません';
  }

  startPlacement(defId) {
    this.cancelPlacement();
    this.customizer.deselect();
    const def = getDef(defId);
    const ghost = buildObject(def);
    ghost.visible = false;
    const helper = new THREE.Box3Helper(new THREE.Box3(), 0x4cd18a);
    helper.material.depthTest = false;
    helper.renderOrder = 999;
    helper.visible = false;
    this.sceneMgr.scene.add(ghost, helper);
    this.placing = { def, ghost, helper, rotY: 0, valid: false, reason: '' };
    this.guides.reset();
    this.onPlacementChange?.(defId);
  }

  cancelPlacement() {
    if (!this.placing) return;
    const { ghost, helper } = this.placing;
    this.guides.reset();
    this.sceneMgr.scene.remove(ghost, helper);
    disposeObject(ghost);
    helper.dispose();
    this.placing = null;
    this.onPlacementChange?.(null);
  }

  _updateGhost(e) {
    const p = this.placing;
    const hit = this._floorHit();
    if (!hit) return;
    if (p.def.wallMount) return this._updateWallGhost(p, hit);
    const { x, z } = this._align(p.def, p.rotY, hit.x, hit.z, e, []);
    const fits = this._fits(p.def, p.rotY, x, z);
    p.ghost.position.set(x, this.manager.elevationAt(p.def, x, z, this.manager.currentFloor), z);
    p.ghost.rotation.y = p.rotY;
    p.ghost.visible = true;
    const lack = this._lack(p.def, p.copy);
    p.valid = fits && !lack;
    p.reason = !fits ? (p.def.basement ? '地下に設置してください' : p.def.yardOnly ? 'バックヤードに設置してください' : '解放済みの床の上に置いてください') : lack;
    p.helper.box.setFromObject(p.ghost);
    p.helper.material.color.set(p.valid ? 0x4cd18a : 0xff6b6b);
    p.helper.visible = true;
  }

  /** 壁付けオブジェ（飼育員用ドア）：近くの仕切り壁に吸い付く */
  _updateWallGhost(p, hit) {
    const near = findNearestRun(this.room.plan.runs(), hit.x, hit.z, 2.5, true, true);
    p.embed = near ? { key: near.run.key, along: near.along, ratio: 0.5, bottom: 0 } : null;
    const placed = near && placeEmbedded(p.ghost, p.def, near.run, p.embed);
    if (!placed) p.ghost.position.set(hit.x, 0, hit.z);
    p.ghost.visible = true;
    const lack = this._lack(p.def);
    p.valid = !!placed && !lack;
    p.reason = !placed ? 'バックヤードとの仕切り壁の近くに置いてください' : lack;
    p.helper.box.setFromObject(p.ghost);
    p.helper.material.color.set(p.valid ? 0x4cd18a : 0xff6b6b);
    p.helper.visible = true;
  }

  _commitPlacement(e) {
    const p = this.placing;
    if (!p.ghost.visible) return;
    if (!p.valid) return this.toast(p.reason, { error: true });
    if (!this.inventory.take(p.def.id)) this.economy.spend(p.def.price);
    if (p.copy) this.economy.spend(this._copyValue(p.copy));
    const obj = this.manager.add(p.def.id, {
      x: p.ghost.position.x,
      z: p.ghost.position.z,
      rotY: p.ghost.rotation.y,
      embed: p.def.wallMount ? { ...p.embed } : null,
      // 貼り付け：見た目と水槽内レイアウトを写す（展示生物は空のまま）
      ...(p.copy && { look: p.copy.look ? structuredClone(p.copy.look) : null, contents: structuredClone(p.copy.contents) }),
    });
    if (p.def.wallMount) this.onWallsChanged?.();
    this.toast(p.copy ? `${p.def.name} を複製しました（展示生物は空です）` : `${p.def.name} を設置しました`);
    if (p.copy && e.shiftKey && !this._lack(p.def, p.copy)) return this.onChanged?.();
    if (p.copy && e.shiftKey) {
      this.cancelPlacement();
      this.customizer.select(obj);
      return this.onChanged?.();
    }
    if (!e.shiftKey) {
      this.cancelPlacement();
      this.customizer.select(obj);
    }
    this.onChanged?.();
  }

  // ---- 選択オブジェクト操作 -------------------------------------------------

  rotate(obj, dir) {
    if (obj.userData.embed) return this.toast('埋め込み中の水槽は壁に向いて固定されます');
    const def = this.manager.defOf(obj);
    const angle = dir * ROTATE_STEP;
    const newRot = (obj.rotation.y + angle) % (Math.PI * 2);
    if (!this._fits(def, newRot, obj.position.x, obj.position.z, obj)) return this.toast('回転すると床からはみ出します', { error: true });
    const riders = this.manager.getRiders(obj);
    obj.rotation.y = newRot;
    const c = Math.cos(-angle);
    const s = Math.sin(-angle);
    for (const r of riders) {
      const dx = r.position.x - obj.position.x;
      const dz = r.position.z - obj.position.z;
      r.position.x = obj.position.x + dx * c - dz * s;
      r.position.z = obj.position.z + dx * s + dz * c;
      r.rotation.y = (r.rotation.y + angle) % (Math.PI * 2);
    }
    this.manager.refreshElevations();
    this.customizer.renderPanel();
    this.onChanged?.();
  }

  remove(obj) {
    const def = this.manager.defOf(obj);
    if (def.stairs) return; // 階段は撤去できない
    // 水槽本体は在庫へ戻し、中身は売却する
    const isTank = def.category === CATEGORY.TANK;
    const value = (isTank ? 0 : def.price) + (obj.userData.clip ? this.manager.contentsValue(obj) : 0);
    const wasEmbedded = !!obj.userData.embed;
    this.customizer.deselect();
    if (isTank) this.onTankRemoved?.(obj); // 展示中の生物は在庫へ戻す
    this.manager.remove(obj);
    if (isTank) this.inventory.add(def.id);
    this.economy.earn(Math.floor(value * REFUND_RATE));
    this.toast(isTank ? `${def.name} を在庫に戻しました` : `${def.name} を撤去しました`);
    if (wasEmbedded) this.onWallsChanged?.();
    this.onChanged?.();
  }

  // ---- 壁への埋め込み -------------------------------------------------------

  embed(tank) {
    const def = this.manager.defOf(tank);
    if (def.category !== CATEGORY.TANK) return;
    const near = findNearestRun(this.room.plan.runs(), tank.position.x, tank.position.z, 1.5);
    if (!near) return this.toast('近くに壁がありません。水槽を壁際へ動かしてください', { error: true });
    const embed = { key: near.run.key, along: near.along, ratio: EMBED_RATIO_MAX, bottom: Math.max(0.3, tank.position.y) };
    if (!placeEmbedded(tank, def, near.run, embed)) return this.toast('この壁は水槽より短いため埋め込めません', { error: true });
    tank.userData.embed = embed;
    this.manager.refreshElevations();
    this.onWallsChanged?.();
    this.customizer.renderPanel();
  }

  unembed(tank) {
    const def = this.manager.defOf(tank);
    const embed = tank.userData.embed;
    if (!embed) return;
    delete tank.userData.embed;
    // 部屋側へ出して床に戻す
    const run = findRunByKey(this.room.plan.runs(), embed.key, embed.along);
    if (run) {
      const [nx, nz] = run.normal;
      tank.position.x += nx * def.size.d;
      tank.position.z += nz * def.size.d;
    }
    this.manager.refreshElevations();
    this.onWallsChanged?.();
    this.customizer.renderPanel();
  }

  setEmbedParam(tank, key, value) {
    const embed = tank.userData.embed;
    if (!embed) return;
    embed[key] = value;
    const run = findRunByKey(this.room.plan.runs(), embed.key, embed.along);
    if (run) placeEmbedded(tank, this.manager.defOf(tank), run, embed);
    this.onWallsChanged?.();
  }

  // ---- イベント -------------------------------------------------------------

  _endDrag() {
    if (!this.drag) return;
    this.drag = null;
    this.guides.reset();
    this.cameraCtl.setEnabled(true);
    this.dom.style.cursor = '';
  }

  _onDown = (e) => {
    if (!this.enabled || this.isBusy?.()) return;
    // 2本目の指 → ドラッグをやめてカメラ操作（ピンチ）に任せる
    if (!e.isPrimary) {
      this._endDrag();
      this.down = null;
      return;
    }
    if (this.placing && e.button === 2) return this.cancelPlacement();
    if (e.button !== 0) return;
    this._setPointer(e);
    this.down = { x: e.clientX, y: e.clientY };
    if (this.placing) return;

    const obj = this._pick();
    if (!obj) return;
    this.customizer.select(obj);
    const hit = this._floorHit();
    if (!hit) return;
    this.cameraCtl.setEnabled(false);
    this.drag = {
      obj,
      offset: new THREE.Vector3(obj.position.x - hit.x, 0, obj.position.z - hit.z),
      riders: this.manager.getRiders(obj).map((r) => ({ obj: r, dx: r.position.x - obj.position.x, dz: r.position.z - obj.position.z })),
      moved: false,
    };
  };

  _onMove = (e) => {
    if (!this.enabled || !e.isPrimary || this.isBusy?.()) return;
    if (this.placing) {
      if (e.target !== this.dom && !this.down) return;
      this._setPointer(e);
      this._updateGhost(e);
      return;
    }
    if (!this.drag) return;
    this._setPointer(e);
    const hit = this._floorHit();
    if (!hit) return;
    const { obj, offset, riders } = this.drag;
    const def = this.manager.defOf(obj);
    // 埋め込み中は壁沿いなので整列ガイドは使わない。台に載った物は一緒に動くので吸着相手から外す
    const { x, z } = obj.userData.embed
      ? { x: this._snap(hit.x + offset.x, e), z: this._snap(hit.z + offset.z, e) }
      : this._align(def, obj.rotation.y, hit.x + offset.x, hit.z + offset.z, e, [obj, ...riders.map((r) => r.obj)]);

    if (obj.userData.embed) {
      // 埋め込み水槽は壁に沿ってスライド
      const embed = obj.userData.embed;
      const run = findRunByKey(this.room.plan.runs(), embed.key, embed.along);
      if (run) {
        embed.along = alongOf(run, x, z);
        placeEmbedded(obj, def, run, embed);
        this.onWallsChanged?.();
      }
    } else {
      // 床に収まる位置だけ受け付ける（軸ごとに試して壁沿いに滑らせる）
      const rot = obj.rotation.y;
      let nx = obj.position.x;
      let nz = obj.position.z;
      if (this._fits(def, rot, x, z, obj)) [nx, nz] = [x, z];
      else if (this._fits(def, rot, x, nz, obj)) nx = x;
      else if (this._fits(def, rot, nx, z, obj)) nz = z;
      obj.position.x = nx;
      obj.position.z = nz;
      for (const r of riders) {
        r.obj.position.x = nx + r.dx;
        r.obj.position.z = nz + r.dz;
      }
      this.manager.refreshElevations();
    }
    this.drag.moved = true;
  };

  _onUp = (e) => {
    if (!this.enabled || !e.isPrimary || this.isBusy?.()) return;
    const down = this.down;
    this.down = null;
    const clicked = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < CLICK_TOLERANCE;
    if (this.placing) {
      if (clicked && e.button === 0) {
        // タッチにはホバーがないので、タップ位置でゴーストを置き直してから確定
        this._setPointer(e);
        this._updateGhost(e);
        this._commitPlacement(e);
      }
      return;
    }
    if (this.drag) {
      const { moved } = this.drag;
      this._endDrag();
      this.customizer.renderPanel();
      if (moved) this.onChanged?.();
      return;
    }
    if (clicked) this.customizer.deselect();
  };

  _onKey = (e) => {
    if (!this.enabled || e.target instanceof HTMLInputElement) return;
    const sel = this.customizer.selected;
    if (e.key === 'Escape') {
      if (this.placing) this.cancelPlacement();
      else this.customizer.deselect();
    } else if (e.key === 'r' || e.key === 'R') {
      const dir = e.shiftKey ? 1 : -1;
      if (this.placing) {
        this.placing.rotY = (this.placing.rotY + dir * ROTATE_STEP) % (Math.PI * 2);
        this._updateGhost(e);
      } else if (sel) this.rotate(sel, dir);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !this.placing) {
      this.remove(sel);
    }
  };
}
