import katex from 'katex';
import { fraction, OPS, type Checkpoint, type Result, type State } from './types';
import { icon } from './icons';
export type Camera = { min: number; max: number };
export type Flight = { phase:'ready'|'releasing'|'flying'|'landed'; position:number; release?:number };
const mathCache=new Map<string,string>();
export const tex=(latex:string)=>{
  const cached=mathCache.get(latex);if(cached)return cached;
  const html=katex.renderToString(latex,{throwOnError:false,trust:false,strict:'ignore',output:'htmlAndMathml'});
  if(mathCache.size>=256)mathCache.delete(mathCache.keys().next().value!);
  mathCache.set(latex,html);return html;
};
const rationalTex=(value:string)=>{const [n,d]=value.split('/');return d?`${n.startsWith('-')?'-':''}\\frac{${n.replace(/^-/,'')}}{${d}}`:n;};
// Fit one diagram uniformly. Resizing or browser zoom never stretches its axes.
// Reserve space beyond both ends of the vertical plot for a steep pullback.
const plotArea=()=>({width:760,height:414,top:62,bottom:310});
const svgMath=(latex:string,x:number,y:number,width=48,extraClass='',offsetY=0)=>`<foreignObject data-axis-x="${x}" data-axis-y="${y}" data-axis-offset-y="${offsetY}" data-axis-width="${width}" x="${x-width/2}" y="${y-12}" width="${width}" height="28"><div xmlns="http://www.w3.org/1999/xhtml" class="axis-math ${extraClass}">${tex(latex)}</div></foreignObject>`;
export function sizeFlightAnnotations(root:HTMLElement) {
  const svg=root.querySelector<SVGSVGElement>('#flight-svg'),scale=svg?.getScreenCTM()?.a;
  if(!svg||!scale)return;
  // Text stays at 12 CSS pixels as the diagram fits, so browser zoom can enlarge
  // the notation normally. Only label boxes change; the coordinate map does not.
  for(const label of svg.querySelectorAll<SVGForeignObjectElement>('[data-axis-x]')) {
    const width=Number(label.dataset.axisWidth)/scale;
    const x=Math.max(16/scale,Math.min(760-16/scale,Number(label.dataset.axisX)));
    const y=Math.max(14/scale,Math.min(414-16/scale,Number(label.dataset.axisY)+Number(label.dataset.axisOffsetY)/scale));
    label.setAttribute('x',String(x-width/2));label.setAttribute('y',String(y-12/scale));
    label.setAttribute('width',String(width));label.setAttribute('height',String(28/scale));
    label.querySelector<HTMLElement>('.axis-math')!.style.fontSize=`${12/scale}px`;
  }
  // Keep the zero numeral left of the first target's full formula. Its text
  // keeps a CSS-pixel size even when the coordinate diagram becomes smaller.
  const zero=svg.querySelector('.zero-label')?.closest('foreignObject');
  const firstTarget=svg.querySelector('.target-label .katex-html');
  if(zero&&firstTarget) {
    const numeral=zero.querySelector('.katex-html')!.getBoundingClientRect();
    const target=firstTarget.getBoundingClientRect();
    const shift=Math.min(0,target.left-numeral.right-8);
    if(numeral.width&&target.width)zero.setAttribute('x',String(Number(zero.getAttribute('x'))+shift/scale));
  }
}
export const interpolate=(points:[number,number][],p:number):[number,number]=>{
  if(!points.length)return [0,0];
  const start=points[0][0],end=points.at(-1)![0],x=start+(end-start)*p,index=points.findIndex(v=>v[0]>=x);
  if(index<=0)return points[index===-1?points.length-1:0];
  const a=points[index-1],b=points[index],t=(x-a[0])/(b[0]-a[0]);return [x,a[1]+(b[1]-a[1])*t];
};
export function transform(state:State,camera:Camera,point:[number,number]) {
  const {width,top,bottom}=plotArea(),end=state.sourceId===5?2:4;
  return [120+point[0]/end*(width-210),bottom-(point[1]-camera.min)/(camera.max-camera.min)*(bottom-top)];
}
export const path=(points:[number,number][],state:State,camera:Camera)=>points.map((v,i)=>`${i?'L':'M'}${transform(state,camera,v).map(n=>n.toFixed(2)).join(',')}`).join(' ');
export const targetStatus=(checkpoint:Checkpoint,state:State,flight:Flight)=>state.mode!=='remix'&&(flight.phase==='flying'||flight.phase==='landed')&&fraction(checkpoint.x)/(state.sourceId===5?2:4)<=flight.position+1e-8?(checkpoint.hit?'hit':'miss'):'waiting';
export const targetDescription=(checkpoint:Checkpoint,index:number,status:string)=>`Target ${index+1}: ${status==='waiting'?(checkpoint.hit?'path matches, ready to throw':'path misses'):(checkpoint.hit?'hit confirmed':'miss confirmed')}`;
export const targetMark=(status:string)=>status==='hit'?icon('check',13):status==='miss'?icon('close',13):'';
export function flightView(state:State,result:Result,camera:Camera,flight:Flight) {
  const {width,height,top,bottom}=plotArea();
  const rings=(state.mode==='remix'?[]:result.checkpoints).map((c,i)=>{
    const [x,y]=transform(state,camera,[fraction(c.x),fraction(c.target)]),status=targetStatus(c,state,flight);
    return `<g class="ring ${status}" data-ring="${i}" data-target="${i}" data-match="${c.hit?'hit':'miss'}" data-status="${status}" aria-label="${targetDescription(c,i,status)}"><circle class="ring-burst" cx="${x}" cy="${y}" r="22"/><circle class="ring-outer" cx="${x}" cy="${y}" r="20"/><circle class="ring-inner" cx="${x}" cy="${y}" r="13"/><g class="target-badge" transform="translate(${x} ${y})"><circle r="12"/><path class="hit-mark" d="m-7 0 5 5 9-10"/><path class="miss-mark" d="m-5-5 10 10m0-10-10 10"/></g></g>`;
  }).join('');
  const targetLabels=(state.mode==='remix'?[]:result.checkpoints).map(c=>{
    const [x,y]=transform(state,camera,[fraction(c.x),fraction(c.target)]);
    // Put labels toward the open middle of the plot, clear of the launcher and
    // axis ticks. Their gap includes CSS pixels because the text does not shrink.
    const direction=y<(top+bottom)/2?1:-1;
    return `<g class="target-label" data-match="${c.hit?'hit':'miss'}">${svgMath(`h = ${rationalTex(c.target)}`,x,y+20*direction,70,'target-height',16*direction)}</g>`;
  }).join('');
  const ticks=Array.from({length:(state.sourceId===5?2:4)+1},(_,i)=>{
    const [x]=transform(state,camera,[i,0]);
    return `<path class="flight-grid" d="M${x} ${top}V${bottom}" stroke="#dce6d0" stroke-dasharray="2 8"/>`;
  }).join('');
  const [startX,startY]=transform(state,camera,result.points[0]),[zeroX,zeroY]=transform(state,camera,[0,0]);
  return `<svg id="flight-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${state.mode==='remix'?'Your cucumber’s flight path.':`Your cucumber's flight path through ${result.checkpoints.length} targets.`}">
    <defs><clipPath id="plot-clip"><rect x="16" y="0" width="${width-32}" height="${height-38}" rx="12"/></clipPath></defs>
    <g clip-path="url(#plot-clip)">${ticks}
      <path class="flight-height-axis" d="M${zeroX} ${top}V${bottom}"/>
      <path class="flight-zero-line" data-zero-line d="M84 ${zeroY}H${width-46}"/>
      <path id="trajectory" d="${path(result.points,state,camera)}"/>
      <path id="flight-trail" d=""/>
      <g id="launcher" transform="translate(${startX-40} ${startY+12})" aria-hidden="true"><ellipse cx="0" cy="28" rx="18" ry="3" fill="#dce5ce"/><path d="m-2 25 1-15-10-18m10 18 13-18" fill="none" stroke="#8c7955" stroke-width="7" stroke-linecap="round"/><path d="m-3 24 1-14-9-17m10 17 11-17" fill="none" stroke="#b4a078" stroke-width="2" stroke-linecap="round"/><path id="band-back" class="slingshot-band"/><path id="band-front" class="slingshot-band"/></g>
      ${rings}
      <g id="cucumber" aria-hidden="true"><g id="flight-motion"><path class="speed-lines" d="M-32-8h-14m13 8h-21m22 8h-13"/></g><g id="flight-spin"><image href="./cucumber.svg" x="-29" y="-29" width="58" height="58"/></g></g>
      <g id="launcher-front" transform="translate(${startX-40} ${startY+12})" aria-hidden="true"><path id="slingshot-pouch" d="M3-8Q-5 0 3 8"/></g>
    </g><g id="target-labels">${targetLabels}</g><g id="axis-labels">${Array.from({length:(state.sourceId===5?2:4)+1},(_,i)=>svgMath(String(i),transform(state,camera,[i,0])[0],height-25)).join('')}${svgMath('0',64,zeroY,24,'zero-label')}${svgMath('h',zeroX,Math.max(16,top-12),28)}${svgMath('x',width-20,height-25,26)}</g>
  </svg>`;
}
// These are reading aids for exact kernel values, never inputs to validation.
const decimalMatches=(exact:string,decimal:string)=>{
  const [numerator,denominator]=exact.split('/').map(BigInt);
  const [mantissa,exponent='0']=decimal.split('e');
  const places=(mantissa.split('.')[1]?.length||0)-Number(exponent);
  const digits=BigInt(mantissa.replace('.',''));
  return places>=0?numerator*10n**BigInt(places)===digits*denominator:numerator===digits*10n**BigInt(-places)*denominator;
};
const comparisonValue=(exact:string)=>{
  const value=fraction(exact);
  const rounded=exact.includes('/')&&Number.isFinite(value)&&value!==0?String(Number(value.toPrecision(4))):undefined;
  const [mantissa,exponent]=rounded?.split('e')||[];
  const decimal=exponent?`${mantissa}\\times 10^{${Number(exponent)}}`:mantissa;
  const relation=rounded&&decimalMatches(exact,rounded)?'=':'\\approx';
  return `<span class="comparison-value"><span class="exact-value">${tex(rationalTex(exact))}</span>${decimal?`<span class="decimal-value">${tex(`${relation} ${decimal}`)}</span>`:''}</span>`;
};
export function functionView(state:State,result:Result,flight:Flight) {
  const puzzle=state.mode!=='remix';
  const guide=result.heightGuide;
  const gap=guide?`<tfoot><tr class="gap-comparison" data-gap-match="${guide.hit}"><th scope="row"><span>Height gap</span><small>${tex(`h(${guide.toX})-h(${guide.fromX})`)}</small></th><td>${comparisonValue(guide.target)}</td><td>${comparisonValue(guide.actual)}</td><td><span class="gap-verdict" aria-label="${guide.hit?'Height gap matches':'Height gap does not match'}">${targetMark(guide.hit?'hit':'miss')}</span></td></tr></tfoot>`:'';
  const rows=result.checkpoints.map((c,i)=>{const status=c.hit?'hit':'miss',confirmed=targetStatus(c,state,flight);return `<tr data-status="${puzzle?status:'sample'}"><td>${comparisonValue(c.x)}</td>${puzzle?`<td>${comparisonValue(c.target)}</td>`:''}<td>${comparisonValue(c.actual)}</td>${puzzle?`<td class="verdict-cell"><span class="equation-verdict" data-target="${i}" data-status="${confirmed}" aria-label="${targetDescription(c,i,confirmed)}">${targetMark(status)}</span></td>`:''}</tr>`;}).join('');
  return `<div class="equation-layout"><section class="final-equation" aria-label="Final equation"><span class="scene-tag">YOUR FUNCTION</span><div class="final-formula">${tex(`h(x) = ${result.stages.at(-1)!.latex}`)}</div></section><div class="value-table"><table aria-label="${puzzle?'Compare your function with the targets':'Sample heights'}"><thead><tr><th>Position ${tex('x')}</th>${puzzle?'<th>Expected</th>':''}<th>${puzzle?'Actual':'Height'}</th>${puzzle?`<th><span class="sr-only">Matches target</span>${icon('target',16)}</th>`:''}</tr></thead><tbody>${rows}</tbody>${gap}</table></div></div>`;
}

const flowScales=new WeakMap<Result,{min:number;max:number;start:number;end:number}>();
function flowScale(result:Result) {
  let scale=flowScales.get(result);
  if(!scale) {
    const heights=[...result.stages.flatMap(stage=>stage.points.map(point=>point[1])),...result.checkpoints.map(c=>fraction(c.target))];
    const min=Math.min(0,...heights),max=Math.max(0,...heights),padding=Math.max(2,max-min)*.12;
    scale={min:min-padding,max:max+padding,start:result.points[0][0],end:result.points.at(-1)![0]};
    flowScales.set(result,scale);
  }
  return scale;
}
function flowPoint(result:Result,[x,y]:[number,number]) {
  const s=flowScale(result);
  return [26+(x-s.start)/(s.end-s.start)*138,108-(y-s.min)/(s.max-s.min)*88];
}
const flowPath=(result:Result,points:[number,number][])=>points.map((p,i)=>`${i?'L':'M'}${flowPoint(result,p).map(n=>n.toFixed(2)).join(',')}`).join(' ');
const sampleTex=(value:number)=>{
  if(Math.abs(value)>=10000){const [n,e]=value.toExponential(2).split('e');return `${n}\\times 10^{${Number(e)}}`;}
  return (Math.abs(value)<.005?0:value).toFixed(2);
};
const positionText=(value:number)=>String(Number(value.toFixed(3)));
export function flow(state:State,result:Result,selectedStage:string,probeIndex:number,flight:Flight) {
  const scale=flowScale(result),step=(scale.end-scale.start)/(result.points.length-1),x=result.points[probeIndex][0];
  const guide=result.heightGuide;
  const gapGoal=guide?`<span class="flow-gap-goal" aria-label="Target height gap from x=${guide.fromX} to x=${guide.toX}">Target ${tex(`h(${rationalTex(guide.toX)})-h(${rationalTex(guide.fromX)})=${rationalTex(guide.target)}`)}</span>`:'';
  const zero=flowPoint(result,[0,0])[1];
  const goals=state.mode==='remix'?[]:result.checkpoints;
  const targets=goals.map((c,i)=>{
    const [x,y]=flowPoint(result,[fraction(c.x),fraction(c.target)]),status=targetStatus(c,state,flight);
    return `<circle class="flow-target" data-target="${i}" data-match="${c.hit?'hit':'miss'}" data-status="${status}" cx="${x}" cy="${y}" r="6"/>`;
  }).join('');
  const goalList=goals.map((c,i)=>{const status=targetStatus(c,state,flight);return `<span class="flow-goal" data-target="${i}" data-match="${c.hit?'hit':'miss'}" data-status="${status}" role="img" aria-label="${targetDescription(c,i,status)}">${tex(`(${rationalTex(c.x)},\\,${rationalTex(c.target)})`)}<span class="target-result" aria-hidden="true">${targetMark(c.hit?'hit':'miss')}</span></span>`;}).join('');
  const cards=result.stages.map((stage,i)=>{
    const op=i?state.nodes[i-1].op:undefined,previous=i&&op!=='D'&&op!=='I'?result.stages[i-1]:undefined;
    const tangent=state.nodes[i]?.op==='D',area=state.nodes[i]?.op==='I';
    const areaPath=area?flowPath(result,[...stage.points,[scale.end,0],[scale.start,0]])+'Z':'';
    const gap=guide?.stages[i];
    const gapLabel=gap?`<span class="gap-sample"><span class="gap-swatch" aria-hidden="true"></span>Gap ${tex(`= ${rationalTex(gap.gap)}`)}</span>`:'';
    let gapPlot='';
    if(guide&&gap) {
      const [x0,y0]=flowPoint(result,[fraction(guide.fromX),fraction(gap.from)]),[x1,y1]=flowPoint(result,[fraction(guide.toX),fraction(gap.to)]);
      const direction=Math.sign(y1-y0),size=Math.min(3,Math.abs(y1-y0)/4),middle=(y0+y1)/2;
      const arrow=size?`<path class="gap-direction" d="M${173-size} ${middle-direction*size}L173 ${middle+direction*size}L${173+size} ${middle-direction*size}Z"/>`:'';
      gapPlot=`<g class="flow-height-gap" data-flow-gap="${i}" data-gap-direction="${direction<0?'up':direction>0?'down':'flat'}" aria-label="Height gap from x=${guide.fromX} to x=${guide.toX}: ${gap.gap}"><path class="gap-guides" d="M${x0} ${y0}H173M${x1} ${y1}H173"/><path class="gap-bracket" d="M169 ${y0}H177M173 ${y0}V${y1}M169 ${y1}H177"/>${arrow}<circle data-gap-position="${guide.fromX}" cx="${x0}" cy="${y0}" r="2.5"/><circle data-gap-position="${guide.toX}" cx="${x1}" cy="${y1}" r="2.5"/></g>`;
    }
    return `${i?`<span class="flow-connector" aria-hidden="true">${icon('arrow',18)}</span>`:''}<article class="flow-machine ${op?OPS[op].color:'source-machine'} ${stage.id===selectedStage?'inspected':''}" aria-label="${i?'Step '+i+': '+OPS[op!].name:'Starting curve'}"><div class="machine-body"><div class="machine-meta"><span class="machine-kicker">${i?'STEP '+i:'START'}</span><span class="machine-icon">${tex(op?OPS[op].formula:stage.latex)}</span><span class="machine-sample">${tex('h \\approx ')}<span data-flow-stage="${i}"></span></span>${gapLabel}${area?`<span class="area-sample">Area ${tex('\\approx')} <span data-flow-area-value="${i}"></span></span>`:''}${tangent?`<span class="tangent-sample">${tex('\\frac{\\mathrm{d}h}{\\mathrm{d}x} \\approx ')}<span data-flow-slope="${i}"></span></span>`:''}</div><svg class="flow-plot" viewBox="0 0 184 132" role="img" data-flow-plot="${i}"><defs><clipPath id="flow-clip-${i}"><rect x="22" y="15" width="148" height="100"/></clipPath>${area?`<clipPath id="flow-area-window-${i}"><rect data-flow-area-window="${i}" x="26" y="15" width="0" height="100"/></clipPath><clipPath id="flow-positive-${i}"><rect x="22" y="15" width="148" height="${Math.max(0,zero-15)}"/></clipPath><clipPath id="flow-negative-${i}"><rect x="22" y="${zero}" width="148" height="${Math.max(0,115-zero)}"/></clipPath><pattern id="area-hatch-${i}" patternUnits="userSpaceOnUse" width="5" height="5"><path d="M-1 1L1-1M0 5L5 0M4 6L6 4" stroke="#ac6755" stroke-width=".8"/></pattern>`:''}</defs><path class="flow-axis" d="M26 20V108"/><foreignObject x="2" y="${zero-8}" width="20" height="20"><div xmlns="http://www.w3.org/1999/xhtml" class="flow-zero">${tex('0')}</div></foreignObject><g clip-path="url(#flow-clip-${i})">${area?`<g clip-path="url(#flow-area-window-${i})" class="flow-area" data-flow-area="${i}"><path class="area-positive" clip-path="url(#flow-positive-${i})" d="${areaPath}"/><g clip-path="url(#flow-negative-${i})"><path class="area-negative" d="${areaPath}"/><path fill="url(#area-hatch-${i})" d="${areaPath}"/></g></g>`:''}<path class="flow-zero-line" data-zero-line d="M26 ${zero}H164"/>${previous?`<path class="flow-before" d="${flowPath(result,previous.points)}"/>`:''}<path class="flow-curve" d="${flowPath(result,stage.points)}"/>${tangent?`<path class="flow-tangent" data-flow-tangent="${i}"/>`:''}<path class="flow-probe" data-flow-probe="${i}"/><path class="flow-change" data-flow-change="${i}"/>${previous?`<circle class="flow-before-point" data-flow-before="${i}" r="3.5"/>`:''}<circle class="flow-point" data-flow-point="${i}" r="4.5"/></g>${gapPlot}${i===result.stages.length-1?targets:''}</svg></div></article>`;
  }).join('');
  return `<div class="flow-controls"><div class="flow-control-heading"><label for="flow-position">Explore at ${tex('x = ')}<output id="flow-position-value" for="flow-position">${tex(positionText(x))}</output></label>${gapGoal}${goals.length?`<div class="flow-goals" role="group" aria-label="Target coordinates and validation">${goalList}</div>`:''}</div><div class="flow-slider-row"><span>${tex(positionText(scale.start))}</span><input id="flow-position" type="range" min="${scale.start}" max="${scale.end}" step="${step}" value="${x}" aria-label="Position x" aria-valuetext="x = ${positionText(x)}"><span>${tex(positionText(scale.end))}</span><span class="flow-key"><span class="before-key"></span>Before <span class="after-key"></span>After</span></div><span class="sr-only">Every graph uses the same height scale. Move position to compare each operation. A tangent shows the incoming slope before a slope block. Before an area block, shading shows accumulated area: solid above zero adds, hatched below zero subtracts. Targets appear on the final graph. During a throw, position follows the flight, then returns to your inspected position.</span></div><div class="flow-line" role="group" aria-label="Transformation chain">${cards}</div>`;
}
export function updateFlowProbe(root:HTMLElement,state:State,result:Result,index:number) {
  const scale=flowScale(result),x=result.points[index][0],zero=flowPoint(result,[x,0])[1];
  const slider=root.querySelector<HTMLInputElement>('#flow-position');
  if(slider){slider.dataset.probeIndex=String(index);slider.value=String(x);slider.setAttribute('aria-valuetext',`x = ${positionText(x)}`);slider.style.setProperty('--position',`${100*(x-scale.start)/(scale.end-scale.start)}%`);}
  const output=root.querySelector('#flow-position-value');if(output)output.innerHTML=tex(positionText(x));
  result.stages.forEach((stage,i)=>{
    const value=stage.points[index][1],[px,py]=flowPoint(result,[x,value]);
    const point=root.querySelector(`[data-flow-point="${i}"]`);point?.setAttribute('cx',String(px));point?.setAttribute('cy',String(py));
    root.querySelector(`[data-flow-probe="${i}"]`)?.setAttribute('d',`M${px} 20V108`);
    const previous=i&&!['D','I'].includes(state.nodes[i-1].op)?result.stages[i-1]:undefined;
    const beforeY=previous?flowPoint(result,[x,previous.points[index][1]])[1]:zero;
    root.querySelector(`[data-flow-change="${i}"]`)?.setAttribute('d',`M${px} ${beforeY}V${py}`);
    const before=root.querySelector(`[data-flow-before="${i}"]`);before?.setAttribute('cx',String(px));before?.setAttribute('cy',String(beforeY));
    const sample=root.querySelector(`[data-flow-stage="${i}"]`);if(sample)sample.innerHTML=tex(sampleTex(value));
    const guide=result.heightGuide,gap=guide?.stages[i];
    const gapDescription=guide&&gap?` The height gap from x=${guide.fromX} to x=${guide.toX} is ${gap.gap}.`:'';
    root.querySelector(`[data-flow-plot="${i}"]`)?.setAttribute('aria-label',`At position ${positionText(x)}, height is approximately ${Number(value.toPrecision(4))}.${gapDescription}`);
    if(state.nodes[i]?.op==='I') {
      const accumulated=result.stages[i+1].points[index][1];
      root.querySelector('[data-flow-area-window="'+i+'"]')?.setAttribute('width',String(Math.max(0,px-26)));
      const label=root.querySelector('[data-flow-area-value="'+i+'"]');if(label)label.innerHTML=tex(sampleTex(accumulated));
      root.querySelector('[data-flow-plot="'+i+'"]')?.setAttribute('aria-label','At position '+positionText(x)+', signed area from zero is approximately '+Number(accumulated.toPrecision(4))+'. Solid area above zero adds; hatched area below zero subtracts.'+gapDescription);
    }
    if(state.nodes[i]?.op==='D') {
      const slope=result.stages[i+1].points[index][1],reach=(scale.end-scale.start)*.18;
      const left=Math.max(scale.start,x-reach),right=Math.min(scale.end,x+reach);
      root.querySelector(`[data-flow-tangent="${i}"]`)?.setAttribute('d',flowPath(result,[[left,value+slope*(left-x)],[right,value+slope*(right-x)]]));
      const label=root.querySelector(`[data-flow-slope="${i}"]`);if(label)label.innerHTML=tex(sampleTex(slope));
    }
  });
}
