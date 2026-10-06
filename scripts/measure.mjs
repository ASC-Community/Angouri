import { chromium } from '@playwright/test';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cpus } from 'node:os';
let executablePath;
if(process.platform==='win32') {
  const cache=join(process.env.LOCALAPPDATA,'ms-playwright');
  const builds=(await readdir(cache)).filter(s=>/^chromium-\d+$/.test(s)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1]));
  if(builds[0])executablePath=join(cache,builds[0],'chrome-win64/chrome.exe');
}
const browser=await chromium.launch({headless:true,executablePath});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const loads=[];context.on('response',r=>loads.push((async()=>{try{return {url:new URL(r.url()).pathname,bytes:(await r.body()).length,encoding:r.headers()['content-encoding']||'identity'}}catch{return {url:r.url(),bytes:null}}})()));
const page=await context.newPage();const start=performance.now();await page.goto('http://127.0.0.1:4174/');await page.waitForFunction(()=>window.angouri?.state);
const coldMilliseconds=performance.now()-start;
const timings=await page.evaluate(async()=>{
  const recorded=[];
  const longRecipe=[...'AHAHAAHAHH','undo','redo','undo','redo','reset'];
  for(const [level,view,ops] of [[3,'flight',['A','H','reset']],[4,'flight',['H','Q','N','A','reset']],[25,'flight',longRecipe],[25,'function',longRecipe],[25,'flow',longRecipe]]){
    document.querySelector(`[data-level="${level}"]`).click();await window.angouri.whenIdle();
    if(window.angouri.state.sourceId!==level)throw Error(`Could not open source ${level}`);
    document.querySelector(`#tab-${view}`).click();await window.angouri.whenIdle();
    for(let cycle=0;cycle<9;cycle++)for(const op of ops){
      const before=window.angouri.measurements.edits.length;
      const start=performance.now();
      if(['reset','undo','redo'].includes(op))document.querySelector(`#${op}`).click();
      else document.querySelector(`[data-op="${op}"]`).click();
      await window.angouri.whenIdle();
      const milliseconds=performance.now()-start,worker=window.angouri.measurements.edits.slice(before);
      if(worker.length!==1||!Number.isFinite(worker[0]))throw Error(`Missing worker timing: ${level} ${op}`);
      recorded.push({level,view,cycle,warm:cycle>=3,op,blocks:window.angouri.state.nodes.length,milliseconds,workerMilliseconds:worker[0]});
    }
  }
  return recorded;
});
const distribution=values=>{const sorted=values.toSorted((a,b)=>a-b);return {samples:sorted.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1)};};
const resources=await Promise.all(loads),warm=timings.filter(t=>t.warm);
const cases=[...new Set(timings.map(t=>`${t.level}:${t.view}`))].map(key=>{
  const rows=warm.filter(t=>`${t.level}:${t.view}`===key);
  return {source:rows[0].level,view:rows[0].view,total:distribution(rows.map(t=>t.milliseconds)),worker:distribution(rows.map(t=>t.workerMilliseconds))};
});
const report={date:new Date().toISOString(),platform:process.platform,device:cpus()[0]?.model,browser:await browser.version(),viewport:'1440 × 1000',isolationHeaders:false,coldMilliseconds,rawTransferredBytes:resources.reduce((sum,r)=>sum+(r.bytes||0),0),missingTransferSizes:resources.filter(r=>r.bytes===null).length,warm:{...distribution(warm.map(t=>t.milliseconds)),method:'Insertion/reset plus ten-block source 25 and Undo/Redo in all views; three warm-up recipe cycles per case, with first-use timings retained separately'},cases,engine:await page.evaluate(()=>window.angouri.measurements),timings,resources};
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/measurements.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,timings:undefined,resources:undefined,engine:undefined},null,2));
await context.close();await browser.close();
