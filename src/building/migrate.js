import { TankManager } from '../tanks/tankManager.js';
import { CATEGORY } from '../tanks/tankData.js';
import { FloorPlan, CELL } from '../room/floorPlan.js';
import { ZONES, FLOOR_COUNT, BASEMENT, PLAN_FLOORS, WING_FLOORS, WING_BASE, WING_RECT, WING_YARD, GRID_X, NORTH_ROWS, isWing, ATRIUM_TANK_POS, LAYOUT, WING_GRID_CENTER, getZone, inRect, oldZoneOffset, zoneCenter, zoneRectCenter } from './blueprint.js';
import { LEGACY_V3 } from './legacyLayoutV3.js';
import { returnTankToStock } from '../breeding/variants.js';

/** 版3の別館の区画（格子 72×46） */
const OLD_WING_RECT = [19, 6, 52, 39];

/** 自由な床形状の時代に使えていた広さに相当するエリア */
export function zonesForLegacyStage(level) {
  return ZONES.filter((z) => z.cost === 0 || (level >= 2 && z.stage === 1) || (level >= 3 && z.stage <= 3)).map((z) => z.id);
}

const overlaps = (a, b) => Math.abs(a.x - b.x) < a.hx + b.hx && Math.abs(a.z - b.z) < a.hz + b.hz;

/** 空いている場所を探す。見つからなければ null */
function findSpot(plans, placed, hx, hz, wantYard) {
  for (const plan of plans) {
    const b = plan.bounds();
    for (let z = b.z1 - hz; z >= b.z0 + hz; z -= 0.45) for (let x = b.x0 + hx; x <= b.x1 - hx; x += 0.45) {
      if (!plan.containsRect(x, z, hx, hz) || (plan.typeAt(x, z) === CELL.YARD) !== wantYard) continue;
      const box = { x, z, hx: hx + 0.3, hz: hz + 0.3, floor: plan.floor };
      if (!placed.some((p) => p.floor === plan.floor && overlaps(p, box))) return box;
    }
  }
  return null;
}

/** 元のエリアに対応する、新しい間取りでの位置 */
function preferred(o, wasBuilding) {
  const { x, z } = o.position;
  const old = wasBuilding ? oldZoneOffset(o.userData.floor, x, z) : null;
  const zone = getZone(old?.id ?? 'entrance');
  const c = zoneCenter(zone);
  return { x: c.x + (old?.dx ?? x), z: c.z + (old?.dz ?? z), floor: zone.floor };
}

/**
 * 間取りを選ぶ前のレイアウトを、選んだ間取りへ移す。水槽の中身は保ったまま、
 * 入りきらない物だけ在庫へ戻す。
 */
export function migrateToLayout({ manager, unlocked, wasBuilding, inventory, expeditions, economy }) {
  const plans = Array.from({ length: FLOOR_COUNT }, (_, f) => new FloorPlan(f, unlocked));
  const all = [...manager.objects.values()];
  const riders = new Map(all.map((o) => [o, manager.getRiders(o)]));
  const carried = new Set([...riders.values()].flat());
  const placed = [];

  for (const o of all) {
    if (carried.has(o)) continue;
    const def = manager.defOf(o);
    if (def.atrium) {
      Object.assign(o.position, { x: ATRIUM_TANK_POS.x, z: ATRIUM_TANK_POS.z });
      continue;
    }
    if (def.wallMount) {
      manager.remove(o);
      economy.earn(def.price);
      continue;
    }
    delete o.userData.embed;
    const { hx, hz } = TankManager.footprintHalf(def, o.rotation.y);
    const home = { ...preferred(o, wasBuilding), hx, hz };
    const plan = plans[home.floor];
    const keep = plan.containsRect(home.x, home.z, hx, hz) && !placed.some((p) => p.floor === home.floor && overlaps(p, home));
    const spot = keep ? home : findSpot(plans, placed, hx, hz, !!def.yardOnly);
    if (!spot) {
      for (const item of [o, ...riders.get(o)]) stow(item, { manager, inventory, expeditions, economy });
      continue;
    }
    const dx = spot.x - o.position.x;
    const dz = spot.z - o.position.z;
    for (const item of [o, ...riders.get(o)]) {
      item.position.x += dx;
      item.position.z += dz;
      item.userData.floor = spot.floor;
      delete item.userData.embed;
    }
    placed.push({ ...spot, hx, hz });
  }
  for (let f = 0; f < FLOOR_COUNT; f++) manager.refreshElevations(f);
}

/** 間取りの変更で置けなくなった物だけを、空いている場所へ移す */
export function relocateInvalid({ manager, unlocked, inventory, expeditions, economy }) {
  const plans = new Map([...PLAN_FLOORS, ...WING_FLOORS].map((f) => [f, new FloorPlan(f, unlocked)]));
  const all = [...manager.objects.values()];
  const riders = new Map(all.map((o) => [o, manager.getRiders(o)]));
  const carried = new Set([...riders.values()].flat());
  const roots = all.filter((o) => !carried.has(o) && !o.userData.embed && !manager.defOf(o).atrium);
  const box = (o) => ({ x: o.position.x, z: o.position.z, floor: o.userData.floor, ...TankManager.footprintHalf(manager.defOf(o), o.rotation.y) });
  // 廃止された階（3階以上）にある物や、バックヤード専用なのにバックヤードの外にある物は置き直す
  const fits = (o) => {
    const plan = plans.get(o.userData.floor);
    if (!plan?.containsRect(o.position.x, o.position.z, box(o).hx, box(o).hz)) return false;
    return !manager.defOf(o).yardOnly || plan.typeAt(o.position.x, o.position.z) === CELL.YARD;
  };
  const placed = roots.filter(fits).map(box);
  for (const o of roots.filter((r) => !fits(r))) {
    const { hx, hz } = box(o);
    const spot = findSpot([...plans.values()].filter((p) => p.floor !== BASEMENT && !isWing(p.floor)), placed, hx, hz, !!manager.defOf(o).yardOnly);
    if (!spot) {
      for (const item of [o, ...riders.get(o)]) stow(item, { manager, inventory, expeditions, economy });
      continue;
    }
    const [dx, dz] = [spot.x - o.position.x, spot.z - o.position.z];
    for (const item of [o, ...riders.get(o)]) {
      item.position.x += dx;
      item.position.z += dz;
      item.userData.floor = spot.floor;
    }
    placed.push({ ...spot, hx, hz });
  }
  for (const f of [...PLAN_FLOORS, ...WING_FLOORS]) manager.refreshElevations(f);
}

/** 置けない物を在庫とお金に戻す */
function stow(o, { manager, inventory, expeditions, economy }) {
  const def = manager.defOf(o);
  returnTankToStock(o, expeditions);
  if (o.userData.clip) economy.earn(manager.contentsValue(o));
  if (def.category === CATEGORY.TANK) inventory.add(def.id);
  else economy.earn(def.price);
  manager.remove(o);
}

/**
 * 間取りを広げた（建物の版4）ときの移行：物を元いたエリアの新しい位置へ、エリア内の並びを保ったまま移す。
 * 壁に埋め込んだ水槽は、壁の位置が変わるので床置きに戻す。大水槽は新しい吹き抜けの中央へ。
 * 置けなくなった物は、続けて relocateInvalid で空いている場所へ移す。
 */
export function migrateLayoutV4({ manager }) {
  const old = LEGACY_V3.layouts[LAYOUT.id] ?? LEGACY_V3.layouts.spiral;
  const [GX, GZ] = LEGACY_V3.grid;
  const C = LEGACY_V3.cell;
  const oldCell = (x, z) => [Math.floor(x / C + GX / 2), Math.floor(z / C + GZ / 2)];
  const center = ([x0, z0, x1, z1], gx, gz, c) => ({ x: ((x0 + x1 + 1) / 2 - gx / 2) * c, z: ((z0 + z1 + 1) / 2 - gz / 2) * c });
  const oldCenter = (r) => center(r, GX, GZ, C);
  const all = [...manager.objects.values()];
  const riders = new Map(all.map((o) => [o, manager.getRiders(o)]));
  const carried = new Set([...riders.values()].flat());
  for (const o of all) {
    if (carried.has(o)) continue;
    const def = manager.defOf(o);
    const group = [o, ...riders.get(o)];
    for (const item of group) delete item.userData.embed;
    if (def.atrium) {
      Object.assign(o.position, { x: ATRIUM_TANK_POS.x, z: ATRIUM_TANK_POS.z });
      continue;
    }
    const floor = o.userData.floor;
    let delta = null;
    if (floor >= WING_BASE) {
      const a = oldCenter(OLD_WING_RECT);
      delta = { x: WING_GRID_CENTER.x - a.x, z: WING_GRID_CENTER.z - a.z };
    } else {
      const [i, j] = oldCell(o.position.x, o.position.z);
      for (const [id, rects] of Object.entries(old.rects)) {
        const zone = getZone(id);
        const k = zone?.floor === floor ? rects.findIndex((r) => inRect(r, i, j)) : -1;
        if (k < 0) continue;
        const a = oldCenter(rects[k]);
        const b = zoneRectCenter(zone.rects[k] ?? zone.rects[0]);
        delta = { x: b.x - a.x, z: b.z - a.z };
        break;
      }
    }
    if (!delta) continue;
    for (const item of group) {
      item.position.x += delta.x;
      item.position.z += delta.z;
    }
  }
}

/**
 * 建物の版4 → 5：敷地の格子を左右に26マスずつ広げた（128 → 180 マス。建物のワールド座標は同じ）。
 * マス番号で持つ壁の編集（境目キー）と、壁への埋め込み（縦の壁の線番号）を新しい格子に直す。data を書き換える
 */
export function migrateGridV5(data) {
  const [OLD_GX, NEW_GX, SHIFT] = [128, 180, 26];
  const conv = (idx) => Math.floor(idx / OLD_GX) * NEW_GX + (idx % OLD_GX) + SHIFT;
  for (const edits of Object.values(data.room?.walls ?? {})) {
    for (const k of ['add', 'remove']) {
      edits[k] = (edits[k] ?? []).map((key) => {
        const [a, b] = String(key).split('|').map(Number);
        const [x, y] = [conv(a), conv(b)];
        return x < y ? `${x}|${y}` : `${y}|${x}`;
      });
    }
  }
  for (const o of data.objects ?? []) {
    const e = o.embed;
    if (!e?.key) continue;
    const [axis, line, ...rest] = String(e.key).split(':');
    if (axis === 'z') e.key = [axis, Number(line) + SHIFT, ...rest].join(':');
  }
}

/** 版5までの別館の区画（格子 180×86）。中心はワールド座標の原点 */
const V5_WING_RECT = [73, 26, 106, 59];

/**
 * 建物の版5 → 6（データの移行）：格子を北へ NORTH_ROWS 行広げ、別館をイルカプールの奥へ移した。
 * 壁の編集（境目キー）と壁への埋め込み（横の壁の線番号）を新しい格子に直し、別館1F・2F（旧フロア10・11）の
 * 壁の編集は本館の1F・2F の格子の新しい別館の位置へ移す。今いる階も直す。data を書き換える
 */
export function migrateGridV6(data, builtVer) {
  const remapFloor = (f) => (f >= WING_BASE && f < WING_BASE + FLOOR_COUNT ? f - WING_BASE : f);
  if (data.economy && Number.isFinite(data.economy.floor)) data.economy.floor = remapFloor(data.economy.floor);
  if (builtVer < 4) return; // それより前の壁の編集・埋め込みは使わない
  const [wx0, wz0] = [WING_RECT[0] + WING_YARD, WING_RECT[1] + WING_YARD];
  const conv = (idx, wing) => {
    const [i, j] = [idx % GRID_X, Math.floor(idx / GRID_X)];
    return wing ? (j - V5_WING_RECT[1] + wz0) * GRID_X + (i - V5_WING_RECT[0] + wx0) : (j + NORTH_ROWS) * GRID_X + i;
  };
  const walls = data.room?.walls;
  if (walls) {
    const out = {};
    for (const [floor, edits] of Object.entries(walls)) {
      const f = +floor;
      const wing = f >= WING_BASE;
      const to = (out[remapFloor(f)] ??= { add: [], remove: [] });
      for (const k of ['add', 'remove']) {
        for (const key of edits[k] ?? []) {
          const [a, b] = String(key).split('|').map((x) => conv(+x, wing));
          to[k].push(a < b ? `${a}|${b}` : `${b}|${a}`);
        }
      }
    }
    data.room.walls = out;
  }
  for (const o of data.objects ?? []) {
    const e = o.embed;
    if (!e?.key) continue;
    if (o.floor >= WING_BASE) {
      delete o.embed; // 別館の物は場所が変わるので床置きに戻す
      continue;
    }
    const [axis, line, ...rest] = String(e.key).split(':');
    if (axis === 'x') e.key = [axis, Number(line) + NORTH_ROWS, ...rest].join(':');
  }
}

/**
 * 建物の版5 → 6（置いた物の移行）：別館の物を新しい別館の位置へ移し、別館1F・2F の物を本館と同じ 1F・2F に移す。
 * moved = 版4の移行で、すでに新しい別館の中心へ移してある
 */
export function migrateWingV6({ manager, moved }) {
  const dx = moved ? 0 : WING_GRID_CENTER.x;
  const dz = moved ? 0 : WING_GRID_CENTER.z;
  for (const o of manager.objects.values()) {
    const f = o.userData.floor;
    if (f < WING_BASE) continue;
    o.position.x += dx;
    o.position.z += dz;
    delete o.userData.embed;
    if (f < WING_BASE + FLOOR_COUNT) o.userData.floor = f - WING_BASE;
  }
}

/**
 * その階の床（展示室）で、target に一番近い空いている場所。見つからなければ null。
 * 置いてある物と重ならず、1つの部屋に収まる位置を、近い順に 0.45m 刻みで探す
 */
export function freeFloorSpot({ manager, floor, unlocked, hx, hz, target, type = CELL.FLOOR }) {
  const plan = new FloorPlan(floor, unlocked);
  const placed = [...manager.objects.values()].filter((o) => o.userData.floor === floor && !o.userData.embed).map((o) => ({ x: o.position.x, z: o.position.z, ...TankManager.footprintHalf(manager.defOf(o), o.rotation.y) }));
  if (!plan.active.includes(type)) return null;
  const b = plan.bounds(type);
  const t = target ?? { x: b.cx, z: b.cz };
  const cand = [];
  for (let z = b.z0 + hz; z <= b.z1 - hz; z += 0.45) for (let x = b.x0 + hx; x <= b.x1 - hx; x += 0.45) cand.push([x, z, (x - t.x) ** 2 + (z - t.z) ** 2]);
  cand.sort((p, q) => p[2] - q[2]);
  for (const [x, z] of cand) {
    if (plan.typeAt(x, z) !== type || !plan.containsRect(x, z, hx, hz)) continue;
    const box = { x, z, hx: hx + 0.4, hz: hz + 0.4 };
    if (!placed.some((p) => overlaps(p, box))) return { x, z };
  }
  return null;
}
