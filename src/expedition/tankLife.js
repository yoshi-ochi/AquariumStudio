import * as THREE from 'three';
import { disposeObject } from '../tanks/tankBuilder.js';
import { mulberry32 } from '../tanks/random.js';
import { getCreature } from './creatureData.js';
import { buildCreature } from './creatureBuilder.js';
import { BENTHIC_FORMS, STATIONARY_FORMS } from './creatureSoft.js';
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
  return { cx: I.swim?.cx ?? 0, hx: (I.swim?.halfW ?? I.halfW) * k, hz: I.halfD * k, y0, y1: Math.max(y0 + 0.01, I.waterTop - 0.03) };
}

/** tank.userData.creatures に合わせてモデルを作り直す */
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
  let index = 0;
  const entries = Object.entries(tank.userData.creatures ?? {}).filter(([id]) => getCreature(id));
  const total = entries.reduce((s, [, n]) => s + n, 0);
  for (const [id, n] of entries) {
    const c = getCreature(id);
    const shown = total <= MAX_MODELS ? n : Math.max(1, Math.round((n / total) * MAX_MODELS));
    for (let i = 0; i < shown; i++) {
      const fish = buildCreature(c);
      // 水槽の水紋（ON/OFF と、この水槽の真上をくり抜いた模様）を使う
      if (tank.userData.clip) for (const k of ['uCauOn', 'uCauTex', 'uCauOrigin', 'uCauSize', 'uCauTop']) fish.userData.uni[k] = tank.userData.clip[k];
      const rand = mulberry32(tank.userData.uid * 131 + index++ * 977);
      const scale = Math.min(1, room / c.len) * sizeOf(speciesPieces(id)); // 大きな生物は水槽に収め、成長（ピース）に応じて育つ
      fish.scale.setScalar(scale);
      const margin = (c.len * scale) / 2;
      const ax = Math.max(0.01, (box.hx - margin) * (0.45 + rand() * 0.55));
      const az = Math.max(0.01, (box.hz - margin) * (0.45 + rand() * 0.55));
      const drifting = c.form === 'jelly' || c.form === 'dumbo' || c.form === 'clione';
      const benthic = BENTHIC_FORMS.has(c.form);
      const fixed = STATIONARY_FORMS.has(c.form);
      const velocity = (0.05 + rand() * 0.07) * (fixed ? 0 : benthic ? 0.15 : drifting ? 0.35 : 1); // m/秒
      fish.userData.swim = {
        ax,
        az,
        speed: velocity / Math.max(ax, az),
        dir: rand() < 0.5 ? 1 : -1,
        p1: rand() * 6.28,
        p2: rand() * 6.28,
        p3: rand() * 6.28,
        cy: benthic ? box.y0 : box.y0 + (box.y1 - box.y0) * (0.3 + rand() * 0.4),
        ay: benthic || fixed ? 0 : (box.y1 - box.y0) * 0.2,
        cx: box.cx,
        tempo: 0.8 + rand() * 0.5,
      };
      fish.userData.still = drifting || fixed; // 向きを変えず漂う
      group.add(fish);
    }
  }
}

function pathAt(s, t, out) {
  const a = t * s.speed * s.dir;
  out.x = s.cx + Math.cos(a + s.p1) * s.ax;
  out.z = Math.sin(a + s.p1 + Math.sin(a * 0.5 + s.p2) * 0.4) * s.az;
  out.y = s.cy + Math.sin(a * 1.7 + s.p3) * s.ay;
  return out;
}

const cur = { x: 0, y: 0, z: 0 };
const next = { x: 0, y: 0, z: 0 };

export function updateLife(tank, time) {
  const group = tank.getObjectByName(LIFE);
  if (!group) return;
  for (const fish of group.children) {
    const s = fish.userData.swim;
    const u = fish.userData;
    pathAt(s, time, cur);
    pathAt(s, time + 0.08, next);
    fish.position.set(cur.x, cur.y, cur.z);
    u.uni.uTime.value = time * s.tempo + s.p2;
    if (fish.userData.still) continue;
    fish.rotation.y = Math.atan2(-(next.z - cur.z), next.x - cur.x);
  }
}
