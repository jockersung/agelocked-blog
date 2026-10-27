// ─────────────────────────────────────────────
// 文章分類 = 「男性慢老」六站（讀者看到的分類）
// frontmatter 的 category 填下面 label 其中一個。
//
// 網址不跟著分類走：文章網址是 /blog/<資料夾>/<slug>/，資料夾是舊的四個漏斗層級
// （body-signals／chronic-inflammation／precision-health-tools／intervention-optimization），
// 已凍結不改，避免 76 篇網址全部變動、影響 SEO。資料夾只決定網址和內部的閱讀步驟（tier），讀者看不到。
// ─────────────────────────────────────────────
export const STATIONS = [
  { n: 1, slug: 'body',          label: '身材',       city: '台北', color: '#e9a27c', desc: '肚子、腰圍、體重與代謝：40 歲後最先被看見的變化。' },
  { n: 2, slug: 'face',          label: '臉蛋',       city: '新北', color: '#f2b5c6', desc: '生理年齡、老化時鐘與長壽科學：為什麼有人看起來比實際年輕。' },
  { n: 3, slug: 'sexual-health', label: '性健康',     city: '桃園', color: '#7fa6c9', desc: '精力、睡眠、壓力與睪固酮：以前不用想的反應，現在開始在意。' },
  { n: 4, slug: 'hair',          label: '禿頭、白髮', city: '台中', color: '#b49ad0', desc: '白髮、髮際線與幹細胞儲備：鏡子裡最早出現的年紀。' },
  { n: 5, slug: 'heart',         label: '心血管',     city: '台南', color: '#e38c8c', desc: 'ApoB、Lp(a)、hs-CRP、血壓與大腦：維持狀態十年以上的底盤。' },
  { n: 6, slug: 'checkup',       label: '健檢站',     city: '高雄', color: '#6f7fb5', desc: '評估、Prysm iO 掃描、保健品識讀與營養補充：把在意的變化換成自己的數據。' },
] as const;

export const CATEGORY_LABELS = STATIONS.map((s) => s.label) as unknown as [string, ...string[]];

export const CATEGORY_MAP: Record<string, string> = Object.fromEntries(STATIONS.map((s) => [s.slug, s.label]));

// Inverse map: label → slug
export const LABEL_TO_SLUG: Record<string, string> = Object.fromEntries(STATIONS.map((s) => [s.label, s.slug]));

export const stationOf = (label: string) => STATIONS.find((s) => s.label === label);

export function getCategoryLabel(slug: string): string {
  return CATEGORY_MAP[slug] ?? slug;
}

export const ALL_CATEGORY_SLUGS = STATIONS.map((s) => s.slug);

// 舊分類資料夾 → 閱讀步驟（1 察覺、2 原因、3 量測、4 調整），只供內部使用
export const FOLDER_TIER: Record<string, number> = {
  'body-signals': 1,
  'chronic-inflammation': 2,
  'precision-health-tools': 3,
  'intervention-optimization': 4,
};

type PostLike = { id: string; filePath?: string; data: { category: string } };

// 文章所在資料夾（= 網址前綴）
export function getFolder(post: PostLike): string | null {
  const m = (post.filePath ?? '').replace(/\\/g, '/').match(/content\/blog\/([^/]+)\//);
  return m && FOLDER_TIER[m[1]] ? m[1] : null;
}

export function getTier(post: PostLike): number {
  const f = getFolder(post);
  return f ? FOLDER_TIER[f] : 1;
}

// Returns the URL slug used in getStaticPaths for a given post
export function getUrlSlug(post: PostLike): string {
  if (post.id.includes('/')) return post.id;
  const folder = getFolder(post);
  return folder ? `${folder}/${post.id}` : post.id;
}
