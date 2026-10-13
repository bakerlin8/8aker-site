// 「有點樣子」作品的共用工具：影片連結轉嵌入網址、圖片網址檢查、找出綁定到作品的日常紀錄。
import { getCollection } from 'astro:content';
import { pillars } from './pillars';

export const safeImg = (u: string) => (typeof u === 'string' && (/^\/works\/[\w./-]+\.(webp|png|jpe?g|gif)$/i.test(u) || /^https:\/\/[^\s"'<>]+$/.test(u)) ? u : '');
export const safeLink = (u: string) => (typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : '');

// YouTube / Vimeo 連結 → 嵌入播放網址；直接的 .mp4 → 用 <video> 播放
export function videoEmbed(u: string): { kind: 'iframe' | 'file'; src: string } | null {
  if (!u || typeof u !== 'string') return null;
  let m = u.match(/^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0` };
  m = u.match(/^https:\/\/(?:www\.)?vimeo\.com\/(?:video\/)?(\d+)(?:\/(\w+))?/);
  if (m) return { kind: 'iframe', src: `https://player.vimeo.com/video/${m[1]}${m[2] ? `?h=${m[2]}` : ''}` };
  if (/^https:\/\/[^\s"'<>]+\.(mp4|webm)(\?[^\s"'<>]*)?$/i.test(u)) return { kind: 'file', src: u };
  return null;
}

export async function entriesForWork(slug: string) {
  const out: { title: string; date: Date; excerpt?: string; url: string; kanji: string; dir: string }[] = [];
  for (const p of pillars) {
    const es = await getCollection(p.slug as any, ({ data }: any) => !data.draft && data.work === slug);
    for (const e of es as any[]) out.push({ title: e.data.title, date: e.data.date, excerpt: e.data.excerpt, url: `/pillars/${p.slug}/${e.slug}/`, kanji: p.kanji, dir: p.slug });
  }
  return out.sort((a, b) => a.date.valueOf() - b.date.valueOf());
}
