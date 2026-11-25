import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // GitHub Pages（https://yoshi-ochi.github.io/AquariumStudio/）で配信するため、本番ビルドはサブパスに置く
  base: command === 'build' ? '/AquariumStudio/' : '/',
  // 一部の環境（サンドボックス等）ではキャッシュへの書き込みが拒否されるため、
  // 依存の事前バンドルを行わない。three は ESM なのでそのまま読み込める。
  optimizeDeps: { noDiscovery: true, include: [] },
}));
