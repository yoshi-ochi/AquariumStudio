/**
 * アプリ内の確認・選択の画面（ブラウザ標準の confirm / prompt の代わり）。画面の下から出るシート。
 *   choose：ボタンを並べて選んだ key を返す（閉じたら null）
 *   askConfirm：OK なら true
 *   showText：文字（URL など）を選択できる欄とコピーのボタン
 * 見た目は style.css の .sh-*。影は使わない
 */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function open(inner, onClick) {
  return new Promise((done) => {
    const el = document.createElement('div');
    el.className = 'sh-back';
    el.innerHTML = `<div class="sh-sheet" role="dialog" aria-modal="true">${inner}</div>`;
    const close = (v) => {
      el.remove();
      removeEventListener('keydown', key);
      done(v);
    };
    const key = (e) => e.key === 'Escape' && close(null);
    addEventListener('keydown', key);
    el.addEventListener('click', (e) => {
      if (e.target === el) return close(null);
      onClick(e, close, el);
    });
    document.body.append(el);
    el.querySelector('button.primary, button')?.focus();
  });
}

/** buttons: [{ key, label, kind: 'primary' | 'danger' | '' }] */
export function choose({ title, text = '', buttons, cancel = '閉じる' }) {
  const btns = buttons.map((b) => `<button data-k="${esc(b.key)}" class="${b.kind ?? ''}">${esc(b.label)}</button>`).join('');
  return open(`<b>${esc(title)}</b>${text ? `<p>${esc(text)}</p>` : ''}<div class="sh-btns">${btns}<button data-k="">${esc(cancel)}</button></div>`, (e, close) => {
    const b = e.target.closest('button[data-k]');
    if (b) close(b.dataset.k || null);
  });
}

export async function askConfirm({ title, text = '', ok = 'OK', cancel = 'キャンセル', danger = false }) {
  return (await choose({ title, text, buttons: [{ key: 'ok', label: ok, kind: danger ? 'danger' : 'primary' }], cancel })) === 'ok';
}

export function showText({ title, text = '', value }) {
  return open(`<b>${esc(title)}</b>${text ? `<p>${esc(text)}</p>` : ''}<input class="sh-input" readonly value="${esc(value)}">
    <div class="sh-btns"><button data-k="copy" class="primary">コピー</button><button data-k="">閉じる</button></div>`, async (e, close, el) => {
    const b = e.target.closest('button[data-k]');
    if (!b) return;
    if (b.dataset.k !== 'copy') return close(null);
    const input = el.querySelector('.sh-input');
    input.select();
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      document.execCommand?.('copy');
    }
    b.textContent = 'コピーしました';
    setTimeout(() => close('copied'), 700);
  });
}
