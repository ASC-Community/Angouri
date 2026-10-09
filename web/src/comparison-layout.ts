const observed=new WeakSet<HTMLTableSectionElement>();

/** Keep native table column sizing, with a fixed header above a separate row
 * scroller. Only horizontal inspection moves the header; rows never pass under it. */
export function sizeEquationTables(root:HTMLElement) {
  for(const table of root.querySelectorAll<HTMLTableElement>('.value-table table')) {
    const body=table.tBodies[0],head=table.tHead;
    if(!body||!head)return;
    const position={left:body.scrollLeft,top:body.scrollTop};
    const gutter=table.classList.contains('comparison-sized')?body.offsetWidth-body.clientWidth:0;
    const measure=()=>{
      table.classList.remove('comparison-sized');
      table.style.width=`calc(100% - ${gutter}px)`;
      const columns=[...head.rows[0].cells].map(cell=>cell.getBoundingClientRect().width);
      table.style.setProperty('--comparison-columns',columns.map(width=>`${width}px`).join(' '));
      table.style.width='';table.classList.add('comparison-sized');
    };
    measure();
    // The body focus border belongs to the stationary table, below its header.
    // Keep the native header height when columns reflow; never scroll this ring.
    table.style.setProperty('--comparison-header-height',`${head.getBoundingClientRect().height}px`);
    body.tabIndex=-1;body.setAttribute('aria-label','Comparison values');
    const align=()=>{
      head.style.transform=`translateX(${-body.scrollLeft}px)`;
      if(table.tFoot)table.tFoot.style.transform=`translateX(${-body.scrollLeft}px)`;
    };
    if(!observed.has(body)){observed.add(body);body.addEventListener('scroll',align,{passive:true});}
    body.scrollLeft=position.left;body.scrollTop=position.top;align();
  }
}
