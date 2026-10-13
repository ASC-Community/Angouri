import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScript, flush } from './helpers/typescript.mjs';

function harness() {
  const handlers=new Map(),requests=[],previews=[],commits=[],restores=[],instant=[];
  const root={addEventListener:(event,handler)=>handlers.set(event,handler),querySelector:()=>null};
  const fraction=value=>{const [numerator,denominator=1]=String(value).split('/').map(Number);return numerator/denominator;};
  const {CropEditor}=loadTypeScript(new URL('../web/src/crop.ts',import.meta.url),{
    window:{addEventListener(){}},
    require:path=>{
      if(path==='./types')return {fraction};
      if(path==='./icons')return {icon:()=>''};
      if(path==='./views')return {tex:()=>'',rationalTex:()=>''};
      throw new Error(`Unexpected import: ${path}`);
    }
  });
  const state={sourceId:72,mode:'remix',crop:{from:'0',to:'4'}},result={crop:{from:'0',to:'4',editable:true}};
  const editor=new CropEditor(root,()=>({state,result}),(_state,crop)=>new Promise((resolve,reject)=>requests.push({crop,resolve,reject})),
    preview=>previews.push(preview),async(crop,previewed)=>{commits.push({crop,previewed});},
    restored=>restores.push(restored),(crop,base)=>instant.push({crop,base}));
  const event=value=>({target:{dataset:{cropRange:'to'},valueAsNumber:value}});
  return {editor,requests,previews,commits,restores,instant,result,
    input:value=>handlers.get('input')(event(value)),change:value=>handlers.get('change')(event(value))};
}

const plain=value=>JSON.parse(JSON.stringify(value));

for(const completion of ['success','failure'])test(`a cancelled preview's late ${completion} leaves the new gesture active and drains its preview`,async()=>{
  const {editor,requests,previews,commits,restores,instant,result,input,change}=harness();
  input(3);editor.cancel();input(2);
  assert.equal(requests.length,1,'previews remain coalesced while the old request is pending');
  assert.deepEqual(plain(instant.map(entry=>entry.crop)),[{from:'0',to:'3'},{from:'0',to:'2'}]);
  if(completion==='success')requests[0].resolve({status:'ok',result:{obsolete:true}});
  else requests[0].reject(new Error('Old preview lost its worker'));
  await flush();
  assert.deepEqual(restores,[result],'only the deliberate cancellation restores the accepted drawing');
  assert.equal(previews.length,0,'an obsolete response cannot repaint the current gesture');
  assert.equal(requests.length,2,'the latest queued preview is still evaluated');
  assert.deepEqual(plain(requests[1].crop),{from:'0',to:'2'});
  const current={crop:{from:'0',to:'2'},current:true};
  requests[1].resolve({status:'ok',result:current});await flush();
  assert.deepEqual(previews,[current]);
  change(2);
  assert.deepEqual(plain(commits),[{crop:{from:'0',to:'2'},previewed:true}]);
});

test('a rejected superseded input continues with the latest input of the same gesture',async()=>{
  const {requests,previews,restores,input}=harness();
  input(3);input(2);input(1);
  requests[0].reject(new Error('Superseded preview failed'));await flush();
  assert.equal(restores.length,0);
  assert.equal(requests.length,2);
  assert.deepEqual(plain(requests[1].crop),{from:'0',to:'1'});
  const latest={latest:true};requests[1].resolve({status:'ok',result:latest});await flush();
  assert.deepEqual(previews,[latest]);
});

test('failure of the current preview restores accepted state and permits the next gesture',async()=>{
  const {requests,previews,commits,restores,result,input,change}=harness();
  input(3);requests[0].reject(new Error('Current preview failed'));await flush();
  assert.deepEqual(restores,[result]);
  assert.equal(commits.length,0);
  input(2);assert.equal(requests.length,2);
  const latest={latest:true};requests[1].resolve({status:'ok',result:latest});await flush();
  assert.deepEqual(previews,[latest]);
  change(2);assert.deepEqual(plain(commits),[{crop:{from:'0',to:'2'},previewed:true}]);
});

test('a late preview rejection after release cannot undo the committed crop',async()=>{
  const {requests,commits,restores,input,change}=harness();
  input(3);change(3);
  requests[0].reject(new Error('Released preview failed'));await flush();
  assert.equal(restores.length,0);
  assert.deepEqual(plain(commits),[{crop:{from:'0',to:'3'},previewed:true}]);
});
