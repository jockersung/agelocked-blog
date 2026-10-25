// Run after npm run build. Verify rendered figures, not only Markdown occurrences.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..'),blog=path.join(root,'src/content/blog');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(d,x.name)):[path.join(d,x.name)]);
test('all 76 articles actually render at least three distinct WebP body images',()=>{
 const files=walk(blog).filter(x=>/\.mdx?$/.test(x));assert.equal(files.length,76);let total=0;
 for(const p of files){
  const source=fs.readFileSync(p,'utf8'),slug=source.match(/^slug:\s*["']?([^\n"']+)/m)[1].trim();
  const category=path.relative(blog,p).split(path.sep)[0];const html=fs.readFileSync(path.join(root,'dist/blog',category,slug,'index.html'),'utf8');
  const body=html.split(/<article\b[^>]*>/)[1].split(/<!--\s*===== ARTICLE CTA|<div class="article-cta/)[0];
  const images=[...new Set([...body.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map(x=>x[1]))];
  assert.ok(images.length>=3,`${slug}: only ${images.length} rendered images`);
  assert.ok(images.every(x=>x.endsWith('.webp')),`${slug}: body image is not WebP`);total+=images.length;
 }
 assert.equal(total,244);
});
test('no bare Markdown body-image URL contains unescaped whitespace',()=>{
 for(const p of walk(blog).filter(x=>/\.mdx?$/.test(x))){
  const s=fs.readFileSync(p,'utf8');
  for(const m of s.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g))assert.ok(!/\s/.test(m[1])||/^<[^>]+>$/.test(m[1]),`${p}: ${m[1]}`);
 }
});
