import * as THREE from 'three';
import { BED, box, buoy, clamp01, crew, ease, fishMesh, fishSet, glow, lamp, lerp, makeLine, particles, prog, span, tags } from './gearKit.js';
import { birds, nabura } from './fishingFx.js';

/** 釣りの動き。各関数は update(step, p, t) を返す */

/** 一本釣り：鳥山とナブラへ船を寄せ、活き餌と散水で群れを船べりに留めて竿で跳ね上げる */
function pole({ group, boat, school }) {
  const boil = nabura(group, 70);
  const flock = birds(group, 14);
  const xs = [-4.4, 0.3, 1.6, 2.9, 4.1];
  xs.forEach((x) => crew(boat, x, 1.15, 1.1, 0xe9d23c));
  const rods = xs.map(() => ({ rod: makeLine(group, 0x3b2a1a, 2), line: makeLine(group, 0xe6eef2, 2) }));
  const flying = fishSet(group, xs.length, 0x3f5f86, 1.3);
  const spray = particles(group, 60, 0xffffff, 0.2);
  const bait = particles(group, 26, 0xcfe6f2, 0.3);
  const tag = tags(group, { tori: '鳥山', boil: 'ナブラ', bait: '活き餌（イワシ）', spray: '散水' });
  school.style(0x4f6f96, 1.3);
  const update = (step, p, t) => {
    const bx = step === 0 ? lerp(-40, 0, ease(p)) : 0;
    boat.place(bx, 0, 0);
    // ナブラは餌をまくと船べりへ寄ってくる
    const near = ease(prog(step, p, 1));
    const nx = lerp(8, 1, near);
    const nz = lerp(16, 7.5, near);
    school.set(nx, -1.8, nz, lerp(6, 4.5, near), 0.2);
    boil(t, nx, nz, lerp(5, 4, near), step === 0 ? 0.8 : 1);
    flock(t, nx, nz, 1, 7);
    bait.visible = step === 1 || step === 3;
    spray.visible = step >= 2;
    for (let i = 0; i < 60; i++) {
      const k = (t * 1.5 + i / 60) % 1;
      spray.setAt(i, -4.5 + (i % 16) * 0.62, 1.7 + k * 2.2 - k * k * 4, 1.5 + k * 6.5);
    }
    for (let i = 0; i < 26; i++) {
      const k = (t * 0.9 + i / 26) % 1;
      bait.setAt(i, 0.5 + (i % 7) * 0.6, 2.2 + k * 2 - k * k * 4.4, 1.4 + k * 5.5);
    }
    spray.flush();
    bait.flush();
    rods.forEach(({ rod, line }, i) => {
      const x = bx + xs[i];
      if (step < 3) {
        rod([]);
        line([]);
        return flying.hide(i);
      }
      const f = (t * 0.55 + i * 0.23) % 1;
      const s = ease(span(f, 0.4, 0.6)) * (1 - ease(span(f, 0.78, 1))); // 竿を立てる
      const tip = [x, lerp(3.4, 6.4, s), lerp(4.8, 1, s)];
      const q = span(f, 0.4, 0.74); // かかった魚が海面から甲板へ飛ぶ
      const fish = [x, -0.3 + Math.sin(q * Math.PI) * 5.5 + q * 2.4, lerp(6.4, -0.3, q)];
      const hooked = q > 0 && q < 1;
      rod([[x, 2.5, 1.35], tip]);
      line([tip, hooked ? fish : [x, -0.3, 6.4]]);
      if (hooked) flying.put(i, fish[0], fish[1], fish[2], Math.PI / 2, 1.2 - q * 2.4 + Math.sin(t * 20) * 0.2);
      else flying.hide(i);
    });
    flying.flush();
    tag.tori.at(nx, 12, nz, step === 0);
    tag.boil.at(nx + 6, 1.2, nz, step === 0);
    tag.bait.at(4, 4.2, 5, step === 1);
    tag.spray.at(-3, 4.4, 5, step === 2);
  };
  update.shots = [[-38, 13, 38, -4, 1, 8], [-22, 9, 32, 1, 0, 6], [-18, 8, 30, 1, 0.5, 5], [-13, 6.5, 25, 1, 1.6, 3]];
  return update;
}

/** はえ縄：浮標でつった幹縄に枝縄を等間隔に下げ、広い範囲を泳ぐ魚を待つ */
function longline({ group, boat, school }) {
  const N = 13;
  const X0 = -30;
  const L = 60;
  const MAIN = -4;
  const HOOK = 5.5;
  const main = makeLine(group, 0xf4e9c8, 40);
  const sets = Array.from({ length: N }, (_, i) => ({ x: X0 + (i / (N - 1)) * L, branch: makeLine(group, 0xd9d2bd, 2), drop: i % 4 ? null : makeLine(group, 0xd9d2bd, 2), float: i % 4 ? null : buoy(group) }));
  const bite = [1, 5, 6, 10]; // 魚がかかる枝縄
  const tuna = fishSet(group, 6, 0x25364f, 2.6);
  const flock = birds(group, 8);
  const tori = makeLine(group, 0xe5412d, 2);
  const streamers = particles(group, 10, 0xff5a3a, 0.35);
  const tag = tags(group, { main: '幹縄', branch: '枝縄', float: '浮標', tori: 'トリライン（鳥よけ）' });
  school.mesh.visible = false;
  const update = (step, p, t) => {
    const head = step === 0 ? lerp(X0 - 2, X0 + L + 14, p) : X0 + L + 14; // 縄を繰り出す位置（船尾）
    const hx = step === 2 ? lerp(X0 - 3, X0 + L + 2, p) : -99; // 揚げている位置
    boat.place(step === 2 ? hx - 1 : head + 5.8, step === 2 ? -1.7 : 0, 0);
    const down = (x) => ease(clamp01((head - x) / 12));
    const up = (x) => (step === 2 ? ease(clamp01((hx + 11 - x) / 11)) : 0);
    const mainY = (s) => lerp((MAIN - (s.float ? 0 : 1.2)) * down(s.x), 1, up(s.x)); // 浮標の間はたるむ
    const hookY = (s) => mainY(s) - HOOK * down(s.x) * (1 - up(s.x) * 0.7);
    const pts = step === 2 ? [[hx, 1.2, -1.2]] : [];
    sets.forEach((s, i) => {
      const on = s.x <= head && s.x >= hx;
      const z = lerp(0, -1.2, up(s.x));
      if (on) pts.push([s.x, mainY(s), z]);
      s.branch(on ? [[s.x, mainY(s), z], [s.x + 0.6, hookY(s), z]] : []);
      if (!s.float) return;
      s.float.visible = on;
      s.float.position.set(s.x, 0.2 + Math.sin(t * 2 + i) * 0.06, 0);
      s.drop(on ? [[s.x, 0.2, 0], [s.x, mainY(s), z]] : []);
    });
    if (step === 0) pts.push([head, 0.9, 0]);
    main(pts);
    for (let j = 0; j < 6; j++) {
      if (step === 0) {
        tuna.hide(j);
        continue;
      }
      const s = sets[bite[j % 4]];
      const when = 0.2 + j * 0.18;
      if (j >= 4) tuna.put(j, -40 + ((t * 3 + j * 30) % 80), -15 + j, 7 - (j - 4) * 14, 0, 0);
      else if (step === 2 || p > when) {
        // かかった魚は枝縄の先で暴れ、揚がると船へ取り込まれる
        if (s.x < hx) tuna.hide(j);
        else tuna.put(j, s.x + 0.6 + Math.sin(t * 3 + j) * 0.5, hookY(s), lerp(0, -1.2, up(s.x)) + Math.cos(t * 2.3 + j) * 0.4, Math.sin(t * 1.5 + j) * 1.2, Math.sin(t * 4 + j) * 0.2);
      } else {
        const k = ease(clamp01(p / when));
        tuna.put(j, lerp(s.x - 26, s.x - 0.8, k), lerp(-12, hookY(s), k), lerp(9, 0, k), -0.25 * (1 - k), 0);
      }
    }
    tuna.flush();
    // 投縄中は餌を狙う海鳥が船尾につく。トリラインで針に近づけない
    flock(t, step === 2 ? hx : head - 9, 0, step === 0 ? 0.7 : step === 2 ? 0.5 : 0, 5);
    tori(step === 0 ? [[head + 1.5, 4.4, 0], [head - 17, 0.3, 0]] : []);
    streamers.visible = step === 0;
    for (let i = 0; i < 10; i++) streamers.setAt(i, head - 1 - i * 1.6, lerp(4.4, 0.3, (2.5 + i * 1.6) / 18.5) - 0.3 - Math.abs(Math.sin(t * 6 + i)) * 0.4, 0);
    streamers.flush();
    tag.tori.at(head - 7, 5.4, 0, step === 0 && p > 0.15);
    tag.float.at(sets[4].x, 2, 0, step === 1 && p < 0.6);
    tag.main.at(sets[6].x, MAIN + 0.4, 3, step === 1 && p < 0.6);
    tag.branch.at(sets[9].x + 3.4, -7.5, 0, step === 1 && p < 0.6);
  };
  update.shots = [[-34, 12, 42, 0, -4, 0], [-22, 6, 38, 0, -6, 0], [-30, 10, 38, -2, -4, 0]];
  return update;
}

/** 立て縄：潮上から錘つきの幹糸を沈め、海底近くの魚を針数だけ連ねて巻き上げる */
function tatenawa({ group, boat, school }) {
  const N = 12;
  const BX = 9;
  const main = makeLine(group, 0xf4e9c8, 2);
  const hooks = Array.from({ length: N }, () => makeLine(group, 0xd9d2bd, 2));
  const caught = fishSet(group, N, 0xd8352a, 1);
  const weight = box(group, 0.5, 0.7, 0.5, 0x4a5560);
  const tide = particles(group, 50, 0xdff4fb, 0.16);
  const tag = tags(group, { up: '潮上', tide: '潮の流れ', weight: '錘' });
  school.style(0xd8352a, 1.2);
  school.set(-3, BED + 2.5, 1.3, 6, 0.12);
  const update = (step, p, t) => {
    boat.place(step === 0 ? lerp(-24, BX, ease(p)) : BX, 0, 0);
    const depth = step === 0 ? 0 : step === 1 ? ease(p) : 1 - ease(span(p, 0.35, 1));
    // 仕掛けは潮に押され、潮下（-X）へ斜めに入っていく
    const top = [BX - 4.5, 1.4, 1.3];
    const end = [top[0] - depth * 7, lerp(0, BED + 0.5, depth), 1.3];
    const len = Math.hypot(end[0] - top[0], end[1] - top[1]) || 1;
    weight.visible = step > 0;
    weight.position.set(end[0], end[1], end[2]);
    main(step > 0 ? [top, end] : []);
    for (let i = 0; i < N; i++) {
      const d = 0.9 + i * 0.85;
      const x = end[0] + ((top[0] - end[0]) * d) / len;
      const y = end[1] + ((top[1] - end[1]) * d) / len;
      const on = step > 0 && d < len && y < -0.2;
      hooks[i](on ? [[x, y, 1.3], [x - 1.1, y - 0.25, 1.3]] : []);
      // 底に近い針から順に食いつき、赤い魚が連なって揚がる
      if (on && step === 2 && p > 0.03 + i * 0.025 && i % 4 !== 3) caught.put(i, x - 1.65 + Math.sin(t * 5 + i) * 0.12, y - 0.25, 1.3, 0, Math.sin(t * 6 + i) * 0.3);
      else caught.hide(i);
    }
    caught.flush();
    for (let i = 0; i < 50; i++) tide.setAt(i, ((((i * 7.3 - t * 1.8) % 60) + 60) % 60) - 30, BED + 0.6 + ((i * 3.1) % 13), ((i * 13.7) % 30) - 15);
    tide.flush();
    tag.up.at(BX, 6.5, 0, step === 0 && p > 0.7);
    tag.tide.at(-14, -6, 8, step <= 1);
    tag.weight.at(end[0] - 2.6, end[1] + 0.4, 1.3, step === 1 && p > 0.5);
  };
  update.shots = [[-30, 12, 40, 0, -5, 0], [-26, 6, 38, 1, -8, 0], [-24, 7, 34, 2, -7, 0]];
  return update;
}

/** ひき縄：鳥山を目印に群れの縁を走り、潜行板で潜らせた擬似餌を引く */
function troll({ group, boat, school, scroll }) {
  const BX = 12;
  const NZ = 11;
  const rigs = [-1, 0, 1].map((s) => ({ s, line: makeLine(group, 0xf4e9c8, 3), planer: box(group, 0.8, 0.08, 0.45, 0xf0c23c), lure: fishMesh(group, 0xf2f2f2, 0.6) }));
  const poles = [-1, 1].map(() => makeLine(group, 0x4a3524, 2));
  const hooked = fishMesh(group, 0x3f5f86, 1.6);
  const boil = nabura(group, 60);
  const flock = birds(group, 12);
  const splash = particles(group, 16, 0xffffff, 0.3);
  const tag = tags(group, { tori: '鳥山', planer: '潜行板', lure: '擬似餌' });
  boat.place(BX, 0, 0);
  school.style(0x4f6f96, 1.2);
  const update = (step, p, t) => {
    scroll(step === 2 ? 2.5 : 5);
    const reach = ease(prog(step, p, 0));
    // 群れを散らさないよう、ナブラの中へは入らず縁をかすめて走る
    const nx = step === 0 ? lerp(62, 40, p) : step === 1 ? lerp(40, -8, p) : lerp(-8, -30, p);
    boil(t, nx, NZ, 5, 1);
    flock(t, nx, NZ, 1, 6);
    school.set(nx, -1.8, NZ, 6, 0.2);
    const strike = step === 1 ? span(p, 0.72, 0.8) : step === 2 ? 1 : 0; // 右舷の糸に食いつく
    const haul = step === 2 ? ease(p) : 0;
    rigs.forEach(({ s, line, planer, lure }, i) => {
      const hit = s === 1 ? strike : 0;
      const pull = s === 1 ? haul : 0; // かかった糸は船尾で手でたぐる
      const z = s === 1 ? lerp(6.2, 1.3, pull) : s * 6.2;
      const from = s ? [lerp(BX - 1, BX - 5.4, pull), lerp(3.3, 1.5, pull), z] : [BX - 5.6, 1.5, 0];
      const px = lerp(from[0], lerp(BX - 20 - Math.abs(s) * 4, BX - 7, pull), reach);
      const py = lerp(lerp(0.5, -2.4, reach), 0.05, hit); // 魚がかかると潜行板が浮いて知らせる
      const lx = px - 4.2 * reach * (1 - pull * 0.6);
      const ly = py - 0.3 + Math.sin(t * 9 + i) * 0.12 * (1 - hit);
      line([from, [px, py, z], [lx, ly, z]]);
      planer.position.set(px, py, z);
      planer.rotation.z = lerp(-0.5, 0, hit);
      lure.position.set(lx, ly, z);
      lure.visible = hit === 0;
      if (s !== 1) return;
      hooked.visible = hit > 0 && haul < 0.97;
      hooked.position.set(lx + Math.sin(t * 9) * 0.3, lerp(ly - 0.3, 1.5, span(haul, 0.85, 1)), z + Math.sin(t * 7) * 0.8 * (1 - haul));
      hooked.rotation.y = Math.sin(t * 9) * 0.5;
      splash.visible = hit > 0 && haul < 0.4;
      for (let k = 0; k < 16; k++) {
        const f = (t * 2 + k / 16) % 1;
        splash.setAt(k, px + Math.cos(k * 2.4) * f * 1.6, f * (1 - f) * 3.2, z + Math.sin(k * 2.4) * f * 1.6);
      }
      splash.flush();
    });
    poles.forEach((l, i) => l([[BX - 1, 1.2, (i ? 1 : -1) * 1.2], [BX - 1, 3.3, (i ? 1 : -1) * 6.2]]));
    tag.tori.at(nx, 11, NZ, step <= 1 && nx < 52);
    tag.planer.at(rigs[2].planer.position.x, 1.6, 6.2, step === 0 && p > 0.5);
    tag.lure.at(rigs[2].lure.position.x - 1, -4.2, 6.2, step === 0 && p > 0.5);
  };
  update.shots = [[-24, 10, 36, 4, -1, 0], [-30, 15, 38, 2, -1, 3], [22, 9, 34, 2, 0, 3]];
  return update;
}

/** いか釣り：夜、集魚灯に寄ったイカを自動いか釣り機の擬餌針で釣り上げる */
function squid({ group, boat, school, time }) {
  const chute = new THREE.Mesh(new THREE.SphereGeometry(2.6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xd9822b, wireframe: true }));
  group.add(chute);
  const chuteLines = [-1, 1].map(() => makeLine(group, 0xf4e9c8, 2));
  const lamps = [-5, -3, -1, 1, 3, 5].flatMap((x) => [lamp(group, x, 4.9, 0.9), lamp(group, x, 4.9, -0.9)]);
  const sun = glow(group, 0, 0, 0xe9fbff);
  const reels = [-4.5, -2.5, -0.5, 1.5, 3.5].flatMap((x, i) => [-1, 1].map((s) => ({ x, s, ph: i * 0.23 + (s > 0 ? 0.5 : 0), line: makeLine(group, 0xbfe9ff, 3) })));
  const jigs = fishSet(group, reels.length * 3, 0xf3dccc, 0.75, 0.9);
  const drips = particles(group, 20, 0xcfe9f5, 0.18);
  const tag = tags(group, { chute: 'シーアンカー', lamp: '集魚灯', reel: '自動いか釣り機' });
  boat.place(0, 0, 0);
  school.style(0xf0d8c8, 0.9);
  school.set(0, BED + 3, 6, 9);
  const update = (step, p, t) => {
    time(step === 0 ? lerp(0.45, 0.85, p) : 1);
    const set = ease(prog(step, p, 0));
    chute.position.set(lerp(8, 20, set), -2.4, 0);
    chute.scale.setScalar(lerp(0.3, 1, set));
    chuteLines.forEach((l, i) => l([[6.4, 0.9, 0], [chute.position.x, -2.4 + (i ? 1 : -1) * 2.6 * chute.scale.x, 0]]));
    const on = prog(step, p, 1);
    lamps.forEach((l) => (l.visible = on > 0.05));
    sun.intensity = on * 260;
    // イカは光に寄るが、まぶしさを避けて船の影になる船底の下へ集まる
    school.set(0, lerp(BED + 3, -5.5, ease(on)), lerp(6, 0, on), lerp(9, 5.5, on), 0.3);
    reels.forEach(({ x, s, ph, line }, i) => {
      const f = (t * 0.22 + ph) % 1;
      const down = f < 0.35 ? f / 0.35 : 1 - (f - 0.35) / 0.65; // 落として、しゃくりながら巻き上げる
      const bottom = lerp(-1.5, -11.5, down) + (f > 0.35 ? Math.sin(t * 9 + i) * 0.35 : 0);
      line(step === 2 ? [[x, 1.5, s * 1.5], [x, 1.9, s * 2.6], [x, bottom, s * 2.9]] : []);
      for (let j = 0; j < 3; j++) {
        const y = bottom + 1 + j * 1.6;
        if (step === 2 && f > 0.4 && y < -0.2 && (i + j) % 3 !== 1) jigs.put(i * 3 + j, x, y, s * 2.9, 0, Math.PI / 2);
        else jigs.hide(i * 3 + j);
      }
    });
    jigs.flush();
    drips.visible = step === 2;
    for (let i = 0; i < 20; i++) {
      const k = (t * 1.6 + i / 20) % 1;
      drips.setAt(i, -4.5 + (i % 5) * 2, 1.9 - k * 1.9, (i % 2 ? 1 : -1) * (2.6 + k * 0.3));
    }
    drips.flush();
    tag.chute.at(chute.position.x, 1.4, 0, step === 0 && p > 0.5);
    tag.lamp.at(0, 6.6, 0, step === 1);
    tag.reel.at(3.5, 3.4, 2.6, step === 2 && p < 0.5);
  };
  update.shots = [[-22, 10, 38, 6, -2, 0], [-30, 10, 36, 0, -3, 0], [-20, 6, 30, 0, -3, 0]];
  return update;
}

export const LINE_GEAR = { pole, longline, tatenawa, troll, squid };
