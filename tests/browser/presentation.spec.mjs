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

test('circle edits preserve the coordinate frame until an explicit fit',async({page})=>{
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
  const fitted=await marks();expect(fitted).not.toEqual(initial);
  await page.locator('#tab-flow').click();await expect(page.locator('#circle-fit')).toBeVisible();await page.locator('#tab-flight').click();expect(await marks()).toEqual(fitted);
  await page.locator('#undo').click();await idle(page);expect(await marks()).toEqual(fitted);
  expect(await page.evaluate(()=>window.angouri.state.circle)).toEqual(state);
});
