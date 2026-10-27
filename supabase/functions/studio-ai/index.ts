// Studio AI 助手：把「請 AI 處理」的需求排進佇列（ai_jobs），由排程的 Claude 任務定時處理後寫回結果。也負責通知設定的讀寫。
import { db, json, SITE } from './shared.ts';
const STUDIO_EMAILS = ['nr.bater@gmail.com'];
const CORS = { 'Access-Control-Allow-Origin': SITE, 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', Vary: 'Origin' };
const reply = (b: unknown, s = 200) => json(b, s, CORS);
const DEFAULT_SETTINGS = { daily: { on: true, hour: 21, minute: 0, days: [1, 2, 3, 4, 5, 6] }, weekly: { on: true, day: 0, hour: 21, minute: 0 }, inquiry: { on: true } };
const int = (v: unknown, lo: number, hi: number, d: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };
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
    const b = await req.json().catch(() => ({}));
    if (b.action === 'list') {
      const rows = await db('ai_jobs?status=neq.dismissed&select=id,created_at,done_at,kind,pillar,title,status,result,ref&order=created_at.desc&limit=12');
      return reply({ items: rows });
    }
    if (b.action === 'count') {
      const rows: any[] = await db('ai_jobs?status=in.(pending,done,error)&select=id,created_at,done_at,kind,pillar,title,status,ref&order=created_at.desc&limit=30');
      return reply({ pending: rows.filter((r) => r.status === 'pending').length, done: rows.filter((r) => r.status === 'done'), error: rows.filter((r) => r.status === 'error').length });
    }
    if (b.action === 'submit') {
      if (!['outline', 'polish', 'review', 'translate'].includes(b.kind)) return reply({ error: 'bad_kind' }, 400);
      const input = String(b.input ?? '').trim().slice(0, 20000);
      if (input.length < 5) return reply({ error: '內容太少，先寫幾句再送出' }, 400);
      const pend = await db('ai_jobs?status=eq.pending&select=id');
      if ((pend || []).length >= 20) return reply({ error: '排隊的太多了，等下一輪處理完再送' }, 429);
      const ref = /^src\/[\w\-./]+\.mdx?$/.test(String(b.ref ?? '')) ? String(b.ref) : null;
      const row = { kind: b.kind, pillar: String(b.pillar ?? '').slice(0, 20), title: String(b.title ?? '').slice(0, 200), input, ref };
      const r = await db('ai_jobs', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
      return reply({ ok: true, id: r?.[0]?.id });
    }
    if (b.action === 'dismiss' && /^[0-9a-f-]{36}$/.test(b.id)) {
      await db(`ai_jobs?id=eq.${b.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'dismissed' }) });
      return reply({ ok: true });
    }
    if (b.action === 'settings_get') {
      const rows: any[] = await db('app_config?key=eq.notify_settings&select=value');
      let s = DEFAULT_SETTINGS; try { if (rows?.[0]?.value) s = { ...DEFAULT_SETTINGS, ...JSON.parse(rows[0].value) }; } catch (_) { /* 用預設 */ }
      return reply({ settings: s });
    }
    if (b.action === 'settings_set') {
      const x = b.settings || {};
      const days = Array.isArray(x.daily?.days) ? [...new Set(x.daily.days.map((n: unknown) => int(n, 0, 6, -1)).filter((n: number) => n >= 0))] : DEFAULT_SETTINGS.daily.days;
      const s = {
        daily: { on: x.daily?.on !== false, hour: int(x.daily?.hour, 0, 23, 21), minute: Number(x.daily?.minute) === 30 ? 30 : 0, days },
        weekly: { on: x.weekly?.on !== false, day: int(x.weekly?.day, 0, 6, 0), hour: int(x.weekly?.hour, 0, 23, 21), minute: Number(x.weekly?.minute) === 30 ? 30 : 0 },
        inquiry: { on: true },
      };
      await db('app_config?on_conflict=key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify([{ key: 'notify_settings', value: JSON.stringify(s), updated_at: new Date().toISOString() }]) });
      return reply({ ok: true, settings: s });
    }
    return reply({ error: 'bad_request' }, 400);
  } catch (_e) { return reply({ error: 'server_error' }, 500); }
});
