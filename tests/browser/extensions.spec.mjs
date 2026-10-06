import {test,expect} from '@playwright/test';
const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
async function ready(page,id,view='flight') {
  await page.goto('/about/');await page.goto(`/#level=${id}&view=${view}`);
  await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
  expect(await page.evaluate(()=>window.angouri.state.sourceId)).toBe(id);
}
async function add(page,op){await page.locator(`[data-op="${op}"]`).click();await idle(page);}
async function recipe(page,ops){for(const op of ops)await add(page,op);}
const snapshot=page=>page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}));

test('a roof recipe constructs both heights and validates squared target heights',async({page})=>{
  await ready(page,48);await recipe(page,'QNA');
  const result=await page.evaluate(()=>window.angouri.result);
  expect(result.solved).toBe(true);expect(result.relation.playback.some(p=>p[1]<0)).toBe(true);expect(result.relation.playback.some(p=>p[1]>0)).toBe(true);
  expect(result.checkpoints.every(p=>p.hit&&p.lhs===p.rhs)).toBe(true);
  const before=await snapshot(page);await page.locator('#tab-function').click();
  await expect(page.locator('.constructed-formula annotation')).toHaveText(result.constructedLatex);
  await expect(page.locator('.value-table')).toContainText('Recipe');await expect(page.locator('.equation-verdict')).toHaveCount(4);
  await page.locator('#tab-flow').click();await expect(page.locator('.relation-machine')).toHaveCount(1);await expect(page.locator('.relation-machine .flow-target')).toHaveCount(4);
  expect(await snapshot(page)).toEqual(before);
  await page.locator('#undo').click();await idle(page);expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(false);
  await page.locator('#redo').click();await idle(page);expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);
});

test('squared-height recipes simplify, solve for height, and travel continuously through zero',async({page})=>{
  await ready(page,48,'function');await recipe(page,'AQ');
  let result=await page.evaluate(()=>window.angouri.result);
  expect(result.stages.at(-1).latex).not.toMatch(/x\s*-\s*2\s*\+\s*1/);
  expect(result.relation.solvedLatex).toContain('h');expect(result.relation.solvedLatex).not.toContain('q(');
  await expect(page.locator('.solution-heights annotation')).toHaveText(result.relation.solvedLines.map(line=>line.heightLatex));
  await expect(page.locator('.solution-condition annotation')).toHaveText([...new Set(result.relation.solvedLines.map(line=>line.conditionLatex))]);
  await page.locator('#tab-flow').click();
  const probe=async x=>{await page.locator('#flow-position').fill(String(x));await page.locator('#flow-position').dispatchEvent('input');};
  await probe(2);await expect(page.locator('[data-relation-probe]:visible')).toHaveCount(2);
  const ys=await page.locator('[data-relation-probe]:visible').evaluateAll(points=>points.map(p=>Number(p.getAttribute('cy'))));expect(ys[0]).toBeLessThan(ys[1]);
  await probe(1);await expect(page.locator('[data-relation-probe]:visible')).toHaveCount(1);
  await page.locator('#reset').click();await idle(page);await recipe(page,'QNA');result=await page.evaluate(()=>window.angouri.result);
  expect(result.relation.breaks).toHaveLength(0);
  const distances=result.relation.playback.slice(1).map((p,i)=>Math.hypot(p[0]-result.relation.playback[i][0],p[1]-result.relation.playback[i][1]));
  expect(Math.max(...distances)).toBeLessThan(.06);
  await page.locator('#menu-open').click();await page.locator('#settings-open').click();await page.locator('#motion-toggle').uncheck();await page.keyboard.press('Escape');
  await page.locator('#tab-flight').click();await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await expect(page.locator('.ring[data-status="hit"]')).toHaveCount(4);
});

test('one-sided stations expose only usable slots and preserve their fixed operation',async({page})=>{
  for(const [id,side,op] of [[53,'After','Q'],[61,'Before','F']]){
    await ready(page,id);
    await expect(page.getByRole('group',{name:side+' the station',exact:true})).toHaveCount(1);
    await expect(page.getByRole('group',{name:(side==='After'?'Before':'After')+' the station',exact:true})).toHaveCount(0);
    await add(page,op);expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);
    await page.locator('#undo').click();await idle(page);expect(await page.evaluate(()=>window.angouri.state.nodes.map(n=>n.op))).toEqual(['S']);
  }
});

test('sine has exact symbolic readings and a kernel circle projection before its output',async({page})=>{
  await ready(page,54,'function');
  const result=await page.evaluate(()=>window.angouri.result),half=result.checkpoints.find(p=>p.x==='1/2');
  expect(half.actualLatex).toContain('sqrt');
  await expect(page.locator('.exact-value').filter({has:page.locator('annotation',{hasText:half.actualLatex})}).first()).toBeVisible();
  await expect(page.locator('.katex-error')).toHaveCount(0);
  await page.locator('#tab-flow').click();
  const diagram=page.locator('.wave-scene'),plot=page.locator('.wave-scene + .machine-body');
  expect(await diagram.evaluate((el)=>el.nextElementSibling.classList.contains('machine-body'))).toBe(true);
  await page.locator('#flow-position').fill('1');await page.locator('#flow-position').dispatchEvent('input');
  await expect(page.locator('[data-station-output] annotation')).toHaveText('\\approx 1');
  const projected=await page.locator('[data-wave-dot]').evaluate(el=>[Number(el.getAttribute('cx')),Number(el.getAttribute('cy'))]);
  expect(projected[0]).toBeCloseTo(88,5);expect(projected[1]).toBeCloseTo(14,5);
  await expect(plot).toBeVisible();
});

test('small symbolic readings display decimal exponents as powers of ten',async({page})=>{
  await ready(page,50,'function');
  const artifact={schema:1,rules:'vine-1',engine:'AngouriMath-2.5.0',type:'creation',sourceId:50,view:'function',nodes:[...'HHHHHHQQS'].map((op,i)=>({id:`decimal-${i}`,op}))};
  await page.locator('#import-file').setInputFiles({name:'small-wave.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(artifact))});await page.waitForFunction(()=>window.angouri.state.mode==='remix');await idle(page);
  const row=page.locator('.value-table tbody tr').nth(1);
  await expect(row.locator('td:nth-child(2) .decimal-value annotation')).toHaveText('\\approx 9.363\\times 10^{-8}');
  await page.locator('#tab-flow').click();await page.locator('#flow-position').fill('1');await page.locator('#flow-position').dispatchEvent('input');
  await expect(page.locator('[data-station-output] annotation')).toHaveText('\\approx 9.36\\times 10^{-8}');await expect(page.locator('.katex-error')).toHaveCount(0);
});

test('floor and ceiling draw gaps with explicit endpoint ownership',async({page})=>{
  for(const [id,op] of [[56,'F'],[57,'C']]){
    await ready(page,id);await add(page,op);expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);
    const {paths,points}=await page.evaluate(()=>window.angouri.result);expect(paths.length).toBeGreaterThan(3);
    expect(points.slice(1).every((point,index)=>point[0]>points[index][0])).toBe(true);
    await expect(page.locator('[data-flight-stroke]')).toHaveCount(1);
    await expect(page.locator('[data-flight-stroke] > [id^="cucumber"]')).toHaveCount(1);
    const d=await page.locator('#trajectory').getAttribute('d');expect(d.match(/M/g).length).toBe(paths.length);
    await expect(page.locator('.path-end.open').first()).toBeVisible();await expect(page.locator('.path-end.closed').first()).toBeVisible();
    await page.locator('#tab-flow').click();
    expect((await page.locator('.flow-curve').last().getAttribute('d')).match(/M/g).length).toBe(paths.length);
    await expect(page.locator('.katex-error')).toHaveCount(0);
  }
});

test('step area stays continuous and shares the reward clock with Flow',async({page})=>{
  await ready(page,62,'flow');await recipe(page,'FS');expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);
  await page.locator('#flow-position').fill('3.5');await page.locator('#flow-position').dispatchEvent('input');
  await expect(page.locator('.amount-scene [data-station-output] annotation')).toHaveText('\\approx 0.5');
  const before=await snapshot(page);
  await page.locator('#menu-open').click();await page.locator('#settings-open').click();await page.locator('#motion-toggle').uncheck();await page.keyboard.press('Escape');
  await page.locator('#launch').click();await expect(page.locator('#flow-position')).toBeDisabled();
  await page.locator('#tab-flight').click();await expect(page.locator('#flight-trail')).toBeVisible();
  await page.waitForFunction(()=>window.angouri.flight.phase==='landed');await page.locator('#tab-flow').click();
  await expect(page.locator('#flow-position')).toBeEnabled();await expect(page.locator('#flow-position')).toHaveValue('3.5');expect(await snapshot(page)).toEqual(before);
});

test('the mixed final garden uses the full chain and finishes only the solved source',async({page})=>{
  test.setTimeout(120000);await ready(page,67);await recipe(page,'DAHFSINAQNAQ');
  const result=await page.evaluate(()=>window.angouri.result);expect(result.solved).toBe(true);expect(result.checkpoints).toHaveLength(10);
  expect(await page.evaluate(()=>window.angouri.state.nodes.map(n=>n.op).join(''))).toBe('DAHFSINAQNAQ');
  await page.locator('#tab-function').click();await expect(page.locator('.equation-verdict')).toHaveCount(10);await expect(page.locator('.katex-error')).toHaveCount(0);
  await page.locator('#launch').click();await expect(page.locator('#launch')).toHaveText('Finish');
  await expect(page.locator('.equation-verdict[data-status="hit"]')).toHaveCount(10);
  await page.locator('#launch').click();await expect(page.locator('#ending-dialog')).toBeVisible();await expect(page.locator('#ending-progress')).toHaveText('1 of 57 puzzles complete');
  await expect(page.locator('#ending-dialog')).toContainText('AngouriMath');
});

test('paired targets have a readable stable opening frame and explicit Fit includes the unfinished path',async({page})=>{
  await ready(page,67);
  const positions=()=>page.locator('.ring-outer').evaluateAll(rings=>rings.map(r=>[Number(r.getAttribute('cx')),Number(r.getAttribute('cy')),Number(r.getAttribute('r'))]));
  const initial=await positions(),xs=initial.map(p=>p[0]);
  expect(Math.max(...xs)-Math.min(...xs)).toBeGreaterThan(330);
  await expect(page.locator('#circle-fit')).toHaveClass(/needs-fit/);
  await add(page,'D');expect(await positions()).toEqual(initial);
  for(const size of [{width:1440,height:900},{width:320,height:568},{width:844,height:390}]){
    await page.setViewportSize(size);
    const boxes=await page.locator('.target-label .katex-html').evaluateAll(labels=>labels.map(l=>l.getBoundingClientRect().toJSON()));
    for(let i=0;i<boxes.length;i++)for(let j=0;j<i;j++){
      const a=boxes[i],b=boxes[j];expect(a.right<=b.left+1||b.right<=a.left+1||a.bottom<=b.top+1||b.bottom<=a.top+1).toBe(true);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
  }
  await page.locator('#undo').click();await idle(page);const before=await snapshot(page);
  await page.locator('#circle-fit').click();expect(await snapshot(page)).toEqual(before);
  await expect(page.locator('#circle-fit')).not.toHaveClass(/needs-fit/);expect(await positions()).not.toEqual(initial);
});

test('floor and ceiling cues put the output on opposite sides of the same input',async({page})=>{
  await ready(page,56);
  const cue=op=>page.locator(`[data-op="${op}"] .ingredient-cue`);
  expect(await cue('F').locator('.cue-before').getAttribute('d')).toBe(await cue('C').locator('.cue-before').getAttribute('d'));
  const heights=async op=>cue(op).locator('.cue-after').evaluate(path=>[.16,.5,.83].map(t=>path.getPointAtLength(path.getTotalLength()*t).y));
  const floor=await heights('F'),ceiling=await heights('C');
  expect(floor.every((y,i)=>y>ceiling[i])).toBe(true);
  await add(page,'C');expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(false);
  await add(page,'F');expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);
});

test('nine reusable operations remain readable and exact sine rounding stays editable',async({page})=>{
  await ready(page,50);await page.locator('#menu-open').click();await page.locator('#nav-create').click();await idle(page);
  await expect(page.locator('.ingredient')).toHaveCount(9);await add(page,'S');await add(page,'F');
  expect(await page.evaluate(()=>window.angouri.state.nodes.map(node=>node.op).join(''))).toBe('SF');
  expect(await page.evaluate(()=>window.angouri.result.paths.length)).toBeGreaterThan(3);
  await expect(page.locator('#feedback')).not.toHaveClass(/error/);
  for(const size of [{width:1440,height:900},{width:320,height:568},{width:844,height:390}]){
    await page.setViewportSize(size);expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
    expect(await page.locator('.ingredient').evaluateAll(items=>items.every(el=>el.getBoundingClientRect().width>60))).toBe(true);
    expect(await page.locator('.ingredient-face').evaluateAll(items=>items.every(el=>el.scrollWidth<=el.clientWidth+1))).toBe(true);
    await expect(page.locator('.katex-error')).toHaveCount(0);
  }
});

test('Notes keep independent reference examples while puzzle sketches require explicit Hints disclosures',async({page})=>{
  test.setTimeout(150000);
  for(const [id,next] of [[43,44],[48,68],[50,51],[56,57],[64,65]]){
    await ready(page,id);const before=await snapshot(page);await page.locator('#ideas-open').click();
    await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
    expect(await page.evaluate(()=>window.angouri.measurements.restarts)).toBe(0);
    await expect(page.locator(`#notes-content [data-reference-lesson="${id}"]`)).toHaveCount(1);
    await expect(page.locator(`#notes-content [data-reference-lesson="${next}"]`)).toHaveCount(0);
    await expect(page.locator('#notes-content [data-note-target]')).toHaveCount(0);
    await expect(page.locator('#notes-content details')).toHaveCount(0);
    await expect(page.locator('.katex-error')).toHaveCount(0);await page.keyboard.press('Escape');expect(await snapshot(page)).toEqual(before);
  }
  await ready(page,60);await page.locator('#ideas-open').click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
  const comparison=page.locator('[data-note-comparison]').first();await expect(comparison.locator('.note-step-end.open').first()).toBeVisible();
  const old=await comparison.locator('[data-note-panel]:visible path.note-curve').evaluateAll(paths=>paths.map(p=>p.getAttribute('d')).join(' '));
  await comparison.locator('[data-note-choice="1"]').click();await expect(comparison.locator('[data-note-choice="1"]')).toHaveAttribute('aria-pressed','true');
  const changed=await comparison.locator('[data-note-panel]:visible path.note-curve').evaluateAll(paths=>paths.map(p=>p.getAttribute('d')).join(' '));expect(changed).not.toBe(old);
  await page.keyboard.press('Escape');await ready(page,67);const before=await snapshot(page);await page.locator('#hints-open').click();
  await expect(page.locator('#hint-notes')).toBeVisible();
  await expect(page.locator('#hint-sketch-toggle')).toBeHidden();await expect(page.locator('#hint-sketch')).toBeEmpty();
  await page.getByRole('button',{name:'Another hint',exact:true}).click();
  await expect(page.locator('#hints-content')).toContainText('midpoint');await expect(page.locator('#hints-content')).not.toContainText('x=1');await expect(page.locator('#hints-content')).not.toContainText('DAHFSINAQNAQ');await expect(page.locator('.katex-error')).toHaveCount(0);
  await expect(page.locator('#hint-sketch')).toBeEmpty();await page.locator('#hint-sketch-toggle').click();
  await expect(page.locator('#hint-sketch')).toHaveAttribute('aria-busy','false');await expect(page.locator('#hint-sketch svg').first()).toBeVisible();
  await expect(page.locator('#hint-sketch .note-recall')).toHaveCount(0);
  await page.keyboard.press('Escape');expect(await snapshot(page)).toEqual(before);
});
