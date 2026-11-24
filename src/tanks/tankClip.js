import * as THREE from 'three';
import { addCaustics } from './caustics.js';

/**
 * 水槽内オブジェの側面クリッピング。
 * フラグメントのワールド座標を水槽のローカル座標に戻し、
 * 円形水槽なら半径の外、箱型なら XZ の範囲外を discard する。Y（上方向）は制限しない。
 * 水槽の水紋（caustics.js）も、ここで一緒に組み込む（水槽ごとの uCauOn で ON/OFF）。
 */

/** 水槽ごとに1つ作る共有 uniform */
export function createClipUniforms(interior) {
  return {
    uClipInv: { value: new THREE.Matrix4() },
    uClipShape: { value: interior.shape === 'cylinder' ? 1 : 0 },
    uClipHalf: { value: new THREE.Vector3(interior.halfW, interior.halfD, interior.radius ?? 0) },
    uTunnel: { value: new THREE.Vector2(interior.tunnel?.r ?? 0, interior.tunnel?.straightH ?? 0) },
    uCauOn: { value: 1 }, // 水紋を映すか（水槽の見た目の「底のゆらめく光」）
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
const VERT_BODY = '#include <project_vertex>\nvClipWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;';
const FRAG_DECL = `#include <common>
varying vec3 vClipWorld;
uniform mat4 uClipInv;
uniform int uClipShape;
uniform vec3 uClipHalf;
uniform vec2 uTunnel;
uniform float uWaterTop;
// 切り口の面の向き（水槽ローカル）：円形は半径方向、箱型ははみ出した側の面
vec3 clipNormalLocal(vec3 lp) {
  if (uClipShape == 1) return normalize(vec3(lp.x, 0.0, lp.z));
  return abs(lp.x) / uClipHalf.x > abs(lp.z) / uClipHalf.y ? vec3(sign(lp.x), 0.0, 0.0) : vec3(0.0, 0.0, sign(lp.z));
}`;
// 切り口から見える裏面（＝空洞）を、ガラス面と同じ向きの平らな面として
// そのオブジェクト自身の色で照らす → 中身の詰まった断面に見える
const FRAG_CAP = `#include <normal_fragment_maps>
if (!gl_FrontFacing) {
  vec3 lpN = (uClipInv * vec4(vClipWorld, 1.0)).xyz;
  vec3 nw = normalize((transpose(uClipInv) * vec4(clipNormalLocal(lpN), 0.0)).xyz);
  normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
}`;
const FRAG_BODY = `#include <clipping_planes_fragment>
{
  vec3 lp = (uClipInv * vec4(vClipWorld, 1.0)).xyz;
  if (uClipShape == 1) {
    if (length(lp.xz) > uClipHalf.z) discard;
  } else if (abs(lp.x) > uClipHalf.x || abs(lp.z) > uClipHalf.y) {
    discard;
  }
  // トンネル水槽：通路（アーチの内側）に入り込んだ部分を消す
  if (uTunnel.x > 0.0 && abs(lp.x) < uTunnel.x && (lp.y < uTunnel.y || length(vec2(lp.x, lp.y - uTunnel.y)) < uTunnel.x)) {
    discard;
  }
}`;

function clipMaterial(material, uniforms) {
  const m = material.userData.shared ? material.clone() : material;
  m.userData.shared = false;
  m.side = THREE.DoubleSide; // 切り口から内側が抜けて見えないように
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', VERT_DECL)
      .replace('#include <project_vertex>', VERT_BODY);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', FRAG_DECL)
      .replace('#include <clipping_planes_fragment>', FRAG_BODY)
      .replace('#include <normal_fragment_maps>', FRAG_CAP);
    // 水紋は水の中だけ（水面の1cm ほど下から上へ消していく）
    addCaustics(shader, uniforms.uCauOn, 'vClipWorld', 'smoothstep(uWaterTop + 0.002, uWaterTop - 0.01, (uClipInv * vec4(vClipWorld, 1.0)).y)');
  };
  m.customProgramCacheKey = () => 'tank-clip-cau';
  m.needsUpdate = true;
  return m;
}

/** オブジェ配下の全メッシュに水槽のクリッピングを適用する */
export function applyClip(obj, uniforms) {
  obj.traverse((child) => {
    if (!child.isMesh || child.userData.noClip) return;
    child.castShadow = false; // クリップ外の部分が影を落とさないように
    child.material = Array.isArray(child.material)
      ? child.material.map((m) => clipMaterial(m, uniforms))
      : clipMaterial(child.material, uniforms);
  });
}
