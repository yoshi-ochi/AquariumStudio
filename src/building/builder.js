import { getZone } from './blueprint.js';
import { PEN, sectionCells } from './seaPen.js';
import { zoneSeconds, stageSeconds, PEN_UNLOCK_SECONDS, PEN_CELL_SECONDS, fmtLeft } from '../management/buildTimes.js';
import { pickBoost } from '../ui/boostPicker.js';
import { getParcel, RESERVE_LEVEL, PARCEL_BUILD_SECONDS } from '../reserve/reserveData.js';

/**
 * 建築の注文窓口：コインを払って工事を始め、完了したら解放する。
 * 増築タブ・館内エリア・生け簀・拡張ボタンはここを通す。同時に進められる工事は1件。
 */
export class Builder {
  constructor({ construction, economy, seaPen, items, wallet, toast, getUnlocked, onZone, onStage, onPen, onPenCell, onReserve, onChange }) {
    Object.assign(this, { construction, economy, seaPen, items, wallet, toast, getUnlocked, onChange });
    construction.onComplete = (job) => {
      if (job.kind === 'zone') onZone(job.id);
      else if (job.kind === 'stage') onStage(job.id);
      else if (job.kind === 'pen') onPen();
      else if (job.kind === 'penCell') onPenCell(job.data);
      else if (job.kind === 'reserve') onReserve?.(job.id);
      this.onChange?.();
    };
  }

  job(kind, id) {
    return this.construction.find(kind, id);
  }

  get busy() {
    return this.construction.busy;
  }

  /** 始める。seconds が0ならすぐ完了。払えない・ほかの工事中なら false */
  _order({ kind, id, label, cost, seconds, data }) {
    if (this.job(kind, id)) return false;
    if (seconds > 0 && this.busy) {
      const cur = this.construction.jobs[0];
      this.toast(`「${cur.label}」の工事中です（残り ${fmtLeft(this.construction.left(cur))}）。加速すると早く終わります`, { error: true, duration: 3500 });
      return false;
    }
    if (!this.economy.spend(cost)) {
      this.toast('コインが足りません', { error: true });
      return false;
    }
    this.construction.start({ kind, id, label, seconds, data });
    if (seconds > 0) this.toast(`「${label}」の工事を始めました（${fmtLeft(seconds)}）`, { duration: 3000 });
    this.onChange?.();
    return true;
  }

  orderZone(id) {
    const z = getZone(id);
    if (!z || this.getUnlocked().has(id)) return false;
    return this._order({ kind: 'zone', id, label: z.name, cost: z.cost, seconds: zoneSeconds(z) });
  }

  orderStage() {
    const next = this.economy.nextStage;
    if (!next) return false;
    return this._order({ kind: 'stage', id: next.level, label: `「${next.name}」への昇格`, cost: next.upgradeCost, seconds: stageSeconds(next.level) });
  }

  orderPen() {
    if (!this.seaPen.canUnlock(this.economy.stage.level)) return false;
    return this._order({ kind: 'pen', id: 'pen', label: '屋外生け簀', cost: PEN.unlockCost, seconds: PEN_UNLOCK_SECONDS });
  }

  /** 環境保護区の区画の整備（1日） */
  orderReserve(id) {
    const p = getParcel(id);
    if (!p || this.economy.stage.level < RESERVE_LEVEL) return false;
    return this._order({ kind: 'reserve', id, label: `保護区：${p.name}`, cost: p.cost, seconds: PARCEL_BUILD_SECONDS });
  }

  /** 生け簀の区画（1マス5分） */
  orderPenCell(rect) {
    const id = `${rect.x0}:${rect.z0}:${rect.x1}:${rect.z1}`;
    return this._order({ kind: 'penCell', id, label: '生け簀の区画', cost: this.seaPen.buildCost(rect), seconds: sectionCells(rect) * PEN_CELL_SECONDS, data: { ...rect } });
  }

  /** 加速アイテムを選んで使う */
  async boost(kind, id) {
    const job = this.job(kind, id);
    if (!job) return;
    const sec = await pickBoost({ items: this.items, wallet: this.wallet, toast: this.toast, left: this.construction.left(job), title: `「${job.label}」の加速` });
    if (sec && this.construction.jobs.includes(job)) this.construction.boost(job, sec);
    this.onChange?.();
  }
}

/** 工事中の行（残り時間と加速ボタン）。data-until は gameSheet・各パネルが毎秒書き換える */
export const jobHtml = (job) =>
  `<small class="bd-job">🏗 工事中 ・ 残り <span data-until="${job.until}">${fmtLeft((job.until - Date.now()) / 1000)}</span></small>`;
export const boostButton = (job) => `<button data-act="build-boost" data-id="${job.kind}|${job.id}" class="primary">⚡加速</button>`;
/** 工事の時間の表示（例：「・ 2時間」） */
export const timeNote = (sec) => (sec > 0 ? ` ・ ${fmtLeft(sec)}` : '');
