// 文章裡一行：  ::embed 網址 | 來源名稱
// 會變成：影片／Podcast 的嵌入播放器 ＋ 下方標註「來源：…」（連回原始頁面）。
// 只認 YouTube、Spotify、Apple Podcasts；其他網址只顯示成一張連結卡（不嵌入），避免放進來路不明的內容。
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function embedInfo(raw) {
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const h = u.hostname.replace(/^www\./, '').replace(/^m\./, '');
  if (h === 'youtu.be' || h === 'youtube.com' || h === 'music.youtube.com') {
    let id = '';
    if (h === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (u.pathname === '/watch') id = u.searchParams.get('v') || '';
    else { const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/); if (m) id = m[1]; }
    if (/^[\w-]{11}$/.test(id)) {
      const t = parseInt(u.searchParams.get('t') || u.searchParams.get('start') || '0', 10) || 0;
      return { kind: 'YouTube', src: `https://www.youtube-nocookie.com/embed/${id}${t ? `?start=${t}` : ''}`, ratio: true, label: 'YouTube 影片' };
    }
  }
  if (h === 'open.spotify.com') {
    const m = u.pathname.match(/^\/(?:intl-[a-z]+\/)?(episode|show|track|playlist|album)\/([A-Za-z0-9]+)/);
    if (m) return { kind: 'Spotify', src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, height: m[1] === 'playlist' || m[1] === 'album' ? 352 : 152, label: 'Spotify' };
  }
  if (h === 'podcasts.apple.com') {
    return { kind: 'Apple Podcasts', src: `https://embed.podcasts.apple.com${u.pathname}${u.search}`, height: /[?&]i=/.test(u.search) ? 175 : 450, label: 'Apple Podcasts' };
  }
  return { kind: '連結', src: '', label: u.hostname };
}

export function embedHtml(url, name) {
  const info = embedInfo(url);
  if (!info) return '';
  const link = esc(url);
  const credit = esc(name || new URL(url).hostname);
  let frame = '';
  if (info.src) {
    const attrs = `src="${esc(info.src)}" title="${credit}" loading="lazy" allowfullscreen allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"`;
    frame = info.ratio
      ? `<div class="embed-frame embed-16x9"><iframe ${attrs}></iframe></div>`
      : `<div class="embed-frame"><iframe ${attrs} style="height:${info.height}px"></iframe></div>`;
  }
  return `<figure class="embed">${frame}<figcaption><span>來源・${esc(info.kind)}</span><a href="${link}" target="_blank" rel="noopener noreferrer">${credit}</a></figcaption></figure>`;
}

const textOf = (n) => (n.value !== undefined ? n.value : (n.children || []).map(textOf).join(''));
function walk(node) {
  const kids = node.children;
  if (!kids) return;
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    if (k.type === 'paragraph') {
      const m = textOf(k).trim().match(/^::embed\s+(https?:\/\/[^\s|]+)\s*(?:\|\s*([\s\S]+))?$/);
      if (m) { const html = embedHtml(m[1], (m[2] || '').trim()); if (html) kids[i] = { type: 'html', value: html }; continue; }
    }
    walk(k);
  }
}
export default function remarkEmbed() { return (tree) => walk(tree); }
