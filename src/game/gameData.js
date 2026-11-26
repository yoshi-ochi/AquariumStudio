// イベントと目標の定義（データのみ）

export const EVENTS = [
  { id: 'feeding', name: '餌やりショー', text: '飼育員の解説つきで餌やりを公開します', cost: 20000, minutes: 10, mult: 1.3, need: (s) => (s.creatures < 3 ? '展示中の生き物が3匹必要です' : '') },
  { id: 'kids', name: '親子ふれあい体験', text: '子ども向けの体験教室を開きます', cost: 50000, minutes: 20, mult: 1.4, need: (s) => (s.guides < 2 ? '案内スタッフが2人必要です' : '') },
  { id: 'night', name: '夜の水族館', text: '照明を落とした幻想的な夜間営業です', cost: 100000, minutes: 30, mult: 1.6, need: (s) => (s.tanks < 3 ? '水槽が3基必要です' : '') },
  { id: 'special', name: '特別展', text: '集めた生き物を一堂に紹介する大型企画です', cost: 500000, minutes: 60, mult: 2, need: (s) => (s.species < 15 ? '図鑑に15種の発見が必要です' : '') },
];

/** 目標の章（順に進む）。第1章は遊び方を覚える目標、第2章からは中盤以降の目標 */
export const CHAPTERS = ['はじめての水族館', '地域の人気館へ', 'テーマのある展示', '大型総合水族館', '世界的な水族館'];

/**
 * 順番に達成していく目標。done(s) が true になると報酬を受け取れる。chapter は CHAPTERS の番号（1〜）。
 * progress(s) があれば [今, 目標] を表示する。s は LifeSystems.stats()
 */
const at = (n) => (s) => [Math.min(s, n), n];
export const GOALS = [
  // 第1章 はじめての水族館
  { id: 'tank2', chapter: 1, text: '水槽を2基にする（アイテム→取引先）', reward: 10000, done: (s) => s.tanks >= 2 },
  { id: 'catch', chapter: 1, text: '地図から採取遠征に出かけて、生き物を受け取る', reward: 5000, done: (s) => s.species >= 1 },
  { id: 'show', chapter: 1, text: '生き物を水槽に展示する（アイテム→生物）', reward: 8000, done: (s) => s.creatures >= 1 },
  { id: 'feed', chapter: 1, text: '飼育画面で生き物にエサをあげる', reward: 5000, done: (s) => s.flags.fed },
  { id: 'home', chapter: 1, text: '地図で水族館の立地を設定する', reward: 5000, done: (s) => s.hasHome },
  { id: 'shop', chapter: 1, text: '館内エリアで売店を開く', reward: 20000, done: (s) => s.shops >= 1 },
  { id: 'event', chapter: 1, text: 'イベントを開催する（その他→イベント）', reward: 30000, done: (s) => s.flags.event },
  { id: 'zukan10', chapter: 1, text: '図鑑で10種を発見する', reward: 100000, done: (s) => s.species >= 10, progress: (s) => at(10)(s.species) },
  // 第2章 地域の人気館へ：水槽を増やし、レイアウトと採取地の制覇を覚える
  { id: 'c2_tank5', chapter: 2, text: '水槽を5基にする', reward: 50000, done: (s) => s.tanks >= 5, progress: (s) => at(5)(s.tanks) },
  { id: 'c2_layout', chapter: 2, text: '水槽内に岩・サンゴ・海藻などを5個以上置いた水槽を作る（水槽→水槽内レイアウトを編集）', reward: 60000, done: (s) => s.layoutTanks >= 1 },
  { id: 'c2_embed', chapter: 2, text: '水槽を壁に埋め込む（館内レイアウト編集で水槽を選んで「壁への埋め込み」）', reward: 50000, done: (s) => s.embedded >= 1 },
  { id: 'c2_zukan25', chapter: 2, text: '図鑑で25種を発見する', reward: 200000, done: (s) => s.species >= 25, progress: (s) => at(25)(s.species) },
  { id: 'c2_place', chapter: 2, text: '1つの採取地で捕れる生き物を全種発見する（図鑑の「地域別」で採取地ごとの発見状況が分かります）', reward: 300000, done: (s) => s.placesDone >= 1 },
  { id: 'c2_share', chapter: 2, text: '自慢の水槽を共有する（水槽→この水槽を共有）', reward: 30000, done: (s) => s.flags.shared },
  // 第3章 テーマのある展示：同じ海の生き物を集めた水槽、レアな生き物、成長
  { id: 'c3_theme', chapter: 3, text: 'テーマ水槽を作る（同じ採取地で捕れる生き物だけを3種以上展示）', reward: 200000, done: (s) => s.themeTanks >= 1 },
  { id: 'c3_rare', chapter: 3, text: 'レア度の最も高い（★4）生き物を展示する', reward: 300000, done: (s) => s.rareShown >= 1 },
  { id: 'c3_grow', chapter: 3, text: '生き物を育てて、1種を★2にする（図鑑の「育成」で育てられます）', reward: 300000, done: (s) => s.maxStars >= 2, progress: (s) => at(2)(s.maxStars) },
  { id: 'c3_events', chapter: 3, text: 'イベントを通算5回開催する', reward: 300000, done: (s) => s.events >= 5, progress: (s) => at(5)(s.events) },
  { id: 'c3_zukan50', chapter: 3, text: '図鑑で50種を発見する', reward: 800000, done: (s) => s.species >= 50, progress: (s) => at(50)(s.species) },
  { id: 'c3_stage2', chapter: 3, text: '水族館を「地域の人気水族館」に昇格させる', reward: 1000000, done: (s) => s.stage >= 2 },
  // 第4章 大型総合水族館
  { id: 'c4_places3', chapter: 4, text: '3つの採取地で、捕れる生き物を全種発見する', reward: 1500000, done: (s) => s.placesDone >= 3, progress: (s) => at(3)(s.placesDone) },
  { id: 'c4_theme3', chapter: 4, text: 'テーマ水槽を3つ作る', reward: 1500000, done: (s) => s.themeTanks >= 3, progress: (s) => at(3)(s.themeTanks) },
  { id: 'c4_tank12', chapter: 4, text: '水槽を12基にする', reward: 1000000, done: (s) => s.tanks >= 12, progress: (s) => at(12)(s.tanks) },
  { id: 'c4_grow', chapter: 4, text: '1種を★4まで育てる', reward: 2000000, done: (s) => s.maxStars >= 4, progress: (s) => at(4)(s.maxStars) },
  { id: 'c4_zukan80', chapter: 4, text: '図鑑で80種を発見する', reward: 3000000, done: (s) => s.species >= 80, progress: (s) => at(80)(s.species) },
  { id: 'c4_stage3', chapter: 4, text: '水族館を「大型総合水族館」に昇格させる', reward: 4000000, done: (s) => s.stage >= 3 },
  // 第5章 世界的な水族館
  { id: 'c5_places8', chapter: 5, text: '8つの採取地で、捕れる生き物を全種発見する', reward: 6000000, done: (s) => s.placesDone >= 8, progress: (s) => at(8)(s.placesDone) },
  { id: 'c5_rare5', chapter: 5, text: '★4の生き物を5種展示する', reward: 6000000, done: (s) => s.rareShown >= 5, progress: (s) => at(5)(s.rareShown) },
  { id: 'c5_theme6', chapter: 5, text: 'テーマ水槽を6つ作る', reward: 6000000, done: (s) => s.themeTanks >= 6, progress: (s) => at(6)(s.themeTanks) },
  { id: 'c5_grow', chapter: 5, text: '1種を★6（最大）まで育てる', reward: 8000000, done: (s) => s.maxStars >= 6, progress: (s) => at(6)(s.maxStars) },
  { id: 'c5_zukan120', chapter: 5, text: '図鑑で120種を発見する', reward: 10000000, done: (s) => s.species >= 120, progress: (s) => at(120)(s.species) },
  { id: 'c5_stage4', chapter: 5, text: '水族館を「世界的な水族館」に昇格させる', reward: 15000000, done: (s) => s.stage >= 4 },
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
