export const CATEGORY_MAP: Record<string, string> = {
  'body-signals':             '身體訊號',
  'chronic-inflammation':     '慢性發炎科學',
  'precision-health-tools':   '精準健康工具',
  'intervention-optimization':'介入與調校',
};

// Inverse map: label → slug
export const LABEL_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_MAP).map(([slug, label]) => [label, slug])
);

export function getCategorySlug(postId: string): string | null {
  const parts = postId.split('/');
  if (parts.length < 2) return null;
  return CATEGORY_MAP[parts[0]] ? parts[0] : null;
}

export function getCategoryLabel(slug: string): string {
  return CATEGORY_MAP[slug] ?? slug;
}

export const ALL_CATEGORY_SLUGS = Object.keys(CATEGORY_MAP);

// Returns the URL slug used in getStaticPaths for a given post
export function getUrlSlug(post: { id: string; data: { category: string } }): string {
  if (post.id.includes('/')) {
    // Path-based ID already contains category folder prefix
    return post.id;
  }
  // Flat English slug — prepend category folder
  const catSlug = LABEL_TO_SLUG[post.data.category];
  return catSlug ? `${catSlug}/${post.id}` : post.id;
}
