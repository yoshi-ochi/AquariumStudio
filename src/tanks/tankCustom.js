import * as THREE from 'three';
import { CATEGORY, CATEGORY_LABELS } from './tankData.js';
import { EMBED_RATIO_MIN, EMBED_RATIO_MAX } from '../room/embed.js';
import { normalizeLook, PALETTE, FRAME_COLORS } from './tankLook.js';
import { floorLabel } from '../building/blueprint.js';

const yen = (n) => `¥${Math.round(n).toLocaleString('ja-JP')}`;
const cm = (v) => Math.round(v * 100);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** スライダー1行（data-param で onAction(`param-${name}`, obj, value) に届く） */
function slider(name, label, min, max, step, value, fmt) {
  return `<label class="slider">${label}<input type="range" data-param="${name}" data-fmt="${fmt}" min="${min}" max="${max}" step="${step}" value="${value}"><output>${format(fmt, value)}</output></label>`;
}
function format(fmt, v) {
  v = Number(v);
  if (fmt === 'cm') return `${Math.round(v * 100)} cm`;
  if (fmt === 'm') return `${v.toFixed(2)} m`;
  if (fmt === '%') return `${Math.round(v * 100)}%`;
  return `${v}`;
}

/**
 * 選択中オブジェクトの詳細パネル・ハイライト・画面上ギズモ。
 * 操作は onAction(action, obj, value) に委ねる。
 * パネルの追加セクション：岩肌ブラシ（ライブロック）、成長（サンゴ・流木・海藻）、壁埋め込み（水槽・館内編集時）
 */
export class TankCustomizer {
  constructor({ scene, camera, panelEl, gizmoEl, getDef, onAction, getBrush, getGrowMode, stairsTo }) {
    Object.assign(this, { scene, camera, panelEl, gizmoEl, getDef, onAction, getBrush, getGrowMode, stairsTo });
    this.selected = null;
    this.helper = null;
    this.allowEmbed = false;
    this.lookSide = 'back';
    this._box = new THREE.Box3();
    this._v = new THREE.Vector3();

    const click = (e) => {
      const btn = e.target.closest('button[data-action]');
      if (btn && this.selected) this.onAction(btn.dataset.action, this.selected);
    };
    panelEl.addEventListener('click', click);
    gizmoEl.addEventListener('click', click);
    // 色の選択（バックスクリーン・ライト色）
    panelEl.addEventListener('input', (e) => {
      const input = e.target.closest('input[data-look]');
      if (input && this.selected) this.onAction(`look-color-${input.dataset.look}`, this.selected, input.value);
    });
    panelEl.addEventListener('input', (e) => {
      const input = e.target.closest('input[data-param]');
      if (!input || !this.selected) return;
      this.onAction(`param-${input.dataset.param}`, this.selected, Number(input.value));
      const out = input.parentElement.querySelector('output');
      if (out) out.textContent = format(input.dataset.fmt, input.value);
    });
  }

  select(obj) {
    if (this.selected === obj) return;
    this.deselect();
    this.selected = obj;
    this.helper = new THREE.BoxHelper(obj, 0xffb300);
    this.helper.material.depthTest = false;
    this.helper.renderOrder = 999;
    this.scene.add(this.helper);
    this.renderPanel();
    this.panelEl.hidden = false;
    this.gizmoEl.hidden = false;
    document.body.classList.add('has-selection'); // 詳細編集中はカタログを閉じる
    const isTank = this.getDef(obj.userData.defId).category === CATEGORY.TANK;
    this.gizmoEl.querySelectorAll('.only-tank').forEach((b) => (b.hidden = !isTank));
    this.syncLock();
  }

  /** ロック状態をギズモに反映（水槽内オブジェのみ表示） */
  syncLock() {
    const obj = this.selected;
    const inner = !!obj?.userData.interiorItem;
    const locked = !!obj?.userData.locked;
    this.gizmoEl.querySelectorAll('.only-interior').forEach((b) => (b.hidden = !inner));
    const btn = this.gizmoEl.querySelector('.lock-btn');
    if (btn) {
      btn.classList.toggle('active', locked);
      btn.querySelector('.shackle')?.setAttribute('d', locked ? 'M8 11V7a4 4 0 0 1 8 0v4' : 'M8 11V7a4 4 0 0 1 7.5-2');
      btn.setAttribute('aria-label', locked ? 'ロック解除' : 'ロック');
    }
    this.gizmoEl.querySelectorAll('[data-action^="rotate"],[data-action="delete"]').forEach((b) => (b.disabled = locked));
    // 階段は撤去できない
    const fixed = !!(obj && this.getDef(obj.userData.defId).stairs);
    this.gizmoEl.querySelectorAll('[data-action="delete"]').forEach((b) => (b.hidden = fixed));
  }

  deselect() {
    if (!this.selected) return;
    this.selected = null;
    this.scene.remove(this.helper);
    this.helper.dispose();
    this.helper = null;
    this.panelEl.hidden = true;
    this.gizmoEl.hidden = true;
    document.body.classList.remove('has-selection');
  }

  /** 階段：上下の階へ移動するボタン */
  _stairsSection(obj) {
    const go = (dir, mark) => {
      const to = this.stairsTo?.(obj.userData.floor, dir);
      return `<button data-action="stairs-${dir}" ${to == null ? 'disabled' : ''}>${mark} ${to == null ? (dir === 'up' ? '上の階なし' : '下の階なし') : `${floorLabel(to)}へ`}</button>`;
    };
    return `<div class="actions">${go('up', '▲')}${go('down', '▼')}</div>`;
  }

  renderPanel() {
    const obj = this.selected;
    if (!obj) return;
    const def = this.getDef(obj.userData.defId);
    const { w, h, d } = def.size;
    const isTank = def.category === CATEGORY.TANK;
    const deg = ((Math.round(THREE.MathUtils.radToDeg(obj.rotation.y)) % 360) + 360) % 360;
    const where = obj.userData.interiorItem ? '水槽内' : floorLabel(obj.userData.floor);
    this.panelEl.innerHTML = `
      <h3>${obj.userData.name ? `${esc(obj.userData.name)}<small> ${def.name}</small>` : def.name}</h3>
      <div class="cat">${CATEGORY_LABELS[def.category]} · ${where}${obj.userData.embed ? ' · 壁に埋め込み中' : ''}</div>
      <dl>
        <dt>サイズ</dt><dd>${cm(w)}×${cm(d)}×${cm(h)}cm</dd>
        <dt>回転</dt><dd>${deg}°</dd>
        <dt>価格</dt><dd>${yen(def.price)}</dd>
        ${isTank ? `<dt>集客</dt><dd>${def.appeal}</dd>` : ''}
      </dl>
      <div class="actions">
        ${obj.userData.interiorItem ? `<button data-action="lock">${obj.userData.locked ? '🔒 ロック解除' : '🔓 ロック'}</button>` : ''}
        <button data-action="rotate-left">⟲ 回転</button>
        <button data-action="rotate-right">⟳ 回転</button>
        ${isTank ? '<button data-action="interior">✎ 水槽内</button>' : ''}
        ${def.stairs ? '' : '<button data-action="delete" class="danger">🗑 撤去</button>'}
      </div>
      ${def.stairs ? this._stairsSection(obj) : ''}
      ${isTank && this.allowEmbed ? this._lookSection(obj, def) : ''}
      ${isTank && this.allowEmbed && !def.atrium ? this._embedSection(obj) : ''}
      ${def.shape === 'liveRock' && this.getBrush ? this._sculptSection(def) : ''}
      ${def.growth && this.getGrowMode ? this._growthSection(obj, def) : ''}
      ${def.bubbles ? `<div class="section"><h4>泡の量</h4>${slider('bubbles', '泡', 0, 1, 0.05, obj.userData.bubbles ?? 0.5, '%')}</div>` : ''}`;
  }

  _lookSection(obj, def) {
    const look = normalizeLook(obj.userData.look);
    const sides = def.shape === 'cylinder' || def.shape === 'tunnel' ? [['back', '背面']] : [['back', '背面'], ['left', '左側面'], ['right', '右側面']];
    if (!sides.some(([k]) => k === this.lookSide)) this.lookSide = 'back';
    const cur = look[this.lookSide];
    const tab = ([k, label]) => {
      const s = look[k];
      const chip = `<i class="chip" style="background:${s.color};opacity:${Math.max(0.15, s.alpha)}"></i>`;
      return `<button data-action="look-side-${k}" class="${this.lookSide === k ? 'active' : ''}">${chip}${label}</button>`;
    };
    const swatches = PALETTE.map(
      (c) => `<button class="swatch${c === cur.color ? ' on' : ''}" style="background:${c}" data-action="look-swatch-${c}" aria-label="${c}"></button>`,
    ).join('');
    const frameSw = FRAME_COLORS.map(
      (c) => `<button class="swatch big${c === look.frameColor ? ' on' : ''}" style="background:${c}" data-action="look-framecolor-${c}" aria-label="${c}"></button>`,
    ).join('');
    return `<div class="section"><h4>バックスクリーン（色と透明度）</h4>
      <div class="seg">${sides.map(tab).join('')}</div>
      <div class="palette">${swatches}</div>
      ${slider('side-alpha', '不透明度', 0, 1, 0.05, cur.alpha, '%')}
      </div>
      <div class="section"><h4>フレーム</h4>
      <div class="seg">
        <button data-action="look-frame-on" class="${look.frame ? 'active' : ''}">フレームあり</button>
        <button data-action="look-frame-off" class="${look.frame ? '' : 'active'}">フレームレス</button>
      </div>
      ${look.frame ? `<div class="palette frames">${frameSw}</div>` : ''}
      </div>
      <div class="section"><h4>水槽ライト</h4>
      <div class="seg"><button data-action="look-light" class="${look.light.on ? 'active' : ''}">💡 ${look.light.on ? 'ON' : 'OFF'}</button></div>
      ${look.light.on ? `
      <div class="look-row"><span>ライト色</span><input type="color" data-look="lightColor" value="${look.light.color}">
        <button data-action="look-lightpreset-#e8f4ff">白</button><button data-action="look-lightpreset-#7fb4ff">青</button><button data-action="look-lightpreset-#ffe2b0">暖色</button></div>
      ${slider('tanklight-intensity', '明るさ', 0.2, 4, 0.1, look.light.intensity, '')}` : ''}</div>`;
  }

  _embedSection(obj) {
    const e = obj.userData.embed;
    if (!e) {
      return `<div class="section"><h4>壁への埋め込み</h4>
        <button data-action="embed">🧱 近くの壁に埋め込む</button></div>`;
    }
    return `<div class="section"><h4>壁への埋め込み</h4>
      ${slider('embed-ratio', '埋め込み', EMBED_RATIO_MIN, EMBED_RATIO_MAX, 0.05, e.ratio, '%')}
      ${slider('embed-bottom', '設置高さ', 0, 1.6, 0.02, e.bottom, 'm')}
      <div class="actions"><button data-action="unembed">壁から外す</button></div></div>`;
  }

  _sculptSection(def) {
    const b = this.getBrush();
    const maxR = Math.max(0.03, Math.min(def.size.w, def.size.d) * 0.5);
    const radius = Math.min(b.radius, maxR);
    const btn = (mode, label) => `<button data-action="brush-${mode ?? 'off'}" class="${b.mode === mode ? 'active' : ''}">${label}</button>`;
    return `<div class="section"><h4>岩肌ブラシ</h4>
      <div class="seg">${btn(null, 'オフ')}${btn('inflate', '⬆ 盛る')}${btn('deflate', '⬇ 削る')}</div>
      ${slider('brush-radius', '半径', 0.01, maxR.toFixed(3), 0.005, radius, 'cm')}
      ${slider('brush-strength', '強さ', 0.1, 1, 0.05, b.strength, '%')}</div>`;
  }

  _growthSection(obj, def) {
    const mode = this.getGrowMode();
    if (def.growth === 'modular') return this._partsSection(obj, mode);
    const g = obj.userData.growth ?? { ext: { x: 0, z: 0 } };
    const len = Math.round(Math.hypot(g.ext.x, g.ext.z) * 100);
    const btn = (m, label) => `<button data-action="grow-${m ?? 'off'}" class="${mode === m ? 'active' : ''}">${label}</button>`;
    const wood = def.growth === 'driftwood';
    const modes = wood
      ? `${btn(null, 'オフ')}${btn('branch', '🌿 枝を増やす')}${btn('extend', '➚ 伸ばす')}${btn('trunk', '🪵 太くする')}`
      : `${btn(null, 'オフ')}${btn('extend', '➚ 伸ばす')}`;
    const info = wood ? `パーツ ${g.parts?.length ?? 4} 本（幹＋枝）` : `群体の伸び ${len} cm`;
    const how = !mode
      ? 'モードを選んで本体をドラッグ'
      : mode === 'branch'
        ? '枝を生やしたい点から伸ばす方向へドラッグ'
        : mode === 'trunk'
          ? '太くしたい枝・幹を上下にドラッグ'
          : wood
            ? '伸ばしたい枝・幹を触って方向へドラッグ'
            : '本体から伸ばしたい方向へドラッグ';
    return `<div class="section"><h4>成長：${how}</h4>
      <div class="seg">${modes}</div>
      <div class="cat">${info}</div></div>`;
  }

  /** パーツ編集サンゴ：触った箇所にパーツを追加 / 伸縮 / 削減 */
  _partsSection(obj, mode) {
    const btn = (m, label) => `<button data-action="grow-${m ?? 'off'}" class="${mode === m ? 'active' : ''}">${label}</button>`;
    const how = { add: '増やしたい箇所から伸ばす方向へドラッグ（タップで既定サイズ）', extend: '伸縮したいパーツを触ってドラッグ', remove: '削りたいパーツをタップ' }[mode] ?? 'モードを選んで本体を操作';
    return `<div class="section"><h4>パーツ編集：${how}</h4>
      <div class="seg">${btn(null, 'オフ')}${btn('add', '＋ 拡張')}${btn('extend', '➚ 伸縮')}${btn('remove', '－ 削減')}</div>
      <div class="cat">パーツ ${obj.userData.growth?.nodes?.length ?? 0} 個</div></div>`;
  }

  /** 毎フレーム：ハイライト更新とギズモの画面位置追従 */
  update() {
    if (!this.selected) return;
    this.helper.update();
    this._box.setFromObject(this.selected);
    const v = this._v.set((this._box.min.x + this._box.max.x) / 2, this._box.max.y, (this._box.min.z + this._box.max.z) / 2).project(this.camera);
    const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    this.gizmoEl.style.visibility = visible ? 'visible' : 'hidden';
    this.gizmoEl.style.left = `${Math.min(Math.max(((v.x + 1) / 2) * window.innerWidth, 90), window.innerWidth - 90)}px`;
    this.gizmoEl.style.top = `${Math.max(((1 - v.y) / 2) * window.innerHeight - 10, 110)}px`;
  }
}
