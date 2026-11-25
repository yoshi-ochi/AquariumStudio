/**
 * 魚種ごとの行動（泳ぐ速さ・緩急・居場所・特殊な行動）。lifeMotion.js が水槽内の動きに使う。
 *
 * cruise は巡航速度（体長/秒）。水槽で縮めた体長に掛けるので、見た目の速さの比が保たれる。
 *   マグロ類：カツオの巡航は約1.4〜2 体長/秒、大型のクロマグロは0.7〜1.8 体長/秒（尾びれ1回/秒未満が大半）
 *   バショウカジキ：捕食時の突進は約7 m/秒・最大でも10 m/秒程度（体長の約5〜6倍/秒）。ふだんはゆっくり
 *   ジンベエザメ：1日15〜47 km の移動（平均0.2〜0.5 m/秒）。体長比ではきわめて遅い
 *   ニシオンデンザメ：平均約0.3 m/秒。魚類でもっとも遅い部類
 *   タツノオトシゴ：背びれを高速で振るが、魚類で最も遅い（小型種で1時間に1.5 m）。尾で海藻に巻き付いて流されないようにする
 * kick は「バースト＆コースト（ひと蹴りして惰性で滑る）」の強さ（0〜1）。マダラ・メジナなど多くの魚が低速でこの泳ぎ方をし、
 *   1回の蹴りと滑走は0.2〜0.4秒の範囲に収め、速さは蹴りと滑走の比で調整する（Li ら 2021）。
 * burst は突進時の速さの倍率、every は突進の平均間隔（秒）。
 *
 * mode（動き方）
 *   cruise  外洋性：水槽を大きく周回し続ける（止まると呼吸できないラム換水の魚を含む）
 *   wander  目標地点へ泳いでは止まる（サンゴ礁・沿岸の魚）。home は縄張り・隠れ家からの行動範囲の広さ
 *   rest    底で待ち伏せ・休む。ときどき場所を変える（カサゴ・ヒラメ・ネコザメ・エイ）。bury は砂に潜る深さ
 *   crevice 岩のすき間から頭だけ出す（ウツボ・タコ・イセエビ・オオカミウオ）。ときどき出て歩き回り、戻る
 *   burrow  砂の巣穴から体を出し、驚くと一斉に引っ込む（チンアナゴ・ヤシャハゼ）
 *   cling   尾で海藻・サンゴに巻き付いて揺れ、ときどき立ち泳ぎで別の場所へ移る（タツノオトシゴ）
 *   pulse   傘の拍動で浮き沈みしながら漂う（クラゲ・クリオネ・メンダコ）
 *   vertical 頭を上（または下）に向けて静止する（リュウグウノツカイ・タチウオ・ヘラヤガラ）
 *   walk    海底を歩いては止まる（カニは横歩き）
 *   host    宿主（イソギンチャク代わりの柔らかいサンゴ）の上で定位し、飛び出しては戻る（クマノミ）。range は宿主から離れる
 *           最大距離（体長の倍数）、nestle は触手に潜り込む割合
 * layer は泳ぐ高さの範囲（水底0〜水面1）。events は周回中に起こす特別な行動
 * 生き物どうし（lifeSocial.js）
 *   hunt    狩りの平均間隔（秒）。自分の2.5分の1以下の別の種の群れへ突っ込む（0 は狩らない）
 *   escape  捕食者から逃げる速さ（体長/秒）。小魚の逃避の初速は体長の10倍/秒を超える（標準8）
 *   pair    つがいで並んで泳ぐ。gap は並ぶ間隔（体長の倍数）
 *   leapH   跳躍の高さ（体長の倍数）
 *   breathe 水面へ呼吸に上がる（イルカ・ウミガメ・ピラルク・デンキウナギ）
 *   bask    水面で横倒しになって日光浴（マンボウ）
 *   loop    後方宙返りで採餌（マンタ）
 *   stand   水面近くで立ち上がって吸い込み採餌（ジンベエザメ）
 *   spin    水面で体をきりもみ回転（ハシナガイルカ）
 *   sleep   海底に降りて休む（ウミガメ）
 *   peck    底をつつく（カワハギ・ブダイ・チョウチョウウオ）
 *   leap    水面から跳び出す（イルカ・マンタ・シイラ・マグロ・サケ・アロワナ）。群れの魚も1匹ずつ跳ぶ
 *   glide   水面から飛び出して滑空する（トビウオ）。捕食者に追われたときも飛ぶ
 */
const B = (mode, cruise, o = {}) => ({ mode, cruise, kick: 0, burst: 1, every: 0, layer: [0.25, 0.75], home: 1, ...o });

/** 体形ごとの標準の行動 */
const FORM_BEH = {
  perch: B('wander', 0.8, { kick: 0.5, burst: 2.5, every: 40 }),
  grouper: B('rest', 0.4, { burst: 3, every: 90, rest: [15, 45] }),
  cod: B('wander', 0.5, { kick: 0.7, layer: [0.05, 0.4] }),
  lump: B('rest', 0.3, { rest: [30, 90] }),
  clown: B('wander', 1.0, { home: 0.25, layer: [0.1, 0.5], pause: 0.5 }),
  tang: B('wander', 1.0, { burst: 2, every: 50 }),
  disc: B('wander', 0.7, { pause: 0.4, events: ['peck'] }),
  moorish: B('wander', 0.6, { pause: 0.4 }),
  bat: B('wander', 0.5, { pause: 0.2 }),
  hump: B('wander', 0.6, { events: ['peck'] }),
  box: B('wander', 0.5, { pause: 0.5 }),
  barreleye: B('wander', 0.15, { pause: 0.8 }),
  tuna: B('cruise', 1.5, { burst: 2.5, every: 30, school: true }),
  needle: B('cruise', 1.5, { burst: 3, every: 25, school: true, layer: [0.6, 0.95] }),
  dolphin: B('cruise', 1.5, { burst: 4, every: 30, layer: [0.6, 0.95] }),
  lancet: B('cruise', 0.4, { layer: [0.3, 0.7] }),
  eel: B('crevice', 0.5),
  ribbon: B('vertical', 0.15),
  mola: B('cruise', 0.4, { layer: [0.5, 0.9], events: ['bask'] }),
  shark: B('cruise', 0.6, { burst: 2.5, every: 60, layer: [0.2, 0.7] }),
  hammer: B('cruise', 0.7, { burst: 2.5, every: 60, layer: [0.3, 0.8], hunt: 120 }),
  coelacanth: B('wander', 0.15, { pause: 0.6, layer: [0.1, 0.5], events: ['headstand'] }),
  jelly: B('pulse', 0.05, { layer: [0.3, 0.9] }),
  dumbo: B('pulse', 0.1, { layer: [0, 0.3], sit: true }),
  clione: B('pulse', 0.15, { layer: [0.5, 0.95] }),
  crab: B('walk', 0.2, { side: true }),
  lobster: B('crevice', 0.3, { walk: true }),
  octopus: B('crevice', 0.3, { walk: true }),
  flat: B('rest', 0.5, { bury: 0.4, rest: [20, 60] }),
  seahorse: B('cling', 0.15),
  garden: B('burrow', 0),
  ray: B('rest', 0.5, { bury: 0.3, rest: [20, 60] }),
  squid: B('wander', 0.8, { burst: 4, every: 35, back: true, school: true }),
  cuttle: B('wander', 0.3, { pause: 0.5, layer: [0.05, 0.4], back: true }),
  horseshoe: B('walk', 0.15, { bury: 0.3 }),
  turtle: B('cruise', 0.3, { layer: [0.2, 0.8], events: ['breathe', 'sleep'] }),
  whale: B('cruise', 1.0, { burst: 2.5, every: 40, layer: [0.3, 0.9], events: ['breathe'] }),
};

/** 体形だけでは決まらない種 */
const ID_BEH = {
  // マグロ・カジキ・外洋の高速遊泳魚（止まらずに泳ぎ続ける）
  kuromaguro: B('cruise', 1.0, { burst: 3.5, every: 25, school: true, layer: [0.3, 0.85], hunt: 50, events: ['leap'], leapH: 0.5 }), // 群れで小魚を追い、水面で跳ねる
  atlbluefin: B('cruise', 1.0, { burst: 3.5, every: 25, school: true, layer: [0.3, 0.85], hunt: 50, events: ['leap'], leapH: 0.5 }),
  katsuo: B('cruise', 1.9, { burst: 3, every: 20, school: true, layer: [0.4, 0.9], hunt: 40, events: ['leap'], leapH: 0.6 }), // ナブラ：イワシの群れを水面へ追い上げて跳ねる
  bashou: B('cruise', 0.8, { burst: 6, every: 30, layer: [0.5, 0.95], hunt: 30, events: ['leap'], leapH: 0.6 }), // 群れで交互にイワシの群れを襲う
  shiira: B('cruise', 1.5, { burst: 4, every: 25, layer: [0.6, 0.95], hunt: 40, events: ['leap'], leapH: 0.5 }), // トビウオを追って跳ねる
  buri: B('cruise', 1.3, { burst: 3, every: 30, school: true, hunt: 50 }),
  rouninaji: B('cruise', 1.2, { burst: 4, every: 30, layer: [0.3, 0.85], hunt: 35 }),
  gingame: B('cruise', 1.0, { burst: 2.5, every: 40, school: true, tight: true, hunt: 60 }),
  sake: B('cruise', 1.0, { burst: 2.5, every: 45, events: ['leap'], leapH: 0.6 }), // 海でも水面から跳ねる
  tobiuo: B('cruise', 1.6, { burst: 4, every: 20, school: true, layer: [0.82, 0.97], events: ['glide'], escape: 10 }), // 追われると水面から飛び出して滑空する
  akamanbou: B('cruise', 0.8, { layer: [0.3, 0.8] }),
  arowana: B('cruise', 0.5, { burst: 4, every: 60, layer: [0.8, 0.97], hunt: 60, events: ['leap'], leapH: 0.8 }), // 水面上の虫を跳んで捕る
  // 群れる小魚（一斉に向きを変え、驚くと散って加速する）
  maiwashi: B('cruise', 1.5, { burst: 3, every: 20, school: true, tight: true, escape: 10 }),
  maaji: B('cruise', 1.3, { burst: 3, every: 25, school: true }),
  nishin: B('cruise', 1.4, { burst: 3, every: 25, school: true }),
  sanma: B('cruise', 1.6, { burst: 3, every: 20, school: true, layer: [0.7, 0.97] }),
  // サメ・エイ
  jinbei: B('cruise', 0.12, { layer: [0.55, 0.9], events: ['stand'] }),
  greenland: B('cruise', 0.1, { layer: [0.05, 0.4] }),
  shirowani: B('cruise', 0.25, { layer: [0.3, 0.7], hover: true }), // 空気を飲んで浮力を調整し、中層でほぼ静止する
  rabuka: B('cruise', 0.3, { layer: [0.05, 0.4] }),
  nekozame: B('rest', 0.4, { rest: [40, 120] }), // 昼は岩陰で休み、胸びれで底を歩く
  komorizame: B('rest', 0.35, { rest: [40, 120] }), // 海底で休み、えらに水を送って呼吸する
  nemuribuka: B('rest', 0.5, { rest: [30, 90] }), // 昼は洞窟の底で休む
  nokogiri: B('rest', 0.4, { rest: [30, 90] }),
  leopardshark: B('cruise', 0.6, { layer: [0.03, 0.3] }),
  oomejirozame: B('cruise', 0.5, { burst: 3, every: 60, layer: [0.1, 0.6], hunt: 80 }),
  manta: B('cruise', 0.3, { layer: [0.5, 0.9], events: ['loop', 'leap'], leapH: 0.4 }), // まれに水面から跳び出す（ブリーチ）
  nanyoumanta: B('cruise', 0.3, { layer: [0.5, 0.9], events: ['loop', 'leap'], leapH: 0.4 }),
  madaraotobi: B('cruise', 0.5, { layer: [0.15, 0.6], events: ['leap'], leapH: 0.6 }),
  // サメ（小魚を襲う）
  tsumaguro: B('cruise', 0.6, { burst: 3, every: 60, layer: [0.2, 0.7], hunt: 80 }),
  galashark: B('cruise', 0.6, { burst: 2.5, every: 60, layer: [0.2, 0.7], hunt: 90 }),
  itachizame: B('cruise', 0.6, { burst: 2.5, every: 60, layer: [0.2, 0.7], hunt: 90 }),
  suzuki: B('wander', 0.8, { kick: 0.5, burst: 3, every: 40, hunt: 60 }), // 小魚の群れを追う
  // つがいで並んで泳ぐ（チョウチョウウオ類は一夫一妻で、つがいがそろって餌をつつく）
  akebono: B('wander', 0.7, { pause: 0.4, events: ['peck'], pair: true }),
  togecho: B('wander', 0.7, { pause: 0.4, events: ['peck'], pair: true }),
  fuuraicho: B('wander', 0.7, { pause: 0.4, events: ['peck'], pair: true }),
  fueyakko: B('wander', 0.7, { pause: 0.4, events: ['peck'], pair: true }),
  tsunodashi: B('wander', 0.6, { pause: 0.4, pair: true }),
  // 底の待ち伏せ
  kasago: B('rest', 0.4, { burst: 4, every: 80, rest: [30, 90], rock: true }),
  oniokoze: B('rest', 0.3, { bury: 0.2, rest: [40, 120] }),
  ankou: B('rest', 0.2, { rest: [60, 180] }),
  chochin: B('rest', 0.15, { rest: [60, 180], float: 0.3 }),
  ainame: B('rest', 0.5, { rest: [10, 40], rock: true }),
  kurosoi: B('rest', 0.5, { rest: [15, 45], rock: true }),
  tamakai: B('rest', 0.25, { rest: [30, 90], rock: true }),
  akahata: B('rest', 0.5, { rest: [15, 40], rock: true }),
  kijihata: B('rest', 0.5, { rest: [15, 40], rock: true }),
  hatahata: B('rest', 0.6, { bury: 0.7, rest: [30, 90] }), // 昼は砂に潜って目だけ出す
  redtail: B('rest', 0.4, { rest: [40, 120] }),
  houbou: B('walk', 0.3, { ground: 0.08 }), // 胸びれの軟条で海底を歩く
  fuusen: B('rest', 0.2, { rest: [60, 180], rock: true, top: true }), // 腹の吸盤で岩に吸い付く
  hirame: B('rest', 0.6, { bury: 0.4, rest: [20, 60], burst: 4, every: 90 }),
  // 岩穴・巣穴
  utsubo: B('crevice', 0.4),
  ookamiuo: B('crevice', 0.3),
  norogenge: B('rest', 0.2, { rest: [60, 180] }),
  hanahige: B('burrow', 0, { lean: 1.25, show: 0.45 }), // 砂礫の穴から上半身を出して口を開ける
  yashahaze: B('burrow', 0, { goby: true }), // テッポウエビと巣穴を共有し、入口で見張る
  denkiunagi: B('wander', 0.3, { layer: [0.05, 0.5], events: ['breathe'] }), // 空気呼吸のため定期的に水面へ
  // 海藻・サンゴのまわり
  tatsu: B('cling', 0.15),
  // 宿主の上で胸びれを漕いで定位し、ときどき上へ飛び出して戻る。触手に潜り込んで体をこすり付ける（lifeHost.js）
  kakure: B('host', 0.6, { burst: 3, range: 4, nestle: 0.35, layer: [0.1, 0.45] }),
  kumanomi: B('host', 0.6, { burst: 3, range: 5, nestle: 0.3, layer: [0.1, 0.45] }),
  deba: B('wander', 0.9, { home: 0.2, layer: [0.1, 0.4], school: true, coral: true }), // 驚くと枝サンゴに逃げ込む
  misuji: B('wander', 0.9, { home: 0.2, layer: [0.1, 0.4], coral: true }),
  rurisuzume: B('wander', 1.0, { home: 0.3, layer: [0.1, 0.5], coral: true }),
  garibaldi: B('wander', 0.8, { home: 0.3, layer: [0.05, 0.5], rock: true }), // 巣を守る縄張り意識が強い
  kingyohana: B('wander', 0.9, { home: 0.4, layer: [0.3, 0.7], school: true, coral: true }),
  hanagoi: B('wander', 0.9, { home: 0.4, layer: [0.3, 0.7], school: true, coral: true }),
  nishikiteguri: B('wander', 0.4, { home: 0.3, layer: [0.02, 0.15], pause: 0.6, coral: true }),
  nenbutsu: B('wander', 0.6, { home: 0.4, layer: [0.3, 0.7], school: true, rock: true, pause: 0.3 }),
  gonzui: B('wander', 0.6, { layer: [0.02, 0.2], school: true, tight: true }), // 幼魚は「ゴンズイ玉」に固まる
  hanamino: B('wander', 0.2, { pause: 0.7, layer: [0.1, 0.5], rock: true }), // ひれを広げてゆっくり漂う
  kawahagi: B('wander', 0.6, { pause: 0.5, events: ['peck'] }),
  umazura: B('wander', 0.7, { pause: 0.4, school: true }),
  budai: B('wander', 0.6, { events: ['peck'] }),
  kobudai: B('wander', 0.5, { events: ['peck'], rock: true }),
  kyusen: B('wander', 0.8, { layer: [0.05, 0.5], events: ['peck'] }),
  napoleon: B('wander', 0.5, { pause: 0.3 }),
  tsubame: B('wander', 0.4, { pause: 0.3, school: true }),
  nodoguro: B('wander', 0.4, { layer: [0.05, 0.4], pause: 0.4 }),
  piranha: B('wander', 0.6, { burst: 5, every: 40, school: true, pause: 0.4, hunt: 45 }),
  // 縦の姿勢
  ryugu: B('vertical', 0.1, { pitch: 1.45 }), // 頭を上にして長い背びれを波打たせ、立ち泳ぎで静止する
  tachiuo: B('vertical', 0.3, { pitch: 1.4, school: true }), // 頭を上にした「立ち泳ぎ」で漂う
  herayagara: B('vertical', 0.4, { pitch: -1.1 }), // 頭を下にしてヤギに紛れ、獲物に忍び寄る
  // 漂う・その他
  sakuraebi: B('wander', 0.4, { layer: [0.5, 0.95], school: true, pause: 0.2 }), // 昼は深く、夜は浅く上がる群れ
  shiroebi: B('wander', 0.4, { layer: [0.2, 0.7], school: true, pause: 0.2 }),
  hotaruika: B('wander', 0.6, { burst: 3, every: 40, back: true, school: true, layer: [0.3, 0.8] }),
  otohime: B('crevice', 0.2),
  iseebi: B('crevice', 0.25, { walk: true }),
  takaashi: B('walk', 0.05, { side: false }), // 深海の巨大ガニ。脚を高く上げてゆっくり歩く
  ogusoku: B('walk', 0.15),
  kabutogani: B('walk', 0.15, { bury: 0.3 }),
  bandou: B('cruise', 1.2, { burst: 3, every: 30, layer: [0.3, 0.9], events: ['breathe', 'leap'], leapH: 1, pair: true, hunt: 60 }), // 2頭で並んで泳ぎ、そろって呼吸・跳躍する
  hashinagairuka: B('cruise', 1.2, { burst: 3, every: 25, layer: [0.4, 0.95], events: ['breathe', 'spin', 'leap'], leapH: 1, pair: true }),
  shiroiruka: B('cruise', 0.6, { layer: [0.3, 0.9], events: ['breathe'] }),
  ashika: B('cruise', 1.5, { burst: 3, every: 20, layer: [0.2, 0.95], events: ['breathe', 'leap'], leapH: 0.4, hunt: 45 }), // 速く泳ぐときは水面を跳ねながら進む（ポーポイジング）
  rakko: B('cruise', 0.3, { layer: [0.9, 0.98], events: ['float'] }), // 水面に仰向けで浮き、ときどき底へ潜って餌を探す
  arapaima: B('cruise', 0.25, { layer: [0.2, 0.7], events: ['breathe'] }), // 10〜20分ごとに水面で空気を吸う
  polkadot: B('rest', 0.4, { bury: 0.3, rest: [20, 60] }),
};

/** 管理者ツールの表示名 */
export const MODE_NAMES = {
  cruise: '周回（外洋性）', wander: '泳いでは止まる', rest: '底で待ち伏せ・休む', crevice: '岩穴から顔を出す', burrow: '砂の巣穴から出入り',
  cling: '海藻に尾を巻き付ける', pulse: '拍動で漂う', vertical: '縦の姿勢で静止', walk: '海底を歩く', host: '住みかの周りで暮らす（クマノミ）',
};
/** 管理者が魚種ごとに上書きできる値（c.beh）。layer は [下, 上]（水底0〜水面1） */
export const BEH_KEYS = ['mode', 'cruise', 'burst', 'every', 'kick', 'pause', 'range', 'nestle', 'hunt', 'escape', 'gap', 'leapH', 'pair', 'layer'];
const LIMIT = { cruise: [0, 12], burst: [1, 10], every: [0, 3600], kick: [0, 1], pause: [0, 1], range: [1, 30], nestle: [0, 1], hunt: [0, 3600], escape: [0, 30], gap: [0.3, 5], leapH: [0, 3] };

/** 組み込みの行動（id → 体形 → 標準） */
export const baseBehaviorOf = (c) => ID_BEH[c.id] ?? FORM_BEH[c.form] ?? FORM_BEH.perch;

/** 魚種の行動。管理者の上書き c.beh を、範囲外や壊れた値を除いて重ねる */
export function behaviorOf(c) {
  const b = baseBehaviorOf(c);
  const o = c.beh;
  if (!o) return b;
  const out = { ...b };
  if (MODE_NAMES[o.mode]) out.mode = o.mode;
  if (typeof o.pair === 'boolean') out.pair = o.pair;
  for (const [k, [lo, hi]] of Object.entries(LIMIT)) if (typeof o[k] === 'number' && Number.isFinite(o[k])) out[k] = Math.min(hi, Math.max(lo, o[k]));
  const L = o.layer;
  if (Array.isArray(L) && L.length === 2 && L.every(Number.isFinite)) {
    const [a, z] = L.map((v) => Math.min(1, Math.max(0, v)));
    out.layer = [Math.min(a, z), Math.max(a, z)];
  }
  return out;
}

/** 体の中心から腹（接地面）までの高さ（全長比）。モデルの原点が底にある体形は 0 */
export const GROUND = { crab: 0, lobster: 0, octopus: 0, flat: 0, garden: 0, horseshoe: 0, dumbo: 0.02, ray: 0.03, shark: 0.07, hammer: 0.07, eel: 0.04, turtle: 0.12, seahorse: 0.3 };
export const groundOf = (c, beh) => beh.ground ?? GROUND[c.form] ?? 0.09;
