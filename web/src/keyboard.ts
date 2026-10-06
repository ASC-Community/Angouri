const DATA_KEYS = ['op','insert','stage','circleValue','circleHandle','circleTarget','cropRange','cropExact','cropAdd','cropClear'] as const;

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

/** Remember focus before render code replaces the palette or recipe markup. */
export function rememberFocus(documentRoot: Document = document): FocusBookmark | undefined {
  const element=documentRoot.activeElement;
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
