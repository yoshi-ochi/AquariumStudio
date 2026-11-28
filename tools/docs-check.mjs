/**
 * 資料（docs/areas・CLAUDE.md・Skill）が開発に追いついているかを確かめる。
 *   npm run docs:check          … 結果を表示（指摘があれば終了コード 1）
 *   node tools/docs-check.mjs --hook … Claude Code のフック用。`gh pr create` の直前だけ動き、指摘を Claude に渡す（止めない）
 *
 * 見ること：
 *   1. このブランチで触ったファイルの領域の資料（docs/areas/<領域>.md）が、同じブランチで更新されているか
 *   2. 資料の行数が上限を超えていないか（毎回読まれるので短く保つ）
 *   3. 資料に書いたファイルが無くなっていないか
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const HOOK = process.argv.includes('--hook');

/** 領域と、その領域のファイル（先に書いた領域が優先） */
const AREAS = [
  { id: 'model', doc: 'docs/areas/model.md', match: [/^src\/expedition\/(creature(Anatomy|Slug|Soft|Builder|Forms|Traced|Facet)|species|behaviorData)/, /^src\/gacha\/gachaSpecies\.js$/, /^tools\/(fish-intake|model-viewer)\//, /^tools\/species-/, /^src\/admin\/adminModeling\.js$/] },
  { id: 'ios', doc: 'docs/areas/ios.md', match: [/^ios\//, /^capacitor\.config\.json$/, /^codemagic\.yaml$/, /^src\/online\/purchases\.js$/, /^supabase\/iap\.sql$/, /^supabase\/functions\//, /^docs\/iphone-release\.md$/] },
  { id: 'sns', doc: 'docs/areas/sns.md', match: [/^docs\/sns\//, /^tools\/(reel|adVideo)\//] },
  { id: 'dev', doc: 'docs/areas/dev.md', match: [/^src\//, /^admin\//, /^supabase\//, /^worker\//, /^(index|share)\.html$/, /^vite\.config\.js$/, /^\.github\//] },
];
const LIMITS = [
  ['CLAUDE.md', 60],
  ...AREAS.map((a) => [a.doc, 80]),
];
const DOCS = ['CLAUDE.md', 'docs/README.md', 'docs/spec.md', ...AREAS.map((a) => a.doc)];
/** 資料の中でファイルとして確かめる書き方（`src/…` など）。git 管理外や記号入りは見ない */
const PATH_LIKE = /^(src|docs|tools|supabase|admin|ios|worker|\.claude|\.github)\/[\w./-]+$|^[\w.-]+\.(md|json|js|mjs|html|yaml)$/;
/** 見ないもの：例として書いた名前（NN・Xxx）、git 管理外の素材 */
const SKIP = /NN|Xxx|^_|^docs\/sns\/reel-\d+\//;

const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};
const lines = (s) => s.split(/\r?\n/).filter(Boolean);

function changedFiles() {
  const base = git('merge-base', 'origin/main', 'HEAD') || git('merge-base', 'main', 'HEAD');
  const committed = base ? lines(git('diff', '--name-only', `${base}...HEAD`)) : [];
  const working = lines(git('status', '--porcelain', '--untracked-files=all')).map((l) => l.slice(3).split(' -> ').pop().replace(/^"|"$/g, ''));
  return [...new Set([...committed, ...working])];
}

function check() {
  const out = [];
  const changed = changedFiles();

  // 1. 触った領域の資料が更新されているか
  const touched = new Map();
  for (const f of changed) {
    if (f.startsWith('docs/areas/')) continue;
    const area = AREAS.find((a) => a.match.some((re) => re.test(f)));
    if (area) touched.set(area, [...(touched.get(area) ?? []), f]);
  }
  for (const [area, files] of touched) {
    if (changed.includes(area.doc)) continue;
    out.push(`${area.doc} が更新されていません（このブランチで ${files.length} 件を変更：${files.slice(0, 3).join('、')}${files.length > 3 ? ' ほか' : ''}）。「いまの状態」「次にやること」を書き換えてください。変わる所が無ければそのままで構いません。`);
  }

  // 2. 行数の上限
  for (const [file, max] of LIMITS) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    const n = fs.readFileSync(full, 'utf8').split(/\r?\n/).length - 1;
    if (n > max) out.push(`${file} が ${n} 行あります（上限 ${max} 行）。古い内容を消して短くしてください。`);
  }

  // 3. 資料に書いたファイルがあるか
  // フォルダ名を省いて書いたファイル名は、リポジトリのどこかにあればよい
  const names = new Set(lines(git('ls-files', '--cached', '--others', '--exclude-standard')).map((f) => path.basename(f)));
  const skills = fs.existsSync(path.join(ROOT, '.claude/skills')) ? fs.readdirSync(path.join(ROOT, '.claude/skills')).map((d) => `.claude/skills/${d}/SKILL.md`) : [];
  for (const doc of [...DOCS, ...skills]) {
    const full = path.join(ROOT, doc);
    if (!fs.existsSync(full)) continue;
    const seen = new Set();
    for (const m of fs.readFileSync(full, 'utf8').matchAll(/`([^`\s]+)`/g)) {
      const p = m[1].replace(/[、。]$/, '');
      if (!PATH_LIKE.test(p) || SKIP.test(p) || seen.has(p)) continue;
      seen.add(p);
      const found = p.includes('/') ? fs.existsSync(path.join(ROOT, p)) : names.has(p);
      if (!found) out.push(`${doc} に書かれた \`${p}\` が見つかりません（名前が変わったか、消えています）。`);
    }
  }
  return out;
}

if (HOOK) {
  let input = '';
  try {
    input = fs.readFileSync(0, 'utf8');
  } catch {
    /* 入力なし */
  }
  let command = '';
  try {
    command = JSON.parse(input)?.tool_input?.command ?? '';
  } catch {
    /* JSON でなければ何もしない */
  }
  if (/\bgh\s+pr\s+create\b/.test(command)) {
    const issues = check();
    if (issues.length) {
      const text = `資料の確認（tools/docs-check.mjs）で ${issues.length} 件の指摘があります。PR に含めるか、不要なら理由を1行で伝えてください。\n- ${issues.join('\n- ')}`;
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: text } }));
    }
  }
  process.exit(0);
}

const issues = check();
if (!issues.length) {
  console.log('資料の確認：指摘なし');
} else {
  console.log(`資料の確認：${issues.length} 件`);
  for (const i of issues) console.log(`- ${i}`);
  process.exit(1);
}
