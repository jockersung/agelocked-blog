import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { CATEGORY_LABELS } from './utils/categories';

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			// 同系列文章的推薦順序
			series: z.string().optional(),
			series_order: z.number().int().positive().optional(),
			heroImage: image().optional(),

			// ── 分類：男性慢老六站 ──
			// 六站分類（見 src/utils/categories.ts）；網址前綴由文章所在資料夾決定，不跟分類走
			category: z.enum(CATEGORY_LABELS),

			// ── 產品介紹文章（知識庫與地圖會標示「產品介紹」，跟一般衛教分開）──
			product: z.boolean().default(false),

			// ── 選填：首頁精選 ──
			featured: z.boolean().default(false),

			// ── CTA 控制 ──
			ctaType: z.enum(['soft', 'hard']).optional().default('soft'),
			ctaBridge: z.string().optional().default(''),
		}),
});

export const collections = { blog };
