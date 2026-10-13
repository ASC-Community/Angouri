import {STORAGE_KEYS,readStoredJSON} from './storage-fixtures.mjs';
import {test,expect} from '@playwright/test';

const PREF='angouri:vine:v1:preferences';
const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
const ready=async(page,id=3)=>{
  await page.goto(`/#level=${id}&view=flight`);
  await page.waitForFunction(()=>window.angouri?.state&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
};
const preference=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),PREF);
const acknowledged=page=>page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history}));
const settings=async page=>{await page.locator('#menu-open').tap();await page.locator('#settings-open').tap();};
const motion=async(page,value)=>{
  await expect(page.locator('#motion-toggle')).toBeChecked({checked:value});
  expect(await page.locator('body').evaluate(body=>body.classList.contains('reduced-motion'))).toBe(value);
};
const centre=async locator=>{const r=await locator.boundingBox();return {x:r.x+r.width/2,y:r.y+r.height/2};};
const circlePaint=page=>page.evaluate(()=>({
  circle:window.angouri.state.circle,history:window.angouri.history,
  fields:[...document.querySelectorAll('[data-circle-value]')].map(el=>[el.dataset.circleValue,el.value]),
  centre:['cx','cy'].map(key=>document.querySelector('.circle-centre-mark').getAttribute(key)),
  rig:[...document.querySelectorAll('#launcher,#launcher-front,#cucumber')].map(el=>[el.id,el.getAttribute('transform')]),
  handles:[...document.querySelectorAll('[data-circle-handle]')].map(el=>[el.dataset.circleHandle,el.style.translate]),
  preview:document.querySelector('#scene').hasAttribute('data-circle-preview'),
}));
const circleUnit=page=>page.evaluate(()=>document.querySelector('#trajectory').getBBox().width/(2*window.angouri.result.circle.radius)*document.querySelector('#flight-svg').getScreenCTM().a);

test.use({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'no-preference'});

test('system motion stays live through preference writes, recipe saves and reload',async({page})=>{
  await ready(page);await motion(page,false);
  expect(await preference(page)).not.toHaveProperty('motion');
  await page.locator('#tab-flow').tap();
  await settings(page);await page.locator('#character-shortcuts').check();await page.keyboard.press('Escape');
  await page.locator('#menu-open').tap();await page.locator('#library-open').tap();
  await page.locator('#seed-name').fill('System motion');await page.locator('#favorite-save').tap();
  await expect(page.locator('[data-seed="0"]')).toBeVisible();await page.keyboard.press('Escape');
  expect(await preference(page)).toEqual({view:'flow',characterShortcuts:false});
  await page.emulateMedia({reducedMotion:'reduce'});await motion(page,true);
  await page.reload();await page.waitForFunction(()=>window.angouri?.state&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
  await motion(page,true);expect(await preference(page)).not.toHaveProperty('motion');
  await page.emulateMedia({reducedMotion:'no-preference'});await motion(page,false);
  await page.emulateMedia({reducedMotion:'reduce'});await motion(page,true);
  await page.locator('[data-op="H"]').tap();await idle(page);await page.locator('#launch').tap();
  expect(await page.evaluate(()=>window.angouri.flight.phase)).toBe('landed');
});

test('an explicit Skip animation choice overrides later system changes and reload',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await ready(page);await motion(page,true);
  await settings(page);await page.locator('#motion-toggle').uncheck();await page.keyboard.press('Escape');
  expect((await preference(page)).motion).toBe(false);
  await page.emulateMedia({reducedMotion:'no-preference'});await page.emulateMedia({reducedMotion:'reduce'});await motion(page,false);
  await page.reload();await page.waitForFunction(()=>window.angouri?.state&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
  await motion(page,false);
  await settings(page);await page.locator('#motion-toggle').check();await page.keyboard.press('Escape');
  await page.emulateMedia({reducedMotion:'no-preference'});await motion(page,true);
  expect((await preference(page)).motion).toBe(true);
});

for(const savedMotion of [false,true])test(`an existing explicit motion=${savedMotion} preference remains authoritative`,async({page})=>{
  await page.addInitScript(([key,motion])=>localStorage.setItem(key,JSON.stringify({view:'flight',motion})),[PREF,savedMotion]);
  await page.emulateMedia({reducedMotion:savedMotion?'no-preference':'reduce'});await ready(page);await motion(page,savedMotion);
  await page.emulateMedia({reducedMotion:savedMotion?'reduce':'no-preference'});await page.emulateMedia({reducedMotion:savedMotion?'no-preference':'reduce'});
  await motion(page,savedMotion);expect((await preference(page)).motion).toBe(savedMotion);
});

test('a live system motion change settles accepted edits and active Flight without changing history',async({page})=>{
  await ready(page);await page.locator('[data-op="H"]').tap();await idle(page);
  const before=await acknowledged(page);
  await page.emulateMedia({reducedMotion:'reduce'});await motion(page,true);
  await expect(page.locator('#scene')).not.toHaveAttribute('data-curve-transition',/./);
  expect(await acknowledged(page)).toEqual(before);
  await page.emulateMedia({reducedMotion:'no-preference'});await motion(page,false);
  await page.locator('#tab-flow').tap();
  await page.locator('#flow-position').evaluate(input=>{input.value='2';input.dispatchEvent(new Event('input',{bubbles:true}));});
  const probe=await page.locator('#flow-position').inputValue();
  await page.locator('#launch').tap();
  expect(await page.evaluate(()=>window.angouri.flight.phase)).toMatch(/releasing|flying/);
  await expect(page.locator('#flow-position')).toBeDisabled();
  await page.emulateMedia({reducedMotion:'reduce'});await motion(page,true);
  expect(await page.evaluate(()=>window.angouri.flight.phase)).toBe('landed');
  await expect(page.locator('#flow-position')).toBeEnabled();await expect(page.locator('#flow-position')).toHaveValue(probe);
  expect(await acknowledged(page)).toEqual(before);
  await expect(page.locator('.flow-goal[data-status="waiting"]')).toHaveCount(0);
  expect(await preference(page)).not.toHaveProperty('motion');
});

test('a live system motion change settles a Garden transfer and releases its completion gate',async({page})=>{
  await ready(page,82);await page.locator('[data-op="H"]').tap();await idle(page);
  await page.keyboard.press('Enter');
  await expect(page.locator('.garden-collection path')).toBeAttached();
  await expect(page.locator('[data-garden-done]')).toBeDisabled();
  const before=await acknowledged(page);
  await page.emulateMedia({reducedMotion:'reduce'});await motion(page,true);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  expect(await page.locator('.garden-collection').count()).toBe(0);
  await expect(page.locator('.garden-shell')).toHaveClass(/trace-complete/);
  await expect(page.locator('[data-garden-done]')).toBeEnabled();
  await expect(page.locator('[data-garden-done]')).toBeFocused();
  expect(await acknowledged(page)).toEqual(before);
  expect((await readStoredJSON(page,STORAGE_KEYS.progress)).completed).toEqual([82]);
  await page.keyboard.press('Space');await expect(page.locator('#garden-dialog')).toBeHidden();
  await expect(page.locator('#launch')).toBeEnabled();await expect(page.locator('#launch')).toHaveAttribute('data-action','continue');
});

test('a system motion change while Garden artwork loads leaves no pending collection',async({page})=>{
  await ready(page,82);await page.locator('[data-op="H"]').tap();await idle(page);
  let releaseArtwork,artworkRequested;
  const artworkGate=new Promise(resolve=>releaseArtwork=resolve),requested=new Promise(resolve=>artworkRequested=resolve);
  await page.route('**/cucumber.svg',async route=>{
    if(route.request().resourceType()==='fetch'){artworkRequested();await artworkGate;}
    await route.continue();
  });
  try {
    await page.keyboard.press('Enter');await requested;
    await expect(page.locator('.garden-loading')).toBeVisible();await expect(page.locator('.garden-collection')).toBeAttached();
    const before=await acknowledged(page);
    await page.emulateMedia({reducedMotion:'reduce'});await motion(page,true);
    await expect(page.locator('#launch')).toBeDisabled();
    releaseArtwork();
    await expect(page.locator('[data-garden-done]')).toBeEnabled();
    await expect(page.locator('[data-garden-done]')).toBeFocused();
    await expect(page.locator('.garden-collection')).toHaveCount(0);
    await expect(page.locator('.garden-shell')).toHaveClass(/trace-complete/);
    expect(await acknowledged(page)).toEqual(before);
  } finally {releaseArtwork();}
});

test('circle cancellation ignores another pointer and releases its own capture',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await ready(page,44);
  const before=await circlePaint(page),start=await centre(page.locator('[data-circle-handle="centre"]')),unit=await circleUnit(page);
  await page.evaluate(()=>document.querySelector('#scene').addEventListener('pointerdown',event=>window.circlePointer=event.pointerId,{once:true}));
  await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+unit,start.y,{steps:4});
  await expect(page.locator('[data-circle-value="x"]')).toHaveValue('3');
  const preview=await circlePaint(page);
  await page.evaluate(()=>{
    const scene=document.querySelector('#scene');
    for(const type of ['pointercancel','lostpointercapture'])scene.dispatchEvent(new PointerEvent(type,{pointerId:window.circlePointer+100,bubbles:true}));
  });
  expect(await circlePaint(page)).toEqual(preview);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>document.querySelector('#scene').hasPointerCapture(window.circlePointer))).toBe(false);
  await page.mouse.up();expect(await circlePaint(page)).toEqual(before);
  await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+unit,start.y,{steps:4});
  await expect(page.locator('[data-circle-value="x"]')).toHaveValue('3');
  await page.evaluate(()=>document.querySelector('#scene').releasePointerCapture(window.circlePointer));
  await page.mouse.move(start.x+unit+2,start.y);await page.mouse.up();
  expect(await circlePaint(page)).toEqual(before);
});

for(const firstRelease of ['owner','other'])test(`two circle touches preserve the owner when ${firstRelease} releases first`,async({page,browserName})=>{
  test.skip(browserName!=='chromium','Multiple native touch points require Chromium CDP; WebKit covers the pointer cancellation contract separately.');
  await page.emulateMedia({reducedMotion:'reduce'});await ready(page,44);
  const session=await page.context().newCDPSession(page),touch=(type,touchPoints)=>session.send('Input.dispatchTouchEvent',{type,touchPoints});
  const before=await circlePaint(page),start=await centre(page.locator('[data-circle-handle="centre"]')),unit=await circleUnit(page);
  const owner={...start,id:1};await touch('touchStart',[owner]);owner.x+=unit;await touch('touchMove',[owner]);
  await expect(page.locator('[data-circle-value="x"]')).toHaveValue('3');
  const preview=await circlePaint(page),other={...await centre(page.locator('[data-circle-handle="centre"]')),id:2};
  await touch('touchStart',[owner,other]);other.x+=unit/2;await touch('touchMove',[owner,other]);
  expect(await circlePaint(page)).toEqual(preview);
  await touch('touchEnd',[firstRelease==='owner'?owner:other]);
  if(firstRelease==='other')expect(await circlePaint(page)).toEqual(preview);
  await touch('touchEnd',[]);await idle(page);
  const committed=await circlePaint(page);
  expect(committed.circle).toEqual({x:'3',y:'0',radius:'1'});expect(committed.history).toEqual({undo:1,redo:0});
  expect(committed.fields).toEqual([['x','3'],['y','0']]);expect(committed.preview).toBe(false);
  expect(committed.centre).toEqual(preview.centre);
  await page.locator('#launch').tap();expect(await page.evaluate(()=>window.angouri.flight.phase)).toBe('landed');
  await page.locator('#undo').tap();await idle(page);expect(await circlePaint(page)).toEqual({...before,history:{undo:0,redo:1}});
});

test('cancelling two circle touches restores the acknowledged fields and artwork',async({page,browserName})=>{
  test.skip(browserName!=='chromium','This check uses Chromium touch cancellation.');
  await page.emulateMedia({reducedMotion:'reduce'});await ready(page,44);
  const session=await page.context().newCDPSession(page),touch=(type,touchPoints)=>session.send('Input.dispatchTouchEvent',{type,touchPoints});
  const before=await circlePaint(page),owner={...await centre(page.locator('[data-circle-handle="centre"]')),id:1},unit=await circleUnit(page);
  await touch('touchStart',[owner]);owner.x+=unit;await touch('touchMove',[owner]);
  await expect(page.locator('[data-circle-value="x"]')).toHaveValue('3');
  const other={...await centre(page.locator('[data-circle-handle="centre"]')),id:2};
  await touch('touchStart',[owner,other]);other.x+=unit/2;await touch('touchMove',[owner,other]);
  await touch('touchCancel',[]);await idle(page);
  expect(await circlePaint(page)).toEqual(before);
});
