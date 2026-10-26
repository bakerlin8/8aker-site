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
    // 祈願所：訪客的想法與建議（純文字）＋各燈籠點亮人數
    if (b.action === 'wish_ideas') {
      const items = await db('wish_events?kind=eq.idea&select=id,created_at,wish_id,body,status&order=created_at.desc&limit=200');
      const counts = await db('rpc/wish_counts', { method: 'POST', body: '{}' });
      return reply({ items, counts });
    }
    if (b.action === 'wish_idea_update' && /^[0-9a-f-]{36}$/.test(b.id) && ['new', 'read', 'used', 'spam'].includes(b.status)) {
      await db(`wish_events?id=eq.${b.id}&kind=eq.idea`, { method: 'PATCH', body: JSON.stringify({ status: b.status }) });
      return reply({ ok: true });
    }
    // 台灣轉帳帳號（私密）：只存在 app_config，不進 GitHub
    if (b.action === 'bank_get') {
      const cfg: any[] = await db('app_config?key=eq.tw_bank&select=value,updated_at');
      return reply({ bank: cfg[0]?.value ? JSON.parse(cfg[0].value) : null, updated_at: cfg[0]?.updated_at || null });
    }
    if (b.action === 'bank_set') {
      const c = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
      const bank = { name: c(b.name, 60), acct: c(b.acct, 40), holder: c(b.holder, 60) };
      if (bank.acct && !/^[0-9 -]{6,40}$/.test(bank.acct)) return reply({ error: '帳號只能有數字、空格和 -' }, 400);
      await db('app_config?on_conflict=key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify([{ key: 'tw_bank', value: JSON.stringify(bank), updated_at: new Date().toISOString() }]) });
      return reply({ ok: true });
    }
    return reply({ error: 'bad_request' }, 400);
  } catch (e) { return reply({ error: 'server_error' }, 500); }
});
