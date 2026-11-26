import * as THREE from 'three';
import { disposeObject } from '../tanks/tankBuilder.js';
import { mulberry32 } from '../tanks/random.js';
import { getCreature } from './creatureData.js';
import { buildCreature } from './creatureBuilder.js';
import { createMotion, stepMotion, reanchor } from './lifeMotion.js';
import { lifeAnchors, anchorSig } from './lifeAnchors.js';
import { speciesPieces, sizeOf, appealOf } from './growth.js';

/** 水槽内の展示生物：収容枠の計算、モデルの同期、遊泳アニメーション */
const LIFE = 'life';

/** 水量（m³）。描いた水槽は def.volume を持つ */
export function tankVolume(def) {
  if (def.volume) return def.volume;
  const { w, h, d } = def.size;
  return w * h * d * (def.shape === 'cylinder' ? Math.PI / 4 : 1);
}

/** 収容枠の目安。30cmキューブで10、吹き抜け大水槽で約3000。超過もできるが幸福度が下がる */
export function tankCapacity(def) {
  return Math.max(10, Math.round(10 * (tankVolume(def) / 0.027) ** 0.6));
}

const sumBy = (tank, key) => Object.entries(tank.userData.creatures ?? {}).reduce((s, [id, n]) => s + (getCreature(id)?.[key] ?? 0) * n, 0);
export const usedCapacity = (tank) => sumBy(tank, 'slots');
/** 同じ種を増やすほど1匹あたりの魅力は少しずつ下がる（群れは見栄えするが青天井にはしない） */
/** 育った魚種ほど集客力が上がる（growth.js） */
export const lifeAppeal = (tank) => Object.entries(tank.userData.creatures ?? {}).reduce((s, [id, n]) => s + (getCreature(id)?.appeal ?? 0) * n ** 0.75 * appealOf(speciesPieces(id)), 0);
/** 混み具合（1 を超えると過密） */
export const crowding = (tank, def) => usedCapacity(tank) / tankCapacity(def);

/** 描画する個体数の上限（それ以上は数だけ持つ）。群れは多めに見せる */
const MAX_MODELS = 120;

/** 泳げる範囲（水槽ローカル）。トンネル水槽はアーチより上、哺乳類用は水域のみ */
function swimBox(I) {
  const k = I.shape === 'cylinder' ? 0.68 : 0.86;
  const y0 = I.tunnel ? I.tunnel.straightH + I.tunnel.r + 0.08 : I.floorY + 0.03;
  return { cx: I.swim?.cx ?? 0, hx: (I.swim?.halfW ?? I.halfW) * k, hz: I.halfD * k, y0, y1: Math.max(y0 + 0.01, I.waterTop - 0.03), round: I.shape === 'cylinder' };
}

/** tank.userData.creatures に合わせてモデルを作り直す。動きは種ごとの行動（lifeMotion.js）で決める */
export function syncLife(tank) {
  const old = tank.getObjectByName(LIFE);
  if (old) {
    tank.remove(old);
    disposeObject(old);
  }
  const group = new THREE.Group();
  group.name = LIFE;
  tank.add(group);
  const box = swimBox(tank.userData.interior);
  const room = Math.min(box.hx, box.hz) * 1.4; // 大きな生物は水槽に収まる大きさに縮める
  // 水の流れの向き（チンアナゴなどが一斉に向く）は水槽ごとに決まっている
  const ctx = { box, anchors: lifeAnchors(tank), sig: anchorSig(tank), current: mulberry32(tank.userData.uid * 31 + 7)() * Math.PI * 2, checked: 0, last: null };
  group.userData.ctx = ctx;
  let index = 0;
  const entries = Object.entries(tank.userData.creatures ?? {}).filter(([id]) => getCreature(id));
  const total = entries.reduce((s, [, n]) => s + n, 0);
  for (const [id, n] of entries) {
    const c = getCreature(id);
    const shown = total <= MAX_MODELS ? n : Math.max(1, Math.round((n / total) * MAX_MODELS));
    const shared = { n: shown }; // 同じ種の群れ・コロニーで共有する状態
    for (let i = 0; i < shown; i++) {
      const fish = buildCreature(c);
      // 水槽の水紋（ON/OFF と、この水槽の真上をくり抜いた模様）を使う
      if (tank.userData.clip) for (const k of ['uCauOn', 'uCauTex', 'uCauOrigin', 'uCauSize', 'uCauTop', 'uCauVanish']) fish.userData.uni[k] = tank.userData.clip[k];
      const rand = mulberry32(tank.userData.uid * 131 + index++ * 977);
      const scale = Math.min(1, room / c.len) * sizeOf(speciesPieces(id)); // 大きな生物は水槽に収め、成長（ピース）に応じて育つ
      fish.scale.setScalar(scale);
      fish.userData.motion = createMotion(c, c.len * scale, ctx, rand, shared, i);
      group.add(fish);
    }
  }
}

export function updateLife(tank, time) {
  const group = tank.getObjectByName(LIFE);
  if (!group) return;
  const ctx = group.userData.ctx;
  const dt = ctx.last === null ? 0 : Math.min(0.1, Math.max(0, time - ctx.last));
  ctx.last = time;
  // 岩・海藻の配置が変わったら、巣や掴まる場所を選び直す（1秒ごとに確認）
  if (time - ctx.checked > 1) {
    ctx.checked = time;
    const sig = anchorSig(tank);
    if (sig !== ctx.sig) {
      ctx.sig = sig;
      ctx.anchors = lifeAnchors(tank);
      for (const fish of group.children) reanchor(fish.userData.motion, ctx);
    }
  }
  for (const fish of group.children) stepMotion(fish, fish.userData.motion, ctx, dt, time);
  // 発光する生き物：水槽のライトが消えている・暗いほど強く光る（光量は 0.2〜4.0）
  const light = tank.userData.look?.light;
  const dark = !light?.on ? 1 : Math.min(1, Math.max(0.12, (4.2 - light.intensity) / 4));
  for (const fish of group.children) {
    if (!fish.userData.glows) continue;
    const ph = fish.userData.motion?.phase ?? fish.id;
    fish.userData.uni.uGlow.value = dark * (0.78 + 0.22 * Math.sin(time * 1.6 + ph));
  }
}
