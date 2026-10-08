import {test,expect} from '@playwright/test';
const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
const paint=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function ready(page,id,view='flight'){
  await page.goto('/about/');await page.evaluate(()=>localStorage.clear());await page.goto(`/#level=${id}&view=${view}`);
  await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');await paint(page);
}
const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height};};
const frame=page=>page.evaluate(()=>Object.fromEntries(['.site-header','.canvas-side','.scene-toolbar','.play-dock'].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return [selector,{x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height}];})));
function sameFrame(actual,expected){for(const selector of Object.keys(expected))for(const key of Object.keys(expected[selector]))expect(Math.abs(actual[selector][key]-expected[selector][key]),`${selector} ${key}`).toBeLessThan(1);}

test('views share one frame while Equation panes and the Flow chain own overflow',async({page},testInfo)=>{
  test.setTimeout(150000);
  for(const size of [{width:1146,height:850},{width:320,height:568},{width:844,height:390}]){
    await page.setViewportSize(size);
    for(const id of [25,54,45]){
      // Direct Equation loads must reserve the same Flight space too.
      await ready(page,id,'function');const original=await frame(page);
      for(const view of ['flow','flight','function']){
        await page.locator(`#tab-${view}`).click();await idle(page);await paint(page);sameFrame(await frame(page),original);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
        expect(await page.evaluate(()=>document.documentElement.scrollHeight-innerHeight)).toBe(0);
        expect(await page.locator('#launch').evaluate(el=>{const r=el.getBoundingClientRect();return r.bottom<=innerHeight&&r.top>=0;})).toBe(true);
      }
      const bounds=await page.locator('.equation-layout').evaluate(el=>{
        const r=el.getBoundingClientRect();return [...el.children].every(child=>{const c=child.getBoundingClientRect();return c.top>=r.top&&c.bottom<=r.bottom&&c.left>=r.left&&c.right<=r.right;});
      });expect(bounds).toBe(true);
      const tableBody=page.locator('.value-table tbody');
      expect(await tableBody.evaluate(el=>el.clientHeight)).toBeGreaterThan(28);
      const centred=await page.locator('.final-equation').evaluate(el=>{
        const inner=el.querySelector('.equation-content'),r=el.getBoundingClientRect(),c=inner.getBoundingClientRect();
        return c.height>el.clientHeight?true:Math.abs((c.top-r.top)-(r.bottom-c.bottom))<2;
      });expect(centred).toBe(true);
      if(id===54&&size.width===320){
        const table=page.locator('.value-table tbody');
        expect(await table.evaluate(el=>el.scrollHeight-el.clientHeight)).toBeGreaterThan(40);
        await table.evaluate(el=>el.scrollTop=80);const scroll=await table.evaluate(el=>el.scrollTop);expect(scroll).toBeGreaterThan(0);
        const header=page.locator('.value-table thead'),head=await header.boundingBox(),body=await table.boundingBox();
        expect(head.y+head.height).toBeLessThanOrEqual(body.y+.5);
        await table.evaluate(el=>el.scrollTop+=20);expect(await header.boundingBox()).toEqual(head);
        await table.evaluate((el,top)=>el.scrollTop=top,scroll);
        const before=await frame(page);await page.locator('#tab-flight').click();await page.locator('#tab-function').click();await paint(page);
        expect(await table.evaluate(el=>el.scrollTop)).toBe(scroll);sameFrame(await frame(page),before);
      }
      if(id===25&&size.width===1146)await page.screenshot({path:testInfo.outputPath('equation-frame.png'),fullPage:true});
    }
  }
});

test('menu headers remain outside their body scrollers',async({page})=>{
  await page.setViewportSize({width:844,height:390});await ready(page,54);
  for(const destination of ['puzzles-open','settings-open','menu-version']){
    await page.locator('#menu-open').click();await page.locator(`#${destination}`).click();
    const dialog=page.locator('dialog[open]'),header=dialog.locator('.dialog-top'),body=dialog.locator('.dialog-content');
    const before=await header.boundingBox();
    await body.evaluate(el=>el.scrollTop=el.scrollHeight);
    expect(await header.boundingBox()).toEqual(before);
    expect(await dialog.evaluate(el=>el.scrollHeight-el.clientHeight)).toBe(0);
    expect(await header.evaluate(el=>{const b=el.nextElementSibling.getBoundingClientRect(),r=el.getBoundingClientRect();return b.top>=r.bottom;})).toBe(true);
    await page.keyboard.press('Escape');
  }
});

test('choice blocks keep stable hit areas and visibly depress without replacing their buttons',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await ready(page,1);
  const block=page.locator('[data-op="H"]'),face=block.locator('.ingredient-surface');
  const before=await block.boundingBox();
  await page.evaluate(()=>window.choiceButton=document.querySelector('[data-op="H"]'));
  await page.mouse.move(before.x+before.width/2,before.y+before.height-1);
  const stable=await block.evaluate(el=>new Promise(resolve=>{
    const start=performance.now(),initial=el.getBoundingClientRect();let same=true;
    const tick=()=>{const r=el.getBoundingClientRect();same&&=el.matches(':hover')&&Math.abs(r.y-initial.y)<.1;if(performance.now()-start<400)requestAnimationFrame(tick);else resolve(same);};tick();
  }));expect(stable).toBe(true);
  await page.mouse.down();await expect.poll(()=>face.evaluate(el=>el.getBoundingClientRect().y-el.parentElement.getBoundingClientRect().y)).toBe(3);
  await page.mouse.up();await idle(page);
  await expect(block).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>window.choiceButton===document.querySelector('[data-op="H"]'))).toBe(true);
  await page.mouse.move(0,0);await expect.poll(()=>face.evaluate(el=>el.getBoundingClientRect().y-el.parentElement.getBoundingClientRect().y)).toBe(3);
  await block.click();await idle(page);await page.mouse.move(0,0);
  await expect(block).toHaveAttribute('aria-pressed','false');
  await expect.poll(()=>face.evaluate(el=>el.getBoundingClientRect().y-el.parentElement.getBoundingClientRect().y)).toBe(0);
  expect(await page.evaluate(()=>window.choiceButton===document.querySelector('[data-op="H"]'))).toBe(true);
});

test('Notes keeps its frame and navigation while each selected lesson scrolls',async({page},testInfo)=>{
  test.setTimeout(120000);
  for(const size of [{width:1146,height:850},{width:320,height:568},{width:844,height:390}]){
    await page.setViewportSize(size);await ready(page,54);await page.locator('#ideas-open').click();
    await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
    const dialog=page.locator('#ideas-dialog'),before=await dialog.boundingBox();
    const ids=await page.locator('[data-note-lesson]').evaluateAll(items=>items.map(el=>el.dataset.noteLesson));
    for(const id of ids){
      await page.locator(`[data-note-lesson="${id}"]`).click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
      expect(await dialog.boundingBox()).toEqual(before);expect(await page.locator('#notes-reading').evaluate(el=>el.scrollTop)).toBe(0);
      const header=await page.locator('#ideas-dialog .dialog-top').boundingBox();
      await page.locator('#notes-reading').evaluate(el=>el.scrollTop=500);
      expect(await page.locator('#ideas-dialog .dialog-top').boundingBox()).toEqual(header);
      expect(await dialog.evaluate(el=>el.scrollHeight-el.clientHeight)).toBe(0);
    }
    await page.screenshot({path:testInfo.outputPath(`notes-${size.width}.png`),fullPage:true});
    await page.keyboard.press('Escape');await expect(page.locator('#ideas-open')).toBeFocused();
  }
});

test('introductory explanations stay beside their icon and Throw stays put when it becomes Next',async({page})=>{
  test.setTimeout(120000);
  for(const size of [{width:1146,height:850},{width:320,height:568},{width:844,height:390}]){
    await page.setViewportSize(size);
    for(const [id,op]of [[1,'H'],[2,'A']]){
      await ready(page,id);await page.locator(`[data-op="${op}"]`).click();await idle(page);await page.mouse.move(0,0);
      const layout=await page.locator('#feedback').evaluate(el=>{
        const a=el.firstElementChild.getBoundingClientRect(),text=el.lastElementChild.firstChild,range=document.createRange();
        range.setStart(text,0);range.setEnd(text,text.textContent.indexOf(' '));const b=range.getBoundingClientRect();
        // Inline text can continue across the full width on its second line.
        // Its first words must still use the space beside the operation icon.
        return {beside:b.left>=a.right,vertical:Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)};
      });
      expect(layout).toEqual({beside:true,vertical:true});
      expect(await page.locator('.ingredient .katex-html').evaluateAll(formulas=>formulas.every(formula=>{
        const r=formula.getBoundingClientRect(),face=formula.closest('.ingredient-surface').getBoundingClientRect();
        return r.left>=face.left+2&&r.right<=face.right-2;
      })),`introductory formulas fit their faces at ${size.width}px`).toBe(true);
      const button=page.locator('#launch'),before=await button.evaluate(rect);
      await button.click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await paint(page);await page.mouse.move(0,0);
      await expect(button).toHaveAccessibleName('Next puzzle');const after=await button.evaluate(rect);
      for(const key of Object.keys(before))expect(Math.abs(after[key]-before[key]),`${id} ${size.width} ${key}`).toBeLessThan(1);
      await expect(page.locator('#rethrow')).toBeVisible();
    }
  }
});

test('the common loading screen does not show the first puzzle block choices',async({page})=>{
  let release;const gate=new Promise(resolve=>release=resolve);
  await page.route('**/engine-worker.js',async route=>{await gate;await route.continue();});
  await page.goto('/#level=54&view=flight');await expect(page.locator('#playground')).toHaveAttribute('aria-busy','true');
  await expect(page.locator('.loading-scene')).toBeVisible();await expect(page.locator('.play-dock')).toBeHidden();
  release();await page.waitForFunction(()=>window.angouri?.state?.sourceId===54&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
  await expect(page.locator('.play-dock')).toBeVisible();
});
