import {test,expect} from '@playwright/test';

const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
const pile=(page,op)=>page.locator(`.ingredient-stack:has([data-op="${op}"])`);
const stock=(page,op)=>pile(page,op).locator('.stock-total annotation');
async function checkStock(page,op,count){
  await expect(pile(page,op).locator('.ingredient')).toHaveAttribute('data-stock',String(count));
  if(count>3)await expect(stock(page,op)).toHaveText(String(count));
  else await expect(pile(page,op).locator('.stock-total')).toHaveCount(0);
}
async function checkLayers(page,op,opacities){
  const layers=await pile(page,op).locator('.stock-deck').evaluate(el=>({
    mask:getComputedStyle(el).maskImage,
    copies:[...el.children].map(copy=>({opacity:Number(getComputedStyle(copy).opacity),mask:getComputedStyle(copy).maskImage}))
  }));
  expect(layers).toEqual({mask:'none',copies:opacities.map(opacity=>({opacity,mask:'none'}))});
}
const place=async(page,op)=>{await page.locator(`[data-op="${op}"]`).click();await idle(page);await page.mouse.move(0,0);};
const paletteSize=page=>page.locator('#palette').evaluate(el=>({width:el.clientWidth,height:el.clientHeight}));
const markerStyle=marker=>marker.evaluate(el=>{
  const style=getComputedStyle(el);
  return Object.fromEntries(['fontSize','lineHeight','right','bottom','opacity','borderTopWidth','backgroundColor'].map(key=>[key,style[key]]));
});
async function checkCompactTray(page){
  for(const viewport of [{width:320,height:568},{width:844,height:390},{width:1146,height:850}]){
    await page.setViewportSize(viewport);
    const layout=await page.locator('.play-dock').evaluate(el=>{
      const dock=el.getBoundingClientRect(),action=el.querySelector('.dock-actions').getBoundingClientRect();
      return {overflow:document.documentElement.scrollWidth-innerWidth,clip:el.scrollHeight-el.clientHeight,actionInside:action.top>=dock.top&&action.bottom<=dock.bottom};
    });
    expect(layout).toEqual({overflow:0,clip:0,actionInside:true});
  }
}

async function ready(page){
  await page.goto('/#level=25&view=flight');
  await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
}

async function pauseRefills(page){
  await page.evaluate(()=>{
    const paused=new WeakSet();
    // Step CSS animations explicitly; protocol latency must not decide which
    // frame a fast or slow browser happens to expose to the assertions.
    window.stackObserver=new MutationObserver(()=>{
      for(const animation of document.querySelector('#palette').getAnimations({subtree:true})){
        if(animation instanceof CSSAnimation&&animation.animationName.startsWith('refill-')&&!paused.has(animation)){
          paused.add(animation);animation.pause();animation.currentTime=0;
        }
      }
    });
    window.stackObserver.observe(document.querySelector('#palette'),{attributes:true,childList:true,subtree:true});
  });
}

async function checkRefill(page,op,bottomOpacity=.3){
  const frames=await pile(page,op).evaluate(async el=>{
    const animations=el.getAnimations({subtree:true}).filter(a=>a instanceof CSSAnimation&&a.animationName.startsWith('refill-'));
    const frames=[];
    for(const time of [0,130,260]){
      animations.forEach(a=>a.currentTime=time);
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const front=getComputedStyle(el.querySelector('.ingredient-surface')),bottom=getComputedStyle(el.querySelector('.stock-deck i:last-child'));
      frames.push({frontY:new DOMMatrix(front.transform).m42,bottomY:new DOMMatrix(bottom.transform).m42,frontOpacity:Number(front.opacity),opacity:Number(bottom.opacity)});
    }
    animations.forEach(a=>a.finish());
    return {count:animations.length,frames};
  });
  expect(frames.count).toBe(3);
  const [start,middle,end]=frames.frames;
  expect(start).toEqual({frontY:8,bottomY:8,frontOpacity:.65,opacity:0});
  expect(middle.frontY).toBeGreaterThan(0);expect(middle.frontY).toBeLessThan(8);
  expect(middle.bottomY).toBeCloseTo(middle.frontY,3);
  expect(middle.frontOpacity).toBeGreaterThan(.65);expect(middle.frontOpacity).toBeLessThan(1);
  expect(middle.opacity).toBeGreaterThan(0);expect(middle.opacity).toBeLessThan(bottomOpacity);
  expect(end).toEqual({frontY:0,bottomY:0,frontOpacity:1,opacity:bottomOpacity});
}

test('finite hidden stock refills from below, becomes literal at three, and shares Create markers',async({page},testInfo)=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await ready(page);await pauseRefills(page);
  const size=await paletteSize(page),finiteStyle=await markerStyle(pile(page,'A').locator('.stock-total'));
  for(const [op,count] of [['H',5],['A',6]]){
    await checkStock(page,op,count);await checkLayers(page,op,[.65,.3]);
  }
  // A cancelled pickup neither consumes a copy nor refills the pile.
  const face=await page.locator('[data-op="A"]').boundingBox();
  await page.mouse.move(face.x+face.width/2,face.y+face.height/2);await page.mouse.down();await page.mouse.move(face.x,face.y-30,{steps:4});
  await page.keyboard.press('Escape');await page.mouse.up();await expect(stock(page,'A')).toHaveText('6');
  await expect(page.locator('.refilling')).toHaveCount(0);
  await place(page,'A');await expect(stock(page,'A')).toHaveText('5');await checkRefill(page,'A');
  await page.locator('#undo').click();await idle(page);await expect(stock(page,'A')).toHaveText('6');
  await page.locator('#redo').click();await idle(page);await expect(stock(page,'A')).toHaveText('5');await checkRefill(page,'A');
  for(const count of [4,3]){
    await place(page,'A');await checkStock(page,'A',count);await checkRefill(page,'A',count===3?1:.3);
    await checkLayers(page,'A',count===3?[1,1]:[.65,.3]);
  }
  // Crossing the threshold in either direction preserves the pile and reveals
  // the exact count again when not all copies are represented.
  await page.locator('#undo').click();await idle(page);await checkStock(page,'A',4);await checkLayers(page,'A',[.65,.3]);
  await page.locator('.part-body').first().click();await checkLayers(page,'A',[1,.65,.3]);
  await page.keyboard.press('Escape');await checkLayers(page,'A',[.65,.3]);
  await page.locator('#redo').click();await idle(page);await checkStock(page,'A',3);await checkRefill(page,'A',1);
  // Taking from the four-copy supply by drag uses the same replenishment.
  await page.locator('[data-op="H"]').focus();await page.keyboard.press('Space');await idle(page);
  await expect(stock(page,'H')).toHaveText('4');await checkRefill(page,'H');
  const from=await page.locator('[data-op="H"]').boundingBox(),to=await page.locator('[data-empty]').first().boundingBox();
  await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:8});await page.mouse.up();await idle(page);
  await checkStock(page,'H',3);await checkRefill(page,'H',1);
  await place(page,'A');await checkStock(page,'A',2);
  await expect(pile(page,'A').locator('.stock-deck i')).toHaveCount(1);await expect(page.locator('.refilling')).toHaveCount(0);
  expect(await paletteSize(page)).toEqual(size);
  await checkCompactTray(page);
  await page.screenshot({path:testInfo.outputPath('finite-stock.png'),fullPage:true});
  await page.locator('#menu-open').click();await page.locator('#nav-create').click();
  if(await page.locator('#leave-dialog').isVisible())await page.locator('#leave-discard').click();await idle(page);
  expect(await markerStyle(pile(page,'A').locator('.reusable-mark'))).toEqual(finiteStyle);
  await expect(pile(page,'A').locator('.reusable-mark annotation')).toHaveText('\\infty');
  await place(page,'A');await checkRefill(page,'A');
  await checkLayers(page,'A',[.65,.3]);
  await checkCompactTray(page);
  await page.locator('#menu-open').click();await page.locator('#settings-open').click();await page.locator('#motion-toggle').check();await page.keyboard.press('Escape');
  await place(page,'A');await expect(page.locator('.refilling')).toHaveCount(0);
  expect(await pile(page,'A').evaluate(el=>el.getAnimations({subtree:true}).length)).toBe(0);
});
