import {test,expect} from '@playwright/test';

async function ready(page,id,view='flight') {
  await page.goto(`/about/`);await page.goto(`/#level=${id}&view=${view}`);
  await page.waitForFunction(()=>window.angouri?.state&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
}
const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
const state=page=>page.evaluate(()=>window.angouri.state);
const order=async page=>(await state(page)).nodes.map(node=>node.op).join('');
async function add(page,op,slot) {if(slot!==undefined)await page.locator(`[data-empty="${slot}"]`).click();await page.locator(`[data-op="${op}"]`).click();await idle(page);}
async function drag(page,from,to) {const a=await from.boundingBox(),b=await to.boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});await page.mouse.up();await idle(page);}

test('a fixed station keeps its place through cross-station tap, keyboard, return, undo and reload',async({page})=>{
  await ready(page,32);
  expect(await page.evaluate(()=>window.angouri.slots)).toEqual([null,'station',null]);
  await expect(page.locator('.fixed-station')).toHaveCount(1);await expect(page.locator('.fixed-station button,.fixed-station .piece-grip')).toHaveCount(0);
  await expect(page.locator('#reset')).toBeDisabled();await add(page,'A');
  expect(await order(page)).toBe('AD');expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(false);
  await page.locator('.part-body').click();await page.locator('[data-empty="2"]').click();await idle(page);
  expect(await order(page)).toBe('DA');expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);
  await page.locator('.part-body').focus();await page.keyboard.press('ArrowLeft');await idle(page);expect(await order(page)).toBe('AD');
  await page.keyboard.press('Control+z');await idle(page);expect(await order(page)).toBe('DA');
  await page.reload();await page.waitForFunction(()=>window.angouri?.state);expect(await order(page)).toBe('DA');
  expect(await page.evaluate(()=>window.angouri.slots[1])).toBe('station');
  await page.locator('.part-body').focus();await page.keyboard.press('Delete');await idle(page);expect(await order(page)).toBe('D');
  await page.locator('#undo').click();await idle(page);expect(await order(page)).toBe('DA');
  await page.locator('#redo').click();await idle(page);expect(await order(page)).toBe('D');
});

test('stock shifts across a fixed machine, while a placed block exchanges with a hole',async({page})=>{
  await ready(page,36);for(const op of 'HHAAQ')await add(page,op);
  const before=await page.evaluate(()=>window.angouri.slots);
  await drag(page,page.locator('[data-op="N"]'),page.locator('[data-cell="4"]'));
  expect(await order(page)).toBe('HHAANDQ');const shifted=await page.evaluate(()=>window.angouri.slots);
  expect(await page.locator('.recipe-part').evaluateAll(parts=>{const machine=document.querySelector('.fixed-station').getBoundingClientRect();return parts.every(part=>{const r=part.getBoundingClientRect();return r.right<=machine.left||r.left>=machine.right||r.bottom<=machine.top||r.top>=machine.bottom;});})).toBe(true);
  expect(shifted[5]).toBe('station');expect(shifted[6]).toBe(before[4]);expect(shifted.slice(0,4)).toEqual(before.slice(0,4));
  await drag(page,page.locator('[data-cell="0"] .part-body'),page.locator('[data-empty="7"]'));
  const moved=await page.evaluate(()=>window.angouri.slots);expect(moved[0]).toBe(null);expect(moved[7]).toBe(before[0]);expect(moved.slice(1,7)).toEqual(shifted.slice(1,7));
  await page.locator('#undo').click();await idle(page);expect(await page.evaluate(()=>window.angouri.slots)).toEqual(shifted);
  await page.locator('#reset').click();await idle(page);expect(await order(page)).toBe('D');
  expect(await page.evaluate(()=>window.angouri.slots)).toEqual([null,null,null,null,null,'station',null,null]);
});

test('narrow station recipes keep one horizontal rail and accept a drag across the fixed machine',async({page})=>{
  await page.setViewportSize({width:320,height:568});await ready(page,32);await add(page,'A');
  await page.locator('#construction').scrollIntoViewIfNeeded();
  const machine=await page.locator('.fixed-station').boundingBox(),input=await page.locator('[data-cell="0"]').boundingBox(),output=await page.locator('[data-cell="2"]').boundingBox();
  expect(input.x+input.width).toBeLessThan(machine.x);expect(output.x).toBeGreaterThan(machine.x+machine.width);
  expect(Math.abs(input.y-output.y)).toBeLessThan(1);
  // Moving toward the rail's edge reveals the destination, just as in a long ordinary recipe.
  const start=await page.locator('.part-body').boundingBox(),rail=await page.locator('.pipeline').boundingBox();
  await page.mouse.move(start.x+start.width/2,start.y+start.height/2);await page.mouse.down();
  for(let i=0;i<12;i++)await page.mouse.move(rail.x+rail.width-8,rail.y+rail.height/2+(i%2),{steps:2});
  const end=await page.locator('[data-empty="2"]').boundingBox();await page.mouse.move(end.x+end.width/2,end.y+end.height/2,{steps:5});await page.mouse.up();await idle(page);expect(await order(page)).toBe('DA');
  expect(await page.evaluate(()=>window.angouri.slots[1])).toBe('station');expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
});

test('a station pickup cancels safely and Create releases the machine as a regular block',async({page})=>{
  await ready(page,33);await add(page,'Q');const before=await state(page);
  const part=await page.locator('.part-body').boundingBox();await page.mouse.move(part.x+15,part.y+15);await page.mouse.down();await page.mouse.move(10,10,{steps:8});await page.keyboard.press('Escape');await page.mouse.up();expect(await state(page)).toEqual(before);
  await page.locator('#menu-open').click();await page.locator('#nav-create').click();await expect(page.locator('#leave-dialog')).toBeVisible();await page.locator('#leave-discard').click();await idle(page);
  expect((await state(page)).mode).toBe('remix');expect((await state(page)).station).toBeUndefined();expect(await order(page)).toBe('QD');await expect(page.locator('.fixed-station')).toHaveCount(0);await expect(page.locator('.part-body')).toHaveCount(2);
  await page.locator('[data-stage="station"]').focus();await page.keyboard.press('Delete');await idle(page);expect(await order(page)).toBe('Q');
});

test('sixth and eighth powers are playable through the existing square block',async({page})=>{
  for(const [id,ops] of [[29,'Q'],[30,'QNA'],[31,'HHQQNA']]) {
    await ready(page,id,'function');for(const op of ops)await add(page,op);
    expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);
    await page.locator('#ideas-open').click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');await expect(page.locator('#notes-content')).toContainText('sixth');await expect(page.locator('annotation').filter({hasText:'(u^3)^2=u^6'})).toHaveCount(1);
    await page.keyboard.press('Escape');
  }
});

test('slope and signed-area sketches read the station and share the scrubber and reward clock',async({page})=>{
  await ready(page,33,'flow');await add(page,'Q');
  const slider=page.locator('#flow-position');
  const scrub=async x=>{await slider.fill(String(x));await slider.dispatchEvent('input');};
  await scrub(1);await expect(page.locator('.station-scene')).toHaveAttribute('data-direction','falling');await expect(page.locator('[data-station-output] annotation')).toHaveText('\\approx -2');
  await expect(page.locator('.station-scene h3')).toHaveText('Height → slope');
  for(const x of [1,2,3]) {
    await scrub(x);
    const slope=await page.locator('[data-station-tangent]').evaluate(path=>{const a=path.getPointAtLength(0),b=path.getPointAtLength(path.getTotalLength());return -(b.y-a.y)/(b.x-a.x);});
    expect(slope).toBeCloseTo(2*(x-2),5);
  }
  await scrub(2);await expect(page.locator('.station-scene')).toHaveAttribute('data-direction','flat');await scrub(3);await expect(page.locator('.station-scene')).toHaveAttribute('data-direction','rising');
  await page.locator('#menu-open').click();await page.locator('#settings-open').click();await page.locator('#motion-toggle').uncheck();await page.keyboard.press('Escape');
  await page.locator('#launch').click();await expect(slider).toBeDisabled();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await expect(slider).toBeEnabled();await expect(slider).toHaveValue('3');
  await ready(page,38,'flow');await add(page,'A');await scrub(2);await expect(page.locator('.station-scene')).toHaveAttribute('data-direction','adding');await expect(page.locator('[data-station-output] annotation')).toHaveText('\\approx 4');
  await scrub(3);await expect(page.locator('.station-scene')).toHaveAttribute('data-direction','still');await scrub(4);await expect(page.locator('.station-scene')).toHaveAttribute('data-direction','taking');
});

test('each calculus visualization stays inside its own step and reads that step input and output',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await ready(page,41,'flow');await add(page,'D');
  const slider=page.locator('#flow-position');await slider.fill('1');await slider.dispatchEvent('input');
  await expect(page.locator('.flow-line>.station-scene')).toHaveCount(0);
  await expect(page.locator('.calculus-machine')).toHaveCount(2);
  const slope=page.locator('[data-station-stage="1"]'),area=page.locator('[data-station-stage="2"]');
  await expect(slope.locator('[data-station-input] annotation')).toHaveText('\\approx 2.5');
  await expect(slope.locator('[data-station-output] annotation')).toHaveText('\\approx 1');
  await expect(area.locator('[data-station-input] annotation')).toHaveText('\\approx 1');
  await expect(area.locator('[data-station-output] annotation')).toHaveText('\\approx 1.5');
  const tops=await page.locator('.flow-plot').evaluateAll(plots=>plots.map(plot=>plot.getBoundingClientRect().top));
  expect(Math.max(...tops)-Math.min(...tops)).toBeLessThan(1);
  for(const index of [1,2])expect(await page.locator(`[data-station-stage="${index}"]`).evaluate((el,index)=>el.closest('.flow-machine').getAttribute('aria-label').startsWith(`Step ${index}:`),index)).toBe(true);
  for(const size of [{width:1440,height:900},{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(size);
    expect(await page.locator('.calculus-machine').evaluateAll(cards=>cards.every(card=>{
      const scene=card.querySelector('.station-scene'),body=card.querySelector('.machine-body');
      const a=scene.getBoundingClientRect(),b=body.getBoundingClientRect();
      return !!(scene.compareDocumentPosition(body)&Node.DOCUMENT_POSITION_FOLLOWING)&&(a.right<=b.left+1||a.bottom<=b.top+1);
    }))).toBe(true);
  }
  await page.setViewportSize({width:1440,height:900});
  await page.locator('#menu-open').click();await page.locator('#nav-create').click();await page.locator('#leave-discard').click();await idle(page);
  await add(page,'I');await slider.fill('1');await slider.dispatchEvent('input');
  await expect(page.locator('.calculus-machine')).toHaveCount(3);
  const secondArea=page.locator('[data-station-stage="3"]');
  await expect(secondArea.locator('[data-station-input] annotation')).toHaveText('\\approx 1.5');
  await expect(secondArea.locator('[data-station-output] annotation')).toHaveText('\\approx 0.833');
  expect(await page.locator('.station-scene pattern').evaluateAll(patterns=>new Set(patterns.map(p=>p.id)).size)).toBe(2);
  await page.locator('#undo').click();await idle(page);await expect(page.locator('.calculus-machine')).toHaveCount(2);
});

test('the final station rewards its input/output solution and advances to Circles',async({page})=>{
  await ready(page,42,'function');for(const op of 'HHNA')await add(page,op);await add(page,'N',6);await add(page,'A',7);
  expect(await order(page)).toBe('HHNAINA');expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);
  await page.locator('#launch').click();await expect(page.locator('#launch')).toHaveText('Next chapter');await expect(page.locator('.equation-verdict[data-status="hit"]')).toHaveCount(5);
  await page.locator('#launch').click();await idle(page);expect((await state(page)).sourceId).toBe(43);await expect(page.locator('#level-category')).toContainText('CIRCLES');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('angouri:vine:v1:progress')).completed)).toEqual([42]);
});

test('Safari-compatible Flight labels stay tied to the plot at compact and wide sizes',async({page})=>{
  await ready(page,25);for(const size of [{width:1440,height:900},{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(size);await expect(page.locator('#flight-svg foreignObject')).toHaveCount(0);
    await expect.poll(()=>page.locator('.flight-label').evaluateAll(labels=>{
      const m=document.querySelector('#flight-svg').getScreenCTM();
      return labels.filter(label=>!label.querySelector('.zero-label')).every(label=>{
        const r=label.getBoundingClientRect(),x=Math.max(16/m.a,Math.min(760-16/m.a,Number(label.dataset.axisX)));
        return Math.abs((r.left+r.width/2)-(m.e+m.a*x))<1;
      });
    })).toBe(true);
    expect(await page.locator('.target-height .katex-html').evaluateAll(labels=>labels.every(label=>{const r=label.getBoundingClientRect(),s=document.querySelector('#scene').getBoundingClientRect();return r.left>=s.left-1&&r.right<=s.right+1&&r.top>=s.top-1&&r.bottom<=s.bottom+1;}))).toBe(true);
  }
});

test('station chapters retain the viewport layout and keep playback from resizing it',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await ready(page,42,'flow');
  for(const op of 'HHNA')await add(page,op);await add(page,'N',6);await add(page,'A',7);
  for(const size of [{width:1440,height:900},{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(size);
    for(const view of ['flight','flow']) {
      await page.locator(`#tab-${view}`).click();
      const boxes=await page.evaluate(()=>['#scene','.play-dock'].map(selector=>document.querySelector(selector).getBoundingClientRect().toJSON()));
      const [board,tray]=boxes;
      expect(board.height).toBeGreaterThanOrEqual(130);
      expect(board.bottom<=tray.top||board.right<=tray.left||board.left>=tray.right).toBe(true);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
      if(view==='flow'&&size.width>1000)expect(await page.locator('.flow-line').evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(1);
    }
  }
  await page.evaluate(()=>{
    const read=()=>['#scene','.flow-line','.station-scene','.play-dock'].map(selector=>{
      const el=document.querySelector(selector);return [el.clientWidth,el.clientHeight,el.scrollWidth,el.scrollHeight];
    });
    const initial=JSON.stringify(read());window.stationLayoutChanges=[];
    const sample=()=>{const current=read();if(JSON.stringify(current)!==initial&&window.stationLayoutChanges.length<10)window.stationLayoutChanges.push(current);window.stationLayoutFrame=requestAnimationFrame(sample);};sample();
  });
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await page.waitForTimeout(450);
  expect(await page.evaluate(()=>{cancelAnimationFrame(window.stationLayoutFrame);return window.stationLayoutChanges;})).toEqual([]);
});

test('entering Slopes or Accumulation does not introduce page scrolling',async({page})=>{
  test.setTimeout(120000);
  for(const size of [{width:1440,height:900},{width:1280,height:720},{width:390,height:844},{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(size);
    const overflow=async()=>page.evaluate(()=>Math.max(0,document.documentElement.scrollHeight-innerHeight));
    await ready(page,28);const baseline=await overflow();
    for(const id of [32,42]) {
      await ready(page,id);
      for(const view of ['flight','flow']) {
        await page.locator(`#tab-${view}`).click();
        expect(await overflow(),`${id} ${view} ${size.width}x${size.height}`).toBeLessThanOrEqual(baseline+1);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
        const extents=await page.locator('.pipeline').evaluate(el=>({client:el.clientHeight,scroll:el.scrollHeight}));
        expect(extents.scroll).toBeLessThanOrEqual(extents.client+1);
      }
    }
  }
});
