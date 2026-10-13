import {test,expect} from '@playwright/test';
import {STORAGE_KEYS,clearStorage,readStorage,readStoredJSON,failStorageWrites,restoreStorageWrites} from './storage-fixtures.mjs';

const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
const mirror=(page,key)=>page.evaluate(key=>localStorage.getItem(key),key);
async function ready(page,level,view='flight') {
  await page.goto('/about/');await clearStorage(page);await page.goto(`/#level=${level}&view=${view}`);
  await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
  expect(await page.evaluate(()=>window.angouri.state.sourceId)).toBe(level);
}
async function place(page,op) {await page.locator(`[data-op="${op}"]`).click();await idle(page);}
// Dense Flight fills its scene. Only a scene shorter than the smallest usable
// plot plus both callout rows may scroll, and then only within itself: every
// whole coordinate must be visible at the top or bottom scroll position.
async function denseFlightReach(page) {
  const reach=await page.locator('#scene').evaluate(scene=>{
    const diagram=scene.querySelector('.flight-diagram'),style=getComputedStyle(diagram),saved=scene.scrollTop;
    const s=scene.getBoundingClientRect(),dock=document.querySelector('.play-dock').getBoundingClientRect();
    const inside=r=>r.left>=s.left-1&&r.right<=s.right+1&&r.top>=s.top-1&&r.bottom<=s.bottom+1;
    const labels=()=>[...scene.querySelectorAll('.target-label .katex-html')].map(label=>label.getBoundingClientRect());
    const visible=labels().map(()=>false);
    for(const top of [0,scene.scrollHeight]){scene.scrollTop=top;labels().forEach((r,i)=>{if(inside(r))visible[i]=true;});}
    scene.scrollTop=saved;
    return {
      cramped:parseFloat(style.minHeight)>scene.clientHeight+1,scrolls:scene.scrollHeight>scene.clientHeight+1,
      overflowY:getComputedStyle(scene).overflowY,diagramHeight:diagram.getBoundingClientRect().height,minHeight:parseFloat(style.minHeight),
      plotHeight:scene.querySelector('#flight-svg').getBoundingClientRect().height,
      reachable:visible.every(Boolean),labels:visible.length,
      sceneOverlapsRecipe:Math.min(s.right,dock.right)-Math.max(s.left,dock.left)>1&&Math.min(s.bottom,dock.bottom)-Math.max(s.top,dock.top)>1,
      page:[document.documentElement.scrollWidth-innerWidth,document.documentElement.scrollHeight-innerHeight]
    };
  });
  expect(reach.labels).toBeGreaterThan(0);expect(reach.reachable).toBe(true);
  expect(reach.plotHeight).toBeGreaterThanOrEqual(189);expect(reach.sceneOverlapsRecipe).toBe(false);
  expect(reach.page[0]).toBeLessThanOrEqual(0);expect(reach.page[1]).toBeLessThanOrEqual(0);
  // A fitting diagram never scrolls; a cramped one keeps only its minimum.
  expect(reach.scrolls).toBe(reach.cramped);
  if(reach.cramped){expect(reach.overflowY).toBe('auto');expect(Math.abs(reach.diagramHeight-reach.minHeight)).toBeLessThan(1);}
  return reach;
}

test('compact Flow exposes a complete area relationship and preserves inspection after edits',async({page})=>{
  for(const viewport of [{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(viewport);await ready(page,37,'flow');await place(page,'A');
    const sizes=await page.locator('.flow-line').evaluate(line=>({height:line.clientHeight,scrollHeight:line.scrollHeight,
      pageWidth:document.documentElement.scrollWidth,pageHeight:document.documentElement.scrollHeight,viewport:[innerWidth,innerHeight]}));
    expect(sizes.scrollHeight).toBeGreaterThan(sizes.height);
    expect(sizes.pageWidth).toBeLessThanOrEqual(sizes.viewport[0]);
    expect(sizes.pageHeight).toBeLessThanOrEqual(sizes.viewport[1]);
    const reach=await page.locator('.flow-line').evaluate(line=>{
      const first=line.querySelector('.flow-machine'),last=line.querySelector('.flow-machine:last-child'),frame=line.getBoundingClientRect();
      const firstTop=first.getBoundingClientRect().top;line.scrollTop=line.scrollHeight;
      return {firstTop,frameTop:frame.top,lastBottom:last.getBoundingClientRect().bottom,frameBottom:frame.bottom,scrollTop:line.scrollTop};
    });
    expect(reach.firstTop).toBeGreaterThanOrEqual(reach.frameTop);
    expect(reach.lastBottom).toBeLessThanOrEqual(reach.frameBottom+1);
    expect(reach.scrollTop).toBeGreaterThan(0);
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
  await ready(page,1);await place(page,'H');await page.locator('#launch').focus();await page.keyboard.press('Space');
  await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await expect(page.locator('#launch')).toBeFocused();
  await page.locator('#rethrow').focus();await page.keyboard.press('Space');
  await page.waitForFunction(()=>window.angouri.flight.phase==='flying');
  await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await expect(page.locator('#rethrow')).toBeFocused();
  await page.locator('#launch').focus();await page.keyboard.press('Space');await idle(page);
  expect(await page.evaluate(()=>window.angouri.state.sourceId)).toBe(2);
  await ready(page,3);await place(page,'A');await page.locator('#launch').focus();await page.keyboard.press('Space');
  await page.waitForFunction(()=>window.angouri.flight.phase==='flying');await page.locator('#tab-flow').focus();await page.keyboard.press('Space');
  await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await expect(page.locator('#tab-flow')).toBeFocused();
});

test('library failures stay visible, preserve data, and clear after recovery',async({page})=>{
  await ready(page,3);await place(page,'H');await page.locator('#menu-open').click();await page.locator('#library-open').click();
  await page.locator('#seed-name').fill('Kept recipe');await page.keyboard.press('Enter');await idle(page);
  const original=await readStorage(page,STORAGE_KEYS.seeds);
  await failStorageWrites(page,STORAGE_KEYS.seeds);
  await page.locator('#seed-name').fill('Recovered recipe');await page.locator('#favorite-save').focus();await page.keyboard.press('Enter');await idle(page);
  await expect(page.locator('#library-error')).toBeVisible();await expect(page.locator('#favorite-save')).toBeFocused();
  await expect(page.locator('#seed-name')).toHaveValue('Recovered recipe');
  await page.locator('[data-delete-seed="0"]').click();await expect(page.locator('.favorite-error')).toBeVisible();
  expect(await readStorage(page,STORAGE_KEYS.seeds)).toBe(original);
  await restoreStorageWrites(page);
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

test('a failed local-storage mirror keeps a committed library save available after reload',async({page})=>{
  await ready(page,3);await place(page,'H');await page.locator('#menu-open').click();await page.locator('#library-open').click();
  await page.locator('#seed-name').fill('Original recipe');await page.locator('#favorite-save').click();await idle(page);
  const originalMirror=await mirror(page,STORAGE_KEYS.seeds);
  const workspace=await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,view:window.angouri.view}));
  await page.evaluate(key=>{
    const write=Storage.prototype.setItem;
    Storage.prototype.setItem=function(name,value){
      if(name===key)throw new DOMException('Test mirror failure','QuotaExceededError');
      return write.call(this,name,value);
    };
  },STORAGE_KEYS.seeds);
  await page.locator('#seed-name').fill('Durable recipe');await page.locator('#favorite-save').click();await idle(page);
  await expect(page.locator('#library-error')).toBeHidden();await expect(page.locator('#seed-name')).toHaveValue('');
  await expect(page.getByRole('button',{name:'Open Durable recipe',exact:true})).toBeVisible();
  const durable=await readStorage(page,STORAGE_KEYS.seeds);
  expect(JSON.parse(durable).map(seed=>seed.name)).toEqual(['Original recipe','Durable recipe']);
  expect(await mirror(page,STORAGE_KEYS.seeds)).toBe(originalMirror);
  expect(await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,view:window.angouri.view}))).toEqual(workspace);
  await page.reload();await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
  await page.locator('#menu-open').click();await page.locator('#library-open').click();
  await expect(page.getByRole('button',{name:'Open Original recipe',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Open Durable recipe',exact:true})).toBeVisible();
  expect(await readStorage(page,STORAGE_KEYS.seeds)).toBe(durable);
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
      const reach=await denseFlightReach(page);
      expect(reach.cramped).toBe(viewport.width!==1365);
      const measured=await page.locator('#scene').evaluate(scene=>{
        const boundary=scene.getBoundingClientRect(),labels=[...scene.querySelectorAll('.target-label .katex-html')].map(el=>el.getBoundingClientRect());
        return {inside:labels.every(r=>r.left>=boundary.left&&r.right<=boundary.right&&r.top>=boundary.top&&r.bottom<=boundary.bottom),
          overlap:labels.some((a,i)=>labels.slice(i+1).some(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)),
          pageWidth:document.documentElement.scrollWidth,viewport:innerWidth};
      });
      if(!reach.cramped)expect(measured.inside).toBe(true);
      expect(measured.overlap).toBe(false);expect(measured.pageWidth).toBeLessThanOrEqual(measured.viewport);
      await page.locator('#tab-flow').click();await expect(page.locator('#scene')).not.toHaveClass(/has-flight-callouts/);
    }
  }
});

test('dense wave Flight reserves the whole diagram above or beside its recipe through reflow',async({page},testInfo)=>{
  test.setTimeout(180000);
  async function frame(source,width) {
    // Inspect the first settled frame: an arbitrary delay can hide WebKit's
    // stale label projection after switching from a portrait to a row layout.
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    if(width===844||width===1146)await page.screenshot({path:testInfo.outputPath(`${source}-${width}.png`),fullPage:true});
    const layout=await page.locator('#scene').evaluate(scene=>{
      const s=scene.getBoundingClientRect(),diagram=scene.querySelector('.flight-diagram'),d=diagram.getBoundingClientRect();
      const svg=scene.querySelector('#flight-svg'),plot=svg.getBoundingClientRect(),vb=svg.viewBox.baseVal;
      const dock=document.querySelector('.play-dock').getBoundingClientRect(),style=getComputedStyle(diagram);
      const scale=Math.min(plot.width/vb.width,plot.height/vb.height),x=plot.left+(plot.width-vb.width*scale)/2-vb.x*scale;
      const axisErrors=[...scene.querySelectorAll('#axis-labels [data-axis-x]')].map(label=>{
        const coordinate=Math.max(16/scale,Math.min(760-16/scale,Number(label.dataset.axisX))),box=label.getBoundingClientRect();
        return Math.abs(box.left+box.width/2-(x+coordinate*scale));
      });
      const labels=[...scene.querySelectorAll('.target-label .katex-html')].map(label=>label.getBoundingClientRect());
      return {
        contained:d.left>=s.left-1&&d.right<=s.right+1&&d.top>=s.top-1&&d.bottom<=s.bottom+1,
        plotFits:plot.top>=d.top+parseFloat(style.paddingTop)-1&&plot.bottom<=d.bottom-parseFloat(style.paddingBottom)+1,
        recipeOverlap:Math.min(d.right,dock.right)-Math.max(d.left,dock.left)>1&&Math.min(d.bottom,dock.bottom)-Math.max(d.top,dock.top)>1,
        labelsFit:labels.every(r=>r.left>=s.left-1&&r.right<=s.right+1&&r.top>=s.top-1&&r.bottom<=s.bottom+1),
        axisError:Math.max(...axisErrors),width:document.documentElement.scrollWidth,viewport:innerWidth
      };
    });
    const reach=await denseFlightReach(page);
    // Wide desktops have room for every coordinate; the short frames below
    // cannot hold the minimum plot and both callout rows, so they scroll.
    if([1440,1512].includes(width))expect(reach.cramped).toBe(false);
    if([1146,844].includes(width))expect(reach.cramped).toBe(true);
    if(!reach.cramped) {
      expect(layout.contained).toBe(true);expect(layout.recipeOverlap).toBe(false);expect(layout.labelsFit).toBe(true);
    } else {
      const scene=page.locator('#scene'),top=()=>scene.evaluate(el=>el.scrollTop);
      await scene.evaluate(el=>{el.scrollTop=0;});await scene.hover();await page.mouse.wheel(0,120);
      await expect.poll(top).toBeGreaterThan(0);expect(await page.evaluate(()=>scrollY)).toBe(0);
      await scene.evaluate(el=>{el.scrollTop=0;});await page.locator('#tab-flight').focus();await page.keyboard.press('PageDown');
      await expect.poll(top).toBeGreaterThan(0);await scene.evaluate(el=>{el.scrollTop=0;});
    }
    expect(layout.plotFits).toBe(true);expect(layout.axisError).toBeLessThan(1);expect(layout.width).toBeLessThanOrEqual(layout.viewport);
  }
  for(const source of [54,80]) {
    await page.setViewportSize({width:1440,height:900});await ready(page,source);
    await frame(source,1440);
    for(const [width,height] of [[1146,610],[390,844],[844,390],[601,520],[1512,982]]) {
      await page.setViewportSize({width,height});await frame(source,width);
    }
    await place(page,'H');await frame(source,1512);
    for(const view of ['function','flow']) {await page.locator(`#tab-${view}`).click();await page.locator('#tab-flight').click();await frame(source,1512);}
  }
});

test('short stacked Equation shows the whole construction above a readable comparison row',async({page})=>{
  for(const viewport of [{width:320,height:450},{width:844,height:390}]) {
    await page.setViewportSize(viewport);
    for(const [source,op] of [[80,'H'],[68,'A'],[85,'']]) {
      await ready(page,source,'function');if(op)await place(page,op);
      await page.evaluate(()=>document.fonts.ready);
      const layout=await page.locator('#scene').evaluate(scene=>{
        const pane=scene.querySelector('.final-equation'),p=pane.getBoundingClientRect(),top=p.top+pane.clientTop,bottom=top+pane.clientHeight;
        // KaTeX struts span each formula row's full height and depth.
        const struts=[...scene.querySelectorAll('.constructed-formula .strut')].map(strut=>strut.getBoundingClientRect());
        const tbody=scene.querySelector('.value-table tbody'),b=tbody.getBoundingClientRect(),head=scene.querySelector('.value-table thead').getBoundingClientRect();
        const row=tbody.querySelector('tr').getBoundingClientRect(),content=scene.querySelector('.equation-content').getBoundingClientRect();
        const fits=pane.scrollHeight<=pane.clientHeight+1;
        return {scrollTop:pane.scrollTop,formula:[Math.min(...struts.map(r=>r.top)),Math.max(...struts.map(r=>r.bottom))],view:[top,bottom],
          headWhole:head.top>=scene.querySelector('.value-table').getBoundingClientRect().top-1&&head.bottom<=b.top+1,
          rowWhole:row.top>=b.top-1&&row.bottom<=b.top+tbody.clientHeight+1,fits,overflowY:getComputedStyle(pane).overflowY,
          centerError:Math.abs((content.top+content.bottom)/2-(top+bottom)/2),fontSize:parseFloat(getComputedStyle(scene.querySelector('.equation-formula')).fontSize),
          page:[document.documentElement.scrollWidth-innerWidth,document.documentElement.scrollHeight-innerHeight]};
      });
      expect(layout.scrollTop).toBe(0);
      expect(layout.formula[0]).toBeGreaterThanOrEqual(layout.view[0]-1);expect(layout.formula[1]).toBeLessThanOrEqual(layout.view[1]+1);
      expect(layout.headWhole).toBe(true);expect(layout.rowWhole).toBe(true);expect(layout.fontSize).toBeGreaterThanOrEqual(20);
      expect(layout.page[0]).toBeLessThanOrEqual(0);expect(layout.page[1]).toBeLessThanOrEqual(0);
      // Longer solved forms stay in the section's own scroller; fitting ones are centered.
      if(layout.fits)expect(layout.centerError).toBeLessThan(1);else expect(layout.overflowY).toBe('auto');
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
  await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await idle(page);
  const saved=await readStorage(page,STORAGE_KEYS.progress),originalMirror=await mirror(page,STORAGE_KEYS.progress);
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
  expect(await readStorage(page,STORAGE_KEYS.progress)).toBe(saved);expect(await mirror(page,STORAGE_KEYS.progress)).toBe(originalMirror);
  expect(new URL(page.url()).hash).toBe('#level=84&view=flight');
  await page.locator('#retry-engine').click();
  await page.waitForFunction(()=>window.angouri?.state?.sourceId===84&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
  expect((await readStoredJSON(page,STORAGE_KEYS.progress)).completed).toEqual([1]);
  await expect(page.locator('#retry-engine')).toHaveCount(0);
});

test('a failed matching workspace restore retries its placed blocks instead of the bare level',async({page})=>{
  await ready(page,3,'flow');await place(page,'A');
  const saved=await readStorage(page,STORAGE_KEYS.progress),originalMirror=await mirror(page,STORAGE_KEYS.progress);
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
  expect(await readStorage(page,STORAGE_KEYS.progress)).toBe(saved);expect(await mirror(page,STORAGE_KEYS.progress)).toBe(originalMirror);
  expect(new URL(page.url()).hash).toBe(snapshot.entry);
  await page.locator('#retry-engine').click();
  await page.waitForFunction(()=>window.angouri?.state?.sourceId===3&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
  expect(await page.evaluate(()=>window.angouri.state)).toEqual(snapshot.state);
  expect(await page.evaluate(()=>window.angouri.slots)).toEqual(snapshot.slots);
  expect(await page.evaluate(()=>window.angouri.view)).toBe(snapshot.view);
  expect(await readStorage(page,STORAGE_KEYS.progress)).toBe(saved);expect(await mirror(page,STORAGE_KEYS.progress)).toBe(originalMirror);
  await expect(page.locator('#retry-engine')).toHaveCount(0);
});
