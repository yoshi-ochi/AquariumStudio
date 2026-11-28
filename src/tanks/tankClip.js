import * as THREE from 'three';
import { addCaustics, causticUniforms } from './caustics.js';
import { attachCapPass, capPassMaterials } from './clipCapPass.js';

/**
 * 水槽内オブジェの側面クリッピング。
 * フラグメントのワールド座標を水槽のローカル座標に戻し、
 * 円形水槽なら半径の外、箱型なら XZ の範囲外を discard する。Y（上方向）は制限しない。
 * 水槽の水紋（caustics.js）も、ここで一緒に組み込む（水槽ごとの uCauOn で ON/OFF）。
 * 切り口は、裏面を「ガラス面の位置にある平らな面」として素材の色で塗って埋める。
 * 壁をまたぐ岩などは、さらに補助の描画（clipCapPass.js）で穴の残らない切り口にする。
 */

/** 水槽ごとに1つ作る共有 uniform */
export function createClipUniforms(interior) {
  return {
    uClipInv: { value: new THREE.Matrix4() },
    uClipShape: { value: interior.shape === 'cylinder' ? 1 : 0 },
    uClipHalf: { value: new THREE.Vector3(interior.halfW, interior.halfD, interior.radius ?? 0) },
    uTunnel: { value: new THREE.Vector2(interior.tunnel?.r ?? 0, interior.tunnel?.straightH ?? 0) },
    ...causticUniforms(1), // 水紋（uCauOn：水槽の見た目の「底のゆらめく光」の ON/OFF、uCauTex：この水槽の真上をくり抜いた水紋）
    uWaterTop: { value: interior.waterTop ?? 1e3 }, // 水面の高さ（水槽ローカル）。これより上には水紋を映さない
  };
}

/** 水槽ローカル x における設置面の高さ（トンネル水槽ならアーチの上面） */
export function floorAt(interior, x) {
  const t = interior.tunnel;
  if (!t || Math.abs(x) >= t.r) return interior.floorY;
  return t.straightH + Math.sqrt(t.r * t.r - x * x);
}

/** 水槽のワールド行列が変わったら呼ぶ（毎フレームで可） */
export function updateClipUniforms(tank) {
  tank.updateWorldMatrix(true, false);
  tank.userData.clip.uClipInv.value.copy(tank.matrixWorld).invert();
}

const VERT_DECL = '#include <common>\nvarying vec3 vClipWorld;';
// 繰り返し描画（InstancedMesh）は個体ごとの行列も掛ける
const VERT_BODY = '#include <project_vertex>\n#ifdef USE_INSTANCING\nvClipWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\nvClipWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif';
const FRAG_DECL = `#include <common>
varying vec3 vClipWorld;
uniform mat4 uClipInv;
uniform int uClipShape;
uniform vec3 uClipHalf;
uniform vec2 uTunnel;
uniform float uWaterTop;
uniform vec3 uCapColor;
#ifdef CLIP_PASS
uniform mat4 projectionMatrix;
#endif
vec3 gClipPos; // 照らす位置（ワールド）。切り口では、切り口の面の上の点
vec3 gCapN; // 切り口の面の向き（ビュー空間）
bool gCap; // 切り口として塗るフラグメント
// 視線が水槽の壁へ入る点（＝切り口の面）を求める。戻り値はフラグメントから d の何倍手前か（当たらなければ 1e9）、
// n はその面の向き（水槽ローカル・外向き）。lp：フラグメント、d：視線（カメラ→フラグメント）、shrink：壁を内側へ寄せる量
float clipCapHit(vec3 lp, vec3 d, float shrink, out vec3 n) {
  float t = 1e9;
  n = vec3(0.0);
  if (uClipShape == 1) {
    float R = uClipHalf.z - shrink;
    float a = dot(d.xz, d.xz);
    float b = dot(lp.xz, d.xz);
    float h = b * b - a * (dot(lp.xz, lp.xz) - R * R);
    if (a > 1e-12 && h >= 0.0) {
      t = (b + sqrt(h)) / a;
      vec3 q = lp - d * t;
      n = vec3(q.x, 0.0, q.z);
    }
  } else {
    vec2 hf = uClipHalf.xy - shrink;
    // 軸ごとに、壁のあいだにいる区間 [lo, hi]。両方が重なる区間のカメラ側の端が、入る点
    float tx = abs(d.x) > 1e-9 ? (lp.x + sign(d.x) * hf.x) / d.x : 1e9;
    float tz = abs(d.z) > 1e-9 ? (lp.z + sign(d.z) * hf.y) / d.z : 1e9;
    float lx = abs(d.x) > 1e-9 ? (lp.x - sign(d.x) * hf.x) / d.x : abs(lp.x) > hf.x ? 1e9 : -1e9;
    float lz = abs(d.z) > 1e-9 ? (lp.z - sign(d.z) * hf.y) / d.z : abs(lp.z) > hf.y ? 1e9 : -1e9;
    if (min(tx, tz) > max(lx, lz)) {
      t = min(tx, tz);
      n = tx < tz ? vec3(-sign(d.x), 0.0, 0.0) : vec3(0.0, 0.0, -sign(d.z));
    }
  }
#ifndef CLIP_PASS
  if (uTunnel.x > 0.0) {
    // トンネル水槽：通路の壁（まっすぐな部分）とアーチ
    float sx = sign(lp.x);
    float tw = abs(d.x) > 1e-9 ? (lp.x - sx * uTunnel.x) / d.x : -1.0;
    if (tw > 0.0 && tw < t && lp.y - d.y * tw < uTunnel.y) {
      t = tw;
      n = vec3(-sx, 0.0, 0.0);
    }
    vec2 o = lp.xy - vec2(0.0, uTunnel.y);
    float a = dot(d.xy, d.xy);
    float b = dot(o, d.xy);
    float h = b * b - a * (dot(o, o) - uTunnel.x * uTunnel.x);
    if (a > 1e-12 && h >= 0.0) {
      float ta = (b - sqrt(h)) / a;
      vec2 q = o - d.xy * ta;
      if (ta > 0.0 && ta < t && q.y >= 0.0) {
        t = ta;
        n = vec3(-q, 0.0);
      }
    }
  }
#endif
  return t;
}`;
// 切り口から見える裏面（＝空洞）を、ガラス面の位置にある平らな面として塗る → 中身の詰まった断面に見える。
// 色は素材の平均色（uCapColor）。裏面の模様をそのまま出すと、奥行きがずれて空洞に見えるため
const FRAG_CAP_COLOR = `#include <color_fragment>
if (gCap && uCapColor.x >= 0.0) diffuseColor.rgb = uCapColor;`;
const FRAG_CAP = `#include <normal_fragment_maps>
if (gCap) normal = gCapN;`;
const FRAG_BODY = `#include <clipping_planes_fragment>
{
  vec3 lp = (uClipInv * vec4(vClipWorld, 1.0)).xyz;
  vec3 dw = isOrthographic ? -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]) : vClipWorld - cameraPosition;
  float tMax = isOrthographic ? 1e6 : 1.0; // これより手前はカメラの後ろ
  vec3 nl;
  gClipPos = vClipWorld;
  gCap = false;
#ifdef CLIP_PASS
  // 補助の描画（clipCapPass.js）：視線が水槽へ入る点より奥にある面だけを使う。
  // 入る点は壁より少し内側に取る（水・ガラスの色がふつうの岩肌と同じように重なる）
  float t = clipCapHit(lp, mat3(uClipInv) * dw, 0.003 + (uClipShape == 1 ? 0.006 * uClipHalf.z : 0.0), nl);
  if (!(t > 0.0 && t < tMax)) discard;
  #ifdef CLIP_MARK
    gl_FragColor = vec4(0.0);
    return;
  #else
    gCap = true;
    gClipPos = vClipWorld - dw * t;
    vec4 cp = projectionMatrix * viewMatrix * vec4(gClipPos, 1.0);
    // 水・ガラスは polygonOffset で奥へずらして描くので、同じ傾きぶん切り口も奥へ送る（斜めから見た壁際で色の重なりが縞にならない）
    float z = cp.z / cp.w * 0.5 + 0.5;
    gl_FragDepth = z + 3.0 * fwidth(z);
  #endif
#else
  if (uClipShape == 1) {
    if (length(lp.xz) > uClipHalf.z) discard;
  } else if (abs(lp.x) > uClipHalf.x || abs(lp.z) > uClipHalf.y) {
    discard;
  }
  // トンネル水槽：通路（アーチの内側）に入り込んだ部分を消す
  if (uTunnel.x > 0.0 && abs(lp.x) < uTunnel.x && (lp.y < uTunnel.y || length(vec2(lp.x, lp.y - uTunnel.y)) < uTunnel.x)) {
    discard;
  }
  if (!gl_FrontFacing) {
    float t = clipCapHit(lp, mat3(uClipInv) * dw, 0.0, nl);
    // カメラが水槽の内側にあるとき（手前に切り口の面が無い）は、ふつうの裏面のまま
    if (t > 0.0 && t < tMax) {
      gCap = true;
      gClipPos = vClipWorld - dw * t;
    }
  }
#endif
  if (gCap) gCapN = normalize((viewMatrix * vec4(normalize((transpose(uClipInv) * vec4(nl, 0.0)).xyz), 0.0)).xyz);
}`;

// 水槽ごとに1つだけ複製して使い回す材質（生き物オブジェ：floraMaterial.js）。水槽の uniform → (元の材質 → 複製)
const TANK_MATS = new WeakMap();

const CAP_COLORS = new WeakMap(); // 材質 → 切り口の色（両面描きへ変える前に決める）

/** 切り口に塗る色：素材の色 × 頂点カラーの平均。もともと両面描きの素材（葉など閉じていない形）や絵柄つきは塗り替えない（x < 0） */
function capColor(material, geometry) {
  if (material.side !== THREE.FrontSide || material.map || !material.color) return new THREE.Vector3(-1, 0, 0);
  const c = material.color.clone();
  const attr = material.vertexColors && geometry?.attributes.color;
  if (!attr) return c;
  const step = Math.max(1, Math.floor(attr.count / 256));
  const sum = [0, 0, 0];
  let n = 0;
  for (let i = 0; i < attr.count; i += step, n++) {
    sum[0] += attr.getX(i);
    sum[1] += attr.getY(i);
    sum[2] += attr.getZ(i);
  }
  return c.multiply(new THREE.Color(sum[0] / n, sum[1] / n, sum[2] / n));
}

function clipMaterial(material, uniforms, mesh) {
  if (material.userData.clipped) return material; // すでにこの仕組みで作った複製
  const reuse = material.userData.tankShared;
  let mats = null;
  if (reuse) {
    mats = TANK_MATS.get(uniforms) ?? TANK_MATS.set(uniforms, new Map()).get(uniforms);
    if (mats.has(material)) return mats.get(material);
  }
  const extend = material.userData.extend; // 元の材質が持つシェーダーの追加（揺れ）。複製すると消えるので先に取る
  const key = material.userData.programKey ?? '';
  const uCapColor = { value: CAP_COLORS.get(material) ?? CAP_COLORS.set(material, capColor(material, mesh.geometry)).get(material) };
  const m = material.userData.shared ? material.clone() : material;
  m.userData.shared = !!reuse; // 使い回す複製は、オブジェを消しても捨てない
  m.userData.clipped = !!reuse;
  if (mats) mats.set(material, m);
  m.side = THREE.DoubleSide; // 切り口から内側が抜けて見えないように
  const cfg = { extend, key, uniforms, uCapColor };
  install(m, cfg);
  // すき間なく閉じた形（userData.solid：岩）は、壁をまたいだとき補助の描画で切り口をふさぐ
  if (mesh.userData?.solid && !mesh.isInstancedMesh && !m.transparent && uCapColor.value.isColor) {
    attachCapPass(mesh, m, uniforms, () =>
      capPassMaterials(install(m.clone(), cfg, { CLIP_PASS: '', CLIP_MARK: '' }), install(m.clone(), cfg, { CLIP_PASS: '' })),
    );
  }
  return m;
}

/** 材質にクリップ・切り口・水紋のシェーダーを組み込む。defines：補助の描画（clipCapPass.js）用の切り替え */
function install(m, { extend, key, uniforms, uCapColor }, defines) {
  if (defines) m.defines = { ...m.defines, ...defines };
  m.onBeforeCompile = (shader) => {
    extend?.(shader);
    Object.assign(shader.uniforms, uniforms, { uCapColor });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', VERT_DECL)
      .replace('#include <project_vertex>', VERT_BODY);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', FRAG_DECL)
      .replace('#include <clipping_planes_fragment>', FRAG_BODY)
      .replace('#include <color_fragment>', FRAG_CAP_COLOR)
      .replace('#include <normal_fragment_maps>', FRAG_CAP);
    // 水紋は水の中だけ（水面の1cm ほど下から上へ消していく）
    addCaustics(shader, uniforms, 'gClipPos', 'smoothstep(uWaterTop + 0.002, uWaterTop - 0.01, (uClipInv * vec4(gClipPos, 1.0)).y)');
  };
  m.customProgramCacheKey = () => `tank-clip-cau${key}`;
  m.needsUpdate = true;
  return m;
}

/** オブジェ配下の全メッシュに水槽のクリッピングを適用する */
export function applyClip(obj, uniforms) {
  obj.traverse((child) => {
    if (!child.isMesh || child.userData.noClip) return;
    child.castShadow = false; // クリップ外の部分が影を落とさないように
    child.material = Array.isArray(child.material)
      ? child.material.map((m) => clipMaterial(m, uniforms, { geometry: child.geometry }))
      : clipMaterial(child.material, uniforms, child);
  });
}
