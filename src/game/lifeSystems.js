import { INCOME_PER_VISITOR } from '../management/stageData.js';
import { CREATURES, DISCOVERY_REWARD, RARITY_NAME, getCreature } from '../expedition/creatureData.js';
import { feed, feedCost, isHungry, hasLife, setCareFacilities } from '../expedition/husbandry.js';
import { Backyard } from '../building/backyard.js';
import { researchBonus } from '../building/backyardData.js';
import { setCleanIntervalBoost } from '../tanks/tankCleaning.js';
import { BackyardView } from '../building/buildingViews.js';
import { Crowd } from '../visitors/crowd.js';
import { CareView, EventView, ZukanView } from './lifeViews.js';
import { EVENTS, GOALS, CHAPTERS, OFFLINE_MAX_HOURS, OFFLINE_RATE } from './gameData.js';
import { goalStats } from './goalStats.js';
import { Mailbox } from './mailbox.js';
import { Monthly } from './monthly.js';

const yen = (n) => `¥${Math.floor(n).toLocaleString('ja-JP')}`;
const emptyState = () => ({ goals: [], flags: {}, zukan: [], event: null, cooldown: {}, monthly: null, badges: [] });

/** 目標・オフライン収入・来館者・飼育・図鑑・イベントをまとめて管理する */
export class LifeSystems {
  constructor({ sceneMgr, room, manager, economy, ops, inventory, expeditions, previews, toast, getHome, goalEl, reportEl, isUnlocked }) {
    Object.assign(this, { manager, economy, ops, inventory, expeditions, toast, getHome, goalEl, reportEl, isUnlocked });
    this.state = emptyState();
    this.mail = new Mailbox();
    this.crowd = new Crowd({ scene: sceneMgr.scene, room, manager });
    this.monthly = new Monthly({ state: this.state, manager, expeditions });
    this.backyard = new Backyard({ manager, ops, economy, expeditions, toast, isUnlocked });
    expeditions.getCapacity = () => this.backyard.capacity;
    expeditions.addEventListener('discovered', (e) => this._rewardDiscovery(e.detail));
    this.panels = {
      backyard: { title: 'バックヤード', live: true, view: new BackyardView({ backyard: this.backyard, expeditions, economy, previews, toast }) },
      care: { title: '飼育', live: true, view: new CareView({ manager, economy, toast, onFed: () => (this.state.flags.fed = true) }) },
      zukan: { title: '生き物図鑑', view: new ZukanView({ expeditions, manager, previews, economy, state: this.state, toast }) },
      event: { title: 'イベント', live: true, view: new EventView({ economy, state: this.state, monthly: this.monthly, previews, getStats: () => this.stats(), toast, onStart: () => { this.state.flags.event = true; this.state.flags.events = (this.state.flags.events ?? 0) + 1; this.monthly.countEvent(); } }) },
    };
    // 報酬のボタンで受け取る。カードのほかの所をタップすると、進め方の案内（main.js の onGoalTap）
    goalEl.addEventListener('click', (e) => {
      if (e.target.closest('button')) return this._claimGoal();
      const g = this._goal;
      if (g && !g.done(this.stats())) this.onGoalTap?.(g);
    });
    reportEl.addEventListener('click', (e) => e.target.closest('button') && (reportEl.hidden = true));
  }

  /**
   * 以前の不具合の救済（1回だけ）：保持枠が満杯で放流され、新種発見のメールが届いたのに1匹も持っていない魚種へ1匹渡す。
   * 展示中・成長に使った魚種は対象外。shown: 展示中の魚種 id の Set
   */
  repairDiscoveries(shown) {
    if (this.state.flags.discoveryFix) return 0;
    this.state.flags.discoveryFix = true;
    const ex = this.expeditions;
    let n = 0;
    for (const key of this.mail.keys) {
      const id = String(key).startsWith('discovery:') ? key.slice(10) : null;
      if (!id || !getCreature(id) || ex.count(id) > 0 || shown.has(id) || (ex.xp[id] ?? 0) > 0) continue;
      ex.give(id);
      n++;
    }
    return n;
  }

  /** 新種を初めて発見したら、レア度に応じた報酬を渡す */
  _rewardDiscovery(ids) {
    for (const id of new Set(ids)) {
      const c = getCreature(id);
      const yen = DISCOVERY_REWARD[c?.rarity] ?? 0;
      if (!c || !yen) continue;
      this.economy.earn(yen);
      this.mail.add({ key: `discovery:${id}`, kind: 'discovery', title: `新種発見：${c.name}`, body: `図鑑に${c.name}（レア度 ${RARITY_NAME[c.rarity]}）が載りました。発見の報酬 ¥${yen.toLocaleString('ja-JP')} を受け取りました。`, data: { id, yen } });
    }
  }

  stats() {
    const tanks = this.manager.tanks;
    const count = (id) => [...this.manager.objects.values()].filter((o) => o.userData.defId === id).length;
    return {
      tanks: tanks.length,
      creatures: tanks.reduce((s, t) => s + Object.values(t.userData.creatures ?? {}).reduce((a, n) => a + n, 0), 0),
      species: CREATURES.filter((c) => this.expeditions.seenCount(c.id) > 0).length,
      guides: this.ops.staff.guide,
      shops: this.isUnlocked('store') ? 1 : 0,
      cafes: this.isUnlocked('diner') ? 1 : 0,
      hasHome: !!this.getHome(),
      trips: this.expeditions.trips.length,
      flags: this.state.flags,
      stage: this.economy.stageIndex + 1,
      events: this.state.flags.events ?? 0,
      ...goalStats(this.manager, this.expeditions),
    };
  }

  /** イベント開催中の来館者倍率 */
  get visitorMult() {
    const e = this.state.event;
    const event = e && e.until > Date.now() ? EVENTS.find((x) => x.id === e.id).mult : 1;
    return event * (1 + researchBonus(this.backyard.level('display'))) * this.monthly.bonus;
  }

  // ---- 毎秒の処理 ------------------------------------------------------------

  tick() {
    const s = this.stats();
    const count = (id) => [...this.manager.objects.values()].filter((o) => o.userData.defId === id).length;
    this.ops.shops = s.shops;
    this.ops.cafes = s.cafes;
    this.ops.wageMult = 1 - researchBonus(this.backyard.level('welfare'));
    this.ops.cleanerRelief = count('cleanCenter');
    setCleanIntervalBoost(1 + Math.min(4, count('waterPlant')) * 0.25);
    setCareFacilities({ freezer: count('freezer'), liveFeed: count('liveFeed'), foodPrep: count('foodPrep') });
    this.backyard.tick();
    this._month();
    this._husbandry();
    this._renderGoal(s);
  }

  /** 飼育員が足りていれば自動でエサやり */
  _husbandry() {
    const staffed = this.ops.staff.keeper >= this.ops.required.keeper;
    for (const t of this.manager.tanks.filter(hasLife)) {
      if (staffed && isHungry(t) && this.economy.spend(feedCost(t))) feed(t);
    }
  }

  /** 月が変わったら特集イベントを始め、メールで知らせる */
  _month() {
    if (!this.monthly.ensure()) return;
    const t = this.monthly.theme;
    this.mail.add({ key: `monthly:${this.state.monthly.key}`, kind: 'monthly', title: `今月の特集「${t.name}」が始まりました`, body: `${t.text}。特集の生き物を展示すると来館者が増えます。イベントタブでミッションに挑戦しましょう。` });
  }

  get _goal() {
    return GOALS.find((g) => !this.state.goals.includes(g.id));
  }

  _renderGoal(s) {
    const g = this._goal;
    const prog = g?.progress?.(s);
    const key = g ? `${g.id}:${g.done(s)}:${prog ?? ''}` : 'none';
    this.goalEl.hidden = !g;
    if (key === this._goalKey) return;
    this._goalKey = key;
    if (!g) return;
    const ready = g.done(s);
    const inCh = GOALS.filter((x) => x.chapter === g.chapter);
    const head = `第${g.chapter}章 ${CHAPTERS[g.chapter - 1]} ${inCh.indexOf(g) + 1}/${inCh.length}`;
    const bar = prog && !ready ? `<small class="goal-prog">${prog[0]} / ${prog[1]}</small>` : '';
    this.goalEl.innerHTML = `<small>${head}</small><b>${g.text}</b>${bar}${ready ? `<button class="primary">報酬 ${yen(g.reward)}</button>` : `<small>報酬 ${yen(g.reward)} ・ <span class="goal-how">👆 タップで進め方</span></small>`}`;
  }

  _claimGoal() {
    const g = this._goal;
    if (!g || !g.done(this.stats())) return;
    this.state.goals.push(g.id);
    this.economy.earn(g.reward);
    const next = this._goal;
    const chapterDone = !next || next.chapter !== g.chapter;
    this.toast(chapterDone ? `第${g.chapter}章「${CHAPTERS[g.chapter - 1]}」クリア！ ${yen(g.reward)} を獲得${next ? ` ・ 次は第${next.chapter}章「${CHAPTERS[next.chapter - 1]}」` : ''}` : `目標達成！ ${yen(g.reward)} を獲得`, { duration: chapterDone ? 4000 : 2400 });
    this._goalKey = null;
  }

  // ---- 閉じていた間の収入 ------------------------------------------------------

  /** 前回の保存からの経過時間ぶんの収入を計算し、受け取りのメールを届ける */
  settleOffline(savedAt, visitorMult) {
    const away = (Date.now() - Date.parse(savedAt)) / 1000;
    if (!(away >= 300)) return;
    const secs = Math.min(away, OFFLINE_MAX_HOURS * 3600);
    const visitors = Math.round(this.manager.totalAppeal() * this.economy.stage.visitorFactor * visitorMult);
    const income = visitors * INCOME_PER_VISITOR * secs * OFFLINE_RATE;
    const wages = this.ops.wages * secs * OFFLINE_RATE;
    const net = Math.max(0, Math.floor(income - wages));
    const h = Math.floor(away / 3600);
    const m = Math.floor((away % 3600) / 60);
    this.mail.add({
      key: `offline:${savedAt}`, kind: 'offline', title: '留守中の報告', actionable: net > 0,
      body: `${h ? `${h}時間` : ''}${m}分の営業結果です。${net > 0 ? '収入を受け取ってください。' : ''}`,
      data: { visitors, income: Math.floor(income), wages: Math.floor(wages), net, capped: away > OFFLINE_MAX_HOURS * 3600 ? OFFLINE_MAX_HOURS : 0 },
    });
  }

  // ---- 保存 ------------------------------------------------------------------

  toJSON() {
    return { ...this.state, backyard: this.backyard.toJSON(), mail: this.mail.toJSON() };
  }

  /** 読み込み。旧データの「開店済み店舗」は設置待ちの在庫に変換する */
  fromJSON(data, { own, oldShops = 0 } = {}) {
    const { backyard, mail, ...rest } = data ?? {};
    Object.assign(this.state, emptyState(), rest);
    this.backyard.fromJSON(backyard);
    this.mail.fromJSON(own ? mail : null); // 訪問先のメールは読まない
    this._goalKey = null;
    if (!own) return;
    for (const t of this.manager.tanks) for (const id of Object.keys(t.userData.creatures ?? {})) this.expeditions.markSeen(id);
    this.ops.shops = this.stats().shops;
  }
}
