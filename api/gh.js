// Studio → GitHub, through the server. GitHub credentials live only on the server (see _github.js)
// and this proxy only reaches the contents of the one repo.
import { getSession, sameOrigin } from './_session.js';
import { githubToken } from './_github.js';
const REPO = process.env.CONTENT_REPO || 'bakerlin8/8aker-site';
const PREFIX = `/repos/${REPO}/contents/`;
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  let s = null;
  try { s = getSession(req); } catch (e) { return res.status(503).json({ message: 'Studio 登入尚未設定' }); }
  if (!s) return res.status(401).json({ message: 'unauthorized' });
  if (req.method !== 'GET' && !sameOrigin(req)) return res.status(403).json({ message: 'forbidden' });
  if (!['GET', 'PUT', 'DELETE'].includes(req.method)) return res.status(405).json({ message: 'method not allowed' });
  const path = String(req.query.p || '');
  if (path === '/user') return res.status(200).json({ login: s.email });
  if (!path.startsWith(PREFIX) || path.includes('..') || path.length > 400) return res.status(400).json({ message: 'path not allowed' });
  let token;
  try { token = await githubToken(); } catch (e) { return res.status(503).json({ message: String(e.message || e) }); }
  const r = await fetch(`https://api.github.com${path}`, {
    method: req.method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': '8aker0-studio', 'Content-Type': 'application/json' },
    body: req.method === 'GET' ? undefined : JSON.stringify(typeof req.body === 'string' ? JSON.parse(req.body) : req.body),
  });
  const text = await r.text();
  res.status(r.status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(text);
}
