import { mulberry32 } from '../tanks/random.js';
import { piecesOf, fishToNext, maxFish, legacyXpToFish } from './growth.js';
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
    this.xp = {}; // 成長：魚種ごとに成長に使った匹数（累計）
    this.getCapacity = () => Infinity;
    this.released = []; // 満杯で放流した生き物（直前の受け取り分）
    this.variants = {}; // アルビノ・変色個体の数 { 種id: { albino, morph } }（在庫の数の内数）
    this.lastVariants = null; // 直前の take で一緒に減ったアルビノ・変色個体
    this.getBonusTeams = () => 0; // 課金の調査隊（永久解放・館長パス）。main.js が wallet につなぐ
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
    const fresh = this.seenCount(id) === 0;
    this.seen[id] = this.seenCount(id) + 1;
    this.give(id);
    if (fresh) this._newSpecies([id]);
  }

  /** 初めて図鑑に載った魚種を知らせる（新種発見の報酬。lifeSystems が受け取る） */
  _newSpecies(ids) {
    if (ids.length) this.dispatchEvent(new CustomEvent('discovered', { detail: ids }));
  }

  count(id) {
    return this.creatures[id] ?? 0;
  }

  /** 同時に出せる調査隊の数（レベルと同数＋追加した隊＋課金の隊） */
  teamLimit(stageLevel) {
    return stageLevel + this.extraTeams + this.getBonusTeams();
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

  /** 帰還した隊の成果（受け取る前に見せる。seed で決まっているので受け取りと同じ結果） */
  preview(index) {
    const trip = this.trips[index];
    return trip ? rollCatch(trip) : [];
  }

  /** 加速：帰還までの時間を sec 縮める（成果の季節は出発時の予定のまま） */
  boost(index, sec) {
    const trip = this.trips[index];
    if (!trip) return;
    trip.rollAt ??= trip.doneAt;
    trip.doneAt -= sec * 1000;
    this._emit();
  }

  /** 帰還した隊の成果を受け取り、捕まえた生物の id 一覧を返す。mult：採取倍のアイテム（成果の数を2倍・4倍） */
  claim(index, now = Date.now(), mult = 1) {
    const trip = this.trips[index];
    if (!trip || !this.isDone(trip, now)) return [];
    const caught = rollCatch(trip).flatMap((id) => Array(Math.max(1, mult | 0)).fill(id));
    this.trips.splice(index, 1);
    this.released = [];
    const kept = [];
    const fresh = [];
    for (const id of caught) {
      const isNew = this.seenCount(id) === 0;
      if (isNew) fresh.push(id);
      this.seen[id] = this.seenCount(id) + 1; // 放流しても図鑑には載る
      // 新種は保持枠が満杯でも1匹目を持ち帰る（図鑑に載ったのに在庫が無い、を防ぐ）
      if (!isNew && this.usedSlots + getCreature(id).slots > this.getCapacity()) {
        this.released.push(id);
        continue;
      }
      this.creatures[id] = this.count(id) + 1;
      kept.push(id);
    }
    this.dispatchEvent(new CustomEvent('claimed', { detail: caught }));
    this._newSpecies(fresh);
    this._emit();
    return kept;
  }

  take(id, n = 1) {
    if (this.count(id) < n) return false;
    this.creatures[id] -= n;
    this.lastVariants = this._clampVariants(id); // ふつうの個体から先に使い、足りない分だけアルビノなどが減る
    this._emit();
    return true;
  }

  // ---- アルビノ・変色個体（在庫の数の内数） ----------------------------------------

  variantsOf(id) {
    return { albino: 0, morph: 0, ...this.variants[id] };
  }

  variantTotal(id) {
    const v = this.variantsOf(id);
    return v.albino + v.morph;
  }

  /** アルビノなどを n 匹ぶん記録する（在庫の数はすでに増えていること） */
  addVariant(id, kind, n = 1) {
    if (!(n > 0) || !['albino', 'morph'].includes(kind)) return;
    const v = this.variantsOf(id);
    v[kind] += n;
    this.variants[id] = v;
    this._clampVariants(id);
    this._emit();
  }

  /** アルビノなどを n 匹取り出す（水槽へ展示するとき） */
  takeVariant(id, kind, n = 1) {
    const v = this.variantsOf(id);
    if (v[kind] < n || this.count(id) < n) return false;
    v[kind] -= n;
    this.variants[id] = v;
    this.creatures[id] -= n;
    this._emit();
    return true;
  }

  /** 在庫の数を超えたアルビノなどを減らす（変色→アルビノの順）。減った数を返す */
  _clampVariants(id) {
    const v = this.variantsOf(id);
    const gone = { albino: 0, morph: 0 };
    let over = v.albino + v.morph - this.count(id);
    for (const k of ['morph', 'albino']) {
      const d = Math.min(Math.max(0, over), v[k]);
      v[k] -= d;
      gone[k] = d;
      over -= d;
    }
    if (v.albino || v.morph) this.variants[id] = v;
    else delete this.variants[id];
    return gone;
  }

  /** 魚種の成長：埋まったピースの数（0〜48） */
  pieces(id) {
    return piecesOf(this.xp[id] ?? 0);
  }

  /**
   * 成長に使える匹数。展示中の魚は使わない。
   * 展示していない魚種は、在庫に最低1匹残す（全部使うと手元からいなくなるため）
   */
  usable(id, shown = 0) {
    // アルビノ・変色個体は成長に使わない
    return Math.max(0, this.count(id) - this.variantTotal(id) - (shown > 0 ? 0 : 1));
  }

  /** 使える在庫で次のピースを埋められるか（図鑑の通知バッジ） */
  canLevelUp(id, shown = 0) {
    const n = this.usable(id, shown);
    return n > 0 && n >= fishToNext(this.xp[id] ?? 0);
  }

  /** 全部のピースを埋め終えたか */
  isMaxed(id) {
    return (this.xp[id] ?? 0) >= maxFish();
  }

  /** 在庫の同じ魚種 n 匹を成長に使う（全部埋まる分まで）。{ from, to, used } を返す（使えなければ null） */
  grow(id, n = 1, shown = 0) {
    const room = maxFish() - (this.xp[id] ?? 0);
    n = Math.min(n, room);
    if (n < 1 || this.usable(id, shown) < n) return null;
    const from = this.pieces(id);
    this.creatures[id] -= n;
    this._clampVariants(id);
    this.xp[id] = (this.xp[id] ?? 0) + n;
    this._emit();
    return { from, to: this.pieces(id), used: n };
  }

  give(id, n = 1) {
    this.creatures[id] = this.count(id) + n;
    this._emit();
  }

  toJSON() {
    return { extraTeams: this.extraTeams, trips: this.trips.map((t) => ({ ...t })), creatures: { ...this.creatures }, seen: { ...this.seen }, xp: { ...this.xp }, xpv: 4, variants: structuredClone(this.variants) };
  }

  fromJSON(data) {
    this.extraTeams = data?.extraTeams ?? 0;
    this.trips = Array.isArray(data?.trips) ? data.trips.filter((t) => getDestination(t.dest)).map((t) => ({ ...t })) : [];
    // 削除した魚種（総称だった種など）は捨てる
    const known = (o) => Object.fromEntries(Object.entries(o ?? {}).filter(([id]) => getCreature(id)));
    this.creatures = known(data?.creatures);
    this.seen = known(data?.seen);
    this.xp = known(data?.xp);
    this.variants = known(data?.variants);
    for (const id of Object.keys(this.variants)) this._clampVariants(id);
    // xpv 4・2 は使った匹数。版なし・xpv 3 は経験値なので、旧版の1匹の経験値で割って匹数に直す
    if (data?.xpv !== 4 && data?.xpv !== 2) for (const id of Object.keys(this.xp)) this.xp[id] = legacyXpToFish(id, this.xp[id]);
    for (const [id, n] of Object.entries(this.creatures)) if (n > 0) this.markSeen(id);
    this._emit();
  }

  _emit() {
    this.dispatchEvent(new Event('change'));
  }
}

/** 2〜4匹をレア度の重みで抽選 */
export function rollCatch(trip) {
  const rand = mulberry32(trip.seed);
  const pool0 = getDestination(trip.dest).pool.filter((id) => getCreature(id));
  // 季節外の生き物は捕れない（全部が季節外なら季節を問わない）
  const fresh = pool0.filter((id) => inSeason(getCreature(id), trip.rollAt ?? trip.doneAt));
  const all = fresh.length ? fresh : pool0;
  const usable = trip.method ? all.filter((id) => SPECIES_METHODS[id]?.includes(trip.method)) : all;
  const pool = (usable.length ? usable : all).map(getCreature);
  const total = pool.reduce((s, c) => s + CATCH_WEIGHT[c.rarity], 0);
  const n = 2 + Math.floor(rand() * 3);
  return Array.from({ length: n }, () => {
    let r = rand() * total;
    for (const c of pool) {
      r -= CATCH_WEIGHT[c.rarity];
      if (r < 0) return c.id;
    }
    return pool[0].id;
  });
}
