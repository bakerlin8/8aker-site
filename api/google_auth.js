import crypto from 'node:crypto';
import { SITE, ALLOWED_EMAILS, errorPage } from './_session.js';
export default function handler(req, res) {
  if (!process.env.GOOGLE_CLIENT_ID) return errorPage(res, 503, 'Google 登入還沒設定完成（缺少 GOOGLE_CLIENT_ID）。');
  const state = crypto.randomBytes(24).toString('hex');
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
  u.searchParams.set('redirect_uri', `${SITE}/api/google_callback`);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'openid email');
  u.searchParams.set('state', state);
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('login_hint', ALLOWED_EMAILS[0]);
  u.searchParams.set('prompt', 'select_account');
  res.setHeader('Set-Cookie', [
    `g_state=${state}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    `g_pkce=${verifier}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  ]);
  res.setHeader('Cache-Control', 'no-store');
  res.writeHead(302, { Location: u.toString() });
  res.end();
}
