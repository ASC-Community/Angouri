import {test,expect} from '@playwright/test';
const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
const snapshot=page=>page.evaluate(()=>window.angouri.state);
async function ready(page,id=43,view='flight') {
  await page.goto('/about/');await page.goto(`/#level=${id}&view=${view}`);
  await page.waitForFunction(()=>window.angouri?.state&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
}
async function parameter(page,key,value){const input=page.locator(`[data-circle-value="${key}"]`);await input.fill(value);await input.press('Enter');await idle(page);}
async function solve(page,id){for(const [key,value] of Object.entries({43:{radius:'1'},44:{x:'3/2',y:'1/2'},45:{y:'1/2',radius:'5/4'},46:{x:'9/4',y:'1/4',radius:'5/4'},47:{x:'5/4',y:'-1/2',radius:'5/2'}}[id]))await parameter(page,key,value);}
async function screenPoint(page,x,y) {
  return page.evaluate(([x,y])=>{
    const circle=window.angouri.result.circle,centre=document.querySelector('.circle-centre-mark');
    const scale=document.querySelector('#trajectory').getBBox().width/(2*circle.radius),m=document.querySelector('#flight-svg').getScreenCTM();
    return {x:m.e+(Number(centre.getAttribute('cx'))+(x-circle.centre[0])*scale)*m.a,y:m.f+(Number(centre.getAttribute('cy'))-(y-circle.centre[1])*scale)*m.d};
  },[x,y]);
}

test('a full circle has both branches and exact radius edits share undo and redo',async({page})=>{
  await ready(page);
  await expect(page.locator('.recipe-part,[data-op]')).toHaveCount(0);
  await expect(page.locator('[data-circle-handle="centre"]')).toHaveCount(0);
  expect(await page.evaluate(()=>{const pts=window.angouri.result.points;return {closed:JSON.stringify(pts[0])===JSON.stringify(pts.at(-1)),up:pts.some(p=>p[1]>0),down:pts.some(p=>p[1]<0)};})).toEqual({closed:true,up:true,down:true});
  await expect(page.locator('#reset')).toBeDisabled();
  const handle=page.locator('[data-circle-handle="radius"]');await handle.focus();await page.keyboard.press('ArrowUp');await idle(page);
  expect((await snapshot(page)).circle.radius).toBe('3/4');await expect(handle).toBeFocused();
  await page.keyboard.press('ArrowRight');await idle(page);expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);
  await page.locator('#undo').click();await idle(page);expect((await snapshot(page)).circle.radius).toBe('3/4');
  await page.locator('#redo').click();await idle(page);expect((await snapshot(page)).circle.radius).toBe('1');
  await page.locator('#tab-function').click();await expect(page.locator('.equation-verdict')).toHaveCount(4);await expect(page.locator('.final-formula')).toContainText('h');
  await page.locator('#launch').click();await expect(page.locator('.equation-verdict[data-status="hit"]')).toHaveCount(4);await expect(page.locator('#launch')).toHaveText('Next puzzle');
  await page.locator('#reset').click();await idle(page);expect((await snapshot(page)).circle.radius).toBe('1/2');await page.locator('#undo').click();await idle(page);expect((await snapshot(page)).circle.radius).toBe('1');
});

test('circle handles support drag, text-selection pickup, cancellation, and tap destinations',async({page})=>{
  await ready(page,44);const before=await snapshot(page);
  await page.evaluate(()=>{const r=document.createRange();r.selectNodeContents(document.querySelector('#level-title'));getSelection().addRange(r);});
  const handle=page.locator('[data-circle-handle="centre"]'),box=await handle.boundingBox(),destination=await screenPoint(page,1.5,.5);
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(destination.x,destination.y,{steps:8});
  expect(await page.evaluate(()=>getSelection().toString())).toBe('');expect(await snapshot(page)).toEqual(before);
  await expect(page.locator('#circle-preview')).toBeVisible();
  await page.keyboard.press('Escape');await page.mouse.up();expect(await snapshot(page)).toEqual(before);
  await expect(page.locator('#circle-preview')).toBeHidden();
  await handle.click();await expect(handle).toHaveAttribute('aria-pressed','true');await page.mouse.click(destination.x,destination.y);await idle(page);
  expect((await snapshot(page)).circle).toEqual({x:'3/2',y:'1/2',radius:'1'});expect(await page.evaluate(()=>window.angouri.history.undo)).toBe(1);
  await page.locator('#undo').click();await idle(page);
  const second=await handle.boundingBox(),end=await screenPoint(page,1.5,.5);await page.mouse.move(second.x+second.width/2,second.y+second.height/2);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:8});await page.mouse.up();await idle(page);
  expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);expect(await page.evaluate(()=>window.angouri.history.undo)).toBe(1);
  await handle.focus();await page.keyboard.press('Space');await expect(handle).toHaveAttribute('aria-pressed','true');await page.keyboard.press('Escape');await expect(handle).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('html')).toHaveAttribute('data-focus-modality','keyboard');
  await page.keyboard.press('Escape');await expect(handle).toBeFocused();await expect(page.locator('html')).toHaveAttribute('data-focus-modality','pointer');
  await expect(page.locator('.keyboard-focus-cue')).toBeHidden();
  await expect(page.locator('[data-circle-value="radius"]')).toHaveCount(0);
});

test('dragging previews exact target verdicts without committing or measuring a new layout',async({page})=>{
  await ready(page,43);
  const before=await snapshot(page),handle=page.locator('[data-circle-handle="radius"]'),box=await handle.boundingBox();
  const delta=await page.evaluate(()=>{const matrix=document.querySelector('#flight-svg').getScreenCTM();return document.querySelector('#trajectory').getBBox().width*matrix.a/2;});
  const geometry=()=>page.evaluate(()=>({scene:document.querySelector('#scene').getBoundingClientRect().toJSON(),scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],targets:[...document.querySelectorAll('.ring-outer')].map(el=>[el.getAttribute('cx'),el.getAttribute('cy')])}));
  const frame=await geometry();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  // Track application layout reads after pointer-down captured the coordinate frame.
  await page.evaluate(()=>{window.circleReads=0;window.circleOriginalRect=Element.prototype.getBoundingClientRect;Element.prototype.getBoundingClientRect=function(){window.circleReads++;return window.circleOriginalRect.call(this);};});
  await page.mouse.move(box.x+box.width/2+delta,box.y+box.height/2,{steps:8});
  await expect(page.locator('.ring[data-match="hit"]')).toHaveCount(4);
  expect(await snapshot(page)).toEqual(before);expect(await page.evaluate(()=>window.angouri.history.undo)).toBe(0);
  expect(await page.evaluate(()=>window.circleReads)).toBe(0);
  await page.evaluate(()=>{Element.prototype.getBoundingClientRect=window.circleOriginalRect;});expect(await geometry()).toEqual(frame);
  await page.keyboard.press('Escape');await page.mouse.up();await expect(page.locator('.ring[data-match="miss"]')).toHaveCount(4);expect(await snapshot(page)).toEqual(before);
  const again=await handle.boundingBox();await page.mouse.move(again.x+again.width/2,again.y+again.height/2);await page.mouse.down();await page.mouse.move(again.x+again.width/2+delta,again.y+again.height/2,{steps:8});
  await expect(page.locator('.ring[data-match="hit"]')).toHaveCount(4);await page.mouse.up();await idle(page);expect((await snapshot(page)).circle.radius).toBe('1');expect(await page.evaluate(()=>window.angouri.history.undo)).toBe(1);
});

test('circle playback keeps its graph and scroll extents stable at every frame',async({page})=>{
  await ready(page,43,'flow');await solve(page,43);
  await page.locator('#menu-open').click();await page.locator('#settings-open').click();await page.locator('#motion-toggle').uncheck();await page.keyboard.press('Escape');
  await page.evaluate(()=>{window.circlePlot=document.querySelector('.circle-flow-curve');window.circleFrames=[];let frames=0;const sample=()=>{const scene=document.querySelector('#scene'),line=document.querySelector('.flow-line');window.circleFrames.push([scene.scrollWidth,scene.scrollHeight,line.scrollWidth,line.scrollHeight,window.circlePlot===document.querySelector('.circle-flow-curve')]);if(++frames<220)requestAnimationFrame(sample);};requestAnimationFrame(sample);});
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
  const frames=await page.evaluate(()=>window.circleFrames);expect(new Set(frames.map(frame=>JSON.stringify(frame))).size).toBe(1);expect(frames.every(frame=>frame.at(-1))).toBe(true);
});

test('circle drag readings follow the preview and release never flashes the pickup position',async({page})=>{
  await page.addInitScript(()=>{
    const post=Worker.prototype.postMessage;
    Worker.prototype.postMessage=function(message,...rest){
      if(window.delayCircleRelease&&message.request?.action?.type==='circle'){
        window.delayCircleRelease=false;setTimeout(()=>post.call(this,message,...rest),220);return;
      }
      return post.call(this,message,...rest);
    };
  });
  await ready(page,43);
  const radius=page.locator('[data-circle-value="radius"]'),handle=page.locator('[data-circle-handle="radius"]');
  const before=await snapshot(page),box=await handle.boundingBox(),a=await screenPoint(page,2,0),b=await screenPoint(page,3,0);
  const from={x:box.x+box.width/2,y:box.y+box.height/2},step=(b.x-a.x)/2;
  const position=()=>page.locator('#launcher').evaluate(el=>{const m=el.getCTM();return [m.e,m.f];});
  const original=await position();
  const drag=async()=>{await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(from.x+step,from.y,{steps:6});};
  await drag();await expect(radius).toHaveValue('1');expect(await snapshot(page)).toEqual(before);
  await page.keyboard.press('Escape');await page.mouse.up();await expect(radius).toHaveValue('1/2');expect(await position()).toEqual(original);
  await drag();await expect(page.locator('.ring[data-match="hit"]')).toHaveCount(4);const preview=await position();expect(preview).not.toEqual(original);
  await page.evaluate(()=>{
    window.delayCircleRelease=true;window.circleReleaseFrames=[];window.observeCircleRelease=true;
    const frame=()=>{const m=document.querySelector('#launcher').getCTM();window.circleReleaseFrames.push({position:[m.e,m.f],radius:document.querySelector('[data-circle-value="radius"]').value});if(window.observeCircleRelease)requestAnimationFrame(frame);};requestAnimationFrame(frame);
  });
  await page.mouse.up();await idle(page);await page.evaluate(()=>{window.observeCircleRelease=false;});
  const frames=await page.evaluate(()=>window.circleReleaseFrames);expect(frames.length).toBeGreaterThan(3);
  for(const frame of frames){expect(frame.radius).toBe('1');expect(frame.position[0]).toBeCloseTo(preview[0],4);expect(frame.position[1]).toBeCloseTo(preview[1],4);}
  expect((await snapshot(page)).circle.radius).toBe('1');expect(await page.evaluate(()=>window.angouri.history.undo)).toBe(1);
  await page.locator('#undo').click();await idle(page);await expect(radius).toHaveValue('1/2');expect(await position()).toEqual(original);
});

test('circle exact fields reject off-grid values and preserve acknowledged state',async({page})=>{
  await ready(page,47,'function');await parameter(page,'x','1.25');expect((await snapshot(page)).circle.x).toBe('5/4');
  const before=await snapshot(page),history=await page.evaluate(()=>window.angouri.history);
  await parameter(page,'radius','1/3');expect(await snapshot(page)).toEqual(before);expect(await page.evaluate(()=>window.angouri.history)).toEqual(history);await expect(page.locator('#feedback')).toContainText('quarter');
  await expect(page.locator('[data-circle-value="radius"]')).toHaveValue('1');await solve(page,47);expect(await page.evaluate(()=>window.angouri.result.checkpoints.every(c=>c.hit&&c.lhs===c.rhs))).toBe(true);
  await page.reload();await page.waitForFunction(()=>window.angouri?.state);expect((await snapshot(page)).circle).toEqual({x:'5/4',y:'-1/2',radius:'5/2'});
});

test('circle reward traverses by phase, shares all views, and restores the Flow probe',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await ready(page,43,'flow');await solve(page,43);
  const slider=page.locator('#flow-position');await slider.fill('0.5');await slider.dispatchEvent('input');
  await page.locator('#launch').click();await expect(slider).toBeDisabled();
  await page.waitForFunction(()=>window.angouri.flight.position>.3&&window.angouri.flight.position<.6);
  await expect(page.locator('[data-circle-target="1"]')).toHaveAttribute('data-status','hit');await expect(page.locator('[data-circle-target="3"]')).toHaveAttribute('data-status','waiting');
  await page.locator('#tab-flight').click();expect(await page.evaluate(()=>window.angouri.flight.position)).toBeGreaterThan(.3);await expect(page.locator('[data-ring="1"]')).toHaveAttribute('data-status','hit');
  await page.locator('#tab-function').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await expect(page.locator('.equation-verdict[data-status="hit"]')).toHaveCount(4);
  await page.locator('#tab-flow').click();await expect(slider).toBeEnabled();await expect(slider).toHaveValue('0.5');
  await expect(page.locator('#launch')).toHaveText('Next puzzle');await expect(page.locator('#rethrow')).toBeVisible();
});

test('circle Flow reveals components and a selectable chord without changing the construction',async({page})=>{
  await ready(page,46,'flow');const before=await snapshot(page),history=await page.evaluate(()=>window.angouri.history);
  await expect(page.locator('.distance-components')).toBeVisible();await expect(page.locator('.circle-chord,.circle-bisector')).toHaveCount(2);
  await expect(page.locator('.circle-target-name')).toHaveText(['Target 1','Target 2','Target 3']);
  await expect(page.locator('#circle-pair option')).toHaveText(['Targets 1 and 2','Targets 2 and 3','Targets 3 and 1']);
  await expect(page.locator('#circle-pair-explanation')).toContainText('Any centre equally far from both');
  const line=await page.locator('.circle-bisector').getAttribute('d');await page.locator('#circle-pair').selectOption('1');await expect(page.locator('#circle-pair')).toBeFocused();expect(await page.locator('.circle-bisector').getAttribute('d')).not.toBe(line);
  const selected=await page.locator('.circle-pair-points annotation').allTextContents();
  expect(selected).toEqual(await page.locator('[data-circle-target="1"] annotation,[data-circle-target="2"] annotation').allTextContents());
  await page.locator('[data-circle-target="2"]').click();await expect(page.locator('[data-circle-target="2"]')).toBeFocused();await expect(page.locator('[data-circle-target="2"]')).toHaveAttribute('aria-pressed','true');
  for(const viewport of [{width:1146,height:850},{width:320,height:568},{width:844,height:390}]){
    await page.setViewportSize(viewport);
    const bounds=await page.locator('.circle-flow-controls').evaluate(controls=>{
      const r=controls.getBoundingClientRect();
      return {clipped:[...controls.querySelectorAll('[data-circle-target]')].some(button=>{const b=button.getBoundingClientRect();return b.left<r.left||b.right>r.right||button.scrollWidth>button.clientWidth+1;}),overflow:document.documentElement.scrollWidth-innerWidth};
    });
    expect(bounds).toEqual({clipped:false,overflow:0});
  }
  expect(await snapshot(page)).toEqual(before);expect(await page.evaluate(()=>window.angouri.history)).toEqual(history);
  await page.locator('#tab-function').click();await expect(page.locator('.gap-comparison')).toHaveCount(0);await expect(page.locator('.value-table')).toContainText('Distance');
});

test('circle saves and source switches protect work, and both directions remain undoable',async({page})=>{
  await ready(page,46);await solve(page,46);const original=await snapshot(page);
  await page.locator('#menu-open').click();await page.locator('#nav-create').click();await expect(page.locator('#leave-dialog')).toBeVisible();await page.locator('#leave-cancel').click();expect(await snapshot(page)).toEqual(original);
  await page.locator('#menu-open').click();await page.locator('#nav-create').click();await page.locator('#leave-discard').click();await idle(page);expect((await snapshot(page)).circle).toEqual(original.circle);
  await page.locator('#source-choose').click();await page.locator('[data-source="1"]').click();await expect(page.locator('#leave-dialog')).toBeVisible();await page.locator('#leave-discard').click();await idle(page);expect((await snapshot(page)).circle).toBeUndefined();
  await page.locator('#undo').click();await idle(page);expect((await snapshot(page)).circle).toEqual(original.circle);
  await page.locator('#redo').click();await idle(page);await page.locator('[data-op="A"]').click();await idle(page);const polynomial=await snapshot(page);
  await page.locator('#source-choose').click();await page.locator('[data-source="43"]').click();await expect(page.locator('#leave-dialog')).toBeVisible();await page.locator('#leave-discard').click();await idle(page);expect((await snapshot(page)).circle).toBeDefined();
  await page.locator('#undo').click();await idle(page);expect(await snapshot(page)).toEqual(polynomial);
});

test('circle challenges omit their solution and reopen with an exact solvable constellation',async({page})=>{
  await ready(page,47);await solve(page,47);
  await page.locator('#menu-open').click();await page.locator('#share-open').click();await page.locator('#share-kind').selectOption('challenge');
  await expect.poll(()=>page.locator('#share-link').inputValue()).toContain('v1=');const url=await page.locator('#share-link').inputValue();
  const encoded=new URL(url).hash.slice(4),artifact=JSON.parse(Buffer.from(encoded.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8'));
  expect(artifact.circle).toBeUndefined();expect(artifact.nodes).toBeUndefined();expect(artifact.goals).toHaveLength(3);
  await page.goto(url);await page.waitForFunction(()=>window.angouri?.state?.mode==='challenge');await idle(page);await solve(page,47);expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);
});

test('circle diagrams keep equal units, readable whole formulas and usable controls across layouts',async({page})=>{
  await ready(page,46);await solve(page,46);
  for(const size of [{width:1440,height:900},{width:390,height:844},{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(size);
    for(const view of ['flight','function','flow']) {
      await page.locator(`#tab-${view}`).click();await expect(page.locator('.katex-error')).toHaveCount(0);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
      if(view==='flight') {
        const circle=await page.locator('#trajectory').evaluate(el=>{const r=el.getBBox();return {width:r.width,height:r.height};});expect(Math.abs(circle.width-circle.height)).toBeLessThan(.1);
        const boxes=await page.evaluate(()=>['#scene','.play-dock'].map(s=>document.querySelector(s).getBoundingClientRect().toJSON()));expect(boxes[0].bottom<=boxes[1].top||boxes[0].right<=boxes[1].left).toBe(true);
        await expect(page.locator('#flight-svg foreignObject')).toHaveCount(0);
        expect(await page.locator('.target-height .katex-html').evaluateAll(labels=>{
          const grip=document.querySelector('[data-circle-handle="radius"]').getBoundingClientRect();
          return labels.every(label=>{const r=label.getBoundingClientRect();return r.right<=grip.left||r.left>=grip.right||r.bottom<=grip.top||r.top>=grip.bottom;});
        })).toBe(true);
      }
      if(view==='function')expect(await page.locator('.final-formula').evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
    }
  }
});

test('emulated touch moves a circle and the immediately following Throw tap works',async({browser,browserName})=>{
  test.skip(browserName!=='chromium','This check uses Chromium touch-event injection.');
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4174',viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  try {
    const page=await context.newPage();await ready(page,44);
    const box=await page.locator('[data-circle-handle="centre"]').boundingBox(),from={x:box.x+box.width/2,y:box.y+box.height/2},to=await screenPoint(page,1.5,.5);
    const session=await context.newCDPSession(page);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});
    for(let i=1;i<=6;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/6,y:from.y+(to.y-from.y)*i/6}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await idle(page);
    expect((await snapshot(page)).circle).toEqual({x:'3/2',y:'1/2',radius:'1'});expect(await page.evaluate(()=>window.angouri.history.undo)).toBe(1);
    await page.locator('#launch').tap();await expect(page.locator('#launch')).toHaveText('Next puzzle');
    await page.locator('#undo').tap();await idle(page);expect((await snapshot(page)).circle).toEqual({x:'2',y:'0',radius:'1'});
    await ready(page,43);
    const sling=await page.locator('[data-circle-handle="radius"]').boundingBox(),a=await screenPoint(page,2,0),b=await screenPoint(page,3,0),start={x:sling.x+sling.width/2,y:sling.y+sling.height/2};
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
    for(let i=1;i<=6;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(b.x-a.x)*i/12,y:start.y}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await idle(page);
    expect((await snapshot(page)).circle.radius).toBe('1');expect(await page.evaluate(()=>window.angouri.flight.phase)).toBe('ready');
    await page.locator('#launch').tap();await expect(page.locator('#launch')).toHaveText('Next puzzle');
  } finally {await context.close();}
});

test('tiny circles keep the centre separate from the slingshot and preserve pickup offsets',async({page})=>{
  await ready(page,46);await page.setViewportSize({width:320,height:568});await parameter(page,'radius','1/4');
  const handle=page.locator('[data-circle-handle="radius"]');await handle.scrollIntoViewIfNeeded();
  const radius=await handle.boundingBox(),centre=await page.locator('[data-circle-handle="centre"]').boundingBox();
  expect(radius.x+radius.width<=centre.x||centre.x+centre.width<=radius.x||radius.y+radius.height<=centre.y||centre.y+centre.height<=radius.y).toBe(true);
  const from={x:radius.x+radius.width/2,y:radius.y+radius.height/2};
  const a=await screenPoint(page,2,0),b=await screenPoint(page,3,0),step=Math.abs(b.x-a.x)/4;
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(from.x+step,from.y+5,{steps:5});
  expect((await snapshot(page)).circle.radius).toBe('1/4');await expect(page.locator('#circle-preview')).toBeVisible();
  await page.mouse.up();await idle(page);expect((await snapshot(page)).circle.radius).toBe('1/2');await page.locator('#undo').click();await idle(page);expect((await snapshot(page)).circle.radius).toBe('1/4');
});

test('the slingshot controls radius, previews its move, cancels cleanly and never throws on drop',async({page})=>{
  await ready(page,43);
  const handle=page.getByRole('button',{name:'Resize circle radius with the slingshot'}),before=await snapshot(page),launcher=page.locator('#launcher'),original=await launcher.getAttribute('transform');
  const start=await handle.boundingBox(),a=await screenPoint(page,2,0),b=await screenPoint(page,3,0),step=(b.x-a.x)/2;
  const from={x:start.x+start.width/2+5,y:start.y+start.height/2-5};
  for(const cancel of [true,false]) {
    await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(from.x+step,from.y+9,{steps:8});
    expect(await snapshot(page)).toEqual(before);expect(await launcher.getAttribute('transform')).not.toBe(original);await expect(page.locator('#circle-preview')).toBeVisible();
    if(cancel)await page.keyboard.press('Escape');await page.mouse.up();await idle(page);
    if(cancel){expect(await snapshot(page)).toEqual(before);expect(await launcher.getAttribute('transform')).toBe(original);}
  }
  expect((await snapshot(page)).circle.radius).toBe('1');expect(await page.evaluate(()=>window.angouri.history.undo)).toBe(1);
  expect(await page.evaluate(()=>window.angouri.flight.phase)).toBe('ready');expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);
  await page.locator('#launch').click();await expect(page.locator('#launch')).toHaveText('Next puzzle');
  await page.locator('#undo').click();await idle(page);expect((await snapshot(page)).circle.radius).toBe('1/2');
  await handle.click();const point=await screenPoint(page,3,0);await page.mouse.click(point.x,point.y);await idle(page);expect((await snapshot(page)).circle.radius).toBe('1');
});
