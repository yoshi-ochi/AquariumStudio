import { EARN, DAILY_TASKS } from '../management/walletData.js';

/** 日付の区切りは mailbox の1日の報告と同じ（端末の日付） */
const today = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const FIELD_TASK = { feeds: 'feed', cleans: 'clean', trips: 'trip' };
const emptyDay = (date) => ({ date, login: false, tasks: [], cleanDia: 0 });

/**
 * 毎日のダイヤ：ログインボーナス・毎日の依頼（エサやり・清掃・遠征）・清掃完了（1日25回まで）・1日の評価。
 * state = { date, login, tasks: [達成した依頼id], cleanDia: その日に清掃でもらった回数, evalDate: 評価のダイヤを渡した最後の日 }
 */
export class Daily extends EventTarget {
  constructor({ wallet, mail, toast }) {
    super();
    Object.assign(this, { wallet, mail, toast });
    this.state = { ...emptyDay(today()), evalDate: '' };
    this.isActive = () => false; // 自分の水族館を遊んでいる間だけ true（main.js が差し込む。訪問中は渡さない）
    mail.addEventListener('counted', (e) => this._counted(e.detail.field));
    mail.addEventListener('dayclosed', (e) => this._evaluated(e.detail));
  }

  /** 毎秒：日付が変わったら切り替え、ログインボーナスを渡す */
  tick(now = Date.now()) {
    if (!this.isActive()) return;
    this._roll(now);
    if (!this.state.login) {
      this.state.login = true;
      this.wallet.grant(EARN.login, 'ログインボーナス');
      this._emit();
    }
  }

  get tasks() {
    return DAILY_TASKS.map((t) => ({ ...t, done: this.state.tasks.includes(t.id), dia: EARN.dailyTask }));
  }

  get cleanLeft() {
    return Math.max(0, EARN.cleanPerDay - this.state.cleanDia);
  }

  _roll(now = Date.now()) {
    const d = today(now);
    if (this.state.date !== d) this.state = { ...emptyDay(d), evalDate: this.state.evalDate };
  }

  _counted(field) {
    if (!this.isActive()) return;
    this._roll();
    const task = FIELD_TASK[field];
    if (task && !this.state.tasks.includes(task)) {
      this.state.tasks.push(task);
      const t = DAILY_TASKS.find((x) => x.id === task);
      this.wallet.grant(EARN.dailyTask, `毎日の依頼「${t.text}」`);
    }
    if (field === 'cleans' && this.cleanLeft > 0) {
      this.state.cleanDia++;
      this.wallet.grant(EARN.clean, `清掃完了（今日 ${this.state.cleanDia}/${EARN.cleanPerDay}回）`);
    }
    this._emit();
  }

  _evaluated({ date, dia }) {
    if (!this.isActive() || !dia || date <= (this.state.evalDate ?? '')) return;
    this.state.evalDate = date;
    this.wallet.grant(dia, '1日の評価');
    this._emit();
  }

  /** 読込の直後：閉じている間に届いた1日の報告のダイヤを渡す（評価のダイヤを持つメールだけ） */
  catchUp() {
    const days = this.mail.items.filter((m) => m.kind === 'daily' && m.data?.dia > 0 && m.data.date > (this.state.evalDate ?? '')).sort((a, b) => (a.data.date < b.data.date ? -1 : 1));
    for (const m of days) this._evaluated({ date: m.data.date, dia: m.data.dia });
  }

  toJSON() {
    return { ...this.state, tasks: [...this.state.tasks] };
  }

  fromJSON(data) {
    const date = typeof data?.date === 'string' ? data.date : today();
    this.state = { ...emptyDay(date), ...(data ?? {}), tasks: Array.isArray(data?.tasks) ? [...data.tasks] : [], evalDate: data?.evalDate ?? '' };
    this._roll();
    this._emit();
  }

  _emit() {
    this.dispatchEvent(new Event('change'));
  }
}
