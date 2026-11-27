import * as THREE from 'three';
import { clamp01, ease, lerp, makeLine, particles, span } from './gearKit.js';
import { creature, soften } from './surveyKit.js';
import { buildShip } from './surveyShips.js';
import { buildChimneys, buildRov } from './surveyTools.js';

const rnd = (i, s = 0) => {
  const v = Math.sin(i * 91.7 + s * 47.3) * 43758.5453;
  return v - Math.floor(v);
};
const SX = 8; // 母船の位置
const dots = (group, n, color, size, opacity) => {
  return soften(particles(group, n, color, size), opacity);
};

/** ROV深海調査：母船から吊り下ろして潜航し、海底を探して吸引式の採集器で採取する */
export function rovSurvey({ group, stage, bedY, time, deep }) {
  const ship = buildShip(stage, 'research');
  ship.root.place(SX);
  const D = ship.deck;
  const rov = buildRov(group);
  const tether = makeLine(group, 0xf0b428, 26);
  const hoist = makeLine(group, 0x30363c, 2);
  const hose = makeLine(group, 0x9aa4a8, 3);
  const snow = dots(group, 240, 0xd5e8f0, 0.22, 0.6);
  const splash = particles(group, 28, 0xffffff, 0.28);
  const sip = particles(group, 10, 0xdff4fb, 0.1);
  const CX = 12;
  const tips = buildChimneys(group, CX, bedY, 1);
  const smoke = dots(group, 64, 0x1a1d20, 1.1, 0.8);
  const squid = creature(group, 'daiou', 0.85);
  const coel = creature(group, 'seela', 1.5);
  const eye = creature(group, 'demenigisu', 4.5);
  const HOLD = [3.2, bedY + 2.6, 4]; // 採取のときにとどまる位置
  const FISH = [HOLD[0] + 3.3, HOLD[1] - 0.85, HOLD[2] + 1.45];
  const light = new THREE.Vector3();
  /** 投光器からの距離で明るさを決める（光の届かない所は、かすかな影だけ） */
  const lit = (f, on, range = 24) => f.shade(Math.max(0.05, on * clamp01(1.2 - f.position.distanceTo(light) / range)));

  const update = (step, p, t) => {
    time(0.1);
    ship.night(0);
    ship.spin(t);
    // Aフレーム：着水のときに倒し、揚収のときに戻す
    const swing = step === 0 ? ease(span(p, 0.25, 0.65)) : step < 4 ? 1 : 1 - ease(span(p, 0.74, 0.92));
    ship.aframe.rotation.z = lerp(-0.3, 0.62, swing);
    const B = ship.block.at();
    const onDeck = D + 0.97;
    const hung = D + 2;
    const START = [SX - 20, -1.6, 0];
    let pos;
    let pitch = 0;
    let on = 1; // 投光器
    let dark = 1;
    if (step === 0) {
      pos = [B[0], p < 0.25 ? lerp(onDeck, hung, ease(p / 0.25)) : lerp(hung, START[1], ease(span(p, 0.65, 1))), 0];
      on = dark = 0;
    } else if (step === 1) {
      const k = ease(p);
      pos = [lerp(START[0], -16, k), lerp(START[1], bedY + 3.4, k), lerp(0, 5, k)];
      pitch = -0.28 * Math.sin(p * Math.PI);
      on = ease(span(p, 0.2, 0.45));
      dark = ease(span(p, 0.03, 0.75));
    } else if (step === 2) {
      const k = ease(p);
      pos = [lerp(-16, HOLD[0], k), lerp(bedY + 3.4, HOLD[1], k) + Math.sin(t * 0.9) * 0.12, lerp(5, HOLD[2], k)];
      pitch = -0.06 * Math.sin(p * Math.PI);
    } else if (step === 3) {
      pos = [HOLD[0] + Math.sin(t * 0.7) * 0.04, HOLD[1] + Math.sin(t * 0.9) * 0.05, HOLD[2]];
    } else {
      const k = ease(span(p, 0, 0.5));
      const lift = ease(span(p, 0.52, 0.74));
      pos = [lerp(HOLD[0], B[0], k), lerp(lerp(HOLD[1], START[1], k), hung, lift) - ease(span(p, 0.92, 1)) * (hung - onDeck), lerp(HOLD[2], 0, k)];
      pitch = 0.22 * Math.sin(k * Math.PI);
      on = 1 - ease(span(p, 0.32, 0.5));
      dark = 1 - ease(span(p, 0.05, 0.5));
    }
    deep(dark);
    squid.visible = coel.visible = smoke.visible = dark > 0.25; // 深みの生き物は海面からは見えない
    ship.root.visible = dark < 0.9; // 深海からは母船は見えない（ケーブルだけが上へ伸びる）
    rov.position.set(pos[0], pos[1], pos[2]);
    rov.rotation.set(0, step === 2 ? Math.sin(t * 0.5) * 0.08 : 0, pitch);
    rov.lights(on);
    rov.reach(step === 3 ? ease(span(p, 0.08, 0.42)) - ease(span(p, 0.8, 1)) : 0);
    light.set(pos[0] + 5, pos[1] - 1, pos[2]);
    // 吊りワイヤー（甲板の上と海面まで）と、潜っている間のケーブル
    const top = [pos[0], pos[1] + 0.92, pos[2]];
    const wired = step === 0 || (step === 4 && p > 0.5);
    hoist(wired ? [B, top] : []);
    const T = rov.tether.at();
    tether(wired ? [] : Array.from({ length: 26 }, (_, i) => {
      const k = i / 25;
      const sag = Math.sin(k * Math.PI);
      return [lerp(B[0], T[0], k) - sag * 3.2, lerp(B[1], T[1], k ** 1.25), lerp(B[2], T[2], k) + sag * 1.2];
    }));
    // 着水・揚収のしぶき
    const wet = step === 0 ? span(p, 0.8, 1) : step === 4 ? 1 - span(p, 0.5, 0.64) : 0;
    splash.visible = wet > 0 && wet < 1;
    for (let i = 0; i < 28; i++) {
      const a = i * 2.4;
      const f = (wet * 1.6 + rnd(i, 1) * 0.5) % 1;
      splash.setAt(i, B[0] + Math.cos(a) * (1 + f * 2), f * (1 - f) * 5, Math.sin(a) * (1 + f * 2));
    }
    splash.flush();
    // マリンスノー（ゆっくり沈む）
    for (let i = 0; i < 240; i++) {
      const y = -2 - ((rnd(i, 3) * (-bedY - 2) + t * (0.25 + rnd(i, 4) * 0.2)) % (-bedY - 2));
      snow.setAt(i, lerp(-34, 24, rnd(i, 5)) + Math.sin(t * 0.3 + i) * 0.3, y, lerp(-9, 17, rnd(i, 6)));
    }
    snow.flush();
    snow.material.opacity = 0.2 + dark * 0.5;
    // チムニーから噴き出す熱水（黒い煙）
    for (let i = 0; i < 64; i++) {
      const tip = tips[i % tips.length];
      const f = (t * 0.22 + rnd(i, 7)) % 1;
      smoke.setAt(i, tip[0] + Math.sin(i * 3 + f * 5) * f * 1.3, tip[1] + f * 8, tip[2] + Math.cos(i * 2.3 + f * 4) * f * 1.3);
    }
    smoke.flush();
    // ダイオウイカが光の先を横切る（外套膜の先を前にして泳ぐ）
    const sq = step === 2 ? p : step === 3 ? 1 + p * 0.4 : step > 3 ? 2 : -0.2;
    squid.position.set(lerp(30, -12, sq), bedY + 6.2 + Math.sin(sq * 3) * 1, lerp(-5, -9, sq));
    squid.rotation.set(0, Math.PI, 0.08);
    squid.swim(t);
    lit(squid, on, 34);
    // 岩陰のシーラカンス（頭を下げてただよう）
    coel.position.set(CX - 5.5 + Math.sin(t * 0.25) * 0.8, bedY + 1.9 + Math.sin(t * 0.4) * 0.25, -3.2);
    coel.rotation.set(0, Math.PI + 0.5, 0.32);
    coel.swim(t * 0.6);
    lit(coel, on);
    // デメニギス：吸引管で海水ごと吸い取り、容器へ送る
    const pull = step === 3 ? ease(span(p, 0.46, 0.64)) : step > 3 ? 1 : 0;
    const Z = rov.nozzle.at();
    eye.visible = pull < 0.98 && dark > 0.25;
    eye.position.set(lerp(FISH[0], Z[0], pull) + Math.sin(t * 0.8) * 0.12 * (1 - pull), lerp(FISH[1], Z[1], pull) + Math.sin(t * 1.1) * 0.08 * (1 - pull), lerp(FISH[2], Z[2], pull));
    eye.rotation.set(0, Math.PI - 0.5, 0);
    eye.scale.setScalar(4.5 * (1 - pull * 0.8));
    eye.swim(t);
    lit(eye, on, 16);
    const J = rov.jar.at();
    const flow = step === 3 ? span(p, 0.44, 0.8) : 0;
    hose(step === 3 ? [Z, [pos[0] + 1.3, pos[1] - 0.35, pos[2] + 0.5], J] : []);
    sip.visible = flow > 0 && flow < 1;
    for (let i = 0; i < 10; i++) {
      const f = (t * 1.6 + i / 10) % 1;
      sip.setAt(i, lerp(Z[0] + 0.7, Z[0], f) + Math.sin(i * 4) * 0.2 * (1 - f), lerp(Z[1], Z[1], f) + Math.cos(i * 3) * 0.2 * (1 - f), lerp(Z[2] + 0.3, Z[2], f));
    }
    sip.flush();
    // カメラはROVを追う
    const [x, y, z] = pos;
    const follow = [x - 9, y + 2.5, z + 19, x + 1, y - 0.6, z];
    update.shots[1] = follow;
    update.shots[2] = [x - 8, y + 4, z + 17, x + 5, y - 0.8, z - 1];
    update.shots[3] = [x + 3.6, y + 1.2, z + 8.5, x + 2.5, y - 0.55, z + 0.6];
    update.shots[4] = p < 0.5 ? follow : update.shots[0];
  };
  update.shots = [[-36, 8, 26, -11, 3.4, 0], null, null, null, null];
  return update;
}
