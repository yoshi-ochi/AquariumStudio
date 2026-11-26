import * as THREE from 'three';
import { BED, clamp01, crew, lerp, mat } from './gearKit.js';
import { Wake } from './fishingFx.js';

/** 川の深さ（海の BED に当たる）と、流れの速さ（下流は -X） */
export const RIVER_BED = -3.5;
const RIVER_FLOW = 4;

// 空の色（上, 下）：昼・朝夕・夜
const SKY = [[0x6fb7e6, 0xd6eef8], [0x3d4f86, 0xf2ae78], [0x081428, 0x1a3656]];
const col = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k);
const sky = (i, k) => {
  const s = clamp01(k) * 2;
  const j = Math.min(1, Math.floor(s));
  return col(SKY[j][i], SKY[j + 1][i], s - j);
};
const rnd = (i, s = 0) => {
  const v = Math.sin(i * 91.7 + s * 47.3) * 43758.5453;
  return v - Math.floor(v);
};
const wrap = (x, w) => ((((x + w / 2) % w) + w) % w) - w / 2;

function hullShape(l, b, bow) {
  const s = new THREE.Shape();
  s.moveTo(-l, b * 0.86);
  s.lineTo(-l, -b * 0.86);
  s.lineTo(bow * 0.45, -b);
  s.quadraticCurveTo(bow * 0.92, -b * 0.4, bow, 0);
  s.quadraticCurveTo(bow * 0.92, b * 0.4, bow * 0.45, b);
  s.closePath();
  return s;
}
const slab = (shape, depth, color, y, k = 1) => {
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }).rotateX(-Math.PI / 2), mat(color, 0.5));
  m.position.y = y;
  m.scale.set(k, 1, k);
  return m;
};

/** 漁船（全長約12m）。kind: 'skiff' は作業用の小舟、'river' は川舟 */
export function buildBoat(hullColor = 0x1f5f8b, kind = 'fishing') {
  const g = new THREE.Group();
  if (kind !== 'fishing') {
    const river = kind === 'river';
    const shape = hullShape(3.3, river ? 0.75 : 1.05, 3.7);
    g.add(slab(shape, 0.75, river ? 0x9a7445 : hullColor, -0.2), slab(shape, 0.1, river ? 0x6f5230 : 0xe9e4d6, 0.4, 0.86));
    const motor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.4), mat(0x2b3138));
    motor.position.set(-3.5, 0.5, 0);
    g.add(motor);
    crew(g, -2.3, 0.45, 0, 0x3f7d5c);
    if (river) crew(g, 1.6, 0.45, 0, 0xf2a13a).scale.y = 0.72;
    g.userData = { len: 7, beam: river ? 0.75 : 1.05 };
    return g;
  }
  const white = mat(0xf1f3f2, 0.5);
  const shape = hullShape(5, 1.55, 6.6);
  g.add(slab(shape, 1.25, hullColor, -0.15), slab(shape, 0.5, 0x8a2f2a, -0.62, 0.985), slab(shape, 0.14, 0xf1f3f2, 1.02, 1.02), slab(shape, 0.06, 0x9a8466, 1.12, 0.93));
  const house = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.7, 2), white);
  house.position.set(-2.2, 2, 0);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 2.06), mat(0x24404f, 0.2));
  glass.position.set(-1.9, 2.35, 0);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.14, 2.3), mat(hullColor, 0.5));
  roof.position.set(-2.2, 2.92, 0);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 3.6, 6), white);
  mast.position.set(-0.6, 3.6, 0);
  const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 5).rotateX(Math.PI / 2), white);
  yard.position.set(-0.6, 4.7, 0);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.4, 5).rotateZ(-1.05), mat(0xd9a02b));
  boom.position.set(1.2, 3.1, 0);
  g.add(house, glass, roof, mast, yard, boom);
  crew(g, 3.4, 1.15, 0.5);
  crew(g, 1.2, 1.15, -0.6, 0xe9d23c);
  g.userData = { len: 11.6, beam: 1.5 };
  return g;
}

/**
 * 漁の舞台（海、または川）。水中が見える断面で表す。
 * setTime(k) は時刻（0 昼・0.5 朝夕・1 夜）、scroll(v) は走り続ける船に合わせて景色を後ろへ流す速さ。
 */
export function buildStage(scene, { river = false, still = false } = {}) {
  const bedY = river ? RIVER_BED : BED;
  const flow = river && !still ? RIVER_FLOW : 0;
  const W = 150; // 岩や浮遊物を置く範囲（漁をする所）
  const D = river ? 44 : 90;
  // 水面は手前（カメラの後ろ）から水平線・対岸まで続く。遠くは空の色へ溶かす
  const FULL = 320;
  const depthZ = river ? 120 : 300;
  const midZ = (river ? D / 2 + 76 : 95) - depthZ / 2; // 手前の端は川 z=98、海 z=95
  scene.fog = new THREE.Fog(0xd6eef8, 110, 300);
  const hemi = new THREE.HemisphereLight(0xf2fbff, 0x35617a, 1.7);
  const sun = new THREE.DirectionalLight(0xfff4dc, 1.5);
  sun.position.set(-20, 40, 20);
  scene.add(hemi, sun);
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 2;
  skyCanvas.height = 128;
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyTex;
  const group = new THREE.Group();
  scene.add(group);

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(FULL, depthZ, 64, river ? 30 : 60).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.46, roughness: 0.2, depthWrite: false, side: THREE.DoubleSide }));
  const water = new THREE.Mesh(new THREE.BoxGeometry(FULL, -bedY, depthZ), new THREE.MeshBasicMaterial({ transparent: true, opacity: river ? 0.16 : 0.24, depthWrite: false }));
  water.position.set(0, bedY / 2, midZ);
  sea.position.z = midZ;
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(FULL + 40, depthZ, 80, river ? 40 : 72).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: river ? 0xb3a98c : 0x9aa890, roughness: 1, flatShading: true }));
  const bp = bed.geometry.attributes.position;
  for (let i = 0; i < bp.count; i++) bp.setY(i, (Math.sin(bp.getX(i) * 0.4) * 0.3 + Math.cos(bp.getZ(i) * 0.5) * 0.3) * (river ? 0.5 : 1));
  bed.geometry.computeVertexNormals();
  bed.position.set(0, bedY, midZ);
  group.add(bed, water, sea);

  // 底の岩（景色を流すときは一緒に流れる）
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: river ? 0x8d8c82 : 0x6f7772, roughness: 1, flatShading: true });
  const rocks = Array.from({ length: river ? 26 : 18 }, (_, i) => {
    const m = new THREE.Mesh(rockGeo, rockMat);
    const s = (river ? 0.35 : 0.6) + rnd(i, 1) * (river ? 0.7 : 1.3);
    m.scale.set(s * 1.4, s * 0.8, s * 1.1);
    m.rotation.y = rnd(i, 2) * 6;
    m.userData.x = (rnd(i, 3) - 0.5) * W;
    m.position.set(m.userData.x, bedY + s * 0.3, (rnd(i, 4) - 0.5) * (D - 6));
    group.add(m);
    return m;
  });
  // 水中の浮遊物（船が走る向きの手がかり）
  const snow = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(70 * 3), 3)), new THREE.PointsMaterial({ color: 0xe8f6fb, size: 0.14, transparent: true, opacity: 0.7 }));
  snow.frustumCulled = false;
  group.add(snow);

  let streaks = null;
  if (river) {
    // 対岸の土手と木立、水際のヨシ。手前側は水中を見せるため開けておく
    const bank = new THREE.Mesh(new THREE.BoxGeometry(FULL, 1.7 - bedY, 60), mat(0x7fa35c, 1));
    bank.position.set(0, (1.7 + bedY) / 2, -D / 2 - 31.5);
    const shore = new THREE.Mesh(new THREE.BoxGeometry(FULL, 0.5 - bedY, 4).rotateX(0.35), mat(0xb9ad8c, 1));
    shore.position.set(0, bedY / 2 + 0.1, -D / 2 - 0.4);
    group.add(bank, shore);
    const treeGeo = new THREE.ConeGeometry(2.4, 6.5, 7);
    const treeMat = mat(0x3f7a4a, 1);
    for (let i = 0; i < 34; i++) {
      const tr = new THREE.Mesh(treeGeo, treeMat);
      const s = 0.7 + rnd(i, 5) * 0.8;
      tr.scale.setScalar(s);
      tr.position.set((rnd(i, 6) - 0.5) * 260, 1.7 + 3.25 * s, -D / 2 - 6 - rnd(i, 7) * 30);
      group.add(tr);
    }
    const reeds = new THREE.InstancedMesh(new THREE.ConeGeometry(0.09, 2.2, 4), mat(0x6f9a4a, 1), 160);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 160; i++) reeds.setMatrixAt(i, m4.makeTranslation((rnd(i, 8) - 0.5) * 260, 0.7 + rnd(i, 9) * 0.5, -D / 2 + 0.4 + rnd(i, 10) * 1.6));
    group.add(reeds);
    if (flow) {
      // 上流（+X）の瀬：水面から頭を出す石
      for (let i = 0; i < 7; i++) {
        const m = new THREE.Mesh(rockGeo, rockMat);
        const s = 1.5 + rnd(i, 11) * 0.9;
        m.scale.set(s * 1.3, s, s * 1.1);
        m.position.set(34 + rnd(i, 12) * 34, -1.2 + rnd(i, 13) * 0.5, (rnd(i, 14) - 0.5) * (D - 8));
        group.add(m);
      }
      // 水面の流れのすじ
      streaks = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.2, 0.08).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }), 60);
      streaks.frustumCulled = false;
      group.add(streaks);
    }
  }

  const wake = new Wake(group);
  const boats = [];
  const stage = { group, sea, bed, bedY, flow, river, boats, scrollV: 0 };
  stage.makeBoat = (hull, kind = river ? 'river' : 'fishing') => {
    const b = buildBoat(hull, kind);
    group.add(b);
    b.place = (x, z, yaw) => {
      b.position.x = x;
      b.position.z = z;
      b.rotation.y = yaw;
    };
    boats.push(b);
    return b;
  };
  stage.scroll = (v) => (stage.scrollV = v);

  let shownTime = -1;
  stage.setTime = (k) => {
    if (Math.abs(k - shownTime) < 0.01) return;
    shownTime = k;
    const g = skyCanvas.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, `#${sky(0, k).getHexString()}`);
    grad.addColorStop(0.62, `#${sky(1, k).getHexString()}`);
    grad.addColorStop(1, `#${sky(1, k).getHexString()}`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 2, 128);
    skyTex.needsUpdate = true;
    scene.fog.color.copy(sky(1, k));
    const dusk = 1 - Math.abs(k - 0.5) * 2;
    hemi.intensity = lerp(1.7, 0.55, k);
    sun.intensity = lerp(1.5, 0.12, k);
    sun.color.copy(col(0xfff4dc, 0xff9a5a, clamp01(dusk)));
    sea.material.color.copy(col(river ? 0x4fa3a0 : 0x2f8fb8, 0x15405e, k));
    water.material.color.copy(col(river ? 0x2f7f72 : 0x1c6f96, 0x0e3048, k));
  };
  stage.setTime(0);

  let dist = 0;
  const m4 = new THREE.Matrix4();
  stage.tick = (dt, t) => {
    const amp = river ? 0.04 : 0.14;
    const pos = sea.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, Math.sin(pos.getX(i) * 0.35 + t * 1.4) * amp + Math.cos((pos.getZ(i) + midZ) * 0.4 + t) * amp * 0.7);
    pos.needsUpdate = true;
    // 景色を後ろ（-X）へ流す
    dist += stage.scrollV * dt;
    bed.position.x = -(dist % (Math.PI * 5));
    for (const r of rocks) r.position.x = wrap(r.userData.x - dist, W);
    const sp = snow.geometry.attributes.position;
    for (let i = 0; i < sp.count; i++) sp.setXYZ(i, wrap((rnd(i, 20) - 0.5) * W - dist - flow * t * 0.6, W), bedY * (0.08 + rnd(i, 21) * 0.86) + Math.sin(t * 0.5 + i) * 0.2, (rnd(i, 22) - 0.5) * (D - 4));
    sp.needsUpdate = true;
    if (streaks) {
      for (let i = 0; i < streaks.count; i++) streaks.setMatrixAt(i, m4.makeTranslation(wrap((rnd(i, 30) - 0.5) * W - flow * t * (0.8 + rnd(i, 31) * 0.5), W), 0.06, (rnd(i, 32) - 0.5) * (D - 3)));
      streaks.instanceMatrix.needsUpdate = true;
    }
    // 船のゆれと航跡
    boats.forEach((b, i) => {
      b.position.y = Math.sin(t * 1.3 + i * 1.7) * (river ? 0.04 : 0.12);
      b.rotation.z = Math.sin(t * 0.9 + i) * (river ? 0.012 : 0.025);
      const u = b.userData;
      if (b.visible && u.px !== undefined && dt > 0) {
        let v = Math.hypot(b.position.x - u.px, b.position.z - u.pz) / dt;
        if (v > 40) v = 0; // 場面の切り替えで飛んだ分は数えない
        v += stage.scrollV;
        if (v > 0.9) {
          u.acc = (u.acc ?? 0) + v * dt * 1.1;
          const fx = Math.cos(b.rotation.y);
          const fz = -Math.sin(b.rotation.y);
          for (; u.acc >= 1; u.acc--) {
            const side = (Math.random() - 0.5) * u.beam * 2;
            wake.emit(b.position.x - fx * u.len * 0.5 - fz * side, b.position.z - fz * u.len * 0.5 + fx * side, u.beam * (0.45 + Math.random() * 0.3));
          }
        }
      }
      u.px = b.visible ? b.position.x : undefined;
      u.pz = b.position.z;
    });
    wake.update(dt, stage.scrollV + flow * 0.5);
  };
  return stage;
}
