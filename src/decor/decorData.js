// 内装ガチャと大型流木の定義（データのみ）。全体の設計は docs/monetization.md

/**
 * デザイン（見た目の差し替え）。free は最初から使える標準のデザイン、rarity はガチャのレア度（1〜4）。
 * stand＝水槽台、plate＝説明プレート、light＝天井照明
 */
export const SKIN_KINDS = { stand: '水槽台', plate: '説明プレート', light: '天井照明' };
export const SKINS = {
  stand: [
    { id: 'wood', name: '木目（標準）', free: true, chip: '#5b3d28' },
    { id: 'white', name: 'ホワイト', rarity: 1, chip: '#f0f0ec' },
    { id: 'black', name: 'ブラック', rarity: 1, chip: '#1e2226' },
    { id: 'oak', name: '明るいオーク', rarity: 2, chip: '#c49a6c' },
    { id: 'marble', name: '大理石', rarity: 3, chip: '#e8e6e0' },
    { id: 'iron', name: 'アイアン脚', rarity: 3, chip: '#2a2d30' },
    { id: 'urushi', name: '黒漆と格子（和風）', rarity: 4, chip: '#1a1412' },
  ],
  plate: [
    { id: 'navy', name: '紺（標準）', free: true, chip: '#0f3d5e' },
    { id: 'wood', name: '木札', rarity: 1, chip: '#b88a5a' },
    { id: 'acrylic', name: '透明アクリル', rarity: 1, chip: '#d8eef8' },
    { id: 'stone', name: '石碑', rarity: 2, chip: '#8a8c88' },
    { id: 'washi', name: '和紙', rarity: 2, chip: '#f4ecd8' },
    { id: 'brass', name: '真鍮', rarity: 3, chip: '#c9a227' },
  ],
  light: [
    { id: 'pendant', name: 'ペンダント（標準）', free: true, chip: '#3a4148' },
    { id: 'globe', name: '球形ペンダント', rarity: 1, chip: '#f6f0e0' },
    { id: 'chochin', name: '提灯（和風）', rarity: 3, chip: '#f0d8a0' },
    { id: 'downlight', name: 'ダウンライト（広告の天井照明）', rarity: 4, chip: '#ffffff' },
  ],
};
export const getSkin = (kind, id) => SKINS[kind]?.find((s) => s.id === id) ?? SKINS[kind]?.[0];
export const skinKey = (kind, id) => `skin:${kind}:${id}`;

/** ガチャで解放する館内オブジェ（tankData.js の STRUCTURE_DEFS に unlock: 'gacha' で入っている） */
export const GACHA_OBJECTS = [
  { id: 'tatami', rarity: 1 },
  { id: 'monstera', rarity: 2 },
  { id: 'kentia', rarity: 2 },
  { id: 'shoji', rarity: 2 },
  { id: 'takegaki', rarity: 2 },
  { id: 'umbellata', rarity: 3 },
  { id: 'toro', rarity: 3 },
];
export const objKey = (id) => `obj:${id}`;

/** 大型流木（水槽内オブジェ。ダイヤで1形ずつ解放、または課金のセットで全部） */
export const BIGWOOD_DIA = 300;
export const BIGWOOD_SET = { id: 'bigwoodSet', yen: 480 };

/** 重なったときにもらえるコイン */
export const DUP_COINS = { 1: 5000, 2: 15000, 3: 50000, 4: 150000 };
