/**
 * スクロールする画面は、開くたびに先頭（横並びは左端）から表示する。
 * hidden が外れた（表示された）ときに、その要素と中のスクロール領域を先頭へ戻す。
 * ゲームシート（#game-sheet）は再描画のたびに作り直すので gameSheet.js 側で扱う。
 */
const scrollers = (root) => [root, ...root.querySelectorAll('*')].filter((el) => el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth);

export function toTop(root) {
  for (const el of scrollers(root)) {
    el.scrollTop = 0;
    el.scrollLeft = 0;
  }
}

export function watchScrollReset(ids) {
  const obs = new MutationObserver((list) => {
    for (const m of list) if (!m.target.hidden && m.oldValue !== null) requestAnimationFrame(() => toTop(m.target));
  });
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) obs.observe(el, { attributes: true, attributeFilter: ['hidden'], attributeOldValue: true });
  }
}
