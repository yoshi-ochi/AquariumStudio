import { CREATURES } from '../expedition/creatureData.js';
import { esc } from './adminUi.js';
import { normalizeName, validName, isGenericName } from './intakeNames.js';

/**
 * モデル待ちタブの「和名だけで仮登録」の欄。
 * 入力するたびに、既存の種・追加予定種・仮登録との重複をその場で知らせる（ID・学名などは聞かない。モデルを作るときに調べて補う）。
 */
const HINT = 'リストに無い種は、和名だけで追加できます。ID・学名・体形・全長・レア度・採取地・解説は、モデルを作るときに調べて補います。';

/** 和名を確かめる。list はモデル待ちタブの一覧（追加予定種＋仮登録）。kind: empty | invalid | planned | custom | game | ok */
export function checkName(raw, list) {
  const name = normalizeName(raw);
  if (!name) return { name, kind: 'empty', text: HINT };
  if (!validName(name)) return { name, kind: 'invalid', text: '和名は30文字以内で、記号（\\ / : * ? " < > | .）は使えません。' };
  const hit = list.find((x) => normalizeName(x.name) === name);
  if (hit) {
    const made = hit.state === 'released' || hit.state === 'modeled';
    const text = made ? `「${hit.name}」はモデルが完成している種です（追加できません）。` : hit.planned ? `「${hit.name}」は追加予定のリストにあります。新しく追加せず、その種を開いて画像を登録してください。` : `「${hit.name}」はすでに仮登録されています。`;
    return { name, kind: hit.planned ? 'planned' : 'custom', id: hit.id, text };
  }
  if (CREATURES.some((c) => normalizeName(c.name) === name)) return { name, kind: 'game', text: `「${name}」はすでにゲームにいる種です（追加できません）。` };
  const generic = isGenericName(name);
  return { name, kind: 'ok', generic, text: generic ? `「${name}」は総称（属・科のまとまり）に見えます。総称のモデルは作れないので、種の和名で登録してください。` : `「${name}」を和名だけで仮登録します。残りの情報は、モデルを作るときに調べて補います。` };
}

export const addFormHtml = (tab) => `<form id="ad-mnew" class="ad-mnew"><div class="ad-bar"><input id="ad-mname" placeholder="和名だけで追加（例：アオリイカ）" maxlength="40" autocomplete="off" value="${esc(tab.newName ?? '')}"><button class="primary" disabled>＋ 追加</button></div><p id="ad-mdup" class="ad-note">${esc(HINT)}</p></form>`;

/** 欄をつなぐ。add(name) は仮登録、open(id) は一覧の種を開く */
export function bindAddForm(root, tab, { list, add, open }) {
  const form = root.querySelector('#ad-mnew');
  if (!form) return;
  const input = form.querySelector('#ad-mname');
  const btn = form.querySelector('button');
  const note = form.querySelector('#ad-mdup');
  const show = () => {
    const r = checkName(input.value, list());
    const dup = r.kind === 'planned' || r.kind === 'custom';
    btn.disabled = tab.busy || !(r.kind === 'ok' || dup);
    btn.textContent = dup ? 'この種を開く' : '＋ 追加';
    note.textContent = r.text;
    note.className = `ad-note ${r.kind === 'ok' && !r.generic ? 'ok' : r.kind === 'empty' ? '' : 'warn'}`;
    return r;
  };
  input.addEventListener('input', () => {
    tab.newName = input.value;
    show();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const r = show();
    if (r.kind === 'planned' || r.kind === 'custom') return (tab.newName = ''), open(r.id);
    if (r.kind === 'ok') (tab.newName = ''), add(r.name);
  });
  show();
}
