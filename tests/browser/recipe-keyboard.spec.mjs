import {test,expect} from '@playwright/test';

const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
async function ready(page,id=25) {
  await page.goto('/about/');await page.evaluate(()=>localStorage.clear());
  await page.goto(`/#level=${id}&view=flight`);
  await page.waitForFunction(()=>window.angouri?.state&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
}
const settled=page=>page.waitForFunction(()=>[...document.querySelectorAll('.recipe-part')].every(el=>el.getAnimations().every(a=>a.playState==='finished')));
const cue=page=>page.locator('.keyboard-arrows:visible');

test('Delete clears the focused slot while Down returns focus to the stack',async({page})=>{
  await ready(page);await page.locator('#palette [data-op="A"]').focus();await page.keyboard.press('ArrowUp');await idle(page);
  await page.keyboard.press('ArrowRight');await idle(page);
  const id=await page.evaluate(()=>window.angouri.state.nodes[0].id);
  await page.keyboard.press('Delete');await idle(page);
  await expect(page.locator('[data-empty="1"]')).toBeFocused();expect(await page.evaluate(()=>window.angouri.state.nodes)).toEqual([]);
  await page.keyboard.press('Control+z');await idle(page);await expect(page.locator(`[data-stage="${id}"]`)).toBeFocused();
  await page.keyboard.press('Backspace');await idle(page);await expect(page.locator('[data-empty="1"]')).toBeFocused();
  await page.keyboard.press('Control+z');await idle(page);await page.keyboard.press('ArrowDown');await idle(page);
  await expect(page.locator('#palette [data-op="A"]')).toBeFocused();expect(await page.evaluate(()=>window.angouri.state.nodes)).toEqual([]);
});

test('Shift Delete restarts only the current recipe, remains undoable and leaves text editing alone',async({page})=>{
  await ready(page);
  for(const op of ['A','H']){await page.locator(`#palette [data-op="${op}"]`).focus();await page.keyboard.press('ArrowUp');await idle(page);}
  const before=await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}));
  for(const key of ['Shift+Delete','Shift+Backspace']) {
    await expect(page.locator('#reset .button-hotkey')).toBeVisible();await expect(page.locator('#reset .button-hotkey')).toHaveText('⇧Del');
    await page.keyboard.press(key);await idle(page);
    expect(await page.evaluate(()=>window.angouri.state.nodes)).toEqual([]);await expect(page.locator('#reset .button-hotkey')).toBeHidden();
    expect(await page.evaluate(()=>window.angouri.history.undo)).toBe(before.history.undo+1);
    await page.keyboard.press('Control+z');await idle(page);
    expect(await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots}))).toEqual({state:before.state,slots:before.slots});
  }
  await page.locator('#menu-open').click();await page.locator('#library-open').click();
  await page.locator('#seed-name').fill('typing hn');await page.keyboard.press('Shift+Delete');await idle(page);
  expect(await page.evaluate(()=>window.angouri.state)).toEqual(before.state);
  await expect(page.locator('#library-dialog')).toBeVisible();
});

test('H and N open available references directly without revealing spoilers or editing the recipe',async({page})=>{
  await ready(page);
  await page.locator('#palette [data-op="A"]').focus();await page.keyboard.press('Space');await idle(page);
  const before=await page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history}));
  await expect(page.locator('#hints-open .button-hotkey')).toBeVisible();await expect(page.locator('#ideas-open .button-hotkey')).toBeVisible();
  await page.keyboard.press('h');await expect(page.locator('#hints-dialog')).toBeVisible();await expect(page.locator('#hints-dialog .dialog-top button')).toBeFocused();
  await expect(page.locator('#hint-more-toggle')).toBeVisible();await expect(page.locator('#hint-more-toggle')).toHaveAttribute('aria-expanded','false');
  await page.keyboard.press('n');await expect(page.locator('#ideas-dialog')).not.toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#hints-open')).toBeFocused();
  await page.keyboard.press('n');await expect(page.locator('#ideas-dialog')).toBeVisible();await expect(page.locator('#ideas-dialog .dialog-top button')).toBeFocused();
  await page.keyboard.press('Escape');await expect(page.locator('#ideas-open')).toBeFocused();
  expect(await page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history}))).toEqual(before);
  await ready(page,1);await page.keyboard.press('h');await page.keyboard.press('n');await expect(page.locator('dialog[open]')).toHaveCount(0);
  await ready(page,3);await page.keyboard.press('h');await expect(page.locator('dialog[open]')).toHaveCount(0);await page.keyboard.press('n');await expect(page.locator('#ideas-dialog')).toBeVisible();
});

test('quick-key opt-out preserves defaults, Tab navigation and modified shortcuts',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await ready(page);
  const buttons=()=>page.locator('.game-shell button').evaluateAll(es=>es.filter(e=>!e.disabled&&e.getClientRects().length&&e.tabIndex>=0).map(e=>e.id||e.dataset.op||e.dataset.empty));
  const before=await buttons();
  await page.locator('#menu-open').click();await page.locator('#settings-open').click();await expect(page.locator('#character-shortcuts')).not.toBeChecked();await expect(page.locator('#motion-toggle')).not.toBeChecked();await page.locator('#character-shortcuts').check();await page.keyboard.press('Escape');
  expect(await buttons()).toEqual(before);
  await page.keyboard.press('h');await page.keyboard.press('n');await page.keyboard.press('?');await page.keyboard.press('x');await expect(page.locator('dialog[open]')).toHaveCount(0);await expect(page.locator('#tab-flight')).toHaveAttribute('aria-selected','true');
  await page.keyboard.press('1');await idle(page);expect(await page.evaluate(()=>window.angouri.state.nodes)).toEqual([]);await expect(page.locator('[data-character]:visible')).toHaveCount(0);await expect(page.locator('#ideas-open')).not.toHaveAttribute('aria-keyshortcuts');
  await page.locator('#ideas-open').focus();await page.keyboard.press('Space');await expect(page.locator('#ideas-dialog')).toBeVisible();await page.keyboard.press('Escape');
  await page.locator('#tab-function').click();await page.reload();await page.waitForFunction(()=>window.angouri?.state&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
  await page.keyboard.press('n');await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.locator('#palette [data-op="A"]').focus();await page.keyboard.press('ArrowUp');await idle(page);await page.keyboard.press('Shift+Delete');await idle(page);
  expect(await page.evaluate(()=>window.angouri.state.nodes)).toEqual([]);await page.keyboard.press('Control+z');await idle(page);expect(await page.evaluate(()=>window.angouri.state.nodes.map(n=>n.op))).toEqual(['A']);
  await page.locator('#menu-open').click();await page.locator('#settings-open').click();await page.locator('#character-shortcuts').uncheck();await page.keyboard.press('Escape');
  await page.keyboard.press('n');await expect(page.locator('#ideas-dialog')).toBeVisible();
});

test('Z X C switch views directly while preserving the focused editor and recipe',async({page})=>{
  await ready(page);
  await page.locator('#palette [data-op="A"]').focus();await page.keyboard.press('ArrowUp');await idle(page);
  const block=page.locator('.part-body'),before=await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}));
  for(const [key,view] of [['c','flow'],['x','function'],['z','flight']]) {
    await page.keyboard.press(key);await expect(page.locator(`#tab-${view}`)).toHaveAttribute('aria-selected','true');await expect(block).toBeFocused();
    await expect(page.locator(`#tab-${view} .button-hotkey`)).toHaveText(key.toUpperCase());await expect(page.locator(`#tab-${view} .button-hotkey`)).toBeVisible();
    expect(await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}))).toEqual(before);
  }
  await page.locator('#tab-flight').focus();await page.keyboard.press('x');await expect(page.locator('#tab-function')).toBeFocused();
  await page.locator('#menu-open').click();await page.locator('#library-open').click();await page.locator('#seed-name').fill('zxc');await page.keyboard.press('z');await expect(page.locator('#tab-function')).toHaveAttribute('aria-selected','true');
  await ready(page,1);await page.keyboard.press('x');await expect(page.locator('#flight-svg')).toBeVisible();await expect(page.locator('.view-tabs')).toBeHidden();
});

test('number shortcuts follow stable palette positions, chosen slots and return controls',async({page})=>{
  await ready(page,3);
  const ops=await page.locator('#palette [data-op]').evaluateAll(es=>es.map(e=>e.dataset.op));
  await page.keyboard.press('1');await idle(page);await expect(page.locator('.part-body')).toBeFocused();
  expect(await page.evaluate(()=>window.angouri.state.nodes.map(n=>n.op))).toEqual([ops[0]]);
  await expect(page.locator('#palette [data-op]').first()).toBeDisabled();await expect(page.locator('#palette [data-op]').last().locator('.button-hotkey')).toHaveText('2');
  await page.keyboard.press('1');await idle(page);expect(await page.evaluate(()=>window.angouri.state.nodes.length)).toBe(1);
  await page.keyboard.press('2');await idle(page);expect(await page.evaluate(()=>window.angouri.state.nodes.map(n=>n.op))).toEqual(ops);

  await ready(page,25);await page.locator('[data-empty="2"]').focus();await page.keyboard.press('Space');await page.keyboard.press('2');await idle(page);
  const id=await page.evaluate(()=>window.angouri.state.nodes[0].id);await expect(page.locator(`[data-stage="${id}"]`)).toBeFocused();expect(await page.evaluate(()=>window.angouri.slots.indexOf(window.angouri.state.nodes[0].id))).toBe(2);
  await page.keyboard.press('Space');await expect(page.locator('#palette [data-op="A"]')).toHaveAttribute('data-return',id);
  await page.keyboard.press('2');await idle(page);expect(await page.evaluate(()=>window.angouri.state.nodes)).toEqual([]);await expect(page.locator('#palette [data-op="A"]')).toBeFocused();
  await page.keyboard.press('Control+z');await idle(page);expect(await page.evaluate(()=>window.angouri.slots.indexOf(window.angouri.state.nodes[0].id))).toBe(2);

  await ready(page,3);await page.locator('#menu-open').click();await page.locator('#nav-create').click();await idle(page);
  const all=await page.locator('#palette [data-op]').evaluateAll(es=>es.map(e=>e.dataset.op));expect(all).toHaveLength(9);
  for(let index=0;index<all.length;index++){await page.keyboard.press(String(index+1));await idle(page);await expect(page.locator('.part-body').last()).toBeFocused();}
  expect(await page.evaluate(()=>window.angouri.state.nodes.map(n=>n.op))).toEqual(all);
  await ready(page,1);await page.keyboard.press('1');await idle(page);await expect(page.locator('#palette [data-op="H"]')).toBeFocused();expect(await page.evaluate(()=>window.angouri.state.nodes.map(n=>n.op))).toEqual(['H']);
});

test('play controls do not intercept assistive modifier combinations or composition',async({page})=>{
  for(const id of [25,43]) {
    await ready(page,id);
    if(id===25){await page.locator('#palette [data-op="A"]').focus();await page.keyboard.press('ArrowUp');await idle(page);}
    else await page.locator('[data-circle-handle]').first().focus();
    const before=await page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history}));
    const prevented=await page.evaluate(()=>{
      const events=[{key:'z',ctrlKey:true,altKey:true},{key:'ArrowRight',ctrlKey:true,altKey:true},{key:'ArrowLeft',altKey:true},{key:'ArrowDown',metaKey:true},{key:'Delete',ctrlKey:true,shiftKey:true},{key:'Enter',altKey:true},{key:'h',altKey:true},{key:'n',isComposing:true}];
      return events.map(options=>{const event=new KeyboardEvent('keydown',{...options,bubbles:true,cancelable:true});document.activeElement.dispatchEvent(event);return event.defaultPrevented;});
    });
    expect(prevented).toEqual(Array(prevented.length).fill(false));await idle(page);
    expect(await page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history}))).toEqual(before);
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  }
});

test('Enter throws without editing, success focuses Next for Space, and misses keep editing focus',async({page})=>{
  for(const view of ['flight','function','flow']) {
    await ready(page,3);await page.locator(`#tab-${view}`).click();
    for(const op of ['A','H']){await page.locator(`#palette [data-op="${op}"]`).focus();await page.keyboard.press('Space');await idle(page);}
    const before=await page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history}));
    expect(await page.evaluate(()=>window.angouri.result.solved)).toBe(true);
    await page.locator('.part-body').last().focus();await page.keyboard.press('Enter');
    await expect(page.locator('#launch')).toBeFocused();await expect(page.locator('#launch')).toHaveAttribute('data-action','continue');
    await expect(page.locator('#launch .button-hotkey')).toHaveText('Space');await expect(page.locator('#launch .button-hotkey')).toBeVisible();
    await expect(page.locator('#rethrow .button-hotkey')).toHaveText('Enter');await expect(page.locator('#rethrow .button-hotkey')).toBeVisible();
    expect(await page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history}))).toEqual(before);
    await page.keyboard.down('Enter');await page.keyboard.down('Enter');await page.keyboard.up('Enter');
    expect(await page.evaluate(()=>window.angouri.state.sourceId)).toBe(3);await expect(page.locator('#launch')).toBeFocused();
    await page.keyboard.press('Space');await idle(page);expect(await page.evaluate(()=>window.angouri.state.sourceId)).toBe(24);
  }
  await ready(page,1);const add=page.locator('#palette [data-op="A"]');await add.focus();await page.keyboard.press('Space');await idle(page);
  const before=await page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history}));
  await page.keyboard.press('Enter');await expect(add).toBeFocused();await expect(page.locator('#launch')).toHaveAttribute('data-action','throw');
  expect(await page.evaluate(()=>window.angouri.flight.phase)).toBe('landed');
  expect(await page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history}))).toEqual(before);
});

test('moving focus during an Enter throw cancels the automatic Next handoff',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await ready(page,1);
  const half=page.locator('#palette [data-op="H"]');await half.focus();await page.keyboard.press('Space');await idle(page);
  await page.keyboard.press('Enter');await page.waitForFunction(()=>window.angouri.flight.phase==='flying');
  await page.keyboard.press('Tab');const chosen=await page.evaluate(()=>document.activeElement.dataset.op);
  await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
  await expect(page.locator(`#palette [data-op="${chosen}"]`)).toBeFocused();await expect(page.locator('#launch')).toHaveAttribute('data-action','continue');
  // Next remains available during a rethrow, but Enter must still respect
  // the disabled Rethrow action instead of restarting its animation.
  await page.keyboard.press('Enter');await page.waitForFunction(()=>window.angouri.flight.phase==='flying');
  await page.keyboard.press('Enter');expect(await page.evaluate(()=>window.angouri.flight.phase)).toBe('flying');
});

test('compact keycaps retain assigned positions and only show available keyboard actions',async({page},testInfo)=>{
  for(const size of [{width:1146,height:850},{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(size);await ready(page);
    await expect(page.locator('.keyboard-focus-cue:visible,.button-hotkey:visible')).toHaveCount(0);
    const add=page.locator('#palette [data-op="A"]');await add.focus();await page.keyboard.press('Shift');
    await expect(cue(page).locator('kbd:visible')).toHaveText(['Space']);
    await expect(cue(page)).toHaveAttribute('data-directions','up');
    await expect(page.locator('#undo .button-hotkey')).toBeHidden();await expect(page.locator('#redo .button-hotkey')).toBeHidden();
    await page.keyboard.press('ArrowUp');await idle(page);
    const block=page.locator('.part-body');await expect(block).toBeFocused();
    await expect(cue(page).locator('kbd:visible')).toHaveText(['Space','Del']);
    await expect(cue(page)).toHaveAttribute('data-directions','xdown');
    await expect(block).toHaveAttribute('aria-describedby','block-keyboard-help');
    await expect(page.locator('#block-tooltip')).toBeHidden();
    await expect(page.locator('#launch .button-hotkey')).toHaveText('Enter');await expect(page.locator('#launch .button-hotkey')).toBeVisible();
    await expect(page.locator('#undo .button-hotkey')).toBeVisible();await expect(page.locator('#undo .button-hotkey')).toHaveText(/⌘Z|Ctrl Z/);
    const boxes=await cue(page).evaluate(el=>({control:document.activeElement.getBoundingClientRect().toJSON(),caps:[...el.children].filter(e=>!e.hidden).map(e=>e.getBoundingClientRect().toJSON())}));
    expect(boxes.caps).toHaveLength(3);
    const [space,arrows,del]=boxes.caps,r=boxes.control;
    expect(Math.abs(space.left-(r.left-6))).toBeLessThan(1.1);
    expect(Math.abs(arrows.left+arrows.width/2-(r.left+r.width/2))).toBeLessThan(1.1);
    expect(Math.abs(del.right-(r.right+6))).toBeLessThan(1.1);
    expect(space.right+1).toBeLessThanOrEqual(arrows.left);expect(arrows.right+1).toBeLessThanOrEqual(del.left);
    for(const cap of boxes.caps){expect(cap.top).toBeGreaterThanOrEqual(0);expect(cap.bottom).toBeLessThanOrEqual(size.height);expect(cap.left).toBeGreaterThanOrEqual(0);expect(cap.right).toBeLessThanOrEqual(size.width);}
    const clipped=await cue(page).evaluate(cue=>{
      const r=cue.getBoundingClientRect(),clipped=[];
      for(let p=cue.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect();
        if(/auto|scroll|hidden|clip/.test(s.overflowY)&&(r.top<b.top+p.clientTop-1||r.bottom>b.top+p.clientTop+p.clientHeight+1))clipped.push(p.className);
        if(/auto|scroll|hidden|clip/.test(s.overflowX)&&(r.left<b.left+p.clientLeft-1||r.right>b.left+p.clientLeft+p.clientWidth+1))clipped.push(p.className);
      }return clipped;
    });expect(clipped,'all three keycaps clear their scroll boundaries').toEqual([]);
    await expect.poll(()=>page.evaluate(()=>{
      const caps=[...document.querySelectorAll('.button-hotkey,.keyboard-focus-cue kbd,.keyboard-direction-key')].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility==='visible');
      const errors=[];
      for(const cap of caps) {
        const r=cap.getBoundingClientRect();
        for(let parent=cap.parentElement;parent;parent=parent.parentElement) {
          const s=getComputedStyle(parent),b=parent.getBoundingClientRect();
          if(/auto|scroll|hidden|clip/.test(s.overflowY)&&(r.top<b.top+parent.clientTop-1||r.bottom>b.top+parent.clientTop+parent.clientHeight+1))errors.push(`clipped ${cap.textContent}`);
          if(/auto|scroll|hidden|clip/.test(s.overflowX)&&(r.left<b.left+parent.clientLeft-1||r.right>b.left+parent.clientLeft+parent.clientWidth+1))errors.push(`clipped ${cap.textContent}`);
        }
      }
      for(let i=0;i<caps.length;i++)for(let j=i+1;j<caps.length;j++) {
        const a=caps[i].getBoundingClientRect(),b=caps[j].getBoundingClientRect();
        if(a.right>b.left+.5&&a.left<b.right-.5&&a.bottom>b.top+.5&&a.top<b.bottom-.5)errors.push(`overlapping ${caps[i].textContent} / ${caps[j].textContent}`);
      }
      return errors;
    })).toEqual([]);
    await page.screenshot({path:testInfo.outputPath(`keyboard-labels-${size.width}.png`)});
    await add.focus();await page.keyboard.press('Shift');await expect(add.locator('.button-hotkey')).toBeVisible();
    await page.keyboard.press('Control+z');await idle(page);
    await expect(page.locator('#undo .button-hotkey')).toBeHidden();await expect(page.locator('#redo .button-hotkey')).toBeVisible();
    await expect(page.locator('#redo .button-hotkey')).toHaveText(/⇧⌘Z|Ctrl⇧Z/);
    await page.keyboard.press('Control+Shift+z');await idle(page);await expect(page.locator('#undo .button-hotkey')).toBeVisible();await expect(page.locator('#redo .button-hotkey')).toBeHidden();
    await page.locator('#menu-open').focus();await page.keyboard.press('Space');
    await expect(page.locator('#menu-dialog .dialog-top button')).toBeFocused();
    await expect(page.locator('#menu-dialog [data-back-shortcut] .button-hotkey')).toBeVisible();await expect(page.locator('#menu-dialog [data-back-shortcut] .button-hotkey')).toHaveText('⌫');
    await expect(page.locator('.keyboard-arrows:visible,.game-shell .button-hotkey:visible')).toHaveCount(0);
    await page.locator('#settings-open').click();await expect(page.locator('.keyboard-focus-cue:visible,.button-hotkey:visible')).toHaveCount(0);
    await page.keyboard.press('Escape');await add.click();await idle(page);
    await expect(page.locator('.keyboard-focus-cue:visible,.button-hotkey:visible')).toHaveCount(0);
  }
});

test('Space selects and deselects an empty slot in place, then follows it through swaps',async({page})=>{
  await ready(page,4);
  const second=page.locator('[data-empty="1"]');await second.focus();
  for(const pressed of ['true','false','true']) {
    await page.keyboard.press('Space');await expect(second).toBeFocused();await expect(second).toHaveAttribute('aria-pressed',pressed);
  }
  expect(await page.evaluate(()=>window.angouri.history)).toEqual({undo:0,redo:0});
  await page.locator('#palette [data-op="H"]').focus();await page.keyboard.press('ArrowUp');await idle(page);
  const half=await page.evaluate(()=>window.angouri.state.nodes[0].id);
  expect(await page.evaluate(()=>window.angouri.slots)).toEqual([null,half,null,null,null]);
  const first=page.locator('[data-empty="0"]');await first.focus();await page.keyboard.press('Space');
  await expect(first).toBeFocused();await expect(first).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('Tab');await expect(page.locator(`[data-stage="${half}"]`)).toBeFocused();
  await page.keyboard.press('Space');await idle(page);
  await expect(second).toBeFocused();await expect(second).toHaveAttribute('aria-pressed','false');
  expect(await page.evaluate(()=>window.angouri.slots)).toEqual([half,null,null,null,null]);
  expect(await page.evaluate(()=>window.angouri.history)).toEqual({undo:2,redo:0});
  await page.keyboard.press('Space');await expect(second).toHaveAttribute('aria-pressed','true');
  // Moving between indistinguishable holes still moves the insertion choice,
  // without inventing a recipe-history change.
  await page.keyboard.press('ArrowRight');await idle(page);
  await expect(page.locator('[data-empty="2"]')).toBeFocused();await expect(page.locator('[data-empty="2"]')).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>window.angouri.history)).toEqual({undo:2,redo:0});
  await page.locator('#palette [data-op="A"]').focus();await page.keyboard.press('ArrowUp');await idle(page);
  const add=await page.evaluate(()=>window.angouri.state.nodes.at(-1).id);
  await expect(page.locator(`[data-stage="${add}"]`)).toBeFocused();
  expect(await page.evaluate(()=>window.angouri.slots)).toEqual([half,null,add,null,null]);
  await page.keyboard.press('Control+z');await idle(page);
  expect(await page.evaluate(()=>window.angouri.slots)).toEqual([half,null,null,null,null]);
});

test('directional placement crosses a fixed station without moving it and return remains undoable',async({page})=>{
  await ready(page,54);const original=await page.evaluate(()=>window.angouri.state);
  await page.locator('#palette [data-op="H"]').focus();await page.keyboard.press('ArrowUp');await idle(page);
  const id=await page.evaluate(()=>window.angouri.state.nodes.find(n=>n.op==='H').id);
  await expect(page.locator(`[data-stage="${id}"]`)).toBeFocused();
  await page.keyboard.press('ArrowRight');await idle(page);
  expect(await page.evaluate(()=>window.angouri.slots.slice(0,3))).toEqual([null,original.station.id,id]);
  await expect(page.locator(`[data-stage="${id}"]`)).toBeFocused();
  await page.keyboard.press('ArrowDown');await idle(page);await expect(page.locator('#palette [data-op="H"]')).toBeFocused();
  expect(await page.evaluate(()=>window.angouri.state)).toEqual(original);
  await page.keyboard.press('Control+z');await idle(page);
  expect(await page.evaluate(()=>window.angouri.slots.slice(0,3))).toEqual([null,original.station.id,id]);
});

test('Space repeats the current stack while Up follows a placed block and Down returns it',async({page})=>{
  await ready(page,3);await page.locator('#menu-open').click();await page.locator('#nav-create').click();await idle(page);
  const negate=page.locator('#palette [data-op="N"]');await negate.focus();
  for(const key of ['Space','Space']) {
    await page.keyboard.press(key);await idle(page);await expect(negate).toBeFocused();
    await expect(cue(page)).toHaveAttribute('data-directions','up');
  }
  const earlier=await page.evaluate(()=>window.angouri.state.nodes);
  expect(earlier.map(n=>n.op)).toEqual(['N','N']);
  await page.keyboard.press('ArrowUp');await idle(page);
  const added=await page.evaluate(()=>window.angouri.state.nodes.at(-1).id);
  await expect(page.locator(`[data-stage="${added}"]`)).toBeFocused();
  await expect(cue(page)).toHaveAttribute('data-directions','xdown');
  const beforeReturn=await page.evaluate(()=>window.angouri.slots);
  await page.keyboard.press('ArrowDown');await idle(page);await expect(negate).toBeFocused();
  expect(await page.evaluate(()=>window.angouri.state.nodes)).toEqual(earlier);
  await page.keyboard.press('Control+z');await idle(page);
  expect(await page.evaluate(()=>window.angouri.slots)).toEqual(beforeReturn);
  await page.keyboard.press('Control+Shift+z');await idle(page);
  expect(await page.evaluate(()=>window.angouri.state.nodes)).toEqual(earlier);

  await ready(page);const add=page.locator('#palette [data-op="A"]');await add.focus();
  for(const key of ['Space','Space']){await page.keyboard.press(key);await idle(page);await expect(add).toBeFocused();}
  await page.keyboard.press('ArrowUp');await idle(page);await expect(page.locator('.part-body').last()).toBeFocused();
  await page.keyboard.press('ArrowDown');await idle(page);await expect(add).toBeFocused();
  expect(await page.evaluate(()=>window.angouri.state.nodes.map(n=>n.op))).toEqual(['A','A']);

  await ready(page,3);await page.locator('#palette [data-op="H"]').focus();
  await page.keyboard.press('Space');await idle(page);await expect(page.locator('#palette [data-op="A"]')).toBeFocused();
  await page.keyboard.press('Space');await idle(page);await expect(page.locator('#launch')).toBeFocused();
  // Minimal choice puzzles have no recipe destination for Up to enter.
  await ready(page,2);await page.keyboard.press('Tab');await expect(cue(page)).toHaveCount(0);
  await page.keyboard.press('ArrowUp');expect(await page.evaluate(()=>window.angouri.state.nodes)).toEqual([]);
});

async function beginFrames(page) {
  await page.evaluate(()=>{
    window.recipeFrames=[];window.recipeFramesDone=false;const start=performance.now();
    const sample=()=>requestAnimationFrame(()=>setTimeout(()=>{
      const active=document.activeElement,part=active.closest('.recipe-part'),cue=document.querySelector('.keyboard-arrows');
      if(part&&cue&&!cue.hidden) {
        const r=active.getBoundingClientRect(),c=cue.getBoundingClientRect();
        const overlaps=[...document.querySelectorAll('.recipe-part')].filter(other=>other!==part).map(other=>{
          const b=other.getBoundingClientRect();return {left:Math.max(r.left,b.left),right:Math.min(r.right,b.right),top:Math.max(r.top,b.top),bottom:Math.min(r.bottom,b.bottom)};
        }).filter(b=>b.right-b.left>2&&b.bottom-b.top>2);
        const above=overlaps.every(b=>document.elementFromPoint((b.left+b.right)/2,(b.top+b.bottom)/2)?.closest('.recipe-part')===part);
        window.recipeFrames.push({id:active.dataset.stage,x:r.x,above,overlaps:overlaps.length,cueError:Math.abs(c.x-(r.left-6)),topError:Math.abs(c.top-Math.max(2,r.top-9)),moving:part.getAnimations().some(a=>a.id==='recipe-move'&&a.playState==='running')});
      }
      if(performance.now()-start<520)sample();else window.recipeFramesDone=true;
    },0));sample();
  });
}
async function checkFrames(page) {
  await page.waitForFunction(()=>window.recipeFramesDone);
  const frames=await page.evaluate(()=>window.recipeFrames),moving=frames.filter(frame=>frame.moving);
  expect(moving.length).toBeGreaterThan(2);
  expect(Math.max(...frames.map(f=>f.cueError))).toBeLessThan(1.1);
  expect(Math.max(...frames.map(f=>f.topError))).toBeLessThan(1.1);
  expect(frames.every(frame=>frame.above),'focused block paints above every overlapping neighbour').toBe(true);
  const moved=frames.filter(frame=>frame.id===frames.at(-1).id);
  expect(Math.max(...moved.map(f=>f.x))-Math.min(...moved.map(f=>f.x))).toBeGreaterThan(10);
}

test('arrow moves and Space swaps carry the focus cue through every painted frame',async({page},testInfo)=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:1146,height:850});await ready(page);
  for(const op of ['A','H']){await page.locator(`#palette [data-op="${op}"]`).click();await idle(page);}
  await page.mouse.move(5,5);await settled(page);
  const nodes=await page.evaluate(()=>window.angouri.state.nodes),first=page.locator(`[data-stage="${nodes[0].id}"]`),second=page.locator(`[data-stage="${nodes[1].id}"]`);
  const slots=()=>page.locator('#construction [data-cell]').evaluateAll(es=>es.map(e=>({x:e.offsetLeft,width:e.offsetWidth})));
  const original=await slots();expect(new Set(original.map(s=>s.width)).size).toBe(1);
  await second.focus();await page.keyboard.press('Shift');
  await beginFrames(page);await page.keyboard.press('ArrowRight');await idle(page);
  await page.waitForTimeout(60);await page.keyboard.press('ArrowRight');await idle(page);
  await checkFrames(page);await expect(second).toBeFocused();
  expect(await slots()).toEqual(original);
  expect(await page.evaluate(()=>window.angouri.slots.slice(0,4))).toEqual([nodes[0].id,null,null,nodes[1].id]);
  await beginFrames(page);await page.keyboard.press('ArrowLeft');await idle(page);
  await page.waitForTimeout(60);await page.keyboard.press('ArrowLeft');await idle(page);await checkFrames(page);
  expect(await slots()).toEqual(original);

  await page.keyboard.press('Escape');await first.focus();await page.keyboard.press('Space');await page.keyboard.press('Tab');await expect(second).toBeFocused();
  await beginFrames(page);await page.keyboard.press('Space');await idle(page);await checkFrames(page);
  await expect(first).toBeFocused();await expect(first).toHaveAttribute('aria-pressed','false');await expect(page.locator('#construction')).not.toHaveClass(/has-selection/);expect(await page.evaluate(()=>window.angouri.slots.slice(0,2))).toEqual([nodes[1].id,nodes[0].id]);
  expect(await slots()).toEqual(original);
  await page.screenshot({path:testInfo.outputPath('space-swap.png')});
  await page.keyboard.press('Control+z');await idle(page);await settled(page);
  expect(await page.evaluate(()=>window.angouri.slots.slice(0,2))).toEqual(nodes.map(n=>n.id));
});

test('offscreen arrow moves reveal the final block and keep its ring inside the rail',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  for(const size of [{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(size);await ready(page);await page.locator('#palette [data-op="A"]').focus();
    await page.keyboard.press('ArrowUp');await idle(page);await settled(page);
    const id=await page.evaluate(()=>window.angouri.state.nodes[0].id),part=page.locator(`[data-stage="${id}"]`);
    for(let index=1;index<6;index++) {
      await page.keyboard.press('ArrowRight');await idle(page);await settled(page);
      await expect(part).toBeFocused();
      const bounds=await part.evaluate(el=>{
        const r=el.getBoundingClientRect(),rail=el.closest('.pipeline'),box=rail.getBoundingClientRect(),cue=document.querySelector('.keyboard-arrows').getBoundingClientRect();
        return {left:r.left-6-(box.left+rail.clientLeft),right:box.left+rail.clientLeft+rail.clientWidth-r.right-6,cue:Math.abs(cue.x-(r.left-6)),scroll:rail.scrollLeft};
      });
      expect(bounds.left).toBeGreaterThanOrEqual(-1);expect(bounds.right).toBeGreaterThanOrEqual(-1);expect(bounds.cue).toBeLessThan(1.1);
      expect(await page.evaluate(()=>window.angouri.slots.indexOf(window.angouri.state.nodes[0].id))).toBe(index);
      expect(await page.evaluate(()=>[scrollX,scrollY])).toEqual([0,0]);
    }
    const before=await page.evaluate(()=>window.angouri.slots);
    await page.keyboard.press('ArrowDown');await idle(page);await expect(page.locator('#palette [data-op="A"]')).toBeFocused();
    await page.keyboard.press('Control+z');await idle(page);expect(await page.evaluate(()=>window.angouri.slots)).toEqual(before);
  }
});

test('uniform recipe cells fit every block formula in desktop and compact layouts',async({page})=>{
  await ready(page,3);await page.locator('#menu-open').click();await page.locator('#nav-create').click();await idle(page);
  const operations=await page.locator('#palette [data-op]').evaluateAll(es=>es.map(e=>e.dataset.op));
  for(const op of operations){await page.locator(`#palette [data-op="${op}"]`).click();await idle(page);}
  for(const size of [{width:1146,height:850},{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(size);
    const cells=await page.locator('#construction [data-cell]').evaluateAll(es=>es.map(e=>{
      const r=e.getBoundingClientRect(),formula=e.querySelector('.katex')?.getBoundingClientRect();
      return {width:r.width,left:formula?formula.left-r.left:0,right:formula?r.right-formula.right:0};
    }));
    expect(new Set(cells.map(c=>c.width)).size).toBe(1);
    for(const cell of cells){expect(cell.left).toBeGreaterThanOrEqual(0);expect(cell.right).toBeGreaterThanOrEqual(0);}
  }
});
