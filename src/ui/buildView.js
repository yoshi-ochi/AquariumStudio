import { BUILD_SHAPES, DRAW_GRID, normalizeSpec, customDef, registerCustom, volumeOf, validPoly } from '../tanks/customTanks.js';
import { tankCapacity } from '../expedition/tankLife.js';
import { coin as yen, coinText } from './currency.js';

const LABEL = { w: '幅', d: '奥行', h: '高さ' };

/** 水槽建造：形と寸法を決めて水槽を作り、在庫に加える */
export class BuildView {
  constructor({ economy, inventory, toast }) {
    Object.assign(this, { economy, inventory, toast });
    this.spec = normalizeSpec({ shape: 'box', w: 90, h: 45, d: 45 });
    this.pts = []; // 描いている頂点（10cm単位、キャンバスの格子座標）
    this.height = 60;
    this.built = null;
  }

  /** 今の入力で作る水槽の仕様。描画中で形になっていなければ null */
  get _spec() {
    if (this.spec.shape !== 'poly') return this.spec;
    const s = normalizeSpec({ shape: 'poly', h: this.height, pts: this.pts });
    return s.pts.length >= 3 && validPoly(s) ? s : null;
  }

  _summary() {
    const spec = this._spec;
    if (!spec) return this.pts.length >= 3 ? '<em class="gs-alert">辺が交差しています。1つ戻すかクリアしてください</em>' : '<small>格子をタップして、水槽の輪郭の角を3つ以上置いてください</small>';
    const def = customDef(spec);
    return `<b>${def.name}</b><small>水量 ${Math.round(volumeOf(spec) * 1000).toLocaleString('ja-JP')}L ・ 収容枠 ${tankCapacity(def)} ・ 集客 ${def.appeal}</small><small>建造費 <b>${yen(def.price)}</b></small>`;
  }

  html() {
    const s = this.spec;
    const L = BUILD_SHAPES[s.shape].limits;
    const shapes = Object.entries(BUILD_SHAPES).map(([k, v]) => `<button data-act="build-shape" data-id="${k}" class="${s.shape === k ? 'active' : ''}">${v.label}</button>`).join('');
    const keys = s.shape === 'cylinder' ? ['w', 'h'] : s.shape === 'poly' ? [] : ['w', 'd', 'h'];
    const draw = s.shape === 'poly' ? `<p class="gs-empty">上から見た形です。1マス10cm、最大 ${DRAW_GRID.w * 10}×${DRAW_GRID.d * 10}cm。角をタップで置くと線でつながり、最後の角と最初の角が自動で閉じます。</p>
      <canvas data-draw class="bd-canvas" width="${DRAW_GRID.w * 8}" height="${DRAW_GRID.d * 8}" aria-label="水槽の形を描く格子"></canvas>
      <div class="gs-btns"><button data-act="build-undo" ${this.pts.length ? '' : 'disabled'}>1つ戻す</button><button data-act="build-clear" ${this.pts.length ? '' : 'disabled'}>クリア</button></div>
      <label class="bd-slider"><span>高さ</span><input type="range" data-field="build-height" min="${BUILD_SHAPES.poly.limits.h[0]}" max="${BUILD_SHAPES.poly.limits.h[1]}" step="5" value="${this.height}"><output>${this.height}cm</output></label>` : '';
    const sliders = keys.map((k) => {
      const label = s.shape === 'cylinder' && k === 'w' ? '直径' : LABEL[k];
      return `<label class="bd-slider"><span>${label}</span><input type="range" data-field="build-${k}" min="${L[k][0]}" max="${L[k][1]}" step="5" value="${s[k]}"><output>${s[k]}cm</output></label>`;
    }).join('');
    const spec = this._spec;
    const price = spec ? customDef(spec).price : 0;
    const done = this.built ? `<div class="gs-row"><div class="gs-info"><b>${this.built.name} を建造しました</b><small>所持数 ${this.inventory.count(this.built.id)}</small></div><button data-act="place" data-id="${this.built.id}" class="primary">設置</button></div>` : '';
    return `<button data-act="build-back">← アイテムへ</button>
      <p class="gs-empty">形と寸法を自由に決めて、水槽を特注で建造します。完成した水槽は所持品に入ります。</p>
      <div class="sp-seg">${shapes}</div>
      ${draw}${sliders}
      <div class="st-sum bd-sum">${this._summary()}</div>
      <button data-act="build-make" class="primary tv-wide" ${spec && this.economy.canAfford(price) ? '' : 'disabled'}>建造する ${spec ? yen(price) : ''}</button>
      ${done}`;
  }

  /** スライダーは再描画せずに数値と見積もりを更新する */
  input(el) {
    const k = el.dataset.field?.replace('build-', '');
    if (k === 'height') {
      this.height = Number(el.value);
      el.parentElement.querySelector('output').textContent = `${this.height}cm`;
    } else if (['w', 'd', 'h'].includes(k)) {
      this.spec = normalizeSpec({ ...this.spec, [k]: el.value });
      el.parentElement.querySelector('output').textContent = `${this.spec[k]}cm`;
    } else return;
    this._refresh(el.closest('.gs-list'));
  }

  _refresh(list) {
    list.querySelector('.bd-sum').innerHTML = this._summary();
    const spec = this._spec;
    const price = spec ? customDef(spec).price : 0;
    const btn = list.querySelector('[data-act="build-make"]');
    btn.textContent = `建造する ${spec ? coinText(price) : ''}`;
    btn.disabled = !spec || !this.economy.canAfford(price);
  }

  /** 格子のタップで角を置く。再描画が必要なら true */
  draw(e) {
    const c = e.target;
    const r = c.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * DRAW_GRID.w);
    const z = Math.round(((e.clientY - r.top) / r.height) * DRAW_GRID.d);
    const last = this.pts[this.pts.length - 1];
    if (last && last[0] === x && last[1] === z) return false;
    if (this.pts.length >= 40) return false;
    this.pts.push([x, z]);
    return true;
  }

  afterRender(root) {
    const c = root.querySelector('canvas[data-draw]');
    if (!c) return;
    const g = c.getContext('2d');
    const k = c.width / DRAW_GRID.w;
    g.fillStyle = '#f4f8fb';
    g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = '#d6e2ea';
    g.lineWidth = 1;
    for (let i = 0; i <= DRAW_GRID.w; i++) {
      g.beginPath();
      g.moveTo(i * k + 0.5, 0);
      g.lineTo(i * k + 0.5, c.height);
      g.stroke();
    }
    for (let j = 0; j <= DRAW_GRID.d; j++) {
      g.beginPath();
      g.moveTo(0, j * k + 0.5);
      g.lineTo(c.width, j * k + 0.5);
      g.stroke();
    }
    if (!this.pts.length) return;
    g.beginPath();
    this.pts.forEach(([x, z], i) => (i ? g.lineTo(x * k, z * k) : g.moveTo(x * k, z * k)));
    if (this.pts.length >= 3) {
      g.closePath();
      g.fillStyle = this._spec ? 'rgba(63, 155, 214, .3)' : 'rgba(226, 84, 84, .25)';
      g.fill();
    }
    g.strokeStyle = '#1f7fb8';
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = '#1f7fb8';
    for (const [x, z] of this.pts) {
      g.beginPath();
      g.arc(x * k, z * k, 6, 0, Math.PI * 2);
      g.fill();
    }
  }

  act(act, id) {
    if (act === 'build-shape') {
      this.spec = id === 'poly' ? { shape: 'poly' } : normalizeSpec({ ...this.spec, w: this.spec.w ?? 90, h: this.spec.h ?? 45, d: this.spec.d ?? 45, shape: id });
      return true;
    }
    if (act === 'build-undo') return this.pts.pop(), true;
    if (act === 'build-clear') return (this.pts = []), true;
    if (act !== 'build-make') return false;
    const spec = this._spec;
    if (!spec) return true;
    const price = customDef(spec).price;
    if (!this.economy.spend(price)) {
      this.toast('コインが足りません', { error: true });
      return true;
    }
    const def = registerCustom(spec);
    this.inventory.add(def.id);
    this.built = def;
    this.toast(`${def.name} を建造しました`);
    return true;
  }
}
