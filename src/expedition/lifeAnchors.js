import * as THREE from 'three';
import { getDef } from '../tanks/tankData.js';
import { specOf } from '../flora/floraBuilder.js';

/**
 * 水槽内オブジェ（岩・海藻・サンゴ・流木）を、生き物の居場所として読み取る。座標は水槽ローカル。
 * rocks: 岩穴にすむ生き物の巣・待ち伏せの場所、holds: タツノオトシゴが尾を巻き付ける場所、coral: クマノミ・スズメダイの住みか
 * solids: 生き物が入り込めない硬い物の概形（当たり判定）。
 *   dome … 岩・硬いサンゴ・シャコガイ：外接箱に収まる丸みのある山（上から見て楕円、角の丸い箱に近い形）
 *   ball … 流木：幹・枝に沿って並べた球
 *   ソフトコーラル・イソギンチャク・海藻・水草は柔らかくなびくので当たり判定を付けない（間を泳げる）。岩を覆う薄い群体も岩の判定で足りる
 */
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();

/** 硬い物か（当たり判定を付けるか） */
function solidKind(def) {
  if (def.group === 'rock') return 'dome';
  if (def.growth === 'driftwood') return 'wood';
  const spec = def.flora ? specOf(def) : null;
  if (spec?.kind === 'grow' && (spec.flat || def.id === 'shakogai')) return 'dome'; // 固着点から育つ硬いサンゴ
  return null;
}

/** 流木：幹・枝の点列に沿って、太さの球を並べる（水槽ローカル） */
function woodBalls(item, out) {
  _m.copy(item.matrix);
  for (const part of item.userData.growth?.parts ?? []) {
    const pts = part.pts.map((p) => new THREE.Vector3(...p).applyMatrix4(_m));
    const r = part.r * item.scale.x;
    for (let i = 0; i < pts.length - 1; i++) {
      const n = Math.max(1, Math.ceil(pts[i].distanceTo(pts[i + 1]) / (r * 1.2)));
      for (let k = 0; k <= n; k++) {
        _v.lerpVectors(pts[i], pts[i + 1], k / n);
        out.push({ t: 'ball', x: _v.x, y: _v.y, z: _v.z, r });
      }
    }
  }
}
const box = new THREE.Box3();
const inv = new THREE.Matrix4();

const HOLD_DECOR = new Set(['driftwood', 'plants']);

export function lifeAnchors(tank) {
  const out = { rocks: [], holds: [], coral: [], solids: [], sig: '' };
  const contents = tank.getObjectByName('contents');
  if (!contents) return out;
  tank.updateMatrixWorld(true);
  inv.copy(tank.matrixWorld).invert();
  for (const item of contents.children) {
    if (item.userData.ghost) continue;
    const def = getDef(item.userData.defId);
    if (!def) continue;
    const solid = solidKind(def);
    if (solid === 'wood') woodBalls(item, out.solids);
    else if (solid) {
      box.setFromObject(item).applyMatrix4(inv);
      if (!box.isEmpty()) out.solids.push({ t: 'dome', x: (box.min.x + box.max.x) / 2, z: (box.min.z + box.max.z) / 2, rx: (box.max.x - box.min.x) / 2, rz: (box.max.z - box.min.z) / 2, y0: box.min.y, h: box.max.y - box.min.y });
    }
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
