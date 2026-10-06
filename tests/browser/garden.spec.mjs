import {test,expect} from '@playwright/test';

async function ready(page,path='/') {
  await page.goto(path);
  await page.waitForFunction(()=>window.angouri?.state&&document.querySelector('#playground')?.getAttribute('aria-busy')==='false');
}
const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
async function placeRecipe(page,ops) {
  const station=(await page.evaluate(()=>window.angouri.state)).station;
  if(!station){for(const op of ops){await page.locator(`[data-op="${op}"]`).click();await idle(page);}return;}
  let after=false,beforeIndex=0,afterIndex=station.before+1;
  for(const op of ops) {
    if(!after&&op===station.op){after=true;continue;}
    await page.locator(`[data-empty="${after?afterIndex++:beforeIndex++}"]`).click();
    await page.locator(`[data-op="${op}"]`).click();await idle(page);
  }
}
async function openGarden(page) {
  await ready(page,'/#level=67&view=flight');await placeRecipe(page,'DAHFSINAQNAQ');
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
  await page.locator('#launch').click();await page.getByRole('button',{name:'Make a picture',exact:true}).click();
  await expect(page.locator('#garden-dialog')).toBeVisible();await expect(page.locator('[data-garden-stamp]')).toHaveCount(5);
}
async function stamp(page,type,slot) {
  await page.locator(`[data-garden-stamp="${type}"]`).click();
  await page.locator(`[data-garden-slot="${slot}"]`).click();
  await expect(page.locator(`[data-garden-slot="${slot}"]`)).toHaveAttribute('data-garden-complete','true');
}
async function expectStampCentersClickable(page) {
  expect(await page.locator('[data-garden-stamp]').evaluateAll(stamps=>stamps.map(stamp=>{
    const bounds=stamp.getBoundingClientRect(),hit=document.elementFromPoint(bounds.left+bounds.width/2,bounds.top+bounds.height/2);
    return [stamp.dataset.gardenStamp,hit?.closest('[data-garden-stamp]')?.getAttribute('data-garden-stamp')??hit?.className??hit?.tagName];
  }))).toEqual([['loop','loop'],['leaf','leaf'],['wave','wave'],['line','line'],['arch','arch']]);
}
async function finishPicture(page) {
  await expectStampCentersClickable(page);
  const slots=page.locator('[data-garden-slot]'),count=await slots.count();
  for(let index=0;index<count;index++) {
    const slot=slots.nth(index),type=await slot.getAttribute('data-garden-needs');
    if(await slot.getAttribute('data-garden-complete')==='true')continue;
    await page.locator(`[data-garden-stamp="${type}"]`).click();await slot.click();
  }
  await expect(page.locator('.garden-shell')).toHaveAttribute('data-garden-complete','true');
}

test('the optional garden stamps three kernel-drawn pictures without changing the puzzle',async({page})=>{
  test.setTimeout(180000);await openGarden(page);
  const before=await page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history,progress:localStorage.getItem('angouri:vine:v1:progress')}));
  await expect(page.locator('[data-garden-slot]')).toHaveCount(3);
  await page.locator('[data-garden-stamp="leaf"]').click();await page.locator('[data-garden-slot="moon"]').click();
  await expect(page.locator('.garden-status')).toContainText('does not fit');await expect(page.locator('[data-garden-complete="true"]')).toHaveCount(0);
  await page.locator('[data-garden-stamp="loop"]').focus();await page.keyboard.press('Enter');
  await page.locator('[data-garden-slot="moon"]').focus();await page.keyboard.press('Space');
  await expect(page.locator('[data-garden-slot="moon"]')).toHaveAttribute('data-garden-complete','true');
  await stamp(page,'wave','ripple-one');await stamp(page,'wave','ripple-two');
  await expect(page.locator('[data-garden-next]')).toBeVisible();await page.locator('[data-garden-replay]').click();
  await page.locator('[data-garden-next]').click();await expect(page.locator('#garden-picture-heading')).toHaveText('Garden');
  await expect(page.locator('[data-garden-slot]')).toHaveCount(4);await finishPicture(page);await page.locator('[data-garden-next]').click();
  await expect(page.locator('#garden-picture-heading')).toHaveText('Angouri');const finalSlots=page.locator('[data-garden-slot]');await expect(finalSlots).toHaveCount(6);
  expect(await finalSlots.evaluateAll(slots=>slots.map(slot=>{const r=slot.getBoundingClientRect(),top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('[data-garden-slot]');return [slot.dataset.gardenSlot,top?.dataset.gardenSlot];}))).toEqual([['body','body'],['ridge-one','ridge-one'],['ridge-two','ridge-two'],['ridge-three','ridge-three'],['smile','smile'],['stem','stem']]);
  await finalSlots.first().focus();await page.keyboard.press('Tab');await expect(finalSlots.nth(1)).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(finalSlots.first()).toBeFocused();
  await page.locator('[data-garden-stamp="loop"]').click();await finalSlots.first().focus();await page.keyboard.press('Enter');await expect(finalSlots.first()).toHaveAttribute('data-garden-complete','true');
  await finishPicture(page);
  await expect(page.locator('[data-garden-next]')).toHaveText(/Celebrate/);await page.locator('[data-garden-next]').click();
  await expect(page.locator('.garden-canonical')).toHaveCSS('opacity','1');await expect(page.locator('.garden-finale-brand #brand-math annotation')).toHaveText('\\mathit{angour}');
  await expect(page.locator('[data-garden-done]')).toBeVisible();
  expect(await page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history,progress:localStorage.getItem('angouri:vine:v1:progress')}))).toEqual(before);
});

test('dragging a stamp inks only its matching stroke and closing cancels motion',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await openGarden(page);
  const stampCard=page.locator('[data-garden-stamp="loop"]'),moon=page.locator('[data-garden-slot="moon"]');
  await stampCard.dragTo(moon);
  await expect(moon).toHaveAttribute('data-garden-complete','true');
  await expect(page.locator('[data-garden-slot="ripple-one"]')).toHaveAttribute('data-garden-complete','false');
  await expect(page.locator('[data-garden-ink="ripple-one"]')).toHaveCSS('stroke-dashoffset','1px');
  await page.locator('[data-garden-stamp="wave"]').click();await page.locator('[data-garden-slot="ripple-one"]').click();
  await page.keyboard.press('Escape');await expect(page.locator('#garden-dialog')).toBeHidden();
  await expect(page.locator('.garden-drag-ghost')).toHaveCount(0);
});
