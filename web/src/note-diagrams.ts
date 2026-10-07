import { CHAPTERS, chapterIndex, escape, fraction, targetHeight, LEVELS, OPS, puzzleLabel, type Checkpoint, type Op, type Result, type Stage } from './types';
import { icon } from './icons';
import { heightAtFormula, operationTex, rationalTex, solvedHeights, tex } from './views';

export const chapterArt=(index:number)=>{const chapter=CHAPTERS[index];return `<svg viewBox="0 0 36 36" width="36" height="36" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><path d="M2 ${chapter.zero}H34" opacity=".2"/><path class="chapter-before" d="${chapter.before}" stroke-width="1.4" stroke-dasharray="2.5 2.5" opacity=".5"/><path class="chapter-after" d="${chapter.after}" stroke-width="1.9"/></svg>`;};
export const lesson=(sourceId:number)=>{
  const chapter=chapterIndex(sourceId);
  return `${chapter<0?'Bonus':puzzleLabel(sourceId)} · ${LEVELS[sourceId-1].name}`;
};
export const move=(op:Op)=>`<span class="note-operation ${OPS[op].color}" aria-label="${OPS[op].name}">${operationTex(op)}</span>`;
export const viewButton=(view:'function'|'flow')=>{const label=view==='function'?'Equation':'Flow';return `<button class="note-view-button" data-view="${view}" aria-label="Open ${label} view">${icon(view,16)}<span>${label}</span></button>`;};
export const recall=(sources:number[],title:string,body:string)=>`<section class="note-recall" data-recall-sources="${sources.join(',')}"><h4 class="note-recall-heading"><span class="note-lesson-numbers">${sources.map(puzzleLabel).join(', ')}</span><span>${title}</span></h4>${body}</section>`;

type NoteChoice={label:string;stage:Stage;before?:Stage};
// KaTeX stays in HTML: WebKit can misplace its descendants in foreignObject.
const notePlot=(label:string,zero:number,contents:string)=>`<div class="note-plot-frame"><svg class="note-plot" viewBox="0 0 176 116" role="img" aria-label="${escape(label)}"><path d="M17 10V103" class="note-axis"/><path d="M17 ${zero}H163" class="note-zero-line" data-zero-line/>${contents}</svg><span class="note-zero" style="top:${zero/116*100}%" aria-hidden="true">${tex('0')}</span></div>`;
const stagePoints=(stage:Stage)=>stage.paths?.flatMap(path=>path.points)??stage.points;
const stagePaths=(stage:Stage)=>stage.paths?.length?stage.paths:[{points:stage.points,startClosed:true,endClosed:true}];
const segmentedStage=(stage:Stage)=>!!stage.paths&&(stage.paths.length>1||stage.paths.some(path=>!path.startClosed||!path.endClosed));
function drawStage(stage:Stage,xy:(point:[number,number])=>number[],cls:string) {
  const segmented=segmentedStage(stage);
  return stagePaths(stage).map(segment=>{
    const d=segment.points.map((point,i)=>`${i?'L':'M'}${xy(point).map(n=>n.toFixed(2)).join(',')}`).join(' ');
    if(!d)return '';
    const ends=segmented&&!segment.approximateEnds&&segment.points.length?[[segment.points[0],segment.startClosed],[segment.points.at(-1)!,segment.endClosed]] as const:[];
    return `<path d="${d}" class="${cls}"/>${ends.map(([point,closed])=>{const [x,y]=xy(point);return `<circle cx="${x}" cy="${y}" r="2.7" class="note-step-end ${cls==='note-previous'?'previous ':''}${closed?'closed':'open'}"/>`;}).join('')}`;
  }).join('');
}
export function relationSketch(result:Result,label:string,options:{before?:Result;bounds?:number[]}={}) {
  const relation=result.relation;
  if(!relation)return '';
  const points=[...relation.paths,...(options.before?.relation?.paths??[])].flatMap(path=>path.points);
  const xs=points.map(point=>point[0]),ys=points.map(point=>point[1]);
  const [left,right,low,high]=options.bounds??[Math.min(0,...xs),Math.max(4,...xs),Math.min(0,...ys),Math.max(0,...ys)];
  const pad=Math.max(1,high-low)*.12,min=low-pad,max=high+pad;
  const xy=([x,h]:[number,number])=>[17+(x-left)/Math.max(.001,right-left)*142,99-(h-min)/Math.max(.001,max-min)*84];
  const zero=xy([left,0])[1];
  const draw=(paths:typeof relation.paths,cls:string)=>paths.map(path=>`<path d="${path.points.map((point,i)=>`${i?'L':'M'}${xy(point).map(n=>n.toFixed(2)).join(',')}`).join(' ')}" class="${cls}"/>`).join('');
  const paths=draw(options.before?.relation?.paths??[],'note-previous')+draw(relation.paths,'note-curve');
  const formulas=[relation.equationLatex,relation.solvedLatex].filter((formula):formula is string=>Boolean(formula));
  const solutions=solvedHeights(relation);
  return `<figure class="note-relation"><figcaption>${escape(label)}</figcaption>${notePlot(`${label} ${formulas.join(' ')}`,zero,paths)}<div class="note-formula">${tex(relation.equationLatex)}</div>${solutions?`<div class="note-solutions">${solutions}</div>`:relation.solvedLatex?`<div class="note-formula">${tex(relation.solvedLatex)}</div>`:''}</figure>`;
}
export function diagramChoices(title:string,choices:{label:string;html:string}[]) {
  return `<section class="note-comparison" data-note-comparison aria-label="${escape(title)}"><strong>${escape(title)}</strong><div class="note-choices" role="group" aria-label="${escape(title)}">${choices.map((choice,i)=>`<button type="button" data-note-choice="${i}" aria-pressed="${i===0}">${escape(choice.label)}</button>`).join('')}</div><div aria-live="polite" aria-atomic="true">${choices.map((choice,i)=>`<div data-note-panel="${i}" ${i?'hidden':''}>${choice.html}</div>`).join('')}</div></section>`;
}

export function circleSketch(circles:Result[],options:{centre?:boolean;spoke?:boolean;triangle?:boolean;diameter?:boolean;targets?:[number,number][];pairs?:number[][];bounds?:number[]}={}) {
  const [left,right,bottom,top]=options.bounds??[-1,5,-2,2];
  const scale=Math.min(268/(right-left),176/(top-bottom));
  const xy=([x,y]:[number,number])=>[150+(x-(left+right)/2)*scale,100-(y-(bottom+top)/2)*scale];
  const p=(point:[number,number])=>xy(point).map(value=>value.toFixed(2)).join(',');
  const line=(a:[number,number],b:[number,number],cls:string)=>`<path class="${cls}" d="M${p(a)}L${p(b)}"/>`;
  const point=(at:[number,number],cls:string,r=4)=>{const [x,y]=xy(at);return `<circle cx="${x}" cy="${y}" r="${r}" class="${cls}"/>`;};
  const targets=options.targets??[],centre=circles.at(-1)?.circle?.centre;
  const zero=xy([0,0]);
  const bisectors=(options.pairs??[]).map(([a,b],i)=>{
    const A=targets[a],B=targets[b],mid:[number,number]=[(A[0]+B[0])/2,(A[1]+B[1])/2];
    const dx=B[0]-A[0],dy=B[1]-A[1];
    // This is only the same geometric guide as Flow; circle membership and all
    // sampled curves above come from the kernel. No centre/solution is inferred.
    const extent=12/Math.hypot(dx,dy),u:[number,number]=[mid[0]-dy*extent,mid[1]+dx*extent],v:[number,number]=[mid[0]+dy*extent,mid[1]-dx*extent];
    return `<g class="note-pair" data-note-pair>${line(A,B,'note-chord')}${line(u,v,`note-bisector ${i?'second':''}`)}${point(mid,'note-midpoint',3)}</g>`;
  }).join('');
  return `<div class="circle-note-sketch note-circle-diagram"><svg viewBox="0 0 300 200" role="img" aria-label="Circle construction with equal horizontal and vertical scales"><path class="note-zero-line" d="M12 ${zero[1]}H288M${zero[0]} 12V188"/>${circles.map((result,i)=>`<path d="${result.points.map((point,j)=>`${j?'L':'M'}${p(point)}`).join(' ')}" class="${i===circles.length-1?'note-curve':'note-previous'}"/>`).join('')}${bisectors}${options.diameter?line(targets[0],targets[1],'note-chord'):''}${centre&&options.spoke?line(centre,circles.at(-1)!.points[0],'note-radius'):''}${centre&&options.triangle?`${line(centre,[targets[0][0],centre[1]],'note-leg-x')}${line([targets[0][0],centre[1]],targets[0],'note-leg-h')}${line(centre,targets[0],'note-radius')}`:''}${targets.map(target=>point(target,'note-required',4.5)).join('')}${centre&&options.centre?point(centre,'note-midpoint',4.5):''}</svg><span class="circle-note-zero" style="left:${(zero[0]-10)/3}%;top:${zero[1]/2}%" aria-hidden="true">${tex('0')}</span></div>`;
}

// Switching a reference changes only which kernel result is visible. All choices
// share one camera; neither progress nor the player's construction is involved.
export function compare(title:string,choices:NoteChoice[],readings:{index:number;x:string}[]=[],legend=['Before','After']) {
  const stages=choices.flatMap(choice=>choice.before?[choice.before,choice.stage]:[choice.stage]);
  const points=stages.flatMap(stagePoints),heights=points.map(point=>point[1]);
  const low=Math.min(0,...heights),high=Math.max(0,...heights),pad=Math.max(1,high-low)*.12;
  const min=low-pad,max=high+pad,start=Math.min(...points.map(point=>point[0])),end=Math.max(...points.map(point=>point[0]));
  const xy=([x,h]:[number,number])=>[17+(x-start)/(end-start)*142,99-(h-min)/(max-min)*84];
  const zero=xy([start,0])[1];
  return `<section class="note-comparison" data-note-comparison aria-label="${escape(title)}"><strong>${escape(title)}</strong>
    <div class="note-choices" role="group" aria-label="${escape(title)}">${choices.map((choice,i)=>`<button type="button" data-note-choice="${i}" aria-pressed="${i===0}">${escape(choice.label)}</button>`).join('')}</div>
    <div class="note-comparison-panels" aria-live="polite" aria-atomic="true">${choices.map((choice,i)=>`<figure data-note-panel="${i}" ${i?'hidden':''}>
      ${notePlot(choice.label+': '+choice.stage.expression,zero,`${choice.before?drawStage(choice.before,xy,'note-previous'):''}${drawStage(choice.stage,xy,'note-curve')}${segmentedStage(choice.stage)?'':choice.stage.points.filter((_,j)=>j===0||j===Math.floor(choice.stage.points.length/2)||j===choice.stage.points.length-1).map(point=>{const [x,y]=xy(point);return `<circle cx="${x}" cy="${y}" r="2.8" class="note-point"/>`;}).join('')}`)}
      <figcaption><div class="note-formula">${tex(choice.stage.latex)}</div>${readings.map(({index,x})=>`<div class="note-reading">${tex(`${heightAtFormula(x)}=${rationalTex(choice.stage.values[index])}`)}</div>`).join('')}</figcaption>
    </figure>`).join('')}</div>${choices.some(choice=>choice.before)?`<small class="note-comparison-key"><i></i>${legend[0]} <i></i>${legend[1]}</small>`:''}</section>`;
}

export function strip(stages:Stage[],captions:string[],links:string[],connection=false,goals:Checkpoint[]=[]) {
  const points=stages.flatMap(stagePoints),heights=[...points.map(point=>point[1]),...goals.map(goal=>targetHeight(goal))];
  const low=Math.min(0,...heights),high=Math.max(0,...heights),pad=Math.max(1,high-low)*.12;
  const min=low-pad,max=high+pad,start=Math.min(...points.map(point=>point[0])),end=Math.max(...points.map(point=>point[0]));
  const xy=([x,h]:[number,number])=>[17+(x-start)/(end-start)*142,99-(h-min)/(max-min)*84];
  const zero=xy([start,0])[1];
  return `<div class="note-strip ${connection?'note-connection':''}" data-count="${stages.length}">${stages.map((stage,i)=>`${i&&links.length?`<div class="note-link">${icon('arrow',20)}<span>${links[i-1]}</span></div>`:''}<figure class="note-stage ${connection&&i===1?'shared-shape':''}"><figcaption>${captions[i]}</figcaption>${notePlot(captions[i]+': '+stage.expression,zero,`${drawStage(stage,xy,'note-curve')}${segmentedStage(stage)?'':stage.points.filter((_,j)=>j===0||j===Math.floor(stage.points.length/2)||j===stage.points.length-1).map(point=>{const [x,y]=xy(point);return `<circle cx="${x}" cy="${y}" r="2.8" class="note-point"/>`;}).join('')}${(i===stages.length-1?goals:[]).map(goal=>{const [x,y]=xy([fraction(goal.x),targetHeight(goal)]);return `<circle cx="${x}" cy="${y}" r="3.8" class="note-required" data-note-target/>`;}).join('')}`)}<div class="note-formula">${tex(stage.latex)}</div></figure>`).join('')}</div>`;
}
