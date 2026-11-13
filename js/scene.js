// js/scene.js: renderer, scene, camera, realms.json and the border canvases. Part of index.html's map script (split into modules in v115; the import order is
// load-bearing, see the note at the top of js/geo.js).
import * as THREE from 'three';
import { GH, GW, H2, MH, MW, clamp, toG } from './geo.js';
/* ---------- renderer ---------- */
THREE.ColorManagement.enabled=false; // every colour here is authored as a display value; keep lit materials (cities) in the same space
export const R=new THREE.WebGLRenderer({antialias:false}); // the screen only ever shows the post pass's full-screen quad, so MSAA there bought nothing
R.outputColorSpace=THREE.LinearSRGBColorSpace;R.setPixelRatio(Math.min(2,devicePixelRatio));R.setSize(innerWidth,innerHeight);document.body.prepend(R.domElement);
export const scene=new THREE.Scene();export const cam=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,1,6000);
export const EX=125; // vertical exaggeration
export const geo=new THREE.PlaneGeometry(MW,MH,GW-1,GH-1);geo.rotateX(-Math.PI/2);
// the map's rim sinks to the water and fades into silk, so the overview has no hard rectangular cliff
const rim=k=>{const i=k%GW,j=(k/GW)|0,e=Math.min(i,GW-1-i,j,GH-1-j)/26;return e>=1?1:e*e*(3-2*e)};
const pos=geo.attributes.position;for(let k=0;k<pos.count;k++){pos.setY(k,H2[k]>0?H2[k]*EX*rim(k):-4)}geo.computeVertexNormals();
// 青绿 colour follows each hill, not absolute height: local prominence = height above the blurred surroundings
// measured against the surrounding LAND only (normalised convolution: blur(height·land)/blur(land)), so the sea's zero
// does not make every island and coastal hill read as one towering crown of dark 石青 (Taiwan did)
const PR=(()=>{const blur=a=>{const b=new Float32Array(a.length),R=9;
  for(let pass=0;pass<2;pass++){for(let j=0;j<GH;j++){let s=0;for(let i=-R;i<=R;i++)s+=a[j*GW+clamp(i,0,GW-1)];for(let i=0;i<GW;i++){b[j*GW+i]=s/(2*R+1);s+=a[j*GW+clamp(i+R+1,0,GW-1)]-a[j*GW+clamp(i-R,0,GW-1)]}}
    for(let i=0;i<GW;i++){let s=0;for(let j=-R;j<=R;j++)s+=b[clamp(j,0,GH-1)*GW+i];for(let j=0;j<GH;j++){a[j*GW+i]=s/(2*R+1);s+=b[clamp(j+R+1,0,GH-1)*GW+i]-b[clamp(j-R,0,GH-1)*GW+i]}}}return a};
  const a=blur(Float32Array.from(H2,v=>Math.max(0,v))),m=blur(Float32Array.from(H2,v=>v>0?1:0));
  return Float32Array.from(H2,(v,k)=>clamp((Math.max(0,v)-a[k]/Math.max(m[k],1e-3))*9,-1,1))})();
geo.setAttribute('pr',new THREE.BufferAttribute(PR,1));
export const RIM=Float32Array.from({length:pos.count},(_,k)=>rim(k));geo.setAttribute('rim',new THREE.BufferAttribute(RIM,1));
const hAttr=new Float32Array(pos.count);for(let k=0;k<pos.count;k++)hAttr[k]=H2[k];geo.setAttribute('h',new THREE.BufferAttribute(hAttr,1));

// 疆域 by date (data/realms.json): soft painted territories that follow the timeline. Frontier edges blur by how uncertain
// they are (fuzz), vassals and 羁縻 are hatched in the patron's colour, contested zones get two-colour stripes.
export const RM=await (await fetch('data/realms.json')).json();
export const dnum=d=>{const [y,m,dd]=d.split('-').map(Number);return y*1e4+(m||1)*100+(dd||1)};
export const BS=2,BW=GW*BS,BH=GH*BS,mkC=()=>{const c=document.createElement('canvas');c.width=BW;c.height=BH;return c};
export const bCan=[mkC(),mkC()],bTex=bCan.map(c=>new THREE.CanvasTexture(c)),OFF=5000;
const rgb=h=>[1,3,5].map(k=>parseInt(h.slice(k,k+2),16));
const pale=(h,k)=>{const a=rgb(h),P=[244,236,216];return `rgb(${a.map((v,i)=>Math.round(v+(P[i]-v)*k)).join()})`};
// shadow trick: draw the shape far off-canvas and let only its blurred shadow land (works on iOS Safari, unlike ctx.filter)
function shp(g,poly,mode,col,blur,lw){g.save();g.shadowColor=col;g.shadowBlur=blur;g.shadowOffsetX=OFF;g.beginPath();
  poly.forEach((p,i)=>{const [x,y]=toG(p);i?g.lineTo(x*BS-OFF,y*BS):g.moveTo(x*BS-OFF,y*BS)});g.closePath();
  if(mode==='fill'){g.fillStyle='#000';g.fill()}else{g.lineWidth=lw;g.lineJoin='round';g.strokeStyle='#000';g.stroke()}g.restore()}
function clipTo(g,poly){g.beginPath();poly.forEach((p,i)=>{const [x,y]=toG(p);i?g.lineTo(x*BS,y*BS):g.moveTo(x*BS,y*BS)});g.closePath();g.clip()}
// 浅水墨 borders: a pale glaze of the ruling colour (multiplied onto the terrain in the shader, so the landscape shows through).
// Vassals carry their own and their patron's glaze; contested land carries both sides at half strength; neighbouring glazes
// blur into each other, so frontiers are seamless. A thin dry-brush ink line marks only edges that are reasonably certain.
export function drawPiece(g,p){const R=RM.realms,col=R[p.realm].color,b=p.fuzz*BS*2.6;
  if(p.overlay){g.globalCompositeOperation='destination-out';shp(g,p.poly,'fill','#000',b*.6);g.globalCompositeOperation='source-over'}
  const washes=p.status==='contested'?p.of.map(r=>[R[r].color,.55]):p.status==='core'?[[col,1]]:[[col,.6],[R[p.of||p.realm].color,.45]];
  for(const [c,k] of washes){g.globalAlpha=.5*k;shp(g,p.poly,'fill',pale(c,.15),b)}
  if(p.fuzz<5&&p.status!=='contested'){g.save();clipTo(g,p.poly);g.globalAlpha=.6;g.setLineDash([9*BS,2*BS,4*BS,2.5*BS]);shp(g,p.poly,'stroke','#2a1d14',.8*BS,2.2*BS);g.restore()}
  g.globalAlpha=1}
