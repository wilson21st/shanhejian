// js/camera.js: camera rig, tilt, fly, input gestures. Part of index.html's map script (split into modules in v115; the import order is
// load-bearing, see the note at the top of js/geo.js).
import * as THREE from 'three';
import './cities.js';
import { R, cam } from './scene.js';
import { MH, MW, MX, MZ, clamp, lerp, sm } from './geo.js';
import { U } from './terrain.js';
import { RS, RSCAP, postM, setRS } from './post.js';
import { hAt, hSm } from './labels.js';
/* ---------- camera: drag pans the ground, pinch zooms; closer = lower, like 三国志11 ---------- */
export let tx=MX(109.5),tz=MZ(34.6),dist=520;const DMIN=60,DMAX=3000;
// furthest zoom: far enough that the whole handscroll, both rollers included (half-width MW/2+99), fits the screen width.
// A phone held upright needs ~4200; DMAX stays the reference for the tilt curve.
export const DFIT=()=>{const f=Math.max(DMAX,(MW/2+150)/(Math.tan(cam.fov*Math.PI/360)*cam.aspect)*1.12);return Math.min(f,roomMax(clamp(tAuto()+tOff,tlo(),THI)))};
export let yaw=0,yawT=0;export var TILT,FOCUS=null;
/* user tilt (Wilson 2026-11-07): the zoom curve picks the camera's elevation; tOff shifts it. Two fingers moved up
   together or a left-button drag upward lays the map back towards the horizon, downward looks straight down.
   The total stays within ~23°–86°, the offset survives zooming, and the compass puts both north and tilt back. */
export let tOff=0,tOffT=0;export const TLO=.4,THI=1.5;
// 书院: zoomed well out the eye may sink to a sitter's height (~7°) to look out of the window; close in the 23° floor holds
// (2026-11-07) a camera pressed against a wall counts as zoomed right out too: turned round toward the 座屏 it sits by the window,
// close to the map, and the 23° floor kept it staring at the map; now it may sink and look across the table at the screen
let ROOMM=1e9;export const tlo=()=>lerp(TLO,.12,Math.max(sm((dist-900)/1600),sm((dist/ROOMM-.85)/.15)));
// 书院: the camera stays inside the room — the farthest it may sit along its current line of sight before it meets a wall, the
// ceiling or the open front (a margin keeps the near plane off them); pinch/wheel stop there and place() pulls back to it
const ROOMB=[[-4900,4900],[-1e9,2760],[-1250,3800]];
const roomMax=tilt=>{const c=Math.cos(tilt),d=[Math.sin(yaw)*c,Math.sin(tilt),Math.cos(yaw)*c],o=[tx,0,tz];let s=1e9;
  for(let i=0;i<3;i++){if(d[i]>1e-4)s=Math.min(s,(ROOMB[i][1]-o[i])/d[i]);else if(d[i]<-1e-4)s=Math.min(s,(ROOMB[i][0]-o[i])/d[i])}return Math.max(DMIN*3,s)};
export const tAuto=()=>{const u=Math.min(1,(dist-DMIN)/(DMAX-DMIN));return lerp((TILT||[.8,1.1])[0],(TILT||[.8,1.1])[1],sm(u))};
export const tClamp=o=>{const a=tAuto();return clamp(a+o,tlo(),THI)-a};
// the compass / north-snap ease runs once per frame and by elapsed time (it used to step once per place() call:
// 1–3 times a frame mid-gesture, so its speed hung on the input rate)
let easeT=0,needleA='';export function ease(now){const k=1-Math.pow(.82,Math.min(4,Math.max(0,now-(easeT||now))/16.7));easeT=now;yaw+=(yawT-yaw)*k;tOff+=(tOffT-tOff)*k}
export function place(){const na=`rotate(${(yaw*180/Math.PI).toFixed(3)})`;if(na!==needleA){needleA=na;document.getElementById('needle').setAttribute('transform',na)}const tilt=clamp(tAuto()+tOff,tlo(),THI);{const m=ROOMM=roomMax(tilt);if(dist>m)dist=m}const hz=dist*Math.cos(tilt);const cb=dist*Math.sin(tilt),cl=hSm(tx/20+72+MW/40,52-(tz+MH/2)/24)+20-cb;cam.position.set(tx+Math.sin(yaw)*hz,cb+(cl>-200?15*Math.log1p(Math.exp(cl/15)):0),tz+Math.cos(yaw)*hz);cam.lookAt(tx,0,tz);U.uCam.value.copy(cam.position);
  // near plane follows the zoom (flicker fix 2026-11-07): at near 1 the 24-bit depth buffer resolves only ~1.5 mm at 5 m, so the
  // painted shade 1.5 mm above the 席 and the window reveals 1 mm behind the wall blinked as the room turned (test/flicker-audit.mjs)
  const nr=Math.round(clamp(dist*.025,1,40));if(cam.near!==nr){cam.near=nr;cam.updateProjectionMatrix();postM.uniforms.near.value=nr}}
export function fly(x,z,d,done){const s={tx,tz,dist},t0=performance.now();(function st(){const u=Math.min(1,(performance.now()-t0)/1100),e=u<.5?2*u*u:1-Math.pow(-2*u+2,2)/2;tx=lerp(s.tx,x,e);tz=lerp(s.tz,z,e);dist=s.dist*Math.pow(d/s.dist,e);if(u<1)requestAnimationFrame(st);else done&&done()})()}
export const pts=new Map();export let pinch=null;
// Gestures work like Google / Apple Maps: whatever ground is under your fingers stays under your fingers.
// One finger pans; two fingers spread to zoom, twist to turn the map *with* the fingers, and move together to pan,
// all pivoting on the point between the fingers. Rotation starts only after a deliberate ~12° twist so pinching
// doesn't spin the map, and a release within 8° of north snaps back to north.
const ray=new THREE.Raycaster(),gPl=new THREE.Plane(new THREE.Vector3(0,1,0),0),gV=new THREE.Vector3();
export const hAtXZ=(x,z)=>hAt(x/20+72+MW/40,52-(z+MH/2)/24),hSmXZ=(x,z)=>hSm(x/20+72+MW/40,52-(z+MH/2)/24);
export function ground(px,py,h){cam.updateMatrixWorld();gPl.constant=-h;ray.setFromCamera({x:px/innerWidth*2-1,y:1-py/innerHeight*2},cam);return ray.ray.intersectPlane(gPl,gV)?gV.clone():null}
// pan limits shrink with distance so the painting, not the empty desk around the mount, fills the screen
const PANX=()=>Math.max(0,MW/2-.25*dist),PANZ=()=>Math.max(0,MH/2-.3*dist);
function keepUnder(px,py,G,h){place();const G2=ground(px,py,h);if(G&&G2){tx=clamp(tx+G.x-G2.x,-PANX(),PANX());tz=clamp(tz+G.z-G2.z,-PANZ(),PANZ());place()}}
const mid=P=>{const [a,b]=P;return [(a[0]+b[0])/2,(a[1]+b[1])/2,a,b]};
function startPinch(P){const [mx,my,a,b]=mid(P);yaw=yawT;place();const g0=ground(mx,my,hAtXZ(tx,tz)),h=g0?hAtXZ(g0.x,g0.z):0;
  pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]),dist,ang:Math.atan2(b[1]-a[1],b[0]-a[0]),yaw:yawT,h,G:ground(mx,my,h),rot:0,a:[...a],b:[...b],m:[mx,my],mode:null}}
/* smoothness (Wilson 2026-11-07: turning and tilting "not natural, not smooth"). The camera used to jump to every
   pointermove as it arrived. Fingers and frames don't tick together (60 Hz touches against 60 fps frames land 0 or 2 to
   a frame; an iPhone's 120 Hz touches land 1–3 to a frame), so the map moved, stopped, moved double: test/gesture-audit
   measured half the frames standing still. Now the handlers only note where each finger was and when (every coalesced
   sample, with its own timestamp), and gesture() solves the camera once per frame from the fingers' positions a fixed
   moment ago — one input interval plus delivery delay behind (10–25 ms on an idle device), read off a straight line between the two samples around it.
   Constant finger speed now gives constant map speed whatever the input rate. Never extrapolated, so it can't overshoot. */
export const FH=new Map();let GT=0,pan=null,panS=null; // panS: where a one-finger/right-button pan went down (v111) // pointerId → {s:[[t,x,y]…], gap: typical ms between samples}; GT: time last solved
const evT=e=>{const n=performance.now(),t=e.timeStamp;return t>0&&t<=n+1&&n-t<500?t:n};
function rec(e){const id=e.pointerId,n=performance.now();let h=FH.get(id);if(!h)FH.set(id,h={s:[],gap:16,age:0,touch:e.pointerType==='touch'});
  for(const c of (e.getCoalescedEvents&&e.isTrusted&&e.getCoalescedEvents().length?e.getCoalescedEvents():[e])){const t=evT(c),L=h.s[h.s.length-1];
    if(L&&t<=L[0]){L[1]=c.clientX;L[2]=c.clientY;continue}if(L&&t-L[0]<60)h.gap=h.s.length===1?clamp(t-L[0],4,20):h.gap+(t-L[0]-h.gap)*.2;h.s.push([t,c.clientX,c.clientY]);if(h.s.length>16)h.s.shift()}
  const age=n-h.s[h.s.length-1][0];h.age+=(age-h.age)*(age>h.age?.5:.05)}
// how far behind to read: one sample interval, plus how late samples reach the page (a busy phone hands them over
// in bursts after a slow frame); otherwise the read point runs past the newest sample and the map stalls a frame
const lag=ids=>Math.min(60,Math.max(...ids.map(i=>{const h=FH.get(i);return h?1.15*h.gap+h.age:20})));
/* finger noise (v112, Wilson 2026-11-09: tilting and twisting together on the iPhone still "窒下窒下"). A real fingertip's
   reported centre wobbles by a pixel or two from sample to sample; reading straight between two samples put that wobble
   into the map — two fingers 160 px apart turn it ~0.8° per px, about half a frame's worth of a steady twist
   (test/gesture-audit rotn: speed cv 0.54). A finger is now read off a straight line fitted to its samples from 100 ms
   before the read time to the newest (test/gesture-audit jit 8–17 → ~3 px at ±1.5 px of noise; 50 ms left ~4, 120 ms ~3): exact for a steady finger, the wobble averaged out, and kept within the samples it
   was fitted to so it can never overshoot. Touch only; a mouse doesn't wobble. */
/* the read clock (v112): lag() is re-estimated every frame from how late samples arrive, and it wobbles by a few ms — so
   the read point stepped unevenly and a steady finger moved the map unevenly (a twist at 90°/s carries a ground point
   300 px out at ~8 px a frame: 3 ms of wobble is a 1.4 px stutter). The read time now advances with the frame clock and
   only eases 10% a frame toward now − lag(); it is set afresh after a pause of more than 100 ms. */
let RDT=0,RDN=0;function readT(ids,now){const g=now-lag(ids);RDT=now-RDN>100||!RDT?g:RDT+(now-RDN)+(g-RDT-(now-RDN))*.1;RDN=now;return RDT}
const FW=+(new URLSearchParams(location.search).get('fw')||100); // fit window, ms (?fw= for tests)
function at(id,T){const h=FH.get(id),s=h.s,L=s[s.length-1];
  if(h.touch&&s.length>=4){T=Math.min(T,L[0]);let n=0,st=0,sx=0,sy=0,stt=0,stx=0,sty=0,x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
    for(let i=s.length-1;i>=0&&s[i][0]>=T-FW;i--){const t=s[i][0]-T,x=s[i][1],y=s[i][2];n++;st+=t;sx+=x;sy+=y;stt+=t*t;stx+=t*x;sty+=t*y;
      if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
    const D=n*stt-st*st;if(n>=4&&D>1e-6){const bx=(n*stx-st*sx)/D,by=(n*sty-st*sy)/D;return [clamp((sx-bx*st)/n,x0,x1),clamp((sy-by*st)/n,y0,y1)]}}
  if(T>=L[0])return [L[1],L[2]];
  for(let i=s.length-1;i>0;i--)if(s[i-1][0]<=T){const [t0,x0,y0]=s[i-1],[t1,x1,y1]=s[i],u=(T-t0)/(t1-t0);return [x0+(x1-x0)*u,y0+(y1-y0)*u]}return [s[0][1],s[0][2]]}
/* desktop mouse (Wilson 2026-11-07 20:01, swapped from right-drag-turns): LEFT-drag turns (sideways) and tilts (up/down),
   like orbiting a 3D viewer; RIGHT-drag (or control-drag on a Mac) pans the map; the wheel zooms. Touch is unchanged.
   The turn snaps back to due north when let go close to it.
   Direction (Wilson 2026-11-07, on a Windows PC: "转左佢转右"): the table turns the way a hand on its near edge would push
   it — drag right and the near side of the map follows the cursor right (the map turns anticlockwise on screen), as
   the room orbits in a 3D viewer. It used to turn the other way.
   The browser's own right-click menu (保存图片…) is switched off everywhere except inside the evidence sheet. */
export let rdrag=null;
addEventListener('contextmenu',e=>{if(!e.target.closest('#wikiOv'))e.preventDefault()});
R.domElement.addEventListener('pointerdown',e=>{try{R.domElement.setPointerCapture(e.pointerId)}catch(_){}
  FH.delete(e.pointerId);rec(e);
  if(e.pointerType==='mouse'&&e.button===0&&!e.ctrlKey){yaw=yawT;tOffT=tOff=tClamp(tOffT);rdrag={id:e.pointerId,x:e.clientX,y:e.clientY,yaw:yawT,t:tOff};R.domElement.style.cursor='move';return}
  pts.set(e.pointerId,[e.clientX,e.clientY]);if(pts.size===1){pan=null;panS=[e.clientX,e.clientY]}if(pts.size===2)startPinch([...pts.keys()].map(i=>at(i,GT)))});
R.domElement.addEventListener('pointermove',e=>{if((rdrag&&e.pointerId===rdrag.id)||pts.has(e.pointerId)){rec(e);if(pts.has(e.pointerId))pts.set(e.pointerId,[e.clientX,e.clientY])}});
export function gesture(now){GT=now;
  if(rdrag){const p=at(rdrag.id,readT([rdrag.id],now));yawT=yaw=rdrag.yaw-(p[0]-rdrag.x)*.006;tOffT=tOff=tClamp(rdrag.t+(p[1]-rdrag.y)*.005);return}
  if(pts.size===1){const [id]=pts.keys();if(!FH.has(id))return;const p=at(id,readT([id],now));
    // the grab plane is set once, at the ground under the finger/cursor when the pan starts: re-reading the terrain at the
    // target every frame changed the plane's height mid-drag, so the map sped up and slowed down over ridges (v111)
    // it starts from the point the button went down, not from the first frame's reading (that lost ~40 ms of travel);
    // after a two-finger gesture hands over to one finger it starts where that finger is
    if(!pan){yaw=yawT;place();const s=panS||p,g0=ground(s[0],s[1],hSmXZ(tx,tz));panS=null;pan=[s[0],s[1]];pan.h=g0?hAtXZ(g0.x,g0.z):0}if(p[0]===pan[0]&&p[1]===pan[1])return;
    yaw=yawT;place();const h=pan.h,G=ground(pan[0],pan[1],h);pan=p;pan.h=h;keepUnder(p[0],p[1],G,h);return}
  if(pts.size!==2||!pinch)return;const ids=[...pts.keys()],T=readT(ids,now),[mx,my,a,b]=mid(ids.map(i=>at(i,T)));
  /* two fingers (v112): tilt, twist and spread all work at once. Wilson 2026-11-09 23:2x: tilting and twisting together
     "窒下窒下". The gesture used to lock into one mode: 'tilt' ignored twist and spread, 'map' (pan + zoom + twist) could
     not tilt, and whichever threshold the fingers crossed first won — so the other half of a combined move stuck dead
     (test/gesture-audit ttw / ttw2: tilt or twist gain 0). Now the mode only says what the fingers' *midpoint* moving does:
     'tilt' (both fingers pushed the same way vertically, spread steady) or 'map' (it pans). Twist turns the map in every
     mode once past ~12°, then 1:1; spread zooms in 'map' at once and in 'tilt' past 10% (so a push doesn't zoom), each
     taken up from where the fingers are when it starts, so nothing jumps. While tilting, or before a mode is chosen, the
     twist and zoom pivot on the ground under the point where the fingers went down. The tilt test takes the twist out of
     the finger moves first (a twist pushes side-by-side fingers opposite ways vertically). */
  const d=Math.hypot(a[0]-b[0],a[1]-b[1]),sp=d/Math.max(1,pinch.d);let da=Math.atan2(b[1]-a[1],b[0]-a[0])-pinch.ang;da=Math.atan2(Math.sin(da),Math.cos(da));
  if(!pinch.mode){const c=Math.cos(da),sn=Math.sin(da),un=p=>(p[1]-my)*c-(p[0]-mx)*sn+my,da0=un(a)-pinch.a[1],db0=un(b)-pinch.b[1],
      vert=Math.abs(my-pinch.m[1])>Math.abs(mx-pinch.m[0]),mv=Math.max(Math.abs(da0),Math.abs(db0),Math.hypot(mx-pinch.m[0],my-pinch.m[1]));
    if(vert&&da0*db0>0&&Math.min(Math.abs(da0),Math.abs(db0))>9&&Math.abs(sp-1)<.1){pinch.mode='tilt';pinch.t=tOffT=tOff=tClamp(tOffT);pinch.y=my}
    else if(mv>24||Math.abs(sp-1)>=.1){const r=pinch.rot;startPinch([a,b]);pinch.mode='map';if(r)pinch.rot=Math.sign(r)*1e-9;return}}
  if(!pinch.rot&&Math.abs(da)>.21)pinch.rot=Math.sign(da)*.21;
  if(pinch.mode==='tilt'&&!pinch.z&&Math.abs(sp-1)>=.1)pinch.z=[d,dist];
  // the pivot is taken before this frame moves the camera: on 60 Hz input the twist can already be past the threshold
  if(pinch.mode!=='map'&&(pinch.rot||pinch.z)&&!pinch.P){place();const g0=ground(pinch.m[0],pinch.m[1],hAtXZ(tx,tz)),h=g0?hAtXZ(g0.x,g0.z):0;pinch.P={G:ground(pinch.m[0],pinch.m[1],h),h}}
  // screen y points down, so a clockwise twist gives da > 0; a larger yaw turns the map clockwise on screen
  if(pinch.rot)yawT=yaw=pinch.yaw+(da-pinch.rot);
  if(pinch.mode==='map'){dist=clamp(pinch.dist*pinch.d/Math.max(1,d),DMIN,DFIT());keepUnder(mx,my,pinch.G,pinch.h);return}
  if(pinch.mode==='tilt'){tOffT=tOff=tClamp(pinch.t+(my-pinch.y)*.006);if(pinch.z)dist=clamp(pinch.z[1]*pinch.z[0]/Math.max(1,d),DMIN,DFIT())}
  if(pinch.P)keepUnder(pinch.m[0],pinch.m[1],pinch.P.G,pinch.P.h)}
const up=e=>{if(rdrag&&e.pointerId===rdrag.id){const L=(FH.get(e.pointerId)||{s:[]}).s.slice(-1)[0];if(L){yawT=rdrag.yaw-(L[1]-rdrag.x)*.006;tOffT=tClamp(rdrag.t+(L[2]-rdrag.y)*.005)}FH.delete(e.pointerId);const k=Math.round(yawT/(2*Math.PI))*2*Math.PI;if(Math.abs(yawT-k)<.14)yawT=k;rdrag=null;R.domElement.style.cursor='';return}FH.delete(e.pointerId);pts.delete(e.pointerId);pan=null;panS=null;if(pts.size<2&&pinch){if(pinch.rot){const k=Math.round(yawT/(2*Math.PI))*2*Math.PI;if(Math.abs(yawT-k)<.14)yawT=k}pinch=null}};R.domElement.addEventListener('pointerup',up);R.domElement.addEventListener('pointercancel',up);
R.domElement.addEventListener('wheel',e=>{e.preventDefault();yaw=yawT;place();const h=hAtXZ(tx,tz),G=ground(e.clientX,e.clientY,h);dist=clamp(dist*Math.exp(e.deltaY*.0012),DMIN,DFIT());keepUnder(e.clientX,e.clientY,G,h)},{passive:false});
addEventListener('resize',()=>{R.setSize(innerWidth,innerHeight);setRS(Math.max(1,Math.min(RS,RSCAP())));cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix()});
export const v=new THREE.Vector3();export let t0=performance.now();
// setters: imported bindings are read-only, so the other modules write these through here
export function setTILT(v){return TILT=v}
export function setYawT(v){return yawT=v}
export function setTOffT(v){return tOffT=v}
export function setFOCUS(v){return FOCUS=v}
export function setTx(v){return tx=v}
export function setTz(v){return tz=v}
export function setDist(v){return dist=v}
export function setYaw(v){return yaw=v}
export function setTOff(v){return tOff=v}
