import { RARITY, RARITY_WEIGHT, activeCreatures } from '../expedition/creatureData.js';
import { GROWTH_RULES, xpPerFish, xpForLevel, MAX_LEVEL } from '../expedition/growth.js';
import { baseRules } from '../expedition/creatureConfig.js';
import { esc, num } from './adminUi.js';

/** 編集できるレア度ごとの規則 */
const ROWS = [
  ['weight', '出現の重み', '採取で選ばれる確率の重み（大きいほど捕れやすい）', 1],
  ['xpMul', '1匹の経験値の倍率', '捕れやすさから自動で決めた経験値にかける', 0.05],
  ['xpMin', '1匹の経験値の下限', '自動の経験値がこれより小さければ引き上げる', 1],
  ['xpFixed', '1匹の経験値を固定', '0 なら自動。魚種ごとの固定（魚種タブ）が優先', 1],
  ['levelMul', 'レベルアップの必要経験値の倍率', '1 で標準。2 なら同じレベルに2倍の経験値が要る', 0.05],
];
const LEVELS = [2, 10, 50, 100, 300, MAX_LEVEL];
const current = (key) => (key === 'weight' ? RARITY_WEIGHT : GROWTH_RULES[key]);

/** レア度・経験値タブ：出現率・1匹の経験値・レベルアップに要る経験値をレア度ごとに調整し、結果を確かめる */
export class GrowthTab {
  constructor(state, changed) {
    Object.assign(this, { state, changed });
  }

  html() {
    const base = baseRules();
    const head = `<tr><th>項目</th>${[1, 2, 3].map((r) => `<th>${RARITY[r]}</th>`).join('')}</tr>`;
    const rows = ROWS.map(([key, label, help, step]) => `<tr><td>${label}<small>${help}</small></td>${[1, 2, 3].map((r) => {
      const v = current(key)[r];
      const b = (key === 'weight' ? base.weight : base[key])[r];
      return `<td><input type="number" data-rule="${key}" data-r="${r}" value="${v}" step="${step}" min="0"><small>${v === b ? '標準' : `標準 ${b}`}</small></td>`;
    }).join('')}</tr>`).join('');
    return `<section class="ad-card"><h3>レア度ごとの調整</h3><p class="ad-note">変更するとすぐ下の試算に反映されます。プレイヤーの経験値（累計）はそのままで、レベルの区切りだけが変わります。</p>
        <div class="ad-scroll"><table class="ad-table ad-rules">${head}${rows}</table></div>
        <div class="ad-acts"><button id="ad-rules-reset">標準に戻す</button></div></section>
      ${this._preview()}`;
  }

  _preview() {
    const live = activeCreatures();
    const stat = (r) => {
      const xs = live.filter((c) => c.rarity === r).map((c) => xpPerFish(c.id)).sort((a, b) => a - b);
      if (!xs.length) return null;
      return { n: xs.length, min: xs[0], mid: xs[xs.length >> 1], max: xs.at(-1), list: live.filter((c) => c.rarity === r) };
    };
    const totalW = [1, 2, 3].reduce((s, r) => s + RARITY_WEIGHT[r], 0) || 1;
    const rows = [1, 2, 3].map((r) => {
      const s = stat(r);
      if (!s) return `<tr><td>${RARITY[r]}</td><td colspan="${3 + LEVELS.length}">魚種なし</td></tr>`;
      const id = s.list.find((c) => xpPerFish(c.id) === s.mid).id;
      const cells = LEVELS.map((lv) => {
        const need = xpForLevel(lv, id);
        return `<td>${num(need)}<small>中央値で${num(Math.ceil(need / s.mid))}匹</small></td>`;
      }).join('');
      return `<tr><td>${RARITY[r]}<small>${s.n}種 ・ 出現 ${Math.round((RARITY_WEIGHT[r] / totalW) * 100)}%（同数のとき）</small></td><td>${num(s.min)}</td><td>${num(s.mid)}</td><td>${num(s.max)}</td>${cells}</tr>`;
    }).join('');
    const head = `<tr><th>レア度</th><th>1匹の経験値 最小</th><th>中央値</th><th>最大</th>${LEVELS.map((lv) => `<th>Lv${lv}まで</th>`).join('')}</tr>`;
    const odd = [2, 3].flatMap((r) => live.filter((c) => c.rarity === r && xpPerFish(c.id) < (stat(r - 1)?.mid ?? 0)).map((c) => `${c.name}（${RARITY[r]}・${num(xpPerFish(c.id))}）`));
    return `<section class="ad-card"><h3>試算</h3><p class="ad-note">「Lvまで」は Lv1 からの累計経験値と、中央値の魚で要る匹数です。</p>
      <div class="ad-scroll"><table class="ad-table">${head}${rows}</table></div>
      ${odd.length ? `<p class="ad-warn">ひとつ下のレア度の中央値より1匹の経験値が少ない魚種：${esc(odd.join('、'))}</p>` : ''}</section>`;
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
    root.querySelector('#ad-rules-reset').onclick = () => {
      delete this.state.cfg.rarity;
      this.changed();
    };
  }
}
