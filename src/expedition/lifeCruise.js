import { TAU, clamp, smooth, bell, env, span, layerY, keepInside, sprintFactor, kickFactor, tailOf } from './lifeKit.js';

// ---- 周回（外洋性・群れ） ------------------------------------------------

function newPath(m, ctx) {
  const { box } = ctx;
  const r = m.r;
  const ax = Math.max(0.01, (box.hx - m.margin) * (0.55 + r() * 0.45));
  const az = Math.max(0.01, (box.hz - m.margin) * (0.55 + r() * 0.45));
  const cy = layerY(ctx, m);
  const room = Math.min(cy - box.y0, box.y1 - cy);
  return { ax, az, R: (ax + az) / 2, p1: r() * TAU, p2: r() * TAU, p3: r() * TAU, dir: r() < 0.5 ? 1 : -1, cy, ay: Math.max(0, Math.min((box.y1 - box.y0) * 0.12, room - m.L * 0.1)), phi: 0, last: -1, v: 0, sprintT: m.beh.every * r() };
}

function pathPos(P, phi, cx, out) {
  out.x = cx + Math.cos(phi + P.p1) * P.ax;
  out.z = Math.sin(phi + P.p1 + Math.sin(phi * 0.5 + P.p2) * 0.4) * P.az;
  out.y = P.cy + Math.sin(phi * 1.7 + P.p3) * P.ay;
  return out;
}

const EVENTS = {
  breathe: [[4, 7], [25, 60]],
  spin: [[4, 6], [30, 70]],
  bask: [[20, 40], [50, 120]],
  loop: [[4, 5], [30, 70]],
  stand: [[12, 25], [40, 90]],
  sleep: [[20, 45], [50, 120]],
  float: [[25, 50], [8, 20]],
};

const A = { x: 0, y: 0, z: 0 };
const N = { x: 0, y: 0, z: 0 };

export function initCruise(m, ctx, sh) {
  m.path = m.beh.school && sh ? (sh.path ??= newPath(m, ctx)) : newPath(m, ctx);
  const spread = m.beh.school && sh ? m.L * (m.beh.tight ? 0.45 : 0.9) * Math.cbrt(sh.n) : 0;
  m.off = [(m.r() * 2 - 1) * spread, (m.r() * 2 - 1) * spread * 0.4, (m.r() * 2 - 1) * spread];
  m.evs = m.beh.school ? [] : (m.beh.events ?? []).filter((e) => EVENTS[e]);
  m.evT = span(m.r, [8, 30]);
  m.ev = null;
}

/** 周回中の特別な行動。速さの倍率と、姿勢・高さの上書きを返す */
function cruiseEvent(m, ctx, dt) {
  if (!m.evs.length) return null;
  if (!m.ev) {
    m.evT -= dt;
    if (m.evT > 0) return null;
    const type = m.evs[Math.floor(m.r() * m.evs.length)];
    m.ev = { type, t: 0, dur: span(m.r, EVENTS[type][0]) };
  }
  const ev = m.ev;
  ev.t += dt;
  const p = ev.t / ev.dur;
  if (p >= 1) {
    m.evT = span(m.r, EVENTS[ev.type][1]);
    m.ev = null;
    return null;
  }
  const { box } = ctx;
  const e = env(p);
  const maxP = Math.asin(clamp(((box.y1 - box.y0) * 0.8) / m.L, 0, 1));
  switch (ev.type) {
    case 'breathe':
    case 'spin': {
      const up = smooth(p / 0.35) * smooth((1 - p) / 0.35);
      return { y: box.y1 - m.L * 0.08, w: up, speed: 1, pitch: p < 0.5 ? 0.35 * bell(p * 2) : -0.35 * bell(p * 2 - 1), roll: ev.type === 'spin' ? TAU * 2 * smooth((p - 0.35) / 0.3) : 0 };
    }
    case 'bask':
      return { y: box.y1 - m.L * 0.2, w: e, speed: 1 - 0.85 * e, roll: 1.35 * e };
    case 'float':
      return { y: box.y1 - m.L * 0.05, w: e, speed: 1 - 0.85 * e, roll: Math.PI * e };
    case 'sleep':
      return { y: box.y0 + m.ground, w: e, speed: 1 - 0.95 * e };
    case 'stand':
      return { y: box.y1 - (m.L / 2) * Math.sin(Math.min(1.2, maxP)), w: e, speed: 1 - 0.9 * e, pitchSet: Math.min(1.2, maxP) * e };
    case 'loop':
      return { loop: TAU * smooth((p - 0.1) / 0.8), speed: 1 - 0.7 * e };
    default:
      return null;
  }
}

function stepPath(P, m, dt, time, speedMul) {
  if (P.last === time) return;
  P.last = time;
  const f = sprintFactor(P, m.beh, dt, m.r) * kickFactor(P, m.beh, dt, m.kickPeriod);
  const lap = TAU * P.R;
  const base = Math.min(m.cs * (1 + 0.1 * Math.sin(time * 0.23 + P.p2)), lap / 4); // 小さな水槽でも1周4秒以上
  P.v = Math.min(base * f, lap / 1.5) * speedMul;
  P.phi += ((dt * P.v) / P.R) * P.dir;
}

export function cruise(m, ctx, dt, time) {
  const P = m.path;
  const ev = cruiseEvent(m, ctx, dt);
  let speedMul = ev?.speed ?? 1;
  if (m.beh.hover) speedMul *= 0.55 + 0.45 * Math.sin(time * 0.07 + m.ph);
  stepPath(P, m, dt, time, speedMul);
  pathPos(P, P.phi, ctx.box.cx, A);
  pathPos(P, P.phi + 0.02 * P.dir, ctx.box.cx, N);
  const hx = N.x - A.x;
  const hz = N.z - A.z;
  const hl = Math.hypot(hx, hz) || 1;
  // 群れの中の位置（進行方向に対する前後・左右・上下）。少し伸び縮みさせる
  const k = 1 + 0.15 * Math.sin(time * 0.5 + m.ph);
  const [f, u, s] = m.off;
  m.x = A.x + ((hx / hl) * f - (hz / hl) * s) * k;
  m.z = A.z + ((hz / hl) * f + (hx / hl) * s) * k;
  let y = A.y + u * k;
  m.yaw = Math.atan2(-hz, hx);
  let pitch = clamp(Math.atan2(N.y - A.y, hl), -0.5, 0.5);
  let roll = 0;
  if (ev) {
    if (ev.y !== undefined) y += (ev.y - y) * ev.w;
    if (ev.pitch) pitch += ev.pitch;
    if (ev.pitchSet !== undefined) pitch = Math.max(pitch, ev.pitchSet);
    if (ev.roll) roll = ev.roll;
    if (ev.loop) {
      // 後方宙返り：頭を上げながら縦の円を描く
      const R = m.L * 0.45;
      pitch = ev.loop;
      m.x += (hx / hl) * Math.sin(ev.loop) * R;
      m.z += (hz / hl) * Math.sin(ev.loop) * R;
      y += (1 - Math.cos(ev.loop)) * R;
    }
  }
  m.y = y;
  m.pitch = pitch;
  m.roll = roll;
  m.v = P.v;
  m.kickTail = P.kickTail;
  m.tail = tailOf(m, P.v);
  keepInside(m, ctx);
}
