import { defineCollection, z } from 'astro:content';

// Shared schema for every pillar. Each article is one markdown file with
// this frontmatter at the top, followed by the article body.
const pillarSchema = z.object({
  title: z.string(),
  date: z.date(),
  excerpt: z.string().optional(),
  tags: z.array(z.string()).optional(),
  draft: z.boolean().optional().default(false), // true = 網站上看不到（草稿或暫時關閉）
  status: z.enum(['draft', 'published', 'paused']).optional(), // Studio 用來區分「草稿」與「暫時關閉」；公開與否仍由 draft 決定
  work: z.string().optional(), // 屬於「有點樣子」哪一件作品（works.json 的 slug），作品頁會自動列為製作紀錄
});

export const collections = {
  strengthen: defineCollection({ type: 'content', schema: pillarSchema }),  // 強化 — 運動與健康
  emit:       defineCollection({ type: 'content', schema: pillarSchema }),  // 放出 — 輸出與分享
  operate:    defineCollection({ type: 'content', schema: pillarSchema }),  // 操作 — AI 學習筆記
  conjure:    defineCollection({ type: 'content', schema: pillarSchema }),  // 具現 — 從無到有的建置
  transmute:  defineCollection({ type: 'content', schema: pillarSchema }),  // 變化 — 心境筆記
};
