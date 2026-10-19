#!/usr/bin/env node
// 把文章資料夾裡的 PNG / JPG 轉成 WebP，並自動更新同資料夾 index.md 裡的圖片路徑。
//
// 用法：
//   node scripts/png-to-webp.mjs <檔案或資料夾> [...]   轉換指定的圖片，或指定資料夾裡的所有圖片
//   node scripts/png-to-webp.mjs --all                  轉換 src/content/blog 底下所有 PNG / JPG
//   加上 --keep 會保留原始檔；預設轉換成功後刪除原始檔
//   加上 --dry 只列出會做什麼，不實際轉換
//
// 規格（依 IMAGE-STYLE.md）：最寬 2400px、不放大、WebP 品質 85。

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BLOG = path.join(ROOT, 'src/content/blog');
const EXT = /\.(png|jpe?g)$/i;
const MAX_WIDTH = 2400;
const QUALITY = 85;

const args = process.argv.slice(2);
const keep = args.includes('--keep');
const dry = args.includes('--dry');
const all = args.includes('--all');
const targets = args.filter((a) => !a.startsWith('--'));

if (!all && targets.length === 0) {
  console.log('請指定檔案或資料夾，或使用 --all。說明見檔案開頭註解。');
  process.exit(1);
}

async function collect(p) {
  const st = await fs.stat(p);
  if (st.isFile()) return EXT.test(p) ? [p] : [];
  const out = [];
  for (const e of await fs.readdir(p, { withFileTypes: true })) {
    const full = path.join(p, e.name);
    if (e.isDirectory()) out.push(...(await collect(full)));
    else if (EXT.test(e.name)) out.push(full);
  }
  return out;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function updateMarkdown(dir, oldName, newName) {
  const mds = (await fs.readdir(dir)).filter((f) => /\.mdx?$/.test(f));
  let changed = 0;
  for (const md of mds) {
    const file = path.join(dir, md);
    const text = await fs.readFile(file, 'utf8');
    // 只替換當作路徑出現的檔名：前面是 ./、/、(、引號或空白
    const re = new RegExp(`(^|[\\s('"/])(${escapeRe(oldName)})(?=[\\s)'"]|$)`, 'gm');
    const next = text.replace(re, (_, pre) => pre + newName);
    if (next !== text) {
      changed++;
      if (!dry) await fs.writeFile(file, next);
    }
  }
  return changed;
}

const files = [];
for (const t of all ? [BLOG] : targets) files.push(...(await collect(path.resolve(t))));

let ok = 0;
for (const src of files) {
  const dir = path.dirname(src);
  const oldName = path.basename(src);
  const newName = oldName.replace(EXT, '.webp');
  const dst = path.join(dir, newName);
  const rel = path.relative(ROOT, src);
  if (dry) {
    console.log(`[dry] ${rel} → ${newName}`);
    continue;
  }
  try {
    const before = (await fs.stat(src)).size;
    await sharp(src)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY, effort: 5 })
      .toFile(dst);
    const after = (await fs.stat(dst)).size;
    const mdCount = await updateMarkdown(dir, oldName, newName);
    if (!keep) await fs.unlink(src);
    ok++;
    console.log(`✓ ${rel} → ${newName}  ${Math.round(before / 1024)}KB → ${Math.round(after / 1024)}KB  更新 ${mdCount} 個 md`);
  } catch (err) {
    console.error(`✗ ${rel}：${err.message}`);
  }
}
if (!dry) console.log(`完成 ${ok} / ${files.length} 張`);
