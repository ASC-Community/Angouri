import {test,expect} from '@playwright/test';

const paint=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
async function ready(page,id,view='flight') {
  await page.goto('/about/');await page.evaluate(()=>localStorage.clear());
  await page.goto(`/#level=${id}&view=${view}`);
  await page.waitForFunction(id=>window.angouri?.state?.sourceId===id&&document.querySelector('#playground').getAttribute('aria-busy')==='false',id);
  await page.evaluate(()=>document.fonts.ready);await paint(page);
}
const viewportFits=page=>page.evaluate(()=>[document.documentElement.scrollWidth-innerWidth,document.documentElement.scrollHeight-innerHeight]);
const visibleHeight=locator=>locator.evaluate(element=>{
  let top=element.getBoundingClientRect().top,bottom=element.getBoundingClientRect().bottom;
  for(let parent=element.parentElement;parent;parent=parent.parentElement) {
    if(!/auto|scroll|hidden|clip/.test(getComputedStyle(parent).overflowY))continue;
    const box=parent.getBoundingClientRect();top=Math.max(top,box.top+parent.clientTop);bottom=Math.min(bottom,box.top+parent.clientTop+parent.clientHeight);
  }
  return Math.max(0,Math.min(innerHeight,bottom)-Math.max(0,top));
});

test('the landing Menu stays clear of the centered wordmark through choice and replay',async({page},testInfo)=>{
  await page.setViewportSize({width:320,height:568});await ready(page,1);
  const check=async()=>{
    const logo=await page.locator('.brand').boundingBox(),menu=await page.locator('#menu-open').boundingBox();
    expect(logo.x+logo.width/2).toBeCloseTo(page.viewportSize().width/2,0);
    expect(logo.width).toBeGreaterThan(200);
    expect(menu.y+menu.height).toBeLessThan(logo.y);
    expect(await viewportFits(page)).toEqual([0,0]);
  };
  await check();await page.locator('[data-op="H"]').click();await idle(page);await check();
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await check();
  await page.locator('#rethrow').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await check();
  await page.screenshot({path:testInfo.outputPath('landing-menu-clear.png')});
});

test('short compact Flow leaves a complete curve reachable below its controls',async({page},testInfo)=>{
  test.setTimeout(150000);
  for(const id of [80,68,25]) {
    await ready(page,id,'flow');
    for(const [width,height] of [[600,450],[601,450],[500,450],[481,450],[480,450],[320,450]]) {
      await page.setViewportSize({width,height});await paint(page);
      const chain=page.locator('.flow-line'),plot=page.locator('.flow-plot').first();
      const plotHeight=(await plot.boundingBox()).height;
      expect(await visibleHeight(chain),`${id}: chain at ${width}×${height}`).toBeGreaterThanOrEqual(plotHeight);
      // A positive scene rectangle alone misses a chain entirely below its clip.
      // Reveal the graph using only the chain's own vertical scroll range.
      await chain.evaluate(element=>{
        const plot=element.querySelector('.flow-plot').getBoundingClientRect(),box=element.getBoundingClientRect();
        element.scrollTop+=plot.top-box.top-(element.clientHeight-plot.height)/2;
      });await paint(page);
      expect(await visibleHeight(plot),`${id}: complete curve at ${width}×${height}`).toBeGreaterThanOrEqual(plotHeight-1);
      expect(await viewportFits(page)).toEqual([0,0]);
      await expect(page.locator('#menu-open')).toBeInViewport();
      if(width===600||width===320)await page.screenshot({path:testInfo.outputPath(`flow-${id}-${width}.png`)});
    }
    if(id!==25) {
      // Discovery feedback and Throw share the footer after the first choice.
      // Their arrival must leave room for a whole selectable face and its cue.
      const choice=page.locator('[data-op="H"]');await choice.click();await idle(page);
      await choice.focus();await page.keyboard.press('Shift');await paint(page);
      const face=choice.locator('.ingredient-surface'),height=(await face.boundingBox()).height;
      expect(await visibleHeight(face)).toBeGreaterThanOrEqual(height-1);
      expect(await page.locator('.recipe-content').evaluate(element=>element.clientHeight)).toBeGreaterThanOrEqual(height+16);
      expect(await face.evaluate(element=>{
        const box=element.getBoundingClientRect(),style=getComputedStyle(element),margin=parseFloat(style.outlineWidth)+parseFloat(style.outlineOffset);
        return ['.recipe-content','.play-dock'].every(selector=>{
          const owner=element.closest(selector),frame=owner.getBoundingClientRect(),top=frame.top+owner.clientTop;
          return box.top-Math.max(10,margin)>=top-1&&box.bottom+margin<=top+owner.clientHeight+1;
        });
      }),`${id}: the selected choice keeps its complete focus treatment`).toBe(true);
      expect(await visibleHeight(page.locator('.flow-line'))).toBeGreaterThanOrEqual((await page.locator('.flow-plot').first().boundingBox()).height);
      await expect(page.locator('#launch')).toBeInViewport();expect(await viewportFits(page)).toEqual([0,0]);
      await page.screenshot({path:testInfo.outputPath(`flow-${id}-320-selected.png`)});
    }
  }
});

test('short Equation has whole readings and every view can reveal a complete recipe control',async({page},testInfo)=>{
  test.setTimeout(120000);
  await ready(page,85,'function');
  for(const [width,height] of [[600,450],[500,450],[480,450],[320,450]]) {
    await page.setViewportSize({width,height});await paint(page);
    const formula=page.locator('.final-equation'),rows=page.locator('.value-table tbody');
    expect(await visibleHeight(formula)).toBeGreaterThan(45);
    expect(await visibleHeight(rows)).toBeGreaterThanOrEqual((await rows.locator('tr').first().boundingBox()).height);
    const header=await page.locator('.value-table thead').boundingBox();
    await rows.evaluate(element=>element.scrollTop=element.scrollHeight);await paint(page);
    expect(await page.locator('.value-table thead').boundingBox()).toEqual(header);
    expect(await viewportFits(page)).toEqual([0,0]);
  }
  for(const view of ['flight','function','flow']) {
    await page.locator(`#tab-${view}`).click();await idle(page);await paint(page);
    for(const selector of ['.empty-slot','#palette .ingredient:not(:disabled)']) {
      const control=page.locator(selector).first();await control.focus();await page.keyboard.press('Shift');await paint(page);
      await expect(control).toBeFocused();
      const bounds=await control.evaluate(element=>{
        const face=element.querySelector('.ingredient-surface')??element,box=face.getBoundingClientRect();
        const reader=element.closest('.recipe-content'),viewport=reader.getBoundingClientRect(),style=getComputedStyle(face);
        const margin=parseFloat(style.outlineWidth)+parseFloat(style.outlineOffset);
        return {height:reader.clientHeight,needed:box.height+Math.max(10,margin)+margin,top:box.top-Math.max(10,margin)-viewport.top-reader.clientTop,bottom:viewport.top+reader.clientTop+reader.clientHeight-box.bottom-margin};
      });
      expect(bounds.height,`${view} ${selector}: whole control and focus cues`).toBeGreaterThanOrEqual(bounds.needed-1);
      expect(bounds.top,`${view} ${selector}: top focus/cue edge`).toBeGreaterThanOrEqual(-1);
      expect(bounds.bottom,`${view} ${selector}: bottom focus edge`).toBeGreaterThanOrEqual(-1);
      await page.screenshot({path:testInfo.outputPath(`recipe-${view}-${selector.startsWith('.')?'slot':'palette'}.png`)});
    }
    await expect(page.locator('#launch')).toBeInViewport();expect(await viewportFits(page)).toEqual([0,0]);
  }
});
