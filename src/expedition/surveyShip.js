import * as THREE from 'three';
import { ease, lerp, makeLine, makeNet, particles, span } from './gearKit.js';
import { School } from './fishingFx.js';
import { beam, soften } from './surveyKit.js';
import { buildShip } from './surveyShips.js';
import { buildCtd, buildFrameNet } from './surveyTools.js';

const rnd = (i, s = 0) => {
  const v = Math.sin(i * 91.7 + s * 47.3) * 43758.5453;
  return v - Math.floor(v);
};
const wrap = (x, w) => ((((x + w / 2) % w) + w) % w) - w / 2;
const SX = 4; // 船の位置（船尾は SX - 18）
const NET_LEN = 10;
const WIDE = [-54, 10, 44, -24, -1.5, 0];

/** 調査船の共同運航：音波で深海散乱層を探し、CTDで水を測り、夜に浮上した散乱層を中層トロールで曳く */
export function shipSurvey({ group, stage, bedY, time, scroll }) {
  const ship = buildShip(stage, 'research');
  ship.root.place(SX);
  // 深海散乱層：光を放つ小さな生き物の帯
  const N = 180;
  const layer = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)), new THREE.PointsMaterial({ color: 0x8fe6ff, size: 0.6, blending: THREE.AdditiveBlending }));
  layer.frustumCulled = false;
  soften(layer, 0.5);
  group.add(layer);
  const school = new School(group, { count: 80, len: 0.55, color: 0xa9c6dc, floor: bedY });
  // 計量魚群探知機の音波
  const cone = beam(group, 30, 9, 0x7fe0ff, 0);
  cone.position.set(SX + 2, -2.2, 0);
  cone.rotation.z = -Math.PI / 2;
  const pings = Array.from({ length: 4 }, () => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9fecff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    group.add(m);
    return m;
  });
  const ctd = buildCtd(group);
  const ctdWire = makeLine(group, 0x30363c, 2);
  const flash = particles(group, 16, 0xffffff, 0.26);
  const frame = buildFrameNet(group);
  const net = makeNet(group, 16, 12, { cell: 2.6, color: 0xe6eef1 });
  const cod = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 1, 10).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf07a1f, roughness: 0.6 }));
  group.add(cod);
  const warp = makeLine(group, 0x30363c, 3);
  const catchGlow = particles(group, 18, 0x9ff2ff, 0.22);
  // 甲板の水槽（冷やした海水）
  const tank = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 1.4), new THREE.MeshStandardMaterial({ color: 0x2f73a8, roughness: 0.5 }));
  tank.position.set(-12.2, ship.deck + 0.45, 0.4);
  const tankWater = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7fd6ea }));
  tankWater.position.set(-12.2, ship.deck + 0.91, 0.4);
  ship.root.add(tank, tankWater);

  let last = 0;
  let dist = 0;
  let speed = 0;
  const update = (step, p, t) => {
    const dt = Math.min(0.1, Math.max(0, t - last));
    last = t;
    speed = step === 0 ? lerp(3, 0, ease(p)) : step === 1 ? 0 : step === 2 ? lerp(0, 1.5, ease(span(p, 0.2, 0.6))) : step === 3 ? 2.2 : lerp(1.5, 0.3, p);
    scroll(speed);
    dist += speed * dt;
    const k = step === 0 ? 0.12 : step === 1 ? lerp(0.12, 0.3, p) : step === 2 ? lerp(0.3, 0.62, p) : step === 3 ? lerp(0.62, 0.95, ease(p)) : lerp(0.95, 0.85, p);
    time(k);
    ship.night(k);
    ship.spin(t);
    // 散乱層は、暗くなると浅い方へ上がる
    const LY = step < 2 ? -26 : step === 2 ? lerp(-26, -15, ease(p)) : -15;
    const lp = layer.geometry.attributes.position;
    for (let i = 0; i < N; i++) lp.setXYZ(i, wrap((rnd(i, 1) - 0.5) * 150 - dist, 150), LY + (rnd(i, 2) - 0.5) * 5 + Math.sin(t * 0.6 + i) * 0.3, (rnd(i, 3) - 0.5) * 54);
    lp.needsUpdate = true;
    const sonar = step === 0 ? ease(span(p, 0.2, 0.45)) : 0;
    layer.material.opacity = lerp(0.3, 0.95, ease(span(k, 0.3, 0.8))) + sonar * 0.35;
    cone.material.opacity = sonar * 0.16;
    pings.forEach((m, j) => {
      const f = (t * 0.5 + j / pings.length) % 1;
      m.position.set(SX + 2, lerp(-2.4, LY, f), 0);
      m.scale.setScalar(lerp(0.8, 8.6, f));
      m.material.opacity = (1 - f) * 0.55 * sonar;
    });
    // CTD採水器：決めた深さで止めてボトルを閉じる
    const G = ship.ctd.at();
    const low = step === 1 ? ease(span(p, 0.04, 0.6)) - ease(span(p, 0.84, 1)) * 0.25 : 0;
    ctd.position.set(G[0], lerp(G[1] - 0.25, -21, low) + Math.sin(t * 1.4) * 0.05, G[2]);
    ctd.rotation.y = t * 0.25;
    ctdWire([G, [ctd.position.x, ctd.position.y, ctd.position.z]]);
    const fire = step === 1 ? span(p, 0.62, 0.84) : 0;
    flash.visible = fire > 0 && fire < 1;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      flash.setAt(i, ctd.position.x + Math.cos(a) * (0.7 + fire * 0.9), ctd.position.y - 1.3 + fire * 1.6 + (i % 3) * 0.2, ctd.position.z + Math.sin(a) * (0.7 + fire * 0.9));
    }
    flash.flush();
    // Aフレームと中層トロール。pay は繰り出したワイヤーの割合
    const swing = step < 2 ? 0 : step === 2 ? ease(span(p, 0, 0.3)) : step === 3 ? 1 : 1 - ease(span(p, 0.72, 1));
    ship.aframe.rotation.z = lerp(-0.3, 0.62, swing);
    const pay = step < 2 ? 0 : step === 2 ? ease(span(p, 0.3, 1)) : step === 3 ? 1 : 1 - ease(span(p, 0, 0.72));
    const B = ship.block.at();
    const towX = lerp(B[0], SX - 42, ease(pay));
    const towY = lerp(B[1] - 0.6, LY + 1.2, pay ** 1.3);
    const a = lerp(Math.PI / 2, 0.26, ease(span(pay, 0, 0.3))); // 吊っている間は網口が上、曳くと前を向く
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    frame.rotation.z = a;
    frame.position.set(towX - (3.65 * ca - 0.3 * sa), towY - (3.65 * sa + 0.3 * ca), 0);
    const len = lerp(0.7, NET_LEN, ease(span(pay, 0.04, 0.5)));
    const fill = step === 3 ? p : step === 4 ? 1 : 0;
    const at = (lx, ly, lz) => [frame.position.x + lx * ca - ly * sa, frame.position.y + lx * sa + ly * ca, lz];
    net((u, v) => {
      const ang = u * Math.PI * 2;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const sq = lerp(1 / Math.max(Math.abs(c), Math.abs(s)), 1, Math.min(1, v * 2.5)); // 枠の所は四角、奥は丸い
      const r = 1.6 * sq * (1 - v * 0.86 + fill * 0.16 * Math.exp(-(((v - 0.9) / 0.1) ** 2)));
      return at(-v * len, s * r, c * r);
    });
    cod.position.set(...at(-len - 0.45, 0, 0));
    cod.rotation.z = a;
    warp([ship.drum.at(), B, [towX, towY, 0]]);
    // 散乱層の生き物が網に入り、採集容器へ集まる
    if (step < 3) school.set(SX - 34, LY, 0, 9, 0.12);
    else if (step === 3) school.set(lerp(frame.position.x + 9, cod.position.x + 1.5, ease(p)), lerp(LY, cod.position.y, ease(p)), 0, lerp(8, 1.3, ease(p)), 0.16);
    else school.set(cod.position.x + 1.2, cod.position.y, 0, 1.1, 0.2);
    school.mesh.visible = cod.position.y < -0.6;
    const tk = step === 4 ? ease(span(p, 0.84, 1)) : 0;
    catchGlow.visible = fill > 0.3;
    for (let i = 0; i < 18; i++) {
      const j = t * 3 + i * 1.7;
      catchGlow.setAt(i, lerp(cod.position.x, SX - 12.2, tk) + Math.sin(j) * 0.25, lerp(cod.position.y, ship.deck + 1.1, tk) + Math.cos(j * 1.3) * 0.18 + Math.sin(tk * Math.PI) * 1.2, lerp(cod.position.z, 0.4, tk) + Math.sin(j * 0.7) * 0.25);
    }
    catchGlow.flush();
    // 網を吊り出す間は船尾に寄り、繰り出したら網まで入る広さに引く
    update.shots[2] = step === 2 && p < 0.36 ? [-40, 8, 27, -16, 2.6, 0] : WIDE;
  };
  update.school = school;
  update.shots = [[-38, 17, 60, 2, -6, 0], [-22, 9, 50, -1, -2.5, 5], WIDE, [-58, 6, 54, -27, -7, 0], [-40, 9, 28, -15, 2.4, 0]];
  return update;
}
