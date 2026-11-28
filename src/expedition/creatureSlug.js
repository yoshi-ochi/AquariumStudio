import * as THREE from 'three';

/**
 * 嚢舌類のウミウシ（葉っぱ形の突起を背負う種）。全長1に正規化、+X が頭、y=0 が底。
 * 面の数を抑えるため、球や円柱は使わず、突起1本を三角形16枚（ひし形断面の紡錘）で組む。全体で約530枚。
 */
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** 三角形の並び（頂点3つずつ）と色から、面ごとに塗り分けた形を作る */
function tris(list) {
  const pos = [];
  const col = [];
  const c = new THREE.Color();
  for (const [a, b, d, hex] of list) {
    c.set(hex);
    for (const p of [a, b, d]) {
      pos.push(p.x, p.y, p.z);
      col.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/** 輪 A と輪 B（同じ数の点）を帯でつなぐ。片方が1点なら錐になる */
function band(out, A, B, hex) {
  const n = Math.max(A.length, B.length);
  for (let i = 0; i < n; i++) {
    const a0 = A[i % A.length], a1 = A[(i + 1) % A.length];
    const b0 = B[i % B.length], b1 = B[(i + 1) % B.length];
    if (A.length > 1) out.push([a0, a1, b0, hex]);
    if (B.length > 1) out.push([a1, b1, b0, hex]);
  }
}

/**
 * 背側突起（鰓突起）。base から dir へ len 伸びる、ふっくらした紡錘形（断面はひし形）。face は表（外）の向き。
 * 根元→最も太い輪（緑）→先の輪（緑）→先端（桃色）。厚みは幅の plump 倍（既定 0.7）
 */
function leaf(out, base, dir, face, len, [green, light, tip], plump = 0.7) {
  const w = new THREE.Vector3().crossVectors(dir, face).normalize();
  const ring = (t, half) => {
    const o = base.clone().addScaledVector(dir, len * t);
    return [o.clone().addScaledVector(w, half), o.clone().addScaledVector(face, half * plump), o.clone().addScaledVector(w, -half), o.clone().addScaledVector(face, -half * plump)];
  };
  const r1 = ring(0.42, len * 0.19);
  const r2 = ring(0.8, len * 0.11);
  band(out, [base], r1, green);
  // 表の2面は明るい緑（白い細かな斑点のかわり）、裏の2面は濃い緑
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const hex = i < 2 ? light : green;
    out.push([r1[i], r1[j], r2[i], hex], [r1[j], r2[j], r2[i], hex]);
  }
  band(out, r2, [base.clone().addScaledVector(dir, len)], tip);
}

/** 体の面（四角 a0-a1-b1-b0）に貼りつく斑。u は a0→a1、t は a→b の範囲。面からわずかに浮かせて重なりのちらつきを防ぐ */
function patch(out, a0, a1, b0, b1, [u0, u1], [t0, t1], hex, lift = 0.0015) {
  const n = new THREE.Vector3().crossVectors(a1.clone().sub(a0), b0.clone().sub(a0)).normalize();
  if (n.z * a0.z < 0) n.negate(); // 体の外向き
  const at = (u, t) => a0.clone().lerp(a1, u).lerp(b0.clone().lerp(b1, u), t).addScaledVector(n, lift);
  const [p, q, r, s] = [at(u0, t0), at(u1, t0), at(u1, t1), at(u0, t1)];
  const m = at((u0 + u1) / 2, t0 - (t1 - t0) * 0.35); // 前へ少しとがらせて丸みを出す
  out.push([p, q, r, hex], [p, r, s, hex], [p, m, q, hex]);
}

/** a から b へ細くなる四角錐（触角） */
function spike(out, a, b, r, hex) {
  const d = b.clone().sub(a).normalize();
  const u = new THREE.Vector3().crossVectors(d, V(0, 1, 0)).normalize();
  const v = new THREE.Vector3().crossVectors(d, u);
  band(out, [1, 0, -1, 0].map((k, i) => a.clone().addScaledVector(u, k * r).addScaledVector(v, [0, 1, 0, -1][i] * r)), [b], hex);
}

/** 小さな八面体（目） */
function gem(out, o, rx, ry, rz, hex) {
  const top = V(o.x, o.y + ry, o.z);
  const bot = V(o.x, o.y - ry, o.z);
  const mid = [V(o.x + rx, o.y, o.z), V(o.x, o.y, o.z + rz), V(o.x - rx, o.y, o.z), V(o.x, o.y, o.z - rz)];
  band(out, mid, [top], hex);
  band(out, [bot], mid, hex);
}

/**
 * ホホベニモウミウシ（Costasiella kuroshimae）：白い頭に寄り目の黒い点、黒紫の触角、ほほの桃色の斑。
 * 背中に緑の葉っぱ形の突起が並び、先端は桃色。突起は真ん中ほど大きく、後ろほど寝る。
 * c.colors：body = 突起の緑、belly = 頭と体の白、fin = 突起の先とほほの桃色。c.mark = 触角
 */
export function leafSlug(c) {
  const { body: green, belly: white, fin: pink } = c.colors;
  const light = new THREE.Color(green).lerp(new THREE.Color(0xf2f6c8), 0.12).getHex();
  const horn = c.mark ?? 0x2a2440;
  const cheek = new THREE.Color(pink).lerp(new THREE.Color(0xffffff), 0.5).getHex(); // 下向きの面は陰で濃く見えるので淡くしておく
  const out = [];

  // 体：頭がふくらみ、尾へ細くなる。底は平ら（6角の輪を5つ）
  const R = (v) => 0.125 * Math.pow(Math.sin(Math.PI * Math.pow(v, 0.55)), 0.6);
  const ringAt = (v) => Array.from({ length: 6 }, (_, k) => {
    const a = (k / 6) * Math.PI * 2;
    return V(0.5 - v, R(v) * 0.9 * (Math.max(Math.cos(a), -0.3) + 0.3), Math.sin(a) * R(v));
  });
  const stops = [0.07, 0.2, 0.36, 0.6, 0.85];
  const rings = stops.map(ringAt);
  const skin = new THREE.Color(white).lerp(new THREE.Color(green), 0.25).getHex(); // 突起の下の体は緑がかる
  band(out, [V(0.5, 0.03, 0)], rings[0], white);
  for (let i = 0; i < rings.length - 1; i++) band(out, rings[i], rings[i + 1], i < 2 ? white : skin);
  band(out, rings[rings.length - 1], [V(-0.5, 0.008, 0)], skin);

  // 突起：6列（4枚と5枚を交互に、計27枚）。φ は真上からの開き、β は後ろへの倒れ
  const rows = [[0.25, 0.27, 0.12], [0.15, 0.34, 0.25], [0.04, 0.37, 0.4], [-0.09, 0.36, 0.55], [-0.22, 0.29, 0.75], [-0.34, 0.2, 0.95]];
  rows.forEach(([x, len, beta], i) => {
    const v = 0.5 - x;
    for (const phi of i % 2 ? [-0.95, -0.48, 0, 0.48, 0.95] : [-0.75, -0.25, 0.25, 0.75]) {
      const r = V(0, Math.cos(phi), Math.sin(phi));
      const dir = r.clone().multiplyScalar(Math.cos(beta)).add(V(-Math.sin(beta), 0, 0));
      const face = r.clone().multiplyScalar(Math.sin(beta)).add(V(Math.cos(beta), 0, 0));
      const base = V(x, R(v) * 0.9 * (Math.cos(phi) + 0.3) * 0.85, Math.sin(phi) * R(v) * 0.85);
      leaf(out, base, dir, face, len * (Math.abs(phi) > 0.7 ? 0.8 : 1), [green, light, pink]);
    }
  });

  for (const s of [-1, 1]) {
    spike(out, V(0.34, 0.1, s * 0.05), V(0.42, 0.17, s * 0.26), 0.024, horn); // 触角
    gem(out, V(0.385, 0.128, s * 0.013), 0.011, 0.009, 0.01, 0x0c1014); // 目（寄り目）
    const k = s > 0 ? 1 : 4; // 体の側面（6角の輪の横の面）
    patch(out, rings[0][k], rings[0][k + 1], rings[1][k], rings[1][k + 1], s > 0 ? [0.2, 0.7] : [0.3, 0.8], [0.08, 0.5], cheek); // ほほの斑（体の面に貼りつく）
  }
  return [tris(out)];
}
