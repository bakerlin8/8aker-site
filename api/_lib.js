// Shared helpers for the GitHub OAuth endpoints. Files starting with "_" are not deployed as routes.
import crypto from 'node:crypto';

// Only these GitHub accounts may sign in to the editors. Override with ALLOWED_GITHUB_LOGINS="a,b" if needed.
export const ALLOWED = (process.env.ALLOWED_GITHUB_LOGINS || 'bakerlin8').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
// Never trust the Host header for redirects; always send people back to the canonical site.
export const SITE = `https://${process.env.SITE_HOST || '8aker0.com'}`;
// The repo is public, so write access to public repos is all the editors need (not the user's private repos).
export const SCOPE = 'public_repo';

export function startAuth(res, callbackPath) {
  const state = crypto.randomBytes(24).toString('hex');
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', process.env.OAUTH_CLIENT_ID);
  url.searchParams.set('redirect_uri', `${SITE}${callbackPath}`);
  url.searchParams.set('scope', SCOPE);
  url.searchParams.set('state', state);
  url.searchParams.set('allow_signup', 'false');
  res.setHeader('Set-Cookie', `oauth_state=${state}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  res.setHeader('Cache-Control', 'no-store');
  res.writeHead(302, { Location: url.toString() });
  res.end();
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

// Verifies state (CSRF), exchanges the code, and checks the account is allowed.
// Returns { token } or { error, status }.
export async function finishAuth(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Set-Cookie', 'oauth_state=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  const { code, state } = req.query || {};
  const expected = readCookie(req, 'oauth_state');
  if (!code || !state || !expected || state.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expected))) {
    return { status: 400, error: '登入驗證失敗（state 不符），請回到後台重新登入。' };
  }
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: process.env.OAUTH_CLIENT_ID, client_secret: process.env.OAUTH_CLIENT_SECRET, code }),
  });
  const data = await tokenRes.json();
  if (data.error || !data.access_token) return { status: 400, error: '無法取得授權，請重新登入。' };
  const userRes = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${data.access_token}`, 'User-Agent': '8aker0-auth' } });
  const user = userRes.ok ? await userRes.json() : null;
  if (!user || !ALLOWED.includes(String(user.login).toLowerCase())) {
    // Not an allowed account: revoke the token we just received so it can't be reused.
    try {
      const basic = Buffer.from(`${process.env.OAUTH_CLIENT_ID}:${process.env.OAUTH_CLIENT_SECRET}`).toString('base64');
      await fetch(`https://api.github.com/applications/${process.env.OAUTH_CLIENT_ID}/token`, {
        method: 'DELETE', headers: { Authorization: `Basic ${basic}`, Accept: 'application/vnd.github+json', 'User-Agent': '8aker0-auth', 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: data.access_token }),
      });
    } catch (e) {}
    return { status: 403, error: '這個 GitHub 帳號沒有編輯權限。' };
  }
  return { token: data.access_token };
}

export function errorPage(res, status, message) {
  res.status(status).setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>登入失敗</title>
<body style="font-family:system-ui,sans-serif;background:#1C0F14;color:#EFE5D6;display:grid;place-items:center;min-height:100vh;margin:0">
<div style="text-align:center"><p>${message.replace(/</g, '&lt;')}</p><p><a style="color:#D4A24C" href="${SITE}/studio/">回到後台</a></p></div></body>`);
}
