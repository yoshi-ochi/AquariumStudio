/**
 * 水槽ごとの水位（tank.userData.waterLevel：0〜1、5%刻み）。
 * 未設定なら作ったときの標準の高さ（以前の固定の水位）のまま。
 * 0 は底（砂の上面）、1 は水槽のフチ。0 は水なし（水の生き物は入れられない）。
 * 水の箱・水面は tankBuilder が userData.water / waterSurface 印を付けて作り、ここで高さを合わせる。
 */
export const WATER_STEP = 0.05;
export const snapLevel = (v) => Math.min(1, Math.max(0, Math.round(v / WATER_STEP) / (1 / WATER_STEP)));

/** 水槽の水位（0〜1）。未設定なら標準の高さを割合にしたもの（表示用） */
export function waterLevelOf(tank) {
  const lv = tank.userData.waterLevel;
  if (lv != null) return lv;
  const span = tank.getObjectByName('body')?.userData.waterSpan;
  const I = tank.userData.interior;
  if (!span || !I) return 1;
  return Math.min(1, Math.max(0, (span.def - I.floorY) / Math.max(1e-3, span.hi - I.floorY)));
}

/** 水を抜いてある（水位 0%） */
export const isDry = (tank) => !!tank.userData.interior?.dry;

/** 水面の高さ（水槽ローカル） */
function topOf(tank, span, I) {
  const lv = tank.userData.waterLevel;
  if (lv == null) return span.def;
  const floor = Math.min(I.floorY, span.hi);
  return floor + (span.hi - floor) * lv;
}

/**
 * 水位を水の箱・水面・interior.waterTop・クリップ（水紋）に反映する。
 * 作成時・底砂の厚さを変えたとき（床の高さが変わる）・水位を変えたときに呼ぶ
 */
export function applyWater(tank) {
  const body = tank.getObjectByName('body');
  const span = body?.userData.waterSpan;
  const I = tank.userData.interior;
  if (!span || !I) return;
  const top = topOf(tank, span, I);
  const dry = tank.userData.waterLevel === 0 || top <= I.floorY + 1e-4;
  I.waterTop = top;
  I.dry = dry;
  body.traverse((m) => {
    const w = m.userData.water;
    if (w) {
      const h = Math.max(1e-3, top - w.y0);
      m.visible = !dry;
      if (w.remake) {
        m.geometry.dispose();
        m.geometry = w.remake(top);
      } else {
        m.scale.y = h / w.h0;
        m.position.y = w.centered ? w.y0 + h / 2 : w.y0;
      }
    }
    const surf = m.userData.waterSurface;
    if (surf) {
      m.visible = !dry;
      if (surf.remake) {
        m.geometry.dispose();
        m.geometry = surf.remake(top);
      }
      m.position.y = top + 0.001;
    }
  });
  const clip = tank.userData.clip;
  if (clip) {
    clip.uWaterTop.value = dry ? -1e3 : top; // 水が無ければ水紋を映さない
    if (dry) clip.uCauOn.value = 0;
  }
  // 汚れの濁り（水の高さで作る）は次の更新で作り直す
  const care = tank.getObjectByName('care');
  if (care) {
    tank.remove(care);
    care.traverse((c) => {
      if (c.isMesh) {
        c.geometry.dispose();
        c.material.dispose();
      }
    });
  }
}

/** 水の箱に付ける印。y0 は箱の下端、h0 は作ったときの高さ、centered はジオメトリが中心原点か */
export function markWater(mesh, y0, h0, centered = true) {
  mesh.userData.water = { y0, h0, centered };
  return mesh;
}

/** 水面の印 */
export function markSurface(mesh) {
  mesh.userData.waterSurface = true;
  return mesh;
}

/** 水位の段階の表示 */
export function levelLabel(v) {
  const p = Math.round(v * 100);
  if (p === 0) return '0%（水なし）';
  if (p <= 10) return `${p}%（ひたひた）`;
  return `${p}%`;
}
