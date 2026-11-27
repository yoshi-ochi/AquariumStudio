import { CREATURES, getCreature } from '../expedition/creatureData.js';
import { creatureThumb } from '../ui/creatureThumb.js';
import { coin } from '../ui/currency.js';
import { jobHtml, boostButton, timeNote } from '../building/builder.js';
import { PARCELS, getParcel, PARCEL_CAPACITY, RESERVE_LEVEL, PARCEL_BUILD_SECONDS, MAX_BONUS, canProtect } from './reserveData.js';

const num = (n) => Math.round(n).toLocaleString('ja-JP');
const pct = (x) => `${Math.round(x * 100)}%`;

/** 環境保護区の画面：収支と効果・区画の地図・選んだ区画の生き物の出し入れ */
export class ReserveView {
  constructor({ reserve, expeditions, economy, previews, builder, toast }) {
    Object.assign(this, { reserve, expeditions, economy, previews, builder, toast });
    this.sel = null; // 選んでいる区画
  }

  html() {
    const r = this.reserve;
    const level = this.economy.stage.level;
    if (!r.available) return `<p class="gs-empty">水族館レベル${RESERVE_LEVEL}「${'環境保護区をもつ水族館'}」に昇格すると、自前の環境保護区を作れます（現在 Lv${level}）。区画ごとに海域・陸域を整備し、クジラや大型の生き物を保護します。</p>`;
    const s = r.stats();
    const sum = `<div class="st-sum"><div class="st-head"><b>環境保護区</b><small>区画 ${r.openParcels.length}/${PARCELS.length}</small></div>
      <small>維持費 毎時 ${coin(s.upkeep)} ・ エコツアー収入 毎時 ${coin(s.eco)}</small>
      <small><b>差し引き 毎時 ${s.net >= 0 ? '−' : '＋'}${coin(Math.abs(s.net))}</b></small>
      <small>保護の貢献度 ${num(s.contribution)} ・ 水族館の来館者 +${pct(s.bonus)}（最大 +${pct(MAX_BONUS)}）</small>
      ${r.state.unpaid ? '<em class="gs-alert">維持費が払えていません。コインが足りない間は来館者が増えません</em>' : ''}</div>`;
    const cell = (p) => {
      const open = r.isOpen(p.id);
      const job = this.builder.job('reserve', p.id);
      const ids = Object.keys(r.creaturesOf(p.id));
      const icons = ids.slice(0, 3).map((id) => creatureThumb(this.previews, id)).join('');
      return `<button class="rv-cell ${p.kind} ${open ? 'open' : ''} ${this.sel === p.id ? 'sel' : ''}" data-act="rv-pick" data-id="${p.id}"><b>${p.name}</b><span class="rv-icons">${icons}</span><small>${job ? '工事中' : open ? `${num(r.used(p.id))}/${PARCEL_CAPACITY}枠` : '未整備'}</small></button>`;
    };
    const row = (kind) => PARCELS.filter((p) => p.kind === kind).map(cell).join('');
    const map = `<div class="rv-map"><div class="rv-sea">${row('sea')}</div><div class="rv-land">${row('land')}</div></div>`;
    return `${sum}<p class="gs-empty">上の8区画が海域、下の4区画が陸域です。区画をタップして整備・保護する生き物を選びます。</p>${map}${this.sel ? this._parcel(getParcel(this.sel)) : ''}`;
  }

  _parcel(p) {
    const r = this.reserve;
    const job = this.builder.job('reserve', p.id);
    const head = `<h4 class="gs-sub">${p.name}（${p.kind === 'sea' ? '海域' : '陸域'}）</h4><p class="gs-empty">${p.text} ・ 維持費 毎時 ${coin(p.upkeep)}</p>`;
    if (job) return `${head}<div class="gs-row"><div class="gs-info"><b>整備中</b>${jobHtml(job)}</div>${boostButton(job)}</div>`;
    if (!r.isOpen(p.id)) {
      return `${head}<button data-act="rv-open" data-id="${p.id}" class="primary tv-wide" ${this.economy.canAfford(p.cost) ? '' : 'disabled'}>整備する ${coin(p.cost)}${timeNote(PARCEL_BUILD_SECONDS)}</button>`;
    }
    const inside = Object.entries(r.creaturesOf(p.id)).map(([id, n]) => `<div class="gs-row wrap">${creatureThumb(this.previews, id)}<div class="gs-info"><b>${getCreature(id)?.name ?? id} ×${n}</b></div>
      <div class="gs-btns"><button data-act="rv-out" data-id="${id}:1">1匹戻す</button><button data-act="rv-out" data-id="${id}:${n}">全部戻す</button></div></div>`).join('');
    const owned = CREATURES.filter((c) => this.expeditions.count(c.id) > 0 && canProtect(p, c.id)).map((c) => {
      const fit = Math.min(this.expeditions.count(c.id) - this.expeditions.variantTotal(c.id), r.room(p.id, c.id));
      return `<div class="gs-row wrap">${creatureThumb(this.previews, c.id)}<div class="gs-info"><b>${c.name}</b><small>在庫 ${this.expeditions.count(c.id)} ・ 1匹 ${c.slots}枠</small></div>
        <div class="gs-btns"><button data-act="rv-in" data-id="${c.id}:1" ${fit >= 1 ? '' : 'disabled'}>1匹入れる</button><button data-act="rv-in" data-id="${c.id}:${Math.max(1, fit)}" class="primary" ${fit >= 1 ? '' : 'disabled'}>${fit}匹入れる</button></div></div>`;
    }).join('');
    const hint = p.kind === 'sea' ? 'クジラ・イルカ・大型のサメやエイ・ウミガメなど、大きな海の生き物を保護できます' : '陸や水辺で暮らす生き物と、産卵に上陸するウミガメを保護できます';
    return `${head}<h4 class="gs-sub">保護している生き物（${num(r.used(p.id))}/${PARCEL_CAPACITY}枠）</h4>${inside || '<p class="gs-empty">まだいません。</p>'}
      <h4 class="gs-sub">在庫から保護する</h4><p class="gs-empty">${hint}。アルビノなどは入れません。</p>${owned || '<p class="gs-empty">この区画で保護できる生き物が在庫にいません。</p>'}`;
  }

  act(act, id) {
    if (act === 'rv-pick') this.sel = this.sel === id ? null : id;
    else if (act === 'rv-open') this.builder.orderReserve(id);
    else if (act === 'build-boost') {
      const [kind, jid] = id.split('|');
      this.builder.boost(kind, jid);
    } else if (act === 'rv-in' || act === 'rv-out') this._move(id, act === 'rv-in');
    else return false;
    return true;
  }

  /** 在庫と区画のあいだで動かす（アルビノなどは動かさない） */
  _move(key, into) {
    const p = this.sel && getParcel(this.sel);
    if (!p) return;
    const [id, k] = key.split(':');
    const n = Math.max(0, Number(k) || 0);
    const ex = this.expeditions;
    const r = this.reserve;
    if (into) {
      const m = Math.min(n, ex.count(id) - ex.variantTotal(id), r.room(p.id, id));
      if (m > 0 && canProtect(p, id) && ex.take(id, m)) r.add(p.id, id, m);
    } else {
      const room = Math.floor((ex.getCapacity() - ex.usedSlots) / (getCreature(id)?.slots ?? 1));
      const m = Math.min(n, Math.max(0, room));
      if (m < n) this.toast('保持枠が足りないため、入る分だけ戻しました', { error: m === 0 });
      const got = r.take(p.id, id, m);
      if (got) ex.give(id, got);
    }
  }
}
