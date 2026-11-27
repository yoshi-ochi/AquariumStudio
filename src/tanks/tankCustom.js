import * as THREE from 'three';
import { ROCK_SHAPES } from './interiorBuilder.js';
import { CATEGORY, CATEGORY_LABELS } from './tankData.js';
import { EMBED_RATIO_MIN, EMBED_RATIO_MAX } from '../room/embed.js';
import { normalizeLook, PALETTE, FRAME_COLORS } from './tankLook.js';
import { SAND_TYPES } from './sandLook.js';
import { floorLabel } from '../building/blueprint.js';
import { specOf, pointCount, LEVELS } from '../flora/floraBuilder.js';
import { levelLabel, snapLevel } from './waterLevel.js';
import { waterSection, setWaterLevel, refreshWaterNote } from './waterControl.js';
import { coin as yen } from '../ui/currency.js';

const cm = (v) => Math.round(v * 100);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** スライダー1行（data-param で onAction(`param-${name}`, obj, value) に届く） */
function slider(name, label, min, max, step, value, fmt) {
  return `<label class="slider">${label}<input type="range" data-param="${name}" data-fmt="${fmt}" min="${min}" max="${max}" step="${step}" value="${value}"><output>${format(fmt, value)}</output></label>`;
}
const fmtLen = (m) => (m >= 1 ? `${Math.round(m * 10) / 10} m` : `${Math.round(m * 100)} cm`);
export function format(fmt, v) {
  v = Number(v);
  if (fmt === 'cm') return `${Math.round(v * 100)} cm`;
  if (fmt === 'm') return `${v.toFixed(2)} m`;
  if (fmt === '%') return `${Math.round(v * 100)}%`;
  if (fmt.startsWith('sz:')) {
    // 生き物オブジェの大きさ（sz:最小:最大。段階に丸める）
    const [, a, b] = fmt.split(':').map(Number);
    return fmtLen(a + (b - a) * (Math.round(v * (LEVELS - 1)) / (LEVELS - 1)));
  }
  if (fmt === 'water') return levelLabel(v); // 水位（0〜100%、5%刻み）
  if (fmt === 'lv') return `${Math.round(v / 0.2)} / 20`; // 水槽ライトの光量の段階
  return `${v}`;
}

/**
 * 選択中オブジェクトの詳細パネル・ハイライト・画面上ギズモ。
 * 操作は onAction(action, obj, value) に委ねる。
 * パネルの追加セクション：岩肌ブラシ（ライブロック）、成長（サンゴ・流木・海藻）、壁埋め込み（水槽・館内編集時）
 */
export class TankCustomizer {
  constructor({ scene, camera, panelEl, gizmoEl, getDef, onAction, getGrowMode, getFloraRadius, stairsTo, getSkins }) {
    Object.assign(this, { scene, camera, panelEl, gizmoEl, getDef, onAction, getGrowMode, getFloraRadius, stairsTo, getSkins });
    // 水位のスライダーはここで処理する（詳細パネルと編集シートの「見た目」タブのどちらからも onAction で届く）
    this.onAction = (action, obj, value) => (action === 'param-water-level' ? this._setWater(obj, value) : onAction(action, obj, value));
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

  /** 水位を変える。生き物がいて 0% にできないときはスライダーを戻して知らせる */
  _setWater(tank, value) {
    const lv = setWaterLevel(tank, value);
    if (lv == null) return;
    for (const el of document.querySelectorAll('input[data-param="water-level"]')) el.value = lv;
    refreshWaterNote(tank, snapLevel(value) === 0 && lv > 0);
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

  /** デザイン（水槽台・説明プレート）：持っているデザインから選ぶ。増やすのは内装ガチャ */
  _skinSection(obj, def) {
    const cur = obj.userData.skin ?? null;
    const list = this.getSkins(def.skin);
    const btns = list.map((s, i) => `<button data-action="skin-${s.id}" class="${(cur ?? list[0].id) === s.id ? 'active' : ''}"><i class="chip" style="background:${s.chip}"></i>${esc(s.name)}</button>`).join('');
    return `<div class="section"><h4>デザイン</h4><div class="seg wrap">${btns}</div><small class="note">内装ガチャでデザインが増えます</small></div>`;
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
        ${isTank ? '<button data-action="tank-edit" class="primary">🐟 水槽を編集</button><button data-action="interior">✎ 水槽内</button>' : ''}
        ${isTank ? '<button data-action="share" title="URL で水槽を見せる（LINE・インスタなど）">🔗 共有</button>' : ''}
        ${isTank && !def.atrium && this.allowEmbed ? '<button data-action="copy" title="サイズ・見た目・水槽内レイアウトを複製（展示生物は除く）">📋 コピー</button>' : ''}
        ${def.stairs ? '' : '<button data-action="delete" class="danger">🗑 撤去</button>'}
      </div>
      ${def.stairs ? this._stairsSection(obj) : ''}
      ${def.skin && this.getSkins ? this._skinSection(obj, def) : ''}
      ${isTank && this.allowEmbed && !def.atrium ? this._embedSection(obj) : ''}
      ${isTank ? waterSection(obj, slider) : ''}
      ${obj.userData.interiorItem && obj.userData.locked ? '<p class="note">ロック中です。「ロック解除」で移動・回転・編集ができます（解除できるのは1つだけ。ほかの物は自動でロックされます）</p>' : `
      ${def.shape === 'liveRock' && obj.userData.interiorItem && !obj.userData.locked ? this._rockShapeSection(obj) : ''}
      ${def.flora && this.getGrowMode ? this._floraSection(obj, def) : def.growth && this.getGrowMode ? this._growthSection(obj) : ''}`}
      ${def.bubbles ? `<div class="section"><h4>泡の量</h4>${slider('bubbles', '泡', 0, 1, 0.05, obj.userData.bubbles ?? 0.5, '%')}</div>` : ''}`;
  }

  /** 底砂（あり・なし・種類・厚さ）、砂なしの底面の色、底に映る光の模様 */
  _sandSection(obj, look) {
    const s = look.sand;
    const base = obj.getObjectByName('sand')?.userData.sandBase;
    const depth = s.depth ?? base?.h ?? 0.03;
    const maxD = Math.max(0.1, (obj.userData.interior?.waterTop ?? 0.4) * 0.4);
    const types = SAND_TYPES.map((t) => `<button data-action="look-sandtype-${t.id}" class="${s.type === t.id ? 'active' : ''}"><i class="chip" style="background:${t.color}"></i>${t.label}</button>`).join('');
    return `<div class="section"><h4>底砂</h4>
      <div class="seg"><button data-action="look-sand-on" class="${s.on ? 'active' : ''}">砂あり</button><button data-action="look-sand-off" class="${s.on ? '' : 'active'}">砂なし</button></div>
      ${s.on ? `<div class="seg wrap">${types}</div>${slider('sand-depth', '厚さ', 0.005, maxD, 0.005, Math.min(depth, maxD), 'cm')}` : '<p class="note">底面の色は「バックスクリーン・底面」の「底面」で選べます。</p>'}
      <div class="seg"><button data-action="look-caustics" class="${look.caustics ? 'active' : ''}">🌊 底のゆらめく光 ${look.caustics ? 'ON' : 'OFF'}</button></div>${look.caustics && !look.light.on ? '<small class="note">水紋は水槽ライトを付けているときに映ります</small>' : ''}
      </div>`;
  }

  /** 水槽の見た目の設定（水槽の編集シートの「見た目」タブで使う） */
  lookHtml(obj) {
    const def = this.getDef(obj.userData.defId);
    return this._lookSection(obj, def);
  }

  _lookSection(obj, def) {
    const look = normalizeLook(obj.userData.look);
    const hasBottom = def.shape === 'box' || def.shape === 'cylinder' || def.shape === 'poly';
    const sides = [...(def.shape === 'cylinder' || def.shape === 'tunnel' ? [['back', '背面']] : [['back', '背面'], ['left', '左側面'], ['right', '右側面']]), ...(hasBottom ? [['bottom', '底面']] : [])];
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
    return `${waterSection(obj, slider)}<div class="section"><h4>バックスクリーン・底面（色と透明度）</h4>
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
      ${def.shape === 'box' || def.shape === 'cylinder' || def.shape === 'poly' ? this._sandSection(obj, look) : ''}
      <div class="section"><h4>水槽ライト</h4>
      <div class="seg"><button data-action="look-light" class="${look.light.on ? 'active' : ''}">💡 ${look.light.on ? 'ON' : 'OFF'}</button></div>
      ${look.light.on ? `
      <div class="look-row"><span>ライト色</span><input type="color" data-look="lightColor" value="${look.light.color}">
        <button data-action="look-lightpreset-#e8f4ff">白</button><button data-action="look-lightpreset-#7fb4ff">青</button><button data-action="look-lightpreset-#ffe2b0">暖色</button></div>
      ${slider('tanklight-intensity', '光量', 0.2, 4, 0.2, look.light.intensity, 'lv')}<small class="note">光量が強いほど水紋が深くまで届く（n段階で水深 n m までほぼ届く）</small>` : ''}</div>`;
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

  /** 岩の形（数種類から選ぶ・くじで変える） */
  _rockShapeSection(obj) {
    const cur = obj.userData.shape ?? 0;
    const btns = ROCK_SHAPES.map((sh, i) => `<button data-action="rockshape-${i}" class="${i === cur ? 'active' : ''}">${sh.label}</button>`).join('');
    return `<div class="section"><h4>岩の形</h4><div class="seg wrap">${btns}</div>
      <div class="actions"><button data-action="rockshape-random">🎲 別の形にする</button></div></div>`;
  }

  /** 流木の編集（枝を増やす・伸ばす・太くする） */
  _growthSection(obj) {
    const mode = this.getGrowMode();
    const g = obj.userData.growth ?? {};
    const btn = (m, label) => `<button data-action="grow-${m ?? 'off'}" class="${mode === m ? 'active' : ''}">${label}</button>`;
    const how = { branch: '枝を生やしたい点から伸ばす方向へドラッグ', trunk: '太くしたい枝・幹を上下にドラッグ', extend: '伸ばしたい枝・幹を触って方向へドラッグ' }[mode] ?? 'モードを選んで本体をドラッグ';
    return `<div class="section"><h4>成長：${how}</h4>
      <div class="seg">${btn(null, 'オフ')}${btn('branch', '🌿 枝を増やす')}${btn('extend', '➚ 伸ばす')}${btn('trunk', '🪵 太くする')}</div>
      <div class="cat">パーツ ${g.parts?.length ?? 4} 本（幹＋枝）</div></div>`;
  }

  /**
   * 生き物オブジェ（サンゴ・ソフトコーラル・イソギンチャク・海藻・水草）。
   * 面に広がる種：ブラシで岩・砂・壁をなぞって広げる／消す。固着点から育つ種：「成長」で群体を大きくする。海藻は高さを伸ばせる
   */
  _floraSection(obj, def) {
    const spec = specOf(def);
    const g = obj.userData.growth;
    const mode = this.getGrowMode();
    const btn = (m, label) => `<button data-action="grow-${m ?? 'off'}" class="${mode === m ? 'active' : ''}">${label}</button>`;
    const size = spec.size ? slider('flora-size', spec.kind === 'grow' ? '成長' : '高さ', 0, 1, 1 / (LEVELS - 1), g.s, `sz:${spec.size[0]}:${spec.size[1]}`) : '';
    if (spec.kind === 'grow') {
      return `<div class="section"><h4>成長：固着点から育つ</h4>${size}
        <div class="cat">${spec.dim}で ${fmtLen(spec.size[0])}〜${fmtLen(spec.size[1])}</div></div>`;
    }
    const how = mode === 'paint' ? '岩・砂・壁をなぞると、その面に広がります' : mode === 'erase' ? 'なぞった所の個体を消します' : 'ブラシを選んで、広げたい面をなぞる';
    const limit = spec.maxR ? `・群体の径は最大 ${Math.round(spec.maxR * 200)}cm` : '';
    return `<div class="section"><h4>広げる：${how}</h4>
      <div class="seg">${btn(null, 'オフ')}${btn('paint', '🖌 広げる')}${btn('erase', '🧽 消す')}</div>
      ${slider('flora-radius', 'ブラシの太さ', spec.gap, spec.gap * 10, spec.gap / 2, Math.min(spec.gap * 10, Math.max(spec.gap, this.getFloraRadius?.() ?? spec.gap * 2)), 'cm')}
      ${size}
      <div class="cat">個体 ${pointCount(g)} / 最大 ${spec.max}${limit}</div></div>`;
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
