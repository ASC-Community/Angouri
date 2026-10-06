import type { CurvePath, Point, Result } from './types';

// These helpers arrange kernel samples; they never evaluate a recipe.
export const flightPoints=(result:Result)=>result.relation?.playback??result.points;
export interface FlightStroke { points:Point[]; start:number; end:number; breaks:number[] }
const strokes=new WeakMap<Result,FlightStroke[]>();
/** Separate branch trails keep one shared reward clock. Steps still progress along x. */
export function flightStrokes(result:Result):FlightStroke[] {
  const cached=strokes.get(result);if(cached)return cached;
  const points=flightPoints(result),ranges=result.relation?.flights??[[0,points.length-1]];
  const resultStrokes=ranges.map(([start,end])=>({points:points.slice(start,end+1),start:start/Math.max(1,points.length-1),end:end/Math.max(1,points.length-1),breaks:(result.relation?.breaks??[]).filter(at=>at>start&&at<=end).map(at=>at-start)})).filter(s=>s.points.length>0);
  strokes.set(result,resultStrokes);return resultStrokes;
}
export function strokePosition(stroke:FlightStroke,progress:number):Point {
  const index=Math.max(0,Math.min(stroke.points.length-1,progress*(stroke.points.length-1))),a=Math.floor(index),b=Math.min(a+1,stroke.points.length-1);
  if(stroke.breaks.includes(b))return stroke.points[a];
  const t=index-a,left=stroke.points[a],right=stroke.points[b];
  return [left[0]+(right[0]-left[0])*t,left[1]+(right[1]-left[1])*t];
}
export const nearestIndex=(points:Point[],x:number)=>points.reduce((best,p,i)=>Math.abs(p[0]-x)<Math.abs(points[best][0]-x)?i:best,0);
export function along(points:Point[],x:number):Point {
  if(!points.length)return [x,0];
  const at=points.findIndex(p=>p[0]>=x);
  if(at<=0)return points[at<0?points.length-1:0];
  const a=points[at-1],b=points[at],t=(x-a[0])/(b[0]-a[0]||1);
  return [x,a[1]+(b[1]-a[1])*t];
}
export function sampledPosition(result:Result,position:number):Point {
  const points=flightPoints(result);
  if(!points.length)return [0,0];
  if(result.relation||result.circle) {
    const index=Math.max(0,Math.min(points.length-1,position*(points.length-1))),a=Math.floor(index),b=Math.min(a+1,points.length-1);
    if(!points.length)return [0,0];
    if(result.relation?.breaks.includes(b))return points[a];
    const t=index-a;return [points[a][0]+(points[b][0]-points[a][0])*t,points[a][1]+(points[b][1]-points[a][1])*t];
  }
  const x=points[0][0]+position*(points.at(-1)![0]-points[0][0]);
  const exact=points.find(p=>Math.abs(p[0]-x)<1e-10);if(exact)return exact;
  const segment=result.paths?.find(p=>x>=p.points[0][0]&&x<=p.points.at(-1)![0]);
  return along(segment?.points??points,x);
}
export function travelledPaths(result:Result,position:number):Point[][] {
  const points=flightPoints(result),at=sampledPosition(result,position);
  if(result.relation) {
    const last=Math.floor(position*(points.length-1)),breaks=[0,...result.relation.breaks,points.length];
    return breaks.slice(0,-1).filter(start=>start<=last).map((start,i)=>{
      const end=Math.min(breaks[i+1],last+1),part=points.slice(start,end);
      if(end===last+1&&!result.relation!.breaks.includes(last+1))part.push(at);
      return part;
    });
  }
  if(result.circle)return [[...points.slice(0,Math.floor(position*(points.length-1))+1),at]];
  return (result.paths??[{points,startClosed:true,endClosed:true}]).filter(p=>p.points[0][0]<=at[0]).map(p=>{
    if(p.points.at(-1)![0]<=at[0])return p.points;
    return [...p.points.filter(v=>v[0]<at[0]),along(p.points,at[0])];
  });
}
export const drawnPaths=(result:Result):CurvePath[]=>result.relation?.paths??result.paths??[{points:result.points,startClosed:true,endClosed:true}];

/** Intersect the drawn polylines with the probe, including both sides of a loop.
 * This interpolates kernel geometry only; it never solves or validates an equation. */
export function heightsAt(paths:CurvePath[],x:number):Point[] {
  const values:Point[]=[],epsilon=1e-8;
  const add=(y:number)=>{if(!values.some(point=>Math.abs(point[1]-y)<epsilon))values.push([x,y]);};
  for(const path of paths) {
    if(path.points.length===1){const [px,y]=path.points[0];if(Math.abs(px-x)<epsilon&&path.startClosed&&path.endClosed)add(y);continue;}
    for(let i=1;i<path.points.length;i++) {
      const a=path.points[i-1],b=path.points[i],dx=b[0]-a[0];
      if(x<Math.min(a[0],b[0])-epsilon||x>Math.max(a[0],b[0])+epsilon)continue;
      if(Math.abs(dx)<epsilon){if(Math.abs(a[0]-x)<epsilon){add(a[1]);add(b[1]);}continue;}
      const t=(x-a[0])/dx;
      if(i===1&&t<=epsilon&&!path.startClosed||i===path.points.length-1&&t>=1-epsilon&&!path.endClosed)continue;
      add(a[1]+Math.max(0,Math.min(1,t))*(b[1]-a[1]));
    }
  }
  return values.sort((a,b)=>b[1]-a[1]);
}
