// Public 祈願所 endpoint: lantern ♡ (one per hashed IP, can be toggled) and 💡 ideas (plain text, no contact info).
// Rows live in wish_events (RLS on, no policies → service role only). Ideas are read in Studio.
import { db, sha256, json } from './shared.ts';
const allow = (o: string) => o === 'https://8aker0.com' || o === 'https://www.8aker0.com' || /^https:\/\/8aker-site-[a-z0-9-]+-baker-lin-s-projects\.vercel\.app$/.test(o);
const clip = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n);

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const CORS = { 'Access-Control-Allow-Origin': allow(origin) ? origin : 'https://8aker0.com', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', Vary: 'Origin' };
  const reply = (b: unknown, s = 200) => json(b, s, CORS);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (!allow(origin)) return reply({ error: 'origin' }, 403);
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const h = ip ? (await sha256('8aker0:wish:' + ip)).slice(0, 32) : null;
  try {
    if (req.method === 'GET') {
      const rows: any[] = await db('rpc/wish_counts', { method: 'POST', body: '{}' });
      const counts: Record<string, { l: number; n: number }> = {};
      for (const r of rows) counts[r.wish_id] = { l: Number(r.likes), n: Number(r.ideas) };
      const mine: any[] = h ? await db(`wish_events?kind=eq.like&active=eq.true&ip_hash=eq.${h}&select=wish_id`) : [];
      return reply({ counts, mine: mine.map((m) => m.wish_id) });
    }
    if (req.method !== 'POST') return reply({ error: 'method' }, 405);
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== 'object') return reply({ error: 'bad_request' }, 400);
    if (b.website) return reply({ ok: true }); // honeypot
    const id = String(b.id || '');
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return reply({ error: 'bad_id' }, 400);
    if (!h) return reply({ error: 'no_ip' }, 400);

    if (b.action === 'like' || b.action === 'unlike') {
      const on = b.action === 'like';
      const ex: any[] = await db(`wish_events?kind=eq.like&wish_id=eq.${id}&ip_hash=eq.${h}&select=id`);
      if (ex.length) await db(`wish_events?id=eq.${ex[0].id}`, { method: 'PATCH', body: JSON.stringify({ active: on }) });
      else if (on) {
        const all: any[] = await db(`wish_events?kind=eq.like&ip_hash=eq.${h}&select=id&limit=60`);
        if (all.length >= 40) return reply({ error: 'too_many' }, 429);
        await db('wish_events', { method: 'POST', body: JSON.stringify([{ wish_id: id, kind: 'like', active: true, ip_hash: h }]) });
      }
      return reply({ ok: true });
    }
    if (b.action === 'idea') {
      const text = clip(b.text, 300);
      if (text.length < 4) return reply({ error: '想法再多寫一點點吧（至少 4 個字）' }, 400);
      const since = new Date(Date.now() - 60 * 60e3).toISOString();
      const recent: any[] = await db(`wish_events?kind=eq.idea&ip_hash=eq.${h}&created_at=gte.${since}&select=id`);
      if (recent.length >= 3) return reply({ error: '送出次數太多，請稍後再試' }, 429);
      await db('wish_events', { method: 'POST', body: JSON.stringify([{ wish_id: id, kind: 'idea', body: text, ip_hash: h }]) });
      return reply({ ok: true });
    }
    return reply({ error: 'bad_request' }, 400);
  } catch (_) { return reply({ error: '暫時無法連線，請稍後再試' }, 500); }
});
