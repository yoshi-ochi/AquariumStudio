import { ATRIUM_VOID, BASEMENT, isWing, CELL_SIZE, EXHIBIT_ZONES, GRID_X, GRID_Z, GRID_Z0, LAYOUT, SERVICE_WIDTH, WALL_EDITS, WING_YARD, ZONES, ZONE_TYPE, zoneHas } from '../building/blueprint.js';

/**
 * 建物の1フロア分のマス目。形は間取り（blueprint.js）で決まり、解放済みのエリアだけ使える。
 * NONE = 敷地外、FLOOR = 展示室、YARD = バックヤード、LOCKED = 未解放、VOID = 吹き抜け、
 * OUT = 屋外エリア、LOCKED_OUT = 未解放の屋外エリア
 */
export const CELL = Object.freeze({ NONE: 0, FLOOR: 1, YARD: 2, LOCKED: 3, VOID: 4, OUT: 5, LOCKED_OUT: 6 });

const OPEN = (t) => t === CELL.FLOOR || t === CELL.YARD || t === CELL.OUT;
const SHUT = (t) => t === CELL.LOCKED || t === CELL.LOCKED_OUT;
/** 来館者が歩ける */
export const WALKABLE = (t) => t === CELL.FLOOR || t === CELL.OUT;

export class FloorPlan {
  constructor(floor, unlocked) {
    this.floor = floor;
    this.cell = CELL_SIZE;
    this.GX = GRID_X;
    this.GZ = GRID_Z;
    this.Z0 = GRID_Z0; // ワールド座標 z = 0 の行
    this.active = new Uint8Array(this.GX * this.GZ);
    const edits = WALL_EDITS[floor] ?? { add: [], remove: [] };
    this.addedWalls = new Set(edits.add);
    this.removedWalls = new Set(edits.remove);
    this.signature = `${LAYOUT.id}:${floor}:${[...unlocked].sort().join(',')}:${edits.add.length}:${edits.remove.length}`;
    this.zoneIds = new Int8Array(this.GX * this.GZ).fill(-1);
    ZONES.forEach((zone, n) => {
      if (zone.floor !== floor || (zone.type === ZONE_TYPE.OUTDOOR && !zone.open)) return;
      const open = unlocked.has(zone.id);
      if (zone.wing && !open) return; // 未建設の別館の階は出さない
      const type = zone.open ? (open ? CELL.OUT : CELL.LOCKED_OUT) : !open ? CELL.LOCKED : zone.type === ZONE_TYPE.YARD ? CELL.YARD : CELL.FLOOR;
      for (const rect of zone.rects) this._fill(rect, type);
      for (let j = 0; j < this.GZ; j++) for (let i = 0; i < this.GX; i++) if (zoneHas(zone, i, j)) this.zoneIds[this.idx(i, j)] = n;
      // 自然再現などの作り付けの景観には物を置けない
      if (zone.scenery && open) this._fill(zone.scenery, CELL.NONE);
    });
    if (floor === ATRIUM_VOID.floor) this._fill(ATRIUM_VOID.rect, unlocked.has(ATRIUM_VOID.zone) ? CELL.VOID : CELL.LOCKED);
    this.doors = this._findDoors();
    if (floor !== BASEMENT && !isWing(floor)) this._carveService(unlocked);
    this._carveWingYard(unlocked);
  }

  /** 別館の展示室の周りを、幅 WING_YARD マスのバックヤードで囲む（連絡通路への出入口は空ける） */
  _carveWingYard(unlocked) {
    const SERVICE = 100;
    ZONES.forEach((zone, n) => {
      if (!zone.wing || zone.floor !== this.floor || !unlocked.has(zone.id)) return;
      const [x0, z0, x1, z1] = zone.rects[0];
      const W = WING_YARD;
      const keep = new Set();
      for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) {
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (this._zoneAt(i + a, j + b) === n || !this.doors.has(this.edge(i, j, i + a, j + b))) continue;
          for (let d = 0; d < W; d++) keep.add(this.idx(i - a * d, j - b * d));
        }
      }
      for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) {
        const edge = i < x0 + W || i > x1 - W || j < z0 + W || j > z1 - W;
        if (!edge || keep.has(this.idx(i, j))) continue;
        this.active[this.idx(i, j)] = CELL.YARD;
        this.zoneIds[this.idx(i, j)] = SERVICE;
      }
    });
  }

  /** 展示室の壁の裏に管理通路を設け、メインバックヤードへつなぐ */
  _carveService(unlocked) {
    const SERVICE = 100;
    const yard = this.floor === 0 ? 'yard1' : 'yard2';
    for (const rect of LAYOUT.serviceLinks) {
      this._fill(rect, unlocked.has(yard) ? CELL.YARD : CELL.LOCKED);
      for (let j = rect[1]; j <= rect[3]; j++) for (let i = rect[0]; i <= rect[2]; i++) this.zoneIds[this.idx(i, j)] = SERVICE;
    }
    ZONES.forEach((zone, n) => {
      if (zone.floor !== this.floor || !EXHIBIT_ZONES.includes(zone.id) || !unlocked.has(zone.id)) return;
      const [x0, z0, x1, z1] = zone.rects[0];
      // 来館者の出入口は通路をまたいで残す
      const keep = new Set();
      for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) {
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (this._zoneAt(i + a, j + b) === n || !this.doors.has(this.edge(i, j, i + a, j + b))) continue;
          for (let d = 0; d < SERVICE_WIDTH; d++) keep.add(this.idx(i - a * d, j - b * d));
        }
      }
      const W = SERVICE_WIDTH;
      for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) {
        const edge = i < x0 + W || i > x1 - W || j < z0 + W || j > z1 - W;
        if (!edge || keep.has(this.idx(i, j))) continue;
        this.active[this.idx(i, j)] = CELL.YARD;
        this.zoneIds[this.idx(i, j)] = SERVICE;
      }
    });
  }

  _fill([x0, z0, x1, z1], type) {
    for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) this.active[this.idx(i, j)] = type;
  }

  idx(i, j) {
    return j * this.GX + i;
  }

  at(i, j) {
    return i >= 0 && j >= 0 && i < this.GX && j < this.GZ ? this.active[this.idx(i, j)] : 0;
  }

  _zoneAt(i, j) {
    return i >= 0 && j >= 0 && i < this.GX && j < this.GZ ? this.zoneIds[this.idx(i, j)] : -1;
  }

  /** 隣り合う2マスの境目を表すキー */
  edge(i0, j0, i1, j1) {
    const a = this.idx(i0, j0);
    const b = this.idx(i1, j1);
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  /** 順路でつながるエリアの境に、幅4マスの出入口をあける */
  _findDoors() {
    const doors = new Set();
    for (const [a, b] of LAYOUT.links) {
      const na = ZONES.findIndex((z) => z.id === a);
      const nb = ZONES.findIndex((z) => z.id === b);
      if (ZONES[na].floor !== this.floor || ZONES[nb].floor !== this.floor) continue;
      const lines = new Map();
      for (let j = 0; j < this.GZ; j++) for (let i = 0; i < this.GX; i++) {
        for (const [di, dj, axis] of [[1, 0, 'v'], [0, 1, 'h']]) {
          const p = this._zoneAt(i, j);
          const q = this._zoneAt(i + di, j + dj);
          if (!((p === na && q === nb) || (p === nb && q === na))) continue;
          const key = axis === 'v' ? `v${i}` : `h${j}`;
          if (!lines.has(key)) lines.set(key, []);
          lines.get(key).push(this.edge(i, j, i + di, j + dj));
        }
      }
      const best = [...lines.values()].sort((x, y) => y.length - x.length)[0] ?? [];
      const start = Math.max(0, Math.floor(best.length / 2) - 2);
      best.slice(start, start + 4).forEach((e) => doors.add(e));
    }
    return doors;
  }

  /** 間取り本来の状態で、その境目を通れるか */
  _basePassable(i0, j0, i1, j1) {
    const p = this._zoneAt(i0, j0);
    const q = this._zoneAt(i1, j1);
    if (p === q) return true;
    if (this.at(i0, j0) === CELL.OUT && this.at(i1, j1) === CELL.OUT) return true; // 屋外どうしは地続き
    return this.doors.has(this.edge(i0, j0, i1, j1));
  }

  /** 隣のマスへ歩いて移動できるか（自由に編集した壁も反映） */
  passable(i0, j0, i1, j1) {
    const key = this.edge(i0, j0, i1, j1);
    if (this.addedWalls.has(key)) return false;
    return this.removedWalls.has(key) || this._basePassable(i0, j0, i1, j1);
  }

  /** 歩けるマスがいくつに分断されているか */
  componentCount() {
    const seen = new Set();
    let count = 0;
    for (let j = 0; j < this.GZ; j++) for (let i = 0; i < this.GX; i++) {
      if (!WALKABLE(this.at(i, j)) || seen.has(this.idx(i, j))) continue;
      count++;
      const queue = [[i, j]];
      seen.add(this.idx(i, j));
      for (let q = 0; q < queue.length; q++) {
        const [x, z] = queue[q];
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!WALKABLE(this.at(x + a, z + b))) continue;
          const k = this.idx(x + a, z + b);
          if (seen.has(k) || !this.passable(x, z, x + a, z + b)) continue;
          seen.add(k);
          queue.push([x + a, z + b]);
        }
      }
    }
    return count;
  }

  /** 矩形の内側を、自由に追加した壁が横切っているか */
  crossesAddedWall(cx, cz, hx, hz) {
    for (const key of this.addedWalls) {
      const [a, b] = key.split('|').map(Number);
      const [i0, j0] = [a % this.GX, Math.floor(a / this.GX)];
      const [i1, j1] = [b % this.GX, Math.floor(b / this.GX)];
      const [x0, z0] = this.cellMin(i1, j1);
      const vertical = j0 === j1;
      const inside = vertical
        ? x0 > cx - hx && x0 < cx + hx && z0 + this.cell > cz - hz && z0 < cz + hz
        : z0 > cz - hz && z0 < cz + hz && x0 + this.cell > cx - hx && x0 < cx + hx;
      if (inside) return true;
    }
    return false;
  }

  cellOf(x, z) {
    return [Math.floor(x / this.cell + this.GX / 2), Math.floor(z / this.cell + this.Z0)];
  }

  cellMin(i, j) {
    return [(i - this.GX / 2) * this.cell, (j - this.Z0) * this.cell];
  }

  /** 使える床の上か */
  containsPoint(x, z) {
    const [i, j] = this.cellOf(x, z);
    return OPEN(this.at(i, j));
  }

  typeAt(x, z) {
    const [i, j] = this.cellOf(x, z);
    return this.at(i, j);
  }

  /** 軸平行の矩形がすべて使える床の上にあり、部屋をまたがないか */
  containsRect(cx, cz, hx, hz) {
    const e = 1e-4;
    const step = this.cell * 0.5;
    const xs = [];
    for (let x = cx - hx + e; x < cx + hx - e; x += step) xs.push(x);
    xs.push(cx + hx - e);
    const zs = [];
    for (let z = cz - hz + e; z < cz + hz - e; z += step) zs.push(z);
    zs.push(cz + hz - e);
    let type = null;
    let room = null;
    for (const x of xs) for (const z of zs) {
      const [i, j] = this.cellOf(x, z);
      const t = this.at(i, j);
      const n = this._zoneAt(i, j);
      if (!OPEN(t) || (type !== null && (t !== type || n !== room))) return false;
      type = t;
      room = n;
    }
    return !this.crossesAddedWall(cx, cz, hx, hz);
  }

  rectOverlapsCell(cx, cz, hx, hz, i, j) {
    const [x0, z0] = this.cellMin(i, j);
    return cx + hx > x0 && cx - hx < x0 + this.cell && cz + hz > z0 && cz - hz < z0 + this.cell;
  }

  /**
   * 壁のラン。{ key, kind, side, axis, line, from, to, normal:[nx,nz] }
   * kind: exterior 外壁 / partition 展示とバックヤードの仕切り / room 展示室の間の壁 /
   *       shutter 未解放エリアとの境 / rail 吹き抜けの手すりと屋外の柵
   */
  runs() {
    const c = this.cell;
    const runs = [];
    const classify = (a, b, i0, j0, i1, j1) => {
      if (WALKABLE(a) && WALKABLE(b)) return this.passable(i0, j0, i1, j1) ? null : { kind: 'room', n: 1, side: CELL.FLOOR };
      if (a === b) return null;
      if (a === CELL.VOID || b === CELL.VOID) {
        if (!OPEN(a) && !OPEN(b)) return { kind: 'shutter', n: a === CELL.VOID ? 1 : -1, side: CELL.LOCKED };
        return { kind: 'rail', n: OPEN(b) ? 1 : -1, side: CELL.FLOOR };
      }
      if (SHUT(a) && OPEN(b)) return { kind: 'shutter', n: 1, side: b };
      if (SHUT(b) && OPEN(a)) return { kind: 'shutter', n: -1, side: a };
      if (SHUT(a) && SHUT(b)) return null;
      if (a === CELL.LOCKED_OUT || b === CELL.LOCKED_OUT) return null; // 未解放の屋外には壁を立てない
      if (a === CELL.OUT || b === CELL.OUT) {
        if (a === CELL.YARD || b === CELL.YARD) return { kind: 'exterior', n: b === CELL.YARD ? 1 : -1, side: CELL.YARD };
        return { kind: 'rail', n: b === CELL.OUT ? 1 : -1, side: CELL.OUT }; // 屋外の柵
      }
      if (!a || !b) return { kind: 'exterior', n: b ? 1 : -1, side: a || b };
      return { kind: 'partition', n: b === CELL.FLOOR ? 1 : -1, side: CELL.FLOOR };
    };
    const push = (axis, lineIdx, cls, a0, a1) => {
      const halfLine = axis === 'x' ? this.Z0 : this.GX / 2;
      const halfAlong = axis === 'x' ? this.GX / 2 : this.Z0;
      runs.push({
        key: `${axis}:${lineIdx}:${cls.n}:${cls.kind}`,
        kind: cls.kind,
        side: cls.side,
        axis,
        line: (lineIdx - halfLine) * c,
        from: (a0 - halfAlong) * c,
        to: (a1 - halfAlong) * c,
        normal: axis === 'x' ? [0, cls.n] : [cls.n, 0],
      });
    };
    const same = (p, q) => p && q && p.kind === q.kind && p.n === q.n && p.side === q.side;
    const scan = (axis, lines, len, posA, posB) => {
      for (let l = 0; l <= lines; l++) {
        let cur = null;
        let start = 0;
        for (let s = 0; s <= len; s++) {
          const [i0, j0] = posA(s, l);
          const [i1, j1] = posB(s, l);
          const cls = s < len ? classify(this.at(i0, j0), this.at(i1, j1), i0, j0, i1, j1) : null;
          if (cur && same(cur, cls)) continue;
          if (cur) push(axis, l, cur, start, s);
          cur = cls;
          start = s;
        }
      }
    };
    scan('x', this.GZ, this.GX, (s, l) => [s, l - 1], (s, l) => [s, l]); // z = 一定 の線
    scan('z', this.GX, this.GZ, (s, l) => [l - 1, s], (s, l) => [l, s]); // x = 一定 の線
    return runs;
  }

  /** 床の外接矩形。type を渡すとその種類だけ */
  bounds(type = null) {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let j = 0; j < this.GZ; j++) for (let i = 0; i < this.GX; i++) {
      const t = this.at(i, j);
      if (!t || (type && t !== type)) continue;
      const [x, z] = this.cellMin(i, j);
      x0 = Math.min(x0, x); z0 = Math.min(z0, z);
      x1 = Math.max(x1, x + this.cell); z1 = Math.max(z1, z + this.cell);
    }
    if (x0 === Infinity) return this.bounds();
    return { x0, z0, x1, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 };
  }
}
