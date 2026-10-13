// Who is signed in (Google). Also hands out a 15-minute token for the body-data database.
import { getSession, healthToken, clearSession, sameOrigin } from './_session.js';
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'DELETE') {
    if (!sameOrigin(req)) return res.status(403).json({ error: 'forbidden' });
    res.setHeader('Set-Cookie', clearSession());
    return res.status(200).json({ ok: true });
  }
  let s = null;
  try { s = getSession(req); } catch (e) { return res.status(503).json({ error: 'not_configured' }); }
  if (!s) return res.status(401).json({ error: 'unauthorized' });
  res.status(200).json({ email: s.email, health_token: healthToken(s.email) });
}
