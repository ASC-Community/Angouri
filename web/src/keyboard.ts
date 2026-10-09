import './focus.css';
import { installKeyboardAffordances } from './keyboard-affordances';

const DATA_KEYS = ['op','insert','stage','circleValue','circleHandle','circleTarget','cropRange','cropExact','cropAdd','cropClear'] as const;
const NATIVE_TAB_STOPS = 'button:not([tabindex]), a[href]:not([tabindex]), summary:not([tabindex]), input:not([type=hidden]):not([tabindex]), select:not([tabindex]), textarea:not([tabindex])';

type DataKey = typeof DATA_KEYS[number];

export interface FocusBookmark {
  element: HTMLElement;
  key?: DataKey;
  value?: string;
  cell?: string;
  area?: 'palette'|'recipe';
}

function enabled(element: HTMLElement | null): element is HTMLElement {
  return !!element
    && !(element instanceof HTMLButtonElement && element.disabled)
    && !(element instanceof HTMLInputElement && element.disabled)
    && !element.hidden
    && !element.closest('[hidden]');
}

/**
 * Safari can omit buttons and links from Tab navigation when its page-tab
 * preference is off. Explicit zero indices keep the app's native DOM order,
 * while leaving roving tablists and deliberately removed controls alone.
 */
export function installTabStops(documentRoot: Document = document) {
  const removeModality=installFocusModality(documentRoot);
  const affordances=installKeyboardAffordances(documentRoot);
  const removeEntry=installGameEntry(documentRoot);
  const removeBoundary=installTabBoundary(documentRoot);
  const add=(root: ParentNode)=>root.querySelectorAll<HTMLElement>(NATIVE_TAB_STOPS).forEach(element=>element.tabIndex=0);
  add(documentRoot);
  const observer=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{
    if(!(node instanceof Element))return;
    if(node.matches(NATIVE_TAB_STOPS))(node as HTMLElement).tabIndex=0;
    add(node);
    affordances.refresh();
  })));
  observer.observe(documentRoot.documentElement,{childList:true,subtree:true});
  return ()=>{observer.disconnect();removeModality();affordances.remove();removeEntry();removeBoundary();};
}

/** The first keyboard action starts at a visible game control, without an
 * extra skip-link stop or unsolicited focus while the document loads. */
export function focusGameControl(documentRoot:Document=document) {
  const candidates=documentRoot.querySelectorAll<HTMLElement>('.view-tabs [aria-selected=true],#palette [data-op]:not(:disabled),#menu-open');
  const target=[...candidates].filter(element=>element.getClientRects().length&&getComputedStyle(element).visibility==='visible');
  // Menu occurs earlier in the document; it is only the loading fallback.
  const control=target.find(element=>element.id!=='menu-open')??target[0];
  control?.focus({preventScroll:true});
  return !!control;
}

function installGameEntry(documentRoot:Document) {
  let pending=true;
  const key=(event:KeyboardEvent)=>{
    if(!event.isTrusted||event.altKey||event.ctrlKey||event.metaKey||['Alt','Control','Meta','Shift'].includes(event.key))return;
    if(pending&&event.key==='Tab'&&!event.shiftKey&&!documentRoot.querySelector('dialog[open]')&&[documentRoot.body,documentRoot.documentElement].includes(documentRoot.activeElement as HTMLElement)) {
      if(focusGameControl(documentRoot))event.preventDefault();
    }
    pending=false;
  };
  const pointer=(event:Event)=>{if(event.isTrusted)pending=false;};
  documentRoot.addEventListener('keydown',key,true);
  documentRoot.addEventListener('pointerdown',pointer,true);
  return ()=>{documentRoot.removeEventListener('keydown',key,true);documentRoot.removeEventListener('pointerdown',pointer,true);};
}

/** Keep the native order within the game or active modal, but wrap between
 * actual controls before the browser inserts an empty document-focus step.
 * Modified Tab and browser shortcuts remain untouched; About is outside this
 * fixed-viewport game scope. */
function installTabBoundary(documentRoot:Document) {
  const wrap=(event:KeyboardEvent)=>{
    if(event.defaultPrevented||event.key!=='Tab'||event.altKey||event.ctrlKey||event.metaKey)return;
    const dialog=documentRoot.querySelector<HTMLDialogElement>('dialog[open]');
    const scope=dialog??documentRoot.querySelector<HTMLElement>('.game-shell');if(!scope)return;
    const controls=[...scope.querySelectorAll<HTMLElement>('button,a[href],input,select,textarea,summary,[tabindex]')].filter(element=>{
      if(element.tabIndex<0||element.matches(':disabled')||element.closest('[inert]')||!element.getClientRects().length||getComputedStyle(element).visibility!=='visible')return false;
      // Closed details can retain nonempty layout boxes for their contents.
      // Only their summary, including any controls in it, participates in Tab.
      for(let parent=element.parentElement;parent&&parent!==scope;parent=parent.parentElement) {
        if(parent instanceof HTMLDetailsElement&&!parent.open&&!parent.querySelector(':scope > summary')?.contains(element))return false;
      }
      return true;
    });
    const active=documentRoot.activeElement,index=controls.indexOf(active as HTMLElement);
    // Neutral page focus can follow a pointer action or a temporarily disabled
    // button. Preserve its native starting point; first arrival is handled by
    // installGameEntry. Only the actual game boundaries need wrapping here.
    if(!dialog&&index<0)return;
    // After a pointer reopens a chapter, compact WebKit can retain the closed
    // details' sequential-navigation position and skip all its puzzle rows.
    // Step from summaries explicitly, using the same visible DOM order.
    if(index>=0&&active?.tagName==='SUMMARY') {
      event.preventDefault();controls[(index+(event.shiftKey?controls.length-1:1))%controls.length]?.focus();return;
    }
    if(index>=0&&(event.shiftKey?index>0:index<controls.length-1))return;
    // A revealed hint is focused for reading with tabindex=-1. Let native Tab
    // continue into its next control instead of jumping back to the header.
    if(dialog&&index<0&&active&&active!==dialog&&dialog.contains(active)) {
      const direction=event.shiftKey?Node.DOCUMENT_POSITION_PRECEDING:Node.DOCUMENT_POSITION_FOLLOWING;
      if(controls.some(control=>active.compareDocumentPosition(control)&direction))return;
    }
    event.preventDefault();
    (event.shiftKey?controls.at(-1):controls[0])?.focus();
  };
  documentRoot.addEventListener('keydown',wrap,true);
  return ()=>documentRoot.removeEventListener('keydown',wrap,true);
}

/** Keep focus restoration, while presenting its ring only for keyboard use. */
export function installFocusModality(documentRoot: Document = document) {
  const root=documentRoot.documentElement;
  let shiftPress:{visible:boolean;used:boolean}|undefined;
  const keyboard=(event:KeyboardEvent)=>{
    if(!event.isTrusted)return;
    if(event.key==='Shift'&&!event.repeat) {
      if(shiftPress)shiftPress.used=true;
      else if(!event.ctrlKey&&!event.metaKey&&!event.altKey)shiftPress={visible:root.dataset.focusModality==='keyboard'&&root.dataset.shortcutLabels!=='hidden',used:false};
    }else if(shiftPress&&event.key!=='Shift')shiftPress.used=true;
    if(!['Alt','Control','Meta'].includes(event.key))root.dataset.focusModality='keyboard';
  };
  const released=(event:KeyboardEvent)=>{
    if(event.key!=='Shift'||!shiftPress)return;
    const press=shiftPress;shiftPress=undefined;
    // Wait for release so Shift+Tab, modified shortcuts, typing and pointer
    // gestures never also toggle the labels. Focus outlines remain independent.
    if(event.isTrusted&&!press.used&&!event.ctrlKey&&!event.metaKey&&!event.altKey)root.dataset.shortcutLabels=press.visible?'hidden':'shown';
  };
  const pointer=(event:Event)=>{if(event.isTrusted){root.dataset.focusModality='pointer';if(shiftPress)shiftPress.used=true;}};
  const blur=()=>{shiftPress=undefined;};
  root.dataset.focusModality='pointer';
  documentRoot.addEventListener('keydown',keyboard,true);
  documentRoot.addEventListener('keyup',released,true);
  documentRoot.addEventListener('pointerdown',pointer,true);
  documentRoot.addEventListener('mousedown',pointer,true);
  documentRoot.addEventListener('touchstart',pointer,{capture:true,passive:true});
  documentRoot.defaultView?.addEventListener('blur',blur);
  return ()=>{
    documentRoot.removeEventListener('keydown',keyboard,true);
    documentRoot.removeEventListener('keyup',released,true);
    documentRoot.removeEventListener('pointerdown',pointer,true);
    documentRoot.removeEventListener('mousedown',pointer,true);
    documentRoot.removeEventListener('touchstart',pointer,true);
    documentRoot.defaultView?.removeEventListener('blur',blur);
    delete root.dataset.focusModality;
    delete root.dataset.shortcutLabels;
  };
}

/**
 * Safari can assign focus to a page control while a new document is arriving.
 * Finish this guard with the first acknowledged construction so that render
 * focus restoration does not turn that browser choice into an app choice.
 * A real key or pointer action during loading makes the focus deliberate.
 */
export function guardArrivalFocus(documentRoot: Document = document) {
  let interacted=false,finished=false;
  const interaction=(event:Event)=>{if(event.isTrusted)interacted=true;};
  const events=['keydown','pointerdown','touchstart'] as const;
  events.forEach(type=>documentRoot.addEventListener(type,interaction,{capture:true,passive:true}));
  return ()=>{
    if(finished)return false;
    finished=true;
    events.forEach(type=>documentRoot.removeEventListener(type,interaction,true));
    const element=documentRoot.activeElement;
    if(interacted||!(element instanceof HTMLElement)||element===documentRoot.body)return false;
    // blur() alone leaves the old sequential-navigation starting point behind,
    // so subsequent Tab navigation can resume at a stale game control.
    const root=documentRoot.documentElement,tabindex=root.getAttribute('tabindex');
    root.tabIndex=-1;root.focus({preventScroll:true});root.blur();
    if(tabindex===null)root.removeAttribute('tabindex');else root.setAttribute('tabindex',tabindex);
    return documentRoot.activeElement===documentRoot.body;
  };
}

/** Bookmark a logical control before a render; default to the current focus. */
export function rememberFocus(documentRoot: Document = document, element:Element|null=documentRoot.activeElement): FocusBookmark | undefined {
  if(!(element instanceof HTMLElement)||element===documentRoot.body)return;
  const key=DATA_KEYS.find(candidate=>element.dataset[candidate]!==undefined);
  const cell=element.closest<HTMLElement>('[data-cell]')?.dataset.cell;
  const area=element.closest('#palette')?'palette':element.closest('#construction')?'recipe':undefined;
  return {element,key,value:key?element.dataset[key]:undefined,cell,area};
}

/**
 * Restore the same logical control after a render. If an edit removed that
 * control, keep keyboard users at the same recipe cell, or in the same editor.
 */
export function restoreFocus(bookmark: FocusBookmark | undefined, documentRoot: Document = document) {
  if(!bookmark)return false;
  const candidates: (HTMLElement|null)[]=[];
  if(bookmark.element.isConnected)candidates.push(bookmark.element);
  if(bookmark.key&&bookmark.value!==undefined) {
    const attribute=bookmark.key.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase());
    candidates.push(documentRoot.querySelector<HTMLElement>(`[data-${attribute}="${CSS.escape(bookmark.value)}"]`));
  }
  if(bookmark.cell!==undefined) {
    const cell=CSS.escape(bookmark.cell);
    candidates.push(documentRoot.querySelector<HTMLElement>(`[data-cell="${cell}"] button, button[data-cell="${cell}"]`));
  }
  if(bookmark.area==='palette')candidates.push(documentRoot.querySelector<HTMLElement>('#palette [data-op]:not(:disabled)'));
  if(bookmark.area==='recipe')candidates.push(documentRoot.querySelector<HTMLElement>('#construction [data-cell] button, #construction button[data-cell]'));
  for(const candidate of candidates) {
    if(!enabled(candidate))continue;
    candidate.focus({preventScroll:true});
    return documentRoot.activeElement===candidate;
  }
  return false;
}

type ActivateTab = (tab: HTMLElement) => void;

/** Apply the horizontal ARIA tablist keys without intercepting Tab/Shift+Tab. */
export function navigateTablist(event: KeyboardEvent, tabs: readonly HTMLElement[], activate: ActivateTab) {
  if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return false;
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return false;
  const target=event.target;
  if(!(target instanceof HTMLElement)||target.getAttribute('role')!=='tab')return false;
  const index=tabs.indexOf(target);
  if(index<0||tabs.length===0)return false;
  event.preventDefault();
  const next=event.key==='Home'?0
    :event.key==='End'?tabs.length-1
    :(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length;
  const tab=tabs[next];
  activate(tab);
  tab.focus({preventScroll:true});
  return true;
}
