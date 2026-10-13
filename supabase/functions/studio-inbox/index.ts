// Studio-only inbox for 需求表 submissions. Google sign-in token (s8.*) verified by 8aker0.com.
import { db, json, SITE } from './shared.ts';
const STUDIO_EMAILS = ['nr.bater@gmail.com'];
const CORS = { 'Access-Control-Allow-Origin': SITE, 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', Vary: 'Origin' };
const reply = (b: unknown, s = 200) => json(b, s, CORS);
async function owner(req: Request) {
  const t = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!t.startsWith('s8.')) return false;
  const v = await fetch(`${SITE}/api/studio_verify`, { headers: { Authorization: `Bearer ${t}` } });
  if (!v.ok) return false;
  const d = await v.json().catch(() => ({}));
  return d.ok === true && STUDIO_EMAILS.includes(String(d.email).toLowerCase());
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (!(await owner(req))) return reply({ error: 'unauthorized' }, 401);
  try {
    if (req.method === 'GET') {
      const rows = await db('inquiries?select=id,created_at,service,name,contact,dates,people,message,lang,source,status,note&order=created_at.desc&limit=200');
      return reply({ items: rows });
    }
    const b = await req.json().catch(() => ({}));
    if (b.action === 'update' && /^[0-9a-f-]{36}$/.test(b.id)) {
      const patch: Record<string, string> = {};
      if (['new', 'replied', 'done', 'spam'].includes(b.status)) patch.status = b.status;
      if (typeof b.note === 'string') patch.note = b.note.slice(0, 2000);
      await db(`inquiries?id=eq.${b.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      return reply({ ok: true });
    }
    return reply({ error: 'bad_request' }, 400);
  } catch (e) { return reply({ error: 'server_error' }, 500); }
});
