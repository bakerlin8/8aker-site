// Studio-only API for body data. Every call must carry a Studio token: Google sign-in only (s8.*, verified by 8aker0.com).
import { db, sha256, json, SITE } from './shared.ts';
const STUDIO_EMAILS = ['nr.bater@gmail.com'];

const CORS = { 'Access-Control-Allow-Origin': SITE, 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', Vary: 'Origin' };
const reply = (b: unknown, s = 200) => json(b, s, CORS);
const DAY = 864e5;
const jstDay = (t: number) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10);
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);
const WNAMES: Record<string, string> = { 'Outdoor Run': '戶外跑步', 'Indoor Run': '室內跑步', Running: '跑步', Yoga: '瑜伽', Dance: '跳舞', 'Traditional Strength Training': '重量訓練', 'Functional Strength Training': '功能性訓練', 'Outdoor Walk': '戶外步行', Walking: '步行', 'Pool Swim': '游泳', Swimming: '游泳', Cycling: '騎車', 'Outdoor Cycle': '戶外騎車', HIIT: '高強度間歇', Snowboarding: '滑雪板', Run: '跑步', TrailRun: '越野跑', VirtualRun: '室內跑步', Walk: '步行', Hike: '健行', Ride: '騎車', VirtualRide: '室內騎車', Swim: '游泳', Workout: '訓練', WeightTraining: '重量訓練', Crossfit: 'CrossFit', Pilates: '皮拉提斯', Snowboard: '滑雪板', BackcountrySki: '野雪', AlpineSki: '滑雪', Rowing: '划船', Elliptical: '橢圓機', StairStepper: '踏步機' };

async function owner(req: Request) {
  const t = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!t) return false;
  // Google sign-in (Studio): short-lived token, checked back with the site that issued it.
  if (t.startsWith('s8.')) {
    const v = await fetch(`${SITE}/api/studio_verify`, { headers: { Authorization: `Bearer ${t}` } });
    if (!v.ok) return false;
    const d = await v.json().catch(() => ({}));
    return d.ok === true && STUDIO_EMAILS.includes(String(d.email).toLowerCase());
  }
  // GitHub sign-in was retired on 2026-10-13: nothing else is accepted.
  return false;
}


// ── small config store (private table, service role only) ──
async function cfgGet(keys: string[]) {
  const rows: any[] = await db(`app_config?key=in.(${keys.join(',')})&select=key,value`);
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string>;
}
async function cfgSet(obj: Record<string, string>) {
  await db('app_config?on_conflict=key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(Object.entries(obj).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }))) });
}

// ── Strava：這裡只回報連線狀態，不再自己同步。
// 同步一律交給 health-public（含全部歷史、爬升、1/5/10 公里最佳成績，每 6 小時一次）。
// 以前兩邊都同步，這邊寫入時少了 elev_m 又整筆覆蓋，會把公開儀表板的爬升洗掉（2026-10-23 修正）。
const STRAVA_KEYS = ['strava_client_id', 'strava_client_secret', 'strava_refresh_token', 'strava_access_token', 'strava_expires_at', 'strava_last_sync', 'strava_athlete'];
async function stravaStatus() {
  const c = await cfgGet(STRAVA_KEYS);
  const status: any = { configured: !!(c.strava_client_id && c.strava_client_secret), connected: !!c.strava_refresh_token, last_sync: c.strava_last_sync || null, athlete: c.strava_athlete || null };
  if (status.configured) status.authorize_url = `https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(c.strava_client_id)}&redirect_uri=${encodeURIComponent(SITE + '/studio/')}&response_type=code&approval_prompt=auto&scope=activity:read_all&state=strava`;
  return status;
}

async function overview(dayParam?: string) {
  const strava = await stravaStatus();
  const since = new Date(Date.now() - 90 * DAY).toISOString();
  const rows: any[] = await db(`health_samples?recorded_at=gte.${since}&select=metric,recorded_at,value,unit,extra&order=recorded_at.asc`);
  const posts: any[] = await db('health_posts?select=day,article_path&order=day.desc&limit=30');
  const byDay: Record<string, { mins: number; workouts: any[]; weight: number[]; fat: number[] }> = {};
  for (const r of rows) {
    const d = jstDay(new Date(r.recorded_at).getTime());
    const b = (byDay[d] ||= { mins: 0, workouts: [], weight: [], fat: [] });
    if (r.metric === 'workout') { b.mins += Number(r.value); b.workouts.push({ name: WNAMES[r.extra?.name] ?? r.extra?.name, min: Number(r.value), km: r.extra?.distance_km }); }
    if (r.metric === 'weight_body_mass') b.weight.push(Number(r.value));
    if (r.metric === 'body_fat_percentage') b.fat.push(Number(r.value));
  }
  // last 14 days table
  const days = [...Array(14)].map((_, i) => jstDay(Date.now() - i * DAY));
  const recent = days.map((d) => ({ day: d, mins: Math.round(byDay[d]?.mins ?? 0), workouts: byDay[d]?.workouts ?? [], weight: r1(avg(byDay[d]?.weight ?? [])), fat: r1(avg(byDay[d]?.fat ?? [])), published: posts.some((p) => p.day === d) }));
  // 12 weekly buckets (oldest → newest) for the homepage chart
  const weeks = [...Array(12)].map((_, i) => {
    const end = Date.now() - (11 - i) * 7 * DAY, start = end - 7 * DAY;
    const ds = Object.keys(byDay).filter((d) => { const t = new Date(d + 'T12:00:00+09:00').getTime(); return t > start && t <= end; });
    return { mins: Math.round(ds.reduce((s, d) => s + byDay[d].mins, 0)), weight: r1(avg(ds.flatMap((d) => byDay[d].weight))), fat: r1(avg(ds.flatMap((d) => byDay[d].fat))) };
  });
  const fill = (k: 'weight' | 'fat') => { let last: number | null = null; const first = weeks.find((w) => w[k] != null)?.[k] ?? null; return weeks.map((w) => (last = w[k] ?? last ?? first)); };
  const series = { mins: weeks.map((w) => w.mins), weight: fill('weight'), fat: fill('fat') };
  let streak = 0; for (const d of days) { if ((byDay[d]?.mins ?? 0) > 0 || (byDay[d]?.weight.length ?? 0) > 0) streak++; else if (streak || d !== days[0]) break; }
  const fatVals = series.fat.filter((x) => x != null) as number[];
  const stats = { week_minutes: String(series.mins[11] ?? 0), fat_change: fatVals.length > 1 ? (fatVals[fatVals.length - 1] - fatVals[0] > 0 ? '+' : '−') + Math.abs(r1(fatVals[fatVals.length - 1] - fatVals[0])!).toFixed(1) : '—', streak: String(streak) };
  // draft for the requested day (default: yesterday, JST)
  const day = dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : jstDay(Date.now() - DAY);
  const b = byDay[day];
  const wk7 = (k: 'weight' | 'fat', offset: number) => r1(avg([...Array(7)].flatMap((_, i) => byDay[jstDay(new Date(day + 'T12:00:00+09:00').getTime() - (i + offset) * DAY)]?.[k] ?? [])));
  const draft = {
    day,
    title: `身體紀錄｜${day.replaceAll('-', '.')}`,
    workouts: b?.workouts ?? [],
    minutes: Math.round(b?.mins ?? 0),
    weight: r1(avg(b?.weight ?? [])), fat: r1(avg(b?.fat ?? [])),
    weight7: wk7('weight', 0), weight7prev: wk7('weight', 7), fat7: wk7('fat', 0), fat7prev: wk7('fat', 7),
    week_minutes: series.mins[11] ?? 0,
  };
  const pub = await cfgGet(['public_show_values']);
  return { recent, series, stats, draft, has_data: rows.length > 0, posts, strava, public_show_values: pub.public_show_values === 'true' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (!(await owner(req))) return reply({ error: 'unauthorized' }, 401);
  try {
    const url = new URL(req.url);
    if (req.method === 'GET') return reply(await overview(url.searchParams.get('day') ?? undefined));
    const body = await req.json().catch(() => ({}));
    if (body.action === 'rotate_key') {
      const key = [...crypto.getRandomValues(new Uint8Array(24))].map((x) => x.toString(16).padStart(2, '0')).join('');
      await db('app_config?on_conflict=key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify([{ key: 'ingest_key_sha256', value: await sha256(key), updated_at: new Date().toISOString() }]) });
      return reply({ key }); // shown once in Studio, never stored in plain text
    }
    if (body.action === 'strava_setup') {
      const id = String(body.client_id || '').trim(), secret = String(body.client_secret || '').trim();
      if (!/^\d{3,10}$/.test(id) || !/^[0-9a-f]{40}$/i.test(secret)) return reply({ error: 'Client ID 或 Client Secret 格式不對' }, 400);
      await cfgSet({ strava_client_id: id, strava_client_secret: secret });
      return reply({ ok: true });
    }
    if (body.action === 'strava_exchange' && typeof body.code === 'string' && body.code.length < 200) {
      const c = await cfgGet(STRAVA_KEYS);
      const r = await fetch('https://www.strava.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: c.strava_client_id, client_secret: c.strava_client_secret, code: body.code, grant_type: 'authorization_code' }) });
      if (!r.ok) return reply({ error: 'Strava 授權失敗，請重新連接' }, 400);
      const d = await r.json();
      await cfgSet({ strava_access_token: d.access_token, strava_refresh_token: d.refresh_token, strava_expires_at: String(d.expires_at), strava_last_sync: '', strava_athlete: `${d.athlete?.firstname ?? ''} ${d.athlete?.lastname ?? ''}`.trim() });
      return reply({ ok: true });
    }
    if (body.action === 'set_public') {
      await cfgSet({ public_show_values: body.value ? 'true' : 'false' });
      return reply({ ok: true });
    }
    if (body.action === 'strava_disconnect') {
      await cfgSet({ strava_access_token: '', strava_refresh_token: '', strava_expires_at: '0', strava_last_sync: '' });
      return reply({ ok: true });
    }
    if (body.action === 'mark_published' && /^\d{4}-\d{2}-\d{2}$/.test(body.day) && typeof body.path === 'string') {
      await db('health_posts?on_conflict=day', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify([{ day: body.day, article_path: body.path.slice(0, 200) }]) });
      return reply({ ok: true });
    }
    return reply({ error: 'bad_request' }, 400);
  } catch (e) { return reply({ error: 'server_error', detail: String(e).slice(0, 200) }, 500); }
});
