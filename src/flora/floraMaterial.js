import * as THREE from 'three';

/**
 * 生き物オブジェの材質（種類をまたいで共有）。頂点カラーのランバート。
 * 揺れるもの（ソフトコーラル・イソギンチャク・海藻）は、頂点の aSway（m）ぶんだけ波に合わせて左右へ揺らす。
 *   ・揺れの向きは群れ全体でそろえ（うねりで同じ側へなびく）、位置ごとに少しずつ遅らせて波が渡っていくように見せる
 *   ・InstancedMesh の個体ごとの向き・大きさを打ち消して、世界で同じ向きに動かす
 * 水槽に入れると tankClip.js が材質を複製してクリップ・水紋を足す。そのとき userData.extend（揺れ）も一緒に組み込まれる。
 */
export const SWAY_TIME = { value: 0 };
/** 毎フレーム呼ぶ（秒） */
export const setSwayTime = (t) => (SWAY_TIME.value = t);

const DECL = '#include <common>\nattribute float aSway;\nuniform float uSwayT;';
const BODY = `#include <begin_vertex>
{
  #ifdef USE_INSTANCING
    vec3 ip = instanceMatrix[3].xyz;
  #else
    vec3 ip = vec3(0.0);
  #endif
  // うねり（約4秒周期）と細かな揺れ（約1.3秒）。高い所ほど遅れて付いてくる
  float ph = uSwayT * 1.6 - ip.x * 2.3 - ip.z * 1.7 - position.y * 3.0;
  vec3 sw = vec3(sin(ph) + 0.35 * sin(ph * 3.1 + 1.3), 0.0, 0.6 * cos(ph * 0.8 + 0.7) + 0.25 * sin(ph * 2.7)) * aSway;
  #ifdef USE_INSTANCING
    transformed += (vec4(sw, 0.0) * instanceMatrix).xyz / dot(instanceMatrix[0].xyz, instanceMatrix[0].xyz);
  #else
    transformed += sw;
  #endif
}`;

function swayShader(shader) {
  shader.uniforms.uSwayT = SWAY_TIME;
  shader.vertexShader = shader.vertexShader.replace('#include <common>', DECL).replace('#include <begin_vertex>', BODY);
}

const cache = new Map();

/** sway：揺れる（aSway を持つ形）、flat：面ごとに陰影（硬いサンゴ・石） */
export function floraMaterial({ sway = false, flat = false } = {}) {
  const key = `${sway ? 's' : 'r'}${flat ? 'f' : 'm'}`;
  let m = cache.get(key);
  if (m) return m;
  m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: flat, side: THREE.DoubleSide });
  m.userData.shared = true;
  m.userData.tankShared = true; // 水槽ごとに1つ複製して、その水槽の全個体で使い回す（tankClip.js）
  if (sway) {
    m.userData.extend = swayShader;
    m.userData.programKey = '-sway';
    m.onBeforeCompile = swayShader;
    m.customProgramCacheKey = () => 'flora-sway';
  }
  cache.set(key, m);
  return m;
}
