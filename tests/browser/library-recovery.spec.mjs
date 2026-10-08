import {test,expect} from '@playwright/test';

const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('angouri:vine:v1:seeds')));
const workspace=page=>page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,view:window.angouri.view}));
async function ready(page){await page.goto('/#level=4&view=flow');await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');}
async function library(page){await page.locator('#menu-open').click();await page.locator('#library-open').click();}
async function save(page,name){await page.locator('#seed-name').fill(name);await page.locator('#favorite-save').click();await idle(page);}

test('deleted recipes retain individual Undo through menu navigation, saving and reload',async({page})=>{
  await ready(page);await page.locator('[data-empty="1"]').click();await page.locator('[data-op="H"]').click();await idle(page);
  const before=await workspace(page);await library(page);await save(page,'First bowl');await save(page,'Second bowl');
  const original=await stored(page);
  await page.getByRole('button',{name:'Delete First bowl',exact:true}).click();
  await expect(page.getByRole('button',{name:'Undo deletion of First bowl'})).toBeFocused();
  await page.getByRole('button',{name:'Delete Second bowl',exact:true}).click();
  await expect(page.locator('[data-seed]')).toHaveCount(0);await expect(page.locator('[data-restore-seed]')).toHaveCount(2);
  expect((await stored(page)).every(seed=>seed.deletedAt)).toBe(true);expect(await workspace(page)).toEqual(before);
  await page.getByRole('button',{name:'Back to menu',exact:true}).click();await page.locator('#library-open').click();
  await expect(page.locator('[data-restore-seed]')).toHaveCount(2);
  await save(page,'New recipe');expect((await stored(page)).filter(seed=>seed.deletedAt)).toHaveLength(2);
  await page.keyboard.press('Escape');await page.reload();await page.waitForFunction(()=>window.angouri?.result);await library(page);
  await expect(page.locator('[data-restore-seed]')).toHaveCount(2);
  await page.getByRole('button',{name:'Undo deletion of First bowl'}).focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:'Open First bowl',exact:true})).toBeFocused();
  expect((await stored(page)).find(seed=>seed.name==='First bowl')).toEqual(original[0]);
  await page.getByRole('button',{name:'Undo deletion of Second bowl'}).click();
  expect((await stored(page)).find(seed=>seed.name==='Second bowl')).toEqual(original[1]);
  await expect(page.locator('.deleted-seeds')).toHaveCount(0);
  await page.getByRole('button',{name:'Open First bowl',exact:true}).click();await idle(page);
  expect(await workspace(page)).toEqual(before);
});

test('Undo preserves its recovery copy when the library is full or storage fails',async({page})=>{
  await ready(page);await library(page);await save(page,'Original');
  await page.evaluate(()=>{const key='angouri:vine:v1:seeds',seed=JSON.parse(localStorage.getItem(key))[0];localStorage.setItem(key,JSON.stringify(Array.from({length:12},(_,i)=>({...seed,name:`Recipe ${i}`}))));});
  await page.reload();await page.waitForFunction(()=>window.angouri?.result);await library(page);
  await page.setViewportSize({width:320,height:568});
  await page.getByRole('button',{name:'Delete Recipe 0',exact:true}).click();await save(page,'Replacement');
  await page.getByRole('button',{name:'Undo deletion of Recipe 0',exact:true}).click();
  await expect(page.locator('.deleted-seed-row .favorite-error')).toContainText('library is full');
  expect((await stored(page)).filter(seed=>seed.deletedAt)).toHaveLength(1);
  await page.getByRole('button',{name:'Delete Recipe 1',exact:true}).click();
  const saved=await stored(page),before=await workspace(page);
  await page.evaluate(()=>{window.nativeLibraryWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='angouri:vine:v1:seeds')throw new DOMException('Full','QuotaExceededError');return window.nativeLibraryWrite.call(this,key,value);};});
  await page.getByRole('button',{name:'Undo deletion of Recipe 0',exact:true}).focus();await page.keyboard.press('Enter');
  await expect(page.locator('.deleted-seed-row .favorite-error')).toContainText('Could not restore');
  await expect(page.getByRole('button',{name:'Undo deletion of Recipe 0',exact:true})).toBeFocused();
  expect(await stored(page)).toEqual(saved);expect(await workspace(page)).toEqual(before);
  await page.evaluate(()=>Storage.prototype.setItem=window.nativeLibraryWrite);
  await page.getByRole('button',{name:'Undo deletion of Recipe 0',exact:true}).click();
  await expect(page.getByRole('button',{name:'Open Recipe 0',exact:true})).toBeFocused();
  await expect(page.locator('.favorite-error')).toHaveCount(0);await expect(page.locator('[data-restore-seed]')).toHaveCount(1);
  expect((await stored(page)).filter(seed=>!seed.deletedAt)).toHaveLength(12);
});
