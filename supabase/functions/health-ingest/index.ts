// Receives Health Auto Export (iOS) REST automation payloads.
// Auth: header "x-8aker-key" must match the key generated in Studio (only its SHA-256 is stored).
import { db, sha256, json } from './shared.ts';

const KEEP: Record<string, string> = { weight_body_mass: 'kg', body_fat_percentage: '%', lean_body_mass: 'kg', resting_heart_rate: 'bpm' };
// Reads ISO dates and also the localized strings Shortcuts produces, e.g. "2026/09/24 21:23",
// "2026年9月24日 下午9:23", "2026-09-24 21:23:00 +0900". Dates without a zone are taken as Japan time.
// Returns null (instead of throwing) when nothing sensible can be read.
const toIso = (raw: string) => {
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) { const d = new Date(s); if (!isNaN(d.getTime())) return d.toISOString(); }
  const dm = s.match(/(\d{4})\s*[-/年.]\s*(\d{1,2})\s*[-/月.]\s*(\d{1,2})/);
  if (!dm) { const d = new Date(s.replace(/\bat\b/, '')); return isNaN(d.getTime()) ? null : d.toISOString(); }
  const rest = s.slice((dm.index ?? 0) + dm[0].length);
  const tm = rest.match(/(\d{1,2})\s*[:：時]\s*(\d{2})(?:\s*[:：分]\s*(\d{2}))?/);
  let H = tm ? Number(tm[1]) : 12;
  if (/下午|午後|PM|pm/.test(rest) && H < 12) H += 12;
  if (/上午|午前|AM|am/.test(rest) && H === 12) H = 0;
  const off = rest.match(/([+-]\d{2}):?(\d{2})\s*$/);
  const zone = off ? `${off[1]}:${off[2]}` : '+09:00';
  const p2 = (x: string | number) => String(x).padStart(2, '0');
  const out = new Date(`${dm[1]}-${p2(dm[2])}-${p2(dm[3])}T${p2(H)}:${tm ? tm[2] : '00'}:${tm?.[3] ?? '00'}${zone}`);
  return isNaN(out.getTime()) ? null : out.toISOString();
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const key = req.headers.get('x-8aker-key') || '';
  const cfg = await db('app_config?key=eq.ingest_key_sha256&select=value');
  if (!key || !cfg?.[0] || (await sha256(key)) !== cfg[0].value) return json({ error: 'unauthorized' }, 401);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const data = body?.data ?? body;
  const rows: any[] = [];
  // iPhone Shortcuts format: { date, weight, fat, exercise_minutes } — each field optional, date in ISO 8601.
  if (body && (body.weight != null || body.fat != null || body.exercise_minutes != null || body.steps != null)) {
    const at = (body.date && toIso(String(body.date))) || new Date().toISOString();
    const num = (x: any) => { const n = Number(String(x).replace(/[^0-9.]/g, '')); return isFinite(n) && n > 0 ? n : null; };
    const w = num(body.weight), f = num(body.fat), m = num(body.exercise_minutes), st = num(body.steps);
    if (w != null) rows.push({ metric: 'weight_body_mass', recorded_at: at, value: Math.round(w * 100) / 100, unit: 'kg' });
    if (f != null) rows.push({ metric: 'body_fat_percentage', recorded_at: at, value: Math.round((f <= 1 ? f * 100 : f) * 100) / 100, unit: '%' });
    const day = /^\d{4}-\d{2}-\d{2}/.test(String(body.date || '')) ? String(body.date).slice(0, 10) : new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    // Daily step total (from Xiaomi → Apple Health → Shortcut). One row per day; re-sending the same day overwrites it.
    if (st != null && st < 200000) rows.push({ metric: 'steps', recorded_at: `${day}T12:00:00+09:00`, value: Math.round(st), unit: 'count' });
    if (m != null) rows.push({ metric: 'exercise_minutes', recorded_at: `${day}T12:00:00+09:00`, value: Math.round(m), unit: 'min' });
  }
  for (const m of data?.metrics ?? []) {
    if (!(m?.name in KEEP)) continue;
    for (const d of m.data ?? []) {
      const v = Number(d.qty ?? d.Avg ?? d.avg);
      const iso = d.date ? toIso(d.date) : null;
      if (!iso || !isFinite(v)) continue;
      let value = v, unit = m.units || KEEP[m.name];
      if (m.name === 'body_fat_percentage' && v <= 1) value = v * 100;      // some exports send 0.21
      if (m.name === 'weight_body_mass' && /lb/i.test(unit)) { value = v * 0.45359237; unit = 'kg'; }
      rows.push({ metric: m.name, recorded_at: iso, value: Math.round(value * 100) / 100, unit });
    }
  }
  // Health Auto Export step_count: sum the samples of each JST day into one daily row.
  for (const m of data?.metrics ?? []) {
    if (m?.name !== 'step_count') continue;
    const perDay: Record<string, number> = {};
    for (const d of m.data ?? []) {
      const v = Number(d.qty); const iso = d.date ? toIso(d.date) : null;
      if (!iso || !isFinite(v) || v < 0) continue;
      const day = new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 10);
      perDay[day] = (perDay[day] || 0) + v;
    }
    for (const [day, v] of Object.entries(perDay)) if (v < 200000) rows.push({ metric: 'steps', recorded_at: `${day}T12:00:00+09:00`, value: Math.round(v), unit: 'count' });
  }
  for (const w of data?.workouts ?? []) {
    const start = (w.start || w.startDate) ? toIso(w.start || w.startDate) : null; if (!start) continue;
    const secs = Number(w.duration ?? 0);
    rows.push({
      metric: 'workout', recorded_at: start, value: Math.round((secs > 1000 ? secs / 60 : secs) * 10) / 10, unit: 'min',
      extra: { name: w.name ?? 'Workout', distance_km: w.distance?.qty != null ? Number(/mi/i.test(w.distance.units || '') ? w.distance.qty * 1.609344 : w.distance.qty) : null, energy_kcal: w.activeEnergyBurned?.qty ?? w.activeEnergy?.qty ?? null },
    });
  }
  if (!rows.length) return json({ ok: true, saved: 0 });
  await db('health_samples?on_conflict=metric,recorded_at', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(rows) });
  return json({ ok: true, saved: rows.length });
});
