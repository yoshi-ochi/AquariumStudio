import { tankLabel } from '../tanks/tankLabel.js';
import { artIcon } from './artIcons.js';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
import { ROLES, GUIDE_MAX, PRODUCTS, PRICE_TIERS, LOT_SIZE, SALES_PER_STAFF } from '../management/opsData.js';
import { cleanSpec, dirtLevel, isCleaning, needsCleaning, startCleaning, busyCleaners } from '../tanks/tankCleaning.js';
import { coin as yen } from './currency.js';

const span = (s) => {
  if (s >= 3600) return `${Math.floor(s / 3600)}時間${Math.floor((s % 3600) / 60)}分`;
  return s >= 60 ? `${Math.floor(s / 60)}分` : `${Math.max(0, Math.ceil(s))}秒`;
};

/** 水槽の掃除：要掃除・掃除中・きれいの3つに分け、2列のタイルで並べる。要掃除はまとめて職員に頼める */
export class CleanView {
  constructor({ manager, economy, ops, toast, getTanks, onChanged }) {
    Object.assign(this, { manager, economy, ops, toast, getTanks, onChanged });
    this.showClean = false; // きれいな水槽の一覧を開いているか
  }

  get _free() {
    return this.ops.staff.cleaner - busyCleaners(this.getTanks());
  }

  html() {
    const now = Date.now();
    const tanks = [...this.getTanks()].sort((a, b) => dirtLevel(b, now) - dirtLevel(a, now));
    if (!tanks.length) return '<p class="gs-empty">水槽がありません。</p>';
    const need = tanks.filter((t) => needsCleaning(t, now));
    const busy = tanks.filter(isCleaning);
    const clean = tanks.filter((t) => !isCleaning(t) && !needsCleaning(t, now));
    const plan = this._bulkPlan(need);
    const bulk = need.length
      ? `<button data-act="clean-all" class="primary tv-wide" ${plan.count ? '' : 'disabled'}>まとめて掃除 ${plan.count}基 ・ ${yen(plan.cost)}</button>
        ${plan.count < need.length ? `<small>${plan.why}</small>` : ''}`
      : '<small>掃除が必要な水槽はありません</small>';
    const head = `<div class="st-sum cl-sum"><div class="cl-stats">
        <span class="${need.length ? 'bad' : ''}"><b>${need.length}</b>要掃除</span><span><b>${busy.length}</b>掃除中</span><span><b>${clean.length}</b>きれい</span><span><b>${Math.max(0, this._free)}/${this.ops.staff.cleaner}</b>空き清掃員</span>
      </div>${bulk}</div>`;
    const grid = (list) => `<div class="cl-grid">${list.map((t) => this._tile(t, now)).join('')}</div>`;
    const sec = (title, list) => (list.length ? `<h4 class="gs-sub">${title} ${list.length}基</h4>${grid(list)}` : '');
    const cleanSec = clean.length
      ? `<button data-act="clean-more" class="gs-fold">${this.showClean ? '▲' : '▼'} きれいな水槽 ${clean.length}基</button>${this.showClean ? grid(clean) : ''}`
      : '';
    return `${head}${sec('掃除が必要', need)}${sec('掃除中', busy)}${cleanSec}`;
  }

  /** まとめて掃除：職員で頼める要掃除の水槽を、汚れている順に人数と所持金の範囲で選ぶ */
  _bulkPlan(need) {
    let free = this._free;
    let money = this.economy.money;
    const picks = [];
    let lackStaff = false;
    for (const t of need) {
      const st = cleanSpec(t.userData.defId).staff;
      if (!st) continue;
      if (free < st.crew) {
        lackStaff = true;
        continue;
      }
      if (money < st.cost) continue;
      free -= st.crew;
      money -= st.cost;
      picks.push(t);
    }
    const cost = picks.reduce((s, t) => s + cleanSpec(t.userData.defId).staff.cost, 0);
    const why = lackStaff ? '清掃員が足りない分は、空いてから頼めます（スタッフで増やせます）' : 'ダイバーが必要な水槽は1基ずつ頼んでください';
    return { picks, count: picks.length, cost, why };
  }

  /** 水槽シート（tankView）用：1基分のタイル */
  _row(t, now) {
    return this._tile(t, now);
  }

  _tile(t, now) {
    const spec = cleanSpec(t.userData.defId);
    const uid = t.userData.uid;
    const name = esc(tankLabel(this.manager, t));
    if (isCleaning(t)) {
      return `<div class="cl-tile busy"><b>${name}</b><small>掃除中 ・ 残り <span data-until="${t.userData.clean.until}">${span((t.userData.clean.until - now) / 1000)}</span></small></div>`;
    }
    const dirt = dirtLevel(t, now);
    const need = dirt >= 1;
    const status = need ? '' : `<small>次まで ${span((1 - dirt) * spec.interval)}</small>`;
    const bar = `<i class="cl-bar ${need ? 'bad' : ''}"><i style="width:${Math.min(100, Math.round(dirt * 100))}%"></i></i>`;
    const buttons = [];
    if (spec.staff) {
      const ok = this._free >= spec.staff.crew && this.economy.canAfford(spec.staff.cost);
      buttons.push(`<button data-act="clean-staff" data-id="${uid}" class="${need ? 'primary' : ''}" title="職員${spec.staff.crew}人で掃除" ${ok ? '' : 'disabled'}>職員${spec.staff.crew} ${yen(spec.staff.cost)}</button>`);
    }
    if (spec.diver) {
      buttons.push(`<button data-act="clean-diver" data-id="${uid}" ${this.economy.canAfford(spec.diver.cost) ? '' : 'disabled'}>ダイバー ${yen(spec.diver.cost)}</button>`);
    }
    return `<div class="cl-tile ${need ? 'need' : ''}"><b>${name}</b>${status}${bar}${buttons.join('')}</div>`;
  }

  act(act, id) {
    if (act === 'clean-more') {
      this.showClean = !this.showClean;
      return true;
    }
    if (act === 'clean-all') {
      const now = Date.now();
      const { picks } = this._bulkPlan([...this.getTanks()].filter((t) => needsCleaning(t, now)).sort((a, b) => dirtLevel(b, now) - dirtLevel(a, now)));
      for (const t of picks) {
        const st = cleanSpec(t.userData.defId).staff;
        if (!this.economy.spend(st.cost)) break;
        startCleaning(t, st.seconds, st.crew);
      }
      if (picks.length) {
        this.toast(`${picks.length}基の掃除を始めました`);
        this.onChanged();
      }
      return true;
    }
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
