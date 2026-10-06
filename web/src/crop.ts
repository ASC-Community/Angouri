import { icon } from './icons';
import { escape, fraction, type Crop, type Response, type Result, type State } from './types';
import { rationalTex, tex } from './views';

export const probePoints=(result:Result)=>result.crop?result.stages.at(-1)!.points:result.points;
export const cropEdited=(state:State)=>!!state.crop&&(state.mode!=='puzzle'||state.crop.from!=='0'||state.crop.to!=='4');
const quarter=(n:number)=>{const k=Math.round(n*4);return k%4===0?String(k/4):k%2===0?`${k/2}/2`:`${k}/4`;};

/** A finishing tool, outside the reorderable block sequence. */
export function cropControl(state:State,result:Result) {
  const crop=result.crop;
  if(!crop)return state.mode==='remix'?`<button class="crop-add button" data-crop-add title="Keep a horizontal interval">${icon('crop',17)}Crop</button>`:'';
  const end=state.sourceId===5?2:4;
  return `<div class="crop-finish" role="group" aria-label="Crop the finished curve"><span class="crop-title">${icon('crop',14)} Crop ${state.mode==='remix'?`<button data-crop-clear aria-label="Remove Crop">${icon('close',14)}</button>`:''}</span>${(['from','to'] as const).map(key=>`<label class="crop-bound"><span>${key==='from'?'From':'To'}</span><input type="range" data-crop-range="${key}" min="0" max="${end}" step="0.25" value="${fraction(crop[key])}" aria-label="Crop ${key}" ${crop.editable?'':'disabled'}><input type="text" inputmode="text" data-crop-exact="${key}" value="${escape(crop[key])}" aria-label="Exact crop ${key}" spellcheck="false" ${crop.editable?'':'readonly'}></label>`).join('')}</div>`;
}

/** Keep the whole-shape requirement visible beside the view it describes. */
export function outlineVerdict(result:Result) {
  if(!result.outline)return '';
  return `<div class="outline-verdict" data-outline-match="${result.outline.hit}" role="status"><span class="outline-key" aria-hidden="true"></span><span data-outline-mark>${icon(result.outline.hit?'check':'close',17)}</span><span>Whole outline</span>${result.crop?.required?`<span class="crop-required" data-crop-match="${result.crop.hit}">${icon(result.crop.hit?'check':'close',14)}${tex(`${rationalTex(result.crop.required.from)}\\le x\\le ${rationalTex(result.crop.required.to)}`)}</span>`:''}</div>`;
}

/** Coalesce previews; a pointer gesture becomes one acknowledged history edit.
 * The owner patches the existing diagram rather than measuring it on input. */
export class CropEditor {
  private held?:{state:State;result:Result;crop:Crop};
  private generation=0;
  private busy=false;
  private queued?:Crop;
  constructor(private root:HTMLElement,private context:()=>{state:State;result:Result}|undefined,private evaluate:(state:State,crop:Crop)=>Promise<Response>,private preview:(result:Result)=>void,private commit:(crop:Crop)=>Promise<unknown>,private restore:(result:Result)=>void,private instant:(crop:Crop,base:Result)=>void) {
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
      this.generation++;this.queued=undefined;this.held=undefined;
      void this.commit(crop);
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
