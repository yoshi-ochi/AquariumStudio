import { DESTINATIONS } from '../expedition/creatureData.js';
import { WorldMap } from '../map/worldMap.js';

/**
 * 地図ページ：採取地・自分の立地・同盟の仲間とフレンドの水族館を表示する。
 * ピンをタップすると onDest / onPlace を呼ぶ。
 */
export class MapPage {
  constructor({ el, getHome, getLevel, getMoveCost, isTripDone, loadPlaces, onDest, onPlace, onHomeSet, onTrips, toast }) {
    Object.assign(this, { el, getHome, getLevel, getMoveCost, isTripDone, loadPlaces, onDest, onPlace, onHomeSet, onTrips, toast });
    this.picking = false;
    this.places = [];
    el.innerHTML = `<canvas id="map-canvas" aria-label="地図"></canvas>
      <div id="map-tools">
        <button data-map="japan">日本</button><button data-map="world">世界</button>
        <button data-map="home">立地を設定</button><button data-map="trips">調査隊</button>
      </div>
      <p id="map-note" hidden>水族館を建てる場所をタップしてください（0.1度単位で公開されます）</p>
      <p id="map-legend"><i style="background:#ffd36b"></i>自分<i style="background:#ff9f2e"></i>採取地<i style="background:#35c98b"></i>同盟<i style="background:#58b7ff"></i>フレンド</p>`;
    this.map = new WorldMap({
      canvas: el.querySelector('#map-canvas'),
      onPin: (pin) => this._pin(pin),
      onPoint: (p) => this._point(p),
    });
    el.querySelector('#map-tools').addEventListener('click', (e) => {
      const id = e.target.closest('button[data-map]')?.dataset.map;
      if (id === 'japan') this.map.showJapan();
      else if (id === 'world') this.map.showWorld();
      else if (id === 'home') this._setPicking(!this.picking);
      else if (id === 'trips') this.onTrips();
    });
  }

  get isOpen() {
    return !this.el.hidden;
  }

  /** 採取地のピンの画面上の位置（操作の案内で指し示す）。地図を閉じていれば null */
  pinRect(destId) {
    if (!this.isOpen) return null;
    const d = DESTINATIONS.find((x) => x.id === destId);
    if (!d || !this.map.view) return null;
    const c = this.map.canvas.getBoundingClientRect();
    const p = this.map._screen(d.lat, d.lon);
    const x = c.left + p.x;
    const y = c.top + p.y;
    return new DOMRect(x - 16, y - 16, 32, 32);
  }

  async open() {
    this.el.hidden = false;
    document.body.classList.add('map-open');
    this.refresh();
    this.map.resize();
    try {
      await this.map.ensureLand();
    } catch (err) {
      console.error(err);
      this.toast('地図を読み込めませんでした', { error: true });
    }
    try {
      this.places = await this.loadPlaces();
    } catch (err) {
      console.error(err); // 同盟の設定前でも採取地は使える
      this.places = [];
    }
    this.refresh();
  }

  close() {
    this.el.hidden = true;
    document.body.classList.remove('map-open');
    this._setPicking(false);
  }

  toggle() {
    return this.isOpen ? this.close() : this.open();
  }

  /** ピンを最新の状態にする */
  refresh() {
    if (!this.isOpen) return;
    const level = this.getLevel();
    const pins = DESTINATIONS.map((d) => ({
      kind: this.isTripDone(d.id) ? 'done' : d.stage > level ? 'locked' : 'dest',
      id: d.id, lat: d.lat, lon: d.lon, label: d.name,
    }));
    for (const p of this.places) if (p.lat != null) pins.push({ kind: p.kind, id: p.id, lat: p.lat, lon: p.lon, label: p.name });
    const home = this.getHome();
    if (home) pins.push({ kind: 'me', id: 'me', lat: home.lat, lon: home.lon, label: '自分の水族館' });
    this.el.querySelector('[data-map=home]').textContent = home ? '立地を移転' : '立地を設定';
    this.map.setPins(pins);
  }

  _setPicking(on) {
    this.picking = on;
    const note = this.el.querySelector('#map-note');
    note.hidden = !on;
    const moving = !!this.getHome();
    note.textContent = moving
      ? `移転先をタップしてください。移転費用 ${this.getMoveCost().toLocaleString('ja-JP')}コイン（航海中の調査隊の残り時間も新しい距離に変わります）`
      : '水族館を建てる場所をタップしてください（0.1度単位で公開されます。最初の設定は無料）';
    this.el.querySelector('[data-map=home]').classList.toggle('active', on);
  }

  _point(p) {
    if (!this.picking) return false;
    this._setPicking(false);
    this.onHomeSet({ lat: Math.round(p.lat * 10) / 10, lon: Math.round(p.lon * 10) / 10 });
    return true;
  }

  _pin(pin) {
    if (pin.kind === 'me') return;
    if (pin.kind === 'ally' || pin.kind === 'friend') this.onPlace(pin);
    else this.onDest(pin.id);
  }
}
