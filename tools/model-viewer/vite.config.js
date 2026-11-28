import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 生成モデルの確認ビューア（開発用。本番には出さない）。
 *   起動: npm run viewer → http://localhost:5182/?id=<種のid>
 *   ゲームの src/ をそのまま読み込み、参考画像（reference/fish、git 管理外）を横に並べる。
 */
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const IMAGE = /\.(png|jpe?g|webp|gif)$/i;
const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

/** 参考画像の置き場。ワークツリーには無いので、本体のフォルダのものを探す */
function referenceDir() {
  const local = path.join(ROOT, 'reference', 'fish');
  if (fs.existsSync(local)) return local;
  try {
    const common = execSync('git rev-parse --path-format=absolute --git-common-dir', { cwd: ROOT, encoding: 'utf8' }).trim();
    const main = path.join(path.dirname(common), 'reference', 'fish');
    if (fs.existsSync(main)) return main;
  } catch {
    /* git が無い環境では参考画像なしで動かす */
  }
  return null;
}

/** 和名から参考画像の一覧を作る（メインが先頭）。フォルダの外は読まない */
function listImages(dir, name) {
  if (!dir || !name || /[\\/]|\.\./.test(name)) return [];
  const out = [];
  const folder = path.join(dir, name);
  if (fs.existsSync(folder) && fs.statSync(folder).isDirectory()) {
    const files = fs.readdirSync(folder).filter((f) => IMAGE.test(f));
    files.sort((a, b) => Number(b.startsWith('main.')) - Number(a.startsWith('main.')) || a.localeCompare(b));
    for (const f of files) out.push(f);
  }
  // 以前の形式：reference/fish/<和名>.png
  for (const ext of Object.keys(TYPES)) if (fs.existsSync(path.join(dir, name + ext))) out.push(`../${name}${ext}`);
  return out;
}

const referenceImages = () => ({
  name: 'reference-images',
  configureServer(server) {
    const dir = referenceDir();
    server.middlewares.use('/ref', (req, res) => {
      const url = new URL(req.url, 'http://localhost');
      const name = url.searchParams.get('name') ?? '';
      const files = listImages(dir, name);
      const file = url.searchParams.get('file');
      if (!file) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(files));
        return;
      }
      if (!files.includes(file)) {
        res.statusCode = 404;
        res.end();
        return;
      }
      const full = path.join(dir, name, file);
      res.setHeader('Content-Type', TYPES[path.extname(full).toLowerCase()] ?? 'application/octet-stream');
      fs.createReadStream(full).pipe(res);
    });
  },
});

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  envDir: ROOT,
  base: './',
  plugins: [referenceImages()],
  // 参考画像を出すので、この PC の中だけで開く（host は付けない）
  // PORT：既定のポートが使用中のときにデスクトップアプリが割り当てる空きポート
  server: { port: Number(process.env.PORT) || 5182, strictPort: true, fs: { allow: [ROOT] } },
  optimizeDeps: { noDiscovery: true, include: [] },
});
