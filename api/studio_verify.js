// Called server-to-server by the body-data database to check a Studio token.
import { verifyHealthToken } from './_session.js';
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const t = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  let p = null;
  try { p = verifyHealthToken(t); } catch (e) { return res.status(503).json({ ok: false }); }
  if (!p) return res.status(401).json({ ok: false });
  res.status(200).json({ ok: true, email: p.email });
}
