import { getCreature } from '../expedition/creatureData.js';
import { mulberry32 } from '../tanks/random.js';
import { EARN } from '../management/walletData.js';
import { CARE, BASE_DEATH, MIN_CARE_INTERVAL, SPAWN_FAIL, SUCCESS_RATIO, stageSeconds, broodOf, hasPair, isDeepSea, morphChance, DEEP_DEVICE_PRICE, stageNames } from './breedData.js';

const H = 3600;
const emptyRecord = () => ({ spawn: 0, hatch: 0, raised: 0, fail: 0, died: 0, albino: 0, morph: 0 });

/**
 * 繁殖：産卵（妊娠）→ふ化（出産）→保育の3段階。段階ごとに期限つきの世話があり、逃すと生き残る数が減る（0なら全部死ぬ）。
 * 保育成功は、ふ化と保育の世話を期限内に8割以上済ませ、生き残りがいるときだけ。
 * state（backyard.state.breed）= { jobs: { 繁殖水槽uid: job }, records: { 種id: 記録 }, deep: [深海繁殖装置に改造した uid] }
 * job = { id, seed, rc, stage, start, end, alive, tasks: [{ at, until, done }], onTime, total, autoUntil }
 * 乱数は job ごとの seed で決まる（読み込み直しても結果が変わらない）。
 */
export class Breeding extends EventTarget {
  constructor({ backyard, expeditions, wallet, toast }) {
    super();
    Object.assign(this, { backyard, expeditions, wallet, toast });
  }

  get state() {
    const s = this.backyard.state;
    s.breed ??= { jobs: {}, records: {}, deep: [] };
    return s.breed;
  }

  get jobs() {
    return this.state.jobs;
  }

  record(id) {
    return { ...emptyRecord(), ...this.state.records[id] };
  }

  _rec(id) {
    return (this.state.records[id] = { ...emptyRecord(), ...this.state.records[id] });
  }

  isDeepTank(uid) {
    return this.state.deep.includes(+uid);
  }

  /** 繁殖水槽を深海繁殖装置に改造する（ダイヤ） */
  upgradeDeep(uid) {
    if (this.isDeepTank(uid) || !this.backyard.breeders.includes(+uid)) return false;
    if (!this.wallet.spend(DEEP_DEVICE_PRICE, 'deepBreeder')) return false;
    this.state.deep.push(+uid);
    this._emit();
    return true;
  }

  /** 始められない理由（始められるなら ''） */
  blocker(uid, id) {
    const c = getCreature(id);
    if (!c) return '生き物が見つかりません';
    if (this.jobs[uid]) return 'この繁殖水槽は使用中です';
    if (!this.backyard.canBreed(c)) return '繁殖技術 Lv2 が必要です';
    if (!hasPair(id, this.expeditions.count(id))) return 'オスとメスがそろっていません';
    if (isDeepSea(id) && !this.isDeepTank(uid)) return '深海繁殖装置が必要です';
    if (this.expeditions.usedSlots + c.slots * broodOf(id) > this.backyard.capacity) return '保持枠が足りません';
    return '';
  }

  /** ペアを入れて産卵（妊娠）の段階を始める。親は在庫から減らない */
  start(uid, id, now = Date.now()) {
    const why = this.blocker(uid, id);
    if (why) {
      this.toast(why, { error: true });
      return false;
    }
    const job = { id, seed: Math.floor(Math.random() * 2 ** 31), rc: 0, stage: 0, alive: broodOf(id), onTime: 0, total: 0, autoUntil: 0 };
    this._enter(job, 0, now);
    this.jobs[uid] = job;
    this._emit();
    return true;
  }

  _rand(job) {
    return mulberry32(job.seed + 7919 * job.rc++)();
  }

  /** 段階に入り、世話の予定を作る */
  _enter(job, stage, now) {
    const c = getCreature(job.id);
    const dur = stageSeconds(stage, c.rarity, this.backyard.level('breeding'));
    Object.assign(job, { stage, start: now, end: now + dur * 1000 });
    const at = (s) => now + s * 1000;
    if (stage === 0) job.tasks = [{ at: at(dur / 2), until: job.end, done: false }];
    else {
      const step = CARE[stage].interval ?? Math.max(MIN_CARE_INTERVAL, dur / 3);
      const n = Math.max(1, Math.floor(dur / step + 1e-6));
      job.tasks = Array.from({ length: n }, (_, i) => ({ at: at(i * step), until: Math.min(job.end, at((i + 1) * step)), done: false }));
    }
  }

  /** 今できる世話（現れていて期限前・未完了） */
  pendingTask(job, now = Date.now()) {
    return job.tasks?.find((t) => !t.done && t.at <= now && now < t.until) ?? null;
  }

  /** 世話の内容（同じ段階でも回ごとに変わる） */
  careText(job) {
    const list = CARE[job.stage].what;
    return list[job.tasks.indexOf(this.pendingTask(job)) % list.length] ?? list[0];
  }

  /** 世話をする */
  care(uid, now = Date.now()) {
    const job = this.jobs[uid];
    const t = job && this.pendingTask(job, now);
    if (!t) return false;
    this._resolve(job, t, true);
    this._emit();
    return true;
  }

  /** 世話の結果を反映する（done：期限内に済ませた） */
  _resolve(job, t, done) {
    t.done = true;
    if (job.stage === 0) {
      job.spawnFail = this._rand(job) < (done ? SPAWN_FAIL.done : SPAWN_FAIL.missed);
      return;
    }
    job.total++;
    if (done) job.onTime++;
    const p = done ? BASE_DEATH : CARE[job.stage].death;
    let dead = 0;
    for (let k = 0; k < job.alive; k++) if (this._rand(job) < p) dead++;
    job.alive -= dead;
    if (!done) job.missed = (job.missed ?? 0) + 1;
  }

  /** 加速：産卵・ふ化の段階を sec 縮める。縮めた間の世話は済んだものとする */
  boost(uid, sec, now = Date.now()) {
    const job = this.jobs[uid];
    if (!job || job.stage >= 2) return;
    job.end = Math.max(now, job.end - sec * 1000);
    for (const t of job.tasks) {
      if (t.done) continue;
      if (t.at >= job.end || t.until > job.end) this._resolve(job, t, true);
    }
    job.tasks = job.tasks.filter((t) => t.at < job.end || t.done);
    this.tick(now);
  }

  /** 保育管理アイテム：sec の間の世話を自動で済ませる */
  autoCare(uid, sec, now = Date.now()) {
    const job = this.jobs[uid];
    if (!job || job.stage !== 2) return false;
    job.autoUntil = Math.max(now, job.autoUntil ?? 0) + sec * 1000;
    this.tick(now);
    return true;
  }

  /** 毎秒：期限の過ぎた世話・保育管理中の世話・段階の終わりを処理する */
  tick(now = Date.now()) {
    let changed = false;
    for (const [uid, job] of Object.entries(this.jobs)) {
      if (!this.backyard.breeders.includes(+uid)) {
        delete this.jobs[uid]; // 繁殖水槽が撤去された
        changed = true;
        continue;
      }
      // 段階をまたいで閉じていた間も、順に進める
      for (let guard = 0; guard < 50; guard++) {
        for (const t of job.tasks) {
          if (t.done) continue;
          if (t.at <= now && t.at <= (job.autoUntil ?? 0)) this._resolve(job, t, true), (changed = true);
          else if (t.until <= now) this._resolve(job, t, false), (changed = true);
        }
        if (job.alive <= 0 || (job.stage === 0 && job.spawnFail && job.end <= now)) {
          this._finish(uid, job);
          changed = true;
          break;
        }
        if (job.end > now) break;
        changed = true;
        if (job.stage === 2) {
          this._finish(uid, job);
          break;
        }
        const rec = this._rec(job.id);
        if (job.stage === 0) rec.spawn++;
        else rec.hatch++;
        this._enter(job, job.stage + 1, job.end);
      }
    }
    if (changed) this._emit();
  }

  /** 終わり：生まれた子を在庫へ。結果を 'finished' で知らせる */
  _finish(uid, job) {
    delete this.jobs[uid];
    const c = getCreature(job.id);
    const rec = this._rec(job.id);
    const names = stageNames(job.id);
    const ratio = job.total ? job.onTime / job.total : 1;
    let result;
    if (job.stage === 0) {
      rec.fail++;
      result = { kind: 'nospawn', text: `${c.name}は${names[0]}しませんでした。ペアの様子と水温を確かめて、もう一度試しましょう。` };
    } else if (job.alive <= 0) {
      rec.died++;
      result = { kind: 'died', text: `${c.name}の${job.stage === 1 ? '卵（子）' : '子ども'}は、すべて死んでしまいました。世話の期限を逃さないようにしましょう。` };
    } else {
      const success = job.stage === 2 && ratio >= SUCCESS_RATIO; // ここへ来るのは保育の終わり（全滅は上）
      const babies = success ? job.alive : Math.max(1, Math.floor(job.alive / 2));
      const morphs = { albino: 0, morph: 0 };
      const p = morphChance(this.backyard.level('breeding'));
      for (let k = 0; k < babies; k++) if (this._rand(job) < p) morphs[this._rand(job) < 0.7 ? 'albino' : 'morph']++;
      this.expeditions.discover(job.id);
      if (babies > 1) this.expeditions.give(job.id, babies - 1);
      for (const k of ['albino', 'morph']) if (morphs[k]) this.expeditions.addVariant(job.id, k, morphs[k]);
      rec.albino += morphs.albino;
      rec.morph += morphs.morph;
      if (success) {
        rec.raised++;
        const gem = EARN.breed[c.rarity] ?? 0;
        if (gem) this.wallet?.grant(gem, `保育成功：${c.name}`);
      } else rec.fail++;
      const extra = [morphs.albino ? `アルビノ${morphs.albino}匹` : '', morphs.morph ? `変色個体${morphs.morph}匹` : ''].filter(Boolean).join('・');
      result = {
        kind: success ? 'raised' : 'partial',
        text: success
          ? `${c.name}の保育に成功！ ${babies}匹が育ちました${extra ? `（${extra}が生まれました！）` : ''}。`
          : `${c.name}の保育は失敗しました。世話の期限内に済ませたのは${Math.round(ratio * 100)}%（成功には${SUCCESS_RATIO * 100}%以上）で、${babies}匹だけ育ちました${extra ? `（${extra}）` : ''}。`,
        babies, morphs,
      };
    }
    this.dispatchEvent(new CustomEvent('finished', { detail: { uid: +uid, id: job.id, ...result } }));
  }

  /** 以前の繁殖（親2匹・時間だけ）を、産卵の段階として引き継ぐ */
  migrate(oldJobs, now = Date.now()) {
    for (const [uid, j] of Object.entries(oldJobs ?? {})) {
      if (!getCreature(j?.id) || this.jobs[uid]) continue;
      const job = { id: j.id, seed: Math.floor(Math.random() * 2 ** 31), rc: 0, stage: 0, alive: broodOf(j.id), onTime: 0, total: 0, autoUntil: 0 };
      this._enter(job, 0, now);
      job.end = Math.max(now, j.until ?? now);
      job.tasks = [{ at: now, until: Math.max(job.end, now + H), done: false }];
      this.jobs[uid] = job;
    }
  }

  _emit() {
    this.dispatchEvent(new Event('change'));
  }
}
