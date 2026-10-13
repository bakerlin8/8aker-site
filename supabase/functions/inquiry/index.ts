// Public 需求表 endpoint. Stores a request in the private inbox (service role only). No email is sent.
import { db, sha256, json, SITE } from './shared.ts';
const CORS = { 'Access-Control-Allow-Origin': SITE, 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' };
const reply = (b: unknown, s = 200) => json(b, s, CORS);
const SERVICES = ['property', 'owner', 'omakase', 'interpret', 'ai', 'other'];
const clip = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return reply({ error: 'method' }, 405);
  if ((req.headers.get('origin') || '') !== SITE) return reply({ error: 'origin' }, 403);
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== 'object') return reply({ error: 'bad_request' }, 400);
  if (b.website) return reply({ ok: true }); // honeypot: bots fill hidden fields
  const row = {
    service: SERVICES.includes(b.service) ? b.service : 'other',
    name: clip(b.name, 80), contact: clip(b.contact, 160), dates: clip(b.dates, 120),
    people: clip(b.people, 40), message: clip(b.message, 3000), lang: clip(b.lang, 10), source: clip(b.source, 60) || null,
  };
  if (!row.name || !row.contact || row.message.length < 5) return reply({ error: '請填寫稱呼、聯絡方式和需求內容' }, 400);
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const ip_hash = ip ? (await sha256('8aker0:' + ip)).slice(0, 32) : null;
  if (ip_hash) {
    const since = new Date(Date.now() - 60 * 60e3).toISOString();
    const recent: any[] = await db(`inquiries?ip_hash=eq.${ip_hash}&created_at=gte.${since}&select=id`);
    if (recent.length >= 5) return reply({ error: '送出次數太多，請稍後再試' }, 429);
  }
  try { await db('inquiries', { method: 'POST', body: JSON.stringify([{ ...row, ip_hash }]) }); }
  catch (_) { return reply({ error: '暫時無法送出，請稍後再試' }, 500); }
  return reply({ ok: true });
});
