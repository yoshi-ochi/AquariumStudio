import { getCreature } from '../expedition/creatureData.js';
import { creatureThumb } from './creatureThumb.js';

/** 生き物の id 一覧 → { id: 匹数 } */
export const countIds = (list) => list.reduce((o, id) => ((o[id] = (o[id] ?? 0) + 1), o), {});

/**
 * 受け取った生き物をブロックで並べる：サムネイル（右上に星の数）と ×匹数、名前。
 * released は満杯で放流した分（灰色で表示）
 */
export function catchBlocks(previews, got = {}, released = {}) {
  const cell = (id, n, gone) => `<div class="cb-cell ${gone ? 'gone' : ''}">${creatureThumb(previews, id)}<b class="cb-n">×${n}</b><small>${getCreature(id)?.name ?? id}</small>${gone ? '<i class="cb-tag">放流</i>' : ''}</div>`;
  const known = (o) => Object.entries(o).filter(([id]) => getCreature(id)); // 削除した魚種は出さない
  const cells = [...known(got).map(([id, n]) => cell(id, n, false)), ...known(released).map(([id, n]) => cell(id, n, true))];
  return cells.length ? `<div class="cb-grid">${cells.join('')}</div>` : '<p class="gs-empty">持ち帰れる生き物はいませんでした。</p>';
}
