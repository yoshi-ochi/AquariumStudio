import { ZONES, getZone } from '../building/blueprint.js';
import { PEN } from '../building/seaPen.js';

const yen = (n) => `¥${Math.floor(n).toLocaleString('ja-JP')}`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * レイアウト編集の「増築」タブ：地下展示室・別館・屋外生け簀の解放（ここからだけ行える）。
 */
export class ExpandPanel {
  constructor({ el, economy, getUnlocked, seaPen, onUnlockZone, onSeaPen }) {
    Object.assign(this, { el, economy, getUnlocked, seaPen, onUnlockZone, onSeaPen });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (b) this._act(b.dataset.act, b.dataset.id);
    });
    economy.addEventListener?.('change', () => !this.el.hidden && this.render());
  }

  setVisible(v) {
    this.el.hidden = !v;
    if (v) this.render();
  }

  render() {
    const unlocked = this.getUnlocked();
    const level = this.economy.stage.level;
    const row = (z) => {
      if (unlocked.has(z.id)) return `<div class="ep-row done"><div><b>${esc(z.name)}</b><small>${z.text}</small></div><span>${z.wing ? '建設済み' : '解放済み'}</span></div>`;
      const lack = z.stage > level ? `水族館レベル${z.stage}で${z.wing ? '建設' : '増築'}できます` : z.requires && !unlocked.has(z.requires) ? `先に${esc(getZone(z.requires).name)}を${z.wing ? '建設' : '増築'}` : '';
      const ok = !lack && this.economy.canAfford(z.cost);
      return `<div class="ep-row"><div><b>${esc(z.name)}</b><small>${z.text}</small>${lack ? `<small class="ep-lack">${lack}</small>` : ''}</div>
        <button data-act="zone-open" data-id="${z.id}" class="primary" ${ok ? '' : 'disabled'}>${z.wing ? '建設' : '増築'} ${yen(z.cost)}</button></div>`;
    };
    // 次に解放できるものまでを並べる（その先は隠す）
    const chain = (list) => list.filter((z, i) => unlocked.has(z.id) || i === 0 || unlocked.has(list[i - 1].id) || !z.requires || unlocked.has(z.requires));
    const annex = chain(ZONES.filter((z) => z.annex && !z.wing && !z.auto)).map(row).join('');
    const wings = chain(ZONES.filter((z) => z.wing)).map(row).join('');
    const pen = this.seaPen;
    const ready = level >= PEN.unlockLevel;
    const penBtn = pen.unlocked
      ? '<button data-act="pen-open" class="primary">区画を編集</button>'
      : `<button data-act="pen-unlock" class="primary" ${ready && this.economy.canAfford(PEN.unlockCost) ? '' : 'disabled'}>解放 ${yen(PEN.unlockCost)}</button>`;
    const penState = pen.unlocked ? `区画 ${pen.sections.length}` : ready ? '' : `水族館レベル${PEN.unlockLevel}で解放できます（現在 Lv${level}）`;
    this.el.innerHTML = `<p class="note">地下展示室・別館・屋外生け簀は、ここから増築・解放します。</p>
      <h4>地下展示室</h4>${annex}
      <h4>別館</h4>${wings}
      <h4>屋外生け簀</h4><div class="ep-row ${pen.unlocked ? 'done' : ''}"><div><b>屋外生け簀</b><small>100m×100m の海の生け簀。自由に区切って大型の生き物を展示できる</small>${penState ? `<small class="ep-lack">${penState}</small>` : ''}</div>${penBtn}</div>`;
  }

  _act(act, id) {
    if (act === 'zone-open') {
      const z = getZone(id);
      if (z && !this.getUnlocked().has(id) && this.economy.spend(z.cost)) this.onUnlockZone(id);
    } else if (act === 'pen-unlock') {
      if (this.seaPen.canUnlock(this.economy.stage.level) && this.economy.spend(PEN.unlockCost)) {
        this.seaPen.unlock();
        this.onSeaPen();
      }
    } else if (act === 'pen-open') this.onSeaPen();
    if (!this.el.hidden) this.render();
  }
}
