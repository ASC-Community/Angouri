import { chromium } from '@playwright/test';
import { readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
const cache=join(process.env.LOCALAPPDATA,'ms-playwright');
const builds=(await readdir(cache)).filter(x=>/^chromium-\d+$/.test(x)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1]));
const browser=await chromium.launch({headless:true,executablePath:join(cache,builds[0],'chrome-win64/chrome.exe')});
await mkdir('artifacts',{recursive:true});
const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
const idle=()=>page.evaluate(()=>window.angouri.whenIdle());
const shot=name=>page.screenshot({path:`artifacts/${name}.png`,fullPage:true});
const discard=async()=>{if(await page.locator('#leave-dialog').isVisible())await page.locator('#leave-discard').click();};
const menu=async id=>{await page.locator('#menu-open').click();await page.locator(`#${id}`).click();if(id==='nav-create')await discard();};
const puzzle=async n=>{await menu('puzzles-open');const option=page.locator(`[data-level="${n}"]`);if(!await option.isVisible())await option.locator('xpath=ancestor::details').locator('summary').click();await option.click();await discard();await idle();};
const place=async op=>{await page.locator(`[data-op="${op}"]`).click();await idle();};
const layouts=[];
try {
  await page.goto('http://127.0.0.1:4174/');await page.waitForFunction(()=>window.angouri?.state,{timeout:60000});await page.evaluate(()=>document.fonts.ready);
  await shot('flight-desktop');
  await place('H');await page.locator('#launch').click();await shot('flight-solved');
  await puzzle(4);await shot('empty-slots-desktop');
  const stack=await page.locator('[data-op="H"]').boundingBox();await page.mouse.move(stack.x+stack.width/2,stack.y+stack.height/2);await page.mouse.down();await page.mouse.move(stack.x+stack.width/2,stack.y-30,{steps:10});await shot('stack-pickup');await page.keyboard.press('Escape');await page.mouse.up();
  await place('H');
  const from=await page.locator('[data-empty="4"]').boundingBox(),to=await page.locator('[data-cell="0"]').boundingBox();
  await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:10});await shot('empty-slot-pickup');await page.mouse.up();await idle();
  await page.locator('#menu-open').click();await shot('menu-desktop');await page.keyboard.press('Escape');
  await puzzle(3);await place('A');await place('H');await page.locator('.part-body').first().click();
  for(const view of ['function','flow','flight']){await page.locator(`#tab-${view}`).click();await shot(`${view}-selected-desktop`);}
  await page.locator('#tab-function').click();await page.locator('#launch').click();await shot('function-confirmed');
  await puzzle(5);for(const op of ['D','H','A'])await place(op);await page.locator('#tab-flow').click();await page.locator('#flow-position').focus();await page.keyboard.press('End');await shot('flow-tangent-desktop');
  await page.setViewportSize({width:1280,height:720});await shot('flow-short-desktop');await page.setViewportSize({width:844,height:390});await shot('flow-landscape');
  await page.setViewportSize({width:390,height:844});await shot('flow-mobile');await page.locator('.flow-machine').last().scrollIntoViewIfNeeded();await shot('flow-mobile-end');
  await page.setViewportSize({width:320,height:568});await shot('flow-compact');await page.locator('#tab-function').click();await shot('function-compact');
  await page.setViewportSize({width:1440,height:900});await puzzle(3);await place('A');await place('H');await page.locator('#tab-flight').click();await page.locator('.part-body').first().click();
  for(const [name,viewport] of Object.entries({mobile:{width:390,height:844},compact:{width:320,height:568},landscape:{width:844,height:390}})) {
    await page.setViewportSize(viewport);await shot(`selection-${name}`);
    layouts.push({name,...await page.evaluate(()=>{const r=document.querySelector('.pipeline');return {pageOverflow:document.documentElement.scrollWidth>innerWidth,pageHeight:document.documentElement.scrollHeight,railHeight:r.clientHeight,railContentHeight:r.scrollHeight,railWidth:r.clientWidth,railContentWidth:r.scrollWidth};})});
  }
  await page.setViewportSize({width:390,height:844});
  const placed=await page.locator('.recipe-part').first().boundingBox();
  await page.mouse.move(placed.x+placed.width/2,placed.y+placed.height/2);await page.mouse.down();await page.mouse.move(180,260,{steps:10});await shot('return-preview');await page.mouse.up();await idle();await shot('returned-mobile');
  await page.setViewportSize({width:1440,height:900});await menu('nav-create');await idle();
  for(let i=0;i<8;i++)await place('A');await shot('creation-desktop');
  await page.locator('#source-choose').click();await shot('starting-curve-chooser');await page.keyboard.press('Escape');
  await puzzle(1);await place('H');await menu('settings-open');await page.locator('#motion-toggle').uncheck();await page.keyboard.press('Escape');
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.position>.45&&window.angouri.flight.position<.7);await shot('throw-in-flight');await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
  await page.locator('#tab-flow').click();await page.locator('#flow-position').focus();await page.keyboard.press('End');
  await page.locator('#rethrow').click();await page.waitForFunction(()=>window.angouri.flight.position>.55&&window.angouri.flight.position<.75);await shot('flow-playback');
  await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await shot('flow-confirmed');await page.locator('#tab-flight').click();
  await page.setViewportSize({width:390,height:844});await shot('completion-mobile');
  await page.setViewportSize({width:320,height:568});await shot('completion-compact');
  await puzzle(4);for(const op of ['Q','H','H','N','A'])await place(op);
  await menu('settings-open');await page.locator('#motion-toggle').check();await page.keyboard.press('Escape');
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await shot('completion-long-compact');
  await page.setViewportSize({width:1440,height:900});await puzzle(7);await shot('squaring-discovery');
  await puzzle(12);await shot('flattening-discovery');await place('Q');await page.locator('#tab-flow').click();await shot('flattening-flow');
  await puzzle(11);await page.locator('#tab-flight').click();await shot('capstone-desktop');
  for(const [name,viewport] of Object.entries({mobile:{width:390,height:844},compact:{width:320,height:568},landscape:{width:844,height:390}})) {await page.setViewportSize(viewport);await shot(`capstone-${name}`);}
  await page.setViewportSize({width:390,height:844});for(const op of ['Q','H','Q','N','A','A'])await place(op);await page.locator('#launch').click();await shot('capstone-complete-mobile');
  await menu('nav-create');await idle();await page.locator('#source-choose').click();await shot('curves-mobile');await page.locator('[data-source="8"]').click();await idle();await shot('creation-source-mobile');
  await puzzle(9);for(const op of ['H','N','A'])await place(op);await page.locator('#launch').click();await page.setViewportSize({width:320,height:568});await shot('finale-invitation-compact');await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:4174/about/');await page.evaluate(()=>document.fonts.ready);await shot('about-mobile');await page.screenshot({path:'artifacts/about-mobile-header.png'});await page.setViewportSize({width:1440,height:900});await shot('about-desktop');await page.screenshot({path:'artifacts/about-desktop-header.png'});
  console.log(JSON.stringify({errors,layouts},null,2));
} finally {await context.close();await browser.close();}
if(errors.length||layouts.some(l=>l.pageOverflow||l.railContentHeight>l.railHeight))process.exitCode=1;
