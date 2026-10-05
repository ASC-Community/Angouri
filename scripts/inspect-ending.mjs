import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import config from '../playwright.config.mjs';

const browser=await chromium.launch({...config.projects[0].use.launchOptions,headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[],layouts=[];
page.on('pageerror',error=>errors.push(String(error)));
const idle=()=>page.evaluate(()=>window.angouri.whenIdle());
const shot=name=>page.screenshot({path:`artifacts/${name}.png`});
try {
  await mkdir('artifacts',{recursive:true});
  for(const [level,ops] of [[14,'D'],[5,'DHA'],[15,'DHHNA'],[22,'DHHQQNA'],[16,'I'],[19,'I'],[17,'IH'],[20,'IA'],[21,'DI'],[18,'IHNA'],[23,'INAQNA']]) {
    await page.goto(`http://127.0.0.1:4174/#level=${level}&view=flight`);
    await page.waitForFunction(id=>window.angouri?.state?.sourceId===id&&document.querySelector('#playground').getAttribute('aria-busy')==='false',level);
    await shot(`slopes-${level}-start`);await page.locator('#ideas-open').click();await page.locator('#notes-content[aria-busy="false"]').waitFor();await shot(`slopes-${level}-notes`);await page.keyboard.press('Escape');
    for(const op of ops){await page.locator(`[data-op="${op}"]`).click();await idle();}
    await page.locator('#tab-flow').click();await shot(`slopes-${level}-flow`);await page.locator('#tab-flight').click();await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
  }
  await page.locator('#launch').click();await shot('ending-partial');await page.keyboard.press('Escape');
  // Visual fixture for the all-complete presentation; the browser suite solves all 28 through the UI.
  await page.evaluate(()=>{const key='angouri:vine:v1:progress',saved=JSON.parse(localStorage.getItem(key));saved.completed=Array.from({length:28},(_,i)=>i+1);localStorage.setItem(key,JSON.stringify(saved));});
  await page.reload();await page.waitForFunction(()=>window.angouri?.state);await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await page.locator('#launch').click();
  for(const [name,viewport] of Object.entries({desktop:{width:1440,height:900},mobile:{width:390,height:844},compact:{width:320,height:568},landscape:{width:844,height:390}})) {
    await page.setViewportSize(viewport);await page.locator('#ending-dialog').evaluate(el=>el.scrollTop=0);await shot(`ending-${name}`);
    layouts.push(await page.locator('#ending-dialog').evaluate(el=>({viewport:[innerWidth,innerHeight],width:[el.clientWidth,el.scrollWidth],height:[el.clientHeight,el.scrollHeight]})));
    if(name==='compact'||name==='landscape'){await page.locator('#ending-dialog').evaluate(el=>el.scrollTop=el.scrollHeight);await shot(`ending-${name}-bottom`);}
  }
  console.log(JSON.stringify({errors,layouts},null,2));
} finally {await browser.close();}
