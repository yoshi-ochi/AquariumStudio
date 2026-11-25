// イベントと目標の定義（データのみ）

export const EVENTS = [
  { id: 'feeding', name: '餌やりショー', text: '飼育員の解説つきで餌やりを公開します', cost: 20000, minutes: 10, mult: 1.3, need: (s) => (s.creatures < 3 ? '展示中の生き物が3匹必要です' : '') },
  { id: 'kids', name: '親子ふれあい体験', text: '子ども向けの体験教室を開きます', cost: 50000, minutes: 20, mult: 1.4, need: (s) => (s.guides < 2 ? '案内スタッフが2人必要です' : '') },
  { id: 'night', name: '夜の水族館', text: '照明を落とした幻想的な夜間営業です', cost: 100000, minutes: 30, mult: 1.6, need: (s) => (s.tanks < 3 ? '水槽が3基必要です' : '') },
  { id: 'special', name: '特別展', text: '集めた生き物を一堂に紹介する大型企画です', cost: 500000, minutes: 60, mult: 2, need: (s) => (s.species < 15 ? '図鑑に15種の発見が必要です' : '') },
];

/** 順番に達成していく目標。done(s) が true になると報酬を受け取れる */
export const GOALS = [
  { id: 'tank2', text: '水槽を2基にする（アイテム→取引先）', reward: 10000, done: (s) => s.tanks >= 2 },
  { id: 'catch', text: '地図から採取遠征に出かけて、生き物を受け取る', reward: 5000, done: (s) => s.species >= 1 },
  { id: 'show', text: '生き物を水槽に展示する（アイテム→生物）', reward: 8000, done: (s) => s.creatures >= 1 },
  { id: 'feed', text: '飼育画面で生き物にエサをあげる', reward: 5000, done: (s) => s.flags.fed },
  { id: 'home', text: '地図で水族館の立地を設定する', reward: 5000, done: (s) => s.hasHome },
  { id: 'shop', text: '館内エリアで売店を開く', reward: 20000, done: (s) => s.shops >= 1 },
  { id: 'event', text: 'イベントを開催する（その他→イベント）', reward: 30000, done: (s) => s.flags.event },
  { id: 'zukan10', text: '図鑑で10種を発見する', reward: 100000, done: (s) => s.species >= 10 },
];

/** 閉じている間の収入の上限と、営業中に対する割合 */
export const OFFLINE_MAX_HOURS = 8;
export const OFFLINE_RATE = 0.5;

/**
 * 月替わりの特集イベント（1月〜12月）。featured の生き物を集めて展示するほど来館者が増える。
 * 採取地の違う種を混ぜ、はじめたばかりでも何種かは手に入るようにしている。
 */
export const MONTHLY = [
  { name: '冬の深海特集', text: '寒い季節においしくなる深海の生き物を集めよう', featured: ['madara', 'ankou', 'kinmedai', 'mendako', 'zuwai', 'kasago'] },
  { name: '流氷の海', text: 'オホーツクの流氷の下で暮らす生き物を紹介', featured: ['clione', 'fuusen', 'kegani', 'hokke', 'ookamiuo', 'taraba'] },
  { name: '春の磯あそび', text: '潮だまりで出会える身近な生き物たち', featured: ['kasago', 'kawahagi', 'madako', 'hakofugu', 'tatsu'] },
  { name: 'サクラ色の海', text: '桜の季節にちなんだ、桜色の生き物を集めよう', featured: ['madai', 'kingyohana', 'sakuraebi', 'hanamino', 'akahata', 'kouika'] },
  { name: 'こどもの日 サンゴ礁', text: '子どもたちに人気のカラフルな熱帯魚', featured: ['kakure', 'nanyouhagi', 'kiirohagi', 'rurisuzume', 'nishikianago'] },
  { name: '梅雨のクラゲ展', text: 'ふわふわ漂うクラゲで館内を涼しく', featured: ['mizukurage', 'akakurage', 'takokurage', 'bluejelly', 'seanettle'] },
  { name: '夏の回遊魚', text: '外洋を泳ぎ回るスピードスターたち', featured: ['katsuo', 'buri', 'maaji', 'tobiuo', 'kuromaguro', 'shiira'] },
  { name: 'サメ・エイ特集', text: '夏休みの主役、サメとエイが大集合', featured: ['nekozame', 'akaei', 'shirowani', 'hammer', 'itachizame', 'manta'] },
  { name: 'お月見 夜の海', text: '夜に活動する生き物と、光る深海魚', featured: ['chochin', 'hanamino', 'utsubo', 'madako', 'mendako', 'kinmedai'] },
  { name: 'ハロウィン ふしぎな生き物', text: 'トゲや毒、変わった姿の生き物たち', featured: ['oniokoze', 'harisenbon', 'hakofugu', 'utsubo', 'mongara', 'kabutogani'] },
  { name: '秋の味覚の海', text: '旬をむかえた秋の魚を展示しよう', featured: ['sanma', 'sake', 'maiwashi', 'katsuo', 'madai', 'surume'] },
  { name: 'クリスマス 赤と白の海', text: '赤と白の生き物で館内をクリスマスに', featured: ['kakure', 'hanamino', 'iseebi', 'shiroiruka', 'akahata', 'kinmedai'] },
];

/**
 * 毎月共通のミッション。reward は「Lv1の水族館」での金額（規模に合わせて増える）。
 * kind: show 特集種を何種展示 / catch 特集種を今月何匹採取 / event 館内イベントを何回開催 / all 特集種をすべて展示
 */
export const MONTHLY_MISSIONS = [
  { id: 'show3', kind: 'show', n: 3, text: '特集の生き物を3種展示する', reward: 60000 },
  { id: 'catch20', kind: 'catch', n: 20, text: '特集の生き物を今月20匹採取する', reward: 80000 },
  { id: 'event3', kind: 'event', n: 3, text: '館内イベントを今月3回開催する', reward: 50000 },
  { id: 'all', kind: 'all', text: '特集の生き物をすべて展示する', reward: 300000, badge: true },
];

/** 特集の生き物1種の展示ごとの来館者ボーナスと上限 */
export const MONTHLY_BONUS = { per: 0.05, max: 0.3 };
