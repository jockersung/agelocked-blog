import { getCollection } from 'astro:content';

export async function GET() {
  const posts = await getCollection('blog');
  const data = posts.map(post => ({
    id: post.id,
    title: post.data.title,
    description: post.data.description ?? '',
    pubDate: post.data.pubDate.toISOString().slice(0, 10),
    url: `/blog/${post.id}/`,
  }));

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}
