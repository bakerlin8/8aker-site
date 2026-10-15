// 作品卡的色塊。依作品順序自動輪替；作品也可以在 Studio 指定 color（填下面的 key）。
// wb/wb2：卡片底色的漸層（深）；dc：編號、浮水印等點綴色（亮）
export const WORK_COLORS = [
  { key: 'wine',     name: '葡萄酒', wb: '#4A1424', wb2: '#2E0C16', dc: '#E0A2B0' },
  { key: 'pine',     name: '松綠',   wb: '#1E3A33', wb2: '#12241F', dc: '#9CC7B2' },
  { key: 'navy',     name: '藏青',   wb: '#1E2B47', wb2: '#121A2C', dc: '#A9BDE6' },
  { key: 'chestnut', name: '栗色',   wb: '#46291A', wb2: '#2A180E', dc: '#E3B98A' },
  { key: 'plum',     name: '葡萄紫', wb: '#38203F', wb2: '#211226', dc: '#CDAADB' },
  { key: 'celadon',  name: '青磁',   wb: '#173B42', wb2: '#0E2328', dc: '#94CBD0' },
] as const;

export function workColor(w: any, i: number) {
  return WORK_COLORS.find((c) => c.key === w?.color) ?? WORK_COLORS[i % WORK_COLORS.length];
}
export const colorVars = (c: { wb: string; wb2: string; dc: string }) => `--wb:${c.wb};--wb2:${c.wb2};--dc:${c.dc}`;
