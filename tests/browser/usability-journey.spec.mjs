import {test,expect} from '@playwright/test';
import {STORAGE_KEYS,readStoredJSON,writeStoredJSON} from './storage-fixtures.mjs';

const progressKey=STORAGE_KEYS.progress;
const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
const loaded=page=>page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
async function ready(page,source=1) {await page.goto(`/#level=${source}&view=flight`);await loaded(page);}
async function choose(page,op) {await page.locator(`[data-op="${op}"]`).click();await idle(page);}
async function throwIt(page) {await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await idle(page);}
const snapshot=page=>page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history,flight:window.angouri.flight}));
const completed=async page=>(await readStoredJSON(page,progressKey)).completed;
async function puzzles(page) {await page.locator('#menu-open').click();await page.locator('#puzzles-open').click();}

test('reselecting the current puzzle returns to the unchanged recipe and history',async({page})=>{
  await ready(page,3);
  await page.locator('[data-empty="1"]').click();await choose(page,'H');
  await page.locator('[data-empty="0"]').click();await choose(page,'A');
  await page.locator('#undo').click();await idle(page);await throwIt(page);
  await expect(page.locator('#feedback')).toContainText('Heights halve.');
  const before=await snapshot(page);
  expect(before.history.redo).toBe(1);expect(before.slots[0]).toBeNull();expect(before.flight.phase).toBe('landed');
  await puzzles(page);await page.locator('[data-level="3"]').click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('[data-empty="0"]')).toBeFocused();
  expect(await snapshot(page)).toEqual(before);

  // Saving the current recipe must not turn the same row into an unguarded restart.
  await page.locator('#menu-open').click();await page.locator('#library-open').click();
  await page.locator('#seed-name').fill('Keep this ordering');await page.locator('#favorite-save').click();await idle(page);
  await expect(page.locator('#library-dialog .muted')).toHaveText('Export progress copies your current recipe and puzzle completions. Named saved recipes, including Recently deleted, stay on this device.');
  await page.keyboard.press('Escape');await puzzles(page);await page.locator('[data-level="3"]').click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);expect(await snapshot(page)).toEqual(before);

  await page.locator('#redo').click();await idle(page);
  const edited=await snapshot(page);
  await puzzles(page);await page.locator('[data-level="24"]').click();
  await expect(page.locator('#leave-dialog')).toBeVisible();
  await page.locator('#leave-cancel').click();expect(await snapshot(page)).toEqual(edited);
});

test('an introductory miss asks for another choice and the next edit restores its finding',async({page},testInfo)=>{
  await page.setViewportSize({width:320,height:568});await ready(page);await choose(page,'A');
  await expect(page.locator('#feedback')).toContainText('Every height rises equally');
  await throwIt(page);
  await expect(page.locator('#feedback')).toHaveText('Pick another block and try again.');
  await expect(page.locator('[data-target-kind="target"][data-status="miss"]')).toHaveCount(3);
  await expect(page.locator('#launch')).toHaveAccessibleName('Throw again');
  await page.screenshot({path:testInfo.outputPath('first-miss-guidance.png')});
  await page.locator('[data-op="H"]').focus();await page.keyboard.press('Space');await idle(page);
  await expect(page.locator('#feedback')).toContainText('Heights halve.');
  await expect(page.locator('#feedback')).not.toContainText('try again');
  await expect(page.locator('[data-op="H"]')).toBeFocused();
  await expect(page.locator('#launch')).toHaveAccessibleName('Throw');
  expect(await completed(page)).toEqual([]);
});

test('reload keeps a confirmed successful throw and its Next and Rethrow actions',async({page})=>{
  await ready(page);await choose(page,'H');await throwIt(page);
  const before=await snapshot(page);
  await page.reload();await loaded(page);
  await expect(page.locator('#launch')).toHaveAccessibleName('Next puzzle');
  await expect(page.locator('#rethrow')).toBeVisible();
  await expect(page.locator('[data-target-kind="target"][data-status="hit"]')).toHaveCount(3);
  const restored=await snapshot(page);
  expect(restored.state).toEqual(before.state);expect(restored.slots).toEqual(before.slots);
  expect(restored.flight).toEqual({phase:'landed',position:1});expect(await completed(page)).toEqual([1]);
  await page.locator('#launch').click();await idle(page);
  expect((await snapshot(page)).state.sourceId).toBe(2);
});

test('reload requires Throw for a green preview, including an edited previously completed puzzle',async({page})=>{
  await ready(page);await choose(page,'H');
  await page.reload();await loaded(page);
  expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);
  await expect(page.locator('#launch')).toHaveAccessibleName('Throw');
  await expect(page.locator('#rethrow')).toBeHidden();expect(await completed(page)).toEqual([]);
  await throwIt(page);await choose(page,'A');await choose(page,'H');
  await page.reload();await loaded(page);
  expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);
  await expect(page.locator('#launch')).toHaveAccessibleName('Throw');
  await expect(page.locator('#rethrow')).toBeHidden();
  await expect(page.locator('[data-target-kind="target"][data-status="waiting"]')).toHaveCount(3);
  expect(await completed(page)).toEqual([1]);
});

test('resume validates the saved confirmation against completion and the exact current result',async({page})=>{
  await ready(page);await choose(page,'H');await throwIt(page);
  const confirmed=await readStoredJSON(page,progressKey);
  for(const variant of ['legacy','uncompleted','changed']) {
    const saved=structuredClone(confirmed);
    if(variant==='legacy')delete saved.confirmed;
    if(variant==='uncompleted')saved.completed=[];
    if(variant==='changed')saved.state.nodes[0].op='A';
    await writeStoredJSON(page,progressKey,saved);
    await page.reload();await loaded(page);
    await expect(page.locator('#launch')).toHaveAccessibleName('Throw');
    await expect(page.locator('#rethrow')).toBeHidden();
    await expect(page.locator('[data-target-kind="target"][data-status="waiting"]')).toHaveCount(3);
    expect(await completed(page)).toEqual(variant==='uncompleted'?[]:[1]);
  }
});

test('resuming a confirmed picture keeps Next without replaying its garden reward',async({page})=>{
  await ready(page,82);await choose(page,'H');await throwIt(page);
  await expect(page.locator('#garden-dialog')).toBeVisible();
  await expect(page.locator('#garden-back')).toHaveAccessibleName('Back to game');
  await expect(page.locator('[data-garden-done]')).toBeEnabled();await page.locator('[data-garden-done]').click();
  const before=await snapshot(page);
  await page.reload();await loaded(page);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('#launch')).toHaveAccessibleName('Next puzzle');
  await expect(page.locator('#rethrow')).toBeVisible();expect((await snapshot(page)).state).toEqual(before.state);
  await page.locator('#rethrow').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
  await expect(page.locator('dialog[open]')).toHaveCount(0);expect(await completed(page)).toEqual([82]);
  await page.locator('#launch').click();await idle(page);expect((await snapshot(page)).state.sourceId).toBe(72);
});

test('the ending picture returns through Done and Back while Escape dismisses to play',async({page})=>{
  test.setTimeout(120000);await ready(page,85);
  const station=(await snapshot(page)).state.station;
  let before=0,after=station.before+1,onOutput=false;
  for(const op of 'DAHFISQ') {
    if(op===station.op){onOutput=true;continue;}
    await page.locator(`[data-empty="${onOutput?after++:before++}"]`).click();await choose(page,op);
  }
  await throwIt(page);await expect(page.locator('#launch')).toHaveAccessibleName('Finish');
  const finished=await snapshot(page);await page.locator('#launch').click();
  await expect(page.locator('#ending-progress')).toHaveText('1 of 70 puzzles complete');
  for(const action of ['[data-garden-done]','#garden-back']) {
    await page.locator('#ending-garden').click();
    await expect(page.locator('#garden-back')).toHaveAccessibleName('Back to ending');
    await expect(page.locator(action)).toBeEnabled();await page.locator(action).click();
    await expect(page.locator('#ending-dialog')).toBeVisible();await expect(page.locator('#ending-garden')).toBeFocused();
    await expect(page.locator('#ending-progress')).toHaveText('1 of 70 puzzles complete');
    expect(await snapshot(page)).toEqual(finished);
  }
  await page.locator('#ending-garden').click();await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);await expect(page.locator('#launch')).toBeFocused();
  expect(await snapshot(page)).toEqual(finished);expect(await completed(page)).toEqual([85]);
});
