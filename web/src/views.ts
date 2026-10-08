import katex from 'katex';
import { decimalTex, fraction, isRelationSource, targetHeight, OPS, type Checkpoint, type CurvePath, type Point, type Op, type Result, type State } from './types';
import { icon } from './icons';
import { drawnPaths, flightStrokes, heightsAt } from './geometry';
import { stationScene, updateStationScene } from './station-scene';
import { cropVerdict, cropWindow, updateCropWindow, probePoints } from './crop';
export type Camera = { min: number; max: number; minX?:number; maxX?:number };
export type Flight = { phase:'ready'|'releasing'|'flying'|'landed'; position:number; release?:number };
const CUCUMBER_VIEWBOX=64,CUCUMBER_IMAGE_SIZE=58;
const CUCUMBER_BODY_TOP:[number,number]=[34.12,8.4],CUCUMBER_BODY_BOTTOM:[number,number]=[27.08,58.56];
const cucumberBodyMidpoint:[number,number]=[(CUCUMBER_BODY_TOP[0]+CUCUMBER_BODY_BOTTOM[0])/2,(CUCUMBER_BODY_TOP[1]+CUCUMBER_BODY_BOTTOM[1])/2];
const cucumberImageScale=CUCUMBER_IMAGE_SIZE/CUCUMBER_VIEWBOX;
const cucumberForward=[(CUCUMBER_BODY_TOP[0]-CUCUMBER_BODY_BOTTOM[0])*cucumberImageScale,(CUCUMBER_BODY_TOP[1]-CUCUMBER_BODY_BOTTOM[1])*cucumberImageScale] as [number,number];
const cucumberForwardAngle=Math.atan2(cucumberForward[1],cucumberForward[0]);
const cucumberHalfLength=Math.hypot(...cucumberForward)/2;
export const cucumberFlightGeometry={
  imageX:-cucumberBodyMidpoint[0]*cucumberImageScale,
  imageY:-cucumberBodyMidpoint[1]*cucumberImageScale,
  imageSize:CUCUMBER_IMAGE_SIZE
};
/** The canonical body's bottom sits in the pouch while its chord follows the launch tangent. */
export function cucumberPose(position:[number,number],angle:number,pull:number,scale=1) {
  const centrePullback=(92-cucumberHalfLength)*scale*pull;
  return {
    transform:`translate(${(position[0]-centrePullback*Math.cos(angle)).toFixed(2)} ${(position[1]-centrePullback*Math.sin(angle)).toFixed(2)})`,
    degrees:(angle-cucumberForwardAngle)*180/Math.PI
  };
}
/** Keep the loaded artwork and its interactive grip on the same projected tangent. */
export function launcherPose(state:State,camera:Camera,origin:[number,number],tangent:[number,number],scale=1) {
  const start=transform(state,camera,origin),ahead=transform(state,camera,[origin[0]+tangent[0],origin[1]+tangent[1]]);
  const angle=Math.atan2(ahead[1]-start[1],ahead[0]-start[0]),degrees=angle*180/Math.PI;
  return {start,angle,degrees,transform:`translate(${start[0]} ${start[1]}) rotate(${degrees}) scale(${scale}) translate(-40 12)`,grip:[start[0]-58*Math.cos(angle)-10*Math.sin(angle),start[1]-58*Math.sin(angle)+10*Math.cos(angle)]};
}
const mathCache=new Map<string,string>();
export const tex=(latex:string)=>{
  const cached=mathCache.get(latex);if(cached)return cached;
  const html=katex.renderToString(latex,{throwOnError:false,trust:false,strict:'ignore',output:'htmlAndMathml'});
  if(mathCache.size>=256)mathCache.delete(mathCache.keys().next().value!);
  mathCache.set(latex,html);return html;
};
const operationCache=new Map<string,string>();
/** Only our fixed operation templates may attach the incoming-expression class.
 * Arbitrary equations still use tex(), with every HTML command untrusted. */
export function operationTex(op?:Op) {
  const formula=op?OPS[op].formula:'\\square',cached=operationCache.get(formula);
  if(cached)return cached;
  const latex=formula.replaceAll('\\square','\\htmlClass{input-placeholder}{\\square}');
  const html=katex.renderToString(latex,{throwOnError:false,strict:'ignore',output:'htmlAndMathml',trust:context=>context.command==='\\htmlClass'});
  operationCache.set(formula,html);return html;
}
export const targetLatex=(checkpoint:Checkpoint)=>checkpoint.targetLatex??rationalTex(checkpoint.target);
export const rationalTex=(value:string)=>{const [n,d]=value.split('/');return d?`${n.startsWith('-')?'-':''}\\frac{${n.replace(/^-/,'')}}{${d}}`:n;};
// Fit one diagram uniformly. Resizing or browser zoom never stretches its axes.
// Reserve space beyond both ends of the vertical plot for a steep pullback.
const plotArea=()=>({width:760,height:414,top:62,bottom:310});
// Keep KaTeX in HTML. WebKit can paint positioned KaTeX descendants at the SVG
// origin when they live inside foreignObject, even when its box is correct.
const flightMath=(latex:string,x:number,y:number,width=48,extraClass='',offsetY=0)=>`<span class="flight-label" data-axis-x="${x}" data-axis-y="${y}" data-axis-offset-y="${offsetY}" data-axis-width="${width}"><span class="axis-math ${extraClass}">${tex(latex)}</span></span>`;
export function sizeFlightAnnotations(root:HTMLElement) {
  const svg=root.querySelector<SVGSVGElement>('#flight-svg');
  const overlay=root.querySelector<HTMLElement>('.flight-annotations');
  if(!svg||!overlay)return;
  const callouts=svg.hasAttribute('data-callouts');
  root.classList.toggle('has-flight-callouts',callouts);
  type Callout={label:HTMLElement;width:number;height:number};
  const rows:{entries:Callout[];side:'top'|'bottom'}[]=[];
  if(callouts) {
    const available=Math.max(120,root.clientWidth-24);
    const labels=[...overlay.querySelectorAll<HTMLElement>('.target-label .flight-label')].sort((a,b)=>Number(a.parentElement!.dataset.plotX)-Number(b.parentElement!.dataset.plotX));
    for(const [parity,side] of [[0,'top'],[1,'bottom']] as const) {
      let used=0,row:Callout[]=[];
      for(const label of labels.filter((_,i)=>i%2===parity)) {
        const rect=label.querySelector('.katex-html')!.getBoundingClientRect();
        if(!row.length||used+rect.width>available){row=[];rows.push({entries:row,side});used=0;}
        row.push({label,width:rect.width,height:rect.height});used+=rect.width+18;
      }
    }
    const space=(side:'top'|'bottom')=>rows.filter(row=>row.side===side).reduce((sum,row)=>sum+Math.max(...row.entries.map(entry=>entry.height))+14,12);
    root.style.setProperty('--callout-top',`${space('top')}px`);
    root.style.setProperty('--callout-bottom',`${space('bottom')}px`);
    const shortLandscape=innerHeight<=560&&innerWidth>innerHeight;
    const plotHeight=shortLandscape?190:Math.max(190,Math.min(320,root.clientWidth*414/760));
    root.style.setProperty('--flight-height',`${space('top')+space('bottom')+plotHeight}px`);
    // The positioned diagram cannot contribute an intrinsic SVG height to the
    // flex layout. Give its plot the actual remaining height explicitly:
    // Safari can resolve a 100% SVG against the wrong indefinite flex height.
    root.style.setProperty('--flight-plot-height',`${Math.max(0,root.clientHeight-space('top')-space('bottom'))}px`);
  }
  // Settle HTML and SVG boxes after changing the callout rows, before taking
  // the projection. WebKit can otherwise return the preceding flex frame.
  const box=overlay.getBoundingClientRect();svg.getBoundingClientRect();
  const matrix=svg.getScreenCTM();if(!matrix)return;
  const scale=matrix.a;
  // Text stays at 12 CSS pixels as the diagram fits, so browser zoom can enlarge
  // the notation normally. Only label boxes change; the coordinate map does not.
  for(const label of overlay.querySelectorAll<HTMLElement>('[data-axis-x]')) {
    const width=Number(label.dataset.axisWidth);
    const x=Math.max(16/scale,Math.min(760-16/scale,Number(label.dataset.axisX)));
    const y=Math.max(14/scale,Math.min(414-16/scale,Number(label.dataset.axisY)+Number(label.dataset.axisOffsetY)/scale));
    label.style.left=`${matrix.e+x*scale-box.left}px`;
    label.style.top=`${matrix.f+y*matrix.d-box.top-12}px`;
    label.style.width=`${width}px`;
  }
  if(callouts) {
    // Whole coordinates occupy reserved rows outside the curve. These leaders
    // are laid out only on render/resize, never during validation or playback.
    // Read every placed formula before moving any of them. Interleaving these
    // reads with each label's writes forces one layout per dense target.
    const formulaBounds=new Map(rows.flatMap(row=>row.entries.map(({label})=>
      [label,label.querySelector('.katex-html')!.getBoundingClientRect()] as const)));
    const leaders:string[]=[],offset={top:8,bottom:box.height-parseFloat(root.style.getPropertyValue('--callout-bottom'))+8};
    for(const {entries,side} of rows) {
      const height=Math.max(...entries.map(entry=>entry.height));
      // Keep the labels in target order and as close to their own x as possible.
      // Alternating above/below avoids leaders running through another label row.
      let right=12;
      const placed=entries.map(entry=>{
        const target=matrix.e+Number(entry.label.parentElement!.dataset.plotX)*scale-box.left;
        const x=Math.max(target,right+entry.width/2);right=x+entry.width/2+18;
        return {entry,x};
      });
      let edge=box.width-12;
      for(const point of [...placed].reverse()){point.x=Math.min(point.x,edge-point.entry.width/2);edge=point.x-point.entry.width/2-18;}
      for(const {entry,x} of placed) {
        const parent=entry.label.parentElement!,rect=formulaBounds.get(entry.label)!;
        const y=offset[side]+height/2;
        entry.label.style.left=`${parseFloat(entry.label.style.left)+box.left+x-(rect.left+rect.width/2)}px`;
        entry.label.style.top=`${parseFloat(entry.label.style.top)+box.top+y-(rect.top+rect.height/2)}px`;
        const tx=matrix.e+Number(parent.dataset.plotX)*scale-box.left,ty=matrix.f+Number(parent.dataset.plotY)*matrix.d-box.top;
        const endY=y+(side==='top'?1:-1)*(entry.height/2+3),distance=Math.hypot(x-tx,endY-ty),radius=Number(parent.dataset.radius)*scale+3;
        leaders.push(`M${tx+(x-tx)*radius/(distance||1)} ${ty+(endY-ty)*radius/(distance||1)}L${x} ${endY}`);
      }
      offset[side]+=height+14;
    }
    root.querySelector('#callout-leaders')?.setAttribute('d',leaders.join(' '));
  } else if(svg.dataset.relation) {
    // Dense paired targets need outside labels. This only runs when a scene is
    // laid out or resized, never while validating or advancing the flight.
    const entries=[...overlay.querySelectorAll<HTMLElement>('.target-label')].map(parent=>{
      const label=parent.querySelector<HTMLElement>('.flight-label')!,rect=label.querySelector('.katex-html')!.getBoundingClientRect();
      return {label,rect,x:matrix.e+Number(parent.dataset.plotX)*scale,y:matrix.f+Number(parent.dataset.plotY)*matrix.d,h:Number(parent.dataset.height),radius:Number(parent.dataset.radius)*scale};
    });
    const positive=entries.filter(e=>e.h>0),negative=entries.filter(e=>e.h<0),zeros=entries.filter(e=>e.h===0),leaders:string[]=[];
    const height=(group:typeof entries)=>Math.max(18,...group.map(e=>e.rect.height));
    const bottom=Math.max(box.top+box.height/2,...entries.map(e=>e.y));
    const positiveY=Math.max(box.top+height(positive)/2+8,Math.min(...entries.map(e=>e.y))-height(positive)/2-25);
    const negativeY=Math.min(box.bottom-height(negative)/2-height(zeros)-(zeros.length?24:8),bottom+height(negative)/2+25);
    const zeroY=Math.min(box.bottom-height(zeros)/2-8,(negative.length?negativeY+height(negative)/2:bottom+14)+height(zeros)/2+12);
    for(const [group,y] of [[positive,positiveY],[negative,negativeY],[zeros,zeroY]] as const) {
      const sorted=[...group].sort((a,b)=>a.x-b.x);let right=box.left+8;
      const placed=sorted.map(entry=>{const x=Math.max(entry.x,right+entry.rect.width/2);right=x+entry.rect.width/2+8;return {entry,x};});
      const shift=Math.max(0,right-8-(box.right-8));
      for(const {entry,x:rawX} of placed){
        const x=rawX-shift,dx=x-(entry.rect.left+entry.rect.width/2),dy=y-(entry.rect.top+entry.rect.height/2);
        entry.label.style.left=`${parseFloat(entry.label.style.left)+dx}px`;entry.label.style.top=`${parseFloat(entry.label.style.top)+dy}px`;
        const endY=y+Math.sign(entry.y-y)*(entry.rect.height/2+3),distance=Math.hypot(x-entry.x,endY-entry.y),offset=Math.min(entry.radius+3,distance);
        const startX=entry.x+(x-entry.x)*offset/(distance||1),startY=entry.y+(endY-entry.y)*offset/(distance||1);
        if(distance>entry.radius+9)leaders.push(`M${(startX-matrix.e)/scale} ${(startY-matrix.f)/matrix.d}L${(x-matrix.e)/scale} ${(endY-matrix.f)/matrix.d}`);
      }
    }
    root.querySelector('#target-leaders')?.setAttribute('d',leaders.join(' '));
  }
  else if(root.querySelector('.crop-window')) {
    // A crop can place several exact landmarks close together. Alternate their
    // callouts only when needed, preserving readable math at compact scales.
    const entries=[...overlay.querySelectorAll<HTMLElement>('.target-label')].map(parent=>{
      const label=parent.querySelector<HTMLElement>('.flight-label')!,rect=label.querySelector('.katex-html')!.getBoundingClientRect();
      return {label,rect,x:matrix.e+Number(parent.dataset.plotX)*scale,y:matrix.f+Number(parent.dataset.plotY)*matrix.d,radius:Number(parent.dataset.radius)*scale};
    });
    const overlaps=entries.some((a,i)=>entries.slice(i+1).some(b=>a.rect.left<b.rect.right+4&&a.rect.right+4>b.rect.left&&a.rect.top<b.rect.bottom+4&&a.rect.bottom+4>b.rect.top));
    if(overlaps) {
      const leaders:string[]=[];
      [...entries].sort((a,b)=>a.x-b.x).forEach((entry,i)=>{
        const y=entry.y+(i%2?-1:1)*(entry.radius+entry.rect.height/2+9);
        const dy=y-(entry.rect.top+entry.rect.height/2);
        entry.label.style.top=`${parseFloat(entry.label.style.top)+dy}px`;
        const direction=Math.sign(y-entry.y),startY=entry.y+direction*(entry.radius+3),endY=y-direction*(entry.rect.height/2+2);
        leaders.push(`M${(entry.x-matrix.e)/scale} ${(startY-matrix.f)/matrix.d}V${(endY-matrix.f)/matrix.d}`);
      });
      root.querySelector('#target-leaders')?.setAttribute('d',leaders.join(' '));
    }
  }
  // Keep the zero numeral left of the first target's full formula. Its text
  // keeps a CSS-pixel size even when the coordinate diagram becomes smaller.
  const zero=overlay.querySelector<HTMLElement>('.zero-label')?.closest<HTMLElement>('.flight-label');
  const firstTarget=overlay.querySelector('.target-label .katex-html');
  if(zero&&firstTarget&&!svg.dataset.relation&&!callouts) {
    const numeral=zero.querySelector('.katex-html')!.getBoundingClientRect();
    const target=firstTarget.getBoundingClientRect();
    const shift=Math.min(0,target.left-numeral.right-8);
    if(numeral.width&&target.width)zero.style.left=`${parseFloat(zero.style.left)+shift}px`;
  }
}
/** KaTeX labels stay in HTML; WebKit can detach glyphs inside foreignObject. */
export function sizeFlowAnnotations(root:HTMLElement) {
  for(const label of root.querySelectorAll<HTMLElement>('[data-flow-zero]')) {
    const frame=label.parentElement!,svg=frame.querySelector('svg')!,matrix=svg.getScreenCTM();
    if(!matrix)continue;
    const box=frame.getBoundingClientRect();
    label.style.left=`${matrix.e+12*matrix.a-box.left}px`;
    label.style.top=`${matrix.f+Number(label.dataset.flowZero)*matrix.d-box.top}px`;
  }
}
export const interpolate=(points:[number,number][],p:number,loop=false):[number,number]=>{
  if(!points.length)return [0,0];
  if(loop) {
    const index=Math.max(0,Math.min(points.length-1,p*(points.length-1))),a=Math.floor(index),b=Math.min(a+1,points.length-1),t=index-a;
    return [points[a][0]+(points[b][0]-points[a][0])*t,points[a][1]+(points[b][1]-points[a][1])*t];
  }
  const start=points[0][0],end=points.at(-1)![0],x=start+(end-start)*p,index=points.findIndex(v=>v[0]>=x);
  if(index<=0)return points[index===-1?points.length-1:0];
  const a=points[index-1],b=points[index],t=(x-a[0])/(b[0]-a[0]);return [x,a[1]+(b[1]-a[1])*t];
};
export function transform(state:State,camera:Camera,point:[number,number]) {
  if(state.circle||isRelationSource(state.sourceId)) {
    const minX=camera.minX??-1,maxX=camera.maxX??5,relation=isRelationSource(state.sourceId),scale=Math.min((relation?460:322)/(maxX-minX),(relation?310:272)/(camera.max-camera.min));
    return [380+(point[0]-(minX+maxX)/2)*scale,200-(point[1]-(camera.min+camera.max)/2)*scale];
  }
  const {width,top,bottom}=plotArea(),end=state.sourceId===5?2:4;
  return [120+point[0]/end*(width-210),bottom-(point[1]-camera.min)/(camera.max-camera.min)*(bottom-top)];
}
export const path=(points:[number,number][],state:State,camera:Camera)=>points.map((v,i)=>`${i?'L':'M'}${transform(state,camera,v).map(n=>n.toFixed(2)).join(',')}`).join(' ');
/** Endpoint dots explain ownership at a jump. Continuous joins need no dots. */
function pathEnds(paths:CurvePath[]|undefined,project:(p:Point)=>number[]) {
  if(!paths||paths.length<2)return '';
  const same=(a:Point|undefined,b:Point)=>!!a&&Math.abs(a[0]-b[0])<1e-8&&Math.abs(a[1]-b[1])<1e-8;
  return paths.flatMap((p,i)=>{
    if(p.approximateEnds)return [];
    const ends:[Point,boolean,boolean][]=[[p.points[0],p.startClosed,i>0&&!same(paths[i-1]?.points.at(-1),p.points[0])],[p.points.at(-1)!,p.endClosed,i<paths.length-1&&!same(paths[i+1]?.points[0],p.points.at(-1)!)]];
    return ends.filter(([, ,show])=>show).map(([point,closed])=>{const [x,y]=project(point);return `<circle class="path-end ${closed?'closed':'open'}" cx="${x}" cy="${y}" r="2.6"/>`;});
  }).join('');
}
export const targetStatus=(checkpoint:Checkpoint,state:State,flight:Flight)=>state.mode!=='remix'&&(flight.phase==='flying'||flight.phase==='landed')&&(checkpoint.phase??fraction(checkpoint.x)/(state.sourceId===5?2:4))<=flight.position+1e-8?(checkpoint.hit?'hit':'miss'):'waiting';
export const targetDescription=(checkpoint:Checkpoint,index:number,status:string)=>`Target ${index+1}: ${status==='waiting'?(checkpoint.hit?'path matches, ready to throw':'path misses'):(checkpoint.hit?'hit confirmed':'miss confirmed')}`;
export const targetMark=(status:string)=>status==='hit'?icon('check',13):status==='miss'?icon('close',13):'';
export function flightView(state:State,result:Result,camera:Camera,flight:Flight) {
  const {width,height,top,bottom}=plotArea();
  const circular=!!state.circle||!!result.relation;
  const callouts=!circular&&state.mode!=='remix'&&result.checkpoints.length>=6;
  const coordinates=result.checkpoints.map(c=>transform(state,camera,[fraction(c.x),targetHeight(c)]));
  const radii=coordinates.map(([x,y],i)=>result.relation||callouts?Math.min(20,...coordinates.flatMap(([a,b],j)=>j===i?[]:[Math.hypot(x-a,y-b)*.39])):20);
  const rings=(state.mode==='remix'?[]:result.checkpoints).map((c,i)=>{
    const [x,y]=transform(state,camera,[fraction(c.x),targetHeight(c)]),status=targetStatus(c,state,flight);
    const radius=radii[i];
    return `<g class="ring ${status}" data-ring="${i}" data-target="${i}" data-match="${c.hit?'hit':'miss'}" data-status="${status}" aria-label="${targetDescription(c,i,status)}"><circle class="ring-burst" cx="${x}" cy="${y}" r="${radius*1.1}"/><circle class="ring-outer" cx="${x}" cy="${y}" r="${radius}"/><circle class="ring-inner" cx="${x}" cy="${y}" r="${radius*.65}"/><g class="target-badge" transform="translate(${x} ${y}) scale(${radius/20})"><circle r="12"/><path class="hit-mark" d="m-7 0 5 5 9-10"/><path class="miss-mark" d="m-5-5 10 10m0-10-10 10"/></g></g>`;
  }).join('');
  const targetLabels=(state.mode==='remix'?[]:result.checkpoints).map((c,i)=>{
    const [x,y]=transform(state,camera,[fraction(c.x),targetHeight(c)]);
    // Put labels toward the open middle of the plot, clear of the launcher and
    // axis ticks. Their gap includes CSS pixels because the text does not shrink.
    const direction=circular?(y<200?-1:1):y<(top+bottom)/2?1:-1;
    return `<span class="target-label" data-match="${c.hit?'hit':'miss'}" data-plot-x="${x}" data-plot-y="${y}" data-height="${targetHeight(c)}" data-radius="${radii[i]}">${flightMath(circular||callouts?`(${rationalTex(c.x)},${targetLatex(c)})`:`h = ${targetLatex(c)}`,x,y+20*direction,circular||callouts?96:70,'target-height',16*direction)}</span>`;
  }).join('');
  const ticks=circular?Array.from({length:Math.min(25,Math.ceil(camera.maxX!)-Math.floor(camera.minX!)+1)},(_,i)=>{
    const [x]=transform(state,camera,[Math.floor(camera.minX!)+i,0]);
    return `<path class="flight-grid" d="M${x} 40V356" stroke="#dce6d0" stroke-dasharray="2 8"/>`;
  }).join(''):Array.from({length:(state.sourceId===5?2:4)+1},(_,i)=>{
    const [x]=transform(state,camera,[i,0]);
    return `<path class="flight-grid" d="M${x} ${top}V${bottom}" stroke="#dce6d0" stroke-dasharray="2 8"/>`;
  }).join('');
  const [zeroX,zeroY]=transform(state,camera,[0,0]);
  const annotations=circular?`${flightMath('0',zeroX-13,zeroY,24,'zero-label',15)}${flightMath('h',zeroX,25,28)}${flightMath('x',575,zeroY,26,'',15)}`:`${Array.from({length:(state.sourceId===5?2:4)+1},(_,i)=>flightMath(String(i),transform(state,camera,[i,0])[0],height-25)).join('')}${flightMath('0',64,zeroY,24,'zero-label',callouts?16:0)}${flightMath('h',zeroX,Math.max(16,top-12),28)}${flightMath('x',width-20,height-25,26)}`;
  // A joined open relation can launch from its right-hand end. Reserve room on
  // both sides for the pulled-back rig without changing its mathematical frame.
  return `<div class="flight-diagram"><svg id="flight-svg" ${result.relation?'data-relation="true"':callouts?'data-callouts="true"':''} viewBox="${result.relation?'92 0 576 414':circular?'132 0 496 414':`0 0 ${width} ${height}`}" role="img" aria-label="${result.circle?'A complete circle, travelled counterclockwise from the rightmost point. ':result.relation?'Both real heights of the equation. ':''}${state.mode==='remix'?'Your cucumber’s flight path.':`Your cucumber's flight path through ${result.checkpoints.length} targets.`}">
    <defs><clipPath id="plot-clip"><rect x="16" y="0" width="${width-32}" height="${height-38}" rx="12"/></clipPath><clipPath id="crop-preview-clip"><rect x="0" y="0" width="760" height="414"/></clipPath></defs>
    <g clip-path="url(#plot-clip)">${ticks}
      <path class="flight-height-axis" d="M${zeroX} ${circular?40:top}V${circular?356:bottom}"/>
      <path class="flight-zero-line" data-zero-line d="M${circular?185:84} ${zeroY}H${circular?575:width-46}"/>
      ${cropWindow(result.crop,x=>transform(state,camera,[x,0])[0],{left:84,right:width-46,top:52,bottom:335},'flight-crop',result.relation?'':(result.stages.at(-1)!.paths??[{points:result.stages.at(-1)!.points}]).map(p=>path(p.points,state,camera)).join(' '))}
      <path id="target-leaders" class="target-leaders" d=""/><path id="trajectory" clip-path="url(#crop-preview-clip)" d="${drawnPaths(result).map(p=>path(p.points,state,camera)).join(' ')}"/>
      <g class="flight-path-ends">${pathEnds(result.relation?.paths??result.paths,p=>transform(state,camera,p))}</g>
      <path id="flight-trail" d=""/>
      ${flightStrokes(result).map((_,i)=>flightRig(i)).join('')}
      ${rings}
    </g></svg><div class="flight-annotations">${callouts?'<svg class="flight-callout-leaders" aria-hidden="true"><path id="callout-leaders" class="target-leaders"/></svg>':''}<div id="target-labels">${targetLabels}</div><div id="axis-labels">${annotations}</div></div>${cropVerdict(result)}</div>`;
}
/** One rig per non-retracing implicit trail; stepped height graphs retain one. */
function flightRig(index:number) {
  const id=(name:string)=>index?`${name}-${index}`:name;
  return `<g data-flight-stroke="${index}">
    <g id="${id('launcher')}" aria-hidden="true"><ellipse cx="0" cy="28" rx="18" ry="3" fill="#dce5ce"/><path d="m-2 25 1-15-10-18m10 18 13-18" fill="none" stroke="#8c7955" stroke-width="7" stroke-linecap="round"/><path d="m-3 24 1-14-9-17m10 17 11-17" fill="none" stroke="#b4a078" stroke-width="2" stroke-linecap="round"/><path id="${id('band-back')}" class="slingshot-band"/><path id="${id('band-front')}" class="slingshot-band"/></g>
    <g id="${id('cucumber')}" aria-hidden="true"><g id="${id('flight-motion')}"><path class="speed-lines" d="M-32-8h-14m13 8h-21m22 8h-13"/></g><g id="${id('flight-spin')}"><image href="./cucumber.svg" x="${cucumberFlightGeometry.imageX}" y="${cucumberFlightGeometry.imageY}" width="${cucumberFlightGeometry.imageSize}" height="${cucumberFlightGeometry.imageSize}"/></g></g>
    <g id="${id('launcher-front')}" aria-hidden="true"><path id="${id('slingshot-pouch')}" class="slingshot-pouch" d="M3-8Q-5 0 3 8"/></g>
  </g>`;
}
// These are reading aids for exact kernel values, never inputs to validation.
const decimalMatches=(exact:string,decimal:string)=>{
  const [numerator,denominator]=exact.split('/').map(BigInt);
  const [mantissa,exponent='0']=decimal.split('e');
  const places=(mantissa.split('.')[1]?.length||0)-Number(exponent);
  const digits=BigInt(mantissa.replace('.',''));
  return places>=0?numerator*10n**BigInt(places)===digits*denominator:numerator===digits*10n**BigInt(-places)*denominator;
};
export const comparisonValue=(exact:string,latex?:string,number?:number)=>{
  if(!/^-?\d+(?:\/\d+)?$/.test(exact)){const decimal=Number.isFinite(number)?`<span class="decimal-value">${tex('\\approx '+decimalTex(Number(number!.toPrecision(4))))}</span>`:'';return `<span class="comparison-value"><span class="exact-value">${tex(latex??'\\text{unavailable}')}</span>${decimal}</span>`;}
  const value=fraction(exact);
  const rounded=exact.includes('/')&&Number.isFinite(value)&&value!==0?String(Number(value.toPrecision(4))):undefined;
  const decimal=rounded===undefined?undefined:decimalTex(rounded);
  const relation=rounded&&decimalMatches(exact,rounded)?'=':'\\approx';
  return `<span class="comparison-value"><span class="exact-value">${tex(rationalTex(exact))}</span>${decimal?`<span class="decimal-value">${tex(`${relation} ${decimal}`)}</span>`:''}</span>`;
};
export function solvedHeights(relation:Result['relation']) {
  const groups:{condition:string;heights:string[]}[]=[];
  for(const line of relation?.solvedLines??[]) {
    const group=groups.find(group=>group.condition===line.conditionLatex);
    if(group)group.heights.push(line.heightLatex);else groups.push({condition:line.conditionLatex,heights:[line.heightLatex]});
  }
  return groups.map(group=>`<div class="solution-group"><div class="solution-heights">${group.heights.map(height=>`<div>${tex(height)}</div>`).join('')}</div><div class="solution-condition">${tex(group.condition)}</div></div>`).join('');
}
/** Both forms come from the kernel; this only arranges their presentation. */
export function equationForms(result:Result) {
  const simplified=result.circle?.equationLatex??result.relation?.solvedLatex??result.equationLatex??result.relation?.equationLatex??`h = ${result.stages.at(-1)!.latex}`;
  const constructed=result.constructedLatex;
  const normalized=(latex:string)=>latex.replace(/\\(?:left|right)|\s/g,'');
  const differs=normalized(constructed)!==normalized(simplified),solution=solvedHeights(result.relation);
  return `<span class="scene-tag">${differs?'YOUR CONSTRUCTION':'YOUR EQUATION'}</span><div class="constructed-formula equation-formula" aria-label="Constructed equation">${tex(constructed)}</div>${differs?`<div class="equation-reduction">${icon('arrow',16)}<span>${result.relation?.solvedLatex?'Solved for '+tex('h'):'Simplified'}</span></div>`:''}<div class="final-formula equation-formula${solution?' relation-solution':''}" aria-label="${result.relation?.solvedLatex?'Solutions for height':'Simplified equation'}"${differs?'':' hidden'}>${differs?solution||tex(simplified):''}</div>`;
}
// Keep the target positions fixed so reflection can reverse the signed gap.
// These are heights in an equation, not a separately introduced function h(x).
export const heightAtFormula=(x:string)=>`\\left.h\\right|_{x=${rationalTex(x)}}`;
export const heightGapFormula=(guide:NonNullable<Result['heightGuide']>)=>`${heightAtFormula(guide.toX)}-${heightAtFormula(guide.fromX)}`;
export function functionView(state:State,result:Result,flight:Flight) {
  const puzzle=state.mode!=='remix';
  const guide=result.heightGuide;
  const gap=guide?`<tfoot><tr class="gap-comparison" data-gap-match="${guide.hit}"><th scope="row"><span>Height gap</span><small title="Heights at the highest and lowest targets' positions" aria-label="Height at x=${guide.toX} minus height at x=${guide.fromX}, the positions of the highest and lowest targets">${tex(heightGapFormula(guide))}</small></th><td>${comparisonValue(guide.target,guide.targetLatex,guide.targetNumber)}</td><td>${comparisonValue(guide.actual,guide.actualLatex,guide.stages.at(-1)?.gapNumber)}</td><td><span class="gap-verdict" aria-label="${guide.hit?'Height gap matches':'Height gap does not match'}">${targetMark(guide.hit?'hit':'miss')}</span></td></tr></tfoot>`:'';
  const rows=result.checkpoints.map((c,i)=>{const status=c.hit?'hit':'miss',confirmed=targetStatus(c,state,flight);return `<tr data-status="${puzzle?status:'sample'}"><td>${result.relation?tex(`(${rationalTex(c.x)},${targetLatex(c)})`):comparisonValue(c.x)}</td>${puzzle?`<td>${result.relation?comparisonValue(c.lhs!):comparisonValue(c.target,c.targetLatex,c.targetNumber)}</td>`:''}<td>${comparisonValue(c.actual,c.actualLatex,c.actualNumber)}</td>${puzzle?`<td class="verdict-cell"><span class="equation-verdict" data-target="${i}" data-status="${confirmed}" aria-label="${targetDescription(c,i,confirmed)}">${targetMark(status)}</span></td>`:''}</tr>`;}).join('');
  return `<div class="equation-layout"><section class="final-equation" aria-label="Final equation">${equationForms(result)}${cropVerdict(result)}</section><div class="value-table"><table aria-label="${puzzle?'Compare your equation with the targets':'Sample heights'}"><thead><tr><th>${result.relation?'Target '+tex('(x,h)'):'Position '+tex('x')}</th>${puzzle?'<th>Expected '+(result.relation?tex('h^2'):'')+'</th>':''}<th>${result.relation?'Recipe '+tex('h^2'):puzzle?'Actual':'Height'}</th>${puzzle?`<th><span class="sr-only">Matches target</span>${icon('target',16)}</th>`:''}</tr></thead><tbody>${rows}</tbody>${gap}</table></div></div>`;
}

const flowScales=new WeakMap<Result,{min:number;max:number;start:number;end:number}>();
function flowScale(result:Result) {
  let scale=flowScales.get(result);
  if(!scale) {
    const heights=[...result.stages.flatMap(stage=>stage.points.map(point=>point[1])),...result.checkpoints.map(c=>targetHeight(c)),...(result.relation?.playback.map(p=>p[1])??[])];
    const min=Math.min(0,...heights),max=Math.max(0,...heights),padding=Math.max(2,max-min)*.12;
    const points=probePoints(result);
    scale={min:min-padding,max:max+padding,start:points[0][0],end:points.at(-1)![0]};
    flowScales.set(result,scale);
  }
  return scale;
}
function flowPoint(result:Result,[x,y]:[number,number]) {
  const s=flowScale(result);
  return [26+(x-s.start)/(s.end-s.start)*138,108-(y-s.min)/(s.max-s.min)*88];
}
const flowPath=(result:Result,points:[number,number][])=>points.map((p,i)=>`${i?'L':'M'}${flowPoint(result,p).map(n=>n.toFixed(2)).join(',')}`).join(' ');
const stagePath=(result:Result,stage:Result['stages'][number])=>(stage.paths??[{points:stage.points}]).map(p=>flowPath(result,p.points)).join(' ');
export const cropFlowPath=(result:Result)=>drawnPaths(result).map(p=>flowPath(result,p.points)).join(' ');
function cropCard(result:Result,targets:string) {
  const crop=result.crop!,zero=flowPoint(result,[0,0])[1];
  return `<span class="flow-connector" aria-hidden="true">${icon('arrow',18)}</span><article class="flow-machine crop-machine"><div class="machine-body"><div class="machine-meta"><span class="machine-kicker">CROP · FINISH</span><span class="machine-icon">${icon('crop',20)}<span data-crop-interval data-from="${crop.from}" data-to="${crop.to}">${tex(`${rationalTex(crop.from)}\\le x\\le ${rationalTex(crop.to)}`)}</span></span><span class="machine-sample" data-crop-reading></span><span class="relation-caption">Kept heights stay the same.</span></div><div class="flow-plot-frame"><svg class="flow-plot" viewBox="0 0 184 132" role="img" aria-label="Only the kept interval"><defs><clipPath id="flow-crop-kept"><rect x="${flowPoint(result,[crop.fromNumber,0])[0]}" y="0" width="${flowPoint(result,[crop.toNumber,0])[0]-flowPoint(result,[crop.fromNumber,0])[0]}" height="132"/></clipPath></defs>${cropWindow(crop,x=>flowPoint(result,[x,0])[0],{left:22,right:170,top:18,bottom:109},'flow-crop',result.relation?'':stagePath(result,result.stages.at(-1)!))}<path class="flow-zero-line" d="M26 ${zero}H164"/><path class="flow-curve" clip-path="url(#flow-crop-kept)" d="${cropFlowPath(result)}"/>${targets}<circle class="flow-point" data-crop-probe r="4"/></svg><span class="flow-zero" data-flow-zero="${zero}" aria-hidden="true">${tex('0')}</span></div></div></article>`;
}
export function updateFlowCrop(root:HTMLElement,result:Result,crop:NonNullable<Result['crop']>,instant=false) {
  updateCropWindow(root,crop,x=>flowPoint(result,[x,0])[0]);
  const left=flowPoint(result,[fraction(crop.from),0])[0],right=flowPoint(result,[fraction(crop.to),0])[0];
  const clip=root.querySelector('#flow-crop-kept rect');clip?.setAttribute('x',String(left));clip?.setAttribute('width',String(right-left));
  if(instant&&!result.relation)root.querySelector('.crop-machine .flow-curve')?.setAttribute('d',stagePath(result,result.stages.at(-1)!));
  const interval=root.querySelector<HTMLElement>('[data-crop-interval]');
  if(interval&&(interval.dataset.from!==crop.from||interval.dataset.to!==crop.to)) {
    interval.innerHTML=tex(`${rationalTex(crop.from)}\\le x\\le ${rationalTex(crop.to)}`);
    interval.dataset.from=crop.from;interval.dataset.to=crop.to;
  }
}
function relationCard(result:Result,targets:string) {
  const relation=result.relation!,zero=flowPoint(result,[0,0])[1];
  return `<span class="flow-connector" aria-hidden="true">${icon('arrow',18)}</span><article class="flow-machine relation-machine"><div class="machine-body"><div class="machine-meta"><span class="machine-kicker">BOTH HEIGHTS</span><span class="machine-icon">${tex('h^2 \\longrightarrow h')}</span><span class="machine-sample" data-relation-values></span><span class="relation-caption">Solve for both real heights.</span></div><div class="flow-plot-frame"><svg class="flow-plot" viewBox="0 0 184 132" role="img" aria-label="Both real heights of the recipe equation"><path class="flow-zero-line" d="M26 ${zero}H164"/><path class="flow-curve" d="${relation.paths.map(p=>flowPath(result,p.points)).join(' ')}"/>${targets}<circle class="flow-point" data-relation-probe r="4"/><circle class="flow-point" data-relation-probe r="4"/></svg><span class="flow-zero" data-flow-zero="${zero}" aria-hidden="true">${tex('0')}</span></div></div></article>`;
}
const sampleTex=(value:number)=>{
  if(Math.abs(value)>=10000)return decimalTex(value.toExponential(2));
  return (Math.abs(value)<.005?0:value).toFixed(2);
};
const positionText=(value:number)=>String(Number(value.toFixed(3)));
export function flow(state:State,result:Result,selectedStage:string,probeIndex:number,flight:Flight) {
  const scale=flowScale(result),points=probePoints(result),x=points[Math.max(0,Math.min(points.length-1,probeIndex))][0];
  const guide=result.heightGuide;
  const symbol=result.relation?'h^2':'h';
  const gapGoal=guide?`<span class="flow-gap-goal" aria-label="Target height gap from x=${guide.fromX} to x=${guide.toX}">Target ${tex(`${heightGapFormula(guide)}=${guide.targetLatex??rationalTex(guide.target)}`)}</span>`:'';
  const zero=flowPoint(result,[0,0])[1];
  const goals=state.mode==='remix'?[]:result.checkpoints;
  const targets=goals.map((c,i)=>{
    const [x,y]=flowPoint(result,[fraction(c.x),targetHeight(c)]),status=targetStatus(c,state,flight);
    return `<circle class="flow-target" data-target="${i}" data-match="${c.hit?'hit':'miss'}" data-status="${status}" cx="${x}" cy="${y}" r="6"/>`;
  }).join('');
  const goalList=goals.map((c,i)=>{const status=targetStatus(c,state,flight);return `<span class="flow-goal" data-target="${i}" data-match="${c.hit?'hit':'miss'}" data-status="${status}" role="img" aria-label="${targetDescription(c,i,status)}">${tex(`(${rationalTex(c.x)},\\,${targetLatex(c)})`)}<span class="target-result" aria-hidden="true">${targetMark(c.hit?'hit':'miss')}</span></span>`;}).join('');
  const cards=result.stages.map((stage,i)=>{
    const op=i?state.nodes[i-1].op:undefined,previous=i&&op!=='D'&&op!=='I'?result.stages[i-1]:undefined;
    const tangent=state.nodes[i]?.op==='D',area=state.nodes[i]?.op==='I';
    const areaPath=area?(stage.paths??[{points:stage.points}]).map(p=>flowPath(result,[...p.points,[p.points.at(-1)![0],0],[p.points[0][0],0]])+'Z').join(' '):'';
    const gap=guide?.stages[i];
    const gapLabel=gap?`<span class="gap-sample"><span class="gap-swatch" aria-hidden="true"></span>Gap ${tex(`= ${/^-?\d+(?:\/\d+)?$/.test(gap.gap)?rationalTex(gap.gap):gap.gapLatex??rationalTex(gap.gap)}`)}</span>`:'';
    let gapPlot='';
    if(guide&&gap) {
      const [x0,y0]=flowPoint(result,[fraction(guide.fromX),gap.fromNumber??fraction(gap.from)]),[x1,y1]=flowPoint(result,[fraction(guide.toX),gap.toNumber??fraction(gap.to)]);
      const direction=Math.sign(y1-y0),size=Math.min(3,Math.abs(y1-y0)/4),middle=(y0+y1)/2;
      const arrow=size?`<path class="gap-direction" d="M${173-size} ${middle-direction*size}L173 ${middle+direction*size}L${173+size} ${middle-direction*size}Z"/>`:'';
      gapPlot=`<g class="flow-height-gap" data-flow-gap="${i}" data-gap-direction="${direction<0?'up':direction>0?'down':'flat'}" aria-label="Height gap from x=${guide.fromX} to x=${guide.toX}: ${gap.gap}"><path class="gap-guides" d="M${x0} ${y0}H173M${x1} ${y1}H173"/><path class="gap-bracket" d="M169 ${y0}H177M173 ${y0}V${y1}M169 ${y1}H177"/>${arrow}<circle data-gap-position="${guide.fromX}" cx="${x0}" cy="${y0}" r="2.5"/><circle data-gap-position="${guide.toX}" cx="${x1}" cy="${y1}" r="2.5"/></g>`;
    }
    return `${i?`<span class="flow-connector" aria-hidden="true">${icon('arrow',18)}</span>`:''}<article class="flow-machine ${op==='D'||op==='I'||op==='S'?'calculus-machine':''} ${op?OPS[op].color:'source-machine'} ${stage.id===selectedStage?'inspected':''}" aria-label="${i?'Step '+i+': '+OPS[op!].name:'Starting curve'}">${stationScene(op,i,tex,!!result.relation)}<div class="machine-body"><div class="machine-meta"><span class="machine-kicker">${i?'STEP '+i:'START'}</span><span class="machine-icon">${op?operationTex(op):tex(symbol+' = '+stage.latex)}</span><span class="machine-sample">${tex(symbol+' \\approx ')}<span data-flow-stage="${i}"></span></span>${gapLabel}${area?`<span class="area-sample">Area ${tex('\\approx')} <span data-flow-area-value="${i}"></span></span>`:''}${tangent?`<span class="tangent-sample">${tex('\\frac{\\mathrm{d}'+(result.relation?'(h^2)':'h')+'}{\\mathrm{d}x} \\approx ')}<span data-flow-slope="${i}"></span></span>`:''}</div><div class="flow-plot-frame"><svg class="flow-plot" viewBox="0 0 184 132" role="img" data-flow-plot="${i}"><defs><clipPath id="flow-clip-${i}"><rect x="22" y="15" width="148" height="100"/></clipPath>${area?`<clipPath id="flow-area-window-${i}"><rect data-flow-area-window="${i}" x="26" y="15" width="0" height="100"/></clipPath><clipPath id="flow-positive-${i}"><rect x="22" y="15" width="148" height="${Math.max(0,zero-15)}"/></clipPath><clipPath id="flow-negative-${i}"><rect x="22" y="${zero}" width="148" height="${Math.max(0,115-zero)}"/></clipPath><pattern id="area-hatch-${i}" patternUnits="userSpaceOnUse" width="5" height="5"><path d="M-1 1L1-1M0 5L5 0M4 6L6 4" stroke="#ac6755" stroke-width=".8"/></pattern>`:''}</defs><path class="flow-axis" d="M26 20V108"/><g clip-path="url(#flow-clip-${i})">${area?`<g clip-path="url(#flow-area-window-${i})" class="flow-area" data-flow-area="${i}"><path class="area-positive" clip-path="url(#flow-positive-${i})" d="${areaPath}"/><g clip-path="url(#flow-negative-${i})"><path class="area-negative" d="${areaPath}"/><path fill="url(#area-hatch-${i})" d="${areaPath}"/></g></g>`:''}<path class="flow-zero-line" data-zero-line d="M26 ${zero}H164"/>${previous?`<path class="flow-before" d="${stagePath(result,previous)}"/>`:''}<path class="flow-curve" d="${stagePath(result,stage)}"/>${pathEnds(stage.paths,p=>flowPoint(result,p))}${tangent?`<path class="flow-tangent" data-flow-tangent="${i}"/>`:''}<path class="flow-probe" data-flow-probe="${i}"/><path class="flow-change" data-flow-change="${i}"/>${previous?`<circle class="flow-before-point" data-flow-before="${i}" r="3.5"/>`:''}<circle class="flow-point" data-flow-point="${i}" r="4.5"/></g>${gapPlot}${i===result.stages.length-1&&!result.relation&&!result.crop?targets:''}</svg><span class="flow-zero" data-flow-zero="${zero}" aria-hidden="true">${tex('0')}</span></div></div></article>`;
  }).join('');
  return `<div class="flow-controls">${cropVerdict(result)}<div class="flow-control-heading"><label for="flow-position">Explore at ${tex('x = ')}<output id="flow-position-value" for="flow-position">${tex(positionText(x))}</output></label>${gapGoal}${goals.length?`<div class="flow-goals" role="group" aria-label="Target coordinates and validation">${goalList}</div>`:''}</div><div class="flow-slider-row"><span>${tex(positionText(scale.start))}</span><input id="flow-position" type="range" min="${scale.start}" max="${scale.end}" step="any" value="${x}" aria-label="Position x" aria-valuetext="x = ${positionText(x)}"><span>${tex(positionText(scale.end))}</span><span class="flow-key"><span class="before-key"></span>Before <span class="after-key"></span>After</span></div><span class="sr-only">Every graph uses the same height scale. Move position to compare each operation. A tangent shows the incoming slope before a slope block. Before an area block, shading shows accumulated area: solid above zero adds, hatched below zero subtracts. Targets appear on the final graph. During a throw, position follows the flight, then returns to your inspected position.</span></div><div class="flow-line" role="group" aria-label="Transformation chain">${cards}${result.relation?relationCard(result,result.crop?'':targets):''}${result.crop?cropCard(result,targets):''}</div>`;
}
export function updateFlowProbe(root:HTMLElement,state:State,result:Result,index:number) {
  const points=probePoints(result);
  index=Math.max(0,Math.min(points.length-1,index));
  updateStationScene(root,state,result.crop?{...result,points}:result,index,tex);
  if(result.relation){
    const values=heightsAt(result.relation.paths,points[index][0]);
    root.querySelectorAll<SVGCircleElement>('[data-relation-probe]').forEach((point,i)=>{const value=values[i];point.style.display=value?'':'none';if(value){const [x,y]=flowPoint(result,value);point.setAttribute('cx',String(x));point.setAttribute('cy',String(y));}});
    const label=root.querySelector('[data-relation-values]');if(label)label.innerHTML=tex(values.length?'h \\approx '+values.map(v=>sampleTex(v[1])).join(',\\;'):'\\nexists h\\in\\mathbb{R}');
  }
  const scale=flowScale(result),x=points[index][0],zero=flowPoint(result,[x,0])[1];
  if(result.crop) {
    const kept=x>=result.crop.fromNumber&&x<=result.crop.toNumber,point=root.querySelector<SVGCircleElement>('[data-crop-probe]');
    if(point){const [px,py]=flowPoint(result,points[index]);point.style.display=kept&&!result.relation?'':'none';point.setAttribute('cx',String(px));point.setAttribute('cy',String(py));}
    const label=root.querySelector('[data-crop-reading]');if(label)label.innerHTML=kept?`Kept: ${tex((result.relation?'h^2':'h')+'\\approx '+sampleTex(points[index][1]))}`:`${tex('x='+positionText(x))} is outside`;
    const range=root.querySelector('.crop-machine .machine-icon');if(range)range.innerHTML=`${icon('crop',20)}${tex(`${rationalTex(result.crop.from)}\\le x\\le ${rationalTex(result.crop.to)}`)}`;
  }
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
    root.querySelector(`[data-flow-plot="${i}"]`)?.setAttribute('aria-label',`At position ${positionText(x)}, ${result.relation?'squared height':'height'} is approximately ${Number(value.toPrecision(4))}.${gapDescription}`);
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
