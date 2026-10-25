// Public, read-only summary for the 強化 page dashboard.
// Returns only aggregates / daily totals the owner chose to show. Raw samples never leave the database.
import { db, SITE } from './shared.ts';

const DAY = 864e5;
const jstNum = (t: number) => Math.floor((t + 9 * 3600e3) / DAY);          // JST day number
const dayStr = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
const wkIdx = (n: number) => Math.floor((n + 3) / 7);                       // Monday-start week index
const dowOf = (n: number) => (n + 3) % 7;                                   // Mon=0 … Sun=6
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);
const NAMES: Record<string, string> = { Run: '跑步', TrailRun: '越野跑', VirtualRun: '室內跑步', Walk: '步行', Hike: '健行', Ride: '騎車', VirtualRide: '室內騎車', Swim: '游泳', Workout: '訓練', WeightTraining: '重量訓練', Yoga: '瑜伽', Pilates: '皮拉提斯', Dance: '跳舞', Crossfit: 'CrossFit', HIIT: '高強度間歇', Snowboard: '滑雪板', BackcountrySki: '野雪', AlpineSki: '滑雪', Rowing: '划船', Elliptical: '橢圓機', StairStepper: '踏步機' };
const RUNS = ['Run', 'TrailRun', 'VirtualRun'];
const HEAD = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': SITE, Vary: 'Origin', 'Cache-Control': 'public, max-age=300' };

async function cfg(keys: string[]) {
  const rows: any[] = await db(`app_config?key=in.(${keys.join(',')})&select=key,value`);
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string>;
}
async function cfgSet(obj: Record<string, string>) {
  await db('app_config?on_conflict=key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(Object.entries(obj).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }))) });
}

// Keep Strava fresh without hammering it: at most once every 6 hours, triggered by page views.
// First run (or when strava_full_sync isn't 'done') pulls the whole history; later runs pull the last 35 days.
// Each run also fetches best efforts for up to 35 not-yet-checked runs (Strava allows 100 reads / 15 min).
async function maybeSyncStrava(c: Record<string, string>) {
  if (!c.strava_refresh_token || !c.strava_client_id) return;
  if (c.strava_last_sync && Date.now() - new Date(c.strava_last_sync).getTime() < 6 * 3600e3) return;
  try {
    await cfgSet({ strava_last_sync: new Date().toISOString() });   // claim first so parallel visitors don't double-run
    let token = c.strava_access_token;
    if (!(Number(c.strava_expires_at || 0) > Date.now() / 1000 + 300)) {
      const r = await fetch('https://www.strava.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: c.strava_client_id, client_secret: c.strava_client_secret, grant_type: 'refresh_token', refresh_token: c.strava_refresh_token }) });
      if (!r.ok) return;
      const d = await r.json(); token = d.access_token;
      await cfgSet({ strava_access_token: d.access_token, strava_refresh_token: d.refresh_token, strava_expires_at: String(d.expires_at) });
    }
    const H = { Authorization: `Bearer ${token}` };
    const full = c.strava_full_sync !== 'done';
    const after = full ? 0 : Math.floor((Date.now() - 35 * DAY) / 1000);
    const acts: any[] = [];
    for (let page = 1; page <= 8; page++) {
      const r = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=200&page=${page}`, { headers: H });
      if (!r.ok) break;
      const part: any[] = await r.json();
      acts.push(...part);
      if (part.length < 200) { if (full) await cfgSet({ strava_full_sync: 'done' }); break; }
    }
    const rows = acts.map((a) => ({ metric: 'workout', recorded_at: new Date(a.start_date).toISOString(), value: Math.round((a.moving_time || 0) / 6) / 10, unit: 'min',
      extra: { name: a.sport_type || a.type, distance_km: a.distance ? Math.round(a.distance / 100) / 10 : null, elev_m: a.total_elevation_gain != null ? Math.round(a.total_elevation_gain) : null, source: 'strava', id: a.id } }));
    for (let i = 0; i < rows.length; i += 100) {
      await db('health_samples?on_conflict=metric,recorded_at', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(rows.slice(i, i + 100)) });
    }
    // best efforts for runs not checked yet
    const done: any[] = await db('strava_best?select=activity_id&limit=5000');
    const have = new Set((done || []).map((x) => Number(x.activity_id)));
    const old: any[] = await db(`health_samples?metric=eq.workout&select=recorded_at,extra&order=recorded_at.desc&limit=2000`);
    const todo: any[] = (old || []).filter((o) => RUNS.includes(o.extra?.name) && o.extra?.id && !have.has(Number(o.extra.id))).slice(0, 35);


    const out: any[] = [];
    for (const t of todo) {
      const id = Number(t.extra.id);
      const r = await fetch(`https://www.strava.com/api/v3/activities/${id}`, { headers: H });
      if (r.status === 429 || r.status === 401 || r.status === 403) break;
      if (!r.ok) continue;
      const d = await r.json(); const be: any[] = Array.isArray(d.best_efforts) ? d.best_efforts : [];
      const pick = (n: string) => { const x = be.find((e) => String(e.name || e.type_value || '').toLowerCase().replace('fastest', '') === n); return x ? Number(x.elapsed_time ?? x.value) : null; };
      out.push({ activity_id: id, day: dayStr(jstNum(new Date(t.recorded_at).getTime())), k1: pick('1k'), k5: pick('5k'), k10: pick('10k') });
    }
    if (out.length) await db('strava_best?on_conflict=activity_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(out) });
  } catch (_) { /* a failed refresh just means slightly older data */ }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...HEAD, 'Access-Control-Allow-Methods': 'GET' } });
  if (req.method !== 'GET') return new Response('{}', { status: 405, headers: HEAD });
  try {
    const c = await cfg(['strava_client_id', 'strava_client_secret', 'strava_refresh_token', 'strava_access_token', 'strava_expires_at', 'strava_last_sync', 'strava_full_sync', 'public_show_values']);
    await maybeSyncStrava(c);
    const now = Date.now(), today = jstNum(now), thisWk = wkIdx(today);
    const wk: any[] = await db(`health_samples?metric=eq.workout&select=recorded_at,value,extra&order=recorded_at.asc&limit=5000`);
    const body: any[] = await db(`health_samples?metric=in.(weight_body_mass,body_fat_percentage)&recorded_at=gte.${new Date(now - 100 * DAY).toISOString()}&select=metric,recorded_at,value&order=recorded_at.asc`);
    const stepRows: any[] = await db(`health_samples?metric=eq.steps&recorded_at=gte.${new Date(now - 100 * DAY).toISOString()}&select=recorded_at,value&order=recorded_at.asc`);
    const kmRows: any[] = await db(`health_samples?metric=eq.walking_distance_km&recorded_at=gte.${new Date(now - 100 * DAY).toISOString()}&select=recorded_at,value&order=recorded_at.asc`);
    const lastRows: any[] = await db('health_samples?select=received_at&order=received_at.desc&limit=1');
    const best: any[] = await db('strava_best?select=day,k1,k5,k10&limit=5000');

    // ── workouts → per-day totals
    type Day = { m: number; k: number; e: number; n: number; t: Record<string, number> };
    const days = new Map<number, Day>();
    const acts = wk.map((r) => { const dn = jstNum(new Date(r.recorded_at).getTime()); return { dn, type: r.extra?.name || 'Workout', min: Number(r.value) || 0, km: Number(r.extra?.distance_km) || 0, elev: Number(r.extra?.elev_m) || 0, t: new Date(r.recorded_at).getTime() }; });
    for (const a of acts) {
      const d = days.get(a.dn) || { m: 0, k: 0, e: 0, n: 0, t: {} };
      d.m += a.min; d.k += a.km; d.e += a.elev; d.n++; d.t[a.type] = (d.t[a.type] || 0) + 1; days.set(a.dn, d);
    }
    const typeLabel = (t: string) => NAMES[t] ?? t;

    // ── week stats (Mon-start)
    const weekAgg = (idx: number) => { let m = 0, k = 0, e = 0, n = 0; const dots: (number | null)[] = Array(7).fill(null);
      for (const [dn, d] of days) if (wkIdx(dn) === idx) { m += d.m; k += d.k; e += d.e; n += d.n; dots[dowOf(dn)] = Math.round(d.m); }
      return { mins: Math.round(m), km: r1(k), elev: Math.round(e), n, dots }; };
    const cur = weekAgg(thisWk), prev = weekAgg(thisWk - 1);
    // week streak: consecutive weeks with ≥1 workout; the current week doesn't break it until it ends
    const activeWeeks = new Set([...days.keys()].map(wkIdx));
    let streak = 0; let w = activeWeeks.has(thisWk) ? thisWk : thisWk - 1;
    while (activeWeeks.has(w)) { streak++; w--; }
    let longest = 0, run = 0; const sorted = [...activeWeeks].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) { run = i && sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1; longest = Math.max(longest, run); }

    // ── 12-week trend (all + by type)
    const topTypes = Object.entries(acts.reduce((m: Record<string, number>, a) => ((m[a.type] = (m[a.type] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).slice(0, 5).map((x) => x[0]);
    const weeks = [...Array(12)].map((_, i) => {
      const idx = thisWk - (11 - i); const o: any = { end: dayStr(idx * 7 - 3 + 6), mins: 0, km: 0, n: 0, by: {} as Record<string, number> };
      for (const [dn, d] of days) if (wkIdx(dn) === idx) { o.mins += d.m; o.km += d.k; o.n += d.n; }
      for (const a of acts) if (wkIdx(a.dn) === idx && topTypes.includes(a.type)) o.by[a.type] = (o.by[a.type] || 0) + a.min;
      return o;
    });

    // ── body (weekly average, filled forward)
    const bw = [...Array(12)].map((_, i) => { const idx = thisWk - (11 - i); const ws = body.filter((b) => b.metric === 'weight_body_mass' && wkIdx(jstNum(new Date(b.recorded_at).getTime())) === idx).map((b) => Number(b.value));
      const fs = body.filter((b) => b.metric === 'body_fat_percentage' && wkIdx(jstNum(new Date(b.recorded_at).getTime())) === idx).map((b) => Number(b.value)); return { w: r1(avg(ws)), f: r1(avg(fs)) }; });
    const fill = (k: 'w' | 'f') => { let last: number | null = null; const first = bw.find((x) => x[k] != null)?.[k] ?? null; return bw.map((x) => (last = x[k] ?? last ?? first)); };
    const fatS = fill('f').filter((x) => x != null) as number[];
    const lastOf = (m: string) => { const x = [...body].reverse().find((b) => b.metric === m); return x ? { v: Number(x.value), day: dayStr(jstNum(new Date(x.recorded_at).getTime())) } : null; };
    const lw = lastOf('weight_body_mass'), lf = lastOf('body_fat_percentage');

    // ── best efforts + 10k estimate (Riegel from best 5k in last 90 days)
    const bestOf = (k: 'k1' | 'k5' | 'k10', fromDay = -1e9) => { const c = best.filter((b) => b[k] != null && jstNum(new Date(b.day + 'T12:00:00+09:00').getTime()) >= fromDay).sort((a, b) => a[k] - b[k])[0]; return c ? { sec: Number(c[k]), day: c.day } : null; };
    const yStart = jstNum(new Date(new Date(now + 9 * 3600e3).getUTCFullYear() + '-01-01T00:00:00+09:00').getTime());
    const rec5 = bestOf('k5', today - 90);
    const topOf = (k: 'k1' | 'k5' | 'k10') => best.filter((b) => b[k] != null).sort((a, b) => a[k] - b[k]).slice(0, 5).map((b) => ({ sec: Number(b[k]), day: b.day }));
    const records = { top: { k1: topOf('k1'), k5: topOf('k5'), k10: topOf('k10') }, k1: bestOf('k1'), k5: bestOf('k5'), k10: bestOf('k10'), year: { k1: bestOf('k1', yStart), k5: bestOf('k5', yStart), k10: bestOf('k10', yStart) } };
    const predict10k = rec5 ? { sec: Math.round(rec5.sec * Math.pow(2, 1.06)), from: '5k', day: rec5.day } : null;

    // ── calendar days (last 400 days) compact: [date, mins, km, elev, "跑步,瑜伽"]
    // daily steps (one row per JST day); weeks.steps = average steps per recorded day
    const stepDay = new Map<number, number>();
    for (const r of stepRows || []) stepDay.set(jstNum(new Date(r.recorded_at).getTime()), Number(r.value) || 0);
    const stepAvgOf = (idx: number) => { const v = [...stepDay].filter(([dn]) => wkIdx(dn) === idx).map(([, n]) => n); return v.length ? Math.round(avg(v) as number) : null; };
    const stepWeeks = [...Array(12)].map((_, i) => stepAvgOf(thisWk - (11 - i)));
    const stepDots: (number | null)[] = Array(7).fill(null);
    for (const [dn, n] of stepDay) if (wkIdx(dn) === thisWk) stepDots[dowOf(dn)] = n;
    const stepLastDn = stepDay.size ? Math.max(...stepDay.keys()) : null;
    // daily walking distance (km), same shape as steps
    const kmDay = new Map<number, number>();
    for (const r of kmRows || []) kmDay.set(jstNum(new Date(r.recorded_at).getTime()), Number(r.value) || 0);
    const kmSumOf = (idx: number) => r1([...kmDay].filter(([dn]) => wkIdx(dn) === idx).reduce((t, [, n]) => t + n, 0)) as number;
    const kmWeeks = [...Array(12)].map((_, i) => kmSumOf(thisWk - (11 - i)));
    const steps = (stepDay.size || kmDay.size) ? {
      today: stepDay.get(today) ?? null, last_day: stepLastDn != null ? dayStr(stepLastDn) : null,
      week_avg: stepAvgOf(thisWk), last_week_avg: stepAvgOf(thisWk - 1), dots: stepDots,
      days: [...stepDay].filter(([dn]) => dn >= today - 60).sort((a, b) => a[0] - b[0]).map(([dn, n]) => [dayStr(dn), n]),
      km_today: kmDay.get(today) ?? null, km_week: kmSumOf(thisWk), km_last_week: kmSumOf(thisWk - 1),
      km_days: [...kmDay].filter(([dn]) => dn >= today - 60).sort((a, b) => a[0] - b[0]).map(([dn, n]) => [dayStr(dn), r1(n)]),
    } : null;

    const cal: any[] = [];
    for (const [dn, d] of days) if (dn >= today - 400) cal.push([dayStr(dn), Math.round(d.m), r1(d.k), Math.round(d.e), Object.keys(d.t).map(typeLabel).join('・')]);
    cal.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const recent = acts.slice(-6).reverse().map((a) => ({ date: dayStr(a.dn), name: typeLabel(a.type), min: Math.round(a.min), km: a.km || null }));
    const lastRecv = lastRows?.[0]?.received_at ? new Date(lastRows[0].received_at).toISOString() : null;
    const show = c.public_show_values === 'true';

    const out: any = {
      updated_at: lastRecv, strava_synced_at: c.strava_last_sync || null, show_values: show,
      total_activities: acts.length, first_day: acts.length ? dayStr(acts[0].dn) : null,
      streak_weeks: streak, longest_streak_weeks: longest,
      this_week: cur, last_week: prev, week_start: dayStr(thisWk * 7 - 3),
      weeks: { labels: weeks.map((x) => x.end.slice(5).replace('-', '/')), mins: weeks.map((x) => Math.round(x.mins)), km: weeks.map((x) => r1(x.km)),
        types: topTypes.map((t) => ({ key: t, name: typeLabel(t), mins: weeks.map((x) => Math.round(x.by[t] || 0)) })) },
      calendar: cal, steps, records, predict10k, recent,
      stats: { week_minutes: cur.mins, week_sessions: cur.n, streak_weeks: streak, fat_change: fatS.length > 1 && bw.filter((x) => x.f != null).length > 1 ? Math.round((fatS[fatS.length - 1] - fatS[0]) * 10) / 10 : null,
        scale_weeks: bw.filter((x) => x.f != null || x.w != null).length },
      scale_last_day: lw?.day || lf?.day || null,
    };
    if (stepDay.size) out.weeks.steps = stepWeeks;
    if (kmDay.size) out.weeks.walk_km = kmWeeks;
    if (show) { out.weeks.weight = fill('w'); out.weeks.fat = fill('f'); out.body_now = { weight: lw, fat: lf }; }
    return new Response(JSON.stringify(out), { headers: HEAD });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'unavailable' }), { status: 503, headers: { ...HEAD, 'Cache-Control': 'no-store' } });
  }
});
