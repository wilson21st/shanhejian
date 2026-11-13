// js/labels.js: HTML labels over the map. Part of index.html's map script (split into modules in v115; the import order is
// load-bearing, see the note at the top of js/geo.js).
import * as THREE from 'three';
import './post.js';
import { EX } from './scene.js';
import { GH, GW, H2, MX, MZ, clamp } from './geo.js';
import { CAPL } from './cities.js';

/* ---------- labels ---------- */
const lab=document.getElementById('lab');export const LBL=[];
export const hAt=(lo,la)=>{const i=clamp(Math.round((lo-72)/70*GW),0,GW-1),j=clamp(Math.round((52-la)/34*GH),0,GH-1);return Math.max(0,H2[j*GW+i])*EX};
/* the eye's terrain lift (Wilson 2026-11-09: right-drag pan on Windows "起起伏伏", and twisting on the phone not smooth).
   The camera used to rise by hAt() at its target: one grid cell, no interpolation, so sliding over the 秦岭 lifted and
   dropped the eye by up to 2% of its distance in a single frame and the map bobbed (test/gesture-audit camstep). It now
   rides HB: the relief dilated (~4 cells, so it still clears the peaks around the target) then box-blurred (~3×10 cells),
   read bilinearly — a slow swell, never a step. And the eye only rises when it would come within ~20 of that relief
   (a soft max, place()): from the usual heights it sits well above every peak and does not follow the ground at all. */
const HB=(()=>{const n=GW*GH,A=new Float32Array(n),B=new Float32Array(n);for(let k=0;k<n;k++)A[k]=Math.max(0,H2[k])*EX;
  const pass=(S,D,r,op,hor)=>{const L=hor?GW:GH,M=hor?GH:GW,st=hor?1:GW,ln=hor?GW:1;for(let m=0;m<M;m++){const o=m*ln;
    if(op){for(let i=0;i<L;i++){let a=-1e9;for(let q=Math.max(0,i-r),q1=Math.min(L-1,i+r);q<=q1;q++)a=Math.max(a,S[o+q*st]);D[o+i*st]=a}continue}
    let s=0;for(let q=0;q<=Math.min(L-1,r);q++)s+=S[o+q*st];
    for(let i=0;i<L;i++){D[o+i*st]=s/(Math.min(L-1,i+r)-Math.max(0,i-r)+1);if(i+r+1<L)s+=S[o+(i+r+1)*st];if(i-r>=0)s-=S[o+(i-r)*st]}}};
  pass(A,B,4,1,1);pass(B,A,4,1,0);for(let k=0;k<3;k++){pass(A,B,10,0,1);pass(B,A,10,0,0)}return A})();
export const hSm=(lo,la)=>{const x=clamp((lo-72)/70*GW,0,GW-1.001),y=clamp((52-la)/34*GH,0,GH-1.001),i=x|0,j=y|0,u=x-i,w=y-j,k=j*GW+i;
  return (HB[k]*(1-u)+HB[k+1]*u)*(1-w)+(HB[k+GW]*(1-u)+HB[k+GW+1]*u)*w};
/* a card's box (relative to its anchor) comes from offsetWidth/Height, which ignore transforms — so it is right even
   mid pop-in, can be taken the moment the card is created, and is never dropped (2026-11-05 night, Wilson: "弹信息
   出嚟好 flicky…好似由一个地方移到另一个地方": re-measuring after the pop-in left one frame with no box, in which the
   card skipped its lift over the capital and dropped ~137px, then jumped back) */
// the 竖匾 carries margin-top:-14px; its box ignored it, so it sat 14px low in the overlap test and a city label could print
// over the top of it (v111, ui-audit 长安 × 凉州 in landscape); the margin is read once per measure
export const popBox=l=>{const w=l.e.offsetWidth,h=l.e.offsetHeight,mt=l===CAPL?parseFloat(getComputedStyle(l.e).marginTop)||0:0;l.box={dx:-w/2,dy:-h+mt,w,h}};
export const LRO=window.ResizeObserver?new ResizeObserver(es=>{for(const e of es){const l=LBL.find(x=>x.e===e.target);if(l){if(l.cls.startsWith('pop'))popBox(l);else l.box=null}}}):null;
addEventListener('resize',()=>{for(const l of LBL)l.box=null});if(document.fonts)document.fonts.ready.then(()=>{for(const l of LBL)l.box=null});
export function addL(cls,lo,la,html,onclick,lift){const e=document.createElement('div');e.className='lb '+cls;e.innerHTML=html;if(onclick)e.onclick=onclick;lab.appendChild(e);const L={e,cls,p:new THREE.Vector3(MX(lo),hAt(lo,la)+(lift||4),MZ(la))};LBL.push(L);return L}
