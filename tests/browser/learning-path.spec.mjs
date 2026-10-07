import {test,expect} from '@playwright/test';
const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
async function ready(page,id){await page.goto('/about/');await page.goto(`/#level=${id}&view=flight`);await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');}
async function recipe(page,ops){
  const station=await page.evaluate(()=>window.angouri.state.station);let after=false,beforeIndex=0,afterIndex=station?.before+1;
  for(const op of ops){if(station&&!after&&op===station.op){after=true;continue;}if(station)await page.locator(`[data-empty="${after?afterIndex++:beforeIndex++}"]`).click();await page.locator(`[data-op="${op}"]`).click();await idle(page);}
}
const workspace=page=>page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history,slots:window.angouri.slots,progress:localStorage.getItem('angouri:vine:v1:progress')}));

test('small input lessons connect loop translation, phase order and a movable sine',async({page})=>{
  test.setTimeout(120000);
  for(const [source,ops,next] of [[78,'AQNA',68],[79,'AHS',81],[81,'HAS',53]]){
    await ready(page,source);await recipe(page,ops);expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);
    const before=await workspace(page);
    await page.locator('#ideas-open').click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
    await expect(page.locator(`[data-reference-lesson="${source}"]`)).toHaveCount(1);await expect(page.locator('.katex-error')).toHaveCount(0);
    await expect(page.locator('#notes-content [data-note-target]')).toHaveCount(0);
    expect(await workspace(page)).toEqual(before);await page.keyboard.press('Escape');
    await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await page.locator('#launch').click();await idle(page);
    expect(await page.evaluate(()=>window.angouri.state.sourceId)).toBe(next);
  }
});

test('bamboo and flower-petal constructions advance through their authored picture positions',async({page})=>{
  for(const [source,ops,next] of [[82,'H',72],[83,'Q',76]]){
    await ready(page,source);await recipe(page,ops);
    expect(await page.evaluate(()=>({solved:window.angouri.result.solved,picture:!!window.angouri.result.picture?.paths.length,relation:window.angouri.result.relation?.kind}))).toEqual({solved:true,picture:true,relation:source===83?'height-squared':undefined});
    await expect(page.locator('#feedback')).toContainText(source===82?'straight line stays planted':'one pointed petal');
    const before=await workspace(page);await page.locator('#ideas-open').click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
    await expect(page.locator(`[data-reference-lesson="${source}"]`)).toHaveCount(1);
    await expect(page.locator('#notes-content')).toContainText(source===82?'constant inclination':'five times around a centre');
    expect(await workspace(page)).toEqual(before);await page.keyboard.press('Escape');
    await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
    if(await page.locator('#garden-dialog').isVisible())await page.keyboard.press('Escape');
    await page.locator('#launch').click();await idle(page);
    expect(await page.evaluate(()=>window.angouri.state.sourceId)).toBe(next);
  }
});

test('a single missed shoulder is repaired without moving the five matching landmarks',async({page})=>{
  await ready(page,80);const before=await page.evaluate(()=>window.angouri.result.checkpoints);
  expect(before.filter(c=>!c.hit).map(c=>c.x)).toEqual(['1/3']);
  await recipe(page,'Q');const after=await page.evaluate(()=>window.angouri.result.checkpoints);
  expect(after.every(c=>c.hit)).toBe(true);
  before.forEach((c,i)=>{if(c.hit)expect(after[i].actual).toBe(c.actual);});
  await expect(page.locator('#feedback')).toContainText('matching peaks alone');
  await page.locator('#ideas-open').click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
  const comparison=page.getByRole('region',{name:'Same endpoints and peak. Different shoulders.'});
  await expect(comparison.locator('[data-note-panel="0"] .note-reading annotation')).toHaveText('\\left.h\\right|_{x=1}=\\frac{1}{2}');
  await comparison.getByRole('button',{name:'Squared again',exact:true}).click();
  await expect(comparison.locator('[data-note-panel="1"] .note-reading annotation')).toHaveText('\\left.h\\right|_{x=1}=\\frac{1}{4}');
  await expect(page.locator('[data-reference-lesson="55"]')).toHaveCount(0);
});

test('puzzle Notes offer relevant dependencies while Create keeps the complete book',async({page})=>{
  await ready(page,76);const before=await workspace(page);await page.locator('#ideas-open').click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
  expect(await page.locator('[data-note-lesson]').evaluateAll(buttons=>buttons.map(b=>Number(b.dataset.noteLesson)))).toEqual([76,81,79,54,80]);
  await expect(page.locator('[data-note]')).toHaveCount(0);
  await page.locator('[data-note-lesson="80"]').click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('#notes-content')).toContainText('single missed point');
  await expect(page.locator('[data-reference-lesson="55"],[data-reference-lesson="77"]')).toHaveCount(0);
  expect(await workspace(page)).toEqual(before);await page.keyboard.press('Escape');
  await page.locator('#menu-open').click();await page.locator('#nav-create').click();await idle(page);
  await page.locator('#ideas-open').click();await expect(page.locator('[data-note]')).toHaveCount(10);
  await page.locator('[data-note="7"]').click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
  for(const id of [50,51,52,79,81,53,54,80,55])expect(await page.locator(`[data-reference-lesson="${id}"]`).count()).toBeGreaterThan(0);
});
