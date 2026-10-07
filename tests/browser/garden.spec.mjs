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
  await expect(page.locator('[data-garden-piece]')).toHaveCount(8);
  await expect(page.locator('#garden-back')).toHaveAccessibleName('Back to puzzle list');
  await page.locator('#garden-back').click();await expect(page.locator('#puzzles-dialog')).toBeVisible();
  await expect(page.locator('#menu-picture-open')).toBeFocused();
  await page.keyboard.press('Escape');
  await page.locator('#picture-open').click();await expect(page.locator('[data-garden-piece]')).toHaveCount(8);
  await expect(page.locator('[data-garden-done]')).toBeFocused();
  await expect(page.locator('.garden-piece:focus-visible')).toHaveCount(0);
  await expect(page.locator('[data-garden-piece][data-complete="true"]')).toHaveCount(0);
  await expect(page.locator('.garden-status')).toContainText('0 of 8');
  for(const id of [82,72,73,74,75,83,76,77]) {
    expect(await page.locator(`[data-garden-piece="${id}"] .garden-area-hit`).evaluate(el=>{
      const b=el.getBoundingClientRect(),id=el.closest('[data-garden-piece]').dataset.gardenPiece;
      // The leaf attaches at the centre of the vine's box and owns that overlap.
      // The bamboo's top stays clear of the vine growing around its support.
      const [x,y]=id==='73'?[.2,.8]:id==='82'?[.5,.05]:[.5,.5];
      return document.elementFromPoint(b.left+b.width*x,b.top+b.height*y)?.closest('[data-garden-piece]')===el.closest('[data-garden-piece]');
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
  await page.evaluate(()=>{const key='angouri:vine:v1:progress',save=JSON.parse(localStorage.getItem(key));save.completed=[82,72,73,74,75,83,76];localStorage.setItem(key,JSON.stringify(save));});
  await page.reload();await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
  for(const op of 'HQQQNAHH'){await page.locator(`[data-op="${op}"]`).click();await idle(page);}
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
  await expect(page.locator('[data-garden-piece][data-complete="true"]')).toHaveCount(8);
  await expect(page.locator('.garden-canonical')).toHaveCSS('opacity','1');
  await expect(page.locator('.garden-shell')).toHaveClass(/trace-complete/);await expect(page.locator('.garden-shell')).toHaveClass(/morph-complete/);
  for(const piece of ['moon','leaf','bank'])await expect(page.locator(`.garden-piece-${piece} .garden-piece-fill`)).toHaveCSS('opacity','1');
  const before=await snapshot(page);
  for(const [width,height] of [[1440,900],[390,844],[320,568],[844,390]]){
    await page.setViewportSize({width,height});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const board=await page.locator('.garden-board').boundingBox();expect(board.width).toBeGreaterThan(220);expect(board.height).toBeGreaterThan(110);
    for(const tile of await page.locator('[data-garden-piece]').all()){
      await tile.scrollIntoViewIfNeeded();
      expect(await tile.evaluate(el=>{
        const id=el.dataset.gardenPiece,factor=id==='73'?.8:id==='82'?.08:.37;
        const path=el.querySelector('.garden-piece-hit'),p=path.getPointAtLength(path.getTotalLength()*factor),screen=new DOMPoint(p.x,p.y).matrixTransform(path.getScreenCTM());
        return document.elementFromPoint(screen.x,screen.y)?.closest('[data-garden-piece]')===el;
      })).toBe(true);
      const label=tile.locator('.garden-piece-label');
      expect(await label.evaluate(el=>{const b=el.getBoundingClientRect();return document.elementFromPoint(b.left+b.width/2,b.top+b.height/2)?.closest('[data-garden-piece]')===el.closest('[data-garden-piece]');})).toBe(true);
      const labelClearance=await tile.evaluate(el=>{
        const label=el.querySelector('.garden-piece-label').getBoundingClientRect();
        // Firefox includes the wide invisible hit stroke in its bounds. Labels
        // must clear the visible drawing; overlapping its hit area is useful.
        const top=el.querySelector('.garden-piece-label').dataset.labelRow==='top';
        return Math.min(...[...el.querySelectorAll('.garden-art-path')].map(path=>top?path.getBoundingClientRect().top-label.bottom:label.top-path.getBoundingClientRect().bottom));
      });
      expect(labelClearance,`piece ${await tile.getAttribute('data-garden-piece')} clears its label at ${width}x${height}`).toBeGreaterThan(0);
    }
    const labelBounds=await page.locator('[data-garden-piece] .garden-piece-label').evaluateAll(labels=>Object.fromEntries(labels.map(el=>[el.closest('[data-garden-piece]').dataset.gardenPiece,el.getBoundingClientRect().toJSON()])));
    for(const row of [[74,77,83,73],[75,76,72,82]]) {
      const centres=row.map(id=>labelBounds[id].y+labelBounds[id].height/2);
      expect(Math.max(...centres)-Math.min(...centres)).toBeLessThan(1);
      for(let index=1;index<row.length;index++)expect(labelBounds[row[index]].left-labelBounds[row[index-1]].right).toBeGreaterThan(8);
    }
    for(const [top,bottom] of [[74,75],[77,76],[83,72],[73,82]])expect(Math.abs(labelBounds[top].x+labelBounds[top].width/2-labelBounds[bottom].x-labelBounds[bottom].width/2)).toBeLessThan(1);
    const bodyAlignment=await page.evaluate(()=>{
      const bounds=element=>{
        const box=element.getBBox(),matrix=element.getScreenCTM(),points=[[box.x,box.y],[box.x+box.width,box.y],[box.x,box.y+box.height],[box.x+box.width,box.y+box.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(matrix));
        const xs=points.map(point=>point.x),ys=points.map(point=>point.y),left=Math.min(...xs),top=Math.min(...ys);
        return {x:left,y:top,width:Math.max(...xs)-left,height:Math.max(...ys)-top};
      };
      const a=bounds(document.querySelector('.garden-canonical-body')),b=bounds(document.querySelector('.garden-cucumber-morph'));
      return Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y),Math.abs(a.width-b.width),Math.abs(a.height-b.height));
    });
    expect(bodyAlignment).toBeLessThan(2);
  }
  await page.locator('[data-garden-done]').click();await expect(page.locator('#garden-dialog')).toBeHidden();
  expect(await snapshot(page)).toEqual(before);
  await page.locator('#picture-open').click();await expect(page.locator('.garden-canonical')).toHaveCSS('opacity','1');
  await expect(page.locator('.garden-piece-cucumber .garden-art-path')).toHaveCSS('opacity','0');
});

test('every earned piece settles into the garden once and leaves the construction intact',async({page})=>{
  test.setTimeout(240000);
  await page.emulateMedia({reducedMotion:'no-preference'});
  const pieces=[[82,'H'],[72,'H'],[73,'IH'],[74,'NAHH'],[75,'HQNAQ'],[83,'Q'],[76,'ASAH'],[77,'HQQQNAHH']];
  for(const [index,[id,ops]] of pieces.entries()) {
    await page.goto('/about/');await ready(page,id);
    for(const op of ops){await page.locator(`[data-op="${op}"]`).click();await idle(page);}
    const before=await page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history}));
    await page.evaluate(()=>{
      window.__gardenTransitions=[];
      window.__gardenTransitionListener=event=>{
        const target=event.target instanceof Element?event.target:null,piece=target?.closest('.garden-piece.is-new-piece');
        if(target?.classList.contains('garden-piece-art')&&piece)window.__gardenTransitions.push({source:piece.dataset.gardenPiece,property:event.propertyName});
      };
      document.addEventListener('transitionrun',window.__gardenTransitionListener);
    });
    await page.locator('#launch').click();await expect(page.locator(`.garden-shell[data-garden-reveal="${id}"]`)).toBeVisible();
    await expect(page.locator('.garden-piece.is-new-piece')).toHaveCount(1);
    await expect(page.locator(`.garden-piece.is-new-piece`)).toHaveAttribute('data-garden-piece',String(id));
    await expect(page.locator('.garden-shell')).toHaveClass(/trace-complete/);
    expect(await page.evaluate(source=>{
      document.removeEventListener('transitionrun',window.__gardenTransitionListener);
      return window.__gardenTransitions.some(event=>event.source===String(source)&&(event.property==='transform'||event.property==='opacity'));
    },id),`piece ${id} runs its placement transition`).toBe(true);
    await expect(page.locator('.is-new-piece .garden-piece-art')).toHaveCSS('opacity','1');
    await expect(page.locator('[data-garden-piece][data-complete="true"]')).toHaveCount(index+1);
    if(id===77)await expect(page.locator('.garden-canonical')).toHaveCSS('opacity','1');
    expect(await page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history}))).toEqual(before);
    await page.locator('[data-garden-done]').click();await expect(page.locator('#launch')).toHaveText(id===77?'Mastery challenge':'Next puzzle');
    await page.locator('#rethrow').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
    await expect(page.locator('#garden-dialog')).toBeHidden();
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('angouri:vine:v1:progress')).completed)).toEqual(pieces.slice(0,index+1).map(([source])=>source));
  }
});
