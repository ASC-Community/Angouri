import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const learningPath=JSON.parse(await readFile(new URL('../../content/learning-path.json',import.meta.url),'utf8'));
const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
const workspace=page=>page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history,slots:window.angouri.slots,progress:localStorage.getItem('angouri:vine:v1:progress')}));
async function ready(page,id) {
  await page.goto('/about/');await page.goto(`/#level=${id}&view=flight`);
  await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
}
async function notes(page) {
  await page.locator('#ideas-open').click();
  await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('[data-retry-notes]')).toHaveCount(0);
}

// Observe the actual stateless kernel responses without adding an evaluator or
// changing any request. Formula identity connects those exact readings to the
// examples that Notes really renders, including hidden comparison choices.
async function recordExamples(page) {
  await page.addInitScript(()=>{
    window.__referenceResults=[];
    const BrowserWorker=window.Worker;
    window.Worker=class extends BrowserWorker {
      constructor(...args) {
        super(...args);
        this.addEventListener('message',({data})=>{
          if(data.type==='result'&&data.response?.status==='ok'&&data.response.result)
            window.__referenceResults.push(data.response.result);
        });
      }
    };
  });
}

for(const source of [12,29,66])test(`discovery Notes ${source} use mathematically independent inputs and outputs`,async({page})=>{
  await recordExamples(page);await ready(page,source);
  const input=await page.evaluate(()=>window.angouri.result);
  await page.locator('[data-op="Q"]').click();await idle(page);
  const solution=await page.evaluate(()=>window.angouri.result);
  expect(solution.solved).toBe(true);
  await page.locator('[data-op="Q"]').click();await idle(page);
  const before=await workspace(page);
  await page.evaluate(()=>{window.__referenceResults=[];});
  await notes(page);

  const rendered=await page.evaluate(()=>{
    const formulas=new Set([...document.querySelectorAll('#notes-content annotation')].map(node=>node.textContent));
    const examples=new Map();
    for(const result of window.__referenceResults) {
      const add=stage=>examples.set(stage.expression,{expression:stage.expression,values:result.checkpoints.map((checkpoint,index)=>[checkpoint.x,stage.values[index]]),domain:[stage.points[0][0],stage.points.at(-1)[0]]});
      for(const stage of result.stages)if(formulas.has(stage.latex))add(stage);
      if(result.relation&&formulas.has(result.relation.equationLatex))add(result.stages.at(-1));
    }
    return [...examples.values()];
  });
  expect(rendered.length).toBeGreaterThanOrEqual(source===29?3:2);
  for(const example of rendered) {
    expect(example.domain).toEqual([0,4]);
    const readings=new Map(example.values);
    for(const [name,result] of [['starting input',input],['completed output',solution]]) {
      const stage=result.stages.at(-1);
      const shared=result.checkpoints.flatMap((checkpoint,index)=>readings.has(checkpoint.x)?[[readings.get(checkpoint.x),stage.values[index]]]:[]);
      expect(shared.length).toBeGreaterThanOrEqual(3);
      expect(shared.some(([reference,active])=>reference!==active),`${example.expression} must differ from the active ${name} at an exact reading`).toBe(true);
    }
  }
  if(source===29) {
    const comparison=page.getByRole('region',{name:'Same input. Different powers.'});
    const axes=await comparison.locator('[data-zero-line]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('d')));
    expect(new Set(axes).size).toBe(1);
    await expect(comparison.getByRole('tab')).toHaveText(['Second power','Fourth power','Sixth power']);
  }
  await expect(page.locator('#notes-content [data-note-target],#notes-content .note-recall,.katex-error')).toHaveCount(0);
  expect(await workspace(page)).toEqual(before);
});

test('the complete Notes book retains a reference for every main lesson, including Build a gate',async({page})=>{
  test.setTimeout(180000);
  await ready(page,1);
  await page.locator('#menu-open').click();await page.locator('#nav-create').click();await idle(page);
  const before=await workspace(page);await notes(page);
  await expect(page.locator('[data-note]')).toHaveCount(learningPath.chapters.length);
  for(const [chapter,sources] of learningPath.chapters.entries()) {
    await page.locator(`[data-note="${chapter}"]`).click();
    await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
    await expect(page.locator('[data-retry-notes],.katex-error')).toHaveCount(0);
    for(const source of sources)
      expect(await page.locator(`#notes-content [data-reference-lesson="${source}"]`).count(),`chapter ${chapter+1} must keep source ${source}`).toBeGreaterThan(0);
  }
  const gate=page.locator('#notes-content [data-recall-sources="65"]');
  await expect(gate).toContainText('10.10');
  await expect(gate).toContainText('Positive input raises the accumulated total');
  await expect(gate.locator('.note-stage')).toHaveCount(2);
  expect(await workspace(page)).toEqual(before);
});

test('authored Build a gate keeps its current reference and separate prerequisite navigation',async({page})=>{
  await ready(page,65);const before=await workspace(page);await notes(page);
  const prerequisites=learningPath.lessons.find(lesson=>lesson.id===65).prerequisites;
  expect(await page.locator('[data-note-lesson]').evaluateAll(buttons=>buttons.map(button=>Number(button.dataset.noteLesson)))).toEqual([65,...prerequisites]);
  await expect(page.locator('#notes-concept')).toHaveText('Input regions become rises, plateaus and falls.');
  await expect(page.locator('#notes-content [data-reference-lesson="65"]')).toHaveCount(1);
  await expect(page.locator('#notes-content .note-recall')).toHaveCount(0);
  expect(await workspace(page)).toEqual(before);
});
