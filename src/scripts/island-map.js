// 健康島 3D 引擎（首頁與 /map 共用）。資料在 build 時由 src/components/HealthIsland.astro 產生，放在 #map-data。
const DATA = JSON.parse(document.getElementById('map-data').textContent);
{ // 萬聖節南瓜燈只在 10/10–11/1 出現
  const d=new Date(), m=d.getMonth()+1, day=d.getDate(); DATA.theme={ halloween:(m===10&&day>=10)||(m===11&&day<=1) }; }

/* ================= boot ================= */
// mode=home：蓋在原本首頁上，可一鍵切回文字首頁（記住選擇）；mode=page：/map，可切換文字版文章地圖
const $ = s => document.querySelector(s);
const ROOT = $('#island-root'), MODE = ROOT.dataset.mode;
const loader = $('#loader'), loadMsg = $('#loadMsg');
const QS = new URLSearchParams(location.search);
const AUDIT = QS.has('audit');
const PREF = 'agelocked-home-view';
const pref = { get(){ try{ return localStorage.getItem(PREF); }catch(e){ return null; } }, set(v){ try{ localStorage.setItem(PREF,v); }catch(e){} } };
const track = (ev,p)=>{ try{ window.gtag&&gtag('event',ev,p||{}); }catch(e){} };
// 裝置分級：lite = 不開 3D；low = 3D 但減量
const gpu = (()=>{ try{ const c=document.createElement('canvas'); return !!(c.getContext('webgl2')||c.getContext('webgl')); }catch(e){ return false; } })();
const mem = navigator.deviceMemory||8, cores = navigator.hardwareConcurrency||8, saveData = !!(navigator.connection&&navigator.connection.saveData);
const LITE = QS.has('3d') ? false : (QS.has('lite') || !gpu || saveData || mem<=2 || cores<=2);
const LOW = mem<=4 || cores<=4;
const UI = ['#leftcol','#side','#hud','#hudToggle','#legend','#log','#disclaimer','#stage'];
let started = false, PAUSED = false; const savedUI = {};

async function boot3D(){
  started = true; loader.hidden = false;
  const slowTimer = setTimeout(()=>{ if(!loader.classList.contains('gone')) loadMsg.textContent='連線較慢，仍在下載 3D 引擎…'; }, 12000);
  try { await main(); }
  catch(e){ console.error(e); started=false; if(MODE==='page') showFallback('3D 地圖載入失敗，先用文字版瀏覽。'); else goText(true); }
  clearTimeout(slowTimer);
}
// ── /map：3D 與文字版文章地圖互切 ──
function showFallback(reason){
  const fb=$('#fallback'); if(!fb) return; fb.hidden=false; loader.hidden=true; PAUSED=true;
  const r=$('#fbReason'); if(r) r.textContent=reason||'';
  UI.forEach(s=>{ const el=$(s); if(el){ savedUI[s]=el.hidden; el.hidden=true; } });
  track('map_view',{mode:'text',reason:reason?'auto':'click'});
}
function show3D(){
  if(!started){ location.search='?3d'; return; }
  $('#fallback').hidden=true; UI.forEach(s=>{ const el=$(s); if(el) el.hidden=!!savedUI[s]; });
  PAUSED=false; window.__islandWake&&window.__islandWake(); track('map_view',{mode:'3d'});
}
// ── 首頁：健康島與原本的文字首頁互切 ──
function goText(auto){
  ROOT.hidden=true; document.documentElement.classList.remove('island-on'); PAUSED=true;
  const ob=$('#islandOpen'); if(ob) ob.hidden=false;
  if(!auto){ pref.set('text'); track('home_view',{mode:'text'}); window.scrollTo(0,0); }
}
async function goIsland(){
  ROOT.hidden=false; document.documentElement.classList.add('island-on');
  const ob=$('#islandOpen'); if(ob) ob.hidden=true;
  pref.set('island'); track('home_view',{mode:'island'});
  PAUSED=false; if(!started) await boot3D(); else window.__islandWake&&window.__islandWake();
}

if(AUDIT) document.querySelectorAll('[data-audit-only]').forEach(el=>el.hidden=false);
$('#tText')?.addEventListener('click',()=> MODE==='home' ? goText(false) : showFallback(''));
$('#toText')?.addEventListener('click',()=>goText(false));
$('#islandOpen')?.addEventListener('click',goIsland);
$('#fbTry')?.addEventListener('click',show3D);
if(MODE==='home'){
  // 首頁的初始狀態由元件裡的 inline script 先決定（避免閃一下原本首頁）
  if(ROOT.hidden){ $('#islandOpen').hidden=false; }
  else if(LITE){ goText(true); }
  else boot3D();
} else {
  if(LITE) showFallback(!gpu?'你的瀏覽器沒有開啟 3D 繪圖，先用文字版瀏覽。':'為了不拖慢你的手機，先用文字版瀏覽。');
  else { $('#fallback').hidden=true; boot3D(); }
}

async function main(){
const THREE = await import('three');
const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
const { CSS2DRenderer, CSS2DObject } = await import('three/addons/renderers/CSS2DRenderer.js');
const { RoundedBoxGeometry } = await import('three/addons/geometries/RoundedBoxGeometry.js');
const BGU = await import('three/addons/utils/BufferGeometryUtils.js');
const { SimplexNoise } = await import('three/addons/math/SimplexNoise.js');
loadMsg.textContent = '建造島嶼與建物…';

/* ---------- helpers ---------- */
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const rng = mulberry32(20261023);
const simplex = new SimplexNoise({ random: mulberry32(777) });
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(e0,e1,x)=>{ const t=clamp((x-e0)/(e1-e0),0,1); return t*t*(3-2*t); };
const lsGet=k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } };
const lsSet=(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} };
const mqMobile = matchMedia('(max-width:800px)');
const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = mqReduce.matches;
const isMobile = mqMobile.matches;

const R=2.02, SPACING=2.28, TOP=0.65, WATER_Y=-0.18, SQ3=Math.sqrt(3);
const C={coral:'#db6a41',ink:'#211d1d',cream:'#fff8f4',yellow:'#fcea8b',stone:'#c5b5a7',green:'#71806a',glass:'#86a8a6',wood:'#b48560',teal:'#3e7c8c',leaf1:'#9cc27a',leaf2:'#8db86f',leaf3:'#728f5f',pink:'#f2b5c6',aqua:'#58a6a6',blue:'#6f7fb5',wall:'#f4ebdd',eave:'#a34e34',win:'#a8c4c2',white:'#fbf7f2',soil:'#a07d5e',skin:'#f1cfb2',orange:'#e8822a'};

/* islands world positions */
const ISL = DATA.islands.map((d,i)=>{ const x=SQ3*SPACING*(d.q+d.r/2), z=1.5*SPACING*d.r; return { ...d, i, x, z }; });
const LAND = (DATA.land||[]).map((d,j)=>({ kind:'mountain', ...d, i:ISL.length+j, land:true, x:SQ3*SPACING*(d.q+d.r/2), z:1.5*SPACING*d.r, items:[], color:d.kind==='plain'?'#c9d98f':'#8fb27a', pattern:d.kind==='plain'?'stripe':'speckle' }));
const HEX = [...ISL, ...LAND];
const center = new THREE.Vector3(); HEX.forEach(s=>{ center.x+=s.x; center.z+=s.z; }); center.x/=HEX.length; center.z/=HEX.length; center.y=TOP;
const itemById = {}; ISL.forEach(s=>s.items.forEach((it,k)=>{ it.island=s.i; it.k=k; it.tier=it.tier||s.tier; itemById[it.id]=it; }));
const islById = {}; ISL.forEach(s=>islById[s.id]=s);

/* ---------- link graph from DATA.articles ---------- */
const ART = DATA.articles||{};
const inLinks={}, outLinks={};
Object.values(itemById).forEach(it=>{ const m=ART[it.id]; it.sum=m?m.sum:''; outLinks[it.id]=(m?m.out:[]).filter(t=>itemById[t]&&t!==it.id); inLinks[it.id]=inLinks[it.id]||[]; });
Object.entries(outLinks).forEach(([sl,ts])=>ts.forEach(t=>(inLinks[t]=inLinks[t]||[]).push(sl)));
const articleItems=Object.values(itemById).filter(it=>!it.page);
const orphans=new Set(articleItems.filter(it=>!inLinks[it.id].length).map(it=>it.id));
const deadEnds=new Set(articleItems.filter(it=>!outLinks[it.id].length).map(it=>it.id));
const dirOf=(a,b)=>itemById[b].tier>itemById[a].tier?'down':itemById[b].tier===itemById[a].tier?'same':'up';
const dirStat={down:0,same:0,up:0}; const pairMap=new Map();
Object.entries(outLinks).forEach(([a,ts])=>ts.forEach(b=>{ const k=dirOf(a,b); dirStat[k]++; const A=itemById[a],B=itemById[b]; if(A.island===B.island) return;
  const key=A.island+'>'+B.island; if(!pairMap.has(key)) pairMap.set(key,{a:A.island,b:B.island,links:[],d:{down:0,same:0,up:0}}); const pr=pairMap.get(key); pr.links.push([a,b]); pr.d[k]++; }));
const totalLinks=dirStat.down+dirStat.same+dirStat.up;
DATA.flows=[...pairMap.values()].filter(pr=>pr.links.length>=(DATA.flowMin||2)).sort((x,y)=>y.links.length-x.links.length).map((pr,i)=>{ const A=ISL[pr.a],B=ISL[pr.b]; const dom=['down','same','up'].sort((x,y)=>pr.d[y]-pr.d[x])[0];
  return { id:'f'+(i+1), from:A.id, to:B.id, carry:A.carry, role:A.role, links:pr.links, d:pr.d, count:pr.links.length, evidence:{down:'official',same:'thematic',up:'pending'}[dom], label:`${pr.links.length} 篇文章互相連結` }; });

/* ---------- renderer / scene ---------- */
const stage = $('#stage');
const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, LOW?1.2:isMobile?1.4:1.75));
renderer.shadowMap.enabled = !(LOW&&isMobile); renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
stage.appendChild(renderer.domElement);
renderer.domElement.tabIndex = 0; renderer.domElement.setAttribute('aria-label','健康島 3D 場景，方向鍵可旋轉');
const labelRenderer = new CSS2DRenderer(); labelRenderer.domElement.id='labels'; stage.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xf4eee3, 62, 210);
const camera = new THREE.PerspectiveCamera(32, 1, .3, 320);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = .07; controls.enablePan = false;
controls.minPolarAngle = THREE.MathUtils.degToRad(25); controls.maxPolarAngle = THREE.MathUtils.degToRad(70);
controls.minDistance = 3; controls.maxDistance = 110;
let dirty = true;
controls.addEventListener('change', ()=>{ dirty=true; });

/* ---------- sky ---------- */
const skyMat = new THREE.ShaderMaterial({
  side:THREE.BackSide, depthWrite:false, fog:false,
  uniforms:{ uTop:{value:new THREE.Color()}, uHorizon:{value:new THREE.Color()}, uSunDir:{value:new THREE.Vector3(0,1,0)}, uSun:{value:new THREE.Color()}, uNight:{value:0} },
  vertexShader:`varying vec3 vDir;
void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader:`uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSun; uniform vec3 uSunDir; uniform float uNight; varying vec3 vDir;
float hash(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453); }
void main(){
  vec3 d = normalize(vDir);
  vec3 c = mix(uHorizon, uTop, smoothstep(-.02,.55,d.y));
  float s = max(dot(d, normalize(uSunDir)), 0.0);
  c += uSun * pow(s, 18.0) * .35;
  float h = hash(floor(d*180.0));
  c += vec3(step(.9965,h) * smoothstep(0.0,.25,d.y) * uNight * .9);
  gl_FragColor = vec4(c,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(170,32,16), skyMat);
sky.position.copy(center); sky.renderOrder=-10; scene.add(sky);

/* ---------- lights ---------- */
const hemi = new THREE.HemisphereLight(0xeef6fa, 0x8f8270, 1.3); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1de, 2.8);
sun.castShadow = true; sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-27,right:27,top:27,bottom:-27,near:1,far:140});
sun.shadow.bias=-.0006; sun.shadow.normalBias=.045; sun.shadow.radius=3;
sun.target.position.copy(center); scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0xbfd6ff, .35); fill.position.set(center.x-20,15,center.z-25); scene.add(fill);

/* ---------- water ---------- */
const waterMat = new THREE.ShaderMaterial({
  fog:true,
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime:{value:0}, uShallow:{value:new THREE.Color('#a4d4da')}, uDeep:{value:new THREE.Color('#6fa9b8')}, uCenter:{value:new THREE.Vector2(center.x,center.z)} }]),
  vertexShader:`varying vec3 vW;
#include <fog_pars_vertex>
void main(){
  vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz;
  vec4 mvPosition = viewMatrix*w;
  gl_Position = projectionMatrix*mvPosition;
  #include <fog_vertex>
}`,
  fragmentShader:`uniform float uTime; uniform vec3 uShallow; uniform vec3 uDeep; uniform vec2 uCenter; varying vec3 vW;
#include <fog_pars_fragment>
void main(){
  float d = length(vW.xz - uCenter);
  float w1 = sin(vW.x*.55 + uTime*.6)*sin(vW.z*.48 - uTime*.45)*.5+.5;
  float w2 = sin((vW.x+vW.z)*.9 - uTime*.8)*.5+.5;
  float k = smoothstep(9.0, 60.0, d);
  vec3 c = mix(uShallow, uDeep, clamp(k*.9 + w1*.12 + w2*.06 - .06, 0.0, 1.0));
  float sp = pow(max(sin(vW.x*3.1+uTime*1.7)*sin(vW.z*2.7-uTime*1.3),0.0),24.0)*.22;
  c += sp*(1.0-k);
  gl_FragColor = vec4(c,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`
});
const water = new THREE.Mesh(new THREE.CircleGeometry(160,64).rotateX(-Math.PI/2), waterMat);
water.position.set(center.x, WATER_Y, center.z); water.receiveShadow=false; scene.add(water);

/* ---------- ground textures ---------- */
function groundTex(kind){
  const c=document.createElement('canvas'); c.width=c.height=256; const g=c.getContext('2d'); const r=mulberry32(kind.length*99);
  g.fillStyle='#f3ebdf'; g.fillRect(0,0,256,256);
  if(kind==='brick'){ g.strokeStyle='#e3d4c0'; g.lineWidth=3;
    for(let y=0;y<256;y+=32){ g.beginPath(); g.moveTo(0,y); g.lineTo(256,y); g.stroke(); for(let x=(y/32)%2?32:0;x<256;x+=64){ g.beginPath(); g.moveTo(x,y); g.lineTo(x,y+32); g.stroke(); } } }
  if(kind==='speckle'){ for(let i=0;i<420;i++){ g.fillStyle=r()<.5?'#e6d9c6':'#eadfcf'; g.beginPath(); g.arc(r()*256,r()*256,1+r()*3,0,7); g.fill(); } }
  if(kind==='stripe'){ g.strokeStyle='#e7dccb'; g.lineWidth=10; for(let i=-256;i<512;i+=34){ g.beginPath(); g.moveTo(i,0); g.lineTo(i+256,256); g.stroke(); } }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=4; return t;
}
const GTEX={ brick:groundTex('brick'), speckle:groundTex('speckle'), stripe:groundTex('stripe') };
function bandTex(color){
  const c=document.createElement('canvas'); c.width=128; c.height=16; const g=c.getContext('2d');
  g.fillStyle=color; g.fillRect(0,0,128,16); g.fillStyle='#ffffffaa';
  for(let x=0;x<128;x+=32){ g.fillRect(x+4,6,12,4); } g.fillStyle='#00000018'; g.fillRect(0,13,128,3);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=THREE.RepeatWrapping; t.repeat.set(6,1); return t;
}

/* ---------- islands ---------- */
const hexXZ = (a,r)=>[Math.cos(a)*r, Math.sin(a)*r];
const flatHex = g=>g.rotateZ(Math.PI/6).rotateX(-Math.PI/2);
const islandTops=[]; const wallGeos=[], curbGeos=[], walkGeos=[], shallowGeos=[], foamGeos=[];
const pick = new THREE.Color();
HEX.forEach(s=>{
  const g = flatHex(new THREE.CircleGeometry(R-.05,6)); g.translate(s.x,TOP,s.z);
  const p=g.attributes.position, uv=g.attributes.uv; for(let i=0;i<p.count;i++) uv.setXY(i,p.getX(i)/2.2,p.getZ(i)/2.2);
  const tint = new THREE.Color(s.color).lerp(new THREE.Color('#ffffff'), s.land?.5:.78);
  const top = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map:GTEX[s.pattern], color:tint, roughness:.92 }));
  top.receiveShadow=true; scene.add(top); if(!s.land){ top.userData.island=s.i; islandTops.push(top); }
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R,R,.16,6,1,true).translate(s.x,TOP-.08,s.z), new THREE.MeshStandardMaterial({ map:bandTex(s.color), roughness:.85 }));
  band.receiveShadow=true; scene.add(band);
  const wh=(TOP-.16)-(WATER_Y-.6);
  wallGeos.push(new THREE.CylinderGeometry(R*.997,R*1.05,wh,6).translate(s.x,(TOP-.16)-wh/2,s.z));
  curbGeos.push(flatHex(new THREE.RingGeometry(R-.09,R-.02,6)).translate(s.x,TOP+.006,s.z));
  walkGeos.push(flatHex(new THREE.RingGeometry(1.66,1.94,6)).translate(s.x,TOP+.004,s.z));
  shallowGeos.push(flatHex(new THREE.RingGeometry(R,R+.7,6)).translate(s.x,WATER_Y+.012,s.z));
  foamGeos.push(flatHex(new THREE.RingGeometry(R,R+.16,6)).translate(s.x,WATER_Y+.02,s.z));
});
function addMerged(geos, mat, opts={}){ const m=new THREE.Mesh(BGU.mergeGeometries(geos), mat); Object.assign(m,opts); scene.add(m); return m; }
addMerged(wallGeos, new THREE.MeshStandardMaterial({color:'#ead8c1',roughness:.9}), {castShadow:true,receiveShadow:true});
addMerged(curbGeos, new THREE.MeshStandardMaterial({color:'#e4d6c3',roughness:.9,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2}), {receiveShadow:true});
addMerged(walkGeos, new THREE.MeshStandardMaterial({color:'#ecc3a8',roughness:.9,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}), {receiveShadow:true});
const shallowMat = new THREE.MeshBasicMaterial({color:'#c6ebe6',transparent:true,opacity:.5,depthWrite:false});
addMerged(shallowGeos, shallowMat);
addMerged(foamGeos, new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.55,depthWrite:false}));

/* ---------- pedestrian graph ---------- */
const nodes=[]; // {p, adj:[[j,w]]}
const link=(a,b)=>{ const w=nodes[a].p.distanceTo(nodes[b].p); nodes[a].adj.push([b,w]); nodes[b].adj.push([a,w]); };
HEX.forEach(s=>{ for(let j=0;j<12;j++){ const a=j*Math.PI/6; const r=j%2===0?1.8*Math.cos(Math.PI/6):1.8; const [x,z]=hexXZ(a,r); nodes.push({p:new THREE.Vector3(s.x+x,TOP+.01,s.z+z),adj:[]}); }
  for(let j=0;j<12;j++) link(s.i*12+j, s.i*12+(j+1)%12); });
const bridges=[]; const bridgeOnEdge = HEX.map(()=>new Set());
for(let a=0;a<HEX.length;a++) for(let b=a+1;b<HEX.length;b++){
  const A=HEX[a],B=HEX[b]; const dq=B.q-A.q, dr=B.r-A.r; if((Math.abs(dq)+Math.abs(dr)+Math.abs(dq+dr))/2!==1) continue;
  let th=Math.atan2(B.z-A.z,B.x-A.x); if(th<0) th+=Math.PI*2; const k=Math.round(th/(Math.PI/3))%6;
  const na=a*12+2*k, nb=b*12+2*((k+3)%6);
  const h=.04+rng()*.06; const mid=nodes[na].p.clone().add(nodes[nb].p).multiplyScalar(.5); mid.y=TOP+.02+h;
  nodes.push({p:mid,adj:[]}); const nm=nodes.length-1; link(na,nm); link(nm,nb);
  bridges.push({pa:nodes[na].p.clone(),pb:nodes[nb].p.clone(),h}); bridgeOnEdge[a].add(k); bridgeOnEdge[b].add((k+3)%6);
}
function dijkstra(s,t){ const n=nodes.length, dist=new Array(n).fill(Infinity), prev=new Array(n).fill(-1), done=new Array(n).fill(false); dist[s]=0;
  for(;;){ let u=-1,best=Infinity; for(let i=0;i<n;i++) if(!done[i]&&dist[i]<best){best=dist[i];u=i;} if(u<0||u===t) break; done[u]=true;
    for(const [v,w] of nodes[u].adj){ if(dist[u]+w<dist[v]){ dist[v]=dist[u]+w; prev[v]=u; } } }
  const path=[]; for(let u=t;u>=0;u=prev[u]) path.unshift(u); return path; }

/* ---------- instanced kit ---------- */
const GEO = {
  box:new THREE.BoxGeometry(1,1,1), rbox:new RoundedBoxGeometry(1,1,1,2,.12),
  cyl:new THREE.CylinderGeometry(.5,.5,1,14), cone:new THREE.ConeGeometry(.5,1,14),
  sphere:new THREE.SphereGeometry(.5,16,12), ico:new THREE.IcosahedronGeometry(.5,1),
  dome:new THREE.SphereGeometry(.5,16,8,0,Math.PI*2,0,Math.PI/2).scale(1,2,1),
  torus:new THREE.TorusGeometry(.4,.1,8,24),
  prism:new THREE.CylinderGeometry(.5,.5,1,3).rotateZ(Math.PI/2).rotateX(-Math.PI/2).translate(0,-.125,0).scale(1,1/.75,1/.866),
  hip:new THREE.ConeGeometry(.7071,1,4).rotateY(Math.PI/4),
  peak:new THREE.ConeGeometry(.5,1,6), flame:new THREE.ConeGeometry(.5,1,10),
  crescent:new THREE.TorusGeometry(.38,.13,10,28,Math.PI*1.2)
};
GEO.glowbox=GEO.box; GEO.glowsphere=GEO.sphere;
const parts=[]; let curOwner=null, curSmall=false;
const baseM=new THREE.Matrix4(); const _q=new THREE.Quaternion(), _e=new THREE.Euler(), _p=new THREE.Vector3(), _s=new THREE.Vector3();
function P(kind,x,y,z,sx,sy,sz,color,o){ o=o||{};
  _e.set(o.rx||0,o.ry||0,o.rz||0); _q.setFromEuler(_e);
  const j=1+(rng()*2-1)*.0072; _p.set(x,y,z); _s.set(sx*j,sy*j,sz*j);
  parts.push({ kind, m:new THREE.Matrix4().compose(_p,_q,_s).premultiply(baseM), color:new THREE.Color(color), owner:o.owner!==undefined?o.owner:curOwner, small:o.small!==undefined?o.small:curSmall });
}
function setFrame(x,y,z,s=1,ry=0){ baseM.compose(new THREE.Vector3(x,y,z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0,ry,0)), new THREE.Vector3(s,s,s)); }

/* ---------- item archetypes (unit space: base ±0.5, y 0–1.5) ---------- */
const TAU=Math.PI*2;
const MODELS = {
  house:{h:1.25, f(){ P('rbox',0,.36,0,.78,.72,.66,C.wall); P('box',0,.735,0,.9,.05,.78,C.eave); P('hip',0,1.0,0,.86,.5,.74,C.coral);
    P('glowbox',-.2,.42,.335,.17,.17,.02,C.win); P('glowbox',.2,.42,.335,.17,.17,.02,C.win); P('glowbox',.395,.42,0,.02,.17,.2,C.win);
    P('box',0,.17,.337,.15,.3,.02,C.wood); P('box',.24,1.08,-.12,.1,.26,.1,C.stone); }},
  hall:{h:1.6, f(){ P('rbox',0,.28,.06,.92,.56,.62,C.wall); [-.3,-.1,.1,.3].forEach(x=>P('cyl',x,.28,.42,.07,.56,.07,C.cream));
    P('box',0,.585,.1,.98,.05,.72,C.eave); P('prism',0,.71,.1,.96,.2,.68,C.coral);
    P('rbox',0,.85,-.22,.34,.9,.3,C.wall); P('cyl',0,1.04,-.06,.22,.03,.22,C.cream,{rx:Math.PI/2}); P('torus',0,1.04,-.05,.29,.29,.4,C.ink);
    P('box',0,1.07,-.04,.016,.07,.01,C.ink); P('box',.025,1.04,-.04,.05,.014,.01,C.ink);
    P('box',0,1.33,-.22,.4,.04,.36,C.eave); P('hip',0,1.5,-.22,.4,.3,.36,C.coral); P('sphere',0,1.68,-.22,.06,.06,.06,C.yellow);
    P('glowbox',-.2,.3,.375,.12,.2,.02,C.win); P('glowbox',.2,.3,.375,.12,.2,.02,C.win); P('glowbox',0,.75,-.065,.1,.14,.02,C.win); }},
  classroom:{h:.85, f(){ P('box',0,.03,0,1,.06,.9,'#e7d3b8'); P('box',0,.48,-.4,.76,.46,.03,C.wood); P('box',0,.48,-.38,.7,.4,.03,'#3d5a4f');
    P('box',-.1,.5,-.36,.22,.01,.005,C.white); P('box',.12,.42,-.36,.18,.01,.005,C.white);
    P('cyl',-.36,.2,-.4,.03,.4,.03,C.wood); P('cyl',.36,.2,-.4,.03,.4,.03,C.wood);
    [[-.2,0],[.2,0],[-.2,.26],[.2,.26]].forEach(([x,z],k)=>{ P('box',x,.2,z,.24,.03,.14,C.wood); P('box',x,.1,z,.03,.18,.1,C.wood);
      P('cyl',x,.19,z+.15,.09,.18,.09,[C.pink,C.aqua,C.yellow,C.blue][k]); P('sphere',x,.33,z+.15,.1,.1,.1,C.skin); P('dome',x,.335,z+.155,.105,.06,.105,C.ink); });
    P('cyl',.36,.22,-.18,.1,.3,.1,C.coral); P('sphere',.36,.43,-.18,.12,.12,.12,C.skin); }},
  clinic:{h:1.25, f(){ P('rbox',0,.4,0,.86,.8,.7,C.white); P('box',0,.82,0,.9,.06,.74,C.teal);
    P('box',0,1.04,0,.34,.11,.07,C.coral); P('box',0,1.04,0,.11,.34,.07,C.coral); P('box',0,.88,0,.06,.08,.06,C.stone);
    [-.28,.28].forEach(x=>P('glowbox',x,.5,.355,.16,.18,.02,C.win)); P('glowbox',0,.6,.355,.16,.14,.02,C.win);
    P('box',0,.2,.357,.22,.36,.02,C.glass); P('box',0,.42,.42,.36,.03,.14,C.teal); }},
  lab:{h:1.0, f(){ P('rbox',0,.27,0,.9,.06,.56,C.white); [[-.4,-.22],[.4,-.22],[-.4,.22],[.4,.22]].forEach(([x,z])=>P('cyl',x,.12,z,.04,.24,.04,C.stone));
    P('sphere',-.24,.4,0,.18,.18,.18,C.glass); P('cyl',-.24,.54,0,.05,.12,.05,C.glass); P('sphere',-.24,.38,0,.13,.1,.13,C.pink);
    P('cone',.05,.42,.06,.18,.24,.18,C.glass); P('cone',.05,.36,.06,.12,.1,.12,C.aqua);
    P('box',.3,.32,-.05,.14,.04,.14,C.ink); P('box',.3,.45,-.1,.04,.24,.04,C.ink); P('cyl',.3,.55,-.02,.05,.18,.05,C.ink,{rx:.5});
    P('sphere',-.2,.74,0,.07,.07,.07,C.glass); P('sphere',-.14,.86,0,.05,.05,.05,C.glass); }},
  bed:{h:1.25, f(){ P('rbox',0,.13,0,.72,.18,1.0,C.wood); P('rbox',0,.4,-.47,.76,.62,.08,C.wood); P('rbox',0,.28,.02,.66,.12,.92,C.cream);
    P('rbox',0,.38,-.3,.44,.08,.2,C.white); P('rbox',0,.37,.14,.68,.06,.62,C.blue);
    P('cyl',.42,.5,-.4,.02,1.0,.02,C.ink); P('sphere',.42,1.06,-.4,.2,.2,.2,C.yellow); P('glowsphere',.22,1.2,-.4,.06,.06,.06,C.yellow); P('glowsphere',.3,.95,-.42,.04,.04,.04,C.yellow); }},
  watch:{h:1.15, f(){ P('cyl',0,.03,0,.7,.06,.5,C.stone); P('rbox',0,.56,0,.3,1.06,.12,C.ink); P('rbox',0,.6,.06,.56,.56,.14,'#3a3434');
    P('glowbox',0,.6,.135,.44,.44,.02,C.aqua); P('box',-.1,.6,.148,.12,.03,.01,C.coral); P('box',.02,.64,.148,.03,.13,.01,C.coral,{rz:.4}); P('box',.12,.6,.148,.1,.03,.01,C.coral);
    P('cyl',.31,.66,.06,.05,.06,.05,C.stone,{rz:Math.PI/2}); }},
  scanner:{h:.9, f(){ P('rbox',0,.15,0,.8,.3,.6,C.white); P('rbox',0,.45,-.18,.7,.38,.08,C.ink,{rx:-.3}); P('glowbox',0,.46,-.13,.58,.28,.02,C.aqua,{rx:-.3});
    P('glowbox',0,.31,.15,.32,.02,.22,C.coral); P('rbox',0,.36,.16,.18,.05,.24,C.skin); P('glowbox',0,.62,.16,.02,.5,.02,C.aqua); }},
  book:{h:1.05, f(){ P('box',0,.07,.08,.62,.14,.42,C.wood); P('rbox',-.24,.21,.08,.5,.05,.7,C.coral,{rz:.18}); P('rbox',.24,.21,.08,.5,.05,.7,C.coral,{rz:-.18});
    P('rbox',-.22,.26,.08,.44,.05,.64,C.cream,{rz:.18}); P('rbox',.22,.26,.08,.44,.05,.64,C.cream,{rz:-.18});
    [-.08,.05,.18].forEach(z=>{ P('box',-.22,.292,z,.3,.006,.025,C.stone,{rz:.18}); P('box',.22,.292,z,.3,.006,.025,C.stone,{rz:-.18}); });
    P('rbox',.0,.55,-.36,.56,.95,.14,C.blue); P('box',0,.55,-.285,.3,.06,.01,C.yellow); }},
  clock:{h:1.2, f(){ P('rbox',0,.03,0,.8,.06,.4,C.stone); P('box',-.25,.16,0,.08,.24,.2,C.wood); P('box',.25,.16,0,.08,.24,.2,C.wood);
    P('cyl',0,.7,0,.8,.1,.8,C.cream,{rx:Math.PI/2}); P('torus',0,.7,0,1.0,1.0,1.4,C.coral);
    for(let k=0;k<12;k++){ const a=k/12*TAU; P('box',Math.cos(a)*.32,.7+Math.sin(a)*.32,.055,.035,.035,.01,C.ink); }
    P('box',0,.8,.06,.03,.22,.02,C.ink); P('box',.08,.7,.06,.18,.03,.02,C.ink); P('sphere',0,.7,.065,.05,.05,.03,C.coral); P('sphere',0,1.15,0,.1,.1,.1,C.yellow); }},
  globe:{h:1.15, f(){ P('cyl',0,.04,0,.5,.08,.5,C.wood); P('cyl',0,.2,0,.06,.3,.06,C.ink); P('torus',0,.7,0,1.12,1.12,1.12,C.stone,{rz:.4});
    P('sphere',0,.7,0,.8,.8,.8,C.teal); P('ico',.15,.84,.25,.3,.2,.14,C.leaf1); P('ico',-.2,.6,.26,.26,.3,.14,C.leaf2); P('ico',.08,.5,-.3,.3,.2,.14,C.leaf1); P('ico',-.25,.85,-.2,.22,.18,.14,C.leaf2); }},
  battery:{h:1.12, f(){ P('rbox',0,.5,0,.56,1.0,.56,C.white); P('cyl',0,1.04,0,.22,.08,.22,C.stone);
    for(let k=0;k<4;k++) P('glowbox',0,.2+k*.22,.285,.42,.16,.02,k===0?C.coral:'#e9e2d4');
    P('box',0,.62,.3,.06,.24,.01,C.yellow,{rz:.4}); }},
  farm:{h:.55, f(){ P('rbox',0,.06,0,.95,.12,.9,C.soil);
    for(let r=0;r<4;r++) for(let c=0;c<4;c++){ const x=-.33+c*.22, z=-.33+r*.22; P('ico',x,.19,z,.17,.15,.17,[C.leaf1,C.leaf2,C.leaf3][(r+c)%3]); if((r*4+c)%5===0) P('sphere',x+.05,.24,z+.04,.06,.06,.06,'#d9473b'); }
    P('cyl',.42,.25,.42,.03,.4,.03,C.wood); P('box',.42,.45,.42,.2,.12,.02,C.cream); }},
  court:{h:1.0, f(){ P('box',0,.03,0,.96,.06,.96,'#8fb88a'); P('box',0,.064,0,.9,.006,.02,C.white); P('box',0,.064,0,.02,.006,.9,C.white);
    P('torus',0,.064,0,.4,.4,.05,C.white,{rx:Math.PI/2});
    P('cyl',0,.45,-.43,.04,.9,.04,C.ink); P('box',0,.85,-.39,.32,.22,.03,C.white); P('torus',0,.75,-.3,.25,.25,.25,C.coral,{rx:Math.PI/2});
    P('sphere',.22,.12,.18,.12,.12,.12,C.orange); P('cyl',-.25,.1,.22,.04,.24,.04,C.ink,{rz:Math.PI/2}); P('cyl',-.37,.1,.22,.11,.05,.11,C.ink,{rz:Math.PI/2}); P('cyl',-.13,.1,.22,.11,.05,.11,C.ink,{rz:Math.PI/2}); }},
  stage:{h:1.15, f(){ P('rbox',0,.12,0,.96,.24,.7,C.wood); P('rbox',0,.62,-.32,.96,.8,.08,C.coral);
    P('box',-.4,.62,-.25,.14,.74,.05,C.eave); P('box',.4,.62,-.25,.14,.74,.05,C.eave); P('box',0,.96,-.27,.6,.12,.02,C.yellow);
    [-.3,0,.3].forEach(x=>P('glowsphere',x,1.06,-.22,.07,.07,.07,C.yellow));
    P('cyl',.12,.4,.1,.02,.32,.02,C.ink); P('sphere',.12,.58,.1,.045,.045,.045,C.ink); P('cyl',-.1,.36,.08,.11,.24,.11,C.teal); P('sphere',-.1,.55,.08,.13,.13,.13,C.skin); }},
  dna:{h:1.35, f(){ P('cyl',0,.03,0,.6,.06,.6,C.stone);
    for(let k=0;k<14;k++){ const y=.12+k*.085, a=k*.55, x=Math.cos(a)*.22, z=Math.sin(a)*.22;
      P('sphere',x,y,z,.09,.09,.09,C.coral); P('sphere',-x,y,-z,.09,.09,.09,C.aqua); P('cyl',0,y,0,.025,.44,.025,C.cream,{rz:Math.PI/2,ry:-a}); } }},
  chart:{h:1.2, f(){ P('rbox',0,.04,0,.96,.08,.5,C.white); const hs=[.3,.5,.42,.72,.95], cs=[C.stone,C.aqua,C.blue,C.coral,C.yellow];
    hs.forEach((h,k)=>P('rbox',-.36+k*.18,.08+h/2,0,.13,h,.3,cs[k])); P('glowsphere',.36,1.12,0,.07,.07,.07,C.yellow); }},
  tube:{h:.85, f(){ P('rbox',0,.06,0,.9,.06,.32,C.wood); P('rbox',0,.42,0,.9,.06,.32,C.wood); P('box',-.43,.24,0,.04,.36,.28,C.wood); P('box',.43,.24,0,.04,.36,.28,C.wood);
    [-.3,-.1,.1,.3].forEach((x,k)=>{ P('cyl',x,.4,0,.11,.62,.11,C.glass); P('cyl',x,.26,0,.09,.32,.09,['#c54b4b','#e8c35a','#c54b4b','#d9824b'][k]); P('cyl',x,.73,0,.12,.06,.12,[C.coral,C.aqua,C.yellow,C.blue][k]); }); }},
  kiosk:{h:1.1, f(){ P('rbox',0,.25,.05,.86,.5,.5,C.cream); P('box',0,.3,.31,.8,.12,.02,C.coral);
    [-.38,.38].forEach(x=>{ P('cyl',x,.6,.27,.04,.72,.04,C.wood); P('cyl',x,.6,-.17,.04,.72,.04,C.wood); });
    for(let k=0;k<6;k++) P('box',-.36+k*.145,.98,.1,.146,.04,.64,k%2?C.white:C.coral,{rx:.22});
    P('cyl',-.22,.55,.05,.08,.1,.08,C.white); P('cyl',-.08,.56,.05,.07,.12,.07,C.teal); P('sphere',.18,.56,.05,.12,.1,.12,C.orange); }}
};

/* ---------- island landmarks (unit space: base ±0.5, y 0–1.7) ---------- */
const PI=Math.PI;
const LANDMARKS = {
  bell:{name:'身體警報鐘',h:1.55,f(){ P('rbox',0,.06,0,1,.12,.62,C.stone); P('box',-.42,.66,0,.08,1.2,.1,C.wood); P('box',.42,.66,0,.08,1.2,.1,C.wood);
    P('box',0,1.25,0,.98,.09,.14,C.wood); P('prism',0,1.42,0,1.08,.26,.42,C.coral); P('box',0,1.18,0,.04,.08,.04,C.ink);
    P('dome',0,.56,0,.62,.6,.62,C.yellow); P('torus',0,.57,0,.82,.82,.7,'#e9c95a',{rx:PI/2}); P('sphere',0,.47,0,.13,.13,.13,C.ink);
    P('box',0,.36,.28,.07,.16,.02,C.coral); P('box',0,.22,.28,.07,.06,.02,C.coral); }},
  brain:{name:'大腦',h:1.15,f(){ P('cyl',0,.12,0,.72,.24,.72,C.cream); P('cyl',0,.26,0,.5,.06,.5,C.stone);
    P('sphere',-.16,.66,.02,.46,.52,.72,C.pink); P('sphere',.16,.66,.02,.46,.52,.72,C.pink);
    [[-.17,.84,.08],[.17,.84,.08],[-.2,.7,.3],[.2,.7,.3],[-.2,.66,-.22],[.2,.66,-.22]].forEach(([x,y,z])=>P('torus',x,y,z,.32,.32,.32,'#e594ac',{ry:PI/2,rx:z*1.5}));
    P('sphere',0,.44,-.26,.32,.22,.26,'#e594ac'); P('cyl',0,.34,-.12,.1,.2,.1,'#e594ac'); P('glowsphere',.32,1.02,.1,.07,.07,.07,C.yellow); P('glowsphere',-.36,.98,-.05,.05,.05,.05,C.yellow); }},
  mars:{name:'男性 40+ 符號',h:1.3,f(){ P('cyl',0,.07,0,.78,.14,.78,C.cream);
    P('torus',-.12,.6,0,.8,.8,1.6,C.blue); P('cyl',.247,.917,0,.1,.4,.1,C.blue,{rz:-PI/4}); P('cone',.46,1.13,0,.24,.22,.24,C.blue,{rz:-PI/4});
    P('cyl',-.12,.2,0,.06,.16,.06,C.blue); P('cyl',-.12,.2,.28,.04,.34,.04,C.ink,{rz:PI/2}); P('cyl',-.3,.2,.28,.12,.06,.12,C.ink,{rz:PI/2}); P('cyl',.06,.2,.28,.12,.06,.12,C.ink,{rz:PI/2}); }},
  moon:{name:'月亮與雲枕',h:1.45,f(){ [[-.25,.2,0,.42],[.05,.24,.05,.5],[.3,.2,-.02,.4],[0,.16,-.2,.4]].forEach(([x,y,z,r])=>P('sphere',x,y,z,r,r*.75,r,C.white));
    P('cyl',.02,.55,0,.03,.6,.03,C.stone); P('crescent',0,1.0,0,1,1,1.4,C.yellow,{rz:1.0});
    P('glowsphere',.38,1.3,0,.08,.08,.08,C.yellow); P('glowsphere',-.38,1.15,.05,.06,.06,.06,C.yellow); P('glowsphere',.3,.82,.1,.05,.05,.05,C.yellow);
    P('box',.42,.62,.12,.12,.03,.02,C.blue); P('box',.42,.66,.12,.03,.1,.02,C.blue,{rz:.8}); P('box',.42,.7,.12,.12,.03,.02,C.blue); }},
  flame:{name:'發炎之火',h:1.45,f(){ [[-.28,-.2],[.28,-.2],[0,.3]].forEach(([x,z])=>P('cyl',x,.18,z,.06,.36,.06,C.ink));
    P('cyl',0,.42,0,.86,.16,.86,'#5a4a44'); P('cyl',0,.5,0,.74,.02,.74,'#3b302c');
    P('flame',0,.92,0,.62,.84,.62,C.coral); P('flame',.14,.82,.08,.4,.6,.4,C.orange); P('flame',-.13,.86,-.04,.34,.66,.34,'#f2b04a'); P('flame',0,.76,.12,.26,.42,.26,'#ffe28a');
    P('glowsphere',.2,1.32,0,.05,.05,.05,C.orange); P('glowsphere',-.18,1.42,.05,.04,.04,.04,C.yellow); }},
  mito:{name:'粒線體',h:1.0,f(){ P('rbox',0,.06,0,1,.12,.56,C.stone);
    P('sphere',0,.5,0,1.0,.62,.6,C.orange); for(let k=0;k<6;k++){ const x=-.36+k*.145; P('box',x,.8,0,.05,.08,.42,'#f6c48e',{rz:k%2?.35:-.35}); }
    P('sphere',0,.5,.29,.8,.4,.04,'#f6c48e'); for(let k=0;k<5;k++) P('box',-.3+k*.15,.5,.31,.04,.3,.02,C.orange,{rz:k%2?.4:-.4});
    P('glowsphere',.42,.92,.1,.07,.07,.07,C.yellow); P('glowsphere',-.4,.95,-.05,.06,.06,.06,C.yellow); }},
  pen:{name:'GLP-1 注射筆',h:1.4,f(){ P('rbox',0,.08,0,.9,.16,.5,C.white); P('rbox',0,.2,0,.5,.1,.3,C.stone);
    P('cyl',0,.75,0,.19,1.0,.19,C.aqua,{rz:.35}); P('cyl',-.03,.83,0,.195,.2,.195,C.white,{rz:.35}); P('box',-.025,.8,.1,.06,.12,.01,C.ink,{rz:.35});
    P('cyl',-.17,1.22,0,.22,.12,.22,C.coral,{rz:.35}); P('cyl',-.2,1.31,0,.13,.07,.13,C.ink,{rz:.35}); P('cyl',.19,.23,0,.035,.1,.035,C.stone,{rz:.35}); }},
  hourglass:{name:'長壽沙漏',h:1.42,f(){ P('cyl',0,.06,0,.84,.1,.84,C.wood); P('cyl',0,1.36,0,.84,.1,.84,C.wood);
    for(let k=0;k<3;k++){ const a=k/3*TAU+.5; P('cyl',Math.cos(a)*.36,.71,Math.sin(a)*.36,.05,1.22,.05,C.wood); }
    P('cone',0,.99,0,.6,.66,.6,C.glass,{rx:PI}); P('cone',0,.43,0,.6,.66,.6,C.glass);
    P('cone',0,.24,0,.46,.28,.46,'#e8c66f'); P('cone',0,1.08,0,.36,.3,.36,'#e8c66f',{rx:PI}); P('cyl',0,.62,0,.02,.36,.02,'#e8c66f'); }},
  drop:{name:'血滴',h:1.35,f(){ P('cyl',0,.07,0,.92,.14,.92,C.white); P('cyl',0,.15,0,.72,.04,.72,'#f2dcd8');
    P('sphere',0,.52,0,.7,.7,.7,'#c8463f'); P('cone',0,1.02,0,.5,.62,.5,'#c8463f'); P('sphere',-.13,.62,.24,.12,.2,.07,'#f29a90');
    P('cyl',.42,.36,.25,.1,.5,.1,C.glass); P('cyl',.42,.26,.25,.08,.28,.08,'#c8463f'); P('cyl',.42,.63,.25,.11,.05,.11,C.coral); }},
  bigwatch:{name:'智慧手錶',h:1.15,f(){ MODELS.watch.f(); }},
  prysm:{name:'Prysm iO 掃描儀',h:1.25,f(){ P('rbox',0,.06,0,.92,.12,.6,C.stone); P('rbox',0,.66,0,.62,1.1,.32,C.white);
    P('rbox',0,.8,.16,.5,.62,.02,'#2b3440'); ['#d9473b','#e8822a','#e8c35a','#7fb35a','#4f8fc0','#7b67b3'].forEach((c,k)=>P('glowbox',0,.56+k*.085,.175,.36,.055,.01,c));
    P('glowbox',0,.24,.17,.22,.03,.1,C.coral); P('rbox',0,1.24,0,.3,.06,.2,C.coral); }},
  helix:{name:'DNA 螺旋',h:1.35,f(){ MODELS.dna.f(); }},
  bottle:{name:'保健品放大鏡',h:1.1,f(){ P('rbox',0,.05,0,1,.1,.6,C.stone);
    P('cyl',-.12,.45,0,.48,.72,.48,C.white); P('cyl',-.12,.88,0,.34,.14,.34,C.coral); P('cyl',-.12,.45,0,.49,.3,.49,C.teal); P('box',-.12,.45,.245,.2,.06,.01,C.white);
    P('torus',.26,.78,.18,.55,.55,.9,C.ink); P('cyl',.26,.78,.18,.36,.02,.36,'#cfe6ea',{rx:PI/2}); P('cyl',.4,.48,.18,.06,.34,.06,C.wood,{rz:.5});
    P('sphere',.28,.14,-.18,.16,.08,.08,C.yellow,{ry:.4}); P('sphere',.38,.14,-.05,.16,.08,.08,C.coral,{ry:-.3}); }},
  clipboard:{name:'評估清單',h:1.4,f(){ P('rbox',0,.06,.08,.92,.12,.56,C.cream);
    P('rbox',0,.75,-.02,.8,1.12,.08,C.wood,{rx:-.2}); P('box',0,.72,.03,.66,.92,.01,C.white,{rx:-.2}); P('rbox',0,1.28,-.12,.3,.12,.1,C.stone,{rx:-.2});
    [1.05,.85,.65,.45].forEach((y,k)=>{ const z=.05-(y-.75)*.2; P('box',-.2,y,z,.09,.09,.012,k<3?C.coral:C.stone,{rx:-.2}); P('box',.08,y,z,.36,.03,.012,C.stone,{rx:-.2}); });
    P('cyl',.36,.2,.26,.04,.5,.04,C.yellow,{rz:1.3}); }}
};

/* ---------- island layout ---------- */
const LM_Z=-.42, LM_H=.5;
function slots(n){
  for(let c=.62;c>=.399;c-=.02){
    const pts=[]; const rowH=c*.9;
    for(let row=-7;row<=7;row++){ const z=row*rowH, off=(row&1)?c/2:0;
      for(let col=-7;col<=7;col++){ const x=col*c+off;
        if(Math.hypot(x,z)+c*.5>1.36) continue;
        if(Math.abs(x)<LM_H+c*.42 && Math.abs(z-LM_Z)<LM_H+c*.42) continue;
        pts.push([x,z]); } }
    if(pts.length<n) continue;
    const chosen=[]; pts.sort((a,b)=>b[1]-a[1]||a[0]-b[0]); chosen.push(pts[Math.floor(pts.length>2?1:0)]);
    while(chosen.length<n){ let best=null,bd=-1; for(const p of pts){ if(chosen.includes(p)) continue; let d=Infinity; for(const q of chosen) d=Math.min(d,Math.hypot(p[0]-q[0],p[1]-q[1])); d=Math.min(d,Math.hypot(p[0],p[1]-LM_Z)*1.1); if(d>bd){bd=d;best=p;} } chosen.push(best); }
    if(chosen.every((p,i)=>chosen.every((q,j)=>i===j||Math.hypot(p[0]-q[0],p[1]-q[1])>=c*.98))) return {c,pts:chosen};
  }
  return {c:.46,pts:[[0,.6],[-.6,.4],[.6,.4],[-.8,-.2],[.8,-.2],[0,1.0]].slice(0,n)};
}
function tree(type,x,z,s){
  P('cyl',x,.12*s,z,.07*s,.24*s,.07*s,C.wood);
  if(type==='conifer'){ P('cone',x,.36*s,z,.46*s,.42*s,.46*s,C.leaf3); P('cone',x,.58*s,z,.36*s,.36*s,.36*s,C.leaf3); P('cone',x,.78*s,z,.24*s,.3*s,.24*s,C.leaf2); }
  else if(type==='cherry'){ P('ico',x,.5*s,z,.56*s,.46*s,.56*s,C.pink); P('ico',x+.1*s,.64*s,z-.05*s,.34*s,.3*s,.34*s,'#f7cdd8'); }
  else if(type==='fruit'){ P('sphere',x,.5*s,z,.52*s,.48*s,.52*s,C.leaf2); for(let k=0;k<5;k++){ const a=k*1.3; P('sphere',x+Math.cos(a)*.22*s,.48*s+(k%2)*.12*s,z+Math.sin(a)*.22*s,.07*s,.07*s,.07*s,C.orange); } }
  else if(type==='palm'){ P('cyl',x,.36*s,z,.06*s,.5*s,.06*s,C.wood,{rz:.1}); for(let k=0;k<6;k++){ const a=k/6*TAU; P('box',x+Math.cos(a)*.16*s,.62*s,z+Math.sin(a)*.16*s,.36*s,.025*s,.1*s,C.leaf2,{ry:-a,rz:-.35}); } }
  else if(type==='willow'){ P('dome',x,.2*s,z,.62*s,.56*s,.62*s,C.leaf1); P('ico',x,.6*s,z,.34*s,.24*s,.34*s,C.leaf2); }
  else { P('ico',x,.5*s,z,.52*s,.5*s,.52*s,C.leaf2); P('ico',x+.08*s,.7*s,z,.32*s,.3*s,.32*s,C.leaf1); }
}
const lampPos=[]; const itemPlace={};
ISL.forEach(s=>{
  const n=s.items.length; const L=slots(n);
  const occupied=[];
  const lm=LANDMARKS[s.landmark]; if(lm){ setFrame(s.x,TOP,s.z+LM_Z,1,0); curOwner='isl:'+s.i; curSmall=false; lm.f(); s.lmH=lm.h; }
  s.items.forEach((it,k)=>{
    const [lx,lz]=L.pts[k]; const sc=L.c*.9;
    occupied.push([lx,lz,sc*.6]);
    const model=MODELS[it.model]||MODELS.house; const ry=(rng()-.5)*.5;
    it.local=[lx,lz]; it.world=new THREE.Vector3(s.x+lx,TOP,s.z+lz); it.scale=sc; it.h=model.h*sc;
    setFrame(s.x+lx,TOP,s.z+lz,sc,ry); curOwner=it.id; curSmall=false; model.f(); itemPlace[it.id]=it;
  });
  // decorations
  curOwner='isl:'+s.i; setFrame(0,TOP,0,1,0);
  const free=(x,z,r)=>occupied.every(([ox,oz,or])=>Math.hypot(x-ox,z-oz)>or+r) && !(Math.abs(x)<.62&&Math.abs(z-LM_Z)<.62);
  // big trees
  let tcount=0;
  for(const a of [Math.PI*1.08,Math.PI*1.92,Math.PI*1.25,Math.PI*1.75,Math.PI*.92,Math.PI*.08]){
    if(tcount>=5) break; const r=1.3; const x=Math.cos(a)*r, z=Math.sin(a)*r; if(!free(x,z,.18)) continue;
    curSmall=false; tree(s.tree,s.x+x,s.z+z,.48+rng()*.14); occupied.push([x,z,.2]); tcount++; }
  // lamps at vertices
  for(let k=0;k<6;k++){ const a=Math.PI/6+k*Math.PI/3; const [x,z]=hexXZ(a,1.95);
    curSmall=true; P('cyl',s.x+x,.25,s.z+z,.035,.5,.035,C.ink); P('glowsphere',s.x+x,.52,s.z+z,.09,.09,.09,'#fff1c9'); P('cone',s.x+x,.585,s.z+z,.12,.05,.12,C.ink);
    lampPos.push(new THREE.Vector3(s.x+x,TOP+.012,s.z+z));
    if(DATA.theme.halloween && k%2===0){ const [px,pz]=hexXZ(a+.09,1.9); P('sphere',s.x+px,.065,s.z+pz,.15,.11,.15,C.orange); P('cyl',s.x+px,.13,s.z+pz,.018,.04,.018,C.leaf3); P('glowbox',s.x+px+.0,.07,s.z+pz,.04,.025,.155,'#ffb347',{ry:-(a+.09)}); } }
  // pots at edge midpoints without bridges
  for(let k=0;k<6;k++){ if(bridgeOnEdge[s.i].has(k)) continue; const a=k*Math.PI/3;
    for(const d of [-.16,.16]){ const [x,z]=hexXZ(a+d,1.68); curSmall=true; P('cyl',s.x+x,.06,s.z+z,.1,.12,.1,'#c9805e'); P('ico',s.x+x,.16,s.z+z,.13,.11,.13,rng()<.5?C.leaf1:C.leaf2);
      P('sphere',s.x+x+.03,.21,s.z+z,.045,.045,.045,[C.pink,C.yellow,'#f6f0ff'][Math.floor(rng()*3)]); } }
  // string lights on rim
  for(let k=0;k<6;k++){ const a1=Math.PI/6+k*Math.PI/3, a2=a1+Math.PI/3; const [x1,z1]=hexXZ(a1,R-.035), [x2,z2]=hexXZ(a2,R-.035);
    for(let t=1;t<6;t++){ const f=t/6; curSmall=true; P('glowsphere',s.x+x1+(x2-x1)*f,.03,s.z+z1+(z2-z1)*f,.035,.035,.035,'#ffe6b0'); } }
  // benches
  for(const a of [Math.PI*.33,Math.PI*.67,Math.PI*1.5]){ const x=Math.cos(a)*1.3, z=Math.sin(a)*1.3; if(!free(x,z,.12)) continue; const ry=-a+Math.PI/2;
    curSmall=true; setFrame(s.x+x,TOP,s.z+z,1,ry); P('box',0,.07,0,.24,.025,.08,C.wood); P('box',0,.13,-.04,.24,.08,.02,C.wood); P('box',-.1,.035,0,.02,.07,.07,C.ink); P('box',.1,.035,0,.02,.07,.07,C.ink); setFrame(0,TOP,0,1,0); occupied.push([x,z,.14]); }
  curSmall=false;
});
// central mountain range
const mtnLabels=[];
LAND.forEach(s=>{ curOwner=null; curSmall=false; setFrame(s.x,TOP,s.z,1,0);
  const rr=mulberry32(s.i*31+7), H=s.h||1;
  if(s.kind==='plain'){
    // 稻田格：水田、田埂、農舍與樹
    for(let gx=-2;gx<=2;gx++) for(let gz=-2;gz<=2;gz++){ const x=gx*.5, z=gz*.5; if(Math.hypot(x,z)>1.3) continue; if((gx+gz+9)%4===0) continue;
      P('box',x,.025,z,.44,.05,.44,(gx*3+gz)%3===0?'#b7cf6e':(gx+gz)%2?'#9fc067':'#a9c98a'); }
    [[-.25,.28],[.35,-.35]].forEach(([x,z],k)=>{ setFrame(s.x+x,TOP,s.z+z,.42,rr()*TAU); MODELS.house.f(); setFrame(s.x,TOP,s.z,1,0); });
    for(let k=0;k<4;k++){ const a=rr()*TAU, r=1.2+rr()*.25; tree(k%2?'round':'fruit',Math.cos(a)*r,Math.sin(a)*r,.32+rr()*.1); }
    return; }
  const H2=H*1.3; const peaks=[[0,-.15,1.75,H2],[-.65,.45,.95,H2*.62],[.62,.42,.9,H2*.55],[.08,.8,.7,H2*.42],[-.75,-.55,.7,H2*.45],[.7,-.5,.7,H2*.5]];
  peaks.forEach(([x,z,w,h],k)=>{ const ry=rr()*TAU;
    P('peak',x,h/2,z,w,h,w,k===0?'#a89c86':'#9a9a84',{ry}); P('peak',x,h*.24,z,w*1.1,h*.48,w*1.1,k%2?'#8fa67a':'#7f9a6c',{ry});
    if(s.snow&&k<3) P('peak',x,h*.86,z,w*.3,h*.28,w*.3,'#fbfbf8',{ry}); else if(H>1&&k===0) P('peak',x,h*.88,z,w*.24,h*.24,w*.24,'#c9bfae',{ry}); });
  for(let k=0;k<7;k++){ const a=rr()*TAU, r=1.15+rr()*.3; tree('conifer',Math.cos(a)*r,Math.sin(a)*r,.28+rr()*.12); }
  if(s.name){ const el=document.createElement('div'); el.className='mtn'; el.textContent=s.name; const o=new CSS2DObject(el); o.position.set(s.x,TOP+H*1.3+.35,s.z-.15); scene.add(o); mtnLabels.push(o); }
});
// bridges
curOwner=null; curSmall=false; setFrame(0,0,0,1,0);
bridges.forEach(b=>{ const dir=b.pb.clone().sub(b.pa); const L=dir.length(); const yaw=Math.atan2(dir.x,dir.z);
  for(let i=0;i<9;i++){ const t=(i+.5)/9; const p=b.pa.clone().addScaledVector(dir,t); const y=TOP+.02+Math.sin(t*Math.PI)*b.h; const slope=Math.atan(b.h*Math.PI*Math.cos(t*Math.PI)/L);
    _e.set(-slope,yaw,0,'YXZ'); const q=new THREE.Quaternion().setFromEuler(_e); _e.order='XYZ';
    parts.push({kind:'box',m:new THREE.Matrix4().compose(new THREE.Vector3(p.x,y,p.z),q,new THREE.Vector3(.36,.04,L/9*.92)),color:new THREE.Color(i%2?'#c9976f':C.wood),owner:null,small:false}); }
  for(const t of [0.02,.98]) for(const side of [-1,1]){ const p=b.pa.clone().addScaledVector(dir,t); const nx=dir.z/L*side*.19, nz=-dir.x/L*side*.19; P('cyl',p.x+nx,TOP+.1,p.z+nz,.04,.2,.04,C.cream); P('sphere',p.x+nx,TOP+.21,p.z+nz,.05,.05,.05,C.coral); }
});

/* ---------- background islets, lighthouse ---------- */
// 澎湖（西）、綠島與蘭嶼（東南）、龜山島（東北）
const islets=[[-15,1,1.2,true],[-16.5,3.4,.8,false],[-14,4.6,.7,false],[13,11,.9,false],[12.5,16,1.1,false],[9,-15.5,.7,false]];
islets.forEach(([dx,dz,sz,lh],k)=>{ const x=center.x+dx, z=center.z+dz; setFrame(x,WATER_Y,z,sz,0);
  P('cyl',0,.2,0,1.6,.5,1.6,'#e3cfae'); P('ico',0,.55,0,1.2,.5,1.2,C.leaf2); P('ico',.3,.8,.2,.6,.5,.6,C.leaf1);
  if(lh){ for(let j=0;j<5;j++) P('cyl',-.2,.9+j*.28,0,.36-.03*j,.28,.36-.03*j,j%2?C.white:C.coral); P('glowsphere',-.2,2.35,0,.24,.24,.24,'#fff1c9'); P('cone',-.2,2.6,0,.36,.3,.36,C.ink); } });
setFrame(0,0,0,1,0);

/* ---------- build instanced meshes ---------- */
const solidMat=new THREE.MeshStandardMaterial({roughness:.78,metalness:0});
const glowMat=new THREE.MeshStandardMaterial({roughness:.6,metalness:0,emissive:new THREE.Color('#ffc777'),emissiveIntensity:0});
const flameMat=new THREE.MeshBasicMaterial({toneMapped:false});
const ownerParts={}; const kitMeshes=[], smallMeshes=[];
{ const groups={}; parts.forEach(pt=>{ const key=pt.kind+(pt.small?'|s':''); (groups[key]=groups[key]||[]).push(pt); });
  for(const key in groups){ const arr=groups[key], kind=key.split('|')[0], small=key.endsWith('|s'), glow=kind.startsWith('glow');
    const mesh=new THREE.InstancedMesh(GEO[kind], kind==='flame'?flameMat:glow?glowMat:solidMat, arr.length);
    mesh.userData.owners=[]; mesh.userData.base=[];
    arr.forEach((pt,i)=>{ mesh.setMatrixAt(i,pt.m); mesh.setColorAt(i,pt.color); mesh.userData.owners[i]=pt.owner; mesh.userData.base[i]=pt.color; if(pt.owner) (ownerParts[pt.owner]=ownerParts[pt.owner]||[]).push([mesh,i]); });
    mesh.castShadow=!small&&!glow&&kind!=='flame'; mesh.receiveShadow=true; mesh.computeBoundingSphere(); scene.add(mesh); kitMeshes.push(mesh); if(small) smallMeshes.push(mesh); } }
parts.length=0;
// lamp pools (additive)
const poolMat=new THREE.MeshBasicMaterial({color:'#ffc777',transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
const pools=new THREE.InstancedMesh(new THREE.CircleGeometry(.5,20).rotateX(-Math.PI/2),poolMat,lampPos.length);
lampPos.forEach((p,i)=>pools.setMatrixAt(i,new THREE.Matrix4().makeTranslation(p.x,p.y,p.z).multiply(new THREE.Matrix4().makeScale(.8,1,.8))));
scene.add(pools); smallMeshes.push(pools);

/* ---------- terrain, trees, mountains, clouds, boats ---------- */
function fbm(x,y){ let a=0,amp=1,f=1; for(let i=0;i<4;i++){ a+=amp*simplex.noise(x*f,y*f); amp*=.5; f*=2; } return a; }
function terrainH(x,z){ const dx=x-center.x, dz=z-center.z, d=Math.hypot(dx,dz*.6);
  const ring=smooth(30,58,d)*9; let h=-2.6+smooth(20,32,d)*2.4+ring+fbm(dx*.045,dz*.045)*3.2*smooth(24,46,d);
  const cd=(dx*.266+dz*.964)/(Math.hypot(dx,dz)+1e-6); h-=smooth(.15,.9,cd)*(ring*.8+smooth(20,32,d)*1.2);
  if(h>0){ const t=Math.floor(h/.55)*.55; h=t+(h-t)*.35; } return h; }
{ const seg=LOW?80:isMobile?110:160; const g=new THREE.PlaneGeometry(210,210,seg,seg).rotateX(-Math.PI/2); const p=g.attributes.position; const col=new Float32Array(p.count*3);
  const stops=[[-.1,'#8fb3ad'],[.35,'#d9c9a3'],[1.5,'#aec493'],[3,'#a3b986'],[6,'#6f8a62'],[99,'#b2a38d']].map(([h,c])=>[h,new THREE.Color(c)]);
  for(let i=0;i<p.count;i++){ const x=p.getX(i)+center.x, z=p.getZ(i)+center.z; const h=terrainH(x,z); p.setY(i,h); const c=stops.find(s=>h<s[0])[1]; col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b; }
  g.setAttribute('color',new THREE.BufferAttribute(col,3)); g.computeVertexNormals();
  const terr=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1})); terr.position.set(center.x,0,center.z); terr.receiveShadow=true; scene.add(terr); }
{ const conG=BGU.mergeGeometries([new THREE.ConeGeometry(.5,.7,7).translate(0,.55,0),new THREE.ConeGeometry(.4,.6,7).translate(0,.85,0),new THREE.ConeGeometry(.28,.5,7).translate(0,1.12,0),new THREE.CylinderGeometry(.08,.08,.3,5).translate(0,.15,0)]);
  const tr=mulberry32(55); const leafParts=[]; for(let k=0;k<4;k++){ leafParts.push(new THREE.IcosahedronGeometry(.32+tr()*.1,0).translate((tr()-.5)*.35,.55+tr()*.35,(tr()-.5)*.35)); } leafParts.push(new THREE.CylinderGeometry(.07,.07,.4,5).translate(0,.2,0));
  const broG=BGU.mergeGeometries(leafParts.map(g=>g.index?g.toNonIndexed():g));
  const N=LOW?400:isMobile?900:2600; const mats=[new THREE.MeshStandardMaterial({flatShading:true,roughness:1}),new THREE.MeshStandardMaterial({flatShading:true,roughness:1})];
  const con=new THREE.InstancedMesh(conG.toNonIndexed?conG:conG,mats[0],N), bro=new THREE.InstancedMesh(broG,mats[1],N); let nc=0,nb=0; const m=new THREE.Matrix4(), cc=new THREE.Color();
  for(let i=0;i<N*3&&(nc<N||nb<N);i++){ const a=tr()*TAU, r=22+tr()*48; const x=center.x+Math.cos(a)*r, z=center.z+Math.sin(a)*r; const h=terrainH(x,z); if(h<WATER_Y+.25) continue; const s=.7+tr()*1.1;
    m.compose(new THREE.Vector3(x,h-.05,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,tr()*TAU,0)),new THREE.Vector3(s,s*(.85+tr()*.4),s));
    if(h>2.4&&tr()<.65){ if(nc<N){ con.setMatrixAt(nc,m); con.setColorAt(nc,cc.set(['#5f7d58','#6f8a62','#587453'][nc%3])); nc++; } }
    else if(nb<N){ bro.setMatrixAt(nb,m); bro.setColorAt(nb,cc.set(['#8db86f','#9cc27a','#7da66a','#a8c47e'][nb%4])); nb++; } }
  con.count=nc; bro.count=nb; scene.add(con,bro); }
const bands=[];
[[82,9,'#a7b9a0',.35],[102,15,'#b0bdb8',.55],[124,22,'#bcc5cc',.72]].forEach(([rad,ht,col,mix],bi)=>{ const N=200, pos=[], idx=[];
  for(let i=0;i<=N;i++){ const a=i/N*TAU; const x=center.x+Math.cos(a)*rad, z=center.z+Math.sin(a)*rad; const cs=smooth(.1,.85,Math.sin(a)*.96+Math.cos(a)*.27);
    const h=ht*(.5+.4*(simplex.noise(a*2.6+bi*7,bi)*.5+.5)+.2*simplex.noise(a*9+bi*3,2))*(1-cs*.75); pos.push(x,-2,z,x,h,z); }
  for(let i=0;i<N;i++){ const a=i*2; idx.push(a,a+2,a+1,a+1,a+2,a+3); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx);
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:col,side:THREE.DoubleSide,fog:true})); scene.add(m); bands.push({m,base:new THREE.Color(col),mix}); });
const clouds=[]; { const cm=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1,emissive:'#ffffff',emissiveIntensity:.15}); const sg=new THREE.SphereGeometry(1,14,10); const cr=mulberry32(91);
  for(let i=0;i<12;i++){ const g=new THREE.Group(); const n=5+Math.floor(cr()*4); for(let k=0;k<n;k++){ const s=new THREE.Mesh(sg,cm); const sc=1+cr()*1.4; s.scale.set(sc*1.3,sc*.8,sc); s.position.set((k-n/2)*1.5+cr(),cr()*.8,(cr()-.5)*1.6); g.add(s); }
    g.position.set(center.x-70+cr()*140,14+cr()*6,center.z-34-cr()*40); g.userData.v=.25+cr()*.35; scene.add(g); clouds.push(g); } }
const boats=[]; { const hullM=new THREE.MeshStandardMaterial({color:C.coral,roughness:.8}), sailM=new THREE.MeshStandardMaterial({color:'#fffaf2',roughness:.9,side:THREE.DoubleSide});
  const sailG=new THREE.BufferGeometry(); sailG.setAttribute('position',new THREE.Float32BufferAttribute([0,.15,0, 0,1.1,0, 0,.15,.7],3)); sailG.computeVertexNormals();
  for(let i=0;i<3;i++){ const b=new THREE.Group(); const h=new THREE.Mesh(new RoundedBoxGeometry(.5,.2,1.1,2,.08),hullM); h.position.y=.05; const s=new THREE.Mesh(sailG,sailM); s.position.z=-.3; b.add(h,s); b.userData={r:18+i*1.6,rz:30+i*2.5,a:1.0+i*1.7,v:.02+i*.006}; scene.add(b); boats.push(b); } }

/* ---------- walkers ---------- */
const ROLES={
  researcher:{name:'研究員',body:'#f7f5f0',hair:'#3b2f2a'}, office:{name:'上班族',body:C.blue,hair:'#2b2523'}, commuter:{name:'通勤族',body:'#6f8f7b',hair:'#4a372d',bike:true},
  elder:{name:'長者',body:C.wood,hair:'#e8e4de',cane:true}, student:{name:'學生',body:C.aqua,hair:'#2b2523',hat:'yellow'}, parent:{name:'家長',body:C.pink,hair:'#5a3d2e',stroller:true},
  coach:{name:'健身教練',body:C.coral,hair:'#2b2523',hat:'cap'}, nutrition:{name:'營養師',body:C.green,hair:'#4a372d',hat:'straw'}, traveler:{name:'旅人',body:C.teal,hair:'#3b2f2a',suitcase:true}
};
const CARRY={ book:'發炎科學文章', report:'評估報告', moon:'睡眠知識', watch:'穿戴數據', scan:'掃描分數', dna:'研究摘要', chat:'身體訊號', tube:'血液數據', seed:'長壽觀念' };
const flowPaths = DATA.flows.map((f,fi)=>{ const A=islById[f.from], B=islById[f.to];
  const path=dijkstra(A.i*12+((fi*5+1)%12), B.i*12+((fi*7+4)%12)).map(n=>nodes[n].p.clone());
  const cum=[0]; for(let i=1;i<path.length;i++) cum.push(cum[i-1]+path[i].distanceTo(path[i-1])); return {pts:path,cum,len:cum[cum.length-1]}; });
const walkers=[]; const roleKeys=Object.keys(ROLES);
DATA.flows.forEach((f,fi)=>{ const fp=flowPaths[fi]; const n=clamp(Math.round(2+f.count*1.1),3,9);
  for(let k=0;k<n;k++){ const role=rng()<.75?f.role:roleKeys[Math.floor(rng()*roleKeys.length)]; const R0=ROLES[role];
    walkers.push({fi,role,carry:f.carry,s:rng()*fp.len,dir:rng()<.5?1:-1,pause:0,speed:R0.bike?.62+rng()*.08:.32+rng()*.08,phase:rng(),lat:.05+rng()*.05,log:k%3===0,pos:new THREE.Vector3(),fwd:new THREE.Vector3(0,0,1)}); } });
const NW=walkers.length;
const wGeo={ leg:new THREE.BoxGeometry(.032,.09,.036).translate(0,-.045,0), arm:new THREE.BoxGeometry(.024,.08,.024).translate(0,-.04,0), body:new THREE.CapsuleGeometry(.045,.06,4,10),
  head:new THREE.SphereGeometry(.07,16,12), hair:new THREE.SphereGeometry(.075,16,8,0,TAU,0,Math.PI/2), eye:new THREE.SphereGeometry(.011,8,6), shadow:new THREE.CircleGeometry(.075,16).rotateX(-Math.PI/2),
  box:new THREE.BoxGeometry(1,1,1), cone:new THREE.ConeGeometry(.5,1,12), dome:GEO.dome, cyl:new THREE.CylinderGeometry(.5,.5,1,8), torus:new THREE.TorusGeometry(.055,.012,6,14).rotateY(Math.PI/2) };
const wMat=new THREE.MeshStandardMaterial({roughness:.75});
function wMesh(geo,n,mat=wMat){ const m=new THREE.InstancedMesh(geo,mat,n); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.castShadow=false; m.frustumCulled=false; scene.add(m); return m; }
const WM={ leg:wMesh(wGeo.leg,NW*2), arm:wMesh(wGeo.arm,NW*2), body:wMesh(wGeo.body,NW), head:wMesh(wGeo.head,NW), hair:wMesh(wGeo.hair,NW), eye:wMesh(wGeo.eye,NW*2),
  shadow:wMesh(wGeo.shadow,NW,new THREE.MeshBasicMaterial({color:'#2a1d14',transparent:true,opacity:.22,depthWrite:false})),
  box:wMesh(wGeo.box,NW*3), cone:wMesh(wGeo.cone,NW), dome:wMesh(wGeo.dome,NW*2), cyl:wMesh(wGeo.cyl,NW), torus:wMesh(wGeo.torus,NW*2) };
const ZERO=new THREE.Matrix4().makeScale(0,0,0);
const LM=(x,y,z,sx,sy,sz,rx=0,ry=0,rz=0)=>new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),new THREE.Vector3(sx,sy,sz));
const accCount={box:0,cone:0,dome:0,cyl:0,torus:0};
walkers.forEach((w,i)=>{ const R0=ROLES[w.role]; const cc=new THREE.Color();
  WM.body.setColorAt(i,cc.set(R0.body)); WM.head.setColorAt(i,cc.set(C.skin)); WM.hair.setColorAt(i,cc.set(R0.hair)); WM.shadow.setColorAt(i,cc.set('#2a1d14'));
  for(const s of [0,1]){ WM.leg.setColorAt(i*2+s,cc.set('#3f3a44')); WM.arm.setColorAt(i*2+s,cc.set(R0.body)); WM.eye.setColorAt(i*2+s,cc.set(C.ink)); }
  w.acc=[]; const add=(pool,m,col)=>{ const idx=accCount[pool]++; WM[pool].setColorAt(idx,cc.set(col)); w.acc.push([pool,idx,m]); };
  if(R0.hat==='yellow') add('dome',LM(0,.3,0,.17,.08,.17),C.yellow);
  if(R0.hat==='cap'){ add('dome',LM(0,.3,0,.16,.07,.16),C.ink); add('box',LM(0,.305,.08,.1,.01,.07),C.ink); }
  if(R0.hat==='straw'){ add('cone',LM(0,.37,0,.24,.09,.24),'#e2c27a'); }
  if(R0.cane) add('cyl',LM(.08,.08,.06,.012,.17,.012,0,0,.15),C.wood);
  if(R0.suitcase){ add('box',LM(.1,.07,-.02,.05,.11,.09),C.yellow); add('box',LM(.1,.15,-.02,.012,.06,.012),C.ink); }
  if(R0.stroller){ add('box',LM(0,.09,.16,.1,.08,.13),C.cream); add('dome',LM(0,.13,.12,.1,.07,.09,-.9),C.blue); }
  if(R0.bike){ add('torus',LM(0,.06,.11,1,1,1),C.ink); add('torus',LM(0,.06,-.11,1,1,1),C.ink); add('box',LM(0,.11,0,.018,.018,.24),C.coral); }
  if(w.role==='researcher') add('box',LM(0,.16,.046,.06,.07,.012),C.aqua);
});
for(const k in accCount){ for(let i=accCount[k];i<WM[k].count;i++) WM[k].setMatrixAt(i,ZERO); }
// badges
function badgeTex(kind){ const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d');
  g.fillStyle='#fff'; g.beginPath(); g.arc(64,64,56,0,TAU); g.fill(); g.lineWidth=9; g.strokeStyle=C.coral; g.stroke();
  g.strokeStyle=C.ink; g.fillStyle=C.ink; g.lineWidth=6; g.lineCap='round'; g.lineJoin='round'; g.beginPath();
  if(kind==='book'){ g.moveTo(64,44); g.lineTo(64,88); g.moveTo(64,44); g.quadraticCurveTo(48,36,34,42); g.lineTo(34,84); g.quadraticCurveTo(48,80,64,88); g.quadraticCurveTo(80,80,94,84); g.lineTo(94,42); g.quadraticCurveTo(80,36,64,44); }
  if(kind==='report'){ g.rect(42,34,44,60); g.moveTo(52,52); g.lineTo(76,52); g.moveTo(52,64); g.lineTo(76,64); g.moveTo(52,76); g.lineTo(68,76); }
  if(kind==='moon'){ g.arc(66,64,26,Math.PI*.35,Math.PI*1.65); g.quadraticCurveTo(50,64,66*1,64+26*Math.sin(Math.PI*.35)); }
  if(kind==='watch'){ g.rect(46,44,36,40); g.moveTo(54,44); g.lineTo(56,30); g.lineTo(72,30); g.lineTo(74,44); g.moveTo(54,84); g.lineTo(56,98); g.lineTo(72,98); g.lineTo(74,84); g.moveTo(52,66); g.lineTo(60,66); g.lineTo(64,56); g.lineTo(68,74); g.lineTo(72,66); g.lineTo(76,66); }
  if(kind==='scan'){ g.moveTo(64,34); g.lineTo(94,64); g.lineTo(64,94); g.lineTo(34,64); g.closePath(); g.moveTo(50,64); g.lineTo(78,64); }
  if(kind==='dna'){ for(let y=36;y<=92;y+=2){ const t=(y-36)/56*TAU; const x1=64+Math.sin(t)*16; y===36?g.moveTo(x1,y):g.lineTo(x1,y); } g.moveTo(64,36); for(let y=36;y<=92;y+=2){ const t=(y-36)/56*TAU; g.lineTo(64-Math.sin(t)*16,y); } }
  if(kind==='chat'){ g.moveTo(38,44); g.lineTo(90,44); g.lineTo(90,78); g.lineTo(60,78); g.lineTo(46,90); g.lineTo(48,78); g.lineTo(38,78); g.closePath(); }
  if(kind==='tube'){ g.moveTo(56,32); g.lineTo(56,84); g.arc(64,84,8,Math.PI,0,true); g.lineTo(72,32); g.moveTo(52,32); g.lineTo(76,32); g.moveTo(56,62); g.lineTo(72,62); }
  if(kind==='seed'){ g.moveTo(64,94); g.lineTo(64,56); g.moveTo(64,66); g.quadraticCurveTo(40,64,40,42); g.quadraticCurveTo(62,42,64,62); g.moveTo(64,58); g.quadraticCurveTo(88,56,88,36); g.quadraticCurveTo(66,36,64,56); }
  g.stroke(); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; }
const badgeMats={}; Object.keys(CARRY).forEach(k=>badgeMats[k]=new THREE.SpriteMaterial({map:badgeTex(k),depthWrite:false}));
const sprites=walkers.map(w=>{ const s=new THREE.Sprite(badgeMats[w.carry]); s.scale.set(.17,.17,1); s.visible=false; scene.add(s); return s; });
const tags=walkers.map(w=>{ const el=document.createElement('div'); el.className='wtag'; el.textContent='正在搬 '+CARRY[w.carry]; const o=new CSS2DObject(el); o.visible=false; scene.add(o); return o; });

/* ---------- flow tubes ---------- */
const flowMeshes = DATA.flows.map((f,fi)=>{ const fp=flowPaths[fi]; const cp=new THREE.CurvePath();
  for(let i=1;i<fp.pts.length;i++) cp.add(new THREE.LineCurve3(fp.pts[i-1].clone().setY(fp.pts[i-1].y+.025),fp.pts[i].clone().setY(fp.pts[i].y+.025)));
  const g=new THREE.TubeGeometry(cp,Math.max(16,fp.pts.length*8),.035,6,false);
  const style={official:0,thematic:1,pending:2}[f.evidence];
  const m=new THREE.Mesh(g,new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    uniforms:{uTime:{value:0},uLen:{value:fp.len},uStyle:{value:style},uColor:{value:new THREE.Color(C.coral)},uOpacity:{value:.82}},
    vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`uniform float uTime; uniform float uLen; uniform float uStyle; uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
void main(){ float u = vUv.x*uLen*5.0 - uTime*1.4;
  if(uStyle>.5 && uStyle<1.5 && fract(u)>.6) discard;
  if(uStyle>1.5 && fract(u)>.3) discard;
  gl_FragColor = vec4(uColor*(.9+.1*sin(u*6.283)), uOpacity);
  #include <colorspace_fragment>
}`}));
  m.visible=false; m.renderOrder=2; m.userData.flow=fi; scene.add(m); return m; });

/* ---------- labels & pins ---------- */
const islLabels = ISL.map(s=>{ const el=document.createElement('button'); el.className='isl'; el.innerHTML=`<b>${String(s.i+1).padStart(2,'0')}</b><span>${s.name}</span>`;
  el.addEventListener('click',e=>{ e.stopPropagation(); selectIsland(s.i); }); const o=new CSS2DObject(el); o.position.set(s.x,TOP*.45,s.z+R*.98); scene.add(o); return {o,el,state:'full',fullW:0}; });
const CIRC='①②③④⑤⑥⑦⑧⑨';
const pins={}; Object.values(itemById).forEach(it=>{ const el=document.createElement('div'); el.className='pin'; el.textContent=CIRC[it.k]; el.title=it.name;
  el.addEventListener('click',e=>{ e.stopPropagation(); selectItem(it.id); }); const o=new CSS2DObject(el); o.position.set(it.world.x,TOP+it.h+.38,it.world.z); o.visible=false; scene.add(o); pins[it.id]={o,el}; });
const pinLines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:C.coral,depthTest:false,transparent:true}));
pinLines.renderOrder=5; pinLines.visible=false; scene.add(pinLines);

/* ---------- day / night ---------- */
const KF=[[0,'1e2c58','3f4f80','b4c2ff',1.15,'94a2d8','64566a',1.85,1,'5a88b2'],[300,'26365f','4c5688','b8c4ff',1.0,'96a4da','66586c',1.85,1,'5c8ab4'],[360,'7f8fc4','f6c3a6','ffb48a',1.3,'f3c6b5','6b5a5a',1.1,.55,'8fb7c4'],[450,'a9d1ea','fbe6d3','ffe2c4',2.4,'eaf2f6','8a7a68',1.25,0,'9fcfd6'],[720,'9fd0ec','f4eee3','fff1de',2.9,'eef6fa','8f8270',1.35,0,'a9d8db'],[960,'a6cfe6','f8e7d2','ffe3c0',2.5,'f1efe8','8a7a66',1.25,0,'9fcbd2'],[1065,'8b8fc4','f7b98f','ff9f6a',1.8,'f6d2bc','7d6660',1.2,.3,'93a9bd'],[1140,'5a5e9e','d99aa6','ff9a7a',1.3,'c0b2e0','655868',1.35,.75,'6a7cab'],[1260,'22325f','445488','c0ccff',1.2,'98a8dc','685a6e',1.9,1,'5a88b2']]
  .map(k=>({t:k[0],top:new THREE.Color('#'+k[1]),hor:new THREE.Color('#'+k[2]),sunC:new THREE.Color('#'+k[3]),sunI:k[4],hs:new THREE.Color('#'+k[5]),hg:new THREE.Color('#'+k[6]),hi:k[7],night:k[8],water:new THREE.Color('#'+k[9])}));
KF.push({...KF[0],t:1440});
let minute=600, lastQ=-1, night=0, activeSlot=-1; const activeItems=new Set();
const cA=new THREE.Color(), WHITE=new THREE.Color('#ffffff');
function applyTime(force){
  const q=Math.floor(minute/10)*10; if(q===lastQ&&!force) return; lastQ=q;
  let i=0; while(i<KF.length-2&&KF[i+1].t<=q) i++; const a=KF[i], b=KF[i+1], f=(q-a.t)/(b.t-a.t);
  const L=(k)=>cA.copy(a[k]).lerp(b[k],f).clone(), N=(k)=>a[k]+(b[k]-a[k])*f;
  const hor=L('hor'); skyMat.uniforms.uTop.value.copy(L('top')); skyMat.uniforms.uHorizon.value.copy(hor); scene.fog.color.copy(hor);
  sun.color.copy(L('sunC')); sun.intensity=N('sunI'); hemi.color.copy(L('hs')); hemi.groundColor.copy(L('hg')); hemi.intensity=N('hi');
  night=N('night'); skyMat.uniforms.uNight.value=night; skyMat.uniforms.uSun.value.copy(sun.color).multiplyScalar(1-night*.7);
  const wc=L('water'); waterMat.uniforms.uShallow.value.copy(wc).lerp(WHITE,.28); waterMat.uniforms.uDeep.value.copy(wc).multiplyScalar(.8);
  shallowMat.color.copy(wc).lerp(WHITE,.5);
  glowMat.emissiveIntensity=night*3.2; poolMat.opacity=night*.55;
  const t=clamp((q-360)/720,0,1), az=Math.PI*(.15+.7*t), el=.35+Math.sin(t*Math.PI)*.75;
  const dir=new THREE.Vector3(Math.cos(az)*Math.cos(el),Math.sin(el),.55*Math.cos(el)+.35).normalize();
  sun.position.copy(center).addScaledVector(dir,60); skyMat.uniforms.uSunDir.value.copy(dir);
  bands.forEach(bd=>bd.m.material.color.copy(bd.base).lerp(hor,bd.mix).multiplyScalar(1-night*.35));
  const slot=DATA.dayCycle.findIndex(s=>minute>=s.from&&minute<s.to);
  if(slot!==activeSlot){ activeSlot=slot; activeItems.clear(); if(slot>=0) DATA.dayCycle[slot].items.forEach(id=>activeItems.add(id)); applyHighlight(); }
  const hh=String(Math.floor(minute/60)).padStart(2,'0'), mm=String(Math.floor(minute%60/10)*10).padStart(2,'0');
  $('#clockT').textContent=hh+':'+mm; $('#clockS').textContent=slot>=0?DATA.dayCycle[slot].name+'・'+DATA.dayCycle[slot].items.map(id=>itemById[id].name).slice(0,2).join('、'):'';
  dirty=true;
}

/* ---------- highlight & selection ---------- */
let sel=null; const ORPH=new THREE.Color('#d8366a'), DEAD=new THREE.Color('#4c5fb0'), CORAL=new THREE.Color(C.coral), YEL=new THREE.Color(C.yellow), tmpC=new THREE.Color();
function applyHighlight(){ const touched=new Set();
  for(const id in ownerParts){ if(!itemById[id]) continue; let tgt=null;
    let amt=.28; if(sel&&sel.type==='item'&&sel.id===id){ tgt=CORAL; amt=.3; } else if(st.audit&&orphans.has(id)){ tgt=ORPH; amt=.55; } else if(st.audit&&deadEnds.has(id)){ tgt=DEAD; amt=.5; } else if(!st.audit&&activeItems.has(id)) tgt=YEL;
    for(const [mesh,i] of ownerParts[id]){ tmpC.copy(mesh.userData.base[i]); if(tgt) tmpC.lerp(tgt,amt); mesh.setColorAt(i,tmpC); touched.add(mesh); } }
  touched.forEach(m=>m.instanceColor.needsUpdate=true); dirty=true; }
const st={ tags:false, carry:true, flows:false, pause:false, bird:false, log:false, audit:false };
function updateFlows(){ const vis=new Set(); if(st.flows) DATA.flows.forEach((f,i)=>vis.add(i));
  if(sel){ if(sel.type==='island'){ const id=ISL[sel.i].id; DATA.flows.forEach((f,i)=>{ if(f.from===id||f.to===id) vis.add(i); }); }
    if(sel.type==='item'){ const id=ISL[itemById[sel.id].island].id; DATA.flows.forEach((f,i)=>{ if(f.from===id||f.to===id) vis.add(i); }); }
    if(sel.type==='flow') vis.add(sel.fi); if(sel.type==='walker') vis.add(walkers[sel.wi].fi); }
  flowMeshes.forEach((m,i)=>m.visible=vis.has(i)); $('#legend').hidden=vis.size===0; dirty=true; }
function showPins(islIdx){ const pos=[];
  Object.values(itemById).forEach(it=>{ const flag=st.audit&&(orphans.has(it.id)||deadEnds.has(it.id)); const on=it.island===islIdx||flag; pins[it.id].o.visible=on; pins[it.id].el.classList.toggle('on',!!(sel&&sel.type==='item'&&sel.id===it.id));
    pins[it.id].el.classList.toggle('orph',st.audit&&orphans.has(it.id)); pins[it.id].el.classList.toggle('dead',st.audit&&!orphans.has(it.id)&&deadEnds.has(it.id));
    if(on){ pos.push(it.world.x,TOP+it.h,it.world.z, it.world.x,TOP+it.h+.3,it.world.z); } });
  pinLines.geometry.dispose(); pinLines.geometry=new THREE.BufferGeometry(); pinLines.geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); pinLines.visible=pos.length>0; }
function islOfSel(){ if(!sel) return -1; if(sel.type==='island') return sel.i; if(sel.type==='item') return itemById[sel.id].island; return -1; }
function refreshLabels(){ const si=islOfSel(); islLabels.forEach((l,i)=>{ l.el.classList.toggle('sel',i===si); l.el.classList.toggle('dim',si>=0&&i!==si); }); }
function afterSelect(){ applyHighlight(); updateFlows(); showPins(islOfSel()); refreshLabels(); renderList(); }

/* ---------- camera flight ---------- */
let fly=null; const UP=new THREE.Vector3(0,1,0);
const OFF_ISL=new THREE.Vector3(2.75,5.3,6.2), OFF_ITEM=new THREE.Vector3(1.6,2.5,3.2).multiplyScalar(1.45);
function cardOpen(){ return !$('#card').hidden; }
function flyTo(obj,off){ const target=obj.clone(); const offset=off.clone();
  if(mqMobile.matches){ target.y-=off.length()*.09; }
  else if(cardOpen()){ const right=new THREE.Vector3().crossVectors(offset.clone().negate(),UP).normalize(); target.addScaledVector(right,-1.5*off.length()/8.6); }
  if(st.bird){ offset.set(.01,84,12); }
  startFly(target.clone().add(offset),target); }
function startFly(pos,target){ if(reduced){ camera.position.copy(pos); controls.target.copy(target); controls.update(); dirty=true; return; }
  fly={t0:performance.now(),p0:camera.position.clone(),t0v:controls.target.clone(),p1:pos,t1:target}; }
function panoDist(){ const a=innerWidth/innerHeight; return a>1.3?64:a>.8?72:124; }
function panoTarget(){ const t=center.clone(); if(mqMobile.matches){ t.x-=0.6; t.z+=0.5; } else { t.z+=5; if(!$('#side').hidden) t.x+=3.6; } return t; }
function panorama(){ const dir=new THREE.Vector3(.16,.8,.58).normalize(); const t=panoTarget(); if(st.bird){ startFly(t.clone().add(new THREE.Vector3(.01,84,12)),t); return; } startFly(t.clone().addScaledVector(dir,panoDist()),t); }

/* ---------- cards ---------- */
const cardBody=$('#cardBody');
function openCard(html){ $('#card').hidden=false; cardBody.innerHTML=html; cardBody.scrollTop=0;
  cardBody.querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>selectItem(b.dataset.item));
  cardBody.querySelectorAll('[data-read]').forEach(a=>a.addEventListener('click',()=>{ try{ window.gtag&&gtag('event','map_read_article',{slug:a.dataset.read}); }catch(e){} }));
  cardBody.querySelectorAll('[data-flow]').forEach(b=>b.onclick=()=>selectFlow(+b.dataset.flow));
  cardBody.querySelectorAll('[data-isl]').forEach(b=>b.onclick=()=>selectIsland(+b.dataset.isl)); }
function closeCard(){ $('#card').hidden=true; sel=null; afterSelect(); }
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const STEP=t=>DATA.steps[t];
const tierChip=t=>`<span class="tier">第 ${t} 步 · ${STEP(t).name}</span>`;
function nextFor(it){
  const t=it.tier; if(t>=4) return null;
  const outs=outLinks[it.id]||[];
  const pick=outs.filter(x=>itemById[x].tier===t+1)[0]||outs.filter(x=>itemById[x].tier>t).sort((a,b)=>itemById[a].tier-itemById[b].tier)[0];
  if(pick) return {id:pick, via:'這篇內文就有連過去'};
  const same=ISL[it.island].items.find(x=>x.tier===t+1&&!x.page); if(same) return {id:same.id, via:'同一座島上的下一步'};
  const any=Object.values(itemById).filter(x=>x.tier===t+1&&!x.page).sort((a,b)=>(inLinks[b.id]||[]).length-(inLinks[a.id]||[]).length)[0];
  return any?{id:any.id, via:'這一步最多文章連到的一篇'}:null;
}
function pathBlock(it){ const t=it.tier;
  const lis=[1,2,3,4].map(k=>`<li class="${k<t?'done':k===t?'on':''}"><i>${k<t?'✓':k}</i>${STEP(k).short}</li>`).join('');
  let next='';
  if(t<4){ const n=nextFor(it); if(n) next=`<button class="next" data-item="${n.id}"><small>下一步 · ${esc(STEP(t+1).name)}</small><b>${esc(itemById[n.id].name)}</b><span style="font-size:11.5px;color:var(--m-muted)">${esc(n.via)}</span></button>`; }
  else next=`<a class="next" href="${DATA.links.prescan}"><small>下一步 · 帶數據來</small><b>填寫掃描前資料表，排出你的 90 天優先順序</b></a>`;
  return `<div class="path"><h3>這篇是閱讀路徑的<b>第 ${t} 步：${esc(STEP(t).name)}</b></h3><ol class="steps">${lis}</ol><p>${esc(STEP(t).what)}</p>${next}</div>`; }
function flowChip(fi){ const f=DATA.flows[fi]; return `<button class="chip" data-flow="${fi}">${esc(islById[f.from].name)} → ${esc(islById[f.to].name)}</button>`; }
function ctaFor(t){ return t<=2?`<a class="cta soft" href="${DATA.links.assessment}">身體警報訊號評估清單（1 分鐘）→</a>`
  :`<a class="cta" href="${DATA.links.prescan}">填寫掃描前資料表，整理優先方向 →</a>`; }
function cardIsland(i){ const s=ISL[i]; const fl=DATA.flows.map((f,fi)=>[f,fi]).filter(([f])=>f.from===s.id||f.to===s.id);
  return `<div class="c-head"><span class="c-num">${String(i+1).padStart(2,'0')}</span><div><div class="eyebrow">健康主題島${LANDMARKS[s.landmark]?' · 地標：'+LANDMARKS[s.landmark].name:''}</div>${tierChip(s.tier)}</div></div>
  <h2>${esc(s.name)}</h2><p>${esc(s.summary)}</p>
  ${AUDIT?`<div class="tiles">${(()=>{ const ids=s.items.map(it=>it.id); const out=ids.reduce((n,id)=>n+outLinks[id].filter(t=>itemById[t].island!==i).length,0), inn=ids.reduce((n,id)=>n+inLinks[id].filter(t=>itemById[t].island!==i).length,0), orph=ids.filter(id=>orphans.has(id)).length;
    return `<div class="tile"><b>${out}<small>條</small></b><span>連往其他島</span></div><div class="tile"><b>${inn}<small>條</small></b><span>從其他島連入</span></div><div class="tile"><b>${orph}<small>篇</small></b><span>孤兒文章</span></div>`; })()}</div>`:''}
  <div class="sec">島上文章 · ${s.items.length}</div>
  <ul class="ilist">${s.items.map(it=>`<li><button data-item="${it.id}"><span class="n">${CIRC[it.k]}</span>${esc(it.name)}${AUDIT&&orphans.has(it.id)?'<small class="fo">孤兒</small>':''}${AUDIT&&deadEnds.has(it.id)?'<small class="fd">死路</small>':''}</button></li>`).join('')}</ul>
  ${fl.length?`<div class="sec">通往其他島的路</div><div class="chips">${fl.map(([f,fi])=>flowChip(fi)).join('')}</div>`:''}
  ${ctaFor(s.tier)}`; }
function numTile(fact){ const m=fact.match(/(\d[\d,]*(?:\.\d+)?)(?:\s*[–-]\s*(\d+))?\s*(年代|mg\/L|%|秒|分鐘|小時|天|週|篇|項|個|年|次|種|步|位|份|條|張|下|頁|件|歲|公分|色|台|大|多)?/); if(!m) return '';
  return `<div class="tile"><b>${m[1]}${m[2]?'–'+m[2]:''}${m[3]?`<small>${m[3]}</small>`:''}</b><span>${esc(fact)}</span></div>`; }
function cardItem(id){ const it=itemById[id], s=ISL[it.island];
  return `<div class="eyebrow">${String(s.i+1).padStart(2,'0')} ${esc(s.name)} · 細項 ${CIRC[it.k]}</div><h2>${esc(it.name)}</h2>
  <canvas class="thumb" id="thumb" width="320" height="320" aria-label="${esc(it.name)} 模型縮圖"></canvas>
  <blockquote class="tq">${esc(it.desc)}</blockquote>
  ${it.sum?`<p>${esc(it.sum)}</p>`:''}
  ${AUDIT&&(orphans.has(id)||deadEnds.has(id))?`<div class="chips" style="margin-bottom:10px">${orphans.has(id)?'<span class="flag orphan">孤兒文章：沒有任何文章連到這篇</span>':''}${deadEnds.has(id)?'<span class="flag dead">死路：內文沒有連出去</span>':''}</div>`:''}
  ${it.facts.length?`<div class="tiles">${it.facts.slice(0,3).map(numTile).join('')}</div>`:''}
  ${it.url?`<a class="cta read" href="${it.url}" data-read="${it.id}">${it.page?'前往這一頁':'閱讀全文'} →</a>`:''}
  <div class="sec">閱讀路徑</div>${pathBlock(it)}
  ${it.page?'':`<div class="sec">延伸閱讀 · ${outLinks[id].length}</div>${outLinks[id].length?`<ul class="ilist lk">${outLinks[id].map(linkBtn).join('')}</ul>`:'<p class="none">這篇沒有延伸閱讀。</p>'}
  <div class="sec">從這些文章讀過來 · ${inLinks[id].length}</div>${inLinks[id].length?`<ul class="ilist lk">${inLinks[id].map(linkBtn).join('')}</ul>`:'<p class="none">還沒有其他文章提到這篇。</p>'}`}
  ${activeItems.has(id)?`<p style="margin-top:12px"><span class="tier" style="background:#fcf3c2;color:#6b5a12">此刻亮起 · ${esc(DATA.dayCycle[activeSlot].name)}</span></p>`:''}
  <div class="sec">所屬島嶼</div><div class="chips"><button class="chip" data-isl="${s.i}">${esc(s.name)}</button></div>
  ${ctaFor(it.tier)}`; }
const EVL={official:'帶往下一步',thematic:'同一步延伸',pending:'帶回前一步'};
const linkBtn=id=>`<li><button data-item="${id}"><span class="n">${itemById[id].tier}</span>${esc(itemById[id].name)}<small>${esc(ISL[itemById[id].island].name)}</small></button></li>`;
function cardFlow(fi){ const f=DATA.flows[fi]; const n=walkers.filter(w=>w.fi===fi).length;
  return `<div class="eyebrow">文章之間的路</div><h2>${esc(islById[f.from].name)} → ${esc(islById[f.to].name)}</h2>
  <div class="flowrow"><button class="chip" data-isl="${islById[f.from].i}">${esc(islById[f.from].name)}</button>→<button class="chip" data-isl="${islById[f.to].i}">${esc(islById[f.to].name)}</button></div>
  ${AUDIT?`<p style="margin-top:10px"><span class="ev"><i class="${f.evidence}"></i>多數連結是${EVL[f.evidence]}</span></p>
  <div class="tiles"><div class="tile"><b>${f.d.down}<small>條</small></b><span>帶往下一步</span></div><div class="tile"><b>${f.d.same}<small>條</small></b><span>同一步延伸</span></div><div class="tile"><b>${f.d.up}<small>條</small></b><span>帶回前一步</span></div></div>`:''}
  <div class="sec">這條路上的文章 · ${f.count}</div>
  <ul class="ilist lk">${f.links.map(([a,b])=>`<li><button data-item="${a}"><span class="n">${itemById[a].tier}</span>${esc(itemById[a].name)}<small>→ ${esc(itemById[b].name)} · 第 ${itemById[b].tier} 步</small></button></li>`).join('')}</ul>
  <p style="margin-top:12px;color:var(--m-muted);font-size:12.5px">${n} 位居民在這條路上搬運「${esc(CARRY[f.carry])}」。</p>`; }
function cardWalker(wi){ const w=walkers[wi], f=DATA.flows[w.fi];
  return `<div class="eyebrow">島上居民</div><h2>${ROLES[w.role].name}</h2><p>正在搬 <b>${esc(CARRY[w.carry])}</b>，往返於 ${esc(islById[f.from].name)} 與 ${esc(islById[f.to].name)} 之間。這條路上有 ${f.count} 組文章互相連結。</p>
  <div class="sec">所在流動</div><div class="chips">${flowChip(w.fi)}</div>`; }
function renderThumb(id){ const cv=document.getElementById('thumb'); if(!cv) return; const it=itemById[id];
  const pr=renderer.getPixelRatio(), S=160, cam=new THREE.PerspectiveCamera(30,1,.1,200); const d=it.scale*2.3+.5;
  cam.position.set(it.world.x+d*.55,TOP+it.h*.6+d*.62,it.world.z+d*.85); cam.lookAt(it.world.x,TOP+it.h*.42,it.world.z);
  const pv=pinLines.visible; pinLines.visible=false; flowMeshes.forEach(m=>m.userData.v=m.visible); flowMeshes.forEach(m=>m.visible=false);
  const size=renderer.getSize(new THREE.Vector2()); renderer.setScissorTest(true); renderer.setScissor(0,0,S,S); renderer.setViewport(0,0,S,S);
  renderer.render(scene,cam); const g=cv.getContext('2d'); g.drawImage(renderer.domElement,0,renderer.domElement.height-S*pr,S*pr,S*pr,0,0,cv.width,cv.height);
  renderer.setScissorTest(false); renderer.setViewport(0,0,size.x,size.y); pinLines.visible=pv; flowMeshes.forEach(m=>m.visible=m.userData.v); dirty=true; }

function selectIsland(i){ sel={type:'island',i}; openCard(cardIsland(i)); afterSelect(); const s=ISL[i]; flyTo(new THREE.Vector3(s.x,TOP,s.z),OFF_ISL); }
function selectItem(id){ sel={type:'item',id}; openCard(cardItem(id)); afterSelect(); const it=itemById[id]; flyTo(it.world.clone().setY(TOP+it.h*.4),OFF_ITEM); renderThumb(id); }
function selectFlow(fi){ sel={type:'flow',fi}; openCard(cardFlow(fi)); afterSelect(); const fp=flowPaths[fi]; const mid=new THREE.Vector3(); fp.pts.forEach(p=>mid.add(p)); mid.multiplyScalar(1/fp.pts.length);
  flyTo(mid,OFF_ISL.clone().multiplyScalar(clamp(fp.len/9,1,1.9))); }
function selectWalker(wi){ sel={type:'walker',wi}; openCard(cardWalker(wi)); afterSelect(); flyTo(walkers[wi].pos.clone(),OFF_ITEM); }

function cardCheck(){ return `<div class="eyebrow">開始你的健檢</div><h2>先從哪一個開始？</h2>
  <p>把地圖上讀到的身體訊號，換成你自己的數據。</p>
  <a class="choice" href="${DATA.links.prescan}"><small>有健檢報告</small><b>填寫掃描前資料表 →</b><span>帶上血液報告和穿戴裝置數據，整理出 90 天生活調整的優先順序。</span></a>
  <a class="choice" href="${DATA.links.assessment}"><small>還沒有數據</small><b>身體警報訊號評估清單 →</b><span>約 1 分鐘，先看看身體哪些訊號正在亮燈。</span></a>`; }
function cardAbout(){ return `<div class="eyebrow">作者</div><h2 class="about-name">孫義坤 <small>生醫數據專員</small></h2>
  <p>幫你找回生活餘裕。這張地圖上的每一篇文章，都是我把研究文獻轉成白話寫成的。</p>
  <ul class="creds"><li>國立陽明交通大學應用化學、國立清華大學分子醫學背景</li><li>15 年協助臨床醫師解讀研究數據、撰寫醫學論文</li><li>帶上你的健檢數據，對照科學研究文獻，了解數字背後可能的生活型態意義</li></ul>
  <p class="motto">我不賣奇蹟，只看科學實證與數據。</p>
  <a class="cta read" href="${DATA.links.about}">看完整介紹 →</a>
  <button class="chip" id="aboutCheck" style="margin-top:10px">開始你的健檢</button>`; }
function openSpecial(kind){ sel=null; openCard(kind==='about'?cardAbout():cardCheck()); afterSelect(); document.body.classList.remove('hud-open'); if(mqMobile.matches) $('#card').style.height='62vh';
  const b=document.getElementById('aboutCheck'); if(b) b.onclick=()=>openSpecial('check'); }

/* ---------- 島主 Jason 與導覽路線 ---------- */
const ROUTES = DATA.routes || [];
const jason = new THREE.Group();
{ // Q 版島主 Jason：照作者照片——深藍西裝、白襯衫、深色領帶、黑色短髮前面往上抓、笑容
  const mat=(c,r=.7)=>new THREE.MeshStandardMaterial({color:c,roughness:r});
  const add=(geo,m,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0)=>{ const o=new THREE.Mesh(geo,m); o.position.set(x,y,z); o.scale.set(sx,sy,sz); o.rotation.set(rx,ry,rz); o.castShadow=true; jason.add(o); return o; };
  const skin=mat('#f0c9a8'), suit=mat('#1f2a44',.6), pants=mat('#1b2236',.6), shirt=mat('#f7f7f5',.5), tie=mat('#2b2f3d',.4), hair=mat('#16130f',.55), ink=mat('#211d1d'), shoe=mat('#111111',.4), mouth=mat('#8a3b2c');
  const box=new THREE.BoxGeometry(1,1,1), sph=new THREE.SphereGeometry(.5,16,12), cone=new THREE.ConeGeometry(.5,1,4);
  // 腿與鞋（以髖部為軸，走路時擺動）
  const leg=(x)=>{ const g=new THREE.Group(); g.position.set(x,.1,0); const l=new THREE.Mesh(wGeo.leg,pants); l.castShadow=true; g.add(l); const sh=new THREE.Mesh(box,shoe); sh.scale.set(.036,.018,.05); sh.position.set(0,-.088,.008); g.add(sh); jason.add(g); return g; };
  // 手臂：西裝袖加手
  const arm=(x)=>{ const g=new THREE.Group(); g.position.set(x,.205,0); const a=new THREE.Mesh(wGeo.arm,suit); a.castShadow=true; g.add(a); const h=new THREE.Mesh(sph,skin); h.scale.setScalar(.026); h.position.set(0,-.084,0); g.add(h); jason.add(g); return g; };
  jason.userData.legs=[leg(-.028), leg(.028)];
  jason.userData.arms=[arm(-.066), arm(.066)];
  add(wGeo.body,suit,0,.15,0,1.15,1,1.12);                 // 西裝外套
  add(cone,shirt,0,.205,.043,.05,.07,.012,Math.PI,0,0);     // 白襯衫 V 領
  add(box,tie,0,.172,.051,.012,.06,.006);                    // 領帶
  add(cone,tie,0,.205,.052,.016,.012,.006,Math.PI,0,0);     // 領帶結
  add(box,suit,-.022,.19,.048,.014,.06,.006,0,0,.35); add(box,suit,.022,.19,.048,.014,.06,.006,0,0,-.35); // 西裝翻領
  add(wGeo.head,skin,0,.295,0,1.12,1.08,1.12);               // 頭（Q 版放大）
  add(sph,skin,-.079,.295,.002,.018,.026,.014); add(sph,skin,.079,.295,.002,.018,.026,.014); // 耳朵
  add(wGeo.hair,hair,0,.318,-.018,1.12,1.0,1.12,-.42,0,0);   // 頭髮（往後抬，露出額頭和臉）
  add(sph,hair,-.014,.378,.028,.1,.042,.055,-.7,0,.15);      // 前面往上抓的瀏海
  add(sph,hair,.03,.372,.032,.064,.03,.04,-.8,0,-.2);
  add(box,hair,-.077,.318,-.008,.008,.036,.05); add(box,hair,.077,.318,-.008,.008,.036,.05); // 鬢角
  add(wGeo.eye,ink,-.028,.3,.072,1.1,.8,1); add(wGeo.eye,ink,.028,.3,.072,1.1,.8,1);
  add(box,ink,-.028,.32,.071,.022,.004,.004,0,0,.12); add(box,ink,.028,.32,.071,.022,.004,.004,0,0,-.12); // 眉毛
  add(new THREE.SphereGeometry(.5,16,8,0,Math.PI*2,Math.PI/2,Math.PI/2),mouth,0,.272,.07,.03,.016,.01); // 微笑（不露牙）
  const sh=new THREE.Mesh(wGeo.shadow,new THREE.MeshBasicMaterial({color:'#2a1d14',transparent:true,opacity:.25,depthWrite:false})); sh.position.y=.004; jason.add(sh);
  jason.scale.setScalar(2.1); }
const jTagEl=document.createElement('button'); jTagEl.className='jtag'; jTagEl.type='button'; jTagEl.textContent='島主 Jason';
const jTag=new CSS2DObject(jTagEl); jTag.position.set(0,.46,0); jason.add(jTag);
const bubEl=document.createElement('div'); bubEl.className='jbub'; const bub=new CSS2DObject(bubEl); bub.position.set(0,.63,0); bub.visible=false; jason.add(bub);
function say(t){ bubEl.textContent=t; bub.visible=true; dirty=true; clearTimeout(say.t); say.t=setTimeout(()=>{ bub.visible=false; dirty=true; },10000); }
const stationNode = (islId)=> islById[islId] ? islById[islId].i*12+4 : 0; // 島的南側（鏡頭這一側），避開路燈
const J={ path:null, cum:null, len:0, s:0, speed:1, arrive:null }; let jNode=null;
function jasonGo(target,onArrive){
  if(jNode===null||reduced||target===jNode){ jNode=target; jason.position.copy(nodes[target].p); jason.rotation.y=0; onArrive&&onArrive(); dirty=true; return; }
  const pts=dijkstra(jNode,target).map(n=>nodes[n].p.clone()); if(pts.length<2){ onArrive&&onArrive(); return; }
  const cum=[0]; for(let i=1;i<pts.length;i++) cum.push(cum[i-1]+pts[i].distanceTo(pts[i-1]));
  Object.assign(J,{ path:pts, cum, len:cum[cum.length-1], s:0, arrive:onArrive }); J.speed=Math.max(1.1,J.len/3.5); jNode=target; }
function stepJason(dt){ if(!J.path) return false;
  J.s=Math.min(J.len,J.s+J.speed*dt); samplePath({pts:J.path,cum:J.cum,len:J.len},J.s,jason.position,_dir); jason.rotation.y=Math.atan2(_dir.x,_dir.z);
  const sw=Math.sin(performance.now()/1000*11); const U=jason.userData;
  U.legs[0].rotation.x=sw*.55; U.legs[1].rotation.x=-sw*.55; U.arms[0].rotation.x=-sw*.45; U.arms[1].rotation.x=sw*.45;
  if(J.s>=J.len){ const cb=J.arrive; J.path=null; J.arrive=null; [...U.legs,...U.arms].forEach(o=>o.rotation.x=0); jason.rotation.y=0; cb&&cb(); }
  return true; }
if(ROUTES.length){ jNode=stationNode(ROUTES[0].stations[0].island); jason.position.copy(nodes[jNode].p); scene.add(jason); }

// 路線在地圖上：一條串起各站的虛線步道，加上站號旗子
const routeVis = ROUTES.map((R0)=>{
  const st=R0.stations.map(x=>stationNode(x.island)); let ids=[st[0]];
  for(let k=1;k<st.length;k++) ids=ids.concat(dijkstra(st[k-1],st[k]).slice(1));
  const pts=ids.map(n=>nodes[n].p.clone().setY(nodes[n].p.y+.06));
  const cp=new THREE.CurvePath(); for(let i=1;i<pts.length;i++) cp.add(new THREE.LineCurve3(pts[i-1],pts[i]));
  let len=0; for(let i=1;i<pts.length;i++) len+=pts[i].distanceTo(pts[i-1]);
  const mat=new THREE.ShaderMaterial({ transparent:true, depthWrite:false,
    uniforms:{ uTime:{value:0}, uLen:{value:len}, uColor:{value:new THREE.Color('#1a8c82')} },
    vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`uniform float uTime; uniform float uLen; uniform vec3 uColor; varying vec2 vUv;
void main(){ float u=vUv.x*uLen*3.0-uTime*1.6; if(fract(u)>.62) discard; gl_FragColor=vec4(uColor,.95);
  #include <colorspace_fragment>
}` });
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(cp,Math.max(32,pts.length*6),.075,6,false),mat); mesh.renderOrder=3; mesh.visible=false; scene.add(mesh);
  const flags=R0.stations.map((x,k)=>{ const el=document.createElement('button'); el.type='button'; el.className='rflag'; el.innerHTML=`<b>${k+1}</b>${esc(x.name)}`;
    el.onclick=e=>{ e.stopPropagation(); if(!route) route={r:ROUTES.indexOf(R0),k:0}; rtEl.hidden=false; goStation(k); };
    const o=new CSS2DObject(el); const p=nodes[st[k]].p; o.position.set(p.x,p.y+1.25,p.z); o.visible=false; scene.add(o); return {o,el}; });
  return { mesh, flags }; });
function showRouteVis(r,k){ routeVis.forEach((v,i)=>{ const on=i===r; v.mesh.visible=on; v.flags.forEach((f,j)=>{ f.o.visible=on; f.el.classList.toggle('on',on&&j===k); f.el.classList.toggle('done',on&&j<k); }); }); dirty=true; }
let route=null; const rtEl=$('#route');
function cardStation(r,k){ const R0=ROUTES[r], st=R0.stations[k];
  const arts=st.articles.map(a=>`<li><a class="st-art" href="${a.url}" data-read="${a.id}"><span class="n">第 ${a.tier} 步</span><span>${esc(a.title)}</span></a></li>`).join('');
  const check= st.id==='check' ? `<a class="choice" href="${DATA.links.prescan}"><small>有健檢報告</small><b>填寫掃描前資料表 →</b><span>帶上血液報告和穿戴裝置數據，整理出 90 天生活調整的優先順序。</span></a><a class="choice" href="${DATA.links.assessment}"><small>還沒有數據</small><b>身體警報訊號評估清單 →</b><span>約 1 分鐘，先看看身體哪些訊號正在亮燈。</span></a>` : '';
  return `<div class="eyebrow">${esc(R0.name)}路線 · 第 ${k+1} / ${R0.stations.length} 站</div><h2>${esc(st.name)}</h2>
  ${st.hook?`<p class="st-hook">「${esc(st.hook)}」</p>`:''}${st.intro?`<p>${esc(st.intro)}</p>`:''}${check}
  ${arts?`<div class="sec">這一站的文章 · ${st.articles.length}</div><ul class="ilist">${arts}</ul>`:''}
  ${st.upcoming&&st.upcoming.length?`<div class="sec">即將加入</div><ul class="st-up">${st.upcoming.map(u=>`<li>${esc(u)}</li>`).join('')}</ul>`:''}
  ${st.doctorNote?`<p class="st-doc">${esc(st.doctorNote)}</p>`:''}
  <a class="link" href="/men/${st.id!=='check'?'#'+st.id:''}">${st.id!=='check'?`看「男性慢老」專區的${esc(st.name)} →`:'看完整「男性慢老」專區 →'}</a>`; }
function routeUI(){ const R0=ROUTES[route.r], n=R0.stations.length, st=R0.stations[route.k];
  $('#rtName').textContent=R0.name+'路線'; $('#rtProg').textContent=`${route.k+1} / ${n}`; $('#rtStation').textContent=`第 ${route.k+1} 站・${st.name}`;
  $('#rtDots').innerHTML=R0.stations.map((_,i)=>`<i class="${i<route.k?'done':i===route.k?'on':''}"></i>`).join('');
  $('#rtPrev').disabled=route.k===0; $('#rtNext').textContent=route.k===n-1?'完成 ✓':'下一站 →'; }
function goStation(k){ const R0=ROUTES[route.r]; const st=R0.stations[k]; const s=islById[st.island]; if(!s) return;
  route.k=k; routeUI(); bub.visible=false; showRouteVis(route.r,k);
  sel={type:'island',i:s.i}; openCard(cardStation(route.r,k)); afterSelect();
  if(mqMobile.matches) $('#card').style.height='46vh';
  flyTo(new THREE.Vector3(s.x,TOP,s.z),OFF_ISL);
  jasonGo(stationNode(st.island),()=>say(st.jason));
  track('route_station',{route:R0.id,station:st.id,step:k+1}); }
function startRoute(r=0){ if(!ROUTES[r]) return; route={r,k:0}; rtEl.hidden=false; $('#help').hidden=true; lsSet('agelocked-island-help','1'); track('route_start',{route:ROUTES[r].id}); goStation(0); }
function endRoute(done){ if(!route) return; if(done) track('route_complete',{route:ROUTES[route.r].id}); route=null; rtEl.hidden=true; showRouteVis(-1,0); dirty=true; }
$('#rtPrev').onclick=()=>{ if(route&&route.k>0) goStation(route.k-1); };
$('#rtNext').onclick=()=>{ if(!route) return; const n=ROUTES[route.r].stations.length; if(route.k<n-1) goStation(route.k+1); else { endRoute(true); say('走完了！想知道自己的狀況，從健檢站開始最快。'); } };
$('#rtExit').onclick=()=>endRoute(false);
$('#tRoute').onclick=()=> route ? goStation(route.k) : startRoute(0);
$('#helpRoute').onclick=()=>startRoute(0);
jTagEl.onclick=e=>{ e.stopPropagation(); if(route) say(ROUTES[route.r].stations[route.k].jason); else startRoute(0); };

/* ---------- sidebar list ---------- */
let tab='t';
function renderList(){ const q=$('#search').value.trim().toLowerCase(); const L=$('#list'); const si=islOfSel();
  if(tab==='t'){ let html='';
    ISL.forEach(s=>{ const its=s.items.filter(it=>!q||(it.name+it.desc+s.name).toLowerCase().includes(q)); if(q&&!its.length) return;
      html+=`<details ${q||si===s.i?'open':''}><summary data-isl="${s.i}"><span class="dot" style="background:${s.color}"></span><span class="k">${String(s.i+1).padStart(2,'0')}</span>${esc(s.name)}<span class="c">${s.items.length}</span></summary>
      <div class="sub">${its.map(it=>`<a href="${it.url||'#'}" data-item="${it.id}">${CIRC[it.k]} ${esc(it.name)}</a>`).join('')}</div></details>`; });
    L.innerHTML=html||'<div class="empty">找不到符合的主題或細項，換個關鍵字試試，例如「睡眠」。</div>'; }
  else if(tab==='h'){ const pct=k=>Math.round(dirStat[k]/totalLinks*100); const match=q?(id=>(itemById[id].name+itemById[id].desc).toLowerCase().includes(q)):(()=>true);
    const lst=(set)=>[...set].filter(match).map(id=>`<button data-item="${id}">${esc(itemById[id].name)} <small>${esc(ISL[itemById[id].island].name)}</small></button>`).join('');
    L.innerHTML=`<div class="audit">
      <div class="tiles"><div class="tile"><b>${articleItems.length}<small>篇</small></b><span>網站文章</span></div><div class="tile"><b>${totalLinks}<small>條</small></b><span>內文連結</span></div><div class="tile"><b>${orphans.size}<small>篇</small></b><span>孤兒文章</span></div><div class="tile"><b>${deadEnds.size}<small>篇</small></b><span>死路文章</span></div></div>
      <div class="sec">連結方向（依閱讀路徑）</div>
      <div class="dirbar"><i style="flex:${dirStat.down}" class="d"></i><i style="flex:${dirStat.same}" class="s"></i><i style="flex:${dirStat.up}" class="u"></i></div>
      <div class="dirleg"><span><i class="d"></i>帶往下一步 ${pct('down')}%</span><span><i class="s"></i>同一步 ${pct('same')}%</span><span><i class="u"></i>帶回前一步 ${pct('up')}%</span></div>
      <p class="note">閱讀路徑是察覺 → 原因 → 量測 → 調整。帶回前一步的連結不算錯，但每一條都值得確認讀者是不是被帶回了起點。</p>
      <div class="sec"><span class="sw o"></span>孤兒文章 · ${orphans.size}</div><p class="note">沒有任何文章在內文裡連到它們，讀者只能從列表或搜尋找到。</p><div class="sub">${lst(orphans)}</div>
      <div class="sec"><span class="sw dd"></span>死路文章 · ${deadEnds.size}</div><p class="note">內文沒有連出去，讀者讀完只剩版型的相關文章和 CTA。</p><div class="sub">${lst(deadEnds)}</div>
      <p class="note">資料來源：agelocked-blog 原始碼的內文連結，不含版型自動產生的「相關文章」區塊。打開下方「連結檢查」開關，可在島上標出這些文章。</p></div>`; }
  else { const fs=DATA.flows.map((f,fi)=>[f,fi]).filter(([f])=>!q||(f.label+islById[f.from].name+islById[f.to].name).toLowerCase().includes(q));
    L.innerHTML=fs.map(([f,fi])=>`<button class="frow" data-flow="${fi}"><b>${esc(islById[f.from].name)} → ${esc(islById[f.to].name)}</b><small><span class="ev"><i class="${f.evidence}"></i></span> ${esc(f.label)}${AUDIT?' · 多數'+EVL[f.evidence]:''}</small></button>`).join('')||'<div class="empty">找不到符合的流動。</div>'; }
  L.querySelectorAll('summary[data-isl]').forEach(b=>b.addEventListener('click',()=>selectIsland(+b.dataset.isl)));
  L.querySelectorAll('[data-item]').forEach(b=>b.onclick=e=>{ if(e.metaKey||e.ctrlKey||e.shiftKey||e.button===1) return; e.preventDefault(); selectItem(b.dataset.item); });
  L.querySelectorAll('[data-flow]').forEach(b=>b.onclick=()=>selectFlow(+b.dataset.flow)); }
$('#search').addEventListener('input',renderList);
function setTab(t){ tab=t; [['t','#tabT'],['f','#tabF'],['h','#tabH']].forEach(([k,sel])=>$(sel).setAttribute('aria-pressed',k===t)); renderList(); }
$('#tabT').onclick=()=>setTab('t'); $('#tabF').onclick=()=>setTab('f'); $('#tabH').onclick=()=>setTab('h');

/* ---------- HUD & tools ---------- */
function setSide(on){ $('#side').hidden=!on; $('#tList').setAttribute('aria-pressed',on); document.body.classList.toggle('side-off',!on); dirty=true; }
setSide(!isMobile);
$('#tList').onclick=()=>setSide($('#side').hidden);
$('#tPano').onclick=()=>{ closeCard(); panorama(); };
$('#cardClose').onclick=closeCard;
document.querySelectorAll('[data-time]').forEach(b=>b.onclick=()=>{ minute=+b.dataset.time; applyTime(true); });
document.querySelectorAll('[data-tog]').forEach(b=>b.onclick=()=>{ const k=b.dataset.tog; st[k]=!st[k]; b.setAttribute('aria-pressed',st[k]);
  if(k==='flows') updateFlows();
  if(k==='audit'){ applyHighlight(); showPins(islOfSel()); if(st.audit){ setSide(true); setTab('h'); } }
  if(k==='log') $('#log').hidden=!st.log;
  if(k==='bird'){ controls.minPolarAngle=st.bird?0:THREE.MathUtils.degToRad(25); const t=controls.target.clone(); startFly(st.bird?t.clone().add(new THREE.Vector3(.01,84,12)):t.clone().addScaledVector(new THREE.Vector3(.16,.8,.58).normalize(),panoDist()),t); }
  if(k==='carry'){ Object.values(WM).forEach(m=>m.visible=st.carry); }
  dirty=true; });
$('#hudToggle').onclick=()=>{ const o=document.body.classList.toggle('hud-open'); $('#hudToggle').setAttribute('aria-expanded',o); };
// sheets drag (mobile)
document.querySelectorAll('.handle').forEach(h=>{ const sheet=h.parentElement; let y0=null,h0=0;
  h.addEventListener('pointerdown',e=>{ y0=e.clientY; h0=sheet.getBoundingClientRect().height; h.setPointerCapture(e.pointerId); });
  h.addEventListener('pointermove',e=>{ if(y0===null) return; sheet.style.height=clamp(h0+(y0-e.clientY),110,innerHeight)+'px'; });
  h.addEventListener('pointerup',()=>{ y0=null; }); });
// help
function showHelp(){ $('#help').hidden=false; $('#helpOk').focus(); }
$('#tHelp').onclick=showHelp;
$('#tAbout').onclick=()=>openSpecial('about');
$('#hudCheck').onclick=()=>openSpecial('check'); $('#helpOk').onclick=()=>{ $('#help').hidden=true; lsSet('agelocked-island-help','1'); };
// log
const logSel=$('#logFilter'); DATA.flows.forEach((f,fi)=>{ const o=document.createElement('option'); o.value=fi; o.textContent=islById[f.from].name+' → '+islById[f.to].name; logSel.appendChild(o); });
const logs=[]; let logDirty=false;
function pushLog(type,w){ if(!w.log) return; const f=DATA.flows[w.fi]; const at=type==='depart'?(w.dir>0?f.from:f.to):(w.dir>0?f.to:f.from);
  logs.unshift({type,fi:w.fi,time:$('#clockT').textContent,text:`${ROLES[w.role].name}${type==='arrive'?'抵達':type==='handoff'?'在':'離開'}${islById[at].name}${type==='handoff'?'交接'+CARRY[w.carry]:''}`}); if(logs.length>60) logs.pop(); logDirty=true; }
function renderLog(){ const fv=logSel.value; const lab={arrive:'抵達',handoff:'交接',depart:'出發'};
  $('#logList').innerHTML=logs.filter(l=>fv===''||l.fi===+fv).slice(0,30).map(l=>`<li><time>${l.time}</time><span><span class="t-${l.type}">${lab[l.type]}</span> ${esc(l.text)}</span></li>`).join('')||'<li><time></time><span>等待小人到站…</span></li>'; logDirty=false; }
logSel.onchange=renderLog;

/* ---------- picking ---------- */
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2(); let down=null;
renderer.domElement.addEventListener('pointerdown',e=>{ down=[e.clientX,e.clientY]; fly=null; });
renderer.domElement.addEventListener('pointerup',e=>{ if(!down) return; const moved=Math.hypot(e.clientX-down[0],e.clientY-down[1]); down=null; if(moved>6) return;
  const r=renderer.domElement.getBoundingClientRect(); ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1); ray.setFromCamera(ndc,camera);
  WM.body.computeBoundingSphere(); WM.head.computeBoundingSphere();
  const targets=[...(st.carry?[WM.body,WM.head]:[]),...flowMeshes.filter(m=>m.visible),...kitMeshes.filter(m=>m.visible),...islandTops];
  const hits=ray.intersectObjects(targets,false);
  for(const h of hits){ const o=h.object;
    if(o===WM.body||o===WM.head){ if(h.instanceId<NW){ selectWalker(h.instanceId); return; } continue; }
    if(o.userData.flow!==undefined){ selectFlow(o.userData.flow); return; }
    if(o.isInstancedMesh){ const ow=o.userData.owners[h.instanceId]; if(!ow) continue; if(itemById[ow]){ selectItem(ow); return; } if(ow.startsWith('isl:')){ selectIsland(+ow.slice(4)); return; } continue; }
    if(o.userData.island!==undefined){ selectIsland(o.userData.island); return; } } });
addEventListener('keydown',e=>{ if(PAUSED) return; if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT') return;
  if(e.key==='Escape'){ if(!$('#help').hidden){ $('#help').hidden=true; lsSet('agelocked-island-help','1'); return; } closeCard(); return; }
  const off=camera.position.clone().sub(controls.target); const sph=new THREE.Spherical().setFromVector3(off);
  if(e.key==='ArrowLeft') sph.theta-=.12; else if(e.key==='ArrowRight') sph.theta+=.12;
  else if(e.key==='ArrowUp') sph.phi=clamp(sph.phi-.06,controls.minPolarAngle,controls.maxPolarAngle); else if(e.key==='ArrowDown') sph.phi=clamp(sph.phi+.06,controls.minPolarAngle,controls.maxPolarAngle); else return;
  e.preventDefault(); fly=null; camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph)); controls.update(); dirty=true; });

/* ---------- walkers update ---------- */
const _W=new THREE.Matrix4(), _M=new THREE.Matrix4(), _wq=new THREE.Quaternion(), _wp=new THREE.Vector3(), _ws=new THREE.Vector3(), _dir=new THREE.Vector3(), _perp=new THREE.Vector3();
let simT=0;
function samplePath(fp,s,out,dir){ s=clamp(s,0,fp.len); let i=1; while(i<fp.cum.length-1&&fp.cum[i]<s) i++; const a=fp.pts[i-1], b=fp.pts[i]; const seg=fp.cum[i]-fp.cum[i-1]||1; const t=(s-fp.cum[i-1])/seg;
  out.copy(a).lerp(b,t); dir.copy(b).sub(a).setY(0).normalize(); }
function stepWalkers(dt){ for(const w of walkers){ const fp=flowPaths[w.fi];
  if(w.pause>0){ w.pause-=dt; if(w.pause<=0){ pushLog('handoff',w); w.dir*=-1; pushLog('depart',w); } continue; }
  w.s+=w.dir*w.speed*dt; if(w.s>=fp.len||w.s<=0){ w.s=clamp(w.s,0,fp.len); w.pause=1.4; pushLog('arrive',w); } } }
function poseWalkers(scale){ walkers.forEach((w,i)=>{ const fp=flowPaths[w.fi]; samplePath(fp,w.s,w.pos,_dir); if(w.dir<0) _dir.negate();
  _perp.set(_dir.z,0,-_dir.x); w.pos.addScaledVector(_perp,-w.lat);
  const moving=w.pause<=0&&!reduced; const ph=simT*9*(w.speed/.36)+w.phase*20; const sw=moving?Math.sin(ph):0;
  const bob=moving?Math.abs(Math.sin(ph))*.012:0;
  _wq.setFromAxisAngle(UP,Math.atan2(_dir.x,_dir.z)); _wp.copy(w.pos).setY(w.pos.y+bob); _ws.setScalar(scale); _W.compose(_wp,_wq,_ws);
  const set=(mesh,idx,L)=>{ _M.multiplyMatrices(_W,L); mesh.setMatrixAt(idx,_M); };
  set(WM.shadow,i,LM(0,.004-bob,0,1,1,1)); set(WM.body,i,LM(0,.145,0,1,1,1)); set(WM.head,i,LM(0,.28,0,1,1,1)); set(WM.hair,i,LM(0,.285,-.008,1,1,1,-.25));
  const R0=ROLES[w.role]; const legA=R0.bike?.25:.55;
  set(WM.leg,i*2,LM(-.025,.095,0,1,1,1,sw*legA)); set(WM.leg,i*2+1,LM(.025,.095,0,1,1,1,-sw*legA));
  set(WM.arm,i*2,LM(-.058,.2,0,1,1,1,-sw*.45,0,.08)); set(WM.arm,i*2+1,LM(.058,.2,0,1,1,1,sw*.45,0,-.08));
  set(WM.eye,i*2,LM(-.025,.285,.064,1,1,1)); set(WM.eye,i*2+1,LM(.025,.285,.064,1,1,1));
  for(const [pool,idx,L] of w.acc) set(WM[pool],idx,L);
  const sp=sprites[i]; sp.position.set(w.pos.x,w.pos.y+.47*scale+bob,w.pos.z); sp.scale.set(.17*scale,.17*scale,1);
  tags[i].position.set(w.pos.x,w.pos.y+.62*scale,w.pos.z); });
  Object.values(WM).forEach(m=>m.instanceMatrix.needsUpdate=true); }

/* ---------- label collision ---------- */
const uiEls=['#brand','#tools','#card','#side','#hud','#log','#legend','#route'].map(s=>$(s));
const hit=(a,b)=>a.l<b.r&&a.r>b.l&&a.t<b.b&&a.b>b.t;
function placeLabels(){ const ui=uiEls.filter(e=>!e.hidden&&e.offsetParent!==null).map(e=>{ const r=e.getBoundingClientRect(); return {l:r.left,r:r.right,t:r.top,b:r.bottom}; });
  const si=islOfSel(); const list=islLabels.map((l,i)=>({l,i,r:l.el.getBoundingClientRect()})).filter(x=>x.l.o.visible&&x.r.width>0);
  list.sort((a,b)=>(b.i===si)-(a.i===si)||b.r.top-a.r.top); const placed=[];
  for(const x of list){ const {l,r}=x; if(l.state==='full') l.fullW=r.width; const cx=r.left+r.width/2, cy=r.top+r.height/2, hh=r.height/2||14;
    const rect=(w,p)=>({l:cx-w/2-p,r:cx+w/2+p,t:cy-hh-p,b:cy+hh+p}); const free=q=>!ui.some(u=>hit(q,u))&&!placed.some(p=>hit(q,p));
    const fw=l.fullW||r.width, cw=34; let ns;
    if(free(rect(fw,l.state==='full'?0:8))) ns='full'; else if(free(rect(cw,l.state==='hide'?8:0))) ns='compact'; else ns='hide';
    if(x.i===si&&ns==='hide') ns='compact';
    if(ns!==l.state){ l.state=ns; l.el.classList.toggle('compact',ns==='compact'); l.el.classList.toggle('hide',ns==='hide'); }
    if(ns!=='hide') placed.push(rect(ns==='full'?fw:cw,2)); } }

/* ---------- resize ---------- */
function resize(){ const w=stage.clientWidth, h=stage.clientHeight; if(!w||!h) return; renderer.setSize(w,h); labelRenderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix(); dirty=true; }
new ResizeObserver(resize).observe(stage); resize();
window.__islandWake=()=>{ resize(); dirty=true; };
mqReduce.addEventListener('change',e=>{ reduced=e.matches; flowMeshes.forEach((m,i)=>{ m.material.uniforms.uStyle.value=reduced?1:({official:0,thematic:1,pending:2})[DATA.flows[i].evidence]; m.material.uniforms.uTime.value=0; }); dirty=true; });
if(reduced) flowMeshes.forEach(m=>m.material.uniforms.uStyle.value=1);

/* ---------- start ---------- */
applyTime(true); renderList();
{ const dir=new THREE.Vector3(.16,.8,.58).normalize(); const t0=panoTarget(); controls.target.copy(t0); camera.position.copy(t0).addScaledVector(dir,panoDist()); controls.update(); }
poseWalkers(1); renderer.render(scene,camera);
loader.classList.add('gone'); setTimeout(()=>loader.hidden=true,600);
if(!lsGet('agelocked-island-help')) showHelp();
if(AUDIT){ setSide(true); setTab('h'); }

let last=performance.now(), logT=0;
function frame(now){ requestAnimationFrame(frame); const dt=Math.min((now-last)/1000,.08); last=now; if(PAUSED) return;
  if(fly){ const t=clamp((now-fly.t0)/800,0,1); const k=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2; camera.position.lerpVectors(fly.p0,fly.p1,k); controls.target.lerpVectors(fly.t0v,fly.t1,k); if(t>=1) fly=null; dirty=true; }
  if(controls.update()) dirty=true;
  if(stepJason(dt)) dirty=true;
  if(route&&!reduced){ routeVis[route.r].mesh.material.uniforms.uTime.value=now/1000; dirty=true; }
  const running=!st.pause&&!reduced;
  if(running){ simT+=dt; minute=(minute+dt*10)%1440; applyTime(false); stepWalkers(dt);
    waterMat.uniforms.uTime.value+=dt; flowMeshes.forEach(m=>{ if(m.visible) m.material.uniforms.uTime.value=simT; });
    clouds.forEach(c=>{ c.position.x+=c.userData.v*dt; if(c.position.x>center.x+75) c.position.x=center.x-75; });
    boats.forEach(b=>{ const u=b.userData; u.a+=u.v*dt; b.position.set(center.x+Math.cos(u.a)*u.r,WATER_Y+.02+Math.sin(simT*1.3+u.r)*.03,center.z+Math.sin(u.a)*u.rz); b.rotation.y=Math.atan2(-Math.sin(u.a)*u.r,Math.cos(u.a)*u.rz); });
    dirty=true; }
  if(!dirty) return; dirty=false;
  const d=camera.position.distanceTo(controls.target);
  const lod=d<26; smallMeshes.forEach(m=>m.visible=lod);
  const sc=clamp(d/20,1,1.45); if(st.carry) poseWalkers(sc);
  sprites.forEach(s=>s.visible=st.carry&&d<16);
  tags.forEach((t,i)=>t.visible=st.tags&&st.carry&&walkers[i].pos.distanceTo(camera.position)<14);
  if(boats.length&&!running) boats.forEach(b=>{ const u=b.userData; b.position.set(center.x+Math.cos(u.a)*u.r,WATER_Y+.02,center.z+Math.sin(u.a)*u.rz); });
  renderer.render(scene,camera); labelRenderer.render(scene,camera); placeLabels();
  logT+=dt; if(st.log&&logDirty&&logT>.3){ renderLog(); logT=0; } }
requestAnimationFrame(frame);
}
