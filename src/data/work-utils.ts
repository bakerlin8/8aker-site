// 「有點樣子」作品的共用工具：影片連結轉嵌入網址、圖片網址檢查、找出綁定到作品的日常紀錄。
import { getCollection } from 'astro:content';
import { pillars } from './pillars';

export const safeImg = (u: string) => (typeof u === 'string' && (/^\/works\/[\w./-]+\.(webp|png|jpe?g|gif)$/i.test(u) || /^https:\/\/[^\s"'<>]+$/.test(u)) ? u : '');
export const safeLink = (u: string) => (typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : '');

// 影片連結 → 嵌入方式。
// Instagram（貼文／Reels）、YouTube Shorts 視為直式；YouTube、Vimeo 視為橫式；.mp4 在頁面上依實際長寬自動判斷。
export type VideoEmbed = { kind: 'iframe' | 'file' | 'instagram'; src: string; vertical: boolean };
export function videoEmbed(u: string): VideoEmbed | null {
  if (!u || typeof u !== 'string') return null;
  u = u.trim();
  let m = u.match(/^https:\/\/(?:www\.)?instagram\.com\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([\w-]+)/);
  if (m) return { kind: 'instagram', src: `https://www.instagram.com/${m[1] === 'p' ? 'p' : 'reel'}/${m[2]}/embed/`, vertical: true };
  m = u.match(/^https:\/\/(?:www\.|m\.)?youtube\.com\/shorts\/([\w-]{11})/);
  if (m) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0`, vertical: true };
  m = u.match(/^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0`, vertical: false };
  m = u.match(/^https:\/\/(?:www\.)?vimeo\.com\/(?:video\/)?(\d+)(?:\/(\w+))?/);
  if (m) return { kind: 'iframe', src: `https://player.vimeo.com/video/${m[1]}${m[2] ? `?h=${m[2]}` : ''}`, vertical: false };
  if (/^(https:\/\/[^\s"'<>]+|\/works\/[\w./-]+)\.(mp4|webm)(\?[^\s"'<>]*)?$/i.test(u)) return { kind: 'file', src: u, vertical: false };
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
