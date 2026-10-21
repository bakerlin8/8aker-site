// 短網址：8aker.com/<關鍵字> → 8aker0.com 的對應頁面
// A. 每件作品自動有短網址：8aker.com/<作品代號> → 8aker0.com/works/<作品代號>/
// B. 自訂短碼：src/data/shortlinks.json 的 custom（自訂優先，同名時蓋過作品代號）
// 每次 build 會重新產生 vercel.json 裡「host 為 8aker.com」的那幾條轉址，其他設定不動。
import fs from 'node:fs';
const HOSTS = ['8aker.com', 'www.8aker.com'];
const MAIN = 'https://8aker0.com';
const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const works = read('../src/data/works.json');
const list = Array.isArray(works) ? works : works.works || [];
const custom = read('../src/data/shortlinks.json').custom || {};
const ok = (c) => /^[a-z0-9][a-z0-9-]{0,40}$/.test(c);
const map = new Map();
for (const w of list) if (w.slug && ok(w.slug)) map.set(w.slug, `${MAIN}/works/${w.slug}/`);
for (const [c, to] of Object.entries(custom)) {
  const code = c.toLowerCase();
  if (!ok(code)) { console.warn('略過不合法的短碼：', c); continue; }
  if (!/^https:\/\//.test(to) && !to.startsWith('/')) { console.warn('略過不合法的目的地：', c, to); continue; }
  map.set(code, to.startsWith('/') ? MAIN + to : to);
}
const cfgUrl = new URL('../vercel.json', import.meta.url);
const cfg = JSON.parse(fs.readFileSync(cfgUrl, 'utf8'));
const isShort = (r) => (r.has || []).some((h) => h.type === 'host' && HOSTS.includes(h.value));
const rest = (cfg.redirects || []).filter((r) => !isShort(r));
const gen = [];
for (const host of HOSTS) {
  for (const [code, to] of map) gen.push({ source: `/${code}`, has: [{ type: 'host', value: host }], destination: to, statusCode: 302 });
}
for (const host of HOSTS) gen.push({ source: '/:path*', has: [{ type: 'host', value: host }], destination: MAIN, statusCode: 302 });
cfg.redirects = [...rest, ...gen];
fs.writeFileSync(cfgUrl, JSON.stringify(cfg, null, 2) + '\n');
console.log(`短網址：${map.size} 條（${[...map.keys()].join(', ')}）`);
