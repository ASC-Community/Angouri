import {launchChromium,previewURL} from './browser.mjs';
import {mkdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {STORAGE_KEYS,readStoredJSON,writeStoredJSON} from '../tests/browser/storage-fixtures.mjs';

const {chapters}=JSON.parse(await readFile(new URL('../content/learning-path.json',import.meta.url),'utf8'));
const mainPuzzles=chapters.flat(),finalLevel=mainPuzzles.at(-1),finalRecipe='DAHFISQ';
assert.equal(finalLevel,85,'Update the ending capture recipe when the authored finale changes.');
assert.equal(new Set(mainPuzzles).size,mainPuzzles.length,'The chapter manifest must contain each main puzzle once.');

const browser=await launchChromium();
const page=await browser.newPage({baseURL:previewURL(),viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[],layouts=[];
page.on('pageerror',error=>errors.push(String(error)));
const idle=()=>page.evaluate(()=>window.angouri.whenIdle());
const shot=name=>page.screenshot({path:`artifacts/${name}.png`});
const ready=()=>page.waitForFunction(id=>window.angouri?.state?.sourceId===id&&document.querySelector('#playground').getAttribute('aria-busy')==='false',finalLevel);
const finish=async()=>{
  assert.equal(await page.evaluate(()=>window.angouri.result.solved),true,'The final recipe must solve the authored puzzle.');
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await idle();
  assert.equal(await page.locator('#launch').getAttribute('aria-label'),'Finish');
  await page.locator('#launch').click();await page.locator('#ending-dialog').waitFor({state:'visible'});
};
try {
  await mkdir('artifacts',{recursive:true});
  await page.goto(`/#level=${finalLevel}&view=flight`);await ready();await page.evaluate(()=>document.fonts.ready);
  const station=await page.evaluate(()=>window.angouri.state.station);
  assert.equal(station?.op,'I');
  let after=false,beforeIndex=0,afterIndex=station.before+1;
  for(const op of finalRecipe) {
    if(!after&&op===station.op){after=true;continue;}
    await page.locator(`[data-empty="${after?afterIndex++:beforeIndex++}"]`).click();
    await page.locator(`[data-op="${op}"]`).click();await idle();
  }
  await finish();
  assert.equal(await page.locator('#ending-progress').textContent(),`1 of ${mainPuzzles.length} puzzles complete`);
  assert.equal(await page.locator('.ending-chapter.complete').count(),0);
  assert.deepEqual((await readStoredJSON(page,STORAGE_KEYS.progress)).completed,[finalLevel]);
  await shot('ending-partial');await page.keyboard.press('Escape');
  // Visual fixture only: seed the current main-puzzle manifest to inspect the
  // all-complete ending. This does not play or verify those other puzzles.
  const saved=await readStoredJSON(page,STORAGE_KEYS.progress);saved.completed=mainPuzzles;await writeStoredJSON(page,STORAGE_KEYS.progress,saved);
  await page.reload();await ready();await finish();
  assert.equal(await page.locator('#ending-progress').textContent(),`${mainPuzzles.length} of ${mainPuzzles.length} puzzles complete`);
  assert.equal(await page.locator('.ending-chapter.complete').count(),chapters.length);
  for(const [name,viewport] of Object.entries({desktop:{width:1440,height:900},mobile:{width:390,height:844},compact:{width:320,height:568},landscape:{width:844,height:390}})) {
    await page.setViewportSize(viewport);await page.locator('#ending-dialog').evaluate(el=>el.scrollTop=0);await shot(`ending-${name}`);
    layouts.push(await page.locator('#ending-dialog').evaluate(el=>({viewport:[innerWidth,innerHeight],width:[el.clientWidth,el.scrollWidth],height:[el.clientHeight,el.scrollHeight]})));
    if(name==='compact'||name==='landscape'){await page.locator('#ending-dialog').evaluate(el=>el.scrollTop=el.scrollHeight);await shot(`ending-${name}-bottom`);}
  }
  console.log(JSON.stringify({source:finalLevel,partialCompleted:1,allCompleteFixture:mainPuzzles.length,errors,layouts},null,2));
} finally {await browser.close();}
if(errors.length)process.exitCode=1;
