import { getCollection } from 'astro:content';
import { pillars } from '../data/pillars';
import copy from '../data/site-copy.json';

// A plain-text guide for AI assistants: who this is, what's here, and where the key pages are.
export async function GET({ site }: { site: URL }) {
  const base = (site ?? new URL('https://8aker0.com')).href.replace(/\/$/, '');
  const lines: string[] = [
    `# ${copy.site_name}`,
    '',
    `> ${copy.site_name}（8 代表巴，零代表林）是林子翔（Baker Lin，暱稱「巴」）的個人網站。他是住在日本大阪的台灣人，從事不動產、民宿營運與室內佈置，同時持續學習並實作 AI 工具。座右銘：「${copy.motto_line1}${copy.motto_line2}」`,
    '',
    '網站以繁體中文為主。內容分成五個持續累積的方向，並以每月 2 日刊出一話的「連載」形式記錄一年的成長（39 歲這一年，第一卷於 2027 年 10 月 2 日發售）。',
    '',
    '## 主要頁面',
    `- [首頁](${base}/): 座右銘、能力值儀表、39・連載中、日常紀錄、有點樣子（工作成果）、身體紀錄、初次見面`,
    '',
    '## 五個方向',
  ];
  for (const p of pillars) lines.push(`- [${p.type}・${p.title}](${base}/pillars/${p.slug}/): ${p.desc}`);
  lines.push('', '## 文章');
  for (const p of pillars) {
    const entries = (await getCollection(p.slug as any, ({ data }: any) => !data.draft)).sort((a: any, b: any) => b.data.date - a.data.date);
    for (const e of entries as any[]) lines.push(`- [${e.data.title}](${base}/pillars/${p.slug}/${e.slug}/)（${p.type}，${e.data.date.toISOString().slice(0, 10)}）${e.data.excerpt ? `: ${e.data.excerpt}` : ''}`);
  }
  lines.push('', '## 關於作者', '- 姓名：林子翔（Baker Lin）', '- 所在地：日本大阪', '- 語言：繁體中文、日文、英文', `- Strava：https://www.strava.com/athletes/103942910`, '');
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
