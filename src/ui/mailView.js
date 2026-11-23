import { getCreature, getDestination } from '../expedition/creatureData.js';
import { isHungry, feedCost, hasLife } from '../expedition/husbandry.js';
import { cleanSpec, isCleaning, needsCleaning, dirtLevel } from '../tanks/tankCleaning.js';
import { tankLabel } from '../tanks/tankLabel.js';
import { icon } from './icons.js';
import { catchBlocks, countIds } from './catchBlocks.js';
import { TAB_OF, gradeOf } from '../game/mailbox.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const yen = (n) => `¥${Math.floor(n).toLocaleString('ja-JP')}`;
const num = (n) => Math.floor(n).toLocaleString('ja-JP');
const when = (t) => {
  const d = new Date(t);
  const sameDay = new Date().toDateString() === d.toDateString();
  const hm = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  return sameDay ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
};
const KIND_ICON = { trip: 'expedition', offline: 'coin', daily: 'mail', clean: 'clean', feed: 'care', ally: 'ally', allyrun: 'ally', discovery: 'coin' };
const TABS = [['system', 'システム'], ['report', '報告'], ['ally', '同盟']];

/**
 * メール画面。タブで分ける：
 *   システム … 1日の報告（評価・まとめ）・留守中の報告・掃除やエサの依頼
 *   報告     … 調査隊の採取結果（プレゼント）。1隊ずつ、またはすべてまとめて受け取る
 *   同盟     … 同盟の活動記録（設立・加入・合同調査の完了と受け取り）
 * scan() を毎秒呼ぶと、帰還した調査隊・汚れた水槽・空腹の水槽をメールで知らせる。
 */
export class MailView {
  constructor({ mailbox, manager, expeditions, economy, ops, cleanView, careView, allianceView, previews, toast }) {
    Object.assign(this, { mailbox, manager, expeditions, economy, ops, cleanView, careView, allianceView, previews, toast });
    this.open = null;
    this.tab = 'system';
    this.last = null; // 報告タブで直前に受け取った結果 { got, released, trips }
    this.lastAlly = null; // 同盟タブで直前にまとめて受け取った結果 { got, runs }
    this.busy = false;
  }

  /** シートを開き直したとき：未読のあるタブを開き、前回の受け取り結果は消す */
  reset() {
    this.last = null;
    this.lastAlly = null;
    this.open = null;
    const unread = TABS.find(([id]) => this.mailbox.items.some((m) => !m.read && TAB_OF(m.kind) === id));
    if (unread) this.tab = unread[0];
  }

  // ---- メールを届ける ------------------------------------------------------------

  scan(now = Date.now()) {
    const mb = this.mailbox;
    for (const trip of this.expeditions.trips) {
      if (!this.expeditions.isDone(trip, now)) continue;
      const d = getDestination(trip.dest);
      mb.add({ key: `trip:${trip.seed}`, kind: 'trip', title: `${d.name}の調査隊が帰還しました`, body: `${d.name}での採取を終えて戻りました。採取した生き物を受け取ってください。`, data: { seed: trip.seed, dest: d.name }, actionable: true });
    }
    const keepersShort = this.ops.staff.keeper < this.ops.required.keeper;
    for (const t of this.manager.tanks) {
      const uid = t.userData.uid;
      const name = tankLabel(this.manager, t);
      if (needsCleaning(t, now)) {
        mb.add({ key: `clean:${uid}:${t.userData.clean?.last ?? 0}`, kind: 'clean', title: `${name} の掃除が必要です`, body: `${name}の水が汚れ、見栄えが落ちて集客が下がっています。職員かダイバーに掃除を指示してください。`, data: { uid }, actionable: true });
      }
      // 飼育員が足りているときは自動でエサをあげるので、足りないときだけ知らせる
      if (keepersShort && hasLife(t) && isHungry(t, now)) {
        mb.add({ key: `feed:${uid}:${t.userData.care?.fed ?? 0}`, kind: 'feed', title: `${name} の生き物がお腹をすかせています`, body: `飼育員が足りないため、${name}のエサやりが止まっています。エサやりを指示するか、スタッフで飼育員を増やしてください。`, data: { uid }, actionable: true });
      }
    }
    // 他の画面で対応済みになったものは閉じる
    for (const m of mb.items) {
      if (!m.actionable || m.done) continue;
      const t = this.manager.objects.get(m.data.uid);
      if (m.kind === 'trip' && !this.expeditions.trips.some((x) => x.seed === m.data.seed)) mb.finish(m.id, '受け取り済みです');
      else if (m.kind === 'clean' && (!t || !needsCleaning(t, now))) mb.finish(m.id, !t ? '水槽がありません' : isCleaning(t) ? '掃除を始めています' : '対応済みです');
      else if (m.kind === 'feed' && (!t || !isHungry(t, now))) mb.finish(m.id, '対応済みです');
    }
  }

  /** 帰還した隊（seed で指定）の成果をまとめて受け取り、対応するメールを閉じる。{ got, released, trips } を返す */
  claimTrips(seeds) {
    const ex = this.expeditions;
    const all = { got: [], released: [], trips: 0 };
    for (const seed of seeds) {
      const i = ex.trips.findIndex((x) => x.seed === seed);
      if (i < 0 || !ex.isDone(ex.trips[i])) continue;
      const got = ex.claim(i);
      const released = [...ex.released];
      all.got.push(...got);
      all.released.push(...released);
      all.trips++;
      const mail = this.mailbox.items.find((m) => m.key === `trip:${seed}`);
      if (mail) {
        mail.data.got = countIds(got);
        mail.data.released = countIds(released);
        this.mailbox.finish(mail.id, got.length || released.length ? '受け取りました' : '持ち帰れる生き物はいませんでした');
      }
    }
    return { got: countIds(all.got), released: countIds(all.released), trips: all.trips };
  }

  get readyTrips() {
    return this.expeditions.trips.filter((t) => this.expeditions.isDone(t));
  }

  // ---- 画面 ----------------------------------------------------------------------

  html() {
    const mb = this.mailbox;
    const unread = (id) => mb.items.filter((m) => !m.read && TAB_OF(m.kind) === id).length;
    const tabs = TABS.map(([id, name]) => {
      const n = unread(id);
      return `<button data-act="mail-tab" data-id="${id}" class="${this.tab === id ? 'active' : ''}">${name}${n ? `<i class="ml-count">${n}</i>` : ''}</button>`;
    }).join('');
    const list = mb.items.filter((m) => TAB_OF(m.kind) === this.tab);
    const tools = list.length ? `<div class="ml-tools"><small>${list.length}件 ・ 未読 ${unread(this.tab)}件</small><button data-act="mail-read-all" ${unread(this.tab) ? '' : 'disabled'}>すべて既読</button><button data-act="mail-clear">既読を整理</button></div>` : '';
    const top = this.tab === 'report' ? this._gift() : this.tab === 'ally' ? this._allyGift() : '';
    const empty = {
      system: '1日の報告（評価・まとめ）や留守中の報告、水槽の掃除・エサやりの依頼が届きます。',
      report: '調査隊が帰還すると、採取結果がここに届きます。',
      ally: '同盟の設立・加入や、合同調査の完了と成果の受け取りが記録されます。',
    }[this.tab];
    const rows = list.map((m) => this._row(m)).join('');
    return `<div class="gs-tabs ml-tabs">${tabs}</div>${top}${tools}${rows || (this.tab === 'report' && this.readyTrips.length ? '' : `<p class="gs-empty">${empty}</p>`)}`;
  }

  /** 報告タブの上部：受け取れる採取結果（プレゼント）と、直前に受け取った結果 */
  _gift() {
    const ready = this.readyTrips;
    const result = this.last ? `<div class="st-sum gf-result"><b>🎁 ${this.last.trips}隊分を受け取りました</b>${catchBlocks(this.previews, this.last.got, this.last.released)}</div>` : '';
    if (!ready.length) return result;
    const names = ready.map((t) => getDestination(t.dest).name).join('・');
    return `${result}<div class="st-sum gf-ready"><b>🎁 受け取れる採取結果 ${ready.length}件</b><small>${esc(names)}</small><button data-act="mail-gift-all" class="primary tv-wide">すべて受け取る</button></div>`;
  }

  /** 受け取り待ちの合同調査のメール */
  get pendingRuns() {
    return this.mailbox.items.filter((m) => m.kind === 'allyrun' && m.actionable && !m.done);
  }

  /** 同盟タブの上部：受け取れる合同調査の成果と、直前にまとめて受け取った結果 */
  _allyGift() {
    const runs = this.pendingRuns;
    const result = this.lastAlly ? `<div class="st-sum gf-result"><b>🎁 合同調査 ${this.lastAlly.runs}件分を受け取りました</b>${catchBlocks(this.previews, this.lastAlly.got)}</div>` : '';
    if (!runs.length) return result;
    const names = [...new Set(runs.map((m) => m.title.replace(/^合同調査「(.+)」.*$/, '$1')))].join('・');
    return `${result}<div class="st-sum gf-ready"><b>🎁 受け取れる合同調査の成果 ${runs.length}件</b><small>${esc(names)}</small><button data-act="mail-ally-all" class="primary tv-wide" ${this.busy ? 'disabled' : ''}>${this.busy ? '受け取り中…' : 'すべて受け取る'}</button></div>`;
  }

  /** 合同調査の成果をまとめて受け取る（サーバーへ1件ずつ確認する） */
  async claimAllRuns(rerender) {
    if (this.busy) return;
    this.busy = true;
    rerender?.();
    const got = [];
    let runs = 0;
    try {
      for (const m of this.pendingRuns) {
        const list = await this.allianceView.claimRun(m.data.project, m.data.run, { quiet: true });
        if (!list.length) {
          this.mailbox.finish(m.id, '受け取り済みです');
          continue;
        }
        got.push(...list);
        runs++;
      }
    } catch (err) {
      this.toast(err.message, { error: true });
    } finally {
      this.busy = false;
    }
    if (runs) this.lastAlly = { got: countIds(got), runs };
    rerender?.();
  }

  _row(m) {
    const open = this.open === m.id;
    const state = m.actionable && !m.done ? '<i class="ml-todo">要対応</i>' : '';
    const snippet = m.result && !open ? m.result : m.body;
    const top = `<button class="ml-head ${m.read ? '' : 'unread'}" data-act="mail-open" data-id="${m.id}"><span class="ml-ico">${icon(KIND_ICON[m.kind] ?? 'mail', 20)}</span><span class="ml-text"><span class="ml-title">${esc(m.title)}</span><span class="ml-snip">${esc(this._summary(m) ?? snippet)}</span></span>${state}<small>${when(m.at)}</small></button>`;
    if (!open) return `<div class="ml-mail">${top}</div>`;
    const result = m.result ? `<p class="ml-result">${esc(m.result)}</p>` : '';
    const actions = m.done ? '' : this._actions(m);
    return `<div class="ml-mail open">${top}<div class="ml-body"><p>${esc(m.body)}</p>${this._detail(m)}${result}<div class="gs-btns">${actions}<button data-act="mail-del" data-id="${m.id}">削除</button></div></div></div>`;
  }

  /** 一覧で本文の代わりに出す1行の要約 */
  _summary(m) {
    const d = m.data;
    if (m.kind === 'daily') return `総合評価 ${gradeOf(d)} ・ 収入 ${yen(d.income)} ・ 来館者 最大${num(d.peak)}人`;
    if (m.kind === 'offline') return `受け取り ${yen(d.net)}（来館者 ${num(d.visitors)}人）${m.done ? ' ・ 受け取り済み' : ''}`;
    if ((m.kind === 'trip' || m.kind === 'allyrun') && d.got) {
      const all = Object.entries(d.got).map(([id, n]) => `${getCreature(id)?.name}×${n}`).join('、');
      return all || '持ち帰れる生き物はいませんでした';
    }
    return null;
  }

  _detail(m) {
    const d = m.data;
    if ((m.kind === 'trip' || m.kind === 'allyrun') && d.got) return catchBlocks(this.previews, d.got, d.released);
    if (m.kind === 'daily') {
      const sat = d.satN ? Math.round(d.satSum / d.satN) : null;
      return `<div class="ml-grade"><b>${gradeOf(d)}</b><small>総合評価</small></div>
        <h5 class="ml-h">評価</h5><dl class="ml-dl"><dt>お客さまの満足度（平均）</dt><dd>${sat == null ? '—' : `${sat}%`}</dd><dt>来館者（最大）</dt><dd>${num(d.peak)}人</dd></dl>
        <h5 class="ml-h">まとめ</h5><dl class="ml-dl"><dt>入館料などの収入</dt><dd>${yen(d.income)}</dd><dt>帰還した調査隊</dt><dd>${d.trips}隊（${d.caught}匹）</dd><dt>掃除した水槽</dt><dd>${d.cleans}基</dd></dl>`;
    }
    if (m.kind === 'offline') {
      return `<dl class="ml-dl"><dt>来館者</dt><dd>${num(d.visitors)}人</dd><dt>入館料</dt><dd>${yen(d.income)}</dd><dt>賃金</dt><dd>−${yen(d.wages)}</dd><dt>受け取り</dt><dd><b>${yen(d.net)}</b></dd></dl>${d.capped ? `<small>計算されるのは最大${d.capped}時間までです。</small>` : ''}`;
    }
    if (m.kind === 'clean') {
      const t = this.manager.objects.get(d.uid);
      return t ? `<dl class="ml-dl"><dt>汚れ</dt><dd>${Math.min(100, Math.round(dirtLevel(t) * 100))}%</dd></dl>` : '';
    }
    if (m.kind === 'feed') {
      return `<dl class="ml-dl"><dt>飼育員</dt><dd>${this.ops.staff.keeper}/${this.ops.required.keeper}人</dd></dl>`;
    }
    return '';
  }

  _actions(m) {
    if (!m.actionable) return ''; // 記録だけのメール
    const btn = (act, text, ok = true, primary = true) => `<button data-act="${act}" data-id="${m.id}" class="${primary ? 'primary' : ''}" ${ok ? '' : 'disabled'}>${text}</button>`;
    if (m.kind === 'trip') return btn('mail-claim', '受け取る');
    if (m.kind === 'offline') return btn('mail-take', `受け取る ${yen(m.data.net)}`);
    if (m.kind === 'allyrun') return btn('mail-ally-claim', '成果を受け取る');
    const t = this.manager.objects.get(m.data.uid);
    if (!t) return '';
    if (m.kind === 'clean') {
      const spec = cleanSpec(t.userData.defId);
      const free = this.ops.staff.cleaner - this.manager.tanks.reduce((s, x) => s + (x.userData.clean?.crew ?? 0), 0);
      return [
        spec.staff ? btn('mail-clean-staff', `職員${spec.staff.crew}人で掃除 ${yen(spec.staff.cost)}`, free >= spec.staff.crew && this.economy.canAfford(spec.staff.cost)) : '',
        spec.diver ? btn('mail-clean-diver', `ダイバーで掃除 ${yen(spec.diver.cost)}`, this.economy.canAfford(spec.diver.cost), !spec.staff) : '',
      ].join('');
    }
    if (m.kind === 'feed') return btn('mail-feed', `エサやり ${yen(feedCost(t))}`, this.economy.canAfford(feedCost(t)));
    return '';
  }

  act(act, id, b, rerender) {
    if (!act.startsWith('mail-')) return false;
    const mb = this.mailbox;
    if (act === 'mail-tab') return (this.tab = id), (this.open = null), true;
    if (act === 'mail-read-all') return mb.items.forEach((m) => TAB_OF(m.kind) === this.tab && mb.read(m.id)), true;
    if (act === 'mail-clear') return mb.clearDone((m) => TAB_OF(m.kind) === this.tab), (this.open = null), true;
    if (act === 'mail-gift-all') return (this.last = this.claimTrips(this.readyTrips.map((t) => t.seed))), true;
    if (act === 'mail-ally-all') return this.claimAllRuns(rerender), true;
    const m = mb.get(+id);
    if (!m) return true;
    if (act === 'mail-open') {
      this.open = this.open === m.id ? null : m.id;
      mb.read(m.id);
    } else if (act === 'mail-del') {
      if (m.actionable && !m.done && !confirm('まだ対応していないメールです。削除しますか？')) return true;
      mb.remove(m.id);
    } else if (act === 'mail-take') {
      this.economy.earn(m.data.net);
      mb.finish(m.id, `${yen(m.data.net)} を受け取りました`);
    } else if (act === 'mail-claim') {
      if (!this.claimTrips([m.data.seed]).trips) mb.finish(m.id, '受け取り済みです');
    } else if (act === 'mail-ally-claim') {
      this.allianceView.claimRun(m.data.project, m.data.run).then(() => rerender?.()).catch((err) => this.toast(err.message, { error: true }));
    } else if (act === 'mail-clean-staff' || act === 'mail-clean-diver') {
      const t = this.manager.objects.get(m.data.uid);
      if (t) this.cleanView.act(act.replace('mail-', ''), String(m.data.uid));
      if (t && isCleaning(t)) mb.finish(m.id, act === 'mail-clean-staff' ? '職員に掃除を指示しました' : 'ダイバーに掃除を依頼しました');
    } else if (act === 'mail-feed') {
      const t = this.manager.objects.get(m.data.uid);
      if (t) this.careView.act('care-feed', String(m.data.uid));
      if (t && !isHungry(t)) mb.finish(m.id, 'エサをあげました');
    }
    return true;
  }
}
