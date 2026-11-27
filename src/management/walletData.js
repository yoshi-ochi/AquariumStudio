// ダイヤ・アイテム・有料商品の定義（データのみ）。全体の設計は docs/monetization.md

/** 両替：100ダイヤ → 50,000コイン（固定。コインはダイヤにできない） */
export const EXCHANGE = { dia: 100, coin: 50000 };

/** 無償ダイヤの入手量 */
export const EARN = {
  login: 100,
  dailyTask: 50,
  daily: { S: 200, A: 150, B: 100, C: 50 },
  clean: 20,
  cleanPerDay: 25,
  breed: { 1: 30, 2: 60, 3: 100, 4: 150 },
  discovery: { 1: 20, 2: 50, 3: 100, 4: 200 },
  /** 目標達成：章ごと（最大200） */
  goal: { 1: 30, 2: 60, 3: 100, 4: 150, 5: 200 },
  place: 200,
};

/** 毎日の依頼（エサやり・清掃・遠征）。flag は daily.js が数える出来事 */
export const DAILY_TASKS = [
  { id: 'feed', text: '生き物にエサをあげる' },
  { id: 'clean', text: '水槽を掃除する' },
  { id: 'trip', text: '調査隊の成果を受け取る' },
];

/**
 * アイテム（ダイヤで買う。所持数は無期限）
 * kind: catch＝採取の倍数 / boost＝残り時間を縮める / event＝イベントカード / nurse＝保育管理（その間の世話を自動で済ませる）
 */
export const ITEMS = [
  { id: 'catchX2', kind: 'catch', name: '採取倍', text: '遠征の成果を見てから使い、受け取る数を2倍にする（合同調査を除く）', price: 150, mult: 2 },
  { id: 'catchX4', kind: 'catch', name: '採取倍々', text: '遠征の成果を見てから使い、受け取る数を4倍にする（合同調査を除く）', price: 400, mult: 4 },
  { id: 'boost1m', kind: 'boost', name: '加速 1分', text: '建築・遠征・繁殖（産卵・ふ化）・卵のふ化の残り時間を1分縮める', price: 10, sec: 60 },
  { id: 'boost5m', kind: 'boost', name: '加速 5分', text: '建築・遠征・繁殖（産卵・ふ化）・卵のふ化の残り時間を5分縮める', price: 40, sec: 300 },
  { id: 'boost1h', kind: 'boost', name: '加速 1時間', text: '建築・遠征・繁殖（産卵・ふ化）・卵のふ化の残り時間を1時間縮める', price: 300, sec: 3600 },
  { id: 'boost3h', kind: 'boost', name: '加速 3時間', text: '建築・遠征・繁殖（産卵・ふ化）・卵のふ化の残り時間を3時間縮める', price: 800, sec: 10800 },
  { id: 'nurse6h', kind: 'nurse', name: '保育管理 6時間', text: '保育中の世話を6時間ぶん自動で済ませる', price: 150, sec: 21600 },
  { id: 'nurse12h', kind: 'nurse', name: '保育管理 12時間', text: '保育中の世話を12時間ぶん自動で済ませる', price: 280, sec: 43200 },
  { id: 'nurse24h', kind: 'nurse', name: '保育管理 24時間', text: '保育中の世話を24時間ぶん自動で済ませる', price: 500, sec: 86400 },
  { id: 'card_feeding', kind: 'event', event: 'feeding', name: 'イベントカード：餌やりショー', text: '餌やりショーを1回開催できる', price: 30 },
  { id: 'card_kids', kind: 'event', event: 'kids', name: 'イベントカード：親子ふれあい体験', text: '親子ふれあい体験を1回開催できる', price: 60 },
  { id: 'card_night', kind: 'event', event: 'night', name: 'イベントカード：夜の水族館', text: '夜の水族館を1回開催できる', price: 120 },
  { id: 'card_special', kind: 'event', event: 'special', name: 'イベントカード：特別展', text: '特別展を1回開催できる', price: 400 },
];
export const getItem = (id) => ITEMS.find((i) => i.id === id);
export const BOOSTS = ITEMS.filter((i) => i.kind === 'boost');
export const NURSES = ITEMS.filter((i) => i.kind === 'nurse');
export const cardFor = (eventId) => ITEMS.find((i) => i.kind === 'event' && i.event === eventId);

/** 有料商品（App内課金は第7段階。今は開発用の購入だけ） */
export const PACKS = [
  { id: 'dia300', yen: 160, dia: 300 },
  { id: 'dia900', yen: 480, dia: 900 },
  { id: 'dia1900', yen: 980, dia: 1900 },
  { id: 'dia3200', yen: 1600, dia: 3200 },
  { id: 'dia6200', yen: 3000, dia: 6200 },
  { id: 'dia10500', yen: 4900, dia: 10500 },
  { id: 'dia22000', yen: 10000, dia: 22000 },
];

/** 館長パス（30日） */
export const PASS = { id: 'pass30', yen: 720, days: 30, offlineHours: 24, teams: 1, catchCards: 10, dia: 5000 };
/** 調査隊の永久解放（1隊ずつ、2隊まで） */
export const TEAM_UNLOCK = { id: 'team', yen: 480, max: 2 };
