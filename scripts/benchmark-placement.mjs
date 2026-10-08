import { chromium, firefox, webkit } from '@playwright/test';

const baseUrl=process.env.ANGOURI_BENCH_URL||'http://127.0.0.1:4187/';
const samples=Number(process.env.ANGOURI_BENCH_SAMPLES||5);
if(!Number.isInteger(samples)||samples<1||samples>20)throw Error('ANGOURI_BENCH_SAMPLES must be an integer from 1 to 20.');
const engineName=process.env.ANGOURI_BENCH_ENGINE||'chromium';
const engine={chromium,firefox,webkit}[engineName];
if(!engine)throw Error('ANGOURI_BENCH_ENGINE must be chromium, firefox or webkit.');

const browser=await engine.launch({headless:true});
const page=await browser.newPage();
await page.goto(baseUrl);
const report=await page.evaluate(async samples=>{
  const worker=new Worker(new URL('engine-worker.js',document.baseURI),{type:'module'});
  let sequence=0;
  const pending=new Map();
  const ready=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Math worker did not become ready.')),30000);
    worker.addEventListener('message',event=>{
      if(event.data.type==='ready'){clearTimeout(timer);resolve(event.data.milliseconds);return;}
      if(event.data.type==='boot-error'){clearTimeout(timer);reject(Error(event.data.message));return;}
      if(event.data.type==='result'){
        const job=pending.get(event.data.id);
        if(job){pending.delete(event.data.id);job(event.data);}
      }
    });
  });
  const readyMilliseconds=await ready;
  const run=request=>new Promise((resolve,reject)=>{
    const id=`bench-${++sequence}`,started=performance.now();
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('Math worker request timed out.'));},10000);
    pending.set(id,data=>{
      clearTimeout(timer);
      if(data.response?.status!=='ok')reject(Error(data.response?.message||'Kernel request failed.'));
      else resolve({response:data.response,workerMilliseconds:data.milliseconds,roundTripMilliseconds:performance.now()-started});
    });
    worker.postMessage({id,request});
  });
  const initial=async()=>{
    const result=await run({state:null,action:{type:'level',sourceId:50,mode:'remix'}});
    return result.response.state;
  };
  const insert=async(state,op,id,index=state.nodes.length)=>run({state,action:{type:'insert',id,op,index}});
  const rows=[];
  for(const op of ['H','A','N','Q','D','I','S','F','C'])for(let sample=0;sample<samples;sample++){
    const state=await initial();
    const measured=await insert(state,op,`${op.toLowerCase()}-${sample}`);
    rows.push({case:op,sample,blocks:1,workerMilliseconds:measured.workerMilliseconds,roundTripMilliseconds:measured.roundTripMilliseconds});
  }
  const representative=['H','A','N','Q','D','I','S','F','C'].map(op=>`AHAH${op}`);
  for(const recipe of ['SS',...representative,'AHAHSS','SF','SC'])for(let sample=0;sample<samples;sample++){
    let state=await initial(),measured;
    for(let index=0;index<recipe.length;index++){
      measured=await insert(state,recipe[index],`${recipe.toLowerCase()}-${sample}-${index}`,index);
      state=measured.response.state;
    }
    rows.push({case:recipe,sample,blocks:recipe.length,workerMilliseconds:measured.workerMilliseconds,roundTripMilliseconds:measured.roundTripMilliseconds});
  }
  worker.terminate();
  return {readyMilliseconds,rows};
},samples);
await page.close();

const uiRecipe='AAAAAAHHHH';
const uiCases=[
  {name:'height',sourceId:25,recipe:uiRecipe,expected:uiRecipe},
  {name:'wave-input',sourceId:54,recipe:'AHQ',expected:'ASHQ'},
  {name:'wave-output',sourceId:54,recipe:'QHA',expected:'SQHA',afterStation:true}
];
const uiRuns=[];
for(const scenario of uiCases)for(const view of ['flight','function','flow']){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const uiPage=await context.newPage();
  await uiPage.goto(baseUrl);
  await uiPage.waitForFunction(()=>window.angouri?.state&&window.angouri?.whenIdle);
  uiRuns.push(await uiPage.evaluate(async({view,recipe,sourceId,name,expected,afterStation})=>{
    const idle=()=>Promise.race([
      window.angouri.whenIdle(),
      new Promise((_,reject)=>setTimeout(()=>reject(Error('UI edit timed out.')),10000))
    ]);
    const click=selector=>{
      const element=document.querySelector(selector);
      if(!(element instanceof HTMLElement))throw Error(`Missing UI control ${selector}`);
      element.click();
    };
    click(`[data-level="${sourceId}"]`);
    await idle();
    if(window.angouri.state.sourceId!==sourceId)throw Error(`Could not open source ${sourceId}.`);
    click(`#tab-${view}`);
    await idle();
    if(window.angouri.view!==view)throw Error(`Could not open ${view} view.`);

    const rows=[];
    const measure=async(kind,action,index)=>{
      if(kind==='insert'&&afterStation)click(`[data-insert="${window.angouri.state.station.before+1+index}"]`);
      const beforeMeasurements=window.angouri.measurements.edits.length;
      const beforeBlocks=window.angouri.state.nodes.length;
      const started=performance.now();
      click(kind==='insert'?`#palette [data-op="${action}"]`:`#${action}`);
      await idle();
      const totalMilliseconds=performance.now()-started;
      const worker=window.angouri.measurements.edits.slice(beforeMeasurements);
      if(worker.length!==1||!Number.isFinite(worker[0]))throw Error(`Missing worker timing for ${view} ${action}.`);
      const blocks=window.angouri.state.nodes.length;
      const expectedBlocks=kind==='insert'?beforeBlocks+1:action==='undo'?beforeBlocks-1:beforeBlocks+1;
      if(blocks!==expectedBlocks)throw Error(`${view} ${action} changed the recipe from ${beforeBlocks} to ${blocks} blocks.`);
      rows.push({kind,action,index,blocks,totalMilliseconds,workerMilliseconds:worker[0],outsideWorkerMilliseconds:totalMilliseconds-worker[0]});
    };
    for(let index=0;index<recipe.length;index++)await measure('insert',recipe[index],index);
    for(const [index,action] of ['undo','redo','undo','redo'].entries())await measure(action,action,index);
    const finalRecipe=window.angouri.state.nodes.map(node=>node.op).join('');
    if(finalRecipe!==expected)throw Error(`${view} ended with ${finalRecipe}, expected ${expected}.`);
    if(afterStation&&!window.angouri.result.solved)throw Error('The fitted wave must still solve exactly.');
    return {name,sourceId,view,finalRecipe,rows};
  },{view,...scenario}));
  await context.close();
}

const distribution=values=>{
  const sorted=values.toSorted((a,b)=>a-b);
  const percentile=fraction=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*fraction))];
  return {samples:sorted.length,p50:percentile(.5),p95:percentile(.95),max:sorted.at(-1)};
};
const cases={};
for(const row of report.rows)(cases[row.case]??=[]).push(row);
const summary=Object.fromEntries(Object.entries(cases).map(([name,rows])=>[name,{
  blocks:rows[0].blocks,
  first:{workerMilliseconds:rows[0].workerMilliseconds,roundTripMilliseconds:rows[0].roundTripMilliseconds},
  worker:distribution(rows.map(row=>row.workerMilliseconds)),
  roundTrip:distribution(rows.map(row=>row.roundTripMilliseconds)),
  warm:rows.length>1?{
    worker:distribution(rows.slice(1).map(row=>row.workerMilliseconds)),
    roundTrip:distribution(rows.slice(1).map(row=>row.roundTripMilliseconds))
  }:null
}]));
const summarizeUiRows=rows=>({
  total:distribution(rows.map(row=>row.totalMilliseconds)),
  worker:distribution(rows.map(row=>row.workerMilliseconds)),
  outsideWorker:distribution(rows.map(row=>row.outsideWorkerMilliseconds))
});
const summarizeUiRun=run=>{
  const inserts=run.rows.filter(row=>row.kind==='insert');
  const undos=run.rows.filter(row=>row.action==='undo');
  const redos=run.rows.filter(row=>row.action==='redo');
  return {
    finalRecipe:run.finalRecipe,
    firstPlacement:inserts[0],
    inserts:summarizeUiRows(inserts),
    undo:summarizeUiRows(undos),
    redo:summarizeUiRows(redos),
    actions:run.rows
  };
};
const ui=Object.fromEntries(uiRuns.filter(run=>run.sourceId===25).map(run=>[run.view,summarizeUiRun(run)]));
const waves=Object.fromEntries(uiCases.filter(scenario=>scenario.sourceId===54).map(scenario=>[scenario.name,{
  sourceId:scenario.sourceId,recipe:scenario.expected,
  views:Object.fromEntries(uiRuns.filter(run=>run.name===scenario.name).map(run=>[run.view,summarizeUiRun(run)]))
}]));
console.log(JSON.stringify({engine:engineName,url:baseUrl,readyMilliseconds:report.readyMilliseconds,cases:summary,ui:{sourceId:25,recipe:uiRecipe,views:ui},waves},null,2));
await browser.close();
