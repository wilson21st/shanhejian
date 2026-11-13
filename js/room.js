// js/room.js: the 书院 room stage. Part of index.html's map script (split into modules in v115; the import order is
// load-bearing, see the note at the top of js/geo.js).
import * as THREE from 'three';
import { MOUNT_G, U } from './terrain.js';
import { cam, scene } from './scene.js';
/* ---------- the 书院 room (Wilson 2026-11-07: "将个背景变成时空沙盘…幅画挂喺半空有啲怪"; the round-11 书院 is the only version
   since 20:01 — the painted-sky handscroll and the 木沙盘台 / 军帐 / 书案 / 沙盘本体 mocks were removed).
   The map lies as an open scroll on a desk in a real room that moves with pan, zoom, twist and tilt. ---------- */
export const STG={hide:[],tick:null,css:'#efe9dc'};
// the mount's rolls, knobs and 带 stay out of the 勾勒 depth pass (jaggies fix 2026-11-07, Wilson: "沙盘一左一右有锯齿"): that pass
// runs at half resolution, so the ink line it traced along each long slanted roll came out as a 2-pixel staircase, while the
// rolls themselves are now anti-aliased (MSAA colour target). The flat mount (first child) still takes part. test/alias-audit.mjs
for(const c of MOUNT_G.children.slice(1))STG.hide.push(c);
{
 const r0=(()=>{let a=11;return()=>(a=(a*16807)%2147483647)/2147483647})();
 const EDGEC={value:new THREE.Color(.86,.85,.82)}; // the dome's colour, seen only past the far clip
 const VS=`varying vec3 vW,vN;varying vec2 vUv;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vN=normalize(mat3(modelMatrix)*normal);vUv=uv;gl_Position=projectionMatrix*viewMatrix*w;}`;
 const CT=(w,h,f,rep)=>{const c=document.createElement('canvas');c.width=w;c.height=h;f(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);if(rep){t.wrapS=t.wrapT=THREE.RepeatWrapping}t.anisotropy=4;return t};
 // the room's far backdrop: a direction-only sphere that rides with the camera (seen only past the floor's far clip)
 const dome=new THREE.Mesh(new THREE.SphereGeometry(4500,24,12),new THREE.ShaderMaterial({side:THREE.BackSide,depthTest:false,depthWrite:false,uniforms:{c0:{value:EDGEC.value}},
   vertexShader:`void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform vec3 c0;void main(){gl_FragColor=vec4(c0,1.);}`}));
 dome.renderOrder=-10;dome.frustumCulled=false;scene.add(dome);STG.hide.push(dome);
 STG.tick=()=>dome.position.copy(cam.position);
 { /* 书院 (round-11 V0 picked by Wilson 2026-11-07): the map is the open scroll on a low 壸门托泥 desk
     (round 4's D1) on a 竹簟 with a 黛青 包边, in a plain Song study: matte grey 方砖, 粉墙, and on the axis a ~3 m window under a
     grand 竹帘 (帘额, 天青 cords and tassels) looking out on a 勾阑, bamboo, mist and 王希孟《千里江山图》; a 梅 sprig in a 汝窑 vase at
     the desk's left end, the 香几 with its 奁式炉 and a thread of incense smoke on the plain wall to the right. Ported from the
     round-11 still mock (since trashed) for a phone: no lights, shadow maps, environment maps or PBR — one unlit shader with
     the window's light baked in by normal (sky above, the window behind, a soft fill from the room), painted contact shadows,
     geometry merged per material, canvas textures drawn without ctx.filter (iOS ignores it). Units ≈ mm: the map is 1.4 m. */
  const S=new THREE.Group();scene.add(S);STG.hide.push(S); // the whole room stays out of the 勾勒 depth pass
  cam.far=16000;cam.updateProjectionMatrix(); // the 千里江山 plate stands ~7 m beyond the window
  const TOP=-10,MATY=6,FY=-370,TW=2240,TD=1000,BACK=-1500,WH=3400,WX0=-1500,WX1=1500,WS=FY+540,WT=FY+2250,WD=240,FR=90,TL=110,BW=WX1-WX0,WZ=BACK-WD/2,FLW=12150,FLD=8910,XW=5200;
  const A=(geo,mat,x=0,y=0,z=0,p=S)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);p.add(m);return m};
  const box=(w,h,d)=>new THREE.BoxGeometry(w,h,d),plane=(w,h)=>new THREE.PlaneGeometry(w,h),V2=(a,b)=>new THREE.Vector2(a,b),V3=(a,b,c)=>new THREE.Vector3(a,b,c);
  // the room's one material: texture × colour, lit by a baked rig (ambient + sky by n.y + the window's light from behind and above + a warm
  // fill from the room side), or unlit for the view outside; uv from the mesh or from world xz / xy / zy (uW 1/2/3) so one tiled
  // texture serves every wall part
  const SM=(o={})=>new THREE.ShaderMaterial({side:o.side||THREE.FrontSide,transparent:!!o.tr,depthWrite:o.dw??!o.tr,blending:o.add?THREE.AdditiveBlending:THREE.NormalBlending,
    polygonOffset:!!o.po,polygonOffsetFactor:-1,polygonOffsetUnits:-4,
    uniforms:{map:{value:o.map||null},uCol:{value:new THREE.Color(...(o.col||[1,1,1]))},uUse:{value:o.map?1:0},uRep:{value:V2(...(o.rep||[1,1]))},uW:{value:o.wuv||0},
      uK:{value:new THREE.Vector4(o.amb??.46,o.g??1,o.unlit?1:0,o.at??0)},uOp:{value:o.op??1},uSat:{value:o.sat??1}},vertexShader:VS,
    fragmentShader:`uniform sampler2D map;uniform vec3 uCol;uniform float uUse,uOp,uSat,uW;uniform vec2 uRep;uniform vec4 uK;varying vec3 vW,vN;varying vec2 vUv;
     void main(){vec2 uv=uW<.5?vUv*uRep:uW<1.5?vW.xz/uRep:uW<2.5?vW.xy/uRep:vW.zy/uRep;vec4 t=uUse>0.?texture2D(map,uv):vec4(1.);if(t.a<uK.w)discard;vec3 b=uCol*t.rgb;
      if(uK.z<.5){vec3 n=normalize(vN)*(gl_FrontFacing?1.:-1.);
       b*=(uK.x+.30*(.5+.5*n.y)+.40*max(dot(n,vec3(.06,.84,-.54)),0.)+.30*max(dot(n,vec3(-.31,.46,.83)),0.))*vec3(1.,.985,.96);}
      b*=uK.y;float y=dot(b,vec3(.3,.59,.11));gl_FragColor=vec4(mix(vec3(y),b,uSat),t.a*uOp);}`});
  const spot=(g,x,y,rx,ry,rgb,a,rot=0)=>{g.save();g.translate(x,y);g.rotate(rot);g.scale(Math.max(rx,.01),Math.max(ry,.01));const gr=g.createRadialGradient(0,0,0,0,0,1);gr.addColorStop(0,`rgba(${rgb},${a})`);gr.addColorStop(1,`rgba(${rgb},0)`);g.fillStyle=gr;g.beginPath();g.arc(0,0,1,0,7);g.fill();g.restore()};
  // wood: dark 栗壳 lacquer over straight-grained 楠/榉 — long fine wavy lines and a faint cathedral figure
  const grain=(g,w,h,vert,dark)=>{g.fillStyle=dark?'#2a1912':'#3e2619';g.fillRect(0,0,w,h);const L=vert?w:h,M=vert?h:w,n=Math.min(700,Math.round(w*h/250));
    for(let i=0;i<n;i++){const p=r0()*L,a=.03+r0()*.09,ph=r0()*9,amp=1+r0()*5;g.strokeStyle=r0()<.62?`rgba(22,10,6,${a})`:`rgba(128,84,54,${a*.7})`;g.lineWidth=.4+r0()*1.4;g.beginPath();
      for(let q=-10;q<=M+10;q+=16){const o=Math.sin(q*.004+ph)*amp;vert?(q<0?g.moveTo(p+o,q):g.lineTo(p+o,q)):(q<0?g.moveTo(q,p+o):g.lineTo(q,p+o))}g.stroke()}
    for(let k=0;k<4;k++){const cx=r0()*w,cy=r0()*h;for(let r=6;r<70;r+=7){g.strokeStyle='rgba(30,14,8,.045)';g.lineWidth=1.2;g.beginPath();vert?g.ellipse(cx,cy,r*.5,r*4,0,0,7):g.ellipse(cx,cy,r*4,r*.5,0,0,7);g.stroke()}}};
  const wood=(w,h,vert,dark)=>CT(w,h,g=>grain(g,w,h,vert,dark));
  const wH=SM({map:wood(512,64,false),g:1.18}),wV=SM({map:wood(64,512,true),g:1.18}),wDark=SM({map:wood(64,512,true,true),g:1.1}),lac=SM({col:[.18,.11,.08],g:1.1});
  // painted contact shadows: one soft disc texture per falloff, a material per strength (merged later)
  const blobT={},blobM={},blob=(w,d,a,x,y,z,r=.4)=>{const kt=r.toFixed(2),km=kt+'|'+a;
    blobT[kt]=blobT[kt]||CT(128,128,(g,W)=>{const gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(8,6,4,1)');gr.addColorStop(r,'rgba(8,6,4,.5)');gr.addColorStop(1,'rgba(8,6,4,0)');g.fillStyle=gr;g.fillRect(0,0,W,W)});
    blobM[km]=blobM[km]||SM({map:blobT[kt],unlit:1,tr:1,op:a,po:1});const m=A(plane(w,d).rotateX(-Math.PI/2),blobM[km],x,y,z);m.renderOrder=1;return m};
  // ---------- the desk: a 平头 top with a 冰盘沿 step over round 4's D1 base — four 壸门 side boards with a 阳线 bead, a 托泥 frame on 龟脚
  {const sx=1024/TW,sz=512/TD,SW=1600,SD=910;
   const topT=CT(1024,512,(g,w,h)=>{grain(g,w,h,false);g.fillStyle='#000';g.shadowOffsetX=4000; // the scroll's soft shadow, painted in (shadowBlur, not ctx.filter)
     g.shadowColor='rgba(10,4,2,.6)';g.shadowBlur=10;g.fillRect((TW-SW)/2*sx-4000,(TD-SD)/2*sz+3,SW*sx,SD*sz+4);
     g.shadowColor='rgba(10,4,2,.3)';g.shadowBlur=26;g.fillRect((TW-SW)/2*sx-4008,(TD-SD)/2*sz,SW*sx+16,SD*sz+18)});
   A(box(TW,22,TD),SM({map:topT,g:1.15}),0,TOP-11,0);A(box(TW-16,12,TD-16),wH,0,TOP-28,0)}
  const feet=[],aoLines=[];
  {const GJ=14,TN=42,PT=24,IN=30,P0=FY+MATY+GJ+TN,P1=TOP-34,PHh=P1-P0,LXo=TW/2-IN,LZo=TD/2-IN,KH=.78;
   const KUN=[[0,.25,0,.42,0,.52],[0,.68,.04,.76,.08,.71],[.095,.685,.105,.655,.125,.67],[.14,.79,.22,.85,.31,.84],[.39,.83,.45,.86,.47,.92],[.485,.95,.495,.975,.5,1]];
   const kun=(s,x0,w,h)=>{const P=(u,v)=>[x0+u*w,v*h];for(const [a,b,c,d,e,f] of KUN)s.bezierCurveTo(...P(a,b),...P(c,d),...P(e,f));
     for(let i=KUN.length-1;i>=0;i--){const [a,b,c,d]=KUN[i],e=i?KUN[i-1].slice(4):[0,0];s.bezierCurveTo(...P(1-c,d),...P(1-a,b),...P(1-e[0],e[1]))}};
   const panel=(L,ops)=>{const s=new THREE.Shape();s.moveTo(0,0);for(const [x0,w] of ops){s.lineTo(x0,0);kun(s,x0,w,PHh*KH)}s.lineTo(L,0);s.lineTo(L,PHh);s.lineTo(0,PHh);s.lineTo(0,0);
     const g=new THREE.ExtrudeGeometry(s,{depth:PT-3,bevelEnabled:true,bevelThickness:1.5,bevelSize:1.5,bevelSegments:1,curveSegments:14});
     const p=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/L,p.getY(i)/PHh+p.getZ(i)*.002);return g};
   const bead=(x0,w)=>{const path=new THREE.Path();path.moveTo(x0,0);kun(path,x0,w,PHh*KH);return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path.getSpacedPoints(90).map(q=>V3(q.x,q.y,0))),140,3.4,5)};
   const Ll=LXo*2,Le=LZo*2-PT*2,EP=118,MP=92,wl=(Ll-2*EP-2*MP)/3,opsL=[0,1,2].map(i=>[EP+i*(wl+MP),wl]),opsE=[[EP,Le-2*EP]],gL=panel(Ll,opsL),gE=panel(Le,opsE);
   for(const sz of[-1,1]){const grp=new THREE.Group();grp.position.set(-LXo,P0,sz>0?LZo-PT+1.5:-LZo+1.5);S.add(grp);A(gL,wH,0,0,0,grp);for(const [x0,w] of opsL)A(bead(x0,w),wH,0,0,sz>0?PT-1.5:-1.5,grp)}
   for(const sx of[-1,1]){const grp=new THREE.Group();grp.rotation.y=-sx*Math.PI/2;grp.position.set(sx*(LXo-1.5),P0,sx*(-LZo+PT));S.add(grp);A(gE,wH,0,0,0,grp);for(const [x0,w] of opsE)A(bead(x0,w),wH,0,0,-1.5,grp)}
   for(const y of[P1-9,P0+5]){for(const sz of[-1,1])A(new THREE.CylinderGeometry(3.6,3.6,Ll,6).rotateZ(Math.PI/2),wH,0,y,sz*(LZo+1));for(const sx of[-1,1])A(new THREE.CylinderGeometry(3.6,3.6,LZo*2,6).rotateX(Math.PI/2),wH,sx*(LXo+1),y,0)}
   const TO=18,TWd=60,ox=LXo+TO,oz=LZo+TO,TY=FY+MATY;
   for(const sz of[-1,1])A(box(ox*2,TN,TWd),wH,0,TY+GJ+TN/2,sz*(oz-TWd/2));for(const sx of[-1,1])A(box(TWd,TN,oz*2-TWd*2+2),wH,sx*(ox-TWd/2),TY+GJ+TN/2,0);
   for(const sx of[-1,1])for(const sz of[-1,1]){const x=sx*(ox-34),z=sz*(oz-34);A(box(64,GJ+2,64),wDark,x,TY+GJ/2,z);feet.push([x,z])}
   for(const sz of[-1,1])aoLines.push([0,sz*(oz-TWd/2),ox*2+60,120]);for(const sx of[-1,1])aoLines.push([sx*(ox-TWd/2),0,120,oz*2+60])}
  // ---------- floor: matte grey 方砖 (≈405 mm) laid straight, each brick its own tone, firing clouds, pores, worn arrises, lime joints;
  // one 4×4-brick tile repeated in world space, a darker band of grime toward the wall foot
  {const t=256,jn=1.6,brick=CT(1024,1024,(g,w,h)=>{g.fillStyle='#a19d93';g.fillRect(0,0,w,h);
     for(let i=0;i<4;i++)for(let j=0;j<4;j++){const x=i*t,y=j*t,L=116+(r0()-.5)*22,cool=(r0()-.5)*5,c=r0();g.save();g.beginPath();g.rect(x+jn,y+jn,t-jn*2,t-jn*2);g.clip();
       g.fillStyle=`rgb(${L-1-cool|0},${L+1|0},${L+2+cool|0})`;g.fillRect(x,y,t,t);
       for(let q=0;q<14;q++)spot(g,x+r0()*t,y+r0()*t,30+r0()*90,20+r0()*60,r0()<.5?'58,60,62':'168,168,162',.05+r0()*.07,r0()*3);
       g.lineWidth=.8;for(let q=0;q<20;q++){g.strokeStyle=`rgba(${r0()<.5?'190,190,184':'60,62,62'},${.025+r0()*.03})`;g.beginPath();g.arc(x+c*t*1.4-t*.2,y+t*1.3,60+q*7,Math.PI*1.1,Math.PI*1.9);g.stroke()}
       for(let q=0;q<420;q++){const d=r0()<.7;g.fillStyle=d?`rgba(36,38,40,${.12+r0()*.28})`:`rgba(206,204,196,${r0()*.22})`;const s=d?.7+r0()*1.3:1;g.fillRect(x+r0()*t,y+r0()*t,s,s)}
       g.strokeStyle='rgba(30,30,30,.22)';g.lineWidth=2.4;g.strokeRect(x+jn+1.2,y+jn+1.2,t-jn*2-2.4,t-jn*2-2.4);g.strokeStyle=`rgba(190,188,180,${.10+r0()*.08})`;g.lineWidth=3;g.strokeRect(x+jn+3,y+jn+3,t-jn*2-6,t-jn*2-6);
       if(r0()<.22){const cx=x+(r0()<.5?jn+2:t-jn-2),cy=y+(r0()<.5?jn+2:t-jn-2),r=4+r0()*6;g.fillStyle='rgba(70,70,68,.75)';g.beginPath();g.moveTo(cx,cy);g.lineTo(cx+(cx>x+t/2?-r:r),cy);g.lineTo(cx,cy+(cy>y+t/2?-r:r));g.fill()}
       g.restore()}
     g.fillStyle='rgba(80,78,72,.22)';for(let i=0;i<=4;i++){g.fillRect(i*t-1.5,0,3,h);g.fillRect(0,i*t-1.5,w,3)}},true); // joints 3 texels wide: thinner ones shimmered far off
   A(plane(FLW,FLD).rotateX(-Math.PI/2),SM({map:brick,wuv:1,rep:[1620,1620],col:[.9,.97,1.04],g:.64}),0,FY,BACK+FLD/2);
   const grime=CT(16,128,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'rgba(20,18,16,.45)');gr.addColorStop(1,'rgba(20,18,16,0)');g.fillStyle=gr;g.fillRect(0,0,w,h)});
   A(plane(FLW,700).rotateX(-Math.PI/2),SM({map:grime,unlit:1,tr:1,po:1}),0,FY+.5,BACK+350).renderOrder=1;
   A(plane(FLW,700),SM({map:CT(16,128,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'rgba(30,24,18,0)');gr.addColorStop(1,'rgba(30,24,18,.35)');g.fillStyle=gr;g.fillRect(0,0,w,h)}),unlit:1,tr:1,po:1}),0,FY+350,BACK+1.5).renderOrder=1}
  // ---------- 粉墙 with the window: one clean 3 m opening, a low sill, real reveals, a heavy frame with 贴脸 线脚
  const plaster=CT(512,512,(g,w,h)=>{g.fillStyle='#f1ebdf';g.fillRect(0,0,w,h);for(let i=0;i<900;i++){const r=2+r0()*12;spot(g,r0()*w,r0()*h,r,r,r0()<.5?'150,140,120':'255,255,250',r0()*.04)}},true);
  const wallXY=SM({map:plaster,wuv:2,rep:[2400,2400],g:.9}),wallZY=SM({map:plaster,wuv:3,rep:[2400,2400],g:.8});
  {const part=(x0,x1,y0,y1)=>A(plane(x1-x0,y1-y0),wallXY,(x0+x1)/2,(y0+y1)/2,BACK);part(-FLW/2,WX0,FY,FY+WH);part(WX1,FLW/2,FY,FY+WH);part(WX0,WX1,FY,WS);part(WX0,WX1,WT,FY+WH);
   const rev=SM({col:[.90,.875,.82]}),back=(x0,x1,y0,y1)=>A(box(x1-x0,y1-y0,WD),rev,(x0+x1)/2,(y0+y1)/2,BACK-WD/2-4);back(-1800,WX0,FY,FY+WH);back(WX1,1800,FY,FY+WH);back(WX0,WX1,FY,WS);back(WX0,WX1,WT,FY+WH);
   for(const sx of[-1,1])A(plane(FLD,WH).rotateY(-sx*Math.PI/2),wallZY,sx*XW,FY+WH/2,BACK+FLD/2);
   A(plane(2*XW,WH).rotateY(Math.PI),wallXY,0,FY+WH/2,4800);A(box(2*XW,140,40),lac,0,FY+70,4780); // the wall behind the seat, seen when the view is turned round; the 座屏 stands before it
   A(box(FLW,140,40),lac,0,FY+70,BACK+20); // 地栿
   for(const x of[-3600,3600])A(box(220,WH,220),wDark,x,FY+WH/2,BACK+110); // 柱
   A(box(FLW,260,200),wDark,0,FY+WH-130,BACK+100); // 阑额
   const board=CT(256,256,(g,w,h)=>{g.fillStyle='#3a2a20';g.fillRect(0,0,w,h);for(let x=0;x<w;x+=32){g.fillStyle=`rgba(${r0()<.5?'20,12,8':'90,66,48'},.25)`;g.fillRect(x,0,30,h);g.fillStyle='rgba(12,8,6,.6)';g.fillRect(x+30,0,2,h)}},true);
   A(plane(FLW,FLD).rotateX(Math.PI/2),SM({map:board,wuv:1,rep:[1200,1200]}),0,FY+WH,BACK+FLD/2); // a plain board ceiling
   const fM=SM({map:wood(64,512,true),g:1.35}),fH=SM({map:wood(512,64,false),g:1.35});
   A(box(FR,WT-WS+FR,WD+40),fM,WX0-FR/2+5,(WS+WT+FR)/2,WZ+20);A(box(FR,WT-WS+FR,WD+40),fM,WX1+FR/2-5,(WS+WT+FR)/2,WZ+20);
   A(box(BW+FR*2,FR,WD+40),fH,0,WT+FR/2-5,WZ+20);A(box(BW,40,WD+20),fH,0,WS+20,WZ+10);
   const ZF=BACK+40,X0=WX0-FR+5,X1=WX1+FR-5,YT=WT+FR-5;
   for(const sx of[-1,1]){const xi=sx<0?X0:X1;A(box(TL,YT-WS+TL,24),fM,xi+sx*TL/2,(WS+YT+TL)/2,BACK+12);A(new THREE.CylinderGeometry(8,8,YT-WS+6,8),fM,xi+sx*6,(WS+YT)/2+3,ZF+2);A(box(18,YT-WS+TL+18,12),fM,xi+sx*(TL+9),(WS+YT+TL+18)/2,BACK+6)}
   A(box(X1-X0+TL*2,TL,24),fH,0,YT+TL/2,BACK+12);A(new THREE.CylinderGeometry(8,8,X1-X0+12,8).rotateZ(Math.PI/2),fH,0,YT-6,ZF+2);A(box(X1-X0+TL*2+36,18,12),fH,0,YT+TL+9,BACK+6);
   A(box(BW+FR*2+TL*2+60,44,WD+150),fH,0,WS-22,WZ+60); // 窗台
   A(new THREE.CylinderGeometry(5,5,BW+FR*2+TL*2+40,8).rotateZ(Math.PI/2),fH,0,WS-50,WZ+128);A(box(BW+FR*2+TL*2,70,20),fH,0,WS-79,BACK+10)}
  // ---------- 竹帘 let down a third: fine slats with light between, a tight roll at the hem, a 帘额 across the top, 天青 cords knotted
  // under it whose free ends hang past the roll in tassels
  {const LW=BW-16,LTOP=WT-6,LBOT=WT-(WT-WS)*.36,LNZ=WZ+58,RR=40,VAL=170,ry=RR*.9,cy=LBOT-RR+6,cz=LNZ+RR*.4;
   const lianT=CT(1024,512,(g,w,h)=>{g.clearRect(0,0,w,h);for(let y=0;y<h;y+=6){const c=184+r0()*18|0;g.fillStyle='rgba(70,48,22,.34)';g.fillRect(0,y+4.5,w,1.5);
       const gr=g.createLinearGradient(0,y,0,y+4.5);gr.addColorStop(0,`rgb(${c+14},${c-10},${c-54})`);gr.addColorStop(1,`rgb(${c-22},${c-46},${c-86})`);g.fillStyle=gr;g.fillRect(0,y,w,4.5);
       for(let k=0;k<2;k++)if(r0()<.5){g.fillStyle='rgba(120,88,44,.4)';g.fillRect(r0()*w,y,3,4.5)}}
     for(let k=1;k<12;k++)for(const d of[-1.3,1.3]){g.fillStyle='rgba(58,52,44,.8)';g.fillRect(w*k/12+d-.5,0,1,h)}});
   A(plane(LW,LTOP-LBOT),SM({map:lianT,tr:1,side:THREE.DoubleSide,g:1.05}),0,(LTOP+LBOT)/2,LNZ).renderOrder=3;
   const rt=CT(512,256,(g,w,h)=>{g.fillStyle='#4e3c22';g.fillRect(0,0,w,h);for(let x=0;x<w;x+=5){const c=166+r0()*34|0;g.fillStyle=`rgb(${c},${c-30},${c-76})`;g.fillRect(x+1,0,3.6,h);g.fillStyle='rgba(30,18,6,.7)';g.fillRect(x,0,1,h)}},true);
   const L=LW+6,xc=LW*.3,yOff=x=>Math.abs(x)<xc?-5*(1-(x/xc)**2):-3*((Math.abs(x)-xc)/(L/2-xc))**2,lump=x=>1+.02*Math.sin(x*.013)-.06*Math.exp(-(((Math.abs(x)-xc)/30)**2));
   const rg=new THREE.CylinderGeometry(RR,RR,L,20,90).rotateZ(Math.PI/2),p=rg.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),s=lump(x);p.setXYZ(i,x,p.getY(i)*s*ry/RR+yOff(x),p.getZ(i)*s)}rg.computeVertexNormals();
   A(rg,SM({map:rt,rep:[2,1]}),0,cy,cz);
   const endT=CT(128,128,(g,w)=>{g.translate(64,64);g.fillStyle='#6b522c';g.beginPath();g.arc(0,0,62,0,7);g.fill();g.strokeStyle='rgba(36,22,8,.75)';g.lineWidth=1;g.beginPath();for(let t=0;t<20*6.283;t+=.08){const r=3+t*.47;g.lineTo(Math.cos(t)*r,Math.sin(t)*r)}g.stroke()});
   for(const sx of[-1,1]){const e=A(new THREE.CircleGeometry(RR*lump(sx*L/2)-.5,20).rotateY(sx*Math.PI/2),SM({map:endT}),sx*(L/2+.2),cy+yOff(sx*L/2),cz);e.scale.set(1,ry/RR,1)}
   const cordM=SM({col:[.44,.56,.54]}),capM=SM({col:[.31,.43,.41]}),tasM=SM({map:CT(32,128,(g,w,h)=>{g.fillStyle='#6f8f8a';g.fillRect(0,0,w,h);for(let x=0;x<w;x+=2){g.fillStyle=`rgba(${r0()<.5?'30,50,48':'200,220,214'},${.2+r0()*.3})`;g.fillRect(x,0,1,h)}})}),KY=LTOP-VAL-26;
   for(const u of[-.3,.3]){const x=LW*u,rc=RR*lump(LW*u)+3,pts=[[x,KY,cz+rc+5]];for(let k=0;k<=12;k++){const th=-Math.PI*k/12;pts.push([x,cy+rc*ry/RR*Math.sin(th),cz+rc*Math.cos(th)])}pts.push([x,KY,cz-rc]);
     A(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(q=>V3(...q))),70,4,5),cordM);A(new THREE.SphereGeometry(14,10,8),cordM,x,KY,cz+rc+6);
     for(const [dx,len] of[[-14,520],[14,440]]){const bx=x+dx,y1=KY-len;A(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(x,KY,cz+rc+10),V3(bx,KY-60,cz+rc+16),V3(bx,y1,cz+rc+18)]),20,4.6,5),cordM);
       A(new THREE.SphereGeometry(15,10,8),cordM,bx,y1-8,cz+rc+18);A(new THREE.CylinderGeometry(12,16,34,10),capM,bx,y1-36,cz+rc+18);A(new THREE.CylinderGeometry(15,32,230,14,1),tasM,bx,y1-53-115,cz+rc+18)}}
   const vt=CT(1024,128,(g,w,h)=>{g.fillStyle='#dedacd';g.fillRect(0,0,w,h);const E='#46585a';g.fillStyle=E;g.fillRect(0,0,w,23);g.fillRect(0,h-29,w,29);g.fillStyle='#d8d6c8';g.fillRect(0,25,w,2);g.fillRect(0,h-33,w,2)});
   const vg=new THREE.PlaneGeometry(BW+10,VAL,120,1),q=vg.attributes.position;for(let i=0;i<q.count;i++){const x=q.getX(i),y=q.getY(i),f=.4+.6*(VAL/2-y)/VAL;q.setZ(i,(Math.sin(x/150*Math.PI*2)*7+Math.sin(x/150*5.1)*2)*f)}vg.computeVertexNormals();
   A(vg,SM({map:vt,side:THREE.DoubleSide,g:1.05}),0,WT-VAL/2-2,BACK-6)}
  // ---------- the view: near, the 寻杖 of a 单勾阑 on a terrace a step down and a clump of bamboo; a low band of mist; far, 《千里江山图》
  {const VZ=BACK-4200,VW=10400,VH=VW*1336/4096,VY=FY+1450,vm=new THREE.ShaderMaterial({uniforms:{map:{value:null}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
     fragmentShader:`uniform sampler2D map;varying vec2 vUv;void main(){vec3 c=texture2D(map,vUv).rgb;float y=dot(c,vec3(.3,.59,.11));c=mix(vec3(y),c,.88);float v=1.-vUv.y;
      float m=.6*(v<.4?mix(.22,.08,v/.4):v<.75?mix(.08,.04,(v-.4)/.35):mix(.04,.12,(v-.75)/.25));gl_FragColor=vec4(mix(c,vec3(.93,.94,.93),m),1.);}`});
   new THREE.TextureLoader().load('data/shuyuan/r3-view-qianli.jpg',t=>{t.anisotropy=4;vm.uniforms.map.value=t;view.visible=true});
   const view=A(plane(VW,VH),vm,0,VY,VZ);view.visible=false;view.userData.keep=1;
   A(plane(VW*1.6,5000),SM({col:[.925,.933,.914],unlit:1}),0,VY+VH/2+2500-4,VZ-2);A(plane(VW*1.6,3000),SM({col:[.79,.82,.80],unlit:1}),0,VY-VH/2-1500+4,VZ-2);
   const RZ=BACK-1800,RY=FY-150,RL=8400,rw=SM({map:wood(512,64,false),col:[1.5,1.5,1.5]});
   const stone=CT(512,128,(g,w,h)=>{g.fillStyle='#9d9a92';g.fillRect(0,0,w,h);for(let k=0;k<150;k++)spot(g,r0()*w,r0()*h,10+r0()*30,4+r0()*10,r0()<.5?'70,70,66':'200,198,190',.08);g.fillStyle='rgba(60,58,54,.5)';for(let x=0;x<w;x+=64)g.fillRect(x,0,2,h)},true);
   A(plane(RL+2000,(BACK-WD)-(RZ-600)).rotateX(-Math.PI/2),SM({map:stone,rep:[4,1],g:1.05}),0,RY,((BACK-WD)+(RZ-600))/2);A(box(RL,60,90),rw,0,RY+30,RZ);
   const PX=[-3800,-1900,1900,3800];for(const x of PX){A(box(100,1000,100),rw,x,RY+500,RZ);A(new THREE.CylinderGeometry(46,56,40,8),rw,x,RY+1020,RZ);A(new THREE.SphereGeometry(40,10,6,0,6.3,0,1.6),rw,x,RY+1040,RZ);A(new THREE.ConeGeometry(16,40,8),rw,x,RY+1090,RZ)}
   A(box(RL,34,70),rw,0,RY+520,RZ);A(new THREE.CylinderGeometry(24,24,RL,10).rotateZ(Math.PI/2),rw,0,RY+860,RZ);
   for(let x=-RL/2+200;x<RL/2;x+=400){if(PX.some(p=>Math.abs(p-x)<120))continue;A(box(34,330,34),rw,x,RY+700,RZ)}for(const y of[RY+180,RY+300,RY+420])A(box(RL,22,30),rw,0,y,RZ);
   // bamboo: culms with nodes, leaves in 个/介 sprays, drawn at half size so the upscale keeps them soft (out of the eye's focus)
   const bt=CT(256,512,(g,w,h)=>{g.scale(.25,.25);const W=1024,H=2048;g.lineCap='round';
     const culm=(x0,lean,wd,col)=>{g.strokeStyle=col;g.lineWidth=wd;g.beginPath();g.moveTo(x0,H);g.quadraticCurveTo(x0+lean*.4,H*.5,x0+lean,-20);g.stroke();
       for(let y=H-60;y>0;y-=150+r0()*60){const t=1-y/H,x=x0+lean*(t*t*.6+t*.4);g.strokeStyle='rgba(30,40,30,.8)';g.lineWidth=6;g.beginPath();g.moveTo(x-wd*.7,y);g.lineTo(x+wd*.7,y);g.stroke()}};
     const leaf=(x,y,a,L,col)=>{g.save();g.translate(x,y);g.rotate(a);g.fillStyle=col;g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(L*.35,-L*.09,L,0);g.quadraticCurveTo(L*.35,L*.09,0,0);g.fill();g.restore()};
     culm(560,120,26,'#33402f');culm(760,60,20,'#3c4a36');culm(380,180,16,'#46553f');
     for(let k=0;k<46;k++){const x=200+r0()*820,y=60+r0()*H*.62,base=r0()<.5?.4:2.6,n=3+(r0()*3|0),col=r0()<.3?'rgba(98,118,72,.95)':'rgba(44,58,40,.97)';
       g.strokeStyle=col;g.lineWidth=5;g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(base)*50,y+Math.sin(base)*40);g.stroke();
       for(let i=0;i<n;i++)leaf(x+Math.cos(base)*50,y+Math.sin(base)*40,base+(i-n/2)*.45+(r0()-.5)*.3+.9,120+r0()*90,col)}});
   A(plane(1500,3000),SM({map:bt,unlit:1,tr:1,at:.05,col:[.85,.85,.85],side:THREE.DoubleSide}),1500,FY+1100,BACK-2600).renderOrder=2;
   const mist=CT(8,128,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'rgba(240,242,240,0)');gr.addColorStop(.55,'rgba(240,242,240,.25)');gr.addColorStop(1,'rgba(240,242,240,.2)');g.fillStyle=gr;g.fillRect(0,0,w,h)});
   A(plane(14000,2200),SM({map:mist,unlit:1,tr:1}),0,FY+300,BACK-3600).renderOrder=1;
   const glow=CT(256,128,(g,w,h)=>{const gr=g.createRadialGradient(w/2,h/2,5,w/2,h/2,w/2);gr.addColorStop(0,'rgba(255,250,236,.55)');gr.addColorStop(.5,'rgba(255,248,232,.22)');gr.addColorStop(1,'rgba(255,248,232,0)');g.fillStyle=gr;g.fillRect(0,0,w,h)});
   A(plane(BW*1.5,(WT-WS)*1.6),SM({map:glow,unlit:1,tr:1,add:1,op:.12}),0,(WS+WT)/2,BACK+150).renderOrder=5}
  // ---------- painted shade: under the desk on the mat, at its feet and 托泥, round the mat
  const MY0=FY+MATY+1.5;blob(TW+420,TD+420,.34,0,MY0,0,.55);for(const [x,z] of feet)blob(170,170,.6,x,MY0+.5,z,.2);for(const [x,z,w,d] of aoLines)blob(w,d,.4,x,MY0+.3,z,.3);
  // ---------- the 席: a fine 竹簟 under the desk and on toward the seat, its 黛青 silk 包边 with a 月白 piping and stitches
  {const mw=2700,md=2800,mz=500,t=CT(1024,1062,(g,W,H)=>{const s=W/mw,B=62*s,strip=4;g.fillStyle='#c8b07c';g.fillRect(0,0,W,H);
     // strips exactly 4 texels (≈10 mm) on whole rows: a fractional 2.65-texel period aliased in the texture and its mipmaps and
     // crawled as the room turned (flicker-audit); a power-of-two period averages out cleanly down the mip chain
     for(let y=0;y<H;y+=strip){const q=r0();g.fillStyle=`rgb(${200+q*20|0},${178+q*18|0},${124+q*16|0})`;g.fillRect(0,y,W,3);g.fillStyle='rgba(86,64,30,.24)';g.fillRect(0,y+3,W,1);
       if(r0()<.3){g.fillStyle='rgba(120,90,40,.16)';g.fillRect(r0()*W,y,20+r0()*80,strip*.8)}}
     g.fillStyle='rgba(86,64,34,.06)';for(let x=0;x<W;x+=16)g.fillRect(x,0,2,H);
     for(let k=0;k<220;k++)spot(g,r0()*W,r0()*H,12+r0()*45,2+r0()*4,r0()<.5?'255,244,210':'96,74,40',r0()*.045);
     g.fillStyle='#46585a';for(const [x,y,w2,h2] of[[0,0,W,B],[0,H-B,W,B],[0,0,B,H],[W-B,0,B,H]])g.fillRect(x,y,w2,h2);
     g.strokeStyle='#ddd9cb';g.lineWidth=5*s;g.strokeRect(B+2.5*s,B+2.5*s,W-B*2-5*s,H-B*2-5*s);
     g.strokeStyle='rgba(232,228,214,.75)';g.lineWidth=1.6*s;g.setLineDash([5*s,5*s]);g.strokeRect(B*.5,B*.5,W-B,H-B);g.setLineDash([]);g.strokeStyle='rgba(20,24,24,.5)';g.lineWidth=1;g.strokeRect(.5,.5,W-1,H-1)});
   A(box(mw,MATY,md),SM({map:t,g:.84,sat:.72}),0,FY+MATY/2,mz);blob(mw+160,md+160,.22,0,FY+1,mz,.8);
   }
  // ---------- 汝窑 纸槌瓶 with one 梅 sprig, at the desk's left end
  const ruT=CT(256,256,(g,w,h)=>{g.fillStyle='#87a9a1';g.fillRect(0,0,w,h);for(let k=0;k<30;k++){const r=15+r0()*30;spot(g,r0()*w,r0()*h,r,r,r0()<.5?'150,180,176':'196,214,206',.25)}
    g.strokeStyle='rgba(150,128,96,.28)';g.lineWidth=.6;for(let i=0;i<60;i++){let x=r0()*w,y=r0()*h;g.beginPath();g.moveTo(x,y);for(let k=0;k<5;k++){x+=(r0()-.5)*18;y+=(r0()-.5)*18;g.lineTo(x,y)}g.stroke()}});
  const ru=SM({map:ruT,g:1.08}),lathe=(pts,mat,x,y,z,p=S,n=28)=>A(new THREE.LatheGeometry(pts.map(([r,h])=>V2(r,h)),n),mat,x,y,z,p);
  {const vx=-TW/2+150,vz=-300;lathe([[0,0],[44,0],[46,2],[45,6],[48,8],[52,14],[53,96],[52,104],[47,111],[36,116],[18,119],[11,123],[10,132],[10.5,205],[12,212],[14,214],[13.5,219],[9,219],[9,214],[0,214]],ru,vx,TOP,vz);
   blob(260,230,.45,vx+30,TOP+1,vz+20,.3);
   const MY=TOP+219,br=SM({col:[.23,.17,.14]}),path=(pts,a,b)=>{const cv=new THREE.CatmullRomCurve3(pts.map(([x,y,z])=>V3(vx+x,MY+y,vz+z))),g=new THREE.TubeGeometry(cv,24,1,5),p=g.attributes.position,n=V3();
     for(let i=0;i<p.count;i++){const t=Math.floor(i/6)/24,c=cv.getPoint(Math.min(1,t));n.set(p.getX(i),p.getY(i),p.getZ(i)).sub(c).multiplyScalar(a+(b-a)*t).add(c);p.setXYZ(i,n.x,n.y,n.z)}A(g,br);return cv};
   const a=path([[0,-60,0],[2,30,1],[-10,120,4],[-6,190,6],[-30,262,10],[-48,318,14],[-84,362,18]],6.4,1.6),b=path([[-6,196,5],[24,238,10],[50,262,16],[72,268,20]],3.4,1.2);
   const petM=SM({col:[.98,.97,.95],amb:.62,side:THREE.DoubleSide}),sepM=SM({col:[.43,.16,.15]}),budM=SM({col:[.85,.70,.67]}),hrt=SM({col:[.84,.70,.32]}),petG=new THREE.SphereGeometry(7.2,8,4,0,Math.PI*2,0,.78).scale(1,.9,1.06),up=V3(0,1,0),FS=1.7;
   const flower=(p,dir,s,open)=>{const f=new THREE.Group();f.position.copy(p);f.quaternion.setFromUnitVectors(up,dir.normalize());f.scale.setScalar(s*FS);S.add(f);
     for(let i=0;i<5;i++){const pg=new THREE.Group();pg.rotation.y=i/5*Math.PI*2;f.add(pg);const m=new THREE.Mesh(petG,petM);m.position.set(open?6.2:3.6,open?1:3.4,0);m.rotation.z=-(open?1.05:.45);pg.add(m);
       const sp=new THREE.Mesh(new THREE.ConeGeometry(2.4,6,5),sepM);sp.position.set(3,-2.2,0);sp.rotation.z=-2.2;pg.add(sp)}A(new THREE.SphereGeometry(2.6,6,4),hrt,0,1.2,0,f)};
   const bud=(p,s)=>{const m=A(new THREE.SphereGeometry(4.4*s*FS,8,6),budM,p.x,p.y,p.z);m.scale.set(1,1.18,1)},off=(cv,t,d)=>cv.getPoint(t).add(d);
   flower(off(a,.62,V3(7,4,8)),V3(.55,.45,.75),1,true);flower(off(a,.86,V3(-6,6,7)),V3(-.4,.55,.7),.92,true);flower(off(b,.78,V3(2,7,4)),V3(.6,.7,.35),.82,false);
   bud(off(a,.44,V3(-5,2,4)),.9);bud(off(a,1,V3(0,3,0)),.75);bud(off(b,1,V3(2,2,0)),.7)}
  // ---------- right end: an 端石 砚 with its 墨锭, a brush on a small 笔搁; left end: two 卷轴 in silk
  {const rx=TW/2-190,st=SM({col:[.19,.155,.18]}),yan=new THREE.Group();yan.position.set(rx+10,TOP,240);yan.rotation.y=-.22;S.add(yan);
   A(box(124,22,196),st,0,11,0,yan);for(const sz of[-1,1])A(box(124,6,12),st,0,24,sz*92,yan);for(const sx of[-1,1])A(box(12,6,172),st,sx*56,24,0,yan);
   A(box(100,1,120),SM({col:[.42,.39,.41]}),0,22.6,22,yan);A(box(100,1,44),SM({col:[.03,.03,.035],unlit:1}),0,20,-62,yan);A(box(100,3,6),st,0,21.5,-38,yan);
   const mo=new THREE.Group();mo.position.set(-18,31,34);mo.rotation.y=.55;yan.add(mo);A(box(20,11,86),SM({col:[.07,.065,.07]}),0,0,0,mo);blob(240,310,.5,rx+10,TOP+1,245,.35);
   const bj=new THREE.Group();bj.position.set(TW/2-105,TOP,10);S.add(bj);const sh=new THREE.Shape();sh.moveTo(-34,0);sh.lineTo(34,0);sh.bezierCurveTo(34,10,24,16,18,14);sh.bezierCurveTo(12,12,8,22,0,24);sh.bezierCurveTo(-8,22,-12,12,-18,14);sh.bezierCurveTo(-24,16,-34,10,-34,0);
   const g=new THREE.ExtrudeGeometry(sh,{depth:16,bevelEnabled:true,bevelThickness:3,bevelSize:3,bevelSegments:1,curveSegments:6});g.translate(0,0,-8);A(g,wV,0,0,-80,bj);
   const brush=new THREE.Group();brush.position.set(0,20,30);brush.rotation.set(0,Math.PI/2,-.075);bj.add(brush);
   A(new THREE.CylinderGeometry(5,5.5,210,8).rotateZ(Math.PI/2),SM({col:[.54,.42,.25]}),0,0,0,brush);A(new THREE.CylinderGeometry(6,6.5,30,8).rotateZ(Math.PI/2),SM({col:[.16,.11,.08]}),120,0,0,brush);A(new THREE.ConeGeometry(6.5,44,8).rotateZ(-Math.PI/2),SM({col:[.1,.09,.08]}),157,0,0,brush);
   blob(120,300,.35,TW/2-105,TOP+1,30,.4);
   const g3=new THREE.Group();g3.position.set(-TW/2+150,TOP,200);g3.rotation.y=1.5;S.add(g3);const ivory=SM({col:[.85,.86,.81],amb:.55});
   const scroll=(len,r,col,x,y,z)=>{const s=new THREE.Group();s.position.set(x,y,z);g3.add(s);A(new THREE.CylinderGeometry(r,r,len,14).rotateZ(Math.PI/2),SM({col}),0,0,0,s);
     for(const sx of[-1,1])A(new THREE.CylinderGeometry(r*.62,r*.62,16,10).rotateZ(Math.PI/2),ivory,sx*(len/2+8),0,0,s);A(new THREE.TorusGeometry(r+.5,1.3,4,16).rotateY(Math.PI/2),SM({col:[.36,.42,.40]}),-len*.18,0,0,s)};
   scroll(300,17,[.80,.75,.62],0,17,-14);scroll(286,16,[.56,.64,.61],8,16,20);blob(210,420,.4,-TW/2+150,TOP+1,200,.45)}
  // ---------- the 香几 on the plain wall right of the window (留白 round it): round top, three slender incurved legs on a ring 托泥 with
  // 龟脚; on it the 汝窑 奁式炉 with raked ash and a smouldering 香饼, and a thread of smoke
  const XJ=[2250,-1050],xjH=1000;
  {const x=new THREE.Group();x.position.set(XJ[0],FY,XJ[1]);S.add(x);
   A(new THREE.CylinderGeometry(176,170,22,40),wH,0,xjH-11,0,x);A(new THREE.CylinderGeometry(140,140,22,40),wDark,0,xjH-38,0,x);A(new THREE.CylinderGeometry(150,150,40,40),wH,0,xjH-70,0,x);A(new THREE.CylinderGeometry(168,166,10,40),wH,0,xjH-26,0,x);
   lathe([[150,8],[184,8],[186,12],[186,26],[182,30],[152,30],[150,26],[150,8]],wH,0,0,0,x,48);
   for(let i=0;i<3;i++){const a=i/3*Math.PI*2+.5+Math.PI/3;A(box(38,10,38),wDark,Math.cos(a)*168,5,Math.sin(a)*150,x)}
   for(let i=0;i<3;i++){const a=i/3*Math.PI*2+.5,cv=new THREE.CatmullRomCurve3([[172,30],[162,44],[138,120],[116,400],[112,680],[124,xjH-120],[138,xjH-70]].map(([r,h])=>V3(Math.cos(a)*r,h,Math.sin(a)*r)));
     const lg=new THREE.TubeGeometry(cv,40,1,8),lp=lg.attributes.position,c=V3(),n=V3();
     for(let k=0;k<lp.count;k++){const t=Math.floor(k/9)/40,rr=11+6*Math.exp(-(((t-.9)/.08)**2))+(t<.06?4*(1-t/.06):0);cv.getPointAt(Math.min(1,t),c);n.set(lp.getX(k),lp.getY(k),lp.getZ(k)).sub(c).multiplyScalar(rr).add(c);lp.setXYZ(k,n.x,n.y,n.z)}lg.computeVertexNormals();
     A(lg,wV,0,0,0,x);A(new THREE.SphereGeometry(16,8,6),wV,Math.cos(a)*172,30,Math.sin(a)*172,x)}
   A(new THREE.TorusGeometry(118,7,6,40).rotateX(Math.PI/2),wV,0,300,0,x);
   lathe([[0,0],[60,0],[63,2],[64,8],[66.5,10],[66.5,15],[64,17],[64,64],[66.5,66],[66.5,71],[64,73],[64,80],[68,82],[68.5,86],[66,88],[59,88],[57,80],[57,14],[0,14]],ru,0,xjH+14,0,x,32);
   for(let i=0;i<3;i++){const a=i/3*Math.PI*2+.3,ft=A(new THREE.SphereGeometry(10,8,5,0,Math.PI*2,0,Math.PI/2),ru,Math.cos(a)*47,xjH+15,Math.sin(a)*47,x);ft.scale.set(1,1.5,1);ft.rotation.x=Math.PI}
   A(new THREE.CircleGeometry(57,24).rotateX(-Math.PI/2),SM({map:CT(128,128,(g,w,h)=>{g.fillStyle='#b9b5ad';g.fillRect(0,0,w,h);for(let k=0;k<600;k++){g.fillStyle=`rgba(${r0()<.5?'90,86,80':'236,232,224'},${r0()*.3})`;g.fillRect(r0()*w,r0()*h,1,1)}
     g.strokeStyle='rgba(120,114,104,.35)';g.lineWidth=.8;for(let r=15;r<64;r+=4.5){g.beginPath();g.arc(64,64,r,0,7);g.stroke()}})}),0,xjH+90,0,x);
   A(new THREE.CylinderGeometry(9,10,4,12),SM({col:[.45,.2,.12],unlit:1}),0,xjH+92,0,x);blob(520,520,.45,XJ[0],FY+3,XJ[1],.35)}
  {/* 袅袅 smoke: painted once on a canvas (a thin laminar stem that breaks into three twisting ribbons which lean apart, widen and fade,
     holes eaten out above, softened by a down-and-up scale instead of a blur filter) on a billboard that turns about its upright to face
     the eye; the shader sways the upper part and breathes its opacity, so it drifts gently at no cost */
   const SWm=700,SHm=1300,pf=.6,W=Math.round(SWm*pf),H=Math.round(SHm*pf),RGB='226,230,236',lay=document.createElement('canvas');lay.width=W;lay.height=H;const q=lay.getContext('2d');let ss=11;const sr=()=>(ss=(ss*16807)%2147483647)/2147483647;
   const ST=.14,AA=2.1,main=t=>W/2+(Math.sin(t*7+.5)*70*Math.max(0,t-ST*.7)+Math.sin(t*14+2)*6*t-40*t*t)*pf;
   for(const s of[{ts:ST,ph:0,amp:1,lean:10,wgt:1,wd:1},{ts:ST+.07,ph:2.1,amp:.8,lean:-170,wgt:.75,wd:.8},{ts:ST+.2,ph:4,amp:1.1,lean:140,wgt:.55,wd:.9}]){const N=520;
     for(let i=0;i<=N;i++){const t=i/N,y=H*(1-t*.98),u=Math.max(0,t-s.ts);if(u===0&&s.ts!==ST)continue;
       const x=main(t)+(s.lean*u**1.5+Math.sin(u*9+s.ph)*110*s.amp*u+Math.sin(u*23+s.ph*1.7)*22*u)*pf,fade=Math.min(1,t/.02)*Math.pow(1-t,1.5)*s.wgt*AA;
       if(u===0){spot(q,x,y,1.8*pf,3*pf,RGB,.5*fade);spot(q,x,y,5*pf,4*pf,RGB,.15*fade);continue}
       const hw=(3+340*u**1.1*s.wd)*.5,pw=Math.abs(Math.cos(u*13+s.ph))*hw+1.5,dens=Math.min(1,6/(pw+4));
       spot(q,x,y,pw*pf,4*pf,RGB,.25*fade*(.4+dens));for(const e of[-1,1])spot(q,x+e*pw*pf*.92,y,(1.2+u*5)*pf,4*pf,RGB,.5*fade*(.5+.5*dens));spot(q,x,y,(pw*1.8+10)*pf,7*pf,RGB,.045*fade)}}
   q.globalCompositeOperation='destination-out';for(let k=0;k<120;k++){const t=.25+sr()*.75,r=(6+sr()*30)*pf*t;spot(q,W/2+(sr()-.5)*W*.8,H*(1-t),r,r*(1+sr()*1.5),'0,0,0',(.2+sr()*.5)*t)}
   const sc=(d)=>{const c=document.createElement('canvas');c.width=Math.max(1,W/d|0);c.height=Math.max(1,H/d|0);c.getContext('2d').drawImage(lay,0,0,c.width,c.height);return c},h2=sc(2),h8=sc(8);
   const sT=CT(W,H,g=>{g.drawImage(h2,0,0,W,H);g.globalAlpha=.5;g.drawImage(h8,0,0,W,H)});
   const sm=new THREE.Mesh(plane(SWm,SHm).translate(0,SHm/2,0),new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{map:{value:sT},uCam:U.uCam,uTime:U.uTime},
     vertexShader:`uniform vec3 uCam;varying vec2 vUv;void main(){vUv=uv;vec3 c=(modelMatrix*vec4(0.,0.,0.,1.)).xyz,d=uCam-c;d.y=0.;vec3 r=normalize(vec3(d.z,0.,-d.x)+1e-5);gl_Position=projectionMatrix*viewMatrix*vec4(c+r*position.x+vec3(0.,position.y,0.),1.);}`,
     fragmentShader:`uniform sampler2D map;uniform float uTime;varying vec2 vUv;void main(){float t=vUv.y;vec2 uv=vUv;uv.x+=(sin(t*5.-uTime*.55)*.035+sin(t*11.+uTime*.9)*.012)*smoothstep(.08,.5,t);
      float a=texture2D(map,uv).a*(.88+.12*sin(uTime*.4+t*4.));gl_FragColor=vec4(.886,.902,.925,a);}`}));
   sm.position.set(XJ[0],FY+xjH+88,XJ[1]);sm.renderOrder=4;sm.frustumCulled=false;sm.userData.keep=1;S.add(sm)}
  // ---------- 座屏 behind the seat (Wilson 2026-11-07: the room turns all the way round, so the wall at the sitter's back gets a big
  // painted screen). Song rooms set the main seat before a 屏风 (台北故宫 宋人《人物》「榻後有座屏風」; 「畫中畫」的屏風多填飾以山水 —
  // hs-shuyuan-r5 verify.md), here on the room's axis behind the 席: one wide panel (3.9 × 2 m, wide and low like the 枕屏 of
  // 南宋《槐荫消夏图》, so a seated eye turned round sees the picture rather than the frame) of 王诜《渔村小雪图》 (北宋, public domain;
  // the right-hand section with the pine and the snowy peaks, 乾隆's inscription and seals removed in round 6: data/shuyuan/song-screen.jpg)
  // in a 月白 silk border, a dark 栗壳 frame with an inner 阳线 bead and a softened outer 混面, a 绦环板 with a 鱼门 opening, two 抱柱
  // standing in 桥形 墩子 with 站牙 both faces, and a 披水牙子 apron. It stands free 450 mm off the back wall, past where the camera
  // may go (z 3800), so it never blocks the seated view. Front faces −z (the desk).
  {const SZ=4350,PW=3400,PHt=PW*780/2048,SB=60,FW=84,FD=56,QH=150,LIFT=170,POST=96,IW=PW+SB*2,IH=PHt+SB*2,Y0=LIFT+FW+QH+FW,TOPY=Y0+IH+FW,OW=IW+POST*2;
   const sg=new THREE.Group();sg.position.set(0,FY,SZ);sg.rotation.y=Math.PI;S.add(sg); // local +z → world −z, toward the desk
   const fH=SM({map:wood(512,64,false,true),g:1.12}),fV=wDark;
   const scrM=SM({map:CT(4,4,g=>{g.fillStyle='#b9ab8c';g.fillRect(0,0,4,4)}),g:1.02,sat:.92,amb:.5});
   new THREE.TextureLoader().load('data/shuyuan/song-screen.jpg',t=>{t.anisotropy=4;scrM.uniforms.map.value=t});
   A(box(IW,IH,10),SM({col:[.86,.86,.81],g:.95}),0,Y0+IH/2,0,sg); // 月白 silk border
   A(plane(PW,PHt),scrM,0,Y0+IH/2,6,sg);
   const rail=(w,y)=>A(box(w,FW,FD),fH,0,y,0,sg);rail(IW,TOPY-FW/2);rail(IW,Y0-FW/2);rail(IW,LIFT+FW/2);
   for(const sx of[-1,1]){A(box(POST,TOPY+50,FD+8),fV,sx*(IW/2+POST/2),(TOPY+50)/2,0,sg); // 抱柱, down into the 墩子
     A(box(POST+22,26,FD+30),fV,sx*(IW/2+POST/2),TOPY+50+13,0,sg); // 帽
     for(const sz of[-1,1])A(new THREE.CylinderGeometry(9,9,TOPY+40,10),fV,sx*(IW/2+POST),(TOPY+40)/2,sz*(FD/2+4),sg)} // 混面 on the outer arris
   // inner 阳线 bead round the picture, both faces; a second round the 绦环板
   const bead=(w,h,y,z,r=7)=>{for(const sy of[-1,1])A(new THREE.CylinderGeometry(r,r,w+r*2,10).rotateZ(Math.PI/2),fH,0,y+sy*h/2,z,sg);for(const sx of[-1,1])A(new THREE.CylinderGeometry(r,r,h,10),fV,sx*w/2,y,z,sg)};
   for(const z of[FD/2,-FD/2]){bead(IW,IH,Y0+IH/2,z);bead(IW,QH,LIFT+FW+QH/2,z,5)}
   A(box(IW,QH,20),fV,0,LIFT+FW+QH/2,0,sg); // 绦环板
   {const s=new THREE.Shape(),L=IW*.56,Hh=QH*.4;s.moveTo(-L/2+Hh/2,-Hh/2);s.lineTo(L/2-Hh/2,-Hh/2);s.absarc(L/2-Hh/2,0,Hh/2,-Math.PI/2,Math.PI/2);s.lineTo(-L/2+Hh/2,Hh/2);s.absarc(-L/2+Hh/2,0,Hh/2,Math.PI/2,Math.PI*1.5);
    const tube=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(s.getPoints(40).map(q=>V3(q.x,q.y,0)),true),160,4,6,true);for(const z of[12,-12])A(tube,fH,0,LIFT+FW+QH/2,z,sg)}
   // 披水牙子: an apron under the bottom rail between the posts, its lower edge a shallow 壸门 curve
   {const s=new THREE.Shape(),L=IW,Hh=120;s.moveTo(-L/2,0);s.lineTo(L/2,0);s.lineTo(L/2,-Hh*.75);s.bezierCurveTo(L/2-120,-Hh*.72,L/2-200,-Hh*.4,L/2-320,-Hh*.38);s.quadraticCurveTo(0,-Hh*.22,-L/2+320,-Hh*.38);
    s.bezierCurveTo(-L/2+200,-Hh*.4,-L/2+120,-Hh*.72,-L/2,-Hh*.75);s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:18,bevelEnabled:true,bevelThickness:2,bevelSize:2,bevelSegments:1,curveSegments:18});g.translate(0,0,-9);
    A(g,fH,0,LIFT,0,sg)}
   // 桥形 墩子 feet with 站牙 front and back
   {const DL=600,DHt=110,dun=new THREE.Shape();dun.moveTo(-DL/2,0);dun.lineTo(-DL/2+80,0);dun.quadraticCurveTo(0,52,DL/2-80,0);dun.lineTo(DL/2,0);dun.lineTo(DL/2-18,DHt-22);dun.quadraticCurveTo(DL/2-24,DHt,DL/2-52,DHt);dun.lineTo(-DL/2+52,DHt);dun.quadraticCurveTo(-DL/2+24,DHt,-DL/2+18,DHt-22);dun.closePath();
    const dg=new THREE.ExtrudeGeometry(dun,{depth:POST+28,bevelEnabled:true,bevelThickness:3,bevelSize:3,bevelSegments:2,curveSegments:20});dg.translate(0,0,-(POST+28)/2);dg.rotateY(Math.PI/2);
    const zy=new THREE.Shape();zy.moveTo(0,0);zy.lineTo(0,260);zy.bezierCurveTo(12,216,34,156,76,114);zy.bezierCurveTo(118,74,160,40,200,0);zy.closePath();
    const zg=new THREE.ExtrudeGeometry(zy,{depth:24,bevelEnabled:true,bevelThickness:2,bevelSize:2,bevelSegments:2,curveSegments:16});zg.translate(0,0,-12);
    for(const sx of[-1,1]){const x=sx*(IW/2+POST/2);A(dg,fV,x,0,0,sg);for(const sz of[-1,1]){const m=A(zg,fV,x,DHt,sz*(FD/2+4),sg);m.rotation.y=sz>0?-Math.PI/2:Math.PI/2}
      blob(DL+180,300,.55,x,FY+2.5,SZ,.3)}}
   blob(OW+400,620,.36,0,FY+2,SZ,.5);
   // the screen's soft shade on the wall behind it, painted (the window light comes from the far side of the room, so it is faint)
   const sh=A(plane(OW+900,TOPY+500),SM({map:blobT['0.50']||CT(128,128,(g,W)=>{const gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(8,6,4,1)');gr.addColorStop(.5,'rgba(8,6,4,.5)');gr.addColorStop(1,'rgba(8,6,4,0)');g.fillStyle=gr;g.fillRect(0,0,W,W)}),unlit:1,tr:1,op:.16,po:1}),0,FY+TOPY*.45,4800-4);
   sh.rotation.y=Math.PI;sh.renderOrder=1}
  // ---------- merge: one draw per material (the room is ~400 parts), each part's transform baked into its vertices
  {S.updateMatrixWorld(true);const by=new Map(),drop=[];S.traverse(o=>{if(!o.isMesh||o.userData.keep)return;if(!by.has(o.material))by.set(o.material,[]);by.get(o.material).push(o);drop.push(o)});
   for(const o of drop)o.parent.remove(o);for(const c of[...S.children])if(!c.isMesh)S.remove(c);
   for(const [mat,ms] of by){let n=0;const gs=ms.map(o=>{const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);n+=g.attributes.position.count;return g});
     const P=new Float32Array(n*3),N=new Float32Array(n*3),T=new Float32Array(n*2);let i=0;for(const g of gs){const c=g.attributes.position.count;P.set(g.attributes.position.array,i*3);N.set(g.attributes.normal.array,i*3);if(g.attributes.uv)T.set(g.attributes.uv.array,i*2);i+=c;g.dispose()}
     const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.BufferAttribute(P,3));bg.setAttribute('normal',new THREE.BufferAttribute(N,3));bg.setAttribute('uv',new THREE.BufferAttribute(T,2));bg.computeBoundingSphere();
     const m=new THREE.Mesh(bg,mat);m.renderOrder=ms[0].renderOrder;S.add(m)}}
  STG.css='#e7e4dc'}
}
