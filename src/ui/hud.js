import { currentEnvironment } from '../management/environment.js';
import { icon } from './icons.js';
import { moneyK } from './currency.js';

const num = (n) => Math.floor(n).toLocaleString('ja-JP');

/** 画面上部のステータスバー：アカウント・天候・時刻・来館者・コイン・ダイヤ */
export class Hud {
  constructor({ el, economy, online, wallet, onAccount, onStore }) {
    Object.assign(this, { el, economy, online, wallet });
    el.innerHTML = `
      <button id="hud-account" aria-label="アカウント"><span id="hud-avatar"></span><i id="hud-save" role="status"></i>
        <span class="hud-who"><b id="hud-name"></b><small id="hud-stage"></small></span></button>
      <div class="hud-weather"><span id="hud-wicon"></span><b id="hud-temp"></b><small id="hud-wlabel"></small></div>
      <div class="hud-clock" id="hud-clock"></div>
      <div class="hud-stat" aria-label="来館者数">${icon('people', 17)}<b id="hud-visitors"></b><small>人</small></div>
      <div class="hud-stat money" aria-label="コイン">${icon('coin', 17)}<b id="hud-money"></b></div>
      <button class="hud-stat gem" id="hud-gem" aria-label="ダイヤ（ショップを開く）">${icon('gem', 17)}<b id="hud-dia"></b><i class="hud-plus" aria-hidden="true">+</i></button>`;
    el.querySelector('#hud-account').addEventListener('click', onAccount);
    el.querySelector('#hud-gem').addEventListener('click', () => onStore?.());
    wallet?.addEventListener('change', () => this.update());
    this.$ = (id) => el.querySelector(`#hud-${id}`);
    economy.addEventListener('change', () => this.update());
    this.update();
    setInterval(() => this.update(), 1000);
  }

  /** 自動保存の状態を、アイコン右下の点で示す */
  setSaveState(state) {
    const label = { saved: '保存済み', dirty: '保存待ち', saving: '保存中', error: '保存に失敗（再試行します）', conflict: '別の端末と競合' }[state];
    const dot = this.$('save');
    dot.dataset.state = state;
    dot.title = label;
    dot.setAttribute('aria-label', label);
  }

  update() {
    const e = this.economy;
    const now = new Date();
    const name = this.online.profile?.name ?? 'ゲスト';
    const env = currentEnvironment(now);
    this.$('avatar').textContent = [...name][0];
    this.$('name').textContent = name;
    this.$('stage').textContent = `Lv${e.stage.level} ${e.stage.name}`;
    if (this._w !== env.weather.id) this.$('wicon').innerHTML = icon((this._w = env.weather.id), 20);
    this.$('temp').textContent = `${env.temp}℃`;
    this.$('wlabel').textContent = env.weather.label;
    this.$('clock').textContent = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    this.$('visitors').textContent = num(e.visitors);
    this.$('money').textContent = moneyK(e.money);
    this.$('money').parentElement.title = `${num(e.money)}コイン`;
    this.$('dia').textContent = num(this.wallet?.total ?? 0);
  }
}
