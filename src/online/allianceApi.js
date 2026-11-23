/** 同盟・立地のサーバー通信（supabase/alliance.sql の表と関数を使う） */
const NOT_READY = /alliance|joint|lat|schema cache|does not exist/i;

export class AllianceApi {
  constructor(online) {
    this.online = online;
    this.state = null; // { alliance, members, runs, contribs }
    this.ready = true;
  }

  get sb() {
    return this.online.sb;
  }

  _check(res) {
    if (res.error) {
      if (NOT_READY.test(res.error.message) && /exist|schema cache/i.test(res.error.message)) {
        this.ready = false;
        throw new Error('同盟機能のデータベース設定がまだ完了していません');
      }
      throw new Error(res.error.message);
    }
    return res.data;
  }

  /** 自分の同盟の情報を読み直す。未加入なら state = null */
  async refresh() {
    if (!this.online.user) throw new Error('同盟機能にはログインが必要です');
    const me = this.online.user.id;
    const rows = this._check(await this.sb.from('alliance_members').select('alliance_id, joined_at').eq('user_id', me).limit(1));
    if (!rows.length) return (this.state = null);
    const id = rows[0].alliance_id;
    // 合同調査：資金集め中・調査中のすべてと、最近30日に完了したもの（同じ調査は同時に99回まで）
    const now = new Date().toISOString();
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [a, mem, active, done] = await Promise.all([
      this.sb.from('alliances').select('*').eq('id', id).single(),
      this.sb.from('alliance_members').select('user_id').eq('alliance_id', id),
      this.sb.from('joint_runs').select('*').eq('alliance_id', id).or(`done_at.is.null,done_at.gt.${now}`).limit(400),
      this.sb.from('joint_runs').select('*').eq('alliance_id', id).lte('done_at', now).gt('done_at', since).order('done_at', { ascending: false }).limit(300),
    ]);
    const memberIds = this._check(mem).map((m) => m.user_id);
    const members = this._check(await this.sb.from('profiles').select('id, name, lat, lon').in('id', memberIds));
    const runList = [...this._check(active), ...this._check(done)];
    // URL が長くなりすぎないよう、100件ずつ問い合わせる
    const contribs = [];
    for (let i = 0; i < runList.length; i += 100) {
      const ids = runList.slice(i, i + 100).map((r) => r.id);
      contribs.push(...this._check(await this.sb.from('joint_contribs').select('run_id, amount, claimed').eq('user_id', me).in('run_id', ids)));
    }
    this.state = { alliance: this._check(a), members, runs: runList, contribs, joinedAt: rows[0].joined_at };
    return this.state;
  }

  /** 加入できる同盟の一覧（人数つき） */
  async list() {
    const rows = this._check(await this.sb.from('alliances').select('id, name, xp').order('xp', { ascending: false }).limit(30));
    const mem = this._check(await this.sb.from('alliance_members').select('alliance_id').in('alliance_id', rows.map((r) => r.id)));
    return rows.map((r) => ({ ...r, count: mem.filter((m) => m.alliance_id === r.id).length }));
  }

  async create(name) {
    this._check(await this.sb.rpc('create_alliance', { p_name: name }));
    return this.refresh();
  }

  async join(id) {
    this._check(await this.sb.rpc('join_alliance', { p_id: id }));
    return this.refresh();
  }

  async leave() {
    this._check(await this.sb.rpc('leave_alliance'));
    this.state = null;
  }

  /** 実際に受け付けられた金額を返す */
  async fund(project, amount) {
    const taken = this._check(await this.sb.rpc('fund_joint', { p_project: project, p_amount: amount }));
    await this.refresh();
    return taken;
  }

  /** 完了した調査の成果を受け取れるか：完了時点で同盟にいて、まだ受け取っていない（出資の有無は問わない） */
  canClaim(run, now = new Date()) {
    const st = this.state;
    if (!st || !run.done_at || new Date(run.done_at) > now) return false;
    if (st.joinedAt && new Date(st.joinedAt) > new Date(run.done_at)) return false;
    return !st.contribs.some((c) => c.run_id === run.id && c.claimed);
  }

  /** refresh: false なら読み直さない（まとめて受け取るときは最後に1回だけ読み直す） */
  async claim(runId, { refresh = true } = {}) {
    const ok = this._check(await this.sb.rpc('claim_joint', { p_run: runId }));
    if (refresh) await this.refresh();
    return ok;
  }

  /** 自分の立地を公開する（0.1度に丸める） */
  async setLocation({ lat, lon }) {
    const round = (v) => Math.round(v * 10) / 10;
    this._check(await this.sb.from('profiles').update({ lat: round(lat), lon: round(lon) }).eq('id', this.online.user.id));
  }

  /** 指定ユーザーの立地つきプロフィール */
  async places(ids) {
    if (!ids.length) return [];
    return this._check(await this.sb.from('profiles').select('id, name, lat, lon').in('id', ids));
  }
}
