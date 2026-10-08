import {test,expect} from '@playwright/test';

const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
const painted=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));

async function scrollAndRecord(page,control,action) {
  await control.scrollIntoViewIfNeeded();
  await painted(page);
  const before=await page.evaluate(()=>{
    window.placementScrolls=[scrollY];window.recordPlacement=true;
    const frame=()=>{if(window.recordPlacement){window.placementScrolls.push(scrollY);requestAnimationFrame(frame);}};
    requestAnimationFrame(frame);
    return scrollY;
  });
  await action();await idle(page);await painted(page);
  const positions=await page.evaluate(()=>{
    window.recordPlacement=false;
    return [...window.placementScrolls,scrollY];
  });
  for(const position of positions)expect(Math.abs(position-before),`page moved from ${before} to ${position}`).toBeLessThanOrEqual(1);
  expect(await page.evaluate(()=>document.body.style.minHeight)).toBe('');
}

for(const view of ['flight','function','flow'])test(`8.7 ${view} edits preserve the scrolled page and editor focus`,async({page})=>{
  test.setTimeout(120000);
  await page.emulateMedia({reducedMotion:'no-preference'});
  for(const viewport of [{width:1146,height:610},{width:390,height:844},{width:844,height:390}]) {
    await page.setViewportSize(viewport);
    await page.goto('/about/');await page.evaluate(()=>localStorage.clear());
    await page.goto(`/#level=54&view=${view}`);
    await page.waitForFunction(()=>window.angouri?.state?.sourceId===54&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
    await page.evaluate(()=>{window.levelButton=document.querySelector('[data-level="54"]');scrollTo(0,document.documentElement.scrollHeight);});
    for(const op of ['A','H','Q']) {
      const block=page.locator(`[data-op="${op}"]`);
      await scrollAndRecord(page,block,()=>block.click());
    }
    expect(await page.evaluate(()=>window.angouri.state.nodes.map(node=>node.op).join(''))).toBe('ASHQ');
    expect(await page.evaluate(()=>window.levelButton===document.querySelector('[data-level="54"]'))).toBe(true);
    const block=page.locator('.part-body').last();
    await block.scrollIntoViewIfNeeded();await block.focus();
    await scrollAndRecord(page,block,()=>page.keyboard.press('Control+z'));
    await expect(page.locator('[data-empty="3"]')).toBeFocused();
    await scrollAndRecord(page,page.locator('[data-empty="3"]'),()=>page.keyboard.press('Control+Shift+z'));
    expect(await page.evaluate(()=>window.angouri.state.nodes.map(node=>node.op).join(''))).toBe('ASHQ');
    expect(await page.evaluate(()=>window.angouri.history)).toEqual({undo:3,redo:0});
  }
});

test('8.7 dragging, cancellation and returning a block keep the page in place',async({page})=>{
  await page.setViewportSize({width:1146,height:610});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('/#level=54&view=flight');
  await page.waitForFunction(()=>window.angouri?.state?.sourceId===54&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
  await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
  expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(100);
  const source=page.locator('[data-op="Q"]');
  const drag=async cancel=>{
    const from=await source.boundingBox(),to=await page.locator('[data-empty="2"]').boundingBox();
    await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();
    await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:8});
    if(cancel)await page.keyboard.press('Escape');
    await page.mouse.up();
  };
  await scrollAndRecord(page,source,()=>drag(true));
  expect(await page.evaluate(()=>window.angouri.history)).toEqual({undo:0,redo:0});
  await scrollAndRecord(page,source,()=>drag(false));
  expect(await page.evaluate(()=>window.angouri.state.nodes.map(node=>node.op).join(''))).toBe('SQ');
  const placed=page.locator('.part-body');
  await scrollAndRecord(page,placed,()=>placed.click());
  await scrollAndRecord(page,source,()=>source.click());
  expect(await page.evaluate(()=>window.angouri.state.nodes.map(node=>node.op).join(''))).toBe('S');
  expect(await page.evaluate(()=>window.angouri.history)).toEqual({undo:2,redo:0});
  // The render guard is synchronous; it must leave ordinary page scrolling free.
  await page.mouse.wheel(0,-500);await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
});
