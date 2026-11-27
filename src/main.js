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
import { setSwayTime } from './flora/floraMaterial.js';
import { TankManager } from './tanks/tankManager.js';
import { TankCustomizer, format as formatParam } from './tanks/tankCustom.js';
import { HallInteraction } from './interaction/hallInteraction.js';
import { InteriorInteraction } from './interaction/interiorInteraction.js';
import { ViewInteraction } from './interaction/viewInteraction.js';
import { LightInteraction } from './interaction/lightInteraction.js';
import { updateCaustics } from './tanks/sandLook.js';
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
import { ShareApi, sendUrl } from './share/shareTank.js';
import { shareUrl } from './share/shareData.js';
import { choose, askConfirm } from './ui/dialog.js';
import { Online } from './online/online.js';
import { AutoSave } from './online/autoSave.js';
import { FriendPanel } from './ui/friendPanel.js';
import { runLoginGate } from './ui/loginGate.js';
import { showNewSpecies } from './ui/newSpecies.js';
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
import { BUILDING_VERSION, STORY_H, FLOOR_COUNT, START_ZONES, ATRIUM_TANK_POS, BASEMENT, isWing, floorLevel, wingCount, floorOrder, DEFAULT_LAYOUT, LAYOUT, WALL_EDITS, zonesUpToLevel, getZone, setLayout, setWallEdits, setZoneNames, zoneAt, zoneCenter, ZONES, floorLabel, GRID_X, GRID_Z0, CELL_SIZE } from './building/blueprint.js';
import { ViewModes } from './building/viewModes.js';
import { buildLowerShell, buildWingShell } from './building/exterior.js';
import { OutdoorScenery } from './building/outdoorScenery.js';
import { WallInteraction } from './interaction/wallInteraction.js';
import { pickLayout } from './ui/layoutPicker.js';
import { ZoneLabels } from './building/zoneLabels.js';
import { DolphinPool } from './building/dolphinPool.js';
import { SeaPen } from './building/seaPen.js';
import { researchBonus } from './building/backyardData.js';
import { SeaPenScene } from './building/seaPenScene.js';
import { SeaPenView } from './ui/seaPenView.js';
import { PoolView } from './ui/poolView.js';
import { DinerView } from './ui/dinerView.js';
import { ExpandPanel } from './ui/expandPanel.js';
import { ZoneView } from './building/buildingViews.js';
import { migrateToLayout, relocateInvalid, migrateLayoutV4, migrateGridV5, migrateGridV6, migrateWingV6, freeFloorSpot, zonesForLegacyStage } from './building/migrate.js';
import { FishingScene } from './expedition/fishingScene.js';
import { zoneOf } from './expedition/husbandry.js';
import { isHungry } from './expedition/husbandry.js';
import { allianceBonus, allianceLevel } from './expedition/creatureData.js';
import { CREATURES, DESTINATIONS, DEFAULT_HOME, relocateCost } from './expedition/creatureData.js';
import { setGrowthSource } from './expedition/growth.js';
import { buildCreature } from './expedition/creatureBuilder.js';
import { loadCreatureConfig } from './expedition/creatureConfig.js';
import { installHoldRepeat } from './ui/holdRepeat.js';
import { applyCreatureReset, CREATURE_RESET } from './online/betaReset.js';
import { TankView } from './ui/tankView.js';
import { BuildView } from './ui/buildView.js';
import { MailView } from './ui/mailView.js';
import { Tutorial } from './ui/tutorial.js';
import { Guide } from './ui/guide.js';
import { RankingView } from './ui/rankingView.js';
import { BuildInPlace } from './interaction/buildInPlace.js';
import { setCustomHandler, registerCustomIds } from './tanks/customTanks.js';
import { tankLabel } from './tanks/tankLabel.js';
import { Wallet } from './management/wallet.js';
import { Items } from './management/items.js';
import { Construction } from './management/construction.js';
import { PASS } from './management/walletData.js';
import { Builder } from './building/builder.js';
import { Daily } from './game/daily.js';
import { OFFLINE_MAX_HOURS } from './game/gameData.js';
import { Purchases } from './online/purchases.js';
import { StoreView } from './ui/storeView.js';
import { Gacha } from './gacha/gacha.js';
import { GachaView } from './ui/gachaView.js';

const $ = (id) => document.getElementById(id);
const MIN_SPLASH_MS = 1800;
const POOL_APPEAL = 30; // プールの設備そのものの魅力（生き物は展示した分を別に数える）
const OUTDOOR_APPEAL = { marine: 60, store: 20, diner: 30 };
const THEME_BONUS = 1.25;
const HINT = {
  home: '水槽をタップすると名前・展示生物・エサ・掃除を管理できます ・ ドラッグで回転 / 2本指でズーム',
  pick: '編集する部屋をタップしてください（真上から見た部屋で編集します）',
  hall: 'タップで選択・ドラッグで移動 ・ 何もない所のドラッグで画面を移動 / 2本指でズーム',
  place: '床をタップして設置 ・ もう一度カードを押すとキャンセル',
  interior: 'ドラッグで移動（岩の上にも積める）・ はみ出した部分はガラス面でカット',
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
  // ダイヤ・アイテム・建築の工事（docs/monetization.md）
  const wallet = new Wallet({ economy });
  const items = new Items({ wallet });
  const construction = new Construction();
  const gacha = new Gacha({ expeditions });
  expeditions.getBonusTeams = () => wallet.extraTeams();
  wallet.addEventListener('granted', (e) => toast(`💎 +${e.detail.n}ダイヤ（${e.detail.reason}）`));
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
  // 屋外生け簀（レベル5で解放。100m×100m を区切って展示）
  const seaPen = new SeaPen();
  const penScene = new SeaPenScene(sceneMgr.scene, seaPen);
  pool.isOpen = () => unlocked.has('pool');
  manager.extraExhibitAppeal = () => seaPen.appeal() + pool.appeal();
  manager.extraExhibits = () => [...seaPen.exhibits, pool.exhibit];
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
  /** 各階に階段を1つずつ置く（なければ、その階の最初の展示室の左奥の隅に近い空いた床へ。動かすのは自由、撤去はできない） */
  function ensureStairs() {
    const def = getDef('stairs');
    for (const floor of floorOrder(unlocked)) {
      if ([...manager.objects.values()].some((o) => o.userData.floor === floor && manager.defOf(o).stairs)) continue;
      // 展示室がない階（地下の機械室だけなど）はバックヤードに置く
      const open = ZONES.filter((z) => z.floor === floor && unlocked.has(z.id) && !z.facility && z.type !== 'outdoor');
      const zone = open.find((z) => z.type === 'hall') ?? open[0];
      const type = zone?.type === 'hall' ? CELL.FLOOR : CELL.YARD;
      // 左奥（-X・-Z）の隅から少し内側
      const [x0, z0] = zone?.rects[0] ?? [];
      const corner = zone && { x: (x0 - GRID_X / 2) * CELL_SIZE + 1.5, z: (z0 - GRID_Z0) * CELL_SIZE + 2.5 };
      const spot = zone && freeFloorSpot({ manager, floor, unlocked, hx: def.size.w / 2, hz: def.size.d / 2, target: corner, type });
      if (spot) manager.add('stairs', { ...spot, floor });
    }
  }
  /** 階段で行ける上下の階（なければ null） */
  function stairsTo(floor, dir) {
    const list = floorOrder(unlocked).filter((f) => f === floor || ZONES.some((z) => z.floor === f && unlocked.has(z.id))).sort((a, b) => floorLevel(a) - floorLevel(b));
    const k = list.indexOf(floor) + (dir === 'up' ? 1 : -1);
    return list.indexOf(floor) < 0 || k < 0 || k >= list.length ? null : list[k];
  }
  /** 階段をタップしたときの、上下の階へ移動するメニュー（タップした位置に出す） */
  function openStairsMenu(stairs, e) {
    let pop = document.getElementById('stairs-pop');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'stairs-pop';
      document.body.append(pop);
      pop.addEventListener('click', (ev) => {
        const b = ev.target.closest('button[data-floor]');
        pop.hidden = true;
        if (b) views.goFloor(+b.dataset.floor);
      });
      document.addEventListener('pointerdown', (ev) => !ev.target.closest('#stairs-pop') && (pop.hidden = true));
    }
    const item = (dir, mark) => {
      const to = stairsTo(stairs.userData.floor, dir);
      return to == null ? '' : `<button data-floor="${to}">${mark} ${floorLabel(to)}へ</button>`;
    };
    const items = item('up', '▲') + item('down', '▼');
    pop.innerHTML = `<b>階段</b>${items || '<small>ほかの階はまだありません</small>'}`;
    pop.style.left = `${Math.min(e.clientX, innerWidth - 150)}px`;
    pop.style.top = `${Math.min(e.clientY, innerHeight - 130)}px`;
    pop.hidden = false;
  }
  /** 埋め込み水槽を壁に合わせ直し、穴あきの壁を作り直す */
  function refreshRoom() {
    const runs = room.plan.runs();
    const holes = [];
    for (const tank of manager.embeddedObjects()) {
      const def = manager.defOf(tank);
      const e = tank.userData.embed;
      const run = findRunByKey(runs, e.key, e.along);
      if (run && run.key !== e.key) e.key = run.key; // 壁の種類が変わった（外壁 → 仕切り壁など）
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
    // 別館と一緒にできるエリア（連絡通路）
    for (const z of ZONES) if (z.auto && unlocked.has(z.auto)) unlocked.add(z.id);
    room.setStage(economy.stage, economy.floor, unlocked);
    pool.setLayout();
    penScene.setLayout();
    zoneLabels.update(economy.floor, unlocked);
    const under = economy.floor === BASEMENT; // 地下では屋外（プール・景観・生け簀）を出さない
    room.setUnderground(under);
    pool.setUnlocked(unlocked.has('pool') && !under);
    scenery.group.visible = !under;
    penScene.setVisible(!under);
    scenery.sync(LAYOUT.id, unlocked);
    manager.extraAppeal = (unlocked.has('pool') ? POOL_APPEAL : 0) + Object.entries(OUTDOOR_APPEAL).reduce((s, [id, n]) => s + (unlocked.has(id) ? n : 0), 0);
    ensureAtriumTank();
    ensureStairs();
    room.applyLook(roomSettings);
    room.setLights(roomSettings.lights);
    refreshRoom();
    afterApplyRoom();
    syncGround();
    if (reframe) cameraCtl.frameBounds(room.plan.bounds(CELL.FLOOR));
  }

  // ---- 上の階の表示：今の階を床の高さ0に置いたまま、地面・屋外・下の階の外壁を階の高さだけ下げる ----
  const lowerShell = buildLowerShell();
  lowerShell.visible = false;
  sceneMgr.scene.add(lowerShell);
  let wingShell = null;
  let viewMode = 'floor'; // 表示の切り替え（ViewModes の mode）
  function syncGround() {
    const floorView = viewMode === 'floor';
    const level = floorLevel(economy.floor);
    const drop = floorView && level > 0 ? level * STORY_H : 0;
    room.grass.position.y = -0.03 - drop;
    for (const g of [scenery.group, pool.group, penScene.group]) g.position.y = -drop;
    // 下の階の外壁（地面からの高さが分かるように）
    lowerShell.visible = drop > 0;
    lowerShell.position.y = -drop;
    lowerShell.scale.y = Math.max(1, Math.min(level, FLOOR_COUNT));
    // 別館は今の階より下の階だけ外観を出す（今の階は館内として表示している）
    const wings = Math.max(0, Math.min(level, wingCount(unlocked)));
    if (wingShell?.userData.floors !== wings) {
      if (wingShell) sceneMgr.scene.remove(wingShell);
      wingShell = buildWingShell(wings);
      wingShell.userData.floors = wings;
      sceneMgr.scene.add(wingShell);
    }
    wingShell.visible = floorView && wings > 0;
    wingShell.position.y = -drop;
  }
  applyRoom(true);
  const views = new ViewModes({
    sceneMgr, cameraCtl, room, manager, pool, scenery, labels: zoneLabels, railEl: $('view-rail'),
    getFloor: () => economy.floor,
    getUnlocked: () => unlocked,
    onFloor: (floor) => changeFloor(floor),
    onModeChange: (m) => {
      view.enabled = m === 'floor' && mode === 'home';
      viewMode = m;
      syncGround();
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
    stairsTo,
    getGrowMode: () => interior.growMode,
    getFloraRadius: () => interior.floraRadius,
    onAction: (action, obj, value) => {
      if (action.startsWith('rockshape-')) return interior.setRockShape(obj, action === 'rockshape-random' ? 'random' : +action.slice(10));
      if (action.startsWith('grow-')) return interior.setGrowMode(action === 'grow-off' ? null : action.slice(5));
      if (action === 'param-flora-size') return interior.setFloraSize(obj, value);
      if (action === 'param-flora-radius') return (interior.floraRadius = value);
      if (action === 'param-embed-ratio') return hall.setEmbedParam(obj, 'ratio', value);
      if (action === 'param-embed-bottom') return hall.setEmbedParam(obj, 'bottom', value);
      if (action === 'embed') return hall.embed(obj);
      if (action === 'tank-edit') return openTankSheet(obj, 'manage');
      if (action === 'param-bubbles') return (obj.userData.bubbles = value);
      if (action.startsWith('look-') || action === 'param-tanklight-intensity' || action === 'param-side-alpha' || action === 'param-sand-depth') return changeTankLook(obj, action, value);
      if (action === 'unembed') return hall.unembed(obj);
      if (action === 'stairs-up' || action === 'stairs-down') {
        const to = stairsTo(obj.userData.floor, action === 'stairs-up' ? 'up' : 'down');
        if (to != null) views.goFloor(to);
        return;
      }
      if (action === 'lock') {
        if (obj.userData.interiorItem) return interior.setLocked(obj, !obj.userData.locked); // 解除できるのは1つだけ
        obj.userData.locked = !obj.userData.locked;
        customizer.syncLock();
        customizer.renderPanel();
        return;
      }
      if (action === 'copy') return hall.enabled ? hall.copy(obj) : toast('館内レイアウト編集でコピーできます');
      if (action === 'share') return shareTank(obj);
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
    } else if (action === 'look-sand-on' || action === 'look-sand-off') manager.setTankLook(tank, { sand: { ...look.sand, on: action === 'look-sand-on' } });
    else if (action.startsWith('look-sandtype-')) manager.setTankLook(tank, { sand: { ...look.sand, type: action.slice(14) } });
    else if (action === 'param-sand-depth') {
      manager.setTankLook(tank, { sand: { ...look.sand, depth: value } });
      rerender = false;
    } else if (action === 'look-caustics') manager.setTankLook(tank, { caustics: !look.caustics });
    else if (action === 'look-frame-on') manager.setTankLook(tank, { frame: true });
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
    if (rerender) {
      customizer.renderPanel();
      if (gameSheet.view === 'tank') gameSheet.render();
    }
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
      else if (kind === 'light-select') room.setSelectedLight(value);
      else if (kind === 'wall-mode') {
        wallCtl.setEnabled(value);
        room.setWallEditing(value);
        hall.setEnabled(!value && mode === 'hall-edit' && !!editRoom);
        if (value) customizer.deselect();
      }
    },
  });

  // 建築の注文窓口：コインを払って工事を始め、完了したら解放する（同時に1件）
  const builder = new Builder({
    construction, economy, seaPen, items, wallet, toast, getUnlocked: () => unlocked,
    onZone: (id) => unlockZone(id),
    onStage: () => finishStage(),
    onPen: () => {
      seaPen.unlock();
      toast('屋外生け簀が完成しました');
    },
    onPenCell: (r) => {
      if (seaPen.rectOf([r.x0, r.z0], [r.x1, r.z1])) seaPen.addSection(r);
      toast('生け簀の区画が完成しました');
    },
    onChange: () => {
      shell.update();
      if (gameSheet.view) gameSheet.render();
    },
  });
  // 地下展示室・別館・屋外生け簀の解放（レイアウト編集の「増築」タブからだけ）
  const expandPanel = new ExpandPanel({
    el: $('expand-panel'), economy, getUnlocked: () => unlocked, seaPen, builder,
    onSeaPen: () => gameSheet.openPanel('seapen'),
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
      if (mode === 'hall-edit' && !editRoom) return toast('先に編集する部屋をタップしてください');
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
      expandPanel.setVisible(extra && id === 'expand');
      inPlace.setActive(extra && id === 'build' && !!editRoom); // 水槽建造も部屋を選んでから
      if (!extra) shell.setHint(editRoom ? HINT.hall : HINT.pick);
    },
  });

  // ---- 操作 -----------------------------------------------------------------
  // ライトのハンドルは他の操作より先にイベントを取るため、最初に作る
  const lightCtl = new LightInteraction({
    sceneMgr, cameraCtl, room, manager,
    getSettings: () => roomSettings,
    onSelect: (i) => roomPanel.selectLight(i),
    onChanged: () => roomPanel.render(), // 向き・傾きの表示を合わせる
    onAdd: (x, z) => roomPanel.addLightAt(x, z),
  });
  const wallCtl = new WallInteraction({
    sceneMgr, room, manager, toast,
    getBrush: () => roomPanel.brush,
    onChanged: () => {
      applyRoom(false);
      room.setWallEditing(true);
    },
  });
  // 水槽のほか、イルカプールと生け簀もタップで展示の画面を開く
  const view = new ViewInteraction({
    sceneMgr, manager, onTankTap: (tank) => openTank(tank),
    onStairsTap: (stairs, e) => openStairsMenu(stairs, e),
    // 部屋の床を長押し：部屋の中から見渡すプレビュー
    onFloorLongPress: (e) => {
      if (roomView) return;
      const zone = floorZoneAt(e);
      if (zone && zone.type !== 'outdoor') enterRoomView(zone.id);
    },
    extraTargets: () => [
      ...(pool.group.visible ? [[pool.water, () => gameSheet.openPanel('pool')]] : []),
      ...(penScene.group.visible ? [[penScene.group, () => gameSheet.openPanel('seapen')]] : []),
      // 売店は商品の補充（店舗運営）、食堂は料理の提供
      ...scenery.facilities.map(([obj, kind]) => [obj, () => gameSheet.openPanel(kind === 'store' ? 'shop' : 'diner')]),
    ],
  });
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
    // コピーした水槽があれば、館内レイアウト編集の間だけ「貼り付け」を出す
    onClipboard: (show) => {
      const b = $('btn-paste');
      b.hidden = !show;
      b.textContent = hall.pasting ? '✓ 貼り付け終了' : hall.clipboards.length > 1 ? `📋 貼り付け（${hall.clipboards.length}）` : '📋 貼り付け';
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
    onGrowChange: (m) => shell.setHint(m ? HINT.grow : HINT.interior),
    // 元に戻すボタン：水槽内編集の間だけ出し、戻せる操作が無ければ押せない
    onHistory: (h) => {
      $('btn-clear').hidden = !h.tank;
      $('btn-undo').hidden = !h.tank;
      $('btn-undo').disabled = !h.size;
      $('btn-undo').textContent = h.size ? `↶ 戻す ${h.size}` : '↶ 戻す';
    },
  });
  $('btn-undo').addEventListener('click', () => interior.undo());
  $('btn-clear').addEventListener('click', () => interior.clearLayout());
  // 貼り付け：コピーが複数あれば選んでから置く。置いている間は「貼り付け終了」
  $('btn-paste').addEventListener('click', async () => {
    if (hall.pasting) return hall.cancelPlacement();
    if (hall.clipboards.length < 2) return hall.paste();
    const k = await choose({ title: 'どのレイアウトを貼り付けますか', text: '新しくコピーした順です（5件まで）。置いたあとも続けて置けます', buttons: hall.clipboards.map((c, i) => ({ key: String(i), label: c.label, kind: i === 0 ? 'primary' : '' })) });
    if (k !== null) hall.paste(hall.clipboards[+k]);
  });

  // ---- モード ---------------------------------------------------------------
  //   home（館内の閲覧）→ 水槽タップ → tank（水槽の閲覧）→ ✎ → interior-edit
  //   home → ✎ → hall-edit（館内レイアウト編集）→ 水槽の「水槽内」→ interior-edit
  let mode = 'home';
  let focusTank = null;
  let interiorFrom = null;

  function goHome() {
    leaveRoomEdit();
    mode = 'home';
    hall.setEnabled(false);
    room.setEditVisible(false);
    roomPanel.setVisible(false);
    expandPanel.setVisible(false);
    inPlace.setActive(false);
    customizer.deselect();
    view.enabled = views.mode === 'floor';
    shell.setMode('home');
    shell.setHint(HINT.home);
  }

  function openTank(tank) {
    if (interiorCam.busy) return;
    exitRoomView();
    focusTank = tank;
    mode = 'tank';
    view.enabled = false;
    $('btn-paste').hidden = true; // 貼り付けは館内レイアウト編集の間だけ
    interiorCam.enter(tank);
    shell.setMode('tank', tankLabel(manager, tank));
    shell.setHint('');
    openTankSheet(tank);
  }

  /** 水槽の管理シート（名前・展示生物・エサ・掃除） */
  function openTankSheet(tank, tab = 'manage') {
    if (visiting) return;
    friendPanel.close();
    tankView.open(tank, tab);
    gameSheet.openPanel('tank');
  }

  // 水槽の編集シートの「見た目」タブ：ボタン・スライダー・色は館内レイアウトの詳細パネルと同じ処理へ
  {
    const sheet = $('game-sheet');
    const target = () => (gameSheet.view === 'tank' && tankView.tank && manager.objects.has(tankView.tank.userData.uid) ? tankView.tank : null);
    sheet.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-action]');
      const t = target();
      if (b && t) customizer.onAction(b.dataset.action, t);
    });
    sheet.addEventListener('input', (e) => {
      const t = target();
      if (!t) return;
      const look = e.target.closest('input[data-look]');
      if (look) return customizer.onAction(`look-color-${look.dataset.look}`, t, look.value);
      const p = e.target.closest('input[data-param]');
      if (!p) return;
      customizer.onAction(`param-${p.dataset.param}`, t, Number(p.value));
      const out = p.parentElement.querySelector('output');
      if (out) out.textContent = formatParam(p.dataset.fmt, p.value);
    });
  }

  function enterHallEdit() {
    exitRoomView();
    views.setMode('floor');
    mode = 'hall-edit';
    view.enabled = false;
    customizer.allowEmbed = true;
    // 部屋を選んでから編集する（水槽内の編集から戻ったときは、その部屋の編集のまま）
    hall.setEnabled(!!editRoom);
    room.setEditVisible(true);
    catalog.setDefs(HALL_DEFS, [{ id: 'build', label: '水槽建造' }, { id: 'room', label: '部屋' }, { id: 'expand', label: '増築' }]);
    shell.setMode('hall-edit', '館内レイアウト編集');
    shell.setHint(editRoom ? HINT.hall : HINT.pick);
  }

  function enterInteriorEdit(tank, from) {
    if (interiorCam.busy) return;
    interiorFrom = from;
    focusTank = tank;
    hall.setEnabled(false);
    roomPanel.setVisible(false);
    expandPanel.setVisible(false);
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
    exitRoomView();
    leaveRoomEdit();
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
      // 水槽に注目している間：水槽の編集シート（生物・飼育／見た目／水槽内レイアウト）を開く。✕で閉じてもここから開き直せる
      else if (mode === 'tank') openTankSheet(focusTank);
    },
    onShare: () => {
      if (mode === 'tank' && focusTank) shareTank(focusTank);
    },
    onDone,
    onFloorChange: (floor) => views.goFloor(floor),
    getStageJob: () => construction.find('stage'),
    onUpgrade: () => {
      const job = construction.find('stage');
      if (job) return builder.boost('stage', job.id);
      builder.orderStage(); // 工事が終わると finishStage
    },
  });

  /** 昇格の工事が終わった：レベルを上げ、レベルに応じたエリアを解放して建物へ反映する */
  function finishStage() {
    if (!economy.completeUpgrade()) return;
    const opened = zonesUpToLevel(economy.stage.level).filter((id) => !unlocked.has(id));
    opened.forEach((id) => unlocked.add(id));
    applyRoom(false);
    if (opened.length) toast(`${opened.map((id) => getZone(id).name).join('、')} を解放しました`, { duration: 5000 });
    if (gameSheet.view) gameSheet.render();
    shell.update();
    toast(`「${economy.stage.name}」に拡張しました！`);
  }

  /** 現在の状態を保存用データにする */
  function snapshot() {
    return { version: LAYOUT_VERSION, creatureReset: CREATURE_RESET, savedAt: new Date().toISOString(), economy: economy.toJSON(), life: life.toJSON(), inventory: inventory.toJSON(), expedition: expeditions.toJSON(), ops: ops.toJSON(), seaPen: seaPen.toJSON(), dolphinPool: pool.toJSON(), wallet: wallet.toJSON(), items: items.toJSON(), construction: construction.toJSON(), daily: daily.toJSON(), gacha: gacha.toJSON(), ...(home && { home }), room: { ...roomSettings, building: BUILDING_VERSION, layout: LAYOUT.id, unlocked: [...unlocked], walls: WALL_EDITS }, objects: manager.serialize() };
  }

  let pendingLayout = null; // 初期設定で選んだ間取り
  function resetLights() {
    const c = zoneCenter(getZone('entrance'));
    roomSettings.lights = [defaultLight(c.x, c.z, 'entrance')];
  }

  // ---- カメラの操作設定の保存と復元 ----
  function camSave() {
    const c = cameraCtl.controls;
    return { pos: sceneMgr.camera.position.clone(), target: c.target.clone(), min: c.minDistance, max: c.maxDistance, minPolar: c.minPolarAngle, maxPolar: c.maxPolarAngle, pan: c.enablePan, zoom: c.enableZoom, rotate: c.enableRotate, speed: c.rotateSpeed, ssp: c.screenSpacePanning, touches: { ...c.touches }, mouse: { ...c.mouseButtons } };
  }
  function camRestore(s) {
    const c = cameraCtl.controls;
    Object.assign(c, { minDistance: s.min, maxDistance: s.max, minPolarAngle: s.minPolar, maxPolarAngle: s.maxPolar, enablePan: s.pan, enableZoom: s.zoom, enableRotate: s.rotate, rotateSpeed: s.speed, screenSpacePanning: s.ssp, touches: s.touches, mouseButtons: s.mouse });
    c.target.copy(s.target);
    sceneMgr.camera.position.copy(s.pos);
    c.update();
  }

  // ---- ホーム：部屋の床をタップすると、部屋の中央の目の高さから壁や天井を見渡すプレビュー ----
  let roomView = null; // { zone, saved }
  const previewBtn = document.createElement('button');
  previewBtn.id = 'preview-exit';
  previewBtn.hidden = true;
  document.body.append(previewBtn);
  previewBtn.addEventListener('click', () => exitRoomView());
  function enterRoomView(zoneId) {
    const zone = getZone(zoneId);
    if (!zone) return;
    const c = cameraCtl.controls;
    const cam = sceneMgr.camera;
    if (!roomView) roomView = { saved: camSave() };
    roomView.zone = zoneId;
    const center = zoneCenter(zone);
    // 注視点のすぐ後ろにカメラを置き、回転で見渡す（距離はほぼ0）
    const dir = new THREE.Vector3().subVectors(c.target, cam.position).setY(0);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    c.target.set(center.x, 1.6, center.z);
    cam.position.copy(c.target).addScaledVector(dir, -0.05);
    Object.assign(c, { minDistance: 0.05, maxDistance: 0.05, minPolarAngle: 0.15, maxPolarAngle: Math.PI - 0.15, enablePan: false, enableZoom: false, enableRotate: true, rotateSpeed: -0.45 });
    c.update();
    previewBtn.textContent = `${zone.name} のプレビューを終わる`;
    previewBtn.hidden = false;
    shell.setHint('ドラッグで部屋の中を見渡せます');
  }
  function exitRoomView() {
    if (!roomView) return;
    const { saved } = roomView;
    roomView = null;
    camRestore(saved);
    previewBtn.hidden = true;
    if (mode === 'home') shell.setHint(HINT.home);
  }

  // ---- レイアウト編集：部屋をタップして、その部屋を真上から見た2Dの画面で編集する ----
  let editRoom = null; // { zone, saved }
  const roomBackBtn = document.createElement('button');
  roomBackBtn.id = 'room-back';
  roomBackBtn.hidden = true;
  roomBackBtn.textContent = '部屋を選び直す';
  document.body.append(roomBackBtn);
  roomBackBtn.addEventListener('click', () => leaveRoomEdit());
  function enterRoomEdit(zoneId) {
    const zone = getZone(zoneId);
    if (!zone || editRoom) return;
    editRoom = { zone: zoneId, saved: camSave() };
    // 部屋の外接矩形が画面に収まる高さの真上から見下ろす（回転なし・1本指で移動・2本指でズーム）
    const xs = zone.rects.flatMap((r) => [r[0], r[2] + 1]).map((i) => (i - GRID_X / 2) * CELL_SIZE);
    const zs = zone.rects.flatMap((r) => [r[1], r[3] + 1]).map((j) => (j - GRID_Z0) * CELL_SIZE);
    const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    const cam = sceneMgr.camera;
    const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const h = Math.max((z1 - z0) / 2 / t, (x1 - x0) / 2 / (t * cam.aspect)) * 1.25 + 4;
    const c = cameraCtl.controls;
    Object.assign(c, { minDistance: 4, maxDistance: Math.max(h * 2, 30), minPolarAngle: 0, maxPolarAngle: 0.0001, enablePan: true, enableZoom: true, enableRotate: false, screenSpacePanning: true });
    c.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
    c.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    // 下のカタログに隠れないよう、注視点を少し手前（画面の下側）へずらす
    c.target.set((x0 + x1) / 2, 0, (z0 + z1) / 2 + (z1 - z0) * 0.12);
    cam.position.set(c.target.x, h, c.target.z + 0.001);
    c.update();
    room.setFocusZone(zoneId);
    roomPanel.setFocus(zoneId);
    hall.setEnabled(true);
    inPlace.setActive(catalog.activeTab === 'build');
    roomBackBtn.textContent = `${zone.name} ・ 部屋を選び直す`;
    roomBackBtn.hidden = false;
    shell.setHint(HINT.hall);
  }
  /** 2Dの部屋の編集から、部屋を選ぶ画面に戻る */
  function leaveRoomEdit() {
    if (!editRoom) return;
    const { saved } = editRoom;
    editRoom = null;
    hall.cancelPlacement();
    customizer.deselect();
    camRestore(saved);
    room.setFocusZone(null);
    roomPanel.setFocus(null);
    roomBackBtn.hidden = true;
    inPlace.setActive(false);
    if (mode === 'hall-edit') {
      hall.setEnabled(false);
      shell.setHint(HINT.pick);
    }
  }
  // 部屋を選ぶ画面：床のタップでその部屋の編集へ
  {
    const dom = sceneMgr.renderer.domElement;
    let down = null;
    dom.addEventListener('pointerdown', (e) => (down = e.isPrimary ? { x: e.clientX, y: e.clientY, t: performance.now() } : null));
    dom.addEventListener('pointerup', (e) => {
      const d = down;
      down = null;
      if (!d || mode !== 'hall-edit' || editRoom || views.mode !== 'floor' || inPlace.active) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || performance.now() - d.t > 500) return;
      const zone = floorZoneAt(e);
      if (zone) enterRoomEdit(zone.id);
    });
  }
  /** 画面の点の下の床の、解放済みのエリア */
  function floorZoneAt(e) {
    const r = sceneMgr.renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), sceneMgr.camera);
    const p = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
    const zone = p && zoneAt(economy.floor, p.x, p.z);
    return zone && unlocked.has(zone.id) ? zone : null;
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

  /** 廃止したお土産店・カフェの置物は撤去して代金を返す（在庫の分も） */
  function refundOldShops() {
    let yen = 0;
    for (const o of [...manager.objects.values()]) {
      const def = manager.defOf(o);
      if (def.id !== 'souvenirShop' && def.id !== 'cafe') continue;
      manager.remove(o);
      yen += def.price;
    }
    for (const id of ['souvenirShop', 'cafe']) {
      const n = inventory.count(id);
      for (let k = 0; k < n; k++) inventory.take(id);
      yen += getDef(id).price * n;
    }
    if (yen > 0) {
      economy.earn(yen);
      saveAfterLoad = true;
      life.mail.add({ key: 'shops-retired', kind: 'room', title: 'お土産店・カフェの置物を払い戻しました', body: `売店・食堂のエリアに置き換えたため、置物を撤去して ${yen.toLocaleString('ja-JP')}コインを払い戻しました。館内エリアで売店・食堂を開けます。` });
    }
  }
  let saveAfterLoad = false; // 読み込み時の救済で中身が変わった（すぐクラウドへ保存する）
  /** 保存用データから状態を復元する。β版の生物データのリセットを行ったら true */
  function applySnapshot(data) {
    const reset = applyCreatureReset(data);
    if (mode !== 'home') goHome();
    views.setMode('floor');
    setLayout(data.room?.layout ?? pendingLayout ?? DEFAULT_LAYOUT);
    // 間取りを広げる前（版4未満）の壁の編集は、壁の位置が変わるので使わない
    const builtVer = data.room?.building ?? 0;
    const oldBuilding = data.room?.layout && builtVer < BUILDING_VERSION;
    const oldGrid = data.room?.layout && builtVer < 4; // 間取りを広げる前（版3まで）
    if (data.room?.layout && builtVer === 4) migrateGridV5(data); // 敷地の格子を左右に広げた
    if (data.room?.layout && builtVer < 6) migrateGridV6(data, builtVer); // 格子を北へ広げ、別館をプールの奥へ移した
    setWallEdits(data.room?.layout && !oldGrid ? data.room.walls : null);
    // 建造した水槽の定義を先に登録する（ID に寸法が入っている）
    registerCustomIds([...(data.objects ?? []).map((o) => o.defId), ...Object.keys(data.inventory?.stock ?? {}), ...(data.inventory?.orders ?? []).map((o) => o.defId)]);
    economy.fromJSON(data.economy);
    inventory.fromJSON(data.inventory);
    expeditions.fromJSON(data.expedition);
    ops.fromJSON(data.ops);
    seaPen.fromJSON(data.seaPen);
    pool.fromJSON(data.dolphinPool);
    if (!visiting) {
      // ダイヤ・アイテム・工事・毎日のダイヤは自分の水族館のものだけ（訪問先のは読まない）
      wallet.fromJSON(data.wallet);
      items.fromJSON(data.items);
      construction.fromJSON(data.construction);
      gacha.fromJSON(data.gacha);
    }
    if (!visiting) refundOldShops();
    if (!visiting) home = data.home ?? null;
    roomSettings = { ...defaultRoomSettings(), ...(data.room ?? {}) };
    // 照明は置いた部屋に属する（以前の、全階共通だった照明は1階のその位置の部屋へ）
    roomSettings.lights = roomSettings.lights.map(normalizeLight).map((l) => (l.zone ? l : { ...l, zone: zoneAt(0, l.x, l.z)?.id ?? 'entrance' }));
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
    } else if (oldBuilding) {
      // 間取りを広げた：物を元のエリアの新しい位置へ移し、置けない物だけ空いている場所へ（照明は置き直す）
      if (oldGrid) migrateLayoutV4({ manager });
      if (builtVer < 6) migrateWingV6({ manager, moved: oldGrid });
      // 版5：屋外ひろば・自然再現エリアを廃止し、左に海獣広場・売店・食堂を設けた。置けなくなった物だけ移す
      relocateInvalid({ manager, unlocked, inventory, expeditions, economy });
      if (oldGrid) resetLights();
    }
    delete roomSettings.plan;
    manager.setFloor(economy.floor);
    life.fromJSON(data.life, { own: !visiting, oldShops: data.life ? 0 : data.ops?.shops ?? 0 });
    if (!visiting) daily.fromJSON(data.daily);
    if (!visiting) {
      const shown = new Set(manager.exhibits.flatMap((t) => Object.entries(t.userData.creatures ?? {}).filter(([, n]) => n > 0).map(([id]) => id)));
      if (life.repairDiscoveries(shown)) saveAfterLoad = true;
    }
    // 別館の階が未建設なら本館へ戻す
    if (isWing(economy.floor) && !floorOrder(unlocked).includes(economy.floor)) {
      economy.setFloor(0);
      manager.setFloor(0);
    }
    applyRoom(true);
    views.syncRail();
    shell.update();
    return reset;
  }

  // ---- オンライン：クラウド保存・フレンド・訪問 -------------------------------
  const online = new Online();
  let visiting = null; // { mine: 自分のスナップショット }

  // ---- 水槽の共有（URL を知っている人がログインなしで見られる。src/share/） ----
  const shareApi = new ShareApi(online);
  let sharing = false;
  async function shareTank(obj) {
    if (visiting) return toast('自分の水族館の水槽だけ共有できます');
    if (!online.user) return toast('共有するにはログインしてください', { error: true });
    if (sharing) return;
    sharing = true;
    const title = obj.userData.name || getDef(obj.userData.defId).name;
    try {
      const old = await shareApi.find(obj.userData.uid);
      let pick = 'update';
      if (old) {
        pick = await choose({
          title: 'この水槽は共有中です',
          text: `これまでに ${old.views} 回見られました。
共有した時点の姿が表示されています。`,
          buttons: [{ key: 'update', label: '今の水槽で更新して送る', kind: 'primary' }, { key: 'send', label: 'URL だけ送る' }, { key: 'stop', label: '共有をやめる', kind: 'danger' }],
        });
        if (!pick) return;
      }
      if (pick === 'stop') {
        await shareApi.unshare(obj.userData.uid);
        return toast('共有をやめました。URL を開いても表示されなくなります');
      }
      let url = shareUrl(old?.id);
      if (pick === 'update') {
        toast('共有の準備中…（水槽を撮影しています）', { duration: 4000 });
        url = await shareApi.share(manager, obj);
      }
      life.state.flags.shared = true; // 目標「水槽を共有する」
      const r = await sendUrl(url, title);
      if (r === 'copied') toast('共有ページの URL をコピーしました。LINE やインスタに貼り付けて送れます', { duration: 4000 });
    } catch (e) {
      toast(e.message ?? String(e), { error: true, duration: 4000 });
    } finally {
      sharing = false;
    }
  }
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
  const hud = new Hud({ el: $('hud'), economy, online, wallet, onAccount: () => !visiting && shell.toggleMenu(), onStore: () => !visiting && gameSheet.openPanel('store') });
  /** エリアを解放して建物を作り直す */
  function unlockZone(id) {
    unlocked.add(id);
    applyRoom(false);
    views.syncRail();
    shell.update();
    const z = getZone(id);
    toast(z.wing ? `${z.name} を建設しました` : `${z.name} を解放しました`);
    // 別館は建てたらその階へ移動して見せる
    if (z.wing) {
      gameSheet.close();
      views.goFloor(z.floor);
      cameraCtl.frameBounds(room.plan.bounds(CELL.FLOOR));
    }
  }
  const life = new LifeSystems({
    isUnlocked: (id) => unlocked.has(id),
    sceneMgr, room, manager, economy, ops, inventory, expeditions, previews, toast,
    getHome: () => home, goalEl: $('goal-card'), reportEl: $('offline-report'), wallet, items,
  });
  life.offlineHours = () => (wallet.hasPass() ? PASS.offlineHours : OFFLINE_MAX_HOURS);
  const daily = new Daily({ wallet, mail: life.mail, toast });
  let dailyReady = false; // セーブを反映してスプラッシュを閉じてから（ログインボーナスなどを渡す）
  daily.isActive = () => !visiting && dailyReady;
  const purchases = new Purchases({ wallet, items, online });
  // 総合レベルのランキング（イベント画面のタブ）。点数は5分ごとに送る
  const rankingView = new RankingView({ manager, expeditions, online, previews, isVisiting: () => !!visiting, onLoaded: () => gameSheet.view === 'event' && gameSheet.render() });
  life.panels.event.view.ranking = rankingView;
  setInterval(() => document.visibilityState === 'visible' && rankingView.submit().catch((err) => console.warn(err.message)), 300000);
  // 操作の案内（チュートリアル・目標の進め方）：押す場所を指のマークで示す
  const guide = new Guide();
  if (import.meta.env.DEV) Object.assign(window, { __guide: guide, __hall: hall, __manager: manager, __life: life, __ex: expeditions }); // 開発用：動作を調べる
  const _box = new THREE.Box3();
  const _v = new THREE.Vector3();
  const guideEnv = {
    /** 画面に映っている水槽（生き物のいる水槽・画面の中央に近い水槽を優先）の画面上の位置 */
    tankRect() {
      if (mode !== 'home' || mapPage.isOpen || gameSheet.view) return null;
      const cam = sceneMgr.camera;
      const W = innerWidth;
      const H = innerHeight;
      let best = null;
      for (const t of manager.tanks) {
        if (!t.visible) continue;
        _box.setFromObject(t);
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let k = 0; k < 8; k++) {
          _v.set(k & 1 ? _box.max.x : _box.min.x, k & 2 ? _box.max.y : _box.min.y, k & 4 ? _box.max.z : _box.min.z).project(cam);
          if (_v.z > 1) continue;
          const sx = ((_v.x + 1) / 2) * W;
          const sy = ((1 - _v.y) / 2) * H;
          x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy);
        }
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        if (!(x1 > x0) || cx < 40 || cx > W - 40 || cy < 120 || cy > H - 140) continue;
        const life_ = Object.values(t.userData.creatures ?? {}).some((n) => n > 0) ? 0 : 1;
        const score = life_ * 1e6 + Math.hypot(cx - W / 2, cy - H / 2);
        if (!best || score < best.score) best = { score, x0, y0, x1, y1 };
      }
      if (!best) return null;
      // 小さい水槽はタップしやすい大きさで示し、大きすぎる水槽は中央の一部だけを示す（周りを暗くしすぎない）
      const w = Math.min(Math.max(best.x1 - best.x0, 56), W * 0.6);
      const h = Math.min(Math.max(best.y1 - best.y0, 56), H * 0.4);
      return new DOMRect((best.x0 + best.x1) / 2 - w / 2, (best.y0 + best.y1) / 2 - h / 2, w, h);
    },
    pinRect: (id) => mapPage.pinRect(id),
    firstDest: () => (DESTINATIONS.find((d) => d.stage <= economy.stage.level) ?? DESTINATIONS[0]).id,
  };
  const tutorial = new Tutorial({ guide, env: guideEnv, getState: () => life.state, getStats: () => life.stats(), economy, toast });
  // 目標カードをタップ：達成済みなら報酬、まだなら進め方を案内する
  life.onGoalTap = (g) => tutorial.guideGoal(g);
  // 案内の判定に使う数（4回/秒だけ計算する）
  let guideCtx = null;
  let guideCtxAt = 0;
  const guideState = (time) => {
    if (!guideCtx || time - guideCtxAt > 0.25) {
      guideCtx = { ...life.stats(), mode, mapOpen: mapPage.isOpen, sheet: gameSheet.view ?? null };
      guideCtxAt = time;
    }
    return guideCtx;
  };
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
  const fishingScene = new FishingScene($('fishing-scene')); // 漁法と合同調査の採取の再現（全画面）
  const allianceView = new AllianceView({
    mailbox: life.mail, scene: fishingScene,
    api: allianceApi, online, economy, expeditions, toast,
    onVisit: (id, name) => visitAquarium(id, name),
    onChanged: () => mapPage.refresh(),
  });
  const expeditionView = new ExpeditionView({ economy, expeditions, toast, previews, getHome: () => home, getDiscount: () => researchBonus(life.backyard.level('field')), getCapacity: () => life.backyard.capacity, fishing: fishingScene, items, wallet, onChange: () => gameSheet.view === 'expedition' && gameSheet.render() });
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
        if (!economy.canAfford(cost)) return toast(`移転には ${cost.toLocaleString('ja-JP')}コインが必要です`, { error: true });
        if (!(await askConfirm({ title: '水族館の立地を移転', text: `費用 ${cost.toLocaleString('ja-JP')}コイン\n航海中の調査隊の残り時間も、新しい距離に合わせて変わります。`, ok: '移転する' }))) return;
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
    // 館内レイアウト編集から開いたときは、水槽内の編集を終えたら館内レイアウト編集へ戻る
    onInterior: (tank) => enterInteriorEdit(tank, mode === 'hall-edit' ? 'hall' : 'tank'),
    lookHtml: (tank) => customizer.lookHtml(tank),
    onShare: (tank) => shareTank(tank),
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
  const mailView = new MailView({ mailbox: life.mail, manager, expeditions, economy, ops, cleanView, careView: life.panels.care.view, allianceView, previews, toast, breeding: life.backyard.breeding });
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
      gacha: { title: '卵ガチャ', live: true, view: new GachaView({ gacha, wallet, items, purchases, toast, onChange: () => gameSheet.view === 'gacha' && gameSheet.render() }) },
      store: { title: 'ショップ', live: true, view: new StoreView({ wallet, items, daily, purchases, builder, toast, onChange: () => gameSheet.view && gameSheet.render() }) },
      mail: { title: 'メール', live: true, view: mailView },
      pool: { title: 'イルカプール', view: new PoolView({ pool, expeditions, previews, toast }) },
      diner: { title: '食堂', view: new DinerView({ expeditions, economy, previews, isOpen: () => unlocked.has('diner') }) },
      seapen: {
        title: '屋外生け簀',
        view: new SeaPenView({
          pen: seaPen, economy, expeditions, previews, toast, builder,
          onLook: () => {
            gameSheet.close();
            mapPage.close();
            if (mode !== 'home') goHome();
            // 1階の表示に切り替え（階の表示も合わせる）、切り替えのカメラ移動を止めて生け簀を映す
            views.goFloor(0);
            views.tween = null;
            cameraCtl.frameBounds(penScene.bounds());
          },
        }),
      },
      zones: {
        title: '館内エリア',
        view: new ZoneView({
          economy, getUnlocked: () => unlocked, onUnlock: (id) => builder.orderZone(id), builder,
          getLook: (id) => ({ floor: roomSettings.floor.color, wall: roomSettings.wall.color, ceiling: roomSettings.ceiling.color, ...roomSettings.zoneLook?.[id] }),
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
    creatureView: new CreatureView({ manager, expeditions, previews, toast, economy, onChanged: () => shell.update(), hasCafe: () => unlocked.has('diner') }),
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
  for (const [btn, id, ic] of [['side-mail', 'mail', 'mail'], ['side-clean', 'clean', 'clean'], ['side-care', 'care', 'care'], ['side-gacha', 'gacha', 'egg'], ['side-zukan', 'zukan', 'zukan'], ['side-staff', 'staff', 'staff']]) {
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
    inventory.collect();
    construction.tick(); // 終わった工事を完了させる（閉じている間に終わった分も）
    daily.tick();
    $('nav-map').classList.toggle('has-badge', expeditions.trips.some((t) => expeditions.isDone(t)));
    mapPage.refresh();
    for (const t of finishCleaning(manager.tanks)) {
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
    for (const t of manager.exhibits) for (const [id, n] of Object.entries(t.userData.creatures ?? {})) shownBy[id] = (shownBy[id] ?? 0) + n;
    const growable = CREATURES.filter((c) => expeditions.canLevelUp(c.id, shownBy[c.id] ?? 0)).length;
    const eggs = gacha.ready().length; // かえった卵
    $('gacha-badge').hidden = !eggs;
    $('gacha-badge').textContent = eggs;
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
    setSwayTime(clock.elapsedTime); // ソフトコーラル・海藻の揺れ
    manager.updateLife(clock.elapsedTime);
    updateCaustics(clock.elapsedTime, sceneMgr.renderer, manager.tanks, sceneMgr.camera);
    penScene.update(clock.elapsedTime);
    pool.update(clock.elapsedTime);
    scenery.update(clock.elapsedTime);
    interior.update();
    economy.update(dt, manager.totalAppeal() * (visiting ? 1 : ops.visitorMult * allyBonus() * life.visitorMult));
    views.update(dt);
    room.updateCeiling(sceneMgr.camera.position.y);
    room.updateCut(sceneMgr.camera.position.distanceTo(cameraCtl.controls.target), dt);
    room.updateOcclusion(sceneMgr.camera.position, cameraCtl.controls.target, dt);
    life.crowd.setVisible(showVisitors && views.mode === 'floor' && mode !== 'interior-edit' && mode !== 'tank' && !mapPage.isOpen);
    if (!visiting && splashDone) tutorial.check();
    if (guide.active) guide.update(guideState(time), !visiting && splashDone);
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
  let creatureResetDone = false; // β版の生物データのリセットを行った（すぐクラウドへ保存する）
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
        if (use && applySnapshot(use)) {
          creatureResetDone = true;
          life.mail.add({ key: `reset:creature${CREATURE_RESET}`, kind: 'room', title: '生き物のデータをリセットしました', body: 'β版の仕様変更（レア度・成長の見直し）にともない、捕まえた生き物・図鑑・成長と合同調査の記録をリセットしました。水族館のレイアウト・資金・同盟はそのまま残っています。' });
        } else if (!use) startNewAquarium(pendingLayout ?? DEFAULT_LAYOUT);
        lastSavedAt = use?.savedAt ?? null;
      },
    });
    autoSave.start();
    if (layoutChosen || restored || creatureResetDone || saveAfterLoad) autoSave.saveNow().catch((err) => console.warn(err.message));
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
  // ダイヤ：有償の残高と権利を読み、閉じている間の1日の評価・今日のログインボーナスを渡す
  await purchases.load();
  dailyReady = true;
  daily.catchUp();
  daily.tick();
  // 前回から追加された魚種・採取地を知らせる（他人の水族館を見ているときは出さない）
  if (!visiting) showNewSpecies({ previews, uid: online.user?.id, onOpenMap: () => mapPage.open() }).catch((err) => console.warn(err));
}

boot().catch((err) => {
  console.error(err);
  const label = document.getElementById('splash-label');
  if (label) label.textContent = `起動に失敗しました: ${err.message}`;
});
