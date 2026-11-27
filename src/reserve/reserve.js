import { getCreature } from '../expedition/creatureData.js';
import { PARCELS, getParcel, PARCEL_CAPACITY, ANIMAL_UPKEEP_PER_SLOT, ECO_PER_APPEAL, CONTRIBUTION_PER_PCT, MAX_BONUS, FIRST_PROTECT_DIA, RESERVE_LEVEL } from './reserveData.js';

/**
 * 環境保護区：区画（海域・陸域）を整備し、大型の生き物を保護する。
 * 維持費（区画＋生き物の世話）は毎秒コインから払い、エコツアーの収入で一部を取り戻す。
 * 保護の貢献度に応じて水族館の来館者が増える（払えていない間は増えない）。
 * state = { parcels: { 区画id: { creatures: { 種id: 匹数 } } }, protectedOnce: [種id], unpaid }
 */
export class Reserve extends EventTarget {
  constructor({ economy, wallet }) {
    super();
    Object.assign(this, { economy, wallet });
    this.state = Reserve.emptyState();
    this._acc = 0;
  }

  static emptyState() {
    return { parcels: {}, protectedOnce: [], unpaid: false };
  }

  get available() {
    return this.economy.stage.level >= RESERVE_LEVEL;
  }

  isOpen(id) {
    return !!this.state.parcels[id];
  }

  get openParcels() {
    return PARCELS.filter((p) => this.isOpen(p.id));
  }

  /** 区画の整備が終わった（費用と工事は builder が受け持つ） */
  openParcel(id) {
    if (!getParcel(id) || this.isOpen(id)) return;
    this.state.parcels[id] = { creatures: {} };
    this._emit();
  }

  creaturesOf(id) {
    return this.state.parcels[id]?.creatures ?? {};
  }

  used(id) {
    return Object.entries(this.creaturesOf(id)).reduce((s, [cid, n]) => s + (getCreature(cid)?.slots ?? 0) * n, 0);
  }

  room(id, cid) {
    const c = getCreature(cid);
    return c ? Math.max(0, Math.floor((PARCEL_CAPACITY - this.used(id)) / c.slots)) : 0;
  }

  /** 在庫から保護区へ移した。初めて保護した種はダイヤ */
  add(id, cid, n) {
    const list = this.state.parcels[id]?.creatures;
    if (!list || n <= 0) return;
    list[cid] = (list[cid] ?? 0) + n;
    if (!this.state.protectedOnce.includes(cid)) {
      this.state.protectedOnce.push(cid);
      const c = getCreature(cid);
      const gem = FIRST_PROTECT_DIA[c?.rarity] ?? 0;
      if (gem) this.wallet?.grant(gem, `初めての保護：${c.name}`);
    }
    this._emit();
  }

  take(id, cid, n) {
    const list = this.state.parcels[id]?.creatures;
    const k = Math.min(list?.[cid] ?? 0, n);
    if (k <= 0) return 0;
    list[cid] -= k;
    if (!list[cid]) delete list[cid];
    this._emit();
    return k;
  }

  // ---- お金と効果 -------------------------------------------------------------------

  /** 毎時の維持費・エコツアー収入・貢献度・来館者の倍率 */
  stats() {
    let upkeep = 0;
    let eco = 0;
    let appeal = 0;
    for (const p of this.openParcels) {
      upkeep += p.upkeep;
      for (const [cid, n] of Object.entries(this.creaturesOf(p.id))) {
        const c = getCreature(cid);
        if (!c) continue;
        upkeep += c.slots * n * ANIMAL_UPKEEP_PER_SLOT;
        eco += c.appeal * n * ECO_PER_APPEAL;
        appeal += c.appeal * n;
      }
    }
    const contribution = Math.floor(appeal / 10);
    const bonus = Math.min(MAX_BONUS, contribution / CONTRIBUTION_PER_PCT / 100);
    return { upkeep, eco, net: upkeep - eco, contribution, bonus };
  }

  /** 水族館の来館者に掛ける倍率（維持費を払えていないときは1） */
  get visitorMult() {
    return this.state.unpaid ? 1 : 1 + this.stats().bonus;
  }

  /** 毎秒：差し引きの維持費を払う。足りなければ「未払い」になり、来館者の増加が止まる */
  tick(secs = 1) {
    if (!this.openParcels.length) return;
    this._acc += (this.stats().net / 3600) * secs;
    if (this._acc < 1 && this._acc > -1) return;
    const amount = Math.trunc(this._acc);
    this._acc -= amount;
    let unpaid = false;
    if (amount > 0) unpaid = !this.economy.pay(amount);
    else this.economy.earn(-amount);
    if (unpaid !== this.state.unpaid) {
      this.state.unpaid = unpaid;
      this.dispatchEvent(new CustomEvent('unpaid', { detail: unpaid }));
      this._emit();
    }
  }

  /** ランキング・成長の「展示中」の判定用（水槽と同じ形） */
  get exhibits() {
    return this.openParcels.map((p) => ({ userData: { creatures: this.creaturesOf(p.id) } }));
  }

  toJSON() {
    return structuredClone(this.state);
  }

  fromJSON(data) {
    const st = { ...Reserve.emptyState(), ...(data ?? {}) };
    st.parcels = Object.fromEntries(Object.entries(st.parcels ?? {}).filter(([id]) => getParcel(id)).map(([id, p]) => [id, { creatures: Object.fromEntries(Object.entries(p?.creatures ?? {}).filter(([cid, n]) => n > 0 && getCreature(cid))) }]));
    st.protectedOnce = Array.isArray(st.protectedOnce) ? st.protectedOnce : [];
    this.state = st;
    this._acc = 0;
    this._emit();
  }

  _emit() {
    this.dispatchEvent(new Event('change'));
  }
}
