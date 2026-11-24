import { FLOOR_TYPES, WALL_TYPES, MAX_LIGHTS, defaultLight } from '../room/roomData.js';

/** 壁を自由に編集できるレベル */
export const WALL_EDIT_LEVEL = 4;

/**
 * 部屋の編集パネル（床・壁・照明）。
 * 設定オブジェクト settings を直接書き換え、onChange(kind) で反映を依頼する。
 * kind: 'look' | 'lights'
 */
export class RoomPanel {
  constructor({ el, getSettings, getPlan, getLevel, onChange }) {
    Object.assign(this, { el, getSettings, getPlan, getLevel, onChange });
    this.brush = 'add';
    this.section = 'floor';
    this.lightIndex = 0;

    el.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act]');
      if (btn) this._act(btn.dataset.act, btn.dataset.v);
    });
    el.addEventListener('input', (e) => {
      const input = e.target.closest('[data-field]');
      if (input) this._field(input.dataset.field, input.type === 'color' ? input.value : Number(input.value), input);
    });
  }

  render() {
    const s = this.getSettings();
    const tab = (id, label) => `<button data-act="section" data-v="${id}" class="${this.section === id ? 'active' : ''}">${label}</button>`;
    let body = '';
    if (this.section === 'floor') body = this._lookSection('floor', FLOOR_TYPES, s.floor);
    else if (this.section === 'wall') body = this._lookSection('wall', WALL_TYPES, s.wall);
    else if (this.section === 'ceiling') body = `${this._lookSection('ceiling', [], s.ceiling)}<p class="note">天井と照明器具は、天井より低い位置から部屋を見たときに表示されます。</p>`;
    else if (this.section === 'walls') body = this._wallSection();
    else body = this._lightSection(s.lights);
    this.el.innerHTML = `<div class="seg">${tab('floor', '床')}${tab('wall', '壁')}${tab('ceiling', '天井')}${tab('light', '照明')}${tab('walls', '間取り')}</div>${body}`;
  }

  setVisible(visible) {
    this.el.hidden = !visible;
    if (visible) this.render();
    this.onChange('light-mode', visible && this.section === 'light');
    this.onChange('wall-mode', visible && this._wallsOn);
  }

  get _wallsOn() {
    return this.section === 'walls' && this.getLevel() >= WALL_EDIT_LEVEL;
  }

  _wallSection() {
    if (this.getLevel() < WALL_EDIT_LEVEL) return `<p class="note">水族館をレベル${WALL_EDIT_LEVEL}に拡張すると、壁を自由に増やしたり撤去したりできます。</p>`;
    const b = (id, label) => `<button data-act="brush" data-v="${id}" class="${this.brush === id ? 'active' : ''}">${label}</button>`;
    return `<div class="seg">${b('add', '壁を追加')}${b('remove', '壁を撤去')}</div>
      <p class="note">マス目の角を2か所タップすると、その間の壁を変更します。壁の移動は、撤去してから追加します。</p>`;
  }

  /** 電球のドラッグなどで照明が選ばれたとき */
  selectLight(i) {
    if (this.lightIndex === i) return;
    this.lightIndex = i;
    this.render();
  }

  _lookSection(kind, types, cur) {
    return `
      <div class="seg" ${types.length ? '' : 'hidden'}>${types.map((t) => `<button data-act="${kind}-type" data-v="${t.id}" class="${cur.type === t.id ? 'active' : ''}">${t.label}</button>`).join('')}</div>
      <div class="row"><span class="label">色</span><input type="color" data-field="${kind}-color" value="${cur.color}"></div>`;
  }

  _lightSection(lights) {
    this.lightIndex = Math.min(this.lightIndex, lights.length - 1);
    const l = lights[this.lightIndex];
    const chips = lights
      .map((_, i) => `<button data-act="light-pick" data-v="${i}" class="${i === this.lightIndex ? 'active' : ''}">💡${i + 1}</button>`)
      .join('');
    const range = (name, label, min, max, step, value, unit) =>
      `<label class="slider">${label}<input type="range" data-field="light-${name}" min="${min}" max="${max}" step="${step}" value="${value}"><output>${value}${unit}</output></label>`;
    return `
      <div class="seg">${chips}
        <button data-act="light-add" data-repeat ${lights.length >= MAX_LIGHTS ? 'disabled' : ''}>＋</button>
        <button data-act="light-remove" class="danger" ${lights.length <= 1 ? 'disabled' : ''}>削除</button></div>
      ${l ? `
      <p class="note">💡 電球をドラッグで移動、床の ◎ をドラッグで照らす向きを変えられます。</p>
      ${range('height', '高さ', 0.5, 5, 0.05, l.height, 'm')}
      ${range('intensity', '光量', 0, 4, 0.05, l.intensity, '')}
      ${range('angle', '照射角', 20, 150, 5, l.angle, '°')}
      <div class="row"><span class="label">色調</span><input type="color" data-field="light-color" value="${l.color}">
        <button data-act="light-preset" data-v="#ffd9a8">電球色</button>
        <button data-act="light-preset" data-v="#fff6e8">温白色</button>
        <button data-act="light-preset" data-v="#e8f2ff">昼光色</button></div>` : ''}`;
  }

  _act(act, v) {
    const s = this.getSettings();
    if (act === 'section') {
      this.section = v;
      this.render();
      this.onChange('light-mode', v === 'light');
      this.onChange('wall-mode', this._wallsOn);
      return;
    }
    if (act === 'brush') {
      this.brush = v;
      return this.render();
    }
    if (act === 'floor-type') s.floor.type = v;
    else if (act === 'wall-type') s.wall.type = v;
    else if (act === 'light-pick') this.lightIndex = Number(v);
    else if (act === 'light-add' && s.lights.length < MAX_LIGHTS) {
      const b = this.getPlan().bounds();
      s.lights.push(defaultLight(b.cx, b.cz));
      this.lightIndex = s.lights.length - 1;
    } else if (act === 'light-remove' && s.lights.length > 1) {
      s.lights.splice(this.lightIndex, 1);
      this.lightIndex = 0;
    } else if (act === 'light-preset') {
      s.lights[this.lightIndex].color = v;
      this.onChange('light-update', this.lightIndex);
      return this.render();
    }
    this.onChange(act.startsWith('light') ? 'lights' : 'look');
    this.render();
  }

  _field(field, value, input) {
    const s = this.getSettings();
    if (field === 'floor-color') s.floor.color = value;
    else if (field === 'wall-color') s.wall.color = value;
    else if (field === 'ceiling-color') s.ceiling.color = value;
    else if (field.startsWith('light-')) {
      s.lights[this.lightIndex][field.slice(6)] = value;
      const out = input.parentElement.querySelector('output');
      if (out) out.textContent = `${value}${out.textContent.replace(/^[-\d.]+/, '')}`;
      return this.onChange('light-update', this.lightIndex);
    }
    this.onChange('look');
  }

  refresh() {}
}
