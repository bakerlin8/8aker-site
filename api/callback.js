import { finishAuth, errorPage, SITE } from './_lib.js';
// Backup editor (/admin, Decap CMS). The token is only ever posted to our own origin.
export default async function handler(req, res) {
  try {
    const r = await finishAuth(req, res);
    if (r.error) return errorPage(res, r.status, r.error);
    const payload = JSON.stringify({ token: r.token, provider: 'github' });
    const origin = JSON.stringify(SITE);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><script>
(function(){
  var ORIGIN=${origin};
  if(!window.opener){document.body.textContent='請從後台重新登入。';return;}
  window.addEventListener('message',function(m){
    if(m.origin!==ORIGIN)return;
    window.opener.postMessage('authorization:github:success:'+${JSON.stringify(payload)},ORIGIN);
  },false);
  window.opener.postMessage('authorizing:github',ORIGIN);
})();
</script>`);
  } catch (e) { errorPage(res, 500, '登入時發生錯誤，請稍後再試。'); }
}
