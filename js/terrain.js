// js/terrain.js: borders by date, terrain shader (STY palette, uniforms U), coast, water, mountain frame. Part of index.html's map script (split into modules in v115; the import order is
// load-bearing, see the note at the top of js/geo.js).
import * as THREE from 'three';
import { BH, BW, RM, bCan, bTex, dnum, drawPiece, geo, scene } from './scene.js';
import { GH, GW, H2, MH, MW, RIVERS, toG } from './geo.js';
import { RLBL } from './cities.js';
export let bKey='',bCur=0,bT0=-1e9;
export function setBorders(d,instant){const n=dnum(d),act=RM.pieces.filter(p=>dnum(p.from)<=n&&(!p.to||n<dnum(p.to)));
  for(const L of RLBL)L.off=!act.includes(L.piece);
  // 武周 690.10.16 (天授元年九月九日) – 705.03.03 (神龙元年二月甲寅，复国号唐): the same territory, but the state was 周
  {const zhou=String(d)>='0690-10-16'&&String(d)<'0705-03-03';for(const L of RLBL)if(L.piece.realm==='tang'&&L.piece.status==='core'){const t=zhou?'大　周':L.piece.label[0];if(L.e.textContent!==t){L.e.textContent=t;L.box=null}}}
  const key=act.map(p=>RM.pieces.indexOf(p)).join();if(key===bKey)return;bKey=key;bCur^=1;
  const g=bCan[bCur].getContext('2d');g.clearRect(0,0,BW,BH);
  for(const p of act)if(!p.overlay)drawPiece(g,p);for(const p of act)if(p.overlay)drawPiece(g,p);
  bTex[bCur].needsUpdate=true;U.uBorder.value=bTex[bCur];U.uBorderB.value=bTex[bCur^1];bT0=instant?-1e9:performance.now()}
const riverTex=new THREE.CanvasTexture((()=>{const c=document.createElement('canvas');c.width=GW*3;c.height=GH*3;const g=c.getContext('2d');g.scale(3,3);g.strokeStyle='#fff';g.lineCap='round';g.lineJoin='round';
  for(const [w,pts] of RIVERS){g.lineWidth=w*.55;g.beginPath();const Q=pts.map(toG);g.moveTo(...Q[0]);for(let i=1;i<Q.length-1;i++){const mx=(Q[i][0]+Q[i+1][0])/2,my=(Q[i][1]+Q[i+1][1])/2;g.quadraticCurveTo(Q[i][0],Q[i][1],mx,my)}g.lineTo(...Q[Q.length-1]);g.stroke()}return c})());
const strokeTex=new THREE.CanvasTexture((()=>{const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');g.fillStyle='#000';g.fillRect(0,0,512,512);let s=3;const r=()=>{s=(s*16807)%2147483647;return s/2147483647};
  for(let i=0;i<1400;i++){const x=r()*512,y=r()*512,len=10+r()*46,w=.6+r()*2.4,a=.25+r()*.75,bend=(r()-.5)*8;
    for(const ox of [0,512,-512])for(const oy of [0,512,-512]){const X=x+ox,Y=y+oy;if(X<-60||X>572||Y<-60||Y>572)continue;
      const gr=g.createLinearGradient(X,Y,X,Y+len);gr.addColorStop(0,`rgba(255,255,255,${a})`);gr.addColorStop(1,'rgba(255,255,255,0)');g.strokeStyle=gr;g.lineWidth=w;g.lineCap='round';
      g.beginPath();g.moveTo(X,Y);g.quadraticCurveTo(X+bend,Y+len*.5,X+bend*.3,Y+len);g.stroke();}}
  return c})());strokeTex.wrapS=strokeTex.wrapT=THREE.RepeatWrapping;
// The palette: 云山 · 青绿留白, the one look in use (the nine others that ?look= could pick were dropped in v114; ?look= is
// now ignored). Colours, then a few switches:
// L  = [colour by hill prominence (1) or by height (0), brush-stroke strength, mist strength, gold 金碧 lines]
// L2 = four more terrain-shader switches (uLk2)
// P  = [outline strength, monochrome ink, posterize levels (0 = off), silk grain]
// tilt = [close, far] camera tilt (tAuto); treeK = tree point size
export const STY={p1:[.86,.80,.58],p2:[.66,.76,.56],moss:[.10,.18,.14],rock:[.80,.60,.36],low:[.88,.84,.64],mid:[.36,.68,.56],high:[.16,.36,.64],snow:[.93,.93,.92],ink:[.12,.11,.09],paper:[.92,.88,.76],water:[.66,.76,.72],river:[.82,.88,.86],tree:[[.09,.20,.16],[.30,.54,.44]],L:[1,1,.8,0],L2:[1,.9,.55,1],P:[.9,0,0,1],sat:1.1,bands:4,tilt:[.5,1.08],treeK:.55};

export const U={uFog:{value:new THREE.Vector2(380,1500)},uSeason:{value:new THREE.Vector4(0,1,0,0)},uP1:{value:new THREE.Color()},uP2:{value:new THREE.Color()},uMoss:{value:new THREE.Color()},uRock:{value:new THREE.Color()},uLow:{value:new THREE.Color()},uMid:{value:new THREE.Color()},uHigh:{value:new THREE.Color()},uSnow:{value:new THREE.Color()},uInk:{value:new THREE.Color()},uPaper:{value:new THREE.Color()},uRiver:{value:new THREE.Color()},uBands:{value:4},uRiv:{value:riverTex},uBorder:{value:bTex[0]},uBorderB:{value:bTex[1]},uBMix:{value:1},uBStr:{value:1},uLk:{value:new THREE.Vector4(1,1,1,0)},uLk2:{value:new THREE.Vector4(0,0,0,0)},uFocus:{value:new THREE.Vector3(0,0,1e4)},uStroke:{value:strokeTex},uTime:{value:0},uCam:{value:new THREE.Vector3()}};
const terrain=new THREE.Mesh(geo,new THREE.ShaderMaterial({uniforms:U,
 vertexShader:`attribute float h,pr,rim;varying float vH,vPr,vRim;varying vec3 vN;varying vec3 vW;varying vec2 vUv;void main(){vH=h;vPr=pr;vRim=rim;vN=normal;vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
 fragmentShader:`uniform vec3 uLow,uMid,uHigh,uSnow,uInk,uPaper,uRiver,uCam,uP1,uP2,uMoss,uRock;uniform float uBands,uTime;uniform vec2 uFog;uniform vec4 uSeason;uniform sampler2D uRiv,uStroke,uBorder,uBorderB;uniform float uBMix,uBStr;uniform vec4 uLk,uLk2;uniform vec3 uFocus;vec3 glz(vec3 c,vec4 b,float k){float L=dot(c,vec3(.3,.59,.11)),Lb=max(dot(b.rgb,vec3(.3,.59,.11)),.04);return mix(c,b.rgb*min(L/Lb,1.15),b.a*k);}varying float vH,vPr,vRim;varying vec3 vN;varying vec3 vW;varying vec2 vUv;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
 float dh(vec2 p){return vnoise(p)*.55+vnoise(p*2.13+5.)*.3+vnoise(p*4.7+9.)*.15;}
 void main(){vec3 n=normalize(vN);
  {float dd=length(vW-uCam),near=1.-smoothstep(90.,420.,dd);if(near>0.){vec2 q=vW.xz*.45;float e=.08,h0=dh(q),hx=dh(q+vec2(e,0.)),hz=dh(q+vec2(0.,e));
    float amp=(.35+1.6*smoothstep(.08,.4,1.-n.y))*near;n=normalize(n+vec3(h0-hx,0.,h0-hz)/e*.22*amp);}}vec3 L=normalize(vec3(-.55,.62,-.55));float d=dot(n,L);
  float lit=floor(clamp(d*.5+.5,0.,1.)*uBands+.5)/uBands; lit=mix(lit,clamp(d*.5+.5,0.,1.),.42);
  float h=vH,pr=vPr,sl0=1.-n.y,slope=sl0;
  float wash=vnoise(vW.xz*.08)*.6+vnoise(vW.xz*.31)*.4;
  // 千里江山图 logic. Flats are silk with a light 石绿 wash (fields as faint patches). Every hill is 赭石 at its foot,
  // 石绿 on the flanks and 石青 on its crown, decided by local prominence (pr), plus a little absolute height so great ranges go bluer
  float pf=vnoise(vW.xz*.035)*.65+vnoise(vW.xz*.11)*.35;
  vec3 c=mix(uLow,uP1,smoothstep(.35,.7,pf)*.55);c=mix(c,uP2,smoothstep(.5,.8,vnoise(vW.xz*.05+11.))*.5);
  // 高原: a pale 石绿-ochre wash where it is high but gentle
  c=mix(c,mix(vec3(.78,.74,.54),vec3(.62,.72,.58),vnoise(vW.xz*.03)),smoothstep(.26,.42,h)*(1.-smoothstep(.12,.35,sl0)));
  float t=mix(clamp(smoothstep(.04,.62,h)+(wash-.5)*.12,0.,1.),clamp(pr*.75+.42+(h-.25)*.45+(wash-.5)*.18,0.,1.),uLk.x);
  vec3 mtn=t<.5?mix(uRock,uMid,smoothstep(.22,.5,t)):mix(uMid,uHigh,smoothstep(.5,.86,t));
  float m=clamp(mix(smoothstep(.1,.32,sl0)+smoothstep(.1,.3,h)*.5,smoothstep(.09,.3,pr)+smoothstep(.15,.36,sl0),uLk.x),0.,1.);
  c=mix(c,mtn,m);
  c=mix(c,uSnow,smoothstep(.62,.8,h)*smoothstep(.45,.85,n.y));
  // 皴: strokes run down the fall line of each slope, like brushwork following the form
  vec2 gd=normalize(n.xz+vec2(1e-4));vec2 p=vW.xz*.055;vec2 uvS=vec2(dot(p,vec2(gd.y,-gd.x)),dot(p,gd)*.3);
  float st=texture2D(uStroke,uvS).r,st2=texture2D(uStroke,uvS*2.3+.37).r;
  // 点苔 ink-green dots along crowns and ridges: removed 2026-11-10, from afar they read as dirt specks
  c*=.64+.46*lit;c*=.94+.12*wash;
  // 冷暖: sunlit faces warm toward 赭, shaded faces cool toward 花青, the way painters separate light without black
  c*=mix(vec3(1.),mix(vec3(.86,.92,1.06),vec3(1.07,1.,.9),lit),uLk2.w);
  float shadow=1.-lit;
  vec3 sk=mix(mix(c*.42,uInk,.45),vec3(.86,.66,.26),uLk.w);c=mix(c,sk,clamp(st*smoothstep(.1,.45,slope)*(.25+.9*shadow)*uLk.y,0.,.85));
  c=mix(c,vec3(.92,.74,.34),uLk.w*smoothstep(.3,.6,pr)*smoothstep(.55,.9,lit)*.45);
  c=mix(c,sk,clamp(st2*smoothstep(.3,.7,slope)*shadow*.5*uLk.y,0.,.6));
  c=mix(c,uInk,smoothstep(.55,.85,slope)*shadow*.6);
  float rv=texture2D(uRiv,vUv).r*smoothstep(.75,.95,n.y);float flow=vnoise(vW.xz*.22+vec2(uTime*.55,uTime*.3))*.6+vnoise(vW.xz*.9-vec2(uTime*1.1,uTime*.7))*.4;vec3 rc=uRiver*(.9+.14*flow)+vec3(.07,.08,.08)*smoothstep(.72,.9,flow);c=mix(c,rc,rv*.92);
  float dist=length(vW-uCam);float fog=smoothstep(uFog.x,uFog.y,dist);float valley=(1.-smoothstep(900.,2000.,uCam.y))*(1.-smoothstep(.02,.16,h+(wash-.5)*.06))*.3;
  // 四季 like the game: the vegetated ground changes colour as a whole; rock and cliffs stay
  float veg=(1.-smoothstep(.32,.6,slope))*(1.-smoothstep(.45,.7,h));float big=vnoise(vW.xz*.012+3.)*.6+vnoise(vW.xz*.04)*.4;
  c=mix(c,mix(vec3(.70,.80,.58),vec3(.56,.74,.58),big)*(.78+.32*lit),uSeason.x*veg*(1.-smoothstep(.1,.4,vPr))*.45);
  c=mix(c,mix(vec3(.80,.66,.34),vec3(.70,.48,.26),smoothstep(.3,.75,big))*(.72+.4*lit),uSeason.z*veg*.62);
  float snowy=clamp(smoothstep(.5,.85,n.y)+smoothstep(.4,.7,h)*.6,0.,1.);
  c=mix(c,mix(vec3(.80,.83,.88),vec3(.96,.96,.97),lit),uSeason.w*snowy*.92);c=mix(c,c*vec3(.82,.86,.95),uSeason.w*(1.-snowy)*.6);
  vec4 b0=texture2D(uBorderB,vUv),b1=texture2D(uBorder,vUv);float bk=uBStr*.55*(1.-smoothstep(.0,.02,-h));c=mix(glz(c,b0,bk),glz(c,b1,bk),uBMix);
  // 云山留白: mist pools in every valley (negative prominence) so ridges stand out as layers, like 留白 between brush-painted ranges
  {float drift=vnoise(vW.xz*.018+vec2(uTime*.012,uTime*.007))*.5+vnoise(vW.xz*.05-vec2(uTime*.02,0.))*.5;
   float vm=(1.-smoothstep(-.5,.12,pr+(wash-.5)*.3+(drift-.5)*.35))*(1.-smoothstep(.0,.25,sl0)*.5);c=mix(c,mix(uPaper,vec3(1.),.25),uLk2.x*vm*.82);}
  // 三远: far ranges turn pale 花青 before they dissolve into silk
  {float ad=smoothstep(uFog.x*.6,uFog.y*1.1,length(vW-uCam));c=mix(c,mix(c,vec3(.70,.77,.82),.7),ad*uLk2.z);}
  // 焦点晕染: full colour where you are looking, fading to pale ink toward the edges, so the eye has somewhere to rest
  {float L=dot(c,vec3(.3,.59,.11));float off=smoothstep(uFocus.z*.3,uFocus.z,length(vW.xz-uFocus.xy));c=mix(c,mix(vec3(L)*vec3(1.,.97,.92),uPaper,.35),uLk2.y*off*.85);}
  c=mix(c,uPaper,clamp((fog*.88+valley)*uLk.z,0.,.92));c=mix(uPaper,c,smoothstep(.7,1.,vRim));
  gl_FragColor=vec4(c,1.);}`}));
scene.add(terrain);
const COAST=(()=>{const N=GW*GH,d=new Float32Array(N),S=1.4142;for(let k=0;k<N;k++)d[k]=H2[k]>0.0005?0:1e9;
  for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){const k=j*GW+i;if(!d[k])continue;let v=d[k];if(i>0)v=Math.min(v,d[k-1]+1);if(j>0){v=Math.min(v,d[k-GW]+1);if(i>0)v=Math.min(v,d[k-GW-1]+S);if(i<GW-1)v=Math.min(v,d[k-GW+1]+S)}d[k]=v}
  for(let j=GH-1;j>=0;j--)for(let i=GW-1;i>=0;i--){const k=j*GW+i;if(!d[k])continue;let v=d[k];if(i<GW-1)v=Math.min(v,d[k+1]+1);if(j<GH-1){v=Math.min(v,d[k+GW]+1);if(i<GW-1)v=Math.min(v,d[k+GW+1]+S);if(i>0)v=Math.min(v,d[k+GW-1]+S)}d[k]=v}
  const u=new Uint8Array(N);for(let k=0;k<N;k++)u[k]=Math.min(255,d[k]/40*255);const t=new THREE.DataTexture(u,GW,GH,THREE.RedFormat,THREE.UnsignedByteType);t.magFilter=t.minFilter=THREE.LinearFilter;t.needsUpdate=true;return t})();
export const water=new THREE.Mesh(new THREE.PlaneGeometry(MW,MH).rotateX(-Math.PI/2),new THREE.ShaderMaterial({uniforms:{uW:{value:new THREE.Color()},uCoast:{value:COAST},uMap:{value:new THREE.Vector2(MW/2,MH/2)},uPaper:U.uPaper,uTime:U.uTime,uCam:U.uCam,uFog:U.uFog},
 vertexShader:`varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
 fragmentShader:`uniform vec3 uW,uPaper,uCam;uniform float uTime;uniform vec2 uFog,uMap;uniform sampler2D uCoast;varying vec3 vW;
  float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+1.),f.x),f.y);}
  // water drawn the way 山水 painters draw it, not as a simulation:
  //  远水无波 - far water is a plain wash; strokes fade out as soon as they would crowd below a pixel (fwidth), never moiré
  //  网巾/鱼鳞水 (千里江山图) - open water is fine overlapping scale arcs; a nearer row covers the farther one, arcs bulge away from the viewer
  //  层波叠浪 (马远《水图》) - near the shore the arcs give way to ink-outlined swells with white 浪花 on their shoreward lip, marching in
  //  拍岸 - two thin white lines hug the beach
  void main(){vec3 c=uW,ink=mix(uW*.6,vec3(.2,.34,.38),.3);
   float dc=texture2D(uCoast,vec2(vW.x/(2.*uMap.x)+.5,vW.z/(2.*uMap.y)+.5)).r*40.;
   {vec2 q=vec2(vW.x,vW.z/.55)/12.;q+=vec2(sin(q.y*.55+uTime*.25)*.18,sin(q.x*.4+uTime*.18)*.12+uTime*.04);
    float rb=floor(q.y/.25)-2.,od=9.;vec2 oc=vec2(0.);
    for(int k=0;k<5;k++){float r=rb+float(k),off=mod(r,2.)*.5;vec2 ce=vec2(floor(q.x-off)+off+.5,r*.25);float d=length(q-ce);if(d<.5){od=d;oc=ce;}}
    float w=fwidth(q.y)*1.4,top=smoothstep(.05,.45,(oc.y-q.y)/max(od,1e-3)),keep=step(.3,h21(oc));
    float arc=(1.-smoothstep(w*.5,w*1.5,abs(.47-od)))*top*keep+.45*(1.-smoothstep(w*.5,w*1.5,abs(.3-od)))*top*keep*step(.5,h21(oc+7.));
    float lod=1.-smoothstep(.05,.13,w);
    float grp=max(smoothstep(.42,.68,vn(vW.xz*.011+vec2(uTime*.01,0.))),1.-smoothstep(5.,16.,dc));
    c=mix(c,ink,arc*lod*grp*.4*smoothstep(1.2,3.,dc));}
   {float near=1.-smoothstep(260.,720.,length(vW-uCam)),band=(1.-smoothstep(2.,7.,dc))*smoothstep(.9,1.6,dc);
    float ph=dc*.8+uTime*1.6+sin(vW.x*.04)*.6+sin(vW.z*.05)*.6,f=fwidth(ph);
    float seg=smoothstep(.4,.75,.5+.5*sin(vW.x*.09+vW.z*.07+dc*.35)+.22*sin(uTime*.7+vW.z*.11));
    float cr=fract(ph/6.2832+.25),lip=1.-smoothstep(f*.25,f*.25+.035,abs(cr-.5)),wash=smoothstep(.3,.44,cr)*(1.-smoothstep(.46,.5,cr));
    vec2 sp=floor(vW.xz*1.6);float spray=step(.86,h21(sp))*(1.-smoothstep(.05,.22,length(fract(vW.xz*1.6)-.5)))*smoothstep(.22,.3,cr)*(1.-smoothstep(.4,.46,cr));
    c=mix(c,vec3(.97,.97,.94),(wash*.8+spray*.9)*seg*band*near);c=mix(c,ink,lip*seg*band*near*.7);
    float g=dc*1.1+uTime*.22,fg=fwidth(g),sh=(1.-smoothstep(fg*.5,fg*1.5+.04,abs(fract(g)-.5)))*(1.-smoothstep(.9,1.5,dc))*smoothstep(.3,.6,dc);
    c=mix(c,vec3(.98,.97,.93),sh*near*.75);c=mix(c,vec3(.97,.96,.92),(1.-smoothstep(.0,.35,dc))*near*.6);}
   c=mix(uPaper,c,smoothstep(-40.,30.,min(uMap.x-abs(vW.x),uMap.y-abs(vW.z))));float fog=smoothstep(uFog.x,uFog.y*1.2,length(vW-uCam));c=mix(c,uPaper,fog*.85);gl_FragColor=vec4(c,1.);}`}));
// water sits well below the lowest land (y ≥ .6) and above the sea floor (−4): flat plains near the faded rim used to dip
// under a y .6 water plane and z-fight with it, flickering teal along the south edge
water.position.y=-1.5;scene.add(water);
// the map is itself a handscroll lying open on the desk, mounted 月白绫 · 白玉轴 like every scroll object here (Wilson
// 2026-11-04: restrained, 内敛): plain 月白 绫 with a tone-on-tone 暗花 of small 云纹, ivory 隔水 strips edged in a fine
// grey-brown rule, and at each side a roll of the same 绫 on its roller with turned 白玉 knobs at both ends; a 石青 带
// with a 白玉 别子 lies loose by the right-hand roll. No gold anywhere.
export const MOUNT_G=new THREE.Group();scene.add(MOUNT_G);
{const M=78,MS=34,PWd=MW+2*M,PHd=MH+2*MS,k=2048/PWd,c=document.createElement('canvas');c.width=Math.round(PWd*k);c.height=Math.round(PHd*k);const g=c.getContext('2d');g.scale(k,k);
 const YB='#dfe3dc',anhua=(q,w,h,step,a)=>{q.strokeStyle=`rgba(255,255,255,${a})`;q.lineWidth=.9;q.lineCap='round';
   for(let y=0,r=0;y<h+step;y+=step,r++)for(let x=(r%2)*step/2;x<w+step;x+=step){q.beginPath();q.arc(x,y,2.6,Math.PI*.9,Math.PI*2.4);q.stroke();q.beginPath();q.arc(x+5,y-3,1.8,Math.PI*.9,Math.PI*2.3);q.stroke();q.beginPath();q.moveTo(x+2.4,y+1.4);q.quadraticCurveTo(x+5,y+1.6,x+6.5,y-.4);q.stroke()}};
 g.fillStyle=YB;g.fillRect(0,0,PWd,PHd);anhua(g,PWd,PHd,26,.2);
 for(let y=0;y<PHd;y+=2.2){g.fillStyle=`rgba(255,255,255,${.03+.02*Math.sin(y*.7)})`;g.fillRect(0,y,PWd,1)}
 g.fillStyle='#ece6d4';g.fillRect(M-26,MS-8,26,MH+16);g.fillRect(M+MW,MS-8,26,MH+16);
 g.fillStyle='#efe4c8';g.fillRect(M-2,MS-8,MW+4,MH+16);
 g.strokeStyle='rgba(120,110,90,.7)';g.lineWidth=1;g.strokeRect(M-27,MS-9,MW+54,MH+18);g.lineWidth=.6;g.strokeRect(M-3,MS-4,MW+6,MH+8);
 for(const [x0,dir] of [[0,1],[PWd,-1]]){const gr=g.createLinearGradient(x0,0,x0+dir*26,0);gr.addColorStop(0,'rgba(40,40,30,.3)');gr.addColorStop(1,'rgba(40,40,30,0)');g.fillStyle=gr;g.fillRect(dir>0?0:PWd-26,0,26,PHd)}
 const tex=new THREE.CanvasTexture(c);tex.anisotropy=4;
 const mnt=new THREE.Mesh(new THREE.PlaneGeometry(PWd,PHd).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:tex}));mnt.position.y=-6;MOUNT_G.add(mnt);
 // the rolls' 绫: a small tile of the same 月白 暗花, repeated round and along each roll
 const lingT=(()=>{const w=document.createElement('canvas');w.width=w.height=64;const q=w.getContext('2d');q.fillStyle=YB;q.fillRect(0,0,64,64);q.scale(2.2,2.2);anhua(q,30,30,15,.25);
   const t=new THREE.CanvasTexture(w);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3,40);return t})();
 const ling=new THREE.MeshLambertMaterial({map:lingT,color:0xffffff,emissive:0x5a5e5a}),jade=new THREE.MeshLambertMaterial({color:0xfffaf0,emissive:0x45443a}),
   ring=new THREE.MeshLambertMaterial({color:0xcfd6cb,emissive:0x202420}),silk=new THREE.MeshLambertMaterial({color:0x6a8e98,emissive:0x10222a,side:THREE.DoubleSide});
 const knob=new THREE.LatheGeometry([[0,0],[11,0],[12.8,1.5],[14.2,5],[14.6,9],[13.6,13],[11,16],[7,18.2],[0,18.8]].map(([x,y])=>new THREE.Vector2(x,y)),28);
 const collar=new THREE.CylinderGeometry(12,12,2.4,28);
 // a roll at each side: the 绫 wound on its roller (r 12), a pale ring and a 白玉 knob at both ends
 for(const sx of[-1,1]){const x=sx*(PWd/2+4),len=PHd+4;
   const roll=new THREE.Mesh(new THREE.CylinderGeometry(12,12,len,32).rotateX(Math.PI/2),ling);roll.position.set(x,6,0);MOUNT_G.add(roll);
   for(const sz of[-1,1]){const z=sz*(len/2);const cl=new THREE.Mesh(collar,ring);cl.rotation.x=Math.PI/2;cl.position.set(x,6,z+sz*1.2);MOUNT_G.add(cl);
     const kb=new THREE.Mesh(knob,jade);kb.rotation.x=sz*Math.PI/2;kb.position.set(x,6,z+sz*2.4);MOUNT_G.add(kb)}}
 // 带: a 石青 silk ribbon from the right-hand roll, lying loose on the desk in a lazy S, ending in a 白玉 别子
 {const x0=PWd/2+12,N=40,W=4.2,pts=[];for(let i=0;i<=N;i++){const u=i/N;pts.push([x0+3+u*96,-5.6+Math.sin(u*3.1)*.4,4+Math.sin(u*Math.PI*1.3)*22+u*30])}
  const pos=[],idx=[];for(let i=0;i<=N;i++){const p=pts[i],q=pts[Math.min(N,i+1)],o=pts[Math.max(0,i-1)];let dx=q[0]-o[0],dz=q[2]-o[2];const l=Math.hypot(dx,dz)||1;const nx=-dz/l*W/2,nz=dx/l*W/2;
    pos.push(p[0]+nx,p[1],p[2]+nz,p[0]-nx,p[1],p[2]-nz);if(i<N){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}}
  const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));rg.setIndex(idx);rg.computeVertexNormals();MOUNT_G.add(new THREE.Mesh(rg,silk));
  const e=pts[N],bz=new THREE.Mesh(new THREE.BoxGeometry(12,2.6,4.6),jade);bz.position.set(e[0]+5,-5,e[2]);bz.rotation.y=-Math.atan2(pts[N][2]-pts[N-1][2],pts[N][0]-pts[N-1][0]);MOUNT_G.add(bz)}}
