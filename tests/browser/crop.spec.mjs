import {test,expect} from '@playwright/test';

const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
async function ready(page,id,view='flight') {
  await page.goto('/about/');await page.goto(`/#level=${id}&view=${view}`);
  await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
}
async function bound(page,key,value) {
  const input=page.locator(`[data-crop-exact="${key}"]`);
  await input.fill(value);await input.press('Enter');await idle(page);
}
async function add(page,ops) {for(const op of ops){await page.locator(`[data-op="${op}"]`).click();await idle(page);}}

test('authored drawing frames are fixed and only curve construction needs solving',async({page})=>{
  await ready(page,72);
  const initial=await page.evaluate(()=>window.angouri.result);
  expect(initial.crop).toMatchObject({from:'0',to:'2',editable:false,hit:true});
  expect(initial.solved).toBe(false);
  await expect(page.locator('[data-crop-exact],[data-crop-range]')).toHaveCount(0);
  await expect(page.locator('#hints-open')).toBeHidden();
  await add(page,'H');expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);
  await page.locator('#tab-function').click();await expect(page.locator('.constructed-formula annotation')).toContainText('for');
  await page.locator('#tab-flow').click();await expect(page.locator('#flow-position')).toHaveAttribute('max','4');
  await page.locator('#flow-position').fill('3');await page.locator('#flow-position').dispatchEvent('input');
  await expect(page.locator('[data-crop-reading]')).toContainText('outside');
  await expect(page.locator('.katex-error')).toHaveCount(0);
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
  await expect(page.locator('#garden-dialog')).toBeVisible();await page.keyboard.press('Escape');
  await page.locator('#launch').click();await idle(page);expect(await page.evaluate(()=>window.angouri.state.sourceId)).toBe(73);
  await expect(page.locator('.crop-fixed')).toContainText('Frame');
  await expect(page.locator('[data-crop-exact],[data-crop-range]')).toHaveCount(0);
});

async function createCrop(page) {
  await ready(page,1);await page.locator('#menu-open').click();await page.locator('#nav-create').click();await idle(page);
  await page.locator('[data-crop-add]').click();await idle(page);
}

test('range previews leave acknowledged state alone, cancel cleanly, and commit once',async({page})=>{
  await createCrop(page);
  const before=await page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history}));
  const range=page.locator('[data-crop-range="to"]');
  await range.focus();
  const immediate=await range.evaluate(input=>{
    const rect=document.querySelector('#crop-preview-clip rect'),before=rect.getAttribute('width');
    window.cropStableNodes=[document.querySelector('[data-crop-range]'),document.querySelector('.crop-title')];
    const cuts=document.querySelector('[data-crop-cuts]'),beforeCuts=cuts.getAttribute('d');
    input.value='3';input.dispatchEvent(new Event('input',{bubbles:true}));
    return {changed:rect.getAttribute('width')!==before,cutsChanged:cuts.getAttribute('d')!==beforeCuts,state:window.angouri.state.crop.to,result:window.angouri.result.crop.to,pending:document.querySelector('#scene').hasAttribute('data-crop-pending')};
  });
  expect(immediate).toEqual({changed:true,cutsChanged:true,state:'4',result:'4',pending:true});
  await page.waitForFunction(()=>window.angouri.result.crop.to==='3');
  expect(await page.evaluate(()=>window.cropStableNodes.every(node=>node.isConnected))).toBe(true);
  expect(await page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history}))).toEqual(before);
  await page.keyboard.press('Escape');await expect(range).toHaveValue('4');
  expect(await page.evaluate(()=>window.angouri.result.crop.to)).toBe('4');
  await range.evaluate(input=>{input.value='2';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForFunction(()=>window.angouri.result.crop.to==='2');
  await range.dispatchEvent('change');await idle(page);
  expect(await page.evaluate(()=>window.angouri.state.crop.to)).toBe('2');
  await page.locator('#undo').click();await idle(page);expect(await page.evaluate(()=>window.angouri.state.crop.to)).toBe('4');
  expect(await page.evaluate(()=>window.angouri.state)).toEqual(before.state);
});

test('crop values allow native selection and replacement and protect crop-only work',async({page})=>{
  await createCrop(page);
  const input=page.locator('[data-crop-exact="to"]');
  await input.dblclick();
  expect(await input.evaluate(el=>el.selectionEnd-el.selectionStart)).toBe(1);
  await expect(input).toHaveCSS('user-select','text');
  await input.pressSequentially('2');await input.press('Enter');await idle(page);
  expect(await page.evaluate(()=>window.angouri.state.crop.to)).toBe('2');
  await page.locator('#menu-open').click();await page.locator('#puzzles-open').click();await page.locator('[data-level="3"]').click();
  await expect(page.locator('#leave-dialog')).toBeVisible();await page.locator('#leave-cancel').click();
  expect(await page.evaluate(()=>window.angouri.state.mode)).toBe('remix');
  expect(await page.evaluate(()=>window.angouri.state.crop.to)).toBe('2');
});

test('the original picture constructions meet exact targets and do not award missing pieces',async({page})=>{
  test.setTimeout(240000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const [id,ops,range] of [[72,'H'],[73,'IH'],[74,'NAHH'],[75,'HQNAQ'],[76,'ASAH'],[77,'HQQQNAHH']]){
    await ready(page,id);await add(page,ops);
    if(range){await bound(page,'from',range[0]);await bound(page,'to',range[1]);}
    const result=await page.evaluate(()=>window.angouri.result);
    expect(result.picture.paths.length,`picture ${id}`).toBeGreaterThan(0);
    expect(result.checkpoints.every(c=>c.hit),`targets ${id}`).toBe(true);expect(result.solved,`solve ${id}`).toBe(true);
    expect(result.checkpoints.every(c=>Number.isFinite(c.targetNumber)),`target placement ${id}`).toBe(true);
    expect(result.outline).toBeUndefined();
    await page.locator('#tab-flow').click();await expect(page.locator('.katex-error')).toHaveCount(0);
    await page.locator('#tab-function').click();await expect(page.locator('.katex-error')).toHaveCount(0);
  }
  await page.locator('#launch').click();await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
  await expect(page.locator('#garden-dialog')).toBeVisible();
  await expect(page.locator('[data-garden-piece][data-complete="true"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('mastery puzzles belong to the authored chapter after its picture lessons',async({page})=>{
  await ready(page,64);await expect(page.locator('#chapter-step')).toContainText('MASTERY CHALLENGE');
  await page.locator('#menu-open').click();await page.locator('#puzzles-open').click();
  const group=page.locator('.chapter-group').filter({hasText:'The moonlit garden'});
  expect(await group.locator('[data-level]').evaluateAll(options=>options.map(option=>Number(option.dataset.level)))).toEqual([82,72,73,74,75,83,76,77,64,65,67]);
  await expect(group.locator('[data-level="64"]')).toContainText('Mastery challenge');
  await expect(group.locator('[data-level="65"]')).toContainText('Mastery challenge');
  await expect(group.locator('[data-level="67"]')).toContainText('Final mastery');
  expect(await group.locator('[data-level="72"] .challenge-label svg').innerHTML()).not.toBe(await group.locator('[data-level="64"] .challenge-label svg').innerHTML());
  await expect(group.locator('[data-level="67"]')).toContainText('One curve, many ideas');
  await page.keyboard.press('Escape');
  await expect(page.locator('#picture-open')).toHaveText('The moonlit garden');
  expect(await page.locator('#level-title').evaluate(el=>{const t=el.getBoundingClientRect(),h=el.closest('.puzzle-heading').getBoundingClientRect();return Math.abs(t.left+t.width/2-h.left-h.width/2);})).toBeLessThan(2);
  expect(await page.locator('#picture-open').evaluate(el=>el.closest('.chapter-context')!==null)).toBe(true);
});

test('nine operations retain distinct colors and readable formula contrast across surfaces',async({page})=>{
  await ready(page,1);await page.locator('#menu-open').click();await page.locator('#nav-create').click();await idle(page);
  const palette=await page.locator('.ingredient').evaluateAll(blocks=>blocks.map(block=>{
    const style=getComputedStyle(block.querySelector('.ingredient-surface'));
    const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
    const lum=s=>rgb(s).reduce((l,n,i)=>l+n*[.2126,.7152,.0722][i],0);
    return {op:block.dataset.op,fill:style.backgroundColor,ink:style.color,contrast:(lum(style.backgroundColor)+.05)/(lum(style.color)+.05)};
  }));
  expect(palette).toHaveLength(9);expect(new Set(palette.map(p=>p.fill)).size).toBe(9);
  for(const block of palette)expect(block.contrast,block.op).toBeGreaterThanOrEqual(4.5);
  for(const op of 'HANDISFC')await add(page,op);
  await page.locator('#tab-flow').click();
  const cards=await page.locator('.flow-machine:not(.source-machine):not(.crop-machine)').evaluateAll(cards=>cards.map(card=>({fill:getComputedStyle(card).backgroundColor,ink:getComputedStyle(card.querySelector('.machine-icon')).color})));
  for(const [i,op] of [...'HANDISFC'].entries())expect(cards[i]).toEqual({fill:palette.find(p=>p.op===op).fill,ink:palette.find(p=>p.op===op).ink});
});

test('rounded and pointed ends are taught before the cucumber synthesis',async({page})=>{
  await ready(page,66);await expect(page.locator('#level-title')).toHaveText('Round or pointed?');
  await add(page,'Q');await expect(page.locator('#feedback')).toContainText('rounded ends become pointed');
  const before=await page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history}));
  await page.locator('#ideas-open').click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
  const comparison=page.locator('[data-note-comparison]').filter({has:page.getByRole('group',{name:'Same roof. Rounded or pointed ends.',exact:true})});
  await comparison.getByRole('button',{name:'Roof squared',exact:true}).click();
  await expect(comparison.locator('[data-note-panel="1"]')).toBeVisible();
  expect(await page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history}))).toEqual(before);
  await ready(page,77);await page.locator('#ideas-open').click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('#notes-content')).toContainText('Broadness, rounded caps and thickness are separate');
  await expect(page.getByRole('group',{name:'The final right side chooses the cap shape.',exact:true})).toBeVisible();
  await expect(page.locator('.katex-error')).toHaveCount(0);
});

test('Create distinguishes circle controls before replacing a block recipe',async({page})=>{
  await ready(page,1);await page.locator('#menu-open').click();await page.locator('#nav-create').click();await idle(page);
  await add(page,'AH');const before=await page.evaluate(()=>window.angouri.state.nodes);
  await page.locator('#source-choose').click();
  await expect(page.locator('.circle-curve-family')).toContainText('Replaces your blocks');
  await page.locator('[data-source="43"]').click();await expect(page.locator('#leave-dialog')).toBeVisible();
  await expect(page.locator('#leave-description')).toContainText('instead of blocks');
  await page.locator('#leave-cancel').click();expect(await page.evaluate(()=>window.angouri.state.nodes)).toEqual(before);
  await page.locator('#source-choose').click();await page.locator('[data-source="43"]').click();await page.locator('#leave-discard').click();await idle(page);
  expect(await page.evaluate(()=>window.angouri.state.nodes)).toEqual([]);
  await expect(page.locator('[data-circle-value="radius"]')).toBeVisible();
  await page.locator('#undo').click();await idle(page);expect(await page.evaluate(()=>window.angouri.state.nodes)).toEqual(before);
});
