import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import config from '../playwright.config.mjs';
const browser=await chromium.launch({...config.projects[0].use.launchOptions,headless:true});
const page=await browser.newPage({reducedMotion:'reduce'}),errors=[],layouts=[];
await page.addInitScript(()=>localStorage.clear());
page.on('pageerror',error=>errors.push(String(error)));
const idle=()=>page.evaluate(()=>window.angouri.whenIdle());
const shot=name=>page.screenshot({path:`artifacts/${name}.png`,fullPage:true});
try {
  await mkdir('artifacts',{recursive:true});
  for(const [name,viewport] of Object.entries({desktop:{width:1440,height:900},mobile:{width:390,height:844},compact:{width:320,height:568},landscape:{width:844,height:390}})) {
    await page.setViewportSize(viewport);await page.goto('http://127.0.0.1:4174/');
    await page.waitForFunction(()=>window.angouri?.state&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
    await shot(`landing-empty-${name}`);
    for(const op of ['A','H']) {
      await page.locator(`[data-op="${op}"]`).click();await idle();await shot(`landing-${op}-${name}`);
    }
    layouts.push(await page.evaluate(name=>({name,viewport:[innerWidth,innerHeight],pageOverflow:document.documentElement.scrollWidth>innerWidth,
      selected:document.querySelector('[aria-pressed="true"][data-op]')?.getAttribute('data-op'),
      controls:[...document.querySelectorAll('#playground button')].filter(el=>el.getClientRects().length).map(el=>el.getAttribute('aria-label')||el.textContent),solved:window.angouri.result.solved
    }),name));
    await page.locator('#menu-open').click();await shot(`landing-menu-${name}`);await page.keyboard.press('Escape');
    await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
    await page.locator('#launch').click();await idle();await shot(`second-puzzle-${name}`);
    await page.locator('[data-op="A"]').click();await idle();await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
    await page.locator('#launch').click();await idle();await shot(`third-puzzle-${name}`);
  }
  await writeFile('artifacts/landing-layout.json',JSON.stringify({errors,layouts},null,2)+'\n');
  console.log(JSON.stringify({errors,layouts},null,2));
} finally {await browser.close();}
