import * as THREE from 'three';
import { BED, box, clamp01, crew, diver, ease, fishSet, flagBuoy, lerp, makeLine, makeNet, mat, particles, prog, span } from './gearKit.js';
import { birds } from './fishingFx.js';

/** 曳く網・追い込む網の動き。各関数は update(step, p, t) を返す */

/** オッタートロール：開口板で網口を広げて海底を曳き、船尾のスリップウェイから揚げる */
function trawl({ group, boat, school, scroll }) {
  const net = makeNet(group, 18, 14);
  const warps = [0, 1].map(() => makeLine(group, 0x30363c, 2));
  const sweeps = [0, 1].map(() => makeLine(group, 0xf4e9c8, 2));
  const boards = [0, 1].map(() => box(group, 2.2, 1.6, 0.22, 0x4a5560));
  const mud = particles(group, 50, 0xcdb98a, 0.45);
  const flock = birds(group, 10);
  const BX = 16;
  boat.place(BX, 0, 0);
  school.set(BX - 20, BED + 1.6, 0, 6, 0.1);
  const update = (step, p, t) => {
    const pay = step === 0 ? ease(p) * 0.22 : step === 1 ? 0.22 + ease(p) * 0.78 : step === 2 ? 1 : 1 - ease(span(p, 0, 0.75));
    const deck = step === 3 ? ease(span(p, 0.75, 1)) : 0; // 袋網を甲板へ引き上げる
    scroll(step === 2 ? 4 : step === 3 ? 1 : 3);
    const down = ease(span(pay, 0.22, 1));
    const mx = BX - 9 - pay * 23 + deck * 6.5; // 網口の位置
    const low = lerp(-1.2, BED + 0.25, down) + deck * 2.6; // 網の下端（グランドロープ）の深さ
    const open = lerp(1.2, 5.2, span(pay, 0.3, 1));
    const fill = step === 2 ? p : step === 3 ? 1 : 0;
    net((u, v) => {
      const a = u * Math.PI * 2;
      const k = 1 - v * 0.86 + fill * 0.3 * Math.exp(-(((v - 0.88) / 0.1) ** 2)); // 魚がたまると袋網がふくらむ
      return [mx - v * 11, low + open * 0.42 * k * (1 + Math.sin(a)), Math.cos(a) * open * k];
    });
    boards.forEach((b, i) => {
      const s = i ? 1 : -1;
      b.visible = pay > 0.22 && deck === 0;
      b.position.set(mx + 4, low + 0.9, s * (open + 1.7));
      b.rotation.y = s * 0.45;
      warps[i](b.visible ? [[BX - 5.6, 1.5, s * 1.1], [mx + 4, low + 0.9, s * (open + 1.7)]] : []);
      sweeps[i](b.visible ? [[mx + 4, low + 0.9, s * (open + 1.7)], [mx, low + open * 0.42, s * open]] : [[BX - 5.6, 1.3, s * 0.6], [mx, low + open * 0.42, s * open]]);
    });
    mud.visible = step === 2;
    for (let i = 0; i < 50; i++) {
      const k = (t * 0.7 + i / 50) % 1;
      mud.setAt(i, mx + 4 - k * 10, BED + 0.3 + k * 1.8 * ((i % 5) / 5), (i % 2 ? 1 : -1) * (open + 1.7 - k * 1.4) + Math.sin(i * 5) * 0.5);
    }
    mud.flush();
    // 海底の魚は開口板と手綱に追われ、網口から袋網の奥へ入る
    if (step === 2) school.set(lerp(mx + 12, mx - 7.5, ease(p)), low + 1.4, 0, lerp(6, 1.5, p), 0.1);
    else if (step === 3) school.set(mx - 8.8, low + 1, 0, 1.3, 0.2);
    flock(t, mx - 7, 0, step === 3 ? span(p, 0.4, 1) : 0, 4);
  };
  update.shots = [[0, 12, 40, 8, -2, 0], [-8, 11, 56, -5, -7, 0], [-12, 7, 56, -7, -9, 0], [0, 10, 36, 8, -2, 0]];
  return update;
}

/** かけまわし：浮標から綱・網・綱の順にひし形に入れ、綱を寄せて海底の魚を網へ追い込む */
function kakemawashi({ group, boat, school }) {
  const ropes = [0, 1].map(() => makeLine(group, 0xf4e9c8, 40));
  const net = makeNet(group, 14, 10);
  const mark = flagBuoy(group);
  const mud = particles(group, 60, 0xcdb98a, 0.4);
  const W = 14;
  const AX = -22;
  const NX = 20;
  const path = [[AX, 0], [0, -W], [NX, 0], [0, W], [AX, 0]];
  const onPath = (k) => {
    const s = clamp01(k) * 4;
    const i = Math.min(3, Math.floor(s));
    return [lerp(path[i][0], path[i + 1][0], s - i), lerp(path[i][1], path[i + 1][1], s - i)];
  };
  school.style(0x7a5f3a);
  school.set(4, BED + 0.8, 0, 9, 0.04);
  const update = (step, p, t) => {
    const run = prog(step, p, 1);
    const pull = ease(prog(step, p, 3));
    const lift = ease(prog(step, p, 4));
    const k0 = Math.min(run, 0.985);
    const [bx, bz] = onPath(run);
    const [hx, hz] = onPath(k0);
    const [nx, nz] = onPath(k0 + 0.01);
    boat.place(bx, bz, Math.atan2(-(nz - hz), nx - hx));
    mark.visible = step < 2 || (step === 2 && p < 0.5);
    mark.position.set(AX, 0.2 + Math.sin(t * 2) * 0.06, 0);
    // 綱は海底をはい、巻くにつれて間がせばまる
    const netX = lerp(lerp(NX, 0, pull), AX + 6, lift);
    const netY = lerp(BED + 0.2, -1.6, lift);
    const laid = (k) => {
      const [x, z] = onPath(k);
      return [lerp(x, AX + 6, pull * 0.55), BED + 0.2, z * (1 - pull * 0.85)];
    };
    const tip = (s) => [netX, netY + 0.3, s * W * 0.34 * (1 - pull * 0.6)];
    ropes.forEach((line, side) => {
      const s = side ? 1 : -1;
      if (lift > 0) return line([[AX, 1, s * 0.6], tip(s)]);
      // 1本目は浮標から網まで、2本目は網から船まで。入れている途中の端は船尾にある
      const a = side ? 0.5 : 0;
      const b = Math.min(side ? 1 : 0.5, run);
      if (b <= a) return line([]);
      const pts = side ? [] : [[AX, 0.3, 0]];
      for (let i = 0; i <= 30; i++) pts.push(laid(lerp(a, b, i / 30)));
      if (side || run < 0.5) pts.push(run >= 1 ? [AX, 0.6, 0.5] : [bx, 0.6, bz]);
      line(pts);
    });
    net.mesh.visible = run >= 0.5;
    net((u, v) => [netX + v * 9, netY + Math.sin(u * Math.PI) * 2.4 * (1 - v * 0.7), (u - 0.5) * 2 * tip(1)[2] * (1 - v * 0.85)]);
    mud.visible = step === 3;
    for (let i = 0; i < 60; i++) {
      const [x, y, z] = laid(i / 60);
      mud.setAt(i, x, y + ((t * 0.7 + i * 0.13) % 1) * 1.5, z);
    }
    mud.flush();
    school.set(lift > 0 ? netX + 4 : lerp(4, netX + 3, pull), lerp(BED + 0.8, netY + 1, lift), 0, lerp(9, 1.8, pull), 0.04 + lift * 0.2);
  };
  update.shots = [[-42, 12, 30, -18, -3, 0], [-10, 50, 38, -4, -6, 0], [-44, 13, 28, -14, -4, 0], [-12, 36, 42, -2, -8, 0], [-42, 9, 28, -14, -3, 0]];
  return update;
}

/** 船びき網：2隻で袋網を曳き、表層〜中層の小さな魚を獲る */
function boatseine({ group, boat, makeBoat, school, scroll }) {
  const mate = makeBoat(0x8a5a2a);
  const net = makeNet(group, 18, 12, { cell: 2.2 });
  const ropes = [0, 1].map(() => makeLine(group, 0xf4e9c8, 2));
  const flock = birds(group, 8);
  school.style(0xe8eef0, 0.55);
  school.set(-4, -4, 0, 8, 0.2);
  const update = (step, p, t) => {
    const out = ease(prog(step, p, 0));
    const shut = step === 2 ? ease(p) : 0;
    scroll(step === 1 ? 3.2 : step === 0 ? 1.5 : 0.6);
    const gap = lerp(lerp(2.6, 10, out), 2.6, shut);
    const back = lerp(4, 24, out);
    boat.place(14, -gap, 0);
    mate.place(14, gap, 0);
    const nx = 8 - back + shut * 14;
    const ny = lerp(-0.8, -5, out) * (1 - shut) - shut * 0.5;
    const fill = step === 1 ? p : step === 2 ? 1 : 0;
    net((u, v) => {
      const a = u * Math.PI * 2;
      const k = 1 - v * 0.88 + fill * 0.2 * Math.exp(-(((v - 0.9) / 0.1) ** 2));
      return [nx - v * 12, ny + Math.sin(a) * 2.8 * k, Math.cos(a) * gap * 0.62 * k];
    });
    ropes.forEach((r, i) => r([[8.4, 1.3, (i ? 1 : -1) * gap], [nx, ny, (i ? 1 : -1) * gap * 0.62]]));
    // 群れは網口に包まれ、袋網の奥へ入る
    if (step === 0) school.set(nx - 4, -4, 0, 8, 0.2);
    else if (step === 1) school.set(lerp(nx + 6, nx - 9, ease(p)), ny, 0, lerp(7, 1.8, p), 0.2);
    else school.set(nx - 10, ny, 0, 1.5, 0.2);
    flock(t, nx - 9, 0, step === 2 ? p : 0, 4);
  };
  update.shots = [[-6, 16, 42, 4, -2, 0], [-10, 20, 56, -4, -4, 0], [-4, 9, 30, 10, -1, 0]];
  return update;
}

/** 地びき網：沖へ半円に入れた網を、浜の両側から人の手で引き寄せる */
function beachseine({ group, boat, school }) {
  const SAND = 0xe2cf9c;
  box(group, 320, 2.2, 80, SAND).position.set(0, -0.7, 61);
  const slope = box(group, 320, 0.6, 33, SAND);
  slope.position.set(0, -4.85, 5.5);
  slope.rotation.x = -Math.atan2(10.4, 31);
  const bottom = (z) => lerp(-10, 0.3, clamp01((z + 10) / 31)); // 浜へ向かって浅くなる
  const net = makeNet(group, 30, 5, { floats: 24 });
  const ropes = [0, 1].map(() => makeLine(group, 0xf4e9c8, 2));
  const teams = [-1, 1].map((s) => [0, 1, 2, 3].map((j) => crew(group, s * 18, 0.4, 23 + j * 1.2, j % 2 ? 0x35506e : 0xd9822b)));
  const flop = fishSet(group, 14, 0xc9dbe6, 0.6);
  const flock = birds(group, 10);
  school.set(0, -3, 2, 7, 0.15);
  const update = (step, p, t) => {
    const lay = prog(step, p, 1);
    const pull = ease(prog(step, p, 2));
    const land = ease(prog(step, p, 3));
    const a = Math.PI * (1 - lay);
    boat.visible = step < 2;
    if (step === 0) boat.place(-16, lerp(15, 8, ease(p)), Math.PI / 2);
    else boat.place(Math.cos(a) * 16, 8 - Math.sin(a) * 14, Math.atan2(-14 * Math.cos(a), 16 * Math.sin(a)));
    const RX = lerp(16, lerp(6, 3.5, land), pull);
    const cz = lerp(8, lerp(18.5, 21, land), pull);
    const AZ = lerp(14, lerp(5, 2.6, land), pull);
    net.mesh.visible = lay > 0;
    net((u, v) => {
      const ang = Math.PI - u * Math.PI * lay;
      const z = cz - Math.sin(ang) * AZ;
      const floor = bottom(z) + 0.15;
      return [Math.cos(ang) * RX, lerp(Math.max(0.1, floor + 0.15), Math.max(floor, -4.9), v), z];
    });
    teams.forEach((team, i) => {
      const s = i ? 1 : -1;
      const tx = s * lerp(18, lerp(7, 4, land), pull);
      team.forEach((c, j) => {
        c.position.set(tx + s * j * 0.25, 0.4, 23.5 + j * 1.25 + (step === 2 ? Math.sin(t * 5 + j) * 0.14 + pull * 2 : pull * 2));
        c.rotation.x = step === 2 ? 0.22 : 0;
      });
      // 左の綱は最初に浜へ固定し、右の綱は船が戻ってから渡す
      const far = step === 0 ? [boat.position.x, 0.7, boat.position.z] : i === 0 || lay >= 1 ? [s * RX, 0.1, cz] : null;
      ropes[i](far && (i === 0 || lay >= 1) ? [[tx, 1.3, 23.5 + pull * 2], far] : []);
    });
    for (let i = 0; i < 14; i++) {
      if (land < 0.5) {
        flop.hide(i);
        continue;
      }
      const hop = Math.abs(Math.sin(t * 6 + i * 2.1));
      flop.put(i, ((i * 5) % 9) - 4, 0.55 + hop * 0.5, 20.6 + ((i * 3) % 5) * 0.4, i * 1.3, hop * 0.9);
    }
    flop.flush();
    school.set(0, lerp(-3, -0.9, pull), lerp(2, lerp(16, 19.5, land), pull), lerp(7, lerp(3, 1.6, land), pull), 0.15);
    school.mesh.visible = land < 0.6;
    flock(t, 0, 19, step === 3 ? p : step === 2 ? pull * 0.5 : 0, 5);
  };
  update.shots = [[-30, 12, 46, -8, 0, 14], [-10, 30, 54, 0, -2, 6], [-26, 14, 52, 0, -1, 12], [-13, 8, 40, 0, 0.5, 19]];
  return update;
}

/** 追い込み網：サンゴ礁に袖網と袋網を張り、潜り手が脅し縄で群れを追い込む */
function oikomi({ group, boat, school }) {
  const reefMat = new THREE.MeshStandardMaterial({ color: 0xd88a6a, roughness: 1, flatShading: true });
  const reefGeo = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(reefGeo, i % 3 ? reefMat : mat(0xe6c35c, 1));
    const s = 1 + ((i * 7) % 5) * 0.45;
    m.scale.set(s * 1.3, s * 0.8, s);
    m.position.set(-34 + ((i * 11) % 26) * 2.4, BED + s * 0.4, (i % 2 ? 1 : -1) * (9 + ((i * 5) % 7) * 2));
    group.add(m);
  }
  const wings = [0, 1].map(() => makeNet(group, 14, 5, { floats: 10 }));
  const bag = makeNet(group, 20, 9);
  const swimmers = [0, 1, 2, 3].map(() => diver(group));
  const scare = makeLine(group, 0xffffff, 8);
  const strips = particles(group, 36, 0xffffff, 0.3);
  const bubbles = particles(group, 32, 0xdff4fb, 0.2);
  const hoist = makeLine(group, 0xf4e9c8, 2);
  boat.place(17, -9, 0);
  school.style(0xf2a03a);
  school.set(-18, BED + 4, 0, 6);
  const update = (step, p, t) => {
    const set = ease(prog(step, p, 0));
    const chase = prog(step, p, 1);
    const lift = step === 2 ? ease(span(p, 0.25, 1)) : 0;
    const shut = step === 2 ? ease(span(p, 0, 0.3)) : 0;
    wings.forEach((w, i) => {
      const s = i ? 1 : -1;
      w.mesh.visible = lift < 0.2;
      w((u, v) => [lerp(11, 11 - 22 * set, u), BED + 0.2 + (1 - v) * 6.5, s * lerp(2.6, 2.6 + 13 * set, u)]);
    });
    const by = lerp(BED + 3.4, -1, lift);
    const bx = lerp(11, 14, lift);
    const bz = lerp(0, -7, lift);
    bag((u, v) => {
      const a = u * Math.PI * 2;
      const k = (1 - v * 0.72) * (1 - shut * (1 - v) * 0.9); // 口を絞ってから揚げる
      return [bx + v * 8 * set, by + Math.sin(a) * 3.2 * k, bz + Math.cos(a) * 3.2 * k];
    });
    hoist(lift > 0 ? [[15, 2.6, -8.4], [bx, by + 0.4, bz]] : []);
    const dx = lerp(-30, 4, ease(chase));
    const pts = [];
    swimmers.forEach((d, i) => {
      d.visible = step === 1;
      d.position.set(dx + Math.sin(i * 2 + t) * 0.6, BED + 3 + (i % 2) * 2.4 + Math.sin(t * 2 + i) * 0.25, (i - 1.5) * lerp(8, 2.2, chase));
      d.kick(t + i);
      pts.push([d.position.x + 1.4, d.position.y - 0.3, d.position.z]);
    });
    scare(step === 1 ? pts : []);
    strips.visible = bubbles.visible = step === 1;
    for (let i = 0; i < 36; i++) {
      const [x, y, z] = pts[Math.floor(i / 9)];
      const [x2, y2, z2] = pts[Math.min(3, Math.floor(i / 9) + 1)];
      const k = (i % 9) / 9;
      strips.setAt(i, lerp(x, x2, k), lerp(y, y2, k) - 0.4 - Math.abs(Math.sin(t * 7 + i)) * 0.5, lerp(z, z2, k));
    }
    for (let i = 0; i < 32; i++) {
      const d = swimmers[i % 4].position;
      bubbles.setAt(i, d.x + 0.8 + Math.sin(i * 3 + t) * 0.4, Math.min(-0.1, d.y + ((t * 0.5 + i / 32) % 1) * 9), d.z + Math.cos(i * 2) * 0.4);
    }
    strips.flush();
    bubbles.flush();
    school.set(lift > 0 ? bx + 4.5 : lerp(-18, 15, ease(chase)), lift > 0 ? by : BED + 4, bz, lerp(6, 2, chase), 0.3);
  };
  update.shots = [[-20, 22, 36, 2, -9, 0], [-30, 26, 32, -2, -10, 0], [-6, 10, 32, 12, -4, -3]];
  return update;
}

export const TOW_GEAR = { trawl, kakemawashi, boatseine, beachseine, oikomi };
