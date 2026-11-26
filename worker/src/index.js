/**
 * 水槽の共有 URL（Cloudflare Workers）。https://<worker>/t/<id>
 *   - LINE・インスタ・X などがリンクの絵を取りに来たら、水槽ごとの題名と画像（og:image）を書いた HTML を返す
 *   - 人が開いたら、GitHub Pages の閲覧ページ（share.html?id=<id>）へそのまま移す
 *   - /i/<id>.jpg は共有の画像（Supabase の公開ストレージ）を中継してキャッシュする
 * 共有のデータは Supabase（supabase/share.sql の get_shared_meta）。環境変数は wrangler.toml。
 */
const BOT = /bot|crawler|spider|facebookexternalhit|facebot|line|twitter|slack|discord|whatsapp|telegram|skype|embedly|preview|pinterest|instagram|kakaotalk|mastodon/i;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function meta(env, id) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_shared_meta`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ share_id: id }),
    cf: { cacheTtl: 60, cacheEverything: true },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0] ?? null;
}

function page({ id, m, origin, env }) {
  const viewer = `${env.VIEWER_URL}?id=${id}`;
  const title = m ? `${m.title || '水槽'}${m.owner_name ? `（${m.owner_name} さんの水族館）` : ''} | Aquarium Studio` : 'Aquarium Studio（アクスタ）';
  const desc = m ? 'Aquarium Studio（アクスタ）で作った水槽です。タップすると、泳ぐ生き物を指で回して見られます。' : 'この共有は見つかりません。';
  const img = m?.img ? `${origin}/i/${id}.jpg?v=${Date.parse(m.updated_at) || 0}` : env.DEFAULT_IMAGE;
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Aquarium Studio">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(`${origin}/t/${id}`)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${esc(viewer)}">
</head><body><p><a href="${esc(viewer)}">水槽を開く</a></p><script>location.replace(${JSON.stringify(viewer)})</script></body></html>`;
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const t = url.pathname.match(/^\/t\/([A-Za-z0-9]{10})\/?$/);
    if (t) {
      const id = t[1];
      // 人はそのまま閲覧ページへ（リンクの絵を取りに来たものにだけ HTML を作る）
      if (!BOT.test(req.headers.get('user-agent') ?? '')) return Response.redirect(`${env.VIEWER_URL}?id=${id}`, 302);
      const m = await meta(env, id);
      return new Response(page({ id, m, origin: url.origin, env }), { status: m ? 200 : 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } });
    }
    const i = url.pathname.match(/^\/i\/([A-Za-z0-9]{10})\.jpg$/);
    if (i) {
      const cache = caches.default;
      const hit = await cache.match(req);
      if (hit) return hit;
      const m = await meta(env, i[1]);
      if (!m?.img) return Response.redirect(env.DEFAULT_IMAGE, 302);
      const src = await fetch(`${env.SUPABASE_URL}/storage/v1/object/public/share-img/${m.img}`);
      if (!src.ok) return Response.redirect(env.DEFAULT_IMAGE, 302);
      const res = new Response(src.body, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=86400' } });
      ctx.waitUntil(cache.put(req, res.clone()));
      return res;
    }
    return Response.redirect(env.APP_URL, 302);
  },
};
