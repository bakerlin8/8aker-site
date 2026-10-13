// Google sign-in for Studio: signed session cookie + short-lived tokens for the body-data database.
// Files starting with "_" are not deployed as routes.
import crypto from 'node:crypto';

export const SITE = `https://${process.env.SITE_HOST || '8aker0.com'}`;
// Only these Google accounts may enter Studio.
export const ALLOWED_EMAILS = (process.env.ALLOWED_GOOGLE_EMAILS || 'nr.bater@gmail.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const COOKIE = 's8_session';
const SESSION_DAYS = 30;

function key() {
  const k = process.env.STUDIO_SESSION_SECRET;
  if (!k || k.length < 32) throw new Error('STUDIO_SESSION_SECRET missing');
  return k;
}
const b64 = (b) => Buffer.from(b).toString('base64url');
function sign(payload) {
  const body = b64(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', key()).update(body).digest('base64url');
  return `${body}.${mac}`;
}
function verify(token) {
  if (typeof token !== 'string' || token.length > 2000) return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const good = crypto.createHmac('sha256', key()).update(body).digest('base64url');
  if (mac.length !== good.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!p.exp || p.exp < Date.now() / 1000) return null;
    if (!ALLOWED_EMAILS.includes(String(p.email).toLowerCase())) return null;
    return p;
  } catch { return null; }
}

export function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function setSession(res, email) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  const tok = sign({ typ: 'session', email, exp });
  return `${COOKIE}=${tok}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}
export const clearSession = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export function getSession(req) {
  const p = verify(readCookie(req, COOKIE));
  return p && p.typ === 'session' ? p : null;
}

// Short-lived bearer token the browser hands to the body-data database, which checks it back with /api/studio_verify.
export function healthToken(email) {
  return 's8.' + sign({ typ: 'health', email, exp: Math.floor(Date.now() / 1000) + 15 * 60 });
}
export function verifyHealthToken(t) {
  if (typeof t !== 'string' || !t.startsWith('s8.')) return null;
  const p = verify(t.slice(3));
  return p && p.typ === 'health' ? p : null;
}

// Writes must come from our own pages (SameSite=Lax already blocks most cross-site requests).
export function sameOrigin(req) {
  const o = req.headers.origin;
  return !o || o === SITE;
}

export function errorPage(res, status, message) {
  res.status(status).setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>登入失敗</title>
<body style="font-family:system-ui,sans-serif;background:#1C0F14;color:#EFE5D6;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center">
<div><p>${String(message).replace(/</g, '&lt;')}</p><p><a style="color:#D4A24C" href="${SITE}/studio/">回到後台</a></p></div></body>`);
}
