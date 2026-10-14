import {test,expect} from '@playwright/test';
import {STORAGE_KEYS,clearStorage,readStorage,writeStorage,failStorageWrites,restoreStorageWrites} from './storage-fixtures.mjs';

// Saved-work recovery: unrestorable progress stays byte-for-byte exact until a
// deliberate change archives it and replaces it in one transaction.
const SAVE=STORAGE_KEYS.progress,RECOVERY=`${SAVE}:recovery:`;
const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
const ready=page=>page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
const mirror=page=>page.evaluate(key=>localStorage.getItem(key),SAVE);
const workspace=page=>page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,view:window.angouri.view,history:window.angouri.history,entry:location.hash}));
const place=async(page,op='H')=>{await page.locator(`[data-op="${op}"]`).click();await idle(page);};
const hash=(page,entry)=>page.evaluate(entry=>{location.hash=entry;},entry);
const stored=async page=>JSON.parse(await readStorage(page,SAVE));
// Recovery copies are separate primary records under the progress key's prefix.
const backups=page=>page.evaluate(prefix=>new Promise((resolve,reject)=>{
  const request=indexedDB.open('angouri:device:v1',1);
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{
    const db=request.result,read=db.transaction('records','readonly').objectStore('records').getAll(IDBKeyRange.bound(prefix,prefix+'\uffff'));
    read.onsuccess=()=>{db.close();resolve(read.result);};read.onerror=()=>{db.close();reject(read.error);};
  };
}),RECOVERY);
async function exact(page,raw) {
  expect(await readStorage(page,SAVE)).toBe(raw);
  expect(await mirror(page)).toBe(raw);
}
async function status(page,text) {
  await page.locator('#menu-open').click();await expect(page.locator('#save-status')).toContainText(text);
  if(text!=='Saved on this device')await expect(page.locator('#save-status')).not.toContainText('Saved on this device');
  await page.keyboard.press('Escape');
}
const sessionOnly=page=>status(page,'Session only');
async function seed(page,raw) {
  await page.goto('/about/');await clearStorage(page);await writeStorage(page,SAVE,raw);
}
const completedLevel=(page,id)=>expect(page.locator(`#level-nav [data-level="${id}"]`)).toHaveAttribute('aria-label',/, completed$/);
const keyPattern=/^angouri:vine:v1:progress:recovery:\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z:[0-9a-f-]{36}$/;
async function oneBackup(page,raw) {
  const copies=await backups(page);
  expect(copies).toHaveLength(1);expect(copies[0].raw).toBe(raw);expect(copies[0].key).toMatch(keyPattern);
  return copies[0].key;
}
async function resetDialog(page){await page.locator('#menu-open').click();await page.locator('#settings-open').click();await page.locator('#reset-progress-open').click();}
const importFile=(page,value)=>page.locator('#import-file').setInputFiles({name:'progress.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
// A real saved Puzzle 4 workspace whose recipe the kernel rejects.
async function rejectedSave(page) {
  await page.goto('/#level=4&view=flight');await ready(page);await place(page);
  const save=await stored(page);
  save.state.nodes=[{id:'bad',op:'?'}];save.progressEpoch='kept-epoch';save.completed=[1,2];
  return JSON.stringify(save,null,1);
}
// Holds the first evaluate of this source after every load, then answers it
// for real or with a forged error.
const holdStartup=(page,sourceId,response='success')=>page.addInitScript(({sourceId,response})=>{
  const post=Worker.prototype.postMessage;let held=false;
  Worker.prototype.postMessage=function(message,...rest){
    if(!held&&message.request?.action?.type==='evaluate'&&message.request.state?.sourceId===sourceId) {
      held=true;const worker=this;window.releaseStartup=()=>{
        if(response==='success')post.call(worker,message,...rest);
        else worker.dispatchEvent(new MessageEvent('message',{data:{type:'result',id:message.id,milliseconds:0,response:{status:'error',message:'Obsolete startup response'}}}));
      };return;
    }
    return post.call(this,message,...rest);
  };
},{sourceId,response});

// Holds the first count progress transactions open after their write, until
// each is released to commit or abort.
const holdWrites=(page,count=1)=>page.evaluate(({key,count})=>{
  const put=IDBObjectStore.prototype.put;window.held=[];
  IDBObjectStore.prototype.put=function(value,...rest){
    const request=put.call(this,value,...rest);
    if(this.name==='records'&&value?.key===key&&window.held.length<count) {
      const store=this;let next='hold';
      window.held.push(action=>{next=action;});
      const keepAlive=()=>{store.get(key).onsuccess=()=>{if(next==='abort')store.transaction.abort();else if(next==='hold')keepAlive();};};
      keepAlive();
    }
    return request;
  };
},{key:SAVE,count});
const heldWrites=(page,count)=>page.waitForFunction(count=>window.held.length===count,count);
const release=(page,index,action='commit')=>page.evaluate(([index,action])=>window.held[index](action),[index,action]);
const label=page=>expect(page.locator('#save-status'));
// A healthy saved puzzle that this tab restores and acknowledges.
async function acknowledgedSave(page,level=1) {
  await page.goto(`/#level=${level}&view=flight`);await ready(page);await idle(page);
  await writeStorage(page,SAVE,JSON.stringify({...await stored(page),progressEpoch:'known-epoch',completed:[2,3]}));
  await page.reload();await ready(page);await idle(page);
  await completedLevel(page,2);await completedLevel(page,3);
}
// Unsupported but readable progress from a newer epoch.
const newerEpoch='{"schema":2,"type":"save","state":{"mode":"puzzle"},"progressEpoch":"newer-epoch","completed":[3]}';
const landed=page=>page.locator('#launch').click().then(()=>page.waitForFunction(()=>window.angouri.flight.phase==='landed')).then(()=>idle(page));
const next=page=>page.locator('#launch').click().then(()=>page.waitForFunction(()=>window.angouri.state.sourceId===2)).then(()=>idle(page));
const notCompleted=(page,id)=>expect(page.locator(`#level-nav [data-level="${id}"]`)).not.toHaveAttribute('aria-label',/, completed$/);

const malformed='{"schema":1,"type":"save",  "state":';
const future='{ "schema" : 2 ,\n  "type":"save", "state":{"mode":"puzzle"},  "extra":[1, 2],\n "progressEpoch":"kept-epoch","completed":[1,2] }';

for(const name of ['malformed','future-schema','kernel-rejected'])test(`${name} saved progress is archived exactly by the first deliberate change`,async({page})=>{
  test.setTimeout(90000);
  const raw=name==='malformed'?malformed:name==='future-schema'?future:await rejectedSave(page);
  const readable=name!=='malformed';
  await seed(page,raw);await page.goto('/#level=3&view=flight');await ready(page);await idle(page);
  // A different link opens as a session draft; the old bytes are not opened.
  expect(await workspace(page)).toMatchObject({state:{sourceId:3,nodes:[]},entry:'#level=3&view=flight'});
  await expect(page.locator('#retry-engine')).toHaveCount(0);
  await expect(page.locator('#feedback')).toContainText('stays unchanged');
  await exact(page,raw);await sessionOnly(page);
  if(readable){await completedLevel(page,1);await completedLevel(page,2);}
  // A view switch and a preference are not deliberate replacements.
  await page.locator('#tab-function').click();await idle(page);
  await page.locator('#menu-open').click();await page.locator('#settings-open').click();await page.locator('#motion-toggle').click();await page.keyboard.press('Escape');
  await idle(page);await exact(page,raw);expect(await backups(page)).toEqual([]);await sessionOnly(page);
  await place(page,'A');
  const key=await oneBackup(page,raw);
  expect(await stored(page)).toMatchObject({state:{sourceId:3,nodes:[{op:'A'}]},view:'function',entry:'#level=3&view=flight',
    progressEpoch:readable?'kept-epoch':'legacy',completed:readable?[1,2]:[]});
  await status(page,'Saved on this device');
  // Later edits, views and reloads save ordinarily under the same single copy.
  await page.locator('#undo').click();await idle(page);await page.locator('#tab-flow').click();await idle(page);
  expect(await stored(page)).toMatchObject({state:{nodes:[]},view:'flow',progressEpoch:readable?'kept-epoch':'legacy'});
  await page.reload();await ready(page);await idle(page);
  expect(await workspace(page)).toMatchObject({state:{sourceId:3,nodes:[]},entry:'#level=3&view=flight'});
  expect(await oneBackup(page,raw)).toBe(key);
});

test('automatic fallback, Retry and a temporary failure never archive; recovery waits for a deliberate change',async({page})=>{
  const raw=await rejectedSave(page);await seed(page,raw);
  await page.addInitScript(()=>{
    const post=Worker.prototype.postMessage;
    Worker.prototype.postMessage=function(message,...rest){
      if(!sessionStorage.getItem('allowRestore')&&message.request?.action?.type==='evaluate'&&message.request.state?.sourceId===4) {
        this.dispatchEvent(new MessageEvent('message',{data:{type:'result',id:message.id,milliseconds:0,response:{status:'error',message:'Temporary engine failure'}}}));return;
      }
      return post.call(this,message,...rest);
    };
  });
  await page.goto('/#level=4&view=flight');await expect(page.locator('#retry-engine')).toBeVisible();
  for(let attempt=0;attempt<2;attempt++) {
    await page.locator('#retry-engine').click();await expect(page.locator('#retry-engine')).toBeVisible();
    await page.evaluate(()=>window.angouri.whenIdle());await exact(page,raw);
  }
  expect(new URL(page.url()).hash).toBe('#level=4&view=flight');
  // A real rejection now leaves the requested level as a session draft.
  await page.evaluate(()=>sessionStorage.setItem('allowRestore','true'));await page.locator('#retry-engine').click();
  await page.waitForFunction(()=>window.angouri?.state?.sourceId===4);await ready(page);await idle(page);
  expect(await workspace(page)).toMatchObject({state:{nodes:[]},entry:'#level=4&view=flight'});
  await exact(page,raw);expect(await backups(page)).toEqual([]);await sessionOnly(page);
  // Without a link, the automatic Puzzle 1 fallback is not a deliberate change either.
  await page.goto('/about/');await page.goto('/');await ready(page);await idle(page);
  expect((await workspace(page)).state).toMatchObject({sourceId:1,nodes:[]});
  await exact(page,raw);expect(await backups(page)).toEqual([]);
  await place(page);await oneBackup(page,raw);
  expect(await stored(page)).toMatchObject({state:{sourceId:1,nodes:[{op:'H'}]},progressEpoch:'kept-epoch',completed:[1,2]});
});

test('an aborted recovery keeps the original, the draft and pending wins',async({page})=>{
  await seed(page,malformed);await page.goto('/');await ready(page);await idle(page);
  await failStorageWrites(page,SAVE);
  await place(page);
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await idle(page);
  await restoreStorageWrites(page);
  await exact(page,malformed);expect(await backups(page)).toEqual([]);await sessionOnly(page);
  expect((await workspace(page)).state.nodes.map(node=>node.op)).toEqual(['H']);await completedLevel(page,1);
  // Next is a deliberate navigation; it archives with the session win kept.
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.state.sourceId===2);await idle(page);
  await oneBackup(page,malformed);
  expect(await stored(page)).toMatchObject({state:{sourceId:2},progressEpoch:'legacy',completed:[1]});
  await status(page,'Saved on this device');
});

test('a recovery never overwrites bytes another tab replaced',async({page})=>{
  await page.goto('/#level=4&view=flight');await ready(page);await place(page);
  const valid=await readStorage(page,SAVE);
  await seed(page,malformed);await page.goto('/');await ready(page);await idle(page);
  await writeStorage(page,SAVE,valid);
  await place(page);
  await expect(page.locator('#feedback')).toContainText('changed in another tab');
  expect(await workspace(page)).toMatchObject({state:{sourceId:1,nodes:[{op:'H'}]},entry:''});
  await exact(page,valid);expect(await backups(page)).toEqual([]);await sessionOnly(page);
});

test('confirmed reset and progress-file replacement archive the original in the same commit',async({page})=>{
  await seed(page,malformed);await page.goto('/');await ready(page);await idle(page);
  await resetDialog(page);await page.locator('#reset-progress-confirm').click();await idle(page);
  await expect(page.locator('#reset-progress-dialog')).toBeHidden();
  const reset=await stored(page);
  expect(reset).toMatchObject({state:{sourceId:1,nodes:[]},entry:'',completed:[]});expect(reset.progressEpoch).not.toBe('legacy');
  await oneBackup(page,malformed);
  await seed(page,future);await page.goto('/');await ready(page);await idle(page);
  const file={schema:1,type:'save',state:(await workspace(page)).state,view:'flight',completed:[3]};
  await importFile(page,file);
  await expect.poll(async()=>(await stored(page)).completed).toEqual([3]);await idle(page);
  const imported=await stored(page);
  expect(imported).toMatchObject({entry:''});expect(imported.progressEpoch).not.toBe('kept-epoch');
  await oneBackup(page,future);await completedLevel(page,3);
});

test('unread primary progress is never replaced, and Retry keeps known completions',async({page})=>{
  await page.goto('/#level=1&view=flight');await ready(page);await place(page);
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await idle(page);
  const raw=await readStorage(page,SAVE);expect(JSON.parse(raw).completed).toEqual([1]);
  await page.addInitScript(key=>{
    const post=Worker.prototype.postMessage,get=IDBObjectStore.prototype.get;
    Worker.prototype.postMessage=function(message,...rest){
      if(!window.restoreAvailable&&message.request?.action?.type==='evaluate'&&message.request.state?.sourceId===1) {
        this.dispatchEvent(new MessageEvent('message',{data:{type:'result',id:message.id,milliseconds:0,response:{status:'error',message:'Temporary engine failure'}}}));return;
      }
      return post.call(this,message,...rest);
    };
    IDBObjectStore.prototype.get=function(query,...rest){
      if(window.failPrimaryReads&&query===key)throw new DOMException('Fixture read failure','UnknownError');
      return get.call(this,query,...rest);
    };
  },SAVE);
  await page.reload();await expect(page.locator('#retry-engine')).toBeVisible();
  // Retry loses primary access and has no compatibility copy to open.
  await page.evaluate(key=>{window.failPrimaryReads=true;window.restoreAvailable=true;localStorage.removeItem(key);},SAVE);
  await page.locator('#retry-engine').click();
  await page.waitForFunction(()=>window.angouri?.state?.sourceId===1);await ready(page);await idle(page);
  await expect(page.locator('#feedback')).toContainText('could not be read');
  await completedLevel(page,1);await sessionOnly(page);
  await place(page);
  await resetDialog(page);await page.locator('#reset-progress-confirm').click();await idle(page);
  await expect(page.locator('#reset-progress-error')).toContainText('cannot be replaced');
  expect((await workspace(page)).state.nodes.map(node=>node.op)).toEqual(['H']);
  await page.evaluate(()=>{window.failPrimaryReads=false;});
  expect(await readStorage(page,SAVE)).toBe(raw);expect(await backups(page)).toEqual([]);
});

test('an obsolete startup read cannot adopt older completions',async({page})=>{
  await page.goto('/#level=1&view=flight');await ready(page);await place(page);
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await idle(page);
  const older=await stored(page),newer=JSON.stringify({...older,completed:[1,2],progressEpoch:'newer-epoch'});
  await page.addInitScript(()=>{
    // Keep later storage refreshes from masking which startup adopted metadata.
    for(const type of ['storage','focus'])window.addEventListener(type,event=>event.stopImmediatePropagation());
    document.addEventListener('visibilitychange',event=>event.stopImmediatePropagation());
    Object.defineProperty(window,'BroadcastChannel',{value:undefined});
    // Deliver the first device transaction (startup's progress read) only on release.
    const transaction=IDBDatabase.prototype.transaction;let held=false;
    IDBDatabase.prototype.transaction=function(...args){
      const created=transaction.apply(this,args);
      if(!held&&this.name==='angouri:device:v1') {
        held=true;let handler;
        Object.defineProperty(created,'oncomplete',{configurable:true,get:()=>handler,set:value=>{handler=value;}});
        created.addEventListener('complete',event=>{window.releaseRead=()=>handler?.call(created,event);});
      }
      return created;
    };
  });
  await page.reload();await page.waitForFunction(()=>!!window.releaseRead);
  await writeStorage(page,SAVE,newer);await failStorageWrites(page,SAVE);
  await hash(page,'#level=3&view=flight');await page.evaluate(()=>window.releaseRead());
  await page.waitForFunction(()=>window.angouri?.state?.sourceId===3);await ready(page);await idle(page);
  await completedLevel(page,2);
  await restoreStorageWrites(page);expect(await readStorage(page,SAVE)).toBe(newer);
});

test('a pending write cannot keep an earlier Saved label',async({context,page})=>{
  await page.goto('/#level=4&view=flight');await ready(page);await place(page);await status(page,'Saved on this device');
  const blocker=await context.newPage();await blocker.goto('/about/');
  await blocker.evaluate(key=>new Promise((held,reject)=>{
    const request=indexedDB.open('angouri:device:v1',1);
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result,transaction=db.transaction('records','readwrite'),store=transaction.objectStore('records');
      let released=false,announce=true;
      const finished=new Promise(resolve=>{transaction.oncomplete=()=>{db.close();resolve();};});
      window.releaseRecords=()=>{released=true;return finished;};
      const keepAlive=()=>{store.get(key).onsuccess=()=>{if(announce){announce=false;held();}if(!released)keepAlive();};};
      keepAlive();
    };
  }),SAVE);
  await page.locator('[data-empty="2"]').click();await page.locator('[data-op="H"]').click();
  await page.waitForFunction(()=>window.angouri.state.nodes.length===2);
  await status(page,'Saving…');
  await blocker.evaluate(()=>window.releaseRecords());await idle(page);
  expect((await stored(page)).state.nodes).toHaveLength(2);await status(page,'Saved on this device');
  await blocker.close();
});

test('a restore cannot authorize newer bytes written while it waited',async({page})=>{
  await page.goto('/#level=4&view=flight');await ready(page);await place(page);
  const healthy=await readStorage(page,SAVE),newer=await rejectedSave(page);
  await writeStorage(page,SAVE,healthy);
  await holdStartup(page,4);await page.reload();await page.waitForFunction(()=>!!window.releaseStartup);
  // Another writer replaces the primary while the old bytes are being restored.
  await writeStorage(page,SAVE,newer);
  await page.evaluate(()=>window.releaseStartup());
  await page.waitForFunction(()=>window.angouri?.state?.nodes.length===1);await ready(page);await idle(page);
  await page.locator('#reset').click();await idle(page);
  expect(await workspace(page)).toMatchObject({state:{sourceId:4,nodes:[]},entry:'#level=4&view=flight'});
  await exact(page,newer);expect(await backups(page)).toEqual([]);await sessionOnly(page);await completedLevel(page,2);
});

test('a late startup failure cannot relabel saved work checked under a newer link',async({page})=>{
  const raw=await rejectedSave(page);await writeStorage(page,SAVE,raw);
  await holdStartup(page,4,'error');await page.reload();await page.waitForFunction(()=>!!window.releaseStartup);
  await hash(page,'#level=3&view=flight');await page.evaluate(()=>window.releaseStartup());
  await page.waitForFunction(()=>window.angouri?.state?.sourceId===3);await ready(page);await idle(page);
  await expect(page.locator('#retry-engine')).toHaveCount(0);
  await expect(page.locator('#feedback')).toContainText('stays unchanged');
  await exact(page,raw);await sessionOnly(page);await completedLevel(page,2);
  // The newer link's own validation, not the stale error, decided the candidate.
  await place(page);await oneBackup(page,raw);
  expect(await stored(page)).toMatchObject({state:{sourceId:3,nodes:[{op:'H'}]},entry:'#level=3&view=flight',progressEpoch:'kept-epoch',completed:[1,2]});
});

test('a healthy tab checks replaced bytes before autosave and keeps its draft',async({page})=>{
  const raw=await rejectedSave(page);
  await page.locator('#reset').click();await idle(page);await status(page,'Saved on this device');
  await writeStorage(page,SAVE,raw);
  await place(page);
  expect(await workspace(page)).toMatchObject({state:{nodes:[{op:'H'}]},entry:'#level=4&view=flight'});
  await exact(page,raw);expect(await backups(page)).toEqual([]);await sessionOnly(page);
});

test('a healthy cross-tab save is checked once and merged normally',async({context,page})=>{
  const other=await context.newPage();
  await page.goto('/#level=1&view=flight');await ready(page);
  await other.goto('/#level=3&view=flight');await ready(other);await place(other,'A');
  await place(page);await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await idle(page);
  const won=await stored(page);expect(won).toMatchObject({state:{sourceId:1},completed:[1]});
  await other.evaluate(()=>{
    const post=Worker.prototype.postMessage;window.evaluations=0;
    Worker.prototype.postMessage=function(message,...rest){if(message.request?.action?.type==='evaluate'&&message.request.state?.sourceId===1)window.evaluations++;return post.call(this,message,...rest);};
  });
  await place(other,'H');
  expect(await stored(page)).toMatchObject({state:{sourceId:3,nodes:[{op:'A'},{op:'H'}]},progressEpoch:won.progressEpoch,completed:[1]});
  await other.locator('#undo').click();await idle(other);
  expect(await stored(page)).toMatchObject({state:{sourceId:3,nodes:[{op:'A'}]},entry:'#level=3&view=flight',progressEpoch:won.progressEpoch,completed:[1]});
  // One check of the first tab's bytes; later own writes reuse that evidence.
  expect(await other.evaluate(()=>window.evaluations)).toBe(1);
  expect(await backups(page)).toEqual([]);
  await other.locator('#menu-open').click();await expect(other.locator('#save-status')).toContainText('Saved on this device');
  await other.close();
});

test('recovering unreadable bytes keeps acknowledged completions and pending wins',async({page})=>{
  await acknowledgedSave(page);
  await writeStorage(page,SAVE,malformed);
  // The next write detects the replaced bytes and protects them.
  await place(page);await exact(page,malformed);await sessionOnly(page);
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await idle(page);
  await exact(page,malformed);expect(await backups(page)).toEqual([]);await completedLevel(page,1);
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.state.sourceId===2);await idle(page);
  await oneBackup(page,malformed);
  expect(await stored(page)).toMatchObject({state:{sourceId:2},progressEpoch:'known-epoch',completed:[2,3,1]});
  for(const id of [1,2,3])await completedLevel(page,id);
  await status(page,'Saved on this device');
});

test('a readable newer epoch in protected bytes supersedes acknowledged completions',async({page})=>{
  await acknowledgedSave(page,3);
  const newer='{"schema":2,"type":"save","state":{"mode":"puzzle"},"progressEpoch":"newer-epoch","completed":[3]}';
  await writeStorage(page,SAVE,newer);
  await place(page);await exact(page,newer);await sessionOnly(page);
  await page.locator('#undo').click();await idle(page);
  await oneBackup(page,newer);
  expect(await stored(page)).toMatchObject({state:{sourceId:3,nodes:[]},progressEpoch:'newer-epoch',completed:[3]});
  await completedLevel(page,3);await notCompleted(page,2);
});

test('views chosen during an authorized archive are saved after it commits',async({page})=>{
  await seed(page,malformed);await page.goto('/#level=3&view=flight');await ready(page);await idle(page);
  await holdWrites(page);
  await page.locator('[data-op="H"]').click();await heldWrites(page,1);
  await page.locator('#tab-function').click();await page.locator('#tab-flow').click();
  await release(page,0);await idle(page);
  const key=await oneBackup(page,malformed);
  expect(await stored(page)).toMatchObject({state:{sourceId:3,nodes:[{op:'H'}]},view:'flow'});
  await status(page,'Saved on this device');
  await page.reload();await ready(page);await idle(page);
  expect(await workspace(page)).toMatchObject({state:{sourceId:3,nodes:[{op:'H'}]},view:'flow'});
  expect((await stored(page)).view).toBe('flow');expect(await oneBackup(page,malformed)).toBe(key);
});

test('a failed archive keeps the original and the latest draft; views never authorize it',async({page})=>{
  await seed(page,malformed);await page.goto('/#level=3&view=flight');await ready(page);await idle(page);
  await holdWrites(page);
  await page.locator('[data-op="H"]').click();await heldWrites(page,1);
  await page.locator('#tab-function').click();
  await release(page,0,'abort');await idle(page);
  await exact(page,malformed);expect(await backups(page)).toEqual([]);
  expect(await workspace(page)).toMatchObject({state:{nodes:[{op:'H'}]},view:'function'});await sessionOnly(page);
  await page.locator('#tab-flow').click();await idle(page);
  await exact(page,malformed);expect(await backups(page)).toEqual([]);await sessionOnly(page);
  await place(page,'A');await oneBackup(page,malformed);
  const saved=await stored(page);expect(saved.view).toBe('flow');expect(saved.state.nodes).toHaveLength(2);
  await status(page,'Saved on this device');
});

for(const outcome of ['commit','abort'])test(`a committed earlier write is not Saved while a later write is pending (${outcome})`,async({page})=>{
  await page.goto('/#level=4&view=flight');await ready(page);await idle(page);
  await holdWrites(page,2);
  await page.locator('[data-op="H"]').click();await heldWrites(page,1);
  await label(page).toHaveText('Saving…');
  await page.locator('#tab-function').click();
  await release(page,0);await heldWrites(page,2);
  // The first write has committed; the newer view is still queued.
  await label(page).toHaveText('Saving…');
  await release(page,1,outcome);await idle(page);
  if(outcome==='commit') {
    await label(page).toContainText('Saved on this device');
    expect(await stored(page)).toMatchObject({state:{nodes:[{op:'H'}]},view:'function'});
  } else {
    await label(page).toHaveText('Session only · Export to keep your progress');
    expect(await stored(page)).toMatchObject({state:{nodes:[{op:'H'}]},view:'flight'});
  }
});

for(const timing of ['after','before'])test(`a win earned ${timing} detecting a newer protected epoch ${timing==='after'?'joins it':'stays stale'}`,async({page})=>{
  await acknowledgedSave(page);
  // No storage notification reaches this tab; its next write detects the bytes.
  if(timing==='after'){await writeStorage(page,SAVE,newerEpoch);await place(page);await exact(page,newerEpoch);await sessionOnly(page);await notCompleted(page,2);}
  else{await place(page);await writeStorage(page,SAVE,newerEpoch);}
  await landed(page);
  await exact(page,newerEpoch);expect(await backups(page)).toEqual([]);
  await next(page);
  await oneBackup(page,newerEpoch);
  expect(await stored(page)).toMatchObject({state:{sourceId:2},progressEpoch:'newer-epoch',completed:timing==='after'?[3,1]:[3]});
  await completedLevel(page,3);await notCompleted(page,2);
  if(timing==='after')await completedLevel(page,1);else await notCompleted(page,1);
  await status(page,'Saved on this device');
});

for(const replacement of ['malformed','newer-epoch'])test(`a committed win survives a failed reread before ${replacement} recovery`,async({page})=>{
  await acknowledgedSave(page);await place(page);
  const raw=replacement==='malformed'?malformed:newerEpoch;
  // Replace the canonical bytes as soon as the win commits, before this tab
  // rereads them: overlapping transactions run in creation order.
  await page.evaluate(({key,raw})=>{
    const put=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(value,...rest){
      const request=put.call(this,value,...rest);
      if(this.name==='records'&&value?.key===key&&JSON.parse(value.raw).completed?.includes(1)) {
        IDBObjectStore.prototype.put=put;
        this.transaction.db.transaction('records','readwrite').objectStore('records').put({key,raw});
      }
      return request;
    };
  },{key:SAVE,raw});
  await landed(page);
  expect(await readStorage(page,SAVE)).toBe(raw);
  // A successfully reread newer epoch supersedes the committed older win.
  if(replacement==='malformed')await completedLevel(page,1);else await notCompleted(page,1);
  // Next detects the replaced bytes; the following edit deliberately recovers.
  await next(page);
  expect(await readStorage(page,SAVE)).toBe(raw);expect(await backups(page)).toEqual([]);await sessionOnly(page);
  await place(page);
  await oneBackup(page,raw);
  expect(await stored(page)).toMatchObject({state:{sourceId:2,nodes:[{op:'H'}]},
    ...replacement==='malformed'?{progressEpoch:'known-epoch',completed:[2,3,1]}:{progressEpoch:'newer-epoch',completed:[3]}});
  await status(page,'Saved on this device');
});

for(const check of ['current','replaced','unreadable'])test(`a delayed kernel rejection protects only bytes still canonical (${check})`,async({context,page})=>{
  const rejected={...JSON.parse(await rejectedSave(page)),progressEpoch:'old-epoch',completed:[2,3]},raw=JSON.stringify(rejected,null,1);
  await page.locator('#reset').click();await idle(page);await status(page,'Saved on this device');
  const replacement=JSON.stringify({...await stored(page),progressEpoch:'reset-epoch',completed:[]});
  // Another tab commits each record and notifies this one in the ordinary way.
  const other=await context.newPage();await other.goto('/about/');
  const commit=async value=>{await writeStorage(other,SAVE,value);await other.evaluate(key=>new BroadcastChannel('angouri:device:v1').postMessage({key}),SAVE);};
  await commit(raw);await completedLevel(page,2);await completedLevel(page,3);
  // Hold the background check of those bytes after the write transaction ended.
  await page.evaluate(key=>{
    const post=Worker.prototype.postMessage,get=IDBObjectStore.prototype.get;
    Worker.prototype.postMessage=function(message,...rest){
      if(!window.releaseRejection&&message.request?.action?.type==='evaluate'&&message.request.state?.nodes?.some(node=>node.op==='?')){const worker=this;window.releaseRejection=()=>post.call(worker,message,...rest);return;}
      return post.call(this,message,...rest);
    };
    IDBObjectStore.prototype.get=function(query,...rest){
      if(window.failPrimaryReads&&query===key)throw new DOMException('Fixture read failure','UnknownError');
      return get.call(this,query,...rest);
    };
  },SAVE);
  const before=(await workspace(page)).history.undo;
  await page.locator('[data-op="H"]').click();await page.waitForFunction(()=>!!window.releaseRejection);
  if(check==='replaced'){await commit(replacement);await notCompleted(page,2);await notCompleted(page,3);}
  if(check==='unreadable')await page.evaluate(()=>{window.failPrimaryReads=true;});
  await page.evaluate(()=>window.releaseRejection());await idle(page);
  await page.evaluate(()=>{window.failPrimaryReads=false;});
  expect(await workspace(page)).toMatchObject({state:{sourceId:4,nodes:[{op:'H'}]},history:{undo:before+1}});
  expect(await backups(page)).toEqual([]);
  if(check==='replaced') {
    // The delayed rejection of older bytes cannot roll back the observed reset.
    await exact(page,replacement);await notCompleted(page,2);await notCompleted(page,3);
    await status(page,'Session only · Export to keep your progress');
    // The next write checks the reset bytes and saves in their epoch.
    await page.locator('#undo').click();await idle(page);
    expect(await stored(page)).toMatchObject({state:{sourceId:4,nodes:[]},progressEpoch:'reset-epoch',completed:[]});
    expect(await backups(page)).toEqual([]);await notCompleted(page,2);await status(page,'Saved on this device');
  } else {
    await exact(page,raw);await completedLevel(page,2);await completedLevel(page,3);
    // A failed check fails only this write; the next one checks again.
    if(check==='unreadable'){await status(page,'Session only · Export to keep your progress');await page.locator('#undo').click();await idle(page);await exact(page,raw);}
    await status(page,'Saved progress kept unchanged');expect(await backups(page)).toEqual([]);
    await page.locator(check==='unreadable'?'#redo':'#undo').click();await idle(page);
    await oneBackup(page,raw);
    expect(await stored(page)).toMatchObject({state:{sourceId:4,nodes:check==='unreadable'?[{op:'H'}]:[]},progressEpoch:'old-epoch',completed:[2,3]});
  }
  await other.close();
});
