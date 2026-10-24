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

// 其他方向的文章，只要把「也屬於」設成這個方向，就會列在這個方向的清單裡（網址仍是它的主方向）
export async function alsoEntries(slug: string) {
  const all = (await Promise.all(pillars.filter((p) => p.slug !== slug).map(async (p) => (await getCollection(p.slug as any, isVisible)).filter((e: any) => e.data.also === slug).map((e: any) => ({ dir: p.slug, e }))))).flat();
  return all;
}

export async function allEntries() {
  const all = (await Promise.all(pillars.map(async (p) => (await getCollection(p.slug as any, isVisible)).map((e: any) => ({ dir: p.slug, e }))))).flat();
  return all.sort((a, b) => b.e.data.date.valueOf() - a.e.data.date.valueOf());
}
