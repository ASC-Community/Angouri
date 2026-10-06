import {test,expect} from '@playwright/test';
const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
async function ready(page,id,view='flight') {
  await page.goto('/about/');await page.goto(`/#level=${id}&view=${view}`);
  await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
}
const workspace=page=>page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history,slots:window.angouri.slots}));
const add=async(page,op)=>{await page.locator(`[data-op="${op}"]`).click();await idle(page);};

test('Hints guide the current puzzle while Notes retain the chapter reference',async({page})=>{
  await ready(page,31,'flow');const before=await workspace(page);
  await expect(page.locator('#ideas-open')).toHaveAccessibleName('Notes');
  await expect(page.locator('#ideas-open [data-icon="book"] svg')).toHaveCount(1);
  await page.locator('#hints-open').click();await expect(page.locator('#hints-dialog')).toHaveAccessibleName('Hints');
  await expect(page.locator('#hints-content')).toContainText('4.5 · Hold a wider summit');
  await expect(page.locator('.hint-clue')).toContainText('Fit the provided bowl');
  await expect(page.locator('#hints-dialog [data-note]')).toHaveCount(0);
  const more=page.getByRole('button',{name:'Another hint',exact:true});
  expect(await page.locator('.hint-actions').evaluate(el=>!!(el.compareDocumentPosition(document.querySelector('#hint-more-toggle'))&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await expect(page.locator('#hint-extra')).toBeHidden();await expect(more).toHaveAttribute('aria-expanded','false');
  await more.focus();await page.keyboard.press('Enter');await expect(page.locator('#hint-extra')).toBeVisible();await expect(more).toHaveAttribute('aria-expanded','true');await expect(more).toBeFocused();
  await page.keyboard.press('Space');await expect(page.locator('#hint-extra')).toBeHidden();await expect(more).toHaveAttribute('aria-expanded','false');
  await page.locator('#hint-notes').click();await expect(page.locator('#hints-dialog')).not.toBeVisible();
  await expect(page.locator('#ideas-dialog')).toHaveAccessibleName('Notes');await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('#notes-content [data-reference-lesson="31"]')).toHaveCount(1);
  await expect(page.locator('#notes-content')).not.toContainText('Fit first. Then square again.');
  await page.locator('[data-note="0"]').click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('#notes-content')).toContainText('height difference');await expect(page.locator('.note-question')).toHaveCount(0);
  await page.keyboard.press('Escape');await expect(page.locator('#ideas-open')).toBeFocused();expect(await workspace(page)).toEqual(before);
  await page.locator('#hints-open').click();await page.locator('#hints-content [data-view="function"]').click();await expect(page.locator('#tab-function')).toBeFocused();
  expect(await workspace(page)).toEqual(before);
  for(const id of [1,2]){await ready(page,id);await expect(page.locator('#ideas-open')).toBeHidden();await expect(page.locator('#hints-open')).toBeHidden();}
  await page.locator('#menu-open').click();await page.locator('#nav-create').click();await idle(page);
  await expect(page.locator('#ideas-open')).toBeVisible();await expect(page.locator('#hints-open')).toBeHidden();
});

test('Equation keeps node order visible above the kernel simplified result',async({page})=>{
  await ready(page,3,'function');await add(page,'A');await add(page,'H');
  const check=async(showSimplified)=>{
    const result=await page.evaluate(()=>window.angouri.result);
    await expect(page.locator('.constructed-formula annotation')).toHaveText(result.constructedLatex);
    if(showSimplified===false)await expect(page.locator('.final-formula')).toBeHidden();
    if(showSimplified===true) {
      await expect(page.locator('.final-formula annotation')).toHaveText(`h = ${result.stages.at(-1).latex}`);
      const raw=await page.locator('.constructed-formula').boundingBox(),simple=await page.locator('.final-formula').boundingBox();expect(raw.y+raw.height).toBeLessThan(simple.y);
    }
    await expect(page.locator('.katex-error')).toHaveCount(0);
    return result.constructedLatex;
  };
  const first=await check(false);await page.locator('.part-body').first().focus();await page.keyboard.press('ArrowRight');await idle(page);expect(await check()).not.toBe(first);
  await page.locator('#undo').click();await idle(page);expect(await check()).toBe(first);
  await ready(page,41,'function');await add(page,'D');await check(true);
  await ready(page,45,'function');await expect(page.locator('.constructed-formula annotation')).toHaveText(await page.evaluate(()=>window.angouri.result.constructedLatex));
  for(const size of [{width:1440,height:900},{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(size);await expect(page.locator('.katex-error')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
  }
});

test('circle edits keep the default frame and Full curve toggles back without editing',async({page})=>{
  await ready(page,43);
  const marks=()=>page.evaluate(()=>({centre:[...document.querySelectorAll('.circle-centre-mark')].map(el=>[el.getAttribute('cx'),el.getAttribute('cy')]),targets:[...document.querySelectorAll('.ring-outer')].map(el=>[el.getAttribute('cx'),el.getAttribute('cy')])}));
  const initial=await marks(),width=await page.locator('#trajectory').evaluate(el=>el.getBBox().width),state=await page.evaluate(()=>window.angouri.state.circle);
  await page.locator('[data-circle-value="radius"]').fill('6');await page.locator('[data-circle-value="radius"]').press('Enter');await idle(page);
  expect(await marks()).toEqual(initial);expect(await page.locator('#trajectory').evaluate(el=>el.getBBox().width)).toBeGreaterThan(width);
  expect(await page.evaluate(()=>[window.angouri.state.circle.x,window.angouri.state.circle.y])).toEqual([state.x,state.y]);
  await expect(page.locator('#circle-fit')).toHaveClass(/needs-fit/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
  const before=await workspace(page);await page.locator('#circle-fit').click();await expect(page.locator('#circle-fit')).toBeFocused();
  expect(await workspace(page)).toEqual(before);await expect(page.locator('#circle-fit')).not.toHaveClass(/needs-fit/);
  await expect(page.locator('#circle-fit')).toHaveAttribute('aria-pressed','true');
  const fitted=await marks();expect(fitted).not.toEqual(initial);
  await page.locator('#tab-flow').click();await expect(page.locator('#circle-fit')).toBeVisible();await page.locator('#tab-flight').click();expect(await marks()).toEqual(fitted);
  await page.locator('#circle-fit').focus();await page.keyboard.press('Space');
  await expect(page.locator('#circle-fit')).toHaveAttribute('aria-pressed','false');
  expect(await marks()).toEqual(initial);expect(await workspace(page)).toEqual(before);
  await page.locator('#circle-fit').click();await page.locator('#undo').click();await idle(page);
  await expect(page.locator('#circle-fit')).toHaveAttribute('aria-pressed','true');
  await page.locator('#circle-fit').click();expect(await marks()).toEqual(initial);
  expect(await page.evaluate(()=>window.angouri.state.circle)).toEqual(state);
});

test('the loaded slingshot and cucumber follow every frame of a curve edit',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await ready(page,3);
  await page.evaluate(()=>{
    window.rigSamples=[];let frames=0;
    const record=()=>{
      if(window.angouri.state.nodes.length===1){
        const curve=document.querySelector('#trajectory').getPointAtLength(0),rig=document.querySelector('#launcher'),front=document.querySelector('#launcher-front'),cucumber=document.querySelector('#cucumber');
        const origin=rig.transform.baseVal.getItem(0).matrix,body=cucumber.transform.baseVal.getItem(0).matrix;
        const degrees=document.querySelector('#flight-spin').transform.baseVal.getItem(0).angle-90,angle=degrees*Math.PI/180;
        window.rigSamples.push({y:curve.y,originError:Math.hypot(curve.x-origin.e,curve.y-origin.f),bodyError:Math.hypot(body.e+68*Math.cos(angle)-origin.e,body.f+68*Math.sin(angle)-origin.f),same:rig.getAttribute('transform')===front.getAttribute('transform')});
      }
      if(++frames<90)requestAnimationFrame(record);
    };requestAnimationFrame(record);
  });
  await add(page,'A');await page.waitForFunction(()=>window.rigSamples.length>=26);
  const samples=await page.evaluate(()=>window.rigSamples);
  expect(Math.max(...samples.map(s=>s.y))-Math.min(...samples.map(s=>s.y))).toBeGreaterThan(15);
  expect(new Set(samples.map(s=>s.y.toFixed(1))).size).toBeGreaterThan(6);
  for(const sample of samples){expect(sample.originError).toBeLessThan(.03);expect(sample.bodyError).toBeLessThan(.03);expect(sample.same).toBe(true);}
});

test('deck formulas stand alone while operation help is available on focus and hover',async({page})=>{
  await ready(page,1);await page.locator('#menu-open').click();await page.locator('#nav-create').click();await idle(page);
  await expect(page.locator('.ingredient-face strong')).toHaveCount(0);
  await page.locator('[data-op="H"]').focus();await page.keyboard.press('Tab');
  await expect(page.locator('[data-op="A"]')).toBeFocused();
  await expect(page.locator('#block-tooltip')).toBeVisible();await expect(page.locator('#block-tooltip strong')).toHaveText('Add one');
  await page.keyboard.press('Escape');await expect(page.locator('#block-tooltip')).toBeHidden();
  await page.locator('[data-op="Q"]').hover();await expect(page.locator('#block-tooltip strong')).toHaveText('Square');
  await expect(page.locator('#block-tooltip')).toBeVisible();
  expect(await page.evaluate(()=>window.angouri.state.nodes)).toEqual([]);
  await add(page,'A');
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'Redo',exact:true})).toBeDisabled();
  await expect(page.locator('.history-actions')).toHaveText('');
});
