import { CREATURES } from '../expedition/creatureData.js';
import { dishPrice } from './expeditionViews.js';
import { creatureThumb } from './creatureThumb.js';
import { coin as yen } from './currency.js';


/** 食堂の画面：在庫の生き物を料理として提供して売上にする（食堂をタップで開く） */
export class DinerView {
  constructor({ expeditions, economy, previews, isOpen }) {
    Object.assign(this, { expeditions, economy, previews, isOpen });
  }

  html() {
    if (!this.isOpen()) return '<p class="gs-empty">館内エリアで食堂を開くと、料理を提供できます。</p>';
    const rows = CREATURES.filter((c) => this.expeditions.count(c.id) > 0).map((c) => {
      const n = this.expeditions.count(c.id);
      return `<div class="gs-row wrap">${creatureThumb(this.previews, c.id)}<div class="gs-info"><b>${c.name}</b><small>在庫 ${n} ・ 1皿 ${yen(dishPrice(c))}</small></div>
        <div class="gs-btns"><button data-act="diner-serve" data-id="${c.id}:1" data-repeat>1皿提供</button><button data-act="diner-serve" data-id="${c.id}:${n}" class="primary">${n}皿 ${yen(dishPrice(c) * n)}</button></div></div>`;
    }).join('');
    return `<p class="gs-empty">提供口から、在庫の生き物を料理として出します。提供した生き物は在庫から減ります。</p>${rows || '<p class="gs-empty">在庫に生き物がいません。</p>'}`;
  }

  act(act, id) {
    if (act !== 'diner-serve') return false;
    const [cid, k] = id.split(':');
    const c = CREATURES.find((x) => x.id === cid);
    const n = Math.min(Number(k) || 1, this.expeditions.count(cid));
    if (!c || n <= 0 || !this.isOpen() || !this.expeditions.take(cid, n)) return true;
    this.economy.earn(dishPrice(c) * n);
    return true;
  }
}
