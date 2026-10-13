import {test,expect} from '@playwright/test';
import {readStorage,readStoredJSON,writeStoredJSON,failStorageWrites,restoreStorageWrites} from './storage-fixtures.mjs';

const progressKey='angouri:vine:v1:progress',libraryKey='angouri:vine:v1:seeds';
const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
const stored=(page,key=libraryKey)=>readStoredJSON(page,key);
const stopStorageUpdates=()=>{
  for(const type of ['storage','focus'])window.addEventListener(type,event=>event.stopImmediatePropagation());
  document.addEventListener('visibilitychange',event=>event.stopImmediatePropagation());
  Object.defineProperty(window,'BroadcastChannel',{value:undefined});
};
async function ready(page,source=4){await page.goto(`/#level=${source}&view=flight`);await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false',undefined,{polling:100});}
async function library(page){await page.locator('#menu-open').click();await page.locator('#library-open').click();}
async function save(page,name){await page.locator('#seed-name').fill(name);await page.locator('#favorite-save').click();await idle(page);}
async function resetDialog(page){await page.locator('#menu-open').click();await page.locator('#settings-open').click();await page.locator('#reset-progress-open').click();}

test('simultaneous saves and stale row actions preserve other tabs and recovery copies',async({context,page})=>{
  const other=await context.newPage();
  // Keep a truly stale display in the second tab; mutations must still read
  // fresh data in their transaction and address IDs rather than displayed indices.
  await other.addInitScript(stopStorageUpdates);
  await ready(page);await ready(other);await library(page);await library(other);
  await page.locator('#seed-name').fill('First tab');await other.locator('#seed-name').fill('Second tab');
  // Start both real form handlers together without racing the browser's one
  // keyboard/pointer focus between two pages (especially in WebKit).
  await Promise.all([page.evaluate(()=>document.querySelector('#seed-save').requestSubmit()),other.evaluate(()=>document.querySelector('#seed-save').requestSubmit())]);
  await Promise.all([idle(page),idle(other)]);
  await expect(page.locator('#seed-name')).toHaveValue('');await expect(other.locator('#seed-name')).toHaveValue('');
  expect((await stored(page)).map(seed=>seed.name).sort()).toEqual(['First tab','Second tab']);
  await other.locator('#library-dialog .close-dialog').click();await library(other);
  await other.getByRole('button',{name:'Rename Second tab',exact:true}).click();await other.locator('#rename-seed').fill('Second renamed');
  await page.getByRole('button',{name:'Delete First tab',exact:true}).click();
  await expect(page.getByRole('button',{name:'Undo deletion of First tab'})).toBeVisible();
  const removed=(await stored(page)).find(seed=>seed.deletedAt);
  await other.getByRole('button',{name:'Save name',exact:true}).click();
  await expect(other.getByRole('button',{name:'Open Second renamed',exact:true})).toBeVisible();
  expect((await stored(page)).find(seed=>seed.deletedAt)).toEqual(removed);
  await other.locator('#seed-name').fill('Third recipe');
  await Promise.all([other.evaluate(()=>document.querySelector('#seed-save').requestSubmit()),page.evaluate(id=>document.querySelector(`[data-library-id="${id}"] [data-restore-seed]`).click(),removed.id)]);
  await idle(page);await idle(other);
  await expect(page.locator('#library-status')).toHaveText('First tab restored.');
  await expect(page.getByRole('button',{name:'Open First tab',exact:true})).toBeVisible();
  expect((await stored(page)).filter(seed=>!seed.deletedAt).map(seed=>seed.name).sort()).toEqual(['First tab','Second renamed','Third recipe']);
  expect((await stored(page)).find(seed=>seed.name==='First tab').id).toBe(removed.id);
  await page.reload();await page.waitForFunction(()=>window.angouri?.result);await library(page);
  await expect(page.locator('[data-seed]')).toHaveCount(3);await expect(page.locator('[data-restore-seed]')).toHaveCount(0);
});

test('external library refresh retains a focused rename draft and its text selection',async({context,page})=>{
  await ready(page);await library(page);await save(page,'Original');
  const other=await context.newPage();await ready(other);await library(other);
  await page.getByRole('button',{name:'Rename Original',exact:true}).click();await page.locator('#rename-seed').fill('My unfinished name');
  await page.locator('#rename-seed').evaluate(input=>input.setSelectionRange(3,10));
  await save(other,'From another tab');
  await expect(page.getByRole('button',{name:'Open From another tab',exact:true})).toBeVisible();
  await expect(page.locator('#rename-seed')).toHaveValue('My unfinished name');await expect(page.locator('#rename-seed')).toBeFocused();
  expect(await page.locator('#rename-seed').evaluate(input=>[input.selectionStart,input.selectionEnd])).toEqual([3,10]);
  await other.getByRole('button',{name:'Delete Original',exact:true}).click();
  await expect(page.getByRole('button',{name:'Undo deletion of Original'})).toBeVisible();
  await expect(page.locator('#rename-seed')).toHaveValue('My unfinished name');
  await page.getByRole('button',{name:'Save name',exact:true}).click();await expect(page.locator('#rename-error')).toContainText('deleted in another tab');
  expect((await stored(page)).find(seed=>seed.name==='Original').deletedAt).toBeTruthy();
});

test('restoring the last available place during export cannot acknowledge a thirteenth save',async({page})=>{
  await ready(page);await library(page);await save(page,'Template');
  const seed=(await stored(page))[0];
  await writeStoredJSON(page,libraryKey,[...Array.from({length:11},(_,i)=>({...seed,id:`active-${i}`,name:`Recipe ${i}`})),{...seed,id:'recover',name:'Recover me',deletedAt:'2026-10-01T00:00:00.000Z',deletedIndex:0}]);
  await page.reload();await page.waitForFunction(()=>window.angouri?.result);await library(page);
  await page.evaluate(()=>{
    const post=Worker.prototype.postMessage;
    Worker.prototype.postMessage=function(message,...rest){if(message.request?.action?.type==='export'&&!window.releaseExport){window.releaseExport=()=>post.call(this,message,...rest);return;}return post.call(this,message,...rest);};
  });
  await page.locator('#seed-name').fill('Delayed thirteenth');await page.locator('#favorite-save').click();
  await page.waitForFunction(()=>window.releaseExport);
  await page.getByRole('button',{name:'Undo deletion of Recover me'}).click();
  await expect(page.getByRole('button',{name:'Open Recover me',exact:true})).toBeVisible();
  await page.evaluate(()=>window.releaseExport());await idle(page);
  await expect(page.locator('#library-error')).toContainText('library is full');await expect(page.locator('#seed-name')).toHaveValue('Delayed thirteenth');
  expect((await stored(page)).filter(seed=>!seed.deletedAt)).toHaveLength(12);
  await page.reload();await page.waitForFunction(()=>window.angouri?.result);await library(page);await expect(page.locator('[data-seed]')).toHaveCount(12);
});

test('ordinary stale-tab writes keep earned progress but never resurrect a reset',async({context,page})=>{
  const other=await context.newPage();
  await other.addInitScript(stopStorageUpdates);
  await Promise.all([ready(page,1),ready(other,1)]);
  await page.locator('[data-op="H"]').click();await idle(page);await page.locator('#launch').click();await idle(page);
  expect((await stored(page,progressKey)).completed).toEqual([1]);
  await other.locator('[data-op="H"]').click();await idle(other);
  expect((await stored(page,progressKey)).completed).toEqual([1]);
  await resetDialog(page);await page.locator('#reset-progress-confirm').click();await idle(page);
  expect((await stored(page,progressKey)).completed).toEqual([]);
  await other.locator('[data-op="H"]').click();await idle(other);
  expect((await stored(page,progressKey)).completed).toEqual([]);
  await other.locator('[data-op="H"]').click();await idle(other);await other.locator('#launch').click();await idle(other);
  expect((await stored(page,progressKey)).completed).toEqual([1]);
});

test('a failed reset preserves the live workspace and durable progress until retry succeeds',async({page})=>{
  await ready(page,1);await page.locator('[data-op="H"]').click();await idle(page);await page.locator('#launch').click();await idle(page);
  const before={raw:await readStorage(page,progressKey),...await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}))};
  await resetDialog(page);
  await failStorageWrites(page,progressKey);
  await page.locator('#reset-progress-confirm').click();await idle(page);
  await expect(page.locator('#reset-progress-dialog')).toBeVisible();await expect(page.locator('#reset-progress-error')).toContainText('unchanged');
  await expect(page.locator('#move-announcement')).not.toContainText('Puzzle progress reset');
  expect({raw:await readStorage(page,progressKey),...await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}))}).toEqual(before);
  await restoreStorageWrites(page);await page.locator('#reset-progress-confirm').click();await idle(page);
  await expect(page.locator('#reset-progress-dialog')).toBeHidden();expect((await stored(page,progressKey)).completed).toEqual([]);
  expect(await page.evaluate(()=>window.angouri.state.nodes)).toEqual([]);
});

test('one confirmed permanent deletion frees library space and keeps failed writes retryable',async({page},testInfo)=>{
  test.setTimeout(90000);
  await ready(page);await library(page);await save(page,'Recovery to remove');await save(page,'Keep active');
  await page.getByRole('button',{name:'Delete Recovery to remove',exact:true}).click();
  await expect(page.getByRole('button',{name:'Undo deletion of Recovery to remove'})).toBeVisible();
  const entries=await stored(page),recovery=entries.find(seed=>seed.deletedAt);
  recovery.padding='';recovery.padding='x'.repeat(1024*1024-128-JSON.stringify(entries).length);await writeStoredJSON(page,libraryKey,entries);
  await page.reload();await page.waitForFunction(()=>window.angouri?.result);await library(page);
  await save(page,'After freeing space');await expect(page.locator('#library-error')).toContainText('storage limit');
  const before=await stored(page),workspace=await page.evaluate(()=>window.angouri.state);
  await page.getByRole('button',{name:'Permanently delete Recovery to remove',exact:true}).click();
  await expect(page.locator('#purge-seed-cancel')).toBeFocused();await expect(page.locator('#purge-seed-description')).toContainText('Recovery to remove');
  await expect(page.locator('#purge-seed-description')).toContainText('cannot undo');
  await page.locator('#purge-seed-cancel').click();await expect(page.getByRole('button',{name:'Permanently delete Recovery to remove',exact:true})).toBeFocused();
  expect(await stored(page)).toEqual(before);
  for(const viewport of [{width:320,height:568},{width:844,height:390}]){
    await page.setViewportSize(viewport);await page.getByRole('button',{name:'Permanently delete Recovery to remove',exact:true}).click();
    await page.screenshot({path:testInfo.outputPath(`permanent-delete-${viewport.width}.png`)});
    expect(await page.locator('#purge-seed-dialog').evaluate(dialog=>dialog.scrollWidth<=dialog.clientWidth+1)).toBe(true);
    await page.locator('#purge-seed-cancel').click();
  }
  await page.getByRole('button',{name:'Permanently delete Recovery to remove',exact:true}).click();
  await failStorageWrites(page,libraryKey);
  await page.locator('#purge-seed-confirm').click();await expect(page.locator('#purge-seed-error')).toContainText('recovery copy is still available');
  expect(await stored(page)).toEqual(before);
  await restoreStorageWrites(page);await page.locator('#purge-seed-confirm').click();
  await expect(page.locator('#library-dialog')).toBeVisible();await expect(page.getByRole('button',{name:'Open Keep active',exact:true})).toBeVisible();
  expect(await stored(page)).toEqual(before.filter(seed=>!seed.deletedAt));expect(await page.evaluate(()=>window.angouri.state)).toEqual(workspace);
  await expect(page.locator('#seed-name')).toHaveValue('After freeing space');await page.locator('#favorite-save').click();await idle(page);
  await expect(page.getByRole('button',{name:'Open After freeing space',exact:true})).toBeVisible();await expect(page.locator('#library-error')).toBeHidden();
});

test('a preferences write cannot hide a failed durable progress save',async({page})=>{
  await ready(page,1);await page.locator('[data-op="H"]').click();await idle(page);
  const before=await readStorage(page,progressKey);
  await failStorageWrites(page,progressKey);
  await page.locator('[data-op="H"]').click();await idle(page);
  await expect(page.locator('#save-status')).toContainText('Session only');
  await page.locator('#menu-open').click();await page.locator('#settings-open').click();await page.locator('#motion-toggle').click();
  await expect(page.locator('#save-status')).toContainText('Session only');
  expect(await readStorage(page,progressKey)).toBe(before);
});
