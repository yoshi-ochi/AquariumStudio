import * as THREE from 'three';
import { box, clamp01, diver, ease, fishSet, flagBuoy, lerp, makeLine, makeNet, mat, particles, prog, scoopNet, span, tags } from './gearKit.js';

/**
 * 川（と湖）の漁の動き。水深は浅く（bedY）、下流は -X。flow が 0 なら流れのない湖。
 * 川舟は流れに負けないよう舳先を上流（+X）へ向けて操る。各関数は update(step, p, t) を返す。
 */

function stake(group, x, z, bedY, top = 1.3) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, top - bedY, 5), mat(0xb9a25e));
  m.position.set(x, (top + bedY) / 2, z);
  group.add(m);
  return m;
}
/** 上流・下流の名札 */
function flowTags(group, flow) {
  const tag = tags(group, { up: '上流', down: '下流' });
  return (show) => {
    tag.up.at(30, 3.4, -14, show && flow > 0);
    tag.down.at(-30, 3.4, -14, show && flow > 0);
  };
}

/** 川の刺し網：流れを斜めに横切って張り、上流から追った魚を網目にかける */
function gill({ group, boat, school, bedY, flow }) {
  const A = [-4, -17];
  const B = [8, 15];
  const D = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const dir = [(B[0] - A[0]) / D, (B[1] - A[1]) / D];
  const crab = flow ? 0.6 : 0; // 流されないよう舳先を上流へ振る
  const yawAB = Math.atan2(-dir[1], dir[0]);
  const net = makeNet(group, 30, 4, { floats: 22, cell: 1.6 });
  stake(group, A[0], A[1], bedY);
  stake(group, B[0], B[1], bedY);
  const caught = fishSet(group, 10, 0xe6eed2, 0.75);
  const splash = particles(group, 18, 0xffffff, 0.25);
  const beater = makeLine(group, 0x4a3524, 2);
  const flowTag = flowTags(group, flow);
  const tag = tags(group, { net: '刺し網', drive: '竿で水面をたたく' });
  school.set(17, bedY + 1.2, -1, 6, 0.25);
  const onNet = (u, end) => [lerp(A[0], end[0], u) - Math.sin(u * Math.PI) * (flow ? 1.5 : 0), lerp(A[1], end[1], u)]; // 流れで下流へふくらむ
  const update = (step, p, t) => {
    const lay = prog(step, p, 0);
    const haul = step === 2 ? p : 0;
    const end = step === 2 ? [lerp(B[0], A[0], haul), lerp(B[1], A[1], haul)] : [A[0] + dir[0] * D * lay, A[1] + dir[1] * D * lay];
    let k = 0;
    if (step === 0) boat.place(end[0] + dir[0] * 3.6, end[1] + dir[1] * 3.6, yawAB + crab);
    else if (step === 2) boat.place(end[0] + 1.6, end[1] + 0.4, yawAB + Math.PI - crab);
    else if (p < 0.35) {
      // 網の上流へ回り込む
      const g = ease(p / 0.35);
      boat.place(lerp(B[0] + dir[0] * 3.6, 27, g), lerp(B[1] + dir[1] * 3.6, 3, g), lerp(yawAB + crab, 0, g));
    } else {
      // 舳先は上流のまま、流れに乗って網へ向かって下る
      k = (p - 0.35) / 0.65;
      boat.place(lerp(27, 13, k), 3 + Math.sin(k * Math.PI * 3) * 5, 0);
    }
    net.mesh.visible = step === 2 ? haul < 0.97 : lay > 0.02;
    net((u, v) => {
      const [x, z] = onNet(u, end);
      return [x, lerp(0.08, bedY + 0.15, v), z];
    });
    const hit = Math.abs(Math.sin(t * 5));
    const bx = boat.position.x;
    const bz = boat.position.z;
    beater(k > 0 ? [[bx - 2.3, 1.7, bz], [bx - 3.8, lerp(0, 2.4, hit), bz + 2]] : []);
    splash.visible = k > 0 && hit < 0.5;
    for (let i = 0; i < 18; i++) splash.setAt(i, bx - 3.8 + Math.cos(i * 2.4) * (1 - hit) * 1.6, (1 - hit) * hit * 5, bz + 2 + Math.sin(i * 2.4) * (1 - hit) * 1.6);
    splash.flush();
    // 魚は普段は流れに頭を向けて定位し、追われると下流へ逃げて網にかかる
    school.hold = flow > 0 && k === 0 && step < 2;
    school.set(lerp(17, 5, ease(k)), bedY + 1.2, -1, lerp(6, 3.5, k), 0.25);
    school.mesh.visible = step < 2;
    for (let i = 0; i < 10; i++) {
      const u = 0.1 + i * 0.085;
      if (!(step === 1 ? k > 0.4 + i * 0.05 : step === 2 && u < 1 - haul)) {
        caught.hide(i);
        continue;
      }
      const [x, z] = onNet(u, step === 2 ? B : end);
      caught.put(i, x, bedY * (0.25 + (i % 3) * 0.25), z, Math.PI + Math.sin(t * 9 + i) * 0.3);
    }
    caught.flush();
    flowTag(step === 0);
    tag.net.at(2, 1.6, -1, step === 0 && p > 0.5);
    tag.drive.at(bx - 3, 4, bz, k > 0 && k < 0.6);
  };
  update.shots = [[-22, 12, 34, 2, -1, 0], [-16, 10, 34, 10, -1, 0], [-20, 9, 32, 2, -1, 2]];
  return update;
}

/** 川の潜水・たも網採集：流れに頭を向けた魚へ下流側から近づき、石の下流に構えた網へ追い込む */
function diving({ group, boat, school, bedY, flow }) {
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x7d7c74, roughness: 1, flatShading: true });
  [[10.5, 0.4, 1.1], [11.6, -1.1, 0.8], [9.6, -1, 0.7]].forEach(([x, z, s]) => {
    const m = new THREE.Mesh(rockGeo, rockMat);
    m.scale.set(s * 1.3, s * 0.8, s);
    m.position.set(x, bedY + s * 0.5, z);
    group.add(m);
  });
  const anchor = makeLine(group, 0xf4e9c8, 2);
  const men = [diver(group, { tank: false, suit: 0x26323c }), diver(group, { tank: false, suit: 0x35506e })];
  const scoop = scoopNet(group, 0.6);
  box(boat, 0.9, 0.6, 0.7, 0x2a9bd6).position.set(0.3, 0.75, 0);
  const flowTag = flowTags(group, flow);
  const tag = tags(group, { bow: '舳先は上流へ', net: 'たも網', keeper: '活かし容器' });
  school.hold = true;
  school.set(9.4, bedY + 0.9, 0, 2.4, 0.2);
  const update = (step, p, t) => {
    // 下流から上ってきて、舳先を上流へ向けたまま錨で止める
    const bx = step === 0 ? lerp(-28, -8, ease(p)) : -8;
    boat.place(bx, 6, 0);
    anchor(step > 0 || p > 0.75 ? [[bx + 3.6, 0.5, 6], [bx + 9.5, bedY + 0.1, 6]] : []);
    const walk = ease(prog(step, p, 1));
    const round = step === 2 ? ease(span(p, 0, 0.5)) : step === 3 ? 1 : 0; // 1人が石の上流へ回る
    const back = step === 3 ? ease(p) : 0;
    const dart = step === 2 ? ease(span(p, 0.55, 0.75)) : step === 3 ? 1 : 0;
    men.forEach((d, i) => {
      d.visible = step >= 1;
      const x = i ? lerp(lerp(-6, 4, walk), 13.6, round) : lerp(-6, 5.6, walk);
      const z = i ? lerp(lerp(7, -3.5, walk), -0.4, round) - Math.sin(round * Math.PI) * 2 : lerp(5, 0.2, walk);
      d.position.set(lerp(x, -6.4, back), lerp(lerp(-0.25, bedY + 1.1, walk), -0.25, back) + Math.sin(t * 2 + i) * 0.08, lerp(z, 4.6 + i * 1.2, back));
      d.rotation.y = step === 3 || (i && round > 0.6) ? Math.PI : 0;
      d.kick(t + i);
    });
    school.hold = dart === 0;
    school.set(lerp(9.4, 7.5, dart), bedY + 0.9, 0, lerp(2.4, 0.6, dart), 0.2);
    school.mesh.visible = dart < 0.95;
    scoop.visible = step >= 1;
    const m0 = men[0].position;
    const stow = step === 3 ? ease(span(p, 0.7, 1)) : 0;
    scoop.position.set(lerp(m0.x + (step === 3 ? -1.7 : 1.7), bx + 0.3, stow), lerp(m0.y - 0.15, 1.5, stow), lerp(m0.z, 6, stow));
    scoop.rotation.z = step === 3 ? 0 : -Math.PI / 2;
    scoop.load.visible = dart > 0.9 && stow < 0.95;
    flowTag(step <= 1);
    tag.bow.at(bx + 3, 3.4, 6, step === 0 && p > 0.6);
    tag.net.at(m0.x + 1.7, m0.y + 1.6, m0.z, step === 2 && p < 0.5);
    tag.keeper.at(bx + 0.3, 3, 6, step === 3 && p > 0.5);
  };
  update.shots = [[-24, 9, 30, -4, -1, 4], [-16, 7, 26, 3, -1.5, 2], [-6, 5.5, 22, 8, -2, 0], [-20, 7, 26, -3, -1, 4]];
  return update;
}

/** 川のはえ縄：夕方、餌をつけた針の列を川底に斜めに延ばし、夜に動く底の魚を朝に揚げる */
function longline({ group, boat, school, bedY, flow, time }) {
  const A = [12, -13]; // 上流側（対岸寄り）
  const B = [-14, 12]; // 下流側（手前）
  const N = 11;
  const D = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const main = makeLine(group, 0xf4e9c8, N + 6);
  const hooks = Array.from({ length: N }, () => makeLine(group, 0xd9d2bd, 2));
  const marks = [A, B].map(([x, z]) => {
    const f = flagBuoy(group);
    f.scale.setScalar(0.6);
    f.position.set(x, 0.1, z);
    box(group, 0.7, 0.5, 0.7, 0x6f6f68).position.set(x, bedY + 0.25, z);
    return f;
  });
  const bite = [2, 5, 8];
  const cats = fishSet(group, 3, 0xa39770, 1.6, 0.6);
  const flowTag = flowTags(group, flow);
  const tag = tags(group, { stone: '石の錘', hook: '針と餌' });
  school.hold = flow > 0;
  school.set(-4, bedY + 1, -14, 4, 0.2);
  const at = (f) => [lerp(A[0], B[0], f), lerp(A[1], B[1], f)];
  const update = (step, p, t) => {
    time(step === 0 ? lerp(0.3, 0.55, p) : step === 1 ? lerp(0.55, 1, span(p, 0, 0.4)) : lerp(0.7, 0.1, p));
    // 入れるときは流れに乗って斜めに下り、揚げるときは下流の端から上流へたぐる。舳先はいつも上流
    const k = step === 0 ? p : step === 1 ? 1 : 1 - p;
    const E = at(k);
    boat.place(E[0] - 3.8, E[1] + 0.3, flow ? 0.3 : -0.8);
    const sink = (f) => ease(clamp01(((k - f) * D) / 4.5));
    marks[1].visible = step === 1;
    const pts = [[A[0], 0.1, A[1]], [A[0], bedY + 0.3, A[1]]];
    for (let i = 0; i < N; i++) {
      const f = (i + 0.5) / N;
      const [x, z] = at(f);
      const y = lerp(0.5, bedY + 0.15, sink(f));
      const on = f < k;
      if (on) pts.push([x, y, z]);
      hooks[i](on ? [[x, y, z], [x - 0.8, y + 0.1, z + 0.3]] : []); // 餌は流れで下流へなびく
      const j = bite.indexOf(i);
      if (j < 0) continue;
      const when = 0.3 + j * 0.2;
      if (!on || step === 0) cats.hide(j);
      else if (step === 1 && p < when) {
        // 夜になると深みから出て、においをたどって上ってくる
        const g = ease(p / when);
        cats.put(j, lerp(x - 9, x - 1.6, g), bedY + 0.4, lerp(z + (j % 2 ? 5 : -5), z + 0.3, g), Math.sin(t * 4 + j) * 0.3);
      } else cats.put(j, x - 1.7 + Math.sin(t * 5 + j) * 0.2, y + 0.15, z + 0.3 + Math.cos(t * 4 + j) * 0.3, Math.sin(t * 5 + j) * 0.8);
    }
    pts.push(step === 1 ? [B[0], bedY + 0.3, B[1]] : [E[0], 0.6, E[1]]);
    if (step === 1) pts.push([B[0], 0.1, B[1]]);
    main(pts);
    cats.flush();
    flowTag(step === 0);
    tag.stone.at(A[0], bedY + 1.8, A[1], step === 0 && p < 0.5);
    tag.hook.at(0, bedY + 1.8, 0, step === 1 && p < 0.5);
  };
  update.shots = [[-24, 12, 34, 0, -1, 0], [-14, 6, 28, -2, -2.5, 0], [-24, 9, 32, 0, -1, 0]];
  return update;
}

/** 川の筒・かご漁：餌を入れた筒を岸寄りの川底に沈め、夜ににおいをたどって上る魚を待つ */
function pots({ group, boat, school, bedY, flow, time }) {
  const N = 6;
  const Z = -15;
  const traps = Array.from({ length: N }, (_, i) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 1.5, 8, 1, true).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb9a25e, roughness: 0.8, side: THREE.DoubleSide }));
    group.add(m);
    const x = -18 + i * 7.2;
    stake(group, x, -21.6, 0.2, 1.6);
    return { x, m, cord: makeLine(group, 0xf4e9c8, 2) };
  });
  const eels = fishSet(group, N, 0x8d9a62, 1.4, 0.35);
  const scent = particles(group, 36, 0xe9d9a8, 0.14);
  const flowTag = flowTags(group, flow);
  const tag = tags(group, { tube: '筒（口は下流向き）', scent: '餌のにおい' });
  school.hold = flow > 0;
  school.set(6, bedY + 1.2, 4, 5, 0.2);
  const update = (step, p, t) => {
    time(step === 1 ? lerp(0, 0.4, p) : step === 2 ? lerp(0.4, 1, span(p, 0, 0.4)) : step === 3 ? lerp(0.7, 0.1, p) : 0);
    // 岸沿いを上流へ進みながら、1つずつ沈める（揚げるときも同じ向き）
    const bx = step === 0 ? -24 : step === 2 ? 26 : lerp(-24, 26, p);
    boat.place(bx, Z + 4, 0);
    traps.forEach(({ x, m, cord }, i) => {
      const k = step === 1 ? clamp01((bx - 1 - x) / 3) : step === 2 ? 1 : step === 3 ? 1 - clamp01((bx + 4 - x) / 3) : 0;
      if (k <= 0) {
        m.position.set(bx - 0.6 + (i % 3) * 0.7, 0.8 + Math.floor(i / 3) * 0.55, Z + 4);
        cord([]);
        return eels.hide(i);
      }
      m.position.set(x, lerp(0.7, bedY + 0.3, ease(k)), lerp(Z + 3, Z, ease(k)));
      cord([[x, m.position.y, m.position.z], [x, 1.2, -21.6]]);
      const when = 0.25 + (i / N) * 0.55;
      if (step === 2 && p < when) eels.put(i, lerp(x - 10, x - 1.4, ease(p / when)), bedY + 0.3, Z + Math.sin(t * 3 + i) * 0.4, Math.sin(t * 6 + i) * 0.4);
      else if (step >= 2) eels.put(i, x - 0.5, m.position.y, m.position.z, Math.sin(t * 5 + i) * 0.15, 0, 0.8);
      else eels.hide(i);
    });
    eels.flush();
    scent.visible = step === 2;
    for (let i = 0; i < 36; i++) {
      const k = (t * 0.25 + i / 36) % 1;
      scent.setAt(i, traps[i % N].x - 0.8 - k * (flow ? 8 : 2.5), bedY + 0.4 + k * 0.7, Z + Math.sin(i * 2.1) * k * (flow ? 0.8 : 2.5));
    }
    scent.flush();
    flowTag(step <= 1);
    tag.tube.at(traps[2].x, bedY + 1.8, Z, step === 2 && p < 0.5);
    tag.scent.at(traps[3].x - 4.5, bedY + 2.2, Z, step === 2 && p > 0.15 && p < 0.6);
  };
  update.shots = [[-32, 8, 22, -22, 0, -10], [-22, 10, 32, 0, -1, -10], [-12, 5.5, 22, 0, -2.5, -13], [-22, 9, 30, 0, -1, -10]];
  return update;
}

/** 川の張り網：杭で固定した袖網と袋網で、流れを上る魚を袋の奥へ導く */
function setnet({ group, boat, school, bedY, flow }) {
  const MZ = -7; // 袋網の口の位置（x=4）
  const posts = [[-10, -17], [-10, 4], [4, MZ - 2.3], [4, MZ + 2.3], [14.6, MZ]].map(([x, z]) => stake(group, x, z, bedY));
  const wings = [0, 1].map(() => makeNet(group, 14, 4, { floats: 8 }));
  const bag = makeNet(group, 16, 10);
  const hoops = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 5, 18).rotateY(Math.PI / 2), mat(0xb9a25e));
    group.add(m);
    return m;
  });
  const flowTag = flowTags(group, flow);
  const tag = tags(group, { wing: '袖網', bag: '袋網' });
  school.hold = flow > 0;
  const route = [[-24, -6], [-9, -6.5], [3, MZ], [10, MZ]];
  const update = (step, p, t) => {
    const built = prog(step, p, 0);
    const lift = step === 2 ? ease(span(p, 0.3, 1)) : 0;
    const w = ease(span(built, 0.2, 0.7));
    const b = ease(span(built, 0.5, 1));
    posts.forEach((m, i) => (m.visible = built > i * 0.1));
    const move = step === 1 ? ease(span(p, 0, 0.3)) : step === 2 ? 1 - ease(span(p, 0, 0.3)) : 0;
    boat.place(lerp(lerp(-14, 15.5, built), 22, move), lerp(lerp(8, -3.6, built), 6, move), 0.25);
    wings.forEach((net, i) => {
      net.mesh.visible = w > 0;
      net((u, v) => [lerp(4, -10, u * w), lerp(0.08, bedY + 0.1, v), lerp(MZ + (i ? 2.3 : -2.3), i ? 4 : -17, u * w)]);
    });
    const cy = bedY / 2;
    const ry = -bedY / 2 - 0.15;
    // 袋網は上流へ向かって細くなる。揚げるときは尻を解いて舟へ引き上げる
    const shape = (v) => {
      const up = lift * clamp01((v - 0.3) / 0.7);
      return [4 + v * 10.4 * b, lerp(cy, 1, up), MZ + up * 2.6, 1 - v * 0.8];
    };
    bag.mesh.visible = b > 0;
    bag((u, v) => {
      const a = u * Math.PI * 2;
      const [x, y, z, k] = shape(v);
      return [x, y + Math.sin(a) * ry * k, z + Math.cos(a) * 2.3 * k];
    });
    hoops.forEach((h, i) => {
      const [x, y, z, k] = shape(i / 3);
      h.visible = b > 0.2;
      h.position.set(x, y, z);
      h.scale.set(1, ry * k, 2.3 * k);
    });
    if (step === 1) {
      // 岸沿いを上ってきた魚は袖網に沿って口へ導かれる
      const s = p * (route.length - 1);
      const i = Math.min(route.length - 2, Math.floor(s));
      school.hold = false;
      school.set(lerp(route[i][0], route[i + 1][0], s - i), bedY + 1.3, lerp(route[i][1], route[i + 1][1], s - i), lerp(4, 1.5, p), 0.2);
    } else if (step === 2) school.set(lerp(10, 12.6, lift), lerp(bedY + 1.5, 0.7, lift), MZ + lift * 2.2, 1.2, 0.2);
    else school.set(-24, bedY + 1.3, -6, 4, 0.2);
    flowTag(step === 0);
    tag.wing.at(-4, 1.6, -11.5, step === 0 && p > 0.7);
    tag.bag.at(9, 1.8, MZ, step === 0 && p > 0.9 || (step === 1 && p < 0.4));
  };
  update.shots = [[-22, 12, 32, 0, -1, -5], [-26, 8, 30, -4, -1.5, -5], [-4, 7, 24, 10, -1, -5]];
  return update;
}

export const RIVER_GEAR = { gill, diving, longline, pots, setnet };
