import {clearStorage,snapshotWithProgress} from './storage-fixtures.mjs';
import {test,expect} from '@playwright/test';

const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
async function ready(page,source) {
  await page.goto('/about/');await clearStorage(page);await page.goto(`/#level=${source}&view=flight`);
  await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
}
async function add(page,op,slot) {
  if(slot!==undefined)await page.locator(`[data-empty="${slot}"]`).click();
  await page.locator(`[data-op="${op}"]`).click();await idle(page);
}

test('empty paired-height paths explain the interval and never announce a ready throw',async({page})=>{
  await ready(page,48);await page.locator('#menu-open').click();await page.locator('#nav-create').click();await idle(page);
  await page.locator('[data-crop-add]').click();await idle(page);
  await page.locator('[data-crop-exact="to"]').fill('1');await page.locator('[data-crop-exact="to"]').press('Enter');await idle(page);
  expect(await page.evaluate(()=>window.angouri.result.relation.playback)).toEqual([]);
  await expect(page.locator('#launch')).toBeDisabled();
  await expect(page.locator('#feedback')).toContainText('No real heights in this crop. Expand or remove Crop');
  await expect(page.locator('#launch')).toHaveAttribute('title',await page.locator('#feedback').innerText());
  await expect(page.locator('#move-announcement')).toContainText('No real path to throw yet.');
  await expect(page.locator('#move-announcement')).not.toContainText('Ready to throw');
  await page.locator('[data-crop-clear]').click();await idle(page);
  await expect(page.locator('#launch')).toBeEnabled();await expect(page.locator('#move-announcement')).toContainText('Ready to throw.');
  for(const op of 'NAAAN')await add(page,op);
  expect(await page.evaluate(()=>window.angouri.result.relation.playback)).toEqual([]);
  await expect(page.locator('#launch')).toBeDisabled();
  await expect(page.locator('#feedback')).toContainText('No real heights in this interval. Make the right side zero or positive.');
  await expect(page.locator('#feedback')).not.toContainText('Crop');
  await expect(page.locator('#move-announcement')).toContainText('No real path to throw yet.');
  await page.locator('#undo').click();await idle(page);
  await expect(page.locator('#launch')).toBeEnabled();await expect(page.locator('#move-announcement')).toContainText('Ready to throw.');
});

for(const event of ['error','messageerror'])test(`a terminal worker ${event} preserves the acknowledged recipe and explains how to retry`,async({page})=>{
  await page.addInitScript(event=>{
    const post=Worker.prototype.postMessage;
    Worker.prototype.postMessage=function(message,...rest){
      if(window.failLanguageMoves&&message.request?.action?.type==='insert') {
        window.failLanguageMoves--;
        // Chromium does not run an onmessageerror attribute for a synthetic
        // dispatch, so call the installed handler as the browser would.
        const handler=this.onmessageerror;
        queueMicrotask(()=>event==='error'?this.dispatchEvent(new ErrorEvent('error',{message:'Test interruption'})):handler.call(this,new MessageEvent('messageerror')));
        return;
      }
      return post.call(this,message,...rest);
    };
  },event);
  await ready(page,3);await add(page,'A');
  const workspace=()=>snapshotWithProgress(page,()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}),'save');
  const before=await workspace();await page.evaluate(()=>window.failLanguageMoves=2);
  await add(page,'H');
  await expect(page.locator('#feedback')).toHaveText('That move could not finish. Your previous recipe is unchanged. Try the move again.');
  expect(await workspace()).toEqual(before);
  expect(await page.evaluate(()=>window.failLanguageMoves)).toBe(0);
  await add(page,'H');
  expect(await page.evaluate(()=>window.angouri.state.nodes.map(node=>node.op).join(''))).toBe('AH');
  expect(await page.evaluate(()=>window.angouri.history.undo)).toBe(before.history.undo+1);
  await expect(page.locator('#feedback')).not.toHaveClass(/error/);
});

// Saving and opening a recipe are not moves; their terminal interruptions say what stopped.
for(const event of ['error','messageerror'])test(`a terminal worker ${event} while saving or opening a recipe keeps both and never mentions a move`,async({page})=>{
  await page.addInitScript(event=>{
    const post=Worker.prototype.postMessage;
    Worker.prototype.postMessage=function(message,...rest){
      if(window.failLanguageAction?.count&&message.request?.action?.type===window.failLanguageAction.type) {
        window.failLanguageAction.count--;
        const handler=this.onmessageerror;
        queueMicrotask(()=>event==='error'?this.dispatchEvent(new ErrorEvent('error',{message:'Test interruption'})):handler.call(this,new MessageEvent('messageerror')));
        return;
      }
      return post.call(this,message,...rest);
    };
  },event);
  await ready(page,3);await add(page,'A');
  const workspace=()=>snapshotWithProgress(page,()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}),'save');
  const fail=type=>page.evaluate(type=>window.failLanguageAction={type,count:2},type);
  const failures=()=>page.evaluate(()=>window.failLanguageAction.count);
  await page.locator('#menu-open').click();await page.locator('#library-open').click();
  const before=await workspace();await fail('export');
  await page.locator('#seed-name').fill('Kept draft');await page.locator('#favorite-save').click();await idle(page);
  await expect(page.locator('#library-error')).toHaveText('The math engine stopped before this recipe was saved. It is still open here. Try saving again.');
  await expect(page.locator('#feedback')).not.toContainText('move');
  expect(await failures()).toBe(0);expect(await workspace()).toEqual(before);
  await expect(page.locator('#seed-name')).toHaveValue('Kept draft');await expect(page.locator('#favorites-list [data-seed]')).toHaveCount(0);
  await page.locator('#favorite-save').click();await idle(page);
  await expect(page.locator('#library-error')).toBeHidden();await expect(page.locator('#favorites-list [data-seed]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  // Opening the saved recipe evaluates its snapshot; the empty recipe stays.
  await page.locator('#reset').click();await idle(page);
  const empty=await workspace();await fail('evaluate');
  await page.locator('#menu-open').click();await page.locator('#library-open').click();
  await page.getByRole('button',{name:'Open Kept draft'}).click();await idle(page);
  await expect(page.locator('#feedback')).toHaveText('The math engine stopped before this could open. Your current recipe is unchanged. Try again.');
  expect(await failures()).toBe(0);expect(await workspace()).toEqual(empty);
  await page.locator('#menu-open').click();await page.locator('#library-open').click();
  // Open first rereads the library, so wait for the accepted recipe, not only idle work.
  await page.getByRole('button',{name:'Open Kept draft'}).click();
  await page.waitForFunction(()=>window.angouri.state.nodes.length>0);await idle(page);
  expect(await page.evaluate(()=>window.angouri.state.nodes.map(node=>node.op).join(''))).toBe('A');
  await expect(page.locator('#feedback')).not.toHaveClass(/error/);
});

test('step discovery findings name the full accepted chain through selection and history',async({page})=>{
  for(const [op,name] of [['F','Floor'],['C','Ceiling']]) {
    await ready(page,61);await add(page,op,0);
    await expect(page.locator('#feedback .discovery-operations')).toHaveAccessibleName(`Block 1: ${name}; then Block 2: Sine`);
    await expect(page.locator('#feedback .discovery-operation')).toHaveCount(2);
    await expect(page.locator('#feedback')).toContainText('The rounded heights feed Sine’s repeating pattern');
  }
  await ready(page,62);await add(page,'F',0);await add(page,'S',1);
  const check=async(order)=>{
    const names=order==='FSI'?'Floor; then Block 2: Sine':'Sine; then Block 2: Floor';
    await expect(page.locator('#feedback .discovery-operations')).toHaveAccessibleName(`Block 1: ${names}; then Block 3: Accumulate`);
    await expect(page.locator('#feedback .discovery-operation')).toHaveCount(3);
    await expect(page.locator('#feedback')).toContainText(order==='FSI'?'Accumulate uses those heights as slopes.':'Accumulate rises, holds or falls with their signs.');
  };
  await check('FSI');
  for(let index=0;index<2;index++) {
    await page.keyboard.press('Escape');await page.locator('.part-body').nth(index).click();await check('FSI');
  }
  await page.keyboard.press('Escape');await page.locator('.part-body').first().focus();await page.keyboard.press('ArrowRight');await idle(page);await check('SFI');
  for(let index=0;index<2;index++) {
    await page.keyboard.press('Escape');await page.locator('.part-body').nth(index).click();await check('SFI');
  }
  await page.locator('#undo').click();await idle(page);await check('FSI');
  await page.locator('#redo').click();await idle(page);await check('SFI');
});
