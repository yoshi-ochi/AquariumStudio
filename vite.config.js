import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig(({ command }) => ({
  // GitHub Pages（https://yoshi-ochi.github.io/AquariumApp/）で配信するため、本番ビルドはサブパスに置く
  base: command === 'build' ? '/AquariumApp/' : '/',
  // 一部の環境（サンドボックス等）ではキャッシュへの書き込みが拒否されるため、
  // 依存の事前バンドルを行わない。three は ESM なのでそのまま読み込める。
  optimizeDeps: { noDiscovery: true, include: [] },
  // ゲーム本体と管理者ツール（生物の設定）の2ページ
  build: { rollupOptions: { input: { main: resolve(import.meta.dirname, 'index.html'), admin: resolve(import.meta.dirname, 'admin.html') } } },
}));
