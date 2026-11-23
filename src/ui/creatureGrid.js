import { getCreature, RARITY_NAME } from '../expedition/creatureData.js';
import { creatureThumb } from './creatureThumb.js';
import { octagrams } from './octagram.js';

const COLS = 4;
const yen = (n) => `¥${Math.floor(n).toLocaleString('ja-JP')}`;

/**
 * 生き物を4列のアイコンで並べる（種類が多くても一覧しやすい）。
 * タップで選ぶと、その行のすぐ下に操作カード（panel）を差し込む。カードの吹き出しの先が選んだアイコンを指す。
 *   items: [{ id, n, pieces? }]（n は所持数など、アイコンの左上に ×n で出す。pieces は成長のピース数）
 */
export function creatureGrid(previews, items, { sel = null, panel = '' } = {}) {
  const at = items.findIndex((it) => it.id === sel);
  const out = [];
  items.forEach(({ id, n, pieces }, i) => {
    const c = getCreature(id);
    out.push(`<button class="cg-cell ${sel === id ? 'sel' : ''}" data-act="cg-pick" data-id="${id}" aria-label="${c?.name ?? id} ${n}匹" aria-expanded="${sel === id}">${creatureThumb(previews, id)}<i class="cg-n">×${n}</i>${pieces != null ? `<i class="cg-lv">${octagrams(pieces, { mini: true })}</i>` : ''}<small>${c?.name ?? id}</small></button>`);
    // 選んだアイコンの行の最後（または一覧の最後）にカードを入れる
    const rowEnd = Math.min(items.length - 1, Math.floor(at / COLS) * COLS + COLS - 1);
    if (at >= 0 && panel && i === rowEnd) {
      const left = (((at % COLS) + 0.5) / COLS) * 100;
      out.push(`<div class="cg-pop" style="--tip:${left}%">${panel}</div>`);
    }
  });
  return `<div class="cg-grid">${out.join('')}</div>`;
}

/**
 * 操作カードの中身：名前と説明、数の選択（−・スライダー・＋・数・最大）、操作ボタン。
 * buttons: [{ act, id, label, unit?, primary?, disabled? }]
 *   id と label の {n} は選んだ数、{yen} は unit×数 の金額、{xp} は xp×数 の経験値に置き換わる（スライダーを動かすとその場で更新）
 */
export function qtyPanel({ title, info = '', extra = '', max, qty, buttons, field = 'cg-qty' }) {
  const n = Math.max(1, Math.min(qty, max));
  const fill = (s, b) => s.replaceAll('{n}', n).replaceAll('{yen}', yen((b.unit ?? 0) * n)).replaceAll('{xp}', ((b.xp ?? 0) * n).toLocaleString('ja-JP'));
  const btns = buttons.map((b) => `<button data-act="${b.act}" data-id="${fill(b.id, b)}" data-idtpl="${b.id}" data-tpl="${b.label}" data-unit="${b.unit ?? 0}" data-xp="${b.xp ?? 0}" class="${b.primary ? 'primary' : ''}" ${b.disabled ? 'disabled' : ''}>${fill(b.label, b)}</button>`);
  const stepper = max > 1
    ? `<div class="cg-step">
        <button data-act="cg-qty" data-repeat data-id="${Math.max(1, n - 1)}" aria-label="1つ減らす" ${n <= 1 ? 'disabled' : ''}>−</button>
        <input type="range" data-field="${field}" min="1" max="${max}" step="1" value="${n}" aria-label="数" style="--p:${max > 1 ? ((n - 1) / (max - 1)) * 100 : 100}%">
        <button data-act="cg-qty" data-repeat data-id="${Math.min(max, n + 1)}" aria-label="1つ増やす" ${n >= max ? 'disabled' : ''}>＋</button>
        <output class="cg-num">${n}</output>
        <button data-act="cg-qty" data-id="${max}" class="cg-max" aria-label="最大" ${n >= max ? 'disabled' : ''}>最大</button>
      </div>`
    : '';
  return `<div class="cg-head"><b>${title}</b>${info ? `<small>${info}</small>` : ''}</div>${extra}${stepper}<div class="cg-acts">${btns.join('')}</div>`;
}

/** スライダーを動かしたとき：再描画せずに数と、ボタンの文字・対象の数を更新する */
export function updateQty(el) {
  const pop = el.closest('.cg-pop');
  if (!pop) return 0;
  const n = Number(el.value);
  const max = Number(el.max);
  el.style.setProperty('--p', `${max > 1 ? ((n - 1) / (max - 1)) * 100 : 100}%`);
  pop.querySelector('.cg-num').textContent = n;
  const [minus, plus, top] = pop.querySelectorAll('.cg-step button');
  minus.dataset.id = Math.max(1, n - 1);
  minus.disabled = n <= 1;
  plus.dataset.id = Math.min(max, n + 1);
  plus.disabled = n >= max;
  top.disabled = n >= max;
  pop.querySelectorAll('.cg-acts button[data-tpl]').forEach((b) => {
    const fill = (s) => s.replaceAll('{n}', n).replaceAll('{yen}', yen(Number(b.dataset.unit) * n)).replaceAll('{xp}', (Number(b.dataset.xp) * n).toLocaleString('ja-JP'));
    b.textContent = fill(b.dataset.tpl);
    b.dataset.id = fill(b.dataset.idtpl);
  });
  return n;
}

/** 名前の横に出す短い説明（レア度・枠） */
export const creatureInfo = (id, extra = '') => {
  const c = getCreature(id);
  return `レア度 ${RARITY_NAME[c.rarity]} ・ 1匹 ${c.slots}枠${extra ? ` ・ ${extra}` : ''}`;
};
