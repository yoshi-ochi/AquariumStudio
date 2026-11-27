import { JOINT_PROJECTS, ALLIANCE_NEXT_XP, allianceLevel, allianceBonus, getCreature } from '../expedition/creatureData.js';
import { mulberry32 } from '../tanks/random.js';
import { countIds } from './catchBlocks.js';
import { artIcon } from './artIcons.js';
import { coin as yen } from './currency.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const FUND_STEPS = [100000, 1000000, 10000000];
const REWARD_COUNT = 2;
/** 同じ合同調査を同時に進められる回数（supabase/joint_carryover.sql と同じ値） */
const MAX_PARALLEL = 99;

/** 合同調査の成果（調査と本人ごとに固定） */
function rollReward(project, runId, userId) {
  let seed = 7;
  for (const ch of runId + userId) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) >>> 0;
  const rand = mulberry32(seed);
  return Array.from({ length: REWARD_COUNT }, () => project.pool[Math.floor(rand() * project.pool.length)]);
}

/** 受け取った成果を1行で（シーラカンス×2、…） */
function gotText(got) {
  const all = Object.entries(countIds(got)).filter(([id]) => getCreature(id)).map(([id, n]) => `${getCreature(id).name}×${n}`).join('、');
  return all ? `成果：${all}` : '受け取れる成果はありませんでした（受け取り済みです）。';
}

/** 同盟水族館：加入・メンバー訪問・合同調査 */
export class AllianceView {
  /** scene は採取の再現を再生する画面（fishingScene.js）。成果を受け取るときに、調査ごとの採取の様子を見せる */
  constructor({ api, online, economy, expeditions, mailbox, toast, onVisit, onChanged, scene }) {
    Object.assign(this, { api, online, economy, expeditions, mailbox, toast, onVisit, onChanged, scene });
    this.list = null;
    this.error = '';
    this.loading = false;
  }

  /** シートを開くときに最新の情報を読む */
  async load(rerender) {
    this.loading = true;
    this.error = '';
    try {
      await this.api.refresh();
      this.list = this.api.state ? null : await this.api.list();
      this.notifyRuns();
    } catch (err) {
      this.error = err.message;
    }
    this.loading = false;
    this.onChanged();
    rerender();
  }

  /** 同盟の活動をメール（同盟タブ）に記録する */
  _log(title, body, extra = {}) {
    this.mailbox?.add({ key: `ally:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`, kind: 'ally', title, body, ...extra });
  }

  /** 同盟の合同調査が完了していたら、メンバー全員に受け取りのメールを届ける */
  notifyRuns() {
    const st = this.api.state;
    if (!st || !this.mailbox) return;
    const now = new Date();
    for (const r of st.runs) {
      if (!this.api.canClaim(r, now)) continue;
      const p = JOINT_PROJECTS.find((x) => x.id === r.project);
      if (!p) continue;
      this.mailbox.add({ key: `allyrun:${r.id}`, kind: 'allyrun', title: `合同調査「${p.name}」が完了しました`, body: `同盟「${st.alliance.name}」の合同調査が完了しました。出資していないメンバーも成果を受け取れます。`, data: { project: p.id, run: r.id }, actionable: true });
    }
  }

  /**
   * 受け取るあいだ、その調査（pids）の採取の様子を再生する。
   * サーバーへの確認と読み直し（work）は再生の裏で進め、終わると成果を画面の最後に表示する。
   */
  _withMotion(pids, work) {
    const done = work();
    const text = done.then((got) => gotText(got.flat().filter(Boolean)), (err) => `受け取れませんでした（${err.message}）`);
    this.scene?.playSurveys(JOINT_PROJECTS.map((p) => p.id).filter((id) => pids.includes(id)), text).catch((err) => console.warn(err.message));
    return done;
  }

  /** 合同調査の成果を受け取る（同盟画面・メールの両方から）。採取の様子を再生する */
  claimRun(pid, runId) {
    return this._withMotion([pid], () => this._claim(pid, runId));
  }

  async _claim(pid, runId, { quiet = false, refresh = true } = {}) {
    if (!(await this.api.claim(runId, { refresh }))) return [];
    const project = JOINT_PROJECTS.find((p) => p.id === pid);
    const got = rollReward(project, runId, this.online.user.id);
    got.forEach((c) => this.expeditions.discover(c));
    const mail = this.mailbox?.items.find((m) => m.key === `allyrun:${runId}`);
    if (mail) {
      mail.data.got = countIds(got);
      this.mailbox.finish(mail.id, '成果を受け取りました');
    } else {
      this.mailbox?.add({ key: `allyrun:${runId}`, kind: 'allyrun', title: `合同調査「${project.name}」の成果を受け取りました`, body: '合同調査で見つかった生き物を受け取りました。', data: { project: pid, run: runId, got: countIds(got) } });
    }
    if (!quiet) this.onChanged();
    return got;
  }

  /** 複数の回をまとめて受け取る。サーバーへは数件ずつ並行で問い合わせ、最後に1回だけ読み直す。
   *  そのあいだ、含まれる調査の採取の様子を順に再生する。
   *  返り値は回ごとの成果（失敗で中断した回は undefined）。失敗はトーストで知らせる */
  claimMany(items, parallel = 8) {
    if (!items.length) return Promise.resolve([]);
    return this._withMotion(items.map((x) => x.project), () => this._claimMany(items, parallel));
  }

  async _claimMany(items, parallel) {
    const out = new Array(items.length);
    let next = 0;
    let error = null;
    const worker = async () => {
      while (next < items.length && !error) {
        const i = next++;
        try {
          out[i] = await this._claim(items[i].project, items[i].run, { quiet: true, refresh: false });
        } catch (err) {
          error = err;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(parallel, items.length) }, worker));
    await this.api.refresh().catch(() => {});
    this.onChanged();
    if (error) this.toast(error.message, { error: true });
    return out;
  }

  html() {
    if (this.error) return `<p class="gs-empty">${esc(this.error)}</p>`;
    if (this.loading && !this.api.state && !this.list) return '<p class="gs-empty">読み込み中…</p>';
    return this.api.state ? this._joined() : this._browse();
  }

  _browse() {
    const rows = (this.list ?? []).map((a) => `<div class="gs-row"><div class="gs-info"><b>${esc(a.name)}</b><small>Lv${allianceLevel(a.xp)} ・ ${a.count}人</small></div><button data-act="ally-join" data-id="${a.id}" class="primary">加入</button></div>`);
    return `<p class="gs-empty">同盟に入ると来館者が増え、仲間の水族館を訪問したり、合同調査に出資できます。</p>
      <div class="al-new"><input id="al-name" maxlength="16" placeholder="新しい同盟の名前" aria-label="新しい同盟の名前"><button data-act="ally-create" class="primary">設立</button></div>
      <h4 class="gs-sub">同盟を探す</h4>${rows.join('') || '<p class="gs-empty">まだ同盟がありません。</p>'}`;
  }

  _joined() {
    const { alliance: a, members, runs, contribs } = this.api.state;
    const level = allianceLevel(a.xp);
    const next = ALLIANCE_NEXT_XP[level];
    const bonus = Math.round((allianceBonus(level) - 1) * 100);
    const me = this.online.user.id;
    const memberRows = members.map((m) => `<div class="gs-row"><div class="gs-info"><b>${esc(m.name)}${m.id === a.owner ? ' ・ 盟主' : ''}</b><small>${m.lat == null ? '立地未設定' : '地図に表示中'}</small></div>${m.id === me ? '' : `<button data-act="ally-visit" data-id="${m.id}" data-name="${esc(m.name)}" class="primary">訪問</button>`}</div>`);
    const projects = JOINT_PROJECTS.map((p) => this._project(p, level, runs, contribs));
    return `<div class="st-sum"><div class="st-head"><b>${esc(a.name)} Lv${level}</b><small>来館者 +${bonus}%</small></div>
        <div class="st-bar"><i style="width:${next ? Math.min(100, (a.xp / next) * 100) : 100}%"></i></div>
        <small>${next ? `次のレベルまで ${(next - a.xp).toLocaleString('ja-JP')} 貢献` : '最大レベル'}</small></div>
      <h4 class="gs-sub">合同調査</h4>${projects.join('')}
      <h4 class="gs-sub">メンバー ${members.length}人</h4>${memberRows.join('')}
      <button data-act="ally-leave" class="al-leave">同盟を脱退</button>`;
  }

  _project(p, level, runs, contribs) {
    if (p.level > level) return `<div class="gs-row locked">${artIcon(p.id)}<div class="gs-info"><b>${p.name}</b><small>同盟Lv${p.level}で解放 ・ 総額 ${yen(p.cost)}</small></div></div>`;
    const { claimable, running, open } = this._runsOf(p.id, runs);
    const funded = open?.funded ?? 0;
    const full = running.length >= MAX_PARALLEL;
    const species = p.pool.map((id) => getCreature(id).name).join('、');
    const buttons = FUND_STEPS.map((n) => `<button data-act="ally-fund" data-repeat="300" data-id="${p.id}:${n}" ${!full && this.economy.canAfford(n) ? '' : 'disabled'}>${n / 10000}万出資</button>`).join('');
    const status = running.length
      ? `<small class="al-runs"><b>調査中 ${running.length}回</b> ・ 次の完了まで <span data-until="${new Date(running[0].done_at).getTime()}"></span></small>`
      : '';
    return `<div class="gs-row wrap">${artIcon(p.id)}<div class="gs-info"><b>${p.name}</b><small>発見：${species}</small>
        ${status}
        <div class="st-bar"><i style="width:${(funded / p.cost) * 100}%"></i></div><small>${yen(funded)} / ${yen(p.cost)} ・ ${p.hours}時間</small>
        ${full ? `<small class="gs-alert">上限（${MAX_PARALLEL}回）まで調査中</small>` : ''}</div>
      <div class="gs-btns">${claimable.length ? `<button data-act="ally-claim" data-id="${p.id}" class="primary">成果を受け取る（${claimable.length}回分）</button>` : ''}${buttons}</div></div>`;
  }

  /** 調査ごとの回：受け取れる回・調査中の回（完了が近い順）・資金集め中の回 */
  _runsOf(pid, runs, now = new Date()) {
    const list = runs.filter((r) => r.project === pid);
    return {
      claimable: list.filter((r) => this.api.canClaim(r, now)),
      running: list.filter((r) => r.done_at && new Date(r.done_at) > now).sort((a, b) => new Date(a.done_at) - new Date(b.done_at)),
      open: list.find((r) => !r.done_at),
    };
  }

  act(act, id, btn, rerender) {
    if (!act.startsWith('ally-')) return false;
    this._run(act, id, btn).catch((err) => this.toast(err.message, { error: true })).finally(() => { this.onChanged(); rerender(); });
    return true;
  }

  async _run(act, id, btn) {
    const api = this.api;
    if (act === 'ally-create') {
      const name = document.getElementById('al-name')?.value.trim();
      if (!name || name.length < 2) throw new Error('同盟の名前は2文字以上にしてください');
      await api.create(name);
      this.toast(`同盟「${name}」を設立しました`);
      this._log(`同盟「${name}」を設立しました`, '盟主として同盟を設立しました。仲間を誘って合同調査に挑みましょう。');
    } else if (act === 'ally-join') {
      await api.join(id);
      this.toast('同盟に加入しました');
      const name = api.state?.alliance?.name ?? this.list?.find((a) => a.id === id)?.name ?? '';
      this._log(`同盟${name ? `「${name}」` : ''}に加入しました`, '同盟の仲間と合同調査に出資したり、仲間の水族館を訪問できます。');
    } else if (act === 'ally-leave') {
      const name = api.state?.alliance?.name ?? '';
      await api.leave();
      this.list = await api.list();
      this.toast('同盟を脱退しました');
      this._log(`同盟${name ? `「${name}」` : ''}を脱退しました`, '同盟から脱退しました。');
    } else if (act === 'ally-visit') {
      await this.onVisit(id, btn.dataset.name);
    } else if (act === 'ally-fund') {
      const [pid, n] = id.split(':');
      const amount = +n;
      if (!this.economy.spend(amount)) return;
      try {
        const taken = await api.fund(pid, amount);
        if (taken < amount) this.economy.earn(amount - taken); // 99回分が調査中で受け付けられなかった分は返金
      } catch (err) {
        this.economy.earn(amount);
        throw err;
      }
    } else if (act === 'ally-claim') {
      // その調査の受け取れる回をまとめて受け取る
      const { claimable } = this._runsOf(id, api.state?.runs ?? []);
      await this.claimMany(claimable.map((r) => ({ project: id, run: r.id })));
    }
  }
}
