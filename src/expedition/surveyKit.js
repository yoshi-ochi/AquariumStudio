import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getCreature } from './creatureData.js';
import { buildCreature } from './creatureBuilder.js';

/**
 * 合同調査の模型（調査船・砕氷船・ROV・観測機器）に使う共通部品。
 * 模型は小さな部品を数多く組んで作り込み、最後に bake() で色を頂点に焼いて1〜2個のメッシュにまとめる
 * （描画の回数が部品の数によらなくなるので、スマホでも軽い）。船首は +X、右舷は +Z、海面は y=0。
 */

const PAINTS = new Map();
/** 色ごとの材質（bake() でまとめる印つき）。both は裏からも見える面（舷の内側など） */
export function paint(color, both = false) {
  const key = both ? -color - 1 : color;
  if (!PAINTS.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.62, side: both ? THREE.DoubleSide : THREE.FrontSide });
    m.userData.bake = true;
    PAINTS.set(key, m);
  }
  return PAINTS.get(key);
}

const bakedMat = (both) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.04, side: both ? THREE.DoubleSide : THREE.FrontSide });

/**
 * root の下の paint() の部品を、色を頂点に焼いて1個（裏も描く面があれば2個）のメッシュにまとめる。
 * userData.live のついた子（動く部品）は、その子自身で bake() しておく。
 */
export function bake(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const m4 = new THREE.Matrix4();
  const buckets = { front: [], both: [] };
  const used = [];
  const walk = (o) => {
    if (o !== root && o.userData.live) return;
    if (o.isMesh && !o.isInstancedMesh && o.material.userData?.bake) {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(m4.multiplyMatrices(inv, o.matrixWorld));
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      const c = o.material.color;
      for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      buckets[o.material.side === THREE.DoubleSide ? 'both' : 'front'].push(g);
      used.push(o);
    }
    [...o.children].forEach(walk);
  };
  walk(root);
  for (const o of used) {
    o.removeFromParent();
    o.geometry.dispose();
  }
  for (const [side, list] of Object.entries(buckets)) {
    if (!list.length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(list, false), bakedMat(side === 'both'));
    list.forEach((g) => g.dispose());
    root.add(mesh);
  }
  return root;
}

/** 動く部品の入れ物（bake() が親とまとめない） */
export function live(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.userData.live = true;
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

export function part(parent, geo, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, paint(color));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

export const cube = (parent, w, h, d, color, x = 0, y = 0, z = 0) => part(parent, new THREE.BoxGeometry(w, h, d), color, x, y, z);

/** 円柱。axis はのびる向き、r2 は反対側の半径（先細り） */
export function tube(parent, r, len, color, x = 0, y = 0, z = 0, axis = 'y', seg = 10, r2 = r) {
  const geo = new THREE.CylinderGeometry(r2, r, len, seg);
  if (axis === 'x') geo.rotateZ(-Math.PI / 2);
  else if (axis === 'z') geo.rotateX(Math.PI / 2);
  return part(parent, geo, color, x, y, z);
}

const UP = new THREE.Vector3(0, 1, 0);
/** 2点を結ぶ棒（パイプ・支柱） */
export function rod(parent, a, b, r, color, seg = 5) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const m = part(parent, new THREE.CylinderGeometry(r, r, va.distanceTo(vb), seg), color);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, vb.sub(va).normalize());
  return m;
}

/** 横から見た形（[x, y] の点列、反時計回り）を幅 w で押し出す */
export function prism(parent, pts, w, color, x = 0, y = 0, z = 0) {
  const shape = new THREE.Shape(pts.map(([px, py]) => new THREE.Vector2(px, py)));
  return part(parent, new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false }).translate(0, 0, -w / 2), color, x, y, z);
}

/**
 * 左右対称の曲面（船体の外板・甲板）。us は船尾→船首の位置、rows は上→下（甲板は中心→舷）の線で、
 * それぞれ u → [x, y, z]（z ≥ 0 の右舷側）を返す。
 */
export function skin(parent, us, rows, color, both = false) {
  const pos = [];
  const idx = [];
  const nv = rows.length;
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (const u of us) for (const row of rows) {
      const [x, y, z] = row(u);
      pos.push(x, y, z * side);
    }
    for (let i = 0; i < us.length - 1; i++) for (let j = 0; j < nv - 1; j++) {
      const a = base + i * nv + j;
      const b = a + nv;
      if (side > 0) idx.push(a, a + 1, b, a + 1, b + 1, b);
      else idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, paint(color, both));
  parent.add(m);
  return m;
}

/** 船尾の平らな面。pts は右舷側の輪郭（上→下）の [x, y, z] */
export function transom(parent, pts, color) {
  const pos = [];
  for (let j = 0; j < pts.length - 1; j++) {
    const [x, y, z] = pts[j];
    const [x2, y2, z2] = pts[j + 1];
    pos.push(x, y, z, x, y, -z, x2, y2, z2, x2, y2, z2, x, y, -z, x2, y2, -z2);
  }
  const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, paint(color));
  parent.add(m);
  return m;
}

/** 手すり：点列に沿って支柱と2段の横棒を張る（線なので軽い）。add(点列, 高さ) で足し、build(親) で1本にまとめる */
export function railings(color = 0xdfe6ea) {
  const seg = [];
  const add = (pts, h = 0.55) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay, az] = pts[i];
      const [bx, by, bz] = pts[i + 1];
      const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 0.9));
      for (const k of [0.5, 1]) seg.push(ax, ay + h * k, az, bx, by + h * k, bz);
      for (let j = 0; j <= n; j++) {
        const t = j / n;
        const x = ax + (bx - ax) * t;
        const y = ay + (by - ay) * t;
        const z = az + (bz - az) * t;
        seg.push(x, y, z, x, y + h, z);
      }
    }
  };
  const build = (parent) => {
    const line = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(seg, 3)), new THREE.LineBasicMaterial({ color }));
    parent.add(line);
    return line;
  };
  return { add, build };
}

/** 作業員（ヘルメットと作業着）。s は大きさ（1 で身長1.8） */
export function person(parent, x, y, z, suit = 0xe8622c, helmet = 0xf4f4f0, s = 0.7) {
  const g = new THREE.Group();
  tube(g, 0.2, 0.62, 0x27323c, 0, 0.31, 0, 'y', 6, 0.17);
  part(g, new THREE.CapsuleGeometry(0.22, 0.48, 2, 7), suit, 0, 1, 0);
  part(g, new THREE.SphereGeometry(0.17, 7, 5), 0xe2b48c, 0, 1.6, 0);
  part(g, new THREE.SphereGeometry(0.2, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), helmet, 0, 1.64, 0);
  g.position.set(x, y, z);
  g.scale.setScalar(s);
  parent.add(g);
  return g;
}

/** 光のすじ（投光器・氷の穴から差す光）。頂点が原点、+X へ広がる円すい。先へ行くほど薄れる */
export function beam(parent, len, r, color = 0xcfe9ff, opacity = 0.1) {
  // 先端の半径を 0 にすると、three r169 では段を分けた円すいの面が半分欠けるので、わずかに太らせる
  const geo = new THREE.CylinderGeometry(0.02, r, len, 16, 5, true).rotateZ(Math.PI / 2).translate(len / 2, 0, 0);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) col.fill(Math.max(0, 1 - pos.getX(i) / len) ** 1.6, i * 3, i * 3 + 3);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, vertexColors: true, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.renderOrder = 3;
  parent.add(m);
  return m;
}

let dotCanvas;
/** 丸くぼけた粒にする（マリンスノー・熱水の煙・発光する生き物・氷のかけら） */
export function soften(points, opacity = 1) {
  if (!dotCanvas) {
    dotCanvas = document.createElement('canvas');
    dotCanvas.width = dotCanvas.height = 32;
    const g = dotCanvas.getContext('2d');
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.75)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
  }
  Object.assign(points.material, { map: new THREE.CanvasTexture(dotCanvas), transparent: true, opacity, depthWrite: false });
  points.material.needsUpdate = true;
  return points;
}

/** 点灯・消灯できる小さな灯り（航海灯・投光器のレンズ） */
export function bulb(parent, x, y, z, color = 0xfff1c4, r = 0.12) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 5), new THREE.MeshBasicMaterial({ color, fog: false }));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/**
 * 図鑑と同じ形の生き物（creatureBuilder.js）。scale は見やすくするための拡大。
 * swim(t) で泳がせ、shade(k) で明るさ（0 闇〜1）を変える（深海では投光器が当たる所だけ見える）。
 */
export function creature(group, id, scale = 1) {
  const f = buildCreature(getCreature(id));
  f.scale.setScalar(scale);
  f.rotation.order = 'YZX';
  f.swim = (t) => (f.userData.uni.uTime.value = t);
  f.shade = (k) => f.traverse((o) => o.material?.color.setScalar(k));
  group.add(f);
  return f;
}

/** 親の動きに合わせて、綱や光の端になる点 */
export function anchor(parent, x, y, z) {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  parent.add(o);
  const v = new THREE.Vector3();
  o.at = () => {
    o.getWorldPosition(v);
    return [v.x, v.y, v.z];
  };
  return o;
}
