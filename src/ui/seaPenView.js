import { CREATURES, getCreature } from '../expedition/creatureData.js';
import { PEN, PEN_N, sectionSize } from '../building/seaPen.js';
import { creatureThumb } from './creatureThumb.js';

const yen = (n) => `¥${Math.floor(n).toLocaleString('ja-JP')}`;
const num = (n) => Math.round(n).toLocaleString('ja-JP');
const HUES = [150, 40, 280, 340, 90, 20, 200, 120, 60, 310];

/**
 * 屋外生け簀の画面：解放、区画づくり（5m 格子の2点を選ぶ）、区画ごとの生き物の出し入れ。
 */
export class SeaPenView {
  constructor({ pen, economy, expeditions, previews, toast, onLook }) {
    Object.assign(this, { pen, economy, expeditions, previews, toast, onLook });
    this.anchor = null; // 区画の1点目 [i, j]
    this.pending = null; // 作る前の長方形
    this.sel = null; // 選んでいる区画の id
  }

  html() {
    const level = this.economy.stage.level;
    if (!this.pen.unlocked) {
      const ok = this.pen.canUnlock(level) && this.economy.canAfford(PEN.unlockCost);
      return `<p class="gs-empty">本館の右手の海に、${PEN.size}m×${PEN.size}m の生け簀を作ります。${PEN.cell}m 単位で自由に区切り、区画ごとに大型の生き物を展示できます。</p>
        ${level < PEN.unlockLevel ? `<p class="gs-empty">水族館レベル${PEN.unlockLevel}で解放できます（現在 Lv${level}）</p>` : ''}
        <button data-act="pen-unlock" class="primary tv-wide" ${ok ? '' : 'disabled'}>生け簀を作る ${yen(PEN.unlockCost)}</button>`;
    }
    const s = this.sel && this.pen.getSection(this.sel);
    return `<div class="gs-btns"><button data-act="pen-look" class="primary">生け簀を見る</button></div>
      <p class="gs-empty">空いているマスを2つタップすると、その2点を対角にした区画を作れます（1マス ${PEN.cell}m・費用 ${yen(PEN.cellCost)}/マス）。区画をタップすると生き物を出し入れできます。</p>
      ${this._grid()}${this._pending()}${s ? this._section(s) : ''}`;
  }

  _grid() {
    const index = new Map(this.pen.sections.map((s, k) => [s.id, k]));
    const cells = [];
    for (let j = 0; j < PEN_N; j++) {
      for (let i = 0; i < PEN_N; i++) {
        const s = this.pen.sectionAt(i, j);
        const p = this.pending;
        const inPending = p && i >= p.x0 && i <= p.x1 && j >= p.z0 && j <= p.z1;
        const anchor = this.anchor && this.anchor[0] === i && this.anchor[1] === j;
        const style = s ? ` style="--h:${HUES[index.get(s.id) % HUES.length]}"` : '';
        const cls = `${s ? 'sec' : ''}${s && s.id === this.sel ? ' sel' : ''}${inPending ? ' pend' : ''}${anchor ? ' anchor' : ''}`;
        cells.push(`<button class="sp-cell ${cls}"${style} data-act="pen-cell" data-id="${i}:${j}" aria-label="${i + 1}列${j + 1}行"></button>`);
      }
    }
    return `<div class="sp-grid">${cells.join('')}</div>`;
  }

  _pending() {
    if (this.anchor && !this.pending) return '<p class="gs-empty">もう1つのマスをタップしてください。<button data-act="pen-cancel">やめる</button></p>';
    if (!this.pending) return '';
    const { w, d } = sectionSize(this.pending);
    const cost = this.pen.buildCost(this.pending);
    return `<div class="gs-row wrap"><div class="gs-info"><b>新しい区画 ${w}m×${d}m</b><small>収容枠 ${num(w * d * PEN.slotsPerM2)} ・ 水深 ${PEN.depth}m</small></div>
      <div class="gs-btns"><button data-act="pen-build" class="primary" ${this.economy.canAfford(cost) ? '' : 'disabled'}>作る ${yen(cost)}</button><button data-act="pen-cancel">やめる</button></div></div>`;
  }

  _section(s) {
    const { w, d } = sectionSize(s);
    const used = this.pen.used(s);
    const cap = this.pen.capacity(s);
    const inside = Object.entries(s.creatures).map(([id, n]) => `<div class="gs-row wrap">${creatureThumb(this.previews, id)}<div class="gs-info"><b>${getCreature(id)?.name ?? id} ×${n}</b></div>
      <div class="gs-btns"><button data-act="pen-out" data-id="${id}:1">1匹戻す</button><button data-act="pen-out" data-id="${id}:${n}">全部戻す</button></div></div>`).join('');
    const owned = CREATURES.filter((c) => this.expeditions.count(c.id) > 0).map((c) => {
      const fit = Math.min(this.expeditions.count(c.id), this.pen.room(s, c.id));
      return `<div class="gs-row wrap">${creatureThumb(this.previews, c.id)}<div class="gs-info"><b>${c.name}</b><small>在庫 ${this.expeditions.count(c.id)} ・ 1匹 ${c.slots}枠</small></div>
        <div class="gs-btns"><button data-act="pen-in" data-id="${c.id}:1" data-repeat ${fit >= 1 ? '' : 'disabled'}>1匹入れる</button><button data-act="pen-in" data-id="${c.id}:${fit}" class="primary" ${fit >= 1 ? '' : 'disabled'}>${fit}匹入れる</button></div></div>`;
    }).join('');
    return `<h4 class="gs-sub">区画 ${w}m×${d}m ・ 収容 ${num(used)}/${num(cap)}枠</h4>
      ${inside || '<p class="gs-empty">まだ生き物がいません。</p>'}
      <h4 class="gs-sub">在庫から入れる</h4>${owned || '<p class="gs-empty">在庫に生き物がいません。</p>'}
      <div class="gs-btns"><button data-act="pen-remove" class="danger">区画を撤去（生き物は在庫へ）</button><button data-act="pen-close">閉じる</button></div>`;
  }

  act(act, id) {
    if (!act.startsWith('pen-')) return false;
    const pen = this.pen;
    if (act === 'pen-unlock') {
      if (pen.canUnlock(this.economy.stage.level) && this.economy.spend(PEN.unlockCost)) pen.unlock();
    } else if (act === 'pen-look') this.onLook();
    else if (act === 'pen-cancel') this.anchor = this.pending = null;
    else if (act === 'pen-close') this.sel = null;
    else if (act === 'pen-cell') this._cell(id.split(':').map(Number));
    else if (act === 'pen-build') {
      if (this.pending && this.economy.spend(pen.buildCost(this.pending))) this.sel = pen.addSection(this.pending).id;
      this.anchor = this.pending = null;
    } else if (act === 'pen-in') this._move(id, true);
    else if (act === 'pen-out') this._move(id, false);
    else if (act === 'pen-remove') {
      const back = pen.removeSection(this.sel);
      for (const [cid, n] of Object.entries(back)) this.expeditions.give(cid, n);
      this.sel = null;
    }
    return true;
  }

  _cell([i, j]) {
    const s = this.pen.sectionAt(i, j);
    if (s && !this.anchor) {
      this.sel = s.id;
      this.pending = null;
      return;
    }
    if (s) return this.toast('ほかの区画と重なっています', { error: true });
    if (!this.anchor || this.pending) {
      this.anchor = [i, j];
      this.pending = null;
      this.sel = null;
      return;
    }
    const r = this.pen.rectOf(this.anchor, [i, j]);
    if (!r) {
      this.anchor = null;
      return this.toast('ほかの区画と重なっています', { error: true });
    }
    this.pending = r;
  }

  /** 在庫と区画のあいだで生き物を動かす */
  _move(key, into) {
    const s = this.pen.getSection(this.sel);
    if (!s) return;
    const [id, k] = key.split(':');
    const n = Math.max(0, Number(k) || 0);
    if (into) {
      const m = Math.min(n, this.expeditions.count(id), this.pen.room(s, id));
      if (m > 0 && this.expeditions.take(id, m)) this.pen.addCreature(s, id, m);
    } else {
      const room = Math.floor((this.expeditions.getCapacity() - this.expeditions.usedSlots) / (getCreature(id)?.slots ?? 1));
      const m = Math.min(n, Math.max(0, room));
      if (m < n) this.toast('保持枠が足りないため、入る分だけ戻しました', { error: m === 0 });
      const got = this.pen.takeCreature(s, id, m);
      if (got) this.expeditions.give(id, got);
    }
  }
}
