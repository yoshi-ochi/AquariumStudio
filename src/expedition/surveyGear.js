import { shipSurvey } from './surveyShip.js';
import { rovSurvey } from './surveyRov.js';
import { polarSurvey } from './surveyPolar.js';

export { getSurvey } from './surveyData.js';

/** 合同調査の id → 採取の動きを作る関数（fishingScene.js が、成果を受け取るときに読み込む） */
export const SURVEY_GEAR = { ship: shipSurvey, rov: rovSurvey, polar: polarSurvey };
