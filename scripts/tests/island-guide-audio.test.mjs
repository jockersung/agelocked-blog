import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createGuideAudio,bindExclusiveAudio,createStationGuide} from '../../src/scripts/island-guide-audio.js';

class FakeAudio extends EventTarget {
  src=''; ended=false; error=null; paused=true;
  play(){this.paused=false;return this.nextPlay?.()??Promise.resolve();}
  pause(){this.paused=true;}
  removeAttribute(name){if(name==='src')this.src='';}
  load(){}
}
function fixture(){
  const media=new FakeAudio(),states=[],errors=[];
  const player=createGuideAudio(media,{onState:s=>states.push(s),onError:()=>errors.push(true)});
  return {media,states,errors,player};
}
test('player starts silent and plays only the selected station',async()=>{
  const {media,states,player}=fixture();assert.equal(media.src,'');assert.deepEqual(states,[]);
  assert.equal(media.autoplay,false);assert.equal(media.loop,false);
  await player.play('/audio/one.mp3');assert.equal(media.src,'/audio/one.mp3');assert.equal(states.at(-1),'playing');
  await player.play('/audio/two.mp3');assert.equal(media.src,'/audio/two.mp3');
  player.stop();assert.equal(media.src,'');assert.equal(media.paused,true);assert.equal(player.isActive(),false);
});
test('a stopped pending request cannot resume or report an obsolete failure',async()=>{
  const {media,states,errors,player}=fixture();let reject;
  media.nextPlay=()=>new Promise((_,no)=>{reject=no;});
  const pending=player.play('/audio/one.mp3');player.stop();reject(new Error('aborted'));await pending;
  assert.equal(states.at(-1),'idle');assert.deepEqual(errors,[]);assert.equal(player.isActive(),false);
});
test('switching clips ignores late resolution from the previous clip',async()=>{
  const {media,player,states}=fixture();let resolve;
  media.nextPlay=()=>new Promise(yes=>{resolve=yes;});const first=player.play('/audio/one.mp3');
  media.nextPlay=undefined;await player.play('/audio/two.mp3');resolve();await first;
  assert.equal(media.src,'/audio/two.mp3');assert.equal(states.at(-1),'playing');
});
test('completion clears playing state and playback failure allows retry',async()=>{
  const {media,player,states,errors}=fixture();await player.play('/audio/one.mp3');
  media.ended=true;media.dispatchEvent(new Event('ended'));assert.equal(player.isActive(),false);assert.equal(states.at(-1),'idle');
  assert.equal(media.src,'');assert.equal(media.paused,true);
  media.nextPlay=()=>Promise.reject(new Error('blocked'));await player.play('/audio/two.mp3');assert.equal(states.at(-1),'error');assert.equal(errors.length,1);
  media.nextPlay=undefined;await player.play('/audio/two.mp3');assert.equal(states.at(-1),'playing');
});
test('six routes reference six real MP3s, including the approved pronunciation revision',()=>{
  const source=readFileSync(new URL('../../src/data/island-routes.ts',import.meta.url),'utf8');
  const files=[...source.matchAll(/audio: "([^"]+)"/g)].map(m=>m[1]);
  assert.equal(files.length,6);assert.equal(new Set(files).size,6);
  for(const file of files){assert.ok(file.startsWith('/audio/island-guide/'));assert.ok(statSync(new URL('../../public'+file,import.meta.url)).size>10000);}
  assert.match(files[4],/05-heart-20261027-v2\.mp3$/);
});
test('lightweight text mode prevents overlapping audio without starting 3D',()=>{
  const first=new FakeAudio(),second=new FakeAudio();let handler,stopped=0;
  const doc={addEventListener(type,fn,capture){assert.equal(type,'play');assert.equal(capture,true);handler=fn;},querySelectorAll:()=>[first,second]};
  bindExclusiveAudio(doc,()=>stopped++,FakeAudio);
  first.paused=false;second.paused=false;handler({target:second});
  assert.equal(first.paused,true);assert.equal(second.paused,false);assert.equal(stopped,1);
});
test('all six stations require a separate icon click and never fall back to station one',async()=>{
  const {media,player}=fixture();
  const stations=Array.from({length:6},(_,i)=>({island:'station-'+(i+1),audio:`/audio/${i+1}.mp3`,jason:`Station ${i+1}`}));
  const guide=createStationGuide(player,stations);
  for(const station of stations){
    guide.select(station.island);assert.equal(player.isActive(),false);assert.equal(media.src,'');
    guide.toggle();assert.equal(media.src,station.audio);assert.equal(player.isActive(),true);
    media.ended=true;media.dispatchEvent(new Event('ended'));
    assert.equal(player.isActive(),false);assert.equal(media.src,'');assert.equal(media.paused,true);
    guide.toggle();assert.equal(media.src,station.audio);guide.toggle();assert.equal(media.src,'');
  }
  guide.select('station-5');guide.toggle();assert.equal(media.src,'/audio/5.mp3');
  guide.select('station-6');assert.equal(media.src,'');assert.equal(player.isActive(),false);
});
