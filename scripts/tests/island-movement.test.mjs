import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWalkSurface, acceptsMovementKey } from '../../src/scripts/island-movement.js';

const data = readFileSync(new URL('../../src/data/island-map.ts', import.meta.url), 'utf8');
const section = start => JSON.parse(data.slice(data.indexOf(start)+start.length, data.indexOf('\n];',data.indexOf(start))).replace(/,\s*$/, '').trim()+']');
const stations = section('export const ISLANDS: MapIsland[] = ');
const terrain = section('export const LAND = ');
const hexes = [...stations,...terrain.map(h=>({kind:'mountain',...h,land:true}))]
  .map(h=>({...h,x:Math.sqrt(3)*2.28*(h.q+h.r/2),z:3.42*h.r}));
const bridges=[];
const adjacency=hexes.map(()=>[]);
for(let a=0;a<hexes.length;a++) for(let b=a+1;b<hexes.length;b++){
  const A=hexes[a],B=hexes[b],dq=B.q-A.q,dr=B.r-A.r;
  if((Math.abs(dq)+Math.abs(dr)+Math.abs(dq+dr))/2!==1) continue;
  const d=Math.hypot(B.x-A.x,B.z-A.z),ux=(B.x-A.x)/d,uz=(B.z-A.z)/d;
  bridges.push({pa:{x:A.x+ux*1.8*Math.sqrt(3)/2,z:A.z+uz*1.8*Math.sqrt(3)/2},pb:{x:B.x-ux*1.8*Math.sqrt(3)/2,z:B.z-uz*1.8*Math.sqrt(3)/2}});
  adjacency[a].push(b);adjacency[b].push(a);
}
const surface=createWalkSurface(hexes,bridges,2.02);

test('all six stations are reachable through neighbouring tiles',()=>{
  const visited=new Set([0]),queue=[0];
  for(const n of queue) for(const next of adjacency[n]) if(!visited.has(next)){visited.add(next);queue.push(next);}
  stations.forEach((s,i)=>assert.ok(visited.has(i),s.id));
  assert.equal(new Set(hexes.map(h=>`${h.q},${h.r}`)).size,hexes.length,'no overlapping tiles');
});
test('every bridge is traversable in both directions, including its midpoint gap',()=>{
  assert.ok(bridges.length>5);
  for(const {pa,pb} of bridges) for(let i=0;i<=100;i++){
    const t=i/100;
    assert.ok(surface.walkable(pa.x+(pb.x-pa.x)*t,pa.z+(pb.z-pa.z)*t),JSON.stringify({pa,pb,t}));
  }
});
test('first and second station share a bridge and its deck edges remain walkable',()=>{
  const A=hexes[0],B=hexes[1],x=(A.x+B.x)/2,z=(A.z+B.z)/2;
  assert.ok(surface.onBridge(x,z));
  assert.ok(surface.walkable(x,z));
  const dx=B.x-A.x,dz=B.z-A.z,d=Math.hypot(dx,dz);
  for(const side of [-1,1]) assert.ok(surface.walkable(x+side*dz/d*.35,z-side*dx/d*.35));
});
test('hex corners work while ocean and mountain centres remain blocked',()=>{
  const A=hexes[0];
  assert.equal(surface.hexAt(A.x,A.z+1.9),A);
  assert.ok(surface.walkable(A.x,A.z+1.9));
  assert.equal(surface.walkable(1000,1000),false);
  for(const h of hexes.filter(h=>h.land&&h.kind!=='plain')) assert.equal(surface.walkable(h.x,h.z),false);
});
test('route and toolbar focus allow walking, typing fields do not',()=>{
  const target=tag=>({closest:selector=>selector.includes(tag)?{}:null});
  assert.ok(acceptsMovementKey(target('button')));
  assert.ok(acceptsMovementKey(null));
  for(const tag of ['input','select','textarea','[contenteditable="true"]','[role="textbox"]']) assert.equal(acceptsMovementKey(target(tag)),false);
});
