// 日常紀錄：所有方向的文章集中在這裡讀取。
// 草稿（draft: true）在正式站一律隱藏；只在本機開發與 Vercel 預覽網址顯示，
// 方便在預覽時看排版，上線後不會被一般讀者看到。
import { getCollection } from 'astro:content';
import { pillars } from './pillars';

export const SHOW_DRAFTS = import.meta.env.DEV || process.env.VERCEL_ENV === 'preview';
export const PER_PAGE = 12;

export const isVisible = ({ data }: any) => SHOW_DRAFTS || !data.draft;

export async function pillarEntries(slug: string, order: 'asc' | 'desc' = 'desc') {
  const es = await getCollection(slug as any, isVisible);
  return es.sort((a: any, b: any) => (order === 'desc' ? -1 : 1) * (a.data.date.valueOf() - b.data.date.valueOf()));
}

export async function allEntries() {
  const all = (await Promise.all(pillars.map(async (p) => (await getCollection(p.slug as any, isVisible)).map((e: any) => ({ dir: p.slug, e }))))).flat();
  return all.sort((a, b) => b.e.data.date.valueOf() - a.e.data.date.valueOf());
}
