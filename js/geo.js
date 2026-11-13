// js/geo.js: geography (lon/lat to map units), the DEM height field.
// index.html's map script, split into ES modules in v115 (no build step). The IMPORT ORDER IS LOAD-BEARING:
//  * index.html's inline module imports js/timeline.js first, and every module's first import is the module before it,
//    so the browser evaluates geo → scene → terrain → room → post → labels → cities → camera → life → loop → bgm → timeline: the old top-to-bottom order;
//  * terrain.js … timeline.js call each other's functions in both directions, so they form an import cycle. Inside a cycle a module does not
//    wait for another's top-level await, so each one also imports the module just before the cycle (that makes it wait for the
//    DEM and realms.json fetches), and the one top-level await inside the cycle (the era data) sits in its LAST module;
//  * imported bindings are read-only: a module that assigns another module's variable calls that module's set<Name>(v).
// New code: import what you use, put it in the module whose state it touches, and keep top-level await out of the cycle.

import * as THREE from 'three';
export const clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,u)=>a+(b-a)*u,sm=u=>{u=clamp(u,0,1);return u*u*(3-2*u)};
/* ---------- geography (same model as the 2D map): lon 72–142, lat 18–52 ---------- */
export const MW=1400,MH=816,MX=lo=>(lo-72)*20-MW/2,MZ=la=>(52-la)*24-MH/2;
const SEA=[[125,52],[131,43],[129.5,35.2],[126.5,34.5],[126,37.5],[124.6,39.8],[121.6,40.9],[119.5,39.8],[117.8,39],[118.8,37.5],[120.7,37.8],[122.5,37.2],[120.3,35.9],[119.2,34.8],[120.8,32.6],[121.9,30.9],[121.9,29.5],[120.5,27.3],[119.5,25.5],[117.3,23.6],[114.2,22.3],[110.5,21],[109.7,21.5],[108,21.6],[106.6,20],[106,18],[142,18],[142,52]];
const ISLES=[[[130.9,34],[132.4,34.4],[135,34.6],[136.9,34.4],[139.8,35],[140.9,36.9],[140,38.5],[140,40],[141.4,41.4],[140,41.2],[139.6,39.6],[138.5,37.7],[136.7,37.2],[135.5,35.6],[133,35.5],[131,34.4]],[[129.6,33.3],[130.6,31.2],[131.7,31.6],[131.9,33.6],[130.6,34]],[[132.6,33.9],[134.6,34.1],[134.3,33.3],[132.9,32.8]],[[140.1,41.6],[141.5,41.4],[145,43.3],[143,45.5],[141.7,45.3],[141.2,43.2]],[[108.6,19.2],[110.5,20.1],[111,19.6],[109.6,18.2]],[[120.1,23],[121,25.2],[122,25],[120.8,22]]];
export const RIVERS=[[3.4,[[96,35],[100,36],[103.7,36.1],[106,37.5],[106.5,39],[107.5,40.6],[110,40.6],[111.2,40.3],[110.5,38.5],[110.4,36],[110.3,34.6],[112.5,34.8],[114.5,34.9],[116,35.8],[117.5,37],[118.9,37.7]]],
 [3.8,[[91,33.5],[97,33],[99.5,28],[101,26.5],[103.5,28.8],[105.8,29.6],[108,30.5],[110.5,31],[112,30.3],[114.3,30.6],[116,29.8],[117.5,30.8],[118.8,32],[121,31.6]]],
 [2,[[104.5,34.7],[107,34.4],[108.9,34.3],[110.2,34.6]]],[2,[[113,32.4],[115.5,32.5],[117.5,33],[119.3,33.8]]],[1.8,[[106.5,33.1],[109,32.7],[111.5,32.4],[112.5,31.2],[114.3,30.6]]],[1.8,[[123.5,43],[122.8,42],[122.2,40.8]]],[1.8,[[105,24.5],[108.5,23.5],[111,23.4],[113.3,23]]]];
export const DESERTS=[[77,90,37,41],[96,112,40,45.5],[100,107,37.5,40.5]];
function mkNoise(seed){const N=256,p=new Float32Array(N*N);let s=seed;for(let i=0;i<N*N;i++){s=(s*16807)%2147483647;p[i]=s/2147483647}
  return(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),a=p[(yi&255)*N+(xi&255)],b=p[(yi&255)*N+((xi+1)&255)],c=p[((yi+1)&255)*N+(xi&255)],d=p[((yi+1)&255)*N+((xi+1)&255)];return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}}
const n1=mkNoise(11);export const fbm=(x,y,o)=>{let s=0,a=.5,f=1,t=0;for(let i=0;i<o;i++){s+=a*n1(x*f,y*f);t+=a;a*=.5;f*=2.03}return s/t};
const ridged=(x,y,o)=>{let s=0,a=.5,f=1,t=0;for(let i=0;i<o;i++){s+=a*(1-Math.abs(2*n1(x*f+31,y*f+17)-1));t+=a;a*=.5;f*=2.1}return s/t};
/* sea mask + river map from a 2D canvas */
export const GW=800,GH=466;
const mc=document.createElement('canvas');mc.width=GW;mc.height=GH;const mg=mc.getContext('2d');export const toG=([lo,la])=>[(lo-72)/70*GW,(52-la)/34*GH];
const poly=(pts)=>{mg.beginPath();pts.forEach((p,i)=>{const [x,y]=toG(p);i?mg.lineTo(x,y):mg.moveTo(x,y)});mg.closePath()};
mg.fillStyle='#f00';poly(SEA);mg.fill();mg.fillStyle='#000';for(const is of ISLES){poly(is);mg.fill()}
mg.strokeStyle='#0f0';mg.lineCap='round';mg.lineJoin='round';for(const [w,pts] of RIVERS){mg.lineWidth=w*.9;mg.beginPath();pts.forEach((p,i)=>{const [x,y]=toG(p);i?mg.lineTo(x,y):mg.moveTo(x,y)});mg.stroke()}
const md=mg.getImageData(0,0,GW,GH).data;
const H=new Float32Array(GW*GH);
// real elevation: Mapzen/AWS Terrarium tiles (z5) resampled to this lon/lat grid by tools in /tmp → data/dem.bin (Int16 metres)
const DEM=new Int16Array(await (await fetch('data/dem.bin')).arrayBuffer());
for(let j=0;j<GH;j++){const la=52-j/GH*34;for(let i=0;i<GW;i++){const lo=72+i/GW*70,k=j*GW+i,e=DEM[k];
  if(e<=0&&(lo>104||la<24)){H[k]=-.06-.04*fbm(lo,la,2);continue}  // sea: east of 104°E, or south of 24°N (Arabian Sea, Bay of Bengal); 吐鲁番 (−154 m) stays land
  let h=.9*Math.pow(Math.max(e,0)/8000,.8)+.006;
  h+=(ridged(lo*3.1,la*3.1,4)-.5)*.035*clamp(h*2.2,0,1);   // brush-scale texture on top of the real relief
  H[k]=Math.max(.005,h)}}
// islands and coastal ranges rise straight out of the sea, so at ~100x vertical exaggeration they turn into needles
// (Taiwan read as a pillar). Height above a cone that grows inland from the shore is compressed to a fifth; the
// mainland interior and the plateaus are untouched (affects ~600 cells: Taiwan, Japan, a few sea cliffs).
{const N=GW*GH,d=new Float32Array(N),S=1.4142;for(let k=0;k<N;k++)d[k]=H[k]<0?0:1e9;
 for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){const k=j*GW+i;if(!d[k])continue;let v=d[k];if(i>0)v=Math.min(v,d[k-1]+1);if(j>0){v=Math.min(v,d[k-GW]+1);if(i>0)v=Math.min(v,d[k-GW-1]+S);if(i<GW-1)v=Math.min(v,d[k-GW+1]+S)}d[k]=v}
 for(let j=GH-1;j>=0;j--)for(let i=GW-1;i>=0;i--){const k=j*GW+i;if(!d[k])continue;let v=d[k];if(i<GW-1)v=Math.min(v,d[k+1]+1);if(j<GH-1){v=Math.min(v,d[k+GW]+1);if(i<GW-1)v=Math.min(v,d[k+GW+1]+S);if(i>0)v=Math.min(v,d[k+GW-1]+S)}d[k]=v}
 for(let k=0;k<N;k++){if(H[k]<0)continue;const E=.04+.022*d[k];if(H[k]>E)H[k]=E+(H[k]-E)*.2}}
// cliffs taller than ~1 in 6 per cell read as a curtain of needles at this exaggeration (the Himalayan front rose 0.31 in one
// ~9 km cell). Any rise above the lowest neighbour + 0.15 (the 99.5th percentile of slopes) is compressed to 30%; a few passes
// turn the wall into a ramp. Only ~0.5% of cells change: the Himalayan front, the 横断 gorges, parts of the 天山.
for(let pass=0;pass<6;pass++){const C=H.slice();for(let j=1;j<GH-1;j++)for(let i=1;i<GW-1;i++){const k=j*GW+i;if(C[k]<0)continue;
  const lo=Math.min(Math.max(C[k-1],0),Math.max(C[k+1],0),Math.max(C[k-GW],0),Math.max(C[k+GW],0))+.15;if(C[k]>lo)H[k]=lo+(C[k]-lo)*.3}}
// the plateau itself: above ~4000 m (h .45) only 40% of the extra height is kept, so 吐蕃 stays a high table without a 75-unit wall
for(let k=0;k<GW*GH;k++)if(H[k]>.45)H[k]=.45+(H[k]-.45)*.4;
// where the ground is steepest, merge the ~9 km needles into massifs: blend toward the 3×3 mean, weighted by local slope
for(let pass=0;pass<3;pass++){const C=H.slice();for(let j=1;j<GH-1;j++)for(let i=1;i<GW-1;i++){const k=j*GW+i;if(C[k]<0)continue;let s=0,n=0,m=0;
  for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const v=C[k+dj*GW+di];if(v>=0){s+=v;n++;m=Math.max(m,Math.abs(v-C[k]))}}
  const w=Math.min(1,Math.max(0,(m-.06)/.08))*.6;H[k]=C[k]+(s/n-C[k])*w}}
// soften once so the carving reads as valleys, not trenches
export const H2=H.slice();for(let j=1;j<GH-1;j++)for(let i=1;i<GW-1;i++){const k=j*GW+i;if(H[k]<0)continue;let s=0,n=0;for(const o of [k,k-1,k+1,k-GW,k+GW]){if(H[o]>=0){s+=H[o];n++}}H2[k]=lerp(H[k],s/n,.7)}
