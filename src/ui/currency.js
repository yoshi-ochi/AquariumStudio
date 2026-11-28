import { icon } from './icons.js';

/** 通貨の表示。コイン（ゲーム内のお金）とダイヤ */
const num = (n) => Math.floor(n).toLocaleString('ja-JP');

/**
 * 大きい金額を K・M・B で短くする（カードやボタンからはみ出さないように）。
 * 1万未満はそのまま。それ以上は有効数字3桁（12.3K・450K・1.23M・91M）。
 */
const UNITS = [
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];
export function shortNum(n) {
  const v = Math.floor(n);
  if (Math.abs(v) < 10000) return v.toLocaleString('ja-JP');
  const [base, unit] = UNITS.find(([b]) => Math.abs(v) >= b);
  const x = v / base;
  const digits = Math.abs(x) < 10 ? 2 : Math.abs(x) < 100 ? 1 : 0;
  // 切り捨て（実際より多く見せない）。末尾の 0 は省く
  const f = 10 ** digits;
  return `${(Math.floor(x * f) / f).toLocaleString('ja-JP', { maximumFractionDigits: digits })}${unit}`;
}

/** ホームの所持コイン：常に K（千）単位で小数1桁（2.1K・2,003.8K）。1,000 未満はそのまま */
export const moneyK = (n) => {
  const v = Math.floor(n);
  if (Math.abs(v) < 1000) return v.toLocaleString('ja-JP');
  return `${(Math.floor(v / 100) / 10).toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}K`;
};

/** HTML 用：コインのアイコン＋数値（1万以上は K・M で短く。title に正確な額） */
export const coin = (n) => `<span class="cur cur-coin" title="${num(n)}コイン">${icon('coin', 14)}${shortNum(n)}</span>`;
/** 文字だけの所（トースト・メール本文・textContent）用 */
export const coinText = (n) => `${num(n)}コイン`;

/** HTML 用：ダイヤのアイコン＋数値 */
export const dia = (n) => `<span class="cur cur-dia">${icon('gem', 14)}${num(n)}</span>`;
export const diaText = (n) => `${num(n)}ダイヤ`;

/**
 * ダイヤで払うボタンの属性。足りないときは押せる見た目のまま（薄く）にして、
 * 押すと「ダイヤが足りません」を出してショップのダイヤ購入へ移る（gameSheet の go-store）。
 */
export const diaBtn = (wallet, price, act, id, { busy = false, cls = 'primary' } = {}) => {
  if (busy) return `data-act="${act}" data-id="${id}" class="${cls}" disabled`;
  if (wallet.canAfford(price)) return `data-act="${act}" data-id="${id}" class="${cls}"`;
  return `data-act="go-store" data-id="${price - wallet.total}" class="${cls} lack"`;
};
