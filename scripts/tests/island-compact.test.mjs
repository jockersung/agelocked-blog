import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PerspectiveCamera,Vector3} from 'three';
import {TAIWAN_COASTLINE} from '../../src/data/taiwan-coastline.js';
import {ISLAND_OVERVIEW,DETECTION_CTA} from '../../src/data/island-overview.js';
const source=readFileSync(new URL('../../src/data/island-map.ts',import.meta.url),'utf8');
const array=key=>JSON.parse(source.slice(source.indexOf(key)+key.length,source.indexOf('\n];',source.indexOf(key))).replace(/,\s*$/,'')+']');
const stations=array('export const ISLANDS: MapIsland[] = '),land=array('export const LAND = ');
const world=h=>new Vector3(Math.sqrt(3)*2.28*(h.q+h.r/2),.65,3.42*h.r);
const center=[...stations,...land].map(world).reduce((a,b)=>a.add(b),new Vector3()).multiplyScalar(1/(stations.length+land.length)).add(new Vector3(3.6,0,5));
function view(direction,distance,fourth){
  const camera=new PerspectiveCamera(32,1280/720,.3,320);camera.position.copy(center).addScaledVector(new Vector3(...direction).normalize(),distance);camera.lookAt(center);camera.updateMatrixWorld();
  const screen=point=>{const p=point.clone().project(camera);return [(p.x+1)*640,(1-p.y)*360];};
  const coast=TAIWAN_COASTLINE.map(([x,z])=>screen(new Vector3(x,.65,z)));
  const a=screen(world(fourth)),b=screen(world(stations[4]));
  return {width:Math.max(...coast.map(p=>p[0]))-Math.min(...coast.map(p=>p[0])),height:Math.max(...coast.map(p=>p[1]))-Math.min(...coast.map(p=>p[1])),gap:Math.hypot(a[0]-b[0],a[1]-b[1])};
}
test('overview is wider, shorter, and stations four/five are closer than the previous release',()=>{
  const before=view([.16,.8,.58],78,{q:1,r:-2});
  const after=view(ISLAND_OVERVIEW.direction,ISLAND_OVERVIEW.desktopDistance,stations[3]);
  assert.ok(after.width>before.width*1.08,JSON.stringify({before,after}));
  assert.ok(after.height<before.height*.9,JSON.stringify({before,after}));
  assert.ok(after.gap<before.gap*.8,JSON.stringify({before,after}));
});
test('detection CTA is a plain form link, separate from voice playback',()=>{
  assert.equal(DETECTION_CTA.href,'/prescan/');assert.match(DETECTION_CTA.text,/檢測/);
  assert.deepEqual(Object.keys(DETECTION_CTA).sort(),['href','text']);
});
