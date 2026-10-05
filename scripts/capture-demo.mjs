import {chromium} from '@playwright/test';
import {readdir,mkdir,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
const cache=join(process.env.LOCALAPPDATA,'ms-playwright');
const builds=(await readdir(cache)).filter(s=>/^chromium-\d+$/.test(s)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1]));
const browser=await chromium.launch({headless:true,executablePath:join(cache,builds[0],'chrome-win64/chrome.exe')});
await mkdir('artifacts',{recursive:true});
const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'no-preference',recordVideo:{dir:'artifacts/video',size:{width:1440,height:900}}});
const page=await context.newPage();
// The marker follows real browser input; the game and mathematical results are untouched.
await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{
  const cursor=document.createElement('div');cursor.style.cssText='position:fixed;width:17px;height:17px;border:2px solid #294f32;border-radius:50%;background:#fff9;pointer-events:none;z-index:10000;transform:translate(-50%,-50%);display:none';document.body.append(cursor);
  document.addEventListener('mousemove',e=>{cursor.style.display='block';cursor.style.left=e.clientX+'px';cursor.style.top=e.clientY+'px'});
  document.addEventListener('mousedown',()=>cursor.style.background='#91ac6b');document.addEventListener('mouseup',()=>cursor.style.background='#fff9');
}));
await page.goto('http://127.0.0.1:4174/');await page.waitForFunction(()=>window.angouri?.state);
await page.waitForTimeout(4300);
const ingredient=await page.locator('[data-op="H"]').boundingBox();
await page.mouse.move(ingredient.x+ingredient.width/2,ingredient.y+ingredient.height/2,{steps:20});await page.mouse.click(ingredient.x+ingredient.width/2,ingredient.y+ingredient.height/2);
await page.waitForFunction(()=>window.angouri.result.solved);await page.waitForTimeout(1200);
await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await page.waitForTimeout(2200);
const video=page.video();await context.close();await copyFile(await video.path(),'artifacts/first-move.webm');await browser.close();
console.log('Recorded the working first move in artifacts/first-move.webm.');
