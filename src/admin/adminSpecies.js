import { CREATURES, SEASONS, RARITY_LIST, RARITY_NAME, getCreature } from '../expedition/creatureData.js';
import { METHODS, SPECIES_METHODS } from '../expedition/fishingData.js';
import { NOTES } from '../expedition/creatureNotes.js';
import { WATER, zoneOf } from '../expedition/husbandry.js';
import { baseCreature } from '../expedition/creatureConfig.js';
import { speciesEntry, allPools, setInPool, validId, idTaken } from './adminState.js';
import { esc, hex, unhex, field, select, checks, readFields, readChecks } from './adminUi.js';
import { swimHtml, bindSwim, readSwim } from './adminSwim.js';

const FORMS = () => [...new Set(CREATURES.map((c) => c.form))].sort();
const PATTERNS = [['', 'なし'], ['spots', '斑点'], ['bands', '横帯'], ['stripes', '縦じま'], ['mottle', 'まだら'], ['mask', '目の帯'], ['lateral', '側線'], ['clown', 'クマノミ'], ['palette', 'ナンヨウハギ']];
const ZONES = [['', '自動（採取地から）'], ...Object.entries(WATER).map(([k, v]) => [k, v.label])];

/** 魚種タブ：一覧（検索・採取地で絞り込み）と、選んだ魚種の編集 */
export class SpeciesTab {
  constructor(state, changed) {
    Object.assign(this, { state, changed });
    this.q = '';
    this.pool = '';
    this.sel = null;
  }

  html() {
    const pools = allPools();
    const q = this.q.trim();
    const list = CREATURES.filter((c) => (!q || c.name.includes(q) || c.id.includes(q)) && (!this.pool || pools.find((p) => p.id === this.pool)?.pool.includes(c.id)));
    const rows = list.map((c) => {
      const at = pools.filter((p) => p.pool.includes(c.id)).map((p) => p.name).join('・') || '—';
      const season = c.seasons?.length ? c.seasons.map((i) => SEASONS[i]).join('') : '通年';
      return `<tr data-id="${c.id}" class="${c.retired ? 'retired' : ''} ${this.sel === c.id ? 'sel' : ''}"><td>${esc(c.name)}${c.added ? ' <i>追加</i>' : ''}${c.retired ? ' <i>削除済</i>' : ''}<small>${c.id}</small></td>
        <td><i class="ad-rar r${c.rarity}">${RARITY_NAME[c.rarity]}</i></td><td>${c.len}m</td><td>${season}</td><td>${WATER[zoneOf(c.id)].label}</td><td class="ad-at">${esc(at)}</td></tr>`;
    }).join('');
    const filter = `<div class="ad-bar"><input id="ad-q" placeholder="名前・id で検索" value="${esc(this.q)}">
      <select id="ad-pool"><option value="">すべての採取地</option>${pools.map((p) => `<option value="${p.id}" ${p.id === this.pool ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
      <span>${list.length}種</span><button id="ad-new">＋ 魚種を追加</button></div>`;
    const editor = this.sel && getCreature(this.sel) ? this._editor(getCreature(this.sel)) : '<p class="ad-note">一覧の行を選ぶと編集できます。</p>';
    return `<div class="ad-split"><section class="ad-card">${filter}<div class="ad-scroll"><table class="ad-table"><thead><tr><th>名前</th><th>レア度</th><th>体長</th><th>季節</th><th>生息環境</th><th>採取地</th></tr></thead><tbody>${rows}</tbody></table></div></section>
      <section class="ad-card ad-edit">${editor}</section></div>`;
  }

  _editor(c) {
    const e = speciesEntry(this.state.cfg, c.id);
    const base = baseCreature(c.id);
    const pools = allPools();
    const look = c.added
      ? `<h4>見た目（追加した魚種）</h4><div class="ad-grid">${select('体形', 'form', c.form, FORMS().map((f) => [f, f]))}${select('模様', 'pat', c.pat ?? '', PATTERNS)}
          ${field('体の色', 'body', hex(c.colors.body), { type: 'color' })}${field('腹の色', 'belly', hex(c.colors.belly), { type: 'color' })}${field('ひれの色', 'fin', hex(c.colors.fin), { type: 'color' })}${field('模様の色', 'mark', hex(c.mark ?? 0x222222), { type: 'color' })}</div>`
      : '';
    return `<h3>${esc(c.name)} <small>${c.id}</small></h3>
      ${base ? `<p class="ad-note">組み込みの値：レア度 ${RARITY_NAME[base.rarity]} ・ 体長 ${base.len}m ・ 集客力 ${base.appeal}</p>` : ''}
      <div class="ad-grid">
        ${field('名前', 'name', c.name)}
        ${select('レア度（カードの色）', 'rarity', c.rarity, RARITY_LIST.map((n) => [n, RARITY_NAME[n]]))}
        ${field('標準体長(m)', 'len', c.len, { type: 'number', step: 0.01, min: 0.01 })}
        ${field('集客力', 'appeal', c.appeal, { type: 'number', step: 0.1, min: 0 })}
        ${select('生息環境（水温）', 'zone', e.zone ?? '', ZONES)}
      </div>
      ${checks('季節（どれも選ばない＝通年）', 'season', SEASONS.map((s, i) => [String(i), s]), (c.seasons ?? []).map(String))}
      ${checks('漁法（採取地で捕るのに必要）', 'method', METHODS.map((m) => [m.id, m.name]), SPECIES_METHODS[c.id] ?? [])}
      ${checks('採取地・合同調査', 'pool', pools.map((p) => [p.id, p.name]), pools.filter((p) => p.pool.includes(c.id)).map((p) => p.id))}
      <label class="ad-field wide"><span>図鑑の解説</span><textarea data-f="note" rows="3">${esc(NOTES[c.id] ?? '')}</textarea></label>
      ${look}
      ${swimHtml(c)}
      <div class="ad-acts"><button id="ad-apply" class="primary">この内容にする</button>
        ${c.retired ? '<button id="ad-restore">削除を取り消す</button>' : '<button id="ad-remove" class="danger">この魚種を削除</button>'}</div>
      <p class="ad-note">削除しても、すでに持っているプレイヤーの在庫・展示は残ります（捕れなくなり、図鑑の対象から外れます）。</p>`;
  }

  bind(root) {
    const q = root.querySelector('#ad-q');
    q.oninput = () => {
      this.q = q.value;
      this.changed();
      const el = document.getElementById('ad-q');
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    };
    root.querySelector('#ad-pool').onchange = (e) => {
      this.pool = e.target.value;
      this.changed();
    };
    root.querySelector('tbody').onclick = (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      this.sel = tr.dataset.id;
      this.changed();
    };
    root.querySelector('#ad-new').onclick = () => this._add();
    const edit = root.querySelector('.ad-edit');
    const c = this.sel && getCreature(this.sel);
    if (c) bindSwim(edit, c);
    edit.querySelector('#ad-apply')?.addEventListener('click', () => this._save(edit));
    edit.querySelector('#ad-remove')?.addEventListener('click', () => this._setRemoved(true));
    edit.querySelector('#ad-restore')?.addEventListener('click', () => this._setRemoved(false));
  }

  _save(root) {
    const c = getCreature(this.sel);
    const f = readFields(root);
    if (!f.name.trim()) return alert('名前を入力してください');
    if (!(f.len > 0)) return alert('体長は0より大きくしてください');
    const e = speciesEntry(this.state.cfg, c.id);
    Object.assign(e, { name: f.name.trim(), rarity: +f.rarity, len: +f.len, appeal: +f.appeal || 0, zone: f.zone, note: f.note.trim() });
    delete e.xp;
    e.seasons = readChecks(root, 'season').map(Number);
    e.methods = readChecks(root, 'method');
    const { swim, beh } = readSwim(root.querySelector('#ad-swim'), c);
    for (const [k, v] of [['swim', swim], ['beh', beh]]) if (v) e[k] = v; else delete e[k];
    if (c.added) {
      Object.assign(e, { form: f.form, pat: f.pat, colors: { body: unhex(f.body), belly: unhex(f.belly), fin: unhex(f.fin) }, mark: unhex(f.mark) });
      if (!e.methods.length) e.methods = ['setnet'];
    }
    const chosen = new Set(readChecks(root, 'pool'));
    for (const p of allPools()) if (chosen.has(p.id) !== p.pool.includes(c.id)) setInPool(this.state.cfg, p.id, c.id, chosen.has(p.id));
    this.changed();
  }

  _setRemoved(on) {
    const c = getCreature(this.sel);
    if (on && !confirm(`${c.name} を削除しますか？（あとで取り消せます）`)) return;
    speciesEntry(this.state.cfg, c.id).removed = on;
    this.changed();
  }

  _add() {
    const name = prompt('新しい魚種の名前（和名）');
    if (!name?.trim()) return;
    const id = prompt('id（英小文字・数字・_。例：kumanomi2）')?.trim();
    if (!id) return;
    if (!validId(id)) return alert('id は英小文字で始まる2〜31文字（英小文字・数字・_）にしてください');
    if (idTaken(id)) return alert('その id はすでに使われています');
    this.state.cfg.added ??= [];
    this.state.cfg.added.push({ id, name: name.trim(), form: 'perch', len: 0.2, rarity: 1, appeal: 1, colors: { body: 0x8a8a8a, belly: 0xe0e0e0, fin: 0x6a6a6a }, methods: ['setnet', 'diving'] });
    this.sel = id;
    this.q = '';
    this.pool = '';
    this.changed();
  }
}
