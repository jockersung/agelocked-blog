import {test} from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {execFileSync} from 'node:child_process';
const source=fs.readFileSync(new URL('../audio/build-audio.mjs',import.meta.url),'utf8');
function fixture(fn){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'agelocked-audio-ci-'));const file='src/content/blog/cat/繁體中文測試/index.md';
 const put=(p,t)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),t);};
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
 put('scripts/audio/build-audio.mjs',source);put('scripts/audio/pronounce.json','{}');put('src/data/audio-manifest.json',JSON.stringify({example:{hash:'pre-existing-stale-hash',file:'/audio/example.mp3'}}));put('public/audio/example.mp3','dry-run fixture');put('audio-queue.txt','# Empty queue\n');
 const article=(title='範例',body='原本的朗讀內容。')=>`---\ntitle: "${title}"\nslug: example\n---\n\n${body}\n`;
 put(file,article());git('init','-q');git('config','user.name','Local Test');git('config','user.email','test@example.invalid');git('add','.');git('commit','-qm','baseline');
 const before=git('rev-parse','HEAD');
 const plan=(sha)=>{
  const env={...process.env,BEFORE:sha,INPUT_SLUGS:'',AUTO_NEW:''};delete env.GEMINI_API_KEY;delete env.GOOGLE_API_KEY;delete env.GEMINI_VOICE_ID;
  execFileSync(process.execPath,['scripts/audio/build-audio.mjs','--ci','--dry-run','--out','plan'],{cwd:root,env,stdio:'pipe'});
  return JSON.parse(fs.readFileSync(path.join(root,'plan/plan.json'),'utf8'));
 };
 try{fn({root,file,put,git,article,before,plan});}finally{
  assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep+'agelocked-audio-ci-'));
  fs.rmSync(root,{recursive:true,force:true});
 }
}
test('Chinese-path image-only change does not rerecord an already stale voice',()=>fixture(({file,put,git,article,before,plan})=>{
 put(file,article('範例','原本的朗讀內容。\n\n![新增圖](./new.webp)'));git('add',file);git('commit','-qm','image only');assert.deepEqual(plan(before),[]);
}));
test('actual narration edit still schedules the article',()=>fixture(({file,put,git,article,before,plan})=>{
 put(file,article('範例','修改後的朗讀內容。'));git('add',file);git('commit','-qm','text edit');assert.equal(plan(before)[0].slug,'example');
}));
test('title change still schedules a new spoken introduction',()=>fixture(({file,put,git,article,before,plan})=>{
 put(file,article('新的標題'));git('add',file);git('commit','-qm','title edit');assert.equal(plan(before)[0].slug,'example');
}));
test('explicit queue still refreshes pre-existing stale narration',()=>fixture(({file,put,git,article,before,plan})=>{
 put(file,article('範例','原本的朗讀內容。\n\n![新增圖](./new.webp)'));git('add',file);git('commit','-qm','image only');put('audio-queue.txt','example\n');assert.equal(plan(before)[0].slug,'example');
}));
test('image production comments neither trigger rerecording nor enter narration',()=>fixture(({file,put,git,article,before,plan})=>{
 put(file,article('範例','原本的朗讀內容。\n\n<!-- 🎨 [cover]\n畫面：PRIVATE_PROMPT_NOT_NARRATION\n標籤：不要朗讀這段\n-->\n\n![圖片](./cover.webp)'));
 git('add',file);git('commit','-qm','production comments');assert.deepEqual(plan(before),[]);
 put('audio-queue.txt','example\n');const result=plan(before);assert.equal(result.length,1);
 assert.ok(!result[0].parts.join('').includes('PRIVATE_PROMPT_NOT_NARRATION'));
 assert.ok(!result[0].parts.join('').includes('不要朗讀這段'));
}));
