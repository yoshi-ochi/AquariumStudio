/**
 * 建築の工事。同時に進められるのは1件。
 * job = { kind: 'stage'|'zone'|'pen'|'penCell', id, label, start, until, data? }
 * 完了したら onComplete(job) を呼ぶ（main.js が今までの解放処理をする）。
 */
export const MAX_JOBS = 1;

export class Construction extends EventTarget {
  constructor() {
    super();
    this.jobs = [];
    this.onComplete = () => {};
  }

  get busy() {
    return this.jobs.length >= MAX_JOBS;
  }

  find(kind, id) {
    return this.jobs.find((j) => j.kind === kind && (id === undefined || String(j.id) === String(id))) ?? null;
  }

  /** 工事を始める。seconds が0ならすぐ完了する。始められなければ false */
  start({ kind, id, label, seconds, data }, now = Date.now()) {
    if (this.find(kind, id)) return false;
    if (seconds <= 0) {
      this.onComplete({ kind, id, label, data });
      return true;
    }
    if (this.busy) return false;
    this.jobs.push({ kind, id, label, start: now, until: now + seconds * 1000, ...(data && { data }) });
    this._emit();
    return true;
  }

  left(job, now = Date.now()) {
    return Math.max(0, (job.until - now) / 1000);
  }

  /** 加速：残り時間を sec 縮める */
  boost(job, sec) {
    job.until -= sec * 1000;
    this._emit();
    this.tick();
  }

  /** 毎秒呼ぶ。終わった工事を完了させる */
  tick(now = Date.now()) {
    const done = this.jobs.filter((j) => j.until <= now);
    if (!done.length) return;
    this.jobs = this.jobs.filter((j) => j.until > now);
    for (const j of done) this.onComplete(j);
    this._emit();
  }

  toJSON() {
    return { jobs: this.jobs };
  }

  fromJSON(data) {
    this.jobs = Array.isArray(data?.jobs) ? data.jobs.filter((j) => j && j.kind && Number.isFinite(j.until)) : [];
    this._emit();
  }

  _emit() {
    this.dispatchEvent(new Event('change'));
  }
}
