import { getDef } from '../tanks/tankData.js';
import { RATES, PITY, TEN_MIN_RARITY } from '../gacha/gachaData.js';
import { SKINS, SKIN_KINDS, GACHA_OBJECTS, DUP_COINS, BIGWOOD_DIA, skinKey, objKey } from './decorData.js';

/** 内装ガチャに入っている景品 [{ key, rarity, name }] */
export const DECOR_POOL = [
  ...Object.entries(SKINS).flatMap(([kind, list]) => list.filter((s) => !s.free).map((s) => ({ key: skinKey(kind, s.id), rarity: s.rarity, name: `${SKIN_KINDS[kind]}：${s.name}` }))),
  ...GACHA_OBJECTS.map((o) => ({ key: objKey(o.id), rarity: o.rarity, name: getDef(o.id).name })),
];

/**
 * 内装の持ち物：ガチャで出たデザイン・館内オブジェと、ダイヤで解放した大型流木。
 * 解放した物は何個でも使える（置くときは今までどおりコイン）。ガチャで重なったらコインに替える。
 * state = { owned: [key], pity, pulls }
 */
export class Decor extends EventTarget {
  constructor({ economy, wallet }) {
    super();
    Object.assign(this, { economy, wallet });
    this.state = { owned: [], pity: 0, pulls: 0 };
  }

  owns(key) {
    return this.state.owned.includes(key);
  }

  ownsSkin(kind, id) {
    return !!SKINS[kind]?.find((s) => s.id === id)?.free || this.owns(skinKey(kind, id));
  }

  ownedSkins(kind) {
    return SKINS[kind].filter((s) => s.free || this.owns(skinKey(kind, s.id)));
  }

  /** 置ける定義か（解放が要る物は解放済みのときだけ） */
  ownsDef(def) {
    return !def.unlock || this.owns(objKey(def.id));
  }

  /** ダイヤで解放する（大型流木） */
  unlockWithDia(def) {
    if (def.unlock !== 'dia' || this.ownsDef(def)) return false;
    if (!this.wallet.spend(def.diaPrice ?? BIGWOOD_DIA, `unlock:${def.id}`)) return false;
    this._own(objKey(def.id));
    return true;
  }

  /** 課金などでまとめて解放する */
  grant(keys) {
    for (const k of keys) this._own(k);
  }

  _own(key) {
    if (!this.owns(key)) this.state.owned.push(key);
    this._emit();
  }

  get pityLeft() {
    return PITY - this.state.pity;
  }

  _pick(tiers, u) {
    const total = tiers.reduce((s, r) => s + RATES[r], 0);
    let x = u * total;
    for (const r of tiers) {
      x -= RATES[r];
      if (x < 0) return r;
    }
    return tiers[tiers.length - 1];
  }

  /** count 回引く（rand は 2×count 個）。結果 [{ key, rarity, name, dup, coins }] */
  pull(count, rand) {
    const tiers = [...new Set(DECOR_POOL.map((p) => p.rarity))].sort();
    const top = Math.max(...tiers);
    const out = [];
    for (let i = 0; i < count; i++) {
      const [u1, u2] = [rand[i * 2], rand[i * 2 + 1]];
      this.state.pity++;
      let rarity;
      if (this.state.pity >= PITY) rarity = top;
      else if (count === 10 && i === count - 1 && !out.some((o) => o.rarity >= TEN_MIN_RARITY)) rarity = this._pick(tiers.filter((r) => r >= TEN_MIN_RARITY), u1);
      else rarity = this._pick(tiers, u1);
      if (rarity >= top) this.state.pity = 0;
      const list = DECOR_POOL.filter((p) => p.rarity === rarity);
      const prize = list[Math.min(list.length - 1, Math.floor(u2 * list.length))];
      const dup = this.owns(prize.key);
      const coins = dup ? DUP_COINS[rarity] : 0;
      if (dup) this.economy.earn(coins);
      else this.state.owned.push(prize.key);
      out.push({ ...prize, dup, coins });
    }
    this.state.pulls += count;
    this._emit();
    return out;
  }

  toJSON() {
    return { ...this.state, owned: [...this.state.owned] };
  }

  fromJSON(data) {
    this.state = { owned: [], pity: 0, pulls: 0, ...(data ?? {}) };
    this.state.owned = Array.isArray(this.state.owned) ? [...this.state.owned] : [];
    this._emit();
  }

  _emit() {
    this.dispatchEvent(new Event('change'));
  }
}

/** 出る確率の表 [{ rarity, rate, items: [{ name, rate }] }] */
export function decorOdds() {
  const tiers = [...new Set(DECOR_POOL.map((p) => p.rarity))].sort();
  const total = tiers.reduce((s, r) => s + RATES[r], 0);
  return tiers.map((r) => {
    const list = DECOR_POOL.filter((p) => p.rarity === r);
    const rate = (RATES[r] / total) * 100;
    return { rarity: r, rate, items: list.map((p) => ({ name: p.name, rate: rate / list.length })) };
  });
}
