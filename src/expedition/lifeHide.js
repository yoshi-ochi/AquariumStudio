import { TAU, clamp, ease, turnTo, bell, span, clampXZ, randXZ, keepInside, steer } from './lifeKit.js';

// ---- 岩穴から顔を出す ------------------------------------------------------

export function den(m, ctx) {
  const { box, anchors } = ctx;
  const rocks = anchors.rocks;
  const benthic = m.ground === 0; // 原点が底にある体形（エビ・タコ）
  if (rocks.length) {
    // 大きな岩ほど選ばれやすい
    const total = rocks.reduce((s, a) => s + a.r, 0);
    let pick = m.r() * total;
    const a = rocks.find((x) => (pick -= x.r) <= 0) ?? rocks[0];
    const ang = m.r() * TAU;
    const ex = Math.cos(ang);
    const ez = Math.sin(ang);
    const P = { x: a.x + ex * a.r * 0.75, z: a.z + ez * a.r * 0.75 };
    const back = benthic ? m.L * 0.15 : m.L * 0.22; // 頭から体の3割ほどを外に出す
    const d = { x: P.x - ex * back, z: P.z - ez * back, y: box.y0 + m.ground + Math.min(a.h * 0.15, m.L * 0.2), yaw: Math.atan2(-ez, ex) };
    clampXZ(box, d, Math.min(m.margin, m.L * 0.1));
    return d;
  }
  // 岩が無いときは壁ぎわの底でじっとする
  const side = m.r() < 0.5 ? -1 : 1;
  const d = { x: box.cx + side * (box.hx - m.L * 0.25), z: (m.r() * 2 - 1) * (box.hz - m.margin), y: box.y0 + m.ground, yaw: m.r() < 0.5 ? Math.PI / 2 : -Math.PI / 2 };
  clampXZ(box, d, Math.min(m.margin, m.L * 0.25));
  return d;
}

export function initCrevice(m, ctx) {
  m.den = den(m, ctx);
  Object.assign(m, { x: m.den.x, y: m.den.y, z: m.den.z, yaw: m.den.yaw, st: 'den', t: span(m.r, [20, 90]) });
}

export function crevice(m, ctx, dt, time) {
  const { box } = ctx;
  if (m.st === 'den') {
    m.t -= dt;
    m.x = ease(m.x, m.den.x, 2, dt);
    m.y = ease(m.y, m.den.y, 2, dt);
    m.z = ease(m.z, m.den.z, 2, dt);
    // 頭をゆっくり振り、口を開け閉めして呼吸する（ウツボはえらぶたが無く口で水を送る）
    m.yaw = turnTo(m.yaw, m.den.yaw + 0.22 * Math.sin(time * 0.35 + m.ph), dt * 1.5);
    m.pitch = ease(m.pitch, 0.06 * Math.sin(time * 0.5 + m.ph), 2, dt);
    m.v = 0;
    m.tail = 0.35;
    if (m.t <= 0) {
      if (m.r() < (m.beh.walk ? 0.5 : 0.3)) {
        m.st = 'out';
        m.t = span(m.r, [10, 25]);
        const p = randXZ(ctx, m);
        Object.assign(m, { tx: p.x, tz: p.z });
      } else m.t = span(m.r, [30, 90]);
    }
  } else if (m.st === 'out') {
    m.t -= dt;
    if (steer(m, ctx, dt, m.tx, box.y0 + m.ground + m.L * 0.05, m.tz, m.cs)) {
      const p = randXZ(ctx, m);
      Object.assign(m, { tx: p.x, tz: p.z });
    }
    if (m.t <= 0) m.st = 'back';
  } else if (steer(m, ctx, dt, m.den.x, m.den.y, m.den.z, m.cs)) {
    m.st = 'den';
    m.t = span(m.r, [40, 120]);
  }
  m.roll = 0;
  keepInside(m, ctx);
}

// ---- 砂の巣穴（チンアナゴ・ハナヒゲウツボ・ヤシャハゼ） -------------------

export function initBurrow(m, ctx, sh, index) {
  const { box } = ctx;
  const solo = m.beh.goby || m.beh.lean;
  const col = solo ? null : (sh.col ??= colonySpot(m, ctx));
  let B;
  if (col) {
    // 群れ（コロニー）は互いの間隔をあけて同じ流れの向きに並ぶ
    const rad = m.L * 0.3 * Math.sqrt(index + 0.5);
    B = { x: col.x + Math.cos(index * 2.4) * rad, z: col.z + Math.sin(index * 2.4) * rad };
  } else B = colonySpot(m, ctx);
  clampXZ(box, B, Math.min(m.margin, m.L * 0.1));
  B.y = box.y0;
  m.B = B;
  m.col = col;
  m.ext = 0.4 + m.r() * 0.6;
  m.extT = 1;
  m.rate = 0.12;
  m.seen = -1;
  m.dipT = span(m.r, [10, 40]);
  m.snapT = span(m.r, [3, 10]);
  m.scareT = span(m.r, [10, 40]);
  m.yaw0 = col ? ctx.current + (m.r() - 0.5) * 0.3 : m.beh.lean ? ctx.current : m.r() * TAU;
}

/** 岩から離れた砂地 */
function colonySpot(m, ctx) {
  let best = null;
  let bestD = -1;
  for (let i = 0; i < 8; i++) {
    const p = randXZ(ctx, m);
    const d = Math.min(9, ...ctx.anchors.rocks.map((a) => Math.hypot(p.x - a.x, p.z - a.z) - a.r));
    if (d > bestD) (best = p), (bestD = d);
  }
  return { x: best.x, z: best.z };
}

export function burrow(m, ctx, dt, time) {
  const col = m.col;
  if (col) {
    if (col.last !== time) {
      col.last = time;
      col.scareT = (col.scareT ?? span(m.r, [15, 50])) - dt;
      if (col.scareT <= 0) {
        // 何かに驚くと、近い個体から波のように一斉に巣穴へ引っ込む
        col.scare = time;
        col.scareT = span(m.r, [25, 70]);
      }
    }
    if (col.scare !== undefined && col.scare > m.seen) {
      m.seen = col.scare;
      m.retractAt = time + Math.hypot(m.B.x - col.x, m.B.z - col.z) / Math.max(0.05, m.L) * 0.4 + m.r() * 0.25;
    }
  } else {
    m.scareT -= dt;
    if (m.scareT <= 0) {
      m.retractAt = time;
      m.scareT = span(m.r, m.beh.goby ? [12, 35] : [25, 70]);
    }
  }
  if (m.retractAt !== undefined && time >= m.retractAt) {
    m.retractAt = undefined;
    m.extT = 0;
    m.fast = true;
    m.hideUntil = time + span(m.r, m.beh.goby ? [2, 5] : [3, 8]);
  }
  if (m.extT === 0 && time >= m.hideUntil) {
    m.extT = 1;
    m.fast = false;
    m.rate = 0.08 + m.r() * 0.12; // ゆっくり様子をうかがいながら出てくる
  }
  // 単独でときどき少し引っ込む
  m.dipT -= dt;
  if (m.dipT <= 0 && m.extT === 1 && m.ext > 0.9) {
    m.extT = 0.55;
    m.dipBack = time + span(m.r, [1.5, 4]);
    m.dipT = span(m.r, [15, 45]);
  }
  if (m.extT === 0.55 && time >= m.dipBack) m.extT = 1;
  const d = m.extT - m.ext;
  m.ext = clamp(m.ext + clamp(d, -(m.fast ? 6 : 1) * dt, m.rate * dt), 0, 1);

  // プランクトンを食べるときの素早い首振り
  m.snapT -= dt;
  if (m.snapT <= 0) {
    m.snap = { t: 0, dir: m.r() < 0.5 ? -1 : 1 };
    m.snapT = span(m.r, [3, 12]);
  }
  let snap = 0;
  if (m.snap) {
    m.snap.t += dt;
    snap = bell(m.snap.t / 0.35) * 0.45 * m.snap.dir;
    if (m.snap.t > 0.35) m.snap = null;
  }
  const sway = 0.28 * Math.sin(time * 0.45 + m.ph);
  const B = m.B;
  const L = m.L;
  if (m.beh.goby) {
    // 入口の上で見張り、危険を感じると頭から巣穴へ飛び込む
    const p = -1.3 * (1 - m.ext);
    m.yaw = m.yaw0 + sway * 0.4;
    const cx = Math.cos(p) * Math.cos(m.yaw);
    const cy = Math.sin(p);
    const cz = -Math.cos(p) * Math.sin(m.yaw);
    // 隠れたときは尾の先が入口に来る（体の中心は入口から頭の向きへ半身分）
    const e = m.ext;
    m.x = B.x * e + (B.x + cx * L * 0.55) * (1 - e);
    m.y = (B.y + L * 0.1) * e + (B.y + cy * L * 0.55) * (1 - e);
    m.z = B.z * e + (B.z + cz * L * 0.55) * (1 - e);
    m.pitch = p;
  } else if (m.beh.lean) {
    // 頭を上にして、体の一部（show）を出す
    const p = m.beh.lean;
    m.yaw = m.yaw0 + sway * 0.6 + snap;
    const ax = Math.cos(p) * Math.cos(m.yaw);
    const ay = Math.sin(p);
    const az = -Math.cos(p) * Math.sin(m.yaw);
    const e = (m.ext * m.beh.show - 0.5) * L;
    m.x = B.x + ax * e;
    m.y = B.y + ay * e;
    m.z = B.z + az * e;
    m.pitch = p;
  } else {
    // チンアナゴ：体は縦向きのモデル。流れの来る方を向いて体を揺らす
    m.yaw = m.yaw0 + sway + snap;
    m.x = B.x;
    m.y = B.y - (1 - m.ext) * L * 0.85;
    m.z = B.z;
    m.pitch = 0;
  }
  m.roll = 0;
  m.v = 0;
  m.tail = 0.5;
  m.visible = m.ext > 0.03;
}

// ---- 海藻に尾を巻き付ける（タツノオトシゴ） --------------------------------

/** 尾の先（モデルの全長比で前0.16・下0.25）を海藻に付ける */
const TAIL = [0.16, -0.25];

export function holdPoint(m, ctx) {
  const { box, anchors } = ctx;
  let H;
  if (anchors.holds.length) {
    // 茎の根元近く（海藻の幅の15%以内）の、水中の高さ
    const h = anchors.holds[Math.floor(m.r() * anchors.holds.length)];
    const top = Math.min(h.y0 + h.h, box.y1);
    H = { x: h.bx + (m.r() - 0.5) * Math.min(h.w, h.d) * 0.3, y: h.y0 + (top - h.y0) * span(m.r, [0.2, 0.7]), z: h.bz + (m.r() - 0.5) * Math.min(h.w, h.d) * 0.3 };
  } else if (anchors.rocks.length) {
    const a = anchors.rocks[Math.floor(m.r() * anchors.rocks.length)];
    H = { x: a.x + (m.r() - 0.5) * a.w * 0.3, y: a.y0 + a.h, z: a.z + (m.r() - 0.5) * a.d * 0.3 };
  } else {
    const p = randXZ(ctx, m);
    H = { x: p.x, y: box.y0 + m.L * 0.05, z: p.z };
  }
  // 体（尾から上へ約0.7体長）が水槽の中・水面の下に収まるようにする
  clampXZ(box, H, m.L * 0.3);
  H.y = clamp(H.y, box.y0 + m.L * 0.05, Math.max(box.y0 + m.L * 0.05, box.y1 - m.L * 0.75));
  return H;
}

const bodyAt = (m, H, yaw) => ({ x: H.x - TAIL[0] * m.L * Math.cos(yaw), y: H.y - TAIL[1] * m.L, z: H.z + TAIL[0] * m.L * Math.sin(yaw) });

export function initCling(m, ctx) {
  m.H = holdPoint(m, ctx);
  m.yaw0 = m.r() * TAU;
  Object.assign(m, bodyAt(m, m.H, m.yaw0), { yaw: m.yaw0, st: 'hold', t: span(m.r, [20, 120]) });
}

export function cling(m, ctx, dt, time) {
  if (m.st === 'hold') {
    m.t -= dt;
    // 尾で体を固定したまま、向きを変えたり揺れたりする
    m.yaw = m.yaw0 + 0.6 * Math.sin(time * 0.12 + m.ph);
    const b = bodyAt(m, m.H, m.yaw);
    const sw = m.L * 0.05 * Math.sin(time * 0.6 + m.ph);
    m.x = ease(m.x, b.x + sw, 3, dt);
    m.y = ease(m.y, b.y, 3, dt);
    m.z = ease(m.z, b.z, 3, dt);
    m.roll = 0.1 * Math.sin(time * 0.6 + m.ph + 1);
    m.pitch = 0;
    m.v = 0;
    m.tail = 0.5;
    if (m.t <= 0) {
      m.st = 'swim';
      m.H2 = holdPoint(m, ctx);
    }
  } else {
    // 立ち泳ぎでゆっくり移る（魚類で最も遅い泳ぎ）
    const b = bodyAt(m, m.H2, m.yaw);
    m.roll = ease(m.roll, 0, 2, dt);
    if (steer(m, ctx, dt, b.x, b.y + Math.sin(time * 2 + m.ph) * m.L * 0.03, b.z, m.cs, { flat: true, turn: 1 })) {
      m.H = m.H2;
      m.yaw0 = m.yaw;
      m.st = 'hold';
      m.t = span(m.r, [40, 150]);
    }
    m.tail = 1.5;
  }
}
