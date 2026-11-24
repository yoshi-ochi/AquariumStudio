import { ROLES, STARTING_STAFF, GUIDE_MAX, requiredStaff, PRODUCTS, PRICE_TIERS, BUY_RATE, SALES_PER_STAFF, LOT_SIZE, CAFE_RATE, CAFE_PRICE } from './opsData.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
/** 満足度が目標値へ近づく速さ（1秒あたりの割合） */
const SAT_RATE = 0.02;
const UNPAID_PENALTY = 30;
const DIRTY_PENALTY = 25;

/** 従業員・賃金・来館者満足度・お土産店 */
export class Operations extends EventTarget {
  constructor() {
    super();
    this.staff = { ...STARTING_STAFF };
    this.satisfaction = 80;
    this.shops = 0; // 設置済みのお土産店（館内の配置から毎秒更新）
    this.cafes = 0;
    this._cafeGuests = 0;
    this.prices = {};
    this.stock = {};
    this.sales = 0;
    this.required = { ...STARTING_STAFF };
    this.wageMult = 1; // 研究「労務管理」で下がる
    this.cleanerRelief = 0; // 清掃センターで減る清掃員の必要数
    this.unpaid = false;
    this.dirtyRatio = 0;
    this._acc = 0;
    this._buyers = 0;
  }

  /** 満足度 0→来館者4割、100→10割 */
  get visitorMult() {
    return 0.4 + 0.6 * (this.satisfaction / 100);
  }

  get wages() {
    return ROLES.reduce((s, r) => s + r.wage * this.staff[r.id], 0) * this.wageMult;
  }

  /** 人員の充足度（必要な職種の重み付き平均 0〜1） */
  get coverage() {
    let sum = 0;
    let total = 0;
    for (const r of ROLES) {
      const need = this.required[r.id];
      if (need <= 0) continue;
      sum += r.weight * Math.min(1, this.staff[r.id] / need);
      total += r.weight;
    }
    return total ? sum / total : 1;
  }

  get targetSatisfaction() {
    return clamp(this.coverage * 100 - this.dirtyRatio * DIRTY_PENALTY - (this.unpaid ? UNPAID_PENALTY : 0), 0, 100);
  }

  /** 満足度を下げている原因 */
  get problems() {
    const out = ROLES.filter((r) => this.staff[r.id] < this.required[r.id]).map((r) => `${r.name}が${this.required[r.id] - this.staff[r.id]}人不足`);
    if (this.dirtyRatio > 0) out.push('掃除が必要な水槽があります');
    if (this.unpaid) out.push('賃金を払えていません');
    return out;
  }

  hire(role) {
    if (role === 'guide' && this.staff.guide >= GUIDE_MAX) return;
    this.staff[role]++;
    this._emit();
  }

  fire(role) {
    if (this.staff[role] <= 0) return;
    this.staff[role]--;
    this._emit();
  }

  /** 毎フレーム呼ぶ。1秒ごとに賃金・満足度・販売を処理する */
  update(dt, getContext, economy) {
    this._acc += dt;
    if (this._acc < 1) return;
    const secs = Math.floor(this._acc);
    this._acc -= secs;
    const ctx = getContext();
    this.required = requiredStaff({ ...ctx, shops: this.shops + this.cafes });
    this.required.cleaner = Math.max(1, this.required.cleaner - this.cleanerRelief);
    this.dirtyRatio = ctx.dirtyRatio;
    this.unpaid = !economy.pay(this.wages * secs);
    this.satisfaction += (this.targetSatisfaction - this.satisfaction) * Math.min(1, SAT_RATE * secs);
    this._sell(secs, economy);
  }

  // ---- お土産店 --------------------------------------------------------------

  restock(id, economy) {
    const p = PRODUCTS.find((x) => x.id === id);
    if (!economy.spend(p.cost * LOT_SIZE)) return false;
    this.stock[id] = (this.stock[id] ?? 0) + LOT_SIZE;
    this._emit();
    return true;
  }

  tierOf(id) {
    return PRICE_TIERS[this.prices[id]] ? this.prices[id] : 'std';
  }

  priceOf(p) {
    return Math.round(p.price * PRICE_TIERS[this.tierOf(p.id)].factor);
  }

  setTier(id, tier) {
    this.prices[id] = tier;
    this._emit();
  }

  _sell(secs, economy) {
    // 店員はお土産店を優先し、余った人がカフェを担当する
    const clerks = Math.min(this.shops, this.staff.shop);
    const baristas = Math.min(this.cafes, this.staff.shop - clerks);
    if (baristas > 0) {
      this._cafeGuests += Math.min(economy.visitors * CAFE_RATE * (this.satisfaction / 100), baristas * SALES_PER_STAFF) * secs;
      const guests = Math.floor(this._cafeGuests);
      this._cafeGuests -= guests;
      if (guests) {
        this.sales += guests * CAFE_PRICE;
        economy.earn(guests * CAFE_PRICE);
      }
    }
    if (!clerks) return;
    const demand = economy.visitors * BUY_RATE * (this.satisfaction / 100);
    this._buyers += Math.min(demand, clerks * SALES_PER_STAFF) * secs;
    while (this._buyers >= 1) {
      this._buyers -= 1;
      const items = PRODUCTS.filter((p) => (this.stock[p.id] ?? 0) > 0);
      const weightOf = (p) => p.weight * PRICE_TIERS[this.tierOf(p.id)].demand;
      let r = Math.random() * items.reduce((s, p) => s + weightOf(p), 0);
      const item = items.find((p) => (r -= weightOf(p)) < 0) ?? items[0];
      if (!item) return; // 在庫切れ：売り逃し
      this.stock[item.id]--;
      const price = this.priceOf(item);
      this.sales += price;
      economy.earn(price);
    }
  }

  // ---- 保存 ------------------------------------------------------------------

  /** live は常に変化する値（自動保存の変更検知から除外する） */
  toJSON() {
    return {
      staff: { ...this.staff },
      shops: this.shops,
      prices: { ...this.prices },
      live: { satisfaction: Math.round(this.satisfaction * 10) / 10, stock: { ...this.stock }, sales: this.sales },
    };
  }

  fromJSON(data) {
    this.staff = { ...STARTING_STAFF, ...(data?.staff ?? {}) };
    // 以前の計算（上限なし）で雇いすぎた案内係は上限まで減らす（賃金がかさむため）
    this.staff.guide = Math.min(GUIDE_MAX, this.staff.guide);
    this.shops = data?.shops ?? 0;
    this.prices = { ...(data?.prices ?? {}) };
    this.satisfaction = data?.live?.satisfaction ?? 80;
    this.stock = { ...(data?.live?.stock ?? {}) };
    this.sales = data?.live?.sales ?? 0;
    this._emit();
  }

  _emit() {
    this.dispatchEvent(new Event('change'));
  }
}
