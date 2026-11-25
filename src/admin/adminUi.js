/** 管理者ツールの小さな部品（入力欄・選択肢） */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const num = (n) => Number(n).toLocaleString('ja-JP');
export const hex = (n) => `#${(n ?? 0).toString(16).padStart(6, '0')}`;
export const unhex = (s) => parseInt(String(s).replace('#', ''), 16) || 0;

/** ラベル付きの入力欄。data-f にフィールド名を入れ、bind 側で読み取る */
export const field = (label, f, value, { type = 'text', step, min, max, placeholder = '', wide = false } = {}) =>
  `<label class="ad-field${wide ? ' wide' : ''}"><span>${label}</span><input data-f="${f}" type="${type}" value="${esc(value)}"${step ? ` step="${step}"` : ''}${min != null ? ` min="${min}"` : ''}${max != null ? ` max="${max}"` : ''} placeholder="${esc(placeholder)}"></label>`;

export const select = (label, f, value, options) =>
  `<label class="ad-field"><span>${label}</span><select data-f="${f}">${options.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(value ?? '') ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;

/** 複数選択のチェック。data-multi にグループ名、value に値 */
export const checks = (label, group, items, chosen) =>
  `<fieldset class="ad-checks"><legend>${label}</legend>${items.map(([v, t]) => `<label><input type="checkbox" data-multi="${group}" value="${esc(v)}" ${chosen.includes(v) ? 'checked' : ''}>${esc(t)}</label>`).join('')}</fieldset>`;

/** 入力欄の値をまとめて読む：{ f: value }（数値の欄は数値、空欄は ''） */
export function readFields(root) {
  const out = {};
  for (const el of root.querySelectorAll('[data-f]')) out[el.dataset.f] = el.type === 'number' ? (el.value === '' ? '' : +el.value) : el.value;
  return out;
}
export const readChecks = (root, group) => [...root.querySelectorAll(`[data-multi="${group}"]:checked`)].map((el) => el.value);

/** 画面下に短く出す知らせ（kind: ok / info / error）。画面を描き直しても消えない */
export function toast(text, kind = 'ok') {
  document.querySelector('.ad-toast')?.remove();
  const el = document.createElement('div');
  el.className = `ad-toast ${kind}`;
  el.setAttribute('role', 'status');
  el.textContent = text;
  document.body.append(el);
  setTimeout(() => el.classList.add('out'), 3500);
  setTimeout(() => el.remove(), 4000);
}
