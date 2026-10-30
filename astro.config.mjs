// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://www.agelocked.com',
	redirects: {
		'/blog/': {
			destination: '/knowledge/',
			status: 301,
		},
		'/blog/precision-health-tools/three-clues-cross-reading/': {
			destination: '/blog/chronic-inflammation/inflammation-three-clues/',
			status: 301,
		},
	},
	integrations: [
		mdx(),
		sitemap({
			serialize(item) {
				item.lastmod = new Date().toISOString();
				return item;
			},
		}),
	],
});
