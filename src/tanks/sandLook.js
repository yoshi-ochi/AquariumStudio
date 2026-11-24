import * as THREE from 'three';

/**
 * 水槽の底：底砂（種類・厚さ／砂なし）と、砂なしのときの底面の色、水面のゆらぎが底に映す光の模様（コースティクス）。
 * 水槽の形を作る関数が、砂のメッシュに name='sand' と userData.sandBase = { y0, h, centered }、
 * 底の形を body.userData.bottom = { kind: 'box'|'circle'|'shape', w, d, r, shape, y0 } として残しておく。
 */
export const SAND_TYPES = [
  { id: 'fine', label: '細かい砂', color: '#e6d6b0' },
  { id: 'coral', label: 'サンゴ砂', color: '#f1ebdc' },
  { id: 'gravel', label: '砂利', color: '#a8a29a' },
  { id: 'black', label: '黒い砂', color: '#3d3d40' },
  { id: 'soil', label: 'ソイル', color: '#4f3b2b' },
];
export const FLOOR_COLORS = ['#f2f2f2', '#c9c9c9', '#7d8790', '#2b2f33', '#101214', '#1b3a5c', '#3a6f8f', '#e6d6b0', '#6b4a32', '#2f5d3a'];

const texCache = new Map();
/** 種類ごとの粒の模様（128px の繰り返しテクスチャ） */
function sandTexture(id) {
  if (texCache.has(id)) return texCache.get(id);
  const type = SAND_TYPES.find((t) => t.id === id) ?? SAND_TYPES[0];
  const N = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const c = cv.getContext('2d');
  c.fillStyle = type.color;
  c.fillRect(0, 0, N, N);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const base = new THREE.Color(type.color);
  const shade = (k) => `#${base.clone().multiplyScalar(k).getHexString()}`;
  // 粒：大きさと数を種類で変える。端をまたぐ粒は反対側にも描いて継ぎ目をなくす
  const dot = (x, y, r, color) => {
    c.fillStyle = color;
    for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) {
      c.beginPath();
      c.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      c.fill();
    }
  };
  const spec = { fine: [2200, 0.6, 1.1], coral: [1400, 0.8, 1.6], gravel: [260, 2.5, 5.5], black: [2200, 0.6, 1.1], soil: [520, 1.6, 2.6] }[type.id];
  for (let i = 0; i < spec[0]; i++) {
    const r = spec[1] + rnd() * (spec[2] - spec[1]);
    const k = 0.6 + rnd() * 0.75;
    const [x, y] = [rnd() * N, rnd() * N];
    dot(x, y, r, shade(k));
    // 砂利とソイルは粒の左上を明るく、立体的に
    if (type.id === 'gravel' || type.id === 'soil') dot(x - r * 0.3, y - r * 0.3, r * 0.45, shade(k * 1.3));
  }
  if (type.id === 'gravel') for (let i = 0; i < 260; i++) dot(rnd() * N, rnd() * N, 1 + rnd() * 1.5, 'rgba(255,255,255,0.18)');
  if (type.id === 'coral') for (let i = 0; i < 90; i++) dot(rnd() * N, rnd() * N, 1 + rnd() * 2, '#ffffff');
  if (type.id === 'black') for (let i = 0; i < 160; i++) dot(rnd() * N, rnd() * N, 0.5, 'rgba(255,255,255,0.55)');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  texCache.set(id, tex);
  return tex;
}

// ---- コースティクス：水面の凹凸で集まった光が底に作る網目の模様 ------------------------------
/** 繰り返しのワーリーノイズの「境目」を明るくした模様（起動時に1回だけ作る） */
function causticTexture() {
  const N = 128;
  const P = 14;
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pts = Array.from({ length: P }, () => [rnd() * N, rnd() * N]);
  const img = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let d1 = 1e9;
    let d2 = 1e9;
    for (const [px, py] of pts) for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
      const d = Math.hypot(x - px - ox, y - py - oy);
      if (d < d1) [d2, d1] = [d1, d];
      else if (d < d2) d2 = d;
    }
    // 境目の細い線ほど明るく（線の太さ 約2px）
    const v = Math.max(0, 1 - (d2 - d1) / 3.2) ** 2.6;
    const k = (y * N + x) * 4;
    img[k] = img[k + 1] = img[k + 2] = Math.round(v * 255);
    img[k + 3] = 255;
  }
  const tex = new THREE.DataTexture(img, N, N, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
let CAUSTIC = null;
/** 2枚の模様を別々の向き・速さで流して重ね、揺らめいて見せる（全水槽で共有） */
function causticMaterials() {
  if (CAUSTIC) return CAUSTIC;
  const tex = causticTexture();
  const t2 = tex.clone();
  t2.repeat.set(0.77, 0.77);
  t2.needsUpdate = true;
  const mat = (map, opacity) => {
    const m = new THREE.MeshBasicMaterial({ map, color: 0xd8f4ff, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    m.userData.shared = true;
    return m;
  };
  CAUSTIC = { tex, t2, mats: [mat(tex, 0.2), mat(t2, 0.16)] };
  return CAUSTIC;
}

/** 毎フレーム：模様を流す */
export function updateCaustics(time) {
  if (!CAUSTIC) return;
  CAUSTIC.tex.offset.set(time * 0.031, time * 0.017);
  CAUSTIC.t2.offset.set(-time * 0.022, time * 0.027);
}

/** 底の形の平面（XZ）。UV はメートル単位（模様の大きさを水槽によらずそろえる） */
function bottomGeometry(b, tile = 0.2) {
  let geo;
  if (b.kind === 'circle') geo = new THREE.CircleGeometry(b.r, 48);
  else if (b.kind === 'shape') geo = new THREE.ShapeGeometry(b.shape);
  else geo = new THREE.PlaneGeometry(b.w, b.d);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / tile;
    uv[i * 2 + 1] = pos.getZ(i) / tile;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/**
 * 底砂・底面・コースティクスを水槽に反映する。look は normalizeLook 済みのもの。
 * 砂の厚さが変わったら水槽内の物を同じだけ上下させ、水槽内の床の高さ（interior.floorY）も直す
 */
export function applySand(tank, look) {
  const body = tank.getObjectByName('body');
  const b = body?.userData.bottom;
  const sand = body?.getObjectByName('sand');
  if (!b || !sand) return;
  const base = sand.userData.sandBase;
  const s = look.sand;
  const depth = s.on ? Math.max(0.005, s.depth ?? base.h) : 0;
  // 砂：水槽ごとの材質（種類の模様。メートル単位で繰り返す）
  sand.visible = s.on;
  if (s.on) {
    if (!tank.userData.sandMat) {
      tank.userData.sandMat = new THREE.MeshStandardMaterial({ roughness: 0.95 });
      sand.material = tank.userData.sandMat;
    }
    const m = tank.userData.sandMat;
    if (m.userData.type !== s.type) {
      m.map?.dispose();
      m.map = sandTexture(s.type).clone();
      m.map.needsUpdate = true;
      m.userData.type = s.type;
      m.needsUpdate = true;
    }
    const size = Math.max(b.w ?? 0, b.d ?? 0, (b.r ?? 0) * 2, 0.2);
    m.map.repeat.set(size / 0.25, size / 0.25);
    sand.scale.y = depth / base.h;
    sand.position.y = base.centered ? base.y0 + depth / 2 : base.y0;
  }
  // 砂なし：底面の板（色を選べる）
  let plate = body.getObjectByName('bottom-plate');
  if (!s.on) {
    if (!plate) {
      plate = new THREE.Mesh(bottomGeometry(b), new THREE.MeshStandardMaterial({ roughness: 0.6 }));
      plate.name = 'bottom-plate';
      plate.position.y = base.y0 + 0.001;
      plate.receiveShadow = true;
      body.add(plate);
    }
    plate.material.color.set(look.floorColor);
  } else if (plate) {
    body.remove(plate);
    plate.geometry.dispose();
    plate.material.dispose();
  }
  // コースティクス
  const floorY = base.y0 + (s.on ? depth : 0.002);
  let ca = body.getObjectByName('caustics');
  if (look.caustics && !ca) {
    ca = new THREE.Group();
    ca.name = 'caustics';
    const geo = bottomGeometry(b);
    for (const mat of causticMaterials().mats) {
      const m = new THREE.Mesh(geo, mat);
      m.renderOrder = 0.9; // 水（1）より先に描いて、水の色で包む
      m.raycast = () => {};
      ca.add(m);
    }
    body.add(ca);
  } else if (!look.caustics && ca) {
    body.remove(ca);
    ca.children[0]?.geometry.dispose();
    ca = null;
  }
  if (ca) ca.position.y = floorY + 0.003;
  // 水槽内の床の高さと、置いてある物の高さ
  const I = tank.userData.interior;
  if (I && Math.abs(I.floorY - floorY) > 1e-6) {
    const dy = floorY - I.floorY;
    I.floorY = floorY;
    for (const item of tank.getObjectByName('contents')?.children ?? []) item.position.y += dy;
  }
}
