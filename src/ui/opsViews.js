import { tankLabel } from '../tanks/tankLabel.js';
import { artIcon } from './artIcons.js';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
import { ROLES, GUIDE_MAX, PRODUCTS, PRICE_TIERS, LOT_SIZE, SALES_PER_STAFF } from '../management/opsData.js';
import { cleanSpec, dirtLevel, isCleaning, needsCleaning, startCleaning, busyCleaners } from '../tanks/tankCleaning.js';

const yen = (n) => `¥${Math.floor(n).toLocaleString('ja-JP')}`;
const span = (s) => {
  if (s >= 3600) return `${Math.floor(s / 3600)}時間${Math.floor((s % 3600) / 60)}分`;
  return s >= 60 ? `${Math.floor(s / 60)}分` : `${Math.max(0, Math.ceil(s))}秒`;
};

/** 水槽の掃除 */
export class CleanView {
  constructor({ manager, economy, ops, toast, getTanks, onChanged }) {
    Object.assign(this, { manager, economy, ops, toast, getTanks, onChanged });
  }

  get _free() {
    return this.ops.staff.cleaner - busyCleaners(this.getTanks());
  }

  html() {
    const now = Date.now();
    const tanks = [...this.getTanks()].sort((a, b) => dirtLevel(b, now) - dirtLevel(a, now));
    const rows = tanks.map((t) => this._row(t, now));
    return `<p class="gs-empty">空いている清掃員 ${Math.max(0, this._free)}/${this.ops.staff.cleaner}人</p>${rows.join('') || '<p class="gs-empty">水槽がありません。</p>'}`;
  }

  _row(t, now) {
    const spec = cleanSpec(t.userData.defId);
    const uid = t.userData.uid;
    const name = esc(tankLabel(this.manager, t));
    if (isCleaning(t)) {
      return `<div class="gs-row"><div class="gs-info"><b>${name}</b><small>掃除中 ・ 残り <span data-until="${t.userData.clean.until}">${span((t.userData.clean.until - now) / 1000)}</span></small></div></div>`;
    }
    const need = needsCleaning(t, now);
    const left = (1 - dirtLevel(t, now)) * spec.interval;
    const status = need ? '<em class="gs-alert">掃除が必要です</em>' : `次の掃除まで ${span(left)}`;
    const buttons = [];
    if (spec.staff) {
      const ok = this._free >= spec.staff.crew && this.economy.canAfford(spec.staff.cost);
      buttons.push(`<button data-act="clean-staff" data-id="${uid}" class="primary" ${ok ? '' : 'disabled'}>職員${spec.staff.crew}人 ${yen(spec.staff.cost)}</button>`);
    }
    if (spec.diver) {
      buttons.push(`<button data-act="clean-diver" data-id="${uid}" ${this.economy.canAfford(spec.diver.cost) ? '' : 'disabled'}>ダイバー ${yen(spec.diver.cost)}</button>`);
    }
    return `<div class="gs-row wrap"><div class="gs-info"><b>${name}</b><small>${status}</small></div><div class="gs-btns">${buttons.join('')}</div></div>`;
  }

  act(act, id) {
    if (act !== 'clean-staff' && act !== 'clean-diver') return false;
    const tank = this.manager.objects.get(+id);
    if (!tank || isCleaning(tank)) return true;
    const spec = cleanSpec(tank.userData.defId);
    const staff = act === 'clean-staff';
    const plan = staff ? spec.staff : spec.diver;
    if (staff && this._free < plan.crew) return true;
    if (!this.economy.spend(plan.cost)) return true;
    startCleaning(tank, plan.seconds, staff ? plan.crew : 0);
    this.toast(`${tankLabel(this.manager, tank)} の掃除を始めました`);
    this.onChanged();
    return true;
  }
}

/** 従業員の配置と満足度 */
export class StaffView {
  constructor({ ops }) {
    this.ops = ops;
  }

  html() {
    const o = this.ops;
    const sat = Math.round(o.satisfaction);
    const problems = o.problems;
    const rows = ROLES.map((r) => {
      const n = o.staff[r.id];
      const need = o.required[r.id];
      return `<div class="gs-row"><div class="gs-info"><b>${r.name}</b><small>${r.text} ・ ${yen(r.wage)}/秒</small></div>
        <span class="st-need ${n < need ? 'lack' : ''}">${n}/${need}人</span>
        <div class="st-ctl"><button data-act="fire" data-repeat data-id="${r.id}" aria-label="${r.name}を減らす" ${n ? '' : 'disabled'}>−</button><button data-act="hire" data-repeat data-id="${r.id}" class="primary" aria-label="${r.name}を増やす" ${r.id === 'guide' && n >= GUIDE_MAX ? 'disabled' : ''}>＋</button></div></div>`;
    });
    return `<div class="st-sum"><div class="st-head"><b>来館者満足度 ${sat}%</b><small>来館者 ${Math.round(o.visitorMult * 100)}%</small></div>
      <div class="st-bar"><i style="width:${sat}%"></i></div>
      <small>賃金の合計 ${yen(o.wages)}/秒</small>
      ${problems.length ? `<em class="gs-alert">${problems.join('、')}</em>` : '<small>人員は足りています</small>'}</div>${rows.join('')}`;
  }

  act(act, id) {
    if (act === 'hire') this.ops.hire(id);
    else if (act === 'fire') this.ops.fire(id);
    else return false;
    return true;
  }
}

/** お土産店 */
export class ShopView {
  constructor({ ops, economy, inventory, onPlace }) {
    Object.assign(this, { ops, economy, inventory, onPlace });
  }

  html() {
    const o = this.ops;
    const level = this.economy.stage.level;
    const need = o.shops + o.cafes;
    const head = `<div class="st-sum"><div class="st-head"><b>売店 ${o.shops ? '営業中' : '未開店'} ・ 食堂 ${o.cafes ? '営業中' : '未開店'}</b><small>売上合計 ${yen(o.sales)}</small></div>
      <small>店員 ${o.staff.shop}/${need}人</small>
      ${need > o.staff.shop ? '<em class="gs-alert">店員が足りません。スタッフから配置してください</em>' : ''}
      ${o.shops && o.cafes ? '<small>売店をタップすると商品の補充、食堂をタップすると料理の提供ができます</small>' : '<small>売店・食堂は、館内エリアで海獣広場の左に開けます</small>'}</div>`;
    if (!o.shops) return head;
    const rows = PRODUCTS.map((p) => {
      if (p.stage > level) return `<div class="gs-row locked">${artIcon(p.id)}<div class="gs-info"><b>${p.name}</b><small>ステージ${p.stage}で解放</small></div></div>`;
      const tier = o.tierOf(p.id);
      const seg = Object.entries(PRICE_TIERS).map(([k, t]) => `<button data-act="shop-tier" data-id="${p.id}:${k}" class="${k === tier ? 'active' : ''}">${t.label}</button>`).join('');
      const cost = p.cost * LOT_SIZE;
      return `<div class="gs-row wrap">${artIcon(p.id)}<div class="gs-info"><b>${p.name}</b><small>販売 ${yen(o.priceOf(p))} ・ 原価 ${yen(p.cost)} ・ 在庫 ${o.stock[p.id] ?? 0}</small></div>
        <div class="gs-btns"><div class="sp-seg">${seg}</div><button data-act="shop-stock" data-id="${p.id}" class="primary" ${this.economy.canAfford(cost) ? '' : 'disabled'}>${LOT_SIZE}個仕入れ ${yen(cost)}</button></div></div>`;
    });
    return head + rows.join('');
  }

  act(act, id) {
    const o = this.ops;
    if (act === 'shop-place') {
      this.onPlace(id);
      return false;
    }
    if (act === 'shop-stock') o.restock(id, this.economy);
    else if (act === 'shop-tier') {
      const [pid, tier] = id.split(':');
      o.setTier(pid, tier);
    } else return false;
    return true;
  }
}
