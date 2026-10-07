import type { Point } from './types';

export interface GardenOrigin { paths:Point[][]; color:string; width:number }

/** Flight and Flow draw kernel samples as M/L polylines. Preserve their separate
 * branches and actual screen positions when the reward leaves the play view. */
export function gardenOrigin(path:SVGPathElement|null):GardenOrigin|undefined {
  const matrix=path?.getScreenCTM(),bounds=path?.getBoundingClientRect();
  if(!path||!matrix||!bounds||bounds.right<0||bounds.left>innerWidth||bounds.bottom<0||bounds.top>innerHeight)return;
  const clip=path.closest('.flow-line')?.getBoundingClientRect();
  if(clip&&(bounds.left<clip.left||bounds.right>clip.right||bounds.top<clip.top||bounds.bottom>clip.bottom))return;
  const paths=(path.getAttribute('d')??'').split('M').slice(1).map(part=>{
    const values=part.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number)??[];
    const points:Point[]=[];
    for(let i=0;i+1<values.length;i+=2) {
      const point=new DOMPoint(values[i],values[i+1]).matrixTransform(matrix);points.push([point.x,point.y]);
    }
    return points;
  }).filter(points=>points.length>1);
  if(!paths.length)return;
  const style=getComputedStyle(path),scale=style.vectorEffect==='non-scaling-stroke'?1:Math.hypot(matrix.a,matrix.b);
  return {paths,color:style.stroke,width:parseFloat(style.strokeWidth)*scale};
}

export function resampleLine(points:Point[],count=120):Point[] {
  const lengths=[0];
  for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
  let segment=1;
  return Array.from({length:count},(_,i)=>{
    const target=lengths.at(-1)!*i/(count-1);
    while(segment<points.length-1&&lengths[segment]<target)segment++;
    const a=points[segment-1],b=points[segment],t=(target-lengths[segment-1])/(lengths[segment]-lengths[segment-1]||1);
    return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  });
}

export const collectionPath=(points:Point[])=>points.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
export const ease=(amount:number)=>{const t=Math.max(0,Math.min(1,amount));return t*t*(3-2*t);};
