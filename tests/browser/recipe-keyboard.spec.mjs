import {test,expect} from '@playwright/test';

const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
async function ready(page,id=25) {
  await page.goto('/about/');await page.evaluate(()=>localStorage.clear());
  await page.goto(`/#level=${id}&view=flight`);
  await page.waitForFunction(()=>window.angouri?.state&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
}
const settled=page=>page.waitForFunction(()=>[...document.querySelectorAll('.recipe-part,.empty-slot')].every(el=>el.getAnimations({subtree:true}).every(a=>a.playState==='finished')));
const cue=page=>page.locator('.keyboard-arrows:visible');
// Set up an editing target after ordinary stack activation. Number-entry tests
// separately verify the automatic focus handoff without this explicit focus.
async function placeFocusedStack(page) {
  await page.keyboard.press('Space');await idle(page);
  await page.locator('.part-body').last().focus();
}

test('Up does not place from the deck and Down or Delete retains local focus for number entry',async({page})=>{
  await ready(page);const deck=page.locator('#palette [data-op="A"]');await deck.focus();
  const original=await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}));
  await page.keyboard.press('ArrowUp');await idle(page);
  expect(await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}))).toEqual(original);
  await expect(deck).toBeFocused();await expect(deck).not.toHaveAttribute('aria-keyshortcuts',/ArrowUp/);await expect(cue(page)).toHaveCount(0);
  await page.keyboard.press('2');await idle(page);await expect(page.locator('.part-body')).toBeFocused();
  await expect(page.locator('.part-body')).toHaveAttribute('aria-keyshortcuts',/ArrowDown/);
  await expect(cue(page)).toHaveAttribute('data-directions','xdown');await expect(cue(page).locator('.keyboard-down')).toBeVisible();
  await page.keyboard.press('ArrowRight');await idle(page);
  const id=await page.evaluate(()=>window.angouri.state.nodes[0].id);
  await page.keyboard.press('Delete');await idle(page);
  await expect(page.locator('[data-empty="1"]')).toBeFocused();expect(await page.evaluate(()=>window.angouri.state.nodes)).toEqual([]);
  await page.keyboard.press('Control+z');await idle(page);await expect(page.locator(`[data-stage="${id}"]`)).toBeFocused();
  await page.keyboard.press('Backspace');await idle(page);await expect(page.locator('[data-empty="0"]')).toBeFocused();
  await page.keyboard.press('Control+z');await idle(page);await expect(page.locator('[data-empty="0"]')).toBeFocused();
  await page.locator(`[data-stage="${id}"]`).focus();await page.keyboard.press('ArrowDown');await idle(page);
  await expect(page.locator('[data-empty="1"]')).toBeFocused();await expect(page.locator('[data-empty="1"]')).toHaveAttribute('aria-pressed','false');
  expect(await page.evaluate(()=>window.angouri.state.nodes)).toEqual([]);
  await page.keyboard.press('1');await idle(page);await expect(page.locator('[data-cell="1"] .part-body')).toBeFocused();
  await page.keyboard.press('2');await idle(page);await expect(page.locator('[data-cell="2"] .part-body')).toBeFocused();
  expect(await page.evaluate(()=>window.angouri.slots[0])).toBeNull();
  expect(await page.evaluate(()=>window.angouri.state.nodes.map(n=>n.op))).toEqual(['H','A']);
});

test('Backspace clears backward through blocks and holes, stops at the first slot and preserves Undo',async({page})=>{
  await ready(page);
  for(let i=0;i<3;i++){await page.keyboard.press('2');await idle(page);}
  for(let i=0;i<2;i++){await page.keyboard.press('ArrowRight');await idle(page);}
  const before=await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}));
  await page.keyboard.press('Backspace');await idle(page);await expect(page.locator('[data-empty="3"]')).toBeFocused();
  await expect(cue(page).locator('kbd:visible')).toHaveText(['Space','⌫']);
  const removed=await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}));
  for(const index of [2,1]) {
    await page.keyboard.press('Backspace');await idle(page);
    await expect(page.locator(`[data-cell="${index}"]${index===1?' .part-body':''}`)).toBeFocused();
    expect(await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}))).toEqual(removed);
  }
  await page.keyboard.press('Backspace');await idle(page);await expect(page.locator('[data-cell="0"] .part-body')).toBeFocused();
  await page.keyboard.press('Backspace');await idle(page);await expect(page.locator('[data-empty="0"]')).toBeFocused();
  await expect(cue(page).locator('kbd:visible')).toHaveText(['Space']);
  expect(await page.evaluate(()=>window.angouri.state.nodes)).toEqual([]);
  const cleared=await page.evaluate(()=>window.angouri.history);expect(cleared.undo).toBe(before.history.undo+3);
  await page.keyboard.press('Backspace');await idle(page);await expect(page.locator('[data-empty="0"]')).toBeFocused();
  expect(await page.evaluate(()=>window.angouri.history)).toEqual(cleared);
  for(let i=0;i<3;i++){await page.keyboard.press('Control+z');await idle(page);}
  expect(await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots}))).toEqual({state:before.state,slots:before.slots});
  expect(await page.evaluate(()=>window.angouri.history)).toEqual({...before.history,redo:3});
});

test('Backspace crosses a fixed station without selecting it, while forward Delete keeps its slot',async({page})=>{
  await ready(page,54);const original=await page.evaluate(()=>window.angouri.state);
  await page.locator('#palette [data-op="H"]').focus();await placeFocusedStack(page);
  await page.keyboard.press('ArrowRight');await idle(page);
  const id=await page.evaluate(()=>window.angouri.state.nodes.find(node=>node.op==='H').id);
  await page.keyboard.press('Backspace');await idle(page);await expect(page.locator('[data-empty="0"]')).toBeFocused();
  expect(await page.evaluate(()=>window.angouri.state)).toEqual(original);
  const history=await page.evaluate(()=>window.angouri.history);
  await page.locator('[data-empty="2"]').focus();await page.keyboard.press('Backspace');await expect(page.locator('[data-empty="0"]')).toBeFocused();
  expect(await page.evaluate(()=>window.angouri.history)).toEqual(history);
  await page.keyboard.press('Control+z');await idle(page);await page.locator(`[data-stage="${id}"]`).focus();
  await page.keyboard.press('Delete');await idle(page);await expect(page.locator('[data-empty="2"]')).toBeFocused();
  expect(await page.evaluate(()=>window.angouri.state)).toEqual(original);
});

test('Shift Delete restarts only the current recipe, remains undoable and leaves text editing alone',async({page})=>{
  await ready(page);
  for(const op of ['A','H']){await page.locator(`#palette [data-op="${op}"]`).focus();await placeFocusedStack(page);}
  const before=await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}));
  for(const key of ['Shift+Delete','Shift+Backspace']) {
    await expect(page.locator('#reset .button-hotkey')).toBeVisible();await expect(page.locator('#reset .button-hotkey')).toHaveText('⇧+⌫');
    await expect(page.locator('#reset')).toHaveAttribute('title','Restart puzzle (⇧+⌫)');
    await page.keyboard.press(key);await idle(page);
    expect(await page.evaluate(()=>window.angouri.state.nodes)).toEqual([]);await expect(page.locator('#reset .button-hotkey')).toBeHidden();
    await expect(page.locator('[data-empty="0"]')).toBeFocused();
    expect(await page.evaluate(()=>window.angouri.history.undo)).toBe(before.history.undo+1);
    await page.keyboard.press('Control+z');await idle(page);
    expect(await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots}))).toEqual({state:before.state,slots:before.slots});
  }
  await page.locator('#menu-open').click();await page.locator('#library-open').click();
  await page.locator('#seed-name').fill('typing hn');await page.keyboard.press('Shift+Delete');await idle(page);
  expect(await page.evaluate(()=>window.angouri.state)).toEqual(before.state);
  await expect(page.locator('#library-dialog')).toBeVisible();
  await ready(page,1);await page.keyboard.press('2');await idle(page);await page.keyboard.press('Shift+Backspace');await idle(page);
  await expect(page.locator('#palette [data-op="H"]')).toBeFocused();expect(await page.evaluate(()=>window.angouri.state.nodes)).toEqual([]);
});

test('H and N open available references and M opens Menu without editing the recipe',async({page})=>{
  await ready(page);
  await page.locator('#palette [data-op="A"]').focus();await page.keyboard.press('Space');await idle(page);
  const before=await page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history}));
  await expect(page.locator('#hints-open .button-hotkey')).toBeVisible();await expect(page.locator('#ideas-open .button-hotkey')).toBeVisible();
  await page.keyboard.press('h');await expect(page.locator('#hints-dialog')).toBeVisible();await expect(page.locator('#hints-dialog .dialog-top button')).toBeFocused();
  await expect(page.locator('#hint-more-toggle')).toBeVisible();await expect(page.locator('#hint-more-toggle')).toHaveAttribute('aria-expanded','false');
  await page.keyboard.press('n');await expect(page.locator('#ideas-dialog')).not.toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#palette [data-op="A"]')).toBeFocused();
  await page.keyboard.press('n');await expect(page.locator('#ideas-dialog')).toBeVisible();await expect(page.locator('#ideas-dialog .dialog-top button')).toBeFocused();
  await page.keyboard.press('Escape');await expect(page.locator('#palette [data-op="A"]')).toBeFocused();
  expect(await page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history}))).toEqual(before);
  await ready(page,1);await page.keyboard.press('h');await page.keyboard.press('n');await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('#menu-open .button-hotkey')).toBeVisible();await expect(page.locator('#menu-open')).toHaveAttribute('aria-keyshortcuts','M');
  await page.keyboard.press('m');await expect(page.locator('#menu-dialog .dialog-top button')).toBeFocused();
  await page.keyboard.press('Backspace');await expect(page.locator('#menu-open')).toBeFocused();
  await ready(page,3);await page.keyboard.press('h');await expect(page.locator('dialog[open]')).toHaveCount(0);await page.keyboard.press('n');await expect(page.locator('#ideas-dialog')).toBeVisible();
});

test('reference shortcuts restore selected blocks and holes, including Hints to Notes and pending edits',async({page})=>{
  await ready(page);await page.keyboard.press('1');await idle(page);await page.keyboard.press('Space');
  const block=page.locator('.part-body');await expect(block).toHaveAttribute('aria-pressed','true');
  const before=await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}));
  for(const [key,dialog] of [['h','hints-dialog'],['n','ideas-dialog']]) {
    await page.keyboard.press(key);await expect(page.locator(`#${dialog} .dialog-top button`).first()).toBeFocused();
    await page.keyboard.press('Backspace');await expect(block).toBeFocused();await expect(block).toHaveAttribute('aria-pressed','true');
  }
  await page.keyboard.press('h');await page.locator('#hint-notes').click();await expect(page.locator('#ideas-dialog')).toBeVisible();
  await page.keyboard.press('Escape');await expect(block).toBeFocused();
  expect(await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}))).toEqual(before);
  await page.keyboard.press('Escape');const empty=page.locator('[data-empty="2"]');await empty.focus();await page.keyboard.press('Space');
  for(const [key,dialog] of [['h','hints-dialog'],['n','ideas-dialog']]) {
    await page.keyboard.press(key);await page.locator(`#${dialog} .dialog-top button`).first().click();
    await expect(empty).toBeFocused();await expect(empty).toHaveAttribute('aria-pressed','true');
  }
  // An explicit view link remains a navigation choice, not reference dismissal.
  await page.keyboard.press('n');await page.locator('#ideas-dialog .note-view-button[data-view="function"]').first().click();
  await expect(page.locator('#tab-function')).toBeFocused();
  await page.locator('#ideas-open').click();await page.keyboard.press('Escape');await expect(page.locator('#ideas-open')).toBeFocused();
  await block.focus();
  await page.evaluate(()=>{
    const block=document.activeElement;
    block.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
    block.dispatchEvent(new KeyboardEvent('keydown',{key:'h',bubbles:true,cancelable:true}));
  });
  await idle(page);await expect(page.locator('#hints-dialog')).toBeVisible();
  await page.keyboard.press('Escape');await expect(block).toBeFocused();
  expect(await page.evaluate(()=>window.angouri.slots.indexOf(window.angouri.state.nodes[0].id))).toBe(1);
  await ready(page);await page.locator('[data-empty="0"]').focus();await page.keyboard.press('Shift');
  for(const [key,reference,next,selected] of [['ArrowRight','h',1,false],['ArrowRight','n',2,true],['2','h',3,true]]) {
    if(next===2)await page.keyboard.press('Space');
    await page.evaluate(([key,reference])=>{
      const slot=document.activeElement;
      for(const value of [key,reference])slot.dispatchEvent(new KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true}));
    },[key,reference]);
    await idle(page);await expect(page.locator(`#${reference==='h'?'hints':'ideas'}-dialog .dialog-top button`).first()).toBeFocused();
    await page.keyboard.press('Escape');await expect(page.locator(`[data-empty="${next}"]`)).toBeFocused();
    await expect(page.locator(`[data-empty="${next}"]`)).toHaveAttribute('aria-pressed',String(selected));
  }
});

test('quick-key opt-out preserves defaults, Tab navigation and modified shortcuts',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await ready(page);
  const buttons=()=>page.locator('.game-shell button').evaluateAll(es=>es.filter(e=>!e.disabled&&e.getClientRects().length&&e.tabIndex>=0).map(e=>e.id||e.dataset.op||e.dataset.empty));
  const before=await buttons();
  await page.locator('#menu-open').click();await page.locator('#settings-open').click();await expect(page.locator('#character-shortcuts')).not.toBeChecked();await expect(page.locator('#motion-toggle')).not.toBeChecked();await page.locator('#character-shortcuts').check();await page.keyboard.press('Escape');
  expect(await buttons()).toEqual(before);
  await page.keyboard.press('h');await page.keyboard.press('n');await page.keyboard.press('m');await page.keyboard.press('?');await page.keyboard.press('x');await expect(page.locator('dialog[open]')).toHaveCount(0);await expect(page.locator('#tab-flight')).toHaveAttribute('aria-selected','true');
  await page.keyboard.press('1');await idle(page);expect(await page.evaluate(()=>window.angouri.state.nodes)).toEqual([]);await expect(page.locator('[data-character]:visible')).toHaveCount(0);await expect(page.locator('#ideas-open')).not.toHaveAttribute('aria-keyshortcuts');await expect(page.locator('#menu-open')).not.toHaveAttribute('aria-keyshortcuts');
  await page.locator('#ideas-open').focus();await page.keyboard.press('Space');await expect(page.locator('#ideas-dialog')).toBeVisible();await page.keyboard.press('Escape');
  await page.locator('#tab-function').click();await page.reload();await page.waitForFunction(()=>window.angouri?.state&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
  await page.keyboard.press('n');await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.locator('#palette [data-op="A"]').focus();await placeFocusedStack(page);await page.keyboard.press('Shift+Delete');await idle(page);
  expect(await page.evaluate(()=>window.angouri.state.nodes)).toEqual([]);await page.keyboard.press('Control+z');await idle(page);expect(await page.evaluate(()=>window.angouri.state.nodes.map(n=>n.op))).toEqual(['A']);
  await page.locator('#menu-open').click();await page.locator('#settings-open').click();await page.locator('#character-shortcuts').uncheck();await page.keyboard.press('Escape');
  await page.keyboard.press('n');await expect(page.locator('#ideas-dialog')).toBeVisible();
});

test('Z X C switch views directly while preserving the focused editor and recipe',async({page})=>{
  await ready(page);
  await page.locator('#palette [data-op="A"]').focus();await placeFocusedStack(page);
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

test('view shortcuts work from Flow sliders and Equation readers with visible focus and a retained probe',async({page})=>{
  await ready(page,25);await page.setViewportSize({width:844,height:390});
  await page.keyboard.press('2');await idle(page);await page.keyboard.press('c');
  const slider=page.locator('#flow-position');await slider.focus();await page.keyboard.press('ArrowRight');
  const position=await slider.inputValue(),before=await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}));
  for(const key of ['c','z','x']) {
    await slider.focus();await page.keyboard.press(key);
    if(key==='c'){await expect(slider).toBeFocused();await expect(slider).toHaveValue(position);}
    else {
      await expect(page.locator(`#tab-${key==='z'?'flight':'function'}`)).toBeFocused();
      await page.keyboard.press('c');await expect(page.locator('#tab-flow')).toBeFocused();await expect(slider).toHaveValue(position);
    }
  }
  await slider.focus();await expect(page.locator('#tab-flight .button-hotkey')).toBeVisible();await expect(page.locator('#tab-function .button-hotkey')).toBeVisible();
  // An edit that replaces the scene also retains the logical slider for Undo.
  await page.keyboard.press('Control+z');await idle(page);await expect(slider).toBeFocused();
  await page.keyboard.press('Control+Shift+z');await idle(page);await expect(slider).toBeFocused();await expect(slider).toHaveValue(position);
  for(const key of ['z','c']) {
    await page.keyboard.press('x');const reader=page.locator('.value-table tbody');await expect(reader).toHaveAttribute('tabindex','0');
    await reader.focus();await page.keyboard.press(key);await expect(page.locator(`#tab-${key==='z'?'flight':'flow'}`)).toBeFocused();
  }
  expect(await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}))).toEqual(before);
  // Exact-value fields are for typing, even outside dialogs.
  await ready(page,43);const exact=page.locator('[data-circle-value]').first();await exact.focus();await page.keyboard.press('x');
  await expect(exact).toBeFocused();await expect(page.locator('#tab-flight')).toHaveAttribute('aria-selected','true');
});

test('number shortcuts follow stable palette positions and chosen slots while return stays a separate action',async({page})=>{
  await ready(page,3);
  const ops=await page.locator('#palette [data-op]').evaluateAll(es=>es.map(e=>e.dataset.op));
  await page.keyboard.press('1');await idle(page);await expect(page.locator('.part-body')).toBeFocused();
  expect(await page.evaluate(()=>window.angouri.state.nodes.map(n=>n.op))).toEqual([ops[0]]);
  await expect(page.locator('#palette [data-op]').first()).toBeDisabled();await expect(page.locator('#palette [data-op]').last().locator('.button-hotkey')).toHaveText('2');
  await page.locator('[data-empty="1"]').focus();await page.keyboard.press('Space');
  await page.keyboard.press('1');await idle(page);expect(await page.evaluate(()=>window.angouri.state.nodes.length)).toBe(1);
  await expect(page.locator('[data-empty="1"]')).toBeFocused();await expect(page.locator('[data-empty="1"]')).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('2');await idle(page);expect(await page.evaluate(()=>window.angouri.state.nodes.map(n=>n.op))).toEqual(ops);

  await ready(page,25);await page.locator('[data-empty="2"]').focus();await page.keyboard.press('Space');await page.keyboard.press('2');await idle(page);
  const id=await page.evaluate(()=>window.angouri.state.nodes[0].id);await expect(page.locator('[data-empty="3"]')).toBeFocused();await expect(page.locator('[data-empty="3"]')).toHaveAttribute('aria-pressed','true');expect(await page.evaluate(()=>window.angouri.slots.indexOf(window.angouri.state.nodes[0].id))).toBe(2);
  await page.keyboard.press('Escape');await page.locator(`[data-stage="${id}"]`).focus();
  await page.keyboard.press('Space');await expect(page.locator('#palette [data-op="A"]')).toHaveAttribute('data-return',id);
  const selected=await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}));
  await expect(page.locator('#palette [data-op="A"] .button-hotkey')).toBeHidden();
  await expect(page.locator('#palette [data-op="A"]')).toHaveAttribute('aria-keyshortcuts','Space');
  await page.keyboard.press('2');await idle(page);
  expect(await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}))).toEqual(selected);
  await expect(page.locator(`[data-stage="${id}"]`)).toBeFocused();await expect(page.locator(`[data-stage="${id}"]`)).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('Delete');await idle(page);expect(await page.evaluate(()=>window.angouri.state.nodes)).toEqual([]);await expect(page.locator('[data-empty="2"]')).toBeFocused();
  await page.keyboard.press('Control+z');await idle(page);expect(await page.evaluate(()=>window.angouri.slots.indexOf(window.angouri.state.nodes[0].id))).toBe(2);

  await ready(page,3);await page.locator('#menu-open').click();await page.locator('#nav-create').click();await idle(page);
  const all=await page.locator('#palette [data-op]').evaluateAll(es=>es.map(e=>e.dataset.op));expect(all).toHaveLength(9);
  for(let index=0;index<all.length;index++){await page.keyboard.press(String(index+1));await idle(page);await expect(page.locator('.part-body').last()).toBeFocused();}
  expect(await page.evaluate(()=>window.angouri.state.nodes.map(n=>n.op))).toEqual(all);
  await ready(page,1);await page.keyboard.press('1');await idle(page);await expect(page.locator('#palette [data-op="H"]')).toBeFocused();expect(await page.evaluate(()=>window.angouri.state.nodes.map(n=>n.op))).toEqual(['H']);
});

test('numbers insert after focus, replace only explicit selections and preserve holes in one Undo step',async({page})=>{
  await ready(page);await page.keyboard.press('2');await idle(page);
  const add=await page.evaluate(()=>window.angouri.state.nodes[0].id);
  await page.keyboard.press('ArrowRight');await idle(page);
  await expect(page.locator(`[data-stage="${add}"]`)).toHaveAttribute('aria-pressed','false');
  await page.keyboard.press('1');await idle(page);
  const half=await page.evaluate(()=>window.angouri.state.nodes.at(-1).id);
  expect(await page.evaluate(()=>window.angouri.slots.slice(0,3))).toEqual([null,add,half]);
  await page.locator(`[data-stage="${add}"]`).focus();await page.keyboard.press('2');await idle(page);
  const added=await page.evaluate(()=>window.angouri.state.nodes[1].id);
  expect(await page.evaluate(()=>window.angouri.slots.slice(0,4))).toEqual([null,add,added,half]);
  await expect(page.locator(`[data-stage="${added}"]`)).toBeFocused();
  const before=await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}));
  const stock=await page.locator('#palette [data-op="A"]').getAttribute('data-stock');
  await page.keyboard.press('Space');await page.keyboard.press('1');await idle(page);
  const replacement=await page.evaluate(()=>window.angouri.state.nodes[1]);expect(replacement.op).toBe('H');expect(replacement.id).not.toBe(added);
  expect(await page.evaluate(()=>window.angouri.slots)).toEqual(before.slots.map(id=>id===added?replacement.id:id));
  expect(await page.evaluate(()=>window.angouri.history.undo)).toBe(before.history.undo+1);
  await expect(page.locator(`[data-stage="${replacement.id}"]`)).toBeFocused();await expect(page.locator(`[data-stage="${replacement.id}"]`)).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#palette [data-op="A"]')).toHaveAttribute('data-stock',String(Number(stock)+1));
  await page.keyboard.press('Control+z');await idle(page);
  expect(await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots}))).toEqual({state:before.state,slots:before.slots});
  await expect(page.locator(`[data-stage="${added}"]`)).toBeFocused();
  await page.keyboard.press('Control+Shift+z');await idle(page);
  await expect(page.locator(`[data-stage="${replacement.id}"]`)).toBeFocused();
  await page.keyboard.press('2');await idle(page);
  expect(await page.evaluate(()=>window.angouri.state.nodes.map(n=>n.op))).toEqual(['A','H','A','H']);
  expect(await page.evaluate(()=>window.angouri.slots[0])).toBeNull();
  await page.locator(`[data-stage="${add}"]`).focus();await page.locator('#palette [data-op="H"]').hover();
  await expect(page.locator('[data-empty="5"]')).toHaveClass(/suggested-slot/);await expect(page.locator('[data-empty="0"]')).not.toHaveClass(/suggested-slot/);
  await page.locator('#palette [data-op="H"]').click();await idle(page);
  expect(await page.evaluate(()=>window.angouri.state.nodes.map(n=>n.op))).toEqual(['A','H','A','H','H']);
  expect(await page.evaluate(()=>window.angouri.slots[0])).toBeNull();
});

test('ordinary entry continues forward when only earlier holes remain and Restart establishes the front',async({page})=>{
  await ready(page);
  const capacity=await page.evaluate(()=>window.angouri.state.limit);
  for(let i=0;i<capacity-1;i++){
    const key=await page.locator('#palette [data-op]:not(:disabled)').last().getAttribute('data-shortcut');
    await page.keyboard.press(key);await idle(page);
  }
  const initialOps=await page.evaluate(()=>window.angouri.state.nodes.map(n=>n.op));
  await page.keyboard.press('ArrowRight');await idle(page);
  const last=await page.evaluate(()=>window.angouri.state.nodes.at(-1).id);
  await page.locator('.part-body').first().focus();await page.keyboard.press('Delete');await idle(page);
  await page.locator(`[data-stage="${last}"]`).focus();await page.keyboard.press('1');await idle(page);
  const half=await page.evaluate(()=>window.angouri.state.nodes.at(-1).id);
  expect(await page.evaluate(()=>window.angouri.slots[0])).toBeNull();
  expect(await page.evaluate(()=>window.angouri.slots.slice(-2))).toEqual([last,half]);
  await expect(page.locator(`[data-stage="${half}"]`)).toBeFocused();
  await page.locator('#palette [data-op="H"]').hover();await expect(page.locator(`[data-cell="${capacity-1}"]`)).toHaveClass(/suggested-slot/);
  await expect(page.locator('[data-empty="0"]')).not.toHaveClass(/suggested-slot/);
  await page.locator('#palette [data-op="H"]').click();await idle(page);
  expect(await page.evaluate(()=>window.angouri.state.nodes.map(n=>n.op))).toEqual([...initialOps.slice(1),'H','H']);
  expect(await page.evaluate(()=>window.angouri.slots.includes(null))).toBe(false);
  await page.locator('#reset').click();await idle(page);await expect(page.locator('[data-empty="0"]')).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-focus-modality','pointer');
  await page.keyboard.press('1');await idle(page);await expect(page.locator('[data-cell="0"] .part-body')).toBeFocused();
  expect(await page.evaluate(()=>window.angouri.state.nodes.map(n=>n.op))).toEqual(['H']);
});

test('full recipes accept replacement from spare stock and unavailable numbers preserve selection',async({page})=>{
  await ready(page);
  const capacity=await page.evaluate(()=>window.angouri.state.limit);
  for(let i=0;i<capacity;i++){
    const key=await page.locator('#palette [data-op]:not(:disabled)').last().getAttribute('data-shortcut');
    await page.keyboard.press(key);await idle(page);
  }
  await expect(page.locator('#palette [data-op="H"]')).toBeDisabled();
  await page.locator('.part-body').first().focus();
  await page.keyboard.press('Space');await expect(page.locator('#palette [data-op="H"]')).toBeEnabled();
  const before=await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}));
  await page.keyboard.press('1');await idle(page);
  expect(await page.evaluate(()=>window.angouri.state.nodes.map(n=>n.op))).toEqual(before.state.nodes.map((n,i)=>i===0?'H':n.op));
  expect(await page.evaluate(()=>window.angouri.history.undo)).toBe(before.history.undo+1);
  await page.keyboard.press('Control+z');await idle(page);
  expect(await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots}))).toEqual({state:before.state,slots:before.slots});

  await ready(page,3);await page.keyboard.press('1');await idle(page);await page.keyboard.press('2');await idle(page);await page.keyboard.press('Space');
  const full=await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}));
  await expect(page.locator('#palette [data-op="H"]')).toBeDisabled();await page.keyboard.press('1');await idle(page);
  expect(await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}))).toEqual(full);
  await expect(page.locator('.part-body').last()).toHaveAttribute('aria-pressed','true');
});

test('replacement and Restart respect fixed stations and pointer and Space agree',async({page})=>{
  for(const id of [53,54]) {
    await ready(page,id);const original=await page.evaluate(()=>window.angouri.state);
    await page.keyboard.press('1');await idle(page);
    const slot=await page.evaluate(()=>Number(document.activeElement.closest('[data-cell]').dataset.cell));
    for(const action of ['click','Space']) {
      const before=await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}));
      await page.keyboard.press('Space');
      const other=page.locator('#palette [data-op]:not([data-return]):not(:disabled)').first();
      const op=await other.getAttribute('data-op');
      await expect(other).toHaveAttribute('aria-describedby','replacement-keyboard-help');
      if(action==='click')await other.click();else {await other.focus();await page.keyboard.press(action);}
      await idle(page);const replacement=await page.evaluate(slot=>window.angouri.slots[slot],slot);
      await expect(page.locator(`[data-stage="${replacement}"]`)).toBeFocused();
      expect(await page.evaluate(id=>window.angouri.state.nodes.find(n=>n.id===id).op,replacement)).toBe(op);
      expect(await page.evaluate(()=>window.angouri.slots)).toEqual(before.slots.map((id,i)=>i===slot?replacement:id));
      expect(await page.evaluate(()=>window.angouri.history.undo)).toBe(before.history.undo+1);
      expect(await page.evaluate(()=>window.angouri.slots[window.angouri.state.station.before])).toBe(original.station.id);
    }
    await page.keyboard.press('Shift+Backspace');await idle(page);
    await expect(page.locator(`[data-empty="${slot}"]`)).toBeFocused();
    expect(await page.evaluate(()=>window.angouri.state)).toEqual(original);
    await page.keyboard.press('1');await idle(page);
    await expect(page.locator(`[data-cell="${slot}"] .part-body`)).toBeFocused();
  }
});

test('number placement advances a selected hole, skips filled cells, wraps and stops at a full recipe',async({page})=>{
  await ready(page);await page.keyboard.press('1');await idle(page);
  const first=await page.evaluate(()=>window.angouri.state.nodes[0].id);
  const last=await page.evaluate(()=>window.angouri.slots.length-1);
  await page.locator(`[data-empty="${last}"]`).focus();await page.keyboard.press('Space');
  let index=last,count=0;
  while(index>=0) {
    const previous=await page.evaluate(()=>({slots:window.angouri.slots,history:window.angouri.history}));
    const number=await page.locator('#palette [data-op]:not(:disabled):not([data-return])').first().getAttribute('data-shortcut');
    await page.keyboard.press(number);await idle(page);count++;
    const next=previous.slots.findIndex((id,i)=>i>index&&id===null);
    previous.slots[index]='filled';index=next>=0?next:previous.slots.indexOf(null);
    expect(await page.evaluate(()=>window.angouri.history.undo)).toBe(previous.history.undo+1);
    expect(await page.evaluate(()=>window.angouri.slots[0])).toBe(first);
    if(index>=0){await expect(page.locator(`[data-empty="${index}"]`)).toBeFocused();await expect(page.locator(`[data-empty="${index}"]`)).toHaveAttribute('aria-pressed','true');}
    else {await expect(page.locator('.part-body:focus')).toHaveCount(1);await expect(page.locator('#construction')).not.toHaveClass(/has-selection/);}
  }
  expect(count).toBe(last);const full=await page.evaluate(()=>window.angouri.slots);
  await page.keyboard.press('1');await idle(page);expect(await page.evaluate(()=>window.angouri.slots)).toEqual(full);
  await page.keyboard.press('Control+z');await idle(page);expect(await page.locator('.empty-slot').count()).toBe(1);
  await page.keyboard.press('Control+Shift+z');await idle(page);expect(await page.evaluate(()=>window.angouri.slots)).toEqual(full);
});

test('selected number placement skips a fixed station and advances into new Create slots',async({page})=>{
  await ready(page,54);const station=await page.evaluate(()=>window.angouri.state.station);
  await page.locator('[data-empty="0"]').focus();await page.keyboard.press('Space');await page.keyboard.press('1');await idle(page);
  await expect(page.locator('[data-empty="2"]')).toBeFocused();await expect(page.locator('[data-empty="2"]')).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>window.angouri.slots[1])).toBe(station.id);
  await ready(page,3);await page.locator('#menu-open').click();await page.locator('#nav-create').click();await idle(page);
  await page.locator('[data-empty="0"]').focus();await page.keyboard.press('Space');
  for(let index=0;index<3;index++) {
    await page.keyboard.press('3');await idle(page);
    await expect(page.locator(`[data-empty="${index+1}"]`)).toBeFocused();await expect(page.locator(`[data-empty="${index+1}"]`)).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('#feedback')).toHaveText('Choose a block.');
    expect(await page.evaluate(()=>window.angouri.history.undo)).toBe(index+1);
  }
  await page.keyboard.press('Space');await expect(page.locator('#feedback')).not.toContainText('Choose a block.');
});

test('play controls do not intercept assistive modifier combinations or composition',async({page})=>{
  for(const id of [25,43]) {
    await ready(page,id);
    if(id===25){await page.locator('#palette [data-op="A"]').focus();await placeFocusedStack(page);}
    else await page.locator('[data-circle-handle]').first().focus();
    const before=await page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history}));
    const prevented=await page.evaluate(()=>{
      const events=[{key:'z',ctrlKey:true,altKey:true},{key:'ArrowRight',ctrlKey:true,altKey:true},{key:'ArrowLeft',altKey:true},{key:'ArrowDown',metaKey:true},{key:'Delete',ctrlKey:true,shiftKey:true},{key:'Enter',altKey:true},{key:'h',altKey:true},{key:'n',isComposing:true},{key:'m',metaKey:true},{key:'m',altKey:true},{key:'m',isComposing:true}];
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

for(const platform of ['MacIntel','Win32'])test(`compact keycaps retain assigned positions and only show available keyboard actions on ${platform}`,async({page},testInfo)=>{
  await page.addInitScript(platform=>Object.defineProperty(navigator,'platform',{get:()=>platform}),platform);
  for(const size of [{width:1146,height:850},{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(size);await ready(page);
    await expect(page.locator('.keyboard-focus-cue:visible,.button-hotkey:visible')).toHaveCount(0);
    const add=page.locator('#palette [data-op="A"]');await add.focus();await page.keyboard.press('Shift');
    await expect(page.locator('.keyboard-focus-cue:visible kbd:visible')).toHaveText(['Space']);
    await expect(cue(page)).toHaveCount(0);
    await expect(page.locator('#undo .button-hotkey')).toBeHidden();await expect(page.locator('#redo .button-hotkey')).toBeHidden();
    await placeFocusedStack(page);
    const block=page.locator('.part-body');await expect(block).toBeFocused();
    await expect(cue(page).locator('kbd:visible')).toHaveText(['Space','⌫']);
    await expect(cue(page)).toHaveAttribute('data-directions','xdown');
    await expect(block).toHaveAttribute('aria-describedby','block-keyboard-help');
    await expect(page.locator('#block-tooltip')).toBeHidden();
    await expect(page.locator('#launch .button-hotkey')).toHaveText('Enter');await expect(page.locator('#launch .button-hotkey')).toBeVisible();
    await expect(page.locator('#undo .button-hotkey')).toBeVisible();await expect(page.locator('#undo .button-hotkey')).toHaveText(/⌘\+Z|Ctrl\+Z/);
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
    await add.focus();await expect(add.locator('.button-hotkey')).toBeVisible();
    await page.keyboard.press('Control+z');await idle(page);
    await expect(page.locator('#undo .button-hotkey')).toBeHidden();await expect(page.locator('#redo .button-hotkey')).toBeVisible();
    await expect(page.locator('#redo .button-hotkey')).toHaveText(/⌘\+⇧\+Z|Ctrl\+⇧\+Z/);
    await page.keyboard.press('Control+Shift+z');await idle(page);await expect(page.locator('#undo .button-hotkey')).toBeVisible();await expect(page.locator('#redo .button-hotkey')).toBeHidden();
    await add.focus();await page.keyboard.press('Space');await idle(page);await page.keyboard.press('Control+z');await idle(page);
    await expect(page.locator('#undo .button-hotkey')).toBeVisible();await expect(page.locator('#redo .button-hotkey')).toBeVisible();
    const undoCap=await page.locator('#undo .button-hotkey').boundingBox(),redoCap=await page.locator('#redo .button-hotkey').boundingBox();
    expect(undoCap.x+undoCap.width).toBeLessThanOrEqual(redoCap.x);
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
  const guidance=()=>page.locator('#feedback').evaluate(el=>({text:el.textContent,hidden:el.hidden}));
  const normal=await guidance();
  const second=page.locator('[data-empty="1"]');await second.focus();
  for(const pressed of ['true','false','true']) {
    await page.keyboard.press('Space');await expect(second).toBeFocused();await expect(second).toHaveAttribute('aria-pressed',pressed);
    if(pressed==='true'){await expect(page.locator('#feedback')).toBeVisible();await expect(page.locator('#feedback')).toHaveText('Choose a block.');}
    else expect(await guidance()).toEqual(normal);
  }
  await page.keyboard.press('Escape');await expect(second).toHaveAttribute('aria-pressed','false');expect(await guidance()).toEqual(normal);
  await page.keyboard.press('Space');await page.locator('.recipe-heading h2').click();await expect(second).toHaveAttribute('aria-pressed','false');expect(await guidance()).toEqual(normal);
  await second.focus();await page.keyboard.press('Space');
  expect(await page.evaluate(()=>window.angouri.history)).toEqual({undo:0,redo:0});
  await page.locator('#palette [data-op="H"]').focus();await placeFocusedStack(page);
  const half=await page.evaluate(()=>window.angouri.state.nodes[0].id);
  expect(await page.evaluate(()=>window.angouri.slots)).toEqual([null,half,null,null,null]);
  const first=page.locator('[data-empty="0"]');await first.focus();await page.keyboard.press('Space');
  await expect(first).toBeFocused();await expect(first).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('Tab');await expect(page.locator(`[data-stage="${half}"]`)).toBeFocused();
  await page.keyboard.press('Space');await idle(page);
  await expect(second).toBeFocused();await expect(second).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#feedback')).not.toContainText('Choose a block.');
  expect(await page.evaluate(()=>window.angouri.slots)).toEqual([half,null,null,null,null]);
  expect(await page.evaluate(()=>window.angouri.history)).toEqual({undo:2,redo:0});
  await page.keyboard.press('Space');await expect(second).toHaveAttribute('aria-pressed','true');
  // Moving between indistinguishable holes still moves the insertion choice,
  // without inventing a recipe-history change.
  await page.keyboard.press('ArrowRight');await idle(page);
  await expect(page.locator('[data-empty="2"]')).toBeFocused();await expect(page.locator('[data-empty="2"]')).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>window.angouri.history)).toEqual({undo:2,redo:0});
  await page.locator('#palette [data-op="A"]').focus();await placeFocusedStack(page);
  const add=await page.evaluate(()=>window.angouri.state.nodes.at(-1).id);
  await expect(page.locator(`[data-stage="${add}"]`)).toBeFocused();
  expect(await page.evaluate(()=>window.angouri.slots)).toEqual([half,null,add,null,null]);
  await page.keyboard.press('Control+z');await idle(page);
  expect(await page.evaluate(()=>window.angouri.slots)).toEqual([half,null,null,null,null]);
});

test('directional placement crosses a fixed station without moving it and return remains undoable',async({page})=>{
  await ready(page,54);const original=await page.evaluate(()=>window.angouri.state);
  await page.locator('#palette [data-op="H"]').focus();await placeFocusedStack(page);
  const id=await page.evaluate(()=>window.angouri.state.nodes.find(n=>n.op==='H').id);
  await expect(page.locator(`[data-stage="${id}"]`)).toBeFocused();
  await page.keyboard.press('ArrowRight');await idle(page);
  expect(await page.evaluate(()=>window.angouri.slots.slice(0,3))).toEqual([null,original.station.id,id]);
  await expect(page.locator(`[data-stage="${id}"]`)).toBeFocused();
  await page.keyboard.press('Delete');await idle(page);await expect(page.locator('[data-empty="2"]')).toBeFocused();
  expect(await page.evaluate(()=>window.angouri.state)).toEqual(original);
  await page.keyboard.press('Control+z');await idle(page);
  expect(await page.evaluate(()=>window.angouri.slots.slice(0,3))).toEqual([null,original.station.id,id]);
});

test('Space repeats the current stack while number entry follows the block and deletion keeps editing local',async({page})=>{
  await ready(page,3);await page.locator('#menu-open').click();await page.locator('#nav-create').click();await idle(page);
  const negate=page.locator('#palette [data-op="N"]');await negate.focus();
  for(const key of ['Space','Space']) {
    await page.keyboard.press(key);await idle(page);await expect(negate).toBeFocused();
    await expect(cue(page)).toHaveCount(0);
  }
  const earlier=await page.evaluate(()=>window.angouri.state.nodes);
  expect(earlier.map(n=>n.op)).toEqual(['N','N']);
  await page.keyboard.press('3');await idle(page);
  const added=await page.evaluate(()=>window.angouri.state.nodes.at(-1).id);
  await expect(page.locator(`[data-stage="${added}"]`)).toBeFocused();
  await expect(cue(page)).toHaveAttribute('data-directions','xdown');
  const beforeReturn=await page.evaluate(()=>window.angouri.slots);
  await page.keyboard.press('ArrowDown');await idle(page);await expect(page.locator('[data-empty="2"]')).toBeFocused();
  expect(await page.evaluate(()=>window.angouri.state.nodes)).toEqual(earlier);
  await page.keyboard.press('Control+z');await idle(page);
  expect(await page.evaluate(()=>window.angouri.slots)).toEqual(beforeReturn);
  await page.keyboard.press('Control+Shift+z');await idle(page);
  expect(await page.evaluate(()=>window.angouri.state.nodes)).toEqual(earlier);
  // Create has one spare slot. If removal collapses its old last slot, keep
  // the nearest insertion position instead of losing focus to the deck/body.
  await page.locator('.part-body').last().focus();await page.keyboard.press('ArrowRight');await idle(page);
  await page.keyboard.press('ArrowDown');await idle(page);await expect(page.locator('[data-empty="1"]')).toBeFocused();
  await page.keyboard.press('3');await idle(page);await expect(page.locator('[data-cell="1"] .part-body')).toBeFocused();
  expect(await page.evaluate(()=>window.angouri.state.nodes.map(n=>n.op))).toEqual(['N','N']);

  await ready(page);const add=page.locator('#palette [data-op="A"]');await add.focus();
  for(const key of ['Space','Space']){await page.keyboard.press(key);await idle(page);await expect(add).toBeFocused();}
  await page.keyboard.press('2');await idle(page);await expect(page.locator('.part-body').last()).toBeFocused();
  await page.keyboard.press('Delete');await idle(page);await expect(page.locator('[data-empty="2"]')).toBeFocused();
  expect(await page.evaluate(()=>window.angouri.state.nodes.map(n=>n.op))).toEqual(['A','A']);

  await ready(page,3);await page.locator('#palette [data-op="H"]').focus();
  await page.keyboard.press('Space');await idle(page);await expect(page.locator('#palette [data-op="A"]')).toBeFocused();
  await page.keyboard.press('Space');await idle(page);await expect(page.locator('#launch')).toBeFocused();
  // Up has no placement action in minimal choice puzzles either.
  await ready(page,2);await page.keyboard.press('Tab');await expect(cue(page)).toHaveCount(0);
  await page.keyboard.press('ArrowUp');expect(await page.evaluate(()=>window.angouri.state.nodes)).toEqual([]);
});

async function beginFrames(page) {
  await page.evaluate(()=>{
    window.recipeFrames=[];window.recipeFramesDone=false;const start=performance.now();
    const sample=()=>requestAnimationFrame(()=>setTimeout(()=>{
      const active=document.activeElement,part=active.closest('.recipe-part,.empty-slot'),cue=document.querySelector('.keyboard-arrows');
      if(part&&cue&&!cue.hidden) {
        const r=active.getBoundingClientRect(),c=cue.getBoundingClientRect(),after=active.getBoundingClientRect();
        // WebKit can advance a compositor animation between geometry reads.
        // Bracket the cue read with its parent's positions, including borders,
        // rather than treating two different instants as the same frame.
        const offsetError=(value,start,end)=>Math.max(Math.min(start,end)-value,value-Math.max(start,end),0);
        const overlaps=[...document.querySelectorAll('.recipe-part,.empty-slot')].filter(other=>other!==part).map(other=>{
          const b=other.getBoundingClientRect();return {left:Math.max(r.left,b.left),right:Math.min(r.right,b.right),top:Math.max(r.top,b.top),bottom:Math.min(r.bottom,b.bottom)};
        }).filter(b=>b.right-b.left>2&&b.bottom-b.top>2);
        const above=overlaps.every(b=>document.elementFromPoint((b.left+b.right)/2,(b.top+b.bottom)/2)?.closest('.recipe-part,.empty-slot')===part);
        window.recipeFrames.push({id:active.dataset.stage??`empty:${active.dataset.empty}`,x:r.x,faceX:part.querySelector('.recipe-face,.empty-face').getBoundingClientRect().x,above,overlaps:overlaps.length,attached:cue.parentElement===active,cueError:offsetError(c.x,r.left+active.clientLeft-6,after.left+active.clientLeft-6),topError:offsetError(c.top,r.top+active.clientTop-9,after.top+active.clientTop-9),moving:part.getAnimations({subtree:true}).some(a=>a.id==='recipe-move'&&a.playState==='running')});
      }
      if(performance.now()-start<520)sample();else window.recipeFramesDone=true;
    },0));sample();
  });
}
async function checkFrames(page,stationary=false) {
  await page.waitForFunction(()=>window.recipeFramesDone);
  const frames=await page.evaluate(()=>window.recipeFrames),moving=frames.filter(frame=>frame.moving);
  await test.info().attach('recipe-frames',{body:JSON.stringify(frames),contentType:'application/json'});
  expect(moving.length).toBeGreaterThan(2);
  expect(frames.every(frame=>frame.attached),'keycaps stay attached to the focused control').toBe(true);
  expect(Math.max(...frames.map(f=>f.cueError))).toBeLessThan(1.1);
  expect(Math.max(...frames.map(f=>f.topError))).toBeLessThan(1.1);
  if(!stationary)expect(frames.every(frame=>frame.above),'focused piece paints above every overlapping neighbour').toBe(true);
  const moved=frames.filter(frame=>frame.id===frames.at(-1).id);
  expect(Math.max(...moved.map(f=>f.faceX))-Math.min(...moved.map(f=>f.faceX))).toBeGreaterThan(10);
  const focusTravel=Math.max(...moved.map(f=>f.x))-Math.min(...moved.map(f=>f.x));
  if(stationary)expect(focusTravel,'Space keeps focus at the receiving slot throughout the slide').toBeLessThan(1.1);
  else expect(focusTravel).toBeGreaterThan(10);
}

test('a block moving into a hole leaves stationary empty faces underneath without extra controls or scrolling',async({page},testInfo)=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  for(const [level,width,height] of [[25,1146,850],[54,320,568]]) {
    await page.setViewportSize({width,height});await ready(page,level);
    await page.keyboard.press('1');await idle(page);await settled(page);
    const before=await page.evaluate(()=>({slots:window.angouri.slots,history:window.angouri.history,cells:document.querySelectorAll('#construction [data-cell]').length,extents:[...document.querySelectorAll('.pipeline,.rail-slots')].map(el=>[el.scrollWidth,el.scrollHeight])}));
    await page.evaluate(()=>{
      window.pausedRecipeMoves=[];
      const animate=Element.prototype.animate;
      Element.prototype.animate=function(frames,options){
        const animation=animate.call(this,frames,options);
        if(options?.id==='recipe-move'){animation.pause();animation.currentTime=0;window.pausedRecipeMoves.push(animation);}
        return animation;
      };
    });
    await page.keyboard.press('ArrowRight');await idle(page);
    await expect(page.locator('.slot-underlay')).toHaveCount(1);await expect(page.locator('.slot-underlay')).toHaveAttribute('aria-hidden','true');
    const frames=[];
    for(const time of [0,110,220]) {
      await page.evaluate(time=>window.pausedRecipeMoves.forEach(animation=>{animation.currentTime=time;}),time);
      frames.push(await page.evaluate(()=>{
        const moving=document.activeElement,face=moving.querySelector('.recipe-face'),vacant=document.querySelector('[data-empty="0"]'),underlay=document.querySelector('.slot-underlay');
        return {piece:face.getBoundingClientRect().toJSON(),hole:underlay.getBoundingClientRect().toJSON(),vacancyOpacity:getComputedStyle(vacant).opacity,vacancyAnimations:vacant.getAnimations({subtree:true}).length,extraControls:underlay.matches('button,[tabindex]')||!!underlay.querySelector('button,[tabindex]')};
      }));
      if(time===110)await page.screenshot({path:testInfo.outputPath(`block-above-holes-${level}-${width}.png`)});
    }
    expect(frames.every(frame=>frame.vacancyOpacity==='1'&&frame.vacancyAnimations===0&&!frame.extraControls)).toBe(true);
    expect(Math.max(...frames.map(frame=>frame.hole.x))-Math.min(...frames.map(frame=>frame.hole.x))).toBeLessThan(1.1);
    expect(frames[2].piece.x-frames[0].piece.x).toBeGreaterThan(50);
    expect(frames[1].piece.x).toBeGreaterThan(frames[0].piece.x);expect(frames[1].piece.x).toBeLessThan(frames[2].piece.x);
    expect(Math.abs(frames[2].piece.x-frames[2].hole.x)).toBeLessThan(1.1);
    expect(Math.abs(frames[2].piece.width-frames[2].hole.width)).toBeLessThan(1.1);
    expect(await page.locator('#construction [data-cell]').count()).toBe(before.cells);
    const extents=await page.locator('.pipeline,.rail-slots').evaluateAll(es=>es.map(el=>[el.scrollWidth,el.scrollHeight]));
    for(let i=0;i<extents.length;i++)for(let axis=0;axis<2;axis++)expect(Math.abs(extents[i][axis]-before.extents[i][axis])).toBeLessThanOrEqual(1);
    expect(await page.evaluate(()=>[scrollX,scrollY])).toEqual([0,0]);
    expect(await page.evaluate(()=>window.angouri.history.undo)).toBe(before.history.undo+1);
    await page.evaluate(()=>{window.pausedRecipeMoves.forEach(animation=>animation.finish());return Promise.all(window.pausedRecipeMoves.map(animation=>animation.finished));});
    await expect(page.locator('.slot-underlay')).toHaveCount(0);
    await page.keyboard.press('ArrowLeft');await idle(page);await expect(page.locator('.slot-underlay')).toHaveCount(1);
    await page.evaluate(()=>window.pausedRecipeMoves.forEach(animation=>animation.cancel()));await expect(page.locator('.slot-underlay')).toHaveCount(0);
    expect(await page.evaluate(()=>window.angouri.slots)).toEqual(before.slots);
  }
});

test('arrows carry focus while Space swaps keep focus at the receiving slot throughout the animation',async({page},testInfo)=>{
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
  await beginFrames(page);await page.keyboard.press('Space');await idle(page);await checkFrames(page,true);
  await expect(first).toBeFocused();await expect(first).toHaveAttribute('aria-pressed','false');await expect(page.locator('#construction')).not.toHaveClass(/has-selection/);expect(await page.evaluate(()=>window.angouri.slots.slice(0,2))).toEqual([nodes[1].id,nodes[0].id]);
  expect(await slots()).toEqual(original);
  await page.screenshot({path:testInfo.outputPath('space-swap.png')});
  await page.keyboard.press('Control+z');await idle(page);await settled(page);
  expect(await page.evaluate(()=>window.angouri.slots.slice(0,2))).toEqual(nodes.map(n=>n.id));
});

test('empty arrow moves animate through identical holes, reversals and filled neighbours without phantom history',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await ready(page);
  await page.locator('[data-empty="0"]').focus();await page.keyboard.press('Shift');
  const original=await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}));
  await beginFrames(page);await page.keyboard.press('ArrowRight');await idle(page);
  await page.waitForTimeout(60);await page.keyboard.press('ArrowRight');await idle(page);await checkFrames(page);
  await expect(page.locator('[data-empty="2"]')).toBeFocused();await expect(page.locator('[data-empty="2"]')).toHaveAttribute('aria-pressed','false');
  await page.keyboard.press('Space');await beginFrames(page);await page.keyboard.press('ArrowRight');await idle(page);
  await page.waitForTimeout(60);await page.keyboard.press('ArrowLeft');await idle(page);await checkFrames(page);
  await expect(page.locator('[data-empty="2"]')).toBeFocused();await expect(page.locator('[data-empty="2"]')).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}))).toEqual(original);
  await page.keyboard.press('ArrowLeft');await idle(page);await settled(page);
  await page.keyboard.press('2');await idle(page);await settled(page);await page.keyboard.press('Escape');
  const block=await page.evaluate(()=>window.angouri.state.nodes[0].id);
  await page.locator('[data-empty="0"]').focus();await beginFrames(page);await page.keyboard.press('ArrowRight');await idle(page);await checkFrames(page);
  await expect(page.locator('[data-empty="1"]')).toBeFocused();expect(await page.evaluate(()=>window.angouri.slots.slice(0,2))).toEqual([block,null]);
  expect(await page.evaluate(()=>window.angouri.history)).toEqual({undo:2,redo:0});
  await page.keyboard.press('Control+z');await idle(page);expect(await page.evaluate(()=>window.angouri.slots.slice(0,2))).toEqual([null,block]);
  await page.emulateMedia({reducedMotion:'reduce'});await ready(page);
  await page.locator('[data-empty="0"]').focus();await page.keyboard.press('ArrowRight');await idle(page);
  await expect(page.locator('[data-empty="1"]')).toBeFocused();expect(await page.locator('#construction').evaluate(el=>el.getAnimations({subtree:true}).length)).toBe(0);
});

test('empty arrows skip the fixed machine with the same travelling focus and no boundary move',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await ready(page,54);
  await page.locator('[data-empty="0"]').focus();await page.keyboard.press('Shift');
  const original=await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}));
  await beginFrames(page);await page.keyboard.press('ArrowRight');await idle(page);await checkFrames(page);
  await expect(page.locator('[data-empty="2"]')).toBeFocused();
  await beginFrames(page);await page.keyboard.press('ArrowLeft');await idle(page);await checkFrames(page);
  await expect(page.locator('[data-empty="0"]')).toBeFocused();await page.keyboard.press('ArrowLeft');await idle(page);
  expect(await page.locator('[data-empty="0"]').evaluate(el=>el.getAnimations({subtree:true}).length)).toBe(0);
  expect(await page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}))).toEqual(original);
});

test('Space destinations stay focused as blocks and empty faces arrive',async({page},testInfo)=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await ready(page);await page.keyboard.press('2');await idle(page);await settled(page);
  const block=page.locator('.part-body');await page.keyboard.press('Space');await page.keyboard.press('Tab');await expect(page.locator('[data-empty="1"]')).toBeFocused();
  const destination=await page.locator('[data-empty="1"]').boundingBox();
  await beginFrames(page);await page.keyboard.press('Space');await idle(page);await checkFrames(page,true);
  await expect(block).toBeFocused();expect(Math.abs((await block.boundingBox()).x-destination.x)).toBeLessThan(1.1);
  await expect(block).toHaveAttribute('aria-pressed','false');
  await page.locator('[data-empty="0"]').focus();await page.keyboard.press('Space');await page.keyboard.press('Tab');await expect(block).toBeFocused();
  await beginFrames(page);await page.keyboard.press('Space');await idle(page);await checkFrames(page,true);
  await expect(page.locator('[data-empty="1"]')).toBeFocused();await expect(page.locator('[data-empty="1"]')).toHaveAttribute('aria-pressed','false');
  const history=await page.evaluate(()=>window.angouri.history);
  await page.keyboard.press('Space');await page.locator('[data-empty="3"]').focus();
  await beginFrames(page);await page.keyboard.press('Space');await idle(page);await checkFrames(page,true);
  await expect(page.locator('[data-empty="3"]')).toBeFocused();await expect(page.locator('[data-empty="3"]')).toHaveAttribute('aria-pressed','false');
  expect(await page.evaluate(()=>window.angouri.history)).toEqual(history);
  await page.screenshot({path:testInfo.outputPath('empty-destination.png')});
});

test('offscreen arrow moves reveal the final block and keep its ring inside the rail',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  for(const size of [{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(size);await ready(page);await page.locator('#palette [data-op="A"]').focus();
    await placeFocusedStack(page);await settled(page);
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
    await page.keyboard.press('Delete');await idle(page);await expect(page.locator('[data-empty="5"]')).toBeFocused();
    await page.keyboard.press('Control+z');await idle(page);expect(await page.evaluate(()=>window.angouri.slots)).toEqual(before);
    await page.locator('[data-empty="4"]').focus();await page.keyboard.press('ArrowRight');await idle(page);await settled(page);
    await expect(page.locator('[data-empty="5"]')).toBeFocused();
    const edges=await page.locator('[data-empty="5"]').evaluate(el=>{
      const r=el.getBoundingClientRect(),rail=el.closest('.pipeline'),box=rail.getBoundingClientRect();
      return [r.left-6-(box.left+rail.clientLeft),box.left+rail.clientLeft+rail.clientWidth-r.right-6];
    });for(const edge of edges)expect(edge).toBeGreaterThanOrEqual(-1);
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
