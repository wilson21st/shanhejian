// js/cities.js: cities, capitals, place pins. Part of index.html's map script (split into modules in v115; the import order is
// load-bearing, see the note at the top of js/geo.js).
import * as THREE from 'three';
import { addL, hAt, popBox } from './labels.js';
import { RM, scene } from './scene.js';
import { MH, MW, MX, MZ } from './geo.js';
import { dist, fly } from './camera.js';
import { PL } from './timeline.js';

export const CITY_TOP={},CITY_G=[];
/* ---------- cities: walled 城 like the game's map — moat, grey walls, corner and gate towers, a hall inside ---------- */
scene.add(new THREE.AmbientLight(0xffffff,1.15));{const dl=new THREE.DirectionalLight(0xfff6e6,.55);dl.position.set(-300,620,420);scene.add(dl);}
const CM={skirt:new THREE.MeshLambertMaterial({color:0x7f8c54,flatShading:true}),wall:new THREE.MeshLambertMaterial({color:0xe8e2d2,flatShading:true}),base:new THREE.MeshLambertMaterial({color:0xb7a684,flatShading:true}),roof:new THREE.MeshLambertMaterial({color:0x5b6670,flatShading:true}),
  red:new THREE.MeshLambertMaterial({color:0x9a3424,flatShading:true}),moat:new THREE.MeshLambertMaterial({color:0x8fb0ae}),street:new THREE.MeshLambertMaterial({color:0xe6dfcc}),house:new THREE.MeshLambertMaterial({color:0xcfc4a8,flatShading:true})};
function roofOn(g,x,y,z,w,d,h){const r=new THREE.Mesh(new THREE.ConeGeometry(.75,1,4),CM.roof);r.rotation.y=Math.PI/4;r.scale.set(w,h,d);r.position.set(x,y+h/2,z);g.add(r);
  const eave=new THREE.Mesh(new THREE.BoxGeometry(w*1.12,.25,d*1.12),CM.roof);eave.position.set(x,y+.1,z);g.add(eave);}
function box(g,m,x,y,z,w,h,d){const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y+h/2,z);g.add(b);return b}
function buildCity(lo,la,W,cap,lite){const g=new THREE.Group();const cx=MX(lo),cz=MZ(la);let top=0;
  {const hs=[];for(let dx=-W/2;dx<=W/2;dx+=2)for(let dz=-W/2;dz<=W/2;dz+=2)hs.push(hAt(72+(cx+dx+MW/2)/20,52-(cz+dz+MH/2)/24));hs.sort((a,b)=>a-b);top=hs[Math.floor(hs.length*.6)]}
  top+=.4;const H=cap?3.6:3,T=cap?1.6:1.2,hw=W/2;
  box(g,CM.skirt,0,top-30,0,W+7,30,W+7);
  box(g,CM.moat,0,top-.05,0,W+5,.1,W+5);box(g,CM.base,0,top,0,W+2.4,.12,W+2.4);
  for(const [x,z,w,d] of [[0,-hw,W,T],[0,hw,W,T],[-hw,0,T,W],[hw,0,T,W]])box(g,CM.wall,x,top,z,w,H,d);
  for(const sx of [-1,1])for(const sz of [-1,1]){box(g,CM.wall,sx*hw,top,sz*hw,T*2,H+1.4,T*2);roofOn(g,sx*hw,top+H+1.4,sz*hw,T*2.4,T*2.4,1.4)}
  for(const [x,z,r] of [[0,-hw,0],[0,hw,0],[-hw,0,1],[hw,0,1]]){const w=r?T*1.6:W*.18,d=r?W*.18:T*1.6;box(g,CM.wall,x,top,z,w,H+2,d);box(g,CM.red,x,top+H+2,z,w*.8,1.2,d*.8);roofOn(g,x,top+H+3.2,z,w*1.05,d*1.05,1.6)}
  if(cap){for(let k=-2;k<=2;k++){box(g,CM.street,k*W/6,top+.13,0,.7,.02,W-2);box(g,CM.street,0,top+.13,k*W/6,W-2,.02,.7)}}
  let s=Math.floor(lo*97+la*13);const r=()=>{s=(s*16807)%2147483647;return s/2147483647};
  const n=cap?46:lite?4:16;for(let k=0;k<n;k++){const x=(r()-.5)*(W-4),z=(r()-.5)*(W-4);if(Math.abs(x)<W*.16&&Math.abs(z)<W*.14)continue;const w=1+r()*1.3,d=.9+r();box(g,CM.house,x,top+.12,z,w,.9,d);roofOn(g,x,top+1.02,z,w,d,.7)}
  box(g,CM.wall,0,top+.12,-W*.05,W*.32,.6,W*.22);box(g,CM.red,0,top+.72,-W*.05,W*.26,1.8,W*.14);roofOn(g,0,top+2.5,-W*.05,W*.32,W*.2,2.2);
  g.position.set(cx,0,cz);scene.add(g);CITY_G.push(g);return top}

for(const [n,lo,la,W,cap] of [['长安',108.94,34.26,22,1],['洛阳',112.45,34.62,15,0],['幽州',116.4,39.9,11,0],['灵州',106.3,38.1,9,0],['敦煌',94.66,40.14,9,0],['扬州',119.4,32.4,12,0],['成都',104.06,30.67,12,0],['太原',112.55,37.87,11,0]])CITY_TOP[n]=buildCity(lo,la,W,cap);
export const RLBL=RM.pieces.filter(p=>p.label).map(p=>{const L=addL('region',p.label[1],p.label[2],p.label[0],null,30);L.piece=p;L.off=true;if(p.overlay||p.status!=='core')L.e.classList.add('sm');return L});
addL('region',137.5,37.6,'倭',null,30);
// 长安 is the capital: its own label, seal-red, visible at every zoom (it used to share the old 玄武门 marker)
export const CAPL=addL('city cap',108.94,34.26,'长<br>安',null,(CITY_TOP['长安']||0)-hAt(108.94,34.26)+14);CAPL.e.dataset.seal='京';
export const BIGL=[['洛阳',112.45,34.62],['幽州',116.4,39.9],['灵州',106.3,38.1],['敦煌',94.66,40.14],['扬州',119.4,32.4],['成都',104.06,30.67],['太原',112.55,37.87]].map(([n,lo,la])=>Object.assign(addL('city',lo,la,n,null,(CITY_TOP[n]||0)-hAt(lo,la)+12),{ll:[lo,la]}));
/* 都城 (Wilson 2026-11-05: "首都有冇改过？唔一定全部长安"). 581–763 the court sat in more than one place; the seal-red
   竖匾 now follows it, and the other capitals carry their title of the day. Dates per 隋书·高祖纪/炀帝纪, 旧唐书·高宗纪/
   则天皇后纪/中宗纪/玄宗纪/肃宗纪, 资治通鉴:
   (lunar months as recorded:) 581.02 隋受禅，都汉长安故城 · 583.03 迁大兴城 · 606.01 东京洛阳成（609 改称东都）· 616.07–618.03 炀帝居江都 ·
   618.05 唐都长安（大兴改称长安）· 657.12 以洛阳为东都 · 684.09 东都改神都，武后临朝居神都，690 称帝都神都 ·
   705.02 复唐，神都复为东都，706.10 中宗还长安 · 723 太原置北都 · 742 京师曰西京，东都曰东京，北都曰北京 ·
   756.01 安禄山洛阳称帝（燕）· 756.06 潼关失守，玄宗出奔，长安陷 · 756.07 肃宗灵武即位 · 757.02 驻凤翔 ·
   757.09 收复长安，757.10 收复洛阳 · 759.09 史思明陷洛阳 · 762.10 收复洛阳。 */
// boundaries are in the Western calendar, like every event date here (lunar dates converted, e.g. 玄宗出奔 六月十三 = 756-07-14)
const CAPS=[ // [from, to, seat label, seat ll, seal]
 ['0581-03','0583-04','长安',[108.94,34.26],'京'],['0583-04','0618-06-18','大兴',[108.94,34.26],'京'],
 ['0618-06-18','0684-10','长安',[108.94,34.26],'京'],['0684-10','0705-03','神都',[112.45,34.62],'京'],
 ['0705-03','0706-11','洛阳',[112.45,34.62],'驻'],['0706-11','0756-07-14','长安',[108.94,34.26],'京'],
 ['0756-07-14','0756-08-12','长安',[108.94,34.26],'陷'],['0756-08-12','0757-03','灵武',[106.3,38.1],'行'],
 ['0757-03','0757-11-13','凤翔',[107.39,34.52],'行'],['0757-11-13','0800','长安',[108.94,34.26],'京']];
// what the other big cities are called (or are) at a date; null = plain name
const CITYTAG={
 '长安':[['0684-10','0705-03','西京'],['0705-03','0706-11','京师'],['0756-07-14','0757-11-13','陷燕']],
 '洛阳':[['0606-02','0609-02','东京'],['0609-02','0618-06-18','东都'],['0658-01','0684-10','东都'],['0706-11','0742-03','东都'],['0742-03','0756-02','东京'],
        ['0756-02','0757-12','燕都'],['0757-12','0759-10','东京'],['0759-10','0762-11','史思明据'],['0762-11','0800','东京']],
 '太原':[['0723-02','0742-03','北都'],['0742-03','0800','北京']],
 '扬州':[['0616-08','0618-04','炀帝行在']],
 '成都':[['0756-08','0758-01','玄宗驻跸'],['0758-01','0800','南京']],
 '灵州':[['0756-08-12','0757-03','肃宗即位']]};
const inR=(d,f,t)=>d>=f&&d<t;
export let CAPKEY='108.94,34.26';export const CAPEXTRA=addL('city',108.94,34.26,'长安',null,(CITY_TOP['长安']||0)-hAt(108.94,34.26)+12);CAPEXTRA.ll=[108.94,34.26];CAPEXTRA.off=true;
export function placeAt(id,d){const nm=(PL[id]||{}).name||'';if(id==='changan'&&d>='0583-04'&&d<'0618-06-18')return '大兴';if(id==='luoyang'&&d>='0684-10'&&d<'0705-03')return '神都';return nm}
/* (2026-11-05 night, Wilson: "天都嘅时候…佢从边度移去边度") — when the seat moves, overlayFrame draws the move: a dashed
   arc from the old seat to the new one with a small seal travelling along it and a caption (迁都 / 行在 / 还都). */
export let CAPPREV=null,CAPMOVE=null;export const capMoveEl=Object.assign(document.createElement('div'),{id:'capMove',className:'glass',hidden:true});document.body.appendChild(capMoveEl);
/* (2026-11-06, Wilson: "无啦啦有一条虚线，冇发生改变都有") — a move is drawn only when the timeline steps forward by one
   step into a new seat (anim=true from showEvent). Scrubbing, jumping back, the person view hopping between years and
   the start-up call update the seat silently: those are not 迁都, they are the viewer moving through time. */
export function capitalUpdate(d,anim){d=String(d);const c=CAPS.find(c=>inR(d,c[0],c[1]))||CAPS[CAPS.length-1];
  if(!anim)CAPMOVE=null;else if(CAPPREV&&(CAPPREV[3][0]!==c[3][0]||CAPPREV[3][1]!==c[3][1]))CAPMOVE={a:CAPPREV[3],b:c[3],t0:performance.now(),
    seal:c[4]==='陷'?'京':c[4],txt:(c[4]==='行'?'行在':c[4]==='京'&&(c[2]==='长安'||CAPPREV[4]!=='京')?'还都':'迁都')+' · '+CAPPREV[2]+' → '+c[2]};
  CAPPREV=c;
  const [lo,la]=c[3],nm=c[2],top=(CITY_TOP[nm==='大兴'||nm==='长安'?'长安':nm==='神都'||nm==='洛阳'?'洛阳':'']||hAt(lo,la)+2)-hAt(lo,la)+14;
  CAPL.p.set(MX(lo),hAt(lo,la)+top,MZ(la));CAPL.key=CAPKEY=[lo,la].join();if(CAPL.html!==nm){CAPL.html=nm;CAPL.e.innerHTML=[...nm].join('<br>');popBox(CAPL)} // sized at once: a card that must rise over it does so from its first frame
  CAPL.e.dataset.seal=c[4];CAPL.e.classList.toggle('fallen',c[4]==='陷');
  // 长安 gets an ordinary city label whenever the seal-red one has moved away from it
  CAPEXTRA.off=lo===108.94;const ct=(CITYTAG['长安'].find(t=>inR(d,t[0],t[1]))||[])[2];CAPEXTRA.e.textContent=ct?'长安 · '+ct:'长安';
  for(const L of BIGL){const n=L.base||(L.base=L.e.textContent),t=(CITYTAG[n]||[]).find(t=>inR(d,t[0],t[1]));const txt=t?n+' · '+t[2]:n;
    L.off=Math.hypot(L.ll[0]-lo,L.ll[1]-la)<.05; // the seat itself is shown by the 竖匾
    if(L.e.textContent!==txt){L.e.textContent=txt;L.box=null}}}
/* 隋唐州府 (Wilson 2026-11-04: 城市太少): the seats of the 十道 and the 都护府 as listed in 《旧唐书·地理志》/《新唐书·地理志》,
   plus the capitals of the neighbours that events happen in. [name or [[fromYear,toYear,name],…], lon, lat, tier, from, to].
   Coordinates are the modern sites (approximate); a town only shows in the years it existed under that name.
   Tier 1 shows at mid zoom like the big cities, tier 2 only close up; both give way to every other label. */
const TOWNS=[
 [[[581,589,'建康'],[589,900,'江宁']],118.79,32.05,1],['凉州',102.64,37.93,1],[[[581,640,'高昌城'],[640,900,'西州']],89.53,42.85,1],['安西',82.96,41.72,1,658],
 ['北庭',89.18,44.0,1,702],['庭州',89.18,44.0,2,640,702],['于阗',79.93,37.11,2],['疏勒',75.99,39.47,2],['碎叶',75.2,42.8,2,679,719],
 ['夏州',108.85,37.99,2],['云州',113.3,40.08,2],['营州',120.45,41.57,1],[[[581,668,'平壤'],[668,676,'安东都护府']],125.75,39.02,1,581,676],
 ['金城（新罗）',129.22,35.84,1],['泗沘（百济）',126.91,36.28,2,581,660],['汴州',114.35,34.79,1],['宋州',115.65,34.41,2],['魏州',115.27,36.28,2],
 ['徐州',117.18,34.26,2],['越州',120.58,30.0,2],['杭州',120.15,30.27,2],['苏州',120.62,31.3,2],['洪州',115.89,28.68,1],['江陵',112.2,30.35,1],
 ['襄州',112.14,32.04,1],['鄂州',114.3,30.55,2],['潭州',112.98,28.2,1],['广州',113.26,23.13,1],['桂州',110.29,25.27,2],
 [[[581,679,'交州'],[679,900,'安南']],105.85,21.03,1],['福州',119.3,26.08,2],['泉州',118.59,24.91,2],['秦州',105.72,34.58,2],['兰州',103.83,36.06,2],
 ['鄯州',102.4,36.48,2],['延州',109.49,36.6,2],['蒲州',110.32,34.84,2],['陕州',111.2,34.77,2],['潼关',110.25,34.55,2],['梓州',105.09,31.1,2],
 ['黔州',108.77,29.53,2],['代州',112.96,39.07,2],['逻些（吐蕃）',91.13,29.65,1,633],['太和城（南诏）',100.2,25.63,2,739],['渤海上京',129.6,44.0,2,755],
 ['回纥牙帐',102.66,47.43,2,744]];
const TOWNL=TOWNS.map(([nm,lo,la,tier,f=0,t=9999])=>{const top=buildCity(lo,la,tier===1?9:7,0,true),g=CITY_G[CITY_G.length-1];const L=addL(tier===1?'city':'city town',lo,la,'',null,top-hAt(lo,la)+9);L.town={nm,f,t,on:false,cur:''};L.g=g;L.ll=[lo,la];return L});
// every city but 长安 (CITY_G[0]) is drawn only when zoomed in past CITY_D — model and label together (Wilson: 平时唔使画，zoom 入去先出现)
// Wilson (16:52): a city is drawn only when its name is tapped — the walls rise out of the ground and the camera comes
// in; tapping another city lets the first one sink back. Names appear when zoomed in past CITY_D; 长安 is always drawn.
export const CITY_D=440,CITYV=CITY_G.slice(1).map((g,i)=>{const L=TOWNL.find(L=>L.g===g)||BIGL[i];return {g,L,town:!!L.town,open:false,t0:0}});
for(const c of CITYV){c.g.visible=false;c.L.e.classList.add('tap');c.L.e.onclick=e=>{e.stopPropagation();toggleCity(c)}}
export function toggleCity(c,force){const now=performance.now(),open=force!==undefined?force:!c.open;
  for(const o of CITYV)if(o!==c&&o.open){o.open=false;o.t0=now}
  c.open=open;c.t0=now;c.L.e.classList.toggle('on',open);if(open)fly(MX(c.L.ll[0]),MZ(c.L.ll[1]),Math.min(dist,260),null)}
export function updateTowns(d){const y=+d.slice(0,4);for(const L of TOWNL){const T=L.town;T.on=y>=T.f&&y<T.t;
  const n=Array.isArray(T.nm)?((T.nm.find(([a,b])=>y>=a&&y<b)||[])[2]||''):T.nm;if(!n)T.on=false;if(n!==T.cur){T.cur=n;L.e.textContent=n}}}
// setters: imported bindings are read-only, so the other modules write these through here
export function setCAPMOVE(v){return CAPMOVE=v}
