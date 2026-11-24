import { CREATURES, getCreature } from '../expedition/creatureData.js';
import { creatureThumb } from './creatureThumb.js';

const num = (n) => Math.round(n).toLocaleString('ja-JP');

/**
 * イルカプールの展示の画面：水槽と同じく、在庫の生き物を入れたり戻したりする。
 * pool: DolphinPool（creatures / capacity / used / room(id) / add / take）
 */
export class PoolView {
  constructor({ pool, expeditions, previews, toast }) {
    Object.assign(this, { pool, expeditions, previews, toast });
  }

  html() {
    const p = this.pool;
    const inside = Object.entries(p.creatures).map(([id, n]) => `<div class="gs-row wrap">${creatureThumb(this.previews, id)}<div class="gs-info"><b>${getCreature(id)?.name ?? id} ×${n}</b></div>
      <div class="gs-btns"><button data-act="pool-out" data-id="${id}:1" data-repeat>1匹戻す</button><button data-act="pool-out" data-id="${id}:${n}">全部戻す</button></div></div>`).join('');
    const owned = CREATURES.filter((c) => this.expeditions.count(c.id) > 0).map((c) => {
      const fit = Math.min(this.expeditions.count(c.id), p.room(c.id));
      return `<div class="gs-row wrap">${creatureThumb(this.previews, c.id)}<div class="gs-info"><b>${c.name}</b><small>在庫 ${this.expeditions.count(c.id)} ・ 1匹 ${c.slots}枠</small></div>
        <div class="gs-btns"><button data-act="pool-in" data-id="${c.id}:1" data-repeat ${fit >= 1 ? '' : 'disabled'}>1匹入れる</button><button data-act="pool-in" data-id="${c.id}:${fit}" class="primary" ${fit >= 1 ? '' : 'disabled'}>${fit}匹入れる</button></div></div>`;
    }).join('');
    return `<p class="gs-empty">観客席のあるショープール。イルカなどの生き物を入れて展示できます。</p>
      <h4 class="gs-sub">展示中 ・ 収容 ${num(p.used)}/${num(p.capacity)}枠</h4>${inside || '<p class="gs-empty">まだ生き物がいません。</p>'}
      <h4 class="gs-sub">在庫から入れる</h4>${owned || '<p class="gs-empty">在庫に生き物がいません。</p>'}`;
  }

  act(act, id) {
    if (!act.startsWith('pool-')) return false;
    const [cid, k] = id.split(':');
    const n = Math.max(0, Number(k) || 0);
    if (act === 'pool-in') {
      const m = Math.min(n, this.expeditions.count(cid), this.pool.room(cid));
      if (m > 0 && this.expeditions.take(cid, m)) this.pool.add(cid, m);
    } else if (act === 'pool-out') {
      const room = Math.floor((this.expeditions.getCapacity() - this.expeditions.usedSlots) / (getCreature(cid)?.slots ?? 1));
      const m = Math.min(n, Math.max(0, room));
      if (m < n) this.toast('保持枠が足りないため、入る分だけ戻しました', { error: m === 0 });
      const got = this.pool.take(cid, m);
      if (got) this.expeditions.give(cid, got);
    }
    return true;
  }
}
