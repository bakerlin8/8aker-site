import { defineConfig } from 'astro/config';
import fs from 'node:fs';

/* 短網址：8aker0.com/<code> → 目標
   1) 作品頁自動有：/<作品代號> → /works/<作品代號>/（資料來自 src/data/works.json）
   2) 自訂短碼：src/data/shortlinks.json
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
  /* 自訂短碼先登記，這樣和作品代號撞名時優先保留自訂的，並明確報錯 */
  for (const l of readJson('./src/data/shortlinks.json').links || []) {
    if (l && l.code && l.to) add(String(l.code).trim().toLowerCase(), String(l.to).trim(), '自訂短碼');
  }
  const w = readJson('./src/data/works.json');
  for (const x of w.works || w) {
    if (x && x.slug) add(String(x.slug).trim().toLowerCase(), `/works/${x.slug}/`, `作品「${x.slug}」`);
  }
  return out;
}

export default defineConfig({
  site: 'https://8aker0.com',
  output: 'static',
  redirects: shortRedirects(),
});
