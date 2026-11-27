import { EXCHANGE, PASS, TEAM_UNLOCK } from './walletData.js';

const DAY = 86400000;

/**
 * ダイヤの財布。無償ダイヤ（遊んで入手・セーブに保存）と有償ダイヤ（課金・サーバーで管理）を分けて記録する（資金決済法のため）。
 * 使うときは無償から先に減らす。館長パス・調査隊の永久解放などの購入済みの権利もここに置く（サーバー側の値）。
 * 'change' と、無償ダイヤを渡したときの 'granted'（detail: { n, reason }）を発行する。
 */
export class Wallet extends EventTarget {
  constructor({ economy }) {
    super();
    this.economy = economy;
    this.free = 0;
    // サーバー（開発中は端末内）の値。purchases.js が読み込む
    this.paid = 0;
    this.passUntil = 0;
    this.teams = 0;
    /** 有償ダイヤを減らす処理（purchases.js が差し込む）。失敗したら reject */
    this.spendPaidRemote = async () => {};
  }

  get total() {
    return this.free + this.paid;
  }

  canAfford(n) {
    return this.total >= n;
  }

  /** 使う。無償から先に減らし、足りない分を有償から（サーバーへは後で送り、失敗したら戻す） */
  spend(n, reason = '') {
    if (!(n > 0) || !this.canAfford(n)) return false;
    const fromFree = Math.min(this.free, n);
    const fromPaid = n - fromFree;
    this.free -= fromFree;
    if (fromPaid > 0) {
      this.paid -= fromPaid;
      this.spendPaidRemote(fromPaid, reason).catch((err) => {
        this.paid += fromPaid;
        console.warn('有償ダイヤの消費に失敗', err?.message);
        this._emit();
      });
    }
    this._emit();
    return true;
  }

  /** 無償ダイヤを渡す */
  grant(n, reason = '') {
    if (!(n > 0)) return;
    this.free += Math.floor(n);
    this.dispatchEvent(new CustomEvent('granted', { detail: { n: Math.floor(n), reason } }));
    this._emit();
  }

  /** 両替：units × 100ダイヤ → units × 50,000コイン */
  exchange(units = 1) {
    if (!(units >= 1) || !this.spend(EXCHANGE.dia * units, 'exchange')) return false;
    this.economy.earn(EXCHANGE.coin * units);
    return true;
  }

  hasPass(now = Date.now()) {
    return this.passUntil > now;
  }

  /** 調査隊の追加数（永久解放＋パス） */
  extraTeams(now = Date.now()) {
    return Math.min(TEAM_UNLOCK.max, this.teams) + (this.hasPass(now) ? PASS.teams : 0);
  }

  /** パスを30日延ばす（有効中なら期限から足す） */
  extendPass(now = Date.now()) {
    this.passUntil = Math.max(now, this.passUntil) + PASS.days * DAY;
    this._emit();
  }

  /** サーバー（開発中は端末内）の値を反映する */
  applyServer({ paid = 0, passUntil = 0, teams = 0 } = {}) {
    Object.assign(this, { paid: Math.max(0, paid | 0), passUntil: +passUntil || 0, teams: Math.max(0, teams | 0) });
    this._emit();
  }

  toJSON() {
    return { free: this.free };
  }

  fromJSON(data) {
    this.free = Math.max(0, Math.floor(data?.free ?? 0));
    this._emit();
  }

  _emit() {
    this.dispatchEvent(new Event('change'));
  }
}
