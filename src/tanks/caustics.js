import * as THREE from 'three';

/**
 * 水槽の底に映る水紋（コースティクス）のシミュレーション。
 *
 * 1. 水面の波：繰り返しの区画（1辺 TILE m）の中で、整数の波数ベクトルを持つ正弦波を重ねる。
 *    波数が整数なので区画の端どうしがつながり、底に何枚並べても継ぎ目が出ない。
 *    各波の角振動数も周期 LOOP 秒の整数倍にして、時間方向にも切れ目なく繰り返す。
 * 2. 光の屈折：真上から来た平行光が水面の傾きで曲がり（空気→水、屈折率 1.33）、底へ届く位置がずれる。
 *    小さな傾きでは、ずれ ≒ 水深 × (1 − 1/1.33) × 水面の勾配。波ごとに「焦点の強さ」を決めて、
 *    光が集まる線（明るい網目）と光が散る所（暗い影）ができる深さにする。
 * 3. 光子の集計：区画を細かい格子に分けた光線を1本ずつ底へ落とし、落ちた位置の明るさに足す（両端は回り込み）。
 *    平均で割って「明るさの倍率」にし、少しぼかして粒を消す。
 * これを FRAMES 枚つくり、描くときは前後の2枚を混ぜて動かす。
 * 底には「底の色 × 倍率」で掛け合わせて描くので、網目は明るく、そのあいだは暗くなる（光と影）。
 */
/** 模様の繰り返しの1辺(m) */
export const TILE = 0.9;
const LOOP = 7; // 秒
const FRAMES = 24;
const N = 128; // テクスチャの解像度
const M = 256; // 光線の数（1辺）
/** 焦点の強さ全体の倍率（大きいほど網目が細く鋭い） */
const FOCUS = 2.1;
/** 重ねる波：波数ベクトル（区画あたりの波の数）・焦点の強さ・周期あたりの振動回数・位相 */
const WAVES = [
  [[2, 1], 0.55, 2, 0.0], [[-1, 2], 0.5, 3, 1.3], [[3, -1], 0.42, 4, 2.1], [[1, 3], 0.38, 3, 4.0],
  [[-3, -2], 0.3, 5, 0.7], [[4, 1], 0.26, 6, 5.1], [[-2, 4], 0.22, 5, 3.3], [[5, -3], 0.16, 7, 1.9],
];

function simulateFrame(t) {
  const acc = new Float32Array(N * N);
  const waves = WAVES.map(([[mx, my], c, n, ph]) => {
    const len = Math.hypot(mx, my);
    // 屈折で底がずれる量：c / (2π|m|) × 勾配の向き × cos(位相)。c が 1 前後で光が線に集まる
    return { mx, my, kx: 2 * Math.PI * mx, ky: 2 * Math.PI * my, amp: (c * FOCUS) / (2 * Math.PI * len), ux: mx / len, uy: my / len, w: (2 * Math.PI * n * t) / LOOP + ph };
  });
  for (let j = 0; j < M; j++) {
    for (let i = 0; i < M; i++) {
      const u = (i + 0.5) / M;
      const v = (j + 0.5) / M;
      let dx = 0;
      let dy = 0;
      for (const w of waves) {
        const k = w.amp * Math.cos(w.kx * u + w.ky * v - w.w);
        dx += k * w.ux;
        dy += k * w.uy;
      }
      // 落ちた位置（区画の外は反対側へ回り込む）に、近い4つのテクセルへ配分して足す
      let x = ((u + dx) * N) % N;
      let y = ((v + dy) * N) % N;
      if (x < 0) x += N;
      if (y < 0) y += N;
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = x - x0;
      const fy = y - y0;
      const x1 = (x0 + 1) % N;
      const y1 = (y0 + 1) % N;
      acc[y0 * N + x0] += (1 - fx) * (1 - fy);
      acc[y0 * N + x1] += fx * (1 - fy);
      acc[y1 * N + x0] += (1 - fx) * fy;
      acc[y1 * N + x1] += fx * fy;
    }
  }
  // 平均で割って倍率にし、3×3 で軽くぼかす（回り込みあり）
  const mean = (M * M) / (N * N);
  const out = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let s = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) s += acc[((y + oy + N) % N) * N + ((x + ox + N) % N)] * (ox || oy ? (ox && oy ? 1 : 2) : 4);
      out[y * N + x] = s / 16 / mean;
    }
  }
  return out;
}

let TEX = null;
let ready = 0; // 計算し終えたフレーム数
/**
 * 全フレームの明るさの倍率（÷4 して 8bit に入れる）を重ねたテクスチャ。初めて使うときに作る。
 * 1枚に約40ms かかるので、最初の1枚だけすぐ作って全フレームに入れ、残りは少しずつ（1回に1枚）計算する
 */
function causticFrames() {
  if (TEX) return TEX;
  const data = new Uint8Array(N * N * FRAMES);
  const write = (f) => {
    const fr = simulateFrame((f / FRAMES) * LOOP);
    for (let k = 0; k < N * N; k++) data[f * N * N + k] = Math.min(255, Math.round((fr[k] / 4) * 255));
  };
  write(0);
  for (let f = 1; f < FRAMES; f++) data.copyWithin(f * N * N, 0, N * N);
  ready = 1;
  const next = () => {
    write(ready);
    ready++;
    TEX.needsUpdate = true;
    if (ready < FRAMES) setTimeout(next, 16);
  };
  setTimeout(next, 16);
  TEX = new THREE.DataArrayTexture(data, N, N, FRAMES);
  TEX.format = THREE.RedFormat;
  TEX.type = THREE.UnsignedByteType;
  TEX.wrapS = TEX.wrapT = THREE.RepeatWrapping;
  TEX.magFilter = TEX.minFilter = THREE.LinearFilter;
  TEX.needsUpdate = true;
  return TEX;
}

let MAT = null;
/**
 * 全水槽で共有する材質。底の色に「影の濃さ＋光の強さ」を掛ける：
 *   出力 = 底の色 × (src.rgb + src.a)（CustomBlending：src × 底の色 + 底の色 × src.a）
 *   src.a = 影（倍率が1より小さい所ほど暗く）、src.rgb = 光（倍率が1より大きい所を水色がかった白で明るく）
 */
export function causticMaterial() {
  if (MAT) return MAT;
  MAT = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: causticFrames() }, uF0: { value: 0 }, uF1: { value: 1 }, uMix: { value: 0 }, uLight: { value: 0.75 }, uShade: { value: 0.5 } },
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `precision highp sampler2DArray;
      uniform sampler2DArray uTex;
      uniform float uF0, uF1, uMix, uLight, uShade;
      varying vec2 vUv;
      void main() {
        float a = texture(uTex, vec3(vUv, uF0)).r;
        float b = texture(uTex, vec3(vUv, uF1)).r;
        float I = mix(a, b, uMix) * 4.0;
        vec3 light = vec3(0.86, 0.97, 1.0) * clamp((I - 1.0) * uLight, 0.0, 1.0);
        float shade = clamp(1.0 - (1.0 - min(I, 1.0)) * uShade, 0.0, 1.0);
        gl_FragColor = vec4(light, shade);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.DstColorFactor,
    blendDst: THREE.SrcAlphaFactor,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -8,
  });
  MAT.userData.shared = true;
  return MAT;
}

/** 毎フレーム：前後2枚の混ぜ具合を進める */
export function updateCaustics(time) {
  if (!MAT || ready < FRAMES) return; // 全フレームがそろうまでは最初の1枚のまま
  const p = (((time % LOOP) + LOOP) % LOOP) / LOOP * FRAMES;
  const f0 = Math.floor(p) % FRAMES;
  MAT.uniforms.uF0.value = f0;
  MAT.uniforms.uF1.value = (f0 + 1) % FRAMES;
  MAT.uniforms.uMix.value = p - Math.floor(p);
}
