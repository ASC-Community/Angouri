import {STORAGE_KEYS,clearStorage,readStorage} from './storage-fixtures.mjs';
import {test,expect} from '@playwright/test';

const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
const snapshot=page=>page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history}));
async function ready(page,id=1) {
  await page.goto('/about/');await clearStorage(page);
  await page.goto(`/#level=${id}&view=flight`);
  await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
}
async function createCrop(page) {
  await ready(page);await page.locator('#menu-open').click();await page.locator('#nav-create').click();await idle(page);
  await page.locator('[data-crop-add]').click();await idle(page);
}
const guardedKeys=[{isComposing:true},{altKey:true},{ctrlKey:true},{metaKey:true},{shiftKey:true},{handled:true}];
async function guardedKey(input,key,options) {
  return input.evaluate((element,{key,handled,...options})=>{
    const event=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...options});
    if(handled)event.preventDefault();
    element.dispatchEvent(event);
    return {prevented:event.defaultPrevented,connected:element.isConnected};
  },{key,...options});
}

test('both crop ranges retain view, menu, throw and history shortcuts',async({page})=>{
  await createCrop(page);
  const before=await snapshot(page);
  for(const key of ['from','to']) {
    const range=page.locator(`[data-crop-range="${key}"]`);
    for(const [shortcut,view] of [['c','flow'],['x','function'],['z','flight']]) {
      await range.focus();await page.keyboard.press(shortcut);
      await expect(page.locator(`#tab-${view}`)).toHaveAttribute('aria-selected','true');
    }
    await range.focus();await page.keyboard.press('m');await expect(page.locator('#menu-dialog')).toBeVisible();
    await page.keyboard.press('Escape');await expect(page.locator('#menu-dialog')).toBeHidden();
    await range.focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
    expect(await snapshot(page)).toEqual(before);
    await range.focus();await page.keyboard.press('Control+z');await idle(page);
    await expect(page.locator('[data-crop-range]')).toHaveCount(0);
    await page.keyboard.press('Control+Shift+z');await idle(page);
    expect(await snapshot(page)).toEqual(before);
  }
});

for(const [kind,field,draft,discarded] of [['crop','from','1/2','1'],['crop','to','3','2'],['circle','radius','1','3/4']])test(`${kind} ${field} exact fields preserve drafts for composing, modified and handled Enter or Escape`,async({page})=>{
  if(kind==='crop')await createCrop(page);else await ready(page,43);
  const input=page.locator(kind==='crop'?`[data-crop-exact="${field}"]`:`[data-circle-value="${field}"]`);
  const before=await snapshot(page);
  await input.fill(draft);
  for(const key of ['Enter','Escape'])for(const options of guardedKeys) {
    expect(await guardedKey(input,key,options),`${key} ${JSON.stringify(options)}`).toEqual({prevented:!!options.handled,connected:true});
    await idle(page);expect(await snapshot(page)).toEqual(before);
    await expect(input).toHaveValue(draft);await expect(input).toBeFocused();
  }
  await input.press('Enter');await idle(page);
  const committed=await snapshot(page);
  expect(kind==='crop'?committed.state.crop[field]:committed.state.circle[field]).toBe(draft);
  expect(committed.history.undo).toBe(before.history.undo+1);
  expect(await page.evaluate(()=>window.angouri.flight.phase)).toBe('ready');
  await input.fill(discarded);await input.press('Escape');await idle(page);
  await expect(input).toHaveValue(draft);await expect(input).toBeFocused();expect(await snapshot(page)).toEqual(committed);
  // Leaving the restored field cannot commit the discarded draft later.
  await page.keyboard.press('Tab');await expect(input).not.toBeFocused();await idle(page);
  await expect(input).toHaveValue(draft);expect(await snapshot(page)).toEqual(committed);
});

test('rename keeps the draft during composing, modified and handled Escape',async({page})=>{
  await ready(page,4);await page.locator('#menu-open').click();await page.locator('#library-open').click();
  await page.locator('#seed-name').fill('Original recipe');await page.locator('#favorite-save').click();await idle(page);
  const saved=await readStorage(page,STORAGE_KEYS.seeds);
  await page.locator('[data-rename-seed="0"]').click();
  const input=page.locator('#rename-seed');await input.fill('Rename draft');
  for(const options of guardedKeys) {
    expect(await guardedKey(input,'Escape',options),JSON.stringify(options)).toEqual({prevented:!!options.handled,connected:true});
    await expect(input).toHaveValue('Rename draft');await expect(input).toBeFocused();
    await expect(page.locator('#library-dialog')).toBeVisible();
    expect(await readStorage(page,STORAGE_KEYS.seeds)).toBe(saved);
  }
  await input.press('Escape');await expect(input).toHaveCount(0);
  await expect(page.locator('#library-dialog')).toBeVisible();await expect(page.locator('[data-rename-seed="0"]')).toBeFocused();
  await expect(page.locator('.favorite-name')).toHaveText('Original recipe');
  await page.locator('[data-rename-seed="0"]').click();await input.fill('Renamed recipe');await input.press('Enter');
  await expect(page.locator('.favorite-name')).toHaveText('Renamed recipe');
});

test('circle handles show separate Space and arrow cues at desktop and compact sizes',async({page},testInfo)=>{
  for(const size of [{width:1280,height:800},{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(size);await ready(page,46);
    for(const kind of ['centre','radius']) {
      const handle=page.locator(`[data-circle-handle="${kind}"]`);await handle.focus();
      if(!await page.evaluate(()=>document.documentElement.dataset.focusModality==='keyboard'&&document.documentElement.dataset.shortcutLabels!=='hidden'))await page.keyboard.press('Shift');
      await expect(page.locator('.keyboard-focus-cue:not([hidden])')).toBeVisible();
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const cue=await handle.evaluate(element=>{
        const cue=document.querySelector('.keyboard-focus-cue:not([hidden])'),space=cue.querySelector('.keyboard-activate'),arrows=cue.querySelector('.keyboard-direction-key');
        return {space:space.getBoundingClientRect().toJSON(),arrows:arrows.getBoundingClientRect().toJSON(),handle:element.getBoundingClientRect().toJSON(),text:space.textContent};
      });
      expect(cue.text).toBe('Space');expect(cue.space.right+3).toBeLessThanOrEqual(cue.arrows.left);
      expect(cue.space.top).toBe(cue.arrows.top);
      expect(Math.abs(cue.arrows.x+cue.arrows.width/2-cue.handle.x-cue.handle.width/2)).toBeLessThan(1);
      expect(cue.space.left).toBeGreaterThanOrEqual(0);expect(cue.arrows.right).toBeLessThanOrEqual(size.width);
      const shortcuts=(await handle.getAttribute('aria-keyshortcuts')).split(' ');
      expect(shortcuts).toEqual(['Space','Escape','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Shift+ArrowLeft','Shift+ArrowRight','Shift+ArrowUp','Shift+ArrowDown']);
      await page.screenshot({path:testInfo.outputPath(`circle-cues-${size.width}-${kind}.png`)});
    }
  }
});

test('circle shortcut metadata follows the editable centre axes',async({page})=>{
  await ready(page,45);
  await expect(page.locator('[data-circle-handle="centre"]')).toHaveAttribute('aria-keyshortcuts','Space Escape ArrowUp ArrowDown Shift+ArrowUp Shift+ArrowDown');
  await expect(page.locator('[data-circle-handle="radius"]')).toHaveAttribute('aria-keyshortcuts','Space Escape ArrowLeft ArrowRight ArrowUp ArrowDown Shift+ArrowLeft Shift+ArrowRight Shift+ArrowUp Shift+ArrowDown');
});
