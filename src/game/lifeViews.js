import { creatureThumb } from '../ui/creatureThumb.js';
import { tankLabel } from '../tanks/tankLabel.js';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
import { CREATURES, DESTINATIONS, JOINT_PROJECTS, RARITY_LIST, RARITY_NAME, getCreature } from '../expedition/creatureData.js';
import { octagrams } from '../ui/octagram.js';
import { NOTES } from '../expedition/creatureNotes.js';
import { WATER, ensureCare, feed, feedCost, hasLife, isHungry, predatorConflict, tankHealth, waterMismatch, nextFeedIn, crowdFactor, zoneOf, FEED_INTERVAL } from '../expedition/husbandry.js';
import { EVENTS } from './gameData.js';
import { monthEnd } from './monthly.js';
import { growPanel, growSpecies, shownCount } from '../ui/growPanel.js';
import { updateQty } from '../ui/creatureGrid.js';

const yen = (n) => `¥${Math.floor(n).toLocaleString('ja-JP')}`;
const span = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}時間${Math.floor((s % 3600) / 60)}分` : `${Math.max(1, Math.ceil(s / 60))}分`);

/** 飼育：幸福度・エサ・水温 */
export class CareView {
  constructor({ manager, economy, toast, onFed }) {
    Object.assign(this, { manager, economy, toast, onFed });
  }

  html() {
    const now = Date.now();
    const rows = this.manager.tanks.filter(hasLife).map((t) => {
      const care = ensureCare(t, now);
      const hp = Math.round(tankHealth(t, now) * 100);
      const cost = feedCost(t);
      const notes = [];
      if (isHungry(t, now)) notes.push('お腹をすかせています');
      if (waterMismatch(t) > 0) notes.push('水温が合わない生物がいます');
      if (predatorConflict(t)) notes.push('捕食者と小さな生物が同居しています');
    if (crowdFactor(t) < 1) notes.push('過密でストレスを感じています');
      const names = Object.keys(t.userData.creatures).map((id) => `${getCreature(id)?.name}（${WATER[zoneOf(id)].label.slice(0, 2)}）`).join('、');
      const seg = Object.entries(WATER).map(([k, w]) => `<button data-act="care-water" data-id="${t.userData.uid}:${k}" class="${care.water === k ? 'active' : ''}">${w.label}</button>`).join('');
      const next = nextFeedIn(t, now);
      return `<div class="gs-row wrap"><div class="gs-info"><b>${esc(tankLabel(this.manager, t))} ・ 幸福度 ${hp}%</b><small>${names}</small>
        ${notes.length ? `<em class="gs-alert">${notes.join('、')}</em>` : `<small>次のエサまで ${span(next)}</small>`}</div>
        <div class="gs-btns"><div class="sp-seg">${seg}</div><button data-act="care-feed" data-id="${t.userData.uid}" class="primary" ${this.economy.canAfford(cost) ? '' : 'disabled'}>エサ ${yen(cost)}</button></div></div>`;
    });
    return `<p class="gs-empty">飼育員が足りていれば、エサやりは自動で行われます。繁殖はバックヤードの繁殖水槽で行います。</p>${rows.join('') || '<p class="gs-empty">生き物を展示している水槽がありません。</p>'}`;
  }

  act(act, id) {
    if (act === 'care-water') {
      const [uid, water] = id.split(':');
      const t = this.manager.objects.get(+uid);
      if (t) ensureCare(t).water = water;
      return true;
    }
    if (act !== 'care-feed') return false;
    const t = this.manager.objects.get(+id);
    if (t && this.economy.spend(feedCost(t))) {
      feed(t);
      this.onFed();
      this.toast('エサをあげました');
    }
    return true;
  }
}

/**
 * 生き物図鑑。発見した魚種の成長（8角星形のピース）を表示し、タップした魚種のすぐ下に説明と育成カードを出す。
 * 育成（成長）はここで行う（在庫の同じ魚種を使う）。並べ方は 地域別 / レア度別 / 育成（ピースの多い順）。
 */
export class ZukanView {
  constructor({ expeditions, manager, previews, economy, state, toast }) {
    Object.assign(this, { expeditions, manager, previews, economy, state, toast });
    this.pick = null;
    this.mode = 'area';
    this.qty = 1;
  }

  /** レア度ごとのまとまり（金→緑）。報酬はなし */
  get starGroups() {
    return [...RARITY_LIST].reverse().map((n) => ({
      id: `rarity${n}`, name: `レア度 ${RARITY_NAME[n]}`, ids: CREATURES.filter((c) => c.rarity === n && (!c.retired || this.expeditions.seenCount(c.id) > 0)).map((c) => c.id),
    })).filter((g) => g.ids.length);
  }

  get groups() {
    const joint = [...new Set(JOINT_PROJECTS.flatMap((p) => p.pool))];
    return [...DESTINATIONS.map((d) => ({ id: d.id, name: d.name, ids: d.pool, reward: d.cost * 5 })), { id: 'joint', name: '合同調査', ids: joint, reward: 3000000 }];
  }

  /** 育成：在庫があるか展示している魚種を、ピースの多い順に */
  get growGroups() {
    const ex = this.expeditions;
    const ids = CREATURES.filter((c) => ex.count(c.id) > 0 || shownCount(this.manager, c.id) > 0)
      .sort((a, b) => ex.pieces(b.id) - ex.pieces(a.id) || b.rarity - a.rarity).map((c) => c.id);
    return [{ id: 'grow', name: '育てられる魚種（ピースの多い順）', ids }];
  }

  _pop(id, col) {
    const c = getCreature(id);
    const detail = `<div class="zk-note"><small>全長 ${Math.round(c.len * 100)}cm ・ 捕獲 ${this.expeditions.seenCount(id)}匹 ・ ${WATER[zoneOf(id)].label}</small><small>${NOTES[id] ?? ''}</small></div>`;
    return `<div class="cg-pop" style="--tip:${((col + 0.5) / 4) * 100}%">${growPanel({ expeditions: this.expeditions, manager: this.manager, id, qty: this.qty, note: detail })}</div>`;
  }

  html() {
    const ex = this.expeditions;
    const seen = (id) => ex.seenCount(id) > 0;
    const total = CREATURES.filter((c) => seen(c.id) && !c.retired).length;
    if (this.pick && !seen(this.pick)) this.pick = null;
    const mode = this.mode;
    const tab = (id, label) => `<button data-act="zk-mode" data-id="${id}" class="${mode === id ? 'active' : ''}">${label}</button>`;
    const tabs = `<div class="sp-seg zk-mode">${tab('area', '地域別')}${tab('star', 'レア度別')}${tab('grow', '育成')}</div>`;
    const list = mode === 'star' ? this.starGroups : mode === 'grow' ? this.growGroups : this.groups;
    let opened = false; // 同じ魚種が複数の地域にあっても、カードは最初の1か所だけ
    const sections = list.map((g) => {
      const got = g.ids.filter(seen).length;
      const done = mode === 'area' && got === g.ids.length;
      const claimed = this.state.zukan.includes(g.id);
      const at = opened ? -1 : g.ids.indexOf(this.pick);
      if (at >= 0) opened = true;
      const rowEnd = at >= 0 ? Math.min(g.ids.length - 1, Math.floor(at / 4) * 4 + 3) : -1;
      const cells = g.ids.map((id, i) => {
        const cell = seen(id)
          ? `<button class="zk-cell ${this.pick === id ? 'sel' : ''}" data-act="zk-pick" data-id="${id}">${creatureThumb(this.previews, id)}<i class="zk-lv">${octagrams(ex.pieces(id), { mini: true })}</i>${ex.canLevelUp(id, shownCount(this.manager, id)) ? '<i class="zk-up" aria-label="成長できます"></i>' : ''}<small>${getCreature(id).name}</small></button>`
          : '<div class="zk-cell unknown"><span>？</span><small>未発見</small></div>';
        return i === rowEnd ? cell + this._pop(this.pick, at % 4) : cell;
      }).join('');
      const reward = done && !claimed ? `<button data-act="zk-claim" data-id="${g.id}" class="primary">達成報酬 ${yen(g.reward)}</button>` : '';
      const count = mode === 'grow' ? `${g.ids.length}種` : `${got}/${g.ids.length}`;
      return `<h4 class="gs-sub">${g.name} ${count}${mode === 'area' && claimed ? ' ・ 達成' : ''}</h4><div class="zk-grid">${cells || '<p class="gs-empty">在庫か展示中の生き物がいません。</p>'}</div>${reward}`;
    });
    const hint = '<p class="gs-empty">魚種をタップすると、在庫の同じ魚種を使って育てられます。育つほど体が大きくなり、集客とランキングの点数が上がります。</p>';
    return `<p class="gs-empty">発見 ${total}/${CREATURES.filter((c) => !c.retired).length}種</p>${tabs}${mode === 'grow' ? hint : ''}${sections.join('')}`;
  }

  /** 数のスライダー（再描画しない） */
  input(el) {
    if (el.dataset.field === 'cg-qty') this.qty = updateQty(el);
  }

  act(act, id) {
    if (act === 'zk-pick') {
      this.pick = this.pick === id ? null : id;
      this.qty = 1;
    } else if (act === 'zk-mode') this.mode = ['star', 'grow'].includes(id) ? id : 'area';
    else if (act === 'cg-qty') this.qty = +id;
    else if (act === 'zk-grow') {
      if (growSpecies(this, id)) this.qty = 1;
    } else if (act === 'zk-claim') {
      const g = this.groups.find((x) => x.id === id);
      if (!this.state.zukan.includes(id)) {
        this.state.zukan.push(id);
        this.economy.earn(g.reward);
        this.toast(`${g.name} の図鑑を達成！ ${yen(g.reward)} を獲得`);
      }
    } else return false;
    return true;
  }

  /** ほかの画面（水槽など）から、その魚種の育成カードを開く */
  focus(id) {
    this.mode = 'grow';
    this.pick = id;
    this.qty = 1;
  }
}

/** イベント開催 */
export class EventView {
  constructor({ economy, state, monthly, previews, getStats, toast, onStart }) {
    Object.assign(this, { economy, state, monthly, previews, getStats, toast, onStart });
    this.ranking = null; // RankingView（main で設定）
    this.tab = 'event';
  }

  /** 報酬は水族館の規模に合わせて増やす（Lv1 で1倍） */
  get scale() {
    return this.economy.stage.visitorFactor / 4;
  }

  /** 今月の特集：特集の生き物・ミッション・記念バッジ */
  _monthlyHtml() {
    const mo = this.monthly;
    mo.ensure();
    const t = mo.theme;
    const shown = new Set(mo.shownFeatured());
    const sec = (monthEnd() - Date.now()) / 1000;
    const left = sec >= 86400 ? `${Math.floor(sec / 86400)}日${Math.floor((sec % 86400) / 3600)}時間` : span(sec);
    const cells = t.featured.map((id) => `<div class="mo-cell ${shown.has(id) ? 'on' : ''}">${creatureThumb(this.previews, id)}<small>${getCreature(id).name}</small>${shown.has(id) ? '<i>展示中</i>' : ''}</div>`).join('');
    const rows = mo.missions().map(({ mission: m, have, need, done, claimed }) => {
      const btn = claimed
        ? '<button disabled>受け取り済み</button>'
        : `<button data-act="mo-claim" data-id="${m.id}" class="primary" ${done ? '' : 'disabled'}>${yen(m.reward * this.scale)}${m.badge ? '＋記念バッジ' : ''}</button>`;
      return `<div class="gs-row"><div class="gs-info"><b>${m.text}</b><div class="mo-bar"><span style="width:${(have / need) * 100}%"></span></div><small>${have} / ${need}</small></div>${btn}</div>`;
    });
    const badges = this.state.badges?.length ? `<p class="mo-badges">記念バッジ：${this.state.badges.map((b) => `<span>🏅 ${esc(b)}</span>`).join('')}</p>` : '';
    return `<div class="mo-card"><small>今月の特集 ・ 残り ${left}</small><b>${t.name}</b><small>${t.text}</small>
      <small class="mo-bonus">特集の生き物 ${shown.size}/${t.featured.length}種を展示中 ・ 来館者 +${Math.round((mo.bonus - 1) * 100)}%</small></div>
      <div class="mo-grid">${cells}</div>${rows.join('')}${badges}<h4 class="gs-sub">館内イベント</h4>`;
  }

  html() {
    const now = Date.now();
    const active = this.state.event?.until > now ? this.state.event : null;
    const stats = this.getStats();
    const head = active
      ? `<div class="st-sum"><b>開催中：${EVENTS.find((e) => e.id === active.id).name}</b><small>残り <span data-until="${active.until}"></span></small></div>`
      : '<p class="gs-empty">開催中は来館者が増えます。同時に開けるのは1つです。</p>';
    const rows = EVENTS.map((e) => {
      const cool = (this.state.cooldown[e.id] ?? 0) - now;
      const lack = e.need(stats);
      const ok = !active && cool <= 0 && !lack && this.economy.canAfford(e.cost);
      const note = lack || (cool > 0 ? `次の開催まで ${span(cool / 1000)}` : `${e.minutes}分間 ・ 来館者 ${e.mult}倍`);
      return `<div class="gs-row"><div class="gs-info"><b>${e.name}</b><small>${e.text}</small><small>${note}</small></div><button data-act="event-start" data-id="${e.id}" class="primary" ${ok ? '' : 'disabled'}>${yen(e.cost)}</button></div>`;
    });
    const tabs = this.ranking ? `<div class="sp-seg zk-mode"><button data-act="ev-tab" data-id="event" class="${this.tab === 'rank' ? '' : 'active'}">特集・イベント</button><button data-act="ev-tab" data-id="rank" class="${this.tab === 'rank' ? 'active' : ''}">ランキング</button></div>` : '';
    if (this.ranking && this.tab === 'rank') return tabs + this.ranking.html();
    return tabs + this._monthlyHtml() + head + rows.join('');
  }

  act(act, id) {
    if (act === 'ev-tab') {
      this.tab = id === 'rank' ? 'rank' : 'event';
      if (this.tab === 'rank') this.ranking?.load();
      return true;
    }
    if (this.ranking?.act(act, id)) return true;
    if (act === 'mo-claim') {
      const got = this.monthly.claim(id, this.scale);
      if (got) {
        this.economy.earn(got.money);
        this.toast(got.badge ? `ミッション達成！ ${yen(got.money)} と記念バッジ「${got.badge}」を獲得` : `ミッション達成！ ${yen(got.money)} を獲得`);
      }
      return true;
    }
    if (act !== 'event-start') return false;
    const e = EVENTS.find((x) => x.id === id);
    const now = Date.now();
    if (this.state.event?.until > now || e.need(this.getStats()) || !this.economy.spend(e.cost)) return true;
    this.state.event = { id, until: now + e.minutes * 60000 };
    this.state.cooldown[id] = now + (e.minutes + 30) * 60000;
    this.onStart();
    this.toast(`${e.name} を開催しました`);
    return true;
  }
}
