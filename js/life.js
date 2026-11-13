// js/life.js: life on the map: people, horses, boats, smoke. Part of index.html's map script (split into modules in v115; the import order is
// load-bearing, see the note at the top of js/geo.js).
import * as THREE from 'three';
import { yaw } from './camera.js';
import { cam, scene } from './scene.js';
import { MX, MZ } from './geo.js';
import { U } from './terrain.js';
import { hAt } from './labels.js';

/* ---------- 山河有生气: ink birds in flocks, horse herds on the steppe, waterfalls ---------- */
export const LIFE=[];const PXS=Math.min(2,devicePixelRatio);
// birds: V-shaped ink strokes that flap, flocks circling over the land
const FLOCKS=[];{let s=41;const r=()=>{s=(s*16807)%2147483647;return s/2147483647};
  for(let f=0;f<10;f++){const lo=100+r()*22,la=25+r()*17;FLOCKS.push({cx:MX(lo),cz:MZ(la),R:25+r()*45,a:r()*6.3,v:(r()<.5?-1:1)*(.05+r()*.05),y:hAt(lo,la)+45+r()*35,n:5+Math.floor(r()*5)})}}
const birdN=FLOCKS.reduce((a,f)=>a+f.n,0),birdPos=new Float32Array(birdN*3),birdPh=new Float32Array(birdN);for(let i=0;i<birdN;i++)birdPh[i]=Math.random();
const birdG=new THREE.BufferGeometry();birdG.setAttribute('position',new THREE.BufferAttribute(birdPos,3));birdG.setAttribute('ph',new THREE.BufferAttribute(birdPh,1));
const birds=new THREE.Points(birdG,new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:U.uTime,uCam:U.uCam,uInk:U.uInk,scale:{value:innerHeight*PXS*.5}},
  vertexShader:`attribute float ph;uniform float scale,uTime;uniform vec3 uCam;varying float vF,vA;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(5.*scale/-mv.z,3.,30.);gl_Position=projectionMatrix*mv;vF=sin(uTime*8.+ph*6.283);vA=1.-smoothstep(700.,1500.,length(position-uCam));}`,
  fragmentShader:`uniform vec3 uInk;varying float vF,vA;float seg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h);}
    void main(){vec2 q=gl_PointCoord*2.-1.;q.y=-q.y;float w=vF*.45;vec2 m=vec2(.42,.12+w*.6);
      float d=min(min(seg(q,vec2(0.),vec2(-m.x,m.y)),seg(q,vec2(-m.x,m.y),vec2(-.9,w))),min(seg(q,vec2(0.),m),seg(q,m,vec2(.9,w))));
      float a=1.-smoothstep(.05,.13,d);if(a*vA<.03)discard;gl_FragColor=vec4(uInk,a*vA*.85);}`}));
scene.add(birds);LIFE.push(birds);
// horses: a two-frame galloping silhouette, herds drifting across the northern grassland
const horseTex=new THREE.CanvasTexture((()=>{const c=document.createElement('canvas');c.width=256;c.height=128;const g=c.getContext('2d');g.fillStyle='#000';g.strokeStyle='#000';g.lineCap='round';
  const horse=(ox,legs)=>{g.beginPath();g.ellipse(ox+64,64,30,13,0,0,6.283);g.fill();g.beginPath();g.moveTo(ox+86,58);g.quadraticCurveTo(ox+100,40,ox+108,34);g.lineWidth=9;g.stroke();
    g.beginPath();g.ellipse(ox+111,36,9,5.5,.5,0,6.283);g.fill();g.lineWidth=3;g.beginPath();g.moveTo(ox+36,58);g.quadraticCurveTo(ox+22,60,ox+16,76);g.stroke();
    g.lineWidth=5;for(const [x0,x1,y1] of legs){g.beginPath();g.moveTo(ox+x0,70);g.lineTo(ox+x1,y1);g.stroke()}};
  horse(0,[[44,30,104],[54,48,106],[78,92,104],[86,100,98]]);horse(128,[[44,52,106],[54,62,104],[78,72,106],[86,80,104]]);return c})());
const HERDS=[{lo:108,la:42.5,n:9,dir:1},{lo:114,la:43.2,n:7,dir:-1},{lo:101,la:38.6,n:6,dir:1},{lo:119,la:44,n:6,dir:-1}];
const horseN=HERDS.reduce((a,h)=>a+h.n,0),horsePos=new Float32Array(horseN*3),horseSeed=new Float32Array(horseN*2);
const horseOff=[];{let s=7;const r=()=>{s=(s*16807)%2147483647;return s/2147483647};for(const h of HERDS)for(let i=0;i<h.n;i++){horseOff.push([(r()-.5)*14,(r()-.5)*9]);}}
const horseG=new THREE.BufferGeometry();horseG.setAttribute('position',new THREE.BufferAttribute(horsePos,3));horseG.setAttribute('sd',new THREE.BufferAttribute(horseSeed,2));
const horses=new THREE.Points(horseG,new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{map:{value:horseTex},uTime:U.uTime,uCam:U.uCam,scale:{value:innerHeight*PXS*.5}},
  vertexShader:`attribute vec2 sd;uniform float scale;uniform vec3 uCam;varying vec2 vS;varying float vA;void main(){vS=sd;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(4.5*scale/-mv.z,0.,48.);gl_Position=projectionMatrix*mv;vA=1.-smoothstep(380.,700.,length(position-uCam));}`,
  fragmentShader:`uniform sampler2D map;uniform float uTime;varying vec2 vS;varying float vA;void main(){vec2 pc=gl_PointCoord;if(vS.y<0.)pc.x=1.-pc.x;float fr=floor(fract(uTime*3.2+vS.x)*2.);
    float a=texture2D(map,vec2((fr+pc.x)/2.,1.-pc.y)).a;if(a*vA<.05)discard;gl_FragColor=vec4(mix(vec3(.30,.22,.16),vec3(.12,.09,.07),fract(vS.x*7.)),a*vA*.92);}`}));
scene.add(horses);LIFE.push(horses);
// waterfalls: falling white streaks with a breath of spray at the foot, always facing the viewer
const FALLS=[[110.44,36.15,'壶口'],[105.67,25.99,'黄果树'],[115.98,29.56,'庐山'],[108.3,33.75,''],[113.9,35.6,''],[103.4,30.9,'']];
const fallMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:U.uTime,uRiver:U.uRiver},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform float uTime;varying vec2 vUv;float h1(float x){return fract(sin(x*127.1)*43758.5);}
    void main(){float col=floor(vUv.x*9.);float sp=.8+h1(col)*.7;float st=fract(vUv.y*2.2+uTime*sp+h1(col+3.));
      float streak=smoothstep(.0,.25,st)*(1.-smoothstep(.55,1.,st));float edge=smoothstep(0.,.25,vUv.x)*smoothstep(1.,.75,vUv.x);
      float a=(.35+.55*streak)*edge*smoothstep(1.,.85,vUv.y);gl_FragColor=vec4(mix(vec3(.80,.86,.88),vec3(1.),streak),a);}`});
const sprayMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:U.uTime},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform float uTime;varying vec2 vUv;void main(){vec2 q=vUv-.5;float d=length(q*vec2(1.,1.6));float a=(1.-smoothstep(.15,.5,d))*(.55+.2*sin(uTime*3.+vUv.x*9.));gl_FragColor=vec4(1.,1.,1.,a*.7);}`});
const FALLG=[];for(const [lo,la] of FALLS){const g=new THREE.Group();const y=hAt(lo,la);
  const f=new THREE.Mesh(new THREE.PlaneGeometry(3.4,11),fallMat);f.position.y=y+5.5;g.add(f);
  const sp=new THREE.Mesh(new THREE.PlaneGeometry(9,4.5),sprayMat);sp.position.y=y+1.2;g.add(sp);
  g.position.set(MX(lo),0,MZ(la));scene.add(g);FALLG.push(g)}
LIFE.push(...FALLG);
let lifeT=performance.now();
export function lifeTick(){const now=performance.now(),dt=Math.min(.1,(now-lifeT)/1000);lifeT=now;
  let k=0;for(const f of FLOCKS){f.a+=f.v*dt;const cx=f.cx+Math.cos(f.a)*f.R,cz=f.cz+Math.sin(f.a)*f.R,dx=-Math.sin(f.a)*Math.sign(f.v),dz=Math.cos(f.a)*Math.sign(f.v);
    for(let i=0;i<f.n;i++){const row=Math.ceil(i/2),side=i%2?1:-1;birdPos[k*3]=cx-dx*row*2.4+(-dz)*side*row*1.8;birdPos[k*3+1]=f.y+Math.sin(now*.001+i)*.6;birdPos[k*3+2]=cz-dz*row*2.4+dx*side*row*1.8;k++}}
  birdG.attributes.position.needsUpdate=true;
  k=0;for(const h of HERDS){h.lo+=h.dir*dt*.035;if(h.lo>121||h.lo<99)h.dir*=-1;
    for(let i=0;i<h.n;i++){const o=horseOff[k];const lo=h.lo+o[0]/20+Math.sin(now*.0007+i)*.05,la=h.la+o[1]/24;
      horsePos[k*3]=MX(lo);horsePos[k*3+1]=hAt(lo,la)+1.6;horsePos[k*3+2]=MZ(la);horseSeed[k*2]=(i*.37)%1;horseSeed[k*2+1]=h.dir*(Math.cos(yaw)>=0?1:-1);k++}}
  horseG.attributes.position.needsUpdate=true;horseG.attributes.sd.needsUpdate=true;
  for(const g of FALLG)g.rotation.y=Math.atan2(cam.position.x-g.position.x,cam.position.z-g.position.z);}
