import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import config from '../playwright.config.mjs';

const browser=await chromium.launch({...config.projects[0].use.launchOptions,headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
const errors=[],layouts=[];page.on('pageerror',error=>errors.push(String(error)));
await mkdir('artifacts',{recursive:true});
const shot=name=>page.screenshot({path:`artifacts/${name}.png`,fullPage:true});
const ready=async id=>{await page.goto(`http://127.0.0.1:4174/#level=${id}&view=flight`);await page.waitForFunction(()=>window.angouri?.state&&document.querySelector('#playground').getAttribute('aria-busy')==='false');};
const notes=async()=>{await page.locator('#ideas-open').click();await page.locator('#notes-content[aria-busy="false"]').waitFor();};
try {
  for(const [name,size] of Object.entries({desktop:{width:1440,height:900},mobile:{width:390,height:844},compact:{width:320,height:568},landscape:{width:844,height:390}})) {
    await page.setViewportSize(size);await ready(4);await shot(`chapters-game-${name}`);
    await notes();await shot(`shape-notes-${name}`);
    layouts.push(await page.evaluate(()=>{const d=document.querySelector('#ideas-dialog');return {viewport:[innerWidth,innerHeight],dialog:[d.clientWidth,d.scrollWidth],page:[document.documentElement.clientWidth,document.documentElement.scrollWidth]};}));
    await page.keyboard.press('Escape');await page.locator('#menu-open').click();await page.locator('#puzzles-open').click();await shot(`chapters-menu-${name}`);await page.keyboard.press('Escape');
  }
  await page.setViewportSize({width:390,height:844});await ready(13);await shot('round-roof-mobile');await notes();await shot('flattening-notes-mobile');await page.keyboard.press('Escape');
  await page.locator('#menu-open').click();await shot('menu-community-mobile');await page.locator('#menu-version').click();await shot('version-log-mobile');await page.keyboard.press('Escape');
  await page.locator('#menu-open').click();await page.locator('#settings-open').click();await shot('settings-mobile');await page.keyboard.press('Escape');
  await page.goto('http://127.0.0.1:4174/about/');await page.evaluate(()=>document.fonts.ready);await page.locator('#honksharp').screenshot({path:'artifacts/honksharp-about-mobile.png'});
  await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:4174/about/');await page.evaluate(()=>document.fonts.ready);
  await page.locator('.project-stars img').evaluateAll(images=>images.forEach(img=>img.loading='eager'));
  await page.waitForFunction(()=>[...document.querySelectorAll('.project-stars img')].every(img=>img.complete));
  const badges=await page.locator('.project-stars img').evaluateAll(images=>images.map(img=>({src:img.src,loaded:img.naturalWidth>0})));
  if(badges.length!==6||badges.some(badge=>!badge.loaded))throw Error('Project badges did not load: '+JSON.stringify(badges));
  await page.screenshot({path:'artifacts/about-shared-content.png'});await page.locator('#honksharp').screenshot({path:'artifacts/honksharp-badge-desktop.png'});
  await page.setViewportSize({width:320,height:568});await page.locator('#generictensor').screenshot({path:'artifacts/project-badge-compact.png'});
  console.log(JSON.stringify({badges},null,2));
  console.log(JSON.stringify({errors,layouts},null,2));
} finally {await browser.close();}
