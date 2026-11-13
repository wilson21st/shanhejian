// js/bgm.js: music and seasons. Part of index.html's map script (split into modules in v115; the import order is
// load-bearing, see the note at the top of js/geo.js).
import './loop.js';
import './scene.js';
import { lerp } from './geo.js';
import { U } from './terrain.js';
import { setTOffT, setYawT, yaw } from './camera.js';
import { PERSON, TL } from './timeline.js';
export const SEAS=[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]];export let seaT=[0,1,0,0];

/* 背景音乐 (Wilson 2026-11-04): two recorded 自得琴社 tracks — 《桂枝香》 under the map, 《长安幻世绘》 (古琴, 筝, 笛 and 鼓; Wilson's pick)
   under an open scroll — crossfaded as a scroll opens and closes, whatever the timeline is doing. The scroll page drops
   its synthesized noise beds and asks for ducking (postMessage 'narr') while its storyteller speaks. Browsers allow sound
   only after a first touch, so it starts on the first tap or key. Both run through Web Audio gain nodes, because iOS
   ignores <audio>.volume. Pauses while the page is hidden; the ♪ button at bottom-left mutes both (remembered). */
// (2026-11-07, Wilson: "地图嘅背景音乐换成《云宫迅音》") the map now plays 《云宫迅音》 (his download, the 黑神话 version; trimmed of
// its 0.3 s lead-in and 3 s tail of silence so the loop comes round quickly, 160k, 4'20", 5.2 MB, −14.5 LUFS against 桂枝香's −12.6,
// so the same .32 level). guizhixiang.mp3 stays in data/bgm.
const TRK={map:Object.assign(new Audio('data/bgm/yungong.mp3'),{loop:true,preload:'auto'}),scroll:Object.assign(new Audio('data/bgm/changan.mp3'),{loop:true,preload:'none'})};
/* (2026-11-06, Wilson: "我揿开佢先开音乐，停咧佢就停音乐…另外 music 嘅掣…可以开，亦可以喺播放时关") — the music follows
   playback: ▶ (timeline or a person's life) brings it in, ⏸ takes it out; an open scroll has its own music. The ♪ button
   flips whatever is happening now — music while paused, or silence while playing — and that choice holds until the
   next ▶/⏸. Nothing is remembered between visits. test/bgm-audit.mjs plays it through. */
const BGMV={map:.32,scroll:.17,narr:.05};let bgmOver=null,bgmScene='map',bgmNarr=false,bgmAC=null;const BGG={};
const bgmAuto=()=>{if(bgmScene==='scroll')return true;try{return TL.playing||PERSON.playing}catch(e){return false}}; // TL / PERSON are declared further down
const bgmIsOn=()=>bgmOver!==null?bgmOver:bgmAuto();
const bgmLvl=k=>!bgmIsOn()||k!==bgmScene?0:k==='scroll'&&bgmNarr?BGMV.narr:BGMV[k];
function bgmApply(tc=.7){document.getElementById('bgm').classList.toggle('off',!bgmIsOn());if(!bgmAC)return;for(const k in TRK){const v=bgmLvl(k);BGG[k].gain.setTargetAtTime(v,bgmAC.currentTime,tc);
  if(v>0)TRK[k].play().catch(()=>{});else setTimeout(()=>{if(bgmLvl(k)===0)TRK[k].pause()},tc*4500)}}
function bgmStart(){try{if(!bgmAC){bgmAC=new(window.AudioContext||window.webkitAudioContext)();
  for(const k in TRK){BGG[k]=bgmAC.createGain();BGG[k].gain.value=0;bgmAC.createMediaElementSource(TRK[k]).connect(BGG[k]).connect(bgmAC.destination)}}
  bgmAC.resume();bgmApply(1.2)}catch(e){}}
export function bgmTo(sc){bgmScene=sc;bgmNarr=false;bgmOver=null;bgmApply(.8)}
addEventListener('message',e=>{if(e.data&&e.data.type==='narr'){bgmNarr=!!e.data.on;bgmApply(.35)}});
/* unlock: browsers allow sound only after a gesture, and a finger's gesture is its pointerup / touchend / click (not
   pointerdown). The audio graph is built on the first such gesture — the ▶ tap itself counts — and the levels then
   follow bgmIsOn(). A light poll notices every play/pause change (timeline, person, end of the line) and drops the ♪
   override there, so no play/stop path needs its own hook. */
{const btn=document.getElementById('bgm');btn.classList.add('off');
 const EVS=['pointerup','touchend','click','keydown'];
 const kick=()=>{bgmStart();setTimeout(()=>{if(bgmAC&&bgmAC.state==='running')EVS.forEach(e=>removeEventListener(e,kick,true))},400)};
 EVS.forEach(e=>addEventListener(e,kick,true));
 let lastAuto=false;setInterval(()=>{const a=bgmAuto();if(a!==lastAuto){lastAuto=a;bgmOver=null;bgmStart();bgmApply(a?1.2:.6)}},250);
 btn.onclick=e=>{e.stopPropagation();bgmOver=!bgmIsOn();bgmStart();bgmApply(bgmOver?1:.35)};
 document.addEventListener('visibilitychange',()=>{if(!bgmAC)return;if(document.hidden)bgmAC.suspend();else bgmAC.resume()})}
window.__bgm={trk:TRK,get ac(){return bgmAC},get on(){return bgmIsOn()},get over(){return bgmOver},get scene(){return bgmScene},get narr(){return bgmNarr},level:bgmLvl};
document.getElementById('compass').onclick=()=>{setYawT(Math.round(yaw/(2*Math.PI))*2*Math.PI);setTOffT(0)};
setInterval(()=>{const v=U.uSeason.value;v.set(lerp(v.x,seaT[0],.15),lerp(v.y,seaT[1],.15),lerp(v.z,seaT[2],.15),lerp(v.w,seaT[3],.15))},33);
// setters: imported bindings are read-only, so the other modules write these through here
export function setSeaT(v){return seaT=v}
