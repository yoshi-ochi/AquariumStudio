import { FLOOR_TYPES, WALL_TYPES, defaultLight } from '../room/roomData.js';
import { getZone, zoneCenter } from '../building/blueprint.js';

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
    this.zone = null; // 照明を編集中の部屋（部屋の中から見ているとき）

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
    this.onChange('light-select', i);
    this.render();
  }

  /** 照明を編集する部屋（null で部屋の外） */
  setFocus(zone) {
    this.zone = zone;
    const own = this._zoneLights();
    if (!own.includes(this.lightIndex)) this.lightIndex = own[0] ?? -1;
    this.onChange('light-select', this.lightIndex);
    this.render();
  }

  /** 編集中の部屋の照明（全照明での番号） */
  _zoneLights() {
    return this.getSettings().lights.map((l, i) => (l.zone === this.zone ? i : -1)).filter((i) => i >= 0);
  }

  /** 部屋の床・天井のタップで照明を追加する */
  addLightAt(x, z) {
    if (!this.zone) return false;
    const s = this.getSettings();
    s.lights.push(defaultLight(x, z, this.zone));
    this.lightIndex = s.lights.length - 1;
    this.onChange('lights');
    this.onChange('light-select', this.lightIndex);
    this.render();
    return true;
  }

  _lookSection(kind, types, cur) {
    return `
      <div class="seg" ${types.length ? '' : 'hidden'}>${types.map((t) => `<button data-act="${kind}-type" data-v="${t.id}" class="${cur.type === t.id ? 'active' : ''}">${t.label}</button>`).join('')}</div>
      <div class="row"><span class="label">色</span><input type="color" data-field="${kind}-color" value="${cur.color}"></div>`;
  }

  /** 照らす向き：真上から見た方角（0°=手前）と、真下からの傾き */
  _aim(l) {
    const dx = l.tx - l.x;
    const dz = l.tz - l.z;
    const reach = Math.hypot(dx, dz);
    const yaw = reach < 1e-3 ? 0 : (((Math.round((Math.atan2(dx, dz) * 180) / Math.PI / 5) * 5) % 360) + 360) % 360;
    return { yaw, tilt: Math.round((Math.atan2(reach, Math.max(0.05, l.height)) * 180) / Math.PI) };
  }

  /** 向き・傾きから照射点を決める */
  _setAim(l, yaw, tilt) {
    const reach = Math.max(0.05, l.height) * Math.tan((Math.min(70, tilt) * Math.PI) / 180);
    l.tx = l.x + Math.sin((yaw * Math.PI) / 180) * reach;
    l.tz = l.z + Math.cos((yaw * Math.PI) / 180) * reach;
  }

  _lightSection(lights) {
    if (!this.zone) {
      return '<p class="note">照明を編集する部屋をタップしてください。部屋の中から壁や天井を見渡して、照明を追加・調整できます。照明はその部屋の中だけを照らします（数の上限はありません）。</p>';
    }
    const own = this._zoneLights();
    const l = own.includes(this.lightIndex) ? lights[this.lightIndex] : null;
    const chips = own.map((i, k) => `<button data-act="light-pick" data-v="${i}" class="${i === this.lightIndex ? 'active' : ''}">💡${k + 1}</button>`).join('');
    const head = `<div class="row"><b>${getZone(this.zone)?.name ?? ''} の照明</b><button data-act="room-exit">部屋から出る</button></div>`;
    const range = (name, label, min, max, step, value, unit) =>
      `<label class="slider">${label}<input type="range" data-field="light-${name}" min="${min}" max="${max}" step="${step}" value="${value}"><output>${value}${unit}</output></label>`;
    return `${head}
      <div class="seg">${chips}
        <button data-act="light-add" data-repeat>＋</button>
        <button data-act="light-remove" class="danger" ${l ? '' : 'disabled'}>削除</button></div>
      <p class="note">ドラッグで見渡し、床や天井をタップするとその場所に照明を追加できます。リング（または電球）をドラッグで移動、白い ● をドラッグで照らす場所を変えられます。</p>
      ${l ? `
      ${range('height', '高さ', 0.5, 5, 0.05, l.height, 'm')}
      ${range('yaw', '向き', 0, 355, 5, this._aim(l).yaw, '°')}
      ${range('tilt', '傾き', 0, 70, 1, this._aim(l).tilt, '°')}
      <div class="row"><button data-act="light-down">真下に向ける</button></div>
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
    else if (act === 'light-pick') {
      this.lightIndex = Number(v);
      this.onChange('light-select', this.lightIndex);
    } else if (act === 'light-down') {
      const l = s.lights[this.lightIndex];
      [l.tx, l.tz] = [l.x, l.z];
      this.onChange('light-update', this.lightIndex);
      return this.render();
    }
    else if (act === 'room-exit') return this.onChange('room-exit');
    else if (act === 'light-add' && this.zone) {
      const c = zoneCenter(getZone(this.zone));
      s.lights.push(defaultLight(c.x, c.z, this.zone));
      this.lightIndex = s.lights.length - 1;
    } else if (act === 'light-remove' && s.lights[this.lightIndex]?.zone === this.zone) {
      s.lights.splice(this.lightIndex, 1);
      this.lightIndex = this._zoneLights()[0] ?? -1;
    } else if (act === 'light-preset') {
      s.lights[this.lightIndex].color = v;
      this.onChange('light-update', this.lightIndex);
      return this.render();
    }
    this.onChange(act.startsWith('light') ? 'lights' : 'look');
    if (act.startsWith('light')) this.onChange('light-select', this.lightIndex);
    this.render();
  }

  _field(field, value, input) {
    const s = this.getSettings();
    if (field === 'floor-color') s.floor.color = value;
    else if (field === 'wall-color') s.wall.color = value;
    else if (field === 'ceiling-color') s.ceiling.color = value;
    else if (field === 'light-yaw' || field === 'light-tilt') {
      const l = s.lights[this.lightIndex];
      const cur = this._aim(l);
      this._setAim(l, field === 'light-yaw' ? value : cur.yaw, field === 'light-tilt' ? value : cur.tilt);
      input.parentElement.querySelector('output').textContent = `${value}°`;
      return this.onChange('light-update', this.lightIndex);
    } else if (field.startsWith('light-')) {
      s.lights[this.lightIndex][field.slice(6)] = value;
      const out = input.parentElement.querySelector('output');
      if (out) out.textContent = `${value}${out.textContent.replace(/^[-\d.]+/, '')}`;
      return this.onChange('light-update', this.lightIndex);
    }
    this.onChange('look');
  }

  refresh() {}
}
