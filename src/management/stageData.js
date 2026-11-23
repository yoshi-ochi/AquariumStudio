// ステージ（館の規模）定義。level は 1 始まり。建物の形は building/blueprint.js で固定。
export const STAGES = [
  { level: 1, name: '開館したての水族館', wallHeight: 3.6, maxFloors: 3, upgradeCost: 0, visitorFactor: 4 },
  { level: 2, name: '地域の人気水族館', wallHeight: 3.6, maxFloors: 3, upgradeCost: 4000000, visitorFactor: 6 },
  { level: 3, name: '大型総合水族館', wallHeight: 3.6, maxFloors: 3, upgradeCost: 10000000, visitorFactor: 9 },
  { level: 4, name: '世界的な水族館', wallHeight: 3.6, maxFloors: 3, upgradeCost: 25000000, visitorFactor: 12 },
  { level: 5, name: '海とつながる水族館', wallHeight: 3.6, maxFloors: 3, upgradeCost: 60000000, visitorFactor: 15 },
];

export const STARTING_MONEY = 300000;
/** 来館者1人あたりの毎秒の収入（円） */
export const INCOME_PER_VISITOR = 2;
/** 削除時の返金率 */
export const REFUND_RATE = 0.5;
