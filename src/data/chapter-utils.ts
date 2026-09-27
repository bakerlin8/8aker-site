import chapters from './chapters.json';
import { getCollection } from 'astro:content';
import { pillars } from './pillars';

export type Chapter = { no: number; date: string; title: string; summary?: string; plan?: { dir?: string; text: string }[]; keep?: string[]; letgo?: string[]; on_break?: boolean };
const T = (d: string) => new Date(d + 'T00:00:00+09:00').getTime();

export function chapterList() {
  const now = Date.now();
  const list = (chapters.chapters as Chapter[]).map((c, i, arr) => {
    const from = i > 0 ? arr[i - 1].date : '0000-00-00';
    const arc = (chapters.arcs || []).find((a: any) => c.no >= a.from && c.no <= a.to)?.name ?? '';
    const state = T(c.date) <= now ? (c.on_break ? 'break' : 'done') : 'future';
    return { ...c, from, arc, state, label: `第 ${c.no} 話` };
  });
  const next = list.find((c) => c.state === 'future');
  if (next) (next as any).state = 'next';
  return { list, volume: chapters.volume, arcs: chapters.arcs };
}

export async function articlesBetween(from: string, to: string, first: boolean) {
  const out: any[] = [];
  for (const p of pillars) {
    const es = await getCollection(p.slug as any, ({ data }: any) => !data.draft);
    for (const e of es as any[]) {
      const d = e.data.date.toISOString().slice(0, 10);
      if ((first ? d >= from : d > from) && d <= to) out.push({ p, e, d });
    }
  }
  return out.sort((a, b) => a.d.localeCompare(b.d));
}
export const stateLabel: Record<string, string> = { done: '已刊出', break: '休載', next: '製作中', future: '預定' };
export const dirOf = (slug?: string) => pillars.find((p) => p.slug === slug);
