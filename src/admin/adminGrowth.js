import { RARITY, RARITY_WEIGHT, activeCreatures } from '../expedition/creatureData.js';
import { GROWTH_RULES, XP_OVERRIDE, xpPerFish, xpForRarityLevel, MAX_LEVEL } from '../expedition/growth.js';
import { baseRules } from '../expedition/creatureConfig.js';
import { esc, num } from './adminUi.js';
import { xpChartHtml, bindXpChart } from './xpChart.js';

const LEVELS = [2, 10, 50, 100, 300, MAX_LEVEL];
const current = (key) => (key === 'weight' ? RARITY_WEIGHT : GROWTH_RULES[key]);
/** レア度ごとの入力欄（data-rule にキー、data-r にレア度） */
const input = (key, r, step) => {
  const base = baseRules();
  const b = (key === 'weight' ? base.weight : base[key])[r];
  const v = current(key)[r];
  return `<input type="number" data-rule="${key}" data-r="${r}" value="${v}" step="${step}" min="0"><small>${v === b ? '標準' : `標準 ${b}`}</small>`;
};

/** レア度・経験値タブ：1匹あたりの経験値（レア度ごとに統一）の表と、レベルアップに要る経験値のグラフ */
export class GrowthTab {
  constructor(state, changed) {
    Object.assign(this, { state, changed });
    this.mode = 'step';
  }

  html() {
    const live = activeCreatures();
    const rows = [1, 2, 3].map((r) => {
      const list = live.filter((c) => c.rarity === r);
      const own = list.filter((c) => XP_OVERRIDE[c.id]);
      const xs = list.map((c) => xpPerFish(c.id));
      const range = GROWTH_RULES.xpFixed[r] > 0 ? '' : `<small>自動：${num(Math.min(...xs))}〜${num(Math.max(...xs))}</small>`;
      return `<tr><th>${RARITY[r]}<small>${list.length}種</small></th>
        <td>${input('xpFixed', r, 1)}${range}</td>
        <td>${own.length ? `${own.length}種<small>${esc(own.map((c) => `${c.name} ${num(XP_OVERRIDE[c.id])}`).join('、'))}</small>` : 'なし'}</td>
        <td>${input('weight', r, 1)}</td><td>${input('levelMul', r, 0.05)}</td></tr>`;
    }).join('');
    const auto = [1, 2, 3].map((r) => `<tr><th>${RARITY[r]}</th><td>${input('xpMul', r, 0.05)}</td><td>${input('xpMin', r, 1)}</td></tr>`).join('');
    const tab = (id, label) => `<button data-mode="${id}" class="${this.mode === id ? 'active' : ''}">${label}</button>`;
    return `<section class="ad-card"><h3>1匹あたりの経験値（レア度ごと）</h3>
        <p class="ad-note">同じレア度の魚は、成長に使ったときの経験値がすべて同じになります。0 にするとそのレア度は捕れやすさからの自動計算になります。魚種ごとの例外は魚種タブで設定します。</p>
        <div class="ad-scroll"><table class="ad-table ad-rules"><thead><tr><th>レア度</th><th>1匹の経験値</th><th>魚種ごとの例外</th><th>出現の重み</th><th>レベルアップの必要経験値の倍率</th></tr></thead><tbody>${rows}</tbody></table></div>
        <details class="ad-more"><summary>自動計算の設定（1匹の経験値を 0 にしたレア度だけに使う）</summary>
          <table class="ad-table ad-rules"><thead><tr><th>レア度</th><th>倍率</th><th>下限</th></tr></thead><tbody>${auto}</tbody></table></details>
        <div class="ad-acts"><button id="ad-rules-reset">標準に戻す</button></div></section>
      <section class="ad-card"><h3>レベルアップに要る経験値</h3>
        <div class="ad-bar"><div class="ad-seg">${tab('step', '次のレベルまで')}${tab('cum', 'Lv1 からの累計')}</div><span class="ad-note">グラフをなぞると、そのレベルの値と要る匹数が出ます。倍率が同じレア度は線が重なります。</span></div>
        ${xpChartHtml(this.mode)}
        ${this._table()}</section>`;
  }

  /** 区切りのレベルまでの累計と、要る匹数（そのレア度の1匹の経験値で） */
  _table() {
    const head = `<tr><th>レア度</th><th>1匹</th>${LEVELS.map((lv) => `<th>Lv${lv}まで</th>`).join('')}</tr>`;
    const rows = [1, 2, 3].map((r) => {
      const per = this._fish(r);
      const cells = LEVELS.map((lv) => {
        const need = xpForRarityLevel(lv, r);
        return `<td>${num(need)}<small>${num(Math.ceil(need / per))}匹</small></td>`;
      }).join('');
      return `<tr><th>${RARITY[r]}</th><td>${num(per)}</td>${cells}</tr>`;
    }).join('');
    return `<h4>区切りのレベルまで（累計）</h4><div class="ad-scroll"><table class="ad-table">${head}${rows}</table></div>`;
  }

  /** そのレア度の1匹の経験値（自動計算なら中央値） */
  _fish(r) {
    if (GROWTH_RULES.xpFixed[r] > 0) return GROWTH_RULES.xpFixed[r];
    const xs = activeCreatures().filter((c) => c.rarity === r && !XP_OVERRIDE[c.id]).map((c) => xpPerFish(c.id)).sort((a, b) => a - b);
    return xs[xs.length >> 1] ?? 1;
  }

  bind(root) {
    for (const el of root.querySelectorAll('[data-rule]')) {
      el.onchange = () => {
        const v = el.value === '' ? '' : Math.max(0, +el.value);
        const cfg = this.state.cfg;
        cfg.rarity ??= {};
        cfg.rarity[el.dataset.rule] = { ...cfg.rarity[el.dataset.rule], [el.dataset.r]: v };
        this.changed();
      };
    }
    for (const b of root.querySelectorAll('[data-mode]')) {
      b.onclick = () => {
        this.mode = b.dataset.mode;
        this.changed();
      };
    }
    root.querySelector('#ad-rules-reset').onclick = () => {
      delete this.state.cfg.rarity;
      this.changed();
    };
    bindXpChart(root, (r) => this._fish(r));
  }
}
