import { createClient } from '@supabase/supabase-js';
import { SaveConflict } from './autoSave.js';
import { encodeRow, decodeRow } from './saveCodec.js';

/** データベースに zdata 列がまだ無い（compress.sql 未実行） */
const missingColumn = (err) => !!err && (err.code === '42703' || err.code === 'PGRST204') && /zdata/.test(err.message ?? '');

/**
 * オンライン機能（Supabase）：アカウント・セーブ・フレンド。
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が無いビルドでは enabled = false（オフラインのみ）。
 * 公開キー（anon）は公開前提の値。データの保護はデータベース側の行レベルセキュリティで行う。
 */
const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const JA = [
  [/invalid login credentials/i, 'メールアドレスまたはパスワードが違います'],
  [/email not confirmed/i, 'メールの確認が済んでいません。届いたメールのリンクを開いてください'],
  [/already registered/i, 'このメールアドレスは登録済みです'],
  [/rate limit|too many/i, '操作が多すぎます。しばらく待ってからお試しください'],
  [/password should be|weak/i, 'パスワードは6文字以上にしてください'],
  [/different from the old/i, '現在と違うパスワードを入力してください'],
  [/valid email|invalid format|missing email/i, 'メールアドレスを正しく入力してください'],
  [/failed to fetch|network/i, '通信できませんでした。接続を確認してください'],
];
const ja = (m) => JA.find(([re]) => re.test(m))?.[1] ?? m;
const HOME = () => location.origin + location.pathname;

export class Online {
  constructor() {
    this.enabled = !!(URL_ && KEY);
    this.recovery = location.hash.includes('type=recovery'); // 再設定メールから来た（現在のパスワード不要）
    this.sb = this.enabled ? createClient(URL_, KEY) : null;
    this.user = null;
    this.profile = null;
  }

  _check(res) {
    if (res.error) throw new Error(ja(res.error.message));
    return res.data;
  }

  // ---- アカウント ------------------------------------------------------------

  /** 保存済みのログイン状態を復元 */
  async restore() {
    if (!this.enabled) return null;
    const { data } = await this.sb.auth.getSession();
    this.user = data.session?.user ?? null;
    if (this.user) await this._loadProfile();
    return this.user;
  }

  /** Supabase 側で有効になっている外部ログイン */
  async providers() {
    try {
      const res = await fetch(`${URL_}/auth/v1/settings`, { headers: { apikey: KEY } });
      const { external = {} } = await res.json();
      return ['google', 'apple'].filter((p) => external[p]);
    } catch {
      return [];
    }
  }

  async oauth(provider) {
    this._check(await this.sb.auth.signInWithOAuth({ provider, options: { redirectTo: HOME() } }));
  }

  async resetPassword(email) {
    this._check(await this.sb.auth.resetPasswordForEmail(email, { redirectTo: HOME() }));
  }

  /** メール＋パスワードでログインできるアカウントか */
  get hasPassword() {
    if (this.recovery) return false;
    return !!this.user?.identities?.some((i) => i.provider === 'email') || !!this.user?.app_metadata?.providers?.includes('email');
  }

  async changeEmail(email) {
    this._check(await this.sb.auth.updateUser({ email }, { emailRedirectTo: HOME() }));
  }

  async changePassword(current, password) {
    if (this.hasPassword) {
      // 端末を離れた隙に変更されないよう、現在のパスワードを確認
      const res = await this.sb.auth.signInWithPassword({ email: this.user.email, password: current });
      if (res.error) throw new Error('現在のパスワードが違います');
    }
    const data = this._check(await this.sb.auth.updateUser({ password }));
    this.user = data.user;
    this.recovery = false;
  }

  /** 表示名は登録時にプレイヤーIDになる（あとで変更できる） */
  async signUp(email, password) {
    const data = this._check(await this.sb.auth.signUp({ email, password, options: { emailRedirectTo: HOME() } }));
    this.user = data.session?.user ?? null; // メール確認が有効なら session は null
    if (this.user) await this._loadProfile();
    return !!this.user;
  }

  async signIn(email, password) {
    const data = this._check(await this.sb.auth.signInWithPassword({ email, password }));
    this.user = data.user;
    await this._loadProfile();
  }

  async signOut() {
    await this.sb.auth.signOut({ scope: 'local' }); // この端末だけログアウト
    this.user = this.profile = null;
  }

  /** アカウントとサーバー上の全データを削除し、この端末のログイン情報も消す */
  async deleteAccount() {
    const { error } = await this.sb.rpc('delete_my_account');
    if (error) {
      const missing = error.code === 'PGRST202' || /could not find the function/i.test(error.message);
      throw new Error(missing ? 'アカウント削除は現在ご利用いただけません' : ja(error.message));
    }
    this.user = this.profile = null; // 以後の自動保存を止める
    try {
      await this.sb.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.warn(err.message);
    }
    Object.keys(localStorage).filter((k) => k.startsWith('sb-')).forEach((k) => localStorage.removeItem(k));
  }

  async _loadProfile() {
    this.profile = this._check(await this.sb.from('profiles').select('*').eq('id', this.user.id).single());
    // 管理者か（supabase/admin_config.sql。未設定なら管理者なし）
    const admin = await this.sb.rpc('is_admin');
    this.isAdmin = !admin.error && admin.data === true;
  }

  async rename(name) {
    this._check(await this.sb.from('profiles').update({ name }).eq('id', this.user.id));
    this.profile.name = name;
  }

  // ---- ランキング（supabase/ranking.sql） ---------------------------------------

  /** 総合レベルを送る。ランキング用の SQL がまだ無いときは送らずに済ませる */
  async submitScore(score, species) {
    if (!this.user || this.noRanking) return;
    const { error } = await this.sb.rpc('submit_score', { p_score: score, p_species: species });
    if (error && (error.code === 'PGRST202' || /could not find the function/i.test(error.message))) this.noRanking = true;
    else if (error) throw new Error(ja(error.message));
  }

  /** 上位100人と自分の順位 */
  async ranking() {
    const [top, mine] = await Promise.all([this.sb.rpc('top_ranking', { p_limit: 100 }), this.sb.rpc('my_rank')]);
    if (top.error && (top.error.code === 'PGRST202' || /could not find the function/i.test(top.error.message))) throw new Error('ランキングは準備中です');
    return { rows: this._check(top), rank: mine.error ? null : mine.data };
  }

  // ---- セーブ ----------------------------------------------------------------

  /** 前回の読込・保存以降に別の端末が更新していたら SaveConflict。force なら上書き */
  async save(data, force = false) {
    // 圧縮の列（zdata）がまだ無いデータベースでは、圧縮せずに保存する
    const body = this.noZ ? { data } : encodeRow(data);
    const row = { user_id: this.user.id, ...body, updated_at: new Date().toISOString() };
    const table = this.sb.from('saves');
    let res;
    if (force) res = await table.upsert(row).select('updated_at');
    else if (this.rev) res = await table.update(row).eq('user_id', this.user.id).eq('updated_at', this.rev).select('updated_at');
    else res = await table.insert(row).select('updated_at');
    if (!this.noZ && missingColumn(res.error)) {
      this.noZ = true;
      return this.save(data, force);
    }
    if (res.error?.code === '23505') throw new SaveConflict('別の端末で更新されています');
    const rows = this._check(res);
    if (!rows.length) throw new SaveConflict('別の端末で更新されています');
    this.rev = rows[0].updated_at;
  }

  /** 自分（id 省略）またはフレンドのセーブ。無ければ null */
  async load(id = this.user.id) {
    let res = await this.sb.from('saves').select(this.noZ ? 'data, updated_at' : 'data, zdata, updated_at').eq('user_id', id).limit(1);
    if (!this.noZ && missingColumn(res.error)) {
      this.noZ = true;
      return this.load(id);
    }
    const rows = this._check(res);
    if (id === this.user.id) this.rev = rows[0]?.updated_at ?? null;
    return decodeRow(rows[0]);
  }

  // ---- フレンド --------------------------------------------------------------

  /** { friends, incoming, outgoing }：各要素は { id, name, friend_code } */
  async friends() {
    const me = this.user.id;
    const rows = this._check(await this.sb.from('friendships').select('requester, addressee, status'));
    const ids = [...new Set(rows.flatMap((r) => [r.requester, r.addressee]).filter((x) => x !== me))];
    const profs = ids.length ? this._check(await this.sb.from('profiles').select('id, name, friend_code').in('id', ids)) : [];
    const byId = new Map(profs.map((p) => [p.id, p]));
    const out = { friends: [], incoming: [], outgoing: [] };
    for (const r of rows) {
      const other = byId.get(r.requester === me ? r.addressee : r.requester);
      if (!other) continue;
      if (r.status === 'accepted') out.friends.push(other);
      else (r.addressee === me ? out.incoming : out.outgoing).push(other);
    }
    return out;
  }

  /** フレンドコードで申請（相手から申請が来ていればそのまま承認） */
  async request(code) {
    const c = code.trim().toUpperCase();
    const rows = this._check(await this.sb.from('profiles').select('id, name').eq('friend_code', c).limit(1));
    const target = rows[0];
    if (!target) throw new Error('そのフレンドコードは見つかりません');
    if (target.id === this.user.id) throw new Error('自分のコードです');
    const back = this._check(
      await this.sb.from('friendships').select('status').eq('requester', target.id).eq('addressee', this.user.id).limit(1),
    );
    if (back.length) {
      await this.accept(target.id);
      return `${target.name} さんとフレンドになりました`;
    }
    const res = await this.sb.from('friendships').insert({ requester: this.user.id, addressee: target.id });
    if (res.error?.code === '23505') throw new Error('すでに申請済みです');
    this._check(res);
    return `${target.name} さんに申請しました`;
  }

  async accept(id) {
    this._check(await this.sb.from('friendships').update({ status: 'accepted' }).eq('requester', id).eq('addressee', this.user.id));
  }

  /** 申請の取り消し・拒否・フレンド解除 */
  async remove(id) {
    const me = this.user.id;
    this._check(await this.sb.from('friendships').delete().or(`and(requester.eq.${me},addressee.eq.${id}),and(requester.eq.${id},addressee.eq.${me})`));
  }
}
