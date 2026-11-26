import * as THREE from 'three';
import { BED, box, clamp01, diver, ease, fishSet, flagBuoy, lerp, makeLine, makeNet, mat, particles, prog, scoopNet, span } from './gearKit.js';

/** かご・つぼ・潜水の動き。各関数は update(step, p, t) を返す */

/** かご漁とたこつぼの共通の動き。幹縄につないだ入れ物を順に沈め、一晩おいて順に揚げる */
function groundLine({ group, boat, school, time }, { count, makeTrap, castStep, prey }) {
  const waitStep = castStep + 1;
  const haulStep = castStep + 2;
  const X0 = -24;
  const L = 48;
  const traps = Array.from({ length: count }, (_, i) => ({ x: X0 + (i / (count - 1)) * L, trap: makeTrap() }));
  const ground = makeLine(group, 0xf4e9c8, count + 6);
  const flags = [flagBuoy(group), flagBuoy(group)];
  const animals = fishSet(group, count, prey, 0.75, 0.9);
  school.mesh.visible = false;
  const update = (step, p, t) => {
    time(step < castStep ? 0 : step === castStep ? lerp(0, 0.35, p) : step === waitStep ? lerp(0.35, 1, span(p, 0, 0.5)) : lerp(0.7, 0.1, p));
    const sx = step < castStep ? X0 - 6 : step === castStep ? lerp(X0 - 6, X0 + L + 14, p) : X0 + L + 14; // 船尾（入れる位置）
    const hx = step === haulStep ? lerp(X0 - 3, X0 + L + 3, p) : -99; // 揚げている位置
    boat.place(step === haulStep ? hx - 1 : sx + 5.8, step === haulStep ? -1.7 : 0, 0);
    const bx = boat.position.x;
    const down = (x) => ease(clamp01((sx - x) / 11));
    const up = (x) => (step === haulStep ? ease(clamp01((hx + 10 - x) / 10)) : 0);
    const ends = [X0 - 2, X0 + L + 2];
    flags[0].visible = step >= castStep && step < haulStep;
    flags[1].visible = sx > ends[1] && hx < ends[1];
    flags.forEach((f, i) => f.position.set(ends[i], 0.15 + Math.sin(t * 2 + i) * 0.06, 0));
    const pts = step === haulStep ? [[hx, 1.3, -1.3]] : flags[0].visible ? [[ends[0], 0.2, 0], [ends[0], lerp(0, BED + 0.3, down(ends[0])), 0]] : [];
    traps.forEach(({ x, trap }, i) => {
      if (x > sx || x < hx) {
        // 甲板に積んである
        trap.position.set(bx + 0.2 + (i % 4) * 0.95, 1.6 + Math.floor(i / 4) * 0.8, ((i % 2) - 0.5) * 1.3);
        return animals.hide(i);
      }
      const y = lerp(lerp(0, BED + 0.5, down(x)), 1.4, up(x));
      const z = lerp(0, -1.3, up(x));
      trap.position.set(x, y, z);
      pts.push([x, y + 0.35, z]);
      // 獲物は待つ間に海底を寄ってきて中へ入る
      const when = 0.15 + (i / count) * 0.6;
      const side = i % 2 ? 1 : -1;
      if (step === waitStep && p < when) {
        const k = ease(p / when);
        animals.put(i, x + lerp(4, 0.3, k) * side, BED + 0.35, lerp(side * 7, 0.3, k), side > 0 ? 2.2 : -1, 0);
      } else if (step >= waitStep) animals.put(i, x, y + 0.05, z + 0.12, 0.6, 0, 0.8);
      else animals.hide(i);
    });
    if (step === castStep && sx < ends[1]) pts.push([sx, 0.9, 0]);
    else if (flags[1].visible) pts.push([ends[1], BED + 0.3, 0], [ends[1], 0.2, 0]);
    ground(pts);
    animals.flush();
  };
  const shots = [[-34, 9, 30, -24, 1, 0], [-32, 12, 42, 0, -5, 0], [-18, 4, 32, 0, -12, 0], [-30, 10, 38, 0, -5, 0]];
  update.shots = shots.slice(1 - castStep);
  return update;
}

function pots(ctx) {
  return groundLine(ctx, {
    count: 8, castStep: 1, prey: 0xb5482f,
    makeTrap: () => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 0.75, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xd8c77f, wireframe: true }));
      m.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), mat(0x7a3b2a)));
      ctx.group.add(m);
      return m;
    },
  });
}

function takotsubo(ctx) {
  return groundLine(ctx, {
    count: 12, castStep: 0, prey: 0xa8503c,
    makeTrap: () => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.9, 10).rotateZ(Math.PI / 2), mat(0x9a5a3a));
      ctx.group.add(m);
      return m;
    },
  });
}

/** 潜水採集：錨綱に沿って潜り、仕切り網へ静かに寄せて手網ですくう。浮上は水深5mで止まる */
function diving({ group, boat, school }) {
  const reefGeo = new THREE.DodecahedronGeometry(1, 0);
  const reefMat = new THREE.MeshStandardMaterial({ color: 0xc98a72, roughness: 1, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(reefGeo, i % 3 ? reefMat : mat(0xe6c35c, 1));
    const s = 1 + ((i * 7) % 5) * 0.4;
    m.scale.set(s * 1.3, s * 0.8, s);
    m.position.set(13 + ((i * 5) % 7) * 1.6, BED + s * 0.4, -6 + ((i * 3) % 8) * 2.1);
    group.add(m);
  }
  const anchor = makeLine(group, 0xf4e9c8, 2);
  const divers = [diver(group), diver(group)];
  const scoop = scoopNet(group, 0.55);
  const fence = makeNet(group, 14, 3, { floats: 8, floatColor: 0xf4d03f });
  const bubbles = particles(group, 36, 0xdff4fb, 0.2);
  const keeper = box(group, 0.7, 0.9, 0.7, 0x2a9bd6);
  box(boat, 0.9, 0.6, 0.05, 0x2a6fd6).position.set(-0.6, 5.1, 0.5);
  boat.place(-12, -6, 0);
  school.style(0xf2c53d, 0.8);
  school.set(9, BED + 3.2, 2, 4.5, 0.3);
  const TOP = [-6, -0.4, -6];
  const LOW = [1, BED + 3, -2];
  const update = (step, p, t) => {
    // 浮上は途中の水深5mで止まり、体を慣らす
    const rise = p < 0.35 ? ease(p / 0.35) * 0.62 : p < 0.7 ? 0.62 : 0.62 + ease((p - 0.7) / 0.3) * 0.38;
    const down = step === 0 ? 0 : step === 1 ? ease(p) : step === 2 ? 1 : 1 - rise;
    const reach = step === 2 ? ease(span(p, 0.1, 0.6)) : step === 3 ? 1 - ease(span(p, 0, 0.3)) : 0;
    anchor([[-5.6, 0.8, -6], [2, BED + 0.1, -2]]);
    divers.forEach((d, i) => {
      d.visible = step > 0 || p > 0.5;
      d.position.set(lerp(TOP[0], LOW[0], down) + reach * 4.6 - i * 1.6, lerp(TOP[1], LOW[1], down) + Math.sin(t * 2 + i) * 0.15 + i * 0.5, lerp(TOP[2], LOW[2], down) + reach * (i ? 5.5 : 1.5) + i * 1.2);
      d.rotation.set(0, step === 3 ? Math.PI : 0, step === 1 ? -0.6 : step === 3 && p > 0.7 ? 0.9 : step === 3 && p < 0.35 ? 0.7 : 0);
      d.kick(t + i);
    });
    const up = step === 2 ? ease(span(p, 0, 0.25)) : step === 3 ? 1 - ease(span(p, 0, 0.2)) : 0;
    fence.mesh.visible = up > 0;
    fence((u, v) => {
      const a = lerp(-1.25, 1.25, u);
      return [9 + Math.cos(a) * 4.6, BED + 0.2 + (1 - v) * 2.6 * up, 2 + Math.sin(a) * 4.6];
    });
    const took = step === 2 ? ease(span(p, 0.65, 0.9)) : step === 3 ? 1 : 0;
    scoop.visible = step >= 2;
    scoop.position.set(divers[0].position.x + (step === 3 ? -1.7 : 1.7), divers[0].position.y - 0.2, divers[0].position.z);
    scoop.rotation.z = step === 3 ? 0 : -Math.PI / 2 + took * 1.2;
    scoop.load.visible = took > 0.6;
    keeper.visible = step >= 1;
    keeper.position.set(divers[1].position.x, divers[1].position.y - 0.9, divers[1].position.z);
    for (let i = 0; i < 36; i++) {
      const d = divers[i % 2].position;
      bubbles.setAt(i, d.x + 0.9 + Math.sin(i * 3 + t) * 0.5, divers[0].visible ? Math.min(-0.1, d.y + ((t * 0.5 + i / 36) % 1) * 9) : -99, d.z + Math.cos(i * 2) * 0.4);
    }
    bubbles.flush();
    // 魚は追い立てず、仕切り網の奥へゆっくり寄せる
    school.set(lerp(9, 11.2, reach), BED + 2.4, 2, lerp(4.5, lerp(2, 1.1, took), reach), 0.3);
  };
  update.shots = [[-30, 10, 30, -10, 0, -5], [-28, 7, 36, -3, -7, -3], [-10, 4, 30, 7, -11, 1], [-28, 8, 34, -4, -5, -4]];
  return update;
}

export const TRAP_GEAR = { pots, takotsubo, diving };
