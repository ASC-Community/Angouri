import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const source=await readFile(new URL('../web/src/persistence.ts',import.meta.url),'utf8');
const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
const {readLibrary,mutateLibrary,mergeCompletions,StorageTransactions}=await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const seed=(id,name=id)=>({id,name,artifact:{schema:1,type:'creation',nodes:[]},savedAt:'2026-10-01T00:00:00.000Z'});

test('legacy rows get stable identities without truncating or removing unknown data',()=>{
  const legacy=Array.from({length:13},(_,i)=>{const {id,...entry}=seed(String(i));return entry;});
  legacy.push(legacy[0],{schema:9,name:'Future format',payload:{keep:true}});
  const first=readLibrary(legacy),second=readLibrary(structuredClone(legacy));
  assert.deepEqual(first,second);assert.equal(first.seeds.length,14);
  assert.equal(new Set(first.seeds.map(entry=>entry.id)).size,14);
  const changed=mutateLibrary(legacy,{type:'rename',id:first.seeds[13].id,name:' Duplicate '});
  const reopened=readLibrary(changed.entries);
  assert.equal(reopened.seeds[13].name,'Duplicate');assert.equal(reopened.seeds[0].name,'0');
  assert.deepEqual(reopened.other,first.other);
});

test('stale row actions target the same identity after another row is deleted',()=>{
  const original=[seed('a'),seed('b'),seed('c')];
  const deleted=mutateLibrary(original,{type:'delete',id:'a',at:'today'}).entries;
  const renamed=mutateLibrary(deleted,{type:'rename',id:'b',name:'B changed'}).entries;
  assert.deepEqual(readLibrary(renamed).seeds.map(entry=>[entry.id,entry.name]),[['b','B changed'],['c','c']]);
  assert.deepEqual(readLibrary(renamed).deleted[0],{...original[0],deletedAt:'today',deletedIndex:0});
  const restored=mutateLibrary(renamed,{type:'restore',id:'a'}).entries;
  assert.deepEqual(readLibrary(restored).seeds[0],original[0]);
  assert.throws(()=>mutateLibrary(deleted,{type:'rename',id:'a',name:'Wrong row'}),/deleted in another tab/);
});

test('commit-time capacity rejects an export completed after restoring the final slot',()=>{
  const existing=Array.from({length:11},(_,i)=>seed(String(i)));
  const recovery={...seed('recover'),deletedAt:'today',deletedIndex:0};
  const restored=mutateLibrary([...existing,recovery],{type:'restore',id:'recover'}).entries;
  const before=structuredClone(restored);
  assert.throws(()=>mutateLibrary(restored,{type:'save',seed:seed('late-export')}),/library is full/);
  assert.deepEqual(restored,before);assert.equal(readLibrary(restored).seeds.length,12);
});

test('only new awards in the current reset generation can extend completion',()=>{
  const before={progressEpoch:'before',completed:[1,2]};
  assert.deepEqual(mergeCompletions(before,'before',[3]).completed,[1,2,3]);
  const reset={progressEpoch:'reset',completed:[]};
  assert.deepEqual(mergeCompletions(reset,'before',[3]),reset);
  assert.deepEqual(mergeCompletions(reset,'reset',[4]),{progressEpoch:'reset',completed:[4]});
});

test('permanent removal drops only the named recovery copy',()=>{
  const active=seed('active'),keep={...seed('keep'),deletedAt:'yesterday',deletedIndex:1},remove={...seed('remove'),deletedAt:'today',deletedIndex:0};
  assert.deepEqual(mutateLibrary([active,keep,remove],{type:'purge',id:'remove'}).entries,[active,keep]);
  assert.throws(()=>mutateLibrary([active,keep],{type:'purge',id:'active'}),/recovery copy changed/);
});

test('unavailable IndexedDB cannot silently fall back to unsafe localStorage writes',async()=>{
  let written=false;
  await assert.rejects(new StorageTransactions(undefined,()=>({getItem:()=>null,setItem:()=>{written=true;},removeItem:()=>{written=true;}})).change('library',()=>{written=true;return {raw:'[]',result:undefined};}),/Safe device storage is unavailable/);
  assert.equal(written,false);
});
