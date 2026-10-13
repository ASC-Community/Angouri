import {test,expect} from '@playwright/test';
import {STORAGE_KEYS,readStorage,writeStorage} from './storage-fixtures.mjs';

const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
const ready=page=>page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
const workspace=page=>page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history,entry:location.hash}));
// A fresh document load, as when a player opens a link again later.
async function open(page,hash){await page.goto('/about/');await page.goto(`/${hash}`);await ready(page);}
const SAVE=STORAGE_KEYS.progress;
const hash=(page,entry)=>page.evaluate(entry=>{location.hash=entry;},entry);
const place=async(page,op='H')=>{await page.locator(`[data-op="${op}"]`).click();await idle(page);};
// Holds the next kernel request of this type, then answers it for real or with an error.
async function holdAction(page,type,response='success') {
  await page.evaluate(({type,response})=>{
    const post=Worker.prototype.postMessage;
    Worker.prototype.postMessage=function(message,...rest){
      if(message.request?.action?.type===type&&!window.releaseHeld){
        const worker=this;window.releaseHeld=()=>{
          if(response==='success')post.call(worker,message,...rest);
          else worker.dispatchEvent(new MessageEvent('message',{data:{type:'result',id:message.id,milliseconds:0,response:{status:'error',message:'Obsolete response'}}}));
        };return;
      }
      return post.call(this,message,...rest);
    };
  },{type,response});
}
async function saveRecipe(page,name) {
  await page.locator('#menu-open').click();await page.locator('#library-open').click();
  await page.locator('#seed-name').fill(name);await page.locator('#favorite-save').click();await idle(page);
}
async function choosePuzzle(page,id) {
  await page.locator('#menu-open').click();await page.locator('#puzzles-open').click();
  const option=page.locator(`#level-nav [data-level="${id}"]`);
  if(!await option.isVisible())await option.locator('xpath=ancestor::details').locator('summary').click();
  await option.click();
}

test('Next detaches the opening level link so it opens that puzzle again',async({page})=>{
  await open(page,'#level=1&view=flight');
  await page.locator('[data-op="H"]').click();await idle(page);
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.state.sourceId===2);await idle(page);
  expect((await workspace(page)).entry).toBe('');
  // Reloading the unlinked page still resumes the current workspace.
  await page.reload();await page.waitForFunction(()=>window.angouri?.state?.sourceId===2);await ready(page);
  await open(page,'#level=1&view=flight');
  expect(await workspace(page)).toMatchObject({state:{mode:'puzzle',sourceId:1,nodes:[]},entry:'#level=1&view=flight'});
});

test('a shared link survives a cancelled switch and opens again after leaving it',async({page})=>{
  await open(page,'#level=4&view=flight');
  await page.locator('[data-op="H"]').click();await idle(page);
  await page.locator('#menu-open').click();await page.locator('#share-open').click();
  await page.locator('#share-kind').selectOption('creation');
  await expect(page.locator('#share-link')).toHaveValue(/#v1=/);
  const link=new URL(await page.locator('#share-link').inputValue()).hash;
  await open(page,link);
  const shared=await workspace(page);
  expect(shared).toMatchObject({state:{nodes:[{op:'H'}]},entry:link});
  await choosePuzzle(page,3);await expect(page.locator('#leave-dialog')).toBeVisible();
  await page.locator('#leave-cancel').click();await expect(page.locator('#leave-dialog')).toBeHidden();
  expect(await workspace(page)).toEqual(shared);
  await choosePuzzle(page,3);await page.locator('#leave-discard').click();
  await page.waitForFunction(()=>window.angouri.state.mode==='puzzle'&&window.angouri.state.sourceId===3);await idle(page);
  expect((await workspace(page)).entry).toBe('');
  await open(page,link);
  expect(await workspace(page)).toMatchObject({state:{nodes:[{op:'H'}]},entry:link});
});

test('Create and opening a saved recipe leave the level link reusable',async({page})=>{
  await open(page,'#level=4&view=flight');
  await page.locator('#menu-open').click();await page.locator('#nav-create').click();
  await page.waitForFunction(()=>window.angouri.state.mode==='remix');await idle(page);
  expect((await workspace(page)).entry).toBe('');
  await open(page,'#level=4&view=flight');
  expect(await workspace(page)).toMatchObject({state:{mode:'puzzle',sourceId:4,nodes:[]},entry:'#level=4&view=flight'});
  await page.locator('[data-op="H"]').click();await idle(page);
  await page.locator('#menu-open').click();await page.locator('#library-open').click();
  await page.locator('#seed-name').fill('Kept recipe');await page.locator('#favorite-save').click();await idle(page);
  await page.getByRole('button',{name:'Open Kept recipe',exact:true}).click();
  await expect(page.locator('#library-dialog')).toBeHidden();await idle(page);
  expect(await workspace(page)).toMatchObject({state:{sourceId:4,nodes:[{op:'H'}]},history:{undo:0,redo:0},entry:''});
  await open(page,'#level=4&view=flight');
  expect(await workspace(page)).toMatchObject({state:{mode:'puzzle',sourceId:4,nodes:[]},entry:'#level=4&view=flight'});
});

test('the open puzzle and a rejected file keep the opening link',async({page})=>{
  await open(page,'#level=4&view=flight');
  await page.locator('[data-op="H"]').click();await idle(page);
  const before=await workspace(page);
  await choosePuzzle(page,4);await expect(page.locator('#puzzles-dialog')).toBeHidden();await idle(page);
  expect(await workspace(page)).toEqual(before);
  await page.locator('#menu-open').click();await page.locator('#library-open').click();
  const chooser=page.waitForEvent('filechooser');await page.locator('#import-open').click();
  await (await chooser).setFiles({name:'future.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schema:999,type:'creation'}))});
  await expect(page.locator('#feedback')).toHaveClass(/error/);await idle(page);
  expect(await workspace(page)).toEqual(before);
});

test('a malformed newer hash cancels a delayed Next and keeps the level link',async({page})=>{
  await open(page,'#level=1&view=flight');await place(page);
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await idle(page);
  const before=await workspace(page),saved=await readStorage(page,SAVE);
  await holdAction(page,'level');await page.locator('#launch').click();await page.waitForFunction(()=>!!window.releaseHeld);
  await hash(page,'#v1=%25');await expect(page.locator('#feedback')).toHaveClass(/error/);
  const feedback=await page.locator('#feedback').textContent();
  await page.evaluate(()=>window.releaseHeld());await idle(page);
  expect(await workspace(page)).toEqual(before);expect(await readStorage(page,SAVE)).toBe(saved);
  await expect(page.locator('#feedback')).toHaveText(feedback);
  await expect(page.locator('#launch')).toHaveAccessibleName('Next puzzle');
});

test('the latest hash wins even when it returns to an earlier pending link',async({page})=>{
  await open(page,'#level=3&view=flight');
  await holdAction(page,'level');await hash(page,'#level=4&view=flight');await page.waitForFunction(()=>!!window.releaseHeld);
  await hash(page,'#level=5&view=flight');await hash(page,'#level=4&view=flight');
  await page.evaluate(()=>window.releaseHeld());
  await page.waitForFunction(()=>window.angouri.state.sourceId===4);await idle(page);
  expect(await workspace(page)).toMatchObject({state:{sourceId:4},entry:'#level=4&view=flight'});
  expect(JSON.parse(await readStorage(page,SAVE))).toMatchObject({state:{sourceId:4},entry:'#level=4&view=flight'});
});

for(const response of ['success','error'])test(`a newer hash cancels a delayed saved recipe ${response}`,async({page})=>{
  await open(page,'#level=4&view=flight');await place(page);await saveRecipe(page,'Kept recipe');
  const before=await workspace(page),saved=await readStorage(page,SAVE);
  await holdAction(page,'evaluate',response);
  await page.getByRole('button',{name:'Open Kept recipe',exact:true}).click();await page.waitForFunction(()=>!!window.releaseHeld);
  await hash(page,'#v1=%25');await expect(page.locator('#feedback')).toHaveClass(/error/);
  const feedback=await page.locator('#feedback').textContent();
  await page.evaluate(()=>window.releaseHeld());await idle(page);
  expect(await workspace(page)).toEqual(before);expect(await readStorage(page,SAVE)).toBe(saved);
  await expect(page.locator('#feedback')).toHaveText(feedback);
});

test('an accepted progress file detaches the opening link and resumes after reload',async({page})=>{
  await open(page,'#level=4&view=flight');await place(page);
  const file={...JSON.parse(await readStorage(page,SAVE)),completed:[1]};
  await page.locator('#undo').click();await idle(page);
  await page.locator('#import-file').setInputFiles({name:'progress.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(file))});
  await page.waitForFunction(()=>window.angouri.state.nodes.length===1);await idle(page);
  expect(await workspace(page)).toMatchObject({state:{sourceId:4,nodes:[{op:'H'}]},entry:''});
  expect(JSON.parse(await readStorage(page,SAVE))).toMatchObject({entry:'',completed:[1]});
  await page.reload();await page.waitForFunction(()=>window.angouri?.state?.nodes.length===1);await ready(page);
  expect(await workspace(page)).toMatchObject({state:{sourceId:4,nodes:[{op:'H'}]},entry:''});
  await open(page,'#level=4&view=flight');
  expect(await workspace(page)).toMatchObject({state:{mode:'puzzle',sourceId:4,nodes:[]},entry:'#level=4&view=flight'});
});

test('a legacy saved recipe without a snapshot detaches the opening link',async({page})=>{
  await open(page,'#level=4&view=flight');await place(page);await saveRecipe(page,'Legacy recipe');
  const legacy=JSON.parse(await readStorage(page,STORAGE_KEYS.seeds)).map(({snapshot,...seed})=>seed);
  expect(legacy).toHaveLength(1);
  await writeStorage(page,STORAGE_KEYS.seeds,JSON.stringify(legacy));
  await page.reload();await ready(page);
  await page.locator('#menu-open').click();await page.locator('#library-open').click();
  await page.getByRole('button',{name:'Open Legacy recipe',exact:true}).click();
  await expect(page.locator('#leave-dialog')).toBeVisible();await page.locator('#leave-discard').click();
  await expect(page.locator('#library-dialog')).toBeHidden();await idle(page);
  expect(await workspace(page)).toMatchObject({state:{nodes:[{op:'H'}]},entry:''});
  expect(JSON.parse(await readStorage(page,SAVE)).entry).toBe('');
  await open(page,'#level=4&view=flight');
  expect(await workspace(page)).toMatchObject({state:{mode:'puzzle',sourceId:4,nodes:[]},entry:'#level=4&view=flight'});
});

async function resetProgress(page) {
  await page.locator('#menu-open').click();await page.locator('#settings-open').click();await page.locator('#reset-progress-open').click();
  await page.locator('#reset-progress-confirm').click();
}

test('reset progress supersedes a delayed startup restore',async({page})=>{
  await open(page,'#level=3&view=flow');await place(page,'A');
  const save=JSON.parse(await readStorage(page,SAVE));save.completed=[1,2];await writeStorage(page,SAVE,JSON.stringify(save));
  await page.addInitScript(()=>{
    const post=Worker.prototype.postMessage;let held=false;
    Worker.prototype.postMessage=function(message,...rest){
      if(!held&&message.request?.action?.type==='evaluate'&&message.request.state?.sourceId===3){
        held=true;const worker=this;window.releaseStartup=()=>post.call(worker,message,...rest);return;
      }
      return post.call(this,message,...rest);
    };
  });
  await page.reload();await page.waitForFunction(()=>!!window.releaseStartup);
  await resetProgress(page);await page.evaluate(()=>window.releaseStartup());
  await page.waitForFunction(()=>window.angouri?.state?.sourceId===1);await idle(page);
  expect(await workspace(page)).toMatchObject({state:{sourceId:1,nodes:[]},entry:''});
  expect(JSON.parse(await readStorage(page,SAVE))).toMatchObject({state:{sourceId:1},entry:'',completed:[]});
  await expect(page.locator('#move-announcement')).toHaveText('Puzzle progress reset. Chapter 1 is ready.');
});

// Another page holds a real readwrite transaction on the shared records store,
// which queues every device storage transaction of the game page behind it.
async function holdRecords(context,key) {
  const blocker=await context.newPage();await blocker.goto('/about/');
  await blocker.evaluate(key=>new Promise((held,reject)=>{
    const request=indexedDB.open('angouri:device:v1',1);
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result,transaction=db.transaction('records','readwrite'),store=transaction.objectStore('records');
      let released=false,announce=true;
      const finished=new Promise((resolve,reject)=>{
        transaction.oncomplete=()=>{db.close();resolve();};
        transaction.onabort=()=>{db.close();reject(transaction.error||Error('Held transaction aborted'));};
      });
      window.releaseRecords=()=>{released=true;return finished;};
      const keepAlive=()=>{
        store.get(key).onsuccess=()=>{
          if(announce){announce=false;held();}
          if(!released)keepAlive();
        };
      };
      keepAlive();
    };
  }),key);
  return blocker;
}
// Flags the game page's next request for this record, issued even while queued.
const observeRecord=(page,key)=>page.evaluate(key=>{
  const get=IDBObjectStore.prototype.get;window.recordRequested=false;
  IDBObjectStore.prototype.get=function(query,...rest){
    if(this.name==='records'&&query===key)window.recordRequested=true;
    return get.call(this,query,...rest);
  };
},key);

test('a newer hash supersedes reset progress waiting for the storage transaction',async({context,page})=>{
  await open(page,'#level=4&view=flight');
  const save=JSON.parse(await readStorage(page,SAVE));save.completed=[1,2,3];await writeStorage(page,SAVE,JSON.stringify(save));
  await page.reload();await ready(page);await idle(page);
  const blocker=await holdRecords(context,SAVE);
  await page.locator('#menu-open').click();await page.locator('#settings-open').click();await page.locator('#reset-progress-open').click();
  // Observe only the reset's own progress write, after its kernel reply.
  await holdAction(page,'level');await page.locator('#reset-progress-confirm').click();await page.waitForFunction(()=>!!window.releaseHeld);
  await observeRecord(page,SAVE);await page.evaluate(()=>window.releaseHeld());await page.waitForFunction(()=>window.recordRequested);
  await hash(page,'#level=5&view=flight');await blocker.evaluate(()=>window.releaseRecords());
  await page.waitForFunction(()=>window.angouri.state.sourceId===5);await idle(page);
  expect((await workspace(page)).entry).toBe('#level=5&view=flight');
  expect(JSON.parse(await readStorage(page,SAVE))).toMatchObject({state:{sourceId:5},entry:'#level=5&view=flight',completed:[1,2,3]});
  await expect(page.locator('#reset-progress-error')).toBeHidden();await expect(page.locator('#feedback')).not.toHaveClass(/error/);
  await expect(page.locator('#move-announcement')).not.toHaveText(/progress reset/);
  await blocker.close();
});

test('a newer hash during a committed reset autosave suppresses the reset confirmation',async({page})=>{
  await open(page,'#level=4&view=flight');
  await page.locator('#menu-open').click();await page.locator('#settings-open').click();await page.locator('#reset-progress-open').click();
  // Keep the autosave after the accepted reset open, so serial is still waiting.
  await page.evaluate(key=>{
    const get=IDBObjectStore.prototype.get;let holding=false;
    IDBObjectStore.prototype.get=function(query,...rest){
      const request=get.call(this,query,...rest);
      if(!holding&&this.name==='records'&&query===key&&window.angouri.state?.sourceId===1) {
        holding=true;const store=this;window.autosaveHeld=true;
        const keepAlive=()=>{get.call(store,key).onsuccess=()=>{if(!window.releaseAutosave)keepAlive();};};keepAlive();
      }
      return request;
    };
  },SAVE);
  await page.locator('#reset-progress-confirm').click();await page.waitForFunction(()=>window.autosaveHeld);
  await hash(page,'#v1=%25');await expect(page.locator('#feedback')).toHaveClass(/error/);
  const feedback=await page.locator('#feedback').textContent();
  await page.evaluate(()=>{window.releaseAutosave=true;});await idle(page);
  expect(await workspace(page)).toMatchObject({state:{sourceId:1,nodes:[]},entry:''});
  expect(JSON.parse(await readStorage(page,SAVE))).toMatchObject({entry:'',completed:[]});
  await expect(page.locator('#feedback')).toHaveText(feedback);
  await expect(page.locator('#move-announcement')).not.toHaveText(/progress reset/);
  await expect(page.locator('#reset-progress-dialog')).toBeVisible();
});

test('a newer hash cancels saved recipe Open waiting for the library read',async({context,page})=>{
  await open(page,'#level=4&view=flight');await place(page);await saveRecipe(page,'Kept recipe');
  const before=await workspace(page),saved=await readStorage(page,SAVE);
  await page.evaluate(()=>{
    const post=Worker.prototype.postMessage;window.evaluations=0;
    Worker.prototype.postMessage=function(message,...rest){if(message.request?.action?.type==='evaluate')window.evaluations++;return post.call(this,message,...rest);};
  });
  const blocker=await holdRecords(context,STORAGE_KEYS.seeds);await observeRecord(page,STORAGE_KEYS.seeds);
  await page.getByRole('button',{name:'Open Kept recipe',exact:true}).click();await page.waitForFunction(()=>window.recordRequested);
  await hash(page,'#v1=%25');await expect(page.locator('#feedback')).toHaveClass(/error/);
  const feedback=await page.locator('#feedback').textContent();
  await blocker.evaluate(()=>window.releaseRecords());await idle(page);
  expect(await workspace(page)).toEqual(before);expect(await readStorage(page,SAVE)).toBe(saved);
  await expect(page.locator('#feedback')).toHaveText(feedback);await expect(page.locator('#leave-dialog')).toBeHidden();
  expect(await page.evaluate(()=>window.evaluations)).toBe(0);
  await blocker.close();
});
