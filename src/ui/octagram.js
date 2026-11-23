import { STAR_COUNT, PIECES_PER_STAR, PIECE_FISH } from '../expedition/growth.js';

/**
 * 成長の表示：6つの8角星形。それぞれ8ピースで、埋まったピースを塗る（上から時計回り）。
 * mini はアイコンの上に重ねる小さな版。
 */
const R = 9.5; // 外側の頂点
const r = 4.4; // 内側の頂点
const pt = (deg, rad) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return `${(Math.cos(a) * rad).toFixed(2)},${(Math.sin(a) * rad).toFixed(2)}`;
};
// ピース i：中心・左の内側の頂点・外側の頂点・右の内側の頂点
const PIECE_PATHS = Array.from({ length: PIECES_PER_STAR }, (_, i) => {
  const deg = i * (360 / PIECES_PER_STAR);
  return `M0,0L${pt(deg - 22.5, r)}L${pt(deg, R)}L${pt(deg + 22.5, r)}Z`;
});

function star(filled, k) {
  const parts = PIECE_PATHS.map((d, i) => `<path d="${d}" class="${i < filled ? 'on' : ''}"/>`).join('');
  const done = filled >= PIECES_PER_STAR ? ' done' : '';
  return `<svg class="oct s${k + 1}${done}" viewBox="-10 -10 20 20" aria-hidden="true">${parts}</svg>`;
}

/** pieces（0〜48）を6つの星形で表す */
export function octagrams(pieces, { mini = false } = {}) {
  const stars = Array.from({ length: STAR_COUNT }, (_, k) => star(Math.max(0, Math.min(PIECES_PER_STAR, pieces - k * PIECES_PER_STAR)), k));
  const label = `成長 ${pieces}/${STAR_COUNT * PIECES_PER_STAR}ピース`;
  return `<span class="oct-row${mini ? ' mini' : ''}" role="img" aria-label="${label}" title="${label}">${stars.join('')}</span>`;
}

/** 育成カード用：星形の下に、それぞれの1ピースの匹数を添える */
export function octagramsDetail(pieces) {
  const cols = Array.from({ length: STAR_COUNT }, (_, k) => {
    const filled = Math.max(0, Math.min(PIECES_PER_STAR, pieces - k * PIECES_PER_STAR));
    return `<span class="oct-col">${star(filled, k)}<small>${PIECE_FISH[k]}匹</small></span>`;
  });
  return `<div class="oct-detail" role="img" aria-label="成長 ${pieces}/${STAR_COUNT * PIECES_PER_STAR}ピース">${cols.join('')}</div>`;
}
