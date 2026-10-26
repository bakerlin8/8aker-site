// Studio 即時 AI 寫作助手（Gemini）：標題、角度、大綱、開頭、續寫、改寫選取文字、錯字語病、待確認事實、摘要、標籤、FAQ、社群文案、順稿、去 AI 化口氣、讀者視角、三語版本。
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
  titles: '請給 6 個文章標題。規則：中文 12–28 字，絕對不要超過 28 字；主要關鍵字放在前段；混合不同類型（問句型、教學型、經驗型、清單型），其中至少 2 個適合被搜尋引擎與 AI 問答引用（直接回答一個問題）；不要誇大、不要標題黨；不得編造文中沒有的數字、次數或經歷（例如不要自己寫「3 件事」）。回傳 JSON：{"items":[{"text":"標題","note":"類型，例如 問句型"}]}',
  excerpt: '請從文章正文擷取重點，給 3 個摘要（會當作搜尋結果的說明文字）。只能使用正文裡出現的資訊，不得編造數字或經歷。規則：每個 60–100 字；開頭就點出主題與關鍵字；說明讀者能得到什麼；不要用「本文」開頭。回傳 JSON：{"items":[{"text":"摘要","note":"風格，例如 直接型"}]}',
  tags: '請給 6 個適合的標籤（繁體中文，每個 2–8 字，包含 1–2 個適合搜尋的關鍵字）。回傳 JSON：{"items":[{"text":"標籤","note":""}]}',
  angles: '請給 5 個不同的寫作切入角度（誰會想讀、這篇的獨特看點）。只能根據提供的內容，不得編造經歷。回傳 JSON：{"items":[{"text":"一句話描述這個角度","note":"適合的讀者"}]}',
  outline: '請根據關鍵字、標題與已有文字，給一份文章大綱（用 Markdown，## 小標題 加每段 1 行重點，4–6 段，最後一段是「## 常見問題」可選）。只給 1 個版本。不得編造事實，缺資料處用【待補：…】標示。回傳 JSON：{"items":[{"text":"大綱 Markdown","note":"大綱"}]}',
  hooks: '請寫 4 個不同風格的文章開頭第一段（各 40–80 字）：直接點題、場景切入、提問、坦白自嘲。只能用提供內容裡的事實，不得編造經歷或數字。回傳 JSON：{"items":[{"text":"第一段","note":"風格"}]}',
  keywords: '請給 8 個 SEO 關鍵字建議（含 3 個主要關鍵字與 5 個長尾關鍵字，繁體中文，貼近台灣讀者實際會搜尋的說法）。回傳 JSON：{"items":[{"text":"關鍵字","note":"主要 或 長尾"}]}',
  continue: '請接著正文最後的內容，往下寫下一段（約 100–160 字），語氣與前文一致，不得編造文中沒有的經歷或數字；缺資料處用【待補：…】標示。給 2 個不同走向的版本。回傳 JSON：{"items":[{"text":"下一段","note":"走向"}]}',
  rewrite: '請改寫「選取文字」。保留原意與所有事實，不得新增文中沒有的資訊。給 2 個版本。回傳 JSON：{"items":[{"text":"改寫後的文字","note":"版本特色"}]}',
  proofread: '請檢查正文的錯字、用詞不當、語病與不通順處（繁體中文台灣用法）。最多列 8 項，每項 text 寫「原句片段 → 建議修改」，note 寫類型（錯字／語病／用詞／冗長）。沒有問題就回傳空的 items。回傳 JSON：{"items":[{"text":"…","note":"…"}]}',
  factcheck: '請找出正文裡「發表前需要作者自己確認」的地方：具體數字、日期、價格、法規或制度說法、絕對化的斷言、可能涉及他人隱私的細節。最多列 8 項，text 寫原句片段，note 寫為什麼要確認。沒有就回傳空的 items。回傳 JSON：{"items":[{"text":"…","note":"…"}]}',
  polish: '請「順稿」：把整篇正文修順。只修正錯字、語病、贅詞、不通順與重複的地方，保留作者原本的語氣、段落與 Markdown 結構（## 小標題、清單、連結、粗體、【待補：…】標記都原樣保留），不得改變意思，不得新增文中沒有的事實、數字或經歷。回傳 JSON：{"items":[{"text":"順好的完整正文（只給正文，不含 front matter）","note":"改了哪幾類（一句話）"}]}，只給 1 個版本。',
  dehuman: '請把整篇正文改成「去 AI 化的口氣」：讓它讀起來像作者本人坐下來跟朋友講話。要去掉的 AI 味：「總而言之」「值得一提的是」「不僅…更…」「讓我們」「在當今…的時代」「綜上所述」、過度工整的排比與三段式、每段都收尾升華、空泛的形容詞與行銷口號。改用短句、具體的細節、偶爾的口語停頓。保留所有事實、數字、Markdown 結構與【待補：…】標記，不得新增文中沒有的資訊或經歷。回傳 JSON：{"items":[{"text":"改好的完整正文","note":"主要去掉了哪些 AI 慣用說法（一句話）"}]}，只給 1 個版本。',
  review: '請站在「第一次來到這個網站的讀者」的視角讀這篇文章，指出：看不懂的地方（沒解釋的術語或前提）、會卡住或想離開的地方、讀完還想追問的問題、缺少的例子或畫面、標題與內容不符之處。最多 8 項，每項 text 寫「原句片段或段落位置 → 讀者會有的疑問」，note 寫建議怎麼補（一句話）。最後一項固定總結：整體讀起來順不順、讀者最可能帶走的一句話。不得替作者編造內容。回傳 JSON：{"items":[{"text":"…","note":"…"}]}',
  translate: '請把標題與整篇正文翻成「日文」與「英文」兩個版本（原文為繁體中文，所以三語 = 繁中原文＋日＋英）。語氣自然、像母語者會說的話，不要逐字直譯；保留 Markdown 結構、連結與【待補：…】標記，不得新增或刪減事實。日文用です・ます調，英文用自然的第一人稱口吻。回傳 JSON：{"items":[{"text":"第一行是譯後標題，空一行後是譯後完整正文","note":"日本語"},{"text":"…","note":"English"}]}，如果兩個語言之間有語感差異，請在對應 note 後面加一句說明。',
  faq: '請根據正文，寫 3–5 組「常見問題」。只能用正文已有的資訊回答，不得編造；每個答案 1–3 句、直接回答。輸出一個 Markdown 區塊，格式：「## 常見問題」換行，然後每組「### 問題」換行「答案」。回傳 JSON：{"items":[{"text":"Markdown 區塊","note":"常見問題"}]}',
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
    const LONG = ['polish', 'dehuman', 'translate'];
    const s = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
    const ctx = [`主要關鍵字：${s(b.keyword, 60) || '（未指定，請從內容判斷）'}`, `所屬方向：${s(b.pillar, 20)}`, `目前標題：${s(b.title, 200)}`, `目前摘要：${s(b.excerpt, 500)}`, `正文：\n${s(b.body, LONG.includes(String(b.kind)) ? 20000 : 6000)}`, s(b.selection, 3000) ? `選取文字：\n${s(b.selection, 3000)}` : '', b.kind === 'rewrite' ? `改寫方向：${({ short: '精簡成約六成長度，保留所有重點', casual: '改成更口語自然、像對朋友說話', vivid: '加入具體畫面與感官細節，但不得新增事實' } as Record<string, string>)[String(b.mode)] || '更清楚順暢'}` : ''].filter(Boolean).join('\n');
    if (b.kind === 'rewrite' && s(b.selection, 3000).length < 5) return reply({ error: '先框選要修改的文字' }, 400);
    if (ctx.replace(/\s/g, '').length < 40) return reply({ error: '內容太少，先寫關鍵字、標題或幾句正文再試' }, 400);
    const u = await usage();
    if (u.n >= DAILY_LIMIT) return reply({ error: `今天的 AI 建議已用完 ${DAILY_LIMIT} 次，明天再來` }, 429);
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${await modelName()}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: VOICE }] }, contents: [{ role: 'user', parts: [{ text: `${TASKS[b.kind]}\n\n===== 文章資料 =====\n${ctx}` }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.8, maxOutputTokens: LONG.includes(String(b.kind)) ? 12000 : 3072 } }),
    });
    if (r.status === 429) return reply({ error: 'Gemini 免費額度暫時用完，過幾分鐘再試' }, 429);
    if (!r.ok) return reply({ error: `Gemini 回應錯誤（${r.status}）` }, 502);
    await bump(u);
    const d = await r.json();
    const text = d?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
    let items: { text: string; note?: string }[] = [];
    try { const j = JSON.parse(text.replace(/^```json\s*|\s*```$/g, '')); items = (Array.isArray(j) ? j : j.items || []).map((x: any) => ({ text: String(x.text ?? '').trim(), note: String(x.note ?? '').trim() })).filter((x: any) => x.text); } catch (_) { /* 解析失敗 */ }
    if (!items.length) return reply(b.kind === 'proofread' || b.kind === 'factcheck' ? { ok: true, items: [{ text: '沒有發現需要處理的地方。', note: '看起來沒問題' }], used: u.n + 1, limit: DAILY_LIMIT } : { error: 'AI 這次沒有給出可用的結果，再按一次試試' }, b.kind === 'proofread' || b.kind === 'factcheck' ? 200 : 502);
    return reply({ ok: true, items, used: u.n + 1, limit: DAILY_LIMIT });
  } catch (_e) { return reply({ error: 'server_error' }, 500); }
});
