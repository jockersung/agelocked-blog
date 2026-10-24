// 文章語音版產生器：用 Gemini TTS（作者本人複製聲音）把文章轉成 MP3，放在 public/audio/<slug>.mp3。
//
// 本機試跑（不呼叫 API，只輸出要唸的稿子）：node scripts/audio/build-audio.mjs --dry-run --only <slug>
// GitHub Actions 會用 --ci 模式自動執行，見 .github/workflows/article-audio.yml。
//
// 需要的環境變數：GEMINI_API_KEY（必填）；GEMINI_VOICE_ID（選填，沒填會自動找名稱含「AGELOCKED」的聲音）
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = process.cwd();
const BLOG = join(ROOT, 'src/content/blog');
const OUT = join(ROOT, 'public/audio');
const MANIFEST = join(ROOT, 'src/data/audio-manifest.json');
const QUEUE = join(ROOT, 'audio-queue.txt');
const MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';
const API = 'https://generativelanguage.googleapis.com/v1beta';
const STYLE = '台灣華語。這是一集健康 podcast，主持人帶著笑意跟聽眾聊天：聲音明亮、有精神、音調稍微上揚，抑揚頓挫明顯，不要低沉也不要平淡；講到驚訝或重點的地方語氣要有起伏，像在跟朋友分享一個很想讓對方知道的發現。語速中等偏快，段落之間自然停頓。';
const CHUNK = 1400; // 每次請求的字數上限（約 5 分鐘語音）
const SR = 24000;
const TEMPO = 0.8; // 播放速度：1 = 模型原速；0.8 = 放慢到 8 成（不改變音高）

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };

// ── 讀文章 ─────────────────────────────────────────────
function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? walk(join(dir, d.name)) : /\.mdx?$/.test(d.name) ? [join(dir, d.name)] : []); }
function parse(file) {
  const raw = readFileSync(file, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const fm = m ? m[1] : ''; const body = m ? m[2] : raw;
  const get = (k) => { const r = fm.match(new RegExp(`^${k}:\\s*["']?(.*?)["']?\\s*$`, 'm')); return r ? r[1] : ''; };
  return { file, slug: get('slug'), title: get('title'), cta: get('ctaType') === 'hard' ? 'hard' : 'soft', body };
}
const ARTICLES = walk(BLOG).map(parse).filter((a) => a.slug);
const bySlug = new Map(ARTICLES.map((a) => [a.slug, a]));

// ── 把 Markdown 轉成要唸的稿子 ───────────────────────────
const DICT = Object.entries(JSON.parse(readFileSync(join(ROOT, 'scripts/audio/pronounce.json'), 'utf8'))).filter(([k]) => !k.startsWith('_')).sort((a, b) => b[0].length - a[0].length);
// Podcast 開場與結尾。結尾 CTA 跟著文章 frontmatter 的 ctaType：soft → 身體警報訊號評估清單，hard → 掃描前資料表
const INTRO = (title) => `大家好，我是健康島島主 Jason！今天要跟大家分享一個很多人都忽略的事：${title}。`;
const OUTRO = {
  soft: '好，今天就分享到這裡。如果你聽完覺得，欸，這好像在說我，歡迎到我的網站 age locked 點 com，花一分鐘做「身體警報訊號評估清單」，先看看你的身體現在有哪些訊號在亮燈。今天提到的研究和參考文獻，也都整理在網站的文章裡。我是健康島島主 Jason，我們下次見！',
  hard: '好，今天就分享到這裡。如果你手上已經有健檢報告，歡迎到我的網站 age locked 點 com，填寫「掃描前資料表」，把你的數據整理起來，看看接下來九十天，最值得先調整的是哪一件事。今天提到的研究和參考文獻，也都整理在網站的文章裡。我是健康島島主 Jason，我們下次見！',
};
export function toScript(a) {
  let t = a.body.replace(/\r/g, '');
  t = t.split(/\n#{1,6}\s*(?:參考資料|參考文獻|學術文獻|References)/)[0];
  t = t.replace(/\*\*延伸閱讀[：:]?\*\*[\s\S]*?(?=\n\s*\n(?!\s*[-*]\s)|$)/g, '');
  t = t.replace(/```[\s\S]*?```/g, '');
  t = t.replace(/(^\|.*\|\s*$\n?)+/gm, '\n（這裡有一張表格，可以在網頁上看。）\n');
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  t = t.replace(/<[^>]+>/g, '');
  t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  t = t.replace(/https?:\/\/\S+/g, '');
  t = t.replace(/^\s*(?:-{3,}|\*{3,})\s*$/gm, '');
  t = t.replace(/^#{1,6}\s*(.+?)\s*$/gm, (_, h) => '\n' + h + (/[。！？!?：:]$/.test(h) ? '' : '。') + '\n');
  t = t.replace(/^\s*>\s?/gm, '');
  t = t.replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '');
  t = t.replace(/\*\*|__|\*|_|`/g, '');
  t = t.replace(/\[\d+(?:[,–-]\d+)*\]/g, '');
  t = t.replace(/[（(][^（）()]*[A-Za-z][^（）()]*\b(?:19|20)\d{2}[^（）()]*[）)]/g, ''); // 行內文獻引用 (Kwok et al., 2025)
  t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '');
  t = t.replace(/——|—/g, '，').replace(/→|⇒|➜/g, '，');
  for (const [k, v] of DICT) t = t.split(k).join(v);
  const paras = t.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, '').trim()).filter((p) => p && !/^[，。、\s]*$/.test(p));
  const title = DICT.reduce((s, [k, v]) => s.split(k).join(v), a.title.replace(/——|—/g, '，'));
  return [INTRO(title), ...paras, OUTRO[a.cta]];
}
function chunks(paras) {
  const out = []; let cur = '';
  const push = (p) => { if ((cur + '\n' + p).length > CHUNK && cur) { out.push(cur); cur = p; } else cur = cur ? cur + '\n' + p : p; };
  for (const p of paras) {
    if (p.length <= CHUNK) { push(p); continue; }
    for (const s of p.match(/[^。！？!?]+[。！？!?]*/g) || [p]) push(s);
  }
  if (cur) out.push(cur);
  return out;
}
const hashOf = (paras) => createHash('sha256').update(MODEL + '|' + STYLE + '|' + TEMPO + '|' + paras.join('\n')).digest('hex').slice(0, 16);

// ── Gemini TTS ───────────────────────────────────────
const KEY = process.env.GEMINI_API_KEY;
async function api(path, init = {}, tries = 5) {
  for (let i = 0; ; i++) {
    const r = await fetch(API + path, { ...init, headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json', ...(init.headers || {}) } });
    if (r.ok) return r.json();
    const body = await r.text();
    if (i < tries - 1 && (r.status === 429 || r.status >= 500)) { const wait = 2 ** i * 8000; console.log(`  API ${r.status}，${wait / 1000} 秒後重試`); await new Promise((s) => setTimeout(s, wait)); continue; }
    throw new Error(`Gemini API ${r.status}: ${body.slice(0, 400)}`);
  }
}
async function findVoice() {
  if (process.env.GEMINI_VOICE_ID) return process.env.GEMINI_VOICE_ID;
  const all = []; let token = '';
  do {
    const j = await api(`/voices?pageSize=200${token ? '&pageToken=' + encodeURIComponent(token) : ''}`);
    all.push(...(j.voices || []));
    token = j.nextPageToken || j.next_page_token || '';
  } while (token);
  const name = (v) => v.display_name || v.displayName || v.name || '';
  const mine = all.filter((v) => /AGELOCKED|本人/i.test(name(v)) && String(v.id || v.name || '').includes('voice_'));
  if (!mine.length) {
    console.log('專案裡的自訂聲音：'); all.filter((v) => String(v.id || '').startsWith('voice_')).forEach((v) => console.log(' ', v.id, name(v)));
    throw new Error('找不到名稱含「AGELOCKED」的聲音。請在 GitHub Secrets 加上 GEMINI_VOICE_ID，或確認金鑰屬於建立該聲音的專案。');
  }
  // 有好幾個符合時，用最新建立的那一個（重新複製聲音後會自動換用新的）
  const t = (v) => Date.parse(v.create_time || v.createTime || v.update_time || v.updateTime || '') || 0;
  const ver = (v) => Number((name(v).match(/v(\d+)\s*$/i) || [0, 1])[1]); // 名稱結尾 v2、v3… 版本越大越優先
  mine.sort((a, b) => ver(b) - ver(a) || t(b) - t(a));
  const v = mine[0]; console.log(`使用聲音：${name(v)}（${v.id || v.name}）${mine.length > 1 ? `，另有 ${mine.length - 1} 個同名聲音未使用` : ''}`);
  return String(v.id || v.name).replace(/^.*\/(voice_)/, '$1');
}
async function tts(text, voice) {
  const j = await api('/interactions', { method: 'POST', body: JSON.stringify({
    model: MODEL,
    input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style: STYLE }] }] }],
    response_format: { type: 'audio', mime_type: 'audio/wav', sample_rate: SR },
    generation_config: { speech_config: [{ voice }] },
  }) });
  const audio = (j.steps || []).filter((s) => s.type === 'model_output').flatMap((s) => s.content || []).filter((c) => c.type === 'audio').pop()
    || j.output_audio || (j.outputs || []).find((o) => o.type === 'audio');
  if (!audio?.data) throw new Error('Gemini 回應裡沒有音訊：' + JSON.stringify(j).slice(0, 300));
  return Buffer.from(audio.data, 'base64');
}
const ff = (a, input) => execFileSync(process.env.FFMPEG || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', ...a], { input, maxBuffer: 1 << 30 });
async function render(a, voice) {
  const paras = toScript(a); const parts = chunks(paras);
  const pcm = []; const gap = Buffer.alloc(Math.round(SR * 0.45) * 2);
  for (let i = 0; i < parts.length; i++) {
    process.stdout.write(`  段落 ${i + 1}/${parts.length}（${parts[i].length} 字）… `);
    const wav = await tts(parts[i], voice);
    pcm.push(ff(['-i', 'pipe:0', '-f', 's16le', '-ac', '1', '-ar', String(SR), 'pipe:1'], wav), gap);
    console.log('完成');
  }
  const raw = Buffer.concat(pcm);
  mkdirSync(OUT, { recursive: true });
  const tmp = join(tmpdir(), `${a.slug}.pcm`); writeFileSync(tmp, raw);
  ff(['-y', '-f', 's16le', '-ar', String(SR), '-ac', '1', '-i', tmp, ...(TEMPO !== 1 ? ['-af', `atempo=${TEMPO}`] : []), '-codec:a', 'libmp3lame', '-b:a', '40k', '-ar', '24000', '-metadata', `title=${a.title}`, '-metadata', 'artist=孫義坤（AI 合成本人聲音）', join(OUT, `${a.slug}.mp3`)]);
  rmSync(tmp);
  return { seconds: Math.round(raw.length / 2 / SR / TEMPO), hash: hashOf(paras) };
}

// ── 決定要做哪幾篇 ─────────────────────────────────────
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
let VOICE = null; // 換了聲音，已經做好的語音也算過期
const stale = (a) => !manifest[a.slug] || manifest[a.slug].hash !== hashOf(toScript(a)) || !existsSync(join(OUT, `${a.slug}.mp3`)) || (VOICE && manifest[a.slug].voice !== VOICE);
function targets() {
  const want = new Set(); let all = false;
  const add = (s) => { s = s.trim(); if (!s || s.startsWith('#')) return; if (s === 'all') all = true; else if (bySlug.has(s)) want.add(s); else console.log(`略過不存在的 slug：${s}`); };
  (opt('--only') || '').split(/[\s,]+/).forEach(add);
  (process.env.INPUT_SLUGS || '').split(/[\s,]+/).forEach(add);
  if (existsSync(QUEUE)) readFileSync(QUEUE, 'utf8').split('\n').forEach(add);
  if (flag('--ci') && process.env.BEFORE && !/^0+$/.test(process.env.BEFORE)) {
    // 這次推送有改到、而且「已經有語音」的文章 → 重新產生；新文章 → 產生
    let changed = '';
    try { changed = execFileSync('git', ['diff', '--name-only', process.env.BEFORE, 'HEAD', '--', 'src/content/blog'], { encoding: 'utf8' }); } catch { /* 淺層 clone 找不到 before 就略過 */ }
    for (const f of changed.split('\n').filter(Boolean)) { const a = ARTICLES.find((x) => x.file.endsWith(f)); if (a && (manifest[a.slug] || process.env.AUTO_NEW === '1')) want.add(a.slug); }
  }
  // 換了聲音：已經有語音的文章全部重錄
  if (VOICE) for (const [s, m] of Object.entries(manifest)) if (m.voice !== VOICE && bySlug.has(s)) want.add(s);
  const list = all ? ARTICLES.map((a) => a.slug) : [...want];
  const force = flag('--force');
  return list.filter((s) => force || stale(bySlug.get(s)));
}

// ── 主程式 ────────────────────────────────────────────
if (KEY && !flag('--dry-run')) VOICE = await findVoice();
const list = targets();
if (flag('--dry-run')) {
  const dir = opt('--out') || join(tmpdir(), 'audio-scripts'); mkdirSync(dir, { recursive: true });
  for (const s of list.length ? list : [ARTICLES[0].slug]) { const p = toScript(bySlug.get(s)); writeFileSync(join(dir, `${s}.txt`), chunks(p).join('\n\n=====（分段）=====\n\n')); console.log(`${s}：${p.join('').length} 字，${chunks(p).length} 段 → ${join(dir, s + '.txt')}`); }
  process.exit(0);
}
if (!list.length) { console.log('沒有需要產生的語音。'); process.exit(0); }
if (!KEY) { console.log('::warning::還沒設定 GEMINI_API_KEY（GitHub → Settings → Secrets and variables → Actions），這次略過語音產生。'); process.exit(0); }
const voice = VOICE;
const failed = []; let done = 0;
const LIMIT = Number(opt('--limit') || process.env.AUDIO_LIMIT || 0) || Infinity;
for (const s of list.slice(0, LIMIT)) {
  const a = bySlug.get(s); console.log(`▶ ${s}`);
  try { const r = await render(a, voice); manifest[s] = { ...r, file: `/audio/${s}.mp3`, model: MODEL, voice, updated: new Date().toISOString().slice(0, 10) }; done++; writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n'); }
  catch (e) { console.log(`  ✗ 失敗：${e.message}`); failed.push(s); }
}
// 佇列只留下失敗和這次沒輪到的
const leftover = [...failed, ...list.slice(LIMIT)];
if (existsSync(QUEUE)) writeFileSync(QUEUE, ['# 要產生語音的文章 slug，一行一篇；寫 all 代表全部。推上 main 後 GitHub Actions 會自動處理並清空。', ...leftover].join('\n') + '\n');
console.log(`完成 ${done} 篇${failed.length ? `，失敗 ${failed.length} 篇：${failed.join(', ')}` : ''}${list.length > LIMIT ? `，還有 ${list.length - LIMIT} 篇留到下次` : ''}`);
if (failed.length && !done) process.exit(1);
