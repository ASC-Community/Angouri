import { test, expect } from '@playwright/test';

async function ready(page,path='/#level=3&view=flight') {
  await page.goto(path);
  await page.waitForFunction(()=>window.angouri?.state&&document.querySelector('#playground')?.getAttribute('aria-busy')==='false');
}

async function idle(page) {await page.evaluate(()=>window.angouri.whenIdle());}

async function hasVisibleOutline(locator) {
  return locator.evaluate(el=>{
    const style=getComputedStyle(el.matches('.ingredient')?el.querySelector('.ingredient-surface'):el);
    return style.outlineStyle!=='none'&&parseFloat(style.outlineWidth)>0;
  });
}

test('Shift alone toggles shortcut labels while focus, editing and modified keys keep working',async({page})=>{
  await ready(page,'/#level=25');
  const labels=page.locator('.keyboard-focus-cue:visible,.button-hotkey:visible'),launchKey=page.locator('#launch .button-hotkey');
  const initial=await page.evaluate(()=>window.angouri.state);
  await expect(labels).toHaveCount(0);await page.keyboard.press('Shift');await expect(launchKey).toBeVisible();
  await page.keyboard.press('Shift');await expect(labels).toHaveCount(0);
  expect(await page.evaluate(()=>window.angouri.state)).toEqual(initial);
  await page.keyboard.press('Tab');await expect(page.locator('#tab-flight')).toBeFocused();
  expect(await hasVisibleOutline(page.locator('#tab-flight'))).toBe(true);await expect(labels).toHaveCount(0);
  await page.locator('#palette [data-op="A"]').focus();await page.keyboard.press('ArrowUp');await idle(page);
  await expect(page.locator('.part-body')).toBeFocused();expect(await hasVisibleOutline(page.locator('.part-body'))).toBe(true);await expect(labels).toHaveCount(0);
  await page.keyboard.press('Shift');await expect(page.locator('.keyboard-focus-cue:visible kbd:visible')).toHaveText(['Space','⌫']);
  await page.keyboard.down('Shift');await page.keyboard.down('Shift');await expect(launchKey).toBeVisible();await page.keyboard.up('Shift');await expect(labels).toHaveCount(0);
  await page.keyboard.press('Shift');await page.keyboard.press('Shift+Tab');await expect(launchKey).toBeVisible();
  await page.keyboard.press('Control+z');await idle(page);await page.keyboard.press('Control+Shift+z');await idle(page);
  expect(await page.evaluate(()=>window.angouri.state.nodes.map(node=>node.op))).toEqual(['A']);await expect(launchKey).toBeVisible();
  await page.keyboard.press('Shift+Backspace');await idle(page);expect(await page.evaluate(()=>window.angouri.state.nodes)).toEqual([]);await expect(launchKey).toBeVisible();
  await page.keyboard.press('Control+z');await idle(page);
  // Shift used with a pointer gesture is not a standalone press either.
  await page.keyboard.down('Shift');await page.locator('#menu-open').click();await page.keyboard.up('Shift');
  await expect(page.locator('html')).toHaveAttribute('data-shortcut-labels','shown');await expect(labels).toHaveCount(0);
  await page.keyboard.press('Escape');await expect(launchKey).toBeVisible();
  await page.keyboard.press('Shift');await page.keyboard.press('?');
  await expect(page.getByText('In play, press Shift to show or hide shortcuts.',{exact:true})).toBeVisible();
  await expect(page.locator('#help-dialog details')).not.toHaveAttribute('open');
});

test('hiding shortcut labels retains the slider knob focus ring and arrow-key control',async({page})=>{
  await ready(page,'/#level=3&view=flow');await page.keyboard.press('Tab');await page.keyboard.press('Tab');
  const slider=page.locator('#flow-position'),ring=page.locator('.keyboard-knob-ring'),arrows=page.locator('.is-knob .keyboard-horizontal');
  await expect(slider).toBeFocused();await expect(ring).toBeVisible();await expect(arrows).toBeVisible();
  await page.keyboard.press('Shift');await expect(arrows).toBeHidden();await expect(ring).toBeVisible();await expect(slider).toBeFocused();
  const before=await slider.inputValue();await page.keyboard.press('ArrowRight');await expect(slider).not.toHaveValue(before);await expect(ring).toBeVisible();await expect(arrows).toBeHidden();
  await page.keyboard.press('Shift');await expect(arrows).toBeVisible();
});

test('Backspace follows menu Back and Cancel without intercepting text editing',async({page})=>{
  await ready(page);await page.locator('#menu-open').focus();await page.keyboard.press('Space');await page.locator('#settings-open').focus();await page.keyboard.press('Space');
  await expect(page.locator('#settings-dialog [data-back-shortcut] .button-hotkey')).toBeVisible();
  await page.keyboard.press('Backspace');await expect(page.locator('#menu-dialog')).toBeVisible();await expect(page.locator('#settings-open')).toBeFocused();
  await page.keyboard.press('Backspace');await expect(page.locator('dialog[open]')).toHaveCount(0);await expect(page.locator('#menu-open')).toBeFocused();
  await page.keyboard.press('Space');await page.locator('#library-open').focus();await page.keyboard.press('Space');
  const name=page.locator('#seed-name');await name.fill('abc');await page.keyboard.press('Backspace');await expect(name).toHaveValue('ab');await expect(page.locator('#library-dialog')).toBeVisible();
  await expect(page.locator('#library-dialog [data-back-shortcut] .button-hotkey')).toBeHidden();
  await page.locator('#library-dialog [data-back-shortcut]').focus();await page.keyboard.press('Backspace');await expect(page.locator('#menu-dialog')).toBeVisible();
  await page.locator('#settings-open').focus();await page.keyboard.press('Space');await page.locator('#motion-toggle').focus();await page.keyboard.press('Backspace');await expect(page.locator('#menu-dialog')).toBeVisible();
  await page.locator('#settings-open').focus();await page.keyboard.press('Space');await page.locator('#reset-progress-open').focus();await page.keyboard.press('Space');
  await expect(page.locator('#reset-progress-cancel')).toBeFocused();await page.keyboard.press('Backspace');await expect(page.locator('#settings-dialog')).toBeVisible();await expect(page.locator('#reset-progress-open')).toBeFocused();
});

test('a focus badge disappears with its scrolled-out control and returns without moving focus',async({page},testInfo)=>{
  await page.setViewportSize({width:320,height:568});await ready(page,'/#level=25');
  await page.keyboard.press('?');
  const summary=page.locator('#help-dialog summary'),reader=page.locator('#help-dialog .dialog-reading'),cue=page.locator('.keyboard-focus-cue');
  await summary.focus();await page.keyboard.press('Space');await expect(cue).toBeVisible();
  const original=await reader.evaluate(el=>el.scrollTop);
  await reader.evaluate(el=>el.scrollTop=el.scrollHeight);
  await expect.poll(async()=>{
    const control=await summary.boundingBox(),pane=await reader.boundingBox();return control.y+control.height<pane.y;
  }).toBe(true);
  await expect(summary).toBeFocused();await expect(cue).toBeHidden();
  expect(await page.evaluate(()=>[scrollX,scrollY])).toEqual([0,0]);
  await page.screenshot({path:testInfo.outputPath('help-scrolled-focus.png')});
  await reader.evaluate((el,top)=>el.scrollTop=top,original);await expect(cue).toBeVisible();await expect(summary).toBeFocused();
  const control=await summary.boundingBox(),badge=await cue.boundingBox();expect(badge.y).toBeCloseTo(control.y-9,0);
  await page.keyboard.press('Backspace');await expect(page.locator('#menu-dialog')).toBeVisible();
});

test('arrival leaves controls unselected and the first Tab shows keyboard focus',async({page})=>{
  // Native Safari can nominate a tabbable page target while the asynchronous
  // game is still arriving. Reproduce that timing independently of the engine.
  await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>document.querySelector('#scene')?.focus(),{once:true}));
  for(const path of ['/#level=1','/#level=54&view=flight']) {
    await ready(page,path);
    expect(await page.evaluate(()=>document.activeElement===document.body)).toBe(true);
    await expect(page.locator('button:focus-visible,a:focus-visible')).toHaveCount(0);
  }
  await page.keyboard.press('Tab');await expect(page.locator('#tab-flight')).toBeFocused();
  for(const [opener,id,back] of [['ideas-open','ideas-dialog','Back to puzzle'],['menu-open','menu-dialog','Back to game']]) {
    await page.locator(`#${opener}`).click();const dialog=page.locator(`#${id}`);
    await expect(dialog).toBeFocused();expect(await dialog.evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('none');
    await expect(dialog.locator('button:focus-visible')).toHaveCount(0);
    await page.keyboard.press('Tab');const first=dialog.getByRole('button',{name:back,exact:true});
    await expect(first).toBeFocused();expect(await first.evaluate(el=>el.matches(':focus-visible')&&getComputedStyle(el).outlineStyle!=='none')).toBe(true);
    await page.keyboard.press('Escape');const restored=page.locator(`#${opener}`);await expect(restored).toBeFocused();
    expect(await hasVisibleOutline(restored)).toBe(true);
  }
});

test('first Tab starts directly at visible play controls without a skip link or canvas stop',async({page})=>{
  for(const [path,target,next] of [
    ['/#level=1','#palette [data-op="H"]','#palette [data-op="A"]'],
    ['/#level=2','#palette [data-op="H"]','#palette [data-op="A"]'],
    ['/#level=3&view=flow','#tab-flow','#flow-position']
  ]) {
    await page.goto('/about/');
    await ready(page,path);const url=page.url();
    await expect(page.locator('a.skip')).toHaveCount(0);
    await page.keyboard.press('Tab');await expect(page.locator(target)).toBeFocused();
    expect(await hasVisibleOutline(page.locator(target))).toBe(true);expect(page.url()).toBe(url);
    await page.keyboard.press('Tab');await expect(page.locator(next)).toBeFocused();
  }
});

test('the complete game Tab cycle has no empty page stop in either direction',async({page})=>{
  await page.setViewportSize({width:1146,height:850});
  const choices=['#palette [data-op="H"]','#palette [data-op="A"]'];
  const header=['a.brand','#ideas-open','#menu-open'];
  const recipe=['#construction [data-empty="0"]','#construction [data-empty="1"]',...choices,'#launch',...header];
  for(const [path,order] of [
    ['/#level=1',[...choices,'a.brand','#menu-open']],
    ['/#level=2',[...choices,'#palette [data-op="N"]','a.brand','#menu-open']],
    ['/#level=3&view=flight',['#tab-flight',...recipe]],
    ['/#level=3&view=function',['#tab-function',...recipe]],
    ['/#level=3&view=flow',['#tab-flow','#flow-position',...recipe]]
  ]) {
    await page.goto('/about/');await ready(page,path);
    // Firefox's comparison rows are slightly taller. Include a reader when
    // its actual content overflows, independently of its assigned tabindex.
    const readers=path.includes('function')?['.final-equation','.value-table tbody']:path.includes('flow')?['.flow-goals','.flow-line']:[];
    const overflowing=[];
    for(const selector of readers)if(await page.locator(selector).evaluate(el=>el.scrollHeight>el.clientHeight+1||el.scrollWidth>el.clientWidth+1))overflowing.push(selector);
    order.splice(path.includes('flow')?2:1,0,...overflowing);
    for(const selector of [...order,...order]) {
      await page.keyboard.press('Tab');await expect(page.locator(selector),`${path}: ${selector}`).toBeFocused();
      expect(await page.evaluate(()=>document.hasFocus()&&document.activeElement!==document.body)).toBe(true);
    }
    await page.keyboard.press('Tab');await expect(page.locator(order[0])).toBeFocused();
    for(const selector of [...order].reverse()) {
      await page.keyboard.press('Shift+Tab');await expect(page.locator(selector),`${path} backwards: ${selector}`).toBeFocused();
      expect(await page.evaluate(()=>document.hasFocus()&&document.activeElement!==document.body)).toBe(true);
    }
    expect(await page.evaluate(()=>[scrollY,document.documentElement.scrollHeight-innerHeight])).toEqual([0,0]);
  }
});

test('game Tab boundaries follow enabled controls and leave browser shortcuts available',async({page})=>{
  await ready(page,'/#level=1');
  await page.evaluate(()=>document.addEventListener('keydown',event=>{
    if(event.key==='Tab'&&(event.ctrlKey||event.altKey||event.metaKey))window.modifiedTabPrevented=event.defaultPrevented;
  }));
  await page.keyboard.press('Control+Tab');expect(await page.evaluate(()=>window.modifiedTabPrevented)).toBe(false);
  await page.keyboard.press('Tab');await expect(page.locator('#palette [data-op="H"]')).toBeFocused();
  const brand=page.locator('a.brand'),add=page.locator('#palette [data-op="A"]');
  await add.focus();await page.keyboard.press('Tab');await expect(brand).toBeFocused();
  await page.keyboard.press('Shift+Tab');await expect(add).toBeFocused();
  await page.locator('#palette [data-op="H"]').click();await idle(page);
  await brand.focus();await page.keyboard.press('Shift+Tab');await expect(page.locator('#launch')).toBeFocused();
  expect(await page.locator('#launch').evaluate(el=>[
    {key:'Tab',ctrlKey:true},{key:'Tab',altKey:true},{key:'Tab',metaKey:true},
    {key:'F6'},{key:'l',ctrlKey:true},{key:'l',metaKey:true}
  ].every(keys=>el.dispatchEvent(new KeyboardEvent('keydown',{...keys,bubbles:true,cancelable:true}))))).toBe(true);
  await page.keyboard.press('Tab');await expect(brand).toBeFocused();
  await page.locator('#menu-open').click();await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:'Back to game',exact:true})).toBeFocused();
  await page.keyboard.press('Shift+Tab');await expect(page.locator('#menu-dialog a[href="./about/"]')).toBeFocused();
});

test('pointer dialog return keeps focus without a keyboard ring',async({page})=>{
  await ready(page);
  const notes=page.locator('#ideas-open');
  await notes.click();
  await page.getByRole('button',{name:'Back to puzzle',exact:true}).click();
  await expect(notes).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-focus-modality','pointer');
  expect(await hasVisibleOutline(notes)).toBe(false);

  await page.keyboard.press('Space');
  const back=page.getByRole('button',{name:'Back to puzzle',exact:true});
  await expect(back).toBeFocused();
  expect(await hasVisibleOutline(back)).toBe(true);
  await page.keyboard.press('Enter');
  await expect(notes).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-focus-modality','keyboard');
  expect(await hasVisibleOutline(notes)).toBe(true);

  await notes.click();
  await page.getByRole('button',{name:'Back to puzzle',exact:true}).click();
  await expect(notes).toBeFocused();
  expect(await hasVisibleOutline(notes)).toBe(false);

  await page.locator('#menu-open').click();await page.locator('#settings-open').click();
  const checkbox=page.locator('#motion-toggle');await checkbox.focus();await page.keyboard.press('Shift');
  expect(await hasVisibleOutline(checkbox)).toBe(true);
  await checkbox.click();expect(await hasVisibleOutline(checkbox)).toBe(false);
});

test('keyboard-opened menu pages focus Back immediately and confirmations retain Cancel',async({page})=>{
  await ready(page,'/#level=25');
  for(const opener of ['ideas-open','hints-open','menu-open']) {
    const button=page.locator(`#${opener}`);await button.focus();await page.keyboard.press('Space');
    const dialog=page.locator('dialog[open]'),back=dialog.locator('.dialog-top button').first();
    await expect(back).toBeFocused();expect(await hasVisibleOutline(back)).toBe(true);
    await page.keyboard.press('Tab');await expect(back).not.toBeFocused();
    await page.keyboard.press('Shift+Tab');await expect(back).toBeFocused();
    await page.keyboard.press('Escape');await expect(button).toBeFocused();
  }
  await page.keyboard.press('Space');await expect(page.locator('#menu-dialog .dialog-top button')).toBeFocused();
  for(const opener of ['puzzles-open','library-open','settings-open','help-open','menu-version']) {
    const tile=page.locator(`#${opener}`);await tile.focus();await page.keyboard.press('Enter');
    const back=page.locator('dialog[open] .dialog-top button').first();await expect(back).toBeFocused();
    await page.keyboard.press('Enter');await expect(tile).toBeFocused();
  }
  await page.locator('#settings-open').focus();await page.keyboard.press('Enter');
  await page.locator('#reset-progress-open').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#reset-progress-cancel')).toBeFocused();
  await page.keyboard.press('Enter');await page.keyboard.press('Escape');
  await page.locator('#menu-open').click();await expect(page.locator('#menu-dialog')).toBeFocused();
  await expect(page.locator('#menu-dialog button:focus-visible')).toHaveCount(0);
});

test('pointer puzzle navigation returns to a visible play control without its keyboard ring',async({page})=>{
  await ready(page);
  await page.locator('#menu-open').click();
  await page.getByRole('button',{name:'Puzzles',exact:true}).click();
  await page.getByRole('button',{name:/Puzzle 1\.1:/}).click();
  await page.waitForFunction(()=>window.angouri?.state?.sourceId===1&&document.querySelector('#playground')?.getAttribute('aria-busy')==='false');
  const choice=page.locator('#palette [data-op="H"]');
  await expect(choice).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-focus-modality','pointer');
  expect(await hasVisibleOutline(choice)).toBe(false);

  await page.keyboard.press('ArrowDown');
  await expect(choice).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-focus-modality','keyboard');
  expect(await hasVisibleOutline(choice)).toBe(true);
});

test('pointer modality keeps field focus and suppresses garden keyboard decoration',async({page})=>{
  await ready(page,'/#level=43&view=flight');
  const field=page.locator('[data-circle-value]').first();
  await field.click();
  await expect(field).toBeFocused();
  expect(await hasVisibleOutline(field)).toBe(true);

  await ready(page,'/#level=82&view=flight');
  await page.locator('#picture-open').click();
  const piece=page.locator('[data-garden-piece]').first();
  await expect(piece).toBeVisible();
  await piece.focus();
  const path=piece.locator('.garden-focus-path').first(),label=piece.locator('.garden-piece-label rect');
  await expect(page.locator('html')).toHaveAttribute('data-focus-modality','pointer');
  await expect(path).toHaveCSS('opacity','0');
  await expect(label).toHaveCSS('stroke-width','1px');

  await page.keyboard.press('ArrowRight');
  await expect(page.locator('html')).toHaveAttribute('data-focus-modality','keyboard');
  await expect(path).toHaveCSS('opacity','0.65');
  await expect(label).toHaveCSS('stroke-width','2px');
});

test('Tab during loading remains deliberate focus after arrival',async({page})=>{
  await page.route('**/engine-worker.js',async route=>{
    await new Promise(resolve=>setTimeout(resolve,750));
    await route.continue();
  });
  await page.goto('/#level=3&view=flight');
  await expect(page.locator('#playground')).toHaveAttribute('aria-busy','true');
  await page.keyboard.press('Tab');
  const menu=page.locator('#menu-open');
  await expect(menu).toBeFocused();
  await page.waitForFunction(()=>window.angouri?.state&&document.querySelector('#playground')?.getAttribute('aria-busy')==='false');
  await expect(menu).toBeFocused();
  expect(await hasVisibleOutline(menu)).toBe(true);
});

test('loading enables a populated puzzle list and preserves the open menu and its focus',async({page})=>{
  test.setTimeout(90000);
  await ready(page);
  const saved=await page.evaluate(()=>localStorage.getItem('angouri:vine:v1:progress'));
  for(const entry of [
    {path:'/',dialog:'menu-dialog'},
    {path:'/#level=54',destination:'help-open',dialog:'help-dialog'},
    {path:'/',saved,destination:'library-open',dialog:'library-dialog'}
  ]) {
    await page.goto('/about/');
    await page.evaluate(saved=>{localStorage.clear();if(saved)localStorage.setItem('angouri:vine:v1:progress',saved);},entry.saved);
    let release;const gate=new Promise(resolve=>{release=resolve;});
    const hold=async route=>{await gate;await route.continue();};
    await page.route('**/engine-worker.js',hold);
    await page.goto(entry.path,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.angouri);
    await expect(page.locator('#playground')).toHaveAttribute('aria-busy','true');
    await page.locator('#menu-open').click();
    await expect(page.locator('#puzzles-open')).toBeDisabled();
    await expect(page.locator('#level-nav [data-level]')).toHaveCount(0);
    if(entry.destination)await page.locator(`#${entry.destination}`).click();
    const dialog=page.locator(`#${entry.dialog}`),back=dialog.locator('.dialog-top button').first();
    await page.keyboard.press('Tab');await expect(back).toBeFocused();
    release();
    await page.waitForFunction(()=>window.angouri?.state&&document.querySelector('#playground')?.getAttribute('aria-busy')==='false');
    await expect(dialog).toBeVisible();await expect(back).toBeFocused();
    await expect(page.locator('#puzzles-open')).toBeEnabled();
    expect(await page.locator('#level-nav [data-level]').count()).toBeGreaterThan(0);
    expect(await hasVisibleOutline(back)).toBe(true);
    await page.unroute('**/engine-worker.js',hold);
    await page.keyboard.press('Escape');
  }
});

test('Save and its name field keep complete focus rings inside the dialog scroller',async({page},testInfo)=>{
  await ready(page);
  for(const viewport of [{width:1146,height:850},{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(viewport);
    await page.locator('#menu-open').click();await page.locator('#library-open').click();
    const field=page.locator('#seed-name'),save=page.locator('#favorite-save');
    await field.click();
    for(const control of [field,save]) {
      if(control===save)await page.keyboard.press('Tab');
      await expect(control).toBeFocused();expect(await hasVisibleOutline(control)).toBe(true);
      const contained=await control.evaluate(el=>{
        const r=el.getBoundingClientRect(),panel=el.closest('.dialog-content'),clip=panel.getBoundingClientRect(),style=getComputedStyle(el);
        const spread=parseFloat(style.outlineWidth)+parseFloat(style.outlineOffset);
        return r.left-spread>=clip.left&&r.right+spread<=clip.left+panel.clientWidth&&r.top-spread>=clip.top&&r.bottom+spread<=clip.top+panel.clientHeight;
      });expect(contained).toBe(true);
      await page.screenshot({path:testInfo.outputPath(`save-${control===field?'field':'button'}-${viewport.width}.png`)});
    }
    await page.keyboard.press('Escape');
  }
});

test('menu Tab cycles wrap directly between visible controls in both directions',async({page})=>{
  await ready(page);
  for(const [destination,buttons] of [[undefined,11],['library-open',6],['settings-open',5],['help-open',3],['puzzles-open',19]]) {
    await page.locator('#menu-open').click();if(destination)await page.locator(`#${destination}`).click();
    await page.keyboard.press('Tab');
    const count=buttons+await page.locator('dialog[open] .dialog-reading[tabindex="0"]').count();
    const first=await page.evaluateHandle(()=>document.activeElement);
    const seen=new Set();
    for(let i=0;i<count;i++) {
      const current=await page.evaluate(()=>{const el=document.activeElement,s=getComputedStyle(el);return {control:el.matches('button,a[href],input,select,textarea,summary,[tabindex]')&&el.tabIndex>=0,inside:!!el.closest('dialog[open]'),ring:s.outlineStyle!=='none',key:el.id||el.getAttribute('aria-label')||el.textContent.trim()};});
      expect(current.control&&current.inside&&current.ring,`${destination||'main'} step ${i}: ${JSON.stringify(current)}`).toBe(true);expect(seen.has(current.key)).toBe(false);seen.add(current.key);
      await page.keyboard.press('Tab');
    }
    expect(await first.evaluate(el=>el===document.activeElement)).toBe(true);
    if(destination==='settings-open'){expect(seen.has('motion-toggle')).toBe(true);expect(seen.has('character-shortcuts')).toBe(true);}
    for(let i=0;i<count;i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await page.evaluate(()=>document.activeElement!==document.querySelector('dialog[open]')&&!!document.activeElement.closest('dialog[open]'))).toBe(true);
    }
    expect(await first.evaluate(el=>el===document.activeElement)).toBe(true);
    await page.keyboard.press('Escape');
  }
});

test('chapter and puzzle focus rings fit their cards and pointer interaction hides them',async({page},testInfo)=>{
  for(const size of [{width:1146,height:850},{width:320,height:568},{width:844,height:390}]) {
    await page.goto('/about/');await ready(page);
    await page.setViewportSize(size);await page.locator('#menu-open').click();await page.locator('#puzzles-open').click();
    for(let i=0;i<3;i++)await page.keyboard.press('Tab');
    const chapter=page.locator('.chapter-group>summary').first();await expect(chapter).toBeFocused();
    for(const key of [undefined,'Enter']) {
      if(key)await page.keyboard.press(key);
      expect(await hasVisibleOutline(chapter)).toBe(true);
      const spread=await chapter.evaluate(el=>{const s=getComputedStyle(el);return parseFloat(s.outlineWidth)+parseFloat(s.outlineOffset);});
      expect(spread).toBeLessThanOrEqual(0);
      await page.screenshot({path:testInfo.outputPath(`chapter-${size.width}-${key?'collapsed':'expanded'}.png`)});
    }
    await chapter.click();await expect(chapter).toBeFocused();expect(await hasVisibleOutline(chapter)).toBe(false);
    await expect(page.locator('.chapter-group').first()).toHaveAttribute('open','');
    await page.keyboard.press('Tab');
    const puzzle=page.locator('.chapter-group[open] .level-option').first();await expect(puzzle).toBeFocused();
    expect(await hasVisibleOutline(puzzle)).toBe(true);
    expect(await puzzle.evaluate(el=>parseFloat(getComputedStyle(el).outlineOffset))).toBeLessThan(0);
    await page.locator('#puzzles-title').click();expect(await hasVisibleOutline(puzzle)).toBe(false);
    await page.keyboard.press('Escape');
  }
});

test('view tabs follow the focused tab while Tab and Shift+Tab keep native order',async({page})=>{
  await ready(page);
  const flight=page.getByRole('tab',{name:'Flight',exact:true});
  const func=page.getByRole('tab',{name:'Equation',exact:true});
  const flow=page.getByRole('tab',{name:'Flow',exact:true});

  await func.focus();
  await page.keyboard.press('ArrowRight');
  await expect(flow).toBeFocused();
  await expect(flow).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#scene')).toHaveAttribute('aria-labelledby','tab-flow');

  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#menu-open')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(flow).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#flow-position')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(flow).toBeFocused();

  await page.keyboard.press('Home');
  await expect(flight).toBeFocused();
  await expect(flight).toHaveAttribute('aria-selected','true');
});

test('undoing a focused block keeps focus in the recipe for continued editing',async({page})=>{
  await ready(page);
  await page.getByRole('button',{name:/Place Halve/}).focus();
  await page.keyboard.press('Space');
  await idle(page);

  const placed=page.getByRole('button',{name:/Halve, slot 1/});
  await placed.focus();
  await page.keyboard.press('Control+z');
  await idle(page);
  await expect(page.getByRole('button',{name:'Empty slot 1'})).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:'Empty slot 2'})).toBeFocused();
  await page.keyboard.press('Control+Shift+z');
  await idle(page);
  await expect(page.getByRole('button',{name:'Empty slot 2'})).toBeFocused();
  await page.keyboard.press('Tab');
  const add=page.getByRole('button',{name:/Place Add one/});
  await expect(add).toBeFocused();
  await expect(add).toHaveAttribute('aria-describedby',/\bblock-tooltip\b/);
  await expect(page.getByRole('tooltip')).toContainText('Add one');
});

test('native dialog Escape and menu Back restore the documented openers',async({page})=>{
  await ready(page);
  const menu=page.getByRole('button',{name:'Menu',exact:true});
  await menu.focus();
  await page.keyboard.press('Space');
  const settings=page.getByRole('button',{name:'Settings',exact:true});
  await settings.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog',{name:'Settings'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();

  await page.keyboard.press('Space');
  await settings.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'Back to menu',exact:true}).press('Enter');
  await expect(page.getByRole('dialog',{name:'Menu'})).toBeVisible();
  await expect(settings).toBeFocused();
});
