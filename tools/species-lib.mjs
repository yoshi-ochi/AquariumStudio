/**
 * species:pull と species:add が共有する小さな道具（参考画像の置き場と、リスト外の種の一覧 _custom.json）。
 *
 * reference/fish/_custom.json は「リスト外から追加した種」＝情報（id・学名・体形など）が未補完の種の一覧。
 *   [{ name: 和名, group: '追加した魚種', intake: 管理者ツールの仮の id（c_…。魚種追加ツールから足した種には無い） }]
 * 追加予定種（speciesRoster.js）に加わった種は、species:add がここから外す。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 参考画像の置き場（git 管理外）。ワークツリーには無いので、本体のフォルダのものを探す。無ければ null */
export function referenceDir() {
  const local = path.join(ROOT, 'reference', 'fish');
  if (fs.existsSync(local)) return local;
  try {
    const common = execSync('git rev-parse --path-format=absolute --git-common-dir', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const main = path.join(path.dirname(common), 'reference', 'fish');
    if (fs.existsSync(main)) return main;
  } catch {
    /* git が使えないときは、下でワークツリーの .git（gitdir: <本体>/.git/worktrees/<名前>）から探す */
  }
  try {
    const gitdir = fs.readFileSync(path.join(ROOT, '.git'), 'utf8').match(/^gitdir:\s*(.+)$/m)?.[1].trim();
    const main = gitdir && path.join(path.resolve(ROOT, gitdir), '..', '..', '..', 'reference', 'fish');
    if (main && fs.existsSync(main)) return main;
  } catch {
    /* 本体のフォルダ（.git がフォルダ）やワークツリーでない所 */
  }
  return null;
}

const customFile = (ref) => path.join(ref, '_custom.json');

export function readCustom(ref) {
  if (!ref || !fs.existsSync(customFile(ref))) return [];
  try {
    const list = JSON.parse(fs.readFileSync(customFile(ref), 'utf8'));
    return Array.isArray(list) ? list.filter((s) => s && typeof s.name === 'string') : [];
  } catch {
    return [];
  }
}

const writeCustom = (ref, list) => fs.writeFileSync(customFile(ref), JSON.stringify(list, null, 2));

/** 情報が未補完の種として残す（すでにあれば仮の id だけ書き足す）。新しく足したら true */
export function addCustom(ref, name, intake) {
  const list = readCustom(ref);
  const hit = list.find((s) => s.name === name);
  if (hit && (hit.intake === intake || !intake)) return false;
  if (hit) hit.intake = intake;
  else list.push({ name, group: '追加した魚種', ...(intake ? { intake } : {}) });
  writeCustom(ref, list);
  return !hit;
}

/** 情報を補って追加予定種に加えた種を外す。外したら true */
export function removeCustom(ref, name) {
  const list = readCustom(ref);
  const rest = list.filter((s) => s.name !== name);
  if (rest.length === list.length) return false;
  writeCustom(ref, rest);
  return true;
}

/** 参考画像（メイン）が届いているか */
export const hasMainImage = (ref, name) =>
  !!ref && ((fs.existsSync(path.join(ref, name)) && fs.readdirSync(path.join(ref, name)).some((f) => /^main\./i.test(f))) || ['png', 'jpg', 'jpeg', 'webp'].some((e) => fs.existsSync(path.join(ref, `${name}.${e}`))));
