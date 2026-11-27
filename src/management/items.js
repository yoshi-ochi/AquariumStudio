import { getItem } from './walletData.js';

/** 持っているアイテム（無期限）。counts = { アイテムid: 個数 } */
export class Items extends EventTarget {
  constructor({ wallet }) {
    super();
    this.wallet = wallet;
    this.counts = {};
  }

  count(id) {
    return this.counts[id] ?? 0;
  }

  add(id, n = 1) {
    if (!getItem(id) || !(n > 0)) return;
    this.counts[id] = this.count(id) + n;
    this._emit();
  }

  /** ダイヤで買う */
  buy(id, n = 1) {
    const item = getItem(id);
    if (!item || !this.wallet.spend(item.price * n, `item:${id}`)) return false;
    this.add(id, n);
    return true;
  }

  /** 1個使う。持っていなければ買って使う（buy=true のとき） */
  use(id, { buy = false } = {}) {
    if (this.count(id) < 1 && !(buy && this.buy(id))) return false;
    this.counts[id] -= 1;
    if (!this.counts[id]) delete this.counts[id];
    this._emit();
    return true;
  }

  toJSON() {
    return { ...this.counts };
  }

  fromJSON(data) {
    this.counts = {};
    for (const [id, n] of Object.entries(data ?? {})) if (getItem(id) && n > 0) this.counts[id] = n | 0;
    this._emit();
  }

  _emit() {
    this.dispatchEvent(new Event('change'));
  }
}
