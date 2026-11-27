// 配信サムネイルの受け取り（開発用）。bakeThumbs.js が送る WebP（base64）と manifest.json を public/thumbs/ に書き出す。
// 使い方：node tools/thumbs/receive.mjs（localhost:5199）→ npm run dev のページのコンソールで bakeThumbs() を実行
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/thumbs');
const SAFE = /^[a-z]_[A-Za-z0-9_]+\.webp$|^manifest\.json$/;

http
  .createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.end();
    const name = new URL(req.url, 'http://x').searchParams.get('name') ?? '';
    if (req.method !== 'POST' || !SAFE.test(name)) {
      res.statusCode = 400;
      return res.end('bad request');
    }
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      fs.writeFileSync(path.join(OUT, name), Buffer.from(body, 'base64'));
      res.end('ok');
    });
  })
  .listen(5199, () => console.log(`receiving thumbnails into ${OUT} on :5199`));
