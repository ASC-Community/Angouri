import {test,expect} from '@playwright/test';

async function completedGarden(page) {
  await page.goto('/#level=72');
  await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground')?.getAttribute('aria-busy')==='false');
  await page.evaluate(()=>{
    const key='angouri:vine:v1:progress',save=JSON.parse(localStorage.getItem(key));
    save.completed=[82,72,73,74,75,83,76,77];localStorage.setItem(key,JSON.stringify(save));
  });
  await page.reload();
  await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground')?.getAttribute('aria-busy')==='false');
  await page.locator('#picture-open').click();
  await expect(page.locator('[data-garden-piece][data-complete="true"]')).toHaveCount(8);
  await page.mouse.move(0,0);
}

test('finished contours match their artwork and all bank decorations are grounded',async({page},testInfo)=>{
  await completedGarden(page);
  for(const [width,height] of [[1440,900],[320,568],[844,390]]) {
    await page.setViewportSize({width,height});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const geometry=await page.evaluate(()=>{
      const points=path=>{
        const length=path.getTotalLength(),matrix=path.getScreenCTM();
        return Array.from({length:721},(_,i)=>{
          const p=path.getPointAtLength(length*i/720);return new DOMPoint(p.x,p.y).matrixTransform(matrix);
        });
      };
      const segmentDistance=(p,a,b)=>{
        const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
        return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
      };
      const deviation=(source,destination)=>Math.max(...source.map(p=>Math.min(...destination.slice(1).map((b,i)=>segmentDistance(p,destination[i],b)))));
      const cucumber=document.querySelector('[data-garden-piece="77"]');
      const outline=points(cucumber.querySelector('.garden-art-path')),body=points(cucumber.querySelector('.garden-canonical-body'));
      const fillDeviations=[74,75].map(id=>{
        const piece=document.querySelector(`[data-garden-piece="${id}"]`);
        return deviation(points(piece.querySelector('.garden-art-path')),points(piece.querySelector('.garden-piece-fill')));
      });
      const moon=document.querySelector('[data-garden-piece="74"] .garden-art-path'),bounds=moon.getBBox(),length=moon.getTotalLength();
      const radii=Array.from({length:240},(_,i)=>{
        const p=moon.getPointAtLength(length*i/240);return Math.hypot(p.x-bounds.x-bounds.width/2,p.y-bounds.y-bounds.height/2);
      });
      const bank=document.querySelector('[data-garden-piece="72"] .garden-piece-fill');
      const roots=[...document.querySelectorAll('[data-bank-root]')].map(el=>{
        const [x,y]=el.dataset.bankRoot.split(' ').map(Number);return bank.isPointInFill(new DOMPoint(x,y));
      });
      const bamboo=document.querySelector('[data-garden-piece="82"] .garden-art-path'),base=bamboo.getPointAtLength(bamboo.getTotalLength());
      return {
        cucumber:Math.max(deviation(outline,body),deviation(body,outline)),fillDeviations,
        moonRadiusVariation:Math.max(...radii)-Math.min(...radii),roots,
        supportRooted:bank.isPointInFill(base),
        bankBeforeSupport:!!(bank.compareDocumentPosition(bamboo)&Node.DOCUMENT_POSITION_FOLLOWING),
        bankStroke:getComputedStyle(document.querySelector('[data-garden-piece="72"] .garden-art-path')).stroke
      };
    });
    expect(geometry.cucumber,`earned contour and skin agree at ${width}px`).toBeLessThan(.15);
    for(const deviation of geometry.fillDeviations)expect(deviation).toBeLessThan(.15);
    expect(geometry.moonRadiusVariation,'the bright moon has no faceted perimeter').toBeLessThan(.1);
    expect(geometry.roots).toEqual(Array(6).fill(true));
    expect(geometry.supportRooted).toBe(true);expect(geometry.bankBeforeSupport).toBe(true);
    expect(geometry.bankStroke,'the idle bank has one fill boundary, without an extra outline').toBe('none');
    await page.screenshot({path:testInfo.outputPath(`lake-garden-${width}.png`)});
  }
});

test('filled shapes have visible contour highlights above their artwork and neutral arrival',async({page},testInfo)=>{
  await completedGarden(page);
  for(const [width,height] of [[1440,900],[320,568]]) {
    await page.setViewportSize({width,height});await page.mouse.move(0,0);
    for(const highlight of await page.locator('.garden-piece-highlight').all())await expect(highlight).toHaveCSS('opacity','0');
    for(const id of [74,77,83,73,75,76,72,82]) {
      const piece=page.locator(`[data-garden-piece="${id}"]`);
      await piece.locator('.garden-piece-label').hover();
      await expect(piece).toHaveClass(/is-pointed/);
      await expect(piece.locator('.garden-piece-highlight')).toHaveCSS('opacity','1');
      const border=piece.locator('.garden-focus-path').first();
      await expect(border).toHaveCSS('stroke-width','3px');
      await expect(border).toHaveCSS('vector-effect','non-scaling-stroke');
      expect(await piece.evaluate(el=>el.querySelector('.garden-piece-art').lastElementChild.classList.contains('garden-piece-highlight'))).toBe(true);
      if(id===77||id===72)await page.screenshot({path:testInfo.outputPath(`highlight-${id}-${width}.png`)});
    }
    await page.mouse.move(0,0);await page.locator('#garden-back').focus();await page.keyboard.press('Tab');
    await expect(page.locator('[data-garden-piece="74"]')).toBeFocused();
    await expect(page.locator('[data-garden-piece="74"] .garden-piece-highlight')).toHaveCSS('opacity','1');
    // Pointer input hides the remembered keyboard focus as well as its contour.
    await page.locator('.garden-heading').click();
    for(const highlight of await page.locator('.garden-piece-highlight').all())await expect(highlight).toHaveCSS('opacity','0');
  }
});
