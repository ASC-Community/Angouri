import { icon } from './icons';
import { escape, fraction, type Crop, type Response, type Result, type State } from './types';
import { rationalTex, tex } from './views';

export const probePoints=(result:Result)=>result.crop?result.stages.at(-1)!.points:result.points;
export const cropEdited=(state:State)=>!!state.crop&&state.mode==='remix';
const quarter=(n:number)=>{const k=Math.round(n*4);return k%4===0?String(k/4):k%2===0?`${k/2}/2`:`${k}/4`;};

/** A finishing tool, outside the reorderable block sequence. */
export function cropControl(state:State,result:Result) {
  const crop=result.crop;
  if(!crop)return state.mode==='remix'?`<button class="crop-add button" data-crop-add title="Keep a horizontal interval">${icon('crop',17)}Crop</button>`:'';
  if(!crop.editable)return `<div class="crop-fixed" aria-label="Fixed drawing interval">${icon('crop',15)}<span>Frame</span>${tex(`${rationalTex(crop.from)}\\le x\\le ${rationalTex(crop.to)}`)}</div>`;
  const end=state.sourceId===5?2:4;
  return `<div class="crop-finish" role="group" aria-label="Crop the finished curve"><span class="crop-title">${icon('crop',14)} Crop ${state.mode==='remix'?`<button data-crop-clear aria-label="Remove Crop">${icon('close',14)}</button>`:''}</span>${(['from','to'] as const).map(key=>`<label class="crop-bound"><span>${key==='from'?'From':'To'}</span><input type="range" data-crop-range="${key}" min="0" max="${end}" step="0.25" value="${fraction(crop[key])}" aria-label="Crop ${key}" ${crop.editable?'':'disabled'}><input type="text" inputmode="text" data-crop-exact="${key}" value="${escape(crop[key])}" aria-label="Exact crop ${key}" spellcheck="false" ${crop.editable?'':'readonly'}></label>`).join('')}</div>`;
}

/** Crop has an interval goal; the ordinary targets determine the curve. */
export function cropVerdict(result:Result) {
  const crop=result.crop;
  if(!crop?.required||!crop.editable)return '';
  return `<div class="crop-verdict" data-crop-match="${crop.hit}" role="status"><span class="crop-key" aria-hidden="true">${icon('crop',16)}</span><span>Keep</span>${tex(`${rationalTex(crop.required.from)}\\le x\\le ${rationalTex(crop.required.to)}`)}<span data-crop-mark>${icon(crop.hit?'check':'close',17)}</span></div>`;
}

/** Preserve text and math nodes while a drag's exact validation catches up. */
export function updateCropVerdict(root:HTMLElement,result:Result) {
  if(!result.crop?.required)return;
  const hit=String(result.crop.hit);
  root.querySelectorAll<HTMLElement>('[data-crop-match]').forEach(element=>{
    if(element.dataset.cropMatch===hit)return;
    element.dataset.cropMatch=hit;
    const mark=element.querySelector('[data-crop-mark]');
    if(mark)mark.innerHTML=icon(result.crop!.hit?'check':'close',17);
  });
}

type WindowBounds={left:number;right:number;top:number;bottom:number};
const cuts=(left:number,right:number,top:number,bottom:number)=>`M${left+6} ${top}H${left}V${bottom}H${left+6}M${right-6} ${top}H${right}V${bottom}H${right-6}`;
const outside=(left:number,right:number,bounds:WindowBounds)=>`M${bounds.left} ${bounds.top}H${left}V${bounds.bottom}H${bounds.left}Z M${right} ${bounds.top}H${bounds.right}V${bounds.bottom}H${right}Z`;

/** A spatial window over existing kernel samples, never a second target curve. */
export function cropWindow(crop:Result['crop'],project:(x:number)=>number,bounds:WindowBounds,id:string,before='') {
  if(!crop)return '';
  const left=project(crop.fromNumber),right=project(crop.toNumber),outsidePath=outside(left,right,bounds);
  const goal=crop.editable?crop.required:undefined,goalLeft=goal&&project(fraction(goal.from)),goalRight=goal&&project(fraction(goal.to));
  return `<g class="crop-window" data-crop-window data-left="${bounds.left}" data-right="${bounds.right}" data-top="${bounds.top}" data-bottom="${bounds.bottom}" aria-hidden="true"><defs><clipPath id="${id}-outside"><path data-crop-outside d="${outsidePath}"/></clipPath></defs><path class="crop-discarded" data-crop-outside d="${outsidePath}"/>${before?`<path class="crop-before" clip-path="url(#${id}-outside)" d="${before}"/>`:''}<path class="crop-cuts" data-crop-cuts d="${cuts(left,right,bounds.top,bounds.bottom)}"/>${goal?`<path class="crop-goal-bracket" data-crop-match="${crop.hit}" d="M${goalLeft} ${bounds.bottom+7}v6H${goalRight}v-6"/>`:''}</g>`;
}

export function updateCropWindow(root:HTMLElement,crop:Crop,project:(x:number)=>number) {
  const left=project(fraction(crop.from)),right=project(fraction(crop.to));
  root.querySelectorAll<SVGGElement>('[data-crop-window]').forEach(window=>{
    const bounds={left:Number(window.dataset.left),right:Number(window.dataset.right),top:Number(window.dataset.top),bottom:Number(window.dataset.bottom)};
    window.querySelectorAll('[data-crop-outside]').forEach(el=>el.setAttribute('d',outside(left,right,bounds)));
    window.querySelector('[data-crop-cuts]')?.setAttribute('d',cuts(left,right,bounds.top,bounds.bottom));
  });
}

/** Coalesce previews; a pointer gesture becomes one acknowledged history edit.
 * The owner patches the existing diagram rather than measuring it on input. */
export class CropEditor {
  private held?:{state:State;result:Result;crop:Crop};
  private generation=0;
  private busy=false;
  private queued?:Crop;
  constructor(private root:HTMLElement,private context:()=>{state:State;result:Result}|undefined,private evaluate:(state:State,crop:Crop)=>Promise<Response>,private preview:(result:Result)=>void,private commit:(crop:Crop,previewed:boolean)=>Promise<unknown>,private restore:(result:Result)=>void,private instant:(crop:Crop,base:Result)=>void) {
    root.addEventListener('input',event=>{
      const input=event.target as HTMLInputElement,key=input.dataset.cropRange as keyof Crop|undefined;
      if(!key)return;
      const context=this.context();if(!context?.result.crop?.editable)return;
      this.held??={...context,crop:{...context.state.crop!}};
      const crop={...this.held.crop,[key]:quarter(input.valueAsNumber)};
      if(fraction(crop.from)>=fraction(crop.to)){input.value=String(fraction(this.held.crop[key]));return;}
      this.held.crop=crop;
      const exact=root.querySelector<HTMLInputElement>(`[data-crop-exact="${key}"]`);if(exact)exact.value=crop[key];
      this.instant(crop,this.held.result);
      this.queued=crop;this.generation++;void this.drain();
    });
    root.addEventListener('change',event=>{
      const input=event.target as HTMLInputElement,key=(input.dataset.cropExact??input.dataset.cropRange) as keyof Crop|undefined;
      if(!key)return;
      const context=this.context();if(!context?.result.crop?.editable)return;
      const crop={...(this.held?.crop??context.state.crop!),[key]:input.dataset.cropExact?input.value.trim():quarter(input.valueAsNumber)};
      const previewed=!!this.held;
      this.generation++;this.queued=undefined;this.held=undefined;
      void this.commit(crop,previewed);
    });
    root.addEventListener('keydown',event=>{
      if(!(event.target as HTMLElement).matches('[data-crop-range],[data-crop-exact]'))return;
      event.stopPropagation();
      if(event.key==='Escape'){event.preventDefault();this.cancel();const context=this.context();if(context)this.restore(context.result);}
      if(event.key==='Enter'&&(event.target as HTMLElement).matches('[data-crop-exact]')){event.preventDefault();(event.target as HTMLInputElement).dispatchEvent(new Event('change',{bubbles:true}));}
    });
    root.addEventListener('pointercancel',()=>this.cancel());
    window.addEventListener('blur',()=>this.cancel());
  }
  cancel() {
    const held=this.held;this.generation++;this.queued=undefined;this.held=undefined;
    if(held)this.restore(held.result);
  }
  private async drain() {
    if(this.busy)return;
    this.busy=true;
    try {
      while(this.queued&&this.held){
        const crop=this.queued,state=this.held.state,generation=this.generation;this.queued=undefined;
        const reply=await this.evaluate(state,crop);
        if(generation===this.generation&&this.held&&reply.status==='ok'&&reply.result)this.preview(reply.result);
      }
    } catch {this.cancel();} finally {this.busy=false;}
  }
}
