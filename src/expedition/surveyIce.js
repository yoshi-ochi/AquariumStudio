import * as THREE from 'three';
import { clamp01, lerp } from './gearKit.js';
import { beam } from './surveyKit.js';

/** 極域の海氷：両側の厚い氷・船が割って進む前方の氷・水路に残る砕けた氷・遠くの氷山 */

const rnd = (i, s = 0) => {
  const v = Math.sin(i * 91.7 + s * 47.3) * 43758.5453;
  return v - Math.floor(v);
};
const TOP = 0.38; // 氷の上面
const THICK = 1.5;
const FAR = 150;

/**
 * 海氷の舞台。half は水路の幅の半分。
 * 返り値の update(t, bow, stern, beam) で、船首 bow から前を割れていない氷でふさぎ、船体（船尾 stern〜船首、半幅 beam）の横へ砕氷を押しのける。
 */
export function buildIce(group, half = 6.5) {
  // 氷は下から見ると青く光を通す
  const ice = new THREE.MeshStandardMaterial({ color: 0xf2f8fb, roughness: 0.9, emissive: 0x3f8298, emissiveIntensity: 0.75 });
  const slab = (w, d) => new THREE.Mesh(new THREE.BoxGeometry(w, THICK, d), ice);
  for (const s of [-1, 1]) {
    const m = slab(320, 150);
    m.position.set(0, TOP - THICK / 2, s * (half + 75));
    group.add(m);
  }
  const ahead = slab(1, half * 2);
  ahead.position.y = TOP - THICK / 2;
  group.add(ahead);

  // 氷の上の起伏（風で固まった雪と、押し合ってできた氷の丘）
  const N_RIDGE = 110;
  const ridgeGeo = new THREE.DodecahedronGeometry(1, 0);
  const ridges = new THREE.InstancedMesh(ridgeGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, emissive: 0x6fa6b8, emissiveIntensity: 0.18 }), N_RIDGE);
  const o = new THREE.Object3D();
  for (let i = 0; i < N_RIDGE; i++) {
    const side = i % 2 ? 1 : -1;
    const s = 0.35 + rnd(i, 1) * 0.95;
    let x = (rnd(i, 2) - 0.5) * 230;
    const z = half + 2.5 + rnd(i, 3) ** 1.4 * 60;
    if (side > 0 && z < half + 16 && Math.abs(x + 8) < 16) x += 34; // 観測点のまわりは平らな氷
    o.position.set(x, TOP + s * 0.05, side * z);
    o.rotation.set(0, rnd(i, 4) * 6, 0);
    o.scale.set(s * (1.6 + rnd(i, 5) * 2.4), s * (0.22 + rnd(i, 6) * 0.5), s * 1.2);
    o.updateMatrix();
    ridges.setMatrixAt(i, o.matrix);
  }
  group.add(ridges);

  // 遠くの氷山
  const bergMat = new THREE.MeshStandardMaterial({ color: 0xe4f3f9, roughness: 0.85, flatShading: true, emissive: 0x4f93ab, emissiveIntensity: 0.22 });
  for (const [x, z, s] of [[-70, -78, 13], [34, -96, 18], [92, -60, 10], [-118, -52, 9], [128, -100, 15]]) {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = 0.78 + rnd(Math.round(p.getX(i) * 31 + p.getY(i) * 17 + p.getZ(i) * 7), x) * 0.44;
      p.setXYZ(i, p.getX(i) * k, Math.max(-0.2, p.getY(i)) * k, p.getZ(i) * k);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, bergMat);
    m.scale.set(s * 1.5, s * 0.75, s);
    m.position.set(x, 0, z);
    group.add(m);
  }

  // 水路に残る砕氷（ブラッシュアイス）
  const N = 150;
  const geo = new THREE.CylinderGeometry(1, 0.86, 0.6, 6);
  const gp = geo.attributes.position;
  for (let i = 0; i < gp.count; i++) {
    const k = 0.75 + rnd(Math.round(Math.atan2(gp.getZ(i), gp.getX(i)) * 10), 9) * 0.5; // 同じ角の頂点は同じだけ動かす
    gp.setX(i, gp.getX(i) * k);
    gp.setZ(i, gp.getZ(i) * (1.5 - k * 0.5));
  }
  geo.computeVertexNormals();
  const brash = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xf6fbfd, roughness: 0.9, flatShading: true, emissive: 0x3f8298, emissiveIntensity: 0.28 }), N);
  brash.frustumCulled = false;
  group.add(brash);
  const pieces = Array.from({ length: N }, (_, i) => ({ x: lerp(-90, 30, rnd(i, 11)), z: (rnd(i, 12) - 0.5) * 2 * (half - 0.5), s: 0.45 + rnd(i, 13) ** 2 * 1.5, yaw: rnd(i, 14) * 6 }));

  const update = (t, bow, stern, beam) => {
    ahead.scale.x = FAR - bow;
    ahead.position.x = (FAR + bow) / 2;
    pieces.forEach((pc, i) => {
      if (pc.x > bow - 1) {
        o.position.set(0, -99, 0);
        o.scale.setScalar(0);
        o.updateMatrix();
        return brash.setMatrixAt(i, o.matrix);
      }
      // 船体の幅（船首へ向かって細く、船尾の後ろはゆっくり閉じる）だけ外へ押しのける
      const w = pc.x > stern ? beam * Math.min(1, ((bow - pc.x) / 13) ** 0.6) : beam * clamp01(1 - (stern - pc.x) / 16) ** 2;
      const sgn = pc.z < 0 ? -1 : 1;
      const z = sgn * Math.min(half - 0.15, Math.max(Math.abs(pc.z), w + 0.5 * pc.s));
      // 割れたばかりの氷は、船首に押されて傾き、揺れる
      const fresh = clamp01(1 - (bow - pc.x) / 9);
      o.position.set(pc.x, 0.02 + Math.sin(t * 1.6 + i) * 0.05 + fresh * 0.28, z);
      o.rotation.set(Math.sin(t * 1.1 + i * 2) * 0.06 + fresh * 0.7 * sgn, pc.yaw, Math.cos(t * 0.9 + i) * 0.06 + fresh * 0.35);
      o.scale.set(pc.s, 1, pc.s);
      o.updateMatrix();
      brash.setMatrixAt(i, o.matrix);
    });
    brash.instanceMatrix.needsUpdate = true;
  };
  update.top = TOP;
  return update;
}

/**
 * 氷を切り抜いた穴（中心 x, z）。上には暗い水面、氷の下には穴から差しこむ光のすじが見える。
 * 返り値の open(k) で開ける（0 まだ氷〜1 開いた）。
 */
export function buildHole(group, x, z, w = 2.8, d = 2.1) {
  const water = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0f3a4c, roughness: 0.15 }));
  water.position.set(x, TOP + 0.012, z);
  const under = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xcdf3fb, fog: false }));
  under.position.set(x, TOP - THICK - 0.012, z);
  group.add(water, under);
  const shaft = beam(group, 19, 4.2, 0xa9e6f2, 0.3);
  shaft.position.set(x, TOP - THICK, z);
  shaft.rotation.z = -Math.PI / 2;
  return (k) => {
    water.visible = under.visible = shaft.visible = k > 0.01;
    water.scale.setScalar(Math.max(0.01, k));
    under.scale.setScalar(Math.max(0.01, k));
    shaft.material.opacity = 0.3 * k;
  };
}
