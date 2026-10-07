import type { Point } from './types';

interface Outline {
  element:SVGGeometryElement;
  inverse:DOMMatrix;
  points:Point[];
  filled:boolean;
  radius:number;
}
interface Shape { element:SVGGElement; outlines:Outline[] }

function segmentDistance([x,y]:Point,a:Point,b:Point) {
  const dx=b[0]-a[0],dy=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
}

/** Presentation geometry only: choose a picture piece, never validate a puzzle. */
export class GardenHitTest {
  private shapes:Shape[]=[];
  private samples=new WeakMap<SVGGeometryElement,Point[]>();

  constructor(private paper:SVGSVGElement) {}

  private points(curve:SVGGeometryElement,scale:number):Point[] {
    const cached=this.samples.get(curve);
    if(cached)return cached;
    const d=curve.getAttribute('d')??'';
    let points:Point[]=[];
    // Kernel curves are already polylines. Sampling each one through native
    // getPointAtLength repeatedly walks its entire path and stalls the reveal.
    if(/^M[-+\d\s,.eELZ]+$/.test(d)) {
      const values=d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)!.map(Number);
      for(let i=0;i+1<values.length;i+=2)points.push([values[i],values[i+1]]);
      if(d.endsWith('Z'))points.push(points[0]);
    } else {
      const length=curve.getTotalLength(),count=Math.max(2,Math.ceil(length*scale));
      points=Array.from({length:count+1},(_,i)=>{
        const point=curve.getPointAtLength(length*i/count);return [point.x,point.y];
      });
    }
    this.samples.set(curve,points);return points;
  }

  refresh() {
    const frame=this.paper.getScreenCTM();
    if(!frame)return;
    const toPaper=frame.inverse();
    this.shapes=Array.from(this.paper.querySelectorAll<SVGGElement>('[data-garden-piece]'),element=>{
      const earned=element.classList.contains('is-earned');
      const canonical=element.dataset.gardenPiece==='77'&&earned;
      const curves=canonical
        ?Array.from(this.paper.querySelectorAll<SVGGeometryElement>('.garden-canonical-body'))
        :Array.from(element.querySelectorAll<SVGGeometryElement>('.garden-art-path'));
      // Connected, filled plant parts belong to the vine/reed even outside the
      // mathematical curve's bounds. Glow and distant reflections do not.
      if(earned)curves.push(...element.querySelectorAll<SVGGeometryElement>('.garden-vine-leaf>path:first-of-type,.garden-young-body,.garden-reed-blade,.garden-fruit-stalk,.garden-flower-pedicel,.garden-calyx'));
      const outlines:Outline[]=curves.map(curve=>{
        const matrix=toPaper.multiply(curve.getScreenCTM()!);
        const scale=Math.max(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d));
        const points=this.points(curve,scale).map(([x,y])=>{
          const mapped=new DOMPoint(x,y).matrixTransform(matrix);
          return [mapped.x,mapped.y] as Point;
        });
        const style=getComputedStyle(curve);
        const strokeScale=style.vectorEffect==='non-scaling-stroke'?1/Math.hypot(frame.a,frame.b):scale;
        return {element:curve,inverse:matrix.inverse(),points,filled:style.fill!=='none',radius:style.stroke==='none'?0:parseFloat(style.strokeWidth)*strokeScale/2};
      });
      // The fill may contain several closed subpaths (the five petals). Use
      // native fill testing; never connect separate subpaths with phantom lines.
      if(!canonical)for(const fill of element.querySelectorAll<SVGGeometryElement>('.garden-piece-fill')) {
        const matrix=toPaper.multiply(fill.getScreenCTM()!);
        outlines.push({element:fill,inverse:matrix.inverse(),points:[],filled:true,radius:0});
      }
      return {element,outlines};
    });
  }

  at(clientX:number,clientY:number) {
    const frame=this.paper.getScreenCTM();
    if(!frame)return;
    const point=new DOMPoint(clientX,clientY).matrixTransform(frame.inverse());
    // Label bands are direct controls, not extra territory for nearby artwork.
    if(point.x<0||point.x>760||point.y<0||point.y>424)return;
    const position:Point=[point.x,point.y];
    let best:SVGGElement|undefined,bestDistance=Infinity,bestEdge=Infinity;
    for(const shape of this.shapes) {
      let nearest=Infinity,edge=Infinity;
      for(const outline of shape.outlines) {
        if(outline.filled&&outline.element.isPointInFill(point.matrixTransform(outline.inverse)))nearest=0;
        for(let i=1;i<outline.points.length;i++) {
          const distance=segmentDistance(position,outline.points[i-1],outline.points[i]);
          edge=Math.min(edge,distance);
          nearest=Math.min(nearest,Math.max(0,distance-outline.radius));
        }
      }
      // At a real painted overlap, a thin stem stays reachable inside a broad
      // filled bank. DOM order never gives an invisible rectangle ownership.
      if(nearest<bestDistance-1e-6||Math.abs(nearest-bestDistance)<1e-6&&edge<bestEdge) {
        best=shape.element;bestDistance=nearest;bestEdge=edge;
      }
    }
    return best;
  }
}
