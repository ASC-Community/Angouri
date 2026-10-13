import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {readStorage,failStorageWrites,restoreStorageWrites,STORAGE_KEYS} from './storage-fixtures.mjs';

const source=await readFile(new URL('../../web/src/persistence.ts',import.meta.url),'utf8');
const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
const moduleURL=`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
async function storagePage(page){
  await page.goto('/about/');
  await page.evaluate(async url=>{
    const {StorageTransactions}=await import(url);
    window.testStorage=new StorageTransactions(indexedDB,()=>localStorage);
  },moduleURL);
}

test('many real two-tab transactions retain every update and migrate legacy bytes only once',async({context,page})=>{
  const other=await context.newPage();await storagePage(page);await storagePage(other);
  for(const key of [STORAGE_KEYS.seeds,STORAGE_KEYS.progress]) {
    const legacy='[  "legacy" ]\n';await page.evaluate(({key,legacy})=>localStorage.setItem(key,legacy),{key,legacy});
    const migrated=await Promise.all([page.evaluate(key=>window.testStorage.read(key),key),other.evaluate(key=>window.testStorage.read(key),key)]);
    expect(migrated).toEqual([legacy,legacy]);
    await other.evaluate(key=>localStorage.setItem(key,'["stale mirror"]'),key);
    const append=(tab,prefix)=>tab.evaluate(async({key,prefix})=>{
      for(let i=0;i<50;i++)await window.testStorage.change(key,raw=>({raw:JSON.stringify([...JSON.parse(raw),`${prefix}${i}`]),result:null}));
    },{key,prefix});
    await Promise.all([append(page,'a'),append(other,'b')]);
    const durable=JSON.parse(await readStorage(page,key));
    expect(durable).toHaveLength(101);expect(new Set(durable).size).toBe(101);expect(durable[0]).toBe('legacy');
    expect(durable).not.toContain('stale mirror');
    await storagePage(page);expect(JSON.parse(await page.evaluate(key=>window.testStorage.read(key),key))).toEqual(durable);
  }
});

test('an aborted primary transaction preserves raw bytes while a failed mirror still leaves durable success',async({page})=>{
  await storagePage(page);
  const key=STORAGE_KEYS.seeds,legacy='[\n  {"legacy":"untouched"}\n]\n';
  await page.evaluate(({key,legacy})=>localStorage.setItem(key,legacy),{key,legacy});
  expect(await page.evaluate(key=>window.testStorage.read(key),key)).toBe(legacy);
  await failStorageWrites(page,key);
  const failure=await page.evaluate(async key=>{
    try{await window.testStorage.change(key,()=>({raw:'["aborted"]',result:true}));return null;}
    catch(error){return error.message;}
  },key);
  expect(failure).toContain('could not be updated');expect(await readStorage(page,key)).toBe(legacy);
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(legacy);
  await restoreStorageWrites(page);
  await page.evaluate(key=>{
    const write=Storage.prototype.setItem;
    Storage.prototype.setItem=function(name,value){if(name===key)throw new DOMException('Mirror unavailable','QuotaExceededError');return write.call(this,name,value);};
  },key);
  expect(await page.evaluate(key=>window.testStorage.change(key,()=>({raw:'["committed"]',result:'saved'})),key)).toBe('saved');
  expect(await readStorage(page,key)).toBe('["committed"]');expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(legacy);
  await storagePage(page);expect(await page.evaluate(key=>window.testStorage.read(key),key)).toBe('["committed"]');
});

test('raw recovery backup and replacement commit together and backups never overwrite',async({page})=>{
  await storagePage(page);
  const key=STORAGE_KEYS.progress,prefix=`${key}:recovery:`,backupKey=`${prefix}one`,raw='unreadable original bytes';
  await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw});
  expect(await page.evaluate(key=>window.testStorage.read(key),key)).toBe(raw);
  await failStorageWrites(page,key);
  // A superseded navigation returns a result without issuing any put.
  expect(await page.evaluate(key=>window.testStorage.change(key,()=>({result:false})),key)).toBe(false);
  const replace=()=>page.evaluate(async({key,backupKey,raw})=>{
    try{return await window.testStorage.change(key,()=>({raw:'{"replaced":true}',backup:{key:backupKey,raw},result:'committed'}));}
    catch(error){return error.message;}
  },{key,backupKey,raw});
  expect(await replace()).toContain('could not be updated');expect(await readStorage(page,key)).toBe(raw);
  expect(await page.evaluate(prefix=>window.testStorage.list(prefix),prefix)).toEqual([]);
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(raw);
  await restoreStorageWrites(page);expect(await replace()).toBe('committed');
  expect(await readStorage(page,key)).toBe('{"replaced":true}');
  await storagePage(page);expect(await page.evaluate(prefix=>window.testStorage.list(prefix),prefix)).toEqual([{key:backupKey,raw}]);
  expect(await replace()).toContain('could not be updated');
  expect(await readStorage(page,key)).toBe('{"replaced":true}');
  expect(await page.evaluate(prefix=>window.testStorage.list(prefix),prefix)).toEqual([{key:backupKey,raw}]);
});
