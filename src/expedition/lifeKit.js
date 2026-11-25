/**
 * 水槽内の生き物の動き（lifeMotion.js）の共通部品：角度・緩急・水槽の範囲・目標へ泳ぐ。
 */
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
export const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
export const turnTo = (a, b, max) => a + clamp(wrap(b - a), -max, max);
export const smooth = (p) => {
  const q = clamp(p, 0, 1);
  return q * q * (3 - 2 * q);
};
export const bell = (p) => (p <= 0 || p >= 1 ? 0 : Math.sin(Math.PI * p));
/** 出入りをなめらかにした 0→1→0 */
export const env = (p, k = 0.2) => smooth(p / k) * smooth((1 - p) / k);
export const span = (r, [a, b]) => a + r() * (b - a);

// ---- 水槽の範囲 ----------------------------------------------------------

export function insideXZ(box, x, z, margin) {
  const u = (x - box.cx) / Math.max(0.005, box.hx - margin);
  const v = z / Math.max(0.005, box.hz - margin);
  return box.round ? u * u + v * v <= 1 : Math.abs(u) <= 1 && Math.abs(v) <= 1;
}

export function clampXZ(box, p, margin) {
  const hx = Math.max(0.005, box.hx - margin);
  const hz = Math.max(0.005, box.hz - margin);
  let u = (p.x - box.cx) / hx;
  let v = p.z / hz;
  if (box.round) {
    const d = Math.hypot(u, v);
    if (d > 1) (u /= d), (v /= d);
  } else (u = clamp(u, -1, 1)), (v = clamp(v, -1, 1));
  p.x = box.cx + u * hx;
  p.z = v * hz;
}

/** 水平のランダムな位置。center があればその周り radius 以内 */
export function randXZ(ctx, m, center, radius) {
  const { box } = ctx;
  const r = m.r;
  for (let i = 0; i < 12; i++) {
    let x;
    let z;
    if (center) {
      const a = r() * TAU;
      const d = Math.sqrt(r()) * radius;
      x = center.x + Math.cos(a) * d;
      z = center.z + Math.sin(a) * d;
    } else {
      x = box.cx + (r() * 2 - 1) * (box.hx - m.margin);
      z = (r() * 2 - 1) * (box.hz - m.margin);
    }
    if (insideXZ(box, x, z, m.margin)) return { x, z };
  }
  const p = { x: center?.x ?? box.cx, z: center?.z ?? 0 };
  clampXZ(box, p, m.margin);
  return p;
}

/** 泳ぐ高さ（layer は水底0〜水面1） */
export function layerY(ctx, m, layer = m.beh.layer) {
  const { y0, y1 } = ctx.box;
  const pad = Math.min((y1 - y0) / 2, m.L * 0.15);
  return clamp(y0 + (y1 - y0) * span(m.r, layer), y0 + pad, y1 - pad);
}

export const bottomY = (ctx, m) => ctx.box.y0 + m.ground - (m.beh.bury ?? 0) * m.L * 0.06;

export function keepInside(m, ctx) {
  clampXZ(ctx.box, m, m.margin);
  m.y = clamp(m.y, ctx.box.y0 - m.L, m.air ? Infinity : ctx.box.y1); // 跳躍・滑空中は水面より上へ出られる
}

// ---- 速さの緩急 ----------------------------------------------------------

/** 突進（バースト）。o は個体または群れの共有状態。突進が始まったフレームで o.darted = true */
export function sprintFactor(o, beh, dt, r) {
  if (beh.burst <= 1 || !beh.every) return 1;
  if (o.sprint) {
    o.sprint.t += dt;
    const p = o.sprint.t / o.sprint.dur;
    if (p < 1) return 1 + (beh.burst - 1) * bell(p);
    o.sprint = null;
    o.sprintT = beh.every * (0.5 + r());
    return 1;
  }
  o.sprintT -= dt;
  if (o.sprintT <= 0) {
    o.sprint = { t: 0, dur: 0.6 + r() * 0.9 };
    o.darted = true;
  }
  return 1;
}

/** バースト＆コースト：蹴りで加速し、惰性で滑る。o.kickTail は尾の振りの速さ（滑走中はほぼ止める） */
export function kickFactor(o, beh, dt, period) {
  const k = beh.kick;
  if (!k) {
    o.kickTail = 1;
    return 1;
  }
  o.kickP = (o.kickP ?? 0) + dt / period;
  const q = o.kickP % 1;
  o.kickTail = q < 0.3 ? 1 + k * 0.8 : 1 - k * 0.85;
  const hi = 1 + 0.6 * k;
  const lo = 1 - 0.5 * k;
  return q < 0.3 ? lo + (hi - lo) * smooth(q / 0.3) : lo + (hi - lo) * Math.exp(-(q - 0.3) * 4);
}

export const tailOf = (m, v) => clamp((v / m.cs) ** 0.8, 0.15, 3) * (m.kickTail ?? 1);

/** 目標へ泳ぐ。着いたら true。side = 横歩き、rev = 後ろ向き（イカの噴射）、flat = 体を傾けずに直接向かう */
export function steer(m, ctx, dt, tx, ty, tz, speed, { turn = m.turn, side = false, rev = false, flat = false } = {}) {
  const dx = tx - m.x;
  const dy = ty - m.y;
  const dz = tz - m.z;
  const dh = Math.hypot(dx, dz);
  const near = Math.hypot(dh, dy);
  if (dh > 1e-4) {
    const want = Math.atan2(-dz, dx);
    let face = rev ? want + Math.PI : want;
    if (side) {
      const a = want + Math.PI / 2;
      const b = want - Math.PI / 2;
      face = Math.abs(wrap(a - m.yaw)) < Math.abs(wrap(b - m.yaw)) ? a : b;
    }
    m.yaw = turnTo(m.yaw, face, turn * dt);
  }
  const tp = flat ? 0 : clamp(Math.atan2(dy, Math.max(dh, 1e-4)), -0.6, 0.6) * (rev ? -1 : 1);
  m.pitch = ease(m.pitch, tp, 3, dt);
  const slow = near < m.L * 0.6 ? Math.max(0.3, near / (m.L * 0.6)) : 1;
  m.v = ease(m.v, speed * slow, 3, dt);
  const step = Math.min(m.v * dt, near);
  if (side || rev || flat) {
    if (near > 1e-6) {
      m.x += (dx / near) * step;
      m.y += (dy / near) * step;
      m.z += (dz / near) * step;
    }
  } else {
    // 体の向きに進む（曲がりながら近づく）。向きが大きくずれている間は減速する
    const err = dh > 1e-4 ? Math.abs(wrap(Math.atan2(-dz, dx) - m.yaw)) : 0;
    const s = step * (err > 1.2 ? 0.4 : 1);
    m.x += Math.cos(m.yaw) * s;
    m.z -= Math.sin(m.yaw) * s;
    m.y += clamp(dy, -s * 0.7, s * 0.7);
  }
  m.tail = tailOf(m, m.v);
  return near < Math.max(m.L * 0.35, 0.004);
}
