import { getCreature, RARITY_NAME } from '../expedition/creatureData.js';

/** 生き物のサムネイル。カードの背景色でレア度を表す（緑・青・紫・金） */
export function creatureThumb(previews, id) {
  const r = getCreature(id)?.rarity ?? 1;
  const label = `レア度 ${RARITY_NAME[r]}`;
  return `<span class="cthumb r${r}" title="${label}"><img src="${previews.get(`creature:${id}`) ?? ''}" alt="${label}"></span>`;
}
