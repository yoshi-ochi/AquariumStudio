/**
 * 魚種の公開を記録する（開発用）。モデルを作ったら main へマージする前に実行する。
 *   npm run species:release          … 公開日の無い実装済みの種に今日の日付を書き足し、予定種の状況を表示
 *   npm run species:release -- --check … 書き込まずに表示だけ（未記録があれば終了コード1）
 *
 * 公開の流れ：参考画像（npm run fish-intake）→ モデル作成（ANATOMY[id] を追加、または speciesRoster.js で model: true）
 *   → このコマンドで公開日を記録 → main へマージ → GitHub Actions が Pages へ公開 → ログイン時に新種として案内
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'src', 'expedition', 'speciesReleases.js');
const REF = path.join(ROOT, 'reference', 'fish');
const check = process.argv.includes('--check');

const { CREATURES, DESTINATIONS, HIDDEN_PLACES } = await import('../src/expedition/creatureData.js');
const { INITIAL, RELEASES } = await import('../src/expedition/speciesReleases.js');
const { plannedStatus } = await import('../src/expedition/speciesRelease.js');

const known = new Set([...INITIAL, ...Object.keys(RELEASES)]);
const fresh = CREATURES.filter((c) => !known.has(c.id));
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // 日本時間の日付

const hasImage = (name) => fs.existsSync(path.join(REF, name)) || ['png', 'jpg', 'jpeg', 'webp'].some((e) => fs.existsSync(path.join(REF, `${name}.${e}`)));

console.log('■ 追加予定種');
for (const s of plannedStatus()) {
  const state = s.released ? `公開 ${s.released}` : s.modeled ? 'モデル済み・公開日未記録' : hasImage(s.name) ? '画像あり・モデル待ち' : '画像待ち';
  console.log(`  ${s.name.padEnd(14, '　')} ${state.padEnd(16, '　')} ${s.places.join('・')}`);
}
console.log('\n■ 採取地');
console.log(`  公開中 ${DESTINATIONS.length}か所 / 魚種がそろうまで非表示 ${HIDDEN_PLACES.map((d) => `${d.name}(${d.pool.length})`).join('、') || 'なし'}`);

if (!fresh.length) {
  console.log('\n公開日の未記録はありません');
  process.exit(0);
}
console.log(`\n■ 公開日の未記録 ${fresh.length}種: ${fresh.map((c) => c.name).join('、')}`);
if (check) process.exit(1);

const src = fs.readFileSync(FILE, 'utf8');
const lines = `  // ${today}\n${fresh.map((c) => `  ${c.id}: '${today}',`).join('\n')}\n`;
const end = src.lastIndexOf('};');
fs.writeFileSync(FILE, src.slice(0, end) + lines + src.slice(end));
console.log(`→ speciesReleases.js に ${today} で記録しました`);
