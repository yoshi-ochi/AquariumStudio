import * as THREE from 'three';

/** 漁具の動きに使う共通部品。海面は y=0、海底は y=BED、船首は +X、右舷は +Z */
export const BED = -15;
export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const lerp = (a, b, t) => a + (b - a) * t;
/** p のうち a〜b の区間の進み具合 */
export const span = (p, a, b) => clamp01((p - a) / (b - a));
/** なめらかな出だしと止まり */
export const ease = (p) => {
  const k = clamp01(p);
  return k * k * (3 - 2 * k);
};
/** 作業 i の進み具合（前は 0、後は 1） */
export const prog = (step, p, i) => (step < i ? 0 : step === i ? p : 1);

export const mat = (color, roughness = 0.7) => new THREE.MeshStandardMaterial({ color, roughness });

let netCanvas;
/** ひし形の網目のテクスチャ */
function netTexture(ru, rv) {
  if (!netCanvas) {
    netCanvas = document.createElement('canvas');
    netCanvas.width = netCanvas.height = 32;
    const g = netCanvas.getContext('2d');
    g.strokeStyle = '#fff';
    g.lineWidth = 3.4;
    g.beginPath();
    for (const o of [-32, 0, 32]) {
      g.moveTo(o, 0);
      g.lineTo(o + 32, 32);
      g.moveTo(o + 32, 0);
      g.lineTo(o, 32);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(netCanvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(ru, rv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** fn(u, v) → [x, y, z] で形が変わる網。floats を指定すると v=0 の縁に浮子が並ぶ */
export function makeNet(group, nu, nv, { color = 0xf2efe2, floats = 0, floatColor = 0xf4a52c, cell = 1.2 } = {}) {
  const holder = new THREE.Group();
  const geo = new THREE.PlaneGeometry(1, 1, nu, nv);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, map: netTexture(nu * cell, nv * cell), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  mesh.frustumCulled = false;
  holder.add(mesh);
  let balls = null;
  if (floats) {
    balls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 6, 5), mat(floatColor, 0.5), floats);
    balls.frustumCulled = false;
    holder.add(balls);
  }
  group.add(holder);
  const m4 = new THREE.Matrix4();
  const draw = (fn) => {
    const pos = geo.attributes.position;
    for (let j = 0, k = 0; j <= nv; j++) for (let i = 0; i <= nu; i++, k++) pos.setXYZ(k, ...fn(i / nu, j / nv));
    pos.needsUpdate = true;
    if (!balls) return;
    for (let i = 0; i < floats; i++) {
      const [x, y, z] = fn(i / (floats - 1), 0);
      balls.setMatrixAt(i, m4.makeTranslation(x, y + 0.08, z));
    }
    balls.instanceMatrix.needsUpdate = true;
  };
  draw.mesh = holder;
  return draw;
}

/** 点列を結ぶ綱 */
export function makeLine(group, color = 0xf4e9c8, count = 32) {
  const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color }));
  line.frustumCulled = false;
  group.add(line);
  return (pts) => {
    pts.slice(0, count).forEach((p, i) => geo.attributes.position.setXYZ(i, p[0], p[1], p[2]));
    geo.setDrawRange(0, Math.min(count, pts.length));
    geo.attributes.position.needsUpdate = true;
  };
}

export function buoy(group, color = 0xf0712c, r = 0.42) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat(color));
  group.add(m);
  return m;
}

/** 旗のついた浮標（ボンデン） */
export function flagBuoy(group, color = 0xe5412d) {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), mat(0xf0712c));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 5), mat(0x3a3026));
  pole.position.y = 1.3;
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  flag.position.set(0.47, 2.3, 0);
  g.add(ball, pole, flag);
  group.add(g);
  return g;
}

/** 点灯・消灯できるランプ */
export function lamp(group, x, y, z, color = 0xffefb0) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color }));
  m.position.set(x, y, z);
  group.add(m);
  return m;
}

/** 海面を照らす光 */
export function glow(group, x, z, color = 0xffe7a8) {
  const l = new THREE.PointLight(color, 0, 70, 1.3);
  l.position.set(x, 5, z);
  group.add(l);
  return l;
}

export function box(group, w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  group.add(m);
  return m;
}

/** 水しぶきなどの粒 */
export function particles(group, count, color = 0xffffff, size = 0.25) {
  const pts = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3)), new THREE.PointsMaterial({ color, size }));
  pts.frustumCulled = false;
  group.add(pts);
  pts.setAt = (i, x, y, z) => pts.geometry.attributes.position.setXYZ(i, x, y, z);
  pts.flush = () => (pts.geometry.attributes.position.needsUpdate = true);
  return pts;
}

/** 魚の形（頭が +X）。紡錘形の胴に尾びれがつく */
const FISH_PROFILE = [[0, -0.5], [0.11, -0.3], [0.15, -0.05], [0.1, 0.25], [0.03, 0.4], [0.14, 0.5]];
const fishGeo = (len, thick = 0.42) => new THREE.LatheGeometry(FISH_PROFILE.map(([x, y]) => new THREE.Vector2(x, y)), 7).rotateZ(Math.PI / 2).scale(len, len, len * thick);
const fishMat = (color) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, metalness: 0.3, roughness: 0.4, side: THREE.DoubleSide });

/** 1匹ずつ位置を決められる魚の集まり。put(i, x, y, z, 向き, 傾き, 大きさ) */
export function fishSet(group, count, color = 0xbcd3df, len = 0.7, thick = 0.42) {
  const mesh = new THREE.InstancedMesh(fishGeo(len, thick), fishMat(color), count);
  mesh.frustumCulled = false;
  group.add(mesh);
  const o = new THREE.Object3D();
  o.rotation.order = 'YZX';
  mesh.put = (i, x, y, z, yaw = 0, pitch = 0, s = 1) => {
    o.position.set(x, y, z);
    o.rotation.set(0, yaw, pitch);
    o.scale.setScalar(s);
    o.updateMatrix();
    mesh.setMatrixAt(i, o.matrix);
  };
  mesh.hide = (i) => mesh.put(i, 0, -999, 0, 0, 0, 0);
  mesh.flush = () => (mesh.instanceMatrix.needsUpdate = true);
  for (let i = 0; i < count; i++) mesh.hide(i);
  return mesh;
}

/** 釣れた魚（竿の先などで動かす）。頭が +X */
export function fishMesh(group, color = 0x36506e, len = 1.1) {
  const m = new THREE.Mesh(fishGeo(len), fishMat(color));
  group.add(m);
  return m;
}

/** ダイバー（頭が +X）。tank を外すと素潜り */
export function diver(group, { tank = true, suit = 0x1d2730 } = {}) {
  const d = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.2, 3, 8).rotateZ(Math.PI / 2), mat(suit));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), mat(0xe2b48c));
  head.position.x = 0.95;
  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.36), mat(0x2a9bd6, 0.2));
  mask.position.set(1.14, 0.04, 0);
  d.add(body, head, mask);
  for (const s of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.26), mat(0xf0c23c));
    fin.position.set(-1.25, 0, s * 0.18);
    d.add(fin);
    d[s < 0 ? 'finL' : 'finR'] = fin;
  }
  if (tank) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.9, 8).rotateZ(Math.PI / 2), mat(0xf0c23c));
    t.position.y = 0.4;
    d.add(t);
  }
  /** 足ひれをばたつかせる */
  d.kick = (t) => {
    d.finL.rotation.z = Math.sin(t * 6) * 0.5;
    d.finR.rotation.z = -Math.sin(t * 6) * 0.5;
  };
  group.add(d);
  return d;
}

/** 甲板や浜に立つ人 */
export function crew(parent, x, y, z, color = 0xf2a13a) {
  const g = new THREE.Group();
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.6, 6), mat(0x26323c));
  legs.position.y = 0.3;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 3, 8), mat(color));
  body.position.y = 1;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), mat(0xe2b48c));
  head.position.y = 1.62;
  g.add(legs, body, head);
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/** たも網。load は中の魚 */
export function scoopNet(group, r = 0.9) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 6, 18).rotateX(Math.PI / 2), mat(0x3a4046));
  const bag = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf2efe2, wireframe: true, transparent: true, opacity: 0.7 }));
  const load = new THREE.Mesh(new THREE.SphereGeometry(r * 0.72, 8, 6), new THREE.MeshStandardMaterial({ color: 0xc9dbe6, metalness: 0.5, roughness: 0.3 }));
  load.position.y = -r * 0.3;
  load.scale.y = 0.6;
  g.add(ring, bag, load);
  g.load = load;
  group.add(g);
  return g;
}

