// Fixture navigation must acknowledge the requested workspace, not just the
// current engine queue: the unsaved-work decision can still be reading storage.
function navigationFinished({mode,sourceId,fromDialog,allowGuard}) {
  const guard=document.querySelector('#leave-dialog')?.open;
  if(guard)return allowGuard;
  const game=window.angouri;
  return !document.querySelector(fromDialog)?.open&&game?.result&&
    document.querySelector('#playground')?.getAttribute('aria-busy')==='false'&&
    game.state.mode===mode&&(sourceId===undefined||game.state.sourceId===sourceId);
}

/** Only fixture navigation that deliberately permits discarding uses this. */
export async function discardToWorkspace(page,{mode,sourceId,fromDialog}) {
  const destination={mode,sourceId,fromDialog};
  await page.waitForFunction(navigationFinished,{...destination,allowGuard:true});
  if(await page.locator('#leave-dialog').isVisible())await page.locator('#leave-discard').click();
  await page.waitForFunction(navigationFinished,{...destination,allowGuard:false});
  await page.evaluate(()=>window.angouri.whenIdle());
}
