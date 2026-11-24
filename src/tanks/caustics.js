import * as THREE from 'three';

/**
 * 水槽の水紋（コースティクス）：martinRenou/threejs-caustics（Evan Wallace の WebGL Water を three.js で実装したもの）の
 * 「水面の格子を光が通り抜けたとき、三角形の面積が縮んだ所に光が集まる（明るさ＝元の面積 ÷ 屈折後の面積）」計算を、
 * 水族館向けに軽くしたもの。
 *
 * 水面：5m 四方で継ぎ目なく繰り返す水面。向きも波長（8〜45cm）もばらばらな 28 の波を重ねるので、
 *   普通の水槽の大きさでは繰り返しも規則性も見えない（波数は 5m あたりの整数なので、5m ごとにつながる）。
 * くり抜き：水槽ごとに、その水槽の真上にあたる範囲だけを計算する（水槽ごとに違う模様になり、隣の水槽とも続いている）。
 *   範囲の格子を1回描くだけ（GPU）で、水槽の大きさに合わせた解像度（1m あたり 200px）のテクスチャに書く。
 *   5m を超える大きな水槽は、5m 四方を計算して継ぎ目なく繰り返す。
 * 水深：屈折で光がずれる量は水深に比例するので、浅い水槽は太く柔らかい網目、深い水槽は細く鋭い網目にする（60cm まで）。
 *   さらに、映す面ごとの水面からの深さで、深い所ほど水紋をぼかして（光の広がり）淡くし、2〜3m でほぼ見えなくする。
 * 元の実装との違い（軽量化）：水面の数値シミュレーションと、光源から見た環境の深度マップは使わない。
 *   画面に見えている近くの水槽だけ、約24回/秒に間引いて描き直す。
 * 底・水槽内の物・生き物の材質には、ワールド座標で水槽のテクスチャを引いて「明るい網目（光）とそのあいだ（影）」を掛ける。
 */
const PERIOD = 5; // m（水面が繰り返す1辺。大きな水槽はこの範囲を繰り返す）
const PX_PER_M = 200;
/** 波の振幅を決めたときの基準の水深(m)。水深 / これ で光のずれを伸び縮みさせる */
const REF_DEPTH = 0.35;
/** 映す面の水面からの深さで、水紋の濃さが 1/e になる深さ(m)。濃さ = exp(-(深さ/これ)²)：50cm で 9割、2m で 2割、3m でほぼ0 */
const FADE_DEPTH = 1.6;
/** 深さ 1m あたりのぼけの半径(m) */
const BLUR_PER_M = 0.022;
/** 光のずれが伸びる深さの上限(m)。これより深いと光が交差しすぎて砂嵐のようになるので、網目のまま淡くしていく */
const MAX_FOCUS_DEPTH = 0.6;
/** くり抜く範囲の外から入ってくる光も数えるための余白(m) */
const PAD = 0.25;
const UPDATE_HZ = 24;
/** これより遠い水槽は描き直さない(m) */
const NEAR = 40;

/** 波：5m あたりの整数の波数ベクトル・ずれの振幅(m)・角振動数・位相。乱数の種を固定して毎回同じ水面にする */
const WAVES = (() => {
  let seed = 20261124;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const out = [];
  const N = 28;
  for (let i = 0; i < N; i++) {
    const lambda = 0.08 * (0.45 / 0.08) ** (i / (N - 1)) * (0.9 + rnd() * 0.2); // 8cm〜45cm を対数で並べる
    const ang = rnd() * Math.PI * 2;
    const mx = Math.round((PERIOD / lambda) * Math.cos(ang));
    const my = Math.round((PERIOD / lambda) * Math.sin(ang));
    const k = (2 * Math.PI * Math.hypot(mx, my)) / PERIOD;
    // 焦点の強さ c（勾配の変化 ≒ c）。全体で網目ができる強さに、波ごとに少しばらつかせる
    const c = 0.36 * (0.8 + rnd() * 0.4);
    out.push({ kx: (2 * Math.PI * mx) / PERIOD, ky: (2 * Math.PI * my) / PERIOD, amp: c / k, omega: 1.25 * Math.sqrt(k), phase: rnd() * Math.PI * 2 });
  }
  return out;
})();

/** 水紋が無いときに使う、明るさの倍率 1 の 1×1 テクスチャ */
const NEUTRAL = (() => {
  const t = new THREE.DataTexture(new Uint8Array([64, 64, 64, 255]), 1, 1, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
})();

/** 全体の強さ（材質で共有） */
export const CAUSTIC_AMOUNT = { value: 0.9 };

/** 水槽ごとの水紋の uniform（水槽の clip uniforms に入れる）。生き物は水槽に入れるときに同じものを使う */
export function causticUniforms(on = 1) {
  return {
    uCauOn: { value: on },
    uCauTex: { value: NEUTRAL },
    uCauOrigin: { value: new THREE.Vector2() },
    uCauSize: { value: new THREE.Vector2(1, 1) },
    uCauTop: { value: 0 }, // 水面の高さ（ワールド）
  };
}

// ---- 水紋を描く（GPU） ----------------------------------------------------------------------------
let sim = null;
function createSim() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWave: { value: WAVES.map((w) => new THREE.Vector4(w.kx, w.ky, w.amp, w.omega)) },
      uPhase: { value: WAVES.map((w) => w.phase) },
      uOrigin: { value: new THREE.Vector2() }, // くり抜く範囲の左上（ワールド XZ）
      uSize: { value: new THREE.Vector2(1, 1) },
      uDepth: { value: 1 }, // 水深 / 基準の水深（光のずれの倍率）
    },
    vertexShader: `uniform float uTime;
      uniform vec4 uWave[${WAVES.length}];
      uniform float uPhase[${WAVES.length}];
      uniform vec2 uOrigin;
      uniform vec2 uSize;
      uniform float uDepth;
      varying vec2 vOld;
      varying vec2 vNew;
      void main() {
        // 格子の点（ワールド XZ）。真上からの光が水面の傾きで曲がって、底に届く位置へずらす
        vec2 p = (modelMatrix * vec4(position, 1.0)).xy;
        vec2 d = vec2(0.0);
        for (int i = 0; i < ${WAVES.length}; i++) {
          vec4 w = uWave[i];
          float ph = dot(w.xy, p) - w.w * uTime + uPhase[i];
          d += w.z * normalize(w.xy) * cos(ph);
        }
        vOld = p;
        vNew = p + d * uDepth;
        gl_Position = vec4((vNew - uOrigin) / uSize * 2.0 - 1.0, 0.0, 1.0);
      }`,
    fragmentShader: `varying vec2 vOld;
      varying vec2 vNew;
      void main() {
        // 明るさ＝元の面積 ÷ 屈折後の面積（光が集まって縮んだ所ほど明るい）
        float oldArea = length(dFdx(vOld)) * length(dFdy(vOld));
        float newArea = length(dFdx(vNew)) * length(dFdy(vNew));
        float I = min(oldArea / max(newArea, 1e-12), 12.0);
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
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const out = { mat, mesh, scene, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), last: -1, tanks: new Map(), grids: new Map() };
  if (import.meta.env?.DEV) window.__caustics = out; // 開発中の確認用
  return out;
}

/** 範囲の大きさに合わせた格子（約 1.5px に1点。大きさごとに使い回す）。原点が範囲の左上 − 余白 */
function gridFor(w, h) {
  const key = `${w.toFixed(1)}x${h.toFixed(1)}`;
  let g = sim.grids.get(key);
  if (!g) {
    const sx = Math.max(8, Math.round(((w + PAD * 2) * PX_PER_M) / 1.5));
    const sy = Math.max(8, Math.round(((h + PAD * 2) * PX_PER_M) / 1.5));
    g = new THREE.PlaneGeometry(w + PAD * 2, h + PAD * 2, sx, sy).translate(w / 2 + PAD, h / 2 + PAD, 0);
    sim.grids.set(key, g);
  }
  return g;
}

const v3 = new THREE.Vector3();
/** 水槽の水の範囲（ワールド XZ の外接矩形。大きさは 10cm 単位に切り上げ。5m を超えたら 5m で繰り返す） */
function windowOf(tank) {
  const I = tank.userData.interior;
  const hx = I.radius ?? I.halfW;
  const hz = I.radius ?? I.halfD;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    v3.set(sx * hx, 0, sz * hz).applyMatrix4(tank.matrixWorld);
    x0 = Math.min(x0, v3.x); x1 = Math.max(x1, v3.x);
    z0 = Math.min(z0, v3.z); z1 = Math.max(z1, v3.z);
  }
  const w = Math.min(PERIOD, Math.ceil(Math.max(0.1, x1 - x0) * 10) / 10);
  const h = Math.min(PERIOD, Math.ceil(Math.max(0.1, z1 - z0) * 10) / 10);
  return { x: x0, z: z0, w, h };
}

const clearColor = new THREE.Color();
/**
 * 毎フレーム（描く前）：見えている近くの水槽の水紋を描き直す（約24回/秒）。
 * 水槽ごとに、真上の範囲を 50m の水面からくり抜いてテクスチャに書き、水槽の uniform（clip）に渡す
 */
export function updateCaustics(time, renderer, tanks = [], camera = null) {
  if (!renderer) return;
  sim ??= createSim();
  if (sim.last >= 0 && time - sim.last < 1 / UPDATE_HZ) return;
  sim.last = time;
  const alive = new Set();
  const prevTarget = renderer.getRenderTarget();
  renderer.getClearColor(clearColor);
  const prevAlpha = renderer.getClearAlpha();
  const prevAuto = renderer.autoClear;
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 1);
  sim.mat.uniforms.uTime.value = time;
  for (const tank of tanks) {
    const cau = tank.userData.clip;
    if (!cau?.uCauTex || !tank.userData.interior) continue;
    alive.add(tank);
    if (!cau.uCauOn.value || !tank.visible) continue;
    tank.updateWorldMatrix(true, false);
    tank.getWorldPosition(v3);
    if (camera && v3.distanceTo(camera.position) > NEAR) continue;
    const I = tank.userData.interior;
    const top = v3.y + I.waterTop; // 水面の高さ（ワールド）。映す面ごとのぼけと淡さに使う
    const win = windowOf(tank);
    // 水深（水面から底まで）で光のずれを決める
    const depth = Math.max(0.05, I.waterTop - I.floorY);
    sim.mat.uniforms.uDepth.value = Math.min(depth, MAX_FOCUS_DEPTH) / REF_DEPTH;
    let st = sim.tanks.get(tank);
    const rw = Math.max(16, Math.round(win.w * PX_PER_M));
    const rh = Math.max(16, Math.round(win.h * PX_PER_M));
    if (!st || st.rt.width !== rw || st.rt.height !== rh) {
      st?.rt.dispose();
      const rt = new THREE.WebGLRenderTarget(rw, rh, { depthBuffer: false, stencilBuffer: false });
      rt.texture.wrapS = rt.texture.wrapT = THREE.RepeatWrapping; // 5m を超える水槽で繰り返す
      rt.texture.generateMipmaps = false;
      st = { rt };
      sim.tanks.set(tank, st);
    }
    sim.mesh.geometry = gridFor(win.w, win.h);
    sim.mesh.position.set(win.x - PAD, win.z - PAD, 0);
    sim.mesh.updateMatrixWorld();
    sim.mat.uniforms.uOrigin.value.set(win.x, win.z);
    sim.mat.uniforms.uSize.value.set(win.w, win.h);
    renderer.setRenderTarget(st.rt);
    renderer.clear(true, false, false);
    renderer.render(sim.scene, sim.camera);
    cau.uCauTex.value = st.rt.texture;
    cau.uCauOrigin.value.set(win.x, win.z);
    cau.uCauSize.value.set(win.w, win.h);
    cau.uCauTop.value = top;
  }
  renderer.autoClear = prevAuto;
  renderer.setClearColor(clearColor, prevAlpha);
  renderer.setRenderTarget(prevTarget);
  // 撤去された水槽のテクスチャを片付ける
  for (const [tank, st] of sim.tanks) {
    if (alive.has(tank)) continue;
    st.rt.dispose();
    sim.tanks.delete(tank);
  }
}

// ---- 材質への組み込み ------------------------------------------------------------------------------
const CAU_DECL = `uniform sampler2D uCauTex;
uniform vec2 uCauOrigin;
uniform vec2 uCauSize;
uniform float uCauTop;
uniform float uCauAmt;
uniform float uCauOn;
// ワールド座標 wp の水紋：明るい網目は明るく、そのあいだは少し暗く（上向きの面ほど強く）
float cauFactor(vec3 wp) {
  if (uCauOn < 0.5) return 1.0;
  vec3 n = normalize(cross(dFdx(wp), dFdy(wp)));
  float up = clamp(abs(n.y) * 0.8 + 0.2, 0.0, 1.0);
  vec2 uv = (wp.xz - uCauOrigin) / uCauSize;
  // 水面からの深さ：深いほど光が広がってぼけ（周りの7点の平均）、水に吸われて淡くなる
  float d = max(0.0, uCauTop - wp.y);
  vec2 r = vec2(d * ${BLUR_PER_M.toFixed(3)}) / uCauSize;
  float I = texture2D(uCauTex, uv).r * 2.0;
  for (int i = 0; i < 6; i++) {
    float a = float(i) * 1.0472;
    I += texture2D(uCauTex, uv + r * vec2(cos(a), sin(a))).r;
  }
  I = I / 8.0 * 4.0;
  I = mix(1.0, I, exp(-pow(d / ${FADE_DEPTH.toFixed(2)}, 2.0)));
  float k = I > 1.0 ? 0.85 : 0.6;
  return max(0.0, 1.0 + uCauAmt * up * k * (I - 1.0));
}`;

/**
 * three.js の標準の材質（MeshStandard / MeshBasic など）のシェーダーに水紋を足す（onBeforeCompile の中で呼ぶ）。
 * cau：水槽ごとの uniform（causticUniforms() の形。水槽の clip uniforms をそのまま渡せる）
 * worldVar：フラグメントで使えるワールド座標の varying 名（無ければ null で、ここで足す）
 * mask：水紋を映す割合の GLSL の式（0〜1。水面より上を 0 にするなど）
 */
export function addCaustics(shader, cau, worldVar = null, mask = '1.0') {
  Object.assign(shader.uniforms, { uCauAmt: CAUSTIC_AMOUNT, uCauOn: cau.uCauOn, uCauTex: cau.uCauTex, uCauOrigin: cau.uCauOrigin, uCauSize: cau.uCauSize, uCauTop: cau.uCauTop });
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
    .replace('#include <opaque_fragment>', `outgoingLight *= mix(1.0, cauFactor(${v}), ${mask});\n#include <opaque_fragment>`);
}

/** 材質に水紋を組み込む（すでに onBeforeCompile があれば、その後に続けて足す） */
export function withCaustics(material, cau, key = 'cau') {
  const prev = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey?.();
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    addCaustics(shader, cau);
  };
  material.customProgramCacheKey = () => `${prevKey ?? ''}|${key}`;
  material.needsUpdate = true;
  return material;
}
