import { PLANNED, NEW_PLACES } from '../expedition/speciesRoster.js';
import { isModeled } from '../expedition/speciesRelease.js';
import { RELEASES } from '../expedition/speciesReleases.js';
import { esc, toast } from './adminUi.js';

/**
 * モデル待ちタブ：追加予定種（speciesRoster.js）とリスト外の種の一覧。参考画像（横・上・正面・その他）とメモを登録し、
 * 「モデル制作へ」で制作を依頼する。画像は Supabase の非公開ストレージ species-ref、状況は species_intake 表（supabase/species_intake.sql）。
 * PC 側は npm run species:pull で reference/fish/<和名>/ に取り込み、状況を「制作中」にする。
 */
const BUCKET = 'species-ref';
const KINDS = [
  ['side', '横から（メイン）', '真横から体全体が写った1枚。輪郭・体色の基準になります', false],
  ['top', '上から', '体の幅・厚みの参考', false],
  ['front', '正面', '体の厚み・顔つきの参考', false],
  ['ref', 'その他', 'ひれ・模様のアップ、雌雄・幼魚など（何枚でも）', true],
];
const STATES = {
  released: ['公開済み', 'done'],
  modeled: ['モデル完成', 'done'],
  modeling: ['制作中', 'work'],
  requested: ['制作依頼済み', 'req'],
  ready: ['画像あり', 'ready'],
  wait: ['画像待ち', 'wait'],
};
const FILTERS = [['todo', '未完成'], ['wait', '画像待ち'], ['ready', '画像あり'], ['req', '依頼・制作中'], ['done', '完成・公開'], ['all', 'すべて']];
const MAX_SIDE = 2000;

/** 画像を縦横 MAX_SIDE 以内の JPEG にする（スマホの大きな写真をそのまま送らない） */
async function shrink(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(bmp.width * k);
  cv.height = Math.round(bmp.height * k);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  bmp.close();
  const blob = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.9));
  return { blob, w: cv.width, h: cv.height };
}

export class ModelingTab {
  constructor(sb, rerender) {
    Object.assign(this, { sb, rerender });
    this.rows = null; // id → species_intake の行
    this.urls = new Map(); // path → 署名付き URL
    this.sel = null;
    this.filter = 'todo';
    this.busy = false;
    this.error = '';
  }

  /** 一覧の項目 [{ id, name, places, planned, row, state }] */
  _list() {
    const rows = this.rows ?? {};
    const out = PLANNED.map((p) => ({ id: p.id, name: p.name, planned: p, places: NEW_PLACES.filter((d) => d.pool.includes(p.id)).map((d) => d.name) }));
    for (const r of Object.values(rows)) if (!out.some((x) => x.id === r.id)) out.push({ id: r.id, name: r.name, places: [] });
    for (const x of out) {
      x.row = rows[x.id];
      const side = x.row?.images.some((i) => i.kind === 'side');
      x.state = x.planned && RELEASES[x.id] ? 'released' : x.planned && isModeled(x.planned) ? 'modeled' : x.row?.status === 'modeling' ? 'modeling' : x.row?.status === 'requested' ? 'requested' : side ? 'ready' : 'wait';
    }
    return out;
  }

  html() {
    if (!this.rows) {
      this._load();
      return `<section class="ad-card"><p class="ad-note">${esc(this.error || '読み込み中…')}</p></section>`;
    }
    const all = this._list();
    const cls = (x) => STATES[x.state][1];
    const shown = all.filter((x) => this.filter === 'all' || (this.filter === 'todo' ? cls(x) !== 'done' : this.filter === 'req' ? cls(x) === 'req' || cls(x) === 'work' : cls(x) === this.filter));
    const count = (f) => all.filter((x) => (f === 'all' ? true : f === 'todo' ? cls(x) !== 'done' : f === 'req' ? cls(x) === 'req' || cls(x) === 'work' : cls(x) === f)).length;
    const chips = FILTERS.map(([f, t]) => `<button data-filter="${f}" class="${this.filter === f ? 'active' : ''}">${t} ${count(f)}</button>`).join('');
    const items = shown.map((x) => {
      const side = x.row?.images.find((i) => i.kind === 'side');
      const thumb = side && this.urls.get(side.path) ? `<img src="${esc(this.urls.get(side.path))}" alt="">` : '<span>🐟</span>';
      const n = x.row?.images.length ?? 0;
      return `<li data-id="${esc(x.id)}" class="${this.sel === x.id ? 'sel' : ''}"><div class="ad-mthumb">${thumb}</div>
        <div><b>${esc(x.name)}</b><small>${esc(x.planned ? x.places.join('・') || '採取地なし' : 'リスト外')}${n ? ` ・ 画像${n}枚` : ''}</small></div>
        <i class="ad-mst ${cls(x)}">${STATES[x.state][0]}</i></li>`;
    }).join('');
    const cur = all.find((x) => x.id === this.sel);
    return `<div class="ad-split"><section class="ad-card"><h3>モデル待ちの魚種</h3>
      <p class="ad-note">参考画像を登録して「モデル制作へ」を押すと、制作の対象になります。モデルが出来た種は、次の公開で自動的にゲームへ加わります。</p>
      <div class="ad-chips">${chips}</div><ul class="ad-mlist">${items || '<p class="ad-note">該当する種はありません。</p>'}</ul>
      <div class="ad-acts"><button id="ad-mnew">＋ リスト外の種を追加</button></div></section>
      <section class="ad-card ad-edit">${cur ? this._editor(cur) : '<p class="ad-note">一覧の種を選ぶと、画像を登録できます。</p>'}</section></div>`;
  }

  _editor(x) {
    const imgs = x.row?.images ?? [];
    const locked = x.state === 'released' || x.state === 'modeled';
    const slots = KINDS.map(([kind, label, hint, multi]) => {
      const list = imgs.filter((i) => i.kind === kind);
      const pics = list.map((i) => `<figure><img src="${esc(this.urls.get(i.path) ?? '')}" alt=""><button data-del="${esc(i.path)}" title="削除" ${this.busy ? 'disabled' : ''}>✕</button></figure>`).join('');
      const add = multi || !list.length ? `<label class="ad-mup ${this.busy ? 'off' : ''}">＋ ${list.length ? '追加' : '画像を選ぶ'}<input type="file" accept="image/*" data-kind="${kind}" ${multi ? 'multiple' : ''} hidden ${this.busy ? 'disabled' : ''}></label>` : '';
      return `<div class="ad-mslot"><h4>${label}${kind === 'side' ? ' <small>必須</small>' : ''}</h4><p class="ad-note">${hint}</p><div class="ad-mpics">${pics}${add}</div></div>`;
    }).join('');
    const p = x.planned;
    const info = p ? `<p class="ad-note">id ${esc(p.id)} ・ 全長 ${p.len}m ・ ${esc(x.places.join('・') || '採取地なし')}</p>${p.note ? `<p class="ad-note">${esc(p.note)}</p>` : ''}` : '<p class="ad-note">リスト外の種です。制作のときに採取地・データも決めます。</p>';
    const status = x.row?.status ?? 'draft';
    const act = locked
      ? `<p class="ad-note">モデルは完成しています（${STATES[x.state][0]}）。</p>`
      : status === 'draft'
        ? `<button id="ad-mreq" class="primary" ${imgs.some((i) => i.kind === 'side') && !this.busy ? '' : 'disabled'}>モデル制作へ</button>${imgs.some((i) => i.kind === 'side') ? '' : '<span class="ad-note">横からの画像を登録すると依頼できます</span>'}`
        : `<span class="ad-mst ${STATES[x.state][1]}">${STATES[x.state][0]}</span><button id="ad-mcancel" ${this.busy ? 'disabled' : ''}>依頼を取り下げる</button>`;
    return `<h3>${esc(x.name)} <i class="ad-mst ${STATES[x.state][1]}">${STATES[x.state][0]}</i></h3>${info}
      ${slots}
      <label class="ad-field wide"><span>制作メモ（体色・模様・雌雄など、伝えたいこと）</span><textarea id="ad-mmemo" rows="3">${esc(x.row?.memo ?? '')}</textarea></label>
      <div class="ad-acts"><button id="ad-mmemo-save" ${this.busy ? 'disabled' : ''}>メモを保存</button>${act}${!p && !imgs.length ? '<button id="ad-mdrop" class="danger">この種を一覧から消す</button>' : ''}</div>
      ${this.busy ? '<p class="ad-note">送信中…</p>' : ''}`;
  }

  bind(root) {
    root.querySelector('.ad-chips')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-filter]');
      if (b) (this.filter = b.dataset.filter), this.rerender();
    });
    root.querySelector('.ad-mlist')?.addEventListener('click', (e) => {
      const li = e.target.closest('[data-id]');
      if (!li) return;
      this.sel = li.dataset.id;
      this.rerender();
      if (innerWidth <= 900) root.querySelector('.ad-edit')?.scrollIntoView({ behavior: 'smooth' });
    });
    root.querySelector('#ad-mnew')?.addEventListener('click', () => this._addCustom());
    const edit = root.querySelector('.ad-edit');
    const x = this._list().find((i) => i.id === this.sel);
    if (!edit || !x) return;
    edit.querySelectorAll('input[type=file]').forEach((el) => el.addEventListener('change', () => this._upload(x, el.dataset.kind, [...el.files])));
    edit.querySelectorAll('[data-del]').forEach((el) => el.addEventListener('click', () => this._remove(x, el.dataset.del)));
    edit.querySelector('#ad-mmemo-save')?.addEventListener('click', () => this._save(x, { memo: edit.querySelector('#ad-mmemo').value }, 'メモを保存しました'));
    edit.querySelector('#ad-mreq')?.addEventListener('click', () => this._save(x, { status: 'requested', memo: edit.querySelector('#ad-mmemo').value }, `${x.name}をモデル制作に回しました`));
    edit.querySelector('#ad-mcancel')?.addEventListener('click', () => confirm('制作の依頼を取り下げますか？') && this._save(x, { status: 'draft' }, '依頼を取り下げました'));
    edit.querySelector('#ad-mdrop')?.addEventListener('click', () => this._drop(x));
  }

  async _load() {
    if (this._loading) return;
    this._loading = true;
    const res = await this.sb.from('species_intake').select('*');
    this._loading = false;
    if (res.error) {
      this.error = `読み込めませんでした（supabase/species_intake.sql を実行してください）：${res.error.message}`;
      return this.rerender();
    }
    this.rows = Object.fromEntries(res.data.map((r) => [r.id, r]));
    await this._sign(res.data.flatMap((r) => r.images.map((i) => i.path)));
    this.rerender();
  }

  /** 非公開の画像を表示するための署名付き URL（1時間） */
  async _sign(paths) {
    const need = paths.filter((p) => !this.urls.has(p));
    if (!need.length) return;
    const res = await this.sb.storage.from(BUCKET).createSignedUrls(need, 3600);
    for (const s of res.data ?? []) if (s.signedUrl) this.urls.set(s.path, s.signedUrl);
  }

  async _write(x, patch) {
    const { data: { user } } = await this.sb.auth.getUser();
    const row = { id: x.id, name: x.name, status: x.row?.status ?? 'draft', images: x.row?.images ?? [], memo: x.row?.memo ?? '', ...patch, updated_at: new Date().toISOString(), updated_by: user.id };
    const res = await this.sb.from('species_intake').upsert(row).select().single();
    if (res.error) throw res.error;
    this.rows[x.id] = res.data;
  }

  async _run(fn, done) {
    this.busy = true;
    this.rerender();
    try {
      await fn();
      if (done) toast(done);
    } catch (e) {
      toast(`失敗しました：${e.message ?? e}`, 'error');
    }
    this.busy = false;
    this.rerender();
  }

  _save(x, patch, done) {
    return this._run(() => this._write(x, patch), done);
  }

  _upload(x, kind, files) {
    if (!files.length) return;
    return this._run(async () => {
      const added = [];
      for (const f of files) {
        const { blob, w, h } = await shrink(f);
        const path = `${x.id}/${kind}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.jpg`;
        const up = await this.sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
        if (up.error) throw up.error;
        added.push({ kind, path, w, h });
      }
      await this._write(x, { images: [...(x.row?.images ?? []), ...added] });
      await this._sign(added.map((i) => i.path));
    }, `${files.length}枚を登録しました`);
  }

  _remove(x, path) {
    if (!confirm('この画像を削除しますか？')) return;
    return this._run(async () => {
      await this._write(x, { images: x.row.images.filter((i) => i.path !== path) });
      await this.sb.storage.from(BUCKET).remove([path]);
    }, '画像を削除しました');
  }

  _addCustom() {
    const name = prompt('追加する種の和名')?.trim();
    if (!name) return;
    const hit = this._list().find((x) => x.name === name);
    if (hit) return (this.sel = hit.id), this.rerender();
    const x = { id: `c_${Date.now().toString(36)}`, name };
    this.sel = x.id;
    return this._save(x, {}, `${name}を追加しました`);
  }

  _drop(x) {
    if (!confirm(`${x.name}を一覧から消しますか？`)) return;
    return this._run(async () => {
      const res = await this.sb.from('species_intake').delete().eq('id', x.id);
      if (res.error) throw res.error;
      delete this.rows[x.id];
      this.sel = null;
    }, '消しました');
  }
}
