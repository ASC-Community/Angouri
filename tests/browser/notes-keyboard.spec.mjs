import {test,expect} from '@playwright/test';

async function ready(page,id=54) {
  await page.goto('/about/');await page.evaluate(()=>localStorage.clear());await page.goto(`/#level=${id}`);
  await page.waitForFunction(()=>window.angouri?.state&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
}
const workspace=page=>page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history,slots:window.angouri.slots}));
async function selected(page,selector) {
  const tab=page.locator(selector);await expect(tab).toBeFocused();await expect(tab).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#notes-index [role=tab][tabindex="0"]')).toHaveCount(1);
  await expect(page.locator('#notes-reading')).toHaveAttribute('aria-labelledby',await tab.getAttribute('id'));
  await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
}

test('Notes lesson tabs use one Tab stop with arrows and Home or End selecting the panel',async({page},testInfo)=>{
  await page.setViewportSize({width:1146,height:850});await ready(page);const before=await workspace(page);
  await page.keyboard.press('n');await expect(page.locator('#ideas-dialog .close-dialog')).toBeFocused();
  await page.keyboard.press('Tab');await selected(page,'#note-lesson-54');
  await expect(page.locator('#notes-index')).toHaveAttribute('role','tablist');await expect(page.locator('#notes-reading')).toHaveAttribute('role','tabpanel');
  await expect(page.locator('.keyboard-arrows:visible')).toHaveAttribute('data-directions','x');
  for(const [key,id] of [['ArrowRight',53],['ArrowRight',25],['ArrowRight',54],['End',25],['Home',54],['ArrowLeft',25]]) {
    await page.keyboard.press(key);await selected(page,`#note-lesson-${id}`);
  }
  await page.keyboard.press('Tab');expect(await page.evaluate(()=>!document.activeElement.closest('#notes-index'))).toBe(true);
  await page.keyboard.press('Shift+Tab');await selected(page,'#note-lesson-25');
  // Rapid changes must leave the newest panel active after kernel examples settle.
  await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');await page.keyboard.press('Home');
  await selected(page,'#note-lesson-54');await expect(page.locator('#notes-content [data-reference-lesson="54"]')).toHaveCount(1);
  await page.screenshot({path:testInfo.outputPath('notes-lesson-tabs.png')});
  await page.keyboard.press('Escape');expect(await workspace(page)).toEqual(before);
  await page.locator('#ideas-open').click();await page.locator('#note-lesson-53').click();
  expect(await page.locator('#note-lesson-53').evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('none');
});

test('narrow Notes tabs use vertical arrows while a wrapped chapter index supports both directions',async({page},testInfo)=>{
  await page.setViewportSize({width:320,height:568});await ready(page,25);await page.keyboard.press('n');await page.keyboard.press('Tab');
  await selected(page,'#note-lesson-25');await expect(page.locator('#notes-index')).toHaveAttribute('aria-orientation','vertical');
  await expect(page.locator('.keyboard-arrows:visible')).toHaveAttribute('data-directions','y');
  await page.keyboard.press('ArrowDown');await selected(page,'#note-lesson-24');await page.keyboard.press('ArrowDown');await selected(page,'#note-lesson-25');
  await page.keyboard.press('ArrowUp');await selected(page,'#note-lesson-24');
  await page.keyboard.press('Escape');await page.locator('#menu-open').click();await page.locator('#nav-create').click();await page.evaluate(()=>window.angouri.whenIdle());
  const before=await workspace(page);await page.setViewportSize({width:320,height:390});await page.keyboard.press('n');await page.keyboard.press('Tab');
  await selected(page,'#note-chapter-0');await expect(page.locator('.keyboard-arrows:visible')).toHaveAttribute('data-directions','xy');
  await page.keyboard.press('ArrowDown');await selected(page,'#note-chapter-2');await page.keyboard.press('ArrowRight');await selected(page,'#note-chapter-3');
  await page.keyboard.press('End');const last=page.locator('#notes-index [role=tab]').last();await selected(page,`#${await last.getAttribute('id')}`);
  await expect.poll(()=>page.locator('#notes-index').evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
  const bounds=await last.evaluate(el=>{const a=el.getBoundingClientRect(),b=el.closest('#notes-index').getBoundingClientRect();return {top:a.top-b.top,bottom:b.bottom-a.bottom};});
  expect(bounds.top).toBeGreaterThanOrEqual(0);expect(bounds.bottom).toBeGreaterThanOrEqual(0);
  await page.screenshot({path:testInfo.outputPath('notes-chapter-tabs-320.png')});
  await page.keyboard.press('ArrowRight');await selected(page,'#note-chapter-0');await page.keyboard.press('Escape');expect(await workspace(page)).toEqual(before);
});

test('comparison tabs inside Notes and Hints switch with arrows without adding extra Tab stops',async({page})=>{
  await page.setViewportSize({width:320,height:568});await ready(page,43);
  await page.locator('#menu-open').click();await page.locator('#nav-create').click();await page.evaluate(()=>window.angouri.whenIdle());
  const before=await workspace(page);await page.keyboard.press('n');await page.locator('#note-chapter-6').click();await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
  const state=tab=>tab.evaluate(tab=>{
    const rect=tab.getBoundingClientRect(),reader=tab.closest('#notes-reading, #hint-sketch');let left=0,right=innerWidth,top=0,bottom=innerHeight;
    for(let parent=tab.parentElement;parent;parent=parent.parentElement) {
      const style=getComputedStyle(parent),box=parent.getBoundingClientRect();
      if(/auto|scroll|hidden|clip/.test(style.overflowX)){left=Math.max(left,box.left+parent.clientLeft);right=Math.min(right,box.left+parent.clientLeft+parent.clientWidth);}
      if(/auto|scroll|hidden|clip/.test(style.overflowY)){top=Math.max(top,box.top+parent.clientTop);bottom=Math.min(bottom,box.top+parent.clientTop+parent.clientHeight);}
    }
    return {visible:rect.left>=left-1&&rect.right<=right+1&&rect.top>=top-1&&rect.top<=bottom+1,scrollTop:reader?.scrollTop??0};
  });
  const expectCue=async(tab,directions,scrollTop)=>{
    const after=await state(tab);
    if(Math.abs(after.scrollTop-scrollTop)>1)expect(after.visible).toBe(true);
    if(!after.visible){await expect(page.locator('.keyboard-focus-cue')).toBeHidden();await tab.scrollIntoViewIfNeeded();}
    await expect(page.locator('.keyboard-arrows:visible')).toHaveAttribute('data-directions',directions);
  };
  const check=async group=>{
    const tabs=group.getByRole('tab');expect(await tabs.count()).toBeGreaterThan(1);
    const rows=await tabs.evaluateAll(tabs=>new Set(tabs.map(tab=>Math.round(tab.getBoundingClientRect().top))).size);
    const vertical=rows===await tabs.count(),directions=rows===1?'x':vertical?'y':'xy',forward=vertical?'ArrowDown':'ArrowRight';
    await tabs.first().focus();await page.keyboard.press(forward);
    await expect(tabs.nth(1)).toBeFocused();await expect(tabs.nth(1)).toHaveAttribute('aria-selected','true');
    await expect(group.locator('[role=tab][tabindex="0"]')).toHaveCount(1);
    const panel=page.locator(`#${await tabs.nth(1).getAttribute('aria-controls')}`);await expect(panel).toBeVisible();await expect(panel).toHaveAttribute('aria-labelledby',await tabs.nth(1).getAttribute('id'));
    await expect(page.locator('.keyboard-arrows:visible')).toHaveAttribute('data-directions',directions);
    if(directions==='xy'){
      await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');
      const selected=group.locator('[role=tab][aria-selected="true"]');await expect(selected).toBeFocused();
      expect((await selected.boundingBox()).y).toBeGreaterThan((await tabs.first().boundingBox()).y+2);
    }
    await page.keyboard.press('End');await expect(tabs.last()).toBeFocused();await page.keyboard.press(forward);await expect(tabs.first()).toBeFocused();
    await page.keyboard.press('Tab');expect(await group.evaluate(el=>el.contains(document.activeElement))).toBe(false);
    await page.keyboard.press('Shift+Tab');await expect(tabs.first()).toBeFocused();
    const narrowScroll=(await state(tabs.first())).scrollTop;
    await page.setViewportSize({width:1146,height:850});await expect(group).toHaveAttribute('data-tab-directions','x');
    await expectCue(tabs.first(),'x',narrowScroll);const wideScroll=(await state(tabs.first())).scrollTop;
    await page.setViewportSize({width:320,height:568});await expect(group).toHaveAttribute('data-tab-directions',directions);
    await expectCue(tabs.first(),directions,wideScroll);
  };
  const groups=page.locator('#notes-content .note-choices');expect(await groups.count()).toBeGreaterThan(1);
  for(const group of await groups.all())await check(group);
  expect(await workspace(page)).toEqual(before);
  await ready(page,31);const puzzle=await workspace(page);await page.keyboard.press('h');await page.locator('#hint-more-toggle').click();await page.locator('#hint-sketch-toggle').click();await expect(page.locator('#hint-sketch')).toHaveAttribute('aria-busy','false');
  await check(page.locator('#hint-sketch .note-choices').first());expect(await workspace(page)).toEqual(puzzle);
});
