/**
 * 操作の案内の手順（guide.js で使う）。チュートリアルと、目標カードをタップしたときの「進め方」。
 * env：main.js から渡す画面の情報
 *   tankRect()   館内の水槽（画面に映っているもの）の画面上の位置
 *   pinRect(id)  地図の採取地のピンの位置
 *   firstDest()  今行ける採取地の id
 * done(c) の c：LifeSystems.stats() ＋ { mode, mapOpen, sheet }（sheet はいま開いている画面の名前）
 */
const visible = (...sels) => () => {
  for (const s of sels) {
    const el = document.querySelector(s);
    if (el && (el.offsetParent !== null || getComputedStyle(el).position === 'fixed')) return el;
  }
  return null;
};

// ---- よく使う流れ ----
const closeMap = { text: '下の「水族館」をタップして、館内へ戻りましょう。', target: '#nav-map', done: (c) => !c.mapOpen };
const closeSheet = { text: '右上の ✕ で画面を閉じましょう。', target: '#game-sheet [data-act="close"]', done: (c) => !c.sheet };
const toHome = [closeMap, closeSheet];
const openMap = { text: '下の「地図」をタップして、採取地の地図を開きましょう。', target: '#nav-map', done: (c) => c.mapOpen };
// 地図のピンは絵なので、行き先の画面が開いたら次へ（タップの位置では進めない）
const pickDest = (env) => ({ text: 'オレンジ色のピン（採取地）をタップしましょう。', target: () => env.pinRect(env.firstDest()), wait: '地図を開いてください。', tap: false, done: (c) => c.sheet === 'expedition' });
const depart = { text: '漁法を選んで「出港」をタップ。調査隊が生き物を採りに出かけます。', target: 'button[data-act="depart"]:not([disabled])', wait: '採取地を選ぶと「出港」が出ます（資金が足りないと押せません）。', done: (c) => c.trips > 0 };
const ITEM_TABS = ['stock', 'creatures', 'supplier', 'outsource'];
const openItems = (tab, label) => [
  { text: '下の「アイテム」をタップしましょう。', target: '#nav-items', done: (c) => ITEM_TABS.includes(c.sheet) },
  { text: `「${label}」のタブをタップ。`, target: `button[data-act="tab"][data-id="${tab}"]`, wait: '「アイテム」を開いてください。', done: (c) => c.sheet === tab },
];
const tapTank = (env) => ({ text: '館内の水槽をタップしましょう。', target: () => env.tankRect(), wait: '館内に戻って、水槽が見える所まで画面を動かしてください。', done: (c) => c.mode === 'tank' });
const editTank = { text: '上の ✎ をタップ。水槽の編集（生物・飼育・見た目・水槽内レイアウト）が開きます。', target: '#btn-edit', done: (c) => c.sheet === 'tank' };
const showCreature = [
  ...openItems('creatures', '生物'),
  { text: '展示したい生き物をタップ。', target: 'button[data-act="cg-pick"]', wait: 'まだ生き物を持っていません。採取に出かけましょう。' },
  { text: '「水槽に展示」をタップ。', target: 'button[data-act="pick"]:not([disabled])' },
  { text: '展示する水槽を選んでタップ。', target: 'button[data-act="show"]:not([disabled])', done: (c) => c.creatures > 0 },
];
const buyTank = [
  ...toHome,
  ...openItems('supplier', '取引先'),
  { text: '置きたい水槽の「購入」をタップ（すぐ届きます）。', target: 'button[data-act="buy"]:not([disabled])', wait: '資金が足りません。来館者が増えるのを待ちましょう。' },
  { text: '「所持品」のタブをタップ。', target: 'button[data-act="tab"][data-id="stock"]' },
  { text: '「設置」をタップ。', target: 'button[data-act="place"]' },
  { text: '水槽を置きたい床をタップして設置します。終わったら右上の「完了」。', target: '#btn-done', tap: false, free: true, done: (c) => c.mode !== 'hall-edit' },
];
const openZukan = (mode, label) => [
  ...toHome,
  { text: '左の「図鑑」をタップしましょう。', target: '#side-zukan' },
  { text: `「${label}」をタップ。`, target: `button[data-act="zk-mode"][data-id="${mode}"]` },
];
const openMenu = [{ text: '左上のアイコンをタップして、メニューを開きましょう。', target: '#hud-account' }];

/** はじめての人向けのチュートリアル */
export function tutorialSteps(env) {
  return [
    { title: 'ようこそ、館長！', text: 'あなたの水族館がオープンしました。生き物を集めて展示し、来館者でにぎわう水族館に育てましょう。指のマークの所をタップして、実際に操作してみましょう。', next: 'はじめる' },
    { title: '採取に出かける', ...openMap },
    { title: '採取地を選ぶ', ...pickDest(env), text: 'オレンジ色のピン（採取地）をタップしましょう。最初は近くの採取地がおすすめです。' },
    { title: '出港する', ...depart },
    { title: '調査隊の帰りを待つ', text: '調査隊が戻りました。「受け取る」をタップして、採った生き物を受け取りましょう。', target: visible('button[data-act="claim"]', '#side-mail'), wait: '調査隊が採取しています（はじめての遠征は20秒ほど）。そのまま待ちましょう。', done: (c) => c.species > 0 },
    { title: '館内へ戻る', ...closeMap },
    { title: '生き物を展示する', ...showCreature[0] },
    ...showCreature.slice(1).map((s) => ({ title: '生き物を展示する', ...s })),
    { title: '画面を閉じる', ...closeSheet },
    { title: '水槽を見る', ...tapTank(env) },
    { title: '水槽の編集画面', text: '水槽をタップすると、この編集画面が開きます。✕で閉じても、上の ✎ でいつでも開き直せます。🔗 で水槽を共有できます。', target: '#btn-edit', next: '次へ' },
    { title: '水槽の中をレイアウト', text: '「水槽内レイアウトを編集」をタップ。水槽の中に入って、岩やサンゴ、海藻を置けます。', target: 'button[data-act="tank-interior"]', done: (c) => c.mode === 'interior-edit' },
    { title: '岩を置いてみる', text: '下のカタログから岩などを選び、水槽の中をタップして置きましょう。終わったら右上の「完了」。', target: '#btn-done', tap: false, free: true, done: (c) => c.mode !== 'interior-edit' },
    { title: '来館者と資金', text: '展示が充実するほど来館者が増え、資金がたまります。資金で水槽を増やしたり、水族館を拡張しましょう。', target: '.hud-stat.money', next: '次へ' },
    { title: '目標に挑戦', text: '左上の目標カードをタップすると、達成のしかたを同じように案内します。', target: '#goal-card', next: 'はじめる' },
  ];
}

/** 目標カードをタップしたときの進め方（無ければ説明だけ） */
export function goalSteps(goal, env) {
  const id = goal.id;
  const tell = (text) => [{ text, next: 'わかった' }];
  const catchMore = [...toHome.slice(1), openMap, pickDest(env), depart];
  const grow = [...openZukan('grow', '育成'), { text: '育てたい生き物をタップして、図鑑の中の「育てる」で育てます（同じ生き物を使います）。', target: 'button[data-act="zk-pick"]', next: 'わかった' }];
  const stage = [...toHome, ...openMenu, { text: '「拡張」をタップすると、次のステージに昇格します（資金が必要です）。', target: '#btn-upgrade', wait: 'メニューを開いてください。' }];
  const areas = [...openZukan('area', '地域別'), { text: '採取地ごとに、発見した数が分かります。全種そろうまで、同じ採取地に何度か出かけましょう。', next: 'わかった' }];
  const theme = [{ text: 'テーマ水槽は、同じ採取地で捕れる生き物だけを3種以上展示した水槽です。図鑑の「地域別」で同じ海の生き物を確かめて、1つの水槽にまとめましょう。', next: '図鑑を見る' }, ...areas];
  const table = {
    tank2: buyTank, c2_tank5: buyTank, c4_tank12: buyTank,
    catch: catchMore, zukan10: catchMore, c2_zukan25: catchMore, c3_zukan50: catchMore, c4_zukan80: catchMore, c5_zukan120: catchMore,
    show: [...toHome, ...showCreature],
    feed: [...toHome, { text: '左の「飼育」をタップしましょう。', target: '#side-care' }, { text: '「エサをあげる」をタップ。', target: 'button[data-act="care-feed"]:not([disabled])', done: (c) => c.flags.fed }],
    home: [...toHome.slice(1), openMap, { text: '「立地を設定」をタップしてから、地図で水族館を建てる場所をタップします。', target: '[data-map="home"]', done: (c) => c.hasHome }],
    shop: [...toHome, ...openMenu, { text: '「館内エリア」をタップして、売店のエリアを開きましょう。', target: '#btn-zones', wait: 'メニューを開いてください。' }],
    event: [...toHome, { text: '下の「イベント」をタップしましょう。', target: '#nav-event' }, { text: '開きたいイベントの「開催」をタップ。', target: 'button[data-act="event-start"]:not([disabled])', done: (c) => c.flags.event }],
    c3_events: [...toHome, { text: '下の「イベント」をタップしましょう。', target: '#nav-event' }, { text: '開きたいイベントの「開催」をタップ。', target: 'button[data-act="event-start"]:not([disabled])' }],
    c2_layout: [...toHome, tapTank(env), editTank, { text: '「水槽内レイアウトを編集」をタップ。下のカタログから岩・サンゴ・海藻を選んで、5個以上置きましょう。', target: 'button[data-act="tank-interior"]', done: (c) => c.mode === 'interior-edit' }],
    c2_embed: [...toHome, { text: '右上の ✎ をタップして、館内レイアウト編集を開きます。', target: '#btn-edit', done: (c) => c.mode === 'hall-edit' }, { text: '編集する部屋をタップし、壁際の水槽を選んで「近くの壁に埋め込む」をタップします。', target: '[data-action="embed"]', wait: '部屋をタップしてから、壁際にある水槽をタップしてください（壁から離れていれば、壁際へドラッグします）。', done: (c) => c.embedded > 0 }],
    c2_place: areas, c4_places3: areas, c5_places8: areas,
    c2_share: [...toHome, tapTank(env), { text: '上の 🔗 をタップして、LINE やインスタで送りましょう。', target: '#btn-share', done: (c) => c.flags.shared }],
    c3_theme: theme, c4_theme3: theme, c5_theme6: theme,
    c3_rare: tell('レア度★4の生き物は、ステージの高い採取地で捕れることが多いです。地図で行き先を選ぶと、捕れる生き物が見られます。'),
    c5_rare5: tell('★4の生き物を5種、水槽に展示しましょう。遠い採取地や合同調査でも捕れます。'),
    c3_grow: grow, c4_grow: grow, c5_grow: grow,
    c3_stage2: stage, c4_stage3: stage, c5_stage4: stage,
  };
  return table[id] ?? tell(goal.text);
}
