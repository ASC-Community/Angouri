import {test,expect} from '@playwright/test';

const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
async function ready(page,id) {
  await page.goto('/about/');await page.evaluate(()=>localStorage.clear());await page.goto(`/#level=${id}&view=flight`);
  await page.waitForFunction(id=>window.angouri?.state?.sourceId===id&&document.querySelector('#playground').getAttribute('aria-busy')==='false',id);
}
async function beginSteppedFades(page) {
  await page.evaluate(()=>{
    window.nativeAnimate=Element.prototype.animate;window.editFades=[];
    Element.prototype.animate=function(frames,options){
      const animation=window.nativeAnimate.call(this,frames,options);
      if(options?.duration===240&&frames[0]?.opacity!==undefined){animation.pause();window.editFades.push(animation);}
      return animation;
    };
  });
}
const stepFades=(page,time)=>page.evaluate(time=>{
  window.editFades.filter(a=>a.effect.target.isConnected&&a.playState!=='idle').forEach(a=>a.currentTime=time);
  return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
},time);
const finishFades=page=>page.evaluate(()=>{
  Element.prototype.animate=window.nativeAnimate;
  window.editFades.filter(a=>a.effect.target.isConnected&&a.playState!=='idle').forEach(a=>a.finish());
});
async function record(page,op,steppedFade=false,steppedFrames=false) {
  if(steppedFade)await beginSteppedFades(page);
  // Pause ahead of the idle page's current clock so protocol latency cannot
  // turn the requested instant into the past. No edit has started yet.
  if(steppedFrames)await page.clock.pauseAt(await page.evaluate(()=>Date.now()+60_000));
  await page.evaluate(()=>{
    window.editFrames=[];window.recordEdit=true;
    const frame=()=>{
      const path=document.querySelector('#trajectory'),rig=document.querySelector('#launcher');
      if(path&&rig){const matrix=rig.transform.baseVal.numberOfItems?rig.transform.baseVal.getItem(0).matrix:null,p=path.getAttribute('d')?path.getPointAtLength(0):null;
        window.editFrames.push({type:document.querySelector('#scene').dataset.curveTransition,d:path.getAttribute('d'),
          alpha:getComputedStyle(path).opacity,ghost:!!document.querySelector('.curve-change-ghost'),
          rig:rig.getAttribute('transform'),front:document.querySelector('#launcher-front')?.getAttribute('transform'),
          originError:p&&matrix?Math.hypot(p.x-matrix.e,p.y-matrix.f):0,
          statuses:[...document.querySelectorAll('.ring')].map(el=>el.dataset.status)});
      }
      if(window.recordEdit)requestAnimationFrame(frame);
    };requestAnimationFrame(frame);
  });
  const block=page.locator(`[data-op="${op}"]`);
  if(steppedFrames)await block.evaluate(button=>button.click());else await block.click();
  await idle(page);
  if(steppedFade){
    for(const time of [60,120,220])await stepFades(page,time);
    await finishFades(page);
  }
  if(steppedFrames){await page.clock.runFor(400);await page.clock.resume();}else await page.waitForTimeout(400);
  return page.evaluate(()=>{window.recordEdit=false;return window.editFrames;});
}

test('continuous introductory, cropped, station and loop edits keep a shared moving rig',async({page})=>{
  test.setTimeout(150000);await page.emulateMedia({reducedMotion:'no-preference'});await page.clock.install();
  for(const [id,op] of [[3,'A'],[82,'H'],[72,'H'],[84,'Q'],[69,'H']]) {
    await ready(page,id);if(id===84)await page.locator('[data-empty="0"]').click();
    const targets=await page.locator('.ring-outer').evaluateAll(rings=>rings.map(r=>[r.getAttribute('cx'),r.getAttribute('cy')]));
    const frames=await record(page,op,false,true),moving=frames.filter(f=>f.type==='morph');
    expect(moving.length,`source ${id} morph frames`).toBeGreaterThanOrEqual(2);
    expect(new Set(moving.map(f=>f.d)).size).toBeGreaterThanOrEqual(2);
    for(const f of moving){expect(f.originError).toBeLessThan(.06);expect(f.rig).toBe(f.front);expect(f.statuses.every(s=>s==='waiting')).toBe(true);}
    expect(await page.locator('.ring-outer').evaluateAll(rings=>rings.map(r=>[r.getAttribute('cx'),r.getAttribute('cy')]))).toEqual(targets);
    await expect(page.locator('.curve-change-ghost')).toHaveCount(0);
    expect(await page.locator('#scene').getAttribute('data-curve-transition')).toBeNull();
  }
});

test('rounded and split-branch edits fade complete geometry without false connecting paths',async({page})=>{
  test.setTimeout(120000);await page.emulateMedia({reducedMotion:'no-preference'});
  for(const [id,op] of [[56,'F'],[57,'C'],[77,'Q'],[83,'Q']]) {
    await ready(page,id);
    if(id===77){await page.locator('[data-op="H"]').click();await idle(page);await page.waitForTimeout(400);}
    const before=await page.locator('#trajectory').getAttribute('d');
    const frames=await record(page,op,true),fading=frames.filter(f=>f.type==='crossfade');
    expect(fading.length,`source ${id} crossfade frames`).toBeGreaterThan(2);
    const after=await page.locator('#trajectory').getAttribute('d');
    expect(after).not.toBe(before);expect(fading.every(f=>f.d===after&&f.ghost)).toBe(true);
    expect(new Set(fading.map(f=>Number(f.alpha).toFixed(2))).size).toBeGreaterThan(2);
    await expect(page.locator('.curve-change-ghost')).toHaveCount(0);
    expect(await page.locator('[id]').evaluateAll(nodes=>nodes.map(n=>n.id).filter((id,i,ids)=>ids.indexOf(id)!==i))).toEqual([]);
  }
});

test('edit transitions settle before Throw, clear on view changes, and honor Skip animation',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await ready(page,72);
  await page.locator('[data-op="H"]').click();await idle(page);await page.locator('#launch').click();
  expect(await page.locator('#scene').getAttribute('data-curve-transition')).toBeNull();await expect(page.locator('.curve-change-ghost')).toHaveCount(0);
  await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await page.keyboard.press('Escape');
  await ready(page,56);await page.locator('[data-op="F"]').click();await idle(page);await page.locator('#tab-function').click();
  await page.waitForTimeout(350);await expect(page.locator('.curve-change-ghost')).toHaveCount(0);
  await expect(page.locator('#scene')).toHaveAttribute('data-view','function');
  await page.emulateMedia({reducedMotion:'reduce'});await ready(page,83);
  const frames=await record(page,'Q');expect(frames.every(f=>!f.type&&!f.ghost)).toBe(true);
});

test('Undo and Redo during a fade retain the displayed blend and settle all temporary geometry',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await ready(page,56);
  await beginSteppedFades(page);
  await page.locator('[data-op="F"]').click();await idle(page);
  await stepFades(page,100);
  await page.locator('#undo').evaluate(button=>button.click());await idle(page);
  await expect(page.locator('#scene')).toHaveAttribute('data-curve-transition','crossfade');
  expect(await page.locator('.curve-change-ghost .curve-change-layer').count()).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.angouri.state.nodes.length)).toBe(0);
  await stepFades(page,100);
  await page.locator('#redo').evaluate(button=>button.click());await idle(page);
  expect(await page.locator('.curve-change-ghost .curve-change-layer').count()).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.angouri.state.nodes.map(n=>n.op).join(''))).toBe('F');
  await finishFades(page);await expect(page.locator('.curve-change-ghost')).toHaveCount(0);
  expect(await page.locator('#scene').getAttribute('data-curve-transition')).toBeNull();
  await expect(page.locator('#trajectory')).toHaveCSS('opacity','1');
});

test('live crop takes over an active loop morph and commits without replaying clipped geometry',async({page})=>{
  await page.addInitScript(()=>{
    const post=Worker.prototype.postMessage;
    Worker.prototype.postMessage=function(message,...rest){
      if(window.delayCrop&&message.request?.action?.type==='crop'){setTimeout(()=>post.call(this,message,...rest),250);return;}
      return post.call(this,message,...rest);
    };
  });
  await page.emulateMedia({reducedMotion:'no-preference'});await ready(page,69);
  await page.locator('#menu-open').click();await page.locator('#nav-create').click();await idle(page);
  await page.locator('[data-crop-add]').click();await idle(page);
  await page.locator('[data-op="H"]').click();await idle(page);await page.waitForTimeout(350);
  const settled=await page.locator('#trajectory').getAttribute('d');
  const settledRig=await page.locator('#launcher').getAttribute('transform');
  await page.locator('#undo').click();await idle(page);await page.waitForTimeout(350);
  await page.locator('[data-op="H"]').click();await idle(page);
  await expect(page.locator('#scene')).toHaveAttribute('data-curve-transition','morph');
  const before=await page.evaluate(()=>window.angouri.history.undo);
  const snapshot=await page.locator('[data-crop-range="to"]').evaluate(input=>{
    window.delayCrop=true;input.value='3';input.dispatchEvent(new Event('input',{bubbles:true}));
    const path=document.querySelector('#trajectory'),rig=document.querySelector('#launcher');
    const value={d:path.getAttribute('d'),transition:document.querySelector('#scene').dataset.curveTransition,rig:rig.getAttribute('transform')};
    window.cropTransitionFrames=[];window.recordCropTransition=true;
    const record=()=>{window.cropTransitionFrames.push(document.querySelector('#scene').dataset.curveTransition||'');if(window.recordCropTransition)requestAnimationFrame(record);};requestAnimationFrame(record);
    input.dispatchEvent(new Event('change',{bubbles:true}));return value;
  });
  expect(snapshot.d).toBe(settled);expect(snapshot.transition).toBeUndefined();expect(snapshot.rig).toBe(settledRig);
  await idle(page);await page.waitForTimeout(350);
  const frames=await page.evaluate(()=>{window.recordCropTransition=false;return window.cropTransitionFrames;});
  expect(frames.length).toBeGreaterThan(3);expect(frames.every(type=>!type)).toBe(true);
  expect(await page.evaluate(()=>window.angouri.state.crop.to)).toBe('3');
  expect(await page.evaluate(()=>window.angouri.history.undo)).toBe(before+1);
  await expect(page.locator('.curve-change-ghost')).toHaveCount(0);
});

test('out-and-back crop commits and rejected preview edits reconcile the unchanged accepted state',async({page})=>{
  await page.addInitScript(()=>{
    const post=Worker.prototype.postMessage;
    Worker.prototype.postMessage=function(message,...rest){
      if(window.delayCrop&&message.request?.action?.type==='crop'){setTimeout(()=>post.call(this,message,...rest),250);return;}
      return post.call(this,message,...rest);
    };
  });
  await ready(page,3);await page.locator('#menu-open').click();await page.locator('#nav-create').click();await idle(page);
  await page.locator('[data-crop-add]').click();await idle(page);
  const before=await page.evaluate(()=>({state:window.angouri.state,result:window.angouri.result,history:window.angouri.history}));
  await page.locator('[data-crop-range="to"]').evaluate(input=>{input.value='3';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForFunction(()=>window.angouri.result.crop.to==='3');
  await page.locator('[data-crop-range="to"]').evaluate(input=>{window.delayCrop=true;input.value='4';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));});
  await idle(page);
  expect(await page.evaluate(()=>({state:window.angouri.state,result:window.angouri.result,history:window.angouri.history}))).toEqual(before);
  await page.evaluate(()=>window.delayCrop=false);
  await page.locator('[data-crop-range="to"]').evaluate(input=>{input.value='3';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForFunction(()=>window.angouri.result.crop.to==='3');
  await page.locator('[data-crop-exact="to"]').fill('-1');await page.locator('[data-crop-exact="to"]').press('Enter');await idle(page);
  await expect.poll(()=>page.evaluate(()=>window.angouri.result.crop.to)).toBe('4');
  expect(await page.evaluate(()=>({state:window.angouri.state,result:window.angouri.result,history:window.angouri.history}))).toEqual(before);
  await expect(page.locator('#feedback')).toHaveClass(/error/);
});

test('gate Notes keep the area relationship and open its prerequisites separately',async({page})=>{
  await ready(page,65);const before=await page.evaluate(()=>window.angouri.state);
  await page.locator('#ideas-open').click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('#notes-concept')).toHaveText('Input regions become rises, plateaus and falls.');
  await expect(page.locator('#notes-content .note-recall')).toHaveCount(0);
  for(const [id,title] of [[63,'Step accumulation is continuous with sharp corners.'],[60,'Input shift sets step phase.']]) {
    await page.locator(`[data-note-lesson="${id}"]`).click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
    await expect(page.locator('#notes-concept')).toHaveText(title);
    await expect(page.locator('#notes-content .note-recall')).toHaveCount(0);
  }
  await expect(page.locator('.katex-error')).toHaveCount(0);
  expect(await page.evaluate(()=>window.angouri.state)).toEqual(before);
});

test('garden fits its remaining panel space and only cramped windows scroll its content',async({page})=>{
  await ready(page,72);await page.locator('#picture-open').click();await expect(page.locator('.garden-paper')).toBeVisible();
  for(const [width,height] of [[2560,1440],[1719,914],[1280,720],[1146,610],[844,390],[760,561],[600,600],[320,568],[320,320],[280,500]]) {
    await page.setViewportSize({width,height});
    await expect.poll(()=>page.locator('.garden-board').evaluate(board=>{
      const b=board.getBoundingClientRect(),workspace=board.parentElement.getBoundingClientRect();
      const overlap=[...document.querySelectorAll('.garden-heading,.garden-heading>*,.garden-footer,.garden-footer>*')].some(el=>{const r=el.getBoundingClientRect();return Math.min(b.right,r.right)-Math.max(b.left,r.left)>1&&Math.min(b.bottom,r.bottom)-Math.max(b.top,r.top)>1;});
      const heading=document.querySelector('.garden-heading');
      return !overlap&&heading.scrollHeight<=heading.clientHeight+1&&b.width>=220&&b.left>=workspace.left-1&&b.right<=workspace.right+1&&b.top>=workspace.top-1&&b.bottom<=workspace.bottom+1;
    })).toBe(true);
    const shell=page.locator('.garden-shell');if(width>=320&&height>=500)expect(await shell.evaluate(e=>e.scrollHeight-e.clientHeight)).toBeLessThanOrEqual(1);
    await page.locator('.garden-done').scrollIntoViewIfNeeded();await expect(page.locator('.garden-done')).toBeInViewport();
  }
});

test('Equation and circle Flow keep reachable content inside the fixed game frame',async({page})=>{
  for(const id of [3,43,85]) {
    await ready(page,id);await page.locator('#tab-function').click();
    for(const [width,height] of [[1280,720],[1146,610],[844,390],[601,521],[320,568]]){
      await page.setViewportSize({width,height});
      expect(await page.locator('#scene').evaluate(e=>e.scrollHeight-e.clientHeight)).toBeLessThanOrEqual(1);
      await expect(page.locator('#scene')).toHaveCSS('overflow-y','hidden');
      expect(await page.locator('.value-table tbody').evaluate(e=>e.clientHeight)).toBeGreaterThan(24);
      expect(await page.evaluate(()=>[document.documentElement.scrollWidth-innerWidth,document.documentElement.scrollHeight-innerHeight])).toEqual([0,0]);
    }
    if(id===43){await page.locator('#tab-flow').click();await page.setViewportSize({width:1280,height:720});await expect(page.locator('.circle-flow-line')).toHaveCSS('overflow-y','auto');expect(await page.locator('.circle-flow-line').evaluate(e=>e.clientHeight)).toBeGreaterThan(60);}
  }
});

test('compact puzzle summaries and saved recipe identities use readable full rows',async({page})=>{
  await ready(page,85);await page.setViewportSize({width:320,height:568});
  await page.locator('#menu-open').click();await page.locator('#puzzles-open').click();
  const summary=page.locator('.chapter-group:has([data-level="85"])>summary');await summary.scrollIntoViewIfNeeded();
  expect(await summary.evaluate(el=>{const box=el.getBoundingClientRect();return [...el.children].every(child=>{const r=child.getBoundingClientRect();return r.left>=box.left&&r.right<=box.right;});})).toBe(true);
  await page.keyboard.press('Escape');await page.locator('#menu-open').click();await page.locator('#library-open').click();
  await page.locator('#seed-name').fill('A long saved recipe name that should remain easy to recognise');await page.locator('#favorite-save').click();await idle(page);
  expect(await page.locator('.favorite-info').evaluate(e=>e.getBoundingClientRect().width)).toBeGreaterThan(200);
  const name=await page.locator('.favorite-info').boundingBox(),actions=await page.locator('.favorite-actions').boundingBox();expect(actions.y).toBeGreaterThanOrEqual(name.y+name.height);
});
