import { GROUP_LABELS, groupOf } from '../tanks/tankData.js';
import { coin as yen } from './currency.js';


/**
 * 編集シートのタブ + カタログカード。
 * extraTabs（例：部屋）を選ぶと onTab(id) を呼び、カードの代わりに別パネルを出す。
 */
export class Catalog {
  constructor({ tabsEl, cardsEl, previews, economy, onSelect, onTab, priceLabel, isOwned = () => true, onUnlock }) {
    Object.assign(this, { tabsEl, cardsEl, previews, economy, onSelect, onTab, priceLabel, isOwned, onUnlock });
    this.defs = [];
    this.extraTabs = [];
    this.activeTab = null;
    this.activeId = null;

    tabsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-tab]');
      if (btn) this.selectTab(btn.dataset.tab);
    });
    cardsEl.addEventListener('click', (e) => {
      const card = e.target.closest('.card');
      if (!card || card.disabled) return;
      const def = this.defs.find((d) => d.id === card.dataset.id);
      if (def?.unlock === 'dia' && !this.isOwned(def)) return this.onUnlock?.(def); // ダイヤで解放してから置ける
      this.onSelect(card.dataset.id);
    });
    economy.addEventListener('change', () => this._refreshLocks());
  }

  setDefs(defs, extraTabs = []) {
    this.defs = defs;
    this.extraTabs = extraTabs;
    this.groups = [...new Set(this._shown(defs).map(groupOf))];
    this.activeId = null;
    this.selectTab(this.groups[0]);
  }

  selectTab(id) {
    this.activeTab = id;
    const extra = this.extraTabs.find((t) => t.id === id);
    this.tabsEl.innerHTML = [
      ...this.groups.map((g) => [g, GROUP_LABELS[g]]),
      ...this.extraTabs.map((t) => [t.id, t.label]),
    ]
      .map(([tid, label]) => `<button data-tab="${tid}" class="${tid === id ? 'active' : ''}">${label}</button>`)
      .join('');
    this.cardsEl.hidden = !!extra;
    if (!extra) this._renderCards();
    this.cardsEl.scrollLeft = 0; // タブを替えたら先頭のカードから
    this.onTab?.(id, !!extra);
  }

  /** 内装ガチャで出ていない物は並べない */
  _shown(defs) {
    return defs.filter((d) => d.unlock !== 'gacha' || this.isOwned(d));
  }

  /** 価格・在庫の表示を更新（ガチャで内装が増えたらタブも作り直す） */
  refresh() {
    const groups = [...new Set(this._shown(this.defs).map(groupOf))];
    if (groups.join() !== (this.groups ?? []).join()) {
      this.groups = groups;
      if (this.activeTab && !this.extraTabs.some((t) => t.id === this.activeTab)) return this.selectTab(groups.includes(this.activeTab) ? this.activeTab : groups[0]);
    }
    if (this.activeTab && !this.cardsEl.hidden) this._renderCards();
  }

  setActive(defId) {
    this.activeId = defId;
    this.cardsEl.querySelectorAll('.card').forEach((c) => c.classList.toggle('active', c.dataset.id === defId));
  }

  _renderCards() {
    this.cardsEl.innerHTML = '';
    for (const def of this._shown(this.defs).filter((d) => groupOf(d) === this.activeTab)) {
      const card = document.createElement('button');
      card.className = 'card';
      card.dataset.id = def.id;
      const img = document.createElement('img');
      img.alt = def.name;
      img.src = this.previews.get(def.id) ?? '';
      card.append(img);
      card.insertAdjacentHTML('beforeend', `<span class="name">${def.name}</span><span class="price">${this.priceLabel?.(def) ?? yen(def.price)}</span>`);
      this.cardsEl.append(card);
    }
    this._refreshLocks();
    this.setActive(this.activeId);
  }

  _refreshLocks() {
    const level = this.economy.stage.level;
    this.cardsEl.querySelectorAll('.card').forEach((card) => {
      const def = this.defs.find((d) => d.id === card.dataset.id);
      const locked = def.requiredStage > level;
      card.classList.toggle('locked', locked);
      card.disabled = locked;
      const dia = def.unlock === 'dia' && !this.isOwned(def); // ダイヤで解放する物（押すと解放の確認）
      card.classList.toggle('dia-locked', dia);
      let badge = card.querySelector('.lock');
      const text = locked ? `🔒 ステージ${def.requiredStage}` : dia ? `💎${def.diaPrice}で解放` : '';
      if (text && !badge) {
        badge = document.createElement('span');
        badge.className = 'lock';
        card.append(badge);
      }
      if (text) badge.textContent = text;
      else badge?.remove();
    });
  }
}
