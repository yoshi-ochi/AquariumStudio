import { clamp, smooth } from './lifeKit.js';

/**
 * 水面から跳ぶ（イルカ・マンタ・シイラ・マグロ・サケ・アロワナ）。
 *   助走  表層〜中層の上部から、加速しながら斜め上へ泳いで水面へ向かう（頭は進行方向の斜め上）
 *   空中  水面を抜けたら放物線（一定の重力）。頭は常に速度の向きで、落ちるときは頭が下がる
 *   着水  頭から入って水の抵抗で減速し、元の泳ぐ高さ・速さへ戻る
 * 高さは水槽ローカル。水平の速さ vh は呼び出し側（lifeCruise.js）が周回の道に沿って進める
 */

/** 水底0〜水面1 で、これより上にいるときだけ跳ぶ（低層からは跳ばない） */
const LEAP_FROM = 0.5;

/** 水面の高さ（tankLife.js の swimBox が水位から入れる） */
export const surfaceOf = (box) => box.surf ?? box.y1 + 0.03;

/** 高さ y から跳べるか */
export function canLeap(ctx, y) {
  const { box } = ctx;
  return (y - box.y0) / Math.max(1e-3, surfaceOf(box) - box.y0) >= LEAP_FROM;
}

/** 跳躍の計画。y は今の高さ、v0 は今の水平の速さ（m/秒） */
function plan(m, ctx, y, v0) {
  const { box } = ctx;
  const top = surfaceOf(box);
  const H = m.L * Math.max(0.2, m.beh.leapH ?? 0.8);
  const tan = Math.tan(0.7 + m.r() * 0.3); // 水面を抜ける角度（40〜57度）
  // 水面を抜ける縦の速さ。空中は0.5〜1.3秒に収める
  const vy = clamp(Math.max(v0, m.cs) * 2.4 * tan, (4 * H) / 1.3, (4 * H) / 0.5);
  const vh = Math.max(v0, vy / tan);
  const D = Math.max(1e-3, top - y);
  const T1 = Math.max(0.9, (2 * D) / vy);
  const dive = Math.min(Math.max(m.L * 0.7, H * 0.6), (top - box.y0) * 0.5);
  return { y, v0, top, H, vy, vh, g: (vy * vy) / (2 * H), D, T1, Ta: (4 * H) / vy, T3: (3 * dive) / vy, T4: 1.6, dive };
}

/**
 * 1フレーム進める。baseY・basePitch は跳ばなかったときの高さと頭の上下、v0 は周回の速さ。
 * { y, pitch, vh, tail, done } を返す（vh は今の水平の速さ）
 */
export function stepLeap(m, ctx, ev, dt, baseY, basePitch, v0) {
  const P = (ev.plan ??= plan(m, ctx, baseY, v0));
  ev.t += dt;
  const { T1, Ta, T3, T4, vy, vh, top } = P;
  let t = ev.t;
  let y;
  let dy;
  let h = vh;
  let tail = 1;
  let blend = 1;
  if (t < T1) {
    // 助走：y = y0 + D·f(u)、f(0)=0・f'(0)=0・f(1)=1・f'(1)=vy·T1/D（浅いときは一度少し沈んで勢いをつける）
    const u = t / T1;
    const s = (vy * T1) / P.D;
    y = P.y + P.D * ((s - 2) * u ** 3 + (3 - s) * u * u);
    dy = (P.D * (3 * (s - 2) * u * u + 2 * (3 - s) * u)) / T1;
    h = P.v0 + (vh - P.v0) * u * u;
    tail = 1 + 2 * u;
    blend = smooth(u / 0.2);
  } else if ((t -= T1) < Ta) {
    // 空中：放物線
    y = top + vy * t - (P.g * t * t) / 2;
    dy = vy - P.g * t;
    tail = 0.3;
  } else {
    t -= Ta;
    const q = clamp(t / (T3 + T4), 0, 1);
    h = P.v0 + (vh - P.v0) * (1 - q) ** 2;
    if (t < T3) {
      // 着水：水の抵抗で縦の速さが0へ
      const k = 1 - t / T3;
      y = top - P.dive * (1 - k ** 3);
      dy = -vy * k * k;
    } else {
      // 元の泳ぐ高さへ戻る
      const w = clamp((t - T3) / T4, 0, 1);
      const yE = top - P.dive;
      y = yE + (baseY - yE) * smooth(w);
      dy = ((baseY - yE) * 6 * w * (1 - w)) / T4;
      blend = 1 - smooth(w);
    }
  }
  m.air = y > ctx.box.y1 - m.L * 0.3;
  const pitch = basePitch + (Math.atan2(dy, Math.max(h, 1e-4)) - basePitch) * blend;
  return { y, pitch, vh: h, tail, done: ev.t >= T1 + Ta + T3 + T4 };
}
