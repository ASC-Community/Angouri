import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {STORAGE_KEYS,clearStorage,readStorage,writeStorage,failStorageWrites,restoreStorageWrites} from './storage-fixtures.mjs';

// Recovery UI: exact downloads of protected saved bytes and their recovery
// copies, and an explicit Start fresh after repeated temporary restore failures.
const SAVE=STORAGE_KEYS.progress,SEEDS=STORAGE_KEYS.seeds,PREF=STORAGE_KEYS.preferences,RECOVERY=`${SAVE}:recovery:`;
const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
const ready=page=>page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
const place=async(page,op='H')=>{await page.locator(`[data-op="${op}"]`).click();await idle(page);};
const hash=(page,entry)=>page.evaluate(entry=>{location.hash=entry;},entry);
const stored=async page=>JSON.parse(await readStorage(page,SAVE));
const workspace=page=>page.evaluate(()=>({state:window.angouri.state,entry:location.hash}));
const records=(page,prefix='')=>page.evaluate(prefix=>new Promise((resolve,reject)=>{
  const request=indexedDB.open('angouri:device:v1',1);
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{
    const db=request.result,read=db.transaction('records','readonly').objectStore('records').getAll(prefix?IDBKeyRange.bound(prefix,prefix+'\uffff'):undefined);
    read.onsuccess=()=>{db.close();resolve(read.result);};read.onerror=()=>{db.close();reject(read.error);};
  };
}),prefix);
const backups=page=>records(page,RECOVERY);
const keyPattern=/^angouri:vine:v1:progress:recovery:\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z:[0-9a-f-]{36}$/;
async function oneBackup(page,raw) {
  const copies=(await backups(page)).filter(copy=>keyPattern.test(copy.key));
  expect(copies).toHaveLength(1);expect(copies[0].raw).toBe(raw);
  return copies[0].key;
}
async function exact(page,raw){expect(await readStorage(page,SAVE)).toBe(raw);}
async function seed(page,raw){await page.goto('/about/');await clearStorage(page);await writeStorage(page,SAVE,raw);}
// The downloaded file's bytes, compared as UTF-8 with the stored string.
async function downloaded(page,action) {
  const [file]=await Promise.all([page.waitForEvent('download'),action()]);
  return readFile(await file.path());
}
const utf8=raw=>Buffer.from(raw,'utf8');
const escapeRegExp=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const completedLevel=(page,id)=>expect(page.locator(`#level-nav [data-level="${id}"]`)).toHaveAttribute('aria-label',/, completed$/);
const openLibrary=async page=>{await page.locator('#menu-open').click();await page.locator('#library-open').click();await expect(page.locator('#library-dialog')).toBeVisible();};
const noPageOverflow=page=>page.evaluate(()=>({x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight,scroll:[scrollX,scrollY]}));

const malformed='{"schema":1,"type":"save","note":"café ✓ 🥒",  "state":';
const future='{ "schema" : 2 ,\n  "type":"save", "title":"Ünïcode ☃", "state":{"mode":"puzzle"},  "extra":[1, 2],\n "progressEpoch":"kept-epoch","completed":[1,2] }';

for(const [name,raw] of [['malformed',malformed],['unsupported-schema',future]])test(`${name} saved work downloads its exact bytes from the notice and Save & open`,async({page})=>{
  await seed(page,raw);await page.goto('/#level=3&view=flight');await ready(page);await idle(page);
  const notice=page.locator('#feedback [data-download-saved]');
  await expect(notice).toHaveAccessibleName('Download saved work');
  expect((await downloaded(page,()=>notice.click())).equals(utf8(raw))).toBe(true);
  await exact(page,raw);expect(await backups(page)).toEqual([]);
  await openLibrary(page);
  const section=page.locator('#recovery-copies');await expect(section).toBeVisible();
  await expect(section.locator('.recovery-row')).toHaveCount(1);
  // No recipe, source or title is invented from the saved bytes.
  const row=section.locator('.recovery-row');
  await expect(row).toContainText('Saved progress that could not be openedKept unchanged on this device');
  for(const invented of ['Puzzle','Create','café','Ünïcode','Date unavailable'])await expect(row).not.toContainText(invented);
  const button=section.getByRole('button',{name:'Download saved work that could not be opened'});
  expect((await downloaded(page,()=>button.click())).equals(utf8(raw))).toBe(true);
  // Export progress remains the separate current-draft action.
  await expect(page.locator('#download-save')).toHaveAccessibleName('Export progress');
  const exported=JSON.parse((await downloaded(page,()=>page.locator('#download-save').click())).toString('utf8'));
  expect(exported).toMatchObject({schema:1,type:'save',state:{sourceId:3}});
  await exact(page,raw);expect(await backups(page)).toEqual([]);
});

test('recovery copies persist across reloads, keep truthful dates and download without changes',async({page})=>{
  await seed(page,malformed);
  await writeStorage(page,`${RECOVERY}from-an-older-version`,'old bytes ✓',{mirror:false});
  await page.goto('/#level=3&view=flight');await ready(page);await idle(page);
  await place(page,'A');const key=await oneBackup(page,malformed);
  await page.reload();await ready(page);await idle(page);
  const before=await records(page);
  await openLibrary(page);
  const rows=page.locator('#recovery-copies .recovery-row');await expect(rows).toHaveCount(2);
  const iso=key.slice(RECOVERY.length,RECOVERY.length+24);
  const local=await page.evaluate(iso=>new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso)),iso);
  await expect(rows.nth(0).locator('time')).toHaveAttribute('datetime',iso);
  await expect(rows.nth(0)).toContainText(new RegExp(`^Recovery copy [2-9A-Z]{5}${escapeRegExp(local)}`));
  await expect(rows.nth(1)).toContainText(/^Recovery copy [2-9A-Z]{5}Date unavailable/);
  const current=rows.nth(0).getByRole('button',{name:new RegExp(`^Download recovery copy [2-9A-Z]{5} from ${escapeRegExp(local)}$`)});
  const older=rows.nth(1).getByRole('button',{name:/^Download recovery copy [2-9A-Z]{5}, date unavailable$/});
  expect((await downloaded(page,()=>current.click())).equals(utf8(malformed))).toBe(true);
  expect((await downloaded(page,()=>older.click())).equals(utf8('old bytes ✓'))).toBe(true);
  // The candidate is archived; only the immutable copies remain listed.
  await expect(page.getByRole('button',{name:'Download saved work that could not be opened'})).toHaveCount(0);
  await idle(page);expect(await records(page)).toEqual(before);
  expect(await workspace(page)).toMatchObject({state:{sourceId:3,nodes:[{op:'A'}]}});
});

test('copies from the same minute and copies without dates keep distinct names and exact downloads',async({page})=>{
  await page.goto('/about/');await clearStorage(page);
  const copies={
    [`${RECOVERY}2026-03-04T05:06:07.000Z:11111111-1111-4111-8111-111111111111`]:'first same-minute ✓',
    [`${RECOVERY}2026-03-04T05:06:41.250Z:22222222-2222-4222-8222-222222222222`]:'second same-minute 🥒',
    [`${RECOVERY}from-an-older-version`]:'undated one',
    [`${RECOVERY}legacy-copy`]:'undated two ☃'
  };
  for(const [key,raw] of Object.entries(copies))await writeStorage(page,key,raw,{mirror:false});
  await page.goto('/#level=3&view=flight');await ready(page);await idle(page);
  const before=await records(page);
  const names=async()=>{
    const named={};
    for(const row of await page.locator('#recovery-copies .recovery-row').all())
      named[await row.getAttribute('data-recovery-key')]={text:await row.innerText(),name:await row.locator('[data-download-recovery]').evaluate(button=>button.getAttribute('aria-label'))};
    return named;
  };
  await openLibrary(page);await expect(page.locator('#recovery-copies .recovery-row')).toHaveCount(4);
  const named=await names();
  expect(Object.keys(named).sort()).toEqual(Object.keys(copies).sort());
  const labels=Object.values(named).map(row=>row.name);
  expect(new Set(labels).size).toBe(4);
  const minute=await page.evaluate(()=>new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date('2026-03-04T05:06:07.000Z')));
  for(const [key,{text,name}] of Object.entries(named)) {
    const code=/^Recovery copy ([2-9A-Z]{5})\n/.exec(text)?.[1];expect(code,text).toBeTruthy();
    // The visible code names the same copy as its action; the date stays truthful.
    expect(name).toBe(key.includes('2026-')?`Download recovery copy ${code} from ${minute}`:`Download recovery copy ${code}, date unavailable`);
    expect(text).toContain(key.includes('2026-')?minute:'Date unavailable');
    for(const invented of ['Puzzle','Create','same-minute','undated'])expect(text).not.toContain(invented);
  }
  for(const [key,{name}] of Object.entries(named)) {
    const file=await downloaded(page,()=>page.getByRole('button',{name,exact:true}).click());
    expect(file.equals(utf8(copies[key])),key).toBe(true);
  }
  // Names belong to each copy, not its position: a newer copy leaves them unchanged.
  await page.keyboard.press('Escape');
  await writeStorage(page,`${RECOVERY}2026-03-04T05:06:59.000Z:33333333-3333-4333-8333-333333333333`,'newest',{mirror:false});
  await openLibrary(page);await expect(page.locator('#recovery-copies .recovery-row')).toHaveCount(5);
  const later=await names();
  for(const key of Object.keys(copies))expect(later[key]).toEqual(named[key]);
  expect(new Set(Object.values(later).map(row=>row.name)).size).toBe(5);
  for(const [key,raw] of Object.entries(copies))expect((await records(page,key))[0].raw).toBe(raw);
  expect((await records(page)).filter(record=>!record.key.endsWith('33333333-3333-4333-8333-333333333333'))).toEqual(before);
});

// URL.createObjectURL throws once; window.restoreObjectURLs restores it early.
const failObjectURLOnce=page=>page.evaluate(()=>{
  const create=URL.createObjectURL;window.restoreObjectURLs=()=>{URL.createObjectURL=create;};
  URL.createObjectURL=()=>{window.restoreObjectURLs();throw new DOMException('Fixture download failure','NotAllowedError');};
});

test('a failed notice download keeps its focused retry until the exact saved work downloads',async({page})=>{
  await seed(page,malformed);await page.goto('/#level=3&view=flight');await ready(page);await idle(page);
  const notice=page.locator('#feedback [data-download-saved]');
  await expect(page.locator('#feedback')).toHaveText('Saved work could not open. It stays unchanged.Download saved work');
  await failObjectURLOnce(page);
  await notice.focus();await page.keyboard.press('Space');
  await expect(page.locator('#feedback')).toHaveText('Download failed. Try again. Saved work is unchanged.Download saved work');
  await expect(notice).toHaveAccessibleName('Download saved work');await expect(notice).toBeFocused();
  await exact(page,malformed);expect(await backups(page)).toEqual([]);
  await page.evaluate(()=>window.restoreObjectURLs());
  expect((await downloaded(page,()=>page.keyboard.press('Space'))).equals(utf8(malformed))).toBe(true);
  await expect(notice).toBeFocused();
  await exact(page,malformed);expect(await backups(page)).toEqual([]);
  // The Save & open row also keeps its action through a failure, and explains the next change.
  await openLibrary(page);
  const row=page.locator('#recovery-copies .recovery-row');
  await expect(row).toContainText('Kept unchanged on this device. Your next change keeps a recovery copy of it here, then saves your new recipe.');
  const button=row.getByRole('button',{name:'Download saved work that could not be opened'});
  await failObjectURLOnce(page);await button.focus();await page.keyboard.press('Enter');
  await expect(row.locator('.favorite-error')).toHaveText('Could not download this copy. It is still kept on this device. Try again.');
  await expect(button).toBeFocused();
  expect((await downloaded(page,()=>page.keyboard.press('Enter'))).equals(utf8(malformed))).toBe(true);
  await exact(page,malformed);expect(await backups(page)).toEqual([]);
});

// Delivers recovery-list reads (the only readonly app transactions) on release.
const holdLists=page=>page.evaluate(()=>{
  const transaction=IDBDatabase.prototype.transaction;window.heldLists=[];window.holdingLists=true;
  IDBDatabase.prototype.transaction=function(names,mode,...rest){
    const created=transaction.call(this,names,mode,...rest);
    if(mode==='readonly'&&window.holdingLists) {
      let handler;
      Object.defineProperty(created,'oncomplete',{configurable:true,get:()=>handler,set:value=>{handler=value;}});
      created.addEventListener('complete',event=>window.heldLists.push(()=>handler?.call(created,event)));
    }
    return created;
  };
});
const heldList=page=>page.waitForFunction(()=>window.heldLists.length>0);
const releaseLists=page=>page.evaluate(()=>{window.holdingLists=false;for(const release of window.heldLists.splice(0))release();});

test('a held recovery list keeps drafts and focus, and cannot reopen a closed dialog',async({page})=>{
  await seed(page,malformed);await page.goto('/#level=3&view=flight');await ready(page);await idle(page);
  await place(page,'A');await oneBackup(page,malformed);
  await holdLists(page);await openLibrary(page);await heldList(page);
  await page.locator('#seed-name').fill('Draft name');await page.locator('#seed-name').press('ArrowLeft');
  await releaseLists(page);
  await expect(page.locator('#recovery-copies .recovery-row')).toHaveCount(1);
  await expect(page.locator('#seed-name')).toBeFocused();await expect(page.locator('#seed-name')).toHaveValue('Draft name');
  expect(await page.locator('#seed-name').evaluate(input=>[input.selectionStart,input.selectionEnd])).toEqual([9,9]);
  // Keyboard reaches the copy's Download control; a refresh keeps it focused.
  const download=page.locator('#recovery-copies [data-download-recovery]');
  for(let step=0;step<12&&!await download.evaluate(element=>element===document.activeElement);step++)await page.keyboard.press('Tab');
  await expect(download).toBeFocused();
  await page.evaluate(()=>{window.holdingLists=true;window.dispatchEvent(new Event('focus'));});await heldList(page);
  await releaseLists(page);await idle(page);
  await expect(download).toBeFocused();await expect(page.locator('#seed-name')).toHaveValue('Draft name');
  // A list completing after Close paints nothing visible and reopens nothing.
  await page.evaluate(()=>{window.holdingLists=true;window.dispatchEvent(new Event('focus'));});await heldList(page);
  await page.keyboard.press('Escape');await expect(page.locator('#library-dialog')).toBeHidden();
  await releaseLists(page);await idle(page);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});

test('a failed recovery list stays actionable and never hides known saved work',async({page})=>{
  await seed(page,malformed);await page.goto('/#level=3&view=flight');await ready(page);await idle(page);
  await page.evaluate(()=>{
    const getAll=IDBObjectStore.prototype.getAll;window.restoreLists=()=>{IDBObjectStore.prototype.getAll=getAll;};
    IDBObjectStore.prototype.getAll=function(){throw new DOMException('Fixture list failure','UnknownError');};
  });
  await openLibrary(page);
  await expect(page.locator('#recovery-copies')).toContainText('Recovery copies could not be read. Your saved work is unchanged on this device.');
  await expect(page.getByRole('button',{name:'Download saved work that could not be opened'})).toBeVisible();
  const retry=page.getByRole('button',{name:'Try reading recovery copies again'});
  await retry.focus();await retry.press('Enter');
  await expect(retry).toBeFocused();
  await page.evaluate(()=>window.restoreLists());await retry.press('Enter');
  await expect(page.locator('#recovery-copies .reset-progress-error')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Download saved work that could not be opened'})).toBeFocused();
  await exact(page,malformed);expect(await backups(page)).toEqual([]);
});

// A healthy saved Puzzle 4 workspace whose restore fails temporarily until
// allowRestore is set in this tab.
async function savedPuzzle(page) {
  await page.goto('/about/');await clearStorage(page);
  await page.goto('/#level=4&view=flight');await ready(page);await place(page);
  const save={...await stored(page),progressEpoch:'kept-epoch',completed:[2,3]};
  return JSON.stringify(save);
}
const failRestores=page=>page.addInitScript(()=>{
  const post=Worker.prototype.postMessage;
  Worker.prototype.postMessage=function(message,...rest){
    const action=message.request?.action,source=message.request?.state?.sourceId;
    if(!sessionStorage.getItem('allowRestore')&&action?.type==='evaluate'&&source===4) {
      this.dispatchEvent(new MessageEvent('message',{data:{type:'result',id:message.id,milliseconds:0,response:{status:'error',message:'Temporary engine failure'}}}));return;
    }
    if(window.failFresh&&action?.type==='level'&&action.sourceId===1) {
      this.dispatchEvent(new MessageEvent('message',{data:{type:'result',id:message.id,milliseconds:0,response:{status:'error',message:'Temporary engine failure'}}}));return;
    }
    if(window.holdFresh&&action?.type==='level'&&action.sourceId===1) {
      window.holdFresh=false;const worker=this;window.releaseFresh=()=>post.call(worker,message,...rest);return;
    }
    return post.call(this,message,...rest);
  };
});
const retry=async page=>{await page.locator('#retry-engine').click();await expect(page.locator('#retry-engine')).toBeVisible();await page.evaluate(()=>window.angouri.whenIdle());};
// Two failed restores of the same bytes, ready for Start fresh.
async function failedTwice(page,raw) {
  await page.goto('/about/');await writeStorage(page,SAVE,raw);await failRestores(page);
  await page.goto('/#level=4&view=flight');await expect(page.locator('#retry-engine')).toBeVisible();
  await expect(page.locator('#start-fresh')).toHaveCount(0);
  await retry(page);await expect(page.locator('#start-fresh')).toBeVisible();
}

test('Start fresh appears after two failures of the same saved work and resets with a new candidate',async({page})=>{
  const raw=await savedPuzzle(page);await page.goto('/about/');await writeStorage(page,SAVE,raw);await failRestores(page);
  await page.goto('/#level=4&view=flight');await expect(page.locator('#retry-engine')).toBeVisible();
  await expect(page.locator('#download-saved-work')).toHaveAccessibleName('Download saved work');
  await expect(page.getByRole('button',{name:'Download saved work'})).toHaveCount(1);
  await expect(page.locator('#start-fresh')).toHaveCount(0);
  expect((await downloaded(page,()=>page.locator('#download-saved-work').click())).equals(utf8(raw))).toBe(true);
  // A failed download keeps the same focused action for a retry.
  await failObjectURLOnce(page);await page.locator('#download-saved-work').focus();await page.keyboard.press('Space');
  await expect(page.locator('#startup-action-error')).toHaveText('Download failed. Try again. Saved work is unchanged.');
  await expect(page.locator('#download-saved-work')).toBeFocused();
  expect((await downloaded(page,()=>page.keyboard.press('Space'))).equals(utf8(raw))).toBe(true);
  await exact(page,raw);expect(await backups(page)).toEqual([]);
  await retry(page);
  await expect(page.locator('#start-fresh')).toBeVisible();
  await expect(page.locator('#start-fresh-note')).toHaveText('Start fresh opens Puzzle 1 and keeps a recovery copy of this saved work in Save & open. Completed puzzles stay complete.');
  await expect(page.locator('#retry-engine')).toBeVisible();await expect(page.locator('#download-saved-work')).toBeVisible();
  // Different canonical bytes are a different candidate with their own count.
  const changed=JSON.stringify(JSON.parse(raw),null,1);await writeStorage(page,SAVE,changed);
  await retry(page);await expect(page.locator('#start-fresh')).toHaveCount(0);
  await retry(page);await expect(page.locator('#start-fresh')).toBeVisible();
  await exact(page,changed);expect(await backups(page)).toEqual([]);
  expect(new URL(page.url()).hash).toBe('#level=4&view=flight');
  // A successful restore clears the candidate; nothing was archived.
  await page.evaluate(()=>sessionStorage.setItem('allowRestore','true'));await page.locator('#retry-engine').click();
  await page.waitForFunction(()=>window.angouri?.state?.nodes.length===1);await ready(page);await idle(page);
  await expect(page.locator('#start-fresh')).toHaveCount(0);
  await exact(page,changed);expect(await backups(page)).toEqual([]);
});

test('keyboard Start fresh archives and replaces the same bytes, keeping completions, library and preferences',async({page})=>{
  const raw=await savedPuzzle(page);
  const library='[{"id":"kept","name":"Kept recipe","artifact":{"type":"creation"},"savedAt":"2026-01-02T03:04:05.000Z"}]',preferences='{"view":"function","characterShortcuts":false}';
  await writeStorage(page,SEEDS,library);await page.evaluate(([key,value])=>localStorage.setItem(key,value),[PREF,preferences]);
  await failedTwice(page,raw);
  // Keyboard reaches every recovery control in the failure scene.
  const reached=[];
  await page.locator('body').focus();
  for(let step=0;step<14;step++){await page.keyboard.press('Tab');reached.push(await page.evaluate(()=>document.activeElement?.id));}
  for(const id of ['retry-engine','download-saved-work','start-fresh'])expect(reached).toContain(id);
  await page.locator('#start-fresh').focus();await page.keyboard.press('Space');
  await page.waitForFunction(()=>window.angouri?.state?.sourceId===1);await ready(page);await idle(page);
  expect(await workspace(page)).toMatchObject({state:{sourceId:1,nodes:[]},entry:''});
  expect(await page.evaluate(()=>window.angouri.view)).toBe('function');
  await expect(page.locator('#construction .part-body,#construction .empty-slot,#palette [data-op]').first()).toBeAttached();
  expect(await page.evaluate(()=>!!document.activeElement?.closest('#construction,#palette,.view-tabs'))).toBe(true);
  const key=await oneBackup(page,raw);
  expect(await stored(page)).toMatchObject({state:{sourceId:1,nodes:[]},entry:'',view:'function',progressEpoch:'kept-epoch',completed:[2,3]});
  expect(await readStorage(page,SEEDS)).toBe(library);
  expect(await page.evaluate(key=>localStorage.getItem(key),PREF)).toBe(preferences);
  await page.locator('#menu-open').click();await expect(page.locator('#save-status')).toContainText('Saved on this device');
  await page.locator('#puzzles-open').click();await completedLevel(page,2);await completedLevel(page,3);await page.keyboard.press('Escape');
  // The fresh workspace reloads ordinarily; its recovery copy stays listed.
  await page.reload();await ready(page);await idle(page);
  expect(await workspace(page)).toMatchObject({state:{sourceId:1,nodes:[]},entry:''});
  expect(await oneBackup(page,raw)).toBe(key);
  await openLibrary(page);await expect(page.locator('#recovery-copies .recovery-row')).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Download saved work that could not be opened'})).toHaveCount(0);
});

test('a failed Start fresh keeps the original, the failure and its recovery controls',async({page})=>{
  const raw=await savedPuzzle(page);await failedTwice(page,raw);
  await page.evaluate(()=>{window.failFresh=true;});
  await page.locator('#start-fresh').click();
  await expect(page.locator('#startup-action-error')).toHaveText('Puzzle 1 could not be prepared. Your saved work is unchanged on this device. Try again, download it, or start fresh again.');
  await exact(page,raw);expect(await backups(page)).toEqual([]);
  await page.evaluate(()=>{window.failFresh=false;});
  await failStorageWrites(page,SAVE);
  await page.locator('#start-fresh').click();
  await expect(page.locator('#startup-action-error')).toHaveText('Could not start fresh on this device. Your saved work is unchanged on this device. Try again, download it, or start fresh again.');
  await restoreStorageWrites(page);
  for(const id of ['retry-engine','download-saved-work','start-fresh'])await expect(page.locator(`#${id}`)).toBeVisible();
  await expect(page.locator('#start-fresh')).not.toHaveAttribute('aria-disabled');
  await exact(page,raw);expect(await backups(page)).toEqual([]);
  expect(await page.evaluate(()=>window.angouri.state)).toBeUndefined();
  expect(new URL(page.url()).hash).toBe('#level=4&view=flight');
  await page.locator('#start-fresh').click();
  await page.waitForFunction(()=>window.angouri?.state?.sourceId===1);await ready(page);await idle(page);
  await oneBackup(page,raw);
  expect(await stored(page)).toMatchObject({state:{sourceId:1},progressEpoch:'kept-epoch',completed:[2,3]});
});

test('a newer link before the Start fresh commit opens its own draft and keeps the original',async({page})=>{
  const raw=await savedPuzzle(page);await failedTwice(page,raw);
  await page.evaluate(()=>{window.holdFresh=true;});
  await page.locator('#start-fresh').click();await page.waitForFunction(()=>!!window.releaseFresh);
  await hash(page,'#level=3&view=flight');await page.evaluate(()=>window.releaseFresh());
  await page.waitForFunction(()=>window.angouri?.state?.sourceId===3);await ready(page);await idle(page);
  expect(await workspace(page)).toMatchObject({state:{sourceId:3,nodes:[]},entry:'#level=3&view=flight'});
  await expect(page.locator('#feedback [data-download-saved]')).toBeVisible();
  await exact(page,raw);expect(await backups(page)).toEqual([]);
});

// Holds the first progress transaction open after its write until released.
const holdWrite=page=>page.evaluate(key=>{
  const put=IDBObjectStore.prototype.put;window.held=[];
  IDBObjectStore.prototype.put=function(value,...rest){
    const request=put.call(this,value,...rest);
    if(this.name==='records'&&value?.key===key&&!window.held.length) {
      const store=this;let next='hold';window.held.push(action=>{next=action;});
      const keepAlive=()=>{store.get(key).onsuccess=()=>{if(next==='abort')store.transaction.abort();else if(next==='hold')keepAlive();};};
      keepAlive();
    }
    return request;
  };
},SAVE);

test('a Start fresh commit stays durable when a newer link owns the page',async({page})=>{
  const raw=await savedPuzzle(page);await failedTwice(page,raw);
  await holdWrite(page);
  await page.locator('#start-fresh').click();await page.waitForFunction(()=>window.held.length===1);
  await hash(page,'#level=3&view=flight');await page.evaluate(()=>window.held[0]('commit'));
  await page.waitForFunction(()=>window.angouri?.state?.sourceId===3);await ready(page);await idle(page);
  // Puzzle 1 never replaced the newer link's workspace or URL.
  expect(await workspace(page)).toMatchObject({state:{sourceId:3,nodes:[]},entry:'#level=3&view=flight'});
  await oneBackup(page,raw);
  expect(await stored(page)).toMatchObject({state:{sourceId:3},entry:'#level=3&view=flight',progressEpoch:'kept-epoch',completed:[2,3]});
});

test('double activation archives once and an open menu stays open',async({page})=>{
  const raw=await savedPuzzle(page);await failedTwice(page,raw);
  await page.evaluate(()=>{window.holdFresh=true;});
  await page.evaluate(()=>{const button=document.getElementById('start-fresh');button.click();button.click();});
  await page.waitForFunction(()=>!!window.releaseFresh);
  await page.locator('#menu-open').click();await page.locator('#settings-open').click();
  await page.locator('#start-fresh').evaluate(button=>button.click()).catch(()=>{});
  await page.evaluate(()=>window.releaseFresh());
  await page.waitForFunction(()=>window.angouri?.state?.sourceId===1);await ready(page);await idle(page);
  await expect(page.locator('#settings-dialog')).toBeVisible();
  await oneBackup(page,raw);
  expect(await stored(page)).toMatchObject({state:{sourceId:1},entry:'',progressEpoch:'kept-epoch',completed:[2,3]});
});

for(const size of [{width:320,height:568},{width:844,height:390}])test(`recovery controls fit ${size.width}×${size.height} without page scrolling`,async({page})=>{
  await page.setViewportSize(size);
  const raw=await savedPuzzle(page);await failedTwice(page,raw);
  expect(await noPageOverflow(page)).toEqual({x:0,y:0,scroll:[0,0]});
  for(const id of ['retry-engine','download-saved-work','start-fresh','start-fresh-note']) {
    const control=page.locator(`#${id}`);await control.scrollIntoViewIfNeeded();
    const box=await control.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(size.width);
    expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(size.height);
  }
  expect(await noPageOverflow(page)).toEqual({x:0,y:0,scroll:[0,0]});
  await page.locator('#start-fresh').click();
  await page.waitForFunction(()=>window.angouri?.state?.sourceId===1);await ready(page);await idle(page);
  await writeStorage(page,`${RECOVERY}from-an-older-version`,'old',{mirror:false});
  await openLibrary(page);await expect(page.locator('#recovery-copies .recovery-row')).toHaveCount(2);
  const top=page.locator('#library-dialog .dialog-top');
  for(const button of await page.locator('#recovery-copies [data-download-recovery]').all()) {
    await button.scrollIntoViewIfNeeded();
    const box=await button.boundingBox(),header=await top.boundingBox(),dialog=await page.locator('#library-dialog').boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(header.y+header.height);expect(box.y+box.height).toBeLessThanOrEqual(dialog.y+dialog.height);
    expect(box.x).toBeGreaterThanOrEqual(dialog.x);expect(box.x+box.width).toBeLessThanOrEqual(dialog.x+dialog.width);
  }
  await expect(page.locator('#library-dialog [data-back="library-open"]')).toBeInViewport();
  await expect(page.locator('#library-dialog .close-dialog')).toBeInViewport();
  expect(await noPageOverflow(page)).toEqual({x:0,y:0,scroll:[0,0]});
});

// The protected notice is a bounded footer row: the recipe's own scroller still
// reveals each complete slot and block face with room for its focus ring.
for(const size of [{width:320,height:568},{width:844,height:390}])test(`the protected notice leaves the recipe usable at ${size.width}×${size.height}`,async({page})=>{
  await page.setViewportSize(size);
  await seed(page,malformed);await page.goto('/#level=3&view=flight');await ready(page);await idle(page);
  const check=async()=>{
    expect(await noPageOverflow(page)).toEqual({x:0,y:0,scroll:[0,0]});
    const layout=await page.evaluate(()=>{
      const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};};
      const body=document.querySelector('.recipe-content'),inner=body.getBoundingClientRect(),revealed=[];
      for(const control of document.querySelectorAll('#construction .insert-slot,#construction .recipe-part,#palette .ingredient-stack')) {
        control.scrollIntoView({block:'nearest',inline:'nearest'});const r=control.getBoundingClientRect();
        revealed.push([r.top-inner.top,inner.bottom-r.bottom,r.left-inner.left,inner.right-r.right]);
      }
      body.scrollTop=0;body.scrollLeft=0;
      return {body:box('.recipe-content'),feedback:box('#feedback'),status:box('#feedback>span'),download:box('[data-download-saved]'),launch:box('#launch'),dock:box('.play-dock'),revealed};
    });
    const {body,feedback,status,download,launch,dock,revealed}=layout;
    // Nothing paints over the body; the footer row stays inside the dock.
    expect(feedback.top).toBeGreaterThanOrEqual(body.bottom-0.5);expect(launch.top).toBeGreaterThanOrEqual(body.bottom-0.5);
    expect(revealed.length).toBeGreaterThan(2);
    for(const [top,bottom,left,right] of revealed){expect(Math.min(top,bottom)).toBeGreaterThanOrEqual(6);expect(Math.min(left,right)).toBeGreaterThanOrEqual(0);}
    // Download keeps a complete ring and its Space cue clear of the status text.
    expect(download.top-status.bottom).toBeGreaterThanOrEqual(8);
    expect(download.left).toBeGreaterThanOrEqual(feedback.left);expect(download.right).toBeLessThanOrEqual(feedback.right);
    expect(download.left-7).toBeGreaterThanOrEqual(dock.left);expect(download.bottom+7).toBeLessThanOrEqual(dock.bottom);
    expect(download.right).toBeLessThanOrEqual(launch.left);
    return layout;
  };
  const initial=await check();
  await failObjectURLOnce(page);await page.locator('#feedback [data-download-saved]').focus();await page.keyboard.press('Space');
  await expect(page.locator('#feedback')).toContainText('Download failed.');
  await expect(page.locator('#feedback [data-download-saved]')).toBeFocused();
  const failed=await check();
  // The retry state keeps the same frame and Throw position.
  expect(failed.launch).toEqual(initial.launch);expect(failed.body).toEqual(initial.body);
  await exact(page,malformed);expect(await backups(page)).toEqual([]);
});
