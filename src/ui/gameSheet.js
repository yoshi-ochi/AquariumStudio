import { PLACEABLE_TANKS as TANK_DEFS, TANK_DEFS as ALL_TANKS } from '../tanks/tankData.js';
import { MAX_ORDERS, outsourceCost, outsourceSeconds } from '../management/inventory.js';
import { icon } from './icons.js';
import { coin as yen } from './currency.js';
import { fmtLeft } from '../management/buildTimes.js';

const time = (s) => (s >= 60 ? `${Math.floor(s / 60)}分${s % 60 ? `${s % 60}秒` : ''}` : `${s}秒`);
const TAB_ACT = /^(tab|[a-z]+-tab|zk-mode)$/;
const TABS = [['stock', '所持品'], ['creatures', '生物'], ['supplier', '取引先'], ['outsource', '外注']];

/** 今後追加する機能の案内 */
export const FEATURES = {
  event: ['event', 'イベント開催', '館内イベントを開いて、来館者を増やします。'],
};

/** 下部バーから開くシート：アイテム（所持品・取引先・外注）と各機能の案内 */
export class GameSheet {
  constructor({ el, economy, inventory, expeditions, ops, panels, creatureView, previews, toast, onPlace }) {
    Object.assign(this, { el, economy, inventory, expeditions, panels, creatureView, previews, toast, onPlace });
    this.view = null;
    this._beat = 0;
    el.addEventListener('click', (e) => {
      if (e.target.matches('canvas[data-draw]')) return this.panels[this.view]?.view.draw?.(e) && this.render();
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      if (TAB_ACT.test(b.dataset.act)) this._top = true; // タブの切り替え（アイテム・メール・図鑑・イベント・水槽）
      this._act(b.dataset.act, b.dataset.id, b);
    });
    // 色・数値の入力は再描画せずに各画面へ渡す
    el.addEventListener('input', (e) => (this.panels[this.view]?.view ?? (this.view === 'creatures' ? this.creatureView : null))?.input?.(e.target));
    inventory.addEventListener('change', () => this.view && this.render());
    expeditions.addEventListener('change', () => this.view && this.render());
    ops.addEventListener('change', () => this.view && this.render());
    setInterval(() => this._tick(), 1000);
  }

  get _level() {
    return this.economy.stage.level;
  }

  openItems(tab = 'stock') {
    this._top = true;
    this.view = tab;
    this.el.hidden = false;
    this.render();
  }

  get isItems() {
    return TABS.some(([id]) => id === this.view);
  }

  /** panels のキー（expedition / clean / staff / shop）を開く */
  openPanel(id) {
    if (this.view !== id) this._top = true; // 別の画面を開いたら先頭から表示する
    this.view = id;
    this.el.hidden = false;
    this.render();
  }

  /** ダイヤが足りないとき：ショップのダイヤ購入を開く（short は足りない数） */
  openStore(short = 0) {
    if (short > 0) this.toast(`ダイヤが${short.toLocaleString('ja-JP')}足りません`, { error: true });
    this.openPanel('store');
    const list = this.el.querySelector('.gs-list');
    const packs = this.el.querySelector('#st-packs');
    if (list && packs) list.scrollTop += packs.getBoundingClientRect().top - list.getBoundingClientRect().top - 8;
  }

  openFeature(id) {
    this._top = true;
    this.view = `feature:${id}`;
    this.el.hidden = false;
    this.render();
  }

  close() {
    this.view = null;
    this.el.hidden = true;
    document.body.classList.remove('sheet-full');
  }

  render() {
    if (!this.view) return; // 操作の結果シートが閉じた（別館の建設で階を移るなど）
    // 水槽のシート以外は、地図と同じく画面全体を切り替えて表示する
    const full = this.view !== 'tank';
    this.el.classList.toggle('gs-full', full);
    document.body.classList.toggle('sheet-full', full);
    // 同じ画面の更新（毎秒の再描画・ボタン操作）はスクロール位置を保つ。画面やタブを切り替えたときは先頭へ
    const scroll = this._top ? 0 : this.el.querySelector('.gs-list')?.scrollTop ?? 0;
    this._top = false;
    this._render();
    const list = this.el.querySelector('.gs-list');
    if (list) list.scrollTop = scroll;
  }

  _render() {
    const head = (title) => `<div class="gs-head"><h3>${title}</h3><button data-act="close" class="gs-close" aria-label="閉じる">✕</button></div>`;
    if (this.view.startsWith('feature:')) {
      const [ic, title, text] = FEATURES[this.view.slice(8)];
      this.el.innerHTML = `${head(title)}<div class="gs-soon">${icon(ic, 40)}<p>${text}</p><b>準備中</b></div>`;
      return;
    }
    const panel = this.panels[this.view];
    if (panel) {
      this.el.innerHTML = `${head(panel.title)}<div class="gs-list">${panel.view.html()}</div>`;
      panel.view.afterRender?.(this.el);
      return;
    }
    const tabs = TABS.map(([id, label]) => `<button data-act="tab" data-id="${id}" class="${this.view === id ? 'active' : ''}">${label}</button>`).join('');
    this.el.innerHTML = `${head('アイテム')}<div class="gs-tabs">${tabs}</div><div class="gs-list">${this[`_${this.view}`]()}</div>`;
  }

  /** 水槽の商品カード（2〜3列の格子に並べる） */
  _row(def, info, button, locked = false) {
    return `<div class="gs-card ${locked ? 'locked' : ''}"><img src="${this.previews.get(def.id) ?? ''}" alt=""><b>${def.name}</b><small>${info}</small>${button}</div>`;
  }

  _cards(html) {
    return html ? `<div class="gs-cards">${html}</div>` : '';
  }

  _creatures() {
    return this.creatureView.html();
  }

  _stock() {
    // 撤去した大水槽など、取引先に無い水槽も所持していれば設置できる
    const owned = ALL_TANKS.filter((d) => this.inventory.count(d.id) > 0);
    const orders = this.inventory.orders.map((o) => {
      const def = ALL_TANKS.find((d) => d.id === o.defId);
      return def ? this._row(def, `外注で製作中 ・ 残り <span data-until="${o.doneAt}">${this._left(o)}</span>`, '') : '';
    });
    const rows = owned.map((d) => this._row(d, `所持数 ${this.inventory.count(d.id)}`, `<button data-act="place" data-id="${d.id}" class="primary">設置</button>`));
    return this._cards([...rows, ...orders].join('')) || '<p class="gs-empty">水槽を持っていません。取引先からの購入か、外注で入手できます。</p>';
  }

  _supplier() {
    return '<button data-act="open-build" class="primary tv-wide bd-open">🛠 水槽を建造する（形・サイズを自由に）</button><p class="gs-empty">買った水槽はすぐ届きます。</p>' + this._available((d) => this._row(d, yen(d.price), `<button data-act="buy" data-id="${d.id}" class="primary" ${this.economy.canAfford(d.price) ? '' : 'disabled'}>購入</button>`));
  }

  _outsource() {
    const full = this.inventory.orders.length >= MAX_ORDERS;
    const note = `<p class="gs-empty">定価の6割で作れますが、完成まで時間がかかります（発注中 ${this.inventory.orders.length}/${MAX_ORDERS}）。</p>`;
    return note + this._available((d) => {
      const cost = outsourceCost(d);
      return this._row(d, `${yen(cost)} ・ ${time(outsourceSeconds(d))}`, `<button data-act="order" data-id="${d.id}" class="primary" ${full || !this.economy.canAfford(cost) ? 'disabled' : ''}>発注</button>`);
    });
  }

  _available(row) {
    return this._cards(TANK_DEFS.map((d) => (d.requiredStage > this._level ? this._row(d, `🔒 ステージ${d.requiredStage}で解放`, '', true) : row(d))).join(''));
  }

  _left(o) {
    return time(Math.max(0, Math.ceil((o.doneAt - Date.now()) / 1000)));
  }

  _tick() {
    if (!this.view) return;
    let finished = false;
    this.el.querySelectorAll('[data-until]').forEach((s) => {
      const left = Math.ceil((+s.dataset.until - Date.now()) / 1000);
      if (left <= 0) finished = true;
      s.textContent = fmtLeft(Math.max(0, left));
    });
    if (finished) this.render(); // 帰還・完成を表示に反映
    else if (this.panels[this.view]?.live && ++this._beat % 3 === 0) this.render(); // 満足度などを更新
  }

  _act(act, id, b) {
    const def = TANK_DEFS.find((d) => d.id === id);
    if (act === 'close') return this.close();
    if (act === 'open-build') return this.openPanel('build');
    if (act === 'build-back') return this.openItems('stock');
    if (act === 'go-store') return this.openStore(+id);
    if (act === 'tab') {
      this.view = id;
      this.creatureView.picking = null;
      return this.render();
    }
    if ((this.panels[this.view]?.view ?? this.creatureView).act(act, id, b, () => this.view && this.render())) return this.render();
    if (act === 'place') {
      this.close();
      return this.onPlace(id);
    }
    if (act === 'buy' && this.economy.spend(def.price)) {
      this.inventory.add(id);
      this.toast(`${def.name} を購入しました`);
    } else if (act === 'order' && this.inventory.orders.length < MAX_ORDERS && this.economy.spend(outsourceCost(def))) {
      this.inventory.order(def);
      this.toast(`${def.name} を外注しました`);
    }
  }
}
