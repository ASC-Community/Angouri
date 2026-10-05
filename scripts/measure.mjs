import { chromium } from '@playwright/test';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const cache=join(process.env.LOCALAPPDATA,'ms-playwright');
const builds=(await readdir(cache)).filter(s=>/^chromium-\d+$/.test(s)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1]));
const browser=await chromium.launch({headless:true,executablePath:join(cache,builds[0],'chrome-win64/chrome.exe')});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const loads=[];context.on('response',r=>loads.push((async()=>{try{return {url:new URL(r.url()).pathname,bytes:(await r.body()).length,encoding:r.headers()['content-encoding']||'identity'}}catch{return {url:r.url(),bytes:null}}})()));
const page=await context.newPage();const start=performance.now();await page.goto('http://127.0.0.1:4174/');await page.waitForFunction(()=>window.angouri?.state);
const coldMilliseconds=performance.now()-start;
const timings=await page.evaluate(async()=>{
  const recorded=[];
  for(const [level,ops] of [[3,['A','H','reset']],[4,['H','Q','N','A','reset']]]){
    document.querySelector(`[data-level="${level}"]`).click();await window.angouri.whenIdle();
    for(let cycle=0;cycle<9;cycle++)for(const op of ops){
      const start=performance.now();
      if(op==='reset')document.querySelector('#reset').click();
      else document.querySelector(`[data-op="${op}"]`).click();
      await window.angouri.whenIdle();if(cycle>=3)recorded.push({level,op,milliseconds:performance.now()-start});
    }
  }
  return recorded;
});
const resources=await Promise.all(loads);const sorted=timings.map(t=>t.milliseconds).sort((a,b)=>a-b);
const report={date:new Date().toISOString(),platform:process.platform,device:'Windows x64, Intel Core i5-8400; headless desktop, local uncompressed static server',browser:await browser.version(),viewport:'1440 × 1000',isolationHeaders:false,coldMilliseconds,rawTransferredBytes:resources.reduce((sum,r)=>sum+(r.bytes||0),0),missingTransferSizes:resources.filter(r=>r.bytes===null).length,warm:{samples:sorted.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1),method:'UI insertion/reset to accepted result and rendering; three warm-up recipe cycles on each of levels 3 and 4'},engine:await page.evaluate(()=>window.angouri.measurements),timings,resources};
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/measurements.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,timings:undefined,resources:undefined,engine:undefined},null,2));
await context.close();await browser.close();
