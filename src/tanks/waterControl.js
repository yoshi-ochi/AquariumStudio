import { applyWater, snapLevel, waterLevelOf, isDry, WATER_STEP } from './waterLevel.js';
import { updateCareVisual } from './tankCleaning.js';
import { syncLife, shallowSpecies, waterDepth } from '../expedition/tankLife.js';
import { hasLife } from '../expedition/husbandry.js';
import { getCreature } from '../expedition/creatureData.js';

/**
 * 水位の設定パネル（水槽の詳細パネル・編集シートの「見た目」タブ）と、水位を変えたときの作り直し。
 * スライダーは data-param="water-level"（TankCustomizer が受け取って setWaterLevel を呼ぶ）
 */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** 水位を変えて、水・水面・泳ぐ範囲・濁りを作り直す。生き物がいる水槽は水を抜けない（5%まで）。実際の水位を返す */
export function setWaterLevel(tank, level) {
  if (!tank?.userData.clip) return null;
  let lv = snapLevel(level);
  if (lv === 0 && hasLife(tank)) lv = WATER_STEP;
  if (lv === tank.userData.waterLevel) return lv;
  tank.userData.waterLevel = lv;
  applyWater(tank);
  updateCareVisual(tank);
  if (tank.userData.creatures) syncLife(tank);
  return lv;
}

/** 水位の注意書き（水なし・浅すぎる生き物） */
export function waterNote(tank, blocked = false) {
  if (isDry(tank)) return '<p class="note warn">水を抜いています。水の生き物は入れられません（展示するには水位を上げてください）</p>';
  const parts = [];
  if (blocked) parts.push('<p class="note warn">生き物がいる水槽は水を抜けません（先に展示をやめてください）</p>');
  const low = shallowSpecies(tank).map((id) => esc(getCreature(id).name));
  if (low.length) {
    parts.push(`<p class="note warn">⚠ 水深 ${Math.round(waterDepth(tank) * 100)}cm：${low.join('・')} の体高より浅く、幸福度が下がります</p>`);
  }
  return parts.join('');
}

/** 水位のセクション（0〜100%、5%刻み） */
export function waterSection(tank, slider) {
  const lv = waterLevelOf(tank);
  return `<div class="section"><h4>水位</h4>
    ${slider('water-level', '水位', 0, 1, WATER_STEP, Math.round(lv / WATER_STEP) * WATER_STEP, 'water')}
    <div data-water-note>${waterNote(tank)}</div></div>`;
}

/** 開いているパネルの注意書きを書き換える（スライダー操作中は再描画しない） */
export function refreshWaterNote(tank, blocked) {
  for (const el of document.querySelectorAll('[data-water-note]')) el.innerHTML = waterNote(tank, blocked);
}
