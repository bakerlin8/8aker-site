// 台灣轉帳：訪客留下稱呼＋聯絡方式後，才回傳轉帳帳號。
// 帳號只存在 Supabase（app_config: tw_bank，service role 才讀得到），不會出現在公開的 GitHub repo 或網頁原始碼。
// 每次索取都記到 inquiries（service = tw_transfer），Studio 收件匣看得到。
import { db, sha256, json, SITE } from './shared.ts';
const PREVIEW = /^https:\/\/8aker-site-git-[a-z0-9-]+-baker-lin-s-projects\.vercel\.app$/;
const okOrigin = (o: string) => o === SITE || PREVIEW.test(o);
const cors = (o: string) => ({ 'Access-Control-Allow-Origin': okOrigin(o) ? o : SITE, 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' });
const clip = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, n);

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const reply = (b: unknown, s = 200) => json(b, s, cors(origin));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== 'POST') return reply({ error: 'method' }, 405);
  if (!okOrigin(origin)) return reply({ error: 'origin' }, 403);
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== 'object') return reply({ error: 'bad_request' }, 400);
  if (b.website) return reply({ error: '暫時無法顯示，請稍後再試' }, 400); // honeypot
  if (b.action !== 'report' && typeof b.t === 'number' && b.t < 2500) return reply({ error: '請再確認一次資料' }, 400); // filled too fast = bot
  // 回報轉帳：用第一次拿帳號時回傳的 id，補上末五碼＋金額
  if (b.action === 'report') {
    const id = String(b.id || ''), last5 = String(b.last5 || '').replace(/\D/g, ''), amount = Math.round(Number(String(b.amount || '').replace(/[^\d.]/g, '')));
    if (!/^[0-9a-f-]{36}$/.test(id)) return reply({ error: '找不到這筆紀錄，請重新索取帳號' }, 400);
    if (!/^\d{5}$/.test(last5)) return reply({ error: '末五碼請填 5 個數字' }, 400);
    if (!(amount >= 1 && amount <= 1000000)) return reply({ error: '請填寫轉帳金額' }, 400);
    const note = clip(b.msg, 300);
    try {
      const rows: any[] = await db(`inquiries?id=eq.${id}&service=in.(tw_transfer,tw_transfer_paid)&select=id,name`);
      if (!rows.length) return reply({ error: '找不到這筆紀錄，請重新索取帳號' }, 404);
      const message = `已回報轉帳｜轉出帳號末五碼 ${last5}｜金額 NT$${amount.toLocaleString('en-US')}｜回報時間 ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}${note ? '\n留言：' + note : ''}`;
      await db(`inquiries?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ service: 'tw_transfer_paid', message, status: 'new' }) });
      return reply({ ok: true });
    } catch (_) { return reply({ error: '暫時無法送出，請稍後再試' }, 500); }
  }
  const name = clip(b.name, 60), contact = clip(b.contact, 120);
  if (name.length < 1 || contact.length < 3) return reply({ error: '請填寫稱呼和聯絡方式' }, 400);
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const ip_hash = ip ? (await sha256('8aker0:' + ip)).slice(0, 32) : null;
  try {
    if (ip_hash) {
      const since = new Date(Date.now() - 60 * 60e3).toISOString();
      const recent: any[] = await db(`inquiries?ip_hash=eq.${ip_hash}&service=in.(tw_transfer,tw_transfer_paid)&created_at=gte.${since}&select=id`);
      if (recent.length >= 3) return reply({ error: '索取次數太多，請一小時後再試' }, 429);
    }
    const cfg: any[] = await db('app_config?key=eq.tw_bank&select=value');
    const bank = cfg[0]?.value ? JSON.parse(cfg[0].value) : null;
    if (!bank || !bank.acct) return reply({ error: 'not_ready' }, 503);
    const ins: any[] = await db('inquiries', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify([{ service: 'tw_transfer', name, contact, message: '索取台灣轉帳帳號（尚未回報轉帳）', lang: clip(b.lang, 10), source: origin === SITE ? 'site' : 'preview', ip_hash }]) });
    return reply({ ok: true, id: ins?.[0]?.id || null, bank: { name: bank.name || '', acct: bank.acct, holder: bank.holder || '' } });
  } catch (_) { return reply({ error: '暫時無法顯示，請稍後再試' }, 500); }
});
