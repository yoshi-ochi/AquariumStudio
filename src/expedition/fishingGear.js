import { NET_GEAR } from './gearNets.js';
import { TOW_GEAR } from './gearTow.js';
import { LINE_GEAR } from './gearLines.js';
import { TRAP_GEAR } from './gearTraps.js';
import { RIVER_GEAR } from './gearRiver.js';

export { BED } from './gearKit.js';
export { RIVER_GEAR };

/** 漁法 id → 動きを作る関数（海） */
export const GEAR = { ...NET_GEAR, ...TOW_GEAR, ...LINE_GEAR, ...TRAP_GEAR };
