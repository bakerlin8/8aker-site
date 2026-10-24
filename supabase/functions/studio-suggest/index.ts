// Studio 即時 AI 建議（Gemini）：標題、摘要、標籤、社群文案。
// 金鑰放在 Supabase 函式秘密變數 GEMINI_API_KEY，不會出現在網頁或程式碼。
// 只有站長（Studio token）能呼叫；每天有次數上限。
import { db, json, SITE } from './shared.ts';
const STUDIO_EMAILS = ['nr.bater@gmail.com'];
const CORS = { 'Access-Control-Allow-Origin': SITE, 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' };
const reply = (b: unknown, s = 200) => json(b, s, CORS);
const DAILY_LIMIT = 60;
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

async function owner(req: Request) {
  const t = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!t.startsWith('s8.')) return false;
  const v = await fetch(`${SITE}/api/studio_verify`, { headers: { Authorization: `Bearer ${t}` } });
  if (!v.ok) return false;
  const d = await v.json().catch(() => ({}));
  return d.ok === true && STUDIO_EMAILS.includes(String(d.email).toLowerCase());
}
const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
async function usage(): Promise<{ day: string; n: number }> {
  try { const r: any[] = await db('app_config?key=eq.gemini_usage&select=value'); const v = JSON.parse(r?.[0]?.value || '{}'); if (v.day === today()) return { day: v.day, n: Number(v.n) || 0 }; } catch (_) { /* 當作 0 */ }
  return { day: today(), n: 0 };
}
async function bump(u: { day: string; n: number }) {
  await db('app_config?on_conflict=key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify([{ key: 'gemini_usage', value: JSON.stringify({ day: u.day, n: u.n + 1 }), updated_at: new Date().toISOString() }]) });
}
async function modelName() {
  try { const r: any[] = await db('app_config?key=eq.gemini_model&select=value'); const v = String(r?.[0]?.value || '').trim(); if (/^gemini-[\w.\-]+$/.test(v)) return v; } catch (_) { /* 用預設 */ }
  return DEFAULT_MODEL;
}

const VOICE = '你是「8AKER零」個人網站的編輯助手。網站主人 Baker 是住在大阪的台灣人、自由工作者。語氣：自然、真誠、白話的台灣繁體中文，像寫給朋友看，不浮誇、不用行銷口號、不編造事實或數字。只根據提供的內容寫，不要加入文中沒有的經歷。';
const TASKS: Record<string, string> = {
  titles: '請給 6 個文章標題。規則：中文約 12–30 字；主要關鍵字放在前段；混合不同類型（問句型、教學型、經驗型、清單型），其中至少 2 個適合被搜尋引擎與 AI 問答引用（直接回答一個問題）；不要誇大、不要標題黨。回傳 JSON：{"items":[{"text":"標題","note":"類型，例如 問句型"}]}',
  excerpt: '請給 3 個文章摘要（會當作搜尋結果的說明文字）。規則：每個 60–100 字；開頭就點出主題與關鍵字；說明讀者能得到什麼；不要用「本文」開頭。回傳 JSON：{"items":[{"text":"摘要","note":"風格，例如 直接型"}]}',
  tags: '請給 6 個適合的標籤（繁體中文，每個 2–8 字，包含 1–2 個適合搜尋的關鍵字）。回傳 JSON：{"items":[{"text":"標籤","note":""}]}',
  social: '請根據文章產生社群文案。回傳 JSON：{"items":[{"text":"內容","note":"平台"}]}，共 4 筆，note 依序為：「Instagram 貼文」（150–250 字，分段、結尾 5 個 hashtag）、「Threads 短貼文」（80 字內，像隨口分享，不放 hashtag）、「Threads 串文」（3 則，用 --- 分隔每則）、「YouTube 短影音腳本」（30–45 秒口播，標出開場一句話、3 個重點、結尾；再附一行建議標題）。',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (!(await owner(req))) return reply({ error: 'unauthorized' }, 401);
  try {
    const b = await req.json().catch(() => ({}));
    if (b.action === 'status') { const u = await usage(); return reply({ ok: true, hasKey: !!Deno.env.get('GEMINI_API_KEY'), used: u.n, limit: DAILY_LIMIT, model: await modelName() }); }
    if (b.action !== 'suggest' || !TASKS[b.kind]) return reply({ error: 'bad_request' }, 400);
    const key = Deno.env.get('GEMINI_API_KEY');
    if (!key) return reply({ error: '還沒設定 Gemini 金鑰（GEMINI_API_KEY）' }, 503);
    const s = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
    const ctx = [`主要關鍵字：${s(b.keyword, 60) || '（未指定，請從內容判斷）'}`, `所屬方向：${s(b.pillar, 20)}`, `目前標題：${s(b.title, 200)}`, `目前摘要：${s(b.excerpt, 500)}`, `正文：\n${s(b.body, 6000)}`].join('\n');
    if (ctx.replace(/\s/g, '').length < 40) return reply({ error: '內容太少，先寫關鍵字、標題或幾句正文再試' }, 400);
    const u = await usage();
    if (u.n >= DAILY_LIMIT) return reply({ error: `今天的 AI 建議已用完 ${DAILY_LIMIT} 次，明天再來` }, 429);
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${await modelName()}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: VOICE }] }, contents: [{ role: 'user', parts: [{ text: `${TASKS[b.kind]}\n\n===== 文章資料 =====\n${ctx}` }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.8, maxOutputTokens: 2048 } }),
    });
    if (r.status === 429) return reply({ error: 'Gemini 免費額度暫時用完，過幾分鐘再試' }, 429);
    if (!r.ok) return reply({ error: `Gemini 回應錯誤（${r.status}）` }, 502);
    await bump(u);
    const d = await r.json();
    const text = d?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
    let items: { text: string; note?: string }[] = [];
    try { const j = JSON.parse(text.replace(/^```json\s*|\s*```$/g, '')); items = (Array.isArray(j) ? j : j.items || []).map((x: any) => ({ text: String(x.text ?? '').trim(), note: String(x.note ?? '').trim() })).filter((x: any) => x.text); } catch (_) { /* 解析失敗 */ }
    if (!items.length) return reply({ error: 'AI 這次沒有給出可用的結果，再按一次試試' }, 502);
    return reply({ ok: true, items, used: u.n + 1, limit: DAILY_LIMIT });
  } catch (_e) { return reply({ error: 'server_error' }, 500); }
});
