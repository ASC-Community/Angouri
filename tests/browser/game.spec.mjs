import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const {version:appVersion}=JSON.parse(await readFile(new URL('../../package.json',import.meta.url),'utf8'));
const releaseHeading=(await readFile(new URL('../../CHANGELOG.md',import.meta.url),'utf8')).split('\n').find(line=>line.startsWith(`## ${appVersion} — `)).slice(3).trim();
async function ready(page,path='/') {await page.goto(path);await page.waitForFunction(()=>window.angouri?.state&&document.querySelector('#playground')?.getAttribute('aria-busy')==='false');}
async function idle(page) {await page.evaluate(()=>window.angouri.whenIdle());}
async function place(page,op) {await page.locator(`[data-op="${op}"]`).click();await idle(page);}

async function placeRecipe(page,ops) {
  const station=(await page.evaluate(()=>window.angouri.state)).station;
  if(!station){for(const op of ops)await place(page,op);return;}
  let after=false,beforeIndex=0,afterIndex=station.before+1;
  for(const op of ops) {
    if(!after&&op===station.op){after=true;continue;}
    await page.locator('[data-empty="'+(after?afterIndex++:beforeIndex++)+'"]').click();await place(page,op);
  }
}

async function setCircle(page,values) {
  for(const [key,value] of Object.entries(values)) {
    const input=page.locator(`[data-circle-value="${key}"]`);
    if(!await input.count())continue;
    await input.fill(value);await input.press('Enter');await idle(page);
  }
}

async function discardNavigation(page) {if(await page.locator('#leave-dialog').isVisible())await page.locator('#leave-discard').click();}
async function menu(page,id) {await page.locator('#menu-open').click();await page.locator(`#${id}`).click();if(id==='nav-create')await discardNavigation(page);}
async function changeView(page,view) {await page.locator(`#tab-${view}`).click();}
const puzzleOption=(page,level)=>page.locator(`#level-nav .level-option[data-level="${level}"]`);
async function choosePuzzle(page,level) {await menu(page,'puzzles-open');const option=puzzleOption(page,level);if(!await option.isVisible())await option.locator('xpath=ancestor::details').locator('summary').click({position:{x:12,y:12}});await option.click();await discardNavigation(page);await idle(page);}
async function throwIt(page) {await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');}
const snapshot=page=>page.evaluate(()=>window.angouri.state);

test('the opening puzzles invite direct choices, add context at 1.2, and reveal the workspace at 1.3',async({page})=>{
  await ready(page);
  await expect(page.locator('.game-shell')).toHaveClass(/intro/);
  for(const selector of ['#level-category','#level-title','#ideas-open','.view-tabs','.construction','.recipe-heading','#undo','#redo','#reset','#launch'])await expect(page.locator(selector)).toBeHidden();
  await expect(page.locator('[data-op]')).toHaveCount(2);
  await expect(page.locator('[data-op="H"]')).toHaveCSS('cursor','pointer');
  const logo=await page.locator('.brand').boundingBox();expect(logo.x+logo.width/2).toBeCloseTo(page.viewportSize().width/2,0);expect(logo.width).toBeGreaterThan(200);expect(logo.height).toBeGreaterThan(60);
  await page.locator('[data-op="A"]').focus();await page.keyboard.press('Enter');await idle(page);
  await expect(page.locator('[data-op="A"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#launch')).toBeVisible();
  expect((await snapshot(page)).nodes.map(n=>n.op)).toEqual(['A']);expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(false);
  await page.locator('[data-op="H"]').focus();await page.keyboard.press('Enter');await idle(page);
  expect((await snapshot(page)).nodes.map(n=>n.op)).toEqual(['H']);expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);
  const chosenLogo=await page.locator('.brand').boundingBox();expect(chosenLogo).toEqual(logo);
  await place(page,'H');expect((await snapshot(page)).nodes).toEqual([]);
  await expect(page.locator('[data-op="H"]')).toHaveAttribute('aria-pressed','false');await expect(page.locator('[data-op="H"]')).toBeFocused();await expect(page.locator('#launch')).toBeHidden();
  await page.keyboard.press('Control+z');await idle(page);expect((await snapshot(page)).nodes.map(n=>n.op)).toEqual(['H']);
  await throwIt(page);await expect(page.locator('.view-tabs')).toBeHidden();await expect(page.locator('#launch')).toHaveText('Next puzzle');
  await page.locator('#launch').click();await idle(page);
  expect((await snapshot(page)).sourceId).toBe(2);await expect(page.locator('.game-shell')).toHaveClass(/intro/);await expect(page.locator('.game-shell')).not.toHaveClass(/landing/);
  await expect(page.locator('#level-category')).toBeVisible();await expect(page.locator('#level-title')).toBeVisible();await expect(page.locator('#axis-labels')).toBeVisible();
  for(const selector of ['#ideas-open','.view-tabs','.construction','.recipe-heading','#undo','#redo','#reset','#launch'])await expect(page.locator(selector)).toBeHidden();
  await expect(page.locator('[data-op]')).toHaveCount(3);await place(page,'H');await place(page,'A');
  expect((await snapshot(page)).nodes.map(n=>n.op)).toEqual(['A']);await throwIt(page);await page.locator('#launch').click();await idle(page);
  expect((await snapshot(page)).sourceId).toBe(3);await expect(page.locator('.game-shell')).not.toHaveClass(/intro/);
  for(const selector of ['#level-category','#ideas-open','.view-tabs','.construction','.recipe-heading'])await expect(page.locator(selector)).toBeVisible();
});

test('replayed and directly linked opening puzzles stay focused without a full-editor override',async({page})=>{
  await page.addInitScript(()=>{const key='angouri:vine:v1:preferences';if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({view:'function',motion:true}));});
  await ready(page);await place(page,'H');await throwIt(page);await page.reload();await page.waitForFunction(()=>window.angouri?.state);
  await expect(page.locator('.game-shell')).toHaveClass(/intro/);expect((await snapshot(page)).nodes.map(n=>n.op)).toEqual(['H']);
  await ready(page,'/#level=1&view=function');await expect(page.locator('.game-shell')).toHaveClass(/intro/);expect(await page.evaluate(()=>window.angouri.view)).toBe('function');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('angouri:vine:v1:progress')).completed)).toEqual([1]);
  await expect(page.locator('#scene')).toHaveAttribute('data-view','flight');await expect(page.locator('#flight-svg')).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('angouri:vine:v1:preferences')).view)).toBe('function');
  for(const selector of ['.view-tabs','#ideas-open','.construction','.recipe-heading','#undo','#redo','#reset'])await expect(page.locator(selector)).toBeHidden();
  const saved=await snapshot(page);await page.locator('#menu-open').click();await expect(page.locator('#menu-show-controls')).toHaveCount(0);await page.keyboard.press('Escape');expect(await snapshot(page)).toEqual(saved);
  await ready(page,'/#level=2&view=flight');await expect(page.locator('.game-shell')).toHaveClass(/intro/);await expect(page.locator('.game-shell')).not.toHaveClass(/landing/);
  for(const viewport of [{width:1440,height:900},{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(viewport);
    await expect.poll(async()=>{
      const label=await page.locator('.zero-label .katex-html').boundingBox(),target=await page.locator('[data-ring="0"] .ring-outer').boundingBox();
      const axis=await page.locator('.flight-height-axis').boundingBox(),tick=await page.locator('#axis-labels .flight-label').first().boundingBox();
      if(!label||!target||!axis||!tick)return false;
      const targetCenter=target.x+target.width/2;
      return label.x+label.width<target.x-1&&Math.abs(axis.x+axis.width/2-targetCenter)<=1&&Math.abs(tick.x+tick.width/2-targetCenter)<=1;
    }).toBe(true);
  }
  expect(await page.evaluate(()=>window.angouri.view)).toBe('function');await expect(page.locator('#scene')).toHaveAttribute('data-view','flight');
  await place(page,'A');await throwIt(page);await page.locator('#launch').click();await idle(page);
  expect((await snapshot(page)).sourceId).toBe(3);await expect(page.locator('#scene')).toHaveAttribute('data-view','function');await expect(page.locator('#tab-function')).toHaveAttribute('aria-selected','true');
});

test('single-slot lessons use choices without hiding learned views or changing layout as they fill',async({page})=>{
  for(const [level,op] of [[6,'N'],[7,'Q'],[12,'Q'],[29,'Q'],[66,'Q']]) {
    await page.goto('/about/');await ready(page,`/#level=${level}&view=function`);
    await expect(page.locator('.game-shell')).toHaveClass(/choice-game/);await expect(page.locator('.game-shell')).not.toHaveClass(/landing/);
    for(const selector of ['#level-category','#ideas-open','.view-tabs'])await expect(page.locator(selector)).toBeVisible();
    for(const selector of ['.construction','.recipe-heading','#launch'])await expect(page.locator(selector)).toBeHidden();
    await expect(page.locator('#scene')).toHaveAttribute('data-view','function');
    await page.locator(`[data-op="${op}"]`).focus();await page.keyboard.press('Enter');await idle(page);
    expect((await snapshot(page)).nodes.map(n=>n.op)).toEqual([op]);await expect(page.locator(`[data-op="${op}"]`)).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('.construction')).toBeHidden();await expect(page.locator('#launch')).toBeVisible();
    await changeView(page,'flow');await expect(page.locator('#scene')).toHaveAttribute('data-view','flow');
    const choice=page.locator(`[data-op="${op}"]`);await choice.focus();await page.keyboard.press('Space');await idle(page);
    expect((await snapshot(page)).nodes).toEqual([]);await expect(choice).toHaveAttribute('aria-pressed','false');await expect(choice).toBeFocused();await expect(page.locator('#launch')).toBeHidden();
    await page.keyboard.press('Control+z');await idle(page);expect((await snapshot(page)).nodes.map(n=>n.op)).toEqual([op]);
    await page.keyboard.press('Control+Shift+z');await idle(page);expect((await snapshot(page)).nodes).toEqual([]);
    await expect(page.locator('#scene')).toHaveAttribute('data-view','flow');await expect(page.locator('.construction')).toBeHidden();
  }
  await page.goto('/about/');await ready(page,'/#level=3');await place(page,'A');
  await expect(page.locator('.empty-slot')).toHaveCount(1);await expect(page.locator('.construction')).toBeVisible();await expect(page.locator('.game-shell')).not.toHaveClass(/choice-game/);
  await page.goto('/about/');await ready(page,'/#level=32');await expect(page.locator('.fixed-station')).toBeVisible();await expect(page.locator('.game-shell')).not.toHaveClass(/choice-game/);
});

test('pickup previews legal gaps and cancelling keeps the acknowledged recipe',async({page})=>{
  await ready(page,'/#level=3&view=flight');
  const start=await snapshot(page),history=await page.evaluate(()=>window.angouri.history);
  const piece=page.locator('[data-op="H"]'),slot=page.locator('[data-insert="0"]');
  await piece.hover();await expect(slot).toHaveClass(/suggested-slot/);
  await expect(piece).toHaveCSS('cursor','grab');await expect(page.locator('.source-part')).toHaveCSS('cursor','default');
  await expect(page.locator('.source-part button,.source-pin')).toHaveCount(0);
  const pickup=async()=>{const r=await piece.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2,r.y-20,{steps:4});};
  await pickup();await expect(page.locator('.drag-ghost .katex')).toHaveCount(1);
  await expect(page.locator('#playground')).toHaveClass(/is-dragging/);expect(await snapshot(page)).toEqual(start);
  const target=await slot.boundingBox();await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:5});
  await expect(slot).toHaveClass(/drop-target/);await page.keyboard.press('Escape');await page.mouse.up();await idle(page);
  expect(await snapshot(page)).toEqual(start);expect(await page.evaluate(()=>window.angouri.history)).toEqual(history);
  await expect(page.locator('.drag-ghost')).toHaveCount(0);await expect(page.locator('.drop-target')).toHaveCount(0);
  await pickup();await page.mouse.move(20,20,{steps:5});await page.mouse.up();await idle(page);expect(await snapshot(page)).toEqual(start);
  await pickup();const rail=await page.locator('.pipeline').boundingBox();await page.mouse.move(rail.x+rail.width-14,rail.y+rail.height/2,{steps:5});
  await expect(page.locator('[data-empty="1"]')).toHaveClass(/drop-target/);await page.mouse.up();await idle(page);
  expect((await snapshot(page)).nodes.map(n=>n.op)).toEqual(['H']);await expect(page.locator('.drag-ghost')).toHaveCount(0);
  await expect(page.locator('[data-op="H"]')).toBeDisabled();await expect(page.locator('.part-body')).toHaveCSS('cursor','grab');
  await page.locator('#undo').click();await idle(page);expect(await snapshot(page)).toEqual(start);
});

test('chapter selection groups puzzles without changing the construction until a puzzle is chosen',async({page})=>{
  await ready(page,'/#level=4&view=flight');await place(page,'H');const before=await snapshot(page);
  await menu(page,'puzzles-open');await expect(page.locator('.chapter-group:not(.extra-puzzles)')).toHaveCount(10);
  await expect(page.locator('#level-nav .challenge-label')).toHaveCount(20);await expect(puzzleOption(page,71)).toContainText('Chapter challenge');await expect(puzzleOption(page,85)).toContainText('Final mastery');
  await expect(page.locator('.chapter-group[open]')).toHaveCount(1);await expect(page.locator('.chapter-group[open]>summary')).toContainText('Bowls and arches');
  const reflection=page.locator('.chapter-group').nth(1).locator('summary');await reflection.focus();await page.keyboard.press('Enter');
  await expect(page.locator('.parallel-lesson,.parallel-options,#puzzle-variations')).toHaveCount(0);
  await expect(puzzleOption(page,8).locator('.level-number')).toHaveText('2.2');await expect(puzzleOption(page,9).locator('.level-number')).toHaveText('2.3');
  await expect(puzzleOption(page,9)).toBeVisible();expect(await snapshot(page)).toEqual(before);
  await puzzleOption(page,9).click();await discardNavigation(page);await idle(page);
  await expect(page.locator('#level-category')).toHaveText('CHAPTER 2 · REFLECTION · 3 OF 4');
  await expect(page.locator('.scene-toolbar [data-target],#checkpoint-summary,.ring-meter')).toHaveCount(0);
  for(const view of ['flight','function','flow']) {await changeView(page,view);expect(await page.locator('#scene [data-target]').count()).toBeGreaterThan(0);}
});

test('adjacent lessons advance separately and award only the sources actually solved',async({page})=>{
  await ready(page,'/#level=8&view=flight');await placeRecipe(page,'NA');expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);await throwIt(page);
  await menu(page,'puzzles-open');
  const reflection=page.locator('.chapter-group').nth(1);if(!await reflection.evaluate(details=>details.open))await reflection.locator('summary').click();
  await expect(reflection.locator('.chapter-progress')).toHaveAttribute('aria-label','1 of 4 puzzles complete');
  await expect(puzzleOption(page,8)).toHaveAttribute('aria-label',/completed/);await expect(puzzleOption(page,9)).not.toHaveAttribute('aria-label',/completed/);
  await page.keyboard.press('Escape');await page.locator('#launch').click();await idle(page);
  expect((await snapshot(page)).sourceId).toBe(9);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('angouri:vine:v1:progress')).completed)).toEqual([8]);
  await placeRecipe(page,'NHA');expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);await throwIt(page);await menu(page,'puzzles-open');
  await expect(page.locator('.chapter-group').nth(1).locator('.chapter-progress')).toHaveAttribute('aria-label','2 of 4 puzzles complete');
  await expect(puzzleOption(page,8)).toHaveAttribute('aria-label',/completed/);await expect(puzzleOption(page,9)).toHaveAttribute('aria-label',/completed/);
  await page.keyboard.press('Escape');await page.locator('#launch').click();await idle(page);expect((await snapshot(page)).sourceId).toBe(26);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('angouri:vine:v1:progress')).completed)).toEqual([8,9]);
});

test('shape notes connect earlier lessons without changing a recipe, history, view or inspection scroll',async({page})=>{
  await page.setViewportSize({width:390,height:844});await ready(page,'/#level=4&view=flow');
  for(const op of ['H','Q','N'])await place(page,op);
  await page.locator('.flow-line').evaluate(el=>el.scrollTop=el.scrollHeight);
  const before=await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history,view:window.angouri.view,scroll:document.querySelector('.flow-line').scrollTop,save:localStorage.getItem('angouri:vine:v1:progress')}));
  await page.locator('#ideas-open').click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('#notes-content [data-note-target]')).toHaveCount(0);
  expect(await page.locator('#notes-content .note-plot').count()).toBeGreaterThan(0);
  const original=await page.locator('#notes-content').innerHTML();
  await expect(page.locator('[data-note="3"]')).toHaveCount(0);
  await page.locator('[data-note-lesson="10"]').click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
  await page.locator('[data-note-lesson="4"]').click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
  expect(await page.locator('#notes-content').innerHTML()).toBe(original);
  await expect(page.locator('[data-note-lesson="4"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('.katex-error')).toHaveCount(0);
  await page.getByRole('button',{name:'Back to puzzle',exact:true}).click();await expect(page.locator('#ideas-open')).toBeFocused();
  expect(await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history,view:window.angouri.view,scroll:document.querySelector('.flow-line').scrollTop,save:localStorage.getItem('angouri:vine:v1:progress')}))).toEqual(before);
  await page.locator('#ideas-open').click();await page.keyboard.press('Escape');await expect(page.locator('#ideas-open')).toBeFocused();
  await choosePuzzle(page,25);await placeRecipe(page,'AAHHHH');
  await page.locator('.flow-line').evaluate(el=>el.scrollTop=el.scrollHeight);
  const shortcutBefore=await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history,scroll:document.querySelector('.flow-line').scrollTop}));
  for(const view of ['function','flow']) {
    await page.locator('#ideas-open').click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
    const shortcut=page.locator(`.note-view-button[data-view="${view}"]`).first();
    expect(await shortcut.locator('svg').innerHTML()).toBe(await page.locator(`#tab-${view} svg`).innerHTML());
    await shortcut.click();await expect(page.locator('#ideas-dialog')).not.toBeVisible();await expect(page.locator(`#tab-${view}`)).toBeFocused();await expect(page.locator('#scene')).toHaveAttribute('data-view',view);
    expect(await snapshot(page)).toEqual(shortcutBefore.state);expect(await page.evaluate(()=>window.angouri.history)).toEqual(shortcutBefore.history);expect(await page.evaluate(()=>window.angouri.slots)).toEqual(shortcutBefore.slots);
  }
  expect(await page.locator('.flow-line').evaluate(el=>el.scrollTop)).toBe(shortcutBefore.scroll);
});

test('the full 1.5 reference survives replay and stays available in Create',async({page})=>{
  await ready(page,'/#level=25&view=function');
  const openCurrent=async()=>{await page.locator('#ideas-open').click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');};
  await openCurrent();await expect(page.locator('#notes-content')).toContainText('difference');
  const original=await page.locator('#notes-content').innerHTML();await page.keyboard.press('Escape');
  await choosePuzzle(page,24);await openCurrent();await expect(page.locator('#notes-content [data-reference-lesson="25"]')).toHaveCount(0);await page.keyboard.press('Escape');
  await choosePuzzle(page,25);await openCurrent();expect(await page.locator('#notes-content').innerHTML()).toBe(original);await page.keyboard.press('Escape');
  await menu(page,'nav-create');await idle(page);await openCurrent();await page.locator('[data-note="0"]').click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('#notes-content [data-reference-lesson="25"]')).toHaveCount(1);
  await expect(page.locator('#notes-content')).toContainText('difference');
});

test('Hints gently invite help after distinct stalled rearrangements, never while building or throwing',async({page})=>{
  await ready(page,'/#level=25&view=function');
  const notes=page.locator('#hints-open');await expect(notes).toHaveAccessibleName('Hints');await expect(notes.locator('[data-icon="bulb"] svg')).toHaveCount(1);
  for(const op of 'AAHHHH') {await place(page,op);await expect(notes).not.toHaveClass(/hint-cue/);}
  for(let i=0;i<3;i++)await throwIt(page);
  await expect(notes).not.toHaveClass(/hint-cue/);
  await page.locator('[data-empty="6"]').focus();await page.keyboard.press('ArrowRight');await idle(page);
  await expect(notes).not.toHaveClass(/hint-cue/);
  const moving=(await snapshot(page)).nodes[1].id;
  const shift=async()=>{await page.locator(`[data-stage="${moving}"]`).focus();await page.keyboard.press('ArrowRight');await idle(page);};
  await shift();await expect(notes).not.toHaveClass(/hint-cue/);
  await page.locator('#undo').click();await idle(page);await page.locator('#redo').click();await idle(page);
  await expect(notes).not.toHaveClass(/hint-cue/);
  await shift();await expect(notes).not.toHaveClass(/hint-cue/);
  await shift();await expect(notes).toHaveClass(/hint-cue/);
  await expect(notes).toHaveCSS('animation-name','none');
  await expect(page.locator('#ideas-dialog')).not.toBeVisible();await expect(page.locator('#move-announcement')).toContainText('Hints can help');
  await expect(page.locator('#ideas-open')).not.toHaveClass(/hint-cue/);
  await page.locator('#ideas-open').click();await page.keyboard.press('Escape');await expect(notes).toHaveClass(/hint-cue/);
  await page.emulateMedia({reducedMotion:'no-preference'});await menu(page,'settings-open');await page.locator('#motion-toggle').uncheck();await page.keyboard.press('Escape');
  await notes.evaluate(async button=>{
    button.getAnimations().find(animation=>animation.animationName==='hint-invite').currentTime=9500;
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
  expect(await notes.evaluate(button=>button.getAnimations().some(animation=>animation.playState==='running'&&Number(animation.currentTime)>=9500))).toBe(true);
  await shift();await expect(notes).toHaveClass(/hint-cue/);
  expect(await notes.evaluate(button=>button.getAnimations().some(animation=>animation.playState==='running'&&Number(animation.currentTime)<2000))).toBe(true);
  const before=await snapshot(page);await notes.click();await expect(notes).not.toHaveClass(/hint-cue/);await page.keyboard.press('Escape');
  expect(await snapshot(page)).toEqual(before);await shift();await expect(notes).not.toHaveClass(/hint-cue/);
});

test('the main menu opens community destinations and the version log, keeping Settings for preferences',async({page,context})=>{
  await ready(page);await page.locator('#menu-open').click();
  for(const [id,url] of [['menu-discord','https://discord.gg/VWwtVdsRMp'],['menu-github','https://github.com/ASC-Community/Angouri']]) {
    const link=page.locator(`#${id}`);await expect(link).toHaveAttribute('href',url);await expect(link.locator('use')).toHaveCount(1);
    await context.route(url,route=>route.fulfill({contentType:'text/html',body:'<title>Community destination</title>'}));
    const opened=context.waitForEvent('page');await link.click();const destination=await opened;await destination.waitForLoadState();expect(destination.url()).toBe(url);await destination.close();
    await expect(page.locator('#menu-dialog')).toBeVisible();
  }
  await expect(page.locator('#menu-version')).toContainText(`v${appVersion}`);await page.locator('#menu-version').click();
  await expect(page.locator('#releases-dialog')).toContainText(releaseHeading);await expect(page.locator('#releases-dialog')).toContainText('ten chapters');
  await page.getByRole('button',{name:'Back to menu',exact:true}).click();await expect(page.locator('#menu-dialog')).toBeVisible();await expect(page.locator('#menu-version')).toBeFocused();
  await page.locator('#settings-open').click();await expect(page.getByRole('checkbox',{name:/Skip animation/})).toBeVisible();await expect(page.locator('#settings-dialog .community-links,#settings-dialog .version-button')).toHaveCount(0);
  await page.keyboard.press('Escape');await expect(page.locator('#menu-open')).toBeFocused();
});

test('minimal openings hide notes, while later puzzles scope them and Create shows the complete reference',async({page})=>{
  test.setTimeout(300000);
  await ready(page);
  const openNotes=async()=>{await page.locator('#ideas-open').click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');};
  const closeNotes=()=>page.getByRole('button',{name:'Back to puzzle',exact:true}).click();
  await expect(page.locator('#ideas-open')).toBeHidden();await choosePuzzle(page,2);await expect(page.locator('#ideas-open')).toBeHidden();
  const chapters=[[1,2,3,24,25],[6,8,9,26],[7,10,4,27,28],[12,13,29,30,31,11],[32,33,34,35,36],[37,38,39,40,41,42],[43,44,48,78,68,69,70,66,49,71],[50,51,52,79,81,53,54,80,84,55],[56,57,58,59,60,61,62,63],[82,72,73,74,75,83,76,77,64,65,85]];
  const route=chapters.flat();
  for(const level of route.slice(2)) {
    await choosePuzzle(page,level);const before=await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history,save:localStorage.getItem('angouri:vine:v1:progress')}));
    await openNotes();const allowed=route.slice(0,route.indexOf(level)+1),chapter=chapters.findIndex(ids=>ids.includes(level));
    await expect(page.locator('[data-note]')).toHaveCount(0);
    expect(await page.locator('[data-note-lesson]').count()).toBeGreaterThan(0);
    if(level===3||level===24)await expect(page.locator('#notes-content [data-view="function"]')).toBeVisible();
    if(level===24)await expect(page.locator('#notes-content [data-view="flow"]')).toBeVisible();
    if(level===3)await expect(page.locator('#notes-content [data-view="flow"]')).toHaveCount(0);
    for(const tab of await page.locator('[data-note-lesson]').all()) {
      if(tab)await tab.click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
      await expect(page.locator('[data-retry-notes]')).toHaveCount(0);
      const references=await page.locator('#notes-content [data-reference-lesson]').evaluateAll(nodes=>nodes.map(el=>Number(el.dataset.referenceLesson)));
      expect(references).toContain(Number(await tab.getAttribute('data-note-lesson')));
      await expect(page.locator('#notes-content .note-recall')).toHaveCount(0);
      for(const reference of references)expect(allowed,`Puzzle ${level} must not reveal concept ${reference}`).toContain(reference);
      await expect(page.locator('#notes-content [data-note-target],#notes-content details')).toHaveCount(0);
      await expect(page.locator('.katex-error')).toHaveCount(0);
    }
    await closeNotes();expect(await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history,save:localStorage.getItem('angouri:vine:v1:progress')}))).toEqual(before);
  }
  await choosePuzzle(page,1);await expect(page.locator('#ideas-open')).toBeHidden();
  await choosePuzzle(page,6);await place(page,'N');await throwIt(page);await choosePuzzle(page,1);
  await page.reload();await page.waitForFunction(()=>window.angouri?.state);await expect(page.locator('#ideas-open')).toBeHidden();
  await menu(page,'nav-create');await idle(page);await page.setViewportSize({width:320,height:568});await openNotes();await expect(page.locator('[data-note]')).toHaveCount(10);
  for(let topic=0;topic<10;topic++) {
    await page.locator(`[data-note="${topic}"]`).click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
    await expect(page.locator('#notes-content details')).toHaveCount(0);
    const overflow=await page.locator('.note-formula').evaluateAll(formulas=>formulas.filter(el=>el.getClientRects().length&&(el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1)).map(el=>({formula:el.textContent,box:[el.clientWidth,el.clientHeight],content:[el.scrollWidth,el.scrollHeight]})));
    expect(overflow,`Topic ${topic} formula overflow`).toEqual([]);
    if(topic===3)await expect(page.locator('#notes-content')).toContainText(/eighth/i);
  }
  await closeNotes();await choosePuzzle(page,1);await expect(page.locator('#ideas-open')).toBeHidden();
});

test('full recipes can reorder, and Undo during a pickup cancels that pickup',async({page})=>{
  await ready(page,'/#level=3&view=flight');await place(page,'A');
  await expect(page.locator('[data-op="A"]')).toHaveAttribute('data-availability','used');
  await expect(page.locator('[data-op="H"]')).toBeEnabled();await place(page,'H');
  await expect(page.locator('[data-op="H"]')).toHaveAttribute('data-availability','used');
  await page.locator('.part-body').first().click();await page.locator('[data-return]').click();await idle(page);
  await expect(page.locator('[data-op="A"]')).toBeEnabled();await page.locator('#reset').click();await idle(page);await place(page,'H');await place(page,'A');
  const before=await snapshot(page);await page.locator(`[data-part="${before.nodes[1].id}"]`).dragTo(page.locator('[data-cell="0"]'));await idle(page);
  expect((await snapshot(page)).nodes).toEqual([before.nodes[1],before.nodes[0]]);expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);
  await expect(page.locator('#success')).toBeHidden();await expect(page.locator('#move-announcement')).toContainText('Ready to throw');
  const held=await page.locator(`[data-part="${before.nodes[1].id}"]`).boundingBox();
  await page.mouse.move(held.x+held.width/2,held.y+held.height/2);await page.mouse.down();await page.mouse.move(held.x+held.width/2,held.y-20,{steps:4});
  await expect(page.locator('.drag-ghost')).toHaveCount(1);await page.keyboard.press('Control+z');await idle(page);await page.mouse.up();await idle(page);
  expect((await snapshot(page)).nodes).toEqual(before.nodes);await expect(page.locator('.drag-ghost')).toHaveCount(0);await expect(page.locator('#playground')).not.toHaveClass(/is-dragging/);
});

test('throw reveals targets in sequence, lands once, and only then awards completion',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await ready(page,'/#level=3&view=flight');await place(page,'A');await place(page,'H');
  await expect(page.locator('.ring.hit')).toHaveCount(0);await expect(page.locator('#success')).toBeHidden();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('angouri:vine:v1:progress')).completed)).toEqual([]);
  await page.locator('#launch').click();await expect(page.locator('#launch')).toBeDisabled();
  await page.waitForFunction(()=>window.angouri.flight.position>.2&&window.angouri.flight.position<.48);
  await expect(page.locator('[data-ring="0"]')).toHaveAttribute('data-status','hit');await expect(page.locator('[data-ring="1"]')).toHaveAttribute('data-status','waiting');
  await expect(page.locator('#flight-trail')).not.toHaveAttribute('d','');
  expect(await page.locator('#flight-motion').getAttribute('transform')).not.toBe(await page.locator('#flight-spin').getAttribute('transform'));
  await expect(page.locator('#flight-spin .speed-lines')).toHaveCount(0);
  await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
  await expect(page.locator('.ring.hit')).toHaveCount(3);await expect(page.locator('#launch')).toHaveText('Next puzzle');
  await expect(page.locator('#launch')).toBeEnabled();await expect(page.locator('#launch')).toHaveClass(/continue-ready/);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('angouri:vine:v1:progress')).completed)).toEqual([3]);
  const resting=await page.locator('#cucumber').getAttribute('transform');await page.waitForTimeout(350);await expect(page.locator('#cucumber')).toHaveAttribute('transform',resting);
  const again=await page.locator('#rethrow').boundingBox(),next=await page.locator('#launch').boundingBox();expect(again.x+again.width).toBeLessThan(next.x);
  await page.locator('#rethrow').click();await page.waitForFunction(()=>window.angouri.flight.position>.05);await expect(page.locator('#launch')).toHaveText('Next puzzle');await expect(page.locator('#launch')).toBeEnabled();await expect(page.locator('#rethrow')).toBeDisabled();
  await menu(page,'puzzles-open');await expect(puzzleOption(page,3)).toHaveAttribute('aria-label',/completed/);await page.keyboard.press('Escape');
  await menu(page,'settings-open');await page.locator('#motion-toggle').check();await page.keyboard.press('Escape');
  await page.locator('#undo').click();await idle(page);await place(page,'H');await throwIt(page);
  await expect(page.locator('.just-hit,.just-placed')).toHaveCount(0);expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
  await expect(page.locator('.ring.hit')).toHaveCount(3);
});

test('the loaded pose and release follow the initial tangent without a rotation jump',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await ready(page);
  const canonical=await page.evaluate(async()=>{
    const source=await (await fetch('./cucumber.svg')).text(),host=document.createElement('div');
    host.style.cssText='position:fixed;visibility:hidden';host.innerHTML=source;document.body.append(host);
    const svg=host.querySelector('svg'),body=svg.querySelector('[data-body-frame]'),frame=body.dataset.bodyFrame.split(' ').map(Number),bend=Number(body.dataset.bodyBend);
    const matrix=body.parentElement.transform.baseVal.consolidate().matrix,top=new DOMPoint(frame[0]+frame[2]/2,frame[1]).matrixTransform(matrix),bottom=new DOMPoint(frame[0]+frame[2]/2+bend,frame[1]+frame[3]).matrixTransform(matrix);
    const viewBox=svg.getAttribute('viewBox').split(' ').map(Number);host.remove();return {top,bottom,viewBox};
  });
  for(const [level,ops,slope] of [[1,'H',2],[16,'H',0],[17,'',-1]]) {
    await choosePuzzle(page,level);for(const op of ops)await place(page,op);
    await page.waitForTimeout(350);
    const loaded=await page.evaluate(canonical=>{
      const launcher=document.querySelector('#launcher').transform.baseVal.consolidate().matrix;
      const spin=document.querySelector('#flight-spin'),image=spin.querySelector('image'),matrix=spin.getCTM(),scale=Number(image.getAttribute('width'))/canonical.viewBox[2];
      const point=p=>new DOMPoint(Number(image.getAttribute('x'))+(p.x-canonical.viewBox[0])*scale,Number(image.getAttribute('y'))+(p.y-canonical.viewBox[1])*scale).matrixTransform(matrix);
      const top=point(canonical.top),bottom=point(canonical.bottom),forward=[top.x-bottom.x,top.y-bottom.y],magnitude=Math.hypot(...forward),aimMagnitude=Math.hypot(launcher.a,launcher.b);
      const cucumber=document.querySelector('#cucumber').transform.baseVal.consolidate().matrix;
      const pouch=document.querySelector('#slingshot-pouch'),seat=new DOMPoint(0,0).matrixTransform(pouch.getCTM());
      const start=new DOMPoint(40,-12).matrixTransform(launcher);
      const delta=[cucumber.e-start.x,cucumber.f-start.y];
      return {slope:window.angouri.result.startSlope,forward:forward.map(v=>v/magnitude),aim:[launcher.a/aimMagnitude,launcher.b/aimMagnitude],delta,seatGap:Math.hypot(bottom.x-seat.x,bottom.y-seat.y)};
    },canonical);
    expect(loaded.slope).toBe(slope);
    expect(loaded.forward[0]).toBeCloseTo(loaded.aim[0],5);expect(loaded.forward[1]).toBeCloseTo(loaded.aim[1],5);
    expect(loaded.seatGap).toBeLessThan(.05);
    expect(loaded.delta[0]*loaded.aim[1]-loaded.delta[1]*loaded.aim[0]).toBeCloseTo(0,1);
    expect(loaded.delta[0]*loaded.aim[0]+loaded.delta[1]*loaded.aim[1]).toBeLessThan(-60);
    await page.evaluate(canonical=>{
      window.launchFrames=[];
      const sample=()=>{
        const spin=document.querySelector('#flight-spin'),image=spin.querySelector('image'),matrix=spin.getCTM(),scale=Number(image.getAttribute('width'))/canonical.viewBox[2];
        const point=p=>new DOMPoint(Number(image.getAttribute('x'))+(p.x-canonical.viewBox[0])*scale,Number(image.getAttribute('y'))+(p.y-canonical.viewBox[1])*scale).matrixTransform(matrix);
        const top=point(canonical.top),bottom=point(canonical.bottom),pouch=document.querySelector('#slingshot-pouch');
        const pathPoint=(selector,end)=>{const path=document.querySelector(selector),point=path.getPointAtLength(end?path.getTotalLength():0);return point.matrixTransform(path.getCTM());};
        const pouchPoint=end=>{const point=pouch.getPointAtLength(end?pouch.getTotalLength():0);return point.matrixTransform(pouch.getCTM());};
        const gap=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
        const c=document.querySelector('#cucumber').transform.baseVal.consolidate().matrix;
        window.launchFrames.push({phase:window.angouri.flight.phase,p:window.angouri.flight.position,angle:Math.atan2(top.y-bottom.y,top.x-bottom.x),x:c.e,y:c.f,backGap:gap(pathPoint('#band-back',true),pouchPoint(false)),frontGap:gap(pathPoint('#band-front',true),pouchPoint(true))});
        if(window.angouri.flight.position<.07)requestAnimationFrame(sample);
      };requestAnimationFrame(sample);
    },canonical);
    await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.position>.08);
    const frames=await page.evaluate(()=>window.launchFrames),release=frames.filter(f=>f.phase==='releasing'),flying=frames.filter(f=>f.phase==='flying');expect(release.length).toBeGreaterThan(1);expect(flying.length).toBeGreaterThan(1);
    expect(Math.max(...release.map(f=>f.angle))-Math.min(...release.map(f=>f.angle))).toBeLessThan(.001);
    const a=release[0],b=release.at(-1),dx=b.x-a.x,dy=b.y-a.y;
    expect(dx*loaded.aim[1]-dy*loaded.aim[0]).toBeCloseTo(0,1);expect(dx*loaded.aim[0]+dy*loaded.aim[1]).toBeGreaterThan(0);
    for(let i=1;i<frames.length;i++)expect(Math.abs(frames[i].angle-frames[i-1].angle)).toBeLessThan(.08);
    expect(Math.max(...frames.map(f=>f.backGap),...frames.map(f=>f.frontGap))).toBeLessThan(.05);
  }
});

test('signed area follows the Flow slider and shared reward clock, then restores the inspected position',async({page})=>{
  await ready(page,'/#level=19&view=flow');await place(page,'I');
  const slider=page.locator('#flow-position');await slider.focus();await page.keyboard.press('End');
  await expect(page.locator('[data-flow-area-value="0"] annotation')).toHaveText('0.00');
  await expect(page.locator('[data-flow-stage="1"] annotation')).toHaveText('0.00');
  await expect(page.locator('[data-flow-area-window="0"]')).toHaveAttribute('width','138');
  await expect(page.locator('.area-positive,.area-negative')).toHaveCount(2);
  await expect(page.locator('[data-flow-plot="1"] .flow-before')).toHaveCount(0);
  await page.keyboard.press('Home');await expect(page.locator('[data-flow-area-window="0"]')).toHaveAttribute('width','0');
  await slider.fill('2');await expect(page.locator('[data-flow-area-value="0"] annotation')).toHaveText('2.00');
  await expect(page.locator('[data-flow-stage="1"] annotation')).toHaveText('2.00');
  await menu(page,'settings-open');await page.locator('#motion-toggle').uncheck();await page.keyboard.press('Escape');
  await page.locator('#launch').click();await expect(slider).toBeDisabled();await page.waitForFunction(()=>window.angouri.flight.position>.6);
  const playing=Number(await page.locator('[data-flow-area-window="0"]').getAttribute('width'));expect(playing).toBeGreaterThan(69);
  await page.locator('#tab-flight').click();await page.locator('#tab-flow').click();await expect(slider).toBeDisabled();
  await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await expect(slider).toBeEnabled();await expect(slider).toHaveValue('2');
  await expect(page.locator('[data-flow-area-window="0"]')).toHaveAttribute('width','69');await expect(page.locator('.flow-goal[data-status="hit"]')).toHaveCount(3);
  await expect(page.locator('.katex-error')).toHaveCount(0);
});

test('zero stays labelled and inside Flight, Flow and reference plots after integration and lifting',async({page})=>{
  await ready(page,'/#level=16&view=flight');await place(page,'I');
  const anchored=await page.evaluate(()=>({zero:document.querySelector('.flight-zero-line').getBBox().y,target:Number(document.querySelector('[data-ring="0"] .ring-outer').getAttribute('cy'))}));
  expect(anchored.zero).toBeCloseTo(anchored.target,3);
  await menu(page,'nav-create');await idle(page);for(const op of 'AAAA')await place(page,op);
  const checkPlots=async selector=>{
    const bounds=await page.locator(selector).evaluateAll(plots=>plots.filter(svg=>svg.getClientRects().length).map(svg=>{
      const zero=svg.querySelector('[data-zero-line]'),b=zero.getBBox(),box=svg.viewBox.baseVal,style=getComputedStyle(zero);
      const labels=svg.id==='flight-svg'?svg.closest('.scene'):svg.closest('.note-plot-frame,.flow-plot-frame')??svg;
      return {inside:b.y>box.y&&b.y<box.y+box.height,solid:style.strokeDasharray==='none',width:parseFloat(style.strokeWidth),label:[...labels.querySelectorAll('annotation')].some(el=>el.textContent==='0')};
    }));
    expect(bounds.length).toBeGreaterThan(0);for(const result of bounds){expect(result.inside).toBe(true);expect(result.solid).toBe(true);expect(result.width).toBeGreaterThanOrEqual(1);expect(result.label).toBe(true);}
  };
  for(const viewport of [{width:1440,height:900},{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(viewport);await changeView(page,'flight');await checkPlots('#flight-svg');await changeView(page,'flow');await checkPlots('.flow-plot');
    expect(await page.locator('[data-flow-plot="0"]').evaluate(svg=>!!(svg.querySelector('.flow-area').compareDocumentPosition(svg.querySelector('[data-zero-line]'))&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  }
  await page.locator('#ideas-open').click();await page.locator('[data-note="5"]').click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('#notes-content details')).toHaveCount(0);await checkPlots('.note-plot');
});

test('a miss can be revised, and an edit during flight resets the throw without awarding it',async({page})=>{
  await ready(page,'/#level=3&view=flight');await place(page,'A');await throwIt(page);
  await expect(page.locator('.ring.miss')).toHaveCount(3);await expect(page.locator('#launch')).toHaveText('Throw again');await expect(page.locator('#success')).toBeHidden();
  await place(page,'H');
  await menu(page,'settings-open');await page.locator('#motion-toggle').uncheck();await page.keyboard.press('Escape');
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.position>.1);
  await page.locator('#undo').click();await idle(page);expect(await page.evaluate(()=>window.angouri.flight)).toEqual({phase:'ready',position:0});
  await expect(page.locator('.ring.hit')).toHaveCount(0);await expect(page.locator('#success')).toBeHidden();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('angouri:vine:v1:progress')).completed)).toEqual([]);
});

test('fullscreen keeps three views visible and occasional tasks in the visual menu',async({page})=>{
  test.setTimeout(120000); // Thirty puzzle/viewport combinations plus menu navigation.
  await ready(page,'/#level=3&view=flight');
  for(const id of ['level-nav','share-open','nav-create','library-open'])await expect(page.locator(`#${id}`)).toBeHidden();
  for(const view of ['flight','function','flow'])await expect(page.locator(`#tab-${view}`)).toBeVisible();
  for(const viewport of [{width:1440,height:900},{width:1280,height:720},{width:390,height:844},{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(viewport);
    for(const level of [3,4,5,7,11,12]){
      await choosePuzzle(page,level);
      const minimumHeight=viewport.width>600&&viewport.height<=520?370:640;
      await expect.poll(()=>page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}))).toEqual({...viewport,height:Math.max(minimumHeight,viewport.height)});
      const launch=page.locator('#launch');if(await launch.isVisible()){await launch.scrollIntoViewIfNeeded();await expect(launch).toBeInViewport();}
      await page.locator('#palette').scrollIntoViewIfNeeded();await expect(page.locator('#palette')).toBeInViewport();
      expect(await page.locator('#axis-labels .flight-label').evaluateAll(labels=>labels.every(el=>{const r=el.getBoundingClientRect(),s=document.querySelector('#scene').getBoundingClientRect();return r.bottom<=s.bottom+.5&&r.top>=s.top-.5;}))).toBe(true);
      const collisions=await page.locator('.target-label .katex-html').evaluateAll(labels=>{
        const rings=[...document.querySelectorAll('.ring-outer')],ticks=[...document.querySelectorAll('#axis-labels .katex-html')];
        const overlaps=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.5;
        return labels.flatMap((el,i)=>{const r=el.getBoundingClientRect();return [...(overlaps(r,rings[i].getBoundingClientRect())?[`Target ${i+1}: ring`]:[]),...ticks.filter(t=>overlaps(r,t.getBoundingClientRect())).map(t=>`Target ${i+1}: axis ${t.textContent}`)];});
      });expect(collisions,`Puzzle ${level} at ${viewport.width} x ${viewport.height}`).toEqual([]);
      const inside=await page.locator('#axis-labels .katex-html,.target-label .katex-html').evaluateAll(labels=>{
        const scene=document.querySelector('#scene').getBoundingClientRect();
        return labels.every(el=>{const r=el.getBoundingClientRect();return r.left>=scene.left&&r.right<=scene.right;});
      });expect(inside,`Puzzle ${level} labels fit at ${viewport.width} x ${viewport.height}`).toBe(true);
    }
  }
  await choosePuzzle(page,1);await page.locator('#menu-open').click();await expect(page.locator('.menu-tile')).toHaveCount(6);await expect(page.locator('.menu-art svg')).toHaveCount(6);
  await page.keyboard.press('Escape');await expect(page.locator('#menu-open')).toBeFocused();
  await place(page,'H');await throwIt(page);await expect(page.locator('#success button')).toHaveCount(0);
  await page.locator('#launch').click();await idle(page);expect((await snapshot(page)).sourceId).toBe(2);await expect(page.locator('#scene')).toBeFocused();
});

test('tap a block then a slot or matching stack to move or return it',async({page})=>{
  await ready(page,'/#level=3&view=flight');await page.locator('[data-empty="1"]').click();await place(page,'H');
  await page.locator('[data-insert="0"]').click();await place(page,'A');
  expect((await snapshot(page)).nodes.map(n=>n.op)).toEqual(['A','H']);
  const state=await snapshot(page);await page.locator(`.part-body[data-stage="${state.nodes[1].id}"]`).click();
  await expect(page.locator('.recipe-editor,.part-controls,#discard-zone')).toHaveCount(0);await expect(page.locator('[data-return]')).toBeEnabled();
  await page.locator('[data-cell="0"] .part-body').click();await idle(page);expect((await snapshot(page)).nodes).toEqual([state.nodes[1],state.nodes[0]]);
  await page.locator('[data-return]').click();await idle(page);expect((await snapshot(page)).nodes).toEqual([state.nodes[0]]);
  await page.locator('#undo').click();await idle(page);expect((await snapshot(page)).nodes).toEqual([state.nodes[1],state.nodes[0]]);
});

test('dragging off the recipe returns to its stack; cancellation and Undo preserve identity',async({page})=>{
  await ready(page,'/#level=3&view=flight');await place(page,'A');await place(page,'H');const before=await snapshot(page);
  const part=await page.locator(`[data-part="${before.nodes[0].id}"]`).boundingBox();
  const lift=async()=>{await page.mouse.move(part.x+part.width/2,part.y+part.height/2);await page.mouse.down();await page.mouse.move(180,260,{steps:12});};
  await lift();await expect(page.locator('[data-op="A"]')).toHaveClass(/return-target/);await expect(page.locator('.drag-ghost')).toHaveClass(/over-return/);
  await page.keyboard.press('Escape');await page.mouse.up();await idle(page);expect(await snapshot(page)).toEqual(before);
  await lift();
  await page.mouse.up();await idle(page);expect((await snapshot(page)).nodes).toEqual([before.nodes[1]]);
  await expect(page.locator('[data-op="A"]')).toHaveAttribute('data-stock','1');await expect(page.locator('[data-empty="0"]')).toBeVisible();
  await page.locator('#undo').click();await idle(page);expect(await snapshot(page)).toEqual(before);
});

test('keyboard editing and view tabs preserve focus and share one history',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await ready(page,'/#level=3&view=flight');
  await expect(page.locator('#redo')).toBeVisible();await expect(page.locator('#redo')).toBeDisabled();
  await page.locator('[data-op="H"]').focus();await page.keyboard.press('Enter');await idle(page);await page.keyboard.press('Enter');await idle(page);
  expect((await snapshot(page)).nodes.map(n=>n.op)).toEqual(['H','A']);await expect(page.locator('#launch')).toBeFocused();
  let state=await snapshot(page);await page.locator(`.part-body[data-stage="${state.nodes[1].id}"]`).focus();await page.keyboard.press('ArrowLeft');await idle(page);
  expect((await snapshot(page)).nodes).toEqual([state.nodes[1],state.nodes[0]]);await expect(page.locator(`.part-body[data-stage="${state.nodes[1].id}"]`)).toBeFocused();
  await page.keyboard.press('Delete');await idle(page);expect((await snapshot(page)).nodes).toEqual([state.nodes[0]]);
  await page.keyboard.press('Control+z');await idle(page);state=await snapshot(page);
  await page.locator('#tab-flight').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#tab-function')).toBeFocused();await expect(page.locator('#tab-function')).toHaveAttribute('aria-selected','true');
  await page.keyboard.press('End');await expect(page.locator('#tab-flow')).toBeFocused();await expect(page.locator('#scene button')).toHaveCount(0);
  expect(await snapshot(page)).toEqual(state);await page.keyboard.press('Home');await expect(page.locator('#tab-flight')).toBeFocused();
  await page.locator('#scene').focus();await page.keyboard.press('Space');await expect(page.locator('#success')).toBeVisible();
  await page.keyboard.press('Control+z');await idle(page);await expect(page.locator('#redo')).toBeEnabled();await page.locator('#redo').click();await idle(page);expect(await snapshot(page)).toEqual(state);await expect(page.locator('#redo')).toBeEnabled();
  await page.keyboard.press('Control+z');await idle(page);await page.keyboard.press('Control+Shift+z');await idle(page);expect(await snapshot(page)).toEqual(state);
  await page.locator('#undo').click();await idle(page);await expect(page.locator('#redo')).toBeEnabled();await page.locator('.part-body').last().focus();await page.keyboard.press('Delete');await idle(page);await expect(page.locator('#redo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('all mathematical notation is KaTeX, and all three views reflect the same throw',async({page})=>{
  await ready(page,'/#level=3&view=flight');
  await expect(page.locator('[data-op="H"] .katex-mathml mfrac')).toHaveCount(1);await expect(page.locator('.source-part .katex')).toHaveCount(1);
  await expect(page.locator('#axis-labels .flight-label .katex')).toHaveCount(8);await expect(page.locator('.target-height .katex')).toHaveCount(3);await place(page,'A');await place(page,'H');
  await expect(page.locator('.part-formula .katex')).toHaveCount(2);await throwIt(page);
  await changeView(page,'function');await expect(page.locator('.value-table tbody tr').first().locator('td .exact-value .katex')).toHaveCount(3);
  await expect(page.locator('.value-table tbody tr').first().locator('td').nth(1).locator('mfrac')).toHaveCount(1);
  await expect(page.locator('.value-table tr[data-status="hit"]')).toHaveCount(3);await expect(page.locator('#scene button')).toHaveCount(0);
  await changeView(page,'flow');await expect(page.locator('.machine-icon .katex')).toHaveCount(3);await expect(page.locator('[data-flow-stage] .katex')).toHaveCount(3);
  await expect(page.locator('.flow-plot')).toHaveCount(3);await expect(page.locator('[data-flow-stage="2"] annotation')).toHaveText('0.50');
  await expect(page.locator('#scene [data-part],#scene button')).toHaveCount(0);await expect(page.locator('.katex-error')).toHaveCount(0);
});

test('ten chapters cover 70 puzzles, then end with a chapter record and AngouriMath credit',async({page})=>{
  test.setTimeout(300000);
  await ready(page);
  const chapters=[[[1,'H'],[2,'A'],[3,'AH'],[24,'AHAH'],[25,'AHHAHA']],[[6,'N'],[8,'NA'],[9,'NHA'],[26,'NAHAHAH']],[[7,'Q'],[10,'HQ'],[4,'HQNA'],[27,'AQ'],[28,'AHQNAH']],[[12,'Q'],[13,'QNA'],[29,'Q'],[30,'QNA'],[31,'HHQQNA'],[11,'QHQNAA']],[[32,'DA'],[33,'QD'],[34,'AQD'],[35,'QD'],[36,'HHNAQDA']],[[37,'AI'],[38,'AI'],[39,'NAI'],[40,'HIA'],[41,'DI'],[42,'HHNAINA']],[[43,{x:'2',y:'0',radius:'1'}],[44,{x:'3/2',y:'1/2',radius:'1'}],[48,'QNA'],[78,'AQNA'],[68,'A'],[69,'HH'],[70,'N'],[66,'Q'],[49,'HAQNAAAA'],[71,'AHHQNAHQ']]];
  chapters.push([[50,'S'],[51,'AS'],[52,'HS'],[79,'AHS'],[81,'HAS'],[53,'SQ'],[54,'SQHA'],[80,'Q'],[84,'QS'],[55,'ASHQA']],[[56,'F'],[57,'C'],[58,'NF'],[59,'HF'],[60,'AHF'],[61,'FS'],[62,'FSI'],[63,'AHFSIQNA']],[[82,'H'],[72,'H'],[73,'IH'],[74,'NAHH'],[75,'HQNAQ'],[83,'Q'],[76,'ASAH'],[77,'HQQQNAHH'],[64,'DSQHA'],[65,'AHFSINAQNA'],[85,'DAHFISQ']]);
  const lessons=chapters.flatMap((levels,chapter)=>levels.map(([level,recipe],step)=>({level,recipe,chapter:chapter+1,step:step+1,total:levels.length})));
  expect(lessons).toHaveLength(70);
  for(const [index,{level,recipe,chapter,step,total}] of lessons.entries()) {
    if(index){await page.locator('#launch').click();await idle(page);}
    expect((await snapshot(page)).sourceId).toBe(level);
    await expect(page.locator('#level-category')).toContainText(`CHAPTER ${chapter}`);
    await expect(page.locator(chapter===10?'#chapter-step':'#level-category')).toContainText(`${step} OF ${total}`);
    if(typeof recipe==='string')await placeRecipe(page,recipe);else await setCircle(page,recipe);
    expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);await throwIt(page);
    if([82,72,73,74,75,83,76,77].includes(level)){await expect(page.locator('#garden-dialog')).toBeVisible();await page.keyboard.press('Escape');}
    if([1,2].includes(level)) {await expect(page.locator('#success')).toBeHidden();await expect(page.locator('.view-tabs')).toBeHidden();}
    else {const choice=(await snapshot(page)).limit===1;await expect(page.locator('#success')).toBeVisible({visible:!choice});for(const view of ['function','flow','flight']){await changeView(page,view);await expect(page.locator('#success')).toBeVisible({visible:!choice});}}
    if(step===total&&chapter<10)await expect(page.locator('#launch')).toHaveText('Next chapter');
    if(step===total-1)await expect(page.locator('#launch')).toHaveText(chapter===10?'Final mastery':'Chapter challenge');
  }
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('angouri:vine:v1:progress')).completed)).toEqual(lessons.map(({level})=>level));
  await expect(page.locator('#launch')).toHaveText('Finish');await expect(page.locator('#chapter-step')).toContainText('FINAL MASTERY');
  const finalRecipe=await snapshot(page),history=await page.evaluate(()=>window.angouri.history);
  await page.locator('#launch').click();await expect(page.locator('#ending-dialog')).toBeVisible();await expect(page.locator('#ending-title')).toHaveText('A whole garden of ideas.');
  await expect(page.locator('.ending-chapter.complete')).toHaveCount(10);await expect(page.locator('#ending-progress')).toHaveText('70 of 70 puzzles complete');
  const credit=page.locator('.ending-credit a');await expect(credit).toContainText('AngouriMath');await expect(credit).toHaveAttribute('href','https://github.com/asc-community/AngouriMath');expect(await credit.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  expect(await snapshot(page)).toEqual(finalRecipe);expect(await page.evaluate(()=>window.angouri.history)).toEqual(history);
  await page.locator('#ending-create').click();await expect(page.locator('#leave-dialog')).toBeVisible();await discardNavigation(page);await idle(page);expect((await snapshot(page)).mode).toBe('remix');expect((await snapshot(page)).circle).toEqual(finalRecipe.circle);
  await choosePuzzle(page,4);for(const op of ['Q','H','H','N','A'])await place(page,op);await throwIt(page);
  expect((await snapshot(page)).nodes).toHaveLength(5);await expect(page.locator('#success')).toContainText('Try fewer blocks?');
});

test('finishing after jumping ahead celebrates that flight without claiming unfinished chapters',async({page})=>{
  await ready(page,'/#level=85&view=flight');await placeRecipe(page,'DAHFISQ');await throwIt(page);
  await expect(page.locator('#launch')).toHaveText('Finish');await page.locator('#launch').click();await expect(page.locator('#ending-title')).toHaveText('Your garden, shaped.');
  await expect(page.locator('#ending-progress')).toHaveText('1 of 70 puzzles complete');await expect(page.locator('.ending-chapter.complete')).toHaveCount(0);
  const finalRecipe=await snapshot(page);await page.locator('#ending-create').click();await expect(page.locator('#leave-dialog')).toBeVisible();
  await page.locator('#leave-cancel').click();expect(await snapshot(page)).toEqual(finalRecipe);await page.locator('#launch').click();
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(viewport);expect(await page.locator('#ending-dialog').evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
    await page.locator('#ending-dialog').evaluate(el=>el.scrollTop=el.scrollHeight);await expect(page.getByRole('button',{name:'Back to final puzzle',exact:true})).toBeInViewport();
  }
  await page.locator('#ending-revisit').click();await expect(page.locator('#puzzles-dialog')).toBeVisible();await expect(page.locator('.chapter-group[open]>summary')).toContainText('The moonlit garden');
  await page.keyboard.press('Escape');await expect(page.locator('#launch')).toHaveText('Finish');await page.reload();await page.waitForFunction(()=>window.angouri?.state);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('angouri:vine:v1:progress')).completed)).toEqual([85]);
});

test('empty slots can move, fill in place, persist, and undo with the recipe',async({page})=>{
  await ready(page,'/#level=4&view=flight');await expect(page.locator('.empty-slot')).toHaveCount(5);await expect(page.locator('#part-count')).toHaveCount(0);
  await expect(page.locator('.ingredient-stack:has([data-op="H"]) .stock-deck i')).toHaveCount(1);await place(page,'H');
  const before=await snapshot(page);const beforeSlots=await page.evaluate(()=>window.angouri.slots);
  await page.locator('[data-empty="4"]').dragTo(page.locator('[data-cell="0"]'));await idle(page);
  expect(await snapshot(page)).toEqual(before);expect(await page.evaluate(()=>window.angouri.slots)).toEqual([null,before.nodes[0].id,null,null,null]);
  await changeView(page,'function');await changeView(page,'flight');await page.reload();await page.waitForFunction(()=>window.angouri?.state);
  await expect(page.locator('[data-empty="0"]')).toBeVisible();await page.locator('[data-empty="0"]').click();await place(page,'A');
  expect((await snapshot(page)).nodes.map(n=>n.op)).toEqual(['A','H']);await expect(page.locator('[data-cell="0"]')).toHaveAttribute('data-part',(await snapshot(page)).nodes[0].id);
  await page.locator('#undo').click();await idle(page);expect(await snapshot(page)).toEqual(before);
  await page.locator('[data-empty="0"]').focus();await page.keyboard.press('ArrowRight');await idle(page);
  expect(await page.evaluate(()=>window.angouri.slots)).toEqual(beforeSlots);await expect(page.locator('[data-empty="1"]')).toBeFocused();
  await page.keyboard.press('Control+z');await idle(page);expect((await page.evaluate(()=>window.angouri.slots))[0]).toBe(null);
});

test('moving a placed block into a hole keeps the other slots fixed',async({page})=>{
  await ready(page,'/#level=4&view=flight');await place(page,'H');await place(page,'H');
  await page.locator('[data-empty="3"]').click();await place(page,'Q');
  const [first,second,square]=(await snapshot(page)).nodes.map(n=>n.id),initial=[first,second,null,square,null];
  expect(await page.evaluate(()=>window.angouri.slots)).toEqual(initial);
  await page.locator(`[data-part="${first}"]`).dragTo(page.locator('[data-empty="2"]'));await idle(page);
  expect(await page.evaluate(()=>window.angouri.slots)).toEqual([null,second,first,square,null]);
  expect((await snapshot(page)).nodes.map(n=>n.id)).toEqual([second,first,square]);
  await page.locator('#undo').click();await idle(page);expect(await page.evaluate(()=>window.angouri.slots)).toEqual(initial);
  await page.locator('#redo').click();await idle(page);expect(await page.evaluate(()=>window.angouri.slots)).toEqual([null,second,first,square,null]);
  await page.locator(`[data-stage="${first}"]`).click();await page.locator('[data-empty="0"]').click();await idle(page);
  expect(await page.evaluate(()=>window.angouri.slots)).toEqual(initial);
});

test('dropping stock onto an occupied slot inserts there and shifts toward a hole',async({page})=>{
  await ready(page,'/#level=4&view=flight');await place(page,'H');await place(page,'Q');
  await page.locator('[data-empty="4"]').click();await place(page,'A');
  const [half,square,raise]=(await snapshot(page)).nodes.map(n=>n.id);
  await page.locator('[data-op="N"]').dragTo(page.locator(`[data-part="${square}"]`));await idle(page);
  const reflect=(await snapshot(page)).nodes.find(n=>n.op==='N').id;
  expect(await page.evaluate(()=>window.angouri.slots)).toEqual([half,reflect,square,null,raise]);
  expect((await snapshot(page)).nodes.map(n=>n.op)).toEqual(['H','N','Q','A']);
  await page.locator('#undo').click();await idle(page);expect(await page.evaluate(()=>window.angouri.slots)).toEqual([half,square,null,null,raise]);
  await page.locator('#redo').click();await idle(page);
  await page.locator('[data-empty="3"]').dragTo(page.locator('[data-cell="0"]'));await idle(page);
  expect(await page.evaluate(()=>window.angouri.slots)).toEqual([null,half,reflect,square,raise]);
  await page.locator('[data-op="H"]').dragTo(page.locator(`[data-part="${raise}"]`));await idle(page);
  const newHalf=(await snapshot(page)).nodes.at(-1).id;
  expect(await page.evaluate(()=>window.angouri.slots)).toEqual([half,reflect,square,raise,newHalf]);
  expect((await snapshot(page)).nodes.map(n=>n.op)).toEqual(['H','N','Q','A','H']);
});

test('selection never grows the rail or creates a vertical scrollbar',async({page})=>{
  await ready(page,'/#level=3&view=flight');await place(page,'A');await place(page,'H');
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
    await page.setViewportSize(viewport);await page.keyboard.press('Escape');
    const metrics=()=>page.locator('.pipeline').evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight,width:el.clientWidth,content:el.scrollWidth}));
    const before=await metrics();await page.locator('.part-body').last().click();expect(await metrics()).toEqual(before);expect(before.scroll).toBe(before.height);expect(before.content).toBe(before.width);
  }
});

test('a text selection cannot steal a pickup and the drop effect lands on the accepted slot',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await ready(page,'/#level=3&view=flight');
  await page.evaluate(()=>{const range=document.createRange();range.selectNodeContents(document.querySelector('#level-title'));window.getSelection().addRange(range);});
  const source=await page.locator('[data-op="H"]').boundingBox(),slot=await page.locator('[data-empty="1"]').boundingBox();
  await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();await page.mouse.move(slot.x+slot.width/2,slot.y+slot.height/2,{steps:10});
  await expect(page.locator('.drag-ghost')).toHaveCount(1);expect(await page.evaluate(()=>getSelection().toString())).toBe('');
  await page.mouse.up();await idle(page);
  const landing=await page.evaluate(()=>{
    const ghost=document.querySelector('.drag-ghost.settling'),animation=ghost?.getAnimations()[0];animation?.pause();
    const last=animation?.effect.getKeyframes().at(-1),part=document.querySelector('.recipe-part').getBoundingClientRect();
    return {x:parseFloat(last?.left),y:parseFloat(last?.top),targetX:part.left+part.width/2,targetY:part.top+part.height/2};
  });
  expect(landing.x).toBeCloseTo(landing.targetX,0);expect(landing.y).toBeCloseTo(landing.targetY,0);
  expect(await page.evaluate(()=>window.angouri.slots[0])).toBe(null);await expect(page.locator('[data-cell="1"]')).toHaveAttribute('data-part',(await snapshot(page)).nodes[0].id);
});

test('creation changes its source under Start and preserves the recipe through Undo and Redo',async({page})=>{
  await ready(page);await menu(page,'nav-create');await idle(page);
  await expect(page.locator('#level-category')).toHaveText('CREATE');await expect(page.locator('.ring,#remix-source,#part-count,#checkpoint-summary')).toHaveCount(0);
  for(let i=0;i<8;i++)await place(page,'A');
  expect((await snapshot(page)).nodes).toHaveLength(8);await expect(page.locator('[data-op="A"]')).toBeEnabled();await expect(page.locator('[data-op="A"]')).toHaveAttribute('data-stock','reusable');
  await throwIt(page);await expect(page.locator('#success')).toBeHidden();await expect(page.locator('#launch')).toHaveText('Throw again');
  await changeView(page,'function');await expect(page.locator('th')).toHaveCount(2);await expect(page.locator('th').first().locator('annotation')).toHaveText('x');await expect(page.locator('th').last()).toHaveText('Height');
  const before=await snapshot(page);await page.locator('#menu-open').click();await expect(page.locator('#nav-create')).toBeHidden();await expect(page.getByRole('button',{name:'Starting curve',exact:true})).toHaveCount(0);await page.keyboard.press('Escape');
  await page.locator('#source-choose').click();await expect(page.locator('#curves-title')).toHaveText('Starting curve');await page.keyboard.press('Escape');await expect(page.locator('#source-choose')).toBeFocused();
  await page.keyboard.press('Enter');await page.locator('[data-source="4"]').click();await idle(page);
  expect((await snapshot(page)).mode).toBe('remix');expect((await snapshot(page)).sourceId).toBe(4);expect((await snapshot(page)).nodes).toEqual(before.nodes);await expect(page.locator('.value-table tbody tr')).toHaveCount(5);
  await page.locator('#undo').click();await idle(page);expect(await snapshot(page)).toEqual(before);await page.locator('#redo').click();await idle(page);expect((await snapshot(page)).sourceId).toBe(4);
  for(const op of ['D','D','Q','Q','Q','Q','Q','Q'])await place(page,op);expect((await snapshot(page)).nodes).toHaveLength(16);
  await choosePuzzle(page,1);expect((await snapshot(page)).mode).toBe('puzzle');await expect(page.locator('.empty-slot')).toHaveCount(1);await expect(page.locator('.construction')).toBeHidden();await expect(page.locator('[data-op]')).toHaveCount(2);await expect(page.locator('#level-category')).not.toContainText('CREATE');
  await menu(page,'nav-create');await idle(page);for(const op of ['A','A','Q','Q','Q'])await place(page,op);
  const supported=await snapshot(page);await place(page,'Q');expect(await snapshot(page)).toEqual(supported);await expect(page.locator('#feedback')).toContainText('preview');
  await menu(page,'share-open');await page.locator('#share-kind').selectOption('challenge');await idle(page);
  await expect(page.locator('#share-message')).toHaveText(/checkpoint height is outside the supported challenge range/i);await expect(page.locator('#copy-link')).toBeDisabled();await expect(page.locator('#share-link')).toHaveValue('');expect(await snapshot(page)).toEqual(supported);
});

test('the italic wordmark and dotted favicon share the thrown cucumber artwork',async({page})=>{
  const {default:opentype}=await import('opentype.js');
  const fontBytes=await readFile(new URL('../../node_modules/katex/dist/fonts/KaTeX_Main-Italic.ttf',import.meta.url));
  const font=opentype.parse(fontBytes.buffer.slice(fontBytes.byteOffset,fontBytes.byteOffset+fontBytes.byteLength));
  const glyph=font.charToGlyph('n').getBoundingBox();
  const ink={ascent:glyph.y2/font.unitsPerEm,descent:-glyph.y1/font.unitsPerEm};
  await ready(page);
  const paths=await page.evaluate(()=>[document.querySelector('link[rel="icon"]').getAttribute('href'),document.querySelector('#cucumber image').getAttribute('href')]);
  expect(paths).toEqual(['./favicon.svg','./cucumber.svg']);
  await expect(page.locator('#brand-math annotation')).toHaveText('\\mathit{angour}');await expect(page.locator('.brand-dot')).toBeVisible();
  const [mascot,favicon]=await Promise.all([page.request.get('/cucumber.svg'),page.request.get('/favicon.svg')]);
  const artwork=await mascot.text(),icon=await favicon.text();
  const body=await page.evaluate(source=>new DOMParser().parseFromString(source,'image/svg+xml').querySelector('[data-body-frame]').getAttribute('d'),artwork);
  await expect(page.locator('.brand-cucumber [data-body-frame]')).toHaveAttribute('d',body);
  await expect(page.locator('.brand-cucumber [data-cucumber-part="stem"]')).toHaveCount(0);
  await expect(page.locator('.brand-cucumber')).toHaveCSS('clip-path','none');
  expect(icon).toContain(body);expect(icon).not.toContain('clipPath');expect(icon).not.toContain('data-cucumber-part="stem"');
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:900});await page.evaluate(()=>document.fonts.ready);
    const alignment=await page.evaluate(ink=>{
    const math=document.querySelector('.brand .mathit'),style=getComputedStyle(math),probe=document.createElement('span');
    probe.style.cssText='display:inline-block;width:1px;height:0';math.append(probe);
    const baseline=probe.getBoundingClientRect();probe.remove();
    // Canvas raster ink bounds can round outward by a whole CSS pixel on
    // Windows. Compare SVG geometry with the actual bundled font outline.
    const fontSize=parseFloat(style.fontSize),scale=baseline.width;
    const body=document.querySelector('.brand-cucumber [data-body-frame]'),matrix=body.getScreenCTM();
    const top=new DOMPoint(11.5,5).matrixTransform(matrix),bottom=new DOMPoint(3.5,62).matrixTransform(matrix);
    const dot=document.querySelector('.brand-dot').getBoundingClientRect(),dx=top.x-bottom.x,dy=top.y-bottom.y;
    return {angle:Math.atan2(dx,-dy)*180/Math.PI,dotGap:Math.abs((dot.x+dot.width/2-top.x)*dy-(dot.y+dot.height/2-top.y)*dx)/Math.hypot(dx,dy),
      family:style.fontFamily,fontStyle:style.fontStyle,
      crownGap:(top.y-baseline.top)/scale+ink.ascent*fontSize,tailGap:(bottom.y-baseline.top)/scale-ink.descent*fontSize};
    },ink);
    expect(alignment.family).toContain('KaTeX_Main');expect(alignment.fontStyle).toBe('italic');
    expect(alignment.angle).toBeCloseTo(17,1);expect(alignment.dotGap).toBeLessThan(.1);
    expect(Math.abs(alignment.crownGap)).toBeLessThan(.5);expect(Math.abs(alignment.tailGap)).toBeLessThan(.5);
  }
  await expect(page.locator('#vine-path')).toHaveCount(0);await expect(page.locator('#launcher')).toBeVisible();
});

test('creation and hidden-solution challenge links reproduce in fresh contexts',async({page,browser})=>{
  await ready(page);await menu(page,'share-open');await idle(page);
  await expect(page.locator('#share-link')).toHaveValue(/#level=1&view=flight$/);await page.keyboard.press('Escape');
  await place(page,'H');await menu(page,'nav-create');await idle(page);await place(page,'A');
  expect((await snapshot(page)).sourceId).toBe(1);expect((await snapshot(page)).mode).toBe('remix');await expect(page.locator('#scene [data-target]')).toHaveCount(0);expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(false);await expect(page.locator('.game-shell')).not.toHaveClass(/intro/);
  const original=await snapshot(page);await menu(page,'share-open');await page.locator('#share-kind').selectOption('creation');
  await expect(page.locator('#copy-link')).toBeEnabled();await idle(page);await expect(page.locator('#download-artifact')).toBeHidden();const creation=await page.locator('#share-link').inputValue();
  const context=await browser.newContext({reducedMotion:'reduce'});const recipient=await context.newPage();await ready(recipient,creation);
  expect((await snapshot(recipient)).nodes).toEqual(original.nodes);expect((await snapshot(recipient)).sourceId).toBe(original.sourceId);await expect(recipient.locator('.game-shell')).not.toHaveClass(/intro/);
  await page.locator('#share-kind').selectOption('challenge');await idle(page);const challenge=await page.locator('#share-link').inputValue();
  const decoded=JSON.parse(Buffer.from(new URL(challenge).hash.split('=')[1],'base64url').toString());expect(decoded.nodes).toBeUndefined();expect(decoded.solution).toBeUndefined();expect(decoded.view).toBe('flight');
  await ready(recipient,challenge);expect((await snapshot(recipient)).mode).toBe('challenge');expect((await snapshot(recipient)).nodes).toHaveLength(0);await expect(recipient.locator('.game-shell')).not.toHaveClass(/intro/);
  await place(recipient,original.nodes[0].op);const partial=await snapshot(recipient);
  await recipient.reload();await recipient.waitForFunction(()=>window.angouri?.state);expect(await snapshot(recipient)).toEqual(partial);
  for(const node of original.nodes.slice(1))await place(recipient,node.op);await throwIt(recipient);await expect(recipient.locator('#success')).toBeVisible();
  await context.close();
});

test('reload, progress files, saved recipes, and invalid imports preserve work',async({page})=>{
  await ready(page,'/#level=3&view=flight');await place(page,'A');await place(page,'H');await throwIt(page);await changeView(page,'function');const original=await snapshot(page);
  await page.evaluate(()=>{for(const key of ['angouri:vine:v1:progress','angouri:vine:v1:preferences']){const saved=JSON.parse(localStorage.getItem(key));saved.view='equations';localStorage.setItem(key,JSON.stringify(saved));}});
  await page.reload();await page.waitForFunction(()=>window.angouri?.state);expect(await snapshot(page)).toEqual(original);expect(await page.evaluate(()=>window.angouri.view)).toBe('function');
  await menu(page,'library-open');const downloadPromise=page.waitForEvent('download');await page.locator('#download-save').click();const file=await downloadPromise;const filePath=await file.path();await page.locator('#library-dialog .close-dialog').click();
  await page.locator('#reset').click();await idle(page);expect((await snapshot(page)).nodes).toHaveLength(0);
  await page.locator('#import-file').setInputFiles(filePath);await idle(page);await expect.poll(()=>snapshot(page)).toEqual(original);
  await menu(page,'library-open');await page.locator('#seed-name').fill('My little experiment');await page.locator('#favorite-save').click();await idle(page);await expect(page.locator('#favorites-list')).toContainText('My little experiment');await page.locator('#library-dialog .close-dialog').click();
  await page.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schema:900,type:'creation'}))});await idle(page);await expect(page.locator('#feedback')).toHaveClass(/error/);expect(await snapshot(page)).toEqual(original);
  await menu(page,'library-open');await page.locator('[data-seed="0"]').click();await idle(page);expect(await snapshot(page)).toEqual(original);
});

test('workspace changes can cancel, save the exact puzzle or creation, or explicitly discard',async({page})=>{
  await ready(page,'/#level=4&view=flow');await place(page,'H');await page.locator('[data-empty="2"]').click();await place(page,'H');
  const puzzle=await snapshot(page),slots=await page.evaluate(()=>window.angouri.slots),history=await page.evaluate(()=>window.angouri.history);
  const openCreate=async()=>{await page.locator('#menu-open').click();await page.locator('#nav-create').click();};
  await openCreate();await expect(page.locator('#leave-dialog')).toBeVisible();await expect(page.locator('#leave-cancel')).toBeFocused();await page.locator('#leave-cancel').click();
  expect(await snapshot(page)).toEqual(puzzle);expect(await page.evaluate(()=>window.angouri.slots)).toEqual(slots);expect(await page.evaluate(()=>window.angouri.history)).toEqual(history);
  await openCreate();await page.locator('#leave-name').fill('Bowl in progress');await page.locator('#leave-save').click();
  await expect.poll(async()=>(await snapshot(page)).mode).toBe('remix');await idle(page);expect((await snapshot(page)).nodes).toEqual(puzzle.nodes);
  await place(page,'A');const creation=await snapshot(page),creationSlots=await page.evaluate(()=>window.angouri.slots);
  const selectThird=async()=>{await menu(page,'puzzles-open');const option=puzzleOption(page,3);if(!await option.isVisible())await option.locator('xpath=ancestor::details').locator('summary').click();await option.click();};
  await selectThird();await expect(page.locator('#leave-dialog')).toBeVisible();await page.keyboard.press('Escape');expect(await snapshot(page)).toEqual(creation);
  await selectThird();await page.locator('#leave-name').fill('A new curve');await page.locator('#leave-save').click();
  await expect.poll(async()=>(await snapshot(page)).sourceId).toBe(3);await idle(page);expect((await snapshot(page)).nodes).toEqual([]);
  await menu(page,'library-open');
  await expect(page.locator('.favorite-context')).toHaveText(['Puzzle 3.3','Create']);
  const savedTimes=await page.locator('.favorite-meta time').evaluateAll(items=>items.map(el=>el.dateTime));
  expect(savedTimes).toHaveLength(2);expect(savedTimes.every(value=>Number.isFinite(Date.parse(value)))).toBe(true);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('angouri:vine:v1:seeds')).map(seed=>seed.savedAt))).toEqual(savedTimes);
  for(const row of await page.locator('.favorite-row').all()) {
    const name=await row.locator('.favorite-name').boundingBox(),meta=await row.locator('.favorite-meta').boundingBox();expect(meta.y).toBeGreaterThanOrEqual(name.y+name.height);
    await expect(row.locator('.favorite-meta')).toContainText('·');
  }
  await page.locator('[data-seed="0"]').click();await idle(page);
  expect(await snapshot(page)).toEqual(puzzle);expect(await page.evaluate(()=>window.angouri.slots)).toEqual(slots);expect(await page.evaluate(()=>window.angouri.view)).toBe('flow');
  await menu(page,'library-open');await page.locator('[data-seed="1"]').click();await idle(page);await expect(page.locator('#leave-dialog')).not.toBeVisible();
  expect(await snapshot(page)).toEqual(creation);expect(await page.evaluate(()=>window.angouri.slots)).toEqual(creationSlots);
  await place(page,'A');await selectThird();await expect(page.locator('#leave-dialog')).toBeVisible();await page.locator('#leave-discard').click();await idle(page);
  expect((await snapshot(page)).sourceId).toBe(3);expect((await snapshot(page)).nodes).toEqual([]);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('angouri:vine:v1:seeds')).length)).toBe(2);
  // Old libraries contain only creation artifacts; they remain openable.
  await page.evaluate(()=>{const key='angouri:vine:v1:seeds',saved=JSON.parse(localStorage.getItem(key));localStorage.setItem(key,JSON.stringify([{name:saved[0].name,artifact:saved[0].artifact}]));});
  await page.reload();await page.waitForFunction(()=>window.angouri?.state);await menu(page,'library-open');await expect(page.locator('.favorite-context')).toHaveText('Create');await expect(page.locator('.favorite-meta')).toContainText('Date unavailable');await page.locator('[data-seed="0"]').click();await idle(page);
  expect((await snapshot(page)).mode).toBe('remix');expect((await snapshot(page)).nodes).toEqual(puzzle.nodes);
});

test('saved recipes rename in place with keyboard cancellation and retain their exact workspace and date',async({page})=>{
  await ready(page,'/#level=4&view=flow');await place(page,'H');
  const before=await snapshot(page),history=await page.evaluate(()=>window.angouri.history);
  await menu(page,'library-open');await page.locator('#seed-name').fill('A bowl');await page.locator('#favorite-save').click();await idle(page);
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('angouri:vine:v1:seeds'))[0]);
  await page.locator('[data-rename-seed="0"]').click();await expect(page.locator('#rename-seed')).toBeFocused();
  await page.locator('#rename-seed').fill('Cancelled');await page.keyboard.press('Escape');
  await expect(page.locator('#library-dialog')).toBeVisible();await expect(page.locator('[data-rename-seed="0"]')).toBeFocused();await expect(page.locator('.favorite-name')).toHaveText('A bowl');
  await page.locator('[data-rename-seed="0"]').click();await page.locator('#rename-seed').fill('  My shifted bowl  ');await page.keyboard.press('Enter');
  await expect(page.locator('.favorite-name')).toHaveText('My shifted bowl');await expect(page.locator('[data-rename-seed="0"]')).toBeFocused();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('angouri:vine:v1:seeds'))[0])).toEqual({...stored,name:'My shifted bowl'});
  expect(await snapshot(page)).toEqual(before);expect(await page.evaluate(()=>window.angouri.history)).toEqual(history);
  await page.reload();await page.waitForFunction(()=>window.angouri?.state);await menu(page,'library-open');await expect(page.locator('.favorite-name')).toHaveText('My shifted bowl');
  await page.setViewportSize({width:320,height:568});await page.locator('[data-rename-seed="0"]').click();
  await page.locator('#rename-seed').fill(' ');await page.getByRole('button',{name:'Save name',exact:true}).click();await expect(page.locator('#rename-error')).toContainText('Enter a recipe name');
  await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='angouri:vine:v1:seeds')throw new DOMException('Full','QuotaExceededError');return set.call(this,key,value);};});
  await page.locator('#rename-seed').fill('Keep draft on failure');await page.getByRole('button',{name:'Save name',exact:true}).click();
  await expect(page.locator('#rename-error')).toContainText('Could not save the name');await expect(page.locator('#rename-seed')).toHaveValue('Keep draft on failure');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('angouri:vine:v1:seeds'))[0])).toEqual({...stored,name:'My shifted bowl'});
  expect(await page.locator('#library-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.locator('.favorite-name')).toHaveText('My shifted bowl');
});

test('a failed Save and continue leaves the recipe open and recoverable',async({page})=>{
  await ready(page);await place(page,'H');const before=await snapshot(page);
  await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='angouri:vine:v1:seeds')throw new DOMException('Full','QuotaExceededError');return set.call(this,key,value);};});
  await page.locator('#menu-open').click();await page.locator('#nav-create').click();await page.locator('#leave-save').click();
  await expect(page.locator('#leave-error')).toContainText('Could not save on this device');await expect(page.locator('#leave-dialog')).toBeVisible();
  expect(await snapshot(page)).toEqual(before);await expect(page.locator('#leave-save')).toBeEnabled();await page.locator('#leave-cancel').click();
  await menu(page,'library-open');await expect(page.locator('.favorite-row')).toHaveCount(0);
  const downloaded=page.waitForEvent('download');await page.locator('#download-save').click();const file=await downloaded;
  expect(JSON.parse(await readFile(await file.path(),'utf8')).state).toEqual(before);
});

test('restart affects the current recipe while confirmed global reset clears puzzle progress and keeps the library and preferences',async({page})=>{
  await ready(page,'/#level=3&view=flight');await place(page,'A');await place(page,'H');await throwIt(page);const solved=await snapshot(page);
  await expect(page.locator('#reset')).toHaveAccessibleName('Restart puzzle');await page.locator('#reset').click();await idle(page);
  expect((await snapshot(page)).nodes).toEqual([]);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('angouri:vine:v1:progress')).completed)).toEqual([3]);
  await page.locator('#undo').click();await idle(page);expect(await snapshot(page)).toEqual(solved);
  await menu(page,'library-open');await page.locator('#seed-name').fill('Keep this recipe');await page.locator('#favorite-save').click();await idle(page);await page.keyboard.press('Escape');
  await choosePuzzle(page,4);await place(page,'H');await changeView(page,'flow');const before=await snapshot(page);
  await menu(page,'settings-open');await page.locator('#motion-toggle').uncheck();
  const kept=await page.evaluate(()=>({seeds:localStorage.getItem('angouri:vine:v1:seeds'),preferences:localStorage.getItem('angouri:vine:v1:preferences')}));
  await page.locator('#reset-progress-open').click();await expect(page.locator('#reset-progress-dialog')).toBeVisible();await page.locator('#reset-progress-cancel').click();
  await expect(page.locator('#settings-dialog')).toBeVisible();await expect(page.locator('#reset-progress-open')).toBeFocused();expect(await snapshot(page)).toEqual(before);
  await page.locator('#reset-progress-open').click();await page.locator('#reset-progress-confirm').click();await idle(page);
  expect((await snapshot(page)).sourceId).toBe(1);expect((await snapshot(page)).nodes).toEqual([]);expect(await page.evaluate(()=>window.angouri.history)).toEqual({undo:0,redo:0});
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('angouri:vine:v1:progress')).completed)).toEqual([]);
  expect(await page.evaluate(()=>({seeds:localStorage.getItem('angouri:vine:v1:seeds'),preferences:localStorage.getItem('angouri:vine:v1:preferences')}))).toEqual(kept);
  await page.reload();await page.waitForFunction(()=>window.angouri?.state);expect((await snapshot(page)).sourceId).toBe(1);
  await menu(page,'library-open');await expect(page.locator('#favorites-list')).toContainText('Keep this recipe');
});

test('worker restart with an edit and undo queued restores the acknowledged snapshot',async({page})=>{
  await ready(page,'/#level=3&view=flight');await place(page,'A');const acknowledged=await snapshot(page);
  await page.evaluate(async()=>{document.querySelector('[data-op="H"]').click();document.querySelector('#undo').click();await Promise.resolve();await Promise.resolve();window.angouri.restart();});
  await idle(page);expect((await snapshot(page)).nodes).toEqual(acknowledged.nodes);expect(await page.evaluate(()=>window.angouri.history.redo)).toBe(1);
  await page.keyboard.press('Control+Shift+z');await idle(page);expect((await snapshot(page)).nodes.map(n=>n.op)).toEqual(['A','H']);await throwIt(page);await expect(page.locator('#success')).toBeVisible();
  expect(await page.evaluate(()=>window.angouri.measurements.restarts)).toBeGreaterThan(0);
});

test('mobile reduced motion and unavailable storage remain playable',async({page,context})=>{
  await context.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage disabled','SecurityError')}});});
  await page.setViewportSize({width:390,height:844});await ready(page,'/#level=3&view=flight');await place(page,'A');await place(page,'H');await throwIt(page);
  await expect(page.locator('#success')).toBeVisible();await page.locator('#menu-open').click();await expect(page.locator('#save-status')).toContainText('Session only');await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await changeView(page,'function');await expect(page.locator('table')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('About preserves the original projects and contributors and returns to the game',async({page})=>{
  await page.goto('/about/');for(const name of ['AngouriMath','MxEngine','GenericTensor','MonoBind','DotnetBenchmarks','WhiteBlackGoose','MomoDeve','Happypig375','TheSeems'])await expect(page.locator('main')).toContainText(name);
  await expect(page.locator('#brand-math annotation')).toHaveText('\\mathit{angour}');await expect(page.locator('.brand-dot')).toBeVisible();
  const mascot=await page.request.get('/cucumber.svg'),artwork=await mascot.text();
  const body=await page.evaluate(source=>new DOMParser().parseFromString(source,'image/svg+xml').querySelector('[data-body-frame]').getAttribute('d'),artwork);
  await expect(page.locator('.brand-cucumber [data-body-frame]')).toHaveAttribute('d',body);
  await expect(page.locator('.brand-cucumber [data-cucumber-part="stem"]')).toHaveCount(0);
  await expect(page.locator('.brand-cucumber')).toBeVisible();
  await expect(page.locator('.archive-note')).toHaveCount(0);await expect(page.locator('main')).not.toContainText('preserved from the original');
  await expect(page.locator('.name-origin')).toContainText('cucumber');await expect(page.locator('.name-origin [lang="el"]')).toHaveText('αγγούρι');
  for(const brand of ['github','discord','twitter','reddit','telegram','habr'])expect(await page.locator(`.social-icon use[href="../social.svg#${brand}"]`).count()).toBeGreaterThan(0);
  expect(await page.locator('main a[href^="https://github.com"]:not(.project-stars):not(:has(svg)),main a[href^="https://discord.gg"]:not(:has(svg))').count()).toBe(0);
  await expect(page.locator('[data-profile-project] .project-stars')).toHaveCount(6);
  const contents=page.getByRole('navigation',{name:'On this page'});
  await expect(contents.locator('a')).toHaveCount(3);await expect(contents.locator('.social-link')).toHaveCount(0);
  await expect(page.locator('.link-block a[href^="#"]')).toHaveCount(0);
  await contents.getByRole('link',{name:'Projects',exact:true}).click();await expect(page.locator('#projects')).toBeInViewport();
  expect(await page.locator('.project-heading img').evaluateAll(images=>images.length===4&&images.every(img=>img.complete&&img.naturalWidth>0))).toBe(true);
  await expect(page.locator('#honksharp')).toContainText('declarative programming');await expect(page.locator('#honksharp a[href="https://github.com/ASC-Community/HonkSharp"]').first()).toBeVisible();
  for(const width of [390,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.getByRole('link',{name:'Back to the playground'}).click();await page.waitForFunction(()=>window.angouri?.state);await expect(page.locator('#level-title')).toContainText('Lower the arc');
});

test('Equation compares the final function immediately and reflows into a column',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await ready(page,'/#level=6&view=function');await place(page,'N');
  await expect(page.getByRole('tab',{name:'Equation',exact:true})).toHaveAttribute('aria-selected','true');
  await menu(page,'share-open');await expect(page.locator('#share-link')).toHaveValue(/#level=6&view=function$/);await page.keyboard.press('Escape');
  await expect(page.locator('.final-formula .katex')).toHaveCount(1);await expect(page.locator('.equation-steps,.stage-formula,.flow-line')).toHaveCount(0);
  await expect(page.locator('.value-table thead th')).toHaveCount(4);await expect(page.locator('.value-table tr[data-status="hit"]')).toHaveCount(3);await expect(page.locator('#success')).toBeHidden();
  const formula=await page.locator('.final-equation').boundingBox(),table=await page.locator('.value-table').boundingBox();expect(formula.x+formula.width).toBeLessThan(table.x);
  const before=await snapshot(page);await page.setViewportSize({width:390,height:844});
  const smallFormula=await page.locator('.final-equation').boundingBox(),smallTable=await page.locator('.value-table').boundingBox();expect(smallFormula.y+smallFormula.height).toBeLessThan(smallTable.y);
  expect(await snapshot(page)).toEqual(before);await page.keyboard.press('Control+z');await idle(page);await expect(page.locator('.value-table tr[data-status="miss"]')).toHaveCount(1);await expect(page.locator('.value-table tr[data-status="hit"]')).toHaveCount(2);
});

test('Equation marks exact decimals with equals and rounded decimals with approximation',async({page})=>{
  await ready(page,'/#level=25&view=function');
  const expected=page.locator('.value-table tbody tr td:nth-child(2)');
  await expect(expected.locator('.exact-value annotation')).toHaveText(['\\frac{13}{8}','\\frac{17}{8}','\\frac{13}{8}']);
  await expect(expected.locator('.decimal-value annotation')).toHaveText(['= 1.625','= 2.125','= 1.625']);
  await expect(page.locator('.value-table tbody tr td:first-child .decimal-value')).toHaveCount(0);
  for(const op of 'AHHAHA')await place(page,op);
  await expect(page.locator('.value-table tr[data-status="hit"]')).toHaveCount(3);await expect(page.locator('#success')).toBeHidden();
  for(const viewport of [{width:1440,height:900},{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(viewport);
    expect(await page.locator('.value-table').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    expect((await page.locator('.gap-comparison th .katex-html').boundingBox()).height).toBeLessThan(30);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    if(viewport.width<=600)expect(await page.locator('#scene').evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
  }
  await menu(page,'nav-create');await idle(page);await page.locator('#reset').click();await idle(page);
  await page.locator('#source-choose').click();await page.locator('[data-source="4"]').click();await idle(page);
  for(const op of 'II')await place(page,op);
  await menu(page,'share-open');await page.locator('#share-kind').selectOption('challenge');await idle(page);
  const artifact=JSON.parse(Buffer.from(new URL(await page.locator('#share-link').inputValue()).hash.split('=')[1],'base64url').toString());
  const goal=artifact.goals.find(g=>g.x==='1');goal.y='-8333333/10000000';
  await page.keyboard.press('Escape');await page.locator('#import-file').setInputFiles({name:'close-match.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(artifact))});await idle(page);
  for(const op of 'II')await place(page,op);
  const miss=page.locator('.value-table tr[data-status="miss"]');await expect(miss).toHaveCount(1);
  await expect(miss.locator('.decimal-value annotation')).toHaveText(['\\approx -0.8333','\\approx -0.8333']);
  await expect(miss.locator('td:nth-child(3) .exact-value annotation')).toHaveText('-\\frac{5}{6}');
  expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(false);
  artifact.goals.find(g=>g.x==='0').y='1/10000000';artifact.goals.find(g=>g.x==='4').y='-1/8';
  await page.locator('#import-file').setInputFiles({name:'exact-decimals.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(artifact))});await idle(page);
  await expect(page.locator('.value-table tbody tr').first().locator('td:nth-child(2) .decimal-value annotation')).toHaveText('= 1\\times 10^{-7}');
  await expect(page.locator('.value-table tbody tr').last().locator('td:nth-child(2) .decimal-value annotation')).toHaveText('= -0.125');
});

test('Height views distinguish fitting the gap from placing the curve',async({page})=>{
  await ready(page,'/#level=3&view=function');await place(page,'H');await place(page,'A');
  await expect(page.locator('.gap-comparison')).toHaveAttribute('data-gap-match','true');
  await expect(page.locator('.value-table tbody tr[data-status="miss"]')).toHaveCount(3);
  expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(false);
  await changeView(page,'flow');await expect(page.locator('#flow-position')).toHaveValue('0');
  await expect(page.locator('.gap-sample annotation')).toHaveText(['= 4','= 2','= 2']);
  const spans=await page.locator('.gap-bracket').evaluateAll(paths=>paths.map(path=>{const b=path.getBBox();return {y:b.y,height:b.height};}));
  expect(spans[0].height).toBeCloseTo(2*spans[1].height,4);expect(spans[1].height).toBeCloseTo(spans[2].height,4);expect(spans[2].y).toBeLessThan(spans[1].y);
  const first=(await snapshot(page)).nodes[0].id;await page.locator(`[data-stage="${first}"]`).focus();await page.keyboard.press('ArrowRight');await idle(page);
  await expect(page.locator('.gap-sample annotation')).toHaveText(['= 4','= 4','= 2']);
  expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);await expect(page.locator('#success')).toBeHidden();
  await choosePuzzle(page,25);await changeView(page,'function');for(const op of 'HHH')await place(page,op);
  await expect(page.locator('.gap-comparison')).toHaveAttribute('data-gap-match','true');
  await expect(page.locator('.gap-comparison .exact-value annotation')).toHaveText(['\\frac{1}{2}','\\frac{1}{2}']);
  await expect(page.locator('.gap-comparison .decimal-value annotation')).toHaveText(['= 0.5','= 0.5']);
  expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(false);
  await menu(page,'nav-create');await idle(page);await expect(page.locator('.gap-comparison')).toHaveCount(0);
  await changeView(page,'flow');await expect(page.locator('.flow-height-gap,.gap-sample,.flow-gap-goal')).toHaveCount(0);
});

test('Reflection carries signed gap tracking from its introduction to the raised-bowl challenge',async({page})=>{
  await ready(page,'/#level=6&view=function');
  await expect(page.locator('.gap-comparison .exact-value annotation')).toHaveText(['2','-2']);
  await place(page,'N');await expect(page.locator('.gap-comparison')).toHaveAttribute('data-gap-match','true');expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);
  await choosePuzzle(page,8);await expect(page.locator('.gap-comparison .exact-value annotation')).toHaveText(['1','-1']);
  await place(page,'N');await expect(page.locator('.gap-comparison')).toHaveAttribute('data-gap-match','true');expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(false);
  await place(page,'A');expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);
  await choosePuzzle(page,9);await place(page,'H');await place(page,'N');await changeView(page,'flow');
  await expect(page.locator('#flow-position')).toHaveValue('2');await expect(page.locator('.gap-sample annotation')).toHaveText(['= -4','= -2','= 2']);
  expect(await page.locator('.flow-height-gap').evaluateAll(items=>items.map(el=>el.dataset.gapDirection))).toEqual(['down','down','up']);
  await choosePuzzle(page,26);await expect(page.locator('#flow-position')).toHaveValue('2');
  for(const op of 'HHH')await place(page,op);await changeView(page,'function');
  await expect(page.locator('.gap-comparison .exact-value annotation')).toHaveText(['\\frac{1}{2}','-\\frac{1}{2}']);await expect(page.locator('.gap-comparison')).toHaveAttribute('data-gap-match','false');
  await place(page,'N');await expect(page.locator('.gap-comparison')).toHaveAttribute('data-gap-match','true');await expect(page.locator('.value-table tbody tr[data-status="miss"]')).toHaveCount(5);
  await changeView(page,'flow');await place(page,'A');
  await expect(page.locator('.gap-sample annotation')).toHaveText(['= -4','= -2','= -1','= -\\frac{1}{2}','= \\frac{1}{2}','= \\frac{1}{2}']);
  const spans=await page.locator('.gap-bracket').evaluateAll(paths=>paths.map(path=>{const b=path.getBBox();return {y:b.y,height:b.height};}));
  expect(spans[3].height).toBeCloseTo(spans[4].height,4);expect(spans[4].height).toBeCloseTo(spans[5].height,4);expect(spans[5].y).toBeLessThan(spans[4].y);
  expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(false);
  await page.locator('#reset').click();await idle(page);for(const op of 'AHHHNA')await place(page,op);
  expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('angouri:vine:v1:progress')).completed)).toEqual([]);
  await page.locator('#ideas-open').click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
  expect(await page.locator('[data-note-lesson]').evaluateAll((items)=>items.map((item)=>item.getAttribute('data-note-lesson')))).toEqual(['26','9','24']);
  await expect(page.locator('#notes-content')).toContainText(/existing offset|negated/i);
  await page.locator('.note-view-button[data-view="function"]').first().click();await expect(page.locator('.gap-comparison')).toHaveAttribute('data-gap-match','true');
});

test('gap tracking continues through every later chapter and names the off-center reference points',async({page})=>{
  test.setTimeout(120000);
  await ready(page,'/#level=7&view=function');
  for(const [level,from,to] of [[7,'2','0'],[10,'2','0'],[4,'0','2'],[27,'1','4'],[28,'4','1'],[12,'2','0'],[13,'0','2'],[11,'0','2'],[14,'0','4'],[5,'0','2'],[15,'0','2'],[22,'0','2'],[16,'0','4'],[19,'0','2'],[17,'0','2'],[20,'0','4'],[21,'0','2'],[18,'0','2'],[23,'0','2']]) {
    if((await snapshot(page)).sourceId!==level)await choosePuzzle(page,level);
    await changeView(page,'function');
    await expect(page.locator('.gap-comparison th annotation')).toHaveText(`\\left.h\\right|_{x=${to}}-\\left.h\\right|_{x=${from}}`);
    await changeView(page,'flow');await expect(page.locator('#flow-position')).toHaveValue([5,27,28].includes(level)?'1':'2');
    await expect(page.locator('.flow-gap-goal')).toHaveAttribute('aria-label',`Target height gap from x=${from} to x=${to}`);
    await expect(page.locator('.flow-height-gap')).toHaveCount(1);
    expect(await page.locator('.flow-height-gap circle').evaluateAll(points=>points.map(point=>point.dataset.gapPosition))).toEqual([from,to]);
  }
  await choosePuzzle(page,27);await place(page,'A');await place(page,'Q');
  await expect(page.locator('.gap-sample annotation')).toHaveText(['= 3','= 3','= 9']);
  await expect(page.locator('.flow-gap-goal annotation')).toHaveText('\\left.h\\right|_{x=4}-\\left.h\\right|_{x=1}=9');
  await changeView(page,'function');await expect(page.locator('.gap-comparison')).toHaveAttribute('data-gap-match','true');
  expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);
  await choosePuzzle(page,28);for(const op of 'AQ')await place(page,op);await changeView(page,'flow');
  await expect(page.locator('.flow-gap-goal annotation')).toHaveText('\\left.h\\right|_{x=1}-\\left.h\\right|_{x=4}=\\frac{9}{8}');
  await expect(page.locator('.gap-sample annotation')).toHaveText(['= -3','= -3','= -9']);
  await page.locator('#reset').click();await idle(page);for(const op of 'AHQNH')await place(page,op);await changeView(page,'function');
  await expect(page.locator('.gap-comparison')).toHaveAttribute('data-gap-match','true');
  await expect(page.locator('.gap-comparison .decimal-value annotation')).toHaveText(['= 1.125','= 1.125']);
  await expect(page.locator('.value-table tbody tr[data-status="miss"]')).toHaveCount(5);
  expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(false);
  await choosePuzzle(page,5);for(const op of 'DHA')await place(page,op);await changeView(page,'flow');
  await expect(page.locator('.gap-sample annotation')).toHaveText(['= 8','= 12','= 6','= 6']);
  await expect(page.locator('[data-flow-tangent="0"]')).not.toHaveAttribute('d','');
  await page.setViewportSize({width:1440,height:900});
  const plotSpread=()=>page.locator('.flow-plot').evaluateAll(plots=>{const tops=plots.map(el=>el.getBoundingClientRect().top);return Math.max(...tops)-Math.min(...tops);});
  expect(await plotSpread()).toBeLessThan(1);
  await choosePuzzle(page,17);for(const op of 'IH')await place(page,op);
  await expect(page.locator('.gap-sample annotation')).toHaveText(['= -2','= 2','= 1']);
  await expect(page.locator('[data-flow-area="0"]')).toHaveCount(1);
  expect(await plotSpread()).toBeLessThan(1);
  await expect(page.locator('[data-flow-plot="0"]')).toHaveAttribute('aria-label',/signed area.*height gap from x=0 to x=2 is -2/);
  const recipe=await snapshot(page),guide=await page.evaluate(()=>window.angouri.result.heightGuide);
  await page.locator('#flow-position').focus();await page.keyboard.press('End');
  expect(await page.evaluate(()=>window.angouri.result.heightGuide)).toEqual(guide);expect(await snapshot(page)).toEqual(recipe);
});

test('throwing in Equation confirms the preview marks in sequence or immediately with Skip animation',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await ready(page,'/#level=6&view=flight');
  await expect(page.locator('.ring[data-match="hit"]')).toHaveCount(2);await expect(page.locator('.ring[data-match="miss"]')).toHaveCount(1);await expect(page.locator('.ring[data-match="miss"] .miss-mark')).toHaveCSS('display','block');
  await expect(page.locator('.target-badge circle').first()).toHaveCSS('fill','rgb(255, 254, 248)');await place(page,'N');await expect(page.locator('.ring[data-match="hit"]')).toHaveCount(3);await changeView(page,'function');
  await expect(page.locator('.equation-verdict[data-status="waiting"] svg')).toHaveCount(3);await expect(page.locator('.equation-verdict[data-status="hit"]')).toHaveCount(0);
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.position>.2&&window.angouri.flight.position<.48);
  await expect(page.locator('.equation-verdict[data-target="0"]')).toHaveAttribute('data-status','hit');await expect(page.locator('.equation-verdict[data-target="1"]')).toHaveAttribute('data-status','waiting');
  await expect(page.locator('#success')).toBeHidden();const position=await page.evaluate(()=>window.angouri.flight.position);
  for(const view of ['flight','flow','function']) {
    await changeView(page,view);
    const sync=await page.evaluate(()=>{const {flight,result}=window.angouri;return {position:flight.position,expected:result.checkpoints.map(c=>Number(c.x)/4<=flight.position+1e-8?'hit':'waiting'),actual:[...document.querySelectorAll('#scene .ring,#scene .flow-goal,#scene .equation-verdict')].map(el=>el.dataset.status)};});
    expect(sync.position).toBeGreaterThanOrEqual(position);expect(sync.actual).toEqual(sync.expected);
  }
  await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
  await expect(page.locator('.equation-verdict[data-status="hit"]')).toHaveCount(3);await expect(page.locator('#launch')).toHaveText('Next puzzle');
  await expect(page.locator('.equation-verdict').first()).toHaveCSS('background-color','rgb(93, 128, 70)');
  await menu(page,'settings-open');await page.getByRole('checkbox',{name:/Skip animation/}).check();await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');await idle(page);await expect(page.locator('.equation-verdict[data-status="waiting"] svg')).toHaveCount(3);
  await place(page,'H'); // A wrong choice keeps the zeros and makes Throw available.
  await expect(page.locator('tr[data-status="miss"] .equation-verdict path')).toHaveCSS('stroke','rgb(166, 80, 75)');
  await page.locator('#launch').click();expect(await page.evaluate(()=>window.angouri.flight.phase)).toBe('landed');
  await expect(page.locator('.equation-verdict[data-status="hit"]')).toHaveCount(2);await expect(page.locator('.equation-verdict[data-status="miss"]')).toHaveCount(1);await expect(page.locator('#success')).toBeHidden();
  await expect(page.locator('.equation-verdict[data-status="miss"]')).toHaveCSS('background-color','rgb(180, 91, 85)');
  await expect(page.locator('.equation-verdict[data-status="miss"] path')).toHaveCSS('stroke','rgb(255, 255, 255)');
  await expect(page.locator('.equation-verdict[data-status="hit"] path').first()).toHaveCSS('stroke','rgb(255, 255, 255)');await changeView(page,'flight');
  await expect(page.locator('.ring.hit')).toHaveCount(2);await expect(page.locator('.ring.miss')).toHaveCount(1);await expect(page.locator('.ring.miss .ring-outer')).toHaveCSS('stroke','rgb(180, 91, 85)');await expect(page.locator('.target-badge circle').first()).toHaveCSS('fill','rgb(93, 128, 70)');
  expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
});

test('Flow scrubs a shared position through curve transformations and the slope tangent',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:1280,height:720});
  await ready(page,'/#level=5&view=flight');for(const op of ['D','H','A'])await place(page,op);await changeView(page,'flow');
  await expect(page.locator('.flow-plot').first()).toBeInViewport({ratio:1});
  await page.locator('.flow-plot').last().scrollIntoViewIfNeeded();await expect(page.locator('.flow-plot').last()).toBeInViewport({ratio:1});
  await page.locator('.flow-line').evaluate(el=>el.scrollLeft=0);await expect(page.locator('#flow-position')).toBeInViewport();
  const before=await snapshot(page),history=await page.evaluate(()=>window.angouri.history);
  const samples=()=>page.locator('[data-flow-stage] annotation').allTextContents();
  expect(await samples()).toEqual(['1.00','3.00','1.50','2.50']);
  await page.locator('#flow-position').focus();await page.keyboard.press('End');
  expect(await samples()).toEqual(['8.00','12.00','6.00','7.00']);await expect(page.locator('[data-flow-slope="0"] annotation')).toHaveText('12.00');
  await expect(page.locator('[data-flow-tangent="0"]')).not.toHaveAttribute('d','');await expect(page.locator('#flow-position')).toHaveAttribute('aria-valuetext','x = 2');
  const markers=await page.locator('[data-flow-point]').evaluateAll(points=>points.map(p=>Number(p.getAttribute('cy'))));expect(markers[1]).toBeLessThan(markers[0]);expect(markers[2]).toBeGreaterThan(markers[3]);
  await expect(page.locator('.flow-goal[data-status="waiting"]')).toHaveCount(3);
  await expect(page.locator('.flow-machine').last().locator('.flow-target')).toHaveCount(3);
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.position>.2&&window.angouri.flight.position<.5);
  await expect(page.locator('#flow-position')).toBeDisabled();
  const probe=await page.evaluate(()=>{const {flight,result}=window.angouri;return {actual:document.querySelector('#flow-position').valueAsNumber,expected:result.points[Math.round(flight.position*(result.points.length-1))][0]};});
  expect(probe.actual).toBe(probe.expected);
  await changeView(page,'function');await changeView(page,'flow');await expect(page.locator('#flow-position')).toBeDisabled();
  await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await expect(page.locator('#flow-position')).toBeEnabled();
  expect(await samples()).toEqual(['8.00','12.00','6.00','7.00']);
  const statuses=await page.locator('.flow-goal').evaluateAll(goals=>goals.map(g=>g.dataset.status));
  expect(statuses).toEqual((await page.evaluate(()=>window.angouri.result.checkpoints)).map(c=>c.hit?'hit':'miss'));
  await menu(page,'settings-open');await page.getByRole('checkbox',{name:/Skip animation/}).check();await page.keyboard.press('Escape');
  await page.locator('#rethrow').click();await expect(page.locator('#flow-position')).toBeEnabled();await expect(page.locator('#flow-position')).toHaveValue('2');
  await changeView(page,'function');await changeView(page,'flow');await expect(page.locator('#flow-position')).toHaveValue('2');
  await page.locator('#flow-position').focus();await page.keyboard.press('Home');expect(await samples()).toEqual(['0.00','0.00','0.00','1.00']);
  expect(await snapshot(page)).toEqual(before);expect(await page.evaluate(()=>window.angouri.history)).toEqual(history);
  await page.setViewportSize({width:390,height:844});await expect(page.locator('.flow-line')).toHaveCSS('flex-direction','column');
  await page.locator('.flow-machine').last().scrollIntoViewIfNeeded();await expect(page.locator('.flow-machine').last()).toBeInViewport();await expect(page.locator('#flow-position')).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('Flow confirmation never introduces transient overflow or resizes its panels',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await ready(page,'/#level=4&view=flow');for(const op of ['H','Q','N','A'])await place(page,op);
  for(const viewport of [{width:1440,height:900},{width:1280,height:720},{width:390,height:844}]) {
    await page.setViewportSize(viewport);await page.evaluate(()=>document.fonts.ready);
    if(viewport.width>600)expect(await page.locator('.flow-line').evaluate(el=>{
      const style=getComputedStyle(el),scrollbar=el.offsetHeight-el.clientHeight-parseFloat(style.borderTopWidth)-parseFloat(style.borderBottomWidth);
      return el.scrollHeight-el.clientHeight-Math.max(0,scrollbar);
    })).toBeLessThanOrEqual(1);
    await page.evaluate(()=>{
      const read=()=>['.flow-goals','.flow-line','#scene','.play-dock'].map(selector=>{
        const el=document.querySelector(selector);return {selector,width:el.clientWidth,height:el.clientHeight,contentWidth:el.scrollWidth,contentHeight:el.scrollHeight};
      });
      const initial=JSON.stringify(read());window.flowLayoutChanges=[];
      const sample=()=>{const current=read();if(JSON.stringify(current)!==initial&&window.flowLayoutChanges.length<10)window.flowLayoutChanges.push(current);window.flowLayoutFrame=requestAnimationFrame(sample);};
      sample();
    });
    await page.locator(await page.locator('#rethrow').isVisible()?'#rethrow':'#launch').click();
    await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await page.waitForTimeout(450);
    const changes=await page.evaluate(()=>{cancelAnimationFrame(window.flowLayoutFrame);return window.flowLayoutChanges;});expect(changes).toEqual([]);
    await expect(page.locator('.flow-goal[data-status="hit"]')).toHaveCount(5);
  }
});

test('Flow preserves horizontal and vertical inspection scroll through edits and view changes',async({page})=>{
  await page.setViewportSize({width:1280,height:720});await ready(page);await menu(page,'nav-create');await idle(page);
  for(let i=0;i<8;i++)await place(page,'A');await changeView(page,'flow');
  const scroll=()=>page.locator('.flow-line').evaluate(el=>({left:el.scrollLeft,top:el.scrollTop}));
  await page.locator('.flow-machine').last().scrollIntoViewIfNeeded();let before=await scroll();expect(before.left).toBeGreaterThan(100);
  await place(page,'H');expect(await scroll()).toEqual(before);await page.locator('#undo').click();await idle(page);expect(await scroll()).toEqual(before);
  await changeView(page,'function');await changeView(page,'flow');expect(await scroll()).toEqual(before);
  await page.setViewportSize({width:390,height:844});await page.locator('.flow-machine').last().scrollIntoViewIfNeeded();before=await scroll();expect(before.top).toBeGreaterThan(100);
  await place(page,'A');expect(await scroll()).toEqual(before);await page.locator('#undo').click();await idle(page);expect(await scroll()).toEqual(before);
  await changeView(page,'flight');await changeView(page,'flow');expect(await scroll()).toEqual(before);
  await choosePuzzle(page,6);expect(await scroll()).toEqual({left:0,top:0});
});

test('Back returns through the menu hierarchy without changing the construction',async({page})=>{
  await ready(page);await place(page,'H');const before=await snapshot(page);
  for(const id of ['puzzles-open','share-open','library-open','help-open','settings-open']) {
    await menu(page,id);await page.getByRole('button',{name:'Back to menu',exact:true}).click();await expect(page.locator('#menu-dialog')).toBeVisible();await expect(page.locator(`#${id}`)).toBeFocused();
    await page.getByRole('button',{name:'Back to game',exact:true}).click();await expect(page.locator('dialog[open]')).toHaveCount(0);await expect(page.locator('#menu-open')).toBeFocused();
  }
  await page.setViewportSize({width:844,height:390});await menu(page,'help-open');await page.locator('#help-dialog').evaluate(el=>el.scrollTop=el.scrollHeight);
  await expect(page.getByRole('button',{name:'Back to menu',exact:true})).toBeInViewport();await page.getByRole('button',{name:'Back to menu',exact:true}).click();await page.keyboard.press('Escape');
  expect(await snapshot(page)).toEqual(before);await menu(page,'nav-create');await idle(page);const creation=await snapshot(page);
  await page.locator('#source-choose').click();await page.getByRole('button',{name:'Back to recipe',exact:true}).click();await expect(page.locator('#source-choose')).toBeFocused();expect(await snapshot(page)).toEqual(creation);
});

test('Flight fits uniformly without changing its mathematical bounds on resize',async({page})=>{
  await ready(page,'/#level=4&view=flight');for(const op of ['H','Q','N','A'])await place(page,op);
  const d=await page.locator('#trajectory').getAttribute('d');
  for(const viewport of [{width:1440,height:900},{width:1280,height:720},{width:640,height:450},{width:390,height:844},{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(viewport);await expect(page.locator('#flight-svg')).toHaveAttribute('viewBox','0 0 760 414');await expect(page.locator('#trajectory')).toHaveAttribute('d',d);
    const scale=await page.locator('#flight-svg').evaluate(el=>{const m=el.getScreenCTM();return [m.a,m.d];});expect(scale[0]).toBeCloseTo(scale[1],6);
    await expect.poll(()=>page.locator('#axis-labels .flight-label').first().evaluate(el=>Math.round(el.getBoundingClientRect().height))).toBe(28);
    const spacing=await page.locator('#axis-labels .flight-label').evaluateAll(labels=>{
      const lastTick=labels.at(-4).querySelector('.katex-html').getBoundingClientRect(),axis=labels.at(-1).querySelector('.katex-html').getBoundingClientRect();
      return axis.left-lastTick.right;
    });expect(spacing).toBeGreaterThan(3);
    const badges=await page.locator('.ring').evaluateAll(rings=>rings.map(ring=>{
      const target=ring.querySelector('.ring-outer').getBoundingClientRect(),badge=ring.querySelector('.target-badge circle').getBoundingClientRect();
      return {ratio:badge.width/target.width,offset:Math.hypot(target.x+target.width/2-badge.x-badge.width/2,target.y+target.height/2-badge.y-badge.height/2)};
    }));
    for(const badge of badges){expect(badge.ratio).toBeGreaterThan(.5);expect(badge.ratio).toBeLessThan(.7);expect(badge.offset).toBeLessThan(.1);}
  }
});

test('selecting either block in 3.5 keeps Flight on the complete recipe',async({page})=>{
  await ready(page,'/#level=28&view=flight');await place(page,'A');await place(page,'H');
  const before=await snapshot(page),history=await page.evaluate(()=>window.angouri.history);
  const path=await page.locator('#trajectory').getAttribute('d');
  for(const node of before.nodes) {
    await page.locator(`[data-stage="${node.id}"]`).click();
    await expect(page.locator(`[data-stage="${node.id}"]`)).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('#trajectory')).toHaveAttribute('d',path);
    await expect(page.locator('.inspected-path,.inspection-legend')).toHaveCount(0);
    expect(await snapshot(page)).toEqual(before);expect(await page.evaluate(()=>window.angouri.history)).toEqual(history);
    await page.keyboard.press('Escape');
  }
});

test('return slots sit above all remaining stock without moving the existing pile or layout',async({page})=>{
  await ready(page,'/#level=4&view=flight');await place(page,'H');await page.mouse.move(0,0);
  const pile=page.locator('.ingredient-stack:has([data-op="H"])'),top=pile.locator('.ingredient'),lower=pile.locator('.stock-deck i');
  const existing=await top.boundingBox(),layout=await page.locator('#palette').boundingBox();
  await page.locator('.part-body').click();await expect(top).toHaveAttribute('data-stock','1');await expect(top).toHaveAttribute('data-return',/./);
  await expect(lower).toHaveCount(1);expect(await lower.boundingBox()).toEqual(existing);
  expect((await top.boundingBox()).y).toBeLessThan(existing.y);expect(await page.locator('#palette').boundingBox()).toEqual(layout);
  await top.click();await idle(page);expect((await snapshot(page)).nodes).toHaveLength(0);await expect(top).toHaveAttribute('data-stock','2');
  await place(page,'H');await place(page,'H');await page.locator('.part-body').first().click();
  await expect(top).toHaveAttribute('data-stock','0');await expect(lower).toHaveCount(0);expect(await page.locator('#palette').boundingBox()).toEqual(layout);
  await top.click();await idle(page);await page.mouse.move(0,0);const single=await top.boundingBox(),before=await snapshot(page);
  const part=await page.locator('.part-body').boundingBox();await page.mouse.move(part.x+part.width/2,part.y+part.height/2);await page.mouse.down();await page.mouse.move(20,20,{steps:8});
  await expect(top).toHaveClass(/return-target/);await expect(lower).toHaveCount(1);expect(await lower.boundingBox()).toEqual(single);
  await page.keyboard.press('Escape');await page.mouse.up();await expect(lower).toHaveCount(0);expect(await snapshot(page)).toEqual(before);
  await menu(page,'nav-create');await idle(page);await page.setViewportSize({width:320,height:568});await page.mouse.move(0,0);
  const documentBox=locator=>locator.evaluate(element=>{const rect=element.getBoundingClientRect();return {x:rect.x+scrollX,y:rect.y+scrollY,width:rect.width,height:rect.height};});
  const reusable=await documentBox(top),creationLayout=await page.locator('#palette').evaluate(element=>({width:element.clientWidth,height:element.clientHeight}));
  await page.locator('.part-body').click();await expect(top).toHaveAttribute('data-stock','reusable');await expect(lower).toHaveCount(3);
  expect(await documentBox(lower.first())).toEqual(reusable);expect(await page.locator('#palette').evaluate(element=>({width:element.clientWidth,height:element.clientHeight}))).toEqual(creationLayout);
  await top.click();await idle(page);await expect(lower).toHaveCount(2);await expect(top).toHaveAttribute('data-stock','reusable');
  await choosePuzzle(page,25);await expect(page.locator('.ingredient-stack:has([data-op="A"]) .stock-total')).toHaveText('6');await place(page,'A');await page.locator('.part-body').click();
  const condensed=page.locator('.ingredient-stack:has([data-op="A"])');
  await expect(condensed.locator('.stock-deck i')).toHaveCount(3);await expect(condensed.locator('.ingredient')).toHaveAttribute('data-stock','5');await expect(condensed.locator('.stock-total')).toHaveText('5');
  await condensed.locator('[data-return]').click();await idle(page);await expect(condensed.locator('.stock-deck i')).toHaveCount(2);
  await expect(condensed.locator('.stock-total')).toHaveText('6');
  const condensedLayout=await page.locator('#palette').evaluate(element=>({width:element.clientWidth,height:element.clientHeight}));
  for(const remaining of [5,4,3,2,1,0]){await place(page,'A');await expect(condensed.locator('.stock-total')).toHaveText(String(remaining));}
  await expect(condensed.locator('.ingredient')).toBeDisabled();await expect(condensed.locator('.stock-deck i')).toHaveCount(0);
  expect(await page.locator('#palette').evaluate(element=>({width:element.clientWidth,height:element.clientHeight}))).toEqual(condensedLayout);
});

test('a stack consists of whole blocks and pickup only lifts the top copy',async({page})=>{
  await ready(page,'/#level=4&view=flight');
  const pile=page.locator('.ingredient-stack:has([data-op="H"])'),top=pile.locator('.ingredient'),lower=pile.locator('.stock-deck i');
  const face=await top.boundingBox(),under=await lower.boundingBox();expect(under.height).toBe(face.height);expect(under.y).toBeGreaterThan(face.y);expect(under.y).toBeLessThan(face.y+face.height);
  const height=await page.locator('#palette').evaluate(el=>el.clientHeight);
  await top.focus();await page.mouse.move(face.x+face.width/2,face.y+face.height/2);await page.mouse.down();await page.mouse.move(face.x+face.width/2,face.y-25,{steps:8});
  await expect(top).toHaveClass(/dragging/);await expect(lower).toHaveCSS('opacity','1');await expect(pile).toHaveCSS('opacity','1');expect(await lower.boundingBox()).toEqual(under);
  await page.keyboard.press('Escape');await page.mouse.up();await place(page,'H');
  await expect(lower).toHaveCount(0);expect(await page.locator('#palette').evaluate(el=>el.clientHeight)).toBe(height);await page.locator('#undo').click();await idle(page);await expect(lower).toHaveCount(1);
});

test('emulated touch can drag, immediately throw, then return by tapping its stack',async({browser,browserName})=>{
  test.skip(browserName!=='chromium','This check uses Chromium touch-event injection.');
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  const page=await context.newPage();await ready(page,'http://127.0.0.1:4174/#level=4&view=flight');
  const source=await page.locator('[data-op="H"]').boundingBox(),target=await page.locator('[data-insert="0"]').boundingBox();
  const from={x:source.x+source.width/2,y:source.y+source.height/2},to={x:target.x+target.width/2,y:target.y+target.height/2};
  const session=await context.newCDPSession(page);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});
  for(let i=1;i<=5;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/5,y:from.y+(to.y-from.y)*i/5}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await idle(page);expect((await snapshot(page)).nodes.map(n=>n.op)).toEqual(['H']);
  await page.locator('#launch').tap();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await page.locator('.part-body').tap();await page.locator('[data-return]').tap();await idle(page);
  expect((await snapshot(page)).nodes).toHaveLength(0);await context.close();
});
