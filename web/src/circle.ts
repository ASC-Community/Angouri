import './circle.css';
import { escape, fraction, type Circle, type Result, type State } from './types';
import { comparisonValue, equationForms, launcherPose, path, rationalTex, targetDescription, targetMark, targetStatus, tex, transform, type Camera, type Flight } from './views';
import { icon } from './icons';

const names:Record<keyof Circle,string>={x:'Centre x',y:'Centre h',radius:'Radius'};
const symbols:Record<keyof Circle,string>={x:'a',y:'b',radius:'r'};
export const circleEdited=(state:State,result:Result|undefined)=>!!state.circle&&!!result?.circle&&(Object.keys(state.circle) as (keyof Circle)[]).some(key=>fraction(state.circle![key])!==fraction(result.circle!.initial[key]));
export function circleRecipe(state:State,result:Result) {
  const circle=state.circle!,editable=result.circle!.editable;
  const source=state.mode==='remix'?`<button id="source-choose" class="source-choice" aria-label="Change starting curve" aria-haspopup="dialog" aria-controls="curves-dialog">${icon('puzzles',18)}<span>Circle</span>${icon('arrow',13)}</button>`:`<span class="circle-form">${tex('(h-b)^2=r^2-(x-a)^2')}</span>`;
  return `<div class="circle-recipe"><div class="circle-recipe-source">${source}</div><div class="circle-parameters">${(Object.keys(names) as (keyof Circle)[]).map(key=>`<label class="circle-parameter ${editable.includes(key)?'editable':'fixed'}"><span>${tex(symbols[key])}<span>${names[key]}</span>${editable.includes(key)?'':icon('lock',12)}</span>${editable.includes(key)?`<input data-circle-value="${key}" aria-label="${names[key]}" aria-describedby="circle-input-help" value="${escape(circle[key])}" inputmode="decimal" autocomplete="off" spellcheck="false">`:`<span class="circle-fixed-value">${tex(rationalTex(circle[key]))}</span>`}</label>`).join('')}</div><span id="circle-input-help" class="sr-only">Use exact fractions or decimals in quarter steps. Centre coordinates range from minus four to eight. Radius ranges from one quarter to six. Enter commits the value. Escape restores it. In Flight, drag the centre to move the circle, or drag the slingshot left or right to change its radius. You can also select either control, then tap a destination. Focused handles move by arrow keys.</span></div>`;
}

/** Geometry for display only. The kernel supplies the defining equation and every verdict. */
export function decorateCircleFlight(root:HTMLElement,state:State,result:Result,camera:Camera) {
  const circle=result.circle!,[cx,cy]=transform(state,camera,circle.centre),pose=launcherPose(state,camera,result.points[0],circle.tangent),[rx,ry]=pose.start;
  root.querySelector('#trajectory')!.insertAdjacentHTML('beforebegin',`<g class="circle-construction" aria-hidden="true"><path class="circle-radius-line" d="M${cx} ${cy}L${rx} ${ry}"/><circle class="circle-centre-mark" cx="${cx}" cy="${cy}" r="4"/></g><circle id="circle-preview" hidden aria-hidden="true"/><g id="circle-pickup" hidden aria-hidden="true"><circle r="12"/><path d="M-18 0H18M0-18V18"/></g>`);
  const controls=[{kind:'centre',x:cx,y:cy,editable:circle.editable.includes('x')||circle.editable.includes('y'),label:'Move circle centre',content:icon('move',22)},{kind:'radius',x:pose.grip[0],y:pose.grip[1],editable:circle.editable.includes('radius'),label:'Resize circle radius with the slingshot',content:`<span class="slingshot-grip" aria-hidden="true">${icon('resize',16)}${tex('r')}</span>`}];
  root.querySelector('.circle-construction')!.insertAdjacentHTML('beforeend','<path class="circle-handle-leader"/>');
  root.querySelector('.flight-diagram')!.insertAdjacentHTML('beforeend',`<div class="circle-handles">${controls.filter(control=>control.editable).map(control=>`<button class="circle-handle ${control.kind==='radius'?'circle-launcher':''}" data-circle-handle="${control.kind}" data-plot-x="${control.x}" data-plot-y="${control.y}" aria-label="${control.label}" aria-describedby="circle-input-help" aria-pressed="false" title="${control.label}: drag, tap a destination, or use arrow keys">${control.content}</button>`).join('')}</div><span class="circle-drag-hint" aria-live="polite"></span>`);
  const handles=root.querySelector<HTMLElement>('.circle-handles')!;handles.dataset.launchX=String(pose.grip[0]);handles.dataset.launchY=String(pose.grip[1]);
  // A loaded cucumber can overlap a required point behind the tangent. Keep its verdict readable.
  root.querySelectorAll('.ring').forEach(ring=>ring.parentElement!.append(ring));
  sizeCircleControls(root);
}
export function sizeCircleControls(root:HTMLElement) {
  const flow=root.querySelector<SVGSVGElement>('.circle-flow-plot'),zero=root.querySelector<HTMLElement>('.circle-flow-zero'),flowMatrix=flow?.getScreenCTM();
  if(zero&&flowMatrix) {
    const box=root.querySelector('.circle-inspection')!.getBoundingClientRect();
    zero.style.left=`${flowMatrix.e+Number(zero.dataset.plotX)*flowMatrix.a-box.left-16}px`;
    zero.style.top=`${flowMatrix.f+Number(zero.dataset.plotY)*flowMatrix.d-box.top+6}px`;
  }
  const svg=root.querySelector<SVGSVGElement>('#flight-svg'),matrix=svg?.getScreenCTM();if(!matrix)return;
  const box=root.querySelector('.flight-diagram')!.getBoundingClientRect();
  root.querySelectorAll<HTMLElement>('[data-circle-handle]').forEach(el=>{el.style.left=`${matrix.e+Number(el.dataset.plotX)*matrix.a-box.left}px`;el.style.top=`${matrix.f+Number(el.dataset.plotY)*matrix.d-box.top}px`;});
  const centre=root.querySelector<HTMLElement>('[data-circle-handle="centre"]'),radius=root.querySelector<HTMLElement>('[data-circle-handle="radius"]');
  if(radius) {radius.style.width=`${Math.max(44,80*matrix.a)}px`;radius.style.height=`${Math.max(52,86*matrix.d)}px`;}
  if(centre&&radius) {
    const c=centre.getBoundingClientRect(),r=radius.getBoundingClientRect(),overlap=c.right+8>r.left&&c.left<r.right+8&&c.bottom+8>r.top&&c.top<r.bottom+8;
    // At tiny radii, move the centre grip aside; the radius grip stays on the slingshot.
    const dx=overlap?r.left-8-c.right:0,cx=Number(centre.dataset.plotX),cy=Number(centre.dataset.plotY);
    centre.style.left=`${matrix.e+cx*matrix.a-box.left+dx}px`;
    root.querySelector('.circle-handle-leader')?.setAttribute('d',dx?`M${cx} ${cy}h${dx/matrix.a}`:'');
  }
  const handles=root.querySelector<HTMLElement>('.circle-handles');
  if(handles) {
    const x=matrix.e+Number(handles.dataset.launchX)*matrix.a,y=matrix.f+Number(handles.dataset.launchY)*matrix.d,w=Math.max(44,80*matrix.a),h=Math.max(52,86*matrix.d);
    const launcher={left:x-w/2,right:x+w/2,top:y-h/2,bottom:y+h/2+12};
    for(const label of root.querySelectorAll<HTMLElement>('.target-label .flight-label')) {
      label.style.left=`${matrix.e+Number(label.dataset.axisX)*matrix.a-box.left}px`;
      const formula=label.querySelector('.katex-html')!.getBoundingClientRect();
      if(formula.right>launcher.left&&formula.left<launcher.right&&formula.bottom>launcher.top&&formula.top<launcher.bottom) {
        const left=launcher.left-8-formula.width/2,right=launcher.right+8+formula.width/2;
        const centreX=left-formula.width/2>=box.left+4?left:right;
        label.style.left=`${centreX-box.left}px`;
      }
    }
  }
}

export function circleEquation(state:State,result:Result,flight:Flight) {
  const puzzle=state.mode!=='remix';
  const rows=result.checkpoints.map((c,i)=>{const status=targetStatus(c,state,flight);return `<tr data-status="${puzzle?c.hit?'hit':'miss':'sample'}"><td>${tex(`(${rationalTex(c.x)},${rationalTex(c.target)})`)}</td><td>${comparisonValue(c.lhs!)}</td><td>${comparisonValue(c.rhs!)}</td>${puzzle?`<td class="verdict-cell"><span class="equation-verdict" data-target="${i}" data-status="${status}" aria-label="${targetDescription(c,i,status)}">${targetMark(c.hit?'hit':'miss')}</span></td>`:''}</tr>`;}).join('');
  return `<div class="equation-layout circle-equation"><section class="final-equation" tabindex="0" aria-label="Final equation"><div class="equation-content">${equationForms(result)}<p class="equation-meaning">Both heights belong to the same loop.</p><div class="circle-identity">${tex('(x-a)^2+(h-b)^2=r^2')}</div><p class="circle-table-key">Equal distances find the centre. Matching the radius puts every point on the loop.</p></div></section><div class="value-table"><table aria-label="Compare squared distances with the squared radius"><thead><tr><th>${puzzle?'Target':'Point'} ${tex('(x,h)')}</th><th>Distance ${tex('d^2')}</th><th>Radius ${tex('r^2')}</th>${puzzle?'<th><span class="sr-only">On the circle</span>'+icon('target',16)+'</th>':''}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

let inspectedTarget=0,inspectedPair=0;
export function resetCircleInspection(){inspectedTarget=0;inspectedPair=0;}
const pointText=(value:number)=>String(Number(value.toFixed(3)));
export function circleFlow(state:State,result:Result,probe:number,flight:Flight) {
  inspectedTarget=Math.min(inspectedTarget,result.checkpoints.length-1);
  inspectedPair=Math.min(inspectedPair,result.checkpoints.length-1);
  const points=result.checkpoints,c=points[inspectedTarget],circle=result.circle!;
  const pointName=state.mode==='remix'?'Point':'Target',pairName=state.mode==='remix'?'Points':'Targets';
  const pairChoices=(points.length>2?points:points.slice(0,1)).map((_,i)=>`<option value="${i}" ${i===inspectedPair?'selected':''}>${pairName} ${i+1} and ${((i+1)%points.length)+1}</option>`).join('');
  const pairPoints=[points[inspectedPair],points[(inspectedPair+1)%points.length]].map(point=>tex(`(${rationalTex(point.x)},${rationalTex(point.target)})`)).join('<span>and</span>');
  const p=probe/(result.points.length-1);
  return `<div class="flow-controls circle-flow-controls"><div class="flow-control-heading"><label for="flow-position">Travel around the loop</label><div class="flow-goals">${points.map((c,i)=>{const status=targetStatus(c,state,flight);return `<button class="${state.mode==='remix'?'circle-sample-choice':'flow-goal'} circle-target-choice" data-circle-target="${i}" data-target="${i}" data-status="${status}" data-match="${c.hit?'hit':'miss'}" aria-pressed="${i===inspectedTarget}" aria-label="Inspect ${state.mode==='remix'?'point':'target'} ${i+1}: ${c.x}, ${c.target}"><span class="circle-target-name">${pointName} ${i+1}</span>${tex(`(${rationalTex(c.x)},${rationalTex(c.target)})`)}${state.mode==='remix'?'':`<span class="target-result">${targetMark(c.hit?'hit':'miss')}</span>`}</button>`;}).join('')}</div></div><div class="flow-slider-row"><span>${tex('0')}</span><input id="flow-position" type="range" min="0" max="1" step="${1/(result.points.length-1)}" value="${p}" aria-label="Position around the loop"><span>Full turn</span></div></div><div class="flow-line circle-flow-line"><div class="circle-inspection"><svg class="circle-flow-plot" viewBox="132 0 496 414" role="img" aria-label="Equal scales. A right triangle connects the centre to the selected target."></svg><output id="circle-position-value"></output></div><article class="circle-distance-card"><span class="scene-tag">Distance to ${pointName.toLowerCase()} ${inspectedTarget+1}</span><div class="distance-components"><span class="distance-x">${tex(`(${rationalTex(c.dx!)})^2`)}${tex('='+rationalTex(c.dxSquared!))}</span><span>${tex('+')}</span><span class="distance-h">${tex(`(${rationalTex(c.dy!)})^2`)}${tex('='+rationalTex(c.dySquared!))}</span></div><div class="distance-total">${tex(`d^2=${rationalTex(c.lhs!)}`)}<span>${tex(`r^2=${rationalTex(circle.radiusSquared)}`)}</span></div>${state.mode==='remix'||state.sourceId>=45?`<div class="circle-chord-lesson"><label for="circle-pair">Locate the centre <select id="circle-pair" aria-label="Pair of ${pointName.toLowerCase()}s" aria-describedby="circle-pair-explanation">${pairChoices}</select></label><p class="circle-pair-points">${pairPoints}</p><p id="circle-pair-explanation">The dashed segment joins these two ${pointName.toLowerCase()}s. Any centre equally far from both lies on the blue perpendicular line through their midpoint. Compare another pair to narrow down the centre.</p></div>`:'<p>A circle keeps the same distance from its centre all the way around.</p>'}</article></div>`;
}

export function updateCircleProbe(root:HTMLElement,state:State,result:Result,index:number,camera:Camera) {
  const circle=result.circle!,c=result.checkpoints[inspectedTarget],centre=circle.centre,point:[number,number]=[fraction(c.x),fraction(c.target)],el=root.querySelector('.circle-flow-plot');
  if(!el)return;
  const p=(v:[number,number])=>transform(state,camera,v).join(','),xy=result.points[index],zero=transform(state,camera,[0,0]);
  if(!el.querySelector('.circle-flow-curve')) {
  if(!root.querySelector('.circle-flow-zero'))el.insertAdjacentHTML('afterend',`<span class="circle-flow-zero" aria-hidden="true">${tex('0')}</span>`);
  const zeroLabel=root.querySelector<HTMLElement>('.circle-flow-zero')!;zeroLabel.dataset.plotX=String(zero[0]);zeroLabel.dataset.plotY=String(zero[1]);sizeCircleControls(root);
  let chord='';
  if(state.mode==='remix'||state.sourceId>=45) {
    const a=result.checkpoints[inspectedPair],b=result.checkpoints[(inspectedPair+1)%result.checkpoints.length],ax=fraction(a.x),ay=fraction(a.target),bx=fraction(b.x),by=fraction(b.target),middle:[number,number]=[(ax+bx)/2,(ay+by)/2];
    const length=Math.hypot(bx-ax,by-ay),reach=16/Math.max(length,1e-8),nx=-(by-ay)*reach,ny=(bx-ax)*reach;
    chord=`<path class="circle-chord" d="M${p([ax,ay])}L${p([bx,by])}"/><path class="circle-bisector" d="M${p([middle[0]-nx,middle[1]-ny])}L${p([middle[0]+nx,middle[1]+ny])}"/><circle class="circle-midpoint" cx="${transform(state,camera,middle)[0]}" cy="${transform(state,camera,middle)[1]}" r="4"/>`;
  }
  el.innerHTML=`<defs><clipPath id="circle-flow-clip"><rect x="160" y="20" width="440" height="360"/></clipPath></defs><g clip-path="url(#circle-flow-clip)"><path class="flow-zero-line" d="M170 ${zero[1]}H590M${zero[0]} 25V365"/>${chord}<path class="circle-flow-curve" d="${path(result.points,state,camera)}"/><path class="distance-leg-x" d="M${p(centre)}L${p([point[0],centre[1]])}"/><path class="distance-leg-h" d="M${p([point[0],centre[1]])}L${p(point)}"/><path class="distance-hypotenuse" d="M${p(centre)}L${p(point)}"/>${result.checkpoints.map((target,i)=>{const [x,y]=transform(state,camera,[fraction(target.x),fraction(target.target)]);const status=root.querySelector(`[data-circle-target="${i}"]`)?.getAttribute('data-status')||'waiting';return `<circle class="circle-sample-target ${state.mode==='remix'?'sample':'flow-target'} ${target.hit?'matched':''}" data-target="${i}" data-status="${status}" data-match="${target.hit?'hit':'miss'}" cx="${x}" cy="${y}" r="${i===inspectedTarget?9:6}"/>`;}).join('')}<circle class="circle-centre-mark" cx="${transform(state,camera,centre)[0]}" cy="${transform(state,camera,centre)[1]}" r="5"/><image data-circle-traveller href="./cucumber.svg" x="${transform(state,camera,xy)[0]-19}" y="${transform(state,camera,xy)[1]-19}" width="38" height="38"/></g>`;
  }
  const traveller=el.querySelector('[data-circle-traveller]');traveller?.setAttribute('x',String(transform(state,camera,xy)[0]-19));traveller?.setAttribute('y',String(transform(state,camera,xy)[1]-19));
  const slider=root.querySelector<HTMLInputElement>('#flow-position')!;slider.dataset.probeIndex=String(index);slider.value=String(index/(result.points.length-1));slider.style.setProperty('--position',`${100*index/(result.points.length-1)}%`);slider.setAttribute('aria-valuetext',`${Math.round(index/(result.points.length-1)*100)} percent of a turn`);
  root.querySelector('#circle-position-value')!.innerHTML=tex(`(x,h)\\approx (${pointText(xy[0])},${pointText(xy[1])})`);
}
export function chooseCircleInspection(target?:number,pair?:number){if(target!==undefined)inspectedTarget=target;if(pair!==undefined)inspectedPair=pair;}

export const quarter=(value:number)=>{const n=Math.round(value*4);return n%4===0?String(n/4):n%2===0?`${n/2}/2`:`${n}/4`;};
export function circleInput(value:string) {
  const clean=value.trim();
  return /^-?\d+(\.\d+)?$/.test(clean)&&Number.isInteger(Number(clean)*4)?quarter(Number(clean)):clean;
}

type CircleContext={state:State;result:Result;camera:Camera};
/** Preview verdicts come from the kernel. Only release commits state and history. */
export function installCircleHandles(root:HTMLElement,get:()=>CircleContext|undefined,commit:(circle:Circle)=>Promise<unknown>,evaluatePreview:(state:State,circle:Circle)=>Promise<Result|undefined>) {
  let selected:'centre'|'radius'|undefined;
  let drag:{id:number;kind:'centre'|'radius';start:[number,number];origin:[number,number];next:Circle;context:CircleContext;rect:DOMMatrix;control:HTMLElement;moved:boolean}|undefined;
  let artwork:{el:Element;transform:string|null}[]=[];
  let fields:{el:HTMLInputElement;value:string}[]=[];
  let geometry:{el:Element;attributes:[string,string|null][]}[]=[];
  let version=0,previewBusy=false,lastPreview='';
  let queued:{state:State;circle:Circle;version:number}|undefined;
  let verdicts:{el:Element;attributes:[string,string|null][]}[]=[];
  const paintVerdicts=(result:Result)=>{
    root.querySelectorAll<HTMLElement>('.ring').forEach((el,i)=>{const c=result.checkpoints[i];if(!c)return;el.dataset.match=c.hit?'hit':'miss';el.dataset.status='waiting';el.classList.remove('hit','miss','just-hit');el.classList.add('waiting');el.setAttribute('aria-label',targetDescription(c,i,'waiting'));});
    root.querySelectorAll<HTMLElement>('.target-label').forEach((el,i)=>{const c=result.checkpoints[i];if(c)el.dataset.match=c.hit?'hit':'miss';});
  };
  const flushPreview=async()=>{
    if(previewBusy)return;
    previewBusy=true;
    try {
      while(queued){const job=queued;queued=undefined;try{const result=await evaluatePreview(job.state,job.circle);if(result&&drag&&job.version===version)paintVerdicts(result);}catch{/* A preview cannot change the acknowledged construction. */}}
    } finally {previewBusy=false;}
  };
  const cancel=()=>{
    version++;queued=undefined;lastPreview='';drag=undefined;selected=undefined;
    for(const {el,attributes} of [...verdicts,...geometry])for(const [key,value] of attributes){
      if(value===null)el.removeAttribute(key);else el.setAttribute(key,value);
    }
    verdicts=[];geometry=[];
    for(const {el,transform} of artwork){if(transform===null)el.removeAttribute('transform');else el.setAttribute('transform',transform);}
    artwork=[];
    for(const {el,value} of fields)el.value=value;
    fields=[];
    root.querySelectorAll<HTMLElement>('[data-circle-handle]').forEach(el=>{el.setAttribute('aria-pressed','false');el.style.translate='';});
    root.querySelectorAll('#circle-pickup,#circle-preview').forEach(el=>el.setAttribute('hidden',''));
    root.removeAttribute('data-circle-preview');
    const hint=root.querySelector('.circle-drag-hint');if(hint)hint.textContent='';
  };
  const select=(button:HTMLElement)=>{selected=button.dataset.circleHandle as 'centre'|'radius';root.querySelectorAll('[data-circle-handle]').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));const hint=root.querySelector('.circle-drag-hint');if(hint)hint.textContent='Tap a destination. Escape cancels.';};
  const coordinateAt=(event:PointerEvent,ctx:CircleContext,matrix:DOMMatrix):[number,number]=>{
    const screen=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()),origin=transform(ctx.state,ctx.camera,[0,0]),unit=transform(ctx.state,ctx.camera,[1,1]),x=(screen.x-origin[0])/(unit[0]-origin[0]),y=(screen.y-origin[1])/(unit[1]-origin[1]);
    return [x,y];
  };
  const valueAt=(event:PointerEvent,kind:'centre'|'radius',ctx:CircleContext,matrix:DOMMatrix,origin?:[number,number]):Circle=>{
    const [x,y]=coordinateAt(event,ctx,matrix);
    const current=ctx.state.circle!,next={...current},editable=ctx.result.circle!.editable;
    if(kind==='centre') {if(editable.includes('x'))next.x=quarter(Math.max(-4,Math.min(8,origin?fraction(current.x)+x-origin[0]:x)));if(editable.includes('y'))next.y=quarter(Math.max(-4,Math.min(8,origin?fraction(current.y)+y-origin[1]:y)));}
    else next.radius=quarter(Math.max(.25,Math.min(6,origin?fraction(current.radius)+x-origin[0]:Math.hypot(x-fraction(current.x),y-fraction(current.y)))));
    return next;
  };
  root.addEventListener('pointerdown',event=>{
    const ctx=get(),button=(event.target as Element).closest<HTMLElement>('[data-circle-handle]'),svg=root.querySelector<SVGSVGElement>('#flight-svg'),matrix=svg?.getScreenCTM();
    if(!ctx||!matrix||event.button!==0||!(event.target as Element).closest('.flight-diagram'))return;
    if(!button&&selected) {event.preventDefault();const next=valueAt(event,selected,ctx,matrix);cancel();void commit(next);return;}
    if(!button)return;event.preventDefault();window.getSelection()?.removeAllRanges();button.focus({preventScroll:true});root.setPointerCapture(event.pointerId);
    const [x,y]=coordinateAt(event,ctx,matrix),circle=ctx.state.circle!;
    artwork=[...root.querySelectorAll('#launcher,#launcher-front,#cucumber')].map(el=>({el,transform:el.getAttribute('transform')}));
    fields=[...root.ownerDocument.querySelectorAll<HTMLInputElement>('[data-circle-value]')].map(el=>({el,value:el.value}));
    geometry=[...root.querySelectorAll('.circle-radius-line,.circle-centre-mark')].map(el=>({el,attributes:['d','cx','cy'].map(key=>[key,el.getAttribute(key)] as [string,string|null])}));
    verdicts=[...root.querySelectorAll('.ring,.target-label')].map(el=>({el,attributes:['class','data-match','data-status','aria-label'].map(key=>[key,el.getAttribute(key)] as [string,string|null])}));
    drag={id:event.pointerId,kind:button.dataset.circleHandle as 'centre'|'radius',start:[event.clientX,event.clientY],origin:[x,y],next:{...circle},context:ctx,rect:matrix,control:button,moved:false};
  });
  root.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;event.preventDefault();
    drag.moved ||= Math.hypot(event.clientX-drag.start[0],event.clientY-drag.start[1])>4;if(!drag.moved)return;
    drag.next=valueAt(event,drag.kind,drag.context,drag.rect,drag.origin);
    const world:[number,number]=[fraction(drag.next.x),fraction(drag.next.y)],centre=transform(drag.context.state,drag.context.camera,world),radius=Math.abs(transform(drag.context.state,drag.context.camera,[world[0]+fraction(drag.next.radius),world[1]])[0]-centre[0]);
    const point=drag.kind==='centre'?centre:[centre[0]+radius,centre[1]],ghost=root.querySelector('#circle-pickup'),preview=root.querySelector('#circle-preview');
    const old=drag.context.result.circle!,oldCentre=transform(drag.context.state,drag.context.camera,old.centre),oldStart=transform(drag.context.state,drag.context.camera,[old.centre[0]+old.radius,old.centre[1]]),dx=centre[0]+radius-oldStart[0],dy=centre[1]-oldStart[1];
    for(const {el,transform} of artwork)el.setAttribute('transform',`translate(${dx} ${dy}) ${transform||''}`);
    for(const {el} of fields)el.value=drag.next[el.dataset.circleValue as keyof Circle];
    root.querySelector('.circle-radius-line')?.setAttribute('d',`M${centre[0]} ${centre[1]}h${radius}`);
    const centreMark=root.querySelector('.circle-centre-mark');centreMark?.setAttribute('cx',String(centre[0]));centreMark?.setAttribute('cy',String(centre[1]));
    root.querySelectorAll<HTMLElement>('[data-circle-handle]').forEach(el=>{const delta=el.dataset.circleHandle==='radius'?[dx,dy]:[centre[0]-oldCentre[0],centre[1]-oldCentre[1]];el.style.translate=`${delta[0]*drag!.rect.a}px ${delta[1]*drag!.rect.d}px`;});
    preview?.removeAttribute('hidden');preview?.setAttribute('cx',String(centre[0]));preview?.setAttribute('cy',String(centre[1]));preview?.setAttribute('r',String(radius));
    ghost?.removeAttribute('hidden');ghost?.setAttribute('transform',`translate(${point.join(' ')})`);
    // The pointer-down matrix fixes the frame for this gesture. Painting a
    // verdict touches only attributes: no DOM replacement, bounds read or fit.
    const key=JSON.stringify(drag.next);
    if(key!==lastPreview){lastPreview=key;root.setAttribute('data-circle-preview','true');queued={state:drag.context.state,circle:{...drag.next},version:++version};void flushPreview();}
  });
  root.addEventListener('pointerup',event=>{
    if(!drag||drag.id!==event.pointerId)return;event.preventDefault();const held=drag;drag=undefined;
    if(root.hasPointerCapture(event.pointerId))root.releasePointerCapture(event.pointerId);
    if(held.moved){
      // Keep the proposed artwork and readings while the one release action is
      // acknowledged. Restoring them here flashes the pickup position for a frame.
      queued=undefined;lastPreview='';selected=undefined;const released=++version;
      root.querySelector('#circle-pickup')?.setAttribute('hidden','');
      void commit(held.next).finally(()=>{if(version===released)cancel();});
    }else select(held.control);
  });
  root.addEventListener('click',event=>{const button=(event.target as Element).closest<HTMLElement>('[data-circle-handle]');if(button&&event.detail===0)select(button);});
  root.addEventListener('pointercancel',cancel);
  root.addEventListener('lostpointercapture',()=>{if(drag)cancel();});
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape'){cancel();return;}
    const button=(event.target as Element).closest<HTMLElement>('[data-circle-handle]'),ctx=get();
    if(!button||!ctx||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();const next={...ctx.state.circle!},step=event.shiftKey?1:.25;
    const key=button.dataset.circleHandle==='radius'?'radius':event.key==='ArrowLeft'||event.key==='ArrowRight'?'x':'y';
    if(!ctx.result.circle!.editable.includes(key))return;
    next[key]=quarter(Math.max(key==='radius'?.25:-4,Math.min(key==='radius'?6:8,fraction(next[key])+(event.key==='ArrowLeft'||event.key==='ArrowDown'?-step:step))));cancel();void commit(next);
  });
  return cancel;
}
