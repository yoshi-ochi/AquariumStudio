import * as THREE from 'three';

/**
 * 水槽の水紋（コースティクス）：martinRenou/threejs-caustics（Evan Wallace の WebGL Water を three.js で実装したもの）の
 * 「水面の格子を光が通り抜けたとき、三角形の面積が縮んだ所に光が集まる（明るさ＝元の面積 ÷ 屈折後の面積）」
 * 計算を、水族館向けに軽くしたもの。
 *
 * 元の実装との違い（軽量化）：
 *  - 水面の波の数値シミュレーションと、光源から見た環境の深度マップをやめ、繰り返しの区画（1辺 TILE m）の中で
 *    整数の波数を持つ波を重ねた水面にした。底に何枚並べても継ぎ目が出ない
 *  - 水槽ごとに計算せず、全水槽で1枚の水紋テクスチャ（256×256）を共有する。毎フレームの仕事は
 *    格子（200×200）を1回描くだけ（GPU）。CPU の計算は無い
 *  - 底・水槽内オブジェ・生き物の材質には、ワールド座標の XZ でこのテクスチャを引いて
 *    「明るい網目（光）とそのあいだ（影）」を掛け合わせるだけの数行を足す
 */
/** 模様の繰り返しの1辺(m) */
export const TILE = 0.9;
const RES = 256;
const SEG = 200;
/** 区画の外から入ってくる光も数えるための余白（区画の幅に対する割合） */
const PAD = 0.35;
/** 焦点の強さ全体の倍率（大きいほど網目が細く鋭い） */
const FOCUS = 2.1;
/** 重ねる波：波数ベクトル（区画あたりの波の数）・焦点の強さ・1秒あたりの振動（rad）・位相 */
const WAVES = [
  [[2, 1], 0.55, 1.8, 0.0], [[-1, 2], 0.5, 2.7, 1.3], [[3, -1], 0.42, 3.6, 2.1], [[1, 3], 0.38, 2.7, 4.0],
  [[-3, -2], 0.3, 4.5, 0.7], [[4, 1], 0.26, 5.4, 5.1], [[-2, 4], 0.22, 4.5, 3.3], [[5, -3], 0.16, 6.3, 1.9],
];

/** 材質に渡す共有の値。uCauOn は水槽ごと（水槽の clip uniforms）か生き物ごと */
export const CAUSTIC_UNIFORMS = {
  uCauTex: { value: null },
  uCauTile: { value: TILE },
  uCauAmt: { value: 0.9 },
};

// ---- 水紋テクスチャを描く（GPU） -----------------------------------------------------------------
let sim = null;
function createSim() {
  const rt = new THREE.WebGLRenderTarget(RES, RES, { depthBuffer: false, stencilBuffer: false });
  rt.texture.wrapS = rt.texture.wrapT = THREE.RepeatWrapping;
  rt.texture.magFilter = rt.texture.minFilter = THREE.LinearFilter;
  rt.texture.generateMipmaps = false;
  const geo = new THREE.PlaneGeometry(1 + PAD * 2, 1 + PAD * 2, SEG, SEG).translate(0.5, 0.5, 0);
  const waves = WAVES.map(([[mx, my], c]) => {
    const len = Math.hypot(mx, my);
    // 屈折で底がずれる量（区画の幅に対する割合）：勾配の向き × c × FOCUS / (2π|m|)
    return new THREE.Vector4(mx, my, (c * FOCUS) / (2 * Math.PI * len), 0);
  });
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWaves: { value: waves },
      uOmega: { value: WAVES.map((w) => w[2]) },
      uPhase: { value: WAVES.map((w) => w[3]) },
    },
    vertexShader: `uniform float uTime;
      uniform vec4 uWaves[${WAVES.length}];
      uniform float uOmega[${WAVES.length}];
      uniform float uPhase[${WAVES.length}];
      varying vec2 vOld;
      varying vec2 vNew;
      void main() {
        // 真上から来た光が、水面の傾きで曲がって底に届く位置
        vec2 p = position.xy;
        vec2 d = vec2(0.0);
        for (int i = 0; i < ${WAVES.length}; i++) {
          vec4 w = uWaves[i];
          float ph = 6.2831853 * dot(w.xy, p) - uOmega[i] * uTime + uPhase[i];
          d += w.z * normalize(w.xy) * cos(ph);
        }
        vOld = p;
        vNew = p + d;
        gl_Position = vec4(vNew * 2.0 - 1.0, 0.0, 1.0);
      }`,
    fragmentShader: `varying vec2 vOld;
      varying vec2 vNew;
      void main() {
        // 明るさ＝元の面積 ÷ 屈折後の面積（光が集まって縮んだ所ほど明るい）
        float oldArea = length(dFdx(vOld)) * length(dFdy(vOld));
        float newArea = length(dFdx(vNew)) * length(dFdy(vNew));
        float I = min(oldArea / max(newArea, 1e-9), 12.0);
        gl_FragColor = vec4(vec3(I * 0.25), 1.0);
      }`,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  CAUSTIC_UNIFORMS.uCauTex.value = rt.texture;
  const out = { rt, mat, scene, camera, last: -1 };
  if (import.meta.env?.DEV) window.__caustics = out; // 開発中の確認用
  return out;
}

const clearColor = new THREE.Color();
/** 毎フレーム（描く前）：水紋テクスチャを描き直す（約30回/秒に間引く） */
export function updateCaustics(time, renderer) {
  if (!renderer) return;
  sim ??= createSim();
  if (time - sim.last < 1 / 30 && sim.last >= 0) return;
  sim.last = time;
  sim.mat.uniforms.uTime.value = time;
  const prevTarget = renderer.getRenderTarget();
  renderer.getClearColor(clearColor);
  const prevAlpha = renderer.getClearAlpha();
  const prevAuto = renderer.autoClear;
  renderer.setRenderTarget(sim.rt);
  renderer.setClearColor(0x000000, 1);
  renderer.clear(true, false, false);
  renderer.autoClear = false;
  renderer.render(sim.scene, sim.camera);
  renderer.autoClear = prevAuto;
  renderer.setClearColor(clearColor, prevAlpha);
  renderer.setRenderTarget(prevTarget);
}

// ---- 材質への組み込み ------------------------------------------------------------------------------
const CAU_DECL = `uniform sampler2D uCauTex;
uniform float uCauTile;
uniform float uCauAmt;
uniform float uCauOn;
// ワールド座標 wp の水紋：明るい網目は明るく、そのあいだは少し暗く（上向きの面ほど強く）
float cauFactor(vec3 wp) {
  if (uCauOn < 0.5) return 1.0;
  vec3 n = normalize(cross(dFdx(wp), dFdy(wp)));
  float up = clamp(abs(n.y) * 0.8 + 0.2, 0.0, 1.0);
  float I = texture2D(uCauTex, wp.xz / uCauTile).r * 4.0;
  float k = I > 1.0 ? 0.85 : 0.6;
  return max(0.0, 1.0 + uCauAmt * up * k * (I - 1.0));
}`;

/**
 * three.js の標準の材質（MeshStandard / MeshBasic など）のシェーダーに水紋を足す（onBeforeCompile の中で呼ぶ）。
 * worldVar：フラグメントで使えるワールド座標の varying 名（無ければ null で、ここで足す）
 * cauOn：水紋を出すかどうかの uniform（{ value: 0|1 }）
 */
export function addCaustics(shader, cauOn, worldVar = null) {
  Object.assign(shader.uniforms, CAUSTIC_UNIFORMS, { uCauOn: cauOn });
  let v = worldVar;
  if (!v) {
    v = 'vCauWorld';
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCauWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCauWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vCauWorld;');
  }
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${CAU_DECL}`)
    .replace('#include <opaque_fragment>', `outgoingLight *= cauFactor(${v});\n#include <opaque_fragment>`);
}

/** 材質に水紋を組み込む（すでに onBeforeCompile があれば、その後に続けて足す） */
export function withCaustics(material, cauOn, key = 'cau') {
  const prev = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey?.();
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    addCaustics(shader, cauOn);
  };
  material.customProgramCacheKey = () => `${prevKey ?? ''}|${key}`;
  material.needsUpdate = true;
  return material;
}
