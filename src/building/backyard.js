import { getCreature } from '../expedition/creatureData.js';
import { Breeding } from '../breeding/breeding.js';
import { ARCHIVE_BONUS, EXPAND_SLOTS, HOLD_BY_LEVEL, HOLD_PER_TANK, POINTS_PER_MIN, researchCost, migrateResearchLevel, BREED_HARD_RARITY } from './backyardData.js';

/** バックヤードの研究室と繁殖水槽。state は保存データの一部（繁殖の中身は breeding/breeding.js） */
export class Backyard {
  constructor({ manager, ops, economy, expeditions, toast, isUnlocked, wallet }) {
    Object.assign(this, { manager, ops, economy, expeditions, toast, isUnlocked, wallet });
    this.state = Backyard.emptyState();
    this.breeding = new Breeding({ backyard: this, expeditions, wallet, toast });
  }

  static emptyState() {
    return { points: 0, levels: {}, breed: { jobs: {}, records: {}, deep: [] }, expansions: 0, rv: 2 };
  }

  get expansions() {
    return this.state.expansions;
  }

  expand() {
    this.state.expansions++;
  }

  /** 魚を保持できる枠の合計 */
  get capacity() {
    const base = HOLD_BY_LEVEL[Math.min(HOLD_BY_LEVEL.length, this.economy.stage.level) - 1];
    return base + this._uids('holdingTank').length * HOLD_PER_TANK + this.state.expansions * EXPAND_SLOTS;
  }

  get points() {
    return this.state.points;
  }

  get jobs() {
    return this.breeding.jobs;
  }

  level(id) {
    return this.state.levels[id] ?? 0;
  }

  _uids(defId) {
    return [...this.manager.objects.values()].filter((o) => o.userData.defId === defId).map((o) => o.userData.uid);
  }

  get labCount() {
    return this._uids('researchLab').length;
  }

  get breeders() {
    return this._uids('breedingTank');
  }

  get researchers() {
    return this.ops.staff.research;
  }

  get ratePerMin() {
    return Math.min(this.labCount, this.researchers) * POINTS_PER_MIN * (this.isUnlocked('archive') ? ARCHIVE_BONUS : 1);
  }

  upgrade(id) {
    const cost = researchCost(this.level(id));
    if (cost == null || this.state.points < cost) return;
    this.state.points -= cost;
    this.state.levels[id] = this.level(id) + 1;
  }

  canBreed(c) {
    return c.rarity < BREED_HARD_RARITY || this.level('breeding') >= 2;
  }

  /** 毎秒の処理 */
  tick(secs = 1) {
    this.state.points += (this.ratePerMin / 60) * secs;
    this.breeding.tick();
  }

  toJSON() {
    return { ...this.state, points: Math.floor(this.state.points) };
  }

  fromJSON(data) {
    const { jobs: oldJobs, ...rest } = data ?? {};
    this.state = { ...Backyard.emptyState(), ...rest };
    this.state.breed = { jobs: {}, records: {}, deep: [], ...this.state.breed };
    // 以前の繁殖（breed より前の jobs）は産卵の段階として引き継ぐ
    if (oldJobs && Object.keys(oldJobs).length) this.breeding.migrate(oldJobs);
    // 研究の版2（最大Lv100）より前のセーブは、効果が同じくらいになるレベルへ直す
    if (data && (data.rv ?? 1) < 2) {
      this.state.levels = Object.fromEntries(Object.entries(this.state.levels ?? {}).map(([id, lv]) => [id, migrateResearchLevel(id, lv)]));
      this.state.rv = 2;
    }
  }
}
