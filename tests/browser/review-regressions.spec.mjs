import {test,expect} from '@playwright/test';

const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
async function ready(page,level,view='flight') {
  await page.goto('/about/');await page.evaluate(()=>localStorage.clear());await page.goto(`/#level=${level}&view=${view}`);
  await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
  expect(await page.evaluate(()=>window.angouri.state.sourceId)).toBe(level);
}
async function place(page,op) {await page.locator(`[data-op="${op}"]`).click();await idle(page);}

test('compact Flow exposes a complete area relationship and preserves inspection after edits',async({page})=>{
  for(const viewport of [{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(viewport);await ready(page,37,'flow');await place(page,'A');
    const sizes=await page.locator('.flow-line').evaluate(line=>({height:line.clientHeight,
      cards:[...line.querySelectorAll('.flow-machine')].map(card=>card.getBoundingClientRect().height),
      pageWidth:document.documentElement.scrollWidth,viewport:innerWidth}));
    expect(sizes.height).toBeGreaterThanOrEqual(Math.max(...sizes.cards));
    expect(sizes.pageWidth).toBeLessThanOrEqual(sizes.viewport);
    await page.locator('#flow-position').fill('4');await page.locator('#flow-position').dispatchEvent('input');
    await page.locator('.flow-line').evaluate(line=>{line.scrollTop=80;line.scrollLeft=80;});
    const scroll=await page.locator('.flow-line').evaluate(line=>[line.scrollLeft,line.scrollTop]);
    await page.locator('#tab-function').click();await page.locator('#tab-flow').click();
    await expect(page.locator('#flow-position')).toHaveValue('4');
    expect(await page.locator('.flow-line').evaluate(line=>[line.scrollLeft,line.scrollTop])).toEqual(scroll);
    await page.locator('#undo').click();await idle(page);await page.locator('#redo').click();await idle(page);
    await expect(page.locator('#flow-position')).toHaveValue('4');
    expect(await page.locator('.flow-line').evaluate(line=>[line.scrollLeft,line.scrollTop])).toEqual(scroll);
  }
});

test('normal-motion keyboard Throw and Rethrow keep an action focus without taking it from another view',async({page})=>{
  test.setTimeout(90000);await page.emulateMedia({reducedMotion:'no-preference'});
  await ready(page,1);await place(page,'H');await page.locator('#launch').focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await expect(page.locator('#launch')).toBeFocused();
  await page.locator('#rethrow').focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.angouri.flight.phase==='flying');
  await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await expect(page.locator('#rethrow')).toBeFocused();
  await page.locator('#launch').focus();await page.keyboard.press('Enter');await idle(page);
  expect(await page.evaluate(()=>window.angouri.state.sourceId)).toBe(2);
  await ready(page,3);await place(page,'A');await page.locator('#launch').focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.angouri.flight.phase==='flying');await page.locator('#tab-flow').focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await expect(page.locator('#tab-flow')).toBeFocused();
});

test('library failures stay visible, preserve data, and clear after recovery',async({page})=>{
  await ready(page,3);await place(page,'H');await page.locator('#menu-open').click();await page.locator('#library-open').click();
  await page.locator('#seed-name').fill('Kept recipe');await page.keyboard.press('Enter');await idle(page);
  const original=await page.evaluate(()=>localStorage.getItem('angouri:vine:v1:seeds'));
  await page.evaluate(()=>{window.nativeStorageWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){
    if(key.endsWith(':seeds'))throw new DOMException('test quota','QuotaExceededError');return window.nativeStorageWrite.call(this,key,value);
  };});
  await page.locator('#seed-name').fill('Recovered recipe');await page.locator('#favorite-save').focus();await page.keyboard.press('Enter');await idle(page);
  await expect(page.locator('#library-error')).toBeVisible();await expect(page.locator('#favorite-save')).toBeFocused();
  await expect(page.locator('#seed-name')).toHaveValue('Recovered recipe');
  await page.locator('[data-delete-seed="0"]').click();await expect(page.locator('.favorite-error')).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('angouri:vine:v1:seeds'))).toBe(original);
  await page.evaluate(()=>Storage.prototype.setItem=window.nativeStorageWrite);
  await page.locator('#favorite-save').click();await idle(page);await expect(page.locator('.favorite-name')).toHaveCount(2);
  await expect(page.locator('#library-error')).toBeHidden();await page.keyboard.press('Escape');
  await expect(page.locator('#feedback')).not.toHaveClass(/error/);
  await page.locator('#menu-open').click();await page.locator('#library-open').click();
  for(let i=2;i<12;i++){await page.locator('#seed-name').fill(`Recipe ${i}`);await page.keyboard.press('Enter');await idle(page);}
  await page.locator('#seed-name').fill('Too many');await page.keyboard.press('Enter');await idle(page);
  await expect(page.locator('#library-error')).toContainText('full');await expect(page.locator('#seed-name')).toHaveValue('Too many');
  await page.locator('[data-delete-seed="0"]').click();await expect(page.locator('.favorite-name')).toHaveCount(11);
  await expect(page.locator('#library-error')).toBeHidden();await page.keyboard.press('Escape');
  await expect(page.locator('#feedback')).not.toHaveClass(/error/);
});

test('nonlinear-phase discovery distinguishes input spacing from output folding',async({page})=>{
  await ready(page,84);await expect(page.locator('#hints-open')).toBeHidden();
  await page.locator('[data-empty="2"]').click();await place(page,'Q');
  expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(false);
  await expect(page.locator('#feedback')).toContainText('zero positions stay fixed');
  await page.locator('#undo').click();await idle(page);
  await page.locator('[data-empty="0"]').click();await place(page,'Q');
  expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);
  await expect(page.locator('#feedback')).toContainText('crests crowd closer');
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
  await page.locator('#launch').click();await idle(page);expect(await page.evaluate(()=>window.angouri.state.sourceId)).toBe(55);
});

test('dense Flight coordinates fit whole and keep a stable target frame through editing',async({page})=>{
  test.setTimeout(180000);
  for(const viewport of [{width:1365,height:900},{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(viewport);
    for(const source of [64,84]) {
      await ready(page,source);
      const frame=await page.locator('.ring-outer').evaluateAll(rings=>rings.map(ring=>[ring.getAttribute('cx'),ring.getAttribute('cy')]));
      if(source===64){await page.locator('#circle-fit').click();expect(await page.locator('.ring-outer').evaluateAll(rings=>rings.map(ring=>[ring.getAttribute('cx'),ring.getAttribute('cy')]))).not.toEqual(frame);await page.locator('#circle-fit').click();}
      if(source===84)await page.locator('[data-empty="0"]').click();
      for(const op of source===64?'DSQHA':'Q')await place(page,op);
      expect(await page.locator('.ring-outer').evaluateAll(rings=>rings.map(ring=>[ring.getAttribute('cx'),ring.getAttribute('cy')]))).toEqual(frame);
      const measured=await page.locator('#scene').evaluate(scene=>{
        const boundary=scene.getBoundingClientRect(),labels=[...scene.querySelectorAll('.target-label .katex-html')].map(el=>el.getBoundingClientRect());
        return {inside:labels.every(r=>r.left>=boundary.left&&r.right<=boundary.right&&r.top>=boundary.top&&r.bottom<=boundary.bottom),
          overlap:labels.some((a,i)=>labels.slice(i+1).some(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)),
          pageWidth:document.documentElement.scrollWidth,viewport:innerWidth};
      });
      expect(measured.inside).toBe(true);expect(measured.overlap).toBe(false);expect(measured.pageWidth).toBeLessThanOrEqual(measured.viewport);
      await page.locator('#tab-flow').click();await expect(page.locator('#scene')).not.toHaveClass(/has-flight-callouts/);
    }
  }
});

test('implicit calculus describes the incoming squared height before solving both branches',async({page})=>{
  await ready(page,85,'flow');await expect(page.locator('#chapter-step')).toContainText('FINAL MASTERY');
  let before=0,after=6,onOutput=false;
  for(const op of 'DAHFISQ') {
    if(op==='I'){onOutput=true;continue;}
    await page.locator(`[data-empty="${onOutput?after++:before++}"]`).click();await place(page,op);
  }
  expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);
  await expect(page.locator('.tangent-sample > .katex annotation')).toContainText('\\mathrm{d}(h^2)');
  await expect(page.locator('.slope-scene h3')).toContainText('Squared height');
  await expect(page.locator('.amount-scene h3')).toContainText('Squared height');
  await expect(page.locator('.wave-scene h3 annotation')).toHaveText('h^2');
  await page.locator('#flow-position').fill('2');await page.locator('#flow-position').dispatchEvent('input');
  await expect(page.locator('.slope-scene [data-station-picture]')).toHaveAttribute('aria-label',/Input squared height 2/);
  await expect(page.locator('.katex-error')).toHaveCount(0);
});

test('Flow zero glyphs stay on their own baselines after compact reflow and scrolling',async({page})=>{
  await ready(page,37,'flow');await place(page,'A');
  for(const viewport of [{width:1365,height:900},{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(viewport);
    await page.locator('.flow-line').evaluate(line=>{line.scrollTop=line.scrollHeight;line.scrollLeft=line.scrollWidth;});
    await expect(page.locator('.flow-plot foreignObject')).toHaveCount(0);
    await expect.poll(()=>page.locator('[data-flow-zero]').evaluateAll(labels=>labels.every(label=>{
      const svg=label.parentElement.querySelector('svg'),m=svg.getScreenCTM(),r=label.querySelector('.katex-html').getBoundingClientRect();
      return Math.abs(r.left+r.width/2-(m.e+12*m.a))<3&&Math.abs(r.top+r.height/2-(m.f+Number(label.dataset.flowZero)*m.d))<3;
    }))).toBe(true);
  }
});

test('a failed known puzzle load preserves the link and prior progress for Retry',async({page})=>{
  await ready(page,1);await place(page,'H');await page.locator('#launch').click();
  await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
  const saved=await page.evaluate(()=>localStorage.getItem('angouri:vine:v1:progress'));
  await page.addInitScript(()=>{
    const post=Worker.prototype.postMessage;let failed=false;
    Worker.prototype.postMessage=function(message,...rest){
      if(!failed&&message.request?.action?.sourceId===84){
        failed=true;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'result',id:message.id,milliseconds:0,response:{status:'error',message:'Test: interrupted while opening the puzzle.'}}})));return;
      }
      return post.call(this,message,...rest);
    };
  });
  await page.goto('/about/');await page.goto('/#level=84&view=flight');
  await expect(page.locator('#retry-engine')).toBeVisible();
  expect(await page.evaluate(()=>window.angouri.state)).toBeUndefined();
  expect(await page.evaluate(()=>localStorage.getItem('angouri:vine:v1:progress'))).toBe(saved);
  expect(new URL(page.url()).hash).toBe('#level=84&view=flight');
  await page.locator('#retry-engine').click();
  await page.waitForFunction(()=>window.angouri?.state?.sourceId===84&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('angouri:vine:v1:progress')).completed)).toEqual([1]);
  await expect(page.locator('#retry-engine')).toHaveCount(0);
});

test('a failed matching workspace restore retries its placed blocks instead of the bare level',async({page})=>{
  await ready(page,3,'flow');await place(page,'A');
  const saved=await page.evaluate(()=>localStorage.getItem('angouri:vine:v1:progress'));
  const snapshot=JSON.parse(saved);
  expect(snapshot.state.nodes).toHaveLength(1);
  expect(snapshot.entry).toBe(new URL(page.url()).hash);
  await page.addInitScript(()=>{
    const post=Worker.prototype.postMessage;let failed=false;
    Worker.prototype.postMessage=function(message,...rest){
      if(!failed&&message.request?.action?.type==='evaluate'&&message.request.state?.sourceId===3){
        failed=true;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'result',id:message.id,milliseconds:0,response:{status:'error',message:'Test: interrupted while restoring the recipe.'}}})));return;
      }
      return post.call(this,message,...rest);
    };
  });
  await page.reload();await expect(page.locator('#retry-engine')).toBeVisible();
  expect(await page.evaluate(()=>window.angouri.state)).toBeUndefined();
  expect(await page.evaluate(()=>localStorage.getItem('angouri:vine:v1:progress'))).toBe(saved);
  expect(new URL(page.url()).hash).toBe(snapshot.entry);
  await page.locator('#retry-engine').click();
  await page.waitForFunction(()=>window.angouri?.state?.sourceId===3&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
  expect(await page.evaluate(()=>window.angouri.state)).toEqual(snapshot.state);
  expect(await page.evaluate(()=>window.angouri.slots)).toEqual(snapshot.slots);
  expect(await page.evaluate(()=>window.angouri.view)).toBe(snapshot.view);
  expect(await page.evaluate(()=>localStorage.getItem('angouri:vine:v1:progress'))).toBe(saved);
  await expect(page.locator('#retry-engine')).toHaveCount(0);
});
