// RevenueCat の Webhook を受けて、App内課金の付与・返金を反映する（supabase/iap.sql の iap_apply）。
// 公開：Supabase ダッシュボード → Edge Functions → 「revenuecat」という名前で作り、このファイルを貼り付けて Deploy。
//       「Verify JWT」はオフ（RevenueCat は Supabase のトークンを送らないため。代わりに下の合言葉で確かめる）。
// 秘密の値：Edge Functions → Secrets に REVENUECAT_WEBHOOK_AUTH（RevenueCat の Webhook の Authorization header と同じ文字列）。
// SUPABASE_URL・SUPABASE_SERVICE_ROLE_KEY は Supabase が自動で入れる。

const GRANT = new Set(['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE', 'RENEWAL']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
  if (!secret || req.headers.get('Authorization') !== secret) return json({ error: 'unauthorized' }, 401);

  let event: Record<string, unknown>;
  try {
    ({ event } = await req.json());
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  const type = String(event?.type ?? '');
  // 返金は CANCELLATION（cancel_reason が CUSTOMER_SUPPORT）として届く
  const kind = GRANT.has(type) ? 'grant' : type === 'CANCELLATION' && event.cancel_reason === 'CUSTOMER_SUPPORT' ? 'revoke' : null;
  if (!kind) return json({ ok: true, ignored: type }); // TEST・TRANSFER などは何もしない（200 を返して再送させない）

  const user = String(event.app_user_id ?? '');
  const product = String(event.product_id ?? '');
  const id = String(event.id ?? '');
  if (!UUID.test(user) || !product || !id) return json({ ok: true, ignored: 'not a game user' });

  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/iap_apply`, {
    method: 'POST',
    headers: {
      apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_event_id: id, p_user: user, p_product: product, p_kind: kind }),
  });
  if (!res.ok) return json({ error: await res.text() }, 500); // 500 なら RevenueCat が再送する
  return json({ ok: true, result: await res.json() });
});
