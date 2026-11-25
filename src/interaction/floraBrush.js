import * as THREE from 'three';
import { getDef } from '../tanks/tankData.js';
import { specOf, pointCount, pointAt, pushPoint } from '../flora/floraBuilder.js';
import { surfaceTargets, castSurface } from '../flora/floraSurface.js';

/**
 * 生き物オブジェをブラシで広げる・消す（growMode：'paint' / 'erase'）。
 * なぞった面（岩・砂・壁）の上に、種ごとの間隔（gap）をあけて個体の点を足していく。
 * ソフトコーラル・イソギンチャクは固着点からの最大半径（maxR）まで、どの種も個体数の上限（max）まで。
 */
export const isFloraMode = (m) => m === 'paint' || m === 'erase';
export const floraItem = (item) => (item?.userData.interiorItem && specOf(getDef(item.userData.defId))?.kind === 'cover' ? item : null);

const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _t1 = new THREE.Vector3();
const _t2 = new THREE.Vector3();
const _q = new THREE.Vector3();
const _inv = new THREE.Matrix4();
const _rot = new THREE.Matrix3();

/** ブラシの半径（m）：種の間隔より細くはしない */
export const brushRadius = (ctx, item) => Math.max(specOf(getDef(item.userData.defId)).gap * 0.6, ctx.floraRadius);

/** ポインタの下の面（水槽ローカル）。ctx.raycaster はポインタに合わせ済み */
export function floraHit(ctx, item) {
  const tank = ctx.tank;
  tank.updateWorldMatrix(true, false);
  _inv.copy(tank.matrixWorld).invert();
  _o.copy(ctx.raycaster.ray.origin).applyMatrix4(_inv);
  _d.copy(ctx.raycaster.ray.direction).transformDirection(_inv);
  const targets = (ctx._floraTargets ??= surfaceTargets(ctx.manager, tank, item));
  return castSurface(tank, targets, _o, _d);
}

/** なぞり始め・なぞり終わりに呼ぶ（当てる相手の一覧を作り直す） */
export const resetFloraTargets = (ctx) => (ctx._floraTargets = null);

/** 1回ぶんのブラシ。点が増減したら true。上限で足せなかったら ctx.floraFull に理由を入れる */
export function floraStroke(ctx, item, hit) {
  const spec = specOf(getDef(item.userData.defId));
  const g = item.userData.growth;
  const R = brushRadius(ctx, item);
  item.updateMatrix();
  _inv.copy(item.matrix).invert();
  _rot.setFromMatrix4(_inv);
  const center = hit.p.clone().applyMatrix4(_inv); // オブジェのローカル
  const p = g.p;

  if (ctx.growMode === 'erase') {
    let changed = false;
    for (let i = pointCount(g) - 1; i >= 0 && pointCount(g) > 1; i--) {
      if (pointAt(p, i, _q).distanceTo(center) > R) continue;
      p.splice(i * 4, 4);
      changed = true;
    }
    return changed;
  }

  // ブラシの円（面に沿う）の中に候補を散らし、それぞれ面へ落として、近くに個体が無ければ足す
  const n = hit.n;
  _t1.set(1, 0, 0);
  if (Math.abs(n.x) > 0.9) _t1.set(0, 0, 1);
  _t1.cross(n).normalize();
  _t2.crossVectors(n, _t1);
  const tries = Math.min(24, Math.max(1, Math.ceil(((R / spec.gap) ** 2) * 1.6)));
  const reach = Math.max(0.05, R * 0.7);
  let changed = false;
  for (let k = 0; k < tries; k++) {
    const a = Math.random() * Math.PI * 2;
    const d = k === 0 ? 0 : Math.sqrt(Math.random()) * R;
    const from = hit.p.clone().addScaledVector(_t1, Math.cos(a) * d).addScaledVector(_t2, Math.sin(a) * d).addScaledVector(n, reach);
    const s = k === 0 ? hit : castSurface(ctx.tank, ctx._floraTargets ?? [], from, _d.copy(n).negate(), reach * 2.5);
    if (!s) continue;
    if (!spec.wall && s.n.y < 0.5) continue; // 砂地・上向きの面にしか生えない種
    const lp = s.p.clone().applyMatrix4(_inv);
    if (spec.maxR && lp.length() > spec.maxR) {
      ctx.floraFull = `この種の群体は径${Math.round(spec.maxR * 200)}cmまでです`;
      continue;
    }
    if (pointCount(g) >= spec.max) {
      ctx.floraFull = `1つのオブジェは${spec.max}個体までです（続きは新しく置いてください）`;
      break;
    }
    let near = false;
    for (let i = 0, c = pointCount(g); i < c && !near; i++) near = pointAt(p, i, _q).distanceToSquared(lp) < spec.gap * spec.gap;
    if (near) continue;
    pushPoint(p, lp, s.n.clone().applyMatrix3(_rot).normalize());
    changed = true;
  }
  return changed;
}
