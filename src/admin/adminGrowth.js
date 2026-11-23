import { CATCH_WEIGHT, RARITY_LIST, RARITY_NAME, activeCreatures } from '../expedition/creatureData.js';
import { PIECE_FISH, PIECES_PER_STAR, STAR_COUNT, MAX_PIECES, fishForPieces } from '../expedition/growth.js';
import { baseRules } from '../expedition/creatureConfig.js';
import { num } from './adminUi.js';
import { growthChartHtml, bindGrowthChart } from './growthChart.js';

/** レア度・成長タブ：レア度（カードの色）ごとの採取の重みと、8角星形ごとの1ピースの匹数 */
export class GrowthTab {
  constructor(state, changed) {
    Object.assign(this, { state, changed });
  }

  html() {
    const base = baseRules();
    const live = activeCreatures();
    const totalW = RARITY_LIST.reduce((s, r) => s + CATCH_WEIGHT[r], 0) || 1;
    const rarity = [...RARITY_LIST].reverse().map((r) => {
      const v = CATCH_WEIGHT[r];
      return `<tr><th><i class="ad-rar r${r}">${RARITY_NAME[r]}</i><small>${live.filter((c) => c.rarity === r).length}種</small></th>
        <td><input type="number" data-weight="${r}" value="${v}" min="0" step="1"><small>${v === base.weight[r] ? '標準' : `標準 ${base.weight[r]}`}</small></td>
        <td>${Math.round((v / totalW) * 100)}%<small>各レア度が同じ種数のとき</small></td></tr>`;
    }).join('');
    const pieces = Array.from({ length: STAR_COUNT }, (_, k) => {
      const v = PIECE_FISH[k];
      return `<tr><th>${k + 1}つ目の星</th>
        <td><input type="number" data-piece="${k}" value="${v}" min="1" step="1"><small>${v === base.pieceFish[k] ? '標準' : `標準 ${base.pieceFish[k]}`}</small></td>
        <td>${num(v * PIECES_PER_STAR)}匹</td><td>${num(fishForPieces((k + 1) * PIECES_PER_STAR))}匹</td></tr>`;
    }).join('');
    return `<section class="ad-card"><h3>レア度（カードの背景色）</h3>
        <p class="ad-note">アイテムカードの背景色でレア度を表します（緑→青→紫→金）。採取の重みが大きいほど捕れやすくなります。</p>
        <div class="ad-scroll"><table class="ad-table ad-rules"><thead><tr><th>レア度</th><th>採取の重み</th><th>出現率の目安</th></tr></thead><tbody>${rarity}</tbody></table></div></section>
      <section class="ad-card"><h3>成長（6つの8角星形 × 8ピース）</h3>
        <p class="ad-note">同じ魚種を成長に使うと、1つ目の星形から順にピースが埋まります。1ピースの匹数は星形ごとに設定します（全魚種・全レア度で共通）。全部で ${MAX_PIECES}ピース、すべて埋めるには ${num(fishForPieces(MAX_PIECES))}匹です。</p>
        <div class="ad-scroll"><table class="ad-table ad-rules"><thead><tr><th>星形</th><th>1ピースの匹数</th><th>8ピース</th><th>ここまでの累計</th></tr></thead><tbody>${pieces}</tbody></table></div>
        <h4>ピースごとの累計の匹数</h4><p class="ad-note">グラフをなぞると、そのピースの匹数と累計が出ます。</p>
        ${growthChartHtml()}
        <div class="ad-acts"><button id="ad-rules-reset">標準に戻す</button></div></section>`;
  }

  bind(root) {
    const cfg = this.state.cfg;
    for (const el of root.querySelectorAll('[data-weight]')) {
      el.onchange = () => {
        cfg.rarity ??= {};
        cfg.rarity.weight = { ...cfg.rarity.weight, [el.dataset.weight]: el.value === '' ? '' : Math.max(0, +el.value) };
        this.changed();
      };
    }
    for (const el of root.querySelectorAll('[data-piece]')) {
      el.onchange = () => {
        const list = [...PIECE_FISH];
        list[+el.dataset.piece] = Math.max(1, Math.round(+el.value) || 1);
        cfg.growth = { pieceFish: list };
        this.changed();
      };
    }
    root.querySelector('#ad-rules-reset').onclick = () => {
      delete cfg.rarity;
      delete cfg.growth;
      this.changed();
    };
    bindGrowthChart(root);
  }
}
