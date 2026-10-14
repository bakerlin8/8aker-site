// This is the ONE place to edit each pillar's name, description, and tags.
// The homepage and every pillar listing page read from here — change it
// once, and it updates everywhere on the site.

export type PillarSlug = 'strengthen' | 'emit' | 'operate' | 'conjure' | 'transmute';

export interface PillarMeta {
  slug: PillarSlug;
  index: string;        // "01".."05"
  type: string;         // 強化 / 放出 / 操作 / 具現 / 變化
  title: string;        // display title, e.g. 運動與健康
  titleJp: string;      // small Japanese subtitle line
  desc: string;         // the paragraph description
  tags: string[];
  kanji: string;        // single character used as the giant watermark
  unit: string;         // "篇" or "個" — the counting word used in "共 — X"
  differentiator: 'ledger' | 'signal' | 'terminal' | 'thumb' | 'gradient';
}

export const pillars: PillarMeta[] = [
  {
    slug: 'strengthen',
    index: '01',
    type: '強化',
    title: '運動與健康',
    titleJp: '体を鍛える、積み重ねの記録',
    desc: '身心靈的強化：跑步、瑜伽、核心、跳舞、滑雪，還有每天至少 15 分鐘的冥想——不是為了炫耀，是讓身體和心都變得更可靠一點。',
    tags: ['跑步', '瑜伽', '冥想', '跳舞', '滑雪'],
    kanji: '強',
    unit: '篇',
    differentiator: 'ledger',
  },
  {
    slug: 'emit',
    index: '02',
    type: '放出',
    title: '輸出與分享',
    titleJp: '発信する、届く言葉の記録',
    desc: '把學到的東西往外送：英文 podcast 心得、用日文和英文說說生活情境、AI 做的影片——目標是能用英文輕鬆聊上一小時，日文達到永住的程度。',
    tags: ['英文', '日文', 'IG 素材', 'AI 影片'],
    kanji: '放',
    unit: '篇',
    differentiator: 'signal',
  },
  {
    slug: 'operate',
    index: '03',
    type: '操作',
    title: 'AI 學習筆記',
    titleJp: '実際に使えた、机上ではない記録',
    desc: '用 Claude 和 AI 工具打造自己的 AI 分身，把時間省下來、重心拉回自己身上——也包含 AI 自動整理的情報誌，和踩過的坑。',
    tags: ['Claude', 'AI 分身', '工作流', 'AI 情報誌'],
    kanji: '操',
    unit: '篇',
    differentiator: 'terminal',
  },
  {
    slug: 'conjure',
    index: '04',
    type: '具現',
    title: '從無到有的建置',
    titleJp: '仲間と共に、ゼロから作り上げる',
    desc: '成果發表：從找地、蓋房到軟裝，從無到有做出來的民宿；改建監工、軟裝設計；還有能實際幫朋友解決工作流程的 AI 小工具。',
    tags: ['民宿', '軟裝', '建築', '成果小工具'],
    kanji: '具',
    unit: '個',
    differentiator: 'thumb',
  },
  {
    slug: 'transmute',
    index: '05',
    type: '變化',
    title: '心境筆記',
    titleJp: '揺れ動く心、その時々の記録',
    desc: '人生不會照著計畫走，那就順著變化做計畫。一時的心情、遇到的人事物、旅途、一首歌、一集 podcast，甚至揪心的事，都記在這裡。',
    tags: ['心境', '旅行', '音樂', '人事物'],
    kanji: '變',
    unit: '篇',
    differentiator: 'gradient',
  },
];

// 副標（例：運動與健康）可在 Studio「首頁文案」修改，存在 site-copy.json 的 pillar_<slug>_title
import siteCopy from './site-copy.json';
for (const p of pillars) { const t = (siteCopy as any)[`pillar_${p.slug}_title`]; if (typeof t === 'string' && t.trim()) p.title = t.trim(); }

export const pillarBySlug = (slug: string) => pillars.find(p => p.slug === slug);
