import { behaviorOf, groundOf } from './behaviorData.js';
import { TAU, clamp } from './lifeKit.js';
import { initCruise, cruise } from './lifeCruise.js';
import { homeOf, pickWander, initWander, wander, restSpot, initRest, rest, initWalk, walk } from './lifeRoam.js';
import { den, initCrevice, crevice, initBurrow, burrow, holdPoint, initCling, cling } from './lifeHide.js';
import { initPulse, pulse, initVertical, vertical } from './lifeDrift.js';
/**
 * 水槽内の生き物の動きの入口。行動の種類（behaviorData.js の mode）ごとに状態を持って毎フレーム進める。
 * 座標は水槽ローカル。向きは yaw（水平の向き）・pitch（頭の上下）・roll（体軸まわりの傾き）。
 *   lifeCruise.js 周回（外洋性・群れ・呼吸や宙返り）  lifeRoam.js 泳いでは止まる・底で休む・海底を歩く
 *   lifeHide.js 岩穴・砂の巣穴・海藻に掴まる          lifeDrift.js 拍動で漂う・縦の姿勢
 */

const MODES = {
  cruise: [initCruise, cruise],
  wander: [initWander, wander],
  rest: [initRest, rest],
  crevice: [initCrevice, crevice],
  burrow: [initBurrow, burrow],
  cling: [initCling, cling],
  pulse: [initPulse, pulse],
  vertical: [initVertical, vertical],
  walk: [initWalk, walk],
};

/**
 * 1匹の動きを作る。L は水槽内での体長（m）、sh は同じ水槽の同じ種で共有する状態（群れ・コロニー）、
 * index はその種の中での番号。ctx = { box, anchors, current }
 */
export function createMotion(c, L, ctx, r, sh, index) {
  const beh = behaviorOf(c);
  const { box } = ctx;
  const m = {
    c,
    beh,
    L,
    r,
    mode: MODES[beh.mode] ? beh.mode : 'wander',
    cs: Math.max(0.002, beh.cruise * L),
    x: 0,
    y: 0,
    z: 0,
    yaw: r() * TAU,
    pitch: 0,
    roll: 0,
    v: 0,
    clock: r() * 10,
    tempo: 0.85 + r() * 0.3,
    tail: 1,
    ph: r() * TAU,
    visible: true,
    sprintT: beh.every ? beh.every * r() : Infinity,
    kickP: r(),
    kickPeriod: clamp(0.4 * (c.len / 0.05) ** 0.4, 0.35, 2.5),
    turn: clamp(1.2 / Math.sqrt(Math.max(c.len, 0.03) / 0.2), 0.5, 4),
    margin: Math.min(L / 2, Math.min(box.hx, box.hz) * 0.9),
    ground: groundOf(c, beh) * L,
  };
  MODES[m.mode][0](m, ctx, sh, index);
  return m;
}

/** 1フレーム進め、モデルに反映する */
export function stepMotion(fish, m, ctx, dt, time) {
  MODES[m.mode][1](m, ctx, dt, time);
  fish.position.set(m.x, m.y, m.z);
  fish.rotation.set(m.roll, m.yaw, m.pitch, 'YZX');
  fish.visible = m.visible;
  m.clock += dt * m.tempo * m.tail;
  fish.userData.uni.uTime.value = m.clock;
}

/** 岩や海藻の配置が変わったとき、居場所に依存する個体を新しい場所へ移す */
export function reanchor(m, ctx) {
  if (m.mode === 'crevice') {
    m.den = den(m, ctx);
    if (m.st === 'den') m.st = 'back';
  } else if (m.mode === 'cling') {
    m.H2 = holdPoint(m, ctx);
    m.st = 'swim';
  } else if (m.mode === 'rest' && (m.beh.rock || m.beh.top)) {
    m.spot = restSpot(m, ctx);
    m.st = 'move';
  } else if (m.mode === 'wander' && (m.beh.coral || m.beh.rock)) {
    const L = m.lead ?? m;
    L.home = homeOf(L, ctx);
    pickWander(L, ctx);
  }
}
