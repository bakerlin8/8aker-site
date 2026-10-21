import { defineConfig } from 'astro/config';
import fs from 'node:fs';

/* 短網址：8aker0.com/<code> → 目標
   自訂短碼放在 src/data/shortlinks.json（可在 Studio「短網址」管理）
   撞到網站既有頁面或資料夾的名稱（studio、journal、chat…）會直接讓建置失敗，不會悄悄蓋掉。 */
const readJson = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const RESERVED = new Set([
  ...fs.readdirSync(new URL('./src/pages', import.meta.url)).map((n) => n.replace(/\.(astro|ts|js|md)$/, '').replace(/\.(txt|xml)$/, '')),
  ...fs.readdirSync(new URL('./public', import.meta.url)).map((n) => n.replace(/\.[a-z0-9]+$/i, '')),
  'api', 'studio', 'admin', 'sitemap', 'robots', 'llms',
]);
const CODE = /^[a-z0-9][a-z0-9-]{0,40}$/;
function shortRedirects() {
  const out = {}, seen = new Map();
  const add = (code, to, from) => {
    if (!CODE.test(code)) throw new Error(`短網址「${code}」（${from}）格式不對：只能用小寫英文、數字、連字號`);
    if (RESERVED.has(code)) throw new Error(`短網址「${code}」（${from}）撞到網站既有頁面，請換一個名稱`);
    if (seen.has(code)) throw new Error(`短網址「${code}」重複了：${seen.get(code)} 和 ${from}`);
    seen.set(code, from); out['/' + code] = to;
  };
  for (const l of readJson('./src/data/shortlinks.json').links || []) {
    if (l && l.code && l.to) add(String(l.code).trim().toLowerCase(), String(l.to).trim(), '自訂短碼');
  }
  return out;
}

/* 選填：自訂短碼可加 title / description / image，轉址頁會帶 LINE、FB 等的連結預覽（標題、說明、縮圖）。沒填的短碼維持原樣。 */
const PREVIEWS = {};
for (const l of readJson('./src/data/shortlinks.json').links || []) {
  if (l && l.code && (l.title || l.description || l.image)) PREVIEWS['/' + String(l.code).trim().toLowerCase()] = l;
}
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const absUrl = (v) => (String(v).startsWith('/') ? new URL(String(v), 'https://8aker0.com').href : String(v));
const previewTags = (pv) => {
  if (!pv) return { title: '8AKER零', tags: '' };
  const title = pv.title ? String(pv.title) : '8AKER零';
  let t = `<meta property="og:type" content="website"><meta property="og:site_name" content="8AKER零"><meta property="og:title" content="${esc(title)}">`;
  if (pv.description) t += `<meta name="description" content="${esc(pv.description)}"><meta property="og:description" content="${esc(pv.description)}">`;
  if (pv.image) t += `<meta property="og:image" content="${esc(absUrl(pv.image))}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(absUrl(pv.image))}">`;
  return { title, tags: t };
};

/* Astro 預設的轉址頁會閃出「Redirecting from …」的字樣。建置完成後把這些頁面換成「沒有任何文字、底色同網站」的版本，並用 JS 立刻轉走。 */
const silentRedirects = (map) => ({
  name: 'silent-short-links',
  hooks: {
    'astro:build:done': ({ dir }) => {
      for (const [from, to] of Object.entries(map)) {
        const f = new URL(`.${from}/index.html`, dir);
        if (!fs.existsSync(f)) continue;
        const pvw = previewTags(PREVIEWS[from]);
        const u = to.startsWith('/') ? new URL(to, 'https://8aker0.com').href : to;
        const j = JSON.stringify(to).replace(/</g, '\\u003c');
        fs.writeFileSync(f, `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(pvw.title)}</title>${pvw.tags}<meta name="robots" content="noindex"><link rel="canonical" href="${u.replace(/"/g, '&quot;')}"><meta http-equiv="refresh" content="0;url=${to.replace(/"/g, '&quot;')}"><style>html,body{margin:0;background:#1C0F14;}</style><script>location.replace(${j});</script></head><body></body></html>`);
      }
    },
  },
});

const REDIRECTS = shortRedirects();

export default defineConfig({
  site: 'https://8aker0.com',
  output: 'static',
  redirects: REDIRECTS,
  integrations: [silentRedirects(REDIRECTS)],
});
