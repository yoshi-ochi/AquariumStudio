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

  // ブラシの円（面に沿う）の中に、間隔 gap の六角格子の候補を置く。格子は面の向きごとに水槽で固定なので、
  // 何度なぞっても同じ格子にそろい、隣どうしがすき間なく接する。候補を面へ落とし、近くに個体が無ければ足す
  const n = hit.n;
  _t1.set(1, 0, 0);
  if (Math.abs(n.x) > 0.9) _t1.set(0, 0, 1);
  _t1.cross(n).normalize();
  _t2.crossVectors(n, _t1);
  const step = spec.gap;
  const row = step * 0.866;
  const u0 = hit.p.dot(_t1);
  const v0 = hit.p.dot(_t2);
  const cands = [];
  const K = Math.ceil(R / row) + 1;
  for (let j = -K; j <= K; j++) {
    const jj = Math.round(v0 / row) + j;
    const v = jj * row - v0;
    for (let i = -K; i <= K; i++) {
      const u = (Math.round(u0 / step) + i + (jj & 1) * 0.5) * step - u0;
      if (u * u + v * v <= R * R) cands.push([u, v]);
    }
  }
  cands.sort((a, b) => a[0] * a[0] + a[1] * a[1] - b[0] * b[0] - b[1] * b[1]);
  const reach = Math.max(0.05, R * 0.7);
  const min2 = (spec.gap * 0.8) ** 2;
  let changed = false;
  for (const [u, v] of cands.slice(0, 40)) {
    // 格子の点にわずかなゆらぎ（並びが機械的に見えないように）
    const jit = spec.gap * 0.12;
    const from = hit.p.clone().addScaledVector(_t1, u + (Math.random() - 0.5) * jit).addScaledVector(_t2, v + (Math.random() - 0.5) * jit).addScaledVector(n, reach);
    const s = castSurface(ctx.tank, ctx._floraTargets ?? [], from, _d.copy(n).negate(), reach * 2.5);
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
    for (let i = 0, c = pointCount(g); i < c && !near; i++) near = pointAt(p, i, _q).distanceToSquared(lp) < min2;
    if (near) continue;
    pushPoint(p, lp, s.n.clone().applyMatrix3(_rot).normalize());
    changed = true;
  }
  return changed;
}
