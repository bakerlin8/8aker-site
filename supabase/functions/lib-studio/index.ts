// Studio-only library (素材庫): list / add / update / delete rows of lib_items.
// Google sign-in token (s8.*) verified by 8aker0.com, same pattern as studio-inbox.
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

const STATUS = ['candidate', 'inbox', 'learning', 'practice', 'done'];
const KIND = ['learn', 'style', 'motion', 'prompt', 'other'];
const TEXT: Record<string, number> = { title: 300, why: 500, column_name: 40, origin: 200, pain: 1000, solution: 1000, result: 1000, cta: 500, prompt: 8000, source_text: 8000, takeaway: 2000 };

// Keeps only known fields with sane types and lengths; anything else is dropped.
function clean(b: any) {
  const p: Record<string, unknown> = {};
  for (const [k, n] of Object.entries(TEXT)) if (typeof b[k] === 'string') p[k] = b[k].slice(0, n);
  if (STATUS.includes(b.status)) { p.status = b.status; p.done_at = b.status === 'done' ? new Date().toISOString() : null; }
  if (KIND.includes(b.kind)) p.kind = b.kind;
  if (b.vis === 'private' || b.vis === 'public') p.vis = b.vis;
  if (typeof b.show_origin === 'boolean') p.show_origin = b.show_origin;
  if (Array.isArray(b.tags)) p.tags = b.tags.map((t: unknown) => String(t).trim().slice(0, 30)).filter(Boolean).slice(0, 8);
  if (Array.isArray(b.steps)) p.steps = b.steps.slice(0, 30).map((s: any) => ({ t: String(s?.t ?? '').slice(0, 200), done: !!s?.done })).filter((s: any) => s.t);
  if (Array.isArray(b.log)) p.log = b.log.slice(0, 200).map((l: any) => ({ d: Number(l?.d) || Date.now(), t: String(l?.t ?? '').slice(0, 500) })).filter((l: any) => l.t);
  return p;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (!(await owner(req))) return reply({ error: 'unauthorized' }, 401);
  try {
    if (req.method === 'GET') {
      const rows = await db('lib_items?select=*&order=created_at.desc&limit=1000');
      return reply({ items: rows });
    }
    const b = await req.json().catch(() => ({}));
    const uuid = /^[0-9a-f-]{36}$/;
    if (b.action === 'add') {
      const row: Record<string, unknown> = { ...clean(b), status: STATUS.includes(b.status) ? b.status : 'inbox' };
      if (typeof b.url === 'string' && /^https?:\/\//i.test(b.url.trim())) { row.url = b.url.trim().slice(0, 1000); try { row.platform = new URL(row.url as string).hostname.replace(/^www\./, ''); } catch { /* keep empty */ } }
      if (!row.url && !row.prompt && !row.title) return reply({ error: '請貼連結或提示詞' }, 400);
      const saved = await db('lib_items', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
      return reply({ ok: true, item: saved?.[0] });
    }
    if (b.action === 'update' && uuid.test(b.id)) {
      const p = { ...clean(b), updated_at: new Date().toISOString() };
      await db(`lib_items?id=eq.${b.id}`, { method: 'PATCH', body: JSON.stringify(p) });
      return reply({ ok: true });
    }
    if (b.action === 'delete' && uuid.test(b.id)) {
      await db(`lib_items?id=eq.${b.id}`, { method: 'DELETE' });
      return reply({ ok: true });
    }
    return reply({ error: 'bad_request' }, 400);
  } catch (e) {
    if (String((e as Error)?.message).startsWith('db 409')) return reply({ error: '這個連結已經存過了' }, 409);
    return reply({ error: 'server_error' }, 500);
  }
});
