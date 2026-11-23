import { mulberry32 } from '../tanks/random.js';
import { levelOf, xpForLevel, xpPerFish, fishToNext, MAX_LEVEL } from './growth.js';
import { getCreature, getDestination, CATCH_WEIGHT, travelPlan, inSeason } from './creatureData.js';
import { SPECIES_METHODS } from './fishingData.js';

/**
 * 採取遠征の進行と、捕まえた生物の在庫。
 * 帰還時刻と成果の乱数 seed は出発時に確定する（再読み込みで成果が変わらない）。
 */
/** 調査隊の追加：1隊目の費用（隊を増やすごとに倍数で上がる）と上限 */
const TEAM_COST = 300000;
const MAX_EXTRA_TEAMS = 6;

export class Expeditions extends EventTarget {
  constructor() {
    super();
    this.trips = [];
    this.extraTeams = 0;
    this.creatures = {};
    this.seen = {}; // 図鑑：これまでに手に入れた数
    this.xp = {}; // 成長：魚種ごとの累計経験値
    this.getCapacity = () => Infinity;
    this.released = []; // 満杯で放流した生き物（直前の受け取り分）
  }

  /** 在庫の生き物が使っている保持枠 */
  get usedSlots() {
    return Object.entries(this.creatures).reduce((s, [id, n]) => s + (getCreature(id)?.slots ?? 0) * n, 0);
  }

  seenCount(id) {
    return this.seen[id] ?? 0;
  }

  /** 図鑑に載せる（捕獲数は増やさない） */
  markSeen(id) {
    this.seen[id] = Math.max(1, this.seenCount(id));
  }

  /** 新しく手に入れた生物を在庫に加える */
  discover(id) {
    this.seen[id] = this.seenCount(id) + 1;
    this.give(id);
  }

  count(id) {
    return this.creatures[id] ?? 0;
  }

  /** 同時に出せる調査隊の数（レベルと同数＋追加した隊） */
  teamLimit(stageLevel) {
    return stageLevel + this.extraTeams;
  }

  /** 次の調査隊を追加する費用。上限なら null */
  get nextTeamCost() {
    return this.extraTeams < MAX_EXTRA_TEAMS ? TEAM_COST * (this.extraTeams + 1) : null;
  }

  addTeam() {
    this.extraTeams++;
    this._emit();
  }

  canDepart(stageLevel) {
    return this.trips.length < this.teamLimit(stageLevel);
  }

  depart(dest, seconds = dest.seconds, method = null, now = Date.now()) {
    this.trips.push({ dest: dest.id, method, doneAt: now + seconds * 1000, seed: Math.floor(Math.random() * 2 ** 31) });
    this._emit();
  }

  /** 立地を移したとき、航海中の隊の残り時間を新しい距離に合わせる（帰還済みの隊はそのまま） */
  rescaleTrips(from, to, now = Date.now()) {
    for (const t of this.trips) {
      if (this.isDone(t, now)) continue;
      const d = getDestination(t.dest);
      const ratio = travelPlan(d, to).seconds / travelPlan(d, from).seconds;
      t.doneAt = now + Math.round((t.doneAt - now) * ratio);
    }
    this._emit();
  }

  isDone(trip, now = Date.now()) {
    return trip.doneAt <= now;
  }

  /** 帰還した隊の成果を受け取り、捕まえた生物の id 一覧を返す */
  claim(index, now = Date.now()) {
    const trip = this.trips[index];
    if (!trip || !this.isDone(trip, now)) return [];
    const caught = rollCatch(trip);
    this.trips.splice(index, 1);
    this.released = [];
    const kept = [];
    for (const id of caught) {
      this.seen[id] = this.seenCount(id) + 1; // 放流しても図鑑には載る
      if (this.usedSlots + getCreature(id).slots > this.getCapacity()) {
        this.released.push(id);
        continue;
      }
      this.creatures[id] = this.count(id) + 1;
      kept.push(id);
    }
    this.dispatchEvent(new CustomEvent('claimed', { detail: caught }));
    this._emit();
    return kept;
  }

  take(id, n = 1) {
    if (this.count(id) < n) return false;
    this.creatures[id] -= n;
    this._emit();
    return true;
  }

  /** 魚種のレベル（1〜999） */
  level(id) {
    return levelOf(this.xp[id] ?? 0, id);
  }

  /**
   * 成長に使える匹数。展示中の魚は使わない。
   * 展示していない魚種は、在庫に最低1匹残す（全部使うと手元からいなくなるため）
   */
  usable(id, shown = 0) {
    return Math.max(0, this.count(id) - (shown > 0 ? 0 : 1));
  }

  /** 使える在庫で次のレベルに上げられるか（図鑑の通知バッジ） */
  canLevelUp(id, shown = 0) {
    const n = this.usable(id, shown);
    return n > 0 && n >= fishToNext(id, this.xp[id] ?? 0);
  }

  /** 在庫の同じ魚種 n 匹を成長に使う。{ from, to, gained } を返す（使えなければ null） */
  grow(id, n = 1, shown = 0) {
    if (n < 1 || this.usable(id, shown) < n || this.level(id) >= MAX_LEVEL) return null;
    const from = this.level(id);
    this.creatures[id] -= n;
    const gained = xpPerFish(id) * n;
    this.xp[id] = Math.min(xpForLevel(MAX_LEVEL, id), (this.xp[id] ?? 0) + gained);
    this._emit();
    return { from, to: this.level(id), gained };
  }

  give(id, n = 1) {
    this.creatures[id] = this.count(id) + n;
    this._emit();
  }

  toJSON() {
    return { extraTeams: this.extraTeams, trips: this.trips.map((t) => ({ ...t })), creatures: { ...this.creatures }, seen: { ...this.seen }, xp: { ...this.xp }, xpv: 3 };
  }

  fromJSON(data) {
    this.extraTeams = data?.extraTeams ?? 0;
    this.trips = Array.isArray(data?.trips) ? data.trips.filter((t) => getDestination(t.dest)).map((t) => ({ ...t })) : [];
    this.creatures = { ...(data?.creatures ?? {}) };
    this.seen = { ...(data?.seen ?? {}) };
    this.xp = { ...(data?.xp ?? {}) };
    // 一時期の形式（使った匹数, xpv 2）は経験値に直す。それ以前（版なし）は経験値のまま
    if (data?.xpv === 2) for (const id of Object.keys(this.xp)) this.xp[id] *= xpPerFish(id);
    for (const [id, n] of Object.entries(this.creatures)) if (n > 0) this.markSeen(id);
    this._emit();
  }

  _emit() {
    this.dispatchEvent(new Event('change'));
  }
}

/** 2〜4匹を星の数の重みで抽選 */
export function rollCatch(trip) {
  const rand = mulberry32(trip.seed);
  const pool0 = getDestination(trip.dest).pool.filter((id) => getCreature(id));
  // 季節外の生き物は捕れない（全部が季節外なら季節を問わない）
  const fresh = pool0.filter((id) => inSeason(getCreature(id), trip.doneAt));
  const all = fresh.length ? fresh : pool0;
  const usable = trip.method ? all.filter((id) => SPECIES_METHODS[id]?.includes(trip.method)) : all;
  const pool = (usable.length ? usable : all).map(getCreature);
  const total = pool.reduce((s, c) => s + CATCH_WEIGHT[c.stars], 0);
  const n = 2 + Math.floor(rand() * 3);
  return Array.from({ length: n }, () => {
    let r = rand() * total;
    for (const c of pool) {
      r -= CATCH_WEIGHT[c.stars];
      if (r < 0) return c.id;
    }
    return pool[0].id;
  });
}
