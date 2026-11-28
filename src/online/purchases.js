import { Capacitor } from '@capacitor/core';
import { PACKS, PASS, TEAM_UNLOCK, STORE_IDS } from '../management/walletData.js';
import { BIGWOOD_SET, objKey } from '../decor/decorData.js';
import { INTERIOR_DEFS } from '../tanks/tankData.js';

/**
 * 購入の窓口。有償ダイヤ・館長パス・調査隊の永久解放・大型流木セットはサーバー（supabase/wallet.sql・iap.sql）で管理する。
 * - store：iPhone アプリ（Capacitor）。App内課金は RevenueCat（StoreKit）で買い、付与はサーバー（RevenueCat の Webhook → Edge Function）
 * - dev：開発中（vite dev のブラウザ）。端末内に保存する「テスト購入」だけ
 * - web：公開版のブラウザ（GitHub Pages）。サーバーの値を読むだけで、買うのはアプリ版
 */
const DEV_KEY = 'aq-dev-wallet';
const DAY = 86400000;
const RC_KEY = import.meta.env.VITE_REVENUECAT_IOS_KEY;

export const purchaseMode = () => (Capacitor.isNativePlatform() ? 'store' : import.meta.env.DEV ? 'dev' : 'web');

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** 応答が無いまま止まらないように、決まった時間で失敗にする（どの段階で止まったかを画面に出す） */
const withTimeout = (p, ms, label) =>
  Promise.race([p, sleep(ms).then(() => { throw new Error(`${label}が${ms / 1000}秒たっても応答しません`); })]);
const BIGWOOD_KEYS = () => INTERIOR_DEFS.filter((d) => d.unlock === 'dia').map((d) => objKey(d.id));

export class Purchases {
  constructor({ wallet, items, online, decor }) {
    Object.assign(this, { wallet, items, online, decor });
    wallet.spendPaidRemote = (n, reason) => this._spendPaid(n, reason);
    this.rc = null; // RevenueCat（アプリのときだけ読み込む）
    this.prices = {}; // App Store の表示価格 { 商品ID: '¥480' }
  }

  get mode() {
    return purchaseMode();
  }

  /** 商品の App Store の ID（調査隊は1隊目・2隊目で別の商品） */
  storeId(productId) {
    if (productId === TEAM_UNLOCK.id) return this.wallet.teams >= 1 ? STORE_IDS.team2 : STORE_IDS.team1;
    return STORE_IDS[productId];
  }

  /** 表示する値段（アプリでは App Store の値段、それ以外は円） */
  priceLabel(productId, yen) {
    return this.prices[this.storeId(productId)] ?? `¥${yen.toLocaleString('ja-JP')}`;
  }

  /** RevenueCat を準備する（ログインしたユーザーの ID で。Webhook がこの ID で付与する） */
  async _store() {
    if (this.rc) return this.rc;
    const uid = this.online?.user?.id;
    if (!RC_KEY) throw new Error('App内課金の設定（VITE_REVENUECAT_IOS_KEY）がありません。ビルドの環境変数を確認してください');
    if (!uid) throw new Error('購入するにはログインしてください');
    // 起動時の読み込みと購入ボタンが同時に呼んでも、準備は1回だけ
    this._rcReady ??= (async () => {
      const { Purchases: RC } = await import('@revenuecat/purchases-capacitor');
      await withTimeout(RC.configure({ apiKey: RC_KEY, appUserID: uid }), 15000, 'RevenueCat の準備');
      return RC;
    })().catch((err) => {
      this._rcReady = null; // 次に押したときにやり直す
      throw err;
    });
    const RC = await this._rcReady;
    this.rc = RC;
    this._loadPrices().catch((err) => console.warn('値段の読み込みに失敗', err.message));
    return RC;
  }

  async _loadPrices() {
    const { products } = await this.rc.getProducts({ productIdentifiers: Object.values(STORE_IDS) });
    for (const p of products ?? []) this.prices[p.identifier] = p.priceString;
  }

  /** サーバー（開発中は端末内）の残高と権利を読み込む。パスの採取倍カードと大型流木セットもここで受け取る */
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
      const row = (id) => rows.find((r) => r.product === id);
      const pass = row(PASS.id);
      this.wallet.applyServer({ paid: w.data?.paid ?? 0, passUntil: pass?.expires_at ? Date.parse(pass.expires_at) : 0, teams: row(TEAM_UNLOCK.id)?.count ?? 0 });
      if (row(BIGWOOD_SET.id)?.count > 0) this.decor?.grant(BIGWOOD_KEYS());
      if (row('pass_cards')?.count > 0) {
        // 館長パスの採取倍カード：サーバーで0に戻してから持ち物へ（二重に受け取らない）
        const { data: n, error } = await sb.rpc('claim_pass_cards');
        if (!error && n > 0) this.items.add('catchX2', n);
      }
      if (this.mode === 'store') this._store().catch(() => {}); // 値段の表示のため
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

  /** 商品を買う。買えたら true、やめたら false */
  async buy(productId) {
    if (this.mode === 'dev') return this._devBuy(productId);
    if (this.mode !== 'store') throw new Error('購入はiPhoneアプリ版で行えます');
    if (productId === TEAM_UNLOCK.id && this.wallet.teams >= TEAM_UNLOCK.max) throw new Error('これ以上解放できません');
    const RC = await this._store();
    const id = this.storeId(productId);
    const { products } = await withTimeout(RC.getProducts({ productIdentifiers: [id] }), 20000, 'App Store からの商品の読み込み');
    const product = products?.[0];
    // App Store が商品を返さない：有料アプリ契約が有効でない・商品が「送信準備完了」でない・IDが違う、のどれか
    if (!product) throw new Error(`App Store に商品 ${id} がありません（有料アプリ契約と商品の状態を確認してください）`);
    try {
      await RC.purchaseStoreProduct({ product });
    } catch (err) {
      if (err?.userCancelled || err?.code === '1' || /cancel/i.test(err?.message ?? '')) return false;
      throw err;
    }
    await this._waitGranted();
    return true;
  }

  /** 付与はサーバー（Webhook）なので、届くまで少し待って読み直す */
  async _waitGranted() {
    const before = JSON.stringify([this.wallet.paid, this.wallet.passUntil, this.wallet.teams]);
    for (let i = 0; i < 12; i++) {
      await sleep(1500);
      await this.load();
      if (JSON.stringify([this.wallet.paid, this.wallet.passUntil, this.wallet.teams]) !== before) return;
    }
  }

  /** 購入の復元（非消耗型）。RevenueCat に同期し、サーバーの権利を読み直す */
  async restore() {
    if (this.mode !== 'store') return this.load();
    const RC = await this._store();
    await RC.restorePurchases();
    await this._waitGranted();
  }

  _devBuy(productId) {
    const w = this.wallet;
    const pack = PACKS.find((p) => p.id === productId);
    if (pack) w.paid += pack.dia;
    else if (productId === PASS.id) {
      w.passUntil = Math.max(Date.now(), w.passUntil) + PASS.days * DAY;
      w.paid += PASS.dia;
      this.items.add('catchX2', PASS.catchCards);
    } else if (productId === BIGWOOD_SET.id) {
      this.decor?.grant(BIGWOOD_KEYS()); // 大型流木を全部解放
    } else if (productId === TEAM_UNLOCK.id) {
      if (w.teams >= TEAM_UNLOCK.max) throw new Error('これ以上解放できません');
      w.teams += 1;
    } else throw new Error('商品が見つかりません');
    writeDev({ paid: w.paid, passUntil: w.passUntil, teams: w.teams });
    w.applyServer({ paid: w.paid, passUntil: w.passUntil, teams: w.teams });
    return true;
  }
}
