import { CREATURES, DESTINATIONS, JOINT_PROJECTS, RETIRED_PLACES, getCreature } from '../expedition/creatureData.js';
import { SPECIES_METHODS, getMethod } from '../expedition/fishingData.js';
import { baseCreature, basePlace, baseMethods, baseNote } from '../expedition/creatureConfig.js';

/**
 * 下書きの設定（cfg）を書き換える関数と、保存前の整理・点検。
 * 画面は「反映済みのデータ（CREATURES など）」を読み、変更は cfg に書いてから applyConfig し直す。
 */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** 魚種の上書き（追加した魚種なら added の項目）を取り出す */
export function speciesEntry(cfg, id) {
  const added = cfg.added?.find((a) => a.id === id);
  if (added) return added;
  cfg.species ??= {};
  return (cfg.species[id] ??= {});
}

/** 採取地の項目（追加した採取地なら addedPlaces の項目） */
export function placeEntry(cfg, id) {
  const added = cfg.addedPlaces?.find((a) => a.id === id);
  if (added) return added;
  cfg.places ??= {};
  return (cfg.places[id] ??= {});
}

/** 採取地・合同調査の一覧 [{ id, name, joint }]（削除した採取地を除く） */
export const allPools = () => [...DESTINATIONS.map((d) => ({ id: d.id, name: d.name, pool: d.pool })), ...JOINT_PROJECTS.map((p) => ({ id: p.id, name: `合同：${p.name}`, pool: p.pool, joint: true }))];

/** 魚種 id を採取地・合同調査 pid の捕れる生き物に入れる／外す */
export function setInPool(cfg, pid, id, on) {
  const joint = JOINT_PROJECTS.find((p) => p.id === pid);
  const cur = joint ? joint.pool : DESTINATIONS.find((d) => d.id === pid)?.pool ?? [];
  const pool = on ? [...new Set([...cur, id])] : cur.filter((x) => x !== id);
  if (joint) {
    cfg.joint ??= {};
    cfg.joint[pid] = { pool };
  } else placeEntry(cfg, pid).pool = pool;
}

/** 新しい id（英小文字・数字・_） */
export const validId = (id) => /^[a-z][a-z0-9_]{1,30}$/.test(id);
export const idTaken = (id) => !!getCreature(id) || DESTINATIONS.some((d) => d.id === id) || RETIRED_PLACES.some((d) => d.id === id);

/** 組み込みと同じ値は保存しない（設定を小さく保つ） */
export function pruneConfig(cfg) {
  const out = structuredClone(cfg);
  for (const [id, o] of Object.entries(out.species ?? {})) {
    const b = baseCreature(id);
    if (!b) {
      delete out.species[id];
      continue;
    }
    for (const k of Object.keys(o)) {
      const v = o[k];
      const base = k === 'methods' ? baseMethods(id) : k === 'note' ? baseNote(id) : k === 'xp' ? 0 : k === 'removed' ? false : b[k];
      if (v === '' || v == null || same(v, base) || (k === 'seasons' && !v.length && !base) || (k === 'zone' && !v)) delete o[k];
    }
    if (!Object.keys(o).length) delete out.species[id];
  }
  for (const [id, o] of Object.entries(out.places ?? {})) {
    const b = basePlace(id);
    if (!b) {
      delete out.places[id];
      continue;
    }
    for (const k of Object.keys(o)) if (o[k] === '' || o[k] == null || same(o[k], b[k]) || (k === 'removed' && !o[k])) delete o[k];
    if (!Object.keys(o).length) delete out.places[id];
  }
  for (const [id, o] of Object.entries(out.joint ?? {})) {
    const i = JOINT_PROJECTS.findIndex((p) => p.id === id);
    if (i < 0 || !o.pool?.length) delete out.joint[id];
  }
  for (const k of ['species', 'places', 'joint', 'added', 'addedPlaces']) if (out[k] && !Object.keys(out[k]).length) delete out[k];
  if (out.rarity) {
    for (const [k, v] of Object.entries(out.rarity)) {
      for (const r of Object.keys(v)) if (v[r] === '' || v[r] == null) delete v[r];
      if (!Object.keys(v).length) delete out.rarity[k];
    }
    if (!Object.keys(out.rarity).length) delete out.rarity;
  }
  return out;
}

/** 反映済みのデータを点検する。[{ level: 'error' | 'warn', text }] */
export function auditConfig() {
  const out = [];
  const err = (text) => out.push({ level: 'error', text });
  const warn = (text) => out.push({ level: 'warn', text });
  const pools = allPools();
  const names = new Map();
  for (const c of CREATURES) {
    if (c.retired) continue;
    const at = pools.filter((p) => p.pool.includes(c.id));
    if (!at.length) warn(`${c.name}：どの採取地・合同調査でも捕れません`);
    const methods = SPECIES_METHODS[c.id] ?? [];
    if (at.some((p) => !p.joint) && !methods.length) err(`${c.name}：漁法が無いため、採取地で捕れません`);
    for (const m of methods) if (!getMethod(m)) err(`${c.name}：不明な漁法「${m}」`);
    if (!(c.len > 0)) err(`${c.name}：体長が0以下です`);
    if (![1, 2, 3].includes(c.rarity)) err(`${c.name}：レア度が1〜3ではありません`);
    if (!(c.appeal >= 0)) err(`${c.name}：集客力が正しくありません`);
    if (c.seasons?.length === 4) warn(`${c.name}：季節が4つとも選ばれています（空欄＝通年と同じ）`);
    if (names.has(c.name)) warn(`${c.name}：同じ名前の魚種があります（${names.get(c.name)} と ${c.id}）`);
    names.set(c.name, c.id);
  }
  for (const d of DESTINATIONS) {
    if (!d.pool.length) err(`${d.name}：捕れる生き物がいません`);
    else if (d.pool.every((id) => getCreature(id).seasons?.length)) {
      const all = new Set(d.pool.flatMap((id) => getCreature(id).seasons));
      if (all.size < 4) warn(`${d.name}：捕れる生き物がいない季節があります（その季節は季節外の生き物も捕れる扱い）`);
    }
    if (!(d.cost > 0)) err(`${d.name}：費用が0以下です`);
    if (!(Math.abs(d.lat) <= 85 && Math.abs(d.lon) <= 180)) err(`${d.name}：緯度・経度が範囲外です`);
  }
  for (const p of JOINT_PROJECTS) if (!p.pool.length) err(`合同調査「${p.name}」：捕れる生き物がいません`);
  return out;
}
