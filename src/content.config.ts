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
				'症狀解析',   // 入口層：從搜尋症狀進來
				'身體保健',   // 機制層：疲勞、免疫、粒線體、NAD+
				'皮膚保養',   // 機制層：乾癢、自由基、氧化壓力
				'體檢紅字',   // 高意圖層：有報告不知怎麼辦
			]),

			// ── 選填：對應的底層機制（文章互連用）──
			mechanism: z.enum([
				'免疫修復',   // 感冒、嘴破、傷口
				'細胞能量',   // 疲勞、睡眠、體力
				'氧化壓力',   // 皮膚、眼睛、肩頸
			]).optional(),

			// ── 選填：首頁精選 ──
			featured: z.boolean().default(false),
		}),
});

export const collections = { blog };
