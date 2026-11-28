import { activeCreatures, DESTINATIONS, RARITY_NAME } from '../expedition/creatureData.js';
import { creatureThumb } from './creatureThumb.js';

/**
 * ログイン時の「新しく追加された魚種」。前回この端末でログインしたときに居なかった魚種と採取地を一覧で知らせる。
 * 初めての端末では、公開から2週間以内の魚種・採取地を「最近の追加」として出す。
 */
const RECENT_MS = 14 * 24 * 3600 * 1000;
const keyOf = (uid) => `aq-species-seen:${uid ?? 'local'}`;

function readSeen(uid) {
  try {
    return JSON.parse(localStorage.getItem(keyOf(uid)) ?? 'null');
  } catch {
    return null;
  }
}

function markSeen(uid) {
  try {
    localStorage.setItem(keyOf(uid), JSON.stringify({ ids: activeCreatures().map((c) => c.id), places: DESTINATIONS.map((d) => d.id), at: Date.now() }));
  } catch {
    /* 保存できない環境では毎回出さない（記録がないと最近の追加だけ出る） */
  }
}

/** 公開日（日本時間の日付）から2週間以内か */
const recent = (date, now) => {
  const t = date ? Date.parse(`${date}T00:00:00+09:00`) : NaN;
  return t <= now && now - t < RECENT_MS;
};

/** 案内する魚種と採取地（新しい順） */
export function newArrivals(uid, now = Date.now()) {
  const seen = readSeen(uid);
  const species = activeCreatures()
    .filter((c) => (seen?.ids ? !seen.ids.includes(c.id) : recent(c.released, now)))
    .sort((a, b) => (b.released ?? '9').localeCompare(a.released ?? '9') || b.rarity - a.rarity);
  const places = DESTINATIONS.filter((d) => (seen?.places ? !seen.places.includes(d.id) : recent(d.opened, now)));
  return { species, places, first: !seen };
}

const placeOf = (id) => DESTINATIONS.find((d) => d.pool.includes(id))?.name ?? '';
const day = (date) => (date ? `${+date.slice(5, 7)}/${+date.slice(8, 10)}` : 'NEW');
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

/** 新しい魚種があれば一覧を表示し、閉じたら resolve。無ければすぐ resolve */
export function showNewSpecies({ previews, uid, onOpenMap }) {
  const { species, places, first } = newArrivals(uid);
  if (!species.length && !places.length) {
    markSeen(uid);
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.id = 'new-species';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', '新しく追加された魚種');
    const cards = species
      .map((c) => `<li class="ns-card">${creatureThumb(previews, c.id)}<span class="ns-text"><b>${esc(c.name)}</b><small>${esc(placeOf(c.id))}</small><small class="ns-meta"><span class="ns-r r${c.rarity}">${RARITY_NAME[c.rarity]}</span>${day(c.released)} 追加</small></span></li>`)
      .join('');
    const placeHtml = places.map((d) => `<li><b>${esc(d.name)}</b><small>${esc(d.text)}</small></li>`).join('');
    // 見出しと閉じるボタンは固定し、一覧だけをスクロールする（長い一覧でも閉じるボタンが見える）
    el.innerHTML = `<div class="ns-box">
      <div class="ns-head"><h2>${first ? '最近追加された生き物' : '新しく追加された生き物'}</h2><button type="button" class="ns-x" data-act="close" aria-label="閉じる">✕</button></div>
      <div class="ns-body">
        ${species.length ? `<p class="ns-lead">${species.length}種が採取できるようになりました</p><ul class="ns-grid">${cards}</ul>` : ''}
        ${places.length ? `<h3>新しい採取地 ${places.length}か所</h3><ul class="ns-places">${placeHtml}</ul>` : ''}
      </div>
      <div class="ns-actions">${places.length && onOpenMap ? '<button type="button" data-act="map">地図で見る</button>' : ''}<button type="button" class="primary" data-act="close">閉じる</button></div>
    </div>`;
    const close = (act) => {
      markSeen(uid);
      el.remove();
      resolve(true);
      if (act === 'map') onOpenMap?.();
    };
    el.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act) close(act);
      else if (e.target === el) close('close');
    });
    document.body.append(el);
    el.querySelector('.ns-actions [data-act=close]').focus({ preventScroll: true });
  });
}
