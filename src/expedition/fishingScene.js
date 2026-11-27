import * as THREE from 'three';
import { GEAR, RIVER_GEAR } from './fishingGear.js';
import { getMethod } from './fishingData.js';
import { buildStage } from './fishingStage.js';
import { School } from './fishingFx.js';
import { pixelRatio } from '../core/quality.js';

// 作業ごとのカメラ（位置, 注視点）が無い漁法の既定
const SHOT = { sea: [-34, 19, 42, 0, -5, 0], river: [-22, 11, 32, 0, -1, 0] };

/** 漁法の作業を3Dで再現し、解説を表示する全画面シーン */
export class FishingScene {
  constructor(el) {
    this.el = el;
    el.innerHTML = `<canvas id="fs-canvas"></canvas>
      <div class="fs-top"><b id="fs-name"></b><small id="fs-count"></small></div>
      <div class="fs-card"><b id="fs-step"></b><p id="fs-text"></p><div class="st-bar"><i id="fs-bar"></i></div>
        <details><summary id="fs-about"></summary><p id="fs-how"></p><p id="fs-note"></p></details>
        <button id="fs-skip">スキップ</button></div>`;
    this.$ = (id) => el.querySelector(`#fs-${id}`);
    this.$('skip').addEventListener('click', () => this._finish());
  }

  /** 作業の再現を再生し、終わると解決する。lastText は最後に表示する結果、water は採取地の水域（fishingData.js の waterOf） */
  play(methodId, lastText = '', water = 'sea') {
    this.water = water;
    return this._open([getMethod(methodId, water)], lastText);
  }

  /**
   * 合同調査の採取を、調査ごとに順に再現する（surveyData.js）。
   * result は最後に表示する結果。Promise を渡すと、再現の裏で進めたサーバーの確認が終わるのを待って表示する。
   */
  playSurveys(ids, result = '') {
    return import('./surveyGear.js').then(({ SURVEY_GEAR, getSurvey }) => {
      this.surveyGear = SURVEY_GEAR;
      const list = ids.map(getSurvey).filter(Boolean);
      return list.length ? this._open(list, result) : undefined;
    });
  }

  _open(list, result) {
    if (this.renderer) this._close();
    this.el.hidden = false;
    this.queue = list;
    this.at = 0;
    this.lastText = result;
    this.ticket = null;
    this._next();
    return new Promise((resolve) => (this.resolve = resolve));
  }

  /** 並んだ再現のうち、今の番のものを始める */
  _next() {
    const method = (this.method = this.queue[this.at]);
    this.$('name').textContent = method.name;
    this.$('about').textContent = method.survey ? 'この調査について' : 'この漁法について';
    this.$('how').textContent = method.how;
    this.$('note').textContent = `資源を守る視点：${method.note}`;
    this.$('skip').textContent = 'スキップ';
    this.$('skip').disabled = false;
    this._start(method);
  }

  _start(method) {
    const canvas = this.$('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(pixelRatio());
    const scene = new THREE.Scene();
    const river = !!method.river;
    const survey = method.survey ? this.surveyGear[method.id] : null;
    const stage = buildStage(scene, survey ? { depth: method.depth } : { river, still: this.water === 'lake' });
    let school = null;
    let update;
    if (survey) {
      update = survey({ group: stage.group, scene, stage, bedY: stage.bedY, time: stage.setTime, deep: stage.setDeep, scroll: stage.scroll });
      school = update.school ?? null;
    } else {
      const boat = stage.makeBoat();
      school = new School(stage.group, river ? { count: 60, len: 0.6, color: 0xe6eed2, floor: stage.bedY } : {});
      update = (river ? RIVER_GEAR : GEAR)[method.id]({ group: stage.group, scene, boat, school, makeBoat: stage.makeBoat, bedY: stage.bedY, flow: stage.flow, time: stage.setTime, scroll: stage.scroll });
    }
    const camera = new THREE.PerspectiveCamera(46, 1, 0.5, 500);
    this.view = { scene, camera, stage, school, update, shots: update.shots ?? [], base: river ? SHOT.river : SHOT.sea, pos: new THREE.Vector3(), look: new THREE.Vector3(), cut: true };
    this.stepIndex = 0;
    this.stepTime = 0;
    this.time = 0;
    this._showStep();
    this.last = performance.now();
    this._resize();
    this.renderer.setAnimationLoop(() => this._frame());
  }

  _resize() {
    const w = this.el.clientWidth;
    const h = this.el.clientHeight;
    this.renderer.setSize(w, h, false);
    const { camera } = this.view;
    camera.aspect = w / h;
    // 下の説明カードに隠れないよう、景色を少し上へ寄せる
    camera.setViewOffset(w, h, 0, h * 0.1, w, h);
    this.view.far = Math.max(1, 1.05 / camera.aspect); // 縦長の画面では引いて全体を入れる
    this.view.stage.viewScale = this.view.far;
    camera.updateProjectionMatrix();
  }

  /** 作業ごとの見せ場へカメラをなめらかに移す */
  _aim(dt) {
    const v = this.view;
    const s = v.shots[this.stepIndex] ?? v.base;
    const look = new THREE.Vector3(s[3], s[4], s[5]);
    const pos = new THREE.Vector3(s[0], s[1], s[2]).sub(look).multiplyScalar(v.far).add(look);
    const k = v.cut ? 1 : 1 - Math.exp(-dt * 1.6);
    v.cut = false;
    v.pos.lerp(pos, k);
    v.look.lerp(look, k);
    v.camera.position.copy(v.pos);
    v.camera.lookAt(v.look);
  }

  _showStep() {
    const s = this.method.steps[this.stepIndex];
    const many = this.queue.length > 1 ? `調査 ${this.at + 1}/${this.queue.length} ・ ` : '';
    this.$('count').textContent = `${many}作業 ${this.stepIndex + 1} / ${this.method.steps.length}`;
    this.$('step').textContent = s.title;
    this.$('text').textContent = s.text;
  }

  _frame() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.stepTime += dt;
    const steps = this.method.steps;
    const s = steps[this.stepIndex];
    const p = Math.min(1, this.stepTime / s.sec);
    const v = this.view;
    v.update(this.stepIndex, p, this.time);
    v.school?.update(dt, this.time);
    v.stage.tick(dt, this.time);
    this._aim(dt);
    this.$('bar').style.width = `${((this.stepIndex + p) / steps.length) * 100}%`;
    this.renderer.render(v.scene, v.camera);
    if (p < 1) return;
    if (this.stepIndex < steps.length - 1) {
      this.stepIndex++;
      this.stepTime = 0;
      this._showStep();
    } else this._complete();
  }

  /** 全作業が終わったら、次の調査へ進む。最後なら結果を見せて、閉じるボタンにする */
  _complete() {
    if (this.at < this.queue.length - 1) {
      this._close();
      this.at++;
      return this._next();
    }
    this.renderer?.setAnimationLoop(null);
    const result = this.lastText;
    if (!result) return this._finish();
    this.lastText = '';
    const skip = this.$('skip');
    this.$('step').textContent = '結果';
    skip.textContent = '閉じる';
    if (typeof result === 'string') return void (this.$('text').textContent = result);
    // サーバーの確認がまだなら、終わるまで待つ
    const ticket = (this.ticket = {});
    this.$('text').textContent = '成果を確認しています…';
    skip.disabled = true;
    result.then((text) => {
      if (this.ticket !== ticket) return;
      this.$('text').textContent = text;
      skip.disabled = false;
    });
  }

  _finish() {
    if (this.lastText) {
      this.at = this.queue.length - 1; // スキップ：残りの調査を飛ばして結果へ
      return this._complete();
    }
    this.ticket = null;
    this._close();
    this.el.hidden = true;
    this.resolve?.();
    this.resolve = null;
  }

  /** 描画を止めて後片付けする */
  _close() {
    if (!this.renderer) return;
    this.renderer.setAnimationLoop(null);
    this.view.scene.background?.dispose?.();
    this.view.scene.traverse((o) => {
      if (!o.geometry?.userData.shared) o.geometry?.dispose(); // 生き物の形は館内と共有しているので残す
      o.material?.map?.dispose();
      o.material?.dispose();
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer = null;
    // 使い終えた canvas は作り直す（失われた描画コンテキストを再利用しない）
    const old = this.$('canvas');
    const fresh = old.cloneNode();
    old.replaceWith(fresh);
  }
}
