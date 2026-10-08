// Accepted moves have already revealed their final layout. Scrolling toward
// their transient painted position would undo that reveal during the slide.
function movingCell(target:HTMLElement) {
  return target.closest('.recipe-part')?.getAnimations().some(animation=>animation.id==='recipe-move'&&animation.playState!=='finished');
}

export function revealFocusRing(target:HTMLElement) {
  if(movingCell(target))return;
  const face=target.querySelector<HTMLElement>('.ingredient-surface')??target;
  const style=getComputedStyle(face);
  const margin=target.matches('input[type=range]')?8:Math.max(0,parseFloat(style.outlineWidth)+parseFloat(style.outlineOffset));
  const topMargin=document.documentElement.dataset.focusModality==='keyboard'&&target.matches('.part-body,.empty-slot,.ingredient')?Math.max(10,margin):margin;
  for(let parent=face.parentElement;parent;parent=parent.parentElement) {
    const s=getComputedStyle(parent),rect=face.getBoundingClientRect(),box=parent.getBoundingClientRect();
    const left=box.left+parent.clientLeft,top=box.top+parent.clientTop;
    const dx=rect.left-margin<left?rect.left-margin-left:Math.max(0,rect.right+margin-left-parent.clientWidth);
    const dy=rect.top-topMargin<top?rect.top-topMargin-top:Math.max(0,rect.bottom+margin-top-parent.clientHeight);
    // Correct only local scrollports. Never resize or scroll the page, and do
    // not move a fitting inspection merely because another control focused.
    if(/auto|scroll/.test(s.overflowX)&&parent.scrollWidth>parent.clientWidth)parent.scrollLeft+=dx;
    if(/auto|scroll/.test(s.overflowY)&&parent.scrollHeight>parent.clientHeight)parent.scrollTop+=dy;
  }
}

/** Reveal a recipe destination horizontally without moving the page to it. */
export function revealRailCell(cell:HTMLElement|undefined|null) {
  if(!cell||movingCell(cell))return;
  for(const rail of [cell.closest<HTMLElement>('.rail-slots'),cell.closest<HTMLElement>('.pipeline')]) {
    if(!rail||rail.scrollWidth<=rail.clientWidth)continue;
    const target=cell.getBoundingClientRect(),box=rail.getBoundingClientRect();
    const left=box.left+rail.clientLeft+8,right=box.left+rail.clientLeft+rail.clientWidth-8;
    const delta=target.left<left?target.left-left:target.right>right?target.right-right:0;
    if(delta)rail.scrollLeft+=delta;
  }
}
