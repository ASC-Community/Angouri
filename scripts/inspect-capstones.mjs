import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import config from '../playwright.config.mjs';

const browser=await chromium.launch({...config.projects[0].use.launchOptions,headless:true});
const page=await browser.newPage({reducedMotion:'reduce'}),errors=[],states=[];
await page.addInitScript(()=>localStorage.clear());
page.on('pageerror',error=>errors.push(String(error)));
const idle=()=>page.evaluate(()=>window.angouri.whenIdle());
const shot=name=>page.screenshot({path:`artifacts/${name}.png`,fullPage:true});
const lessons=[[24,'AHAH'],[25,'AHHAHA'],[26,'NAHAHAH'],[27,'AQ'],[28,'AHQNAH'],[11,'QHQNAA'],[22,'DHHQQNA'],[23,'INAQNA']];
try {
  await mkdir('artifacts',{recursive:true});
  for(const [size,viewport] of Object.entries({desktop:{width:1440,height:900},compact:{width:320,height:568}})) {
    await page.setViewportSize(viewport);
    for(const [level,ops] of lessons) {
      await page.goto('http://127.0.0.1:4174/about/');
      await page.goto(`http://127.0.0.1:4174/#level=${level}&view=flight`);
      await page.waitForFunction(id=>window.angouri?.state?.sourceId===id&&document.querySelector('#playground').getAttribute('aria-busy')==='false',level);
      await shot(`capstone-${level}-start-${size}`);
      await page.locator('#ideas-open').click();await page.locator('#notes-content[aria-busy="false"]').waitFor();
      await shot(`capstone-${level}-notes-${size}`);await page.keyboard.press('Escape');
      for(const op of ops){await page.locator(`[data-op="${op}"]`).click();await idle();}
      await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
      await shot(`capstone-${level}-solved-${size}`);
      states.push(await page.evaluate(({size,level})=>({size,level,solved:window.angouri.result.solved,
        pageOverflow:document.documentElement.scrollWidth>innerWidth,
        recipeOverflow:document.querySelector('.pipeline').scrollHeight>document.querySelector('.pipeline').clientHeight+1,
        targets:window.angouri.result.checkpoints.map(({x,target,hit})=>({x,target,hit}))
      }),{size,level}));
    }
  }
  await writeFile('artifacts/capstone-layout.json',JSON.stringify({errors,states},null,2)+'\n');
  console.log(JSON.stringify({errors,states},null,2));
} finally {await browser.close();}
