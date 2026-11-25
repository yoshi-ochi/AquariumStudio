import * as THREE from 'three';
import { getDef } from '../tanks/tankData.js';

/**
 * 水槽内オブジェ（岩・海藻・サンゴ・流木）を、生き物の居場所として読み取る。座標は水槽ローカル。
 * rocks: 岩穴にすむ生き物の巣・待ち伏せの場所、holds: タツノオトシゴが尾を巻き付ける場所、coral: クマノミ・スズメダイの住みか
 */
const box = new THREE.Box3();
const inv = new THREE.Matrix4();

const HOLD_DECOR = new Set(['driftwood', 'plants']);

export function lifeAnchors(tank) {
  const out = { rocks: [], holds: [], coral: [], sig: '' };
  const contents = tank.getObjectByName('contents');
  if (!contents) return out;
  tank.updateMatrixWorld(true);
  inv.copy(tank.matrixWorld).invert();
  for (const item of contents.children) {
    if (item.userData.ghost) continue;
    const def = getDef(item.userData.defId);
    if (!def) continue;
    const g = def.group;
    const kind = g === 'rock' ? 'rock' : g === 'seaweed' ? 'hold' : g === 'coral' || g === 'soft' ? 'coral' : HOLD_DECOR.has(def.id) ? 'hold' : null;
    if (!kind) continue;
    box.setFromObject(item).applyMatrix4(inv);
    if (box.isEmpty()) continue;
    // bx, bz は根元（配置した位置）。海藻は葉が垂れて外接箱の中心が根元からずれるので、掴まる場所は根元から選ぶ
    const a = { x: (box.min.x + box.max.x) / 2, z: (box.min.z + box.max.z) / 2, w: box.max.x - box.min.x, d: box.max.z - box.min.z, y0: box.min.y, h: box.max.y - box.min.y, bx: item.position.x, bz: item.position.z, id: def.id };
    a.r = Math.min(a.w, a.d) / 2;
    if (kind === 'rock') out.rocks.push(a);
    else if (kind === 'coral') out.coral.push(a), out.holds.push(a);
    else out.holds.push(a);
  }
  return out;
}

/** 水槽内オブジェの配置が変わったかを調べるための目印（数と位置・大きさの合計） */
export function anchorSig(tank) {
  const contents = tank.getObjectByName('contents');
  if (!contents) return '';
  let n = 0;
  let s = 0;
  for (const c of contents.children) {
    if (c.userData.ghost) continue;
    n++;
    s += c.position.x * 3.1 + c.position.y * 5.3 + c.position.z * 7.7 + c.rotation.y + c.scale.x;
  }
  return `${n}:${s.toFixed(3)}`;
}
