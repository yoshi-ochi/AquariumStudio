import { clamp, span, turnTo, wrap, clampXZ, ease, solidTop } from './lifeKit.js';
import { forceEvent } from './lifeCruise.js';
import { hideInHost } from './lifeHost.js';

/**
 * 水槽の中の生き物どうしの関わり。行動ごとの動き（lifeMotion.js の mode）の上に「ずれ」を重ねて表す。
 *   並走   つがいで暮らす魚（チョウチョウウオ類）・イルカは、相手の横に並んで同じ向きに泳ぐ
 *   狩り   捕食者（hunt 秒ごと）が獲物の群れの中心へ突っ込み、すり抜けて元の泳ぎに戻る。群れで狩る魚は同じ獲物を少し遅れて追う
 *          （バショウカジキは6〜40尾で同じイワシの群れを交互に襲う。1回の突進で捕らえるのは2割強）
 *   逃避   獲物は捕食者が近づくと、群れが左右に割れて捕食者を避け（ファウンテン効果。横から襲われたときに多い）、
 *          ごく近いと四方へ散る（フラッシュ拡散）。去ったあとは元の位置へ戻って群れを組み直す（再集合）
 *          トビウオは水面から飛び出して滑空し、クマノミは宿主に潜り、チンアナゴは巣穴へ引っ込む
 * 位置は m.x/y/z（行動の位置）＋ m.ox/oy/oz（ずれ）。描画の位置と向きは m.rx/ry/rz・m.ryaw・m.rpitch
 */
const REACT = new Set(['cruise', 'wander', 'host', 'burrow']);
/** p は m にとっての捕食者か（狩りをし、2.5倍以上大きい別の種） */
const threatOf = (m, p) => p !== m && p.beh.hunt > 0 && p.L >= m.L * 2.5 && p.c.id !== m.c.id;
const len = (x, y, z) => Math.hypot(x, y, z) || 1e-9;

export function initSocial(m, ctx, sh, index) {
  Object.assign(m, { ox: 0, oy: 0, oz: 0, ovx: 0, ovy: 0, ovz: 0, rx: m.x, ry: m.y, rz: m.z, ryaw: m.yaw, rpitch: m.pitch, px: m.x, py: m.y, pz: m.z });
  m.side = index % 2 ? 1 : -1;
  m.prey = REACT.has(m.mode);
  m.huntT = m.beh.hunt > 0 ? span(m.r, [0.3, 1]) * m.beh.hunt : Infinity;
  (ctx.agents ??= []).push(m);
  // つがい：2匹ずつ組にし、後の個体が先の個体の横に並ぶ（先の個体が先に動く）
  if (m.beh.pair && sh) {
    sh.pairs ??= [];
    if (index % 2 === 1 && sh.pairs[index - 1]) m.partner = sh.pairs[index - 1];
    sh.pairs[index] = m;
  }
}

/** 相手（描画の位置・向き）の横に並ぶ（少し後ろ・体長の gap 倍の間隔）。逃避・狩り・呼吸・跳躍も一緒にする */
export function followPartner(m, ctx, time) {
  const p = m.partner;
  const gap = m.L * (m.beh.gap ?? 0.9) * (1 + 0.15 * Math.sin(time * 0.4 + m.ph));
  const fx = Math.cos(p.ryaw);
  const fz = -Math.sin(p.ryaw);
  m.x = p.rx + -fz * gap * m.side - fx * m.L * 0.25;
  m.z = p.rz + fx * gap * m.side - fz * m.L * 0.25;
  m.y = p.ry + Math.sin(time * 0.5 + m.ph) * m.L * 0.12;
  m.yaw = p.ryaw + Math.sin(time * 0.8 + m.ph) * 0.08;
  Object.assign(m, { pitch: p.rpitch, roll: p.roll, v: p.v + Math.hypot(p.ovx, p.ovz), tail: p.tail, visible: p.visible, air: p.air });
  if (!m.air) clampXZ(ctx.box, m, m.margin);
}

/** 群れの中心（同じ群れの個体の描画位置の平均）。1フレームに1回だけ計算する */
function center(t, ctx, time) {
  const sh = t.beh.school ? t.sh : null;
  if (!sh) return { x: t.rx, y: t.ry, z: t.rz };
  if (sh.cenT !== time) {
    let x = 0, y = 0, z = 0, n = 0;
    for (const a of ctx.agents) if (a.sh === sh && a.visible) (x += a.rx), (y += a.ry), (z += a.rz), n++;
    sh.cen = n ? { x: x / n, y: y / n, z: z / n } : { x: t.rx, y: t.ry, z: t.rz };
    sh.cenT = time;
  }
  return sh.cen;
}

/** ずれを元へ戻す（再集合）。k が大きいほど早く戻る */
function settle(m, dt, k = 3) {
  const c = 2 * Math.sqrt(k);
  m.ovx += (-m.ox * k - m.ovx * c) * dt;
  m.ovy += (-m.oy * k - m.ovy * c) * dt;
  m.ovz += (-m.oz * k - m.ovz * c) * dt;
}

/** ずれの速さを目標の速さへ近づける */
function push(m, vx, vy, vz, rate, dt) {
  const a = Math.min(1, rate * dt);
  m.ovx += (vx - m.ovx) * a;
  m.ovy += (vy - m.ovy) * a;
  m.ovz += (vz - m.ovz) * a;
}

function pickPrey(m, ctx) {
  const list = ctx.agents.filter((a) => a.prey && a.visible && threatOf(a, m));
  return list.length ? list[Math.floor(m.r() * list.length)] : null;
}

function hunt(m, ctx, dt, time) {
  const school = m.beh.school ? m.sh : null;
  if (!m.hunt) {
    m.huntT -= dt;
    settle(m, dt);
    if (m.huntT > 0) return;
    // 群れの狩りは最初の個体が獲物を決め、仲間は0〜1.5秒遅れて同じ群れへ向かう
    const fresh = school?.huntTarget && time - school.huntAt < 3 ? school.huntTarget : null;
    const target = fresh ?? pickPrey(m, ctx);
    m.huntT = span(m.r, [0.6, 1.4]) * m.beh.hunt;
    if (!target) return;
    if (school && !fresh) Object.assign(school, { huntTarget: target, huntAt: time });
    m.hunt = { target, t: -(fresh ? m.r() * 1.5 : 0), ph: 'chase' };
  }
  const H = m.hunt;
  H.t += dt;
  if (H.t < 0) return settle(m, dt);
  const speed = m.cs * Math.max(2, m.beh.burst ?? 2.5);
  if (H.ph === 'chase') {
    const T = center(H.target, ctx, time);
    const dx = T.x - m.rx + m.side * m.L * 0.15;
    const dy = T.y - m.ry;
    const dz = T.z - m.rz;
    const d = len(dx, dy, dz);
    push(m, (dx / d) * speed, (dy / d) * speed * 0.7, (dz / d) * speed, 3, dt);
    if (d < m.L * 0.35 || H.t > 7) Object.assign(H, { ph: 'pass', t: 0 });
  } else if (H.ph === 'pass') {
    // 群れの中をすり抜ける
    if (H.t > 0.5) Object.assign(H, { ph: 'back', t: 0 });
  } else {
    settle(m, dt, 1.5);
    if (H.t > 1 && Math.hypot(m.ox, m.oy, m.oz) < m.L * 0.1) m.hunt = null;
  }
}

function evade(m, ctx, dt, time) {
  let threat = null;
  let best = 1;
  let attack = false;
  for (const p of ctx.agents) {
    if (!threatOf(m, p)) continue;
    const attacking = !!(p.hunt && p.hunt.ph !== 'back' && p.hunt.t > 0);
    // 襲ってくる捕食者には早めに、ただ通り過ぎる捕食者にはすぐ近くでだけ反応する
    const R = attacking ? Math.max(m.L * 6, p.L * 1.0) : p.L * 0.5 + m.L * 1.5;
    const q = Math.hypot(m.rx - p.rx, m.ry - p.ry, m.rz - p.rz) / R;
    if (q < best) (best = q), (threat = p), (attack = attacking);
  }
  if (!threat) return settle(m, dt, m.beh.school ? 2.5 : 1.5);
  const urg = 1 - best;
  // 隠れられる生き物は隠れる
  if (m.mode === 'host') return hideInHost(m, ctx), settle(m, dt);
  if (m.mode === 'burrow') {
    if (m.col) m.col.scareT = Math.min(m.col.scareT ?? 0, 0);
    else m.scareT = Math.min(m.scareT, 0);
    return;
  }
  if (attack && urg > 0.4 && (m.beh.events ?? []).includes('glide') && forceEvent(m, ctx, 'glide')) return settle(m, dt);
  const p = threat;
  const rx = m.rx - p.rx;
  const ry = m.ry - p.ry;
  const rz = m.rz - p.rz;
  const rl = len(rx, ry, rz);
  // 捕食者の進む向き
  let fx = p.rx - p.px;
  let fz = p.rz - p.pz;
  const fl = Math.hypot(fx, fz);
  if (fl < 1e-6) (fx = Math.cos(p.ryaw)), (fz = -Math.sin(p.ryaw));
  else (fx /= fl), (fz /= fl);
  let dx;
  let dz;
  if (best < 0.3) {
    // ごく近い：四方へ散る
    dx = rx / rl;
    dz = rz / rl;
  } else {
    // 捕食者の進路から左右へ割れる（進路の真上なら決まった側へ）
    const along = rx * fx + rz * fz;
    let lx = rx - fx * along;
    let lz = rz - fz * along;
    let ll = Math.hypot(lx, lz);
    if (ll < m.L * 0.2) (lx = -fz * m.side), (lz = fx * m.side), (ll = 1);
    dx = lx / ll + (rx / rl) * 0.5;
    dz = lz / ll + (rz / rl) * 0.5;
  }
  const dl = Math.hypot(dx, dz) || 1;
  // 捕食者の体をかわせるだけ離れたら、それ以上は逃げない（群れはすぐ後ろで組み直す）
  const far = Math.hypot(m.ox, m.oz) > m.L * 3 + p.L * 0.5;
  const v = far ? 0 : m.L * (m.beh.escape ?? 8) * (0.35 + 0.65 * urg);
  push(m, (dx / dl) * v, (ry / rl) * v * 0.3, (dz / dl) * v, far ? 3 : 8, dt);
}

/** 当たり判定を付けない動き方：岩穴にすむ・砂に潜る・海藻に掴まる（岩・海藻に入り込むのが本来の姿） */
const PASS = new Set(['crevice', 'burrow', 'cling']);

/**
 * 当たり判定：岩・硬いサンゴ・流木の中へ入らないよう、上面より上へ持ち上げる量。
 * 急に跳ね上がらないよう、上がるときは速く・下がるときはゆっくりならす。底で休む・歩く生き物は岩の上に乗る
 */
function bodyLift(m, ctx, x, z, y, dt) {
  const solids = ctx.anchors?.solids;
  let need = 0;
  if (solids?.length && m.visible && !m.air && !PASS.has(m.mode)) {
    const top = solidTop(solids, x, z, m.L * 0.2);
    if (top > -Infinity) need = Math.max(0, Math.min(ctx.box.y1, top + Math.max(m.ground, m.L * 0.1)) - y);
  }
  m.lift = ease(m.lift ?? 0, need, need > (m.lift ?? 0) ? 12 : 2.5, dt);
  // 追いつく前でも、体が半分以上めり込まないようにする
  return Math.max(m.lift, need - m.L * 0.25);
}

/** 行動の位置にずれを重ね、描画の位置・向きを決める */
export function social(m, ctx, dt, time) {
  if (dt <= 0) return;
  if (m.partner) settle(m, dt, 4); // つがいの後ろの個体は相手に合わせる
  else if (m.beh.hunt > 0) hunt(m, ctx, dt, time);
  else if (m.prey) evade(m, ctx, dt, time);
  m.ox += m.ovx * dt;
  m.oy += m.ovy * dt;
  m.oz += m.ovz * dt;
  // 水槽の外へ出ない
  const { box } = ctx;
  const q = { x: m.x + m.ox, z: m.z + m.oz };
  clampXZ(box, q, m.margin);
  if (q.x !== m.x + m.ox) (m.ox = q.x - m.x), (m.ovx *= 0.3);
  if (q.z !== m.z + m.oz) (m.oz = q.z - m.z), (m.ovz *= 0.3);
  // ずれで水面より上へは出ない（跳躍・滑空は行動の位置 m.y が水面より上になる）
  let y = clamp(m.y + m.oy, Math.min(m.y, box.y0 + m.L * 0.2), Math.max(m.y, box.y1));
  if (y !== m.y + m.oy) (m.oy = y - m.y), (m.ovy *= 0.3);
  y += bodyLift(m, ctx, m.x + m.ox, m.z + m.oz, y, dt);
  m.px = m.rx;
  m.py = m.ry;
  m.pz = m.rz;
  m.rx = m.x + m.ox;
  m.ry = y;
  m.rz = m.z + m.oz;
  // ずれが速いあいだは、その向きへ体を向ける（尾びれも速く振る）
  const ov = Math.hypot(m.ovx, m.ovz);
  const w = clamp(ov / Math.max(m.cs, 1e-4) / 1.5, 0, 1);
  const vx = (m.rx - m.px) / dt;
  const vz = (m.rz - m.pz) / dt;
  const want = w > 0.05 && Math.hypot(vx, vz) > 1e-5 ? m.yaw + wrap(Math.atan2(-vz, vx) - m.yaw) * w : m.yaw;
  m.ryaw = turnTo(m.ryaw, want, 9 * dt);
  m.rpitch = m.pitch + clamp(m.ovy / Math.max(ov + Math.abs(m.ovy), 1e-4), -1, 1) * 0.5 * w;
  if (w > 0.05) m.tail = Math.max(m.tail, clamp((ov / Math.max(m.cs, 1e-4)) ** 0.8, 0, 4));
}
