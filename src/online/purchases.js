import { PACKS, PASS, TEAM_UNLOCK } from '../management/walletData.js';
import { BIGWOOD_SET, objKey } from '../decor/decorData.js';
import { INTERIOR_DEFS } from '../tanks/tankData.js';

/**
 * 購入の窓口。有償ダイヤ・館長パス・調査隊の永久解放はサーバー（supabase/wallet.sql）で管理する。
 * - 開発中（vite dev）：端末内に保存する「テスト購入」だけ
 * - 本番：サーバーの値を読むだけ。App内課金（StoreKit）は第7段階で buy() に差し込む
 */
const DEV_KEY = 'aq-dev-wallet';
const DAY = 86400000;

export const purchaseMode = () => (import.meta.env.DEV ? 'dev' : 'store');

function readDev() {
  try {
    return JSON.parse(localStorage.getItem(DEV_KEY)) ?? {};
  } catch {
    return {};
  }
}
function writeDev(v) {
  try {
    localStorage.setItem(DEV_KEY, JSON.stringify(v));
  } catch {
    /* 保存できなくても続ける */
  }
}

export class Purchases {
  constructor({ wallet, items, online, decor }) {
    Object.assign(this, { wallet, items, online, decor });
    wallet.spendPaidRemote = (n, reason) => this._spendPaid(n, reason);
  }

  get mode() {
    return purchaseMode();
  }

  /** サーバー（開発中は端末内）の残高と権利を読み込む */
  async load() {
    if (this.mode === 'dev') return this.wallet.applyServer(readDev());
    const sb = this.online?.sb;
    const uid = this.online?.user?.id;
    if (!sb || !uid) return this.wallet.applyServer({});
    try {
      const [w, e] = await Promise.all([
        sb.from('wallets').select('paid').eq('user_id', uid).maybeSingle(),
        sb.from('entitlements').select('product, count, expires_at').eq('user_id', uid),
      ]);
      const rows = e.data ?? [];
      const pass = rows.find((r) => r.product === PASS.id);
      const teams = rows.find((r) => r.product === TEAM_UNLOCK.id);
      this.wallet.applyServer({ paid: w.data?.paid ?? 0, passUntil: pass?.expires_at ? Date.parse(pass.expires_at) : 0, teams: teams?.count ?? 0 });
    } catch (err) {
      console.warn('財布の読み込みに失敗', err.message); // テーブルが無い環境でも遊べるようにする
    }
  }

  async _spendPaid(n, reason) {
    if (this.mode === 'dev') return writeDev({ ...readDev(), paid: this.wallet.paid });
    const { error } = await this.online.sb.rpc('spend_paid', { p_amount: n, p_reason: reason });
    if (error) throw new Error(error.message);
  }

  /**
   * 卵ガチャの乱数（1回に2つ）。有償ダイヤを使う回はサーバーで抽選の乱数を作り、有償ダイヤもサーバーで減らす（gacha.sql）。
   * { rand, serverPaid } を返す。serverPaid なら wallet.spend は remote: false で呼ぶ
   */
  async gachaRandom(cat, count, paidPart) {
    if (this.mode === 'dev' || paidPart <= 0) {
      const a = new Uint32Array(count * 2);
      crypto.getRandomValues(a);
      return { rand: [...a].map((x) => x / 2 ** 32), serverPaid: false };
    }
    const { data, error } = await this.online.sb.rpc('gacha_draw', { p_machine: cat, p_count: count, p_paid: paidPart });
    if (error) throw new Error(error.message);
    return { rand: data, serverPaid: true };
  }

  /** 商品を買う。開発中はその場で付与する */
  async buy(productId) {
    if (this.mode !== 'dev') throw new Error('App内課金は準備中です');
    const w = this.wallet;
    const pack = PACKS.find((p) => p.id === productId);
    if (pack) w.paid += pack.dia;
    else if (productId === PASS.id) {
      w.passUntil = Math.max(Date.now(), w.passUntil) + PASS.days * DAY;
      w.paid += PASS.dia;
      this.items.add('catchX2', PASS.catchCards);
    } else if (productId === BIGWOOD_SET.id) {
      this.decor?.grant(INTERIOR_DEFS.filter((d) => d.unlock === 'dia').map((d) => objKey(d.id))); // 大型流木を全部解放
    } else if (productId === TEAM_UNLOCK.id) {
      if (w.teams >= TEAM_UNLOCK.max) throw new Error('これ以上解放できません');
      w.teams += 1;
    } else throw new Error('商品が見つかりません');
    writeDev({ paid: w.paid, passUntil: w.passUntil, teams: w.teams });
    w.applyServer({ paid: w.paid, passUntil: w.passUntil, teams: w.teams });
  }
}
