import {test,expect} from '@playwright/test';

const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
async function ready(page,id=72) {
  await page.goto(`/#level=${id}&view=flight`);
  await page.waitForFunction(()=>window.angouri?.state&&document.querySelector('#playground')?.getAttribute('aria-busy')==='false');
}
const snapshot=page=>page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history,progress:localStorage.getItem('angouri:vine:v1:progress')}));
const screenPoint=(page,x,y)=>page.locator('.garden-paper').evaluate((svg,[x,y])=>{
  const point=new DOMPoint(x,y).matrixTransform(svg.getScreenCTM());return {x:point.x,y:point.y};
},[x,y]);
async function hoverCurve(page,id) {
  const point=await page.locator(`[data-garden-piece="${id}"] .garden-art-path`).first().evaluate(path=>{
    const id=path.closest('[data-garden-piece]').dataset.gardenPiece,factor=id==='73'?.8:id==='82'?.08:.37;
    const p=path.getPointAtLength(path.getTotalLength()*factor),screen=new DOMPoint(p.x,p.y).matrixTransform(path.getScreenCTM());
    return {x:screen.x,y:screen.y};
  });
  await page.mouse.move(point.x,point.y);
  await expect(page.locator('.garden-piece.is-pointed')).toHaveAttribute('data-garden-piece',String(id));
}

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
  await expect(page.locator('#garden-dialog')).toBeFocused();
  await expect(page.locator('.garden-piece:focus-visible')).toHaveCount(0);
  await expect(page.locator('[data-garden-piece][data-complete="true"]')).toHaveCount(0);
  await expect(page.locator('.garden-status')).toContainText('0 of 8');
  for(const id of [82,72,73,74,75,83,76,77]) {
    await hoverCurve(page,id);
  }
  expect(await snapshot(page)).toEqual(before);
  await page.locator('[data-garden-piece="75"]').focus();await page.keyboard.press('Enter');await idle(page);
  expect(await page.evaluate(()=>window.angouri.state.sourceId)).toBe(75);
  await expect(page.locator('#garden-dialog')).toBeHidden();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('angouri:vine:v1:progress')).completed)).toEqual([]);
});

test('garden Tab order follows labels across the top and bottom without changing paint order',async({page})=>{
  for(const size of [{width:1146,height:850},{width:320,height:568}]) {
    await page.setViewportSize(size);await ready(page);const before=await snapshot(page);
    await page.locator('#picture-open').focus();await page.keyboard.press('Space');await expect(page.locator('[data-garden-piece]')).toHaveCount(8);
    const paint=await page.locator('[data-garden-piece]').evaluateAll(es=>es.map(el=>Number(el.dataset.gardenPiece)));
    expect(paint).toEqual([74,76,72,82,75,73,83,77]);
    const order=['#garden-back',...[74,77,83,73,75,76,72,82].map(id=>`[data-garden-piece="${id}"]`),'[data-garden-done]'];
    await expect(page.locator(order[0])).toBeFocused();
    for(const selector of [...order.slice(1),order[0]]){await page.keyboard.press('Tab');await expect(page.locator(selector)).toBeFocused();}
    for(const selector of [...order].reverse()){await page.keyboard.press('Shift+Tab');await expect(page.locator(selector)).toBeFocused();}
    expect(await page.locator('[data-garden-piece]').evaluateAll(es=>es.map(el=>Number(el.dataset.gardenPiece)))).toEqual(paint);
    expect(await snapshot(page)).toEqual(before);await page.keyboard.press('Escape');
  }
});

test('a keyboard picture completion waits for collection then focuses Done before Next',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await ready(page,82);await page.locator('[data-op="H"]').click();await idle(page);
  await page.keyboard.press('Enter');await expect(page.locator('#garden-dialog')).toBeVisible();
  await expect(page.locator('[data-garden-done]')).toBeDisabled();await expect(page.locator('#launch')).toHaveAttribute('data-action','throw');await expect(page.locator('#launch')).toBeDisabled();
  await expect(page.locator('[data-garden-done]')).toBeEnabled();await expect(page.locator('[data-garden-done]')).toBeFocused();await expect(page.locator('.garden-collection')).toHaveCount(0);
  await expect(page.locator('#launch')).toHaveAttribute('data-action','continue');await page.keyboard.press('Space');await expect(page.locator('#garden-dialog')).toBeHidden();await expect(page.locator('#launch')).toBeFocused();
  await page.keyboard.press('Space');await idle(page);expect(await page.evaluate(()=>window.angouri.state.sourceId)).toBe(72);
});

test('garden completion honors deliberate focus navigation and reduced motion',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await ready(page,82);await page.locator('[data-op="H"]').click();await idle(page);await page.keyboard.press('Enter');
  await expect(page.locator('[data-garden-piece]')).toHaveCount(8);await page.keyboard.press('Tab');const moon=page.locator('[data-garden-piece="74"]');await expect(moon).toBeFocused();
  await expect(page.locator('[data-garden-done]')).toBeEnabled();await expect(moon).toBeFocused();await page.keyboard.press('Escape');await expect(page.locator('#launch')).toBeFocused();
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/about/');await page.evaluate(()=>localStorage.clear());await ready(page,82);await page.locator('[data-op="H"]').click();await idle(page);await page.keyboard.press('Enter');
  await expect(page.locator('[data-garden-done]')).toBeEnabled();await expect(page.locator('[data-garden-done]')).toBeFocused();await expect(page.locator('.garden-collection')).toHaveCount(0);
});

test('the cucumber completion waits for its final artwork crossfade before enabling Done',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await ready(page,77);
  for(const op of 'HQQQNAHH'){await page.locator(`[data-op="${op}"]`).click();await idle(page);}
  await page.keyboard.press('Enter');await expect(page.locator('#garden-dialog')).toBeVisible();
  await expect(page.locator('[data-garden-done]')).toBeDisabled();
  await expect(page.locator('.garden-shell')).toHaveClass(/show-canonical/);
  await expect(page.locator('[data-garden-done]')).toBeDisabled();await expect(page.locator('#launch')).toBeDisabled();
  await expect(page.locator('[data-garden-done]')).toBeEnabled();await expect(page.locator('[data-garden-done]')).toBeFocused();
  await expect(page.locator('.garden-canonical')).toHaveCSS('opacity','1');await expect(page.locator('.garden-canonical')).toHaveCSS('filter','none');
  await expect(page.locator('.garden-piece-cucumber .garden-art-path')).toHaveCSS('opacity','0');await expect(page.locator('.garden-collection')).toHaveCount(0);
  await expect(page.locator('#launch')).toHaveAttribute('data-action','continue');
});

test('earned curves reveal the cucumber, preserve the recipe, and fit compact layouts',async({page})=>{
  test.setTimeout(180000);await ready(page,77);
  await page.evaluate(()=>{const key='angouri:vine:v1:progress',save=JSON.parse(localStorage.getItem(key));save.completed=[82,72,73,74,75,83,76];localStorage.setItem(key,JSON.stringify(save));});
  await page.reload();await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
  for(const op of 'HQQQNAHH'){await page.locator(`[data-op="${op}"]`).click();await idle(page);}
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
  await expect(page.locator('[data-garden-piece][data-complete="true"]')).toHaveCount(8);
  await expect(page.locator('.garden-canonical')).toHaveCSS('opacity','1');
  await expect(page.locator('.garden-shell')).toHaveClass(/trace-complete/);await expect(page.locator('.garden-shell')).toHaveClass(/show-canonical/);
  for(const piece of ['moon','leaf','bank'])await expect(page.locator(`.garden-piece-${piece} .garden-piece-fill`)).toHaveCSS('opacity','1');
  const before=await snapshot(page);
  for(const [width,height] of [[1440,900],[390,844],[320,568],[844,390]]){
    await page.setViewportSize({width,height});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const board=await page.locator('.garden-board').boundingBox();expect(board.width).toBeGreaterThan(220);expect(board.height).toBeGreaterThan(110);
    for(const tile of await page.locator('[data-garden-piece]').all()){
      await tile.scrollIntoViewIfNeeded();
      await hoverCurve(page,await tile.getAttribute('data-garden-piece'));
      const label=tile.locator('.garden-piece-label');
      expect(await label.evaluate(el=>{const b=el.getBoundingClientRect();return document.elementFromPoint(b.left+b.width/2,b.top+b.height/2)?.closest('[data-garden-piece]')===el.closest('[data-garden-piece]');})).toBe(true);
      const labelClearance=await tile.evaluate(el=>{
        const label=el.querySelector('.garden-piece-label').getBoundingClientRect();
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
      const a=bounds(document.querySelector('.garden-canonical-body')),b=bounds(document.querySelector('.garden-piece-cucumber .garden-art-path'));
      return Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y),Math.abs(a.width-b.width),Math.abs(a.height-b.height));
    });
    expect(bodyAlignment).toBeLessThan(2);
  }
  await page.locator('[data-garden-done]').click();await expect(page.locator('#garden-dialog')).toBeHidden();
  expect(await snapshot(page)).toEqual(before);
  await page.locator('#picture-open').click();await expect(page.locator('.garden-canonical')).toHaveCSS('opacity','1');
  await expect(page.locator('.garden-piece-cucumber .garden-art-path')).toHaveCSS('opacity','0');
});

test('nearest garden shapes own pointer hover and clicks independently of drawing order',async({page})=>{
  test.setTimeout(120000);await ready(page);
  for(const completed of [[],[82,72,73,74,75,83,76,77]]) {
    await page.evaluate(completed=>{
      const key='angouri:vine:v1:progress',save=JSON.parse(localStorage.getItem(key));save.completed=completed;localStorage.setItem(key,JSON.stringify(save));
    },completed);
    await page.reload();await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
    await page.locator('#picture-open').click();await expect(page.locator('[data-garden-piece]')).toHaveCount(8);
    const before=await snapshot(page);
    for(const [width,height] of [[1440,900],[390,844],[844,390]]) {
      await page.setViewportSize({width,height});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      // The vine's old box covered all three first positions; the closest
      // bamboo or cucumber must win. Ripple also reaches beyond its old box.
      for(const [x,y,id] of [[628,200,82],[636,170,82],[600,200,77],[240,350,76],[396,347,76],[156,92,74],[550,50,83],[80,335,75]]) {
        const point=await screenPoint(page,x,y);await page.mouse.move(point.x,point.y);
        await expect(page.locator('.garden-piece.is-pointed'),`${x},${y} at ${width}px`).toHaveAttribute('data-garden-piece',String(id));
        await expect(page.locator('.garden-piece.is-pointed .garden-piece-label rect')).toHaveCSS('stroke-width','2px');
      }
      const gap=await screenPoint(page,400,-31);await page.mouse.click(gap.x,gap.y);
      await expect(page.locator('.garden-piece.is-pointed')).toHaveCount(0);
      await expect(page.locator('#garden-dialog')).toBeVisible();
      expect(await snapshot(page)).toEqual(before);
    }
    // Reversing the shape groups cannot change geometric ownership.
    await page.evaluate(()=>{
      const paper=document.querySelector('.garden-paper');
      [...paper.querySelectorAll('[data-garden-piece]')].reverse().forEach(piece=>paper.append(piece));
    });
    for(const [x,y,id] of [[636,170,82],[600,200,77],[240,350,76]]) {
      const point=await screenPoint(page,x,y);await page.mouse.click(point.x,point.y);await idle(page);
      expect(await page.evaluate(()=>window.angouri.state.sourceId)).toBe(id);
      await expect(page.locator('#garden-dialog')).toBeHidden();
      await page.locator('#picture-open').click();await expect(page.locator('[data-garden-piece]')).toHaveCount(8);
    }
    // A label's explicit destination always wins, even far from its artwork.
    await page.locator('[data-garden-piece="77"] .garden-piece-label').click();await idle(page);
    expect(await page.evaluate(()=>window.angouri.state.sourceId)).toBe(77);
    await page.locator('#picture-open').click();await expect(page.locator('[data-garden-piece]')).toHaveCount(8);
    await page.locator('[data-garden-piece="73"]').focus();await page.keyboard.press('Space');await idle(page);
    expect(await page.evaluate(()=>window.angouri.state.sourceId)).toBe(73);
  }
});

test('touch selects the closest shape without a preceding hover',async({browser,baseURL})=>{
  const context=await browser.newContext({baseURL,hasTouch:true,viewport:{width:390,height:844},reducedMotion:'reduce'});
  const page=await context.newPage();
  try {
    await ready(page);await page.locator('#picture-open').tap();await expect(page.locator('[data-garden-piece]')).toHaveCount(8);
    const point=await screenPoint(page,636,170);await page.touchscreen.tap(point.x,point.y);await idle(page);
    expect(await page.evaluate(()=>window.angouri.state.sourceId)).toBe(82);
    await expect(page.locator('#garden-dialog')).toBeHidden();
  } finally {await context.close();}
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
      window.__gardenFrames=[];
      let began=false;
      const observe=()=>{
        const overlay=document.querySelector('.garden-collection'),path=overlay?.querySelector('path');
        if(path) {
          began=true;
          const first=path.getPointAtLength(0),source=document.querySelector('#flight-trail'),p=source.getPointAtLength(0),original=new DOMPoint(p.x,p.y).matrixTransform(source.getScreenCTM());
          window.__gardenFrames.push({arrival:Number(document.querySelector('#garden-dialog').style.getPropertyValue('--garden-arrival')),x:first.x,y:first.y,startDistance:Math.hypot(first.x-original.x,first.y-original.y)});
        }
        if(!began||overlay)requestAnimationFrame(observe);
      };
      requestAnimationFrame(observe);
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
    await expect(page.locator('.is-new-piece .garden-piece-art')).toHaveCSS('opacity','1');
    expect(await page.evaluate(source=>{
      document.removeEventListener('transitionrun',window.__gardenTransitionListener);
      return window.__gardenTransitions.some(event=>event.source===String(source)&&(event.property==='transform'||event.property==='opacity'));
    },id),`piece ${id} runs its placement transition`).toBe(true);
    await expect(page.locator('[data-garden-piece][data-complete="true"]')).toHaveCount(index+1);
    if(id===77)await expect(page.locator('.garden-canonical')).toHaveCSS('opacity','1');
    await expect(page.locator('.garden-collection')).toHaveCount(0);
    const frames=await page.evaluate(()=>window.__gardenFrames);
    expect(frames[0].arrival).toBe(0);expect(frames[0].startDistance).toBeLessThan(1);
    expect(frames.some(frame=>frame.arrival>.1&&frame.arrival<.9),`piece ${id} fades the picture gradually`).toBe(true);
    expect(Math.max(...frames.slice(1).map((frame,i)=>frame.arrival-frames[i].arrival)),`piece ${id} never jumps through the fade`).toBeLessThan(.2);
    expect(frames.at(-1).arrival).toBe(1);
    expect(new Set(frames.map(frame=>`${Math.round(frame.x)},${Math.round(frame.y)}`)).size).toBeGreaterThan(4);
    expect(await page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history}))).toEqual(before);
    await page.locator('[data-garden-done]').click();await expect(page.locator('#launch')).toHaveAccessibleName(id===77?'Mastery challenge':'Next puzzle');
    await page.locator('#rethrow').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
    await expect(page.locator('#garden-dialog')).toBeHidden();
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('angouri:vine:v1:progress')).completed)).toEqual(pieces.slice(0,index+1).map(([source])=>source));
  }
});

test('collection can be dismissed during transfer and reduced motion skips the transition',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await ready(page,82);
  await page.locator('[data-op="H"]').click();await idle(page);
  await page.locator('#launch').click();await expect(page.locator('.garden-collection')).toBeAttached();
  const before=await snapshot(page);
  await page.keyboard.press('Escape');await expect(page.locator('#garden-dialog')).toBeHidden();
  await expect(page.locator('.garden-collection')).toHaveCount(0);
  await expect(page.locator('#garden-dialog')).not.toHaveClass(/is-collecting/);
  expect(await snapshot(page)).toEqual(before);
  await page.locator('#picture-open').click();await expect(page.locator('[data-garden-piece="82"]')).toHaveAttribute('data-complete','true');
  await expect(page.locator('.garden-collection')).toHaveCount(0);
  await expect(page.locator('.garden-shell')).toHaveCSS('opacity','1');
  await page.locator('[data-garden-done]').click();
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/about/');await ready(page,83);
  await page.locator('[data-op="Q"]').click();await idle(page);await page.locator('#launch').click();
  await expect(page.locator('.garden-shell')).toHaveClass(/trace-complete/);
  await expect(page.locator('.garden-collection')).toHaveCount(0);
  await expect(page.locator('.garden-shell')).toHaveCSS('opacity','1');
  await expect(page.locator('.garden-piece-flower .garden-piece-art')).toHaveCSS('opacity','1');
});

test('collection works from Flow and Equation without changing the selected view',async({page})=>{
  test.setTimeout(90000);await page.emulateMedia({reducedMotion:'no-preference'});
  for(const [name,id,op] of [['Flow',82,'H'],['Equation',83,'Q']]) {
    await page.goto('/about/');await ready(page,id);
    await page.locator(`[data-op="${op}"]`).click();await idle(page);
    await page.getByRole('tab',{name,exact:true}).click();
    if(name==='Flow')await page.locator('.flow-machine').last().scrollIntoViewIfNeeded();
    const start=name==='Flow'?await page.locator('.flow-machine').last().locator('.flow-curve').evaluate(path=>{
      const p=path.getPointAtLength(0),point=new DOMPoint(p.x,p.y).matrixTransform(path.getScreenCTM());return {x:point.x,y:point.y};
    }):undefined;
    const before=await page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history}));
    await page.locator('#launch').click();await expect(page.locator('.garden-collection')).toBeAttached();
    if(start) {
      const distance=await page.locator('.garden-collection path').first().evaluate((path,start)=>{
        const point=path.getPointAtLength(0);return Math.hypot(point.x-start.x,point.y-start.y);
      },start);
      expect(distance).toBeLessThan(1);
    }
    await expect(page.locator('.garden-shell')).toHaveClass(/trace-complete/);
    await expect(page.locator('.garden-collection')).toHaveCount(0);
    await expect(page.locator('.is-new-piece .garden-piece-art')).toHaveCSS('opacity','1');
    await page.locator('[data-garden-done]').click();
    await expect(page.getByRole('tab',{name,exact:true})).toHaveAttribute('aria-selected','true');
    expect(await page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history}))).toEqual(before);
  }
});
