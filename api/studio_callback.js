import { finishAuth, errorPage, SITE } from './_lib.js';
export default async function handler(req, res) {
  try {
    const r = await finishAuth(req, res);
    if (r.error) return errorPage(res, r.status, r.error);
    // Token travels in the URL fragment, which browsers never send to any server.
    res.writeHead(302, { Location: `${SITE}/studio/#gh_token=${r.token}` });
    res.end();
  } catch (e) { errorPage(res, 500, '登入時發生錯誤，請稍後再試。'); }
}
