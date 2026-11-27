/**
 * 卵ガチャでしか手に入らない生き物（データのみ。モデル待ち）。
 * speciesRoster.js の PLANNED に加わり、管理者ツールの「モデル待ち」から参考画像を登録できる。
 * モデル（ANATOMY[id] または model: true）が出来た種だけがガチャに並ぶ（speciesRelease.js）。
 * gacha は区分（gachaData.js の CATS）、habitat は暮らす場所（water 水中 / shore 水辺と陸 / land 陸）。
 * 採取地には入らない（at を持たない）。form は魚類以外は仮（体の組み立ては第8段階で作る）。
 */
const g = (gacha, id, name, form, len, rarity, appeal, body, belly, fin, sci, habitat, zone, note) => ({
  id, name, form, len, rarity, slots: 1, appeal, colors: { body, belly, fin }, gacha, sci, habitat, zone, note,
});

export const GACHA_PLANNED = [
  // ---- 魚類（古代魚を含む） ----
  g('fish', 'senegalus', 'ポリプテルス・セネガルス', 'eel', 0.3, 1, 3, 0x8a8a6a, 0xd8d4b8, 0x7a7a5a, 'Polypterus senegalus', 'water', 'tropical', '背中に小さな背びれが旗のように並ぶ古代魚。肺のような浮き袋で空気も吸える。'),
  g('fish', 'ropefish', 'ロープフィッシュ', 'eel', 0.4, 1, 3, 0x6a6a3a, 0xd8c070, 0x5a5a30, 'Erpetoichthys calabaricus', 'water', 'tropical', 'ヘビのように細長いポリプテルスの仲間。夜に水草の間をくねって小エビを探す。'),
  g('fish', 'bichir', 'ポリプテルス・ビキール', 'eel', 0.7, 2, 8, 0x7a7a5c, 0xe0dcc4, 0x6a6a4c, 'Polypterus bichir', 'water', 'tropical', 'ナイル川などにすむ大型のポリプテルス。胸びれで川底を歩くように進む。'),
  g('fish', 'bowfin', 'ボウフィン', 'cod', 0.7, 2, 8, 0x5c6a4a, 0xc8c8a0, 0x4a5a3a, 'Amia calva', 'water', 'temperate', '1億年以上前から姿の変わらない北米の古代魚。オスは卵と稚魚を守る。'),
  g('fish', 'butterflyfish_fw', 'バタフライフィッシュ', 'perch', 0.1, 2, 4, 0x8a7a5a, 0xd8ccaa, 0x6a5a3a, 'Pantodon buchholzi', 'water', 'tropical', '大きな胸びれを広げて水面のすぐ下に浮かぶ。驚くと水面から跳んで滑空する。'),
  g('fish', 'spottedgar', 'スポッテッドガー', 'needle', 0.8, 3, 14, 0x8a8a5a, 0xe0dcc0, 0x6a6a40, 'Lepisosteus oculatus', 'water', 'temperate', '硬いエナメル質のうろこに覆われたガー。体と頭に黒い斑点が散らばる。'),
  g('fish', 'lungfish_af', 'アフリカハイギョ', 'eel', 1.0, 3, 16, 0x6a5a4a, 0xb8a890, 0x5a4a3a, 'Protopterus annectens', 'water', 'tropical', '乾季に川が干上がると泥の中で繭を作り、何か月も眠って雨を待つ。'),
  g('fish', 'beluga_sturgeon', 'オオチョウザメ', 'shark', 4.0, 4, 60, 0x6a7680, 0xd8dee2, 0x5a6670, 'Huso huso', 'water', 'cold', 'カスピ海や黒海にすむ世界最大級の淡水魚。100年以上生きることがある。'),
  g('fish', 'menadoensis', 'インドネシアシーラカンス', 'coelacanth', 1.4, 4, 65, 0x5a4a3a, 0x8a7a64, 0x4a3a2c, 'Latimeria menadoensis', 'water', 'cold', '1998年にインドネシアで見つかった2種目のシーラカンス。褐色の体に金色の斑点が光る。'),
  // ---- 両生類 ----
  g('amphibian', 'akahara', 'アカハライモリ', 'amphibian', 0.1, 1, 3, 0x2a2a2a, 0xe84a2a, 0x2a2a2a, 'Cynops pyrrhogaster', 'shore', 'temperate', '日本の田んぼや池にすむイモリ。お腹の赤い模様は毒があることを知らせる警告色。'),
  g('amphibian', 'xenopus', 'アフリカツメガエル', 'amphibian', 0.1, 1, 3, 0x6a6a4a, 0xd8d0b8, 0x5a5a3a, 'Xenopus laevis', 'water', 'tropical', '一生を水中で暮らすカエル。舌がなく、前足で餌を口へかき込む。'),
  g('amphibian', 'axolotl', 'ウーパールーパー', 'amphibian', 0.25, 2, 10, 0xf0c8c0, 0xf8e0d8, 0xe8a0a0, 'Ambystoma mexicanum', 'water', 'temperate', 'メキシコサラマンダー。子どもの姿のまま大人になり、外にえらのふさを広げて水中で暮らす。'),
  g('amphibian', 'pleurodeles', 'イベリアトゲイモリ', 'amphibian', 0.25, 2, 6, 0x6a6a5a, 0xe8c060, 0x5a5a4a, 'Pleurodeles waltl', 'water', 'temperate', '危険を感じると肋骨の先を皮膚から突き出して身を守る。'),
  g('amphibian', 'bellhorn', 'ベルツノガエル', 'amphibian', 0.12, 2, 8, 0x6a9a4a, 0xe8e0b8, 0x8a4a2a, 'Ceratophrys ornata', 'land', 'tropical', '大きな口で自分と同じくらいの獲物にも食らいつく。土に潜って待ち伏せする。'),
  g('amphibian', 'firesalamander', 'マダラサラマンダー', 'amphibian', 0.2, 3, 14, 0x1a1a1a, 0x2a2a2a, 0xf0c020, 'Salamandra salamandra', 'land', 'temperate', '黒地に黄色い斑紋のサラマンダー。湿った森にすみ、子どもを水辺に産む。'),
  g('amphibian', 'dartfrog', 'コバルトヤドクガエル', 'amphibian', 0.04, 3, 14, 0x2a4ac8, 0x1a2a8a, 0x101040, 'Dendrobates tinctorius', 'land', 'tropical', '鮮やかな青は毒をもつ印。オタマジャクシを背負って水たまりへ運ぶ。'),
  g('amphibian', 'chinesegiant', 'チュウゴクオオサンショウウオ', 'amphibian', 1.5, 4, 55, 0x5a4a3a, 0x8a7a64, 0x4a3a2c, 'Andrias davidianus', 'water', 'temperate', '世界最大級の両生類。清流の岩の下で待ち伏せし、近づいた魚を一瞬で吸い込む。'),
  g('amphibian', 'hellbender', 'ヘルベンダー', 'amphibian', 0.6, 4, 40, 0x6a5a3a, 0x9a8a64, 0x5a4a2c, 'Cryptobranchus alleganiensis', 'water', 'temperate', '北米の清流にすむ大型のサンショウウオ。しわの多い皮膚から水中の酸素を取り込む。'),
  // ---- 爬虫類 ----
  g('reptile', 'kusagame', 'クサガメ', 'turtle', 0.25, 1, 4, 0x5a4a3a, 0xd8c890, 0x3a3a2a, 'Mauremys reevesii', 'shore', 'temperate', '池や川にすむカメ。危険を感じると脇から独特のにおいを出す。'),
  g('reptile', 'mapturtle', 'ミシシッピチズガメ', 'turtle', 0.25, 1, 4, 0x5a5a4a, 0xe8d8a0, 0x4a4a3a, 'Graptemys pseudogeographica kohni', 'shore', 'temperate', '甲羅と皮膚に地図の等高線のような黄色い線模様がある。流木の上で甲羅干しをする。'),
  g('reptile', 'hanagame', 'ハナガメ', 'turtle', 0.25, 2, 6, 0x5a5a3a, 0xe8d890, 0x3a4a3a, 'Mauremys sinensis', 'shore', 'tropical', '首から頭に細かい黄緑の線が花模様のように走る。流れのゆるい川や池で暮らす。'),
  g('reptile', 'pignose', 'スッポンモドキ', 'turtle', 0.5, 2, 10, 0x8a9a8a, 0xe8e0d0, 0x7a8a7a, 'Carettochelys insculpta', 'water', 'tropical', 'ブタのような鼻をもち、ウミガメのような前足で水中を羽ばたくように泳ぐ。'),
  g('reptile', 'greeniguana', 'グリーンイグアナ', 'reptile', 1.5, 2, 10, 0x5a9a4a, 0x9ac87a, 0x4a7a3a, 'Iguana iguana', 'land', 'tropical', '川沿いの木の上で暮らし、危険が迫ると水に飛び込んで泳いで逃げる。'),
  g('reptile', 'basilisk', 'グリーンバシリスク', 'reptile', 0.7, 3, 16, 0x4aa84a, 0x9ad87a, 0x3a8a3a, 'Basiliscus plumifrons', 'shore', 'tropical', '危険を感じると後ろ足で水面を走って逃げる。頭と背中に帆のようなとさかがある。'),
  g('reptile', 'seakrait', 'エラブウミヘビ', 'reptile', 1.2, 3, 16, 0x6a8aa8, 0xc8d8e0, 0x1a1a2a, 'Laticauda semifasciata', 'water', 'tropical', '黒い帯模様のウミヘビ。海で狩りをし、陸に上がって卵を産む。'),
  g('reptile', 'saltwatercroc', 'イリエワニ', 'reptile', 5.0, 4, 70, 0x4a5a3a, 0xc8c090, 0x3a4a2c, 'Crocodylus porosus', 'shore', 'tropical', '現生最大の爬虫類。河口から外洋まで泳ぎ、島から島へ渡ることもある。'),
  g('reptile', 'gharial', 'インドガビアル', 'reptile', 5.0, 4, 65, 0x6a7a5a, 0xd8d0a8, 0x5a6a4a, 'Gavialis gangeticus', 'shore', 'tropical', '細長い口先で魚を捕らえるワニ。オスの鼻先にはつぼのようなこぶがある。'),
  // ---- 鳥類 ----
  g('bird', 'umiu', 'ウミウ', 'bird', 0.85, 1, 4, 0x1a1a1a, 0x2a2a2a, 0x1a1a1a, 'Phalacrocorax capillatus', 'shore', 'temperate', '潜水して魚を捕る海鳥。長良川の鵜飼いで活躍する。'),
  g('bird', 'humboldt', 'フンボルトペンギン', 'bird', 0.65, 1, 10, 0x2a2a2e, 0xf4f4f4, 0x2a2a2e, 'Spheniscus humboldti', 'shore', 'temperate', '南米の海岸の岩場にすむペンギン。胸に黒い帯が1本ある。'),
  g('bird', 'rockhopper', 'イワトビペンギン', 'bird', 0.55, 2, 14, 0x2a2a2e, 0xf4f4f4, 0x2a2a2e, 'Eudyptes chrysocome', 'shore', 'cold', '黄色い飾り羽をもち、両足をそろえて岩から岩へ跳びはねる。'),
  g('bird', 'puffin', 'ツノメドリ', 'bird', 0.35, 2, 12, 0x1a1a1a, 0xf4f4f4, 0xe8702a, 'Fratercula corniculata', 'shore', 'cold', '大きな橙色のくちばしの海鳥。翼で水をかいて潜り、小魚を何匹もくわえて巣へ運ぶ。'),
  g('bird', 'pelican', 'モモイロペリカン', 'bird', 1.6, 2, 14, 0xf4e0dc, 0xf8ecea, 0x1a1a1a, 'Pelecanus onocrotalus', 'shore', 'tropical', 'のどの大きな袋で水ごと魚をすくい取る。群れで魚を浅瀬へ追い込む。'),
  g('bird', 'kingpenguin', 'キングペンギン', 'bird', 0.95, 3, 30, 0x3a4250, 0xf4f4f4, 0xf0a020, 'Aptenodytes patagonicus', 'shore', 'cold', '2番目に大きいペンギン。首の橙色が鮮やか。300m以上の深さまで潜る。'),
  g('bird', 'flamingo', 'ベニイロフラミンゴ', 'bird', 1.3, 3, 26, 0xf07a6a, 0xf8b0a0, 0x1a1a1a, 'Phoenicopterus ruber', 'shore', 'tropical', '頭を逆さにして浅瀬の水をこし、小さなエビや藻を食べる。この餌が羽を紅色にする。'),
  g('bird', 'shoebill', 'ハシビロコウ', 'bird', 1.2, 4, 60, 0x7a8a9a, 0xa8b4c0, 0x6a7a8a, 'Balaeniceps rex', 'shore', 'tropical', '湿地で何時間も動かずに立ち、浮かんできた肺魚を大きなくちばしで捕らえる。'),
  g('bird', 'albatross', 'ワタリアホウドリ', 'bird', 1.2, 4, 55, 0xf4f4f4, 0xf8f8f8, 0x3a3a3a, 'Diomedea exulans', 'shore', 'cold', '翼を広げると3mを超える。ほとんど羽ばたかずに南の海を何千kmも飛び続ける。'),
];
