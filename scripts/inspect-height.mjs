import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import config from '../playwright.config.mjs';

const browser=await chromium.launch({...config.projects[0].use.launchOptions,headless:true});
const page=await browser.newPage({reducedMotion:'reduce'}),errors=[],layouts=[];
await page.addInitScript(()=>localStorage.clear());
page.on('pageerror',error=>errors.push(String(error)));
const idle=()=>page.evaluate(()=>window.angouri.whenIdle());
try {
  await mkdir('artifacts',{recursive:true});
  for(const [level,ops,name] of [[3,'HA','order'],[24,'AHAH','pieces'],[25,'HHH','gap'],[25,'AHHAHA','placed'],[26,'','raised-bowl'],[26,'HHHN','reflected-gap'],[26,'AHHHNA','reflected-placed']]) {
    await page.goto('http://127.0.0.1:4174/about/');
    await page.goto(`http://127.0.0.1:4174/#level=${level}&view=function`);
    await page.waitForFunction(id=>window.angouri?.state?.sourceId===id,level);
    for(const op of ops){await page.locator(`[data-op="${op}"]`).click();await idle();}
    for(const [size,viewport] of Object.entries({desktop:{width:1440,height:900},compact:{width:320,height:568}})) {
      await page.setViewportSize(viewport);
      for(const view of ['function','flow']) {
        await page.locator(`#tab-${view}`).click();await page.evaluate(()=>scrollTo(0,0));
        await page.screenshot({path:`artifacts/height-${name}-${view}-${size}.png`,fullPage:true});
        layouts.push(await page.evaluate(({size,view,name})=>({size,view,name,
          pageOverflow:document.documentElement.scrollWidth>innerWidth,
          tableOverflow:document.querySelector('.value-table')?.scrollWidth>document.querySelector('.value-table')?.clientWidth,
          gap:window.angouri.result.heightGuide,solved:window.angouri.result.solved
        }),{size,view,name}));
      }
    }
  }
  await writeFile('artifacts/height-guide-layout.json',JSON.stringify({errors,layouts},null,2));
  console.log(JSON.stringify({errors,states:layouts.length,overflow:layouts.filter(s=>s.pageOverflow||s.tableOverflow).map(({name,view,size})=>({name,view,size}))},null,2));
} finally {await browser.close();}
