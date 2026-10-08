const READERS='.final-equation,.value-table tbody,.flow-line,.flow-goals:not(:has(button)),.notes-reading,.dialog-reading';
const CONTAINERS='#scene,.recipe-content,.pipeline,.rail-slots,.notes-index,.flow-goals:has(button)';
type Directions=''|'x'|'y'|'xy';

function revealFocusRing(target:HTMLElement) {
  const face=target.querySelector<HTMLElement>('.ingredient-surface')??target;
  const style=getComputedStyle(face);
  const margin=target.matches('input[type=range]')?8:Math.max(0,parseFloat(style.outlineWidth)+parseFloat(style.outlineOffset));
  for(let parent=face.parentElement;parent;parent=parent.parentElement) {
    const s=getComputedStyle(parent),rect=face.getBoundingClientRect(),box=parent.getBoundingClientRect();
    const left=box.left+parent.clientLeft,top=box.top+parent.clientTop;
    const dx=rect.left-margin<left?rect.left-margin-left:Math.max(0,rect.right+margin-left-parent.clientWidth);
    const dy=rect.top-margin<top?rect.top-margin-top:Math.max(0,rect.bottom+margin-top-parent.clientHeight);
    // Correct only local scrollports. Never resize or scroll the page, and do
    // not move a fitting inspection merely because another control focused.
    if(/auto|scroll/.test(s.overflowX)&&parent.scrollWidth>parent.clientWidth)parent.scrollLeft+=dx;
    if(/auto|scroll/.test(s.overflowY)&&parent.scrollHeight>parent.clientHeight)parent.scrollTop+=dy;
  }
}

function scrollDirections(element:HTMLElement):Directions {
  if(!element.clientWidth||!element.clientHeight)return '';
  const style=getComputedStyle(element);
  const x=/auto|scroll/.test(style.overflowX)&&element.scrollWidth>element.clientWidth+1;
  const y=/auto|scroll/.test(style.overflowY)&&element.scrollHeight>element.clientHeight+1;
  return x?(y?'xy':'x'):(y?'y':'');
}

/** Reading panes join Tab order only when arrow keys can actually scroll
 * them. A small, noninteractive cue describes the focused control's existing
 * arrow action; ordinary menu buttons remain ordinary Tab destinations. */
export function installKeyboardAffordances(documentRoot:Document) {
  let frame=0;
  let pendingFocus:HTMLElement|undefined;
  const observed=new Set<Element>();
  const cue=documentRoot.createElement('span');
  cue.className='keyboard-arrows';cue.setAttribute('aria-hidden','true');cue.hidden=true;
  cue.innerHTML='<svg viewBox="0 0 60 34" fill="none" aria-hidden="true"><circle class="keyboard-knob-ring" cx="30" cy="17" r="13"/><path class="keyboard-horizontal" d="M10 11L4 17L10 23M50 11L56 17L50 23"/><path class="keyboard-vertical" d="M24 9L30 3L36 9M24 25L30 31L36 25"/></svg>';
  const showCue=()=>{
    const active=documentRoot.activeElement;
    if(documentRoot.documentElement.dataset.focusModality!=='keyboard'||!(active instanceof HTMLElement)||!active.getClientRects().length){cue.hidden=true;return;}
    let directions:Directions='',knob=false;
    if(active.matches('input[type=range]:not(:disabled)')){directions='x';knob=true;}
    else if(active.matches('[data-circle-handle]'))directions='xy';
    else if(active.matches('[role=tab],.part-body,.empty-slot'))directions='x';
    else if(active.matches(READERS))directions=scrollDirections(active);
    if(active.id==='tab-flight'&&scrollDirections(documentRoot.querySelector<HTMLElement>('#scene')!).includes('y'))directions='xy';
    if(!directions){cue.hidden=true;return;}
    const host=active.closest('dialog')??documentRoot.body;
    if(cue.parentElement!==host)host.append(cue);
    const rect=active.getBoundingClientRect();
    let width=30,height=18,left=rect.right-39,top=rect.top-9;
    if(knob) {
      const slider=active as HTMLInputElement;
      const min=Number(slider.min)||0,max=Number(slider.max)||100;
      let progress=Math.max(0,Math.min(1,(slider.valueAsNumber-min)/(max-min||1)));
      if(getComputedStyle(slider).direction==='rtl')progress=1-progress;
      width=60;height=34;left=rect.left+9.5+progress*(rect.width-19)-width/2;top=rect.top+(rect.height-height)/2;
    }
    cue.dataset.directions=directions;cue.classList.toggle('is-knob',knob);
    cue.style.width=`${width}px`;cue.style.height=`${height}px`;
    cue.style.left=`${Math.max(2,Math.min(window.innerWidth-width-2,left))}px`;
    cue.style.top=`${Math.max(2,Math.min(window.innerHeight-height-2,top))}px`;
    cue.hidden=false;
  };
  const resize=new ResizeObserver(()=>schedule());
  const measure=()=>{
    if(frame)cancelAnimationFrame(frame);
    frame=0;
    if(pendingFocus&&pendingFocus===documentRoot.activeElement)revealFocusRing(pendingFocus);
    pendingFocus=undefined;
    const readers=[...documentRoot.querySelectorAll<HTMLElement>(READERS)];
    const current=new Set<Element>();
    for(const reader of readers) {
      const directions=scrollDirections(reader),index=directions?0:-1;
      if(reader.tabIndex!==index)reader.tabIndex=index;
      reader.dataset.scrollDirections=directions;
      if(reader.matches('.value-table tbody'))reader.setAttribute('aria-label','Comparison values');
      current.add(reader);for(const child of reader.children)current.add(child);
    }
    for(const element of documentRoot.querySelectorAll<HTMLElement>(CONTAINERS))if(element.tabIndex!==-1)element.tabIndex=-1;
    for(const element of observed)if(!current.has(element)){resize.unobserve(element);observed.delete(element);}
    for(const element of current)if(!observed.has(element)){resize.observe(element);observed.add(element);}
    showCue();
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
  const focus=(event:FocusEvent)=>{if(event.target instanceof HTMLElement)pendingFocus=event.target;schedule();};
  const key=(event:KeyboardEvent)=>{
    // Update before the browser chooses the next sequential focus target.
    if(event.key==='Tab')measure();
    const active=documentRoot.activeElement;
    if(active instanceof HTMLElement&&active.matches(READERS)&&!event.altKey&&!event.ctrlKey&&!event.metaKey) {
      const directions=scrollDirections(active),horizontal=['ArrowLeft','ArrowRight'].includes(event.key);
      const vertical=['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key);
      const axis=horizontal?'left':'top',extent=horizontal?active.clientWidth:active.clientHeight;
      if((horizontal&&directions.includes('x'))||(vertical&&directions.includes('y'))) {
        event.preventDefault();
        if(event.key==='Home'||event.key==='End')active.scrollTo({[axis]:event.key==='Home'?0:active.scrollHeight});
        else active.scrollBy({[axis]:(['ArrowLeft','ArrowUp','PageUp'].includes(event.key)||(event.key===' '&&event.shiftKey)?-1:1)*(event.key.startsWith('Page')||event.key===' '?extent*.8:40)});
      }
    }
    if(active instanceof HTMLElement&&active.id==='tab-flight'&&['ArrowUp','ArrowDown','PageUp','PageDown'].includes(event.key)&&!event.altKey&&!event.ctrlKey&&!event.metaKey) {
      const scene=documentRoot.querySelector<HTMLElement>('#scene')!;
      if(scrollDirections(scene).includes('y')) {
        event.preventDefault();
        scene.scrollBy({top:(event.key.endsWith('Up')?-1:1)*(event.key.startsWith('Page')?scene.clientHeight*.8:40)});
      }
    }
    schedule();
  };
  documentRoot.addEventListener('keydown',key,true);
  documentRoot.addEventListener('focusin',focus,true);
  for(const event of ['focusout','input','pointerdown','scroll'])documentRoot.addEventListener(event,schedule,true);
  window.addEventListener('resize',schedule);documentRoot.fonts.ready.then(schedule);
  schedule();
  return {refresh:schedule,remove:()=>{
    cancelAnimationFrame(frame);resize.disconnect();cue.remove();
    documentRoot.removeEventListener('keydown',key,true);
    documentRoot.removeEventListener('focusin',focus,true);
    for(const event of ['focusout','input','pointerdown','scroll'])documentRoot.removeEventListener(event,schedule,true);
    window.removeEventListener('resize',schedule);
  }};
}
