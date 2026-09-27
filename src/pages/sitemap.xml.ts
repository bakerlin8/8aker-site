import { getCollection } from 'astro:content';
import { pillars } from '../data/pillars';

export async function GET({ site }: { site: URL }) {
  const base = (site ?? new URL('https://8aker0.com')).href.replace(/\/$/, '');
  const urls: { loc: string; lastmod?: string; priority: string }[] = [{ loc: `${base}/`, priority: '1.0' }];
  for (const p of pillars) {
    const entries = await getCollection(p.slug as any, ({ data }: any) => !data.draft);
    const latest = entries.reduce((m: Date | null, e: any) => (!m || e.data.date > m ? e.data.date : m), null);
    urls.push({ loc: `${base}/pillars/${p.slug}/`, lastmod: latest?.toISOString().slice(0, 10), priority: '0.7' });
    for (const e of entries as any[]) urls.push({ loc: `${base}/pillars/${p.slug}/${e.slug}/`, lastmod: e.data.date.toISOString().slice(0, 10), priority: '0.8' });
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`)
    .join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
