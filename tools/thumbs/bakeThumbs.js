/**
 * 配信サムネイルを作り直す（開発用）。すべての水槽・オブジェ・生き物を撮影し、WebP と manifest.json を
 * 受け取りサーバー（localhost:5199 → public/thumbs/）へ送る。コミットして本番へ反映すると配信される。
 * 使い方（npm run dev 中のブラウザのコンソール）:
 *   const { bakeThumbs } = await import('/tools/thumbs/bakeThumbs.js');
 *   await bakeThumbs();
 */
import { generatePreviews } from '/src/core/previewRenderer.js';
import { thumbKey, thumbFile } from '/src/core/thumbCache.js';
import { ALL_DEFS } from '/src/tanks/tankData.js';
import { CREATURES } from '/src/expedition/creatureData.js';
import { buildObject, disposeObject } from '/src/tanks/tankBuilder.js';
import { buildCreature } from '/src/expedition/creatureBuilder.js';

const RECV = 'http://localhost:5199/';
const send = (name, b64) => fetch(`${RECV}?name=${encodeURIComponent(name)}`, { method: 'POST', body: b64 });

export async function bakeThumbs({ onProgress = () => {} } = {}) {
  const manifest = { d: {}, c: {} };
  const jobs = [['d', ALL_DEFS, buildObject], ['c', CREATURES, buildCreature]];
  for (const [kind, defs, build] of jobs) {
    const shots = await generatePreviews(defs, build, { dispose: disposeObject, type: 'image/webp', quality: 0.82, transparent: kind === 'c', onProgress: (i, n) => onProgress(kind, i, n) });
    for (const def of defs) {
      await send(thumbFile(kind, def.id), shots.get(def.id).split(',')[1]);
      manifest[kind][def.id] = thumbKey(kind, def);
    }
  }
  await send('manifest.json', btoa(JSON.stringify(manifest)));
  return { objects: Object.keys(manifest.d).length, creatures: Object.keys(manifest.c).length };
}
