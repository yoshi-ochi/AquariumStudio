import { clamp, ease, span, randXZ, keepInside, steer } from './lifeKit.js';
import { pickWander, initPos } from './lifeRoam.js';

// ---- 拍動で浮き沈み（クラゲ・クリオネ・メンダコ） ---------------------------

export function initPulse(m, ctx) {
  initPos(m, ctx);
  m.pp = m.r();
  m.Tp = clamp(0.9 + m.c.len * 3, 0.8, 3);
  m.dirY = m.r() < 0.5 ? 1 : -1;
  const p = randXZ(ctx, m);
  Object.assign(m, { tx: p.x, tz: p.z, st: m.beh.sit ? 'sit' : 'drift', t: span(m.r, [5, 40]) });
  if (m.beh.sit) m.y = ctx.box.y0 + m.ground;
}

export function pulse(m, ctx, dt) {
  const { box } = ctx;
  const L = m.L;
  m.pp += dt / m.Tp;
  const q = m.pp % 1;
  m.tail = 1;
  if (m.st === 'sit') {
    // メンダコ：ふだんは海底で傘を広げ、ときどき耳のようなひれで浮き上がる
    m.y = ease(m.y, box.y0 + m.ground, 1, dt);
    m.t -= dt;
    m.tail = 0.2;
    if (m.t <= 0) {
      const p = randXZ(ctx, m);
      Object.assign(m, { st: 'rise', t: span(m.r, [3, 6]), tx: p.x, tz: p.z });
    }
  } else if (m.st === 'rise' || m.st === 'sink') {
    const h = Math.hypot(m.tx - m.x, m.tz - m.z);
    const s = Math.min(h, m.cs * dt);
    if (h > 1e-5) (m.x += ((m.tx - m.x) / h) * s), (m.z += ((m.tz - m.z) / h) * s);
    if (m.st === 'rise') {
      m.y += L * 0.3 * dt;
      m.t -= dt;
      if (m.t <= 0) m.st = 'sink';
    } else {
      m.y -= L * 0.08 * dt; // 傘を開いてパラシュートのようにゆっくり沈む
      m.tail = 0.1;
      if (m.y <= box.y0 + m.ground) (m.st = 'sit'), (m.t = span(m.r, [20, 60]));
    }
  } else {
    // 傘を縮めたときに上がり、開く間に少し沈む。層の上端で下り、下端で上りに切り替える
    const lo = box.y0 + (box.y1 - box.y0) * m.beh.layer[0];
    const hi = box.y0 + (box.y1 - box.y0) * m.beh.layer[1];
    if (m.y > hi) m.dirY = -1;
    if (m.y < lo) m.dirY = 1;
    m.y += (q < 0.3 ? 0.5 * L * (m.dirY > 0 ? 1 : 0.45) : -0.12 * L) * dt;
    const h = Math.hypot(m.tx - m.x, m.tz - m.z);
    if (h < L * 0.3) {
      const p = randXZ(ctx, m);
      Object.assign(m, { tx: p.x, tz: p.z });
    } else {
      const s = Math.min(h, m.cs * dt);
      m.x += ((m.tx - m.x) / h) * s;
      m.z += ((m.tz - m.z) / h) * s;
    }
  }
  m.yaw += 0.05 * dt;
  m.pitch = 0;
  m.roll = 0;
  keepInside(m, ctx);
  m.y = clamp(m.y, box.y0 + (m.beh.sit ? m.ground : L * 0.1), box.y1 - L * 0.1);
}

// ---- 縦の姿勢で静止（リュウグウノツカイ・タチウオ・ヘラヤガラ） -------------

export function initVertical(m, ctx) {
  const { box } = ctx;
  const maxP = Math.asin(clamp(((box.y1 - box.y0) * 0.85) / m.L, 0, 1));
  const want = m.beh.pitch ?? 1.4;
  m.pt = maxP < 0.35 ? 0 : Math.sign(want) * Math.min(Math.abs(want), maxP); // 浅い水槽では縦になれない
  initPos(m, ctx);
  const p = randXZ(ctx, m);
  Object.assign(m, { pitch: m.pt, tx: p.x, tz: p.z, st: 'hang', t: span(m.r, [10, 60]) });
}

export function vertical(m, ctx, dt, time) {
  const { box } = ctx;
  const half = (Math.abs(Math.sin(m.pitch)) * m.L) / 2 + m.L * 0.05;
  if (m.st === 'hang') {
    m.t -= dt;
    m.pitch = ease(m.pitch, m.pt, 0.8, dt);
    const h = Math.hypot(m.tx - m.x, m.tz - m.z);
    if (h < m.L * 0.2) {
      const p = randXZ(ctx, m);
      Object.assign(m, { tx: p.x, tz: p.z });
    } else {
      const s = Math.min(h, m.cs * 0.5 * dt);
      m.x += ((m.tx - m.x) / h) * s;
      m.z += ((m.tz - m.z) / h) * s;
    }
    m.y += Math.sin(time * 0.2 + m.ph) * m.L * 0.02 * dt;
    m.yaw += 0.04 * dt;
    m.v = 0;
    m.tail = 0.6;
    if (m.t <= 0) {
      if (m.r() < 0.4) {
        m.st = 'swim';
        m.t = span(m.r, [8, 20]);
        pickWander(m, ctx);
        m.st = 'swim';
      } else m.t = span(m.r, [20, 60]);
    }
  } else {
    m.t -= dt;
    if (steer(m, ctx, dt, m.tx, m.ty, m.tz, m.cs * 2.5)) {
      pickWander(m, ctx);
      m.st = 'swim';
    }
    m.tail = Math.max(m.tail, 0.6);
    if (m.t <= 0) {
      m.st = 'hang';
      m.t = span(m.r, [20, 60]);
    }
  }
  m.roll = 0;
  keepInside(m, ctx);
  m.y = clamp(m.y, box.y0 + half, Math.max(box.y0 + half, box.y1 - half));
}
