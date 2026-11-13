import { writeFileSync } from 'node:fs';import { chrome, sleep, BASE } from './cdp.mjs';
const cdp=await chrome({tag:'dump',port:[9050,40]}),{send}=cdp;
try{await send('Page.enable');await send('Page.navigate',{url:BASE+'?dump=1'});
let v;for(let k=0;k<100;k++){await sleep(300);const r=await send('Runtime.evaluate',{expression:'window.__m3&&__m3.steps?JSON.stringify(__m3.steps()):null',returnByValue:true});v=r.result?.result?.value;if(v)break}
writeFileSync(process.argv[2],JSON.stringify(JSON.parse(v),null,1));console.log(JSON.parse(v).length,'steps');}finally{cdp.kill()}
