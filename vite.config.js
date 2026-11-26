import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ command }) => ({
  // GitHub Pages（https://yoshi-ochi.github.io/AquariumStudio/）で配信するため、本番ビルドはサブパスに置く
  base: command === 'build' ? '/AquariumStudio/' : '/',
  // 一部の環境（サンドボックス等）ではキャッシュへの書き込みが拒否されるため、
  // 依存の事前バンドルを行わない。three は ESM なのでそのまま読み込める。
  optimizeDeps: { noDiscovery: true, include: [] },
  // ゲーム本体と、共有された水槽の閲覧ページ（share.html。ログインなしで1つの水槽を見る）
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        share: fileURLToPath(new URL('./share.html', import.meta.url)),
      },
    },
  },
}));
