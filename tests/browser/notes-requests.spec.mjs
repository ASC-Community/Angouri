import {snapshotWithProgress} from './storage-fixtures.mjs';
import {test,expect} from '@playwright/test';

async function ready(page,source) {
  await page.addInitScript(()=>{
    if(window.noteWork)return;
    const RealWorker=window.Worker;
    const work=window.noteWork={requests:[],replies:[],held:[],record:false,hold:false};
    window.Worker=class extends RealWorker {
      constructor(...args) {
        super(...args);
        this.addEventListener('message',({data})=>{if(data.type==='result')work.replies.push(data.id);});
      }
      postMessage(message,...rest) {
        if(work.record)work.requests.push({id:message.id,source:message.request.state?.sourceId??message.request.action.sourceId,ops:message.request.state?.nodes.map(node=>node.op).join(''),type:message.request.action.type});
        if(work.hold)work.held.push(()=>super.postMessage(message,...rest));else super.postMessage(message,...rest);
      }
    };
  });
  await page.goto('/about/');await page.goto(`/#level=${source}&view=flight`);
  await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
  await page.evaluate(()=>{window.noteWork.record=true;});
}
const workspace=page=>snapshotWithProgress(page,()=>({state:window.angouri.state,history:window.angouri.history,slots:window.angouri.slots}));
const requests=page=>page.evaluate(()=>window.noteWork.requests.map(({type,source,ops})=>({type,source,...(ops===undefined?{}:{ops})})));
const loaded=page=>expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
const release=page=>page.evaluate(()=>{window.noteWork.hold=false;window.noteWork.held.splice(0).forEach(send=>send());});

test('focused Notes evaluate only their visible independent sketches and reuse completed examples',async({page})=>{
  for(const [source,base,ops] of [[25,50,['A','H']],[54,4,['HS','HSA','HSH']],[64,50,['HQS','HS']]]) {
    await ready(page,source);const before=await workspace(page);
    await page.locator('#ideas-open').click();await loaded(page);
    const work=await requests(page);
    expect(work.filter(job=>job.type==='level')).toEqual([{type:'level',source:base}]);
    expect(work.filter(job=>job.type==='evaluate').map(job=>`${job.source}:${job.ops}`).sort()).toEqual(ops.map(op=>`${base}:${op}`).sort());
    await expect(page.locator('#notes-content .note-recall')).toHaveCount(0);expect(await workspace(page)).toEqual(before);
    await page.keyboard.press('Escape');await page.locator('#ideas-open').click();await loaded(page);
    expect(await requests(page)).toEqual(work);expect(await workspace(page)).toEqual(before);
    await page.keyboard.press('Escape');
  }
});

test('closing Notes during its bootstrap leaves the current request alone and starts no later work',async({page})=>{
  await ready(page,64);const before=await workspace(page);
  await page.evaluate(()=>{window.noteWork.hold=true;});await page.locator('#ideas-open').click();
  await page.waitForFunction(()=>window.noteWork.held.length===1);
  const first=await requests(page);await page.keyboard.press('Escape');await release(page);
  await page.waitForFunction(()=>window.noteWork.replies.includes(window.noteWork.requests[0].id));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
  expect(await requests(page)).toEqual(first);await expect(page.locator('#ideas-open')).toBeFocused();expect(await workspace(page)).toEqual(before);
  await page.locator('#ideas-open').click();await loaded(page);
  const reopened=await requests(page);expect(reopened.filter(job=>job.type==='level')).toHaveLength(1);
  expect(reopened.filter(job=>job.type==='evaluate').map(job=>job.ops).sort()).toEqual(['HQS','HS']);expect(await workspace(page)).toEqual(before);
});

test('switching a loading lesson preserves the new tab and skips superseded evaluations',async({page})=>{
  await ready(page,54);const before=await workspace(page);
  await page.evaluate(()=>{window.noteWork.hold=true;});await page.keyboard.press('n');
  await page.waitForFunction(()=>window.noteWork.held.length===1);
  await page.locator('#note-lesson-25').focus();await page.keyboard.press('Enter');await release(page);await loaded(page);
  await expect(page.locator('#note-lesson-25')).toBeFocused();await expect(page.locator('#notes-concept')).toHaveText('Vertical placement and height difference are separate.');
  const work=await requests(page);
  expect(work.filter(job=>job.type==='level').map(job=>job.source)).toEqual([4,50]);
  expect(work.filter(job=>job.type==='evaluate').map(job=>`${job.source}:${job.ops}`).sort()).toEqual(['50:A','50:H']);
  expect(await workspace(page)).toEqual(before);
});
