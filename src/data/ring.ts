// 結尾小年輪：每一歲一圈，30 歲前梅花粉紅（台灣）、之後金色（日本）、往右上偏移；只有今年這一圈亮起來。
export function buildRing(birth: string) {
  const [by, bm, bd] = String(birth || '1987-10-02').split('-').map(Number);
  const now = new Date(Date.now() + 9 * 3600e3);
  let age = now.getUTCFullYear() - by;
  if (now.getUTCMonth() + 1 < bm || (now.getUTCMonth() + 1 === bm && now.getUTCDate() < bd)) age--;
  const MOVE = 30, paths: { d: string; cls: string }[] = [];
  let ox = 0, oy = 0, last = '', lx = 0, ly = 0;
  for (let i = 1; i <= age; i++) {
    const r = 3 + i * 1.12, k = Math.max(0, i - MOVE);
    ox = k * 0.42; oy = -k * 0.34;
    let d = '';
    for (let j = 0; j <= 72; j++) {
      const t = (j / 72) * Math.PI * 2;
      const w = 1 + 0.035 * Math.sin(3 * t + 0.7) + 0.02 * Math.sin(5 * t + i * 0.13);
      const bias = i > MOVE ? 1 + 0.012 * k * Math.cos(t + 0.65) : 1;
      const x = 50 + ox + Math.cos(t) * r * w * bias, y = 50 + oy + Math.sin(t) * r * w * bias;
      d += (j ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2);
      if (i === age && j === 9) { lx = x; ly = y; }
    }
    paths.push({ d: d + 'Z', cls: i === age ? 'now' : i <= MOVE ? 'tw' : 'jp' });
  }
  return { age, paths, lx, ly };
}
