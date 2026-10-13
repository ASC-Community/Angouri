import {clearStorage} from './storage-fixtures.mjs';
import {test,expect} from '@playwright/test';

const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
const snapshot=page=>page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}));
async function ready(page,sourceId,view='flight') {
  await page.goto('/about/');await clearStorage(page);
  await page.goto(`/#level=${sourceId}&view=${view}`);
  await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
}
async function create(page,sourceId) {
  await ready(page,sourceId);await page.locator('#menu-open').click();await page.locator('#nav-create').click();
  if(await page.locator('#leave-dialog').isVisible())await page.locator('#leave-discard').click();
  await idle(page);expect(await page.evaluate(()=>window.angouri.state.mode)).toBe('remix');
}
async function place(page,op) {await page.locator(`[data-op="${op}"]`).click();await idle(page);}

test('equivalent Create choices preserve authored source, blocks, crop, history and focus',async({page})=>{
  test.setTimeout(180000);
  for(const [sourceId,choice] of [[79,50],[81,4],[82,50],[71,49],[73,9],[75,48],[76,4],[77,48],[78,48],[83,66]]) {
    await create(page,sourceId);await place(page,'A');
    if(await page.locator('[data-crop-add]').count()){await page.locator('[data-crop-add]').click();await idle(page);}
    const before=await snapshot(page),measurements=await page.evaluate(()=>window.angouri.measurements.edits.length);
    expect(before.state.crop).toBeDefined();expect(before.state.nodes.length).toBeGreaterThan(0);
    await page.locator('#source-choose').click();
    const option=page.locator(`[data-source="${choice}"]`);
    await expect(option).toHaveAttribute('aria-pressed','true');
    await option.click();await idle(page);
    expect(await snapshot(page),`source ${sourceId}`).toEqual(before);
    expect(await page.evaluate(()=>window.angouri.measurements.edits.length)).toBe(measurements);
    await expect(page.locator('#source-choose')).toBeFocused();
    await expect(page.locator('#curves-dialog')).not.toBeVisible();
  }
});

test('the four-unit cubic is distinct from the two-unit Create option',async({page})=>{
  await create(page,64);await page.locator('[data-crop-add]').click();await idle(page);
  const before=await snapshot(page);
  await expect(page.locator('[data-crop-range="to"]')).toHaveAttribute('max','4');
  await expect(page.locator('.flight-grid')).toHaveCount(5);
  await page.locator('#source-choose').click();
  await expect(page.locator('#curve-choices [aria-pressed="true"]')).toHaveCount(0);
  await page.locator('[data-source="5"]').click();await idle(page);
  expect(await page.evaluate(()=>window.angouri.state.sourceId)).toBe(5);
  expect(await page.evaluate(()=>window.angouri.state.crop)).toEqual({from:'0',to:'2'});
  await expect(page.locator('[data-crop-range="to"]')).toHaveAttribute('max','2');
  await expect(page.locator('.flight-grid')).toHaveCount(3);
  await page.locator('#undo').click();await idle(page);
  expect((await snapshot(page)).state).toEqual(before.state);
  await expect(page.locator('[data-crop-range="to"]')).toHaveAttribute('max','4');
});

test('exact target coordinates remain named through preview, confirmation and editing in every view',async({page})=>{
  await ready(page,25);
  const prefix='Target 2, x = 2, height = 17/8: ';
  for(const [view,selector] of [['flight','.ring'],['function','.equation-verdict'],['flow','.flow-goal']]) {
    await page.locator(`#tab-${view}`).click();
    await expect(page.locator(`${selector}[data-target="1"]`)).toHaveAttribute('aria-label',prefix+'path misses');
  }
  for(const op of 'AHHAHA')await place(page,op);
  await expect(page.locator('.flow-goal[data-target="1"]')).toHaveAttribute('aria-label',prefix+'path matches, ready to throw');
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
  for(const [view,selector] of [['flow','.flow-goal'],['flight','.ring'],['function','.equation-verdict']]) {
    await page.locator(`#tab-${view}`).click();
    await expect(page.locator(`${selector}[data-target="1"]`)).toHaveAttribute('aria-label',prefix+'hit confirmed');
  }
  await page.locator('#undo').click();await idle(page);
  await expect(page.locator('.equation-verdict[data-target="1"]')).toHaveAttribute('data-status','waiting');
  await expect(page.locator('.equation-verdict[data-target="1"]')).toHaveAttribute('aria-label',prefix+'path misses');
});

test('circle targets retain their inspection action and coordinates after misses, hits and reset',async({page})=>{
  await ready(page,43,'flow');
  const target=page.locator('[data-circle-target="0"]'),prefix='Inspect target 1, x = 3, height = 0: ';
  await expect(target).toHaveAccessibleName(prefix+'path misses');
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
  await expect(target).toHaveAccessibleName(prefix+'miss confirmed');
  await page.locator('[data-circle-value="radius"]').fill('1');await page.locator('[data-circle-value="radius"]').press('Enter');await idle(page);
  await expect(target).toHaveAccessibleName(prefix+'path matches, ready to throw');
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
  await expect(target).toHaveAccessibleName(prefix+'hit confirmed');
  const before=await snapshot(page);
  await page.getByRole('button',{name:prefix+'hit confirmed',exact:true}).click();
  await expect(target).toBeFocused();expect(await snapshot(page)).toEqual(before);
  await page.locator('#reset').click();await idle(page);
  await expect(target).toHaveAccessibleName(prefix+'path misses');
  await expect(target).toHaveAttribute('data-status','waiting');
});

test('cancelling circle preview restores the exact named verdict and acknowledged history',async({page})=>{
  await ready(page,43);
  const before=await snapshot(page),target=page.locator('.ring[data-target="0"]'),prefix='Target 1, x = 3, height = 0: ';
  const handle=page.locator('[data-circle-handle="radius"]'),box=await handle.boundingBox();
  const delta=await page.evaluate(()=>document.querySelector('#trajectory').getBBox().width*document.querySelector('#flight-svg').getScreenCTM().a/2);
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+delta,box.y+box.height/2,{steps:8});
  await expect(target).toHaveAttribute('aria-label',prefix+'path matches, ready to throw');
  await expect(target).toHaveAttribute('data-status','waiting');
  expect(await snapshot(page)).toEqual(before);
  await page.keyboard.press('Escape');await page.mouse.up();
  await expect(target).toHaveAttribute('aria-label',prefix+'path misses');
  expect(await snapshot(page)).toEqual(before);
});
