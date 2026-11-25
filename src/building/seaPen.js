import { getCreature } from '../expedition/creatureData.js';
import { appealOf, speciesPieces } from '../expedition/growth.js';

/**
 * 屋外の生け簀（100m × 100m）。水族館レベル5で解放し、5m 格子で自由に区画を切って生き物を展示する。
 * 区画はそれぞれ1つの展示（水槽と同じく生き物を入れる）。将来ザトウクジラなどの大型種も入れられる広さ。
 * state = { unlocked, seq, sections: [{ id, x0, z0, x1, z1, creatures: { id: 匹数 } }] }（x/z はマス番号、両端を含む）
 */
export const PEN = {
  size: 100, // m
  cell: 5, // m（区画の格子）
  depth: 10, // m（水深）
  unlockLevel: 5,
  unlockCost: 30000000,
  cellCost: 60000, // 1マス（5m×5m）の網と浮き桟橋の費用
  slotsPerM2: 1, // 収容枠（水槽の収容枠と同じ単位）
};
export const PEN_N = PEN.size / PEN.cell; // 20 マス

const inside = (s, i, j) => i >= s.x0 && i <= s.x1 && j >= s.z0 && j <= s.z1;
export const sectionCells = (s) => (s.x1 - s.x0 + 1) * (s.z1 - s.z0 + 1);
export const sectionSize = (s) => ({ w: (s.x1 - s.x0 + 1) * PEN.cell, d: (s.z1 - s.z0 + 1) * PEN.cell });

export class SeaPen extends EventTarget {
  constructor() {
    super();
    this.state = SeaPen.emptyState();
  }

  static emptyState() {
    return { unlocked: false, seq: 0, sections: [] };
  }

  get unlocked() {
    return this.state.unlocked;
  }

  get sections() {
    return this.state.sections;
  }

  canUnlock(level) {
    return !this.unlocked && level >= PEN.unlockLevel;
  }

  unlock() {
    this.state.unlocked = true;
    this._emit();
  }

  sectionAt(i, j) {
    return this.sections.find((s) => inside(s, i, j)) ?? null;
  }

  getSection(id) {
    return this.sections.find((s) => s.id === id) ?? null;
  }

  /** 2点を対角にした長方形。範囲外・他の区画と重なるなら null */
  rectOf(a, b) {
    const r = { x0: Math.min(a[0], b[0]), z0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), z1: Math.max(a[1], b[1]) };
    if (r.x0 < 0 || r.z0 < 0 || r.x1 >= PEN_N || r.z1 >= PEN_N) return null;
    for (let i = r.x0; i <= r.x1; i++) for (let j = r.z0; j <= r.z1; j++) if (this.sectionAt(i, j)) return null;
    return r;
  }

  buildCost(r) {
    return sectionCells(r) * PEN.cellCost;
  }

  /** 区画を作る（費用は呼び出し側で払う） */
  addSection(r) {
    const s = { id: ++this.state.seq, ...r, creatures: {} };
    this.sections.push(s);
    this._emit();
    return s;
  }

  /** 区画を撤去し、中の生き物を返す { id: 匹数 } */
  removeSection(id) {
    const s = this.getSection(id);
    if (!s) return {};
    this.state.sections = this.sections.filter((x) => x !== s);
    this._emit();
    return s.creatures;
  }

  capacity(s) {
    const { w, d } = sectionSize(s);
    return w * d * PEN.slotsPerM2;
  }

  used(s) {
    return Object.entries(s.creatures).reduce((sum, [id, n]) => sum + (getCreature(id)?.slots ?? 0) * n, 0);
  }

  /** 区画に入れられる匹数 */
  room(s, id) {
    const c = getCreature(id);
    return c ? Math.max(0, Math.floor((this.capacity(s) - this.used(s)) / c.slots)) : 0;
  }

  addCreature(s, id, n) {
    s.creatures[id] = (s.creatures[id] ?? 0) + n;
    this._emit();
  }

  takeCreature(s, id, n) {
    const have = s.creatures[id] ?? 0;
    const k = Math.min(have, n);
    if (k <= 0) return 0;
    s.creatures[id] = have - k;
    if (!s.creatures[id]) delete s.creatures[id];
    this._emit();
    return k;
  }

  /** 展示の一覧（ランキング・成長の「展示中」の判定用。水槽と同じ形 { userData: { creatures } }） */
  get exhibits() {
    return this.sections.map((s) => ({ userData: { creatures: s.creatures } }));
  }

  /** 生け簀全体の集客力。広い海を泳ぐ姿は見ごたえがあるので、水槽より2割高い */
  appeal() {
    if (!this.unlocked) return 0;
    let sum = this.sections.length ? 20 : 0;
    for (const s of this.sections) {
      for (const [id, n] of Object.entries(s.creatures)) {
        const c = getCreature(id);
        if (c && n > 0) sum += c.appeal * n ** 0.75 * appealOf(speciesPieces(id)) * 1.2;
      }
    }
    return sum;
  }

  toJSON() {
    return structuredClone(this.state);
  }

  fromJSON(data) {
    const st = { ...SeaPen.emptyState(), ...(data ?? {}) };
    st.sections = (st.sections ?? []).filter((s) => [s.x0, s.z0, s.x1, s.z1].every((v) => Number.isInteger(v) && v >= 0 && v < PEN_N));
    for (const s of st.sections) s.creatures = Object.fromEntries(Object.entries(s.creatures ?? {}).filter(([id, n]) => n > 0 && getCreature(id)));
    this.state = st;
    this._emit();
  }

  _emit() {
    this.dispatchEvent(new Event('change'));
  }
}
