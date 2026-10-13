import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScript, flush } from './helpers/typescript.mjs';

function harness() {
  const timers=new Map(),workers=[],statuses=[];
  let now=0,sequence=0;
  const clock={
    setTimeout(fn,delay){const id=++sequence;timers.set(id,{fn,at:now+delay});return id;},
    clearTimeout(id){timers.delete(id);},
    get pending(){return timers.size;},
    async advance(milliseconds){
      const until=now+milliseconds;
      for(;;){
        const next=[...timers].filter(([,timer])=>timer.at<=until).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];
        if(!next)break;
        now=next[1].at;timers.delete(next[0]);next[1].fn();await flush();
      }
      now=until;await flush();
    }
  };
  class Worker {
    constructor(){this.requests=[];this.terminations=0;workers.push(this);}
    terminate(){this.terminations++;}
    postMessage(request){this.requests.push(request);}
    message(data){this.onmessage?.({data});}
    ready(){this.message({type:'ready',milliseconds:1});}
    error(){this.onerror?.({message:'Injected worker failure'});}
    messageerror(){this.onmessageerror?.({});}
    complete(){
      for(const request of this.requests)this.message({type:'result',id:request.id,milliseconds:1,response:{status:'ok',result:{token:request.request.action.token}}});
    }
  }
  const {Kernel}=loadTypeScript(new URL('../web/src/engine.ts',import.meta.url),{
    Worker,URL,Error,document:{baseURI:'http://localhost/'},setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout
  });
  const kernel=new Kernel((message,recovering)=>statuses.push({message,recovering}));
  return {kernel,workers,clock,statuses};
}

const calls=(kernel,count=7)=>Array.from({length:count},(_,token)=>kernel.run({snapshot:token},{type:'evaluate',token}));
const expected=count=>Array.from({length:count},(_,token)=>({status:'ok',result:{token}}));

for(const event of ['error','messageerror'])test(`parallel requests share one replacement after a worker ${event}`,async()=>{
  const {kernel,workers,clock,statuses}=harness();
  const jobs=calls(kernel);
  workers[0].ready();await flush();
  assert.equal(workers[0].requests.length,7);
  workers[0][event]();await flush();
  assert.equal(workers.length,2);
  assert.equal(workers[0].terminations,1);
  assert.equal(clock.pending,1,'only the replacement boot deadline remains');
  workers[1].ready();await flush();
  assert.equal(workers[1].requests.length,7);
  for(let index=0;index<7;index++){
    assert.equal(workers[1].requests[index].request.state,workers[0].requests[index].request.state);
    assert.equal(workers[1].requests[index].request.action,workers[0].requests[index].request.action);
  }
  workers[1].complete();
  assert.deepEqual(await Promise.all(jobs),expected(7));
  assert.equal(kernel.measurements.restarts,1);
  assert.equal(statuses.length,1);
  assert.equal(clock.pending,0);
});

for(const failure of ['boot-error','error','timeout'])test(`parallel boot waiters recover together after ${failure}`,async()=>{
  const {kernel,workers,clock}=harness();
  const jobs=calls(kernel);
  if(failure==='timeout')await clock.advance(30000);
  else if(failure==='error')workers[0].error();
  else workers[0].message({type:'boot-error'});
  await flush();
  assert.equal(workers.length,2);
  assert.equal(workers[0].terminations,1);
  assert.equal(workers[0].requests.length,0);
  assert.equal(clock.pending,1);
  workers[1].ready();await flush();workers[1].complete();
  assert.deepEqual(await Promise.all(jobs),expected(7));
  assert.equal(clock.pending,0);
  assert.equal(kernel.measurements.restarts,1);
});

test('an explicit restart settles boot waiters promptly and ignores every retired worker event',async()=>{
  const {kernel,workers,clock}=harness();
  const jobs=calls(kernel,2);
  const oldMessage=workers[0].onmessage,oldError=workers[0].onerror,oldMessageError=workers[0].onmessageerror;
  kernel.restart();await flush();
  assert.equal(workers.length,2);
  assert.equal(workers[0].terminations,1);
  assert.equal(clock.pending,1);
  workers[1].ready();await flush();
  assert.equal(workers[1].requests.length,2,'old boot waiters joined without waiting for a timeout');
  let settled=0;const observed=jobs.map(job=>job.then(value=>{settled++;return value;}));
  oldMessage({data:{type:'ready',milliseconds:999}});
  oldMessage({data:{type:'boot-error'}});
  oldMessage({data:{type:'result',id:workers[1].requests[0].id,response:{status:'error'}}});
  oldError({});oldMessageError({});await flush();
  assert.equal(settled,0);
  assert.equal(workers[1].terminations,0);
  assert.equal(clock.pending,2);
  assert.deepEqual([...kernel.measurements.ready],[1]);
  workers[1].complete();assert.deepEqual(await Promise.all(observed),expected(2));
  assert.equal(clock.pending,0);
});

test('a restart after ready but before request dispatch never posts to the retired worker',async()=>{
  const {kernel,workers,clock}=harness();
  const jobs=calls(kernel,2);
  workers[0].ready();kernel.restart();await flush();
  assert.equal(workers[0].requests.length,0);
  assert.equal(workers.length,2);
  workers[1].ready();await flush();workers[1].complete();
  assert.deepEqual(await Promise.all(jobs),expected(2));
  assert.equal(clock.pending,0);
});

test('the final request timeout terminates all failed work and a later action starts fresh',async()=>{
  const {kernel,workers,clock}=harness();
  const settled=Promise.allSettled(calls(kernel,3));
  workers[0].ready();await flush();
  await clock.advance(8000);
  assert.equal(workers.length,2);
  assert.equal(workers[0].terminations,1);
  workers[1].ready();await flush();
  assert.equal(workers[1].requests.length,3);
  await clock.advance(8000);
  const results=await settled;
  assert.ok(results.every(result=>result.status==='rejected'&&result.reason.message==='Engine interrupted'));
  assert.deepEqual(workers.map(worker=>worker.terminations),[1,1]);
  assert.equal(clock.pending,0);
  assert.equal(workers.length,2,'exhausted callers do not create another retry');
  const next=kernel.run(undefined,{type:'evaluate',token:'next'});
  assert.equal(workers.length,3);
  workers[2].ready();await flush();workers[2].complete();
  assert.deepEqual(await next,{status:'ok',result:{token:'next'}});
  assert.equal(clock.pending,0);
});

test('the final boot timeout leaves no worker, deadline or waiting caller behind',async()=>{
  const {kernel,workers,clock}=harness();
  const settled=Promise.allSettled(calls(kernel,3));
  await clock.advance(30000);await clock.advance(30000);
  const results=await settled;
  assert.ok(results.every(result=>result.status==='rejected'&&/took too long to load/.test(result.reason.message)));
  assert.deepEqual(workers.map(worker=>worker.terminations),[1,1]);
  assert.equal(clock.pending,0);
  const next=kernel.run(undefined,{type:'evaluate',token:'next'});
  workers[2].ready();await flush();workers[2].complete();
  assert.deepEqual(await next,{status:'ok',result:{token:'next'}});
  assert.equal(clock.pending,0);
});

test('a failed postMessage retires its deadline and replays the same request',async()=>{
  const {kernel,workers,clock}=harness();
  workers[0].postMessage=()=>{throw new Error('Injected post failure');};
  const job=kernel.run(undefined,{type:'evaluate',token:'retry'});
  workers[0].ready();await flush();
  assert.equal(workers[0].terminations,1);
  assert.equal(clock.pending,1);
  workers[1].ready();await flush();workers[1].complete();
  assert.deepEqual(await job,{status:'ok',result:{token:'retry'}});
  assert.equal(clock.pending,0);
});

test('an idle worker failure is retired and the next action joins a fresh worker',async()=>{
  const {kernel,workers,clock}=harness();
  workers[0].ready();workers[0].error();
  assert.equal(workers[0].terminations,1);
  assert.equal(clock.pending,0);
  const jobs=calls(kernel,2);
  assert.equal(workers.length,2);
  workers[1].ready();await flush();workers[1].complete();
  assert.deepEqual(await Promise.all(jobs),expected(2));
  assert.equal(clock.pending,0);
});

test('timing diagnostics retain the latest 1024 samples while restart counts remain cumulative',async()=>{
  const {kernel,workers,clock}=harness();
  const measurements=kernel.measurements,{ready,edits}=measurements;
  for(let index=0;index<1030;index++){
    if(index)kernel.restart();
    workers.at(-1).message({type:'ready',milliseconds:index});
  }
  const jobs=calls(kernel,1030);await flush();
  const worker=workers.at(-1);
  for(const [index,request] of worker.requests.entries())worker.message({type:'result',id:request.id,milliseconds:index,response:{status:'ok'}});
  assert.ok((await Promise.all(jobs)).every(response=>response.status==='ok'));
  const retained=Array.from({length:1024},(_,index)=>index+6);
  assert.equal(kernel.measurements,measurements);
  assert.equal(kernel.measurements.ready,ready);
  assert.equal(kernel.measurements.edits,edits);
  assert.deepEqual([...ready],retained);
  assert.deepEqual([...edits],retained);
  assert.equal(measurements.restarts,1029);
  assert.equal(clock.pending,0);
});
