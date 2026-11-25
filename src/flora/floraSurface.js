import * as THREE from 'three';
import { getDef } from '../tanks/tankData.js';
import { specOf, pointCount, pointAt, decodeNormal, encodeNormal } from './floraBuilder.js';

/**
 * 生き物オブジェが付く面を探す。面は「岩・流木など生き物でない水槽内オブジェの表面」と「水槽の底・壁（水面より下）」。
 * 座標は水槽ローカル。戻り値 { p, n }（位置と、水槽の内側を向いた法線）
 */
const ray = new THREE.Raycaster();
const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _a = new THREE.Vector3();

/** レイを当てる相手（生き物オブジェ・置いている途中のものを除く。トンネル水槽のアーチのガラスを含む） */
export function surfaceTargets(manager, tank, self) {
  tank.updateMatrixWorld(true); // 置いたばかりの岩にも当たるよう、行列を最新にする
  const list = manager.interiorItems(tank).filter((o) => o !== self && !getDef(o.userData.defId).flora);
  tank.getObjectByName('body')?.traverse((o) => o.userData.tunnelGlass && list.push(o));
  return list;
}

/** 水槽の底・壁との交点（水槽の中から外へ出る側の面）。o, d は水槽ローカルの始点と向き */
function boundsHit(I, o, d) {
  let t = Infinity;
  let n = null;
  const take = (tt, nx, ny, nz) => {
    if (tt > 1e-4 && tt < t) (t = tt), (n = [nx, ny, nz]);
  };
  if (d.y < -1e-6) take((I.floorY - o.y) / d.y, 0, 1, 0);
  if (I.shape === 'cylinder') {
    const a = d.x * d.x + d.z * d.z;
    const b = 2 * (o.x * d.x + o.z * d.z);
    const c = o.x * o.x + o.z * o.z - I.radius * I.radius;
    const disc = b * b - 4 * a * c;
    if (a > 1e-9 && disc > 0) {
      const tt = (-b + Math.sqrt(disc)) / (2 * a); // 遠い側の交点（内から外へ）
      if (tt > 1e-4 && tt < t) {
        t = tt;
        n = [-(o.x + d.x * tt) / I.radius, 0, -(o.z + d.z * tt) / I.radius];
      }
    }
  } else {
    if (d.x > 1e-6) take((I.halfW - o.x) / d.x, -1, 0, 0);
    if (d.x < -1e-6) take((-I.halfW - o.x) / d.x, 1, 0, 0);
    if (d.z > 1e-6) take((I.halfD - o.z) / d.z, 0, 0, -1);
    if (d.z < -1e-6) take((-I.halfD - o.z) / d.z, 0, 0, 1);
  }
  if (!n) return null;
  const p = new THREE.Vector3().copy(o).addScaledVector(d, t);
  // 水槽の外・水面より上・底より下は面ではない
  const e = 0.004;
  const inside = I.shape === 'cylinder' ? Math.hypot(p.x, p.z) <= I.radius + e : Math.abs(p.x) <= I.halfW + e && Math.abs(p.z) <= I.halfD + e;
  if (!inside || p.y < I.floorY - e || p.y > (I.waterTop ?? 1e3)) return null;
  return { t, p, n: new THREE.Vector3(...n) };
}

/** 水槽ローカルのレイ（o から d へ、長さ far まで）が最初に当たる面 */
export function castSurface(tank, targets, o, d, far = Infinity) {
  tank.updateWorldMatrix(true, false);
  let best = boundsHit(tank.userData.interior, o, d);
  if (best && best.t > far) best = null;
  if (targets.length) {
    ray.set(_o.copy(o).applyMatrix4(tank.matrixWorld), _d.copy(d).transformDirection(tank.matrixWorld));
    ray.far = Math.min(far, best?.t ?? Infinity);
    const hit = ray.intersectObjects(targets, true)[0];
    if (hit?.face) {
      const p = tank.worldToLocal(hit.point.clone());
      // 面の法線（ワールド）→ 水槽ローカル。裏から当たったらレイの手前側へ向ける
      const n = _a.copy(hit.face.normal).transformDirection(hit.object.matrixWorld).add(hit.point);
      tank.worldToLocal(n).sub(p).normalize();
      if (n.dot(d) > 0) n.negate();
      best = { t: hit.distance, p, n: n.clone() };
    }
  }
  return best ? { p: best.p, n: best.n } : null;
}

/**
 * オブジェを動かした・回したあと、個体の点を近くの面に沿わせ直す。
 * 各点から面の法線の逆向きに探し、見つからなければ真上から落として探す（上向きの面にいた点だけ）
 */
export function conformFlora(manager, tank, item) {
  const def = getDef(item.userData.defId);
  const g = item.userData.growth;
  if (!specOf(def) || !g) return;
  const targets = surfaceTargets(manager, tank, item);
  item.updateMatrix();
  const inv = new THREE.Matrix4().copy(item.matrix).invert();
  const rot = new THREE.Matrix3().setFromMatrix4(item.matrix);
  const irot = new THREE.Matrix3().setFromMatrix4(inv);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const o = new THREE.Vector3();
  const d = new THREE.Vector3();
  const reach = 0.15;
  for (let i = 0, count = pointCount(g); i < count; i++) {
    pointAt(g.p, i, p).applyMatrix4(item.matrix);
    decodeNormal(g.p[i * 4 + 3], n).applyMatrix3(rot).normalize();
    let hit = castSurface(tank, targets, o.copy(p).addScaledVector(n, reach), d.copy(n).negate(), reach * 2.5);
    if (!hit && n.y > 0.5) hit = castSurface(tank, targets, o.set(p.x, p.y + 1.5, p.z), d.set(0, -1, 0));
    if (!hit) continue;
    hit.p.applyMatrix4(inv);
    hit.n.applyMatrix3(irot).normalize();
    g.p[i * 4] = Math.round(hit.p.x * 1000);
    g.p[i * 4 + 1] = Math.round(hit.p.y * 1000);
    g.p[i * 4 + 2] = Math.round(hit.p.z * 1000);
    g.p[i * 4 + 3] = encodeNormal(hit.n);
  }
}
