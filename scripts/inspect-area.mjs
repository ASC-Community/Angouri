import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import config from '../playwright.config.mjs';

const browser=await chromium.launch({...config.projects[0].use.launchOptions,headless:true});
const page=await browser.newPage({reducedMotion:'reduce'}),states=[],errors=[];
page.on('pageerror',error=>errors.push(String(error)));
const idle=()=>page.evaluate(()=>window.angouri.whenIdle());
const shot=name=>page.screenshot({path:`artifacts/${name}.png`});
try {
  await mkdir('artifacts',{recursive:true});
  for(const [size,viewport] of Object.entries({desktop:{width:1440,height:900},mobile:{width:390,height:844},compact:{width:320,height:568},landscape:{width:844,height:390}})) {
    await page.setViewportSize(viewport);
    for(const [level,ops] of [[16,'I'],[19,'I'],[18,'IHNA']]) {
      await page.goto('http://127.0.0.1:4174/about/');
      await page.goto(`http://127.0.0.1:4174/#level=${level}&view=flight`);
      await page.waitForFunction(id=>window.angouri?.state?.sourceId===id&&document.querySelector('#playground').getAttribute('aria-busy')==='false',level);
      if(level===18)await shot(`area-pullback-${size}`);
      const pose=await page.evaluate(()=>{
        const c=document.querySelector('#cucumber').transform.baseVal.consolidate().matrix,b=document.querySelector('#flight-spin').transform.baseVal.consolidate().matrix;
        const corners=[[-12,-29],[12,-29],[-12,27],[12,27]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(b).matrixTransform(c));
        return {slope:window.angouri.result.startSlope,ink:{left:Math.min(...corners.map(p=>p.x)),right:Math.max(...corners.map(p=>p.x)),top:Math.min(...corners.map(p=>p.y)),bottom:Math.max(...corners.map(p=>p.y))}};
      });
      for(const op of ops){await page.locator(`[data-op="${op}"]`).click();await idle();}
      await page.locator('#tab-flow').click();
      const slider=page.locator('#flow-position');await slider.focus();await page.keyboard.press('End');
      await shot(`area-${level}-flow-${size}`);
      const layout=await page.evaluate(()=>({pageOverflow:document.documentElement.scrollWidth>innerWidth,
        overflow:[...document.querySelectorAll('.ingredient-face,.part-formula,.machine-icon,.machine-meta')].filter(el=>el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1).map(el=>({class:el.className,text:el.textContent,width:[el.clientWidth,el.scrollWidth],height:[el.clientHeight,el.scrollHeight]})),
        area:document.querySelector('[data-flow-area-value]')?.textContent
      }));
      states.push({size,level,pose,...layout});
      if(level===18){await page.locator('#ideas-open').click();await page.locator('#notes-content[aria-busy="false"]').waitFor();await shot(`area-notes-${size}`);await page.keyboard.press('Escape');}
    }
    await page.locator('#menu-open').click();await page.locator('#nav-create').click();if(await page.locator('#leave-dialog').isVisible())await page.locator('#leave-discard').click();await idle();
    await page.screenshot({path:`artifacts/six-block-create-${size}.png`,fullPage:true});
  }
  await writeFile('artifacts/area-layout.json',JSON.stringify({errors,states},null,2)+'\n');
  console.log(JSON.stringify({errors,states},null,2));
} finally {await browser.close();}
