import * as THREE from 'three';

/**
 * 内装の形：水槽台のデザイン違い・説明プレート・大型観葉植物・和風オブジェ・大型流木。
 * tankBuilder.js の BUILDERS に加わる（builder(g, def, { seed, skin })）。影は落とすだけ（UIの影ではない）
 */
const mats = new Map();
function mat(color, opts = {}) {
  const key = `${color}|${JSON.stringify(opts)}`;
  if (!mats.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...opts });
    m.userData.shared = true;
    mats.set(key, m);
  }
  return mats.get(key);
}
function add(g, geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  return m;
}
const box = (g, w, h, d, material, x, y, z) => add(g, new THREE.BoxGeometry(w, h, d), material, x, y, z);
const rand = (seed) => {
  let s = seed >>> 0 || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 2 ** 32;
};

// ---- 水槽台のデザイン ---------------------------------------------------------------

const STAND = {
  white: { body: 0xf0f0ec, top: 0xffffff, line: 0xb8bcc0 },
  black: { body: 0x1e2226, top: 0x2a2f34, line: 0x4a5058, metal: true },
  oak: { body: 0xc49a6c, top: 0xd8b48a, line: 0x8a6446 },
  marble: { body: 0xe8e6e0, top: 0xf4f2ee, line: 0x9a9890, marble: true },
};

/** 標準（木目）以外の水槽台。skin は decorData の SKINS.stand の id */
export function buildStandSkin(g, def, skin) {
  const { w, h, d } = def.size;
  const topT = 0.04;
  if (skin === 'iron') {
    // アイアン：細い鉄の脚と木の天板・中段の棚
    const iron = mat(0x2a2d30, { metalness: 0.6, roughness: 0.4 });
    const leg = 0.035;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, leg, h - topT, leg, iron, sx * (w / 2 - leg / 2), (h - topT) / 2, sz * (d / 2 - leg / 2));
    for (const y of [0.06, h - topT - 0.03]) {
      box(g, w, 0.03, leg, iron, 0, y, d / 2 - leg / 2);
      box(g, w, 0.03, leg, iron, 0, y, -d / 2 + leg / 2);
    }
    box(g, w - 0.06, 0.025, d - 0.06, mat(0x8a6446), 0, h * 0.28, 0);
    box(g, w, topT, d, mat(0xa0764e), 0, h - topT / 2, 0);
    return;
  }
  if (skin === 'urushi') {
    // 黒漆と格子：黒い箱に朱の縁取り、前面に木の格子
    box(g, w - 0.02, h - topT, d - 0.02, mat(0x1a1412, { roughness: 0.25 }), 0, (h - topT) / 2, 0);
    box(g, w, topT, d, mat(0x8a1e1a, { roughness: 0.3 }), 0, h - topT / 2, 0);
    const lat = mat(0x6a4a2c);
    const n = Math.max(4, Math.round(w / 0.08));
    for (let i = 1; i < n; i++) box(g, 0.012, h - topT - 0.1, 0.012, lat, -w / 2 + (w / n) * i, (h - topT) / 2, d / 2 - 0.004);
    for (const y of [0.18, 0.42]) box(g, w - 0.06, 0.012, 0.012, lat, 0, y * (h / 0.7), d / 2 - 0.002);
    return;
  }
  const c = STAND[skin] ?? STAND.white;
  box(g, w - 0.02, h - topT, d - 0.02, mat(c.body, c.metal ? { metalness: 0.3, roughness: 0.35 } : c.marble ? { roughness: 0.2 } : {}), 0, (h - topT) / 2, 0);
  box(g, w, topT, d, mat(c.top, c.marble ? { roughness: 0.15 } : {}), 0, h - topT / 2, 0);
  if (c.marble) for (let i = 0; i < 4; i++) box(g, w * 0.6, 0.004, 0.002, mat(0x9a9890), (i - 1.5) * w * 0.08, (h - topT) * (0.25 + i * 0.17), d / 2 - 0.008);
  const doors = Math.max(1, Math.round(w / 0.6));
  for (let i = 1; i < doors; i++) box(g, 0.006, h - topT - 0.06, 0.004, mat(c.line), -w / 2 + (w / doors) * i, (h - topT) / 2, d / 2 - 0.008);
  // 取っ手
  for (let i = 0; i < doors; i++) box(g, 0.08, 0.012, 0.012, mat(c.line, { metalness: 0.5 }), -w / 2 + (w / doors) * (i + 0.5), h * 0.62, d / 2 + 0.004);
}

// ---- 説明プレート -----------------------------------------------------------------

const PLATE = {
  navy: { board: 0x0f3d5e, text: '#e8f6ff', bg: '#0f3d5e', post: 0x2b3440 },
  wood: { board: 0xb88a5a, text: '#3a2414', bg: '#c89a68', post: 0x6a4a2c },
  acrylic: { board: 0xd8eef8, text: '#123a52', bg: 'rgba(230,246,255,0.85)', post: 0xb8c4cc, clear: true },
  stone: { board: 0x8a8c88, text: '#f4f4f0', bg: '#7a7c78', post: 0x6a6c68, stone: true },
  washi: { board: 0xf4ecd8, text: '#2a2018', bg: '#f4ecd8', post: 0x2a2018 },
  brass: { board: 0xc9a227, text: '#3a2a08', bg: '#d8b440', post: 0x6a5420 },
};
const plateTex = new Map();
function plateTexture(skin) {
  if (plateTex.has(skin)) return plateTex.get(skin);
  const p = PLATE[skin] ?? PLATE.navy;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const ctx = c.getContext('2d');
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, 256, 160);
  ctx.fillStyle = p.text;
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText(skin === 'washi' || skin === 'wood' ? 'いきもの解説' : 'GUIDE  解説', 18, 44);
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 4; i++) ctx.fillRect(18, 70 + i * 20, i === 3 ? 140 : 220, 7);
  // 魚のシルエット
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.ellipse(205, 32, 24, 11, 0, 0, Math.PI * 2);
  ctx.moveTo(181, 32);
  ctx.lineTo(166, 20);
  ctx.lineTo(166, 44);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  plateTex.set(skin, t);
  return t;
}

/** 斜めに立てた解説板と支柱 */
function buildInfoPlate(g, def, { skin = 'navy' } = {}) {
  const { w, h } = def.size;
  const p = PLATE[skin] ?? PLATE.navy;
  if (p.stone) {
    // 石碑：厚い石の板と台石
    box(g, w * 0.7, 0.12, 0.26, mat(0x6a6c68), 0, 0.06, 0);
    box(g, w * 0.9, h - 0.12, 0.1, mat(p.board, { roughness: 0.95, flatShading: true }), 0, 0.12 + (h - 0.12) / 2, 0);
    add(g, new THREE.PlaneGeometry(w * 0.75, w * 0.47), new THREE.MeshBasicMaterial({ map: plateTexture(skin), toneMapped: false }), 0, h * 0.62, 0.051);
    return;
  }
  box(g, 0.24, 0.025, 0.2, mat(p.post), 0, 0.0125, 0);
  box(g, 0.04, h * 0.72, 0.04, mat(p.post, { metalness: 0.3 }), 0, (h * 0.72) / 2, -0.02);
  const board = new THREE.Group();
  board.position.set(0, h * 0.8, 0.02);
  board.rotation.x = -0.5;
  g.add(board);
  const bm = p.clear ? new THREE.MeshStandardMaterial({ color: p.board, transparent: true, opacity: 0.45, roughness: 0.1, depthWrite: false, side: THREE.DoubleSide }) : mat(p.board, skin === 'brass' ? { metalness: 0.7, roughness: 0.3 } : {});
  add(board, new THREE.BoxGeometry(w, w * 0.64, 0.02), bm);
  add(board, new THREE.PlaneGeometry(w * 0.92, w * 0.575), new THREE.MeshBasicMaterial({ map: plateTexture(skin), toneMapped: false, transparent: !!p.clear }), 0, 0, 0.0115);
}

// ---- 大型観葉植物 -----------------------------------------------------------------

function pot(g, r, h, color = 0xe8e4dc) {
  add(g, new THREE.CylinderGeometry(r, r * 0.8, h, 20), mat(color, { roughness: 0.6 }), 0, h / 2, 0);
  add(g, new THREE.CylinderGeometry(r * 0.94, r * 0.94, 0.02, 20), mat(0x3a2a1c, { roughness: 1 }), 0, h - 0.02, 0);
}

/** 葉の形（平面を曲げた舟形）。split：モンステラの切れ込み */
function leafGeo(len, wid, split = false) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(wid * 0.7, len * 0.1, wid * 0.6, len * 0.85, 0, len);
  s.bezierCurveTo(-wid * 0.6, len * 0.85, -wid * 0.7, len * 0.1, 0, 0);
  if (split) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const hole = new THREE.Path();
        const y = len * (0.3 + i * 0.2);
        hole.moveTo(side * wid * 0.12, y);
        hole.lineTo(side * wid * 0.48, y + len * 0.04);
        hole.lineTo(side * wid * 0.48, y + len * 0.08);
        hole.lineTo(side * wid * 0.12, y + len * 0.03);
        s.holes.push(hole);
      }
    }
  }
  const geo = new THREE.ShapeGeometry(s, 6);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, -Math.abs(pos.getX(i)) * 0.35 + (pos.getY(i) / len) ** 2 * len * 0.18);
  geo.computeVertexNormals();
  return geo;
}

function leaves(g, { n, len, wid, color, y0, spread, tilt, split = false, seed = 1, stem = 0x4a6a2a }) {
  const r = rand(seed);
  const leafMat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, side: THREE.DoubleSide });
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.4;
    const out = spread * (0.5 + r() * 0.5);
    const y = y0 + r() * 0.35;
    // 茎
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, y0 - 0.25, 0), new THREE.Vector3(Math.cos(a) * out * 0.3, y + 0.15, Math.sin(a) * out * 0.3), new THREE.Vector3(Math.cos(a) * out, y, Math.sin(a) * out));
    add(g, new THREE.TubeGeometry(curve, 6, 0.008, 4), mat(stem));
    const leaf = add(g, leafGeo(len * (0.8 + r() * 0.4), wid, split), leafMat, Math.cos(a) * out, y, Math.sin(a) * out);
    leaf.rotation.order = 'YXZ';
    leaf.rotation.y = -a + Math.PI / 2;
    leaf.rotation.x = -tilt - r() * 0.3;
  }
}

function buildMonstera(g, def, { seed = 3 } = {}) {
  pot(g, 0.22, 0.38, 0xf0ece4);
  leaves(g, { n: 14, len: 0.5, wid: 0.46, color: 0x2f6a2a, y0: 0.6, spread: 0.36, tilt: 0.55, split: true, seed });
}

function buildKentia(g, def, { seed = 5 } = {}) {
  pot(g, 0.24, 0.42, 0x3a3a3a);
  const r = rand(seed);
  const frond = new THREE.MeshStandardMaterial({ color: 0x3f7a34, roughness: 0.6, side: THREE.DoubleSide });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + r() * 0.3;
    const end = new THREE.Vector3(Math.cos(a) * 0.5, 1.7 + r() * 0.3, Math.sin(a) * 0.5);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.4, 0), new THREE.Vector3(Math.cos(a) * 0.15, 1.9, Math.sin(a) * 0.15), end);
    add(g, new THREE.TubeGeometry(curve, 10, 0.009, 4), mat(0x5a7a3a));
    // 小葉：茎に沿って左右に細い葉を並べる
    for (let k = 3; k < 10; k++) {
      const t = k / 10;
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t);
      for (const side of [-1, 1]) {
        const leaflet = add(g, new THREE.PlaneGeometry(0.03, 0.28 * (1 - t * 0.5)).translate(0, -0.12, 0), frond, p.x, p.y, p.z);
        leaflet.lookAt(p.clone().add(tan));
        leaflet.rotateZ(side * 1.1);
      }
    }
  }
}

function buildUmbellata(g, def, { seed = 7 } = {}) {
  pot(g, 0.2, 0.36, 0xd8d0c4);
  // 曲がった幹と、上の方に大きなハート形の葉
  const trunk = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.34, 0), new THREE.Vector3(0.08, 0.9, 0.02), new THREE.Vector3(-0.04, 1.35, 0)]);
  add(g, new THREE.TubeGeometry(trunk, 12, 0.025, 6), mat(0x8a7a62));
  leaves(g, { n: 18, len: 0.34, wid: 0.4, color: 0x5a9a3a, y0: 1.25, spread: 0.32, tilt: 0.45, seed, stem: 0x7a8a4a });
}

// ---- 和風 -----------------------------------------------------------------------

function buildTatami(g, def) {
  const { w, h, d } = def.size;
  box(g, w, h, d, mat(0xc8c08a, { roughness: 0.9 }), 0, h / 2, 0);
  // 畳縁（へり）と目の線
  for (const sz of [-1, 1]) box(g, w, h + 0.002, 0.045, mat(0x2a3a2a), 0, h / 2, sz * (d / 2 - 0.0225));
  for (let i = 1; i < 40; i++) box(g, 0.003, 0.001, d - 0.1, mat(0xb0a874), -w / 2 + (w / 40) * i, h + 0.0005, 0);
}

function buildShoji(g, def) {
  const { w, h, d } = def.size;
  const wood = mat(0x8a6a44);
  const paper = new THREE.MeshStandardMaterial({ color: 0xf6f0e2, roughness: 0.9, emissive: 0x302a20, side: THREE.DoubleSide });
  add(g, new THREE.PlaneGeometry(w - 0.06, h - 0.1), paper, 0, h / 2, 0);
  box(g, w, 0.04, d, wood, 0, 0.02, 0);
  box(g, w, 0.04, d, wood, 0, h - 0.02, 0);
  for (const sx of [-1, 0, 1]) box(g, 0.03, h, d, wood, sx * (w / 2 - 0.015) * (sx ? 1 : 0), h / 2, 0);
  // 組子（格子）
  for (let i = 1; i < 6; i++) box(g, 0.012, h - 0.08, d * 0.6, wood, -w / 2 + (w / 6) * i, h / 2, 0);
  for (let j = 1; j < 8; j++) box(g, w - 0.04, 0.012, d * 0.6, wood, 0, 0.04 + ((h - 0.08) / 8) * j, 0);
}

function buildTakegaki(g, def) {
  const { w, h, d } = def.size;
  const bamboo = mat(0xb8a86a, { roughness: 0.5 });
  const n = Math.round(w / 0.045);
  for (let i = 0; i < n; i++) add(g, new THREE.CylinderGeometry(0.018, 0.018, h, 8), bamboo, -w / 2 + (i + 0.5) * (w / n), h / 2, 0);
  for (const y of [0.25, 0.7, 1.0]) add(g, new THREE.CylinderGeometry(0.02, 0.02, w, 8).rotateZ(Math.PI / 2), mat(0x8a7a4a), 0, y * (h / 1.2), d / 2);
  for (const sx of [-1, 1]) add(g, new THREE.CylinderGeometry(0.035, 0.035, h + 0.08, 8), mat(0x6a5a3a), sx * w / 2, (h + 0.08) / 2, 0);
}

function buildToro(g, def) {
  const stone = mat(0x9a9890, { roughness: 1, flatShading: true });
  add(g, new THREE.CylinderGeometry(0.28, 0.3, 0.12, 6), stone, 0, 0.06, 0); // 基礎
  add(g, new THREE.CylinderGeometry(0.08, 0.09, 0.5, 8), stone, 0, 0.37, 0); // 竿
  add(g, new THREE.CylinderGeometry(0.22, 0.16, 0.1, 6), stone, 0, 0.67, 0); // 中台
  // 火袋（窓から灯りがもれる）
  add(g, new THREE.CylinderGeometry(0.15, 0.15, 0.24, 6), stone, 0, 0.84, 0);
  for (let i = 0; i < 2; i++) {
    const win = add(g, new THREE.PlaneGeometry(0.11, 0.14), new THREE.MeshBasicMaterial({ color: 0xffd890, toneMapped: false, side: THREE.DoubleSide }), 0, 0.84, 0);
    win.rotation.y = i * Math.PI / 2;
    win.position.set(Math.sin(i * Math.PI / 2) * 0.131, 0.84, Math.cos(i * Math.PI / 2) * 0.131);
  }
  add(g, new THREE.ConeGeometry(0.32, 0.22, 6), stone, 0, 1.07, 0); // 笠
  add(g, new THREE.SphereGeometry(0.06, 8, 6), stone, 0, 1.22, 0); // 宝珠
}

// ---- 大型流木 ---------------------------------------------------------------------

/** 形ごとの枝（正規化した座標 [x, y, z]・太さ）。def.size に合わせて伸ばす */
function bigwoodParts(kind, r) {
  const j = () => (r() - 0.5) * 0.08;
  switch (kind) {
    case 'root': // 根張り：中央の株から四方へ根が広がる
      return [
        { pts: [[0, 0.1, 0], [0.02, 0.6, 0], [0.05, 1, 0.05]], r: 0.09 },
        ...Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2 + j();
          return { pts: [[0, 0.15, 0], [Math.cos(a) * 0.25, 0.08, Math.sin(a) * 0.4], [Math.cos(a) * 0.5, 0.02, Math.sin(a) * 0.5]], r: 0.04 };
        }),
      ];
    case 'arch': // アーチ：両端を床に付けて弧を描く
      return [
        { pts: [[-0.5, 0, 0], [-0.4, 0.6, j()], [-0.1, 0.95, 0], [0.2, 0.9, j()], [0.45, 0.4, 0], [0.5, 0, 0]], r: 0.06 },
        { pts: [[-0.1, 0.95, 0], [0.0, 1.0, 0.3], [0.1, 0.8, 0.45]], r: 0.025 },
      ];
    case 'log': // 倒木：太い幹が横たわり、折れた枝が少し立つ
      return [
        { pts: [[-0.5, 0.35, 0], [-0.1, 0.4, j()], [0.3, 0.35, 0], [0.5, 0.3, j()]], r: 0.14 },
        { pts: [[-0.15, 0.45, 0], [-0.1, 0.8, 0.1], [-0.05, 1, 0.05]], r: 0.04 },
        { pts: [[0.25, 0.4, 0], [0.3, 0.7, -0.2]], r: 0.035 },
      ];
    case 'twist': // ねじれ：らせん状に立ち上がる
      return [{ pts: Array.from({ length: 8 }, (_, i) => [Math.sin(i * 0.9) * 0.3, i / 7, Math.cos(i * 0.9) * 0.3]), r: 0.06 }, { pts: [[0.2, 0.7, 0.1], [0.45, 0.85, 0.2]], r: 0.025 }];
    default: // 枝分かれ：太い幹から枝が何本も伸びる
      return [
        { pts: [[-0.5, 0.05, 0], [-0.2, 0.25, 0], [0.1, 0.55, j()], [0.35, 1, 0]], r: 0.07 },
        { pts: [[-0.2, 0.25, 0], [-0.25, 0.6, 0.2], [-0.35, 0.95, 0.3]], r: 0.035 },
        { pts: [[0.1, 0.55, 0], [0.35, 0.6, -0.25], [0.5, 0.75, -0.4]], r: 0.03 },
        { pts: [[-0.05, 0.4, 0], [0.2, 0.3, 0.3], [0.45, 0.35, 0.45]], r: 0.03 },
      ];
  }
}

function buildBigwood(g, def, { seed = 1 } = {}) {
  const { w, h, d } = def.size;
  const r = rand(seed * 977 + 13);
  const woodMat = mat(0x5a3a24, { roughness: 0.95 });
  for (const part of bigwoodParts(def.wood, r)) {
    const pts = part.pts.map(([x, y, z]) => new THREE.Vector3(x * w, y * h, z * d));
    const curve = new THREE.CatmullRomCurve3(pts);
    const rad = part.r * Math.min(w, h) * 2;
    add(g, new THREE.TubeGeometry(curve, Math.max(8, Math.round(curve.getLength() * 40)), rad, 7), woodMat);
    for (const p of [pts[0], pts[pts.length - 1]]) add(g, new THREE.SphereGeometry(rad, 7, 5), woodMat, p.x, p.y, p.z);
  }
}

export const DECOR_BUILDERS = {
  infoPlate: buildInfoPlate,
  monstera: buildMonstera,
  kentia: buildKentia,
  umbellata: buildUmbellata,
  tatami: buildTatami,
  shoji: buildShoji,
  takegaki: buildTakegaki,
  toro: buildToro,
  bigwood: buildBigwood,
};
