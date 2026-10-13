import {test,expect} from '@playwright/test';
import {STORAGE_KEYS,clearStorage,readStorage,writeStorage,failStorageWrites,restoreStorageWrites} from './storage-fixtures.mjs';

const SAVE=STORAGE_KEYS.progress;
const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
const encoded=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
async function ready(page,source=4,view='flow') {
  await page.goto(`/#level=${source}&view=${view}`);
  await page.waitForFunction(()=>window.angouri?.state&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
}
async function snapshot(page) {
  const current=await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,view:window.angouri.view,history:window.angouri.history,entry:location.hash}));
  return {...current,saved:await readStorage(page,SAVE)};
}
const mirror=page=>page.evaluate(key=>localStorage.getItem(key),SAVE);
async function place(page,op='H'){await page.locator(`[data-op="${op}"]`).click();await idle(page);}
async function importFile(page,value){await page.locator('#import-file').setInputFiles({name:'recipe.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});}
async function hash(page,entry){await page.evaluate(entry=>{location.hash=entry;},entry);}
async function holdAction(page,type) {
  await page.evaluate(type=>{
    const post=Worker.prototype.postMessage;
    Worker.prototype.postMessage=function(message,...rest){
      if(message.request?.action?.type===type&&!window.releaseHeld){
        const worker=this;window.releaseHeld=()=>post.call(worker,message,...rest);return;
      }
      return post.call(this,message,...rest);
    };
  },type);
}

test('URL progress saves have no completion authority but explicit files retain it',async({page})=>{
  await ready(page);await place(page);
  const save=JSON.parse(await readStorage(page,SAVE));save.completed=[1,2,3];await writeStorage(page,SAVE,JSON.stringify(save));
  await page.reload();await page.waitForFunction(()=>window.angouri?.state);await idle(page);
  const before=await snapshot(page),originalMirror=await mirror(page),payload={...JSON.parse(before.saved),completed:[]};
  await page.goto('/about/');await page.goto(`/#v1=${encoded(payload)}`);
  await page.waitForFunction(()=>window.angouri?.state);await idle(page);
  expect(await snapshot(page)).toEqual(before);expect(await mirror(page)).toBe(originalMirror);
  await expect(page.locator('#feedback')).toContainText('saved recipe is ready');
  await hash(page,`#v1=${encoded({...payload,completed:[84]})}`);
  await expect(page.locator('#feedback')).toContainText('Import progress from file');
  expect(await snapshot(page)).toEqual(before);expect(await mirror(page)).toBe(originalMirror);
  await expect(page.locator('#leave-dialog')).not.toBeVisible();
  await importFile(page,payload);await expect(page.locator('#leave-dialog')).toBeVisible();
  await page.locator('#leave-discard').click();await idle(page);
  await expect.poll(async()=>JSON.parse(await readStorage(page,SAVE)).completed).toEqual([]);
});

test('malformed and rejected startup links restore exact saved work without engine Retry',async({page})=>{
  await ready(page);await place(page);await page.locator('[data-empty="2"]').click();await place(page,'H');
  const before=await snapshot(page),originalMirror=await mirror(page);
  const invalidCreation={schema:1,rules:'vine-1',engine:'AngouriMath-2.5.0',type:'creation',sourceId:4,view:'flow',nodes:[{id:'bad',op:'?'}]};
  const links=['%25',Buffer.from([255]).toString('base64url'),Buffer.from('{broken').toString('base64url'),encoded({schema:999,type:'creation'}),encoded(invalidCreation)];
  for(const link of links) {
    await page.goto('/about/');await page.goto(`/#v1=${link}`);
    await page.waitForFunction(()=>window.angouri?.state);await idle(page);
    const after=await snapshot(page);
    expect(after).toEqual({...before,history:{undo:0,redo:0}});
    expect(await mirror(page)).toBe(originalMirror);
    await expect(page.locator('#retry-engine')).toHaveCount(0);
    await expect(page.locator('#feedback')).toContainText('saved recipe is ready');
  }
});

test('hash replacement protects work, restores the URL on cancel, and waits to persist its entry',async({page})=>{
  await ready(page);await place(page);const before=await snapshot(page);
  await hash(page,'#level=3&view=function');await expect(page.locator('#leave-dialog')).toBeVisible();
  const pending=await snapshot(page);expect(pending.saved).toBe(before.saved);expect(pending.state).toEqual(before.state);
  await page.locator('#leave-cancel').click();
  await expect.poll(()=>snapshot(page)).toEqual(before);
  await hash(page,'#level=3&view=function');await expect(page.locator('#leave-dialog')).toBeVisible();
  await page.locator('#leave-discard').click();
  await page.waitForFunction(()=>window.angouri.state.sourceId===3);await idle(page);
  const after=await snapshot(page);expect(after.entry).toBe('#level=3&view=function');expect(JSON.parse(after.saved).entry).toBe(after.entry);expect(after.history).toEqual({undo:0,redo:0});
});

test('a pending edit keeps its acknowledged URL and the latest hash wins its guard',async({page})=>{
  await ready(page);const entry=new URL(page.url()).hash;
  await holdAction(page,'insert');await page.locator('[data-op="H"]').click();await page.waitForFunction(()=>!!window.releaseHeld);
  await hash(page,'#level=3&view=function');await page.evaluate(()=>window.releaseHeld());
  await expect(page.locator('#leave-dialog')).toBeVisible();
  const accepted=await snapshot(page),saved=JSON.parse(accepted.saved);
  expect(saved.entry).toBe(entry);expect(saved.state.nodes.map(node=>node.op)).toEqual(['H']);
  await hash(page,'#level=5&view=flight');await expect(page.locator('#leave-dialog')).toBeVisible();
  await page.locator('#leave-discard').click();await page.waitForFunction(()=>window.angouri.state.sourceId===5);await idle(page);
  const final=await snapshot(page);expect(final.entry).toBe('#level=5&view=flight');expect(JSON.parse(final.saved).entry).toBe(final.entry);
});

test('file replacement validates first, saves accepted work, and stays open when saving fails',async({page})=>{
  await ready(page);await place(page);const before=await snapshot(page);
  await importFile(page,{schema:999,type:'creation'});await expect(page.locator('#feedback')).toHaveClass(/error/);await idle(page);
  await expect(page.locator('#leave-dialog')).not.toBeVisible();expect(await snapshot(page)).toEqual(before);
  const destination={schema:1,type:'level',sourceId:3,view:'flight'};
  await importFile(page,destination);await expect(page.locator('#leave-dialog')).toBeVisible();
  await page.locator('#leave-name').fill('Protected blocks');
  await failStorageWrites(page,STORAGE_KEYS.seeds);
  await page.locator('#leave-save').click();await expect(page.locator('#leave-error')).toBeVisible();
  expect(await snapshot(page)).toEqual(before);await expect(page.locator('#leave-dialog')).toBeVisible();
  await restoreStorageWrites(page);await page.locator('#leave-save').click();
  await page.waitForFunction(()=>window.angouri.state.sourceId===3);await idle(page);
  const seed=JSON.parse(await readStorage(page,STORAGE_KEYS.seeds)).find(seed=>seed.name==='Protected blocks');
  expect(seed.snapshot).toEqual({state:before.state,slots:before.slots});expect(seed.view).toBe(before.view);
});

test('a queued accepted edit is protected before Puzzle, Create, and saved-recipe navigation',async({page})=>{
  test.setTimeout(90000);
  for(const destination of ['puzzle','create','saved']) {
    await page.goto('/about/');await clearStorage(page);await ready(page);
    if(destination==='saved') {
      await page.locator('#menu-open').click();await page.locator('#library-open').click();
      await page.locator('#seed-name').fill('Empty baseline');await page.locator('#favorite-save').click();await idle(page);
      await page.locator('#library-dialog .close-dialog').click();
    }
    await holdAction(page,'insert');await page.locator('[data-op="H"]').click();await page.waitForFunction(()=>!!window.releaseHeld);
    await page.locator('#menu-open').click();
    if(destination==='puzzle') {
      await page.locator('#puzzles-open').click();
      const option=page.locator('#level-nav [data-level="3"]');if(!await option.isVisible())await option.locator('xpath=ancestor::details').locator('summary').click();
      await option.click();
    } else if(destination==='create')await page.locator('#nav-create').click();
    else {await page.locator('#library-open').click();await page.locator('[data-seed="0"]').click();}
    await expect(page.locator('#leave-dialog')).not.toBeVisible();
    await page.evaluate(()=>window.releaseHeld());await expect(page.locator('#leave-dialog')).toBeVisible();
    expect((await snapshot(page)).state.nodes.map(node=>node.op)).toEqual(['H']);
    const accepted=await snapshot(page);await page.locator('#leave-cancel').click();expect(await snapshot(page)).toEqual(accepted);
  }
});

test('circle and crop-only work receive the same import guard',async({page})=>{
  test.setTimeout(90000);
  await ready(page,43,'function');
  const radius=page.locator('[data-circle-value="radius"]');await radius.fill('3');await radius.press('Enter');await idle(page);
  const circle=await snapshot(page);await hash(page,'#level=3&view=flight');await expect(page.locator('#leave-dialog')).toBeVisible();
  await page.locator('#leave-cancel').click();expect(await snapshot(page)).toEqual(circle);
  await page.goto('/about/');await clearStorage(page);await ready(page,1,'flight');
  await page.locator('#menu-open').click();await page.locator('#nav-create').click();await idle(page);
  await page.locator('[data-crop-add]').click();await idle(page);
  const bound=page.locator('[data-crop-exact="to"]');await bound.fill('2');await bound.press('Enter');await idle(page);
  const crop=await snapshot(page);expect(crop.state.nodes).toEqual([]);
  await importFile(page,{schema:1,type:'level',sourceId:3,view:'flight'});await expect(page.locator('#leave-dialog')).toBeVisible();
  await page.locator('#leave-cancel').click();expect(await snapshot(page)).toEqual(crop);
});

test('an invalid file chosen during loading does not cancel the initial workspace',async({page})=>{
  await page.addInitScript(()=>{
    const post=Worker.prototype.postMessage;let held=false;
    Worker.prototype.postMessage=function(message,...rest){
      if(!held&&message.request?.action?.type==='level') {
        held=true;const worker=this;window.releaseStartup=()=>post.call(worker,message,...rest);return;
      }
      return post.call(this,message,...rest);
    };
  });
  await page.goto('/#level=3&view=flow');await page.waitForFunction(()=>!!window.releaseStartup);
  await importFile(page,{schema:999,type:'creation'});await page.evaluate(()=>window.releaseStartup());
  await page.waitForFunction(()=>window.angouri?.state?.sourceId===3);await idle(page);
  await expect(page.locator('#retry-engine')).toHaveCount(0);
  expect(JSON.parse((await snapshot(page)).saved).entry).toBe('#level=3&view=flow');
});

for(const response of ['success','invalid','error'])test(`newer hash owns startup after delayed ${response}`,async({page})=>{
  await ready(page,3,'flow');await place(page,'A');
  await page.addInitScript(response=>{
    const post=Worker.prototype.postMessage;let held=false;
    Worker.prototype.postMessage=function(message,...rest){
      if(!held&&message.request?.action?.type==='evaluate'&&message.request.state?.sourceId===3){
        held=true;const worker=this;window.releaseStartup=()=>{
          if(response==='success')post.call(worker,message,...rest);
          else worker.dispatchEvent(new MessageEvent('message',{data:{type:'result',id:message.id,milliseconds:0,response:{status:response,message:'Obsolete startup response'}}}));
        };return;
      }
      return post.call(this,message,...rest);
    };
  },response);
  await page.reload();await page.waitForFunction(()=>!!window.releaseStartup);
  await hash(page,'#level=4&view=flight');await page.evaluate(()=>window.releaseStartup());
  await page.waitForFunction(()=>window.angouri?.state?.sourceId===4);await idle(page);
  const final=await snapshot(page);expect(final.state.sourceId).toBe(4);expect(final.entry).toBe('#level=4&view=flight');expect(JSON.parse(final.saved).entry).toBe(final.entry);
  await expect(page.locator('#retry-engine')).toHaveCount(0);
});


test('a newer link cancels a progress file waiting for the primary storage transaction',async({context,page})=>{
  await ready(page);await place(page);
  const save=JSON.parse(await readStorage(page,SAVE));save.completed=[1,2,3];await writeStorage(page,SAVE,JSON.stringify(save));
  await page.reload();await page.waitForFunction(()=>window.angouri?.state);await idle(page);
  const before=await snapshot(page),blocker=await context.newPage();await blocker.goto('/about/');
  await importFile(page,{...JSON.parse(before.saved),completed:[]});
  await expect(page.locator('#leave-dialog')).toBeVisible();
  // Let the unsaved-work library read finish before holding the shared records
  // store. A real readwrite transaction then queues the file's progress write.
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
      window.releaseProgressTransaction=()=>{released=true;return finished;};
      const keepAlive=()=>{
        store.get(key).onsuccess=()=>{
          if(announce){announce=false;held();}
          if(!released)keepAlive();
        };
      };
      keepAlive();
    };
  }),SAVE);
  await page.evaluate(()=>{
    const transaction=IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction=function(stores,mode,...rest){
      const result=transaction.call(this,stores,mode,...rest);
      if(this.name==='angouri:device:v1'&&mode==='readwrite'&&(stores==='records'||Array.from(stores).includes('records')))window.progressTransactionQueued=true;
      return result;
    };
  });
  await page.locator('#leave-discard').click();
  await page.waitForFunction(()=>window.progressTransactionQueued===true);
  await hash(page,'#level=5&view=flight');await blocker.evaluate(()=>window.releaseProgressTransaction());
  await expect(page.locator('#leave-dialog')).toBeVisible();
  const waiting=await snapshot(page);
  expect(waiting.state).toEqual(before.state);expect(waiting.history).toEqual(before.history);expect(waiting.saved).toBe(before.saved);
  await expect(page.locator('#feedback')).not.toHaveClass(/error/);
  await page.locator('#leave-discard').click();await page.waitForFunction(()=>window.angouri.state.sourceId===5);await idle(page);
  const final=await snapshot(page);expect(final.entry).toBe('#level=5&view=flight');expect(JSON.parse(final.saved).completed).toEqual([1,2,3]);
  await blocker.close();
});

for(const action of ['award','reset'])test(`a delayed startup restore retains another tab's ${action}`,async({context,page})=>{
  test.setTimeout(90000);
  const other=await context.newPage();await ready(other,2,'flight');
  await ready(page,1,'flight');await place(page);await page.locator('#launch').click();
  await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await idle(page);
  await page.addInitScript(()=>{
    const post=Worker.prototype.postMessage;let held=false;
    Worker.prototype.postMessage=function(message,...rest){
      if(!held&&message.request?.action?.type==='evaluate'&&message.request.state?.sourceId===1) {
        held=true;const worker=this;window.releaseStartup=()=>post.call(worker,message,...rest);return;
      }
      return post.call(this,message,...rest);
    };
  });
  await page.reload();await page.waitForFunction(()=>!!window.releaseStartup);
  if(action==='award') {
    await place(other,'A');await other.locator('#launch').click();
    await other.waitForFunction(()=>window.angouri.flight.phase==='landed');await idle(other);
  } else {
    await other.locator('#menu-open').click();await other.locator('#settings-open').click();await other.locator('#reset-progress-open').click();
    await other.locator('#reset-progress-confirm').click();await idle(other);
  }
  const durable=await readStorage(other,SAVE);
  expect(JSON.parse(durable).completed).toEqual(action==='award'?[1,2]:[]);
  await page.evaluate(()=>window.releaseStartup());await page.waitForFunction(()=>window.angouri?.state?.sourceId===1);await idle(page);
  expect((await snapshot(page)).saved).toBe(durable);
  if(action==='award') {
    await expect(page.locator('#level-nav [data-level="2"]')).toHaveAttribute('aria-label',/, completed$/);
    await expect(page.locator('#launch')).toHaveAccessibleName('Next puzzle');
  } else {
    await expect(page.locator('#level-nav [data-level="1"]')).not.toHaveAttribute('aria-label',/, completed$/);
    await expect(page.locator('#rethrow')).toBeHidden();
    expect(await page.evaluate(()=>window.angouri.flight.phase)).toBe('ready');
  }
  await other.close();
});
