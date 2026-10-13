import {STORAGE_KEYS,readStoredJSON} from './storage-fixtures.mjs';
import {test,expect} from '@playwright/test';

const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
const playback=page=>page.evaluate(()=>window.angouri.flight);
async function ready(page) {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('/#level=3&view=flight');
  await page.waitForFunction(()=>window.angouri?.state&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
  await page.evaluate(async()=>{
    await document.fonts.ready;
    const request=requestAnimationFrame;
    window.animationFrameCalls=0;
    window.requestAnimationFrame=callback=>request(time=>{window.animationFrameCalls++;callback(time);});
  });
}
async function noIdleFrames(page) {
  // Let finite edit/focus effects settle before counting idle callbacks.
  await page.waitForTimeout(350);
  const before=await page.evaluate(()=>window.animationFrameCalls);
  await page.waitForTimeout(200);
  expect(await page.evaluate(()=>window.animationFrameCalls)).toBe(before);
}
async function solve(page) {
  for(const op of 'AH'){await page.locator(`[data-op="${op}"]`).click();await idle(page);}
}
async function startFlight(page) {
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.angouri.flight.phase==='flying'&&window.angouri.flight.position>.08);
}

test('the finite flight clock stops while idle, paused, cancelled, or skipped',async({page})=>{
  await ready(page);await noIdleFrames(page);await solve(page);await startFlight(page);
  await page.locator('#menu-open').click();const paused=await playback(page);
  expect(paused.phase).toBe('flying');await noIdleFrames(page);expect(await playback(page)).toEqual(paused);
  await page.keyboard.press('Escape');
  await page.waitForFunction(position=>window.angouri.flight.position>position+.05,paused.position);
  await page.locator('#tab-function').click();
  await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await noIdleFrames(page);
  expect((await readStoredJSON(page,STORAGE_KEYS.progress)).completed).toEqual([3]);
  await expect(page.locator('#launch')).toHaveAttribute('data-action','continue');
  await startFlight(page);await page.keyboard.press('Control+z');await idle(page);
  expect(await playback(page)).toEqual({phase:'ready',position:0});await noIdleFrames(page);
  await expect(page.locator('#launch')).toBeEnabled();
  await page.keyboard.press('Control+Shift+z');await idle(page);await startFlight(page);
  await page.locator('#menu-open').click();await page.locator('#settings-open').click();await page.locator('#motion-toggle').check();
  expect(await playback(page)).toEqual({phase:'landed',position:1});await noIdleFrames(page);
  await page.keyboard.press('Escape');await page.keyboard.press('Enter');
  expect(await playback(page)).toEqual({phase:'landed',position:1});await noIdleFrames(page);
  expect((await readStoredJSON(page,STORAGE_KEYS.progress)).completed).toEqual([3]);
});

test('visibility events pause the shared flight and resume without counting hidden time',async({page})=>{
  await ready(page);await solve(page);await startFlight(page);
  const paused=await page.evaluate(()=>{
    // Headless engines keep background tabs visible. Exercise their visibility
    // event boundary explicitly without claiming a native window-hide test.
    Object.defineProperty(document,'hidden',{configurable:true,value:true});
    document.dispatchEvent(new Event('visibilitychange'));
    return window.angouri.flight;
  });
  await noIdleFrames(page);expect(await playback(page)).toEqual(paused);
  const resumed=await page.evaluate(async()=>{
    delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));
    await new Promise(resolve=>requestAnimationFrame(resolve));
    return window.angouri.flight;
  });
  expect(resumed.phase).toBe('flying');expect(resumed.position).toBeGreaterThanOrEqual(paused.position);
  expect(resumed.position-paused.position).toBeLessThanOrEqual(50/2600+1e-8);
  await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await noIdleFrames(page);
  expect((await readStoredJSON(page,STORAGE_KEYS.progress)).completed).toEqual([3]);
});
