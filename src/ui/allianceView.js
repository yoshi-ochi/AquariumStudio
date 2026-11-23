import { JOINT_PROJECTS, ALLIANCE_NEXT_XP, allianceLevel, allianceBonus, getCreature } from '../expedition/creatureData.js';
import { mulberry32 } from '../tanks/random.js';
import { countIds } from './catchBlocks.js';
import { artIcon } from './artIcons.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const yen = (n) => `¥${Math.floor(n).toLocaleString('ja-JP')}`;
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

/** 同盟水族館：加入・メンバー訪問・合同調査 */
export class AllianceView {
  constructor({ api, online, economy, expeditions, mailbox, toast, onVisit, onChanged }) {
    Object.assign(this, { api, online, economy, expeditions, mailbox, toast, onVisit, onChanged });
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

  /** 合同調査の成果を受け取る（同盟画面・メールの両方から） */
  async claimRun(pid, runId, { quiet = false, refresh = true } = {}) {
    if (!(await this.api.claim(runId, { refresh }))) return [];
    const project = JOINT_PROJECTS.find((p) => p.id === pid);
    const got = rollReward(project, runId, this.online.user.id);
    got.forEach((c) => this.expeditions.discover(c));
    if (!quiet) this.toast(`発見：${got.map((c) => getCreature(c).name).join('、')}`, { duration: 4000 });
    const mail = this.mailbox?.items.find((m) => m.key === `allyrun:${runId}`);
    if (mail) {
      mail.data.got = countIds(got);
      this.mailbox.finish(mail.id, '成果を受け取りました');
    } else {
      this.mailbox?.add({ key: `allyrun:${runId}`, kind: 'allyrun', title: `合同調査「${project.name}」の成果を受け取りました`, body: '合同調査で見つかった生き物を受け取りました。', data: { project: pid, run: runId, got: countIds(got) } });
    }
    this.onChanged();
    return got;
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
        const before = this._runsOf(pid, api.state?.runs ?? []).running.length;
        const taken = await api.fund(pid, amount);
        if (taken < amount) this.economy.earn(amount - taken); // 99回分が調査中で受け付けられなかった分は返金
        const started = Math.max(0, this._runsOf(pid, api.state?.runs ?? []).running.length - before);
        const extra = started ? `（調査を${started}回開始）` : '';
        const back = taken < amount ? ` ・ ${yen(amount - taken)} は上限のため返金` : '';
        this.toast(`${yen(taken)} を出資しました${extra}${back}`, { duration: back ? 4000 : undefined });
      } catch (err) {
        this.economy.earn(amount);
        throw err;
      }
    } else if (act === 'ally-claim') {
      // その調査の受け取れる回をまとめて受け取る
      const { claimable } = this._runsOf(id, api.state?.runs ?? []);
      const got = [];
      for (const r of claimable) got.push(...(await this.claimRun(id, r.id, { quiet: true, refresh: false })));
      await api.refresh();
      if (got.length) this.toast(`${claimable.length}回分の成果：${Object.entries(countIds(got)).map(([c, n]) => `${getCreature(c).name}×${n}`).join('、')}`, { duration: 5000 });
    }
  }
}
