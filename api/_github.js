// GitHub credentials for Studio saves (server only).
// Preferred: our own GitHub App → a fresh 1-hour token is minted automatically, nothing ever expires.
//   env: GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY (the .pem contents)
// Fallback: a fine-grained personal token in GITHUB_CONTENT_TOKEN (expires; must be renewed by hand).
import crypto from 'node:crypto';
const REPO = process.env.CONTENT_REPO || 'bakerlin8/8aker-site';
let cached = null; // { token, exp }

function appJwt() {
  const key = String(process.env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const body = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({ iat: now - 60, exp: now + 540, iss: String(process.env.GITHUB_APP_ID) })}`;
  return `${body}.${crypto.sign('RSA-SHA256', Buffer.from(body), key).toString('base64url')}`;
}
const H = (auth) => ({ Authorization: auth, Accept: 'application/vnd.github+json', 'User-Agent': '8aker0-studio' });

export async function githubToken() {
  if (process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY) {
    if (cached && cached.exp - Date.now() > 5 * 60e3) return cached.token;
    const jwt = appJwt();
    const inst = await fetch(`https://api.github.com/repos/${REPO}/installation`, { headers: H(`Bearer ${jwt}`) });
    if (!inst.ok) throw new Error(`GitHub App 尚未安裝到 ${REPO}（${inst.status}）`);
    const { id } = await inst.json();
    const r = await fetch(`https://api.github.com/app/installations/${id}/access_tokens`, {
      method: 'POST', headers: { ...H(`Bearer ${jwt}`), 'Content-Type': 'application/json' },
      body: JSON.stringify({ repositories: [REPO.split('/')[1]], permissions: { contents: 'write' } }),
    });
    if (!r.ok) throw new Error(`無法取得 GitHub App 憑證（${r.status}）`);
    const d = await r.json();
    cached = { token: d.token, exp: new Date(d.expires_at).getTime() };
    return cached.token;
  }
  if (process.env.GITHUB_CONTENT_TOKEN) return process.env.GITHUB_CONTENT_TOKEN;
  throw new Error('還沒設定 GitHub 存檔憑證');
}
