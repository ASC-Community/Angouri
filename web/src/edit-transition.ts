import type {Point,Result} from './types';
import {along,drawnPaths,flightStrokes,strokePosition} from './geometry';

export interface CurveMorph { from:Point[]; to:Point[]; kind:'height'|'loop' }
const same=(a:Point,b:Point)=>a[0]===b[0]&&a[1]===b[1];
function continuousHeight(result:Result):Point[]|undefined {
  if(result.circle||result.relation)return;
  const paths=drawnPaths(result);if(!paths.length)return;
  const points:Point[]=[];
  for(const [i,path] of paths.entries()) {
    if(path.points.length<2||path.points.some((p,j)=>j>0&&p[0]<=path.points[j-1][0]))return;
    // Join only endpoints the kernel already places together, with the
    // boundary included on at least one side. Rounded jumps stay separate.
    if(i&&(!same(points.at(-1)!,path.points[0])||!paths[i-1].endClosed&&!path.startClosed))return;
    points.push(...path.points.slice(i?1:0));
  }
  return points;
}
function anchoredLoop(result:Result) {
  if(!result.relation)return;
  const paths=drawnPaths(result),strokes=flightStrokes(result);
  if(!paths.length||strokes.length!==1||strokes[0].breaks.length)return;
  // A single upper/lower lobe has an unambiguous zero-height end anchor.
  // Intersections, cropped open branches and several travellers do not.
  if(!paths.every(p=>p.startClosed&&p.endClosed&&!p.approximateEnds&&p.points.length>2))return;
  const stroke=strokes[0],points=stroke.points,first=points[0];
  if(!same(first,points.at(-1)!)||first[1]!==0)return;
  const xs=points.map(p=>p[0]),anchor=first[0]===Math.min(...xs)?'left':first[0]===Math.max(...xs)?'right':undefined;
  if(!anchor)return;
  // The renderer may already have merged the two branches into one path.
  // Check its traversal: one upper run, one lower run, meeting only at tips.
  const low=Math.min(...xs),high=Math.max(...xs),signs:number[]=[];
  for(const [x,y] of points) {
    if(y===0){if(x!==low&&x!==high)return;}
    else if(Math.sign(y)!==signs.at(-1))signs.push(Math.sign(y));
  }
  if(signs.length!==2||signs[0]===signs[1])return;
  const far=points.findIndex(p=>p[0]===(anchor==='left'?high:low)),direction=anchor==='left'?1:-1;
  if(far<1||points.some((p,i)=>i>0&&(p[0]-points[i-1][0])*direction*(i<=far?1:-1)<0))return;
  const area=points.slice(1).reduce((sum,p,i)=>sum+points[i][0]*p[1]-p[0]*points[i][1],0);
  return {stroke,anchor,orientation:Math.sign(area)};
}
/** Correspondence of kernel geometry only. Intermediate samples never validate. */
export function curveMorph(before:Result,after:Result,displayed?:Point[]):CurveMorph|undefined {
  const from=continuousHeight(before),to=continuousHeight(after);
  if(from&&to&&from[0][0]===to[0][0]&&from.at(-1)![0]===to.at(-1)![0]) {
    // Retain corners from both polylines, including a partly displayed edit.
    const old=displayed??from,xs=[...new Set([...old,...to].map(([x])=>x))].sort((a,b)=>a-b);
    return {kind:'height',from:xs.map(x=>along(old,x)),to:xs.map(x=>along(to,x))};
  }
  const a=anchoredLoop(before),b=anchoredLoop(after);
  if(!a||!b||a.anchor!==b.anchor||a.orientation!==b.orientation||!a.orientation)return;
  const count=Math.min(1024,Math.max(160,a.stroke.points.length,b.stroke.points.length));
  const old=displayed?{...a.stroke,points:displayed}:a.stroke;
  return {kind:'loop',from:Array.from({length:count},(_,i)=>strokePosition(old,i/(count-1))),
    to:Array.from({length:count},(_,i)=>strokePosition(b.stroke,i/(count-1)))};
}

export function captureFlightGeometry(root:HTMLElement):SVGGElement|undefined {
  const svg=root.querySelector('svg#flight-svg');if(!svg)return;
  const group=document.createElementNS('http://www.w3.org/2000/svg','g');
  group.classList.add('curve-change-ghost');group.setAttribute('aria-hidden','true');group.style.pointerEvents='none';
  if(root.dataset.curveTransition==='crossfade')group.dataset.fromFade='true';
  for(const element of svg.querySelectorAll('#trajectory,.flight-path-ends,[data-flight-stroke],.curve-change-ghost')) {
    const copy=element.cloneNode(true) as SVGElement;
    copy.style.opacity=getComputedStyle(element).opacity;
    copy.classList.replace('curve-change-ghost','curve-change-layer');
    if(element.id==='trajectory')copy.classList.add('curve-change-trajectory');
    if(copy.classList.contains('flight-path-ends'))copy.classList.replace('flight-path-ends','curve-change-ends');
    for(const node of [copy,...copy.querySelectorAll('*')]) {node.removeAttribute('id');node.removeAttribute('data-flight-stroke');}
    group.append(copy);
  }
  return group;
}

export function fadeFlightGeometry(root:HTMLElement,previous:SVGGElement):()=>void {
  const trajectory=root.querySelector('#trajectory');if(!trajectory)return ()=>{};
  const nodes=[trajectory,...root.querySelectorAll('.flight-path-ends,[data-flight-stroke]')];
  trajectory.parentElement!.insertBefore(previous,trajectory);
  const options={duration:240,easing:'ease-out',fill:'both' as FillMode};
  const animations=[previous.animate([{opacity:1},{opacity:0}],options),...nodes.map(node=>node.animate([{opacity:0},{opacity:1}],options))];
  root.dataset.curveTransition='crossfade';
  const clear=()=>{for(const animation of animations)animation.cancel();previous.remove();delete root.dataset.curveTransition;};
  void Promise.all(animations.map(animation=>animation.finished)).then(clear,()=>{});
  return clear;
}
