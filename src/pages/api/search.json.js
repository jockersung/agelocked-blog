import { getCollection } from 'astro:content';
import { getUrlSlug } from '../../utils/categories';

export async function GET() {
  const posts = await getCollection('blog');
  const data = posts.map(post => ({
    id: post.id,
    title: post.data.title,
    description: post.data.description ?? '',
    pubDate: post.data.pubDate.toISOString().slice(0, 10),
    url: `/blog/${getUrlSlug(post)}/`,
  }));

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}
