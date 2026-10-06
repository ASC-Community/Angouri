import katex from 'katex';
import { renderBrand } from './brand';
import type { Kernel } from './engine';
import type { CurvePath, Op, Point, Result } from './types';
import './garden.css';

type Stamp = 'loop'|'leaf'|'wave'|'line'|'arch';
type Orientation = 'horizontal'|'vertical';

interface Sample {
  caption:string;
  points:Point[];
}

interface Box { x:number; y:number; width:number; height:number }

interface Stroke {
  id:string;
  stamp:Stamp;
  label:string;
  box:Box;
  hit?:Box;
  orientation?:Orientation;
  flipY?:boolean;
}

interface Picture {
  name:string;
  prompt:string;
  className:string;
  frame?:Box;
  strokes:Stroke[];
}

const STAMPS:Stamp[]=['loop','leaf','wave','line','arch'];
const STAMP_LABEL:Record<Stamp,string>={loop:'Loop',leaf:'Leaf',wave:'Wave',line:'Line',arch:'Arch'};
const RECIPES:Record<Stamp,{sourceId:number;ops:string}>={
  loop:{sourceId:48,ops:'QNA'},
  leaf:{sourceId:66,ops:'Q'},
  wave:{sourceId:50,ops:'S'},
  line:{sourceId:50,ops:''},
  arch:{sourceId:1,ops:''}
};

const PICTURES:Picture[]=[
  {
    name:'Moonlight',prompt:'Stamp a moon and two quiet ripples.',className:'moonlight',
    strokes:[
      {id:'moon',stamp:'loop',label:'round moon',box:{x:112,y:43,width:146,height:146}},
      {id:'ripple-one',stamp:'wave',label:'upper ripple',box:{x:278,y:245,width:205,height:34}},
      {id:'ripple-two',stamp:'wave',label:'lower ripple',box:{x:430,y:325,width:176,height:30}}
    ]
  },
  {
    name:'Garden',prompt:'Give each leaf a stem.',className:'leaves',
    strokes:[
      {id:'leaf-one',stamp:'leaf',label:'left leaf',box:{x:156,y:45,width:135,height:238},hit:{x:150,y:120,width:28,height:80},orientation:'vertical'},
      {id:'stem-one',stamp:'line',label:'left stem',box:{x:218,y:274,width:12,height:78},orientation:'vertical'},
      {id:'leaf-two',stamp:'leaf',label:'right leaf',box:{x:437,y:67,width:126,height:218},hit:{x:535,y:120,width:28,height:80},orientation:'vertical'},
      {id:'stem-two',stamp:'line',label:'right stem',box:{x:494,y:277,width:12,height:75},orientation:'vertical'}
    ]
  },
  {
    name:'Angouri',prompt:'Draw the cucumber that carried every idea.',className:'angouri',frame:{x:290,y:0,width:180,height:375},
    strokes:[
      {id:'body',stamp:'loop',label:'cucumber body',box:{x:333,y:55,width:95,height:286},hit:{x:425,y:200,width:16,height:120},orientation:'vertical'},
      {id:'ridge-one',stamp:'line',label:'left ridge',box:{x:360,y:99,width:8,height:190},hit:{x:360,y:95,width:8,height:20},orientation:'vertical'},
      {id:'ridge-two',stamp:'line',label:'middle ridge',box:{x:376,y:91,width:8,height:205},hit:{x:376,y:260,width:8,height:20},orientation:'vertical'},
      {id:'ridge-three',stamp:'line',label:'right ridge',box:{x:392,y:108,width:8,height:177},hit:{x:400,y:140,width:8,height:20},orientation:'vertical'},
      {id:'smile',stamp:'arch',label:'small smile',box:{x:367,y:192,width:28,height:14},flipY:true},
      {id:'stem',stamp:'arch',label:'curved stem',box:{x:379,y:28,width:24,height:28},orientation:'vertical'}
    ]
  }
];

const svg=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const finite=(point:Point)=>Number.isFinite(point[0])&&Number.isFinite(point[1]);
const distance=(a:Point,b:Point)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

/** Join only branches which share an endpoint. Relation samples can describe a
 * closed curve as two branches; unrelated branches never become a flight. */
function connectedStroke(paths:CurvePath[]):Point[] {
  const available=paths.map(path=>path.points.filter(finite)).filter(points=>points.length>1);
  if(!available.length)return [];
  let best:Point[]=[];
  for(let seed=0;seed<available.length;seed++) {
    const rest=available.map(points=>points.slice());
    let joined=rest.splice(seed,1)[0].slice(),changed=true;
    const all=joined.concat(...rest),span=Math.max(1,...all.map(([x,y])=>Math.abs(x)+Math.abs(y)));
    const tolerance=span*1e-6;
    while(changed&&rest.length) {
      changed=false;
      for(let i=0;i<rest.length;i++) {
        const candidate=rest[i],start=joined[0],end=joined.at(-1)!;
        if(distance(end,candidate[0])<=tolerance){joined.push(...candidate.slice(1));}
        else if(distance(end,candidate.at(-1)!)<=tolerance){joined.push(...candidate.slice(0,-1).reverse());}
        else if(distance(start,candidate.at(-1)!)<=tolerance){joined.unshift(...candidate.slice(0,-1));}
        else if(distance(start,candidate[0])<=tolerance){joined.unshift(...candidate.slice(1).reverse());}
        else continue;
        rest.splice(i,1);changed=true;break;
      }
    }
    if(joined.length>best.length)best=joined;
  }
  return best;
}

function fit(points:Point[],stroke:Stroke):Point[] {
  const xs=points.map(point=>point[0]),ys=points.map(point=>point[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const nx=(x:number)=>(x-minX)/Math.max(1e-9,maxX-minX);
  const ny=(y:number)=>(y-minY)/Math.max(1e-9,maxY-minY);
  const {x,y,width,height}=stroke.box;
  return points.map(([px,py])=>{
    if(stroke.orientation==='vertical')return [x+(stroke.flipY?1-ny(py):ny(py))*width,y+nx(px)*height];
    return [x+nx(px)*width,y+(stroke.flipY?ny(py):1-ny(py))*height];
  });
}

function pathData(points:Point[]) {
  return points.map((point,index)=>`${index?'L':'M'}${point[0].toFixed(2)} ${point[1].toFixed(2)}`).join(' ');
}

function pointAt(points:Point[],progress:number):Point {
  if(points.length<2)return points[0]??[0,0];
  const position=Math.max(0,Math.min(1,progress))*(points.length-1),index=Math.min(points.length-2,Math.floor(position));
  const amount=position-index,a=points[index],b=points[index+1];
  return [a[0]+(b[0]-a[0])*amount,a[1]+(b[1]-a[1])*amount];
}

function launcher(points:Point[],id:string) {
  const start=points[0]??[0,0],next=points[1]??[start[0]+1,start[1]];
  const angle=Math.atan2(next[1]-start[1],next[0]-start[0])*180/Math.PI;
  return `<g class="garden-launcher" data-garden-launcher="${id}" transform="translate(${start[0].toFixed(2)} ${start[1].toFixed(2)}) rotate(${angle.toFixed(2)})" aria-hidden="true"><path class="garden-sling-handle" d="M-22 0H-9M-9 0l6-6M-9 0l6 6"/><path class="garden-sling-band" d="M-3-6L1 0-3 6"/></g><g class="garden-cucumber-flight" data-garden-flight="${id}" transform="translate(${start[0].toFixed(2)} ${start[1].toFixed(2)})" aria-hidden="true"><image href="./cucumber.svg" x="-9" y="-9" width="18" height="18"/></g>`;
}

export class Garden {
  private readonly cache=new Map<Stamp,Promise<Sample>>();
  private samples?:Record<Stamp,Sample>;
  private picture=0;
  private selected?:Stamp;
  private completed=new Set<string>();
  private active=false;
  private playing=false;
  private generation=0;
  private frame?:number;
  private motionDone?:()=>void;
  private inkAnimation?:Animation;
  private timers=new Set<number>();
  private suppressClickUntil=0;
  private drag?:{stamp:Stamp;pointerId:number;card:HTMLElement;startX:number;startY:number;moved:boolean;ghost?:HTMLElement};

  constructor(private host:HTMLElement,private kernel:Kernel,private options:{reduced:()=>boolean;onFinish:()=>void}) {
    host.addEventListener('click',this.click);
    host.addEventListener('pointerdown',this.pointerDown);
    host.addEventListener('pointermove',this.pointerMove);
    host.addEventListener('pointerup',this.pointerUp);
    host.addEventListener('pointercancel',this.pointerCancel);
  }

  async show() {
    this.close();
    this.active=true;
    const version=this.generation;
    this.host.classList.add('garden-content');
    this.host.innerHTML='<div class="garden-loading" role="status"><img src="./cucumber.svg" width="54" height="54" alt=""><p>Gathering five curves…</p></div>';
    try {
      const loaded=await Promise.all(STAMPS.map(async stamp=>[stamp,await this.sample(stamp)] as const));
      if(!this.active||version!==this.generation)return;
      this.samples=Object.fromEntries(loaded) as Record<Stamp,Sample>;
      this.picture=0;this.selected=undefined;this.completed.clear();this.render();
      this.host.querySelector<HTMLElement>('[data-garden-stamp]')?.focus({preventScroll:true});
    } catch {
      if(!this.active||version!==this.generation)return;
      this.host.innerHTML='<div class="garden-loading garden-error" role="alert"><p>The garden could not gather its curves.</p><button class="button" data-garden-retry>Try again</button></div>';
    }
  }

  close() {
    this.active=false;this.cancelMotion();this.playing=false;this.generation++;
    for(const timer of this.timers)clearTimeout(timer);
    this.timers.clear();this.dragEnd();
    this.host.classList.remove('garden-content','garden-celebrating');
    this.host.replaceChildren();
  }

  private sample(stamp:Stamp) {
    let cached=this.cache.get(stamp);
    if(!cached) {
      const recipe=RECIPES[stamp];
      cached=(async()=>{
        const initial=await this.kernel.run(undefined,{type:'level',sourceId:recipe.sourceId,mode:'remix'});
        if(initial.status!=='ok'||!initial.state)throw new Error('Curve unavailable');
        const state={...initial.state,nodes:[...recipe.ops].map((op,index)=>({id:`garden-${stamp}-${index}`,op:op as Op}))};
        const response=await this.kernel.run(state,{type:'evaluate'});
        if(response.status!=='ok'||!response.result)throw new Error('Curve unavailable');
        return this.readSample(response.result,stamp);
      })();
      this.cache.set(stamp,cached);
      void cached.catch(()=>this.cache.delete(stamp));
    }
    return cached;
  }

  private readSample(result:Result,stamp:Stamp):Sample {
    const final=result.stages.at(-1);
    const points=(stamp==='loop'||stamp==='leaf')&&result.relation
      ?connectedStroke(result.relation.paths)
      :(final?.points??result.points).filter(finite);
    if(points.length<2)throw new Error('Curve unavailable');
    return {caption:result.relation?.equationLatex??final?.latex??result.constructedLatex,points};
  }

  private render() {
    if(!this.samples)return;
    const picture=PICTURES[this.picture],frame=picture.frame??{x:0,y:0,width:760,height:420},all=picture.strokes.every(stroke=>this.completed.has(stroke.id));
    const artwork=picture.strokes.map(stroke=>this.strokeMarkup(stroke)).join('');
    const slots=picture.strokes.map(stroke=>this.slotMarkup(stroke,frame)).join('');
    const final=this.picture===PICTURES.length-1;
    this.host.innerHTML=`<section class="garden-shell garden-${picture.className}" aria-labelledby="garden-picture-heading" data-garden-complete="${all}">
      <header class="garden-heading"><p class="eyebrow">A LITTLE MORE FLIGHT · ${this.picture+1} OF ${PICTURES.length}</p><h2 id="garden-picture-heading">${picture.name}</h2><p>${picture.prompt}</p></header>
      <div class="garden-workspace">
        <div class="garden-board" aria-label="${picture.name} picture board" style="--garden-ratio:${frame.width}/${frame.height}">
          <svg class="garden-paper" viewBox="${frame.x} ${frame.y} ${frame.width} ${frame.height}" role="img" aria-labelledby="garden-picture-title garden-picture-description"><title id="garden-picture-title">${picture.name}</title><desc id="garden-picture-description">${picture.prompt} Choose a curve stamp, then its matching outlined stroke.</desc><g class="garden-speckles" aria-hidden="true">${this.speckles()}</g>${artwork}${final?'<image class="garden-canonical" href="./cucumber.svg" x="197" y="7" width="365" height="365" aria-hidden="true"/>':''}</svg>
          <div class="garden-targets">${slots}</div>
          ${final?'<div class="garden-celebration" aria-live="polite"><div class="garden-finale-brand brand"></div><p>Every curve grew into Angouri.</p><button class="button primary" data-garden-done hidden>Done</button></div>':''}
        </div>
        <div class="garden-stamps" role="group" aria-label="Curve stamps">${STAMPS.map(stamp=>this.stampMarkup(stamp)).join('')}</div><div class="garden-stamp-caption" aria-live="polite">Choose a stamp to see its equation.</div>
      </div>
      <div class="garden-footer"><p class="garden-status" role="status" aria-live="polite">Choose a stamp, then an outlined stroke.</p><div class="garden-actions"><button class="button garden-replay" data-garden-replay ${this.completed.size?'':'hidden'} aria-label="Replay this picture"><span aria-hidden="true">↻</span> Replay</button><button class="button primary garden-next" data-garden-next ${all?'':'hidden'}>${final?'Celebrate':'Next picture'} <span aria-hidden="true">→</span></button></div></div>
    </section>`;
    // A browser may scroll the modal itself to activate the previous picture's
    // Next button. The garden owns the inner scroll; its external Back header stays put.
    this.host.closest<HTMLDialogElement>('dialog')?.scrollTo({top:0});
  }

  private strokeMarkup(stroke:Stroke) {
    const points=fit(this.samples![stroke.stamp].points,stroke),path=pathData(points),done=this.completed.has(stroke.id);
    const step=Math.max(1,Math.ceil(points.length/9));
    const pointsMarkup=points.filter((_,index)=>index%step===0).map(([x,y])=>`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2.3"/>`).join('');
    return `<g class="garden-stroke ${done?'is-complete':''}" data-stroke="${stroke.id}" data-garden-complete="${done}"><path class="garden-path-hit" data-garden-path="${stroke.id}" d="${path}"/><path class="garden-outline" d="${path}"/><g class="garden-guide-points" aria-hidden="true">${pointsMarkup}</g><path class="garden-ink" data-garden-ink="${stroke.id}" d="${path}" pathLength="1"/>${launcher(points,stroke.id)}</g>`;
  }

  private slotMarkup(stroke:Stroke,frame:Box) {
    const {x,y,width,height}=stroke.hit??stroke.box,done=this.completed.has(stroke.id);
    const pad=Math.max(8,Math.min(18,Math.min(width,height)*.2));
    return `<button class="garden-slot" data-garden-slot="${stroke.id}" data-garden-needs="${stroke.stamp}" data-garden-complete="${done}" aria-disabled="${done}" aria-label="${svg(stroke.label)}, needs ${STAMP_LABEL[stroke.stamp]} stamp" style="--slot-x:${((x-pad-frame.x)/frame.width*100).toFixed(3)}%;--slot-y:${((y-pad-frame.y)/frame.height*100).toFixed(3)}%;--slot-width:${((width+pad*2)/frame.width*100).toFixed(3)}%;--slot-height:${((height+pad*2)/frame.height*100).toFixed(3)}%"><span class="sr-only">${svg(stroke.label)}</span></button>`;
  }

  private stampMarkup(stamp:Stamp) {
    const sample=this.samples![stamp],preview:Stroke={id:'preview',stamp,label:'',box:{x:3,y:3,width:58,height:30},orientation:(stamp==='leaf'||stamp==='loop')?'vertical':'horizontal'};
    const path=pathData(fit(sample.points,preview));
    const equation=katex.renderToString(sample.caption,{throwOnError:false,output:'htmlAndMathml'});
    return `<button class="garden-stamp" data-garden-stamp="${stamp}" aria-pressed="${this.selected===stamp}" aria-label="${STAMP_LABEL[stamp]} stamp"><svg viewBox="0 0 64 36" aria-hidden="true"><path d="${path}"/></svg><strong>${STAMP_LABEL[stamp]}</strong><span class="garden-equation">${equation}</span></button>`;
  }

  private speckles() {
    return [[44,62],[79,328],[184,371],[300,83],[326,360],[516,70],[624,178],[688,344],[705,102],[559,376]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="1.8"/>`).join('');
  }

  private click=(event:MouseEvent)=>{
    const source=event.target as Element,path=source.closest<SVGElement>('[data-garden-path]');
    if(path&&this.host.contains(path)){const id=path.dataset.gardenPath;if(id){if(this.selected)void this.tryStamp(id,this.selected);else this.say('Choose a stamp first.');}return;}
    const target=source.closest<HTMLElement>('button');
    if(!target||!this.host.contains(target))return;
    if(target.hasAttribute('data-garden-retry')){void this.show();return;}
    const stamp=target.dataset.gardenStamp as Stamp|undefined;
    if(stamp) {
      if(performance.now()<this.suppressClickUntil){event.preventDefault();return;}
      this.select(stamp);return;
    }
    const slot=target.dataset.gardenSlot;
    if(slot){if(this.selected)void this.tryStamp(slot,this.selected);else this.say('Choose a stamp first.');return;}
    if(target.hasAttribute('data-garden-replay')){void this.replay();return;}
    if(target.hasAttribute('data-garden-next')) {
      if(this.picture<PICTURES.length-1){this.cancelMotion();this.picture++;this.completed.clear();this.selected=undefined;this.render();this.host.querySelector<HTMLElement>('[data-garden-stamp]')?.focus({preventScroll:true});}
      else this.celebrate();
      return;
    }
    if(target.hasAttribute('data-garden-done'))this.options.onFinish();
  };

  private select(stamp:Stamp) {
    if(this.playing)return;
    this.selected=stamp;
    this.host.querySelectorAll<HTMLElement>('[data-garden-stamp]').forEach(card=>card.setAttribute('aria-pressed',String(card.dataset.gardenStamp===stamp)));
    const caption=this.host.querySelector<HTMLElement>('.garden-stamp-caption');
    if(caption)caption.innerHTML=katex.renderToString(this.samples![stamp].caption,{throwOnError:false,output:'htmlAndMathml'});
    this.say(`${STAMP_LABEL[stamp]} stamp ready. Choose its outline.`);
  }

  private async tryStamp(id:string,stamp:Stamp) {
    if(this.playing||this.completed.has(id))return;
    const stroke=PICTURES[this.picture].strokes.find(item=>item.id===id);
    if(!stroke)return;
    const slot=this.host.querySelector<HTMLElement>(`[data-garden-slot="${id}"]`)!;
    if(stroke.stamp!==stamp) {
      slot.classList.remove('is-wrong');void slot.offsetWidth;slot.classList.add('is-wrong');
      this.say(`${STAMP_LABEL[stamp]} does not fit the ${stroke.label}. Try another curve.`);
      const timer=window.setTimeout(()=>{slot.classList.remove('is-wrong');this.timers.delete(timer);},650);this.timers.add(timer);
      return;
    }
    this.playing=true;this.completed.add(id);this.selected=undefined;
    this.host.querySelectorAll<HTMLElement>('[data-garden-stamp]').forEach(card=>card.setAttribute('aria-pressed','false'));
    slot.dataset.gardenComplete='true';slot.setAttribute('aria-disabled','true');
    const drawing=this.host.querySelector<HTMLElement>(`[data-stroke="${id}"]`);
    drawing?.classList.add('is-complete','is-playing');if(drawing)drawing.dataset.gardenComplete='true';
    this.say(`${STAMP_LABEL[stamp]} fits. Cucumber flying along the ${stroke.label}.`);
    const version=this.generation;
    await this.animateStroke(stroke);
    if(!this.active||version!==this.generation)return;
    this.host.querySelector<HTMLElement>(`[data-stroke="${id}"]`)?.classList.remove('is-playing');
    this.playing=false;
    const all=PICTURES[this.picture].strokes.every(item=>this.completed.has(item.id));
    this.host.querySelector<HTMLElement>('.garden-shell')!.dataset.gardenComplete=String(all);
    const replay=this.host.querySelector<HTMLElement>('[data-garden-replay]')!;replay.hidden=false;
    if(all){this.host.querySelector<HTMLElement>('[data-garden-next]')!.hidden=false;this.say(`${PICTURES[this.picture].name} is complete.`);}
    else this.say(`${stroke.label} inked. Choose another stamp.`);
  }

  private async replay() {
    if(this.playing||!this.completed.size)return;
    this.playing=true;const version=this.generation;this.say(`Replaying ${PICTURES[this.picture].name}.`);
    for(const stroke of PICTURES[this.picture].strokes) {
      if(!this.active||version!==this.generation)return;
      if(!this.completed.has(stroke.id))continue;
      await this.animateStroke(stroke);
    }
    if(!this.active||version!==this.generation)return;
    this.playing=false;this.say(`${PICTURES[this.picture].name} is ready.`);
  }

  private animateStroke(stroke:Stroke):Promise<void> {
    const points=fit(this.samples![stroke.stamp].points,stroke),ink=this.host.querySelector<SVGPathElement>(`[data-garden-ink="${stroke.id}"]`),flight=this.host.querySelector<SVGGElement>(`[data-garden-flight="${stroke.id}"]`);
    if(!ink||!flight)return Promise.resolve();
    this.cancelMotion();
    const token=this.generation;
    ink.style.strokeDashoffset='1';
    flight.setAttribute('transform',`translate(${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)})`);
    if(this.options.reduced()){ink.style.strokeDashoffset='0';const end=points.at(-1)!;flight.setAttribute('transform',`translate(${end[0].toFixed(2)} ${end[1].toFixed(2)})`);return Promise.resolve();}
    const duration=Math.max(650,Math.min(1250,points.length*14));
    this.inkAnimation=ink.animate([{strokeDashoffset:'1'},{strokeDashoffset:'0'}],{duration,easing:'linear',fill:'forwards'});
    return new Promise(resolve=>{
      this.motionDone=resolve;const start=performance.now();
      const tick=(now:number)=>{
        if(!this.active||token!==this.generation){this.finishMotion();return;}
        const progress=Math.min(1,(now-start)/duration),point=pointAt(points,progress);
        flight.setAttribute('transform',`translate(${point[0].toFixed(2)} ${point[1].toFixed(2)}) rotate(${(progress*300).toFixed(1)})`);
        if(progress<1)this.frame=requestAnimationFrame(tick);
        else {ink.style.strokeDashoffset='0';this.finishMotion();}
      };
      this.frame=requestAnimationFrame(tick);
    });
  }

  private cancelMotion() {
    if(this.frame!==undefined)cancelAnimationFrame(this.frame);
    this.frame=undefined;this.inkAnimation?.cancel();this.inkAnimation=undefined;
    this.motionDone?.();this.motionDone=undefined;
  }

  private finishMotion() {
    if(this.frame!==undefined)cancelAnimationFrame(this.frame);
    this.frame=undefined;this.inkAnimation?.cancel();this.inkAnimation=undefined;
    const done=this.motionDone;this.motionDone=undefined;done?.();
  }

  private celebrate() {
    if(this.playing||!PICTURES[this.picture].strokes.every(stroke=>this.completed.has(stroke.id)))return;
    this.playing=true;this.host.classList.add('garden-celebrating');
    this.host.querySelectorAll<HTMLButtonElement>('[data-garden-next],[data-garden-replay]').forEach(button=>button.disabled=true);
    const brand=this.host.querySelector<HTMLElement>('.garden-finale-brand');if(brand)renderBrand(brand,'./cucumber.svg');
    this.say('The drawn cucumber becomes Angouri.');
    const reveal=()=>{if(this.active)this.host.querySelector<HTMLElement>('.garden-celebration')?.classList.add('show-brand');};
    const done=()=>{if(this.active){const button=this.host.querySelector<HTMLButtonElement>('[data-garden-done]');if(button){button.hidden=false;button.focus({preventScroll:true});}}};
    if(this.options.reduced()){this.host.classList.add('garden-celebration-ready');reveal();done();return;}
    const first=window.setTimeout(()=>{this.host.classList.add('garden-celebration-ready');this.timers.delete(first);},120);
    const second=window.setTimeout(()=>{reveal();this.timers.delete(second);},850);
    const third=window.setTimeout(()=>{done();this.timers.delete(third);},1450);
    this.timers.add(first);this.timers.add(second);this.timers.add(third);
  }

  private say(message:string) {const status=this.host.querySelector<HTMLElement>('.garden-status');if(status)status.textContent=message;}

  private pointerDown=(event:PointerEvent)=>{
    const card=(event.target as Element).closest<HTMLElement>('[data-garden-stamp]');
    if(!card||this.playing||event.button!==0)return;
    const stamp=card.dataset.gardenStamp as Stamp;
    this.drag={stamp,pointerId:event.pointerId,card,startX:event.clientX,startY:event.clientY,moved:false};
    card.setPointerCapture(event.pointerId);
  };

  private pointerMove=(event:PointerEvent)=>{
    const drag=this.drag;if(!drag||drag.pointerId!==event.pointerId)return;
    if(!drag.moved&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>6) {
      drag.moved=true;drag.card.classList.add('is-dragging');
      drag.ghost=document.createElement('div');drag.ghost.className='garden-drag-ghost';drag.ghost.textContent=STAMP_LABEL[drag.stamp];document.body.append(drag.ghost);
      document.getSelection()?.removeAllRanges();
    }
    if(drag.moved){event.preventDefault();drag.ghost!.style.transform=`translate(${event.clientX+12}px,${event.clientY+12}px)`;}
  };

  private pointerUp=(event:PointerEvent)=>{
    const drag=this.drag;if(!drag||drag.pointerId!==event.pointerId)return;
    if(drag.moved) {
      event.preventDefault();this.suppressClickUntil=performance.now()+400;
      const destination=document.elementFromPoint(event.clientX,event.clientY),slot=destination?.closest<HTMLElement>('[data-garden-slot]'),path=destination?.closest<SVGElement>('[data-garden-path]');
      const id=slot?.dataset.gardenSlot??path?.dataset.gardenPath;
      if(id&&(slot?this.host.contains(slot):path&&this.host.contains(path)))void this.tryStamp(id,drag.stamp);
      else this.say('Drop the stamp on an outlined stroke.');
    }
    this.dragEnd();
  };

  private pointerCancel=(event:PointerEvent)=>{if(this.drag?.pointerId===event.pointerId)this.dragEnd();};

  private dragEnd() {
    const drag=this.drag;if(!drag)return;
    if(drag.card.hasPointerCapture(drag.pointerId))drag.card.releasePointerCapture(drag.pointerId);
    drag.card.classList.remove('is-dragging');drag.ghost?.remove();this.drag=undefined;
  }
}
