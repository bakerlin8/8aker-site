// LINE Flex Message 卡片：用網站的深酒紅＋金色配色（和 8aker0.com 同一套）
export type Item = { dir: number; title: string; draft?: boolean };
type Base = { date: string; dow: string; sample?: boolean };
const K = ['強', '放', '操', '具', '變'];
const N = ['強化', '放出', '操作', '具現', '變化'];
// openExternalBrowser=1：讓 LINE 用手機的 Safari／預設瀏覽器打開（LINE 內建瀏覽器不能用 Google 登入）
const STUDIO = 'https://8aker0.com/studio/?openExternalBrowser=1';
const C = { night: '#1C0F14', wine: '#3D0F1A', gold: '#D4A24C', gold2: '#EBD3A8', bone: '#EFE5D6', ash: '#B9A89E', dim: '#7C6A70', line: '#4A2A33', chip: '#2A1820' };
const t = (text: string, o: Record<string, unknown> = {}) => ({ type: 'text', text, ...o });

const header = (label: string, right: string, contents: unknown[]) => ({
  type: 'box', layout: 'vertical', paddingAll: '22px', paddingBottom: '20px',
  background: { type: 'linearGradient', angle: '160deg', startColor: C.wine, endColor: C.night },
  contents: [
    { type: 'box', layout: 'horizontal', contents: [t(label, { size: 'xxs', color: C.gold, weight: 'bold' }), t(right, { size: 'xxs', color: C.ash, align: 'end' })] },
    ...contents,
  ],
});
const button = (label: string) => ({ type: 'box', layout: 'vertical', paddingAll: '11px', cornerRadius: '4px', borderColor: C.gold, borderWidth: '1px', action: { type: 'uri', label, uri: STUDIO }, contents: [t(label, { size: 'sm', color: C.gold, align: 'center' })] });
const shell = (altText: string, body: unknown[], footerLabel: string) => ({
  type: 'flex', altText,
  contents: {
    type: 'bubble', size: 'mega',
    styles: { body: { backgroundColor: C.night }, footer: { backgroundColor: C.night } },
    body: { type: 'box', layout: 'vertical', paddingAll: '0px', contents: body },
    footer: { type: 'box', layout: 'vertical', paddingAll: '20px', paddingTop: '4px', contents: [button(footerLabel)] },
  },
});
const chip = (k: string, on = true) => ({ type: 'box', layout: 'vertical', width: '30px', height: '30px', flex: 0, cornerRadius: '15px', backgroundColor: on ? C.gold : C.chip, justifyContent: 'center', alignItems: 'center', contents: [t(k, { size: 'sm', weight: 'bold', color: on ? C.night : C.dim, align: 'center' })] });

export function recordsFlex(d: Base & { items: Item[] }) {
  const rows: unknown[] = [];
  d.items.slice(0, 8).forEach((x, i) => {
    if (i) rows.push({ type: 'separator', color: C.line, margin: 'md' });
    rows.push({ type: 'box', layout: 'horizontal', spacing: 'lg', alignItems: 'center', paddingTop: i ? '12px' : '2px', paddingBottom: '2px', contents: [chip(K[x.dir]), { type: 'box', layout: 'vertical', flex: 1, spacing: 'xs', contents: [t(x.title, { size: 'sm', color: C.bone, wrap: true }), t(N[x.dir] + (x.draft ? '・草稿' : ''), { size: 'xxs', color: C.dim })] }] });
  });
  return shell(`今天新增 ${d.items.length} 筆日常紀錄`, [
    header('8AKER零 · TODAY', `${d.date} ${d.dow}`, [t('今天新增', { size: 'xs', color: C.ash, margin: 'xl' }), { type: 'box', layout: 'baseline', spacing: 'sm', contents: [t(String(d.items.length), { size: '4xl', weight: 'bold', color: C.gold2, flex: 0 }), t('筆日常紀錄', { size: 'md', color: C.gold2, flex: 0 })] }]),
    { type: 'box', layout: 'vertical', paddingStart: '22px', paddingEnd: '22px', paddingTop: '6px', paddingBottom: '20px', contents: rows },
  ], '繼續新增');
}

export function reminderFlex(d: Base) {
  return shell('今天還沒有新增日常紀錄，該新增了', [
    header('8AKER零 · TODAY', `${d.date} ${d.dow}${d.sample ? '・預覽範例' : ''}`, [t('今天還沒有', { size: 'xs', color: C.ash, margin: 'xl' }), t('新增日常紀錄', { size: 'xxl', weight: 'bold', color: C.gold2, margin: 'sm' }), t('該新增了。', { size: 'sm', color: C.ash, margin: 'md' })]),
    { type: 'box', layout: 'vertical', paddingAll: '6px', contents: [] },
  ], '去新增');
}

// 每週統整：這週新增了什麼＋助理的話
export function weeklyFlex(d: { range: string; items: Item[]; counts: number[]; prevCounts: number[]; prevTotal: number; note?: string; sample?: boolean }) {
  const total = d.items.length, max = Math.max(1, ...d.counts, ...d.prevCounts);
  const diff = total - d.prevTotal;
  const bars = d.counts.map((n, i) => {
    const dl = n - d.prevCounts[i];
    return { type: 'box', layout: 'horizontal', spacing: 'md', alignItems: 'center', paddingTop: '7px', paddingBottom: '7px', contents: [
      t(N[i], { size: 'xs', color: n ? C.bone : C.dim, flex: 0, gravity: 'center' }),
      { type: 'box', layout: 'horizontal', flex: 1, height: '6px', backgroundColor: C.chip, cornerRadius: '3px', contents: n ? [{ type: 'box', layout: 'vertical', width: `${Math.max(8, Math.round((n / max) * 100))}%`, height: '6px', backgroundColor: C.gold, cornerRadius: '3px', contents: [{ type: 'filler' }] }] : [{ type: 'filler' }] },
      t(`${n}${dl ? `  ${dl > 0 ? '+' : '−'}${Math.abs(dl)}` : ''}`, { size: 'xs', color: n ? C.gold2 : C.dim, flex: 0, align: 'end', gravity: 'center' }),
    ] };
  });
  const list: unknown[] = d.items.slice(0, 6).map((x) => ({ type: 'box', layout: 'horizontal', spacing: 'md', paddingTop: '6px', contents: [t(K[x.dir], { size: 'xs', color: C.gold, flex: 0, weight: 'bold' }), t(x.title + (x.draft ? '（草稿）' : ''), { size: 'xs', color: C.bone, wrap: true, flex: 1 })] }));
  if (d.items.length > 6) list.push(t(`…還有 ${d.items.length - 6} 筆`, { size: 'xs', color: C.ash, margin: 'md' }));
  if (!d.items.length) list.push(t('這週還沒有新增的日常紀錄。', { size: 'xs', color: C.ash }));
  const body: unknown[] = [
    header('8AKER零 · WEEKLY', `${d.range}${d.sample ? '・預覽範例' : ''}`, [
      t('本週新增', { size: 'xs', color: C.ash, margin: 'xl' }),
      { type: 'box', layout: 'baseline', spacing: 'sm', contents: [t(String(total), { size: '4xl', weight: 'bold', color: C.gold2, flex: 0 }), t('筆日常紀錄', { size: 'md', color: C.gold2, flex: 0 })] },
      t(`上週 ${d.prevTotal} 筆${diff ? `　${diff > 0 ? '+' : '−'}${Math.abs(diff)}` : '　持平'}`, { size: 'xs', color: C.ash, margin: 'md' }),
    ]),
    { type: 'box', layout: 'vertical', paddingStart: '22px', paddingEnd: '22px', paddingTop: '4px', paddingBottom: '6px', contents: bars },
    { type: 'box', layout: 'vertical', paddingStart: '22px', paddingEnd: '22px', paddingTop: '8px', paddingBottom: '18px', contents: [{ type: 'separator', color: C.line }, { type: 'box', layout: 'vertical', paddingTop: '8px', contents: list }] },
  ];
  if (d.note) body.push({ type: 'box', layout: 'vertical', margin: 'none', paddingStart: '22px', paddingEnd: '22px', paddingBottom: '20px', contents: [{ type: 'box', layout: 'vertical', backgroundColor: C.chip, cornerRadius: '6px', paddingAll: '16px', spacing: 'sm', contents: [t('助理的話', { size: 'xxs', color: C.gold, weight: 'bold' }), t(d.note, { size: 'sm', color: C.bone, wrap: true })] }] });
  return shell(`本週新增 ${total} 筆日常紀錄（${d.range}）`, body, '打開後台');
}
