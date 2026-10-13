import crypto from 'node:crypto';
import { SITE, ALLOWED_EMAILS, readCookie, setSession, errorPage } from './_session.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const clear = ['g_state=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0', 'g_pkce=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0'];
  try {
    const { code, state, error } = req.query || {};
    if (error) { res.setHeader('Set-Cookie', clear); return errorPage(res, 400, '已取消 Google 登入。'); }
    const expected = readCookie(req, 'g_state'), verifier = readCookie(req, 'g_pkce');
    if (!code || !state || !expected || !verifier || state.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expected))) {
      res.setHeader('Set-Cookie', clear);
      return errorPage(res, 400, '登入驗證失敗（state 不符），請回到後台重新登入。');
    }
    const t = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${SITE}/api/google_callback`, grant_type: 'authorization_code', code_verifier: verifier }),
    });
    const tok = await t.json();
    if (!t.ok || !tok.access_token) { res.setHeader('Set-Cookie', clear); return errorPage(res, 400, '無法取得 Google 授權，請重新登入。'); }
    const u = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tok.access_token}` } });
    const info = u.ok ? await u.json() : null;
    const email = String(info?.email || '').toLowerCase();
    if (!info || !info.email_verified || !ALLOWED_EMAILS.includes(email)) {
      res.setHeader('Set-Cookie', clear);
      return errorPage(res, 403, `這個 Google 帳號（${email || '未知'}）沒有後台權限。`);
    }
    res.setHeader('Set-Cookie', [...clear, setSession(res, email)]);
    res.writeHead(302, { Location: `${SITE}/studio/` });
    res.end();
  } catch (e) {
    res.setHeader('Set-Cookie', clear);
    errorPage(res, 500, '登入時發生錯誤，請稍後再試。');
  }
}
