import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import config from '../playwright.config.mjs';

const browser=await chromium.launch({...config.projects[0].use.launchOptions,headless:true});
const page=await browser.newPage({reducedMotion:'reduce'}),states=[],errors=[];
await page.addInitScript(()=>localStorage.clear());
page.on('pageerror',error=>errors.push(String(error)));
const idle=()=>page.evaluate(()=>window.angouri.whenIdle());
const place=async op=>{await page.locator(`[data-op="${op}"]`).click();await idle();};
const inspect=async name=>states.push(await page.evaluate(name=>{
  const dialog=document.querySelector('dialog[open]'),root=dialog||document.querySelector('#playground');
  const owners=['.pipeline','.scene','.final-formula','.value-table','.flow-goals','.flow-line','.play-dock','dialog','.notes-content'];
  const content=['.note-formula','.part-formula','.machine-icon','.machine-sample','.source-part','.ingredient-face','.dialog-top','.view-tabs'];
  const elements=[...root.querySelectorAll([...owners,...content].join(',')),root];
  const measurements=elements.filter(el=>el.getClientRects().length).map(el=>{
    const style=getComputedStyle(el),x=el.scrollWidth>el.clientWidth+1,y=el.scrollHeight>el.clientHeight+1;
    return {element:el.id?'#'+el.id:'.'+el.className.toString().split(' ').join('.'),x,y,overflow:[style.overflowX,style.overflowY],size:[el.clientWidth,el.clientHeight],content:[el.scrollWidth,el.scrollHeight]};
  });
  return {name,viewport:[innerWidth,innerHeight],pageOverflow:document.documentElement.scrollWidth>innerWidth,measurements};
},name));
const openMenu=()=>page.locator('#menu-open').click();
try {
  await mkdir('artifacts',{recursive:true});
  for(const [name,viewport] of Object.entries({desktop:{width:1440,height:900},short:{width:1280,height:720},mobile:{width:390,height:844},compact:{width:320,height:568},landscape:{width:844,height:390}})) {
    await page.setViewportSize(viewport);await page.goto('http://127.0.0.1:4174/about/');await page.goto('http://127.0.0.1:4174/#level=4&view=flight');
    await page.waitForFunction(()=>window.angouri?.state&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
    for(const op of ['H','Q','N','A'])await place(op);
    for(const view of ['flight','function','flow']){await page.locator(`#tab-${view}`).click();await inspect(`${name}: ${view}`);if(['desktop','short','compact'].includes(name))await page.screenshot({path:`artifacts/${view}-audit-${name}.png`});}
    await openMenu();await inspect(`${name}: menu`);
    if(['mobile','compact','landscape'].includes(name))await page.screenshot({path:`artifacts/menu-audit-${name}.png`});
    await page.keyboard.press('Escape');
    for(const button of ['puzzles-open','settings-open','library-open','share-open','help-open','menu-version']) {
      await openMenu();await page.locator('#'+button).click();await inspect(`${name}: ${button}`);
      if(button==='library-open'&&['mobile','compact'].includes(name))await page.screenshot({path:`artifacts/library-audit-${name}.png`});
      if(button==='settings-open'){await page.locator('#reset-progress-open').click();await inspect(`${name}: reset progress`);if(name==='compact')await page.screenshot({path:'artifacts/reset-progress-compact.png'});}
      await page.keyboard.press('Escape');
    }
    await openMenu();await page.locator('#nav-create').click();if(await page.locator('#leave-dialog').isVisible()){await inspect(`${name}: save before leaving`);if(name==='compact')await page.screenshot({path:'artifacts/save-before-leaving-compact.png'});await page.locator('#leave-discard').click();}await idle();
    if(['mobile','compact','landscape'].includes(name))await page.screenshot({path:`artifacts/create-audit-${name}.png`,fullPage:true});
    await page.locator('#ideas-open').click();
    for(let topic=0;topic<6;topic++) {
      await page.locator(`[data-note="${topic}"]`).click();await page.locator('#notes-content[aria-busy="false"]').waitFor();
      await page.locator('#notes-content details').evaluateAll(details=>details.forEach(el=>el.open=true));
      await inspect(`${name}: notes ${topic}`);
      if(topic===3&&['mobile','compact','landscape'].includes(name))await page.screenshot({path:`artifacts/notes-audit-${name}.png`});
    }
    await page.keyboard.press('Escape');
    await page.locator('#reset').click();await idle();
    for(const op of 'AQAQAQHHHHHHHHHH')await place(op);
    for(const view of ['function','flow']){await page.locator(`#tab-${view}`).click();await inspect(`${name}: long creation ${view}`);}
  }
  const report={errors,states};
  await writeFile('artifacts/overflow-audit.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({errors,states:states.length,pageOverflow:states.filter(s=>s.pageOverflow).map(s=>s.name),scrolling:states.map(s=>({name:s.name,regions:s.measurements.filter(m=>(m.x||m.y)&&m.overflow.some(v=>v==='auto'||v==='scroll')).map(m=>`${m.element} ${m.x?'x':''}${m.y?'y':''}`)})).filter(s=>s.regions.length)},null,2));
} finally {await browser.close();}
