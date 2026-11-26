import { TAU, clamp, ease, turnTo, span, clampXZ, randXZ, layerY, bottomY, keepInside, sprintFactor, kickFactor, steer, solidPush } from './lifeKit.js';

// ---- 目標へ泳いでは止まる（サンゴ礁・沿岸の魚） ---------------------------

export function homeOf(m, ctx) {
  const { rocks, coral } = ctx.anchors;
  const list = m.beh.coral ? (coral.length ? coral : rocks) : m.beh.rock ? rocks : [];
  if (!list.length || m.beh.home >= 1) return null;
  const a = list[Math.floor(m.r() * list.length)];
  return { x: a.x, z: a.z, top: a.y0 + a.h };
}

export function pickWander(m, ctx) {
  const { box } = ctx;
  const radius = m.home ? Math.max(m.L * 3, m.beh.home * Math.max(box.hx, box.hz)) : 0;
  let p = randXZ(ctx, m, m.home, radius);
  m.peck = (m.beh.events ?? []).includes('peck') && m.r() < 0.3;
  let y = layerY(ctx, m);
  if (m.home) y = clamp(m.home.top + m.L * span(m.r, [-0.5, 2]), box.y0 + m.L * 0.3, box.y1 - m.L * 0.2);
  if (m.peck) y = box.y0 + m.L * 0.35;
  // 目的地が岩・硬いサンゴの中なら選び直す（横へよける当たり判定と合わせ、岩を突き抜けようとしない）
  const solids = ctx.anchors?.solids;
  for (let i = 0; i < 8 && solids?.length && solidPush(solids, p.x, y, p.z, m.L * 0.3); i++) p = randXZ(ctx, m, m.home, radius);
  m.tx = p.x;
  m.ty = y;
  m.tz = p.z;
  m.rev = !!m.beh.back && m.r() < 0.35;
  m.st = 'go';
}

export function initWander(m, ctx, sh) {
  m.home = homeOf(m, ctx);
  if (m.beh.school && sh) {
    if (!sh.lead) {
      // 群れの先導役（描画しない）。群れの全員がこれを追う
      sh.lead = { ...m, home: m.home, last: -1 };
      initPos(sh.lead, ctx);
      pickWander(sh.lead, ctx);
    }
    m.lead = sh.lead;
    const sp = m.L * (m.beh.tight ? 0.4 : 0.8) * Math.cbrt(sh.n);
    m.off = [(m.r() * 2 - 1) * sp, (m.r() * 2 - 1) * sp * 0.5, (m.r() * 2 - 1) * sp];
    m.x = sh.lead.x + m.off[0];
    m.y = sh.lead.y + m.off[1];
    m.z = sh.lead.z + m.off[2];
  } else {
    initPos(m, ctx);
    pickWander(m, ctx);
  }
}

export function initPos(m, ctx) {
  const radius = m.home ? Math.max(m.L * 3, m.beh.home * Math.max(ctx.box.hx, ctx.box.hz)) : 0;
  const p = randXZ(ctx, m, m.home, radius);
  m.x = p.x;
  m.z = p.z;
  m.y = layerY(ctx, m);
}

function wanderSelf(m, ctx, dt, time) {
  const f = sprintFactor(m, m.beh, dt, m.r);
  const k = kickFactor(m, m.beh, dt, m.kickPeriod);
  if (m.darted) {
    m.darted = false;
    pickWander(m, ctx);
  }
  if (m.st === 'pause') {
    m.t -= dt;
    m.v = ease(m.v, 0, 2, dt);
    m.pitch = ease(m.pitch, m.peck ? -0.7 : m.head ? -1.4 : m.beh.tilt ?? 0, 1.5, dt);
    m.yaw += Math.sin(time * 0.3 + m.ph) * 0.15 * dt;
    m.y += Math.sin(time * 0.8 + m.ph) * m.L * 0.03 * dt;
    m.tail = 0.3;
    if (m.t <= 0) pickWander(m, ctx);
  } else if (steer(m, ctx, dt, m.tx, m.ty, m.tz, m.cs * f * k, { rev: m.rev })) {
    if (m.peck || m.r() < (m.beh.pause ?? 0.3)) {
      m.st = 'pause';
      m.t = span(m.r, [1.5, 6]);
      m.head = (m.beh.events ?? []).includes('headstand') && m.r() < 0.4; // シーラカンスの逆立ち
    } else pickWander(m, ctx);
  }
  m.roll = 0;
  keepInside(m, ctx);
}

export function wander(m, ctx, dt, time) {
  if (!m.lead) return wanderSelf(m, ctx, dt, time);
  const L = m.lead;
  if (L.last !== time) {
    L.last = time;
    wanderSelf(L, ctx, dt, time);
  }
  const k = 1 + 0.2 * Math.sin(time * 0.4 + m.ph);
  const tx = L.x + m.off[0] * k;
  const ty = L.y + m.off[1] * k;
  const tz = L.z + m.off[2] * k;
  const d = Math.hypot(tx - m.x, ty - m.y, tz - m.z);
  if (L.st === 'pause' && d < m.L * 1.2) {
    m.v = ease(m.v, 0, 2, dt);
    m.yaw = turnTo(m.yaw, L.yaw, dt);
    m.pitch = ease(m.pitch, L.pitch, 2, dt);
    m.tail = 0.3;
  } else steer(m, ctx, dt, tx, ty, tz, L.v + clamp(d / m.L - 0.3, 0, 3) * m.cs, { rev: L.rev });
  m.roll = 0;
  keepInside(m, ctx);
}

// ---- 底で休む・待ち伏せ ---------------------------------------------------

export function restSpot(m, ctx) {
  const { box, anchors } = ctx;
  const rocks = anchors.rocks;
  if (m.beh.top && rocks.length) {
    const a = rocks[Math.floor(m.r() * rocks.length)];
    return { x: a.x + (m.r() - 0.5) * a.w * 0.3, z: a.z + (m.r() - 0.5) * a.d * 0.3, y: a.y0 + a.h + m.ground * 0.6 };
  }
  let p;
  if (m.beh.rock && rocks.length) {
    const a = rocks[Math.floor(m.r() * rocks.length)];
    const ang = m.r() * TAU;
    p = { x: a.x + Math.cos(ang) * (a.r + m.L * 0.35), z: a.z + Math.sin(ang) * (a.r + m.L * 0.35) };
    clampXZ(box, p, m.margin);
  } else p = randXZ(ctx, m);
  p.y = bottomY(ctx, m) + (m.beh.float ?? 0) * m.L;
  return p;
}

export function initRest(m, ctx) {
  m.spot = restSpot(m, ctx);
  Object.assign(m, { x: m.spot.x, y: m.spot.y, z: m.spot.z, st: 'rest', t: span(m.r, m.beh.rest ?? [20, 60]) * m.r() });
}

export function rest(m, ctx, dt, time) {
  sprintFactor(m, m.beh, dt, m.r);
  if (m.st === 'rest') {
    m.t -= dt;
    m.v = ease(m.v, 0, 3, dt);
    m.pitch = ease(m.pitch, 0, 2, dt);
    m.yaw += Math.sin(time * 0.05 + m.ph) * 0.03 * dt;
    m.x = ease(m.x, m.spot.x, 1, dt);
    m.z = ease(m.z, m.spot.z, 1, dt);
    m.y = ease(m.y, m.spot.y, 1.5, dt); // 砂に沈み込むように着底する
    m.tail = 0.18;
    if (m.darted) {
      // 待ち伏せからの一瞬の突進
      m.darted = false;
      m.st = 'lunge';
      m.t = 0.35;
    } else if (m.t <= 0) {
      m.st = 'move';
      m.spot = restSpot(m, ctx);
    }
  } else if (m.st === 'lunge') {
    m.t -= dt;
    const s = m.cs * m.beh.burst * 1.5 * dt;
    m.x += Math.cos(m.yaw) * s;
    m.z -= Math.sin(m.yaw) * s;
    m.tail = 3;
    if (m.t <= 0) {
      m.st = 'rest';
      m.spot = { x: m.x, y: m.spot.y, z: m.z };
      m.t = span(m.r, m.beh.rest ?? [20, 60]);
    }
  } else {
    kickFactor(m, m.beh, dt, m.kickPeriod);
    if (steer(m, ctx, dt, m.spot.x, m.spot.y + m.L * 0.12, m.spot.z, m.cs * (m.kickTail > 1 ? 1.3 : 0.8))) {
      m.st = 'rest';
      m.t = span(m.r, m.beh.rest ?? [20, 60]);
    }
  }
  m.roll = 0;
  keepInside(m, ctx);
}

// ---- 海底を歩く（カニ・グソクムシ・ホウボウ） -------------------------------

export function pickWalk(m, ctx) {
  const p = randXZ(ctx, m, { x: m.x, z: m.z }, m.L * 4);
  Object.assign(m, { tx: p.x, tz: p.z, st: 'go' });
}

export function initWalk(m, ctx) {
  const p = randXZ(ctx, m);
  Object.assign(m, { x: p.x, z: p.z, y: bottomY(ctx, m) });
  pickWalk(m, ctx);
}

export function walk(m, ctx, dt) {
  const y = bottomY(ctx, m);
  if (m.st === 'pause') {
    m.t -= dt;
    m.v = ease(m.v, 0, 3, dt);
    m.tail = 0.2;
    if (m.t <= 0) pickWalk(m, ctx);
  } else if (steer(m, ctx, dt, m.tx, y, m.tz, m.cs, { side: !!m.beh.side, flat: true, turn: 1.5 })) {
    if (m.r() < 0.6) (m.st = 'pause'), (m.t = span(m.r, [2, 8]));
    else pickWalk(m, ctx);
  }
  m.y = y;
  m.pitch = 0;
  m.roll = 0;
  keepInside(m, ctx);
}
