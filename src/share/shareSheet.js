/**
 * 共有の操作を選ぶ小さなシート（共有中の水槽で「共有」を押したとき）。選んだボタンの key を返す（閉じたら null）
 * buttons: [{ key, label, kind: 'primary' | 'danger' | '' }]
 */
export function chooseShare({ title, text, buttons }) {
  return new Promise((done) => {
    const el = document.createElement('div');
    el.className = 'sh-back';
    el.innerHTML = `<div class="sh-sheet" role="dialog" aria-label="${title}"><b>${title}</b><p>${text}</p>
      <div class="sh-btns">${buttons.map((b) => `<button data-k="${b.key}" class="${b.kind ?? ''}">${b.label}</button>`).join('')}<button data-k="">閉じる</button></div></div>`;
    const close = (k) => {
      el.remove();
      done(k || null);
    };
    el.addEventListener('click', (e) => {
      if (e.target === el) return close(null);
      const b = e.target.closest('button[data-k]');
      if (b) close(b.dataset.k);
    });
    document.body.append(el);
  });
}
