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
    desc: '運動、跳舞、體能訓練的日常紀錄——不是為了瘦身或炫耀，是每天讓身體這個「本來就有的東西」變得更可靠一點。',
    tags: ['運動', '跳舞'],
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
    desc: '語言學習的輸出、生活裡累積下來的體悟——把學到的東西往外送，讓它影響到你觸碰不到的人。',
    tags: ['語言輸出', '生活筆記'],
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
    desc: '不是工具介紹文，是「這個我真的用過、真的省了時間」的紀錄——連同踩過的坑跟後來怎麼修正。',
    tags: ['Claude', '工作流'],
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
    desc: '跟夥伴一起創業，協助從零開始建置一間公司的過程——還在路上，但已經有一些具體的成果可以分享。',
    tags: ['創業', '成果小工具'],
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
    desc: '心境一直在變——這裡不整理成教學，只是誠實記下當下的狀態，跟現在跟以前不一樣的地方。',
    tags: ['心境', '反思'],
    kanji: '變',
    unit: '篇',
    differentiator: 'gradient',
  },
];

export const pillarBySlug = (slug: string) => pillars.find(p => p.slug === slug);
