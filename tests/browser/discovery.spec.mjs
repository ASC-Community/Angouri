import {test,expect} from '@playwright/test';

const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
async function ready(page,id) {
  await page.goto('/about/');await page.goto(`/#level=${id}&view=flight`);
  await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
}
async function add(page,op,slot) {
  if(slot!==undefined)await page.locator(`[data-empty="${slot}"]`).click();
  await page.locator(`[data-op="${op}"]`).click();await idle(page);
}
const readings=page=>page.evaluate(()=>window.angouri.result.checkpoints.map(point=>point.actual));
const snapshot=page=>page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}));

test('actual lift arrangements show their block order through selection, moves and history',async({page})=>{
  await ready(page,3);await expect(page.locator('#hints-open')).toBeHidden();await expect(page.locator('#ideas-open')).toBeVisible();
  await add(page,'H');await add(page,'A');
  await expect(page.locator('#feedback')).toContainText('The halved curve is raised by');
  await expect(page.locator('#feedback .discovery-operations')).toHaveAccessibleName('Block 1: Halve; then Block 2: Add one');
  await page.locator('.part-body').last().focus();await page.keyboard.press('ArrowLeft');await idle(page);
  await expect(page.locator('#feedback')).toContainText('Every height is halved. The added lift shrinks:');
  await expect(page.locator('#feedback annotation').last()).toHaveText('1\\to\\frac12');
  await expect(page.locator('#feedback .discovery-operations')).toHaveAccessibleName('Block 1: Add one; then Block 2: Halve');
  expect((await readings(page))[0]).toBe('1/2');
  await page.locator('#undo').click();await idle(page);await expect(page.locator('#feedback')).toContainText('The halved curve is raised by');
  expect((await readings(page))[0]).toBe('1');
  await page.locator('#redo').click();await idle(page);await expect(page.locator('#feedback')).toContainText('The added lift shrinks:');
  for(const view of ['function','flow','flight']) {await page.locator(`#tab-${view}`).click();await expect(page.locator('#feedback')).toContainText('The added lift shrinks:');}
  await page.keyboard.press('Escape');await page.locator('.part-body').last().click();
  await expect(page.locator('#feedback')).toContainText('Every height is halved. The added lift shrinks:');
  await expect(page.locator('#feedback .discovery-operation')).toHaveCount(2);
  await expect(page.locator('#feedback .discovery-operations')).toHaveAccessibleName('Block 1: Add one; then Block 2: Halve');
  await expect(page.locator('#feedback .discovery-operation').last()).toHaveClass(/sage/);
  await expect(page.locator('#feedback')).not.toContainText(/At this (step|pair)/);
  // A cancelled drag must not describe a proposed order as an accepted lesson.
  const before=await snapshot(page),finding=await page.locator('#feedback').textContent(),box=await page.locator('.part-body').last().boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x-30,box.y-30,{steps:4});await page.keyboard.press('Escape');await page.mouse.up();
  expect(await snapshot(page)).toEqual(before);await expect(page.locator('#feedback')).toHaveText(finding);
});

test('an insertion before existing blocks and a drag follow the edited block, not the last block',async({page},testInfo)=>{
  await ready(page,24);await add(page,'H',1);await add(page,'H',2);await add(page,'A',0);
  await expect(page.locator('#feedback')).toContainText('Every height is halved twice. The added lift shrinks:');
  await expect(page.locator('#feedback annotation').last()).toHaveText('1\\to\\frac12\\to\\frac14');
  await expect(page.locator('#feedback .discovery-operations')).toHaveAccessibleName('Block 1: Add one; then Block 2: Halve; then Block 3: Halve');
  await expect(page.locator('#feedback .discovery-operation').first()).toHaveClass(/peach/);
  expect((await readings(page))[0]).toBe('1/4');
  const from=await page.locator('.part-body').first().boundingBox(),to=await page.locator('[data-empty="3"]').boundingBox();
  await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:10});await page.mouse.up();await idle(page);
  await expect(page.locator('#feedback')).toContainText('The halved curve is raised by');
  expect((await readings(page))[0]).toBe('1');
  await page.locator('#undo').click();await idle(page);await expect(page.locator('#feedback')).toContainText('Every height is halved twice');
  await page.keyboard.press('Escape');await add(page,'A',3);
  await page.locator('.part-body').last().focus();await page.keyboard.press('ArrowLeft');await idle(page);
  expect((await readings(page))[0]).toBe('3/4');
  // Follow the first lift through the actual intervening block, without
  // presenting the two halves as if they were adjacent in this recipe.
  await page.keyboard.press('Escape');const before=await snapshot(page);await page.locator('.part-body').first().click();
  expect(await snapshot(page)).toEqual(before);
  await expect(page.locator('#feedback')).toContainText('The first lift shrinks:');
  await expect(page.locator('#feedback .discovery-operations')).toHaveAccessibleName('Block 1: Add one; then Block 2: Halve; then Block 3: Add one; then Block 4: Halve');
  for(const viewport of [{width:1146,height:850},{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(viewport);
    const layout=await page.locator('#feedback').evaluate(feedback=>{
      const text=feedback.getBoundingClientRect(),action=document.querySelector('.dock-actions').getBoundingClientRect(),dock=feedback.closest('.play-dock').getBoundingClientRect();
      return {overflow:document.documentElement.scrollWidth-innerWidth,clip:feedback.scrollWidth-feedback.clientWidth,overlap:Math.min(text.right,action.right)>Math.max(text.left,action.left)&&Math.min(text.bottom,action.bottom)>Math.max(text.top,action.top),actionInside:action.top>=dock.top&&action.bottom<=dock.bottom};
    });
    expect(layout).toEqual({overflow:0,clip:0,overlap:false,actionInside:true});
    await page.screenshot({path:testInfo.outputPath(`lift-sequence-${viewport.width}.png`),fullPage:true});
  }
});

test('fixed slope and area stations teach the arrangement on each side without a Hints detour',async({page})=>{
  test.setTimeout(120000);
  await ready(page,33);await add(page,'Q',2);await expect(page.locator('#hints-open')).toBeHidden();
  await expect(page.locator('#feedback')).toContainText('Squaring the slopes');
  await page.locator('.part-body').focus();await page.keyboard.press('ArrowLeft');await idle(page);
  await expect(page.locator('#feedback')).toContainText('flat place at the incoming zero');
  expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);
  await ready(page,35);await add(page,'Q',0);await expect(page.locator('#feedback')).toContainText('three flat places');
  await ready(page,41);await add(page,'D',0);await expect(page.locator('#feedback')).toContainText('recovers change');
  expect((await readings(page))[0]).toBe('0');
  await page.locator('.part-body').focus();await page.keyboard.press('ArrowRight');await idle(page);
  await expect(page.locator('#feedback')).toContainText('recovers the heights that entered Accumulate');
  expect((await readings(page))[0]).toBe('1');
  await page.keyboard.press('Escape');await add(page,'A',0);await expect(page.locator('#feedback')).toContainText('preserves this input lift');
  expect((await readings(page))[0]).toBe('2');
});

test('Notes reopens at the current lesson after reading a prerequisite',async({page})=>{
  await page.setViewportSize({width:390,height:844});await ready(page,81);await page.locator('#ideas-open').click();
  await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('[data-note-lesson]').first()).toHaveAttribute('data-note-lesson','81');
  await expect(page.locator('[data-note-lesson="81"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('[data-note-lesson="79"]').click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
  await page.locator('#notes-reading').evaluate(dialog=>dialog.scrollTop=dialog.scrollHeight);
  expect(await page.locator('#notes-reading').evaluate(dialog=>dialog.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press('Escape');await page.locator('#ideas-open').click();
  await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('[data-note-lesson="81"]')).toHaveAttribute('aria-pressed','true');
  expect(await page.locator('#notes-reading').evaluate(dialog=>dialog.scrollTop)).toBe(0);
  await expect(page.locator('[data-note-lesson][aria-pressed=true]')).toContainText('8.5');
});

test('equivalent orders say what stays the same and threshold orders describe their own input',async({page})=>{
  await ready(page,60);await add(page,'A');await add(page,'F');
  await expect(page.locator('#feedback')).toContainText('whole-unit lift before Floor');const original=await readings(page);
  await page.locator('.part-body').first().focus();await page.keyboard.press('ArrowRight');await idle(page);
  await expect(page.locator('#feedback')).toContainText('without moving their thresholds');expect(await readings(page)).toEqual(original);
  await ready(page,40);await add(page,'H',0);const incoming=await readings(page);
  await expect(page.locator('#feedback')).toContainText('input or the accumulated result');
  await page.locator('.part-body').focus();await page.keyboard.press('ArrowRight');await idle(page);
  expect(await readings(page)).toEqual(incoming);await expect(page.locator('#feedback')).toContainText('input or the accumulated result');
});

test('short reuse lessons expose discoveries while planning puzzles keep Hints',async({page})=>{
  test.setTimeout(180000);
  for(const id of [9,13,30,48,78,79,81,54,59,61,62,21]) {
    await ready(page,id);await expect(page.locator('#hints-open')).toBeHidden();await expect(page.locator('#ideas-open')).toBeVisible();
    const op=await page.locator('[data-op]').first().getAttribute('data-op');await add(page,op);
    await expect(page.locator('#feedback')).toHaveClass(/discovery-feedback/);await expect(page.locator('#feedback')).not.toBeEmpty();
  }
  for(const id of [4,25,31,36,42,55,63]){await ready(page,id);await expect(page.locator('#hints-open')).toBeVisible();}
});

test('station discovery findings fit with the Flight diagram and actions through compact reflow',async({page},testInfo)=>{
  await ready(page,54);await add(page,'Q',2);await add(page,'H',3);await add(page,'A',4);
  await page.keyboard.press('Escape');await page.locator('.part-body').first().click();
  await expect(page.locator('#feedback .discovery-operations')).toHaveAccessibleName('Block 2: Square; then Block 3: Halve');
  await expect(page.locator('#feedback')).toContainText('halves the squared result');
  await page.keyboard.press('Escape');await page.locator('.part-body').nth(1).click();
  await expect(page.locator('#feedback .discovery-operations')).toHaveAccessibleName('Block 3: Halve; then Block 4: Add one');
  await expect(page.locator('#feedback')).toContainText('The halved curve is raised by');
  for(const size of [{width:1512,height:982},{width:1146,height:610},{width:390,height:844},{width:844,height:390},{width:320,height:568}]) {
    await page.setViewportSize(size);await expect(page.locator('#feedback')).toBeVisible();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const layout=await page.evaluate(()=>{
      const feedback=document.querySelector('#feedback'),scroller=document.querySelector('#scene'),scene=scroller.getBoundingClientRect(),diagram=document.querySelector('.flight-diagram').getBoundingClientRect(),dock=document.querySelector('.play-dock').getBoundingClientRect(),text=feedback.getBoundingClientRect(),action=document.querySelector('.dock-actions').getBoundingClientRect();
      return {overflow:document.documentElement.scrollWidth-innerWidth,clip:feedback.scrollWidth-feedback.clientWidth,contained:diagram.bottom<=scene.top+scroller.scrollHeight-scroller.scrollTop+1&&diagram.right<=scene.right+1,overlap:Math.min(text.right,action.right)>Math.max(text.left,action.left)&&Math.min(text.bottom,action.bottom)>Math.max(text.top,action.top),dockOverlap:Math.min(scene.right,dock.right)>Math.max(scene.left,dock.left)+1&&Math.min(scene.bottom,dock.bottom)>Math.max(scene.top,dock.top)+1};
    });
    expect(layout).toEqual({overflow:0,clip:0,contained:true,overlap:false,dockOverlap:false});
    const inline=await page.locator('#feedback').evaluate(el=>{
      const icons=el.querySelector('.discovery-operations').getBoundingClientRect(),text=el.lastElementChild.firstChild;
      const range=document.createRange();range.setStart(text,0);range.setEnd(text,text.textContent.indexOf(' '));const word=range.getBoundingClientRect();
      return word.left>=icons.right&&word.top>=icons.top&&word.bottom<=icons.bottom;
    });expect(inline,'the first words use the space beside the unbroken block sequence').toBe(true);
    if(size.width===844)await page.screenshot({path:testInfo.outputPath('station-discovery-landscape.png'),fullPage:true});
  }
});
