// js/post.js: clouds, mist, trees, ink outline and post pass (render scale RS, MSAA). Part of index.html's map script (split into modules in v115; the import order is
// load-bearing, see the note at the top of js/geo.js).
import * as THREE from 'three';
import { STG } from './room.js';
import { EX, RIM, cam, scene } from './scene.js';
import { DESERTS, GH, GW, H2, MH, MW, MX, MZ, fbm } from './geo.js';
import { STY, U, water } from './terrain.js';
import { setTILT } from './camera.js';
// clouds: soft paper-white puffs drifting above the ranges
// in the room a cloud shows only where it lies over the table: seen against the dark room it read as smoke
export const cloudMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uPaper:U.uPaper,uOp:{value:1},uCam:U.uCam,uClip:{value:new THREE.Vector2(MW/2+20,MH/2+20)}},vertexShader:`varying vec2 vUv;varying vec3 vW;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader:`uniform vec3 uPaper,uCam;uniform float uOp;uniform vec2 uClip;varying vec2 vUv;varying vec3 vW;void main(){float k=1.;if(uClip.x>0.){vec3 d=vW-uCam;if(d.y>-.001)discard;vec3 p=uCam+d*((-6.-uCam.y)/d.y);k=(1.-smoothstep(uClip.x-90.,uClip.x,abs(p.x)))*(1.-smoothstep(uClip.y-90.,uClip.y,abs(p.z)));if(k<.01)discard;}vec2 q=(vUv-.5)*vec2(2.,2.);float a=0.;a+=exp(-dot(q-vec2(-.35,.05),q-vec2(-.35,.05))*6.);a+=exp(-dot(q-vec2(.25,-.05),q-vec2(.25,-.05))*5.);a+=.8*exp(-dot(q-vec2(0.,.2),q-vec2(0.,.2))*8.);gl_FragColor=vec4(mix(uPaper,vec3(1.),.6),clamp(a*.45,0.,.6)*uOp*k);}`});
export const clouds=[];for(let i=0;i<16;i++){const s=new THREE.Mesh(new THREE.PlaneGeometry(1,1),cloudMat);const lo=74+Math.random()*60,la=24+Math.random()*26;s.position.set(MX(lo),130+Math.random()*70,MZ(la));s.scale.set(300+Math.random()*200,110+Math.random()*50,1);scene.add(s);clouds.push(s)}

/* ---------- ink outline pass: dark lines where depth jumps (ridges, silhouettes), like the game's 勾勒 ---------- */
const DPR=Math.min(2,devicePixelRatio);
/* render scale (perf 2026-11-05): the scene is drawn three times a frame (colour, depth for the 勾勒 outlines, post), so
   cost grows with pixels. A 1440×900 laptop at 2× is 5.2 M pixels and ran at ~47 fps on an M1; the brush-and-wash look
   does not need that. The colour/depth targets are capped near 2.6 M pixels, and an adaptive governor steps the scale
   down 0.15 when the slowest tenth of the last 90 frames runs over 19 ms, and back up 0.1 after a calm spell (never above
   the cap, never below 1). The final canvas stays at full DPR, so lines and UI stay sharp. */
// with 4× MSAA on (2026-11-07) the cap is 2.0 M pixels: the edges no longer need the extra resolution, and the saved shading pays
// for the multisampling (a phone is unaffected: 390×844 stays at 2)
export const AA=+(new URLSearchParams(location.search).get('aa')??4); // MSAA samples on the colour target (?aa=0 for comparisons)
let AAON=AA>0;export const RSCAP=()=>Math.min(DPR,Math.sqrt((AAON?2.0e6:2.6e6)/(innerWidth*innerHeight)));export let RS=Math.max(1,RSCAP());
export const rt=new THREE.WebGLRenderTarget(innerWidth*RS,innerHeight*RS,{samples:AA});
// rtD is full resolution since 2026-11-10 (at half resolution each nearest depth texel showed as a stair-step block in the brush
// line on a phone). rtD reads nearest (2026-11-07): depth is packed into RGBA, so blending two texels made up a depth between the map's edge and the
// empty background and drew a zigzag of false ink along it
export const rtD=new THREE.WebGLRenderTarget(innerWidth*RS,innerHeight*RS,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});export const depthMat=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
export const postM=new THREE.ShaderMaterial({uniforms:{uFog:U.uFog,uSat:{value:1.2},tC:{value:rt.texture},tD:{value:rtD.texture},px:{value:new THREE.Vector2(1/(innerWidth*RS),1/(innerHeight*RS))},uInk:U.uInk,uPost:{value:new THREE.Vector4(1,0,0,1)},near:{value:cam.near},far:{value:cam.far},uPaper:U.uPaper},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
  fragmentShader:`#include <packing>
uniform sampler2D tC,tD;uniform float uSat;uniform vec4 uPost;uniform vec2 uFog;uniform vec2 px;uniform vec3 uInk,uPaper;uniform float near,far;varying vec2 vUv;
  float ld(vec2 uv){float z=unpackRGBAToDepth(texture2D(tD,uv));return -perspectiveDepthToViewZ(z,near,far);}
  float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
  // how much of a disk of radius r (24 samples on two rings) lies behind a depth step: counting coverage instead of taking the
  // max jump blurs the stair-steps of the half-res depth, and one stray depth texel covers too little of the disk to leave a speck
  float E(vec2 uv,float d,float r){if(d>far*.9||d<near*1.5)return 0.;float s=0.;for(int i=0;i<24;i++){float a=float(i)*.5236+(i<12?0.:.26);
    vec2 o=vec2(cos(a),sin(a))*px*r*(i<12?.5:1.);float dn=ld(uv+o);if(dn<far*.9&&dn>near*1.5)s+=smoothstep(.04,.1,(dn-d)/d);}return s/24.;}
  // 中锋 brush line (2026-11-10, chosen from four mocked brush styles; replaced the thin pen-like max-jump outline): a soft-edged stroke that
  // swells and thins along its length (提按) as noise blends a narrow and a wide coverage radius
  void main(){vec3 c=texture2D(tC,vUv).rgb;float d=ld(vUv);vec2 g=gl_FragCoord.xy;
    float w=vn(g*.018+d*.01);float e=mix(E(vUv,d,5.),E(vUv,d,18.),w);
    float line=smoothstep(.02,.14,e)*mix(.55,.95,w);
    float far2=smoothstep(uFog.x*1.6,uFog.y*1.3,d);line*=1.-far2;
    c=mix(c,uInk,clamp(line*uPost.x,0.,1.));{float lum=dot(c,vec3(.3,.59,.11));c=mix(vec3(lum),c,uSat);c=(c-.5)*(1.+.12*(uSat-1.)*5.)+.5;c=(c-.5)*1.1+.52;}
    c=mix(c,vec3(dot(c,vec3(.3,.59,.11)))*vec3(1.,.985,.95),uPost.y);if(uPost.z>0.)c=mix(c,floor(c*uPost.z+.5)/uPost.z,.6);
    {vec2 g=gl_FragCoord.xy;float fib=fract(sin(floor(g.x*.7)*91.3)*4375.)*.6+fract(sin(floor(g.y*.35)*37.1)*1731.)*.4;c*=mix(1.,.975+.035*fib,uPost.w);}
    gl_FragColor=vec4(c,1.);}`,depthTest:false,depthWrite:false});
const postQ=new THREE.Mesh(new THREE.PlaneGeometry(2,2),postM);export const postS=new THREE.Scene();postS.add(postQ);export const postC=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
/* ---------- low mist: layered sheets of cloud lying in the valleys ---------- */
export const mists=[];
/* ---------- trees: painted clusters on the lower slopes, one Points draw call ---------- */
/* ---------- trees, painted the way 山水 painters do them: 松 with needle clusters, 点叶 broadleaf, 夹叶 outlines ---------- */
// two atlases, 4 variants each: ink (dark brushwork) and wash (the colour laid under it)
function treeAtlas(){const W=512,H=128,ink=document.createElement('canvas'),wash=document.createElement('canvas');ink.width=wash.width=W;ink.height=wash.height=H;
  const gi=ink.getContext('2d'),gw=wash.getContext('2d');let s=21;const r=()=>{s=(s*16807)%2147483647;return s/2147483647};
  const trunk=(g,x,y0,y1,lean,w)=>{g.strokeStyle='#000';g.lineCap='round';for(let k=0;k<2;k++){g.lineWidth=w*(1-k*.45);g.beginPath();g.moveTo(x,y0);g.bezierCurveTo(x+lean*.2,y0-(y0-y1)*.35,x+lean*.9,y0-(y0-y1)*.7,x+lean,y1);g.stroke()}};
  const dab=(g,x,y,rx,ry,a)=>{g.globalAlpha=a;g.beginPath();g.ellipse(x,y,rx,ry,(r()-.5)*.6,0,6.283);g.fill();g.globalAlpha=1};
  // 0: 松 pine — leaning trunk, flat needle clusters drawn as fans of short strokes
  {const ox=0,cx=ox+64;trunk(gi,cx-4,124,30,10,3.2);
    for(const [dx,dy,w] of [[6,34,30],[-14,52,26],[16,58,24],[-6,74,22],[12,88,18]]){const x=cx+dx,y=dy;
      gw.fillStyle='#fff';dab(gw,x,y,w*.9,7,.9);
      gi.strokeStyle='#000';gi.lineWidth=1.1;for(let k=0;k<22;k++){const u=(k/21-.5)*2,px=x+u*w*.85;gi.globalAlpha=.75;gi.beginPath();gi.moveTo(px,y+3);gi.lineTo(px+u*3,y-5-r()*3);gi.stroke()}gi.globalAlpha=1;
      gi.fillStyle='#000';dab(gi,x,y+2,w*.8,2.2,.55);}}
  // 1: 点叶 broadleaf — a crown built from dabs of ink, darker inside
  {const ox=128,cx=ox+64;trunk(gi,cx,124,62,-4,3);gi.lineWidth=1.6;gi.beginPath();gi.moveTo(cx-2,84);gi.lineTo(cx-18,70);gi.moveTo(cx,78);gi.lineTo(cx+16,64);gi.stroke();
    gw.fillStyle='#fff';dab(gw,cx,52,34,28,.9);gi.fillStyle='#000';for(let k=0;k<120;k++){const a=r()*6.283,d=Math.sqrt(r())*30;dab(gi,cx+Math.cos(a)*d,52+Math.sin(a)*d*.8,2.4+r()*2,1.4+r()*1.2,.35+.5*(1-d/30))}}
  // 2: 夹叶 outlined leaves — light crown of little brush circles (often coloured)
  {const ox=256,cx=ox+64;trunk(gi,cx+2,124,58,6,2.6);gw.fillStyle='#fff';dab(gw,cx+4,48,30,26,.95);
    gi.strokeStyle='#000';gi.lineWidth=1;for(let k=0;k<55;k++){const a=r()*6.283,d=Math.sqrt(r())*26;gi.globalAlpha=.7;gi.beginPath();gi.arc(cx+4+Math.cos(a)*d,48+Math.sin(a)*d*.85,2.6+r()*1.4,0,6.283);gi.stroke()}gi.globalAlpha=1}
  // 3: 柳/杂树 — tall thin tree with drooping strokes
  {const ox=384,cx=ox+64;trunk(gi,cx,124,22,-6,2.8);gw.fillStyle='#fff';dab(gw,cx-2,46,22,30,.85);
    gi.strokeStyle='#000';gi.lineWidth=.9;for(let k=0;k<40;k++){const x=cx-20+r()*40,y=24+r()*30;gi.globalAlpha=.6;gi.beginPath();gi.moveTo(x,y);gi.quadraticCurveTo(x+3,y+12,x+(r()-.5)*6,y+22+r()*14);gi.stroke()}gi.globalAlpha=1}
  const t1=new THREE.CanvasTexture(ink),t2=new THREE.CanvasTexture(wash);for(const t of [t1,t2]){t.premultiplyAlpha=false;t.generateMipmaps=true}return[t1,t2]}
const [treeInk,treeWash]=treeAtlas();
let treeMat;export let treePts; // hidden in the depth pass (js/loop.js): under depthMat each sprite drew a solid depth texel, a black speck in the outline
{const P=[],C=[];let s=13;const r=()=>{s=(s*16807)%2147483647;return s/2147483647};
  for(let k=0;k<90000&&P.length<3*14000;k++){const i=1+Math.floor(r()*(GW-2)),j=1+Math.floor(r()*(GH-2)),h=H2[j*GW+i];if(h<.05||h>.55||RIM[j*GW+i]<1)continue;const lo=72+i/GW*70,la=52-j/GH*34;
    let des=false;for(const [a,b,c2,d] of DESERTS)if(lo>a&&lo<b&&la>c2&&la<d)des=true;if(des||la>44)continue;
    // groves: clustered by noise; pines prefer ridges, broadleaf the lower slopes
    const ridge=h-(H2[j*GW+i-1]+H2[j*GW+i+1]+H2[(j-1)*GW+i]+H2[(j+1)*GW+i])/4;if(fbm(lo*2.2,la*2.2,3)<.63&&ridge<.004)continue;
    const kind=ridge>.003||h>.3?0:(r()<.45?1:r()<.6?2:3);
    P.push(MX(lo)+(r()-.5)*2,h*EX+2,MZ(la)+(r()-.5)*2);C.push(r(),r(),kind)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('seed',new THREE.Float32BufferAttribute(C,3));
  treeMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uSeason:U.uSeason,tInk:{value:treeInk},tWash:{value:treeWash},uA:{value:new THREE.Color()},uB:{value:new THREE.Color()},uTK:{value:1},uInk:U.uInk,scale:{value:innerHeight*Math.min(2,devicePixelRatio)*.5},uCam:U.uCam,uPaper:U.uPaper},
    vertexShader:`attribute vec3 seed;uniform float scale,uTK;varying vec3 vS;varying float vF;uniform vec3 uCam;void main(){vS=seed;vec4 mv=modelViewMatrix*vec4(position+vec3(0.,5.,0.),1.);gl_PointSize=clamp(15.*uTK*(.6+.8*seed.y)*scale/-mv.z,0.,110.);gl_Position=projectionMatrix*mv;vF=smoothstep(380.,1300.,length(position-uCam));}`,
    fragmentShader:`uniform sampler2D tInk,tWash;uniform vec4 uSeason;uniform vec3 uA,uB,uInk,uPaper;varying vec3 vS;varying float vF;void main(){vec2 pc=vec2(gl_PointCoord.x,gl_PointCoord.y);if(vS.x>.5)pc.x=1.-pc.x;vec2 uv=vec2((vS.z+pc.x)/4.,1.-pc.y);
      float leafy=step(.5,vS.z);float ink=texture2D(tInk,uv).a,wash=texture2D(tWash,uv).a;
      wash*=1.-uSeason.w*leafy*.92;float a=max(ink*.9,wash*.92);if(a<.04)discard;
      vec3 wc=mix(uA,uB,vS.y);
      wc=mix(wc,mix(vec3(.96,.74,.80),vec3(.98,.95,.92),step(.5,vS.x)),uSeason.x*leafy*step(.45,vS.y));
      wc=mix(wc,mix(mix(vec3(.88,.62,.18),vec3(.84,.36,.16),step(.33,vS.x)),vec3(.70,.2,.14),step(.75,vS.x)),uSeason.z*leafy);
      wc=mix(wc,mix(wc,vec3(.95,.96,.98),smoothstep(.55,.3,pc.y)),uSeason.w*(1.-leafy));
      wc*=mix(1.15,.66,pc.y);vec3 c=mix(wc,uInk,ink*.85);c=mix(c,uPaper,vF*.85);gl_FragColor=vec4(c,a*(1.-vF*.75));}`});
  scene.add(treePts=new THREE.Points(g,treeMat));}
/* 苔点 ridge-crest moss dots removed 2026-11-10: from a distance they read as dirt specks along the ridges */
export function setStyle(S){U.uLk.value.set(...S.L);U.uLk2.value.set(...S.L2);setTILT(S.tilt);treeMat.uniforms.uTK.value=S.treeK;postM.uniforms.uPost.value.set(...S.P);for(const [u,v] of [['uP1','p1'],['uP2','p2'],['uMoss','moss'],['uRock','rock'],['uLow','low'],['uMid','mid'],['uHigh','high'],['uSnow','snow'],['uInk','ink'],['uPaper','paper'],['uRiver','river']])U[u].value.setRGB(...S[v]);U.uBands.value=S.bands;treeMat.uniforms.uA.value.setRGB(...S.tree[0]);treeMat.uniforms.uB.value.setRGB(...S.tree[1]);water.material.uniforms.uW.value.setRGB(...S.water);
  scene.background=new THREE.Color(...S.paper);postM.uniforms.uSat.value=S.sat;document.body.style.background=`rgb(${S.paper.map(x=>x*255|0)})`;
  }
setStyle(STY);
// the 书院 room is the background (the old painted ?bg= sky went with stages 0-4, 2026-11-07): paper tone for the terrain's fog
U.uPaper.value.setRGB(.93,.915,.87);scene.background=null;document.body.style.background=STG.css;
export function setRS(v){RS=Math.round(v*100)/100;rt.setSize(innerWidth*RS,innerHeight*RS);rtD.setSize(innerWidth*RS,innerHeight*RS);postM.uniforms.px.value.set(1/(innerWidth*RS),1/(innerHeight*RS))}
export function setAA(n){rt.samples=n;AAON=n>0;rt.dispose()} // moved here in v115 from the frame-loop code: they set RS and AAON
