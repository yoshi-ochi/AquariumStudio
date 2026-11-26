import { BED, box, clamp01, ease, fishSet, flagBuoy, glow, lamp, lerp, makeLine, makeNet, particles, prog, scoopNet, span, tags } from './gearKit.js';
import { birds, nabura } from './fishingFx.js';

/** 囲む網・待つ網の動き。各関数は update(step, p, t) を返す。update.shots は作業ごとのカメラ [位置, 注視点] */

/** たも網で魚をすくって運ぶ1往復。k は 0〜1 */
function carry(scoop, k, from, to, top = 4.2) {
  const back = 1 - ease(span(k, 0.8, 1));
  const up = ease(span(k, 0.1, 0.4)) * back;
  const over = ease(span(k, 0.35, 0.65)) * back;
  scoop.position.set(lerp(from[0], to[0], over), lerp(from[1], top, up), lerp(from[2], to[2], over));
  scoop.load.visible = k > 0.08 && k < 0.72;
}

/** まき網：鳥山とナブラで群れを見つけ、円く囲んで底を締め、魚捕りへ寄せてすくう */
function purse({ group, boat, makeBoat, school }) {
  const net = makeNet(group, 48, 8, { floats: 36, cell: 1.4 });
  const skiff = makeBoat(0xd9822b, 'skiff');
  const carrier = makeBoat(0x3f6d4e);
  const tow = makeLine(group, 0xf4e9c8, 2);
  const wire = makeLine(group, 0x30363c, 2);
  const boil = nabura(group);
  const flock = birds(group, 14);
  const scoop = scoopNet(group, 1.1);
  const tag = tags(group, { tori: '鳥山', boil: 'ナブラ', skiff: 'レッコ艇', wire: '環ワイヤー', bag: '魚捕り', carrier: '運搬船' });
  const R = 14;
  const CX = 2;
  const PX = CX - R; // 網の両端が集まる位置（網船）
  const update = (step, p, t) => {
    const sweep = prog(step, p, 1) * Math.PI * 2;
    const close = ease(prog(step, p, 2));
    const haul = ease(prog(step, p, 3));
    const radius = lerp(R, 4.6, haul);
    const cx = PX + radius + 1.7 * haul;
    // 網船：群れの脇へ進み、右回りに囲んで元の位置へ戻る
    const a0 = Math.PI - sweep;
    if (step === 0) boat.place(PX, lerp(-46, 0, ease(p)), -Math.PI / 2);
    else boat.place(CX + Math.cos(a0) * R, Math.sin(a0) * R, Math.atan2(Math.cos(a0), Math.sin(a0)));
    const depth = 11 * (1 - haul * 0.55);
    net.mesh.visible = sweep > 0.02;
    net((u, v) => {
      const a = Math.PI - u * sweep;
      const sunk = step === 1 ? clamp01(((1 - u) * sweep) / 1.3 + 0.12) : 1; // 入れたばかりの所はまだ沈みきっていない
      const w = close * v ** 1.5 * 0.94; // 環締め：網裾が網船の舷側へ集まる
      return [lerp(cx + Math.cos(a) * radius, PX + 2.4, w), 0.1 - v * depth * sunk * (1 - close * v * 0.4), lerp(Math.sin(a) * radius, 0, w)];
    });
    wire(step === 2 ? [[PX + 0.6, 1.4, 0], [PX + 2.4, 0.1 - depth * 0.6, 0]] : []);
    // レッコ艇：網の端を持って待ち、囲み終えたら網船を網の外へ引く
    const off = step === 1 ? ease(span(p, 0.8, 1)) : step > 1 ? 1 : 0;
    const towing = ease(prog(step, p, 2));
    skiff.visible = step > 0 || p > 0.85;
    skiff.place(lerp(PX - 2.6 * off, PX - 8.5, towing), lerp(-0.4 - 2.6 * off, 0, towing), lerp(-Math.PI / 2, Math.PI, towing));
    tow(step >= 2 ? [[PX - 1.6, 1, 0], [skiff.position.x + 3.2, 0.6, skiff.position.z]] : []);
    // 群れ：海面で沸く → 締められて潜る → 魚捕りへ寄せられる
    const dive = step === 2 ? Math.sin(p * Math.PI) : 0;
    const fx = lerp(CX, cx, haul);
    school.set(fx, lerp(-1.6, -2.6, haul) - dive * 6.5, 0, lerp(6, 2.8, haul), 0.2);
    boil(t, fx, 0, lerp(5, 3, haul), step < 2 ? 1 : step === 2 ? 1 - p : step === 3 ? p * 0.7 : 0.7);
    flock(t, fx, 0, step === 2 ? lerp(1, 0.4, p) : step === 3 ? lerp(0.4, 1, p) : 1);
    const carX = cx + radius + 1.9;
    carrier.visible = step === 4;
    carrier.place(carX, lerp(-36, 0, ease(span(p, 0, 0.3))), -Math.PI / 2);
    scoop.visible = step === 4 && p > 0.3;
    carry(scoop, (span(p, 0.3, 1) * 2.999) % 1, [cx, -0.5, 0], [carX, 0, 0]);
    tag.tori.at(CX, 11, 0, step === 0);
    tag.boil.at(CX, 1.2, 7, step === 0);
    tag.skiff.at(skiff.position.x, 3.4, skiff.position.z, step === 1);
    tag.wire.at(PX + 4, -8, 0, step === 2);
    tag.bag.at(cx, 3, 0, step === 3);
    tag.carrier.at(carX, 6.5, 0, step === 4 && p > 0.3);
  };
  update.shots = [[-42, 15, 34, -2, 1, 0], [-14, 42, 36, 0, -3, 0], [-36, 8, 30, -4, -5, 0], [-36, 14, 28, -6, -2, 0], [-30, 10, 24, -6, 0, 0]];
  return update;
}

/** 定置網：垣網で沖へ導き、運動場から登り網を上った魚を箱網にためる。夜明けに網を起こす */
function setnet({ group, boat, makeBoat, school, time }) {
  box(group, 34, 2.4 - BED, 90, 0xcdbb8a).position.set(-58, (2.4 + BED) / 2, 0);
  box(group, 30, 0.6, 90, 0x7fa35c).position.set(-60, 2.7, 0);
  const leader = makeNet(group, 22, 5, { floats: 14 });
  const yards = [0, 1].map(() => makeNet(group, 16, 5, { floats: 12 }));
  const ramp = makeNet(group, 8, 8);
  const pocket = makeNet(group, 30, 9, { floats: 26 });
  const side = makeBoat(0x7a4a2a);
  const boil = nabura(group, 40);
  const flock = birds(group, 10);
  const scoop = scoopNet(group, 1);
  const tag = tags(group, { coast: '岸', leader: '垣網', yard: '運動場', ramp: '登り網', pocket: '箱網' });
  const LX = -41;
  const route = [[-28, 30], [-28, 4], [-16, 2.5], [-5, 0], [-5, 0], [7, 0], [17, 0]];
  const update = (step, p, t) => {
    const built = prog(step, p, 0);
    time(step === 1 ? lerp(0, 0.9, p) : step === 2 ? lerp(0.9, 0.5, span(p, 0, 0.5)) : step === 3 ? lerp(0.5, 0, p) : 0);
    const a1 = span(built, 0, 0.3);
    const a2 = span(built, 0.25, 0.55);
    const a3 = span(built, 0.5, 0.75);
    const a4 = span(built, 0.7, 1);
    leader.mesh.visible = a1 > 0;
    leader((u, v) => [LX + u * a1 * 27, 0.1 - v * 12.5, 0]);
    yards.forEach((yard, i) => {
      yard.mesh.visible = a2 > 0;
      yard((u, v) => {
        const a = (i ? -1 : 1) * lerp(Math.PI - 0.42, 0.3, u * a2); // 垣網の両脇と登り網の前は開けておく
        return [-5 + Math.cos(a) * 9, 0.1 - v * 12.5, Math.sin(a) * 8];
      });
    });
    ramp.mesh.visible = a3 > 0;
    ramp((u, v) => [4 + v * 7 * a3, lerp(-12.5, -3, v * a3), (u - 0.5) * lerp(5, 3.4, v)]);
    // 網起こし：入口側から網をたぐって底を持ち上げ、魚を奥の魚捕りへ寄せる
    const haul = ease(prog(step, p, 2));
    const front = lerp(8, 22.5, haul);
    pocket.mesh.visible = a4 > 0;
    pocket((u, v) => {
      const a = u * Math.PI * 2;
      const k = v < 0.55 ? 1 : 1 - ((v - 0.55) / 0.45) * 0.96;
      const x = 17 + Math.cos(a) * 7 * k;
      return [x, 0.1 - Math.min(1, v / 0.55) * lerp(8.5, 0.9, clamp01((front - x) / 3.5)) * a4, Math.sin(a) * 5 * k];
    });
    const go = step < 2 ? 0 : step === 2 ? ease(span(p, 0, 0.2)) : 1;
    const bx0 = lerp(-34, 4, ease(built));
    boat.place(lerp(bx0, front - 1.5, go), lerp(-13, -6.8, go), 0);
    side.place(lerp(bx0 - 14, front - 1.5, go), lerp(-15, 6.8, go), 0);
    if (step === 0) school.set(-28, -6, 30, 5);
    else if (step === 1) {
      const s = p * (route.length - 1);
      const i = Math.min(route.length - 2, Math.floor(s));
      school.set(lerp(route[i][0], route[i + 1][0], s - i), i >= 4 ? -4.5 : -6, lerp(route[i][1], route[i + 1][1], s - i), i >= 3 ? 3.2 : 4.5);
    } else school.set(Math.min(21.5, Math.max(17, front + 2.2)), lerp(-4.5, -1, haul), 0, lerp(3.5, 1.9, haul), 0.25);
    boil(t, 21, 0, 2.6, step >= 2 ? span(haul, 0.6, 1) * 0.8 : 0);
    flock(t, 21, 0, step === 3 ? 1 : step === 2 ? span(haul, 0.5, 1) : 0);
    scoop.visible = step === 3;
    carry(scoop, (p * 2.999) % 1, [21, -0.4, 0], [21, 0, -6.8], 4);
    tag.coast.at(-52, 6, 0, step <= 1);
    tag.leader.at(LX + 13, 2.2, 0, step <= 1 && a1 >= 1);
    tag.yard.at(-5, 2.2, 0, step <= 1 && a2 >= 1);
    tag.ramp.at(7.5, 2.2, 5, step <= 1 && a3 >= 1);
    tag.pocket.at(17, 2.2, -4, a4 >= 1 && step <= 2);
  };
  update.shots = [[-28, 46, 46, -14, -4, 0], [-42, 24, 42, -8, -5, 2], [2, 15, 32, 16, -2, 0], [8, 9, 22, 20, 0, -1]];
  return update;
}

/** 底刺し網：夕方に潮を横切って張り、夜に動く魚を網目にかけ、朝に揚げる */
function gill({ group, boat, school, time }) {
  const H = 3.4;
  const X0 = -24;
  const X1 = 24;
  const TOP = BED + H;
  const net = makeNet(group, 36, 4, { floats: 20, floatColor: 0xf4d03f });
  const flags = [flagBuoy(group), flagBuoy(group)];
  const risers = [makeLine(group, 0xf4e9c8, 2), makeLine(group, 0xf4e9c8, 2)];
  const caught = fishSet(group, 14, 0xe0b98a, 1.25);
  const tide = particles(group, 46, 0xdff4fb, 0.16);
  const tag = tags(group, { flag: 'ボンデン（旗）', float: '浮子綱', sink: '沈子綱', tide: '潮の流れ' });
  school.style(0xc9a37a);
  school.set(0, BED + 2, 26, 7, 0.1);
  const spot = (i) => [X0 + 5 + ((i * 5) % 14) * 3.1, BED + 0.6 + ((i * 3) % 7) * 0.4];
  const update = (step, p, t) => {
    time(step === 0 ? 0.45 : step === 1 ? lerp(0.5, 1, span(p, 0, 0.4)) : lerp(0.75, 0.15, p));
    // 投網は船尾から繰り出し、揚網は入れ始めの端からたぐる
    const sx = step === 0 ? lerp(X0, X1 + 15, p) : X1 + 15;
    const hx = step === 2 ? lerp(X0 - 2, X1 + 2, p) : -99;
    boat.place(step === 2 ? hx - 1 : sx + 5.5, step === 2 ? -1.6 : 0, 0);
    const rise = (x) => (step === 2 ? ease(clamp01((hx + 12 - x) / 12)) : 0);
    const yAt = (x, v) => lerp(lerp(lerp(0.2, -0.7, v), lerp(TOP, BED + 0.1, v), ease(clamp01((sx - x) / 14))), 1.3, rise(x));
    const from = Math.max(X0, hx);
    const to = Math.min(X1, sx);
    net.mesh.visible = to - from > 0.3;
    net((u, v) => {
      const x = lerp(from, to, u);
      return [x, yAt(x, v), lerp(0, -1.6, rise(x))];
    });
    flags.forEach((f, i) => {
      const x = i ? X1 : X0;
      f.visible = (i ? sx > X1 : true) && hx < x;
      f.position.set(x, 0.15 + Math.sin(t * 2 + i) * 0.06, 0);
      risers[i](f.visible ? [[x, 0.2, 0], [x, yAt(x, 0), 0]] : []);
    });
    for (let i = 0; i < 14; i++) {
      const [x, y] = spot(i);
      if (!(step === 1 ? p > 0.4 + i * 0.035 : step === 2 && x > hx)) {
        caught.hide(i);
        continue;
      }
      caught.put(i, x, lerp(y, 1.2, rise(x)), lerp(0.1, -1.6, rise(x)), Math.PI / 2 + (i % 2 ? 0.7 : -0.7) + Math.sin(t * 9 + i) * 0.25);
    }
    caught.flush();
    school.set(0, BED + 2, step === 0 ? 26 : step === 1 ? lerp(26, -24, p) : -30, 7, 0.1);
    for (let i = 0; i < 46; i++) tide.setAt(i, ((i * 13.7) % 60) - 30, BED + 1 + ((i * 3.1) % 12), ((((i * 7.3 - t * 2.2) % 50) + 50) % 50) - 25);
    tide.flush();
    tag.flag.at(X0 + 3, 3.8, 0, step === 0);
    tag.float.at(-6, TOP + 1, 0, step === 1 && p < 0.5);
    tag.sink.at(8, BED - 0.9, 0, step === 1 && p < 0.5);
    tag.tide.at(16, -5, 12, step === 1);
  };
  update.shots = [[-30, 13, 42, 2, -6, 0], [-20, 5, 34, 0, -10, 0], [-30, 10, 36, 0, -6, 0]];
  return update;
}

/** さんま棒受け網：右舷で集める間に左舷へ網を張り、灯りの切り替えで網の上へ誘導する */
function bouke({ group, boat, school, time }) {
  const STAR = 7; // 右舷の魚群の位置
  const PORT = -10; // 左舷の網の位置
  const xs = [-6, -3, 0, 3, 6];
  const starLamps = xs.map((x) => lamp(group, x, 4, 2.4));
  const portLamps = xs.map((x) => lamp(group, x, 4, -2.4));
  const reds = [-3, 0, 3].map((x) => lamp(group, x, 3.4, -2.6, 0xff3b30));
  const lightS = glow(group, 0, 8);
  const lightP = glow(group, 0, -8);
  const lightR = glow(group, 0, -8, 0xff4a3a);
  const net = makeNet(group, 22, 10, { floats: 18 });
  const poles = [-7, 7].map(() => makeLine(group, 0xd9c9a0));
  const hose = makeLine(group, 0x2a7fb5, 12);
  const pumped = particles(group, 26, 0xdcebf2, 0.3);
  const tag = tags(group, { lamp: '集魚灯', red: '赤色灯', net: '棒受け網', pump: 'フィッシュポンプ' });
  boat.place(0, 0, 0);
  school.style(0x9fc4de);
  school.set(0, -8, 26, 9);
  time(1);
  const update = (step, p, t) => {
    // 灯り：右舷→左舷へ順に点灯→赤色灯
    const star = step === 0 ? p : step === 1 ? 1 : step === 2 ? 1 - span(p, 0, 0.4) : 0;
    const port = step === 0 ? p : step === 1 ? 1 - span(p, 0, 0.3) : step === 2 ? span(p, 0.3, 1) : 0;
    const red = step >= 3 ? 1 : 0;
    starLamps.forEach((l) => (l.visible = star > 0.1));
    portLamps.forEach((l, i) => (l.visible = step === 2 ? span(p, 0.3 + i * 0.12, 0.42 + i * 0.12) > 0 : port > 0.1));
    reds.forEach((l) => (l.visible = red > 0));
    lightS.intensity = star * 200;
    lightP.intensity = port * 200;
    lightR.intensity = red * 60;
    // 網：左舷に張り出し、起こすと舷側へたぐり寄せる
    const spread = ease(prog(step, p, 1));
    const haul = ease(prog(step, p, 4));
    net.mesh.visible = spread > 0;
    const edge = lerp(PORT - 8, -3, haul);
    net((u, v) => [(u - 0.5) * lerp(20, 13, haul), 0.1 - Math.sin((1 - v) * Math.PI) * lerp(7, 1.5, haul) * spread, lerp(edge, -2.6, v) * spread - 2.6 * (1 - spread)]);
    poles.forEach((line, i) => line(spread > 0 ? [[i ? 7 : -7, 1.2, -2], [(i ? 10 : -10) * lerp(1, 0.65, haul), 0.2, lerp(-2.6, edge, spread)]] : []));
    hose(step === 5 ? [[0, 1.8, -2], [0, 0.8, -3.2], [0, -0.5, -4.5]] : []);
    pumped.visible = step === 5;
    for (let i = 0; i < 26; i++) {
      const k = (t * 1.3 + i / 26) % 1;
      pumped.setAt(i, Math.sin(i * 3) * 0.15, lerp(-0.5, 1.8, k), lerp(-4.5, -2, k));
    }
    pumped.flush();
    // 魚群：右舷へ集まる→船の下をくぐって網の上へ
    if (step === 0) school.set(0, lerp(-8, -3, p), lerp(26, STAR, p), lerp(9, 5.5, p));
    else if (step === 1) school.set(0, -3, STAR, 5);
    else if (step === 2) {
      const k = span(p, 0.15, 1);
      school.set(0, -3 - Math.sin(k * Math.PI) * 2.5, lerp(STAR, PORT, k), 5);
    } else if (step === 3) school.set(0, -2, PORT, 4, 0.15);
    else if (step === 4) school.set(0, lerp(-2, -0.9, p), lerp(PORT, -5, p), lerp(4, 2, p), 0.15);
    else school.set(0, -0.8, -5, lerp(2, 0.6, p), 0.15);
    tag.lamp.at(0, 6, 2.4, step <= 1);
    tag.net.at(0, 2, PORT - 4, step === 1 || step === 2);
    tag.red.at(0, 5.4, -2.6, step === 3);
    tag.pump.at(0, 3.4, -3.4, step === 5);
  };
  update.shots = [[-30, 13, 38, 0, -2, 4], [-30, 15, 30, 0, -2, -4], [-34, 11, 24, 0, -3, -2], [-28, 13, -30, 0, -1, -8], [-26, 11, -28, 0, -1, -6], [-18, 8, -22, 0, 0, -4]];
  return update;
}

export const NET_GEAR = { purse, setnet, gill, bouke };
