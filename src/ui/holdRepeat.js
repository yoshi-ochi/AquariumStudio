/**
 * data-repeat を付けたボタンの長押し：押し続けると連続でタップしたことにし、1回ごとに短く振動する。
 * 押すたびに画面が描き直されても続けられるよう、同じ操作のボタン（data-act と aria-label / data-id）を探し直す。
 * data-repeat="250" のように値を付けると、連打の最短間隔（ミリ秒）を変えられる（通信を伴う操作向け）。
 */
const DELAY = 400; // 長押しと判定するまで
const FIRST_GAP = 180; // 連打の最初の間隔（だんだん速くなる）
const MIN_GAP = 60;

const keyOf = (b) => `${b.dataset.act}|${b.getAttribute('aria-label') ?? b.dataset.id ?? b.textContent.trim()}`;
const buzz = (ms) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* 振動できない端末 */
  }
};

export function installHoldRepeat(root = document) {
  let timer = 0;
  let key = null;
  let scope = null;
  let minGap = MIN_GAP;
  let fired = 0;
  let suppressUntil = 0;

  const find = () => [...(scope?.isConnected ? scope : document.body).querySelectorAll('button[data-repeat]')].find((b) => keyOf(b) === key);
  const stop = () => {
    clearTimeout(timer);
    if (fired) suppressUntil = performance.now() + 500; // 指を離したときの通常のクリックは数えない
    key = null;
    fired = 0;
  };
  const tick = (gap) => {
    const b = key && find();
    if (!b || b.disabled) return stop();
    b.click();
    fired++;
    buzz(8);
    timer = setTimeout(() => tick(Math.max(minGap, gap * 0.85)), gap);
  };

  root.addEventListener('pointerdown', (e) => {
    const b = e.target.closest?.('button[data-repeat]');
    if (!b || b.disabled || e.button > 0) return;
    stop();
    key = keyOf(b);
    scope = b.parentElement?.closest('[id]') ?? document.body;
    minGap = Math.max(MIN_GAP, +b.dataset.repeat || 0);
    timer = setTimeout(() => {
      buzz(15);
      tick(Math.max(FIRST_GAP, minGap));
    }, DELAY);
  });
  for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, stop, true);
  window.addEventListener('blur', stop);
  document.addEventListener('visibilitychange', stop);
  root.addEventListener('click', (e) => {
    if (!e.isTrusted || performance.now() > suppressUntil) return;
    suppressUntil = 0;
    e.stopPropagation();
    e.preventDefault();
  }, true);
  root.addEventListener('contextmenu', (e) => e.target.closest?.('button[data-repeat]') && e.preventDefault());
}
