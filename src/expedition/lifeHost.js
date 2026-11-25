import { TAU, clamp, ease, turnTo, span, randXZ, clampXZ, keepInside, steer } from './lifeKit.js';

/**
 * 住みか（宿主）の周りで暮らす：クマノミ類。
 *   ・1つのイソギンチャクに群れ（最大のメス・オス・若魚）で住み、宿主の触手の範囲からほとんど離れない
 *   ・宿主の上で胸びれを漕ぎ続けて定位し（流れに頭を向ける）、ときどき上へ飛び出してプランクトンを捕り、すぐ戻る
 *   ・触手に体（腹・ひれ）をこすり付け、体をくねらせて潜り込む（180度向きを変えながら押し入る。宿主の換水にもなる）
 *   ・順位の低い小さな個体ほど宿主の近くに留まる（大きな個体の攻撃で外へ出る余力が少ない）
 * 水槽にイソギンチャクは無いので、触手の長い・柔らかいサンゴを宿主に見立てる（飼育下でもハナサンゴ・ウミアザミ等に入る）。
 * サンゴが無ければ岩、それも無ければ底の1点を住みかにする。
 */
const HOST_PREF = ['euphyllia', 'xenia', 'tosaka', 'tama', 'gsp'];
// 順位（0 が最大のメス）ごとの行動半径の倍率
const RANK = [1, 0.75, 0.55, 0.45];

export function hostOf(m, ctx) {
  const { coral, rocks } = ctx.anchors;
  const soft = coral.filter((a) => HOST_PREF.includes(a.id));
  const list = soft.length ? soft : coral.length ? coral : rocks;
  if (list.length) {
    // いちばん好む種類のサンゴの中から選ぶ
    const pref = (a) => (HOST_PREF.includes(a.id) ? HOST_PREF.indexOf(a.id) : 99);
    const best = Math.min(...list.map(pref));
    const pool = list.filter((x) => pref(x) === best);
    const a = pool[Math.floor(m.r() * pool.length)];
    return { x: a.x, z: a.z, top: a.y0 + a.h, r: Math.max(m.L * 0.6, a.r) };
  }
  const p = randXZ(ctx, m);
  return { x: p.x, z: p.z, top: ctx.box.y0 + m.L * 0.4, r: m.L * 1.2 };
}

/** 同じ水槽の同じ種は、同じ宿主に住む */
function sharedHost(m, ctx) {
  if (m.sh) return (m.sh.host ??= hostOf(m, ctx));
  return hostOf(m, ctx);
}

const reach = (m) => m.L * (m.beh.range ?? 4) * m.rank;

/** 宿主の上の定位する場所 */
function hoverSpot(m, ctx) {
  const H = m.host;
  const a = m.r() * TAU;
  const d = Math.sqrt(m.r()) * (H.r * 0.7 + m.L * 0.8 * m.rank);
  const p = { x: H.x + Math.cos(a) * d, z: H.z + Math.sin(a) * d };
  clampXZ(ctx.box, p, m.margin);
  return { ...p, y: clamp(H.top + m.L * span(m.r, [0.2, 1.4]) * m.rank, ctx.box.y0 + m.L * 0.3, ctx.box.y1 - m.L * 0.3) };
}

function next(m, ctx) {
  const q = m.r();
  const nestle = m.beh.nestle ?? 0.35;
  // 順位の低い個体ほど飛び出さず、触手に潜り込む
  const dart = 0.25 * m.rank;
  if (q < nestle * (1.3 - m.rank * 0.3)) {
    m.st = 'in';
    m.T = { x: m.host.x + (m.r() - 0.5) * m.host.r * 0.6, y: m.host.top - m.L * 0.2, z: m.host.z + (m.r() - 0.5) * m.host.r * 0.6 };
  } else if (q < nestle + dart) {
    // プランクトンを捕りに上・外へ飛び出す
    const a = m.r() * TAU;
    const d = span(m.r, [0.4, 1]) * reach(m);
    const p = { x: m.host.x + Math.cos(a) * d * 0.6, z: m.host.z + Math.sin(a) * d * 0.6 };
    clampXZ(ctx.box, p, m.margin);
    m.T = { ...p, y: clamp(m.host.top + d * 0.8, ctx.box.y0 + m.L * 0.3, ctx.box.y1 - m.L * 0.3) };
    m.st = 'dart';
  } else {
    m.T = hoverSpot(m, ctx);
    m.st = 'go';
  }
}

export function initHost(m, ctx, sh, index) {
  m.sh = sh;
  m.rank = RANK[Math.min(index ?? 0, RANK.length - 1)];
  m.host = sharedHost(m, ctx);
  const p = hoverSpot(m, ctx);
  Object.assign(m, p);
  m.st = 'hover';
  m.t = span(m.r, [0.5, 3]);
  m.face = ctx.current; // 流れに頭を向ける（チンアナゴと同じ向き）
}

export function rehost(m, ctx) {
  if (m.sh) m.sh.host = null;
  m.host = sharedHost(m, ctx);
  m.st = 'go';
  m.T = hoverSpot(m, ctx);
}

export function host(m, ctx, dt, time) {
  const burst = Math.max(1, m.beh.burst ?? 3);
  m.roll = ease(m.roll, 0, 3, dt);
  if (m.st === 'hover') {
    // 定位：流れに頭を向け、胸びれを漕いで小さく揺れながらその場に留まる
    m.t -= dt;
    m.v = ease(m.v, 0, 3, dt);
    m.yaw = turnTo(m.yaw, m.face + Math.sin(time * 0.7 + m.ph) * 0.5, 1.5 * dt);
    m.pitch = ease(m.pitch, Math.sin(time * 1.1 + m.ph) * 0.12, 2, dt);
    m.y += Math.sin(time * 1.6 + m.ph) * m.L * 0.12 * dt;
    m.x += Math.sin(time * 0.9 + m.ph * 2) * m.L * 0.08 * dt;
    m.tail = 0.4;
    if (m.t <= 0) next(m, ctx);
  } else if (m.st === 'in') {
    // 触手に潜り込む：体をくねらせ、ときどき180度向きを変えて押し入る。体の横を触手にこすり付ける
    if (!m.wr) {
      if (steer(m, ctx, dt, m.T.x, m.T.y, m.T.z, m.cs * 0.8)) {
        m.wr = { t: span(m.r, [2, 5]), base: m.yaw, flip: span(m.r, [0.8, 1.8]) };
        m.t = m.wr.t;
      }
    } else {
      m.t -= dt;
      const w = m.wr;
      w.flip -= dt;
      if (w.flip <= 0) {
        w.base += Math.PI;
        w.flip = span(m.r, [0.8, 1.8]);
      }
      m.v = ease(m.v, 0, 4, dt);
      m.yaw = turnTo(m.yaw, w.base + Math.sin(time * 9 + m.ph) * 0.45, 6 * dt);
      m.roll = Math.sin(time * 6 + m.ph) * 0.4;
      m.y = ease(m.y, m.T.y + Math.sin(time * 4 + m.ph) * m.L * 0.08, 3, dt);
      m.tail = 1.4;
      if (m.t <= 0) {
        m.wr = null;
        m.T = hoverSpot(m, ctx);
        m.st = 'go';
      }
    }
  } else if (m.st === 'dart') {
    // 飛び出し：尾びれも使って一気に出る。着いたら餌をついばみ、すぐ戻る
    if (steer(m, ctx, dt, m.T.x, m.T.y, m.T.z, m.cs * burst)) {
      m.st = 'snap';
      m.t = span(m.r, [0.2, 0.6]);
    }
  } else if (m.st === 'snap') {
    m.t -= dt;
    m.v = ease(m.v, 0, 6, dt);
    m.pitch = ease(m.pitch, 0.35, 8, dt);
    m.tail = 0.8;
    if (m.t <= 0) {
      m.T = hoverSpot(m, ctx);
      m.st = 'back';
    }
  } else {
    // 宿主へ戻る（back は少し速く）
    if (steer(m, ctx, dt, m.T.x, m.T.y, m.T.z, m.cs * (m.st === 'back' ? 1.6 : 1))) {
      m.st = 'hover';
      m.t = span(m.r, [1.5, 5]);
      m.face = ctx.current + (m.r() - 0.5) * 0.8;
    }
  }
  keepInside(m, ctx);
}
