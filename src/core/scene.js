import * as THREE from 'three';
import { QUALITY, isMobile, pixelRatio } from './quality.js';

const SKY = 0xbfe6ff;

/** レンダラー・シーン・カメラ・屋外の光（太陽と空）を管理する。部屋は room/room.js */
export class SceneManager {
  constructor(container) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true }); // stencil：水槽内の岩の切り口（tanks/clipCapPass.js）
    this.renderer.setPixelRatio(pixelRatio()); // スマホは 1.5 まで（core/quality.js）
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = isMobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    // 影は毎コマではなく一定の間隔で計算し直す（render()。照明ごとに場面を描き直すので重い）
    this.renderer.shadowMap.autoUpdate = false;
    this._shadowAt = -Infinity;
    this.shadowsLive = false; // true の間（物を動かしている間）は毎コマ影を計算する
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);
    // iPhone では裏に回している間に描画（WebGL）が切られることがある。戻ったときに真っ暗のままにならないよう、
    // 切られたら復帰を待ち、戻ったら（または戻らなければ表に出たときに）読み込み直す。セーブは自動保存と端末内の控えで残る
    const canvas = this.renderer.domElement;
    let lost = false;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      lost = true;
    });
    canvas.addEventListener('webglcontextrestored', () => location.reload());
    document.addEventListener('visibilitychange', () => {
      if (lost && document.visibilityState === 'visible') setTimeout(() => lost && location.reload(), 1500);
    });

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 500);

    this.scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x6b8f4e, 1.1));
    const sun = new THREE.DirectionalLight(0xfff6e5, 1.5);
    // 天井が無いため、太陽の影は室内に落とさない（影は室内ライトのみ）
    sun.castShadow = false;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun, sun.target);
    this.sun = sun;

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
  }

  /** 影のカメラ範囲を建物に合わせる */
  fitShadow(cx, cz, ext) {
    const cam = this.sun.shadow.camera;
    cam.left = -ext;
    cam.right = ext;
    cam.top = ext;
    cam.bottom = -ext;
    cam.near = 0.5;
    cam.far = ext * 8;
    cam.updateProjectionMatrix();
    this.sun.position.set(cx + ext * 0.6, ext * 2.5, cz + ext * 0.9);
    this.sun.target.position.set(cx, 0, cz);
    this.scene.fog = new THREE.Fog(SKY, ext * 5, ext * 14);
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** 次のコマで影を計算し直す（物を置いた・照明を変えたときなど） */
  refreshShadows() {
    this._shadowAt = -Infinity;
  }

  render() {
    const now = performance.now() / 1000;
    if (this.shadowsLive || now - this._shadowAt >= QUALITY.shadowInterval) {
      this.renderer.shadowMap.needsUpdate = true;
      this._shadowAt = now;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
