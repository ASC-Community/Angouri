import {test,expect} from '@playwright/test';

const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
async function ready(page,id=72) {
  await page.goto(`/#level=${id}&view=flight`);
  await page.waitForFunction(()=>window.angouri?.state&&document.querySelector('#playground')?.getAttribute('aria-busy')==='false');
}
const snapshot=page=>page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history,progress:localStorage.getItem('angouri:vine:v1:progress')}));

test('picture silhouettes link to actual construction without awarding progress',async({page})=>{
  await ready(page);const before=await snapshot(page);
  await page.locator('#menu-open').click();await page.locator('#puzzles-open').click();
  await page.locator('#menu-picture-open').click();
  await expect(page.locator('[data-garden-piece]')).toHaveCount(6);
  await expect(page.locator('#garden-back')).toHaveAccessibleName('Back to puzzle list');
  await page.locator('#garden-back').click();await expect(page.locator('#puzzles-dialog')).toBeVisible();
  await expect(page.locator('#menu-picture-open')).toBeFocused();
  await page.keyboard.press('Escape');
  await page.locator('#picture-open').click();await expect(page.locator('[data-garden-piece]')).toHaveCount(6);
  await expect(page.locator('[data-garden-piece][data-complete="true"]')).toHaveCount(0);
  await expect(page.locator('.garden-status')).toContainText('0 of 6');
  for(const id of [74,75,77]) {
    expect(await page.locator(`[data-garden-piece="${id}"] .garden-area-hit`).evaluate(el=>{
      const b=el.getBoundingClientRect();return document.elementFromPoint(b.left+b.width/2,b.top+b.height/2)?.closest('[data-garden-piece]')===el.closest('[data-garden-piece]');
    })).toBe(true);
  }
  expect(await snapshot(page)).toEqual(before);
  await page.locator('[data-garden-piece="75"]').focus();await page.keyboard.press('Enter');await idle(page);
  expect(await page.evaluate(()=>window.angouri.state.sourceId)).toBe(75);
  await expect(page.locator('#garden-dialog')).toBeHidden();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('angouri:vine:v1:progress')).completed)).toEqual([]);
});

test('earned curves reveal the cucumber, preserve the recipe, and fit compact layouts',async({page})=>{
  test.setTimeout(180000);await ready(page,77);
  await page.evaluate(()=>{const key='angouri:vine:v1:progress',save=JSON.parse(localStorage.getItem(key));save.completed=[72,73,74,75,76];localStorage.setItem(key,JSON.stringify(save));});
  await page.reload();await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
  for(const op of 'HQQQNAHH'){await page.locator(`[data-op="${op}"]`).click();await idle(page);}
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
  await expect(page.locator('[data-garden-piece][data-complete="true"]')).toHaveCount(6);
  await expect(page.locator('.garden-canonical')).toHaveCSS('opacity','1');
  const before=await snapshot(page);
  for(const [width,height] of [[1440,900],[390,844],[320,568],[844,390]]){
    await page.setViewportSize({width,height});
    const board=await page.locator('.garden-board').boundingBox();expect(board.width).toBeGreaterThan(220);expect(board.height).toBeGreaterThan(110);
    for(const tile of await page.locator('[data-garden-piece]').all()){
      await tile.scrollIntoViewIfNeeded();
      expect(await tile.evaluate(el=>{
        const path=el.querySelector('.garden-piece-hit'),p=path.getPointAtLength(path.getTotalLength()*.37),screen=new DOMPoint(p.x,p.y).matrixTransform(path.getScreenCTM());
        return document.elementFromPoint(screen.x,screen.y)?.closest('[data-garden-piece]')===el;
      })).toBe(true);
      const label=tile.locator('.garden-piece-label');
      expect(await label.evaluate(el=>{const b=el.getBoundingClientRect();return document.elementFromPoint(b.left+b.width/2,b.top+b.height/2)?.closest('[data-garden-piece]')===el.closest('[data-garden-piece]');})).toBe(true);
    }
    const labelBounds=await page.locator('[data-garden-piece] .garden-piece-label').evaluateAll(labels=>Object.fromEntries(labels.map(el=>[el.closest('[data-garden-piece]').dataset.gardenPiece,el.getBoundingClientRect().toJSON()])));
    expect(labelBounds[77].left-labelBounds[76].right).toBeGreaterThan(8);
    expect(labelBounds[73].top).toBeGreaterThan(labelBounds[76].bottom);
  }
  await page.locator('[data-garden-done]').click();await expect(page.locator('#garden-dialog')).toBeHidden();
  expect(await snapshot(page)).toEqual(before);
  await page.locator('#picture-open').click();await expect(page.locator('.garden-canonical')).toHaveCSS('opacity','1');
  await expect(page.locator('.garden-piece-cucumber .garden-art-path')).toHaveCSS('opacity','0');
});
