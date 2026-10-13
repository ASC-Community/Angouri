import { icon } from './icons';
import { escape, fraction, sourceInfo, type Checkpoint, type State } from './types';
import type { Flight } from './views';

export type TargetStatus='waiting'|'hit'|'miss';
type TargetKind='target'|'inspect-target'|'inspect-point';

/** Confirmation follows the shared clock; the kernel's exact match is separate. */
export const targetStatus=(checkpoint:Checkpoint,state:State,flight:Flight):TargetStatus=>state.mode!=='remix'&&(flight.phase==='flying'||flight.phase==='landed')&&(checkpoint.phase??fraction(checkpoint.x)/sourceInfo(state.sourceId).endpoint)<=flight.position+1e-8?(checkpoint.hit?'hit':'miss'):'waiting';
export const targetDescription=(checkpoint:Checkpoint,index:number,status:TargetStatus,kind:TargetKind='target')=>{
  const name=kind==='target'?'Target':kind==='inspect-target'?'Inspect target':'Inspect point';
  const coordinates=`${name} ${index+1}, x = ${checkpoint.x}, height = ${checkpoint.target}`;
  if(kind==='inspect-point')return coordinates;
  const verdict=status==='waiting'?(checkpoint.hit?'path matches, ready to throw':'path misses'):(checkpoint.hit?'hit confirmed':'miss confirmed');
  return `${coordinates}: ${verdict}`;
};
export const targetMark=(status:string)=>status==='hit'?icon('check',13):status==='miss'?icon('close',13):'';

/** A missing kind marks a decorative plot/label; only named verdicts and
 * inspection controls receive an accessible name. */
export const targetAttributes=(checkpoint:Checkpoint,index:number,status:TargetStatus,kind?:TargetKind)=>`data-target="${index}" data-match="${checkpoint.hit?'hit':'miss'}" data-status="${status}"${kind?` data-target-kind="${kind}" aria-label="${escape(targetDescription(checkpoint,index,status,kind))}"`:''}`;

/** Patch presentation only. Awarding completion remains with the play owner. */
export function updateTarget(root:ParentNode,checkpoint:Checkpoint,index:number,status:TargetStatus,animate=false) {
  const match=checkpoint.hit?'hit':'miss';
  root.querySelectorAll<HTMLElement|SVGElement>(`[data-target="${index}"]`).forEach(element=>{
    const changedMatch=element.dataset.match!==match,changedStatus=element.dataset.status!==status;
    if(!changedMatch&&!changedStatus)return;
    element.dataset.match=match;element.dataset.status=status;
    element.classList.remove('waiting','hit','miss','just-hit');element.classList.add(status);
    if(changedStatus&&status==='hit'&&animate)element.classList.add('just-hit');
    const kind=element.dataset.targetKind as TargetKind|undefined;
    if(kind)element.setAttribute('aria-label',targetDescription(checkpoint,index,status,kind));
    const mark=element.matches('.equation-verdict')?element:element.querySelector('.target-result');
    if(mark&&changedMatch)mark.innerHTML=targetMark(match);
  });
}
