// Receives a shared link from the iPhone Shortcut and saves it to lib_items.
// Auth: header "x-8aker-key" must match the key whose SHA-256 is stored in app_config (key = lib_key_sha256).
// Metadata (title / thumbnail) is best effort: a failed lookup never blocks saving the link.
import { db, sha256, json } from './shared.ts';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

function firstUrl(raw: string): string | null {
  const m = String(raw || '').match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0].replace(/[)\].,;!?]+$/, '') : null;
}

function normalize(u: string): URL | null {
  try {
    const x = new URL(u);
    if (!/^https?:$/.test(x.protocol)) return null;
    x.hash = '';
    x.hostname = x.hostname.toLowerCase();
    const drop = ['igsh', 'igshid', 'si', 'feature', 'fbclid', 'ref', 'xmt', 'slof', 'mibextid'];
    for (const k of [...x.searchParams.keys()]) if (k.startsWith('utm_') || drop.includes(k)) x.searchParams.delete(k);
    return x;
  } catch { return null; }
}

function isPublicHost(h: string) {
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':')) return false;
  return h.includes('.');
}

function platformOf(h: string) {
  const x = h.replace(/^www\./, '');
  if (/(^|\.)instagram\.com$/.test(x)) return 'Instagram';
  if (/(^|\.)threads\.(net|com)$/.test(x)) return 'Threads';
  if (x === 'youtu.be' || /(^|\.)youtube\.com$/.test(x)) return 'YouTube';
  if (/(^|\.)tiktok\.com$/.test(x)) return 'TikTok';
  if (/(^|\.)(x|twitter)\.com$/.test(x)) return 'X';
  return x;
}

async function timedFetch(url: string, init: RequestInit = {}, ms = 5000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...init, signal: c.signal, redirect: 'follow' }); } finally { clearTimeout(t); }
}

function decode(s: string) {
  const cp = (n: number) => { try { return String.fromCodePoint(n); } catch { return ''; } };
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => cp(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => cp(parseInt(d, 10)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

// Login walls answer with a bare site name or a login title; those are not real titles.
const GENERIC = /^(instagram|threads|tiktok|x|twitter|youtube|log in|login|sign in|ログイン|登入)([\s•·|\-–—].*(log in|login|sign|ログイン|登入))?$/i;

async function lookup(u: URL, platform: string): Promise<{ title: string; thumb: string | null }> {
  const out = { title: '', thumb: null as string | null };
  try {
    if (platform === 'YouTube' || platform === 'TikTok') {
      const ep = platform === 'YouTube' ? 'https://www.youtube.com/oembed?format=json&url=' : 'https://www.tiktok.com/oembed?url=';
      const r = await timedFetch(ep + encodeURIComponent(u.toString()), { headers: { 'User-Agent': UA } });
      if (r.ok) {
        const j = await r.json();
        out.title = String(j.title || '');
        out.thumb = j.thumbnail_url || null;
        if (out.title || out.thumb) return out;
      }
    }
    if (!isPublicHost(u.hostname)) return out;
    const r = await timedFetch(u.toString(), { headers: { 'User-Agent': UA, 'Accept-Language': 'ja,zh-TW;q=0.9,en;q=0.8' } });
    if (!r.ok) return out;
    const html = (await r.text()).slice(0, 400_000);
    const meta = (p: string) => {
      const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]*content=["']([^"']*)["']`, 'i'));
      const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${p}["']`, 'i'));
      return decode((a?.[1] || b?.[1] || '').trim());
    };
    out.title = meta('og:title') || meta('twitter:title') || decode((html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').trim());
    const img = meta('og:image') || meta('twitter:image');
    if (img && /^https?:\/\//i.test(img)) out.thumb = img;
    if (GENERIC.test(out.title.trim())) out.title = '';
  } catch { /* best effort */ }
  return out;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const key = req.headers.get('x-8aker-key') || '';
  const cfg = await db('app_config?key=eq.lib_key_sha256&select=value');
  if (!key || !cfg?.[0] || (await sha256(key)) !== cfg[0].value) return json({ error: 'unauthorized' }, 401);

  let body: any = {};
  const ct = req.headers.get('content-type') || '';
  try { body = ct.includes('json') ? await req.json() : { url: await req.text() }; } catch { return json({ error: 'bad_body' }, 400); }

  const raw = firstUrl(body.url || body.text || '');
  const u = raw ? normalize(raw) : null;
  if (!u) return json({ error: 'no_url' }, 400);

  const url = u.toString();
  const exists = await db(`lib_items?url=eq.${encodeURIComponent(url)}&select=id,title`);
  if (exists?.length) return json({ ok: true, duplicate: true, id: exists[0].id, title: exists[0].title, message: '這個連結之前存過了' + (exists[0].title ? '：' + exists[0].title : '') });

  const platform = platformOf(u.hostname);
  const info = await lookup(u, platform);
  const kind = ['learn', 'style', 'motion', 'prompt', 'other'].includes(body.kind) ? body.kind : 'learn';
  const row = {
    url, platform, kind, status: 'inbox',
    title: info.title.slice(0, 300),
    thumb_url: info.thumb,
    why: String(body.why || '').slice(0, 500),
    meta: info.title || info.thumb ? 'ok' : 'pending',
  };
  const saved = await db('lib_items', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
  return json({ ok: true, duplicate: false, id: saved?.[0]?.id, platform, title: row.title, has_thumb: !!row.thumb_url, meta: row.meta, message: '已存進素材庫' + (row.title ? '：' + row.title : '（' + platform + '，標題稍後補）') });
});
