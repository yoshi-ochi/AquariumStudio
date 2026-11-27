import { STAGES, STARTING_MONEY, INCOME_PER_VISITOR } from './stageData.js';
import { isWing } from '../building/blueprint.js';

/**
 * 資金・来館者・階層・ステージの経営ロジック。
 * 状態が変わると 'change' イベントを発行する。
 */
export class Economy extends EventTarget {
  constructor() {
    super();
    this.money = STARTING_MONEY;
    this.stageIndex = 0;
    this.floor = 0;
    this.visitors = 0;
    this.incomePerSec = 0;
    this._acc = 0;
  }

  get stage() {
    return STAGES[this.stageIndex];
  }

  get nextStage() {
    return STAGES[this.stageIndex + 1] ?? null;
  }

  canAfford(amount) {
    return this.money >= amount;
  }

  spend(amount) {
    if (!this.canAfford(amount)) return false;
    this.money -= amount;
    this._emit();
    return true;
  }

  earn(amount) {
    this.money += amount;
    this._emit();
  }

  /** 支払う。足りなければ残高を0にして false */
  pay(amount) {
    const ok = this.money >= amount;
    this.money = Math.max(0, this.money - amount);
    this._emit();
    return ok;
  }

  upgradeStage() {
    const next = this.nextStage;
    if (!next) return { ok: false, reason: 'これ以上拡張できません' };
    if (!this.canAfford(next.upgradeCost)) return { ok: false, reason: 'コインが足りません' };
    this.money -= next.upgradeCost;
    this.stageIndex++;
    this._emit();
    return { ok: true };
  }

  /** 昇格の工事が終わった（費用は工事を始めたときに払っている） */
  completeUpgrade() {
    if (!this.nextStage) return false;
    this.stageIndex++;
    this._emit();
    return true;
  }

  setFloor(floor) {
    if ((!isWing(floor) && (floor < 0 || floor >= this.stage.maxFloors)) || floor === this.floor) return false;
    this.floor = floor;
    this._emit();
    return true;
  }

  /** 毎フレーム呼ぶ。1秒ごとに来館者と収入を計算する */
  update(dt, appeal) {
    this._acc += dt;
    if (this._acc < 1) return;
    const secs = Math.floor(this._acc);
    this._acc -= secs;
    this.visitors = Math.round(appeal * this.stage.visitorFactor);
    this.incomePerSec = this.visitors * INCOME_PER_VISITOR;
    this.money += this.incomePerSec * secs;
    this._emit();
  }

  toJSON() {
    return { money: this.money, stageIndex: this.stageIndex, floor: this.floor };
  }

  fromJSON(data) {
    this.money = Number.isFinite(data?.money) ? data.money : STARTING_MONEY;
    this.stageIndex = Math.min(Math.max(0, data?.stageIndex | 0), STAGES.length - 1);
    const f = data?.floor | 0;
    this.floor = isWing(f) ? f : Math.min(Math.max(0, f), this.stage.maxFloors - 1);
    this._acc = 0;
    this._emit();
  }

  _emit() {
    this.dispatchEvent(new Event('change'));
  }
}
