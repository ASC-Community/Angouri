import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setImmediate} from 'node:timers/promises';
import ts from 'typescript';

// Exercise the production loader with a counted, controllable kernel. No Wasm
// timing or browser event timing is needed to prove which jobs get started.
const source=await readFile(new URL('../web/src/note-examples.ts',import.meta.url),'utf8');
const module=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {NoteExamples}=await import(`data:text/javascript;base64,${Buffer.from(module).toString('base64')}`);
const settled=()=>setImmediate();

function harness() {
  const calls=[];
  const cache=new NoteExamples({run(state,action){
    let resolve,reject;
    const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
    const entry={state,action,resolve,reject};calls.push(entry);
    return promise;
  }});
  const finish=(index=calls.length-1)=>{
    const call=calls[index],state=call.state??{sourceId:call.action.sourceId,nodes:[],mode:'remix',goals:[]};
    const result={sourceId:state.sourceId,ops:state.nodes.map(node=>node.op).join(''),...(state.circle?{circle:{...state.circle}}:{})};
    call.resolve({status:'ok',state,result});return result;
  };
  return {cache,calls,finish};
}

test('examples share one source bootstrap, reuse its unedited result and serialize evaluations',async()=>{
  const {cache,calls,finish}=harness(),reader=cache.forReader(()=>true);
  const pending=Promise.all([reader.example(50,''),reader.example(50,'H'),reader.example(50,'A')]);
  await settled();assert.deepEqual(calls.map(call=>call.action),[{type:'level',sourceId:50,mode:'remix'}]);
  const initial=finish();await settled();assert.equal(calls.length,2);assert.equal(calls[1].state.nodes[0].op,'H');
  finish();await settled();assert.equal(calls.length,3);assert.equal(calls[2].state.nodes[0].op,'A');
  finish();const results=await pending;
  assert.equal(results[0],initial);assert.deepEqual(results.map(result=>result.ops),['','H','A']);
  assert.equal(await reader.example(50,'H'),results[1]);assert.equal(calls.length,3);
  assert.deepEqual(calls[1].state.nodes,[{id:'note-0',op:'H'}]);
});

test('a reader closed before queued work starts posts no kernel requests',async()=>{
  const {cache,calls}=harness();let open=true;
  const reader=cache.forReader(()=>open),pending=Promise.allSettled([reader.example(50,'H'),reader.example(4,'Q')]);
  open=false;
  assert.ok((await pending).every(result=>result.status==='rejected'));assert.equal(calls.length,0);
});

test('closing during a source bootstrap prevents its later evaluation and retains the starting result',async()=>{
  const {cache,calls,finish}=harness();let open=true;
  const reader=cache.forReader(()=>open),pending=Promise.allSettled([reader.example(50,'H'),reader.example(50,'A'),reader.example(4,'Q')]);
  await settled();assert.equal(calls.length,1);open=false;finish();
  assert.ok((await pending).every(result=>result.status==='rejected'));assert.equal(calls.length,1);
  const next=cache.forReader(()=>true).example(50,'H');await settled();
  assert.equal(calls.length,2);assert.equal(calls[1].action.type,'evaluate');finish();await next;
});

test('closing during evaluation keeps that completed cache entry and cancels remaining jobs',async()=>{
  const {cache,calls,finish}=harness();let open=true;
  const reader=cache.forReader(()=>open),pending=Promise.allSettled([reader.example(50,'H'),reader.example(50,'A')]);
  await settled();finish();await settled();assert.equal(calls.length,2);
  open=false;const half=finish();await pending;await settled();assert.equal(calls.length,2);
  const reopened=cache.forReader(()=>true);assert.equal(await reopened.example(50,'H'),half);assert.equal(calls.length,2);
  const lift=reopened.example(50,'A');await settled();assert.equal(calls.length,3);finish();await lift;
});

test('a superseding reader can share pending work without reviving abandoned examples',async()=>{
  const {cache,calls,finish}=harness();let version=1;
  const old=cache.forReader(()=>version===1),abandoned=Promise.allSettled([old.example(50,'H'),old.example(50,'A')]);
  await settled();version=2;
  const selected=cache.forReader(()=>version===2).example(50,'A');finish();await settled();
  assert.equal(calls.length,2);assert.equal(calls[1].state.nodes[0].op,'A');finish();
  assert.equal((await selected).ops,'A');assert.ok((await abandoned).every(result=>result.status==='rejected'));
  assert.equal(calls.length,2);
});

test('a shared in-flight result survives its original reader and failures can be retried',async()=>{
  const {cache,calls,finish}=harness();let version=1;
  const old=cache.forReader(()=>version===1),first=Promise.allSettled([old.example(50,'H')]);
  await settled();finish();await settled();version=2;
  const current=cache.forReader(()=>version===2),second=current.example(50,'H');finish();
  assert.equal((await second).ops,'H');assert.equal((await first)[0].status,'rejected');assert.equal(calls.length,2);
  const failed=assert.rejects(current.example(50,'A'),/test failure/);await settled();calls[2].reject(new Error('test failure'));await failed;
  const retry=current.example(50,'A');await settled();assert.equal(calls.length,4);assert.equal(calls[3].action.type,'evaluate');finish();await retry;
});

test('circle examples share their bootstrap and preserve exact parameters and goals',async()=>{
  const {cache,calls,finish}=harness(),reader=cache.forReader(()=>true);
  const pending=Promise.all([reader.circleExample('1','0','3/4'),reader.circleExample('1','0','3/4',[['2','3/4']])]);
  await settled();assert.equal(calls.length,1);assert.equal(calls[0].action.sourceId,43);finish();await settled();
  assert.deepEqual(calls[1].state.circle,{x:'1',y:'0',radius:'3/4'});assert.equal(calls[1].state.mode,'remix');finish();await settled();
  assert.equal(calls[2].state.mode,'challenge');assert.deepEqual(calls[2].state.goals,[{x:'2',y:'3/4'}]);finish();await pending;
  assert.equal(calls.length,3);
});

test('hint target readings keep authored puzzle mode separate from remix examples',async()=>{
  const {cache,calls,finish}=harness(),reader=cache.forReader(()=>true);
  const target=reader.puzzle(47);await settled();
  assert.deepEqual(calls[0].action,{type:'level',sourceId:47,mode:'puzzle'});const targetResult=finish();await target;
  const independent=reader.example(47,'');await settled();
  assert.deepEqual(calls[1].action,{type:'level',sourceId:47,mode:'remix'});const independentResult=finish();await independent;
  assert.equal(await reader.puzzle(47),targetResult);assert.equal(await reader.example(47,''),independentResult);assert.equal(calls.length,2);
});
