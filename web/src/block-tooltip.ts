/** Operation names stay available without repeating the formula on every card. */
export function installBlockTooltip(root:HTMLElement) {
  const tip=document.createElement('div');tip.id='block-tooltip';tip.className='block-tooltip';
  tip.setAttribute('role','tooltip');tip.hidden=true;document.body.append(tip);
  let owner:HTMLButtonElement|undefined,dismissed:HTMLButtonElement|undefined;
  const hide=()=>{
    if(owner) {
      const remaining=owner.getAttribute('aria-describedby')?.split(' ').filter(id=>id!==tip.id).join(' ');
      if(remaining)owner.setAttribute('aria-describedby',remaining);else owner.removeAttribute('aria-describedby');
    }
    owner=undefined;tip.hidden=true;
  };
  const block=(target:EventTarget|null)=>(target instanceof Element?target.closest<HTMLButtonElement>('.ingredient[data-block-name]'):null);
  const show=(button:HTMLButtonElement)=>{
    if(button===dismissed||button===owner)return;
    hide();owner=button;
    const name=document.createElement('strong'),help=document.createElement('span');
    name.textContent=button.dataset.blockName!;help.textContent=button.dataset.blockHelp!;
    tip.replaceChildren(name,help);tip.hidden=false;
    const anchor=button.getBoundingClientRect(),bounds=tip.getBoundingClientRect();
    tip.style.left=`${Math.max(8,Math.min(innerWidth-bounds.width-8,anchor.left+(anchor.width-bounds.width)/2))}px`;
    tip.style.top=`${anchor.top>=bounds.height+18?anchor.top-bounds.height-10:anchor.bottom+10}px`;
    button.setAttribute('aria-describedby',[button.getAttribute('aria-describedby'),tip.id].filter(Boolean).join(' '));
  };
  root.addEventListener('pointerover',event=>{
    // A rebuilt stack under a resting mouse must not obscure a keyboard move.
    if(document.documentElement.dataset.focusModality==='keyboard'&&!root.contains(document.activeElement))return;
    const button=block(event.target);if(button&&event.pointerType!=='touch')show(button);
  });
  root.addEventListener('pointerout',event=>{
    const button=block(event.target);if(button&&button!==block(event.relatedTarget)){
      if(document.documentElement.dataset.focusModality!=='keyboard'||document.activeElement!==button)hide();dismissed=undefined;
    }
  });
  root.addEventListener('focusin',event=>{const button=block(event.target);if(button&&document.documentElement.dataset.focusModality==='keyboard')show(button);});
  root.addEventListener('focusout',()=>{hide();dismissed=undefined;});
  document.addEventListener('focusin',event=>{if(!root.contains(event.target as Node))hide();});
  root.addEventListener('pointerdown',()=>{dismissed=owner;hide();});
  document.addEventListener('pointerdown',event=>{if(owner!==block(event.target))hide();},true);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){dismissed=owner;hide();return;}
    const focused=block(document.activeElement);
    if(focused&&document.documentElement.dataset.focusModality==='keyboard')show(focused);else hide();
  });
  window.addEventListener('resize',hide);window.addEventListener('scroll',hide,true);
  new MutationObserver(()=>{if(owner&&!owner.isConnected)hide();}).observe(root,{childList:true});
}
