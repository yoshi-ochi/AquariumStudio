import { getCreature, MAX_STARS } from '../expedition/creatureData.js';

/** 生き物のサムネイル。右上に星の数（最大6つ）を重ねる */
export function creatureThumb(previews, id) {
  const n = getCreature(id)?.stars ?? 1;
  const label = `星${n}つ（${MAX_STARS}段階）`;
  return `<span class="cthumb"><img src="${previews.get(`creature:${id}`) ?? ''}" alt=""><i class="cstars" title="${label}" aria-label="${label}">${'★'.repeat(n)}</i></span>`;
}
