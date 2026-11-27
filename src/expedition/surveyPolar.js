import * as THREE from 'three';
import { ease, lerp, makeLine, particles, span } from './gearKit.js';
import { bake, creature, person } from './surveyKit.js';
import { buildShip } from './surveyShips.js';
import { buildCamp } from './surveyTools.js';
import { buildHole, buildIce } from './surveyIce.js';

const rnd = (i, s = 0) => {
  const v = Math.sin(i * 91.7 + s * 47.3) * 43758.5453;
  return v - Math.floor(v);
};
const HALF = 6.6; // 水路の幅の半分
const X0 = -50; // 船の位置：砕氷の始めと、止まる所
const X1 = 2;
const HX = X1 - 8.8; // 氷の穴（クレーンの台座の真横）
const HZ = 14;
const CRANE_Z = 3.3;
const HOOKS = 5;

/** 極地探検：砕氷船で氷を割って進み、氷の穴から底はえ縄を下ろしてニシオンデンザメを採取する */
export function polarSurvey({ group, stage, bedY, time, deep }) {
  const ship = buildShip(stage, 'icebreaker');
  const ice = buildIce(group, HALF);
  const TOP = ice.top;
  const hole = buildHole(group, HX, HZ, 4.6, 2);
  const camp = buildCamp(group);
  camp.position.set(HX, TOP, HZ);
  // 氷上の隊員：船のそばから観測点へ歩く
  const crew = [[-2.6, 1.9, 0xe8622c], [2.9, 1.7, 0xf0c22c], [-1, -2.4, 0xd4302a], [5.2, 1.2, 0x2f73a8]].map(([dx, dz, suit], i) => {
    const g = bake(person(group, 0, 0, 0, suit, 0xf4f4f0, 0.75));
    g.userData = { from: [HX + 4 + i * 1.4, HALF + 1.6], to: [HX + dx, HZ + dz] };
    return g;
  });
  const chips = particles(group, 48, 0xffffff, 0.34);
  // 底はえ縄：幹縄・枝縄・餌・錘
  const main = makeLine(group, 0xf4e9c8, 3);
  const snoods = Array.from({ length: HOOKS }, () => makeLine(group, 0xe6eef2, 2));
  const baits = particles(group, HOOKS, 0xf0a590, 0.3);
  const sinker = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.6, 7), new THREE.MeshStandardMaterial({ color: 0x4a5258, roughness: 0.6 }));
  group.add(sinker);
  const shark = creature(group, 'greenland', 1);
  const LEN = 4;
  // 担架（スリング）と、クレーンの吊りワイヤー
  const sling = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 4.3, 10, 1, true, Math.PI / 2, Math.PI).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2f6fb8, roughness: 0.8, side: THREE.DoubleSide }));
  group.add(sling);
  const straps = makeLine(group, 0xf0c22c, 3);
  const wire = makeLine(group, 0x30363c, 2);
  const tankAt = [X1 + ship.tank[0], ship.tank[1] + 0.75, ship.tank[2]];

  const update = (step, p, t) => {
    time(0.22);
    ship.night(0);
    ship.spin(t);
    // 砕氷：乗り上げては割る、を繰り返して進む
    const c = step === 0 ? p * 3 : 3;
    const ram = c - Math.min(2, Math.floor(c));
    const push = Math.min(1, ram / 0.72);
    const sx = step === 0 ? lerp(X0, X1, (Math.min(2, Math.floor(c)) + ease(push)) / 3) : X1;
    ship.root.place(sx);
    ship.g.rotation.z = step === 0 ? Math.sin(push * Math.PI) * 0.03 - (ram > 0.72 ? Math.sin(((ram - 0.72) / 0.28) * Math.PI) * 0.012 : 0) : 0;
    const bow = sx + 21.4;
    ice(t, bow, sx - 22, 5.2);
    chips.visible = step === 0;
    for (let i = 0; i < 48; i++) {
      const f = (t * 0.9 + rnd(i, 1)) % 1;
      const side = i % 2 ? 1 : -1;
      chips.setAt(i, bow - 1 - rnd(i, 2) * 5 + f * 1.5, 0.3 + f * (1 - f) * 5 * (0.4 + rnd(i, 3)) * push, side * (1.5 + rnd(i, 4) * 3 + f * 2.5));
    }
    chips.flush();
    // 観測点：氷を切り抜き、三脚とテントを立てる
    const built = step < 1 ? 0 : step === 1 ? ease(span(p, 0.15, 0.6)) : 1;
    camp.visible = built > 0.01;
    camp.scale.set(1, Math.max(0.01, built), 1);
    hole(step < 1 ? 0 : step === 1 ? ease(span(p, 0.5, 0.85)) : 1);
    const walk = step < 1 ? 0 : step === 1 ? ease(span(p, 0, 0.5)) : 1;
    crew.forEach((g, i) => {
      const { from, to } = g.userData;
      g.visible = step >= 1;
      const moving = walk > 0 && walk < 1;
      g.position.set(lerp(from[0], to[0], walk), TOP + (moving ? Math.abs(Math.sin(t * 7 + i)) * 0.07 : 0), lerp(from[1], to[1], walk));
      g.rotation.y = moving ? Math.atan2(to[0] - from[0], to[1] - from[1]) : Math.atan2(HX - to[0], HZ - to[1]);
    });
    // 底はえ縄を沈め、かかったら時間をかけて巻き上げる
    const down = step < 2 ? 0 : step === 2 ? ease(span(p, 0, 0.55)) : 1;
    const up = step === 3 ? ease(p) : step > 3 ? 1 : 0;
    const P = camp.pulley.at();
    const baseY = lerp(TOP - 0.3, bedY + 2.2, down);
    const hookY = (i) => lerp(baseY + 1.2 + i * 1.5, -0.6 - (i - 1) * 1.5, up); // 2番目の針（かかった針）が水面に来るまで巻く
    const lineOn = step >= 2 && step < 4;
    main(lineOn ? [camp.winch.at(), P, [HX, Math.min(TOP, hookY(0) - 1.2), HZ]] : []);
    sinker.visible = lineOn;
    sinker.position.set(HX, Math.min(TOP - 0.4, hookY(0) - 1.4), HZ);
    const bite = step === 2 ? ease(span(p, 0.86, 1)) : step > 2 ? 1 : 0;
    for (let i = 0; i < HOOKS; i++) {
      const y = Math.min(TOP - 0.2, hookY(i));
      const shown = lineOn && y < TOP - 0.5;
      const sway = Math.sin(t * 0.8 + i) * 0.15;
      snoods[i](shown ? [[HX, y, HZ], [HX + 0.9, y - 0.25 + sway * 0.3, HZ + sway]] : []);
      baits.setAt(i, HX + 0.95, shown && !(i === 1 && bite > 0.6) ? y - 0.3 + sway * 0.3 : -99, HZ + sway);
    }
    baits.flush();
    // ニシオンデンザメ：においをたどってゆっくり近づき、餌をくわえる
    const hook = [HX + 0.9, hookY(1) - 0.25, HZ];
    const near = step < 2 ? 0 : step === 2 ? ease(span(p, 0.1, 0.9)) : 1;
    const tilt = lerp(0, 1.05, up) * (1 - (step === 4 ? ease(span(p, 0, 0.18)) : 0)); // 巻き上げる間は頭を上にする
    const lifted = step === 4 ? ease(span(p, 0.2, 0.48)) : 0;
    const swung = step === 4 ? ease(span(p, 0.48, 0.8)) : 0;
    const set = step === 4 ? ease(span(p, 0.8, 1)) : 0;
    // クレーンは前向きにたたんでおき、吊るときに穴の真上へ出して、船上の水槽の上へ回す
    const out = step === 4 ? ease(span(p, 0, 0.16)) : 0;
    const ang = lerp(lerp(0, Math.PI / 2, out), Math.PI * 1.02, swung);
    const reach = lerp(lerp(11.8, HZ - CRANE_Z, out), 3.9, swung);
    const tip = ship.lift.aim(Math.cos(ang) * reach, Math.sin(ang) * reach);
    // かかった針の先に体が下がる。船へ運ぶときは水面で体を水平にして、担架ごと吊る
    const hx = hook[0] + Math.cos(tilt) * LEN * 0.5;
    const hy = hook[1] - Math.sin(tilt) * LEN * 0.5;
    let sp = [lerp(HX + 34, hx, near), lerp(bedY + 4.5, hy, near) + Math.sin(t * 0.5) * 0.3 * (1 - bite), lerp(HZ - 7, HZ, near)];
    if (step === 4) {
      const level = ease(span(p, 0, 0.18));
      sp = [lerp(lerp(hx, HX, level), tip[0], swung), lerp(lerp(lerp(hy, -0.25, level), 9.6, lifted), tankAt[1], set), lerp(HZ, tip[2], swung)];
    }
    shark.visible = step >= 2;
    shark.position.set(sp[0], sp[1], sp[2]);
    shark.rotation.set(0, Math.PI + (step === 2 ? (1 - near) * 0.25 : 0), tilt);
    shark.swim(t * (step === 3 ? 0.7 : step === 4 ? 0.25 : 0.45)); // 泳ぎはとてもゆっくり
    shark.shade(step < 4 ? 0.8 : 1);
    const slung = step === 4 ? ease(span(p, 0.04, 0.2)) : 0;
    sling.visible = slung > 0.01;
    sling.position.set(sp[0], sp[1] - 0.15, sp[2]);
    sling.scale.set(1, slung, 1);
    const hk = [sp[0], sp[1] + 2.2, sp[2]];
    straps(slung > 0.5 ? [[sp[0] - 1.9, sp[1] + 0.5, sp[2]], hk, [sp[0] + 1.9, sp[1] + 0.5, sp[2]]] : []);
    wire(step === 4 ? [tip, slung > 0.5 ? hk : [tip[0], lerp(tip[1], 3, slung * 2), tip[2]]] : []);
    // 氷の下は薄暗い
    deep(0.5 * (step === 2 ? ease(span(p, 0, 0.12)) : step === 3 ? 1 : step === 4 ? 1 - ease(span(p, 0, 0.12)) : 0));
    update.shots[0] = [sx + 50, 14, 50, sx + 9, 2, 0];
    update.shots[3] = [HX - 15, lerp(-12, -5.5, up), HZ + 22, HX + 1, lerp(-18, -4.5, up), HZ];
  };
  update.shots = [null, [-36, 9, 42, HX, 2, HZ - 3], [HX - 17, -10, HZ + 22, HX + 3, -15, HZ], null, [-38, 13, 36, -9, 5, 8]];
  return update;
}
