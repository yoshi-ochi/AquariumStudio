import './style.css';
import * as THREE from 'three';
import { SceneManager } from './core/scene.js';
import { CameraController } from './core/controls.js';
import { generatePreviews } from './core/previewRenderer.js';
import { loadThumbManifest, splitThumbs } from './core/thumbCache.js';
import { Economy } from './management/economy.js';
import { Inventory } from './management/inventory.js';
import { HALL_DEFS, INTERIOR_DEFS, ALL_DEFS, CATEGORY, getDef } from './tanks/tankData.js';
import { buildObject, disposeObject } from './tanks/tankBuilder.js';
import { TankManager } from './tanks/tankManager.js';
import { TankCustomizer } from './tanks/tankCustom.js';
import { HallInteraction } from './interaction/hallInteraction.js';
import { InteriorInteraction } from './interaction/interiorInteraction.js';
import { ViewInteraction } from './interaction/viewInteraction.js';
import { LightInteraction } from './interaction/lightInteraction.js';
import { InteriorCamera } from './interior/interiorCamera.js';
import { Room } from './room/room.js';
import { CELL } from './room/floorPlan.js';
import { defaultRoomSettings, defaultLight, normalizeLight } from './room/roomData.js';
import { findRunByKey, placeEmbedded, holeFor } from './room/embed.js';
import { normalizeLook } from './tanks/tankLook.js';
import { Splash } from './ui/splash.js';
import { Catalog } from './ui/catalog.js';
import { AppShell } from './ui/shell.js';
import { RoomPanel } from './ui/roomPanel.js';
import { toast } from './ui/toast.js';
import { WAVE_PARAMS, bakeWaves, waveCacheKey } from './water/waveBaker.js';
import { loadCached, saveCached } from './water/waveCache.js';
import { setWaveData, updateWater } from './water/waterSurface.js';
import { LAYOUT_VERSION } from './io/layoutIO.js';
import { writeJournal, markJournalSynced, pendingJournal } from './online/localJournal.js';
import { Online } from './online/online.js';
import { AutoSave } from './online/autoSave.js';
import { FriendPanel } from './ui/friendPanel.js';
import { runLoginGate } from './ui/loginGate.js';
import { Hud } from './ui/hud.js';
import { BottomNav } from './ui/bottomNav.js';
import { GameSheet } from './ui/gameSheet.js';
import { ExpeditionView, CreatureView } from './ui/expeditionViews.js';
import { Expeditions } from './expedition/expeditions.js';
import { Operations } from './management/operations.js';
import { CleanView, StaffView, ShopView } from './ui/opsViews.js';
import { finishCleaning, needsCleaning } from './tanks/tankCleaning.js';
import { icon } from './ui/icons.js';
import { AllianceApi } from './online/allianceApi.js';
import { AllianceView } from './ui/allianceView.js';
import { MapPage } from './ui/mapPage.js';
import { LifeSystems } from './game/lifeSystems.js';
import { START_ZONES, ATRIUM_TANK_POS, BASEMENT, isWing, floorOrder, DEFAULT_LAYOUT, LAYOUT, WALL_EDITS, zonesUpToLevel, getZone, setLayout, setWallEdits, setZoneNames, zoneAt, zoneCenter } from './building/blueprint.js';
import { ViewModes } from './building/viewModes.js';
import { OutdoorScenery } from './building/outdoorScenery.js';
import { WallInteraction } from './interaction/wallInteraction.js';
import { pickLayout } from './ui/layoutPicker.js';
import { ZoneLabels } from './building/zoneLabels.js';
import { DolphinPool } from './building/dolphinPool.js';
import { ZoneView } from './building/buildingViews.js';
import { migrateToLayout, relocateInvalid, zonesForLegacyStage } from './building/migrate.js';
import { FishingScene } from './expedition/fishingScene.js';
import { zoneOf } from './expedition/husbandry.js';
import { isHungry } from './expedition/husbandry.js';
import { allianceBonus, allianceLevel } from './expedition/creatureData.js';
import { CREATURES, DEFAULT_HOME, relocateCost } from './expedition/creatureData.js';
import { setGrowthSource } from './expedition/growth.js';
import { buildCreature } from './expedition/creatureBuilder.js';
import { loadCreatureConfig } from './expedition/creatureConfig.js';
import { installHoldRepeat } from './ui/holdRepeat.js';
import { TankView } from './ui/tankView.js';
import { BuildView } from './ui/buildView.js';
import { MailView } from './ui/mailView.js';
import { Tutorial } from './ui/tutorial.js';
import { RankingView } from './ui/rankingView.js';
import { BuildInPlace } from './interaction/buildInPlace.js';
import { setCustomHandler, registerCustomIds } from './tanks/customTanks.js';
import { tankLabel } from './tanks/tankLabel.js';

const $ = (id) => document.getElementById(id);
const MIN_SPLASH_MS = 1800;
const POOL_APPEAL = 150;
const OUTDOOR_APPEAL = { plaza: 20, marine: 60, nature: 90 };
const THEME_BONUS = 1.25;
const HINT = {
  home: '水槽をタップすると名前・展示生物・エサ・掃除を管理できます ・ ドラッグで回転 / 2本指でズーム',
  hall: 'タップで選択・ドラッグで移動 ・ 何もない所のドラッグで視点を回転',
  place: '床をタップして設置 ・ もう一度カードを押すとキャンセル',
  interior: 'ドラッグで移動（岩の上にも積める）・ はみ出した部分はガラス面でカット',
  sculpt: '岩肌をなぞって{mode} ・ 2本指で視点操作',
  grow: 'パネルの説明どおりに本体をドラッグ ・ 2本指で視点操作',
};

// 古いブラウザ向け：角丸の描画を四角で代用する
CanvasRenderingContext2D.prototype.roundRect ??= function roundRect(x, y, w, h) {
  this.rect(x, y, w, h);
};

async function boot() {
  const startedAt = performance.now();
  installHoldRepeat(); // 出資・＋−などのボタンは長押しで連続タップ
  const splash = new Splash({ root: $('splash'), canvas: $('splash-canvas'), bar: $('splash-bar'), label: $('splash-label') });

  // ---- コア -----------------------------------------------------------------
  const sceneMgr = new SceneManager($('viewport'));
  const cameraCtl = new CameraController(sceneMgr.camera, sceneMgr.renderer.domElement);
  const economy = new Economy();
  const inventory = new Inventory();
  const expeditions = new Expeditions();
  setGrowthSource((id) => expeditions.pieces(id)); // 展示の大きさ・集客は在庫側の成長（ピース）で決める
  const ops = new Operations();
  let home = null; // 自分の立地 { lat, lon }
  const manager = new TankManager(sceneMgr.scene);
  const room = new Room(sceneMgr.scene, sceneMgr);
  let roomSettings = defaultRoomSettings();

  // ---- 事前準備（スプラッシュの裏で）：サムネイル撮影と水面モーション ----------
  // 配信サムネイル（GitHub Pages）を使い、無い物・形が変わった物だけ端末で撮影する
  // 管理者が編集した生物の設定（レア度・採取地・成長など）を先に反映する
  splash.setProgress(0, '生き物のデータを読み込み中…');
  await loadCreatureConfig();
  const manifest = await loadThumbManifest();
  const objThumbs = splitThumbs('d', ALL_DEFS, manifest);
  const fishThumbs = splitThumbs('c', CREATURES, manifest);
  const previews = objThumbs.urls;
  for (const [id, url] of fishThumbs.urls) previews.set(`creature:${id}`, url);
  const shoot = objThumbs.missing.length + fishThumbs.missing.length;
  const progress = (off) => (i, n, def) => splash.setProgress((off + i) / shoot, `${def.name} を撮影中… (${off + i}/${shoot})`);
  for (const [id, url] of await generatePreviews(objThumbs.missing, buildObject, { dispose: disposeObject, onProgress: progress(0) })) previews.set(id, url);
  const creatureShots = await generatePreviews(fishThumbs.missing, buildCreature, { dispose: disposeObject, transparent: true, onProgress: progress(objThumbs.missing.length) });
  for (const [id, url] of creatureShots) previews.set(`creature:${id}`, url);
  const waveKey = waveCacheKey();
  let waves = await loadCached(waveKey);
  if (!waves) {
    waves = await bakeWaves(WAVE_PARAMS, (r) => splash.setProgress(r, `水面の動きを計算中… ${Math.round(r * 100)}%`));
    await saveCached(waveKey, waves);
  }
  setWaveData(waves);

  // ---- 部屋 -----------------------------------------------------------------
  let wallsDirty = false;
  let unlocked = new Set(START_ZONES); // 解放済みのエリア
  const zoneLabels = new ZoneLabels(sceneMgr.scene);
  const pool = new DolphinPool(sceneMgr.scene);
  const scenery = new OutdoorScenery(sceneMgr.scene);
  manager.themeBonus = (tank) => {
    const theme = zoneAt(tank.userData.floor, tank.position.x, tank.position.z)?.theme;
    const ids = Object.keys(tank.userData.creatures ?? {});
    return theme && ids.length && ids.every((id) => zoneOf(id) === theme) ? THEME_BONUS : 1;
  };
  /** 大水槽ホールを解放したら、最初の1回だけ吹き抜けの大水槽を据え付ける（撤去・移動は自由） */
  function ensureAtriumTank() {
    if (!unlocked.has('atrium') || roomSettings.atriumGiven) return;
    roomSettings.atriumGiven = true;
    if ([...manager.objects.values()].some((o) => manager.defOf(o).atrium) || inventory.count('atriumTank') > 0) return;
    manager.add('atriumTank', { ...ATRIUM_TANK_POS, floor: 0 });
    manager.setFloor(economy.floor);
  }
  /** 埋め込み水槽を壁に合わせ直し、穴あきの壁を作り直す */
  function refreshRoom() {
    const runs = room.plan.runs();
    const holes = [];
    for (const tank of manager.embeddedObjects()) {
      const def = manager.defOf(tank);
      const e = tank.userData.embed;
      const run = findRunByKey(runs, e.key, e.along);
      if (run && placeEmbedded(tank, def, run, e)) {
        holes.push(holeFor(def, e));
      } else if (def.wallMount) {
        manager.remove(tank);
        economy.earn(def.price);
        toast(`${def.name} の取り付け先の壁がなくなったため、撤去しました（全額返金）`);
      } else {
        delete tank.userData.embed;
        const b = room.plan.bounds(CELL.FLOOR);
        tank.position.set(b.cx, 0, b.cz);
        toast(`${def.name} の埋め込み先の壁がなくなったため、床に戻しました`);
      }
    }
    manager.refreshElevations();
    room.rebuild(holes);
    wallsDirty = false;
  }
  let afterApplyRoom = () => {}; // 館内編集の十字線など（操作の準備ができてから差し替える）
  function applyRoom(reframe) {
    room.setStage(economy.stage, economy.floor, unlocked);
    pool.setLayout();
    zoneLabels.update(economy.floor, unlocked);
    const under = economy.floor === BASEMENT;
    const away = under || isWing(economy.floor); // 別棟では本館の屋外（プール・景観）を出さない
    room.setUnderground(under);
    pool.setUnlocked(unlocked.has('pool') && !away);
    scenery.group.visible = !away;
    scenery.sync(LAYOUT.id, unlocked);
    manager.extraAppeal = (unlocked.has('pool') ? POOL_APPEAL : 0) + Object.entries(OUTDOOR_APPEAL).reduce((s, [id, n]) => s + (unlocked.has(id) ? n : 0), 0);
    ensureAtriumTank();
    room.applyLook(roomSettings);
    room.setLights(roomSettings.lights);
    refreshRoom();
    afterApplyRoom();
    if (reframe) cameraCtl.frameBounds(room.plan.bounds(CELL.FLOOR));
  }
  applyRoom(true);
  const views = new ViewModes({
    sceneMgr, cameraCtl, room, manager, pool, scenery, labels: zoneLabels, railEl: $('view-rail'),
    getFloor: () => economy.floor,
    getUnlocked: () => unlocked,
    onFloor: (floor) => changeFloor(floor),
    onModeChange: (m) => {
      view.enabled = m === 'floor' && mode === 'home';
      document.body.dataset.view = m;
    },
  });
  document.body.dataset.view = 'floor';

  // ---- 選択パネル・カタログ ---------------------------------------------------
  const customizer = new TankCustomizer({
    scene: sceneMgr.scene,
    camera: sceneMgr.camera,
    panelEl: $('detail-panel'),
    gizmoEl: $('gizmo'),
    getDef,
    getBrush: () => interior.brush,
    getGrowMode: () => interior.growMode,
    onAction: (action, obj, value) => {
      if (action.startsWith('brush-')) return interior.setBrush('mode', action === 'brush-off' ? null : action.slice(6));
      if (action.startsWith('grow-')) return interior.setGrowMode(action === 'grow-off' ? null : action.slice(5));
      if (action === 'param-brush-radius') return interior.setBrush('radius', value);
      if (action === 'param-brush-strength') return interior.setBrush('strength', value);
      if (action === 'param-embed-ratio') return hall.setEmbedParam(obj, 'ratio', value);
      if (action === 'param-embed-bottom') return hall.setEmbedParam(obj, 'bottom', value);
      if (action === 'embed') return hall.embed(obj);
      if (action === 'param-bubbles') return (obj.userData.bubbles = value);
      if (action.startsWith('look-') || action === 'param-tanklight-intensity' || action === 'param-side-alpha') return changeTankLook(obj, action, value);
      if (action === 'unembed') return hall.unembed(obj);
      if (action === 'lock') {
        obj.userData.locked = !obj.userData.locked;
        customizer.syncLock();
        customizer.renderPanel();
        return;
      }
      if (obj.userData.locked && (action.startsWith('rotate') || action === 'delete')) return;
      const target = obj.userData.interiorItem ? interior : hall;
      if (action === 'rotate-left') target.rotate(obj, 1);
      else if (action === 'rotate-right') target.rotate(obj, -1);
      else if (action === 'delete') target.remove(obj);
      else if (action === 'interior') enterInteriorEdit(obj, 'hall');
    },
  });

  /** 水槽の見た目パネルの操作 */
  function changeTankLook(tank, action, value) {
    const look = normalizeLook(tank.userData.look);
    const side = customizer.lookSide;
    let rerender = true;
    if (action.startsWith('look-side-')) customizer.lookSide = action.slice(10);
    else if (action.startsWith('look-swatch-')) {
      // 透明（0%）のまま色を選んだら、見えるように不透明にする
      manager.setTankLook(tank, { [side]: { color: action.slice(12), alpha: look[side].alpha > 0 ? look[side].alpha : 1 } });
    } else if (action === 'param-side-alpha') {
      manager.setTankLook(tank, { [side]: { ...look[side], alpha: value } });
      rerender = false;
    } else if (action === 'look-frame-on') manager.setTankLook(tank, { frame: true });
    else if (action === 'look-frame-off') manager.setTankLook(tank, { frame: false });
    else if (action.startsWith('look-framecolor-')) manager.setTankLook(tank, { frameColor: action.slice(16) });
    else if (action === 'look-light') manager.setTankLook(tank, { light: { on: !look.light.on } });
    else if (action.startsWith('look-lightpreset-')) manager.setTankLook(tank, { light: { color: action.slice(17) } });
    else if (action === 'look-color-lightColor') {
      manager.setTankLook(tank, { light: { color: value } });
      rerender = false;
    } else if (action === 'param-tanklight-intensity') {
      manager.setTankLook(tank, { light: { intensity: value } });
      rerender = false;
    }
    if (rerender) customizer.renderPanel();
  }

  const roomPanel = new RoomPanel({
    el: $('room-panel'),
    getSettings: () => roomSettings,
    getPlan: () => room.plan,
    getLevel: () => economy.stage.level,
    onChange: (kind, value) => {
      if (kind === 'look') room.applyLook(roomSettings);
      else if (kind === 'lights') room.setLights(roomSettings.lights);
      else if (kind === 'light-update') room.updateLight(value, roomSettings.lights[value]);
      else if (kind === 'light-mode') lightCtl.enabled = value;
      else if (kind === 'wall-mode') {
        wallCtl.setEnabled(value);
        room.setWallEditing(value);
        hall.setEnabled(!value && mode === 'hall-edit');
        if (value) customizer.deselect();
      }
    },
  });

  const catalog = new Catalog({
    tabsEl: $('catalog-tabs'),
    cardsEl: $('catalog-cards'),
    previews,
    economy,
    onSelect: (id) => {
      const active = mode === 'interior-edit' ? interior : hall;
      if (active.placing?.def.id === id) return active.cancelPlacement();
      // 水槽は在庫から設置する。無ければ取引先を開く
      if (mode === 'hall-edit' && getDef(id).category === CATEGORY.TANK && inventory.count(id) <= 0) {
        toast('在庫がありません。取引先から購入できます');
        return gameSheet.openItems('supplier');
      }
      active.startPlacement(id);
    },
    priceLabel: (def) => (def.category === CATEGORY.TANK ? `所持 ${inventory.count(def.id)}` : null),
    onTab: (id, extra) => {
      if (mode !== 'hall-edit') return;
      hall.cancelPlacement();
      roomPanel.setVisible(extra && id === 'room');
      inPlace.setActive(extra && id === 'build');
      if (!extra) shell.setHint(HINT.hall);
    },
  });

  // ---- 操作 -----------------------------------------------------------------
  // ライトのハンドルは他の操作より先にイベントを取るため、最初に作る
  const lightCtl = new LightInteraction({
    sceneMgr, cameraCtl, room,
    getSettings: () => roomSettings,
    onSelect: (i) => roomPanel.selectLight(i),
  });
  const wallCtl = new WallInteraction({
    sceneMgr, room, manager, toast,
    getBrush: () => roomPanel.brush,
    onChanged: () => {
      applyRoom(false);
      room.setWallEditing(true);
    },
  });
  const view = new ViewInteraction({ sceneMgr, manager, onTankTap: (tank) => openTank(tank) });
  const hall = new HallInteraction({
    sceneMgr, cameraCtl, manager, economy, inventory, customizer, room, toast,
    getUnlocked: () => unlocked,
    onPlacementChange: (id) => {
      catalog.setActive(id);
      shell.setHint(id ? HINT.place : HINT.hall);
    },
    onChanged: () => shell.update(),
    onWallsChanged: () => (wallsDirty = true),
    onTankRemoved: (tank) => {
      for (const [id, n] of Object.entries(tank.userData.creatures ?? {})) expeditions.give(id, n);
    },
  });
  afterApplyRoom = () => hall.refreshCenters();
  const inPlace = new BuildInPlace({
    sceneMgr, cameraCtl, manager, economy, hall, toast,
    panelEl: $('build-panel'),
    onPlaced: (obj) => {
      shell.update();
      customizer.select(obj);
    },
  });
  hall.isBusy = () => inPlace.active;
  const interiorCam = new InteriorCamera(cameraCtl);
  const interior = new InteriorInteraction({
    sceneMgr, cameraCtl, manager, economy, customizer, toast,
    onPlacementChange: (id) => {
      catalog.setActive(id);
      shell.setHint(id ? HINT.place : HINT.interior);
    },
    onChanged: () => shell.update(),
    onExitRequest: () => onDone(),
    onBrushChange: (m) => shell.setHint(m ? HINT.sculpt.replace('{mode}', m === 'inflate' ? '盛る' : '削る') : HINT.interior),
    onGrowChange: (m) => shell.setHint(m ? HINT.grow : HINT.interior),
  });

  // ---- モード ---------------------------------------------------------------
  //   home（館内の閲覧）→ 水槽タップ → tank（水槽の閲覧）→ ✎ → interior-edit
  //   home → ✎ → hall-edit（館内レイアウト編集）→ 水槽の「水槽内」→ interior-edit
  let mode = 'home';
  let focusTank = null;
  let interiorFrom = null;

  function goHome() {
    mode = 'home';
    hall.setEnabled(false);
    room.setEditVisible(false);
    roomPanel.setVisible(false);
    inPlace.setActive(false);
    customizer.deselect();
    view.enabled = views.mode === 'floor';
    shell.setMode('home');
    shell.setHint(HINT.home);
  }

  function openTank(tank) {
    if (interiorCam.busy) return;
    focusTank = tank;
    mode = 'tank';
    view.enabled = false;
    interiorCam.enter(tank);
    shell.setMode('tank', tankLabel(manager, tank));
    shell.setHint('');
    openTankSheet(tank);
  }

  /** 水槽の管理シート（名前・展示生物・エサ・掃除） */
  function openTankSheet(tank) {
    if (visiting) return;
    friendPanel.close();
    tankView.open(tank);
    gameSheet.openPanel('tank');
  }

  function enterHallEdit() {
    views.setMode('floor');
    mode = 'hall-edit';
    view.enabled = false;
    customizer.allowEmbed = true;
    hall.setEnabled(true);
    room.setEditVisible(true);
    catalog.setDefs(HALL_DEFS, [{ id: 'build', label: '水槽建造' }, { id: 'room', label: '部屋' }]);
    shell.setMode('hall-edit', '館内レイアウト編集');
    shell.setHint(HINT.hall);
  }

  function enterInteriorEdit(tank, from) {
    if (interiorCam.busy) return;
    interiorFrom = from;
    focusTank = tank;
    hall.setEnabled(false);
    roomPanel.setVisible(false);
    inPlace.setActive(false);
    customizer.deselect();
    customizer.allowEmbed = false;
    gameSheet.close();
    if (from === 'hall') interiorCam.enter(tank);
    interior.attach(tank);
    mode = 'interior-edit';
    if (!visiting) life.state.flags.interior = true;
    catalog.setDefs(INTERIOR_DEFS);
    shell.setMode('interior-edit', `${tankLabel(manager, tank)} の水槽内`);
    shell.setHint(HINT.interior);
  }

  function onDone() {
    if (interiorCam.busy) return;
    if (mode === 'hall-edit') return goHome();
    if (mode === 'interior-edit') {
      interior.detach();
      if (interiorFrom === 'tank') {
        mode = 'tank';
        shell.setMode('tank', tankLabel(manager, focusTank));
        shell.setHint('');
        openTankSheet(focusTank);
      } else {
        interiorCam.exit();
        enterHallEdit();
      }
    }
  }

  function changeFloor(floor) {
    if (!economy.setFloor(floor)) return;
    hall.cancelPlacement();
    customizer.deselect();
    manager.setFloor(economy.floor);
    applyRoom(false);
  }

  const shell = new AppShell({
    economy,
    manager,
    getFloorOrder: () => floorOrder(unlocked),
    onBack: () => {
      if (mode !== 'tank' || interiorCam.busy) return;
      if (gameSheet.view === 'tank') gameSheet.close();
      interiorCam.exit();
      goHome();
    },
    onEdit: () => {
      if (visiting) return;
      if (mode === 'home') enterHallEdit();
      else if (mode === 'tank') enterInteriorEdit(focusTank, 'tank');
    },
    onDone,
    onFloorChange: (floor) => views.goFloor(floor),
    onUpgrade: () => {
      const res = economy.upgradeStage();
      if (!res.ok) return toast(res.reason, { error: true });
      // レベルに応じたエリアを解放して建物へ反映する
      const opened = zonesUpToLevel(economy.stage.level).filter((id) => !unlocked.has(id));
      opened.forEach((id) => unlocked.add(id));
      applyRoom(false);
      if (opened.length) toast(`${opened.map((id) => getZone(id).name).join('、')} を解放しました`, { duration: 5000 });
      if (gameSheet.view) gameSheet.render();
      toast(`「${economy.stage.name}」に拡張しました！`);
    },
  });

  /** 現在の状態を保存用データにする */
  function snapshot() {
    return { version: LAYOUT_VERSION, savedAt: new Date().toISOString(), economy: economy.toJSON(), life: life.toJSON(), inventory: inventory.toJSON(), expedition: expeditions.toJSON(), ops: ops.toJSON(), ...(home && { home }), room: { ...roomSettings, building: 3, layout: LAYOUT.id, unlocked: [...unlocked], walls: WALL_EDITS }, objects: manager.serialize() };
  }

  let pendingLayout = null; // 初期設定で選んだ間取り
  function resetLights() {
    const c = zoneCenter(getZone('entrance'));
    roomSettings.lights = [defaultLight(c.x, c.z)];
  }

  /** 新しいアカウント：選んだ間取りのエントランスに最初の水槽を置く */
  function startNewAquarium(layoutId) {
    setLayout(layoutId);
    setWallEdits(null);
    roomSettings.zoneNames = setZoneNames({});
    roomSettings.zoneLook = {};
    roomSettings.atriumGiven = false;
    unlocked = new Set(START_ZONES);
    manager.clear();
    resetLights();
    economy.setFloor(0);
    manager.setFloor(0);
    applyRoom(false);
    const b = room.plan.bounds(CELL.FLOOR);
    manager.add('stand60', { x: b.cx, z: b.z0 + 0.3 });
    manager.add('tank60', { x: b.cx, z: b.z0 + 0.3 });
    applyRoom(true);
  }

  /** 保存用データから状態を復元する */
  function applySnapshot(data) {
    if (mode !== 'home') goHome();
    views.setMode('floor');
    setLayout(data.room?.layout ?? pendingLayout ?? DEFAULT_LAYOUT);
    setWallEdits(data.room?.layout ? data.room.walls : null);
    // 建造した水槽の定義を先に登録する（ID に寸法が入っている）
    registerCustomIds([...(data.objects ?? []).map((o) => o.defId), ...Object.keys(data.inventory?.stock ?? {}), ...(data.inventory?.orders ?? []).map((o) => o.defId)]);
    economy.fromJSON(data.economy);
    inventory.fromJSON(data.inventory);
    expeditions.fromJSON(data.expedition);
    ops.fromJSON(data.ops);
    if (!visiting) home = data.home ?? null;
    roomSettings = { ...defaultRoomSettings(), ...(data.room ?? {}) };
    roomSettings.lights = roomSettings.lights.map(normalizeLight);
    roomSettings.zoneNames = setZoneNames(roomSettings.zoneNames);
    roomSettings.zoneLook = { ...roomSettings.zoneLook };
    manager.deserialize(data.objects);
    unlocked = new Set([...START_ZONES, ...(data.room?.building ? data.room.unlocked ?? [] : zonesForLegacyStage(economy.stage.level))]);
    // 以前にレベルアップ済みのセーブにも、レベルに応じたエリアを反映する
    zonesUpToLevel(economy.stage.level).forEach((id) => unlocked.add(id));
    if (!data.room?.layout) {
      // 間取りを選ぶ前のセーブを、選んだ間取りへ移す
      migrateToLayout({ manager, unlocked, wasBuilding: !!data.room?.building, inventory, expeditions, economy });
      resetLights();
      economy.setFloor(0);
    } else if ((data.room.building ?? 0) < 3) {
      // 管理通路の追加で置けなくなった物を移す
      relocateInvalid({ manager, unlocked, inventory, expeditions, economy });
    }
    delete roomSettings.plan;
    manager.setFloor(economy.floor);
    life.fromJSON(data.life, { own: !visiting, oldShops: data.life ? 0 : data.ops?.shops ?? 0 });
    // 別棟の階が未建設なら本館へ戻す
    if (isWing(economy.floor) && !floorOrder(unlocked).includes(economy.floor)) {
      economy.setFloor(0);
      manager.setFloor(0);
    }
    applyRoom(true);
    views.syncRail();
    shell.update();
  }

  // ---- オンライン：クラウド保存・フレンド・訪問 -------------------------------
  const online = new Online();
  let visiting = null; // { mine: 自分のスナップショット }
  /** 訪問先のセーブを5分間だけ覚えておく（続けて訪問しても読み直さない＝転送量を減らす） */
  const VISIT_CACHE_MS = 5 * 60 * 1000;
  const visitCache = new Map();
  async function loadVisit(id) {
    const hit = visitCache.get(id);
    if (hit && Date.now() - hit.at < VISIT_CACHE_MS) return structuredClone(hit.data);
    const data = await online.load(id);
    if (data) visitCache.set(id, { at: Date.now(), data: structuredClone(data) });
    return data;
  }
  /** フレンド・同盟の仲間の水族館を訪問する */
  async function visitAquarium(id, name) {
    const data = await loadVisit(id);
    if (!data) return toast(`${name} さんはまだ水族館を保存していません`, { error: true });
    if (!visiting) visiting = { mine: snapshot() };
    gameSheet.close();
    mapPage.close();
    applySnapshot(data);
    document.body.classList.add('visiting');
    $('visit-label').textContent = `${name} さんの水族館`;
    $('visit-bar').hidden = false;
    toast(`${name} さんの水族館を訪問中`);
  }

  const autoSave = new AutoSave({
    save: (data, force) => online.save(data, force),
    getSnapshot: () => snapshot(),
    isPaused: () => !!visiting || !online.user,
    onState: (s) => hud.setSaveState(s),
    onConflict: () => ($('save-conflict').hidden = false),
    // 端末内の控え（急に閉じてもクラウドへ届かなかった変更を次回に送り直す）
    keep: (s) => online.user && writeJournal(online.user.id, s, online.rev),
    onSaved: () => online.user && markJournalSynced(online.user.id, online.rev),
  });
  $('btn-conflict-load').addEventListener('click', async () => {
    try {
      const data = await online.load();
      if (data) applySnapshot(data);
      autoSave.markLoaded();
      $('save-conflict').hidden = true;
      toast('最新のデータを読み込みました');
    } catch (err) {
      toast(err.message, { error: true });
    }
  });
  $('btn-conflict-keep').addEventListener('click', async () => {
    $('save-conflict').hidden = true;
    if (await autoSave.overwrite()) toast('この端末の内容で保存しました');
    else toast('保存できませんでした', { error: true });
  });
  const friendPanel = new FriendPanel({
    el: $('friend-sheet'),
    online,
    toast,
    onSave: async () => {
      if (visiting) return toast('訪問中は保存できません', { error: true });
      await autoSave.saveNow();
      toast('クラウドに保存しました');
    },
    onLoad: async () => {
      if (visiting) return toast('訪問中は読み込めません', { error: true });
      const data = await online.load();
      if (!data) return toast('クラウドにまだ保存がありません');
      applySnapshot(data);
      autoSave.markLoaded();
      toast('クラウドから読み込みました');
    },
    onVisit: (id, name) => visitAquarium(id, name),
    beforeSignOut: () => autoSave.flush(),
    onSignOut: () => location.reload(), // スプラッシュのログインへ戻る
  });
  $('btn-online').addEventListener('click', () => {
    shell.toggleMenu(false);
    friendPanel.open();
  });

  // ---- 上部バー・下部メニュー・アイテム ---------------------------------------
  // プレイヤーアイコン：これまでの「その他」のメニュー（拡張・館内エリア・フレンド・保存など）を開く
  const hud = new Hud({ el: $('hud'), economy, online, onAccount: () => !visiting && shell.toggleMenu() });
  /** エリアを解放して建物を作り直す */
  function unlockZone(id) {
    unlocked.add(id);
    applyRoom(false);
    views.syncRail();
    shell.update();
    const z = getZone(id);
    toast(z.wing ? `${z.name} を建設しました` : `${z.name} を解放しました`);
    // 別棟は建てたらその階へ移動して見せる
    if (z.wing) {
      gameSheet.close();
      views.goFloor(z.floor);
      cameraCtl.frameBounds(room.plan.bounds(CELL.FLOOR));
    }
  }
  const life = new LifeSystems({
    isUnlocked: (id) => unlocked.has(id),
    sceneMgr, room, manager, economy, ops, inventory, expeditions, previews, toast,
    getHome: () => home, goalEl: $('goal-card'), reportEl: $('offline-report'),
  });
  // 総合レベルのランキング（イベント画面のタブ）。点数は5分ごとに送る
  const rankingView = new RankingView({ manager, expeditions, online, previews, isVisiting: () => !!visiting, onLoaded: () => gameSheet.view === 'event' && gameSheet.render() });
  life.panels.event.view.ranking = rankingView;
  setInterval(() => document.visibilityState === 'visible' && rankingView.submit().catch((err) => console.warn(err.message)), 300000);
  const tutorial = new Tutorial({ getState: () => life.state, getStats: () => life.stats(), economy, toast });
  $('btn-tutorial').addEventListener('click', () => {
    shell.toggleMenu(false);
    tutorial.restart();
  });
  // 来館者（人の表示）の表示・非表示。端末ごとに覚える。非表示の間は人の動きの計算も止まる
  let showVisitors = true;
  try { showVisitors = localStorage.getItem('aq.visitors') !== 'off'; } catch { /* 保存できない環境 */ }
  const visitorsBtn = $('btn-visitors');
  const syncVisitorsBtn = () => {
    visitorsBtn.textContent = showVisitors ? '来館者：表示中' : '来館者：非表示';
    visitorsBtn.classList.toggle('primary', showVisitors);
    visitorsBtn.setAttribute('aria-pressed', String(showVisitors));
  };
  syncVisitorsBtn();
  visitorsBtn.addEventListener('click', () => {
    showVisitors = !showVisitors;
    try { localStorage.setItem('aq.visitors', showVisitors ? 'on' : 'off'); } catch { /* 保存できない環境 */ }
    syncVisitorsBtn();
  });
  const allianceApi = new AllianceApi(online);
  const allianceView = new AllianceView({
    mailbox: life.mail,
    api: allianceApi, online, economy, expeditions, toast,
    onVisit: (id, name) => visitAquarium(id, name),
    onChanged: () => mapPage.refresh(),
  });
  const expeditionView = new ExpeditionView({ economy, expeditions, toast, previews, getHome: () => home, getDiscount: () => life.backyard.level('field') * 0.1, getCapacity: () => life.backyard.capacity, fishing: new FishingScene($('fishing-scene')) });
  // 地図で選んだ仲間の水族館
  const placeView = {
    pin: null,
    html() {
      const name = String(this.pin?.label ?? '').replace(/[&<>"']/g, '');
      return `<div class="st-sum"><b>${name} さんの水族館</b><small>${this.pin?.kind === 'ally' ? '同盟の仲間' : 'フレンド'}</small><button data-act="place-visit" class="primary">訪問する</button></div>`;
    },
    act(act) {
      if (act !== 'place-visit') return false;
      visitAquarium(this.pin.id, this.pin.label).catch((err) => toast(err.message, { error: true }));
      return true;
    },
  };
  const mapPage = new MapPage({
    el: $('map-page'), toast,
    getHome: () => home,
    getLevel: () => economy.stage.level,
    isTripDone: (dest) => expeditions.trips.some((t) => t.dest === dest && expeditions.isDone(t)),
    loadPlaces: async () => {
      if (!online.user) return [];
      await allianceApi.refresh();
      const allies = (allianceApi.state?.members ?? []).filter((m) => m.id !== online.user.id).map((m) => ({ ...m, kind: 'ally' }));
      const { friends } = await online.friends();
      const others = friends.filter((f) => !allies.some((a) => a.id === f.id));
      const places = await allianceApi.places(others.map((f) => f.id));
      return [...allies, ...places.map((p) => ({ ...p, kind: 'friend' }))];
    },
    onDest: (id) => {
      expeditionView.focus = id;
      gameSheet.openPanel('expedition');
    },
    onPlace: (pin) => {
      placeView.pin = pin;
      gameSheet.openPanel('place');
    },
    onTrips: () => {
      expeditionView.focus = null;
      gameSheet.openPanel('expedition');
    },
    getMoveCost: () => relocateCost(economy.stage.level),
    onHomeSet: async (p) => {
      if (visiting) return toast('訪問中は立地を変えられません', { error: true });
      const old = home;
      if (old) {
        // 移転は高額。確認してから支払う
        const cost = relocateCost(economy.stage.level);
        if (!economy.canAfford(cost)) return toast(`移転には ¥${cost.toLocaleString('ja-JP')} が必要です`, { error: true });
        if (!confirm(`水族館の立地を移転しますか？\n費用 ¥${cost.toLocaleString('ja-JP')}\n航海中の調査隊の残り時間も、新しい距離に合わせて変わります。`)) return;
        economy.spend(cost);
      }
      home = p;
      expeditions.rescaleTrips(old ?? DEFAULT_HOME, p);
      mapPage.refresh();
      if (gameSheet.view === 'expedition') gameSheet.render();
      toast(old ? '立地を移転しました。採取地までの時間と費用が変わります' : '立地を設定しました');
      if (online.user) await allianceApi.setLocation(p).catch((err) => console.error(err));
    },
  });
  const cleanView = new CleanView({ manager, economy, ops, toast, getTanks: () => manager.tanks, onChanged: () => shell.update() });
  const tankView = new TankView({
    manager, expeditions, economy, previews, toast, cleanView,
    careView: life.panels.care.view,
    onInterior: (tank) => enterInteriorEdit(tank, 'tank'),
    onGrow: (id) => {
      life.panels.zukan.view.focus(id); // 図鑑の育成カードを開く
      gameSheet.openPanel('zukan');
      requestAnimationFrame(() => document.querySelector('.cg-pop')?.scrollIntoView({ block: 'center' }));
    },
    onChanged: () => {
      shell.update();
      if (mode === 'tank' && focusTank) shell.setMode('tank', tankLabel(manager, focusTank));
    },
  });
  const mailView = new MailView({ mailbox: life.mail, manager, expeditions, economy, ops, cleanView, careView: life.panels.care.view, allianceView, previews, toast });
  expeditions.addEventListener('claimed', (e) => {
    life.mail.count('trips');
    life.mail.count('caught', e.detail.length);
  });
  const syncMailBadge = () => {
    const n = life.mail.unread;
    $('mail-badge').hidden = !n;
    $('mail-badge').textContent = n > 99 ? '99+' : n;
    $('side-mail').classList.toggle('has-mail', life.mail.pending > 0);
  };
  life.mail.addEventListener('change', () => {
    syncMailBadge();
    if (gameSheet.view === 'mail') gameSheet.render();
  });
  const gameSheet = new GameSheet({
    el: $('game-sheet'), economy, inventory, expeditions, ops, previews, toast,
    panels: {
      expedition: { title: '採取遠征', view: expeditionView },
      ally: { title: '同盟水族館', view: allianceView },
      place: { title: '水族館', view: placeView },
      clean: { title: '水槽の掃除', live: true, view: cleanView },
      tank: { get title() { return tankView.title; }, view: tankView },
      build: { title: '水槽建造', view: new BuildView({ economy, inventory, toast }) },
      staff: { title: 'スタッフ', live: true, view: new StaffView({ ops }) },
      shop: { title: '店舗運営', live: true, view: new ShopView({ ops, economy, inventory, onPlace: (id) => { gameSheet.close(); mapPage.close(); if (mode !== 'hall-edit') enterHallEdit(); hall.startPlacement(id); } }) },
      ...life.panels,
      mail: { title: 'メール', live: true, view: mailView },
      zones: {
        title: '館内エリア',
        view: new ZoneView({
          economy, getUnlocked: () => unlocked, onUnlock: unlockZone,
          getLook: (id) => ({ floor: roomSettings.floor.color, wall: roomSettings.wall.color, ...roomSettings.zoneLook?.[id] }),
          onLook: (id, kind, color) => {
            const all = { ...roomSettings.zoneLook };
            if (kind) all[id] = { ...all[id], [kind]: color };
            else delete all[id];
            roomSettings.zoneLook = all;
            room.applyLook(roomSettings);
            if (!kind) gameSheet.render();
          },
          onRename: (id, name) => {
            roomSettings.zoneNames = setZoneNames({ ...roomSettings.zoneNames, [id]: name });
            zoneLabels.update(economy.floor, unlocked);
            gameSheet.render();
            toast(`エリア名を「${getZone(id).name}」にしました`);
          },
        }),
      },
    },
    creatureView: new CreatureView({ manager, expeditions, previews, toast, economy, onChanged: () => shell.update(), hasCafe: () => [...manager.objects.values()].some((o) => o.userData.defId === 'cafe') }),
    onPlace: (id) => {
      if (mode !== 'hall-edit') enterHallEdit();
      hall.startPlacement(id);
    },
  });
  const bottomNav = new BottomNav({
    el: $('bottom-nav'),
    onSelect: (id) => {
      if (mode !== 'home' || visiting) return;
      const wasOpen = gameSheet.view;
      const itemsOpen = gameSheet.isItems;
      gameSheet.close();
      friendPanel.close();
      if (id === 'map') return mapPage.toggle();
      shell.toggleMenu(false);
      if (id === 'event') {
        mapPage.close();
        return wasOpen === 'event' ? undefined : gameSheet.openPanel('event');
      }
      if (id === 'layout') {
        mapPage.close();
        return enterHallEdit();
      }
      if (id === 'ally') {
        if (wasOpen === 'ally') return;
        gameSheet.openPanel('ally');
        return allianceView.load(() => gameSheet.view === 'ally' && gameSheet.render());
      }
      if (id === 'items') return itemsOpen ? undefined : gameSheet.openItems();
      if (id === 'shop') return wasOpen === id ? undefined : gameSheet.openPanel(id);
      if (wasOpen !== `feature:${id}`) gameSheet.openFeature(id);
    },
  });
  // 地図を開いている間は、地図のボタンを「水族館」（戻る）にする
  new MutationObserver(() => {
    const open = !mapPage.el.hidden;
    bottomNav.setButton('map', open ? 'layout' : 'map', open ? '水族館' : '地図');
  }).observe(mapPage.el, { attributes: true, attributeFilter: ['hidden'] });
  // 開き直したときは前回の受け取り結果を消す（下の開閉処理より先に動かす）
  // 開き直したときは未読のあるタブを開き、前回の受け取り結果を消す（下の開閉処理より先に動かす）
  $('side-mail').addEventListener('click', () => mailView.reset(), true);
  for (const [btn, id, ic] of [['side-mail', 'mail', 'mail'], ['side-clean', 'clean', 'clean'], ['side-care', 'care', 'care'], ['side-zukan', 'zukan', 'zukan'], ['side-staff', 'staff', 'staff']]) {
    $(btn).querySelector('.sa-ico').innerHTML = icon(ic, 24);
    $(btn).addEventListener('click', () => {
      if (visiting) return;
      const open = gameSheet.view === id;
      gameSheet.close();
      if (!open) gameSheet.openPanel(id);
    });
  }
  for (const [btn, id] of [['btn-zones', 'zones'], ['btn-backyard', 'backyard']]) {
    $(btn).addEventListener('click', () => {
      shell.toggleMenu(false);
      gameSheet.openPanel(id);
    });
  }
  $('btn-event').addEventListener('click', () => {
    shell.toggleMenu(false);
    gameSheet.openPanel('event');
  });
  inventory.addEventListener('change', () => catalog.refresh());
  // 外注の完成チェック（閉じている間に完成した分も受け取る）
  setInterval(() => {
    if (visiting) return;
    for (const id of inventory.collect()) toast(`外注の ${getDef(id).name} が完成しました`);
    $('nav-map').classList.toggle('has-badge', expeditions.trips.some((t) => expeditions.isDone(t)));
    mapPage.refresh();
    for (const t of finishCleaning(manager.tanks)) {
      toast(`${tankLabel(manager, t)} の掃除が終わりました`);
      life.mail.count('cleans');
    }
    mailView.scan();
    life.mail.tickDay({ incomePerSec: economy.incomePerSec, visitors: economy.visitors, satisfaction: ops.satisfaction });
    const dirty = manager.tanks.filter((t) => needsCleaning(t)).length;
    $('clean-badge').hidden = !dirty;
    $('clean-badge').textContent = dirty;
    $('side-sat').textContent = `満足度${Math.round(ops.satisfaction)}%`;
    manager.updateCare();
    life.tick();
    const hungry = manager.tanks.filter((t) => isHungry(t)).length;
    $('care-badge').hidden = !hungry;
    $('care-badge').textContent = hungry;
    // 在庫で次のレベルに上げられる魚種がある（図鑑で育てられる）
    const shownBy = {};
    for (const t of manager.tanks) for (const [id, n] of Object.entries(t.userData.creatures ?? {})) shownBy[id] = (shownBy[id] ?? 0) + n;
    const growable = CREATURES.filter((c) => expeditions.canLevelUp(c.id, shownBy[c.id] ?? 0)).length;
    $('zukan-badge').hidden = !growable;
    $('zukan-badge').textContent = growable;
  }, 1000);
  $('btn-visit-end').addEventListener('click', () => {
    if (!visiting) return;
    const mine = visiting.mine;
    visiting = null;
    applySnapshot(mine);
    document.body.classList.remove('visiting');
    $('visit-bar').hidden = true;
    toast('自分の水族館に戻りました');
  });

  // 建造した水槽のサムネイルを撮る
  setCustomHandler(async (def) => {
    const shot = await generatePreviews([def], buildObject, { dispose: disposeObject });
    previews.set(def.id, shot.get(def.id));
    catalog.refresh();
    if (gameSheet.view) gameSheet.render();
  });

  // 初期レイアウト（無料）：エントランスに水槽台＋60cm水槽
  startNewAquarium(DEFAULT_LAYOUT);
  goHome();

  // 開発時だけ：ブラウザのコンソールから状態を調べられるようにする
  if (import.meta.env.DEV) window.__app = { sceneMgr, manager, room, economy, inventory, expeditions, ops, get life() { return life; }, snapshot, applySnapshot, get views() { return views; }, startNewAquarium, openTank: (t) => openTank(t), get cameraCtl() { return cameraCtl; } };

  // ---- ループ ---------------------------------------------------------------
  /**
   * 編集シート（＋詳細パネル）に隠れない領域の中央に視点の中心が来るよう、
   * カメラの投影をずらす（OrbitControls の注視点は変えない）。
   */
  let viewShift = 0;
  const editorEl = $('editor');
  const panelEl = $('detail-panel');
  function updateViewShift() {
    const h = window.innerHeight;
    let top = h;
    if (!editorEl.hidden) top = editorEl.getBoundingClientRect().top;
    if (!editorEl.hidden && !panelEl.hidden) top = Math.min(top, panelEl.getBoundingClientRect().top);
    const target = Math.max(0, (h - top) / 2 - 20);
    viewShift += (target - viewShift) * 0.2;
    const cam = sceneMgr.camera;
    if (viewShift < 0.5) {
      if (cam.view?.enabled) cam.clearViewOffset();
    } else {
      cam.setViewOffset(window.innerWidth, h, 0, viewShift, window.innerWidth, h);
    }
  }

  /** 同盟に入っている間の来館者ボーナス */
  function allyBonus() {
    const a = allianceApi.state?.alliance;
    return a ? allianceBonus(allianceLevel(a.xp)) : 1;
  }

  /** 必要人員の計算に使う水族館の規模 */
  function opsContext() {
    const tanks = manager.tanks;
    return {
      potential: manager.totalAppeal() * economy.stage.visitorFactor,
      tanks: tanks.length,
      creatures: tanks.reduce((s, t) => s + Object.values(t.userData.creatures ?? {}).reduce((a, n) => a + n, 0), 0),
      level: economy.stage.level,
      showTanks: tanks.filter((t) => t.userData.defId === 'mammal').length * 2 + tanks.filter((t) => t.userData.defId === 'tunnel').length + (unlocked.has('pool') ? 4 : 0),
      labs: life.backyard.labCount,
      dirtyRatio: tanks.length ? tanks.filter((t) => needsCleaning(t)).length / tanks.length : 0,
    };
  }

  const clock = new THREE.Clock();
  let splashDone = false; // スプラッシュを閉じてから（セーブ反映後に）チュートリアルを判定する
  let manual = false; // 開発用：録画中は時計を止め、frame() を外から1コマずつ呼ぶ
  sceneMgr.renderer.setAnimationLoop(() => {
    // 間取りを選んでいる間は裏の館内を描画しない
    if (!$('layout-picker').hidden || manual) return;
    frame(Math.min(clock.getDelta(), 0.1), clock.elapsedTime);
  });
  /** 1コマ分の更新と描画（dt: 前のコマからの秒、time: 経過秒） */
  function frame(dt, time) {
    clock.elapsedTime = time;
    updateViewShift();
    if (wallsDirty) refreshRoom();
    interiorCam.update(dt);
    updateWater(clock.elapsedTime);
    cameraCtl.update();
    manager.updateClips();
    manager.updateAeration(clock.elapsedTime);
    manager.updateLife(clock.elapsedTime);
    pool.update(clock.elapsedTime);
    scenery.update(clock.elapsedTime);
    interior.update();
    economy.update(dt, manager.totalAppeal() * (visiting ? 1 : ops.visitorMult * allyBonus() * life.visitorMult));
    views.update(dt);
    room.updateCut(sceneMgr.camera.position.distanceTo(cameraCtl.controls.target), dt);
    room.updateOcclusion(sceneMgr.camera.position, cameraCtl.controls.target, dt);
    life.crowd.setVisible(showVisitors && views.mode === 'floor' && mode !== 'interior-edit' && mode !== 'tank' && !mapPage.isOpen);
    if (!visiting && splashDone) {
      tutorial.check();
      tutorial.update(!mapPage.isOpen && (!gameSheet.view || gameSheet.view === 'tank') && mode !== 'interior-edit' && mode !== 'hall-edit');
    } else tutorial.update(false);
    life.crowd.update(dt, economy.visitors, visiting ? 80 : ops.satisfaction);
    if (!visiting) ops.update(dt, opsContext, economy);
    customizer.update();
    sceneMgr.render();
  }
  if (import.meta.env.DEV) Object.assign(window.__app ?? {}, { frame, setManual: (v) => (manual = v), setMode: (m) => shell.setMode(m), goHome: () => goHome() });

  const wait = MIN_SPLASH_MS - (performance.now() - startedAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  splash.setProgress(1, '読み込み中…');
  // 確認用：URL に ?splash を付けるとスプラッシュを閉じない
  if (new URLSearchParams(location.search).has('splash')) return;

  let lastSavedAt = null;
  let layoutChosen = false;
  let restored = false; // 端末内の控えから戻した
  // ログイン必須：完了してそのアカウントのセーブを反映するまでスプラッシュを閉じない
  if (online.enabled) {
    await runLoginGate({
      online,
      host: $('login-host'),
      setLabel: (t) => splash.setProgress(1, t),
      onReady: async () => {
        const data = await online.load();
        // 間取りが未設定なら最初に選んでもらう
        // 読み込みの再試行では選び直しを求めない
        if (!data?.room?.layout && !pendingLayout) {
          pendingLayout = await pickLayout($('layout-picker'));
          layoutChosen = true;
        }
        // クラウドに届いていない端末内の控えがあれば、そちらを使う（急に閉じたときの最後の変更）
        const kept = pendingJournal(online.user.id, data, online.rev);
        if (kept) restored = true;
        const use = kept ?? data;
        if (use) applySnapshot(use);
        else startNewAquarium(pendingLayout ?? DEFAULT_LAYOUT);
        lastSavedAt = use?.savedAt ?? null;
      },
    });
    autoSave.start();
    if (layoutChosen || restored) autoSave.saveNow().catch((err) => console.warn(err.message));
    if (lastSavedAt) {
      life.settleOffline(lastSavedAt, ops.visitorMult);
      autoSave.flush(); // 受け取った収入をすぐ保存（二重受け取りを防ぐ）
    }
    // 同盟ボーナスの反映と、完了した合同調査のメール（5分ごとに確認）
    const checkAlliance = () => allianceApi.refresh().then(() => allianceView.notifyRuns()).catch((err) => console.warn(err.message));
    checkAlliance();
    // 同盟に入っていない人は確認しない（加入したら同盟画面を開いた時点で state が入る）
    setInterval(() => allianceApi.state && !visiting && document.visibilityState === 'visible' && checkAlliance(), 300000);
    if (online.recovery) friendPanel.open(); // 再設定メールから来たら新しいパスワードの入力へ
    // 別タブでログアウトしたらこのタブも閉じる
    online.sb.auth.onAuthStateChange((event) => event === 'SIGNED_OUT' && location.reload());
  } else if (import.meta.env.DEV && new URLSearchParams(location.search).has('layout')) {
    startNewAquarium(await pickLayout($('layout-picker'))); // 開発用：オフラインで間取りを試す
  }
  await splash.hide();
  splashDone = true;
}

boot().catch((err) => {
  console.error(err);
  const label = document.getElementById('splash-label');
  if (label) label.textContent = `起動に失敗しました: ${err.message}`;
});
