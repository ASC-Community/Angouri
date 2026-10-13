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
    constructor(){this.requests=[];this.postedAt=[];this.terminations=0;workers.push(this);}
    terminate(){this.terminations++;this.active=undefined;}
    postMessage(request){
      assert.equal(this.active,undefined,'at most one request can be executing in a worker');
      assert.equal(this.terminations,0,'retired workers never receive a request');
      this.active=request;this.requests.push(request);this.postedAt.push(now);
    }
    message(data){
      if(data.type==='result'&&data.id===this.active?.id)this.active=undefined;
      this.onmessage?.({data});
    }
    ready(){this.message({type:'ready',milliseconds:1});}
    error(){this.onerror?.({message:'Injected worker failure'});}
    messageerror(){this.onmessageerror?.({});}
    complete(){
      const request=this.active;assert.ok(request,'expected an executing request');
      this.message({type:'result',id:request.id,milliseconds:1,response:{status:'ok',result:{token:request.request.action.token}}});
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
const complete=async(worker,count)=>{for(let index=0;index<count;index++){worker.complete();await flush();}};

for(const event of ['error','messageerror'])test(`active and queued requests share one replacement after a worker ${event}`,async()=>{
  const {kernel,workers,clock,statuses}=harness();
  const jobs=calls(kernel);
  workers[0].ready();await flush();
  assert.equal(workers[0].requests.length,1);
  workers[0][event]();await flush();
  assert.equal(workers.length,2);
  assert.equal(workers[0].terminations,1);
  assert.equal(clock.pending,1,'only the replacement boot deadline remains');
  workers[1].ready();await flush();
  assert.equal(workers[1].requests.length,1);
  assert.equal(workers[1].requests[0].request.state,workers[0].requests[0].request.state);
  assert.equal(workers[1].requests[0].request.action,workers[0].requests[0].request.action);
  await complete(workers[1],7);
  assert.deepEqual(await Promise.all(jobs),expected(7));
  assert.deepEqual(workers[1].requests.map(job=>job.request.action.token),[0,1,2,3,4,5,6]);
  assert.equal(kernel.measurements.restarts,1);
  assert.equal(statuses.length,1);
  assert.equal(clock.pending,0);
});

for(const failure of ['boot-error','error','timeout'])test(`an active boot waiter and queued calls recover together after ${failure}`,async()=>{
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
  workers[1].ready();await flush();await complete(workers[1],7);
  assert.deepEqual(await Promise.all(jobs),expected(7));
  assert.equal(clock.pending,0);
  assert.equal(kernel.measurements.restarts,1);
});

test('an explicit restart settles the boot waiter promptly and ignores every retired worker event',async()=>{
  const {kernel,workers,clock}=harness();
  const jobs=calls(kernel,2);
  const oldMessage=workers[0].onmessage,oldError=workers[0].onerror,oldMessageError=workers[0].onmessageerror;
  kernel.restart();await flush();
  assert.equal(workers.length,2);
  assert.equal(workers[0].terminations,1);
  assert.equal(clock.pending,1);
  workers[1].ready();await flush();
  assert.equal(workers[1].requests.length,1,'the old boot waiter joined without waiting for a timeout');
  let settled=0;const observed=jobs.map(job=>job.then(value=>{settled++;return value;}));
  oldMessage({data:{type:'ready',milliseconds:999}});
  oldMessage({data:{type:'boot-error'}});
  oldMessage({data:{type:'result',id:workers[1].requests[0].id,response:{status:'error'}}});
  oldError({});oldMessageError({});await flush();
  assert.equal(settled,0);
  assert.equal(workers[1].terminations,0);
  assert.equal(clock.pending,1);
  assert.deepEqual([...kernel.measurements.ready],[1]);
  await complete(workers[1],2);assert.deepEqual(await Promise.all(observed),expected(2));
  assert.equal(clock.pending,0);
});

test('a restart after ready but before request dispatch never posts to the retired worker',async()=>{
  const {kernel,workers,clock}=harness();
  const jobs=calls(kernel,2);
  workers[0].ready();kernel.restart();await flush();
  assert.equal(workers[0].requests.length,0);
  assert.equal(workers.length,2);
  workers[1].ready();await flush();await complete(workers[1],2);
  assert.deepEqual(await Promise.all(jobs),expected(2));
  assert.equal(clock.pending,0);
});

test('a nine-second request retries once, terminates after its final timeout and permits a later action',async()=>{
  const {kernel,workers,clock}=harness();
  const settled=Promise.allSettled(calls(kernel,1));
  workers[0].ready();await flush();
  await clock.advance(9000);
  assert.equal(workers.length,2);
  assert.equal(workers[0].terminations,1);
  workers[1].ready();await flush();
  assert.equal(workers[1].requests.length,1);
  await clock.advance(9000);
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
  const settled=Promise.allSettled(calls(kernel,1));
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
  workers[1].ready();await flush();await complete(workers[1],2);
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
  const worker=workers.at(-1);
  for(let index=0;index<1030;index++){
    const job=kernel.run(undefined,{type:'evaluate'});await flush();
    worker.message({type:'result',id:worker.active.id,milliseconds:index,response:{status:'ok'}});
    assert.equal((await job).status,'ok');
  }
  const retained=Array.from({length:1024},(_,index)=>index+6);
  assert.equal(kernel.measurements,measurements);
  assert.equal(kernel.measurements.ready,ready);
  assert.equal(kernel.measurements.edits,edits);
  assert.deepEqual([...ready],retained);
  assert.deepEqual([...edits],retained);
  assert.equal(measurements.restarts,1029);
  assert.equal(clock.pending,0);
});

test('four queued three-second calculations each receive their own execution deadline',async()=>{
  const {kernel,workers,clock}=harness();
  const jobs=calls(kernel,4),worker=workers[0];
  worker.ready();await flush();
  for(let index=0;index<4;index++){
    assert.equal(worker.requests.length,index+1);
    assert.equal(clock.pending,1,'waiting jobs do not own watchdogs');
    await clock.advance(3000);
    assert.equal(workers.length,1);
    worker.complete();await flush();
  }
  assert.deepEqual(await Promise.all(jobs),expected(4));
  assert.deepEqual(worker.postedAt,[0,3000,6000,9000]);
  assert.equal(kernel.measurements.restarts,0);
  assert.equal(clock.pending,0);
});

test('interactive requests pass queued background work in FIFO order without interrupting active work',async()=>{
  const {kernel,workers,clock}=harness(),worker=workers[0];
  const run=(token,priority)=>kernel.run(undefined,{type:'evaluate',token},priority);
  const jobs=[run('background-active','background')];
  worker.ready();await flush();
  jobs.push(run('background-1','background'),run('background-2','background'),run('interactive-1'),run('interactive-2'));
  assert.deepEqual(worker.requests.map(job=>job.request.action.token),['background-active']);
  await complete(worker,5);
  assert.deepEqual(worker.requests.map(job=>job.request.action.token),['background-active','interactive-1','interactive-2','background-1','background-2']);
  assert.ok((await Promise.all(jobs)).every(response=>response.status==='ok'));
  assert.equal(worker.terminations,0);
  assert.equal(kernel.measurements.restarts,0);
  assert.equal(clock.pending,0);
});

test('queued work survives a preceding final failure and retains both of its own execution attempts',async()=>{
  const {kernel,workers,clock}=harness();
  const [first,queued]=calls(kernel,2);
  const firstFailed=assert.rejects(first,/Engine interrupted/);
  const queuedResult=queued.then(value=>({value}),error=>({error}));
  workers[0].ready();await flush();await clock.advance(8000);
  workers[1].ready();await flush();await clock.advance(8000);
  await firstFailed;
  assert.equal(workers.length,3,'only the next admitted job starts fresh after exhaustion');
  workers[2].ready();await flush();
  assert.equal(workers[2].active.request.action.token,1);
  await clock.advance(8000);
  assert.equal(workers.length,4,'queued waiting did not spend this job\'s retry');
  workers[3].ready();await flush();
  assert.equal(workers[3].active.request.state,workers[2].requests[0].request.state);
  assert.equal(workers[3].active.request.action,workers[2].requests[0].request.action);
  workers[3].complete();
  assert.deepEqual(await queuedResult,{value:{status:'ok',result:{token:1}}});
  assert.deepEqual(workers.map(worker=>worker.requests.map(job=>job.request.action.token)),[[0],[0],[1],[1]]);
  assert.deepEqual(workers.map(worker=>worker.terminations),[1,1,1,0]);
  assert.equal(clock.pending,0);
});

test('queue overflow rejects only the new call without disturbing active or queued work',async()=>{
  const {kernel,workers,clock}=harness();
  const jobs=calls(kernel,257);
  await assert.rejects(kernel.run(undefined,{type:'evaluate',token:'overflow'}),/engine is busy/);
  workers[0].ready();await flush();
  assert.equal(clock.pending,1);
  await complete(workers[0],257);
  assert.deepEqual(await Promise.all(jobs),expected(257));
  assert.equal(workers.length,1);
  assert.equal(workers[0].requests.length,257);
  assert.equal(kernel.measurements.restarts,0);
  assert.equal(clock.pending,0);
});
