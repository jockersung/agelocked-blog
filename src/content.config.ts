import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: image().optional(),

			// ── 分類 ──
			category: z.enum([
				'身體訊號',
				'慢性發炎科學',
				'精準健康工具',
				'介入與調校',
			]),

			// ── 選填：首頁精選 ──
			featured: z.boolean().default(false),
		}),
});

export const collections = { blog };
