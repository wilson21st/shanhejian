// js/timeline.js: era data, timeline, cards, story mode, people mode, overlay. Part of index.html's map script (split into modules in v115; the import order is
// load-bearing, see the note at the top of js/geo.js).
import * as THREE from 'three';
import { SEAS, bgmTo, seaT, setSeaT } from './bgm.js';
import { RM, cam } from './scene.js';
import { MX, MZ } from './geo.js';
import { U, setBorders } from './terrain.js';
import { LBL, LRO, addL, hAt, popBox } from './labels.js';
import { CAPMOVE, capMoveEl, capitalUpdate, placeAt, setCAPMOVE, updateTowns } from './cities.js';
import { dist, fly, setDist, setFOCUS, setTx, setTz, setYaw, setYawT, tx, tz, yaw } from './camera.js';

/* ---------- 时间轴: play history over the map; events pop up where they happened, scrolls stay tappable ----------
   581–763 (Wilson, 2026-11-04): the span was just 武德九年 玄武门之变; data/era.json adds 隋文帝 to 安史之乱 as a second,
   coarser layer of events, each with multi-type evidence (史书/考古/碑刻/文物/画作/异域/今人研究) shown in a 「wiki 卡」
   overlay instead of the handscroll. The one day still covered in detail (626-06-29 to 09-25) keeps its own dense
   EVS/SCROLL_IDS entries from world.json; era.json's own 玄武门之变 headline (s626xwm) is dropped so the two don't clash. */
export const [WD,ERA,POEMS,ERAIMG]=await Promise.all([fetch('data/world.json'),fetch('data/era.json'),fetch('data/poems.json'),fetch('data/era-images/manifest.json')].map(r=>r.then(x=>x.json())));
// contributed events (data/contrib-events.json, era.json shape; merged from event-proposal issues by .github/workflows/event-proposal.yml)
export const CONTRIB=await fetch('data/contrib-events.json').then(r=>r.ok?r.json():null).catch(()=>null)||{places:{},events:[]};
export const PL={...CONTRIB.places,...POEMS.places,...ERA.places,...WD.places}; // place lookup: world.json wins on id clash (e.g. changan), then era.json, then poems.json
const ERAIMG_BY_KEY=new Map(ERAIMG.map(m=>[m.eventId+'|'+m.evidenceIndex,m]));
const ordD=d=>{const [y,m,dd]=d.split('-').map(Number);return y*400+(m||6)*32+(dd||15)};
export const llOf=id=>{const p=PL[id];if(!p)return null;const ca=PL.changan.ll;if(p.view==='palace'||Math.hypot(p.ll[0]-ca[0],p.ll[1]-ca[1])<1.2)return ca;return p.ll};
// 581–763 regnal-year label: 「开元十四年 三月」. cnNum formats small ints as 中文数字 (reigns run at most 28 years).
const cnNum=n=>{if(n<=10)return '〇一二三四五六七八九十'[n];if(n<20)return '十'+(n%10?'〇一二三四五六七八九'[n%10]:'');const t='〇一二三四五六七八九'[Math.floor(n/10)];return t+'十'+(n%10?'〇一二三四五六七八九'[n%10]:'')};
// 隋唐年号 table, 581–763: [改元 date (Julian, approx. to the month where the day is uncertain), 皇帝, 年号, 国号].
// The year of 改元 counts as 元年; 天宝 uses 载 from 744 and 至德 throughout. 载初 and 圣历 were proclaimed in a Julian
// December under the 周正 calendar but are 元年 of the next year, so they start on 01-01. Julian Jan/early-Feb dates can be
// one 年 ahead of the lunar year (no new-year table here). 武周 runs 690-10-16 to 705-03-03.
const NIANHAO=[['0581-03-04','文帝','开皇','隋'],['0601-02-01','文帝','仁寿','隋'],['0605-02-01','炀帝','大业','隋'],['0617-12-18','恭帝','义宁','隋'],
 ['0618-06-18','高祖','武德','唐'],['0627-01-23','太宗','贞观','唐'],['0650-02-01','高宗','永徽','唐'],['0656-02-01','高宗','显庆','唐'],['0661-04-01','高宗','龙朔','唐'],
 ['0664-02-01','高宗','麟德','唐'],['0666-02-01','高宗','乾封','唐'],['0668-04-01','高宗','总章','唐'],['0670-04-01','高宗','咸亨','唐'],['0674-09-01','高宗','上元','唐'],
 ['0676-12-01','高宗','仪凤','唐'],['0679-07-01','高宗','调露','唐'],['0680-09-01','高宗','永隆','唐'],['0681-11-01','高宗','开耀','唐'],['0682-03-01','高宗','永淳','唐'],
 ['0683-12-01','高宗','弘道','唐'],['0684-02-01','中宗','嗣圣','唐'],['0684-03-01','睿宗','文明','唐'],['0684-10-01','睿宗','光宅','唐'],['0685-02-01','睿宗','垂拱','唐'],
 ['0689-02-01','睿宗','永昌','唐'],['0690-01-01','睿宗','载初','唐'],['0690-10-16','武则天','天授','武周'],['0692-04-01','武则天','如意','武周'],['0692-10-01','武则天','长寿','武周'],
 ['0694-06-01','武则天','延载','武周'],['0695-01-01','武则天','证圣','武周'],['0695-10-01','武则天','天册万岁','武周'],['0696-01-01','武则天','万岁登封','武周'],
 ['0696-04-01','武则天','万岁通天','武周'],['0697-09-01','武则天','神功','武周'],['0698-01-01','武则天','圣历','武周'],['0700-05-01','武则天','久视','武周'],
 ['0701-02-01','武则天','大足','武周'],['0701-11-01','武则天','长安','武周'],['0705-01-30','武则天','神龙','武周'],['0705-03-03','中宗','神龙','唐'],['0707-10-01','中宗','景龙','唐'],
 ['0710-07-08','殇帝','唐隆','唐'],['0710-08-01','睿宗','景云','唐'],['0712-02-01','睿宗','太极','唐'],['0712-06-01','睿宗','延和','唐'],['0712-09-01','玄宗','先天','唐'],
 ['0713-12-22','玄宗','开元','唐'],['0742-02-10','玄宗','天宝','唐'],['0756-08-12','肃宗','至德','唐'],['0758-03-01','肃宗','乾元','唐'],['0760-05-01','肃宗','上元','唐'],
 ['0762-05-01','代宗','宝应','唐'],['0763-08-01','代宗','广德','唐']];
const padD=d=>d.length===4?d+'-07-01':d.length===7?d+'-15':d;
function nianhao(d){const D=padD(d);let r=NIANHAO[0];for(const x of NIANHAO)if(x[0]<=D)r=x;
  const y=+D.slice(0,4),n=y-(+r[0].slice(0,4))+1,zai=(r[2]==='天宝'&&y>=744)||r[2]==='至德';
  return {emp:r[1],dyn:r[3],label:r[2]+(n===1?'元':cnNum(n))+(zai?'载':'年')}}
const ceOf=d=>{const [y,m,dd]=d.split('-').map(Number);return '公元'+y+'年'+(m?m+'月':'')+(dd?dd+'日':'')};
// the timeline chip: two lines — 公元 date on top, 国号 · 年号 · season under it (Wilson: 睇唔出年份同国号)
function setTld(d,si){const h=nianhao(d);
  tld.innerHTML=`<span class="t1">${ceOf(d)}</span><span class="t2">${h.dyn} · ${h.label}${si!==undefined?' · '+'春夏秋冬'[si]:''}</span>`}
export const EVS=[...WD.events.filter(e=>e.phase!=='world'),
  ...ERA.events.filter(e=>e.id!=='s626xwm').map(e=>({id:e.id,date:e.date,place:e.place,kind:e.kind,title:e.title,_era:e})),
  ...POEMS.events.map(e=>({id:e.id,date:e.date,place:e.place,kind:e.kind,title:e.title,_era:e})),
  ...CONTRIB.events.map(e=>({id:e.id,date:e.date,place:e.place,kind:e.kind,title:e.title,_era:e}))]
  .sort((a,b)=>ordD(a.date)-ordD(b.date));
export const SCROLL_IDS=new Set(['e0629','e0701a','e0701b','e0701c','d1','d2','d3','d4','d5','d6','d7','d8','d9','d10','d11','d12','d13']);
export var TL={i:0,playing:false,timer:null};export const rng=document.getElementById('rng'),tld=document.getElementById('tld'),play=document.getElementById('play');
rng.max=EVS.length-1;
// 581–763 era events that have their own 说书, beyond 玄武门之变: each maps an era.json event id to its story in
// data/shuoshu/<story>/ and the era.json place to fly to. (2026-11-10, Wilson: 说书 beats the animated handscroll — the
// cards open shuoshu.html?s=<story> now; xuanwumen.html / mawei.html stay on disk, unlinked. 烛影斧声 976 is outside
// the map's 581–763, so it is only on shuoshu-list.html.)
export const SCROLL_PAGES={s626ws:{story:'weishui',place:'bianqiao',title:'渭水之盟'},s756:{story:'mawei',place:'mawei'}};
const spTitle=(sp,ev)=>sp.title||ev.title.replace(/[，：:].*/,'');
// a closed pair of rolls (see .jp in the CSS): left the 轴, right the 天杆, both with 白玉 knobs, one 带 round both
const TAIL='<svg class="tl" width="12" height="26" viewBox="0 0 12 26"><path d="M1 0C6 4 1 10 5 15S3 21 5 23" fill="none" stroke="#5d7880" stroke-width="2" stroke-linecap="round"/><rect x="2" y="21.5" width="6" height="3.4" rx="1" fill="#ecebe0" stroke="rgba(90,80,60,.5)" stroke-width=".6"/></svg>';
const ROLL1='<i class="sh"></i><i class="bd"></i><i class="fc"></i><i class="k t"></i><i class="k b"></i>';
const ROLLS=(w,tail=true)=>`<span class="jp" style="--w:${w}px"><span class="jr b">${ROLL1}</span><span class="jr a">${ROLL1}</span><i class="bn"></i>${tail?TAIL:''}</span>`;
// a story card: tapping it opens the 说书; when the event also has an evidence sheet, a small 「证据」 tab opens that
function scrollCard(ll,kind,title,sub,open,ev,s){const k=WD.kinds[kind]||WD.kinds.pol;
  const L=placePop('pop big scrollc',ll,`<span class="kh">${kAnim(kind,'#ffe9b0')}<span class="kd" style="background:${k.color}">${k.glyph}</span></span><b>${title}</b><br><small>${sub}</small><br><small>📜 说书 · 点击听书${ev?' · <span class="ev">证据</span>':''}</small>${ROLLS(15)}`,open,1e9);
  L.e.style.setProperty('--kc',k.color);L.step=s;if(ev)L.e.querySelector('.ev').onclick=x=>{x.stopPropagation();openWiki(ev)};return L}
function openStory(story,ll){openScroll(`shuoshu.html?s=${story}&embed=1`,ll)}
// any embeddable page (shuoshu.html, design-film.html) opened as a scroll over the map; it posts 'closeScroll' to leave
export function openScroll(src,ll,onClose){stopTL();
  // remember where the timeline and camera were (used if the story is opened as its own page)
  try{sessionStorage.setItem('hs.back',JSON.stringify({s:TL.i,tx,tz,dist,yaw}))}catch(e){}
  const back={tx,tz,dist};
  // one piece with the map: fly down to the place, then the 说书 unrolls from the centre over the map like a scroll.
  // Closing rolls it back up and the camera rises to where it was; the timeline never moved.
  fly(MX(ll[0]),MZ(ll[1]),90,()=>{const ov=document.createElement('div');ov.id='scrollOv';
    // the card's closed pair reappears at the centre, its 带 slips off, and the two rolls part with the story between;
    // shuoshu.html?embed=1 shows 「← 大地图」 and posts 'closeScroll', and ducks the scroll music ('narr') while it speaks
    // v139 (Wilson 2026-11-13: 拉开画卷 跳帧): the scroll parts only once the page inside has loaded and two frames have
    // gone by with nothing to parse, so the 0.9 s opening runs on an idle main thread (the iframe is same-origin: its parse,
    // script and fonts used to land in the middle of the opening as 100–180 ms frozen frames). 'hold' also stops the 3D map
    // rendering under the overlay (js/loop.js) until it is gone; the map stands still behind it anyway. test/unroll-audit.mjs
    ov.className='hold';ov.innerHTML=`<iframe src="${src}" allow="autoplay"></iframe>${ROLLS(24)}`;document.body.appendChild(ov);
    const fr=ov.querySelector('iframe'),tR=performance.now();let loaded=false,opened=false;fr.addEventListener('load',()=>{loaded=true},{once:true});
    const openNow=()=>{if(opened||!ov.isConnected)return;opened=true;ov.classList.add('open');
      // the page inside starts (a poem's voice) when it is on screen, not while still rolled up
      setTimeout(()=>{try{fr.contentWindow.postMessage({type:'shown'},'*')}catch(e){}},900)};
    // open: loaded + two quiet frames, never before the rolls have landed (420 ms), never later than 3 s
    const tryOpen=()=>{if(opened)return;const w=performance.now()-tR;if(w>3000||(loaded&&w>420))requestAnimationFrame(()=>requestAnimationFrame(openNow));else setTimeout(tryOpen,60)};
    // v134 (Wilson 23:52: 两首歌一齐播): a poem plays its own bed, so the map's music goes fully silent under it ('poem' has
    // no map track); a 说书 / film keeps the scroll music, ducked while it speaks
    bgmTo(/^design-poem\.html/.test(src)?'poem':'scroll');requestAnimationFrame(()=>requestAnimationFrame(()=>{ov.classList.add('ready');tryOpen()}));
    const close=e=>{if(!e.data||e.data.type!=='closeScroll')return;removeEventListener('message',close);opened=true;ov.classList.remove('open');
      bgmTo('map');setTimeout(()=>ov.classList.remove('ready'),900);setTimeout(()=>{ov.remove();fly(back.tx,back.tz,back.dist,null);if(onClose)onClose()},1300)};
    addEventListener('message',close)})}
export const STEPS=[];for(let i=0;i<EVS.length;i++){const g=SCROLL_IDS.has(EVS[i].id);if(g&&STEPS.length&&SCROLL_IDS.has(EVS[STEPS[STEPS.length-1]].id))continue;STEPS.push(i)}
rng.max=STEPS.length-1;
setBorders(EVS[STEPS[0]].date,true);
// add_event's local preview (js/webmcp.js): put one era-shaped event (and its new place) into the timeline of this tab only and
// show it; STEPS is rebuilt the same way as above. Returns the step, or -1 if the place has no position.
export function previewEvent(ev,place){if(place)PL[place.id]={name:place.name,ll:place.ll};if(!llOf(ev.place))return -1;
  let i=EVS.findIndex(x=>x.id===ev.id);if(i<0){EVS.push({id:ev.id,date:ev.date,place:ev.place,kind:ev.kind,title:ev.title,_era:ev});EVS.sort((a,b)=>ordD(a.date)-ordD(b.date))}
  else EVS[i]={...EVS[i],_era:ev};
  STEPS.length=0;for(let j=0;j<EVS.length;j++){const g=SCROLL_IDS.has(EVS[j].id);if(g&&STEPS.length&&SCROLL_IDS.has(EVS[STEPS[STEPS.length-1]].id))continue;STEPS.push(j)}
  rng.max=STEPS.length-1;for(const l of LBL)if(l.step!==undefined)l.until=performance.now();i=EVS.findIndex(x=>x.id===ev.id);const s=STEPS.indexOf(i);showEvent(s);const ll=llOf(ev.place);fly(MX(ll[0]),MZ(ll[1]),Math.min(dist,800),null);return s}
const seasonOf=d=>{const m=+d.split('-')[1]||6;return m>=3&&m<=5?0:m>=6&&m<=8?1:m>=9&&m<=11?2:3};
/* 交战双方 (2026-11-05 night, Wilson picked the design-war mock option A): data/battles.json gives each of the 14 battles its
   sides — realm, leaders, where that army set out from, route, result. While a battle's step is on screen, overlayFrame
   draws one arrow per side from its origin to the field, in the realm's colour, with a small banner at the origin; the
   arrows march in together, a 战 seal lands, and the losing side fades. Rebels (a side rising against the court of the
   day) get a broken stroke and 「叛」. The card adds one line: 「唐」李世民 胜 对 「夏」窦建德 败. */
const BAT_SHORT={sui:'隋',chen:'陈',tang:'唐',xia:'夏',goguryeo:'句丽',tujue_e:'突厥',wa:'倭',silla:'新罗',houtujue:'突厥',dashi:'大食',yan:'燕',
  xuangan:'玄感',wei:'瓦岗',tuyuhun:'吐谷浑',gaochang:'高昌',tujue_w:'西突厥',baekje:'百济',tubo:'吐蕃',jingye:'敬业',khitan:'契丹'};
export let BAT={},BATTLE=null;fetch('data/battles.json').then(r=>r.ok?r.json():null).then(j=>{if(j&&j.battles)BAT=j.battles}).catch(()=>{});
const batCol=r=>(RM.realms[r]||{}).color||(r==='dashi'?'#6b5a3a':'#5a4630');
// a rebel is a side outside the court's camp: 突厥 fighting for 武周 against 契丹 (696) is not one
const batRebel=(b,sd,d)=>{if(b.type!=='rebellion')return false;const ct=String(d)<'0618-06-18'?'sui':'tang';if(sd.realm===ct)return false;
  const cs=b.sides.find(x=>x.realm===ct);return!cs||(sd.result==='胜')!==(cs.result==='胜')};
const batName=t=>String(t||'').replace(/（[^）]*）/g,'');
/* (2026-11-05 night, Wilson: "有时候两边都系同一个颜色，唔 make sense") — colour by camp (winners vs the rest), not by
   realm: each camp takes its lead realm's colour, and if the two read alike (唐 red vs 隋 orange, 唐 vs 倭) the camp
   without the court falls back to ink-blue / ink. Allied columns share their camp's colour; their banners tell them apart. */
const hexRgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const colDist=(a,b)=>{const x=hexRgb(a),y=hexRgb(b),m=(x[0]+y[0])/2;return Math.sqrt((2+m/256)*(x[0]-y[0])**2+4*(x[1]-y[1])**2+(2+(255-m)/256)*(x[2]-y[2])**2)};
function batCamps(b){if(b._cc)return b._cc;const W=b.sides.filter(x=>x.result==='胜'),L=b.sides.filter(x=>x.result!=='胜'),m=new Map();
  if(!W.length||!L.length){for(const x of b.sides)m.set(x,batCol(x.realm));return b._cc=m}
  // the camp holding the court (隋/唐) keeps its colour; if both or neither do, the winners keep theirs
  const court=g=>g.some(x=>x.realm==='tang'||x.realm==='sui'),[K,O]=court(L)&&!court(W)?[L,W]:[W,L];
  const ck=batCol(K[0].realm);let co=batCol(O[0].realm);if(colDist(ck,co)<170)co=['#2c4f73','#2b2118','#2f7a6a'].find(c=>colDist(ck,c)>=170)||'#2b2118';
  for(const x of K)m.set(x,ck);for(const x of O)m.set(x,co);return b._cc=m}
function batSides(b,d){const g=[];
  const cc=batCamps(b);for(const sd of b.sides){let x=g.find(q=>q.r===sd.realm);if(!x)g.push(x={r:sd.realm,c:cc.get(sd),lead:[],res:sd.result,reb:batRebel(b,sd,d)});for(const l of sd.leaders||[]){const n=batName(l);if(!x.lead.includes(n))x.lead.push(n)}}
  return `<span class="bsl">${g.map(x=>`<span class="bs${x.res==='胜'?'':' lose'}"><i class="rz" style="background:${x.c}">${BAT_SHORT[x.r]||x.r}${x.reb?'·叛':''}</i>${esc(x.lead.slice(0,2).join('、'))}<i class="rs">${x.res}</i></span>`).join('<span class="vs">对</span>')}</span>`}
/* 诗 (Wilson picked the design-war mock option 4): a poem's card is a small vertical inscription — its opening couplet in two
   columns, poet · title and year · place in a narrow column, and a red 「诗」 seal; no kind icons, no coloured frame. */
function poemCard(ev,place,yl){const p=ev.poem,c=String(p.text[0]||'').replace(/[。！？!?]$/,'').split(/[，,；;]/).filter(Boolean).slice(0,2);
  // columns are stacked with <br>, not writing-mode: WebKit sizes a vertical-writing box as if it were horizontal
  // brackets and dashes turn to their vertical forms (2026-11-07, Wilson: "括号…应该系打横"): （台城） reads ︵台城︶
  const VF={'（':'︵','）':'︶','(':'︵',')':'︶','《':'︽','》':'︾','「':'﹁','」':'﹂','『':'﹃','』':'﹄','〈':'︿','〉':'﹀','【':'︻','】':'︼','／':'︱','—':'︱','…':'︙','“':'﹁','”':'﹂'};
  // v136: the card is in the 吟诗 brush (志莽行书), which has no ︵︶︽︾ glyphs: a bracket / dash / ellipsis is its own brush glyph
  // turned a quarter (span.vr), so it keeps the brush; quotes and · keep the vertical-form codepoints above
  const ROT=new Set('（）()《》〈〉【】—…／');
  const col=t=>[...String(t)].map(ch=>ch==='·'?'︙':ROT.has(ch)?`<span class="vr">${esc(ch)}</span>`:VF[ch]||esc(ch)).join('<br>');
  return `<span class="pv">${c.map(t=>`<span class="v">${col(t)}</span>`).join('')}<span class="v s">${col(p.poet+'·'+(p.short||p.title))}</span><span class="v s">${col((yl||+ev.date.slice(0,4))+'·'+place)}</span><span class="sl">诗</span></span>`}
/* v131 (2026-11-11 07:48, Wilson: 人物传每一站…佢喺度写咗边首诗; 张卡要同编年体一样; 吟诗效果两边都要) — a poem is one
   card in both modes: the 编年体 inscription above (poemCard) with a 吟 button under it that opens the brush show
   (design-poem.html?id=<poem>&embed=1 as a scroll over the map, like the 说书). Only three poems have a recorded voice
   (有声: 早发白帝城, 春望, 崔颢《黄鹤楼》); the rest are written out by the brush with their lines as subtitles (书写).
   Poems come from poems.json (the chronicle's 25) and person-poems.json (more, for 人物传 stops; dated with how sure). */
const POEM_AUDIO={p23:'baidi',p21:'chunwang',p11:'huanghelou'};
/* v133 (Wilson 14:06: a poem opened from 编年体 looked like the old one with no voice) — since v132 every map poem is recited
   (yin-map.json: the other 43), so the card and sheet say 有声 for all of them, a poem card's tap opens the show itself in both
   modes (not the text sheet), and the show's URL carries the version so no stale copy is reused */
const POEM_V='139',VOICED=new Set(Object.keys(POEM_AUDIO));
fetch('data/design-poem/yin-map.json').then(r=>r.ok?r.json():null).then(j=>{if(j)for(const k of Object.keys(j))VOICED.add(k)}).catch(()=>{});
const poemUrl=id=>`design-poem.html?id=${id}&embed=1&v=${POEM_V}`;
export let PPO=null;fetch('data/person-poems.json').then(r=>r.ok?r.json():null).then(j=>{if(j&&j.poems)PPO=j}).catch(()=>{});
export const poemById=id=>POEMS.events.find(x=>x.id===id)||(PPO&&PPO.poems.find(x=>x.id===id))||null;
const poemPlace=ev=>String(ev.placeName||(PL[ev.place]||{}).name||'').replace(/（[^）]*）/g,'');
const poemLL=ev=>ev.ll||(PL[ev.place]||{}).ll;
// the year on a person's poem card: 「约」 for a usual-but-unsure 系年, 「年代不详」 where nobody knows
const poemYear=ev=>{const u=PPO&&PPO._meta.undated&&PPO._meta.undated[ev.id];return u||ev.dateConf==='low'?'年代不详':(ev.dateConf==='medium'?'约':'')+(+ev.date.slice(0,4))};
const yinBtn=ev=>`<span class="pft"><button class="yinb" data-yin="${ev.id}" aria-label="吟《${esc(ev.poem.title)}》">吟<small>${VOICED.has(ev.id)?'有声':'书写'}</small></button></span>`;
export function openPoem(id,ll){const ev=poemById(id);if(!ev)return;const p=PERSON.active,was=PERSON.playing;pPause();
  openScroll(poemUrl(id),ll||poemLL(ev),()=>{if(was)pResume(p)})}
// 吟 (and a person card's 1/2 ›) are buttons inside a card: caught before the card's own tap, which opens the wiki sheet
function cardBtns(L){L.e.addEventListener('click',x=>{const b=x.target.closest('.yinb,.pnx');if(!b)return;x.stopPropagation();
  if(b.classList.contains('yinb'))openPoem(b.dataset.yin,L.ll);else if(L.next)L.next()},true)}
/* the one map card (both modes): the HTML label on its place with the lead line and pin drawn by pinsFrame, draggable
   (popDrag). o.key: its own slot (default: one card per place); o.noPin: lead line only, when something else already
   marks the place (a battle's 战 seal, a crossing's landing point); o.kc: the lead/pin colour. */
function placePop(cls,ll,html,onclick,ms,o={}){const key=o.key||ll.join(),now=performance.now();
  // one pop per place at a time: a newer event at the same place replaces the older one; different places show side by side
  for(const l of LBL)if(l.cls.startsWith('pop')&&l.key===key&&l.until>now+250)l.until=now+250;
  // v133 (Wilson 13:14: 人物传 cards sat on the protagonist's portrait): in person mode the card stands higher, its lead line
  // reaching past the portrait (.pmark spans 10–44 px above its point), like the 编年体 card clear above its place
  const L=addL(cls,ll[0],ll[1],html,onclick,1.5);L.key=key;L.ll=ll;L.noPin=!!o.noPin;if(o.kc)L.e.style.setProperty('--kc',o.kc);L.lead=document.body.classList.contains('pmode')?58:26;L.e.style.setProperty('--lead',L.lead+'px');L.until=performance.now()+ms;
  popBox(L);if(LRO)LRO.observe(L.e);popDrag(L);cardBtns(L);
  return L}
/* (2026-11-07, Wilson: "呢啲卡片…我只手拉开佢…移过少少咁样，唔会挡住") — press and drag a card to move it off what it
   covers. It keeps that offset from its place while the map moves, until the card goes; the lead line bends to follow.
   A press that moves under 6px is still a tap. Drag it back near home and it snaps back into its own spot. */
function popDrag(L){const e=L.e;let g=null;
  e.addEventListener('pointerdown',ev=>{if(ev.button>0)return;g={id:ev.pointerId,x:ev.clientX,y:ev.clientY,d0:L.drag?[...L.drag]:[L.X-L.bX||0,L.Y-L.bY||0],on:false};ev.stopPropagation()});
  e.addEventListener('pointermove',ev=>{if(!g||ev.pointerId!==g.id)return;const dx=ev.clientX-g.x,dy=ev.clientY-g.y;
    if(!g.on){if(Math.hypot(dx,dy)<6)return;g.on=true;try{e.setPointerCapture(g.id)}catch(_){}e.classList.add('dragging')}
    L.drag=[g.d0[0]+dx,g.d0[1]+dy];ev.preventDefault()});
  const end=ev=>{if(!g||ev.pointerId!==g.id)return;if(g.on){e.classList.remove('dragging');L.noTap=performance.now();
      if(L.drag&&Math.hypot(L.drag[0],L.drag[1])<24)L.drag=null}g=null};
  e.addEventListener('pointerup',end);e.addEventListener('pointercancel',end);
  e.addEventListener('click',ev=>{if(L.noTap&&performance.now()-L.noTap<400){ev.stopImmediatePropagation();ev.preventDefault()}},true)}
// (2026-11-07, Wilson: "两个箭头…有啲拖拉…我有时候好快过") — the battle plays inside one step: its timings scale with play
// speed (f = 1 at 1×, .5 at 2×), and a step reached by a jump (⏭⏭, slider, back) shows the finished field at once
function batPace(){try{return Math.min(1,1/SPEEDS[spdI])}catch(e){return 1}}
export function showEvent(s){const prevI=TL.i;queueMicrotask(()=>{try{storyStep(s)}catch(e){}});for(const l of LBL)if(l.step!==undefined&&l.step!==s)l.until=performance.now();TL.i=s;rng.value=s;const i=STEPS[s],e=EVS[i],si=seasonOf(e.date);BATTLE=BAT[e.id]?{b:BAT[e.id],t0:performance.now()-(s===prevI+1?0:1e4),d:e.date,f:batPace()}:null;setSeaT(SEAS[si]);
  setTld(e.date,si);updateTowns(e.date);capitalUpdate(e.date,s===prevI+1);{const fl=llOf(e.place);if(fl)setFOCUS({x:MX(fl[0]),z:MZ(fl[1]),until:performance.now()+(SCROLL_IDS.has(e.id)?6000:e._era&&e._era.importance===3?5000:3600)})}setBorders(e.date);const ll=llOf(e.place);
  if(ll){if(SCROLL_IDS.has(e.id)){
      // 玄武门 is one unit: one pop for the whole story, opening its 说书 from the beginning
      scrollCard(ll,'pol','玄武门之变','626年 · 武德九年六月 · 长安',()=>openStory('xuanwumen',WD.places.changan.ll),null,s);
    }else if(e._era){
      // a 581–763 era event: tap opens the wiki card (openWiki below); the pop itself stays up for the whole step,
      // like the scroll card, so there is always something to tap while scrubbing a far-apart span of years
      const k=WD.kinds[e.kind]||WD.kinds.pol,ev=e._era,place=placeAt(e.place,e.date),sp=SCROLL_PAGES[ev.id];
      const bs=BAT[ev.id]?'<br>'+batSides(BAT[ev.id],ev.date):'';
      if(sp)scrollCard(ll,e.kind,spTitle(sp,ev),`${+ev.date.slice(0,4)}年 · ${nianhao(ev.date).label} · ${place}`,()=>openStory(sp.story,PL[sp.place].ll),ev,s);
      else if(ev.poem){const L=placePop('pop wiki poem',ll,poemCard(ev,place)+yinBtn(ev),()=>openPoem(ev.id,ll),1e9);L.e.style.setProperty('--kc','#a87b14');L.step=s} // (2026-11-07, Wilson: "唔中意嗰个红色…同战争冲突") — a poem's lead, pin and 诗 seal wear the 文化 ochre
      else if(ev.importance===3){const L=placePop('pop big wiki',ll,`<span class="kh">${kAnim(e.kind,'#ffe9b0')}<span class="kd" style="background:${k.color}">${k.glyph}</span></span><b>${ev.title}</b><br><small>${+ev.date.slice(0,4)}年 · ${nianhao(ev.date).label} · ${place}</small>${bs}${bs?'':'<br>'}<small>点击查看证据</small>`,()=>openWiki(ev),1e9);L.e.style.setProperty('--kc',k.color);L.step=s}
      else{const L=placePop('pop wiki',ll,`<span class="kh">${kAnim(e.kind,k.color)}<span class="kd" style="background:${k.color}">${k.glyph}</span></span><b style="color:${k.color}">${place}</b> ${ev.title}${bs}`,()=>openWiki(ev),1e9);L.e.style.borderColor=k.color;L.e.style.setProperty('--kc',k.color);L.step=s}
    }else{const k=WD.kinds[e.kind]||WD.kinds.pol;const L=placePop('pop',ll,`<span class="kh">${kAnim(e.kind,k.color)}<span class="kd" style="background:${k.color}">${k.glyph}</span></span><b style="color:${k.color}">${(PL[e.place]||{}).name||''}</b> ${e.title}`,null,e.kind==='mil'?4200:3400);L.e.style.borderColor=k.color;L.e.style.setProperty('--kc',k.color);if(e.kind==='mil')L.e.classList.add('war')}}
}
const KA={mil:'<g class="s1"><path d="M5 19L17 7M15 5l4 4M7 15l2 2"/></g><g class="s2"><path d="M19 19L7 7M5 9l4-4M17 15l-2 2"/></g><circle class="sp" cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/>',
  pol:'<g class="st"><path d="M9.5 3h5v5h-5zM7 8h10v4H7z"/></g><rect class="mk" x="6" y="17" width="12" height="4" rx="1" fill="#d8453a" stroke="none"/>',
  dip:'<path class="rl" d="M4 5v14"/><path class="rr" d="M20 5v14"/><rect class="pp" x="5" y="7" width="14" height="10" fill="currentColor" opacity=".28" stroke="none"/><path class="ln" d="M8 10.5h8M8 13.5h5"/>',
  gov:'<path d="M12 6v13M7.5 20h9"/><circle cx="12" cy="5.2" r="1.3" fill="currentColor" stroke="none"/><path class="bm" d="M3.5 6h17"/><g class="pl"><path d="M4 6v5" stroke-width="1.2"/><path d="M1 11h6a3 2.3 0 0 1-6 0z" fill="currentColor" fill-opacity=".3"/></g><g class="pr"><path d="M20 6v5" stroke-width="1.2"/><path d="M17 11h6a3 2.3 0 0 1-6 0z" fill="currentColor" fill-opacity=".3"/></g>',
  // (2026-11-07, Wilson picked the design-cul mock 1 「毛笔」 over the old squiggle-and-nib): an upright brush that dips and writes one stroke
  cul:'<g class="bh"><path d="M12 2.5v10"/><path d="M12 12.5c-2.2 1.6-2.4 4.6 0 7.5 2.4-2.9 2.2-5.9 0-7.5z" fill="currentColor" stroke-width="1.2"/></g><path class="br" pathLength="1" d="M4 21.5h16" stroke-width="1.6"/>',
  nat:'<path class="tw" d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill="currentColor" stroke="none"/>'};
export const kAnim=(kind,col)=>KA[kind]?`<span class="ka ka-${kind}" style="color:${col}"><svg viewBox="0 0 24 24">${KA[kind]}</svg></span>`:'';
/* ---------- era wiki card: a multi-source overlay for 581–763 events (data/era.json), opened from the pop above.
   Evidence items are grouped by type (正史/考古/碑刻/文物/画作/异域/今人研究); each carries a stance pill
   (支持/复杂化/相抵触) and, where data/era-images/manifest.json has a verified public-domain image, a thumbnail. */
const EV_TYPE={text:'正史',archaeology:'考古',inscription:'碑刻',artifact:'文物',art:'画作',foreign:'异域',modern:'今人研究'};
const EV_STANCE={supports:['印证','#4f7a3a'],complicates:['复杂化','#a87b14'],contradicts:['相抵触','#8e2a20']};
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
export function openWiki(ev){stopTL();const pp=PERSON.active,was=PERSON.playing;pPause();document.getElementById('wikiOv')?.remove();const k=WD.kinds[ev.kind]||WD.kinds.pol,ov=document.createElement('div');ov.id='wikiOv';
  const place=ev.placeName||(PL[ev.place]||{}).name||'',late=+ev.date.slice(0,4)>763;
  ov.innerHTML=`<div class="wsheet"><div class="whead"><span class="kd" style="background:${k.color}">${k.glyph}</span>
    <div class="wt"><b>${esc(ev.title)}</b><small>${ceOf(ev.date)}${late?'':' · '+(h=>h.dyn+' · '+h.emp+' · '+h.label)(nianhao(ev.date))} · ${esc(place)}</small></div>
    <button class="wx" aria-label="收起">✕</button></div>
    <div class="wbody">
    ${SCROLL_PAGES[ev.id]?`<button class="wscroll">${ROLLS(9,false)}📜 听说书《${esc(spTitle(SCROLL_PAGES[ev.id],ev))}》</button>`:''}
    ${ev.poem?`<div class="wpoem"><div class="wpT">${esc(ev.poem.poet)} · 《${esc(ev.poem.title)}》<small>${esc(ev.poem.form||'')}${ev.poem.excerpt?' · 节选':''}</small></div>
      ${ev.poem.text.map(l=>`<p>${esc(l)}</p>`).join('')}<button class="wyin">吟 · ${VOICED.has(ev.id)?'有声朗读':'毛笔书写（无录音）'}</button></div>`:''}
    ${ev.dateNote?`<p class="wdeb"><b>系年${{high:'',medium:'（通行说法，未必确定）',low:'（年代不详）'}[ev.dateConf]||''}：</b>${esc(ev.dateNote)}</p>`:''}
    <p class="wsum">${esc(ev.summary)}</p>
    ${ev.why?`<p class="wwhy"><b>为何重要：</b>${esc(ev.why)}</p>`:''}
    ${ev.debate?`<p class="wdeb"><b>尚有争议：</b>${esc(ev.debate)}</p>`:''}
    <div class="wevh">证据（${ev.evidence.length}）</div>
    ${ev.evidence.map((x,i)=>{const im=ERAIMG_BY_KEY.get(ev.id+'|'+i),st=EV_STANCE[x.stance]||['',''];
      return `<div class="wev"><div class="wevt">${EV_TYPE[x.type]||x.type}<span class="wst" style="background:${st[1]}">${st[0]}</span></div>
      <div class="wevb">${im?`<img class="wimg" src="data/era-images/${im.file}" loading="lazy" alt="">`:''}
      <div><div class="evT">${esc(x.title)}</div><div class="evD">${esc(x.detail)}</div>
      ${x.quote?`<div class="evQ">「${esc(x.quote)}」</div>`:''}
      <div class="evC">${esc(x.cite)}${x.url?` · <a href="${x.url}" target="_blank" rel="noopener">查看来源 ↗</a>`:''}</div>
      ${im?`<div class="evI">图：${esc(im.attribution)} · <a href="${im.commonsUrl}" target="_blank" rel="noopener">原图 ↗</a></div>`:''}</div></div></div>`}).join('')}
    </div></div>`;
  document.body.appendChild(ov);void ov.offsetHeight;ov.classList.add('open'); // forced reflow, not rAF: rAF stalls when WebGL frames are slow
  const shut=(keep)=>{ov.classList.remove('open');setTimeout(()=>ov.remove(),400);if(was&&keep!==true)pResume(pp)};
  ov.querySelector('.wx').onclick=shut;ov.addEventListener('click',e=>{if(e.target===ov)shut()});
  {const b=ov.querySelector('.wyin');if(b)b.onclick=()=>{shut(true);const ll=poemLL(ev);openScroll(poemUrl(ev.id),ll,()=>{if(was)pResume(pp)})}}
  const sp=SCROLL_PAGES[ev.id];if(sp)ov.querySelector('.wscroll').onclick=()=>{shut();openStory(sp.story,PL[sp.place].ll)}}
function stopTL(){TL.playing=false;clearTimeout(TL.timer);play.textContent='▶'}
// speed 0.5× / 1× / 2× scales the pause between events; ⏮ ⏭ move exactly one event (the slider jumps too far on a phone)
const SPEEDS=[.5,1,2];let spdI=1;const spd=document.getElementById('spd');
spd.onclick=()=>{spdI=(spdI+1)%SPEEDS.length;spd.textContent=SPEEDS[spdI]+'×'};
const tickMs=()=>(SCROLL_IDS.has(EVS[STEPS[TL.i]].id)?5200:EVS[STEPS[TL.i]]._era?2600:1800)/SPEEDS[spdI]+storyHold();
const tick=()=>{if(!TL.playing)return;if(TL.i>=STEPS.length-1)return stopTL();if(storyGate(TL.i+1))return;showEvent(TL.i+1);TL.timer=setTimeout(tick,tickMs())};
play.onclick=()=>{if(PERSON.active)return personPlay();if(TL.playing)return stopTL();TL.playing=true;play.textContent='⏸';if(TL.i>=STEPS.length-1)TL.i=-1;tick()};
function stepTL(d){if(PERSON.active)return PERSON.x?crossGo(PERSON.x.j+d):personGo(PERSON.i+d);const n=Math.max(0,Math.min(STEPS.length-1,TL.i+d));if(n===TL.i)return;clearTimeout(TL.timer);showEvent(n);if(TL.playing)TL.timer=setTimeout(tick,tickMs())}
document.getElementById('prev').onclick=()=>stepTL(-1);document.getElementById('next').onclick=()=>stepTL(1);
addEventListener('keydown',e=>{if(document.getElementById('wikiOv')||document.getElementById('scrollOv'))return;
  if(e.key==='ArrowLeft'){stepTL(-1);e.preventDefault()}else if(e.key==='ArrowRight'){stepTL(1);e.preventDefault()}else if(e.key===' '){play.onclick();e.preventDefault()}});
capitalUpdate(EVS[0].date);
rng.oninput=()=>{if(PERSON.active)return personGo(+rng.value);stopTL();showEvent(+rng.value)};
setTld(EVS[0].date);updateTowns(EVS[0].date);
{const lg=document.getElementById('lg');lg.innerHTML=Object.values(WD.kinds).map(k=>`<div><span class="kd" style="background:${k.color}">${k.glyph}</span><b>${k.name}</b> <small style="opacity:.7">${k.scope||''}</small></div>`).join('');
 lg.innerHTML+=`<div><span class="kd" style="background:#b3281c">诗</span><b>诗词</b> <small style="opacity:.7">名篇：竖排题诗，开头两句</small></div><div class="lgh">大战</div><div><span class="sw" style="background:linear-gradient(90deg,#b23a2c 70%,transparent 70%)"></span>箭头：各方由出发地进兵；同一阵营同一色，两阵必定不同色</div><div><span class="sw" style="background:radial-gradient(circle,transparent 45%,#2c4f73 50% 70%,transparent 75%)"></span>圈：守方原地守城（旗上写「守」）</div><div><span class="sw" style="background:repeating-linear-gradient(90deg,#3e3e6e 0 5px,#f6efdc 5px 7px)"></span>断笔：叛军（旗上写「叛」）</div>`;
 lg.innerHTML+=`<div class="lgh">疆域（跟时间轴变）</div><div><span class="sw" style="background:#e6c3b8"></span>淡彩：势力范围，颜色＝统治者</div><div><span class="sw" style="background:linear-gradient(90deg,#e6c3b8,#cfd6dc)"></span>两色相融：边界不清的过渡地带</div><div><span class="sw" style="background:linear-gradient(90deg,#e6c3b8 45%,#2a1d14 45% 55%,#e9dcc0 55%)"></span>墨线：较确定的边界</div><div><span class="sw" style="background:linear-gradient(90deg,#e2d2b0,#e6c3b8)"></span>附庸／羁縻：染上宗主的颜色</div><div style="opacity:.7;font-size:12px">拉远看得清楚，拉近会淡去</div>`;
 const ct=document.getElementById('ct');
 document.getElementById('lgb').onclick=()=>{ct.classList.remove('on');lg.classList.toggle('on')};
 document.getElementById('ctb').onclick=()=>{lg.classList.remove('on');ct.classList.toggle('on')};}
{let b=null;try{b=JSON.parse(sessionStorage.getItem('hs.back'));sessionStorage.removeItem('hs.back')}catch(e){}
 if(b&&STEPS[b.s]!==undefined){setTx(b.tx);setTz(b.tz);setDist(b.dist);setYawT(setYaw(b.yaw||0));showEvent(b.s);U.uSeason.value.set(...seaT)}}
// Safari's back button can restore this page from bfcache with the fade still opaque
addEventListener('pageshow',e=>{if(e.persisted)document.getElementById('fade').style.opacity=0});

/* ================= 讲古 · 章回 (Wilson 2026-11-05, the design-story mock part 2) =================
   data/huimu.json groups the timeline steps into 回. Entering a 回 shows its 回目 at the top and, at the bottom, the
   opening question, then two or three sentences in a storyteller's voice typed out, with 伏笔 / 此时·别处 chips. Its
   causal links are drawn on the map as faint red arcs from the earlier event's place. While playing, the timeline holds
   a step long enough to read, and at the end of each 回 it stops on the closing hook until 「欲知后事如何 ›」 is tapped.
   The tab folds to a small 「第N回」 strip (storyFold, remembered). */
const STORY={on:true,min:/^(off|min)$/.test(localStorage.getItem('hs.story')||''),data:null,of:new Map(),cur:-1,typ:null,typEnd:0,lines:[],passFor:-1,waiting:false};
const huimuEl=document.getElementById('huimu'),narrEl=document.getElementById('narr'),ovSvg=document.getElementById('ovSvg');
fetch('data/huimu.json').then(r=>r.ok?r.json():null).then(j=>{if(!j||!j.hui)return;STORY.data=j;
  j.hui.forEach((h,k)=>h.steps.forEach(id=>STORY.of.set(id,k)));if(TL.i>=0)storyStep(TL.i)}).catch(()=>{});
const CN='〇一二三四五六七八九',cnN=n=>n<10?CN[n]:n<20?'十'+(n%10?CN[n%10]:''):CN[Math.floor(n/10)]+'十'+(n%10?CN[n%10]:'');
const huiOf=s=>s>=0&&s<STEPS.length?STORY.of.get(EVS[STEPS[s]].id):undefined;
function storyHide(){huimuEl.hidden=true;narrEl.hidden=true;huimuEl.classList.remove('open');STORY.cur=-1;STORY.lines=[];clearInterval(STORY.typ)}
/* (revised 2026-11-05 evening, Wilson: "讲古好啰嗦，成个屏占晒；唔系每样嘢我都有兴趣") — quiet by default: entering a 回 shows
   only a small 回目 tab at the top with the opening question beneath it. Nothing else appears unless he taps the tab;
   then the story drops down under it (all text at once, no typing), with the 伏笔 / 此时·别处 notes and the closing hook,
   and playback pauses while he reads. The causal arcs stay on the map as a quiet hint. Playback no longer waits at 回 ends. */
export function storyStep(s){if(!STORY.data||!STORY.on||PERSON.active){storyHide();return}
  const k=huiOf(s);if(k===undefined){storyHide();return}const H=STORY.data.hui[k],id=EVS[STEPS[s]].id;
  if(k!==STORY.cur){STORY.cur=k;STORY.lines=[];narrEl.hidden=true;
    huimuEl.innerHTML=`<span class="fold" role="button" aria-label="收起讲古">收</span><div class="n">第 ${cnN(H.n||k+1)} 回</div><div class="t">${esc(H.title[0])}　${esc(H.title[1])}</div>${H.hook?`<div class="q">${esc(H.hook)} <span class="more">展开 ›</span></div>`:''}`;
    huimuEl.hidden=false;huimuEl.classList.remove('fresh','open');huimuEl.classList.toggle('min',STORY.min);void huimuEl.offsetWidth;huimuEl.classList.add('fresh');
    huimuEl.onclick=e=>{if(e.target.closest('.fold'))storyFold(!STORY.min);else if(STORY.min)storyFold(false);else storyToggle()}}
  /* (2026-11-05 night, Wilson: "战争效果转换咗之后，嗰条虚线仲喺度") — causal arcs belong to this step only: they used to
     pile up for the whole 回 and outlive the card they explained (a world card lasts ~4 s), leaving a bare dashed line.
     Now each step starts with none, an arc fades out after ~5 s unless the story is open, and a folded tab draws none. */
  STORY.lines=[];
  for(const c of H.causes||[])if(c.to===id){const a=stepLL(c.from),b=stepLL(c.to);if(a&&b&&!STORY.lines.some(l=>l.c===c))STORY.lines.push({a,b,note:c.note,c,t0:performance.now()})}}
function storyToggle(){if(STORY.cur<0)return;const H=STORY.data.hui[STORY.cur];
  if(!narrEl.hidden){narrEl.hidden=true;huimuEl.classList.remove('open');return}
  stopTL();const chips=[H.fubi?`<span class="chip fu">伏笔 · ${esc(H.fubi)}</span>`:'',...(H.elsewhere||[]).map(t=>`<span class="chip">此时 · 别处：${esc(t)}</span>`)].join('');
  narrEl.innerHTML=`<button class="x" aria-label="收起">×</button><div class="txt">${(H.narr||[]).map(t=>`<p>${esc(t).replace(/^(话说|却说|且说|再说)/,'<span class="say">$1</span>')}</p>`).join('')}</div>${chips?`<div class="chips">${chips}</div>`:''}${H.cliff?`<div class="cliff">${esc(H.cliff)}</div>`:''}`;
  narrEl.hidden=false;huimuEl.classList.add('open');narrEl.querySelector('.x').onclick=e=>{e.stopPropagation();narrEl.hidden=true;huimuEl.classList.remove('open')}}
function stepLL(id){const e=EVS.find(x=>x.id===id);return e?llOf(e.place):null}
// while playing: hold a step until its narration has been typed out, plus a beat to read it
function storyHold(){return 0}
// while playing: stop at the end of a 回 and wait for 「欲知后事如何 ›」
function storyGate(n){return false}
/* (2026-11-05 night, Wilson: "讲古个 button 唔需要…直接喺上面收埋佢") — no button: the tab itself folds. ︿ shrinks it to a
   faint 「第N回」 strip that keeps counting 回 as the timeline moves; tapping the strip brings the tab back. Remembered. */
export function storyFold(m){STORY.min=m;localStorage.setItem('hs.story',m?'min':'on');huimuEl.classList.toggle('min',m);
  if(m){narrEl.hidden=true;huimuEl.classList.remove('open')}}

/* ================= 人物视角 v2 (2026-11-10, Wilson: "用原本嘅 3D 地图做底…由一个人嘅视角开始…再列出同佢人生有交集嘅名人") =================
   data/people.json: pick a protagonist (「人物」 button: portraits) and the timeline becomes their life — ⏮ ⏭ ▶ and the
   slider walk their stops; the camera flies to each; their route is drawn in their own colour (travelled part solid, the
   rest faint), their portrait rides the route, a card shows age · post · what happened, and a life bar their 身份 phases.
   Above the bar, 交集 lists the famous people whose lives crossed theirs (data crossings, ranked: real meetings first,
   then how often). Tapping one turns the card into that crossing — when, where, what happened, the source, ▶看片 when a
   film exists — while the other's route shows faint around the overlap only and a seal pulses on the place; ‹ › (and
   ⏮ ⏭) step through their crossings, 换视角 makes the other the protagonist. The protagonist stays first: their portrait,
   colour and life bar never give way. × closes the crossing, then leaves; the ordinary timeline comes back at the same
   year. The map's borders stop at 763: a later stop (杜甫 died 770) still shows, the borders and 年号 stay at 763.
   v123 (2026-11-10 17:48, Wilson: "条路线唔清楚…用会郁嘅虚线"; "另外嗰个人得半条线，好似冇用…要好似普通事件咁，一点
   行去一个地方，喺嗰度有个动画话佢哋喺度见面") — the route is moving dashes (travelled part bold, the rest faint); stepping
   one stop on walks the portrait along the leg and the stop lands as an ordinary event card (placePop: card, lead line,
   pulsing ring), one at a time. A crossing no longer draws the other's half-route: each of the two comes along a short
   moving dashed arc from where they last were, they meet, the seal stamps and a ripple spreads. 传说 / 同城 / 隔空 come
   in dotted and stay apart. ▶ plays the stops and, after each, its crossings in turn. Design: the task's design.md. */
export const PERSON={data:null,active:null,i:0,timer:0,playing:false,x:null,leg:null,pop:null,popT:0,q:[]};
const RMO=matchMedia('(prefers-reduced-motion: reduce)'),pSpd=()=>{try{return SPEEDS[spdI]}catch(e){return 1}};
fetch('data/people.json').then(r=>r.ok?r.json():null).then(j=>{if(j&&j.people)PERSON.data=j}).catch(()=>{});
const whoEl=document.getElementById('who'),lifeEl=document.getElementById('life'),pplEl=document.getElementById('peopleOv'),xsEl=document.getElementById('xs');
const ROLEC=['#8a7550','#7a4f8a','#b07a1e','#a3291d','#3f6e3a','#3d6680']; // each dark enough to draw a route on the map
// crossing kinds: seal glyph, words, colour
// [3]: what the map says beside the seal; [4]: do the two dots meet on the place
export const XKIND={met:['遇','真见过','#b3281c','',1],legend:['传','传说','#7a4f8a','传说 · 未必真见过',0],near:['同','同城·无交往记载','#6b6255','同在一城 · 无见面记载',0],saw:['望','远远见到','#3d6680','远远见到',1],far:['念','隔空','#4f6b45','隔空 · 未曾见面',0]};
const roleAt=(p,y)=>{let k=p.roles.findIndex(r=>y>=r.from&&y<r.to);if(k<0)k=y<p.roles[0].from?0:p.roles.length-1;return k};
const ydate=y=>String(Math.max(581,Math.min(763,y))).padStart(4,'0')+'-06-30'; // the era's data runs 581–763
const pById=id=>PERSON.data&&PERSON.data.people.find(p=>p.id===id);
const faceH=(p,g,cls='face')=>p&&p.img?`<img class="${cls}" src="${p.img}" alt="${esc(p.name)}像" title="${esc(p.imgCredit?p.imgCredit.cap+' · 后人想象':'后人想象')}">`:`<div class="${cls}">${esc(p?p.face||p.name[0]:g.face)}</div>`;
// everyone whose life crossed p's: [{k, o (person) or g (guest), l: crossings by year}], real meetings first, then how many
export function crossList(p){const m=new Map(),D=PERSON.data;if(!D||!D.crossings)return [];
  for(const c of D.crossings){if(c.a!==p.id&&c.b!==p.id)continue;const oid=c.a===p.id?c.b:c.a,k=oid||'g:'+c.guest.name;if(!m.has(k))m.set(k,{k,o:oid?pById(oid):null,g:oid?null:c.guest,l:[]});m.get(k).l.push(c)}
  const met=e=>e.l.some(c=>c.kind==='met')?0:1;
  return [...m.values()].map(e=>(e.l.sort((a,b)=>a.year-b.year),e)).sort((a,b)=>met(a)-met(b)||b.l.length-a.l.length||a.l[0].year-b.l[0].year)}
const xYears=l=>{const a=l[0].year,b=Math.max(...l.map(c=>c.years?c.years[1]:c.year));return a===b?`${a}`:`${a}–${b}`};
document.getElementById('bPeople').onclick=()=>{if(PERSON.active)return exitPerson();if(!PERSON.data)return;
  const row=p=>`<div class="p${p.id===PERSON.last?' on':''}" data-id="${p.id}" style="--c:${p.c}" tabindex="0" role="button">${faceH(p)}<div><b>${esc(p.name)}</b><small>${p.born}–${p.died} · ${esc(p.roles.map(r=>r.label).join(' → '))}</small><small class="xn">交集 ${crossList(p).length} 人</small></div></div>`,
    P=PERSON.data.people;
  pplEl.innerHTML=`<div class="pnl glass"><h3>人物视角</h3><div class="ls">${P.filter(p=>!p.cameo).map(row).join('')}<h4>配角 · 只收与主角相交的几站</h4>${P.filter(p=>p.cameo).map(row).join('')}</div><p class="nt">画像都是后人想象画，唐人真容没有流传下来</p></div>`;
  pplEl.hidden=false;pplEl.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('p')){e.preventDefault();e.target.click()}};
  {const r=pplEl.querySelector('.p.on');if(r)r.scrollIntoView({block:'nearest'})}pplEl.onclick=e=>{const r=e.target.closest('.p');if(!r&&e.target.closest('.pnl'))return;pplEl.hidden=true;if(r)enterPerson(pById(r.dataset.id))}};
export function enterPerson(p){PERSON.last=p.id;stopTL();if(PERSON.playing)personPlay();popOff();PERSON.active=p;PERSON.x=null;PERSON.leg=null;PERSON.q=[];setCAPMOVE(null);document.body.classList.add('pmode');document.getElementById('bPeople').classList.add('on');
  for(const l of LBL)if(l.cls.startsWith('pop'))l.until=performance.now();storyHide();document.getElementById('wikiOv')?.remove();
  const span=p.died-p.born||1,X=PERSON.xl=crossList(p);landReset(p);
  const pct=y=>Math.max(0,Math.min(100,(y-p.born)/span*100));
  lifeEl.innerHTML=`<div class="ends"><span>${p.born} 生</span><span>${p.died} 卒</span></div><div class="trk"><div class="bar">${p.roles.map((r,k)=>`<i style="width:${Math.max(1.5,(r.to-r.from)/span*100)}%;background:${ROLEC[k%ROLEC.length]}"></i>`).join('')}<span class="fut"></span></div>`+
    p.stops.map((st,i)=>{const k=roleAt(p,st.year),turn=i>0&&k!==roleAt(p,p.stops[i-1].year);return `<b class="tk${turn?' turn':''}" data-i="${i}" title="${st.year} ${esc(st.place)}" style="left:${pct(st.year)}%;--c:${ROLEC[k%ROLEC.length]}"></b>`}).join('')+
    // a small seal over the bar for every crossing; tapping one opens it
    X.flatMap(e=>e.l.map((c,j)=>`<b class="xm" data-k="${esc(e.k)}" data-j="${j}" title="${c.year} ${esc(e.o?e.o.name:e.g.name)}" style="left:${pct(c.year)}%;--c:${XKIND[c.kind][2]}"></b>`)).join('')+
    `<span class="now">${esc(p.face||p.name[0])}</span></div>`+
    `<div class="lbl">${(()=>{let pc=-99,pw=0,row=1;return p.roles.map((r,k)=>{const c=((r.from+r.to)/2-p.born)/span*100,w=r.label.length*3.6;row=c-pc<(w+pw)/2+2?1-row:0;pc=c;pw=w;return `<span data-k="${k}" style="left:${Math.min(94,Math.max(6,c))}%;top:${row*14}px;color:${ROLEC[k%ROLEC.length]}">${esc(r.label)}</span>`}).join('')})()}</div>`;
  lifeEl.onclick=e=>{const x=e.target.closest('.xm');if(x)return openCross(x.dataset.k,+x.dataset.j);const t=e.target.closest('.tk');if(t){if(PERSON.playing)personPlay();personGo(+t.dataset.i)}};
  xsEl.innerHTML=`<span class="h">交<br>集<small>${X.length}人</small></span><div class="row">${X.map(e=>{const n=e.o?e.o.name:e.g.name,soft=!e.l.some(c=>c.kind==='met');
    return `<button class="xc${soft?' soft':''}" data-k="${esc(e.k)}" style="--c:${e.o?e.o.c:'#6b6255'}">${faceH(e.o,e.g,'f')}<span><b>${esc(n)}</b><small>${xYears(e.l)} · ${soft?XKIND[e.l[0].kind][1]:e.l.length+'次'}</small></span></button>`}).join('')}</div>`;
  xsEl.onclick=e=>{const b=e.target.closest('.xc');if(!b)return;if(PERSON.x&&PERSON.x.k===b.dataset.k)return closeCross();openCross(b.dataset.k,0)};
  xsEl.scrollLeft=0;lifeEl.hidden=false;whoEl.hidden=false;xsEl.hidden=!X.length;rng.max=p.stops.length-1;personGo(0)}
// the map year: borders, towns, capital and the year label follow it; past 763 the map holds at 763
function personYear(y,age,p){const d=ydate(y),h=nianhao(d);
  tld.innerHTML=`<span class="t1">公元${y}年 · ${esc(p.name)}${age}岁</span><span class="t2">${y>763?'地图止于763年':h.dyn+' · '+h.label.replace(/ .*/,'')}</span>`;
  setBorders(d);updateTowns(d);capitalUpdate(d);{const x=Math.max(0,Math.min(100,(y-p.born)/(p.died-p.born||1)*100)),k=roleAt(p,y),nw=lifeEl.querySelector('.now');nw.style.left=x+'%';nw.style.setProperty('--c',ROLEC[k%ROLEC.length]);
    lifeEl.querySelector('.fut').style.left=x+'%';for(const sp of lifeEl.querySelectorAll('.lbl span'))sp.classList.toggle('cur',+sp.dataset.k===k)}}
/* a stop's event: the ordinary event card on the place (placePop, so it gets the lead line and the pulsing ring like any
   event), one at a time: the last stop's card goes when the next one lands or a crossing opens */
function popOff(){clearTimeout(PERSON.popT);if(PERSON.pop){PERSON.pop.until=performance.now()+250;PERSON.pop=null}}
function stopPop(i){const p=PERSON.active;popOff();if(!p||PERSON.x)return;const st=p.stops[i],t=String(st.text||''),tx=t.length>34?t.slice(0,33)+'…':t;
  /* v131: a stop where he wrote a poem shows that poem on the 编年体 poem card (inscription + 吟), with the stop on one
     line above it; several poems there: 1/2 › steps through them. Tapping the card opens the poem's show (v133; was
     its text sheet). */
  const ps=(st.poems||[]).map(poemById).filter(Boolean);
  if(ps.length){let k=0;const h=()=>{const ev=ps[k];return `<span class="sh"><span class="kd" style="background:${p.c}">${esc(p.face||p.name[0])}</span><b style="color:${p.c}">${esc(st.place)}</b> ${st.year}年 · ${esc(st.title||'')}</span>`+
      poemCard(ev,poemPlace(ev),poemYear(ev)).replace('<span class="sl">诗</span>',ev.poem.poet!==p.name?`<span class="sl">赠</span>`:'<span class="sl">诗</span>')+yinBtn(ev).replace('</span>',ps.length>1?`<button class="pnx" aria-label="下一首">${k+1}/${ps.length} ›</button></span>`:'</span>')};
    const L=placePop('pop wiki poem pstop',st.ll,h(),()=>openPoem(ps[k].id,st.ll),1e9,{kc:p.c});L.e.style.setProperty('--pc',p.c);L.pstop=i;L.ps=ps;L.next=()=>{k=(k+1)%ps.length;L.e.innerHTML=h()};PERSON.pop=L;return}
  const L=placePop('pop wiki pstop',st.ll,`<span class="kh"><span class="kd" style="background:${p.c}">${esc(p.face||p.name[0])}</span></span><b style="color:${p.c}">${esc(st.place)}</b> ${st.year}年 · ${esc(st.title||'')}<br><small>${esc(tx)}</small>`,null,1e9);
  L.e.style.borderColor=p.c;L.e.style.setProperty('--kc',p.c);L.pstop=i;PERSON.pop=L}
// the stop index each crossing hangs on (the protagonist's last stop not after it)
const stopOf=(p,y)=>{let i=0;p.stops.forEach((s,q)=>{if(s.year<=y)i=q});return i};
const stopFor=(p,c)=>{const m=p.stops.findIndex(s=>s.year===c.year&&Math.hypot(s.ll[0]-c.ll[0],s.ll[1]-c.ll[1])<=.3);return m>=0?m:stopOf(p,c.year)};
function crossAt(i){const p=PERSON.active,r=[];for(const e of PERSON.xl||[])e.l.forEach((c,j)=>{if(stopFor(p,c)===i)r.push([e.k,j,c.year])});return r.sort((a,b)=>a[2]-b[2])}
export function personGo(i){const p=PERSON.active;if(!p)return;if(PERSON.x)closeCross(true);i=Math.max(0,Math.min(p.stops.length-1,i));const i0=PERSON.i;PERSON.i=i;rng.value=i;const st=p.stops[i];
  // one stop on (▶, ⏭, the slider by one): the portrait walks the leg, then the stop lands; anything else lands at once
  const D=i===i0+1&&!RMO.matches?1300/pSpd():0;PERSON.leg=D?{a:i0,b:i,t0:performance.now(),d:D}:null;popOff();PERSON.popT=setTimeout(()=>{PERSON.leg=null;stopPop(i)},D);
  PERSON.pb=null;stopUI(i);
  personYear(st.year,st.age,p);
  const prev=p.stops[Math.max(0,i-1)],far=Math.hypot(st.ll[0]-prev.ll[0],st.ll[1]-prev.ll[1])>8;fly(MX(st.ll[0]),MZ(st.ll[1]),far?1300:Math.min(Math.max(dist,520),900))}
// the stop's card in #who (no year, no camera: ▶ keeps those on its own clock)
function stopUI(i){const p=PERSON.active,st=p.stops[i];whoEl.className='glass';
  whoEl.innerHTML=`<button class="x" aria-label="退出人物视角">×</button>${faceH(p)}<div><div class="nm" style="color:${p.c}">${esc(p.name)}</div><div class="st">${st.year}年 · ${st.age}岁 · ${esc(st.title||'')}</div><div class="tx">${esc(st.place)}：${esc(st.text)}</div><div class="src">${esc(st.src||'')}</div></div>`;
  whoEl.querySelector('.x').onclick=exitPerson}
// a crossing: k = the other person's id (or g:<guest name>), j = which of their crossings
// auto: opened by ▶ (play goes on afterwards); a tap pauses play
export function openCross(k,j,auto){const p=PERSON.active;if(!p)return;const e=crossList(p).find(x=>x.k===k);if(!e)return;if(PERSON.playing&&!auto)personPlay();
  PERSON.x={k,e,j:0,t0:0,auto:!!auto};for(const b of xsEl.querySelectorAll('.xc'))b.classList.toggle('on',b.dataset.k===k);
  {const b=xsEl.querySelector('.xc.on');if(b)b.scrollIntoView({block:'nearest',inline:'nearest'})}
  crossGo(j||0)}
export function crossGo(j){const p=PERSON.active,X=PERSON.x;if(!p||!X)return;const e=X.e;j=Math.max(0,Math.min(e.l.length-1,j));X.j=j;X.t0=performance.now()+(RMO.matches||X.auto?0:500); // a tap: he sets out once the camera is on its way
  const c=e.l[j],o=e.o,n=o?o.name:e.g.name,K=XKIND[c.kind],film=c.film&&PERSON.data._meta.films&&PERSON.data._meta.films[c.film];
  // the protagonist's own stop for that year (the last one not after it) carries the slider and the life bar
  const i=stopFor(p,c);PERSON.i=i;rng.value=i;PERSON.leg=null;popOff();
  /* where each of the two comes from: the protagonist from their stop for that year (the one before, if that stop is the
     meeting place itself), the other from their last stop before the crossing that is somewhere else; a guest, or
     someone already there, steps in from just beside it */
  {const away=s=>Math.hypot(s.ll[0]-c.ll[0],s.ll[1]-c.ll[1])>.3,
     // the stops up to the one that is this meeting (same year, same place), or up to that year
     upTo=q=>{const m=q.stops.findIndex(s=>s.year===c.year&&!away(s));return m>=0?q.stops.slice(0,m):q.stops.filter(s=>s.year<=c.year)},
     A=upTo(p).reverse().find(away),Bs=o?upTo(o).reverse().find(away)||o.stops.find(s=>s.year>c.year&&away(s)):null;
   X.a0=X.auto?p.stops[i].ll:A?A.ll:null;X.b0=Bs?Bs.ll:null}
  for(const m of lifeEl.querySelectorAll('.xm'))m.classList.toggle('on',m.dataset.k===X.k&&+m.dataset.j===j);
  whoEl.className='glass xmode';document.body.classList.add('xopen');
  whoEl.innerHTML=`<button class="x" aria-label="收起交集">×</button><div class="hd">${faceH(p)}<span class="vs">×</span>${faceH(o,e.g,'face o')}<div><div class="nm"><span style="color:${p.c}">${esc(p.name)}</span> <small>与</small> <span style="color:${o?o.c:'#5a4630'}">${esc(n)}</span></div>`+
    `<div class="st">${c.years?c.years[0]+'–'+c.years[1]:c.year}年 · ${esc(c.place)}${c.approx?' · 年份推定':''}</div><div class="st">${esc(p.name)}${c.year-p.born}岁${o?` · ${esc(n)}${c.year-o.born}岁`:''}</div></div></div>`+
    `<div class="xk"><i style="background:${K[2]}">${K[0]}</i>${K[1]} · <b>${esc(c.title)}</b></div><div class="tx">${esc(c.text)}</div>${c.poem?`<div class="po">${esc(c.poem)}</div>`:''}<div class="src">出处：${esc(c.src)}</div>`+
    `<div class="nav">${e.l.length>1?`<button class="pv" aria-label="上一次"${j?'':' disabled'}>‹</button><span>${j+1}/${e.l.length}</span><button class="nx" aria-label="下一次"${j<e.l.length-1?'':' disabled'}>›</button>`:''}`+
    `${film?`<button class="film">▶ 看片 · ${esc(film.title)}</button>`:''}${o?`<button class="sw">换成${esc(n)}的视角</button>`:''}</div>`;
  whoEl.querySelector('.x').onclick=()=>closeCross();
  {const b=whoEl.querySelector('.pv');if(b)b.onclick=()=>{pPause();crossGo(X.j-1)}}{const b=whoEl.querySelector('.nx');if(b)b.onclick=()=>{pPause();crossGo(X.j+1)}}
  {const b=whoEl.querySelector('.film');if(b)b.onclick=()=>pPause()||openScroll(film.href+(film.href.includes('?')?'&':'?')+'embed=1',c.ll)}
  {const b=whoEl.querySelector('.sw');if(b)b.onclick=()=>{const id=c.id;enterPerson(o);const f=crossList(o).find(x=>x.k===p.id);if(f)openCross(p.id,Math.max(0,f.l.findIndex(x=>x.id===id)))}}
  if(X.auto)return; // inside ▶ the clock keeps the year and the camera follows
  personYear(c.year,c.year-p.born,p);
  fly(MX(c.ll[0]),MZ(c.ll[1]),Math.min(Math.max(dist,600),900))}
// back to the protagonist's own life at the stop the crossing sat on (quiet: personGo is about to draw its own stop)
export function closeCross(quiet){if(!PERSON.x)return;PERSON.x=null;document.body.classList.remove('xopen');for(const b of xsEl.querySelectorAll('.xc.on'))b.classList.remove('on');for(const m of lifeEl.querySelectorAll('.xm.on'))m.classList.remove('on');
  if(!quiet)personGo(PERSON.i)}
const pPause=()=>{if(PERSON.playing)personPlay()};
// ▶ goes on from the same moment after a sheet or a poem it paused for (only if still the same person, still paused)
function pResume(p){if(p&&PERSON.active===p&&!PERSON.playing&&PERSON.pb){PERSON.playing=true;play.textContent='⏸';PERSON.pb.last=performance.now()}}
/* ▶ v127 (2026-11-10 22:13, Wilson: 跳下跳下…带住条线行过去) — one playback clock instead of personGo per stop + timers.
   Each stop is a segment: a dwell (the stop's card stands, the year ticks on through the years he stayed, his crossings
   there open one after another) then the road to the next stop (the portrait walks it, the line grows behind him).
   Time on the road ∝ √distance (1.2–3.5 s), dwell ∝ years stayed (0.8–3 s) + 3.4 s per crossing; the camera only
   eases after him when he nears the edge. pbTick runs from overlayFrame every frame; ⏸ keeps the clock to resume. */
const XSLOT=3400,kmOf=(a,b)=>Math.hypot((b[0]-a[0])*111*Math.cos((a[1]+b[1])*Math.PI/360),(b[1]-a[1])*111);
function pbSeg(k){const p=PERSON.active,a=p.stops[k],b=p.stops[k+1],xs=crossAt(k),y1=b?b.year:a.year,
    dwell=Math.min(3000,Math.max(800,800+(y1-a.year)*450))+(a.poems&&a.poems.length?1800:0)+xs.length*XSLOT,travel=b?Math.min(3500,Math.max(1200,Math.sqrt(kmOf(a.ll,b.ll))*90)):0,
    keys=[[0,a.year]],slots=[];let y=a.year;
  xs.forEach(([k2,j,cy],n)=>{const t0=500+n*XSLOT;cy=Math.max(y,Math.min(y1,cy));keys.push([t0,cy],[t0+XSLOT-300,cy]);y=cy;slots.push({t0,t1:t0+XSLOT-300,k:k2,j})});
  keys.push([dwell+travel,y1]);return {k,dwell,travel,keys,slots,s:-1}}
const yearAt=(K,t)=>{for(let n=1;n<K.length;n++)if(t<=K[n][0]){const [t0,y0]=K[n-1],[t1,y1]=K[n];return Math.floor(y0+(y1-y0)*(t1>t0?(t-t0)/(t1-t0):1)+1e-6)}return K[K.length-1][1]};
function pbTick(now){const B=PERSON.pb,p=PERSON.active;if(!B)return;const rd=Math.min(100,now-B.last);B.last=now;if(!PERSON.playing)return;
  B.t+=rd*pSpd();const S=B.seg;
  const sl=S.slots.findIndex(x=>B.t>=x.t0&&B.t<x.t1);
  if(sl!==S.s){if(S.s>=0&&PERSON.x){closeCross(true);stopUI(S.k)}S.s=sl;if(sl>=0){popOff();openCross(S.slots[sl].k,S.slots[sl].j,true)}}
  const y=yearAt(S.keys,B.t);if(y!==PERSON.yr){PERSON.yr=y;personYear(y,y-p.born,p)}
  let H=p.stops[S.k].ll;
  if(B.t>=S.dwell){const b=S.k+1;if(b>=p.stops.length){PERSON.playing=false;PERSON.pb=null;play.textContent='▶';return}
    if(PERSON.x){closeCross(true);stopUI(S.k)}
    const u=Math.min(1,(B.t-S.dwell)/S.travel);if(!PERSON.leg){popOff();PERSON.leg={a:S.k,b,u:0}}PERSON.leg.u=u;H=lerpLL(H,p.stops[b].ll,ease(u));
    if(u>=1){PERSON.leg=null;PERSON.i=b;rng.value=b;stopUI(b);stopPop(b);B.seg=pbSeg(b);B.t=0}}
  if(PERSON.x)H=PERSON.x.e.l[PERSON.x.j].ll;
  // the camera eases after the head only once it nears the edge, and lets go when it is back near the middle
  const q=scr(H),o=q?Math.max(Math.abs(q[0]/innerWidth-.5)/.26,Math.abs(q[1]/innerHeight-.42)/.2):9;
  if(o>1)B.fc=1;else if(o<.35)B.fc=0;
  if(B.fc){const k=1-Math.exp(-rd/600),ex=MX(H[0])-tx,ez=MZ(H[1])-tz;if(Math.hypot(ex,ez)<1.5)B.fc=0;else{setTx(tx+ex*k);setTz(tz+ez*k)}}}
function personPlay(){const p=PERSON.active;if(PERSON.playing){PERSON.playing=false;clearTimeout(PERSON.timer);play.textContent='▶';return}
  if(PERSON.x)closeCross(true);PERSON.playing=true;play.textContent='⏸';
  if(PERSON.pb&&PERSON.pb.seg.k===PERSON.i){PERSON.pb.last=performance.now();return} // resume where it paused
  if(PERSON.i>=p.stops.length-1)personGo(0);
  PERSON.leg=null;PERSON.yr=p.stops[PERSON.i].year;PERSON.pb={t:0,last:performance.now(),seg:pbSeg(PERSON.i),fc:0}}
function exitPerson(){const p=PERSON.active;if(!p)return;const y=PERSON.x?PERSON.x.e.l[PERSON.x.j].year:p.stops[PERSON.i].year;PERSON.playing=false;clearTimeout(PERSON.timer);play.textContent='▶';
  popOff();xcardOff();PERSON.leg=null;PERSON.q=[];PERSON.active=null;PERSON.x=null;document.body.classList.remove('pmode','xopen');document.getElementById('bPeople').classList.remove('on');whoEl.hidden=true;lifeEl.hidden=true;xsEl.hidden=true;ovSvg.innerHTML='';pmA.hidden=true;plBox.hidden=true;prSvg.style.display='none';
  rng.max=STEPS.length-1;let s=STEPS.findIndex(i=>+EVS[i].date.slice(0,4)>=y);if(s<0)s=STEPS.length-1;showEvent(s)}
// the protagonist's portrait on the map: rides their route (at the crossing place while a real meeting is open).
// Persistent HTML moved by `translate`, like the pins (no per-frame <image> churn). v130: above every map layer (.pmark
// z-index 4 > #lab 3), under the UI chrome and sheets.
const pmA=document.createElement('div');pmA.className='pmark';pmA.hidden=true;
document.body.insertBefore(pmA,document.getElementById('lab'));
function pmSet(el,p,g,q){if(!q){el.hidden=true;return}
  const key=p?p.id:g.name;if(el.dataset.k!==key){el.dataset.k=key;el.innerHTML=faceH(p,g,'f');el.style.setProperty('--c',p?p.c:'#6b6255')}
  el.hidden=false;pmMove(el,q)}
function pmMove(el,q){const t=`${q[0].toFixed(1)}px ${q[1].toFixed(1)}px`;if(el.style.translate!==t)el.style.translate=t}
/* v130 落脚点 (2026-11-11 06:56, Wilson approved design-meet2.html?opt=3: "基本上就系呢种效果") — every crossing is one
   landing point on its place, the 编年体 pin (#pins 单圈呼吸: gradient disk breathing, one thin ring every 3.2 s, a 9 px
   dot) on a paper-cream base, with a one-line caption under it: [the other's small portrait] 744 洛阳 · 遇杜甫. It lands
   when the crossing opens; once he walks on it stays behind faint (no ring). Tapping the point or the caption opens the
   reading sheet (#wikiOv: what the two did, the lines, the source); ▶ pauses while it is open and resumes on close.
   Replaces v126's side-by-side portraits, the two arcs and the ripple. Own layer #pLand, z-index 3 (above #pRoute's ink
   dots and #ovSvg's stop dots, which are 2), under the moving portrait. One point per year+place (梁宋 744 has two). */
const plBox=document.createElement('div');plBox.id='pLand';plBox.hidden=true;document.body.insertBefore(plBox,document.getElementById('lab'));
const LPTS=new Map(),XVERB={met:'遇',saw:'远远望见',legend:'传说遇',near:'同城 · ',far:'隔空念'};
function landReset(p){for(const v of LPTS.values())v.remove();LPTS.clear();xcardOff();PERSON.lseen=new Set();
  PERSON.xf=PERSON.xl.flatMap(e=>e.l.map(c=>({c,o:e.o,g:e.g,st:stopFor(p,c),key:c.year+'|'+c.ll[0].toFixed(1)+'|'+c.ll[1].toFixed(1)})))}
function landPt(x){let d=LPTS.get(x.key);if(!d){d=document.createElement('div');d.className='lp';d.innerHTML='<i class="base"></i><i class="disk"></i><i class="ring"></i><i class="dt"></i><i class="hit"></i>';
  plBox.appendChild(d);LPTS.set(x.key,d)}d.dataset.id=x.c.id;d.style.setProperty('--pc',XKIND[x.c.kind][2]);return d}
function landFrame(now,X,xc,land){const I=PERSON.leg?PERSON.leg.a:PERSON.i,seen=PERSON.lseen,show=new Map();if(plBox.hidden)plBox.hidden=false;
  if(xc&&land!=null)seen.add(xc.id);
  for(const x of PERSON.xf||[]){const on=x.c===xc&&land!=null,cur=!on&&!X&&!PERSON.playing&&!PERSON.leg&&x.st===I;
    if(!(on||cur||x.st<I||x.st===I&&seen.has(x.c.id)))continue;const s=show.get(x.key);if(!s||on||cur&&!s.on)show.set(x.key,{x,on:on||cur,cap:on?land>=(RMO.matches?0:350):cur})}
  let capX=null;
  for(const [k,d] of LPTS)if(!show.has(k)&&!d.hidden)d.hidden=true;
  for(const [k,s] of show){const q=scr(s.x.c.ll),d=landPt(s.x);if(!q){d.hidden=true;continue}d.hidden=false;pmMove(d,q);d.classList.toggle('old',!s.on);if(s.cap&&!capX)capX=[s.x,q]}
  if(!capX){xcardOff();return}
  /* v131: the crossing's words are the same map card as a stop or a 编年体 event (placePop: lead line, drag), anchored
     on the landing point — noPin, since the landing point is its pin. Tapping it opens the reading sheet. */
  const [x]=capX,c=x.c;if(!PERSON.xcard||PERSON.xcard.xid!==c.id){xcardOff();const n=x.o?x.o.name:x.g.name,v=XVERB[c.kind]||'遇';
    const L=placePop('pop wiki pcross',c.ll,`<span class="kh">${faceH(x.o,x.g,'f')}</span><b>${c.year} ${esc(String(c.place).replace(/（[^）]*）/g,''))}</b> · ${c.kind==='near'?'与'+esc(n)+'同城':v+esc(n)}<br><small>${esc(c.title||'')}${c.poem?' · 有诗':''} · 点开看</small>`,()=>xSheet(x),1e9,{key:'x|'+c.id,noPin:1,kc:XKIND[c.kind][2]});
    L.e.style.setProperty('--c',x.o?x.o.c:'#6b6255');L.xid=c.id;PERSON.xcard=L}}
function xcardOff(){if(PERSON.xcard){PERSON.xcard.until=performance.now()+250;PERSON.xcard=null}}
plBox.onclick=e=>{const t=e.target.closest('.lp');if(!t)return;const x=(PERSON.xf||[]).find(v=>v.c.id===t.dataset.id);if(x)xSheet(x)};
// the reading sheet for a crossing; ▶ pauses while it is open and goes on from the same moment when it closes
function xSheet(x){const p=PERSON.active;if(!p)return;const c=x.c,o=x.o,n=o?o.name:x.g.name,K=XKIND[c.kind],was=PERSON.playing;pPause();
  document.getElementById('wikiOv')?.remove();const ov=document.createElement('div');ov.id='wikiOv';ov.className='xsheet';
  const fc=(q,g)=>`<span style="--c:${q?q.c:'#6b6255'}">${faceH(q,g,'wf')}</span>`;
  ov.innerHTML=`<div class="wsheet"><div class="whead"><span class="wfaces">${fc(p)}${fc(o,x.g)}</span>
    <div class="wt"><b>${esc(c.title)} · ${esc(p.name)} × ${esc(n)}</b><small>${c.years?c.years[0]+'–'+c.years[1]:c.year} · ${esc(c.place)}${c.approx?' · 年份推定':''} · ${K[1]}</small></div>
    <button class="wx" aria-label="收起">✕</button></div>
    <div class="wbody"><p class="wq">他们做了什么</p><p class="wsum">${esc(c.text)}</p>${c.poem?`<div class="wpoem"><div class="wpT">他们留下的句子</div><p>${esc(c.poem)}</p></div>`:''}
    <div class="wevh">出处</div><p class="wsum wsrc">${esc(c.src)}</p></div></div>`;
  document.body.appendChild(ov);void ov.offsetHeight;ov.classList.add('open');
  const shut=()=>{ov.classList.remove('open');setTimeout(()=>ov.remove(),RMO.matches?0:400);
    if(was)pResume(p)};
  ov.querySelector('.wx').onclick=shut;ov.addEventListener('click',e=>{if(e.target===ov)shut()})}
/* the lifeline: its own <svg> of persistent paths whose `d` is rewritten only when it changes; the per-frame overlay
   below keeps the dots and names. v124 (2026-11-10 21:15, Wilson: 成世人条虚线好怪) — read like a journey map, not a
   marquee: the travelled part is one calm solid line in the person's colour on a pale casing (so it holds on any
   terrain), what is still ahead is a thin faint line, and the only motion is on the leg being walked: a short comet
   tail behind the portrait that settles into the solid line on arrival. Crossing arcs are solid while the two walk
   in; a dotted arc means "no record they met" (传说 / 同城 / 隔空), the map convention for uncertain. */
const PRNS='http://www.w3.org/2000/svg',prSvg=document.createElementNS(PRNS,'svg');prSvg.id='pRoute';prSvg.style.display='none';document.body.insertBefore(prSvg,ovSvg);
const PR={};for(const [k,cls] of [...[0,1,2,3,4,5].map(r=>['f'+r,'ln fut']),['trail','g']]){const e=document.createElementNS(PRNS,k==='trail'?'g':'path');e.setAttribute('class',cls);prSvg.appendChild(e);PR[k]=e}
const PRL=[];function prl(k){if(!PRL[k]){const h=document.createElementNS(PRNS,'path'),d=document.createElementNS(PRNS,'path');h.setAttribute('class','dh');d.setAttribute('class','dt');PR.trail.append(h,d);PRL[k]=[h,d]}return PRL[k]}
const sa=(e,k,v)=>{if(e.getAttribute(k)!==v)e.setAttribute(k,v)},f1=n=>n.toFixed(1);
const lerpLL=(a,b,u)=>[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u],ease=u=>u<.5?2*u*u:1-Math.pow(-2*u+2,2)/2;
// polyline through projected stops a..b, broken where a stop is behind the camera
// a crossing arc on screen: from S (clamped to a short reach from the place) to the end beside the place; t in 0..1
function xArc(S,E,dflt,u,avoid,keep){if(keep&&S&&Math.hypot(E[0]-S[0],E[1]-S[1])<70)return {d:'',at:[S[0]+(E[0]-S[0])*u,S[1]+(E[1]-S[1])*u],s:S};const R=Math.min(200,innerWidth*.36);keep=keep&&S;let s=S;if(!keep&&(!s||Math.hypot(s[0]-E[0],s[1]-E[1])<24))s=[E[0]+dflt[0],E[1]+dflt[1]];
  let dx=s[0]-E[0],dy=s[1]-E[1],l=Math.hypot(dx,dy);
  // B coming from (nearly) the same side as A swings 45° off A's line, so the two arcs never lie on one another
  if(avoid&&!keep){const da=Math.atan2(dy,dx)-Math.atan2(avoid[1]-E[1],avoid[0]-E[0]),w=Math.atan2(Math.sin(da),Math.cos(da));if(Math.abs(w)<.6){const r=(w<0?-1:1)*.8-w,c=Math.cos(r),sn=Math.sin(r);[dx,dy]=[dx*c-dy*sn,dx*sn+dy*c]}}
  const rr=keep?l:Math.max(70,Math.min(R,l));s=[E[0]+dx/l*rr,E[1]+dy/l*rr];
  const L=Math.hypot(E[0]-s[0],E[1]-s[1])||1,C=[(s[0]+E[0])/2+(E[1]-s[1])/L*L*.22,(s[1]+E[1])/2-(E[0]-s[0])/L*L*.22],Q=v=>{const a=1-v;return[a*a*s[0]+2*a*v*C[0]+v*v*E[0],a*a*s[1]+2*a*v*C[1]+v*v*E[1]]};
  return {d:`M${f1(s[0])} ${f1(s[1])}Q${f1(C[0])} ${f1(C[1])} ${f1(E[0])} ${f1(E[1])}`,at:Q(u),s}}
function routeFrame(now){const p=PERSON.active,X=PERSON.x,n=p.stops.length,P=p.stops.map(st=>scr(st.ll)),G=PERSON.leg;
  if(prSvg.style.display)prSvg.style.display='';prSvg.style.setProperty('--pc',p.c);
  let I=PERSON.i,cur=P[I];
  /* v128 (2026-11-10 22:27, Wilson: 条线变咗锯齿) — the growing leg was 12 samples each lifted to the terrain under it, so
     every ridge on the way became a kink on screen. A leg is now one straight line in 3D between its two stops (height
     linear from stop to stop, never following the ground), so on screen it is a straight segment that ends exactly on
     both stop dots, re-projected every frame; the head and the portrait sit on that same line. */
  if(G){const u=G.u!=null?G.u:Math.min(1,(now-G.t0)/G.d);I=G.a;cur=legPt(p.stops[G.a].ll,p.stops[G.b].ll,ease(u))}
  /* v129 (2026-11-10 22:47, Wilson picked B1 in design-trail.html) — the travelled trail is round ink dots that march
     slowly forward (~24 px/s) instead of a solid line: one dot path per leg (dasharray of zero-length round-capped dashes,
     three sizes for a brush feel) on a pale halo path with the same pattern, constant screen spacing (7 px, thinned on
     long legs so a leg never carries more than ~50 dots). Each leg is the v128 straight segment, re-projected every
     frame; the leg being walked runs from its stop to the portrait. Colour = the life-bar phase of the leg's
     destination (v125). What is still ahead stays a faint dotted guide; reduced-motion = still dots. */
  {const F=['','','','','',''],RK=k=>roleAt(p,p.stops[k].year)%ROLEC.length,T=RMO.matches?0:now*.024;
    for(let k=1;k<n;k++){const a=P[k-1],b=P[k];if(a&&b&&k>I)F[RK(k)]+=`M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`}
    for(let r=0;r<6;r++){sa(PR['f'+r],'d',F[r]);sa(PR['f'+r],'stroke',ROLEC[r])}
    const last=G?G.b:I;
    for(let k=1;k<Math.max(n,PRL.length);k++){const L=k<n&&k<=last?prl(k):PRL[k];if(!L)continue;
      const a=P[k-1],b=G&&k===G.b?cur:P[k];
      if(k>last||!a||!b){sa(L[0],'d','');sa(L[1],'d','');continue}
      const len=Math.hypot(b[0]-a[0],b[1]-a[1]),sp=Math.max(7,len/50),pat=`0 ${f1(sp)} .7 ${f1(sp-.7)} .3 ${f1(sp-.3)}`,d=`M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`,
        off=f1(-(T%(sp*3)));
      for(const el of L){sa(el,'d',d);sa(el,'stroke-dasharray',pat);sa(el,'stroke-dashoffset',off)}
      sa(L[1],'stroke',ROLEC[RK(k)]);L[1].classList.toggle('cur',!!G&&k===G.b)}}
  // v130: a crossing is a landing point (landFrame); a real meeting (遇/望) away from his stop walks the portrait there
  // in a straight glide (no line), 传/同/念 leave him on his stop. land = ms since the point landed, null before.
  const xc=X&&X.e.l[X.j];let mA=G||!X?cur:null,land=null;
  if(xc){const E=scr(xc.ll),S0=scr(p.stops[PERSON.i].ll)||E;
    if(E){const go=XKIND[xc.kind][4]&&S0&&Math.hypot(E[0]-S0[0],E[1]-S0[1])>8,D=go&&!RMO.matches?1500/pSpd():0,te=now-X.t0,u=D?Math.max(0,Math.min(1,te/D)):1,e=ease(u);
      mA=go?[S0[0]+(E[0]-S0[0])*e,S0[1]+(E[1]-S0[1])*e]:S0;if(te>=D)land=te-D}
    else mA=S0}
  return {P,X,xc,mA,land}}
/* the overlay (cause arcs, a person's route) is redrawn every frame from projected places */
const OVP=new THREE.Vector3();
function legPt(a,b,e){const ha=hAt(a[0],a[1]),hb=hAt(b[0],b[1]);OVP.set(MX(a[0]+(b[0]-a[0])*e),ha+(hb-ha)*e+3,MZ(a[1]+(b[1]-a[1])*e)).project(cam);return OVP.z<1?[(OVP.x+1)/2*innerWidth,(1-OVP.y)/2*innerHeight]:null}
function scr(ll){OVP.set(MX(ll[0]),hAt(ll[0],ll[1])+3,MZ(ll[1])).project(cam);return OVP.z<1?[(OVP.x+1)/2*innerWidth,(1-OVP.y)/2*innerHeight]:null}
let ovKey='';export var BATBOX=null,TLTOP=0,PMBOX=null;addEventListener('resize',()=>TLTOP=0); // var: the label pass reads them before this line runs // BATBOX: the screen box of the battle on show (banners, captions, strokes), so its card can stand clear of it
/* 地点 (2026-11-05 night, Wilson: "件事本身要有一个发生地点…glow 一下…先有地理嘅意识感") — every card is tied to its place
   by a lead line from the card's bottom edge (wherever the card had to move) to a glowing marker on the place: a warm
   halo, a pulsing ring in the event's colour and the diamond. Drawn in their own <svg> as persistent elements, so the
   ring's CSS pulse keeps running while the camera moves; the cards' CSS lead lines are switched off.
   test/card-audit.mjs measures it. */
export const PINS=new Map(),SVGNS='http://www.w3.org/2000/svg',pinSvg=document.createElementNS(SVGNS,'svg'),pinBox=document.createElement('div');pinSvg.id='pinSvg';pinBox.id='pins';
document.body.insertBefore(pinSvg,document.getElementById('lab'));document.body.insertBefore(pinBox,document.getElementById('lab'));
// the glow and the pulsing rings are HTML, moved by `translate` and animated on transform/opacity only (compositor);
// the same animation on SVG circles cost Chrome an extra layout every frame (perf-audit: 1.4–1.6 layouts/frame)
const PIN_DIR=new THREE.Vector3();let pinRy='';
function pinsFrame(){const seen=new Set();
  {const ry=Math.max(.2,Math.min(1,-cam.getWorldDirection(PIN_DIR).y)).toFixed(2);if(ry!==pinRy){pinRy=ry;pinBox.style.setProperty('--ry',ry);plBox.style.setProperty('--ry',ry)}} // ground circles seen at the camera's tilt
  for(const l of LBL){if(!l.cls.startsWith('pop')||!l.vis||l.disp==='none'||!l.box||l.ax==null)continue;seen.add(l);let P=PINS.get(l);
    if(!P){const c=l.e.style.getPropertyValue('--kc').trim()||'#8e2a20',ln=document.createElementNS(SVGNS,'path'),hl=document.createElementNS(SVGNS,'path'),d=document.createElement('div');
      hl.setAttribute('class','leadH');pinSvg.appendChild(hl);
      ln.setAttribute('class','lead');ln.setAttribute('stroke',c);ln.setAttribute('stroke-width','1.3');ln.setAttribute('stroke-opacity','.85');pinSvg.appendChild(ln);ln._h=hl;
      // (2026-11-06, Wilson: "交战…圆点、圆环、虚线圆环…太累赘，好多 layer") — on a battle the 战/起 seal already marks the
      // field, so the pin keeps only its lead line there: no breathing disk, ring or dot under the seal
      d.className='pin'+(l.noPin||l.step!=null&&EVS[STEPS[l.step]]&&BAT[EVS[STEPS[l.step]].id]?' bat':'');d.style.setProperty('--pc',c);d.innerHTML='<i class="disk"></i><i class="ring"></i><i class="dt"></i>';pinBox.appendChild(d);
      P={ln,d,k:''};PINS.set(l,P)}
    /* (2026-11-07, Wilson: "条线点样去画…一条直线会好肉酸") — the lead leaves the card from the edge nearest the place, at
       right angles to that edge, and comes down onto the place from above: one cubic curve, which is a straight drop when
       the card sits right over its place and a soft S-bend when he has dragged the card aside. A pale under-stroke keeps
       it readable over busy terrain. */
    const L0=l.X+l.box.dx,R0=L0+l.box.w,T0=l.Y+l.box.dy,B0=T0+l.box.h,AX=l.ax,AY=l.ay;let x1,y1,nx=0,ny=1;
    if(AY>=B0-4){x1=Math.min(R0-6,Math.max(L0+6,AX));y1=B0}
    else if(AY<=T0+4&&AX>L0-20&&AX<R0+20){x1=Math.min(R0-6,Math.max(L0+6,AX));y1=T0;ny=-1}
    else{const rt=AX>R0;x1=rt?R0:L0;y1=Math.min(B0-5,Math.max(T0+5,AY));nx=rt?1:-1;ny=0}
    // (2026-11-07, Wilson: "那个棍子挡在战字前面") — on a battle the lead stops at the rim of the 战 seal instead of
    // running through it to the place (the seal stands a little above the ground point, so the line crossed its face)
    const SB=l.step!=null&&BATBOX&&BATBOX.s===l.step&&BATBOX.sx!=null&&P.d.classList.contains('bat')?BATBOX:null,dn=SB?(SB.sy>=y1?1:-1):(AY>=y1?1:-1),
      EX=SB?SB.sx:AX,EY=SB?SB.sy-dn*14:AY,
      ln=Math.hypot(EX-x1,EY-y1),hk=Math.min(90,ln*.45),c1=[x1+nx*hk,y1+ny*hk],c2=[EX,EY-Math.min(70,ln*.4)*dn],
      ax=AX.toFixed(1),ay=AY.toFixed(1),key=`${x1|0} ${y1|0} ${ax} ${ay} ${EX|0} ${EY|0}`;
    if(key!==P.k){P.k=key;const d=`M${x1.toFixed(1)} ${y1.toFixed(1)}C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${EX.toFixed(1)} ${EY.toFixed(1)}`;
      P.ln.setAttribute('d',d);P.ln._h.setAttribute('d',d);P.ln.setAttribute('x1',x1.toFixed(1));P.ln.setAttribute('y1',y1.toFixed(1));P.ln.setAttribute('x2',ax);P.ln.setAttribute('y2',ay);
      P.d.style.translate=`${ax}px ${ay}px`;P.d.dataset.x=ax;P.d.dataset.y=ay}
    if(P.d.hidden){P.d.hidden=false;P.ln.style.display='';P.ln._h.style.display=''}}
  for(const [l,P] of PINS)if(!seen.has(l)){if(!l.e.isConnected){P.ln._h.remove();P.ln.remove();P.d.remove();PINS.delete(l)}else if(!P.d.hidden){P.d.hidden=true;P.ln.style.display='none';P.ln._h.style.display='none'}}}
export function overlayFrame(){let h='';const now=performance.now();pinsFrame();PMBOX=null;
  if(PERSON.active){pbTick(now);if(!PERSON.active)return;const p=PERSON.active,{P,X,xc,mA,land}=routeFrame(now),G=PERSON.leg,I=G?G.a:PERSON.i;
    for(const f of p.focus||[]){const c=scr(f.ll),e=scr([f.ll[0]+f.r/(111*Math.cos(f.ll[1]*Math.PI/180)),f.ll[1]]);if(!c||!e)continue;const r=Math.hypot(e[0]-c[0],e[1]-c[1]);
      h+=`<circle cx="${c[0]|0}" cy="${c[1]|0}" r="${r|0}" fill="url(#ovWash)"/><text x="${c[0]|0}" y="${(c[1]+r*.55)|0}" font-size="11" text-anchor="middle" fill="rgba(142,42,32,.75)">${esc(f.label)}</text>`}
    // stop labels never print over each other (stops cluster round 长安·骊山): the current stop's label goes first, then
    // the phase turns, then the rest; a label that would overlap one already placed is left out
    const lab=[],tw=(t,fs)=>[...t].reduce((w,ch)=>w+(ch.charCodeAt(0)<256?fs*.58:fs),0),RC=k=>ROLEC[roleAt(p,p.stops[k].year)%ROLEC.length];
    P.forEach((q,k)=>{if(!q)return;const cur=k===PERSON.i&&!X,st=p.stops[k],done=k<=I,turn=k>0&&roleAt(p,st.year)!==roleAt(p,p.stops[k-1].year);
      // stop dots sized by weight: a turn in his life (new role), a filmed stop, birth and death are larger; ahead = hollow
      const big=turn||st.film||k===0||k===p.stops.length-1,r=big?5.4:3.4;
      if(!cur)h+=done?`<circle cx="${q[0]|0}" cy="${q[1]|0}" r="${r}" fill="${RC(k)}" stroke="#f6efdc" stroke-width="1.6"/>`:`<circle cx="${q[0]|0}" cy="${q[1]|0}" r="${r-.6}" fill="#f6efdc" fill-opacity=".8" stroke="${RC(k)}" stroke-width="1.3" opacity=".6"/>`;
      if(cur&&PERSON.pop)return; // the stop's event card says it already
      const t=`${cur?st.place+' · ':''}${st.year}${turn&&(done||cur)?' · '+p.roles[roleAt(p,st.year)].label:''}`,fs=cur?13:10;
      lab.push({pr:cur?0:turn&&done?1:2,x:q[0]+(cur?20:9),y:q[1]-(cur?12:7),t,fs,fill:done?(cur?'#2b2118':RC(k)):'rgba(43,33,24,.45)',w:tw(t,fs)})});
    const placed=[];if(xc){const q=scr(xc.ll);if(q)placed.push([q[0]-60,q[1]-50,q[0]+170,q[1]+44])} // keep clear of the crossing's portraits and seal
    for(const L of lab.sort((a,b)=>a.pr-b.pr)){const R=[L.x-1,L.y-L.fs,L.x+L.w+1,L.y+3];
      if(L.pr&&placed.some(u=>R[0]<u[2]&&R[2]>u[0]&&R[1]<u[3]&&R[3]>u[1]))continue;placed.push(R);
      h+=`<text x="${L.x|0}" y="${L.y|0}" font-size="${L.fs}" fill="${L.fill}">${esc(L.t)}</text>`}
    landFrame(now,X,xc,land);pmSet(pmA,p,null,mA);PMBOX=mA&&!pmA.hidden?{l:mA[0]-17,r:mA[0]+17,t:mA[1]-44,b:mA[1]-10}:null}
  else if(STORY.lines.length&&!STORY.min){for(const L of STORY.lines){const a=scr(L.a),b=scr(L.b);if(!a||!b)continue;const age=now-L.t0,k=Math.min(1,age/900)*(narrEl.hidden?Math.max(0,Math.min(1,(6000-age)/1000)):1);if(k<=0)continue;const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2-Math.hypot(b[0]-a[0],b[1]-a[1])*.22;
      h+=`<path d="M${a[0]|0} ${a[1]|0}Q${mx|0} ${my|0} ${b[0]|0} ${b[1]|0}" fill="none" stroke="rgba(142,42,32,${.6*k})" stroke-width="1.7" stroke-dasharray="5 4"/><circle cx="${a[0]|0}" cy="${a[1]|0}" r="3.5" fill="rgba(142,42,32,${.6*k})"/>`+
        (L.note&&!narrEl.hidden?`<text x="${mx|0}" y="${(my+((a[1]+b[1])/2-my)*.5-4)|0}" font-size="11" text-anchor="middle" fill="rgba(90,42,28,${k})">${esc(L.note)}</text>`:'')}}
  /* the caption is a strip under the 回 tab, not on the map: map labels are too dense near the capitals for it to find a
     clear spot, and the arc already says where */
  {const t=CAPMOVE&&!PERSON.active?now-CAPMOVE.t0:1e9,o=t<3400?1:Math.max(0,1-(t-3400)/1000),el=capMoveEl;
   if(o>0){if(el.textContent!==CAPMOVE.txt){el.textContent=CAPMOVE.txt;const hb=huimuEl.hidden?0:huimuEl.getBoundingClientRect().bottom;el.style.top=Math.max(8,hb+6)+'px'}
     const os=o.toFixed(2);if(el.style.opacity!==os)el.style.opacity=os;if(el.hidden)el.hidden=false}
   else if(!el.hidden)el.hidden=true}
  /* the move (v97): one brush stroke drawn from the old seat to the new (1.8 s) with the seal riding its tip — a wide
     faint wash under a thin vermilion core, no dashes — then a ring spreads at the new seat as it lands, and the stroke
     dries away; gone after 4.4 s */
  if(CAPMOVE&&!PERSON.active){const M=CAPMOVE,t=now-M.t0;if(t>4400)setCAPMOVE(null);else{const a=scr(M.a),b=scr(M.b);if(a&&b){
    const L=Math.hypot(b[0]-a[0],b[1]-a[1])||1;let nx=(a[1]-b[1])/L,ny=(b[0]-a[0])/L;if(ny>0||(ny===0&&nx<0)){nx=-nx;ny=-ny}
    const k=Math.min(1,t/1800),e=1-(1-k)*(1-k)*(1-k),o=t<2800?1:Math.max(0,1-(t-2800)/1600),bulge=Math.max(30,L*.25),mx=(a[0]+b[0])/2+nx*bulge,my=(a[1]+b[1])/2+ny*bulge,
      q=(u,p0,p1,p2)=>(1-u)*(1-u)*p0+2*(1-u)*u*p1+u*u*p2,px=q(e,a[0],mx,b[0]),py=q(e,a[1],my,b[1]),d=`M${a[0]|0} ${a[1]|0}Q${mx|0} ${my|0} ${b[0]|0} ${b[1]|0}`;
    h+=`<g opacity="${o.toFixed(2)}"><path d="${d}" pathLength="1" fill="none" stroke="rgba(179,40,28,.2)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${e.toFixed(3)} 2"/>`+
      `<path d="${d}" pathLength="1" fill="none" stroke="#9a2418" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="${e.toFixed(3)} 2"/>`+
      `<circle cx="${a[0]|0}" cy="${a[1]|0}" r="4.5" fill="#f6efdc" stroke="#9a2418" stroke-width="1.5"/>`;
    if(k<1)h+=`<rect x="${(px-8)|0}" y="${(py-8)|0}" width="16" height="16" rx="2" fill="#b3281c"/><text x="${px|0}" y="${(py+4)|0}" font-size="11" text-anchor="middle" fill="#fff1d6" style="stroke:none">${M.seal}</text>`;
    else{const u=Math.min(1,(t-1800)/900);h+=`<ellipse cx="${b[0]|0}" cy="${b[1]|0}" rx="${(8+u*34)|0}" ry="${((8+u*34)*.5)|0}" fill="none" stroke="#b3281c" stroke-width="2" opacity="${(1-u).toFixed(2)}"/>`}
    h+='</g>'}}}
  BATBOX=null;
  if(BATTLE&&!PERSON.active&&TL.i>=0){const B=BATTLE.b,t=now-BATTLE.t0,at=(PL[B.at]||{}).ll||llOf(EVS[STEPS[TL.i]].place),A=at&&scr(at);
    if(A){const f=BATTLE.f||1,D=500*f,k=Math.min(1,t/D),gr=1-(1-k)*(1-k)*(1-k),IW=innerWidth;let near=0;const used=[[A[0]-12,A[1]-12,A[0]+12,A[1]+12]],
        ov=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
      // a rising that starts at the event's own place (范阳 755, 晋阳 617): the rebels' arrow points from there at the
      // court they march on, and the court side only plants its banner — only when the court side defends; when the court marches on
      // the rising instead (李孝逸 on 扬州 684), the rebels hold the field with a banner and the court's stroke comes to them
      const atSite=S=>{const q=scr(S.from.ll);return q&&Math.hypot(q[0]-A[0],q[1]-A[1])<=18},
        rs=B.type==='rebellion'&&B.sides.some(S=>S.role==='defender'&&!batRebel(B,S,BATTLE.d))?B.sides.find(S=>batRebel(B,S,BATTLE.d)&&atSite(S)):null,tgt=rs&&B.sides.find(S=>S!==rs),
        // a side already standing at the field (陈 at 建康, 高句丽 at 平壤, 突厥 at 定襄 from afar) defends it: no arrow, its
        // 「守」 banner planted beside the seal; the attackers' arrows stop at the seal
        isDef=S=>S!==rs&&S!==tgt&&atSite(S),hasDef=B.sides.some(isDef),CC=batCamps(B);
      // defenders go last, so their big banner can look for a spot clear of every attacker's banner and stroke
      [...B.sides].sort((a,b)=>isDef(a)-isDef(b)).forEach((S,si)=>{const pts=(S===rs&&tgt?[at,tgt.from.ll]:S===tgt?[S.from.ll]:[S.from.ll,at]).map(scr); // (2026-11-06, Wilson: "运兵…从边度去边度嘅细节冇必要") — origin to field in one gentle arc; the routes' waypoints are no longer drawn
        if(pts.some(p=>!p))return;
        for(const p of pts)used.push([p[0]-6,p[1]-6,p[0]+6,p[1]+6]);
        const Z=pts[pts.length-1];
        const col=CC.get(S)||batCol(S.realm),def=isDef(S),reb=batRebel(B,S,BATTLE.d),o=S.result!=='胜'&&t>D+300*f?Math.max(.7,1-.3*(t-D-300*f)/(300*f)):1;let O=pts[0],g='';
        if(pts.length>1&&Math.hypot(O[0]-Z[0],O[1]-Z[1])>18){const A=Z;
          // (2026-11-07, Wilson picked 「墨笔一扫」 from the design-war2 mock) — one brush sweep from origin to field in ~0.5 s: thick
          // at the origin, tapering to a point 15px short of the seal, so it needs no arrowhead
          const C=[(O[0]+A[0])/2+(A[1]-O[1])*.12,(O[1]+A[1])/2-(A[0]-O[0])*.12],ux=A[0]-C[0],uy=A[1]-C[1],ul=Math.hypot(ux,uy)||1,E=[A[0]-ux/ul*15,A[1]-uy/ul*15],
            q=u=>{const a=1-u;return[a*a*O[0]+2*a*u*C[0]+u*u*E[0],a*a*O[1]+2*a*u*C[1]+u*u*E[1]]},
            tg=u=>{const x=(1-u)*(C[0]-O[0])+u*(E[0]-C[0]),y=(1-u)*(C[1]-O[1])+u*(E[1]-C[1]),l=Math.hypot(x,y)||1;return[x/l,y/l]},N=24,Lp=[],Rp=[];
          for(let j=0;j<=N;j++){const u=j/N*gr,p=q(u),d=tg(u),w=(1-j/N)*3.4+.5+(j<3?(3-j)*.6:0);Lp.push(`${(p[0]-d[1]*w).toFixed(1)} ${(p[1]+d[0]*w).toFixed(1)}`);Rp.push(`${(p[0]+d[1]*w).toFixed(1)} ${(p[1]-d[0]*w).toFixed(1)}`)}
          const tp=q(Math.min(1,gr+.06));
          g+=`<path d="M${Lp.join('L')}L${tp[0].toFixed(1)} ${tp[1].toFixed(1)}L${Rp.reverse().join('L')}z" fill="${col}" fill-opacity=".85"/>`;
          if(k>=1&&reb)g+=`<path d="M${O[0]|0} ${O[1]|0}Q${C[0]|0} ${C[1]|0} ${E[0]|0} ${E[1]|0}" fill="none" stroke="#f6efdc" stroke-width="1.2" stroke-dasharray="6 6"/>`}
        else if(def){
          // (2026-11-06, Wilson: "战字外边个圈唔需要…陈军系绿色…我睇唔到绿色") — the defender holds the field: no ring round the
          // seal, but a full-size banner in its own colour planted right beside it, so both colours meet at the field. It
          // goes right of the seal, else left (flag flown to the left), else below, else up-left / up-right — whichever is clear of the other side's
          // banners and captions. The pole stands 17px off the seal's centre, clear of its 11.5px rim even mid-stamp (×1.3)
          const bw=(BAT_SHORT[S.realm]||'').length*14+28,hit=(o,f)=>used.some(u=>u[0]<o[0]+(f?0:bw)&&u[2]>o[0]-(f?bw:0)&&u[1]<o[1]+34&&u[3]>o[1]-33);
          const C=[[[A[0]+17,A[1]+10],0],[[A[0]-17,A[1]+10],1],[[A[0]+4,A[1]+52],0],[[A[0]-17,A[1]-14],1],[[A[0]+17,A[1]-14],0]],pick=C.find(([o,f])=>!hit(o,f))||C[0];O=pick[0];S._flip=pick[1]}
        else if(pts.length>1||atSite(S)){O=[A[0]+16,A[1]+(near++?30:12)]}
        if(S===rs)O=[A[0]+16,A[1]+12];
        // the banner at the origin: realm (·叛), leader, where from
        const nm=(BAT_SHORT[S.realm]||'')+(reb?'·叛':def?'·守':''),big=def,fs=big?13:10.5,bh=big?19:14,ph=big?32:26,fw=nm.length*(big?14:11)+(big?10:8),fl=def&&S._flip,fx=fl?O[0]-fw:O[0],R=fl||O[0]>IW*.62,lb=batName((S.leaders||[])[0]),fr=(def?'守':'自')+batName(S.from.name).replace(/^[自守]/,'');
        // banners and captions of nearby origins (三路兵 from 马邑 / 云中 / 定襄) must not print over each other: a caption
        // that would overlap one already placed steps down in 16px rows
        used.push([fx-2,O[1]-ph-1,fx+fw+2,O[1]+1]);
        const cap=`${lb}${lb?' · ':''}${fr}`,st='',tx=O[0]+(R?-4:-2),cw=Math.max(cap.length*11.5,st.length*10.5),
          bx=y=>R?[tx-cw,y-11,tx,y+3+(st?14:0)]:[tx,y-11,tx+cw,y+3+(st?14:0)];let ty=O[1]+14;for(let n=0;n<6&&used.some(u=>ov(u,bx(ty)));n++)ty+=16;used.push(bx(ty));
        g+=`<path d="M${O[0]|0} ${O[1]|0}V${(O[1]-ph)|0}" stroke="#3a2a1c" stroke-width="${big?1.6:1.3}"/><rect x="${fx|0}" y="${(O[1]-ph)|0}" width="${fw}" height="${bh}" fill="${col}"/>`+
          `<text x="${(fx+(big?5:4))|0}" y="${(O[1]-ph+bh-4)|0}" font-size="${fs}" fill="#fff6e0" style="stroke:none">${esc(nm)}</text>`+
          `<text x="${tx|0}" y="${ty|0}" font-size="11.5" text-anchor="${R?'end':'start'}" fill="${col}">${esc(cap)}</text>`+
          (st?`<text x="${tx|0}" y="${(ty+14)|0}" font-size="10.5" text-anchor="${R?'end':'start'}" fill="#5a4630">${esc(st)}</text>`:'');
        h+=`<g opacity="${o.toFixed(2)}">${g}</g>`});
      BATBOX={s:TL.i,sx:A[0],sy:A[1],l:Math.min(...used.map(u=>u[0])),t:Math.min(...used.map(u=>u[1])),r:Math.max(...used.map(u=>u[2])),b:Math.max(...used.map(u=>u[3]))};
      // ink spatter where the strokes land, then the seal stamps down (1.3 → 1). The seal is a round 朱印 in the card's
      // 战 colour (2026-11-07, Wilson picked the design-seal mock 5): round, so it never reads as a square city plaque
      if(k>=1){const a=Math.min(1,(t-D)/(220*f)),e=1-(1-a)*(1-a)*(1-a);for(const[x,y,r]of[[-17,-6,2.6],[16,-9,2],[-13,11,1.8],[19,8,2.4],[3,-17,1.5],[-22,3,1.3],[8,16,1.6]])h+=`<circle cx="${(A[0]+x*e).toFixed(1)}" cy="${(A[1]+y*e*.8).toFixed(1)}" r="${(r*e).toFixed(2)}" fill="#2b2118" fill-opacity=".8"/>`}
      if(k>.85){const a=Math.min(1,(t-D*.85)/(150*f)),sc=1.3-.3*(1-(1-a)*(1-a)*(1-a));h+=`<g transform="translate(${A[0]|0} ${A[1]|0}) scale(${sc.toFixed(3)})"><circle r="11.5" fill="#8e2a20"/><circle r="9.6" fill="none" stroke="rgba(255,240,210,.6)" stroke-width="1"/><text x="0" y="5" font-size="13" text-anchor="middle" fill="#fff6e0" style="stroke:none">${rs?'起':'战'}</text></g>`}}}
  if(h!==ovKey){ovKey=h;ovSvg.innerHTML='<defs><radialGradient id="ovWash"><stop offset="0" stop-color="rgba(142,42,32,.16)"/><stop offset="1" stop-color="rgba(142,42,32,0)"/></radialGradient></defs>'+h}}
// setters: imported bindings are read-only, so the other modules write these through here
export function setTLTOP(v){return TLTOP=v}
