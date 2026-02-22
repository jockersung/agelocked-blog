export const CATEGORY_MAP: Record<string, string> = {
  'antiaging-health':   '抗衰老保健',
  'antiaging-skincare': '抗衰老保養',
  'ageloc-products':    '抗衰老產品',
  'test-post':          '網路行銷',
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
