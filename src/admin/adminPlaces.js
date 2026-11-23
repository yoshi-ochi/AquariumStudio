import { DESTINATIONS, JOINT_PROJECTS, RETIRED_PLACES, STAR_LIST, starLabel, getCreature, activeCreatures } from '../expedition/creatureData.js';
import { WATER } from '../expedition/husbandry.js';
import { basePlace } from '../expedition/creatureConfig.js';
import { placeEntry, setInPool, validId, idTaken } from './adminState.js';
import { esc, num, field, select, readFields } from './adminUi.js';

const ZONES = [['', '自動'], ...Object.entries(WATER).map(([k, v]) => [k, v.label])];

/** 採取地タブ：採取地の名前・費用・位置・水温と、捕れる生き物。合同調査は捕れる生き物だけ編集できる */
export class PlacesTab {
  constructor(state, changed) {
    Object.assign(this, { state, changed });
  }

  html() {
    const places = DESTINATIONS.map((d) => this._place(d)).join('');
    const joint = JOINT_PROJECTS.map((p) => this._pool(p.id, `合同調査：${p.name}`, p.pool, `<p class="ad-note">費用 ¥${num(p.cost)} ・ 同盟Lv${p.level} ・ ${p.hours}時間（費用・時間はサーバーの SQL で管理）</p>`)).join('');
    const retired = RETIRED_PLACES.map((d) => `<div class="ad-row"><span>${esc(d.name)}（削除済）</span><button data-restore="${d.id}">削除を取り消す</button></div>`).join('');
    return `<div class="ad-bar"><button id="ad-new-place">＋ 採取地を追加</button><span class="ad-note">捕れる確率は星の数の「出現の重み」で決まります（星・経験値タブ）。</span></div>
      ${places}${joint}${retired ? `<section class="ad-card"><h3>削除した採取地</h3>${retired}</section>` : ''}`;
  }

  _place(d) {
    const base = basePlace(d.id);
    const form = `<div class="ad-grid" data-place="${d.id}">
        ${field('名前', 'name', d.name)}${field('説明', 'text', d.text, { wide: true })}
        ${field('解放ステージ', 'stage', d.stage, { type: 'number', min: 1, max: 9 })}${field('基本費用(円)', 'cost', d.cost, { type: 'number', min: 1 })}
        ${field('緯度', 'lat', d.lat, { type: 'number', step: 0.1, min: -85, max: 85 })}${field('経度', 'lon', d.lon, { type: 'number', step: 0.1, min: -180, max: 180 })}
        ${select('水温（生息環境の既定）', 'zone', d.zone ?? '', ZONES)}
      </div><div class="ad-acts"><button data-save="${d.id}" class="primary">この内容にする</button><button data-remove="${d.id}" class="danger">採取地を削除</button></div>`;
    return this._pool(d.id, `${d.name}${base ? '' : ' <i>追加</i>'}`, d.pool, form);
  }

  /** 捕れる生き物の一覧（外すボタン付き）と、追加の選択 */
  _pool(id, title, pool, extra) {
    const chips = pool.map((cid) => {
      const c = getCreature(cid);
      return `<span class="ad-chip s${c.stars}">${esc(c.name)}<small>${starLabel(c.stars)}</small><button data-out="${id}:${cid}" aria-label="${esc(c.name)}を外す">×</button></span>`;
    }).join('');
    const options = activeCreatures().filter((c) => !pool.includes(c.id)).map((c) => `<option value="${c.id}">${esc(c.name)}（${starLabel(c.stars)}）</option>`).join('');
    const count = STAR_LIST.map((r) => `★${r} ${pool.filter((x) => getCreature(x).stars === r).length}`).join(' ・ ');
    return `<section class="ad-card"><h3>${title}</h3>${extra}
      <h4>捕れる生き物 ${pool.length}種 <small>${count}</small></h4><div class="ad-chips">${chips || '<span class="ad-note">いません</span>'}</div>
      <div class="ad-bar"><select data-pick="${id}"><option value="">生き物を加える…</option>${options}</select></div></section>`;
  }

  bind(root) {
    root.querySelector('#ad-new-place').onclick = () => this._add();
    root.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.out) {
        const [pid, cid] = b.dataset.out.split(':');
        setInPool(this.state.cfg, pid, cid, false);
        this.changed();
      } else if (b.dataset.save) this._save(root, b.dataset.save);
      else if (b.dataset.remove) {
        const d = DESTINATIONS.find((x) => x.id === b.dataset.remove);
        if (!confirm(`${d.name} を削除しますか？（航海中の調査隊はそのまま帰れます。あとで取り消せます）`)) return;
        placeEntry(this.state.cfg, d.id).removed = true;
        this.changed();
      } else if (b.dataset.restore) {
        placeEntry(this.state.cfg, b.dataset.restore).removed = false;
        this.changed();
      }
    };
    for (const sel of root.querySelectorAll('[data-pick]')) {
      sel.onchange = () => {
        if (!sel.value) return;
        setInPool(this.state.cfg, sel.dataset.pick, sel.value, true);
        this.changed();
      };
    }
  }

  _save(root, id) {
    const f = readFields(root.querySelector(`[data-place="${id}"]`));
    if (!f.name.trim()) return alert('名前を入力してください');
    if (!(f.cost > 0)) return alert('費用は1円以上にしてください');
    if (!(Math.abs(f.lat) <= 85 && Math.abs(f.lon) <= 180)) return alert('緯度は -85〜85、経度は -180〜180 にしてください');
    Object.assign(placeEntry(this.state.cfg, id), { name: f.name.trim(), text: f.text.trim(), stage: Math.max(1, Math.round(f.stage) || 1), cost: Math.round(f.cost), lat: +f.lat, lon: +f.lon, zone: f.zone });
    this.changed();
  }

  _add() {
    const name = prompt('新しい採取地の名前');
    if (!name?.trim()) return;
    const id = prompt('id（英小文字・数字・_。例：okinawa_deep）')?.trim();
    if (!id) return;
    if (!validId(id)) return alert('id は英小文字で始まる2〜31文字（英小文字・数字・_）にしてください');
    if (idTaken(id)) return alert('その id はすでに使われています');
    this.state.cfg.addedPlaces ??= [];
    this.state.cfg.addedPlaces.push({ id, name: name.trim(), text: '', stage: 1, cost: 10000, lat: 35, lon: 139, zone: 'temperate', pool: [] });
    this.changed();
  }
}
