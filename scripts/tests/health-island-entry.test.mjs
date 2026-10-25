import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const component=readFileSync(new URL('../../src/components/HealthIsland.astro',import.meta.url),'utf8');
const inline=component.match(/<script is:inline>([\s\S]*?)<\/script>/)[1];
function run({search='',preference=null,memory=8,cores=8,saveData=false}={}){
 const root={hidden:true};let active=false;
 vm.runInNewContext(inline,{location:{search},navigator:{deviceMemory:memory,hardwareConcurrency:cores,connection:{saveData}},localStorage:{getItem:()=>preference},document:{getElementById:()=>root,documentElement:{classList:{add:()=>{active=true;}}}}});
 return !root.hidden&&active;
}
test('direct home visit shows island despite legacy text preference',()=>assert.equal(run({preference:'text'}),true));
test('new visitors enter the island',()=>assert.equal(run(),true));
test('explicit lite mode still avoids automatic 3D',()=>assert.equal(run({search:'?lite'}),false));
test('low-memory devices keep lightweight fallback',()=>assert.equal(run({memory:2}),false));
test('data-saving mode keeps lightweight fallback',()=>assert.equal(run({saveData:true}),false));
test('explicit 3D entry overrides saved preference and lite heuristics',()=>assert.equal(run({search:'?3d',preference:'text',memory:2}),true));
test('text homepage exposes a visible semantic link to force 3D',()=>{
 const index=readFileSync(new URL('../../src/pages/index.astro',import.meta.url),'utf8');
 assert.match(index,/<nav class="island-home-entry" aria-label="健康島入口">/);
 assert.match(index,/<a href="\/\?3d">進入健康島 →<\/a>/);
});
