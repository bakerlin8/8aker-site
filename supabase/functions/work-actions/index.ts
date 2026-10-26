// 作品頁互動數字：試玩次數（play）、♡ 有興趣（like，可取消）、想要自己的版本（want）。
// 公開端只收數字，不存姓名、email；IP 只存單向雜湊。資料在 work_events（RLS 開、沒有 policy → 只有 service role 能讀寫）。
// Studio 端（s8.* token）用 action:'stats' 取彙總。
import { db, sha256, json, SITE } from './shared.ts';
const STUDIO_EMAILS = ['nr.bater@gmail.com'];
const allow = (o: string) => o === 'https://8aker0.com' || o === 'https://www.8aker0.com' || /^https:\/\/8aker-site-[a-z0-9-]+-baker-lin-s-projects\.vercel\.app$/.test(o);
async function owner(req: Request) {
  const t = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!t.startsWith('s8.')) return false;
  const v = await fetch(`${SITE}/api/studio_verify`, { headers: { Authorization: `Bearer ${t}` } });
  if (!v.ok) return false;
  const d = await v.json().catch(() => ({}));
  return d.ok === true && STUDIO_EMAILS.includes(String(d.email).toLowerCase());
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const CORS = { 'Access-Control-Allow-Origin': allow(origin) ? origin : SITE, 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', Vary: 'Origin' };
  const reply = (b: unknown, s = 200) => json(b, s, CORS);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    // Studio：彙總數字
    if ((req.headers.get('authorization') || '').startsWith('Bearer s8.')) {
      if (!(await owner(req))) return reply({ error: 'unauthorized' }, 401);
      const rows = await db('rpc/work_stats', { method: 'POST', body: '{}' });
      return reply({ items: (rows || []).map((r: any) => ({ slug: r.work_slug, plays: Number(r.plays), players: Number(r.players), plays7: Number(r.plays7), likes: Number(r.likes), wants: Number(r.wants), last_at: r.last_at })) });
    }
    if (!allow(origin)) return reply({ error: 'origin' }, 403);
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
    const h = ip ? (await sha256('8aker0:work:' + ip)).slice(0, 32) : null;

    if (req.method === 'GET') {
      const slug = new URL(req.url).searchParams.get('slug') || '';
      if (!/^[a-z0-9-]{1,40}$/.test(slug)) return reply({ error: 'bad_slug' }, 400);
      const likes: any[] = await db(`work_events?work_slug=eq.${slug}&kind=eq.like&active=eq.true&select=id&limit=5000`);
      const mine: any[] = h ? await db(`work_events?work_slug=eq.${slug}&kind=eq.like&active=eq.true&ip_hash=eq.${h}&select=id`) : [];
      return reply({ likes: likes.length, liked: mine.length > 0 });
    }
    if (req.method !== 'POST') return reply({ error: 'method' }, 405);
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== 'object') return reply({ error: 'bad_request' }, 400);
    if (b.website) return reply({ ok: true }); // 蜜罐
    const slug = String(b.slug || '');
    if (!/^[a-z0-9-]{1,40}$/.test(slug)) return reply({ error: 'bad_slug' }, 400);
    if (!h) return reply({ error: 'no_ip' }, 400);

    // 每個 IP 每小時最多 30 筆，擋灌水
    const since = new Date(Date.now() - 3600e3).toISOString();
    const recent: any[] = await db(`work_events?ip_hash=eq.${h}&created_at=gte.${since}&select=id&limit=40`);
    if (recent.length >= 30) return reply({ ok: true, limited: true });

    if (b.action === 'play' || b.action === 'want') {
      // 同一人同一作品：5 分鐘內重複點只算一次
      const kind = b.action;
      const dup: any[] = await db(`work_events?work_slug=eq.${slug}&kind=eq.${kind}&ip_hash=eq.${h}&created_at=gte.${new Date(Date.now() - 300e3).toISOString()}&select=id&limit=1`);
      if (!dup.length) await db('work_events', { method: 'POST', body: JSON.stringify([{ work_slug: slug, kind, ip_hash: h }]) });
      return reply({ ok: true });
    }
    if (b.action === 'like' || b.action === 'unlike') {
      const on = b.action === 'like';
      const ex: any[] = await db(`work_events?kind=eq.like&work_slug=eq.${slug}&ip_hash=eq.${h}&select=id`);
      if (ex.length) await db(`work_events?id=eq.${ex[0].id}`, { method: 'PATCH', body: JSON.stringify({ active: on }) });
      else if (on) await db('work_events', { method: 'POST', body: JSON.stringify([{ work_slug: slug, kind: 'like', active: true, ip_hash: h }]) });
      return reply({ ok: true });
    }
    return reply({ error: 'bad_request' }, 400);
  } catch (_) { return reply({ error: 'server_error' }, 500); }
});
