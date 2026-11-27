import { icon } from './icons.js';

/** 通貨の表示。コイン（ゲーム内のお金）とダイヤ */
const num = (n) => Math.floor(n).toLocaleString('ja-JP');

/** HTML 用：コインのアイコン＋数値 */
export const coin = (n) => `<span class="cur cur-coin">${icon('coin', 14)}${num(n)}</span>`;
/** 文字だけの所（トースト・メール本文・textContent）用 */
export const coinText = (n) => `${num(n)}コイン`;

/** HTML 用：ダイヤのアイコン＋数値 */
export const dia = (n) => `<span class="cur cur-dia">${icon('gem', 14)}${num(n)}</span>`;
export const diaText = (n) => `${num(n)}ダイヤ`;
