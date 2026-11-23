import { getCreature, RARITY_NAME } from '../expedition/creatureData.js';

/** 生き物のサムネイル。カードの背景色でレア度を表す（緑・青・紫・金）。overlay は画像の上に重ねる部品（成長の星形など） */
export function creatureThumb(previews, id, overlay = '') {
  const r = getCreature(id)?.rarity ?? 1;
  const label = `レア度 ${RARITY_NAME[r]}`;
  return `<span class="cthumb r${r}" title="${label}"><img src="${previews.get(`creature:${id}`) ?? ''}" alt="${label}">${overlay}</span>`;
}
