/** Reveal a recipe destination horizontally without moving the page to it. */
export function revealRailCell(cell:HTMLElement|undefined|null) {
  if(!cell)return;
  for(const rail of [cell.closest<HTMLElement>('.rail-slots'),cell.closest<HTMLElement>('.pipeline')]) {
    if(!rail||rail.scrollWidth<=rail.clientWidth)continue;
    const target=cell.getBoundingClientRect(),box=rail.getBoundingClientRect();
    const left=box.left+rail.clientLeft,right=left+rail.clientWidth;
    const delta=target.left<left?target.left-left:target.right>right?target.right-right:0;
    if(delta)rail.scrollLeft+=delta;
  }
}
