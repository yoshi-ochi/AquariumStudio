import { getCreature } from '../expedition/creatureData.js';
import { RATES, PITY, TEN_MIN_RARITY, HATCH_SECONDS, poolOf } from './gachaData.js';

/**
 * 卵ガチャの抽選・天井・卵のふ化。
 * state = { seq, pity: { 区分: ★4が出ずに引いた回数 }, pulls: { 区分: 累計回数 }, eggs: [{ seq, id, cat, rarity, until }] }
 * 抽選の乱数は外から渡す（有償ダイヤを使う回はサーバーの乱数。purchases.js）。1回につき2つ使う。
 */
export class Gacha extends EventTarget {
  constructor({ expeditions, getPool = poolOf }) {
    super();
    Object.assign(this, { expeditions, getPool });
    this.state = Gacha.emptyState();
  }

  static emptyState() {
    return { seq: 0, pity: {}, pulls: {}, eggs: [] };
  }

  get eggs() {
    return this.state.eggs;
  }

  pityLeft(cat) {
    return PITY - (this.state.pity[cat] ?? 0);
  }

  /** レア度の段（出る種のあるレア度だけ）と、その確率の重み */
  _tiers(pool, min = 1) {
    return Object.keys(RATES).map(Number).filter((r) => r >= min && pool.some((c) => c.rarity === r));
  }

  _pickRarity(tiers, u) {
    const total = tiers.reduce((s, r) => s + RATES[r], 0);
    let x = u * total;
    for (const r of tiers) {
      x -= RATES[r];
      if (x < 0) return r;
    }
    return tiers[tiers.length - 1];
  }

  /**
   * count 回引く（1 か 10）。rand は 2×count 個の 0〜1 の乱数。卵を加えて結果 [{ id, rarity, seq }] を返す
   */
  pull(cat, count, rand, now = Date.now()) {
    const pool = this.getPool(cat);
    if (!pool.length || rand.length < count * 2) return [];
    const st = this.state;
    const out = [];
    for (let i = 0; i < count; i++) {
      const [u1, u2] = [rand[i * 2], rand[i * 2 + 1]];
      st.pity[cat] = (st.pity[cat] ?? 0) + 1;
      let rarity;
      const top = Math.max(...this._tiers(pool));
      if (st.pity[cat] >= PITY) rarity = top; // 天井
      else if (count === 10 && i === count - 1 && !out.some((o) => o.rarity >= TEN_MIN_RARITY)) rarity = this._pickRarity(this._tiers(pool, Math.min(TEN_MIN_RARITY, top)), u1); // 10連の確定枠
      else rarity = this._pickRarity(this._tiers(pool), u1);
      if (rarity >= top) st.pity[cat] = 0;
      const list = pool.filter((c) => c.rarity === rarity);
      const c = list[Math.min(list.length - 1, Math.floor(u2 * list.length))];
      const egg = { seq: ++st.seq, id: c.id, cat, rarity, until: now + HATCH_SECONDS[rarity] * 1000 };
      st.eggs.push(egg);
      out.push(egg);
    }
    st.pulls[cat] = (st.pulls[cat] ?? 0) + count;
    this._emit();
    return out;
  }

  ready(now = Date.now()) {
    return this.eggs.filter((e) => e.until <= now);
  }

  /** 加速：卵がかえるまでの時間を sec 縮める */
  boost(seq, sec) {
    const e = this.eggs.find((x) => x.seq === +seq);
    if (!e) return;
    e.until -= sec * 1000;
    this._emit();
  }

  /** かえった卵を受け取る（在庫と図鑑へ）。受け取った生き物の id を返す */
  hatch(seq, now = Date.now()) {
    const i = this.eggs.findIndex((x) => x.seq === +seq && x.until <= now);
    if (i < 0) return null;
    const [e] = this.eggs.splice(i, 1);
    if (getCreature(e.id)) this.expeditions.discover(e.id);
    this._emit();
    return e.id;
  }

  toJSON() {
    return { ...this.state, eggs: this.eggs.map((e) => ({ ...e })) };
  }

  fromJSON(data) {
    const s = { ...Gacha.emptyState(), ...(data ?? {}) };
    s.eggs = Array.isArray(s.eggs) ? s.eggs.filter((e) => e && getCreature(e.id) && Number.isFinite(e.until)) : [];
    this.state = s;
    this._emit();
  }

  _emit() {
    this.dispatchEvent(new Event('change'));
  }
}
