import {test,expect} from '@playwright/test';

const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
const snapshot=page=>page.evaluate(()=>({state:window.angouri.state,slots:window.angouri.slots,history:window.angouri.history}));
async function ready(page) {
  await page.goto('/#level=4&view=flight');
  await page.waitForFunction(()=>window.angouri?.state&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
}
async function place(page,op) {await page.locator(`[data-op="${op}"]`).click();await idle(page);}

for(const [pickup,destination] of [['stock','0'],['stock','1'],['placed','outside']]) {
  test(`Undo cancels a ${pickup} pickup before acknowledgement and release at ${destination} keeps Redo`,async({page})=>{
    await ready(page);await place(page,'H');const original=await snapshot(page);
    // Hold the actual worker request until the pointer has been released, so
    // the test covers the pending window independently of machine speed.
    await page.evaluate(()=>{
      const post=Worker.prototype.postMessage;let hold=true;window.editingRequests=[];
      Worker.prototype.postMessage=function(message,...rest){
        window.editingRequests.push(message.request?.action?.type);
        if(hold&&message.request?.action?.type==='evaluate') {
          hold=false;window.releaseEditingRequest=()=>post.call(this,message,...rest);return;
        }
        return post.call(this,message,...rest);
      };
    });
    const from=await page.locator(pickup==='stock'?'[data-op="A"]':'.part-body').boundingBox();
    const to=destination==='outside'?{x:from.x+from.width/2,y:from.y-50}:await page.locator(`[data-cell="${destination}"]`).evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
    await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:5});
    await expect(page.locator('#playground')).toHaveClass(/is-dragging/);
    await page.keyboard.press('Control+z');await page.waitForFunction(()=>typeof window.releaseEditingRequest==='function');
    const pending=await page.evaluate(()=>({busy:document.querySelector('#playground').getAttribute('aria-busy'),dragging:document.querySelector('#playground').classList.contains('is-dragging'),held:document.querySelectorAll('.dragging,.drop-target,.return-target').length}));
    await page.mouse.up();await expect(page.locator('#playground')).toHaveAttribute('aria-busy','true');
    await page.evaluate(()=>window.releaseEditingRequest());await idle(page);
    expect(pending).toEqual({busy:'true',dragging:false,held:0});
    expect((await snapshot(page)).state.nodes).toEqual([]);
    expect((await snapshot(page)).history).toEqual({undo:0,redo:1});
    expect(await page.evaluate(()=>window.editingRequests)).toEqual(['evaluate']);
    await expect(page.locator('.drag-ghost')).toHaveCount(0);await expect(page.locator('#feedback')).not.toHaveClass(/error/);
    await page.locator('#redo').click();await idle(page);expect(await snapshot(page)).toEqual(original);
  });
}

test('a rejected stock drop preserves the selected replacement and its history',async({page})=>{
  await ready(page);await page.locator('#menu-open').click();await page.locator('#nav-create').click();await idle(page);
  await place(page,'F');await page.locator('.part-body').click();const original=await snapshot(page),floor=original.state.nodes[0];
  await page.locator('[data-op="D"]').dragTo(page.locator('[data-empty="1"]'));await idle(page);
  await expect(page.locator('#feedback')).toContainText('Find slope cannot follow this construction because it has a jump');
  expect(await snapshot(page)).toEqual(original);
  await expect(page.locator(`[data-stage="${floor.id}"]`)).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-return]')).toHaveAttribute('data-return',floor.id);
  await expect(page.locator('#palette')).toHaveAttribute('aria-label','Replace the selected block or return it');
  await place(page,'A');const replacement=await snapshot(page);
  expect(replacement.state.nodes.map(node=>node.op)).toEqual(['A']);
  expect(replacement.state.nodes[0].id).not.toBe(floor.id);
  expect(replacement.history).toEqual({undo:2,redo:0});
  await expect(page.locator('.part-body[aria-pressed="true"],[data-return]')).toHaveCount(0);
  await page.locator('#undo').click();await idle(page);
  expect((await snapshot(page)).state).toEqual(original.state);expect((await snapshot(page)).slots).toEqual(original.slots);
  await page.locator('#redo').click();await idle(page);expect(await snapshot(page)).toEqual(replacement);
});

test('deliberate stock, reorder and outside-return drops each commit once',async({page})=>{
  await ready(page);
  await page.locator('[data-op="A"]').dragTo(page.locator('[data-cell="2"]'));await idle(page);
  const add=(await snapshot(page)).state.nodes[0];expect(add.op).toBe('A');expect((await snapshot(page)).slots[2]).toBe(add.id);
  await page.locator('[data-op="H"]').dragTo(page.locator('[data-cell="2"]'));await idle(page);
  const inserted=await snapshot(page),halve=inserted.state.nodes[0];
  expect(inserted.state.nodes.map(node=>node.op)).toEqual(['H','A']);expect(inserted.history).toEqual({undo:2,redo:0});
  await page.locator(`[data-part="${add.id}"]`).dragTo(page.locator('[data-cell="2"]'));await idle(page);
  const reordered=await snapshot(page);expect(reordered.state.nodes).toEqual([add,halve]);expect(reordered.history).toEqual({undo:3,redo:0});
  const from=await page.locator(`[data-part="${add.id}"]`).boundingBox();
  await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(from.x+from.width/2,from.y-50,{steps:5});await page.mouse.up();await idle(page);
  expect((await snapshot(page)).state.nodes).toEqual([halve]);expect((await snapshot(page)).history).toEqual({undo:4,redo:0});
  await expect(page.locator('.drag-ghost')).toHaveCount(0);await expect(page.locator('#playground')).not.toHaveClass(/is-dragging/);
  await page.locator('#undo').click();await idle(page);
  expect((await snapshot(page)).state).toEqual(reordered.state);expect((await snapshot(page)).slots).toEqual(reordered.slots);
});
