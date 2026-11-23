import { getCreature } from '../expedition/creatureData.js';
import { ARCHIVE_BONUS, EXPAND_SLOTS, HOLD_BY_LEVEL, HOLD_PER_TANK, POINTS_PER_MIN, breedHours, researchCost, BREED_HARD_RARITY } from './backyardData.js';

/** バックヤードの研究室と繁殖水槽。state は保存データの一部 */
export class Backyard {
  constructor({ manager, ops, economy, expeditions, toast, isUnlocked }) {
    Object.assign(this, { manager, ops, economy, expeditions, toast, isUnlocked });
    this.state = Backyard.emptyState();
  }

  static emptyState() {
    return { points: 0, levels: {}, jobs: {}, expansions: 0 };
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
    return this.state.jobs;
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

  /** 親2匹を確認して繁殖を始める（親は減らない） */
  startBreeding(uid, id) {
    const c = getCreature(id);
    if (this.jobs[uid] || !this.breeders.includes(uid) || !c || !this.canBreed(c) || this.expeditions.count(id) < 2) return false;
    if (this.expeditions.usedSlots + c.slots > this.capacity) {
      this.toast('保持枠がいっぱいです', { error: true });
      return false;
    }
    this.jobs[uid] = { id, until: Date.now() + breedHours(c.rarity, this.level('breeding')) * 3600000 };
    return true;
  }

  /** 毎秒の処理 */
  tick(secs = 1) {
    this.state.points += (this.ratePerMin / 60) * secs;
    const now = Date.now();
    for (const [uid, job] of Object.entries(this.jobs)) {
      if (!this.breeders.includes(+uid)) delete this.jobs[uid]; // 水槽が撤去された
      else if (job.until <= now) {
        delete this.jobs[uid];
        this.expeditions.discover(job.id);
        this.toast(`${getCreature(job.id).name} の赤ちゃんが生まれました`);
      }
    }
  }

  toJSON() {
    return { ...this.state, points: Math.floor(this.state.points) };
  }

  fromJSON(data) {
    this.state = { ...Backyard.emptyState(), ...(data ?? {}) };
  }
}
