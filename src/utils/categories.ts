export const CATEGORY_MAP: Record<string, string> = {
  'body-signals':             '身體訊號',
  'chronic-inflammation':     '慢性發炎科學',
  'precision-health-tools':   '精準健康工具',
  'intervention-optimization':'介入與調校',
};

export function getCategorySlug(postId: string): string | null {
  const parts = postId.split('/');
  if (parts.length < 2) return null;
  return CATEGORY_MAP[parts[0]] ? parts[0] : null;
}

export function getCategoryLabel(slug: string): string {
  return CATEGORY_MAP[slug] ?? slug;
}

export const ALL_CATEGORY_SLUGS = Object.keys(CATEGORY_MAP);
