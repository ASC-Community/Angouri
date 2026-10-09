import { revealFocusRing } from './scroll';

const READERS='.final-equation,.value-table tbody,.flow-line,.flow-goals:not(:has(button)),.notes-reading,.dialog-reading';
const CONTAINERS='#scene,.recipe-content,.pipeline,.rail-slots,.notes-index,.flow-goals:has(button)';
type Directions=''|'x'|'y'|'xy'|'xdown';

function scrollDirections(element:HTMLElement):Directions {
  if(!element.clientWidth||!element.clientHeight)return '';
  const style=getComputedStyle(element);
  const x=/auto|scroll/.test(style.overflowX)&&element.scrollWidth>element.clientWidth+1;
  const y=/auto|scroll/.test(style.overflowY)&&element.scrollHeight>element.clientHeight+1;
  return x?(y?'xy':'x'):(y?'y':'');
}

function anchorVisible(element:HTMLElement,rect:DOMRect,anchorY:number,anchorBottom=anchorY):boolean {
  let left=0,right=innerWidth,top=0,bottom=innerHeight;
  for(let parent=element.parentElement;parent;parent=parent.parentElement) {
    const style=getComputedStyle(parent),clipsX=/auto|scroll|hidden|clip/.test(style.overflowX),clipsY=/auto|scroll|hidden|clip/.test(style.overflowY);
    if(!clipsX&&!clipsY)continue;
    const box=parent.getBoundingClientRect();
    if(clipsX){left=Math.max(left,box.left+parent.clientLeft);right=Math.min(right,box.left+parent.clientLeft+parent.clientWidth);}
    if(clipsY){top=Math.max(top,box.top+parent.clientTop);bottom=Math.min(bottom,box.top+parent.clientTop+parent.clientHeight);}
  }
  return rect.left>=left-1&&rect.right<=right+1&&anchorY>=top-1&&anchorBottom<=bottom+1;
}

/** Reading panes join Tab order only when they can scroll. Compact keycaps
 * share the focus outline; ordinary menu buttons retain their Tab stops. */
export function installKeyboardAffordances(documentRoot:Document) {
  let frame=0;
  let pendingFocus:HTMLElement|undefined;
  const observed=new Set<Element>();
  const cue=documentRoot.createElement('span');
  cue.className='keyboard-focus-cue';cue.setAttribute('aria-hidden','true');cue.hidden=true;
  cue.innerHTML='<kbd class="keyboard-activate">Space</kbd><span class="keyboard-direction-key"><svg viewBox="0 0 60 34" fill="none" aria-hidden="true"><circle class="keyboard-knob-ring" cx="30" cy="17" r="13"/><path class="keyboard-horizontal" d="M10 11L4 17L10 23M50 11L56 17L50 23"/><path class="keyboard-up" d="M24 9L30 3L36 9"/><path class="keyboard-down" d="M24 25L30 31L36 25"/></svg></span><kbd class="keyboard-delete">⌫</kbd>';
  const activate=cue.querySelector<HTMLElement>('.keyboard-activate')!,arrows=cue.querySelector<HTMLElement>('.keyboard-direction-key')!,remove=cue.querySelector<HTMLElement>('.keyboard-delete')!;
  const mac=/Mac|iPhone|iPad/.test(navigator.platform);
  for(const [id,label] of [['undo',mac?'⌘+Z':'Ctrl+Z'],['redo',mac?'⌘+⇧+Z':'Ctrl+⇧+Z']]) {
    const cap=documentRoot.querySelector<HTMLElement>(`#${id} .button-hotkey`);if(cap)cap.textContent=label;
    documentRoot.querySelector<HTMLElement>(`#${id}`)?.setAttribute('title',`${id==='undo'?'Undo':'Redo'} (${label})`);
  }
  const showCue=()=>{
    const active=documentRoot.activeElement;
    if(documentRoot.documentElement.dataset.focusModality!=='keyboard'||!(active instanceof HTMLElement)||!active.getClientRects().length){cue.hidden=true;return;}
    let directions:Directions='',knob=false;
    if(active.matches('input[type=range]:not(:disabled)')){directions='x';knob=true;}
    else if(active.matches('[data-circle-handle]'))directions='xy';
    else if(active.matches('.part-body'))directions='xdown';
    else if(active.matches('[role=tab]'))directions=(active.closest<HTMLElement>('[role=tablist]')?.dataset.tabDirections as Directions|undefined)??'x';
    else if(active.matches('.empty-slot'))directions='x';
    else if(active.matches(READERS))directions=scrollDirections(active);
    if(active.id==='tab-flight'&&scrollDirections(documentRoot.querySelector<HTMLElement>('#scene')!).includes('y'))directions='xy';
    if(documentRoot.documentElement.dataset.shortcutLabels==='hidden'&&!knob){cue.hidden=true;return;}
    const dedicated=active.matches('#launch,#rethrow,#undo,#redo,#reset');
    const activation=!dedicated&&!active.matches('[role=tab],:disabled')&&(active.matches('button,summary,[role=button],input[type=checkbox],a[href]'));
    if(!directions&&!activation){cue.hidden=true;return;}
    activate.hidden=!activation;activate.textContent=active.matches('a[href]')?'Enter':'Space';activate.classList.toggle('is-enter',active.matches('a[href]'));
    const canStepBack=active.matches('.empty-slot')&&active!==active.closest('.pipeline')?.querySelector('[data-cell]');
    remove.hidden=!active.matches('.part-body')&&!canStepBack;arrows.hidden=!directions;
    cue.dataset.directions=directions;cue.classList.toggle('is-knob',knob);cue.classList.toggle('keyboard-arrows',!!directions);
    const piece=active.matches('.part-body,.empty-slot')?active:active.querySelector('.ingredient-surface');
    cue.classList.toggle('on-piece',!!piece);
    if(piece) {
      // Let the same painted object carry its cue through swaps, interrupted
      // slides and pickup feedback. A separately positioned overlay can lag a
      // compositor animation even when measured on every animation frame.
      if(cue.parentElement!==piece)piece.append(cue);
      cue.style.removeProperty('width');cue.style.removeProperty('height');cue.style.removeProperty('left');cue.style.removeProperty('top');
      cue.hidden=false;return;
    }
    const host=active.closest('dialog')??documentRoot.body;
    if(cue.parentElement!==host)host.append(cue);
    const rect=(active.querySelector('.ingredient-surface')??active).getBoundingClientRect();
    // Floating cues must disappear with their control when a reader is
    // scrolled manually. Clamping an offscreen control's badge to the viewport
    // would detach it from both the control and its focus ring.
    if(!anchorVisible(active,rect,knob?rect.top+rect.height/2:rect.top)){cue.hidden=true;return;}
    let width=rect.width+12,height=18,left=rect.left-6,top=rect.top-9;
    if(knob) {
      const slider=active as HTMLInputElement;
      const min=Number(slider.min)||0,max=Number(slider.max)||100;
      let progress=Math.max(0,Math.min(1,(slider.valueAsNumber-min)/(max-min||1)));
      if(getComputedStyle(slider).direction==='rtl')progress=1-progress;
      width=60;height=34;left=rect.left+9.5+progress*(rect.width-19)-width/2;top=rect.top+(rect.height-height)/2;
    }
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
      if(reader.getAttribute('tabindex')!==String(index))reader.tabIndex=index;
      reader.dataset.scrollDirections=directions;
      if(reader.matches('.value-table tbody'))reader.setAttribute('aria-label','Comparison values');
      current.add(reader);for(const child of reader.children)current.add(child);
    }
    // A div reports tabIndex=-1 even when Firefox implicitly makes its
    // overflow scrollable by Tab. Explicitly opt containers out of that stop.
    for(const element of documentRoot.querySelectorAll<HTMLElement>(CONTAINERS))if(element.getAttribute('tabindex')!=='-1')element.tabIndex=-1;
    for(const element of observed)if(!current.has(element)){resize.unobserve(element);observed.delete(element);}
    for(const element of current)if(!observed.has(element)){resize.observe(element);observed.add(element);}
    if(documentRoot.documentElement.dataset.focusModality==='keyboard')for(const cap of documentRoot.querySelectorAll<HTMLElement>('#palette .button-hotkey')) {
      const face=cap.closest<HTMLElement>('.ingredient-surface')!,rect=face.getBoundingClientRect();
      cap.classList.toggle('is-clipped',!anchorVisible(face,rect,rect.top-9,rect.bottom));
    }
    showCue();
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
  // Tab layout can settle after the window's resize event, especially inside
  // a newly revealed hint. Refresh when its supported directions change.
  const tabDirections=new MutationObserver(schedule);
  tabDirections.observe(documentRoot.documentElement,{subtree:true,attributes:true,attributeFilter:['data-tab-directions']});
  const focus=(event:FocusEvent)=>{
    if(event.target instanceof HTMLElement) {
      pendingFocus=event.target;
      // Local cues must change owner in the focus event itself. Waiting for
      // the next layout pass can leave them on a departing empty slot for
      // the first frame of a move that does not replace the rail markup.
      if(event.target.matches('.part-body,.empty-slot,.ingredient'))showCue();else cue.hidden=true;
    }
    schedule();
  };
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
  const released=(event:KeyboardEvent)=>{if(event.key==='Shift')schedule();};
  const toggle=(event:Event)=>{
    if(!(event.target instanceof HTMLDetailsElement))return;
    // Exclusive chapters can close a preceding panel without changing the
    // whole list's size. Observe the toggle itself, after Space activates it.
    const active=documentRoot.activeElement;
    if(active instanceof HTMLElement&&active.matches('summary'))pendingFocus=active;
    schedule();
  };
  documentRoot.addEventListener('keydown',key,true);
  documentRoot.addEventListener('keyup',released,true);
  documentRoot.addEventListener('focusin',focus,true);
  documentRoot.addEventListener('toggle',toggle,true);
  for(const event of ['focusout','input','pointerdown','scroll'])documentRoot.addEventListener(event,schedule,true);
  window.addEventListener('resize',schedule);documentRoot.fonts.ready.then(schedule);
  schedule();
  return {refresh:schedule,remove:()=>{
    cancelAnimationFrame(frame);resize.disconnect();tabDirections.disconnect();cue.remove();
    documentRoot.removeEventListener('keydown',key,true);
    documentRoot.removeEventListener('keyup',released,true);
    documentRoot.removeEventListener('focusin',focus,true);
    documentRoot.removeEventListener('toggle',toggle,true);
    for(const event of ['focusout','input','pointerdown','scroll'])documentRoot.removeEventListener(event,schedule,true);
    window.removeEventListener('resize',schedule);
  }};
}
