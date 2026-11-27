import { CATEGORY } from '../tanks/tankData.js';
import { floorLabel } from '../building/blueprint.js';
import { coin as yen, coinText } from './currency.js';
import { fmtLeft, stageSeconds } from '../management/buildTimes.js';

/** 階の並びの中で隣の階 */
const stepFloor = (order, floor, d) => order[order.indexOf(floor) + d];

const $ = (id) => document.getElementById(id);

/**
 * 画面の外枠：上部ボタン（メニュー・戻る・編集・完了）、メニュー、編集シートの表示切替。
 * モード: 'home' | 'tank' | 'hall-edit' | 'interior-edit'
 */
export class AppShell {
  constructor({ economy, manager, getFloorOrder, onBack, onEdit, onShare, onDone, onFloorChange, onUpgrade, getStageJob = () => null }) {
    this.getStageJob = getStageJob;
    this.economy = economy;
    this.manager = manager;
    this.mode = 'home';

    $('btn-back').addEventListener('click', onBack);
    $('btn-edit').addEventListener('click', onEdit);
    $('btn-share').addEventListener('click', () => onShare?.());
    $('btn-done').addEventListener('click', onDone);
    this.getFloorOrder = getFloorOrder;
    const step = (d) => {
      const f = stepFloor(getFloorOrder(), economy.floor, d);
      if (f !== undefined) onFloorChange(f);
    };
    $('floor-up').addEventListener('click', () => step(1));
    $('floor-down').addEventListener('click', () => step(-1));
    $('btn-upgrade').addEventListener('click', onUpgrade);
    // メニュー外をタップしたら閉じる
    document.addEventListener('pointerdown', (e) => {
      if (!$('menu-sheet').hidden && !e.target.closest('#menu-sheet, #hud-account')) this.toggleMenu(false);
    });

    economy.addEventListener('change', () => this.update());
    this.update();
  }

  setMode(mode, title = '') {
    this.mode = mode;
    document.body.dataset.mode = mode;
    const editing = mode === 'hall-edit' || mode === 'interior-edit';
    $('btn-back').hidden = mode !== 'tank';
    $('btn-share').hidden = mode !== 'tank'; // 水槽に注目している間：共有
    $('btn-edit').hidden = editing;
    $('btn-edit').title = mode === 'tank' ? '水槽を編集（生物・飼育・見た目・水槽内レイアウト）' : '館内レイアウトを編集';
    $('btn-done').hidden = !editing;
    $('editor').hidden = !editing;
    $('mode-title').textContent = title;
    document.body.classList.toggle('editing', editing);
    this.toggleMenu(false);
    this.update();
  }

  toggleMenu(force) {
    const sheet = $('menu-sheet');
    sheet.hidden = force === undefined ? !sheet.hidden : !force;
  }

  update() {
    const e = this.economy;
    const st = e.stage;
    $('menu-stats').textContent =
      `コイン ${coinText(e.money)} ・ 来館者 ${e.visitors.toLocaleString('ja-JP')}人 ・ 水槽 ${this.manager.countByCategory(CATEGORY.TANK)}基`;
    $('floor-label').textContent = floorLabel(e.floor);
    const order = this.getFloorOrder();
    $('floor-down').disabled = stepFloor(order, e.floor, -1) === undefined;
    $('floor-up').disabled = stepFloor(order, e.floor, 1) === undefined;
    $('menu-stage').textContent = `Lv${st.level} ${st.name}`;
    const next = e.nextStage;
    const up = $('btn-upgrade');
    const job = this.getStageJob();
    if (job) {
      up.textContent = `昇格工事中 残り${fmtLeft((job.until - Date.now()) / 1000)} ⚡加速`;
      up.disabled = false;
      return;
    }
    up.textContent = next ? `拡張 ${coinText(next.upgradeCost)} ・ ${fmtLeft(stageSeconds(next.level))}` : '最大規模';
    up.disabled = !next || !e.canAfford(next.upgradeCost);
  }

  setHint(text) {
    $('hint').textContent = text ?? '';
  }
}
