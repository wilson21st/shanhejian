// js/loop.js: frame loop, resolution governor, perf meter. Part of index.html's map script (split into modules in v115; the import order is
// load-bearing, see the note at the top of js/geo.js).
import { LIFE, lifeTick } from './life.js';
import { R, cam, scene } from './scene.js';
import { MW, clamp, lerp, sm } from './geo.js';
import { U, bT0, water } from './terrain.js';
import { STG } from './room.js';
import { AA, RS, RSCAP, cloudMat, clouds, depthMat, treePts, mists, postC, postS, rt, rtD, setAA, setRS } from './post.js';
import { LBL, LRO } from './labels.js';
import { CAPKEY, CAPL, CITYV, CITY_D, CITY_G } from './cities.js';
import { FH, FOCUS, THI, dist, ease, gesture, pinch, place, pts, rdrag, t0, tAuto, tOff, tlo, tx, tz, v, yaw } from './camera.js';
import { BATBOX, BATTLE, PMBOX, TL, TLTOP, overlayFrame, setTLTOP } from './timeline.js';
let OVERR=0;
let HID=null;const HV=[];

export const GOV={last:0,dts:[],calm:0};
function govern(now){if(GOV.off)return;if(GOV.last){const dt=now-GOV.last;if(dt<250)GOV.dts.push(dt)}GOV.last=now;if(GOV.dts.length<90||document.hidden)return;
  // no resolution change while a finger or button is down (v111): each one is a visible pop plus a reallocation hitch mid-gesture;
  // the frames keep counting and the step waits for the release
  if(rdrag||pts.size){if(GOV.dts.length>300)GOV.dts.splice(0,GOV.dts.length-300);return}
  const d=GOV.dts.sort((a,b)=>a-b),p90=d[Math.floor(d.length*.9)];GOV.dts=[];
  // MSAA is the last rung (2026-11-07): a slow device first gives up render scale, then the 4× MSAA; a calm one gets MSAA back first
  // (after two drops it stays off for the visit, so it does not flap)
  if(p90>19&&RS>1){setRS(Math.max(1,RS-.15));GOV.calm=0}else if(p90>19&&rt.samples){setAA(0);GOV.calm=0;GOV.drops=(GOV.drops||0)+1}
  else if(p90<15.5){if(++GOV.calm>=3){if(AA&&!rt.samples&&(GOV.drops||0)<2)setAA(AA);else if(RS<RSCAP())setRS(Math.min(RSCAP(),RS+.1));GOV.calm=0}}else GOV.calm=0}

/* ?perf=1 (v112; exactly 1: test/perf-audit puts a timestamp in ?perf= as a cache-buster): a small meter in the top-left corner, for measuring on the phone itself (headless tests only model an
   iPhone). Live: fps and 95th-percentile frame time over the last 2 s, frames slower than 25 ms (a visible hitch), the
   touch input rate. After each gesture: its length and frames, hitches, which two-finger channels it used (俯 tilt / 移
   pan, 转 twist, 缩 zoom) and, for each channel that moved, cv (how uneven its speed was, 0 = perfectly even; under 0.3
   reads as smooth; counted from 150 ms after that channel starts moving until it stops, as test/gesture-audit does) and 跳 (fastest frame ÷ the median speed; over 3 is a lurch). */
const PERF=new URLSearchParams(location.search).get('perf')==='1'?(()=>{const el=document.createElement('div');
  el.style.cssText='position:fixed;left:6px;top:calc(env(safe-area-inset-top) + 6px);z-index:99;font:11px/1.4 ui-monospace,Menlo,monospace;color:#fff;background:rgba(0,0,0,.62);padding:4px 7px;border-radius:6px;pointer-events:none;white-space:pre';
  document.body.appendChild(el);let last=0,shown=0,hz=0,G=null,SUM='';el.id='perf-hud';const dts=[];
  const q=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.min(s.length-1,Math.floor(s.length*p))]:0};
  const ch=(F,k,nm)=>{const mv=F.map((f,i)=>i&&Math.abs(f[k]-F[i-1][k])>1e-5),i0=mv.indexOf(true),i1=mv.lastIndexOf(true);if(i0<0)return '';
    const S=F.slice(i0,i1+1).filter(f=>f[0]>=F[i0][0]+150);if(S.length<6)return '';const dv=S.slice(1).map((f,i)=>f[k]-S[i][k]),tot=dv.reduce((a,b)=>a+b,0);
    if(Math.abs(tot)<(k===1?.03:k===2?.02:.03))return '';const v=S.slice(1).map((f,i)=>dv[i]/(f[0]-S[i][0])),m=v.reduce((a,b)=>a+b,0)/v.length,sd=Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length);
    return `${nm} cv${(sd/Math.abs(m)).toFixed(2)} 跳${(Math.max(...v.map(Math.abs))/Math.max(1e-9,q(v.map(Math.abs),.5))).toFixed(1)}  `};
  const sum=g=>{const F=g.f,d=F.slice(1).map((f,i)=>f[0]-F[i][0]);if(F.length<3)return '';
    return `上次 ${((F[F.length-1][0]-F[0][0])/1000).toFixed(1)}s ${F.length}帧 p95 ${q(d,.95).toFixed(0)}ms 卡${d.filter(x=>x>25).length}  ${g.mode}\n`+ch(F,1,'转')+ch(F,2,'俯')+ch(F,3,'缩')};
  return now=>{if(last)dts.push([now,now-last]);last=now;while(dts.length&&dts[0][0]<now-2000)dts.shift();
    for(const h of FH.values())if(h.touch&&h.s.length>4){const s=h.s;hz=(s.length-1)*1000/Math.max(1,s[s.length-1][0]-s[0][0])}
    if(pts.size){if(!G)G={f:[],mode:''};G.f.push([now,yaw,clamp(tAuto()+tOff,tlo(),THI),Math.log(dist)]);
      G.mode=pts.size>1&&pinch?({tilt:'俯',map:'移'}[pinch.mode]||'-')+(pinch.rot?'+转':'')+(pinch.z||pinch.mode==='map'?'+缩':''):'单指'}
    else if(G){SUM=sum(G);G=null}
    if(now-shown>250){shown=now;const d=dts.map(x=>x[1]),sp=dts.length>1?(dts[dts.length-1][0]-dts[0][0])/1000:1;
      el.textContent=`fps ${(d.length/sp).toFixed(0)}  p95 ${q(d,.95).toFixed(1)}ms  卡>25ms ${d.filter(x=>x>25).length}\n输入 ${hz.toFixed(0)}Hz${G?'  手势中 '+G.mode:''}\n${SUM}`}}})():null;
 // three re-creates the target's buffers on its next use
// v139: a scroll over the map ('hold' on #scrollOv, js/timeline.js openScroll) covers it or stands still in front of it, so
// the map draws nothing until the overlay is gone: its unroll and roll-up get the main thread to themselves
const OVH=document.getElementsByClassName('hold');
function frame(now){if(OVH.length&&OVH[0].id==='scrollOv'){GOV.last=0;requestAnimationFrame(frame);return}govern(now);const t=(now-t0)/1000;U.uTime.value=t;U.uBMix.value=Math.min(1,(now-bT0)/1400);{const f=FOCUS&&now<FOCUS.until?FOCUS:null,fx=f?f.x:tx,fz=f?f.z:tz,F=U.uFocus.value;F.x+=(fx-F.x)*.06;F.y+=(fz-F.y)*.06;F.z=dist*.75}{const z=Math.min(1,Math.max(0,(dist-450)/1700));U.uBStr.value=.3+.7*z*z*(3-2*z)}ease(now);gesture(now);place();if(PERF)PERF(now);lifeTick();if(STG.tick)STG.tick(t);
  clouds.forEach((c,i)=>{c.quaternion.copy(cam.quaternion);c.position.x+=Math.sin(i)*.04+.05;if(c.position.x>MW/2+200)c.position.x=-MW/2-200});
  {const clear=sm((dist-1500)/1300);U.uFog.value.set(lerp(dist*.5+60,dist*1.2,clear),lerp(dist*1.9+300,dist*3.2,clear));}cloudMat.uniforms.uOp.value=1-sm((dist-500)/600);
  mists.forEach((m,i)=>{m.material.map.offset.x=t*.004*(i+1);m.material.map.offset.y=t*.002*(i%2?1:-1)});
  R.setRenderTarget(rt);R.render(scene,cam);const hid=HID&&HID.length===2+clouds.length+CITY_G.length+LIFE.length+STG.hide.length?HID:(HID=[water,treePts,...clouds,...CITY_G,...LIFE,...STG.hide]);for(let i=0;i<hid.length;i++){HV[i]=hid[i].visible;hid[i].visible=false}const bg=scene.background;scene.background=null;scene.overrideMaterial=depthMat;R.setRenderTarget(rtD);R.setClearColor(0xffffff,1);R.clear();R.render(scene,cam);scene.overrideMaterial=null;scene.background=bg;for(let i=0;i<hid.length;i++)hid[i].visible=HV[i];R.setRenderTarget(null);R.render(postS,postC);
  {const now=performance.now();for(const c of CITYV){if(c.open&&c.town&&!c.L.town.on)c.open=false;const k=Math.min(1,(now-c.t0)/650),e=k*k*(3-2*k),v=c.open?e:1-e;c.g.visible=v>.01;c.g.scale.y=Math.max(.01,v)}}
  /* labels (perf 2026-11-05): ~230 of them are projected every frame. They used to be placed with left/top, have their
     size read back (offsetWidth) and their box read back again (getBoundingClientRect) for the overlap test — two or
     three forced layouts per frame, the main cause of hitching on a phone. Now: positions go to the `translate`
     property (compositor only), a label's box relative to its anchor is measured once when it first shows and kept
     until a ResizeObserver says its size changed, and the overlap test uses those cached boxes; style is only written
     when a value actually changes. test/perf-audit.mjs watches layouts per frame. */
  const far=dist>900,nowL=performance.now(),popCap=LBL.length?LBL.some(x=>x.cls.startsWith('pop')&&x.key===CAPKEY):false,IW=innerWidth,IH=innerHeight;
  for(let i=LBL.length-1;i>=0;i--){const l=LBL[i];if(l.until&&nowL>l.until){l.e.remove();if(LRO)LRO.unobserve(l.e);LBL.splice(i,1);continue}v.copy(l.p).project(cam);
    const lod=l.cls.startsWith('pop')||(l.cls==='scroll'?(!far||!(TL&&TL.playing))&&!popCap:(l.cls==='region'?dist>350:l.cls==='city cap'?true:(l.cls==='city'||l.cls==='city town')?dist<CITY_D:!far))&&!(l.town&&!l.town.on);
    const vis=lod&&!l.off&&v.z<1&&Math.abs(v.x)<1.1&&Math.abs(v.y)<1.1;l.vis=vis;
    if(vis){let X=(v.x+1)/2*IW,Y=(1-v.y)/2*IH-(l.lead||0);l.ax=X;l.ay=Y+(l.lead||0);
      if(l.cls.startsWith('pop')&&l.box){const w=l.box.w,h=l.box.h,m=8,mr=l.cls.includes('scrollc')?m+24:m,X0=X,Y0=Y;X=Math.min(IW-mr-w/2,Math.max(m+w/2,X));Y=Math.max(m+h,Y);
        l._nd=Math.abs(X-X0)>1||Math.abs(Y-Y0)>1}
      l.X=X;l.Y=Y;l.bX=X;l.bY=Y;if(l.drag){l.X=X+l.drag[0];l.Y=Y+l.drag[1]}}}
  // labels never sit on one another: higher priority keeps its place, the rest step aside until there is room
  /* (2026-11-05 night, Wilson: "卡片弹出嚟嘅时候，嗰个都城就会消失") — the 竖匾 always shows. A card that would cover it
     rises above it, staying over its own place (v93: it used to step sideways, which pushed every 长安 card off to the
     left — "永远固定喺左手边"); only if there is no room above does it step aside. */
  {const cap=CAPL.vis&&CAPL.box?{l:CAPL.X+CAPL.box.dx-14,r:CAPL.X+CAPL.box.dx+CAPL.box.w+14,t:CAPL.Y+CAPL.box.dy-24,b:CAPL.Y+CAPL.box.dy+CAPL.box.h+10}:null;
   if(cap)for(const l of LBL){if(!l.vis||!l.box||!l.cls.startsWith('pop')||l.drag)continue;const x0=l.X+l.box.dx,y0=l.Y+l.box.dy;
     if(x0<cap.r&&x0+l.box.w>cap.l&&y0<cap.b&&y0+l.box.h>cap.t){const Y=cap.t-6-l.box.dy-l.box.h;
       if(Y+l.box.dy>=8)l.Y=Y;else{let X=cap.r+4-l.box.dx;if(X+l.box.dx+l.box.w>IW-8)X=cap.l-4-l.box.dx-l.box.w;l.X=X}}}}
  /* (2026-11-07, Wilson's 589 平陈 screenshot: the card sat right over 贺若弼's and 韩擒虎's banners and strokes) — a battle's
     card stands clear of the whole field: above it if there is room, else below it (above the timeline bar), else where it was */
  if(BATBOX&&BATBOX.s===TL.i){const B=BATBOX,tb=TLTOP||(setTLTOP((document.getElementById('tl')||{}).offsetTop||IH));
   for(const l of LBL){if(!l.vis||!l.box||!l.cls.startsWith('pop')||l.step!==B.s||l.drag)continue;const x0=l.X+l.box.dx,y0=l.Y+l.box.dy;
     if(x0<B.r&&x0+l.box.w>B.l&&y0<B.b&&y0+l.box.h>B.t){const up=B.t-8-l.box.dy-l.box.h,dn=B.b+8-l.box.dy;
       if(up+l.box.dy>=8){l.Y=up;l._nd=true}else if(dn+l.box.dy+l.box.h<=tb-8){l.Y=dn;l._nd=true}}}}
  /* v133 (Wilson 13:14: in 人物传 the card covered the protagonist's round portrait) — the portrait (.pmark, last frame's box
     PMBOX, padded) is an obstacle like the capital: a card that would touch it rises above it; with no room above (portrait
     near the top of the screen) it steps sideways, to the side with more room. A dragged card stays where it was put. */
  const PM=PMBOX&&{l:PMBOX.l-10,r:PMBOX.r+10,t:PMBOX.t-10,b:PMBOX.b+8};
  const pmAvoid=l=>{if(!PM||l.drag)return;const x0=l.X+l.box.dx,y0=l.Y+l.box.dy;if(!(x0<PM.r&&x0+l.box.w>PM.l&&y0<PM.b&&y0+l.box.h>PM.t))return;
    const Y=PM.t-l.box.dy-l.box.h;if(Y+l.box.dy>=8){l.Y=Y;l._nd=l._nd||Y<l.bY-1;return}
    const lf=PM.l-8>=l.box.w,rt=IW-8-PM.r>=l.box.w;
    if(lf||rt)l.X=(lf&&(!rt||(PM.l+PM.r)/2>IW/2))?PM.l-l.box.dx-l.box.w:PM.r-l.box.dx;else l.Y=PM.b-l.box.dy;l._nd=true};  // no room either side: under it
  for(const l of LBL)if(l.vis&&l.box&&l.cls.startsWith('pop'))pmAvoid(l);
  /* (2026-11-05 night, Wilson: "同时有几条 message 嘅话，嗰啲效果好差") — cards never sit on one another: the newest keeps
     its place, an older card that would overlap it climbs above it (up to four steps), its lead line hidden. */
  {const ps=PM?[{...PM}]:[];for(let i=LBL.length-1;i>=0;i--){const l=LBL[i];if(!l.vis||!l.box||!l.cls.startsWith('pop'))continue;
     let y=l.Y,moved=false;for(let n=0;n<(l.drag?0:4);n++){const x0=l.X+l.box.dx,y0=y+l.box.dy,hit=ps.find(q=>x0<q.r-2&&x0+l.box.w>q.l+2&&y0<q.b-2&&y0+l.box.h>q.t+2);if(!hit)break;const ny=hit.t-6-l.box.dy-l.box.h;if(ny+l.box.dy<4)break;y=ny;moved=true}
     ps.push({l:l.X+l.box.dx,r:l.X+l.box.dx+l.box.w,t:y+l.box.dy,b:y+l.box.dy+l.box.h});if(moved){l.Y=y;l._nd=true}
     if(l.ax!=null)ps.push({l:l.ax-14,r:l.ax+14,t:l.ay-14,b:l.ay+14})}} // an older card must not cover a newer card's place either
  for(const l of LBL){if(!l.vis)continue;
    if(l.box&&l.cls.startsWith('pop')){l.X=Math.min(IW-8-l.box.dx-l.box.w,Math.max(8-l.box.dx,l.X));l.Y=Math.max(8-l.box.dy,l.Y); // never off screen
      if(l.drag){const tb=TLTOP||(setTLTOP((document.getElementById('tl')||{}).offsetTop||IH));l.Y=Math.max(8-l.box.dy,Math.min(tb-8-l.box.dy-l.box.h,l.Y))} // a dragged card stops above the timeline bar
      // a card that has to make room (rise over the capital, climb above a newer card) glides there; a new card starts
      // where it belongs, so it never appears in one spot and then leaves it
      const ox=l.X-l.bX,oy=l.Y-l.bY;
      /* (2026-11-07, card-audit steady: 615 雁门 slid 90px up after it appeared) — the battle's screen box is measured by the
         overlay pass, which runs after this one, so on a new battle step a new card would first stand where the field
         is and then glide clear of it. It waits (unseen, still in its fade-in) until the box for its step exists. */
      const bw=l.oS==null&&!l.drag&&BATTLE&&l.step===TL.i&&!(BATBOX&&BATBOX.s===TL.i)&&(l.bw=(l.bw||0)+1)<4;if(bw!==!!l.bwH){l.bwH=bw;l.e.style.visibility=bw?'hidden':''}
      if(l.drag)l.oS=[ox,oy];else if(bw);else if(l.oS==null)l.oS=[ox,oy];else{l.oS[0]+=(ox-l.oS[0])*.25;l.oS[1]+=(oy-l.oS[1])*.25;if(Math.abs(ox-l.oS[0])<.3)l.oS[0]=ox;if(Math.abs(oy-l.oS[1])<.3)l.oS[1]=oy}
      if(l.oS){l.X=l.bX+l.oS[0];l.Y=l.bY+l.oS[1]}}
    const tr=`${l.X.toFixed(1)}px ${l.Y.toFixed(1)}px`;if(tr!==l.tr){l.tr=tr;l.e.style.translate=tr}
    if(l.cls.startsWith('pop')){const nd=!!l._nd;l._nd=false;if(nd!==l.nd){l.nd=nd;l.e.classList.toggle('nudged',nd)}}}
  {const pri=l=>l.cls.startsWith('pop')?0:l.cls==='city cap'?0:l.cls==='scroll'?1:l.cls==='city'?(l.town?3:2):l.cls==='city town'?5:l.e.classList.contains('sm')?4:3;
   const placed=[],show=new Set();
   for(const l of LBL.filter(l=>l.vis).sort((a,b)=>pri(a)-pri(b))){
     if(!l.box){if(l.e.style.display==='none'){l.e.style.display='';l.disp=''}const r=l.e.getBoundingClientRect();l.box={dx:r.left-l.X,dy:r.top-l.Y,w:r.width,h:r.height};if(LRO)LRO.observe(l.e)} // once per label
     const r={left:l.X+l.box.dx,top:l.Y+l.box.dy,right:l.X+l.box.dx+l.box.w,bottom:l.Y+l.box.dy+l.box.h};
     if(pri(l)>0&&placed.some(q=>r.left<q.right-2&&r.right>q.left+2&&r.top<q.bottom-2&&r.bottom>q.top+2))continue;placed.push(r);show.add(l)}
   for(const l of LBL){const d=show.has(l)?'':'none';if(d!==l.disp){l.disp=d;l.e.style.display=d}}}
  try{overlayFrame()}catch(e){if(!(e instanceof ReferenceError)&&!OVERR){OVERR=1;console.error('overlayFrame',e)}} // the overlay's state is declared further down the module; early frames skip that (ReferenceError), any other throw is reported once (ui-audit's js-error catches it)
  // (removed 2026-11-05, Wilson: zooming out used to swing the map back to north-up; he wants a side view to stay put.
  //  The angle now only changes when he turns it; the compass button still resets to north.)
  requestAnimationFrame(frame)}
requestAnimationFrame(frame);
if(window.visualViewport){const vv=visualViewport,fit=()=>document.documentElement.style.setProperty('--vvb',Math.max(0,innerHeight-vv.height-vv.offsetTop)+'px');vv.addEventListener('resize',fit);vv.addEventListener('scroll',fit);addEventListener('resize',fit);fit()}
