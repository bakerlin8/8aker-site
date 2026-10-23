// 8AKER零 通知：把訊息推到 Baker 的 LINE（和 TRS Check-in 同一個官方帳號、同一個對話視窗）。
// 只有帶著正確內部金鑰（資料庫 app_config.notify_key）的請求才能發送。
// daily  ：晚上 9 點，只有「今天沒有新增日常紀錄」才發提醒（有新增就不發）
// weekly：星期日晚上 9 點，這一週新增統整＋助理的話（資料庫 weekly_notes，由排程的 Claude 任務在当天晚上寫好）
import { recordsFlex, reminderFlex, weeklyFlex, type Item } from './cards.ts';
const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const REPO = 'bakerlin8/8aker-site';
const DIRS = ['strengthen', 'emit', 'operate', 'conjure', 'transmute'];
const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

async function db(path: string) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { apikey: SB_KEY, ...(SB_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${SB_KEY}` } : {}) } });
  if (!r.ok) throw new Error(`db ${r.status}`);
  return r.json();
}
async function push(messages: unknown[]) {
  const token = Deno.env.get('LINE_CHANNEL_TOKEN'), to = Deno.env.get('LINE_USER_ID');
  if (!token || !to) return { ok: false, error: 'LINE 的設定還沒填' };
  const r = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, messages }),
  });
  if (!r.ok) return { ok: false, error: `LINE ${r.status}`, detail: (await r.text()).slice(0, 300) };
  return { ok: true };
}
const jst = () => new Date(Date.now() + 9 * 3600e3);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400e3);
const mmdd = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;
const dateLabel = () => { const d = jst(); return { date: mmdd(d), dow: DOW[d.getUTCDay()] }; };

type Entry = Item & { day: string };
// 讀最近幾天有變動的文章，再讀它的 date（文章日期當作「新增日」）
async function recentEntries(days: number): Promise<Entry[]> {
  const gh = (u: string) => fetch(u, { headers: { 'User-Agent': '8aker-notify', Accept: 'application/vnd.github+json', ...(Deno.env.get('GITHUB_TOKEN') ? { Authorization: `Bearer ${Deno.env.get('GITHUB_TOKEN')}` } : {}) } });
  const since = new Date(Date.now() - days * 86400e3).toISOString();
  const cr = await gh(`https://api.github.com/repos/${REPO}/commits?path=src/content&since=${since}&per_page=60`);
  if (!cr.ok) throw new Error(`github ${cr.status}`);
  const commits: any[] = await cr.json();
  const files = new Map<string, string>();
  const details = await Promise.all(commits.map(async (c) => { const r = await gh(`https://api.github.com/repos/${REPO}/commits/${c.sha}`); if (!r.ok) throw new Error(`github ${r.status}`); return r.json(); }));
  for (const det of details) for (const f of det.files || []) {
    const m = /^src\/content\/(strengthen|emit|operate|conjure|transmute)\/[^/]+\.md$/.exec(f.filename);
    if (m && f.status !== 'removed') files.set(f.filename, m[1]);
  }
  const out: Entry[] = [];
  await Promise.all([...files].map(async ([path, dir]) => {
    const r = await fetch(`https://raw.githubusercontent.com/${REPO}/main/${path}`, { headers: { 'Cache-Control': 'no-cache' } });
    if (!r.ok) return;
    const raw = await r.text(), fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)?.[1] || '';
    const get = (k: string) => (new RegExp(`^${k}:\\s*(.*)$`, 'm').exec(fm)?.[1] || '').trim().replace(/^["']|["']$/g, '');
    const day = get('date').slice(0, 10);
    if (!day) return;
    out.push({ dir: DIRS.indexOf(dir), title: get('title') || '（無標題）', draft: get('draft') === 'true', day });
  }));
  return out.sort((a, b) => a.day.localeCompare(b.day) || a.dir - b.dir);
}

// 這一週（週一到週日）的統整
async function weekData() {
  const now = jst(), dow = now.getUTCDay();
  const monday = addDays(now, -((dow + 6) % 7)), sunday = addDays(monday, 6), prevMonday = addDays(monday, -7);
  const all = await recentEntries(18);
  const inRange = (e: Entry, a: Date, b: Date) => e.day >= ymd(a) && e.day <= ymd(b);
  const cur = all.filter((e) => inRange(e, monday, sunday)), prev = all.filter((e) => inRange(e, prevMonday, addDays(monday, -1)));
  const count = (arr: Entry[]) => [0, 1, 2, 3, 4].map((i) => arr.filter((e) => e.dir === i).length);
  let note = '';
  try { const rows = await db(`weekly_notes?week_start=eq.${ymd(monday)}&select=note`); note = rows?.[0]?.note || ''; } catch (_) { /* 沒有助理的話就只送統整 */ }
  return { weekStart: ymd(monday), range: `${mmdd(monday)} – ${mmdd(sunday)}`, cur, items: cur.map(({ day: _d, ...x }) => x) as Item[], counts: count(cur), prevCounts: count(prev), prevTotal: prev.length, note };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const given = req.headers.get('x-notify-key') || '';
  let real = '';
  try { const rows = await db('app_config?key=eq.notify_key&select=value'); real = rows?.[0]?.value || ''; } catch (_) { return json({ error: 'config' }, 500); }
  if (!real || given !== real) return json({ error: 'forbidden' }, 403);
  const b = await req.json().catch(() => ({}));
  const L = dateLabel();
  if (b.action === 'test') {
    const res = await push([{ type: 'text', text: '✅ 8AKER零 通知測試成功' }]);
    return json(res, res.ok ? 200 : 500);
  }
  if (b.action === 'daily') {
    let items: Entry[];
    try { items = (await recentEntries(3)).filter((e) => e.day === ymd(jst())); } catch (e) { return json({ ok: false, error: String((e as Error).message || e) }, 502); }
    if (items.length) return json({ ok: true, sent: false, count: items.length });
    if (b.dry) return json({ ok: true, sent: false, wouldSend: 'reminder' });
    const res = await push([reminderFlex({ ...L })]);
    return json({ ...res, sent: res.ok, count: 0 }, res.ok ? 200 : 500);
  }
  if (b.action === 'weekly') {
    let w;
    try { w = await weekData(); } catch (e) { return json({ ok: false, error: String((e as Error).message || e) }, 502); }
    if (b.dry) return json({ ok: true, dry: true, weekStart: w.weekStart, range: w.range, total: w.items.length, counts: w.counts, prevCounts: w.prevCounts, prevTotal: w.prevTotal, hasNote: !!w.note, titles: w.items.map((x) => x.title) });
    const res = await push([weeklyFlex({ range: w.range, items: w.items, counts: w.counts, prevCounts: w.prevCounts, prevTotal: w.prevTotal, note: w.note })]);
    return json({ ...res, total: w.items.length, hasNote: !!w.note }, res.ok ? 200 : 500);
  }
  return json({ error: 'unknown_action' }, 400);
});
