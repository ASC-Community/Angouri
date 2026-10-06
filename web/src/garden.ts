import type { Kernel } from './engine';
import type { Point } from './types';
import './garden.css';

type SourceId = 72|73|74|75|76|77;
type Orientation = 'horizontal'|'vertical';

interface Box { x:number; y:number; width:number; height:number }
interface Piece {
  sourceId:SourceId;
  name:string;
  shortName:string;
  description:string;
  className:string;
  box:Box;
  orientation:Orientation;
  labelAt:Point;
}
interface Sample { paths:Point[][] }

const FRAME:Box={x:0,y:0,width:760,height:424};
const PIECES:Piece[]=[
  {sourceId:72,name:'Water lobe',shortName:'Water',description:'a cropped sine lobe beside the water',className:'water-lobe',box:{x:66,y:287,width:190,height:56},orientation:'horizontal',labelAt:[161,381]},
  {sourceId:73,name:'Curved stem',shortName:'Stem',description:'a growing curved stem',className:'stem',box:{x:314,y:171,width:66,height:141},orientation:'vertical',labelAt:[310,350]},
  {sourceId:74,name:'Moon',shortName:'Moon',description:'a round moon above the garden',className:'moon',box:{x:91,y:42,width:112,height:112},orientation:'horizontal',labelAt:[147,192]},
  {sourceId:75,name:'Pointed leaf',shortName:'Leaf',description:'both sides of a pointed leaf',className:'leaf',box:{x:279,y:91,width:168,height:82},orientation:'horizontal',labelAt:[290,211]},
  {sourceId:76,name:'Quiet ripple',shortName:'Ripple',description:'a small ripple across the water',className:'ripple',box:{x:442,y:316,width:174,height:40},orientation:'horizontal',labelAt:[460,394]},
  {sourceId:77,name:'Cucumber',shortName:'Cucumber',description:'the long cucumber outline',className:'cucumber',box:{x:555,y:55,width:95,height:286},orientation:'vertical',labelAt:[653,394]}
];
const SOURCE_IDS=PIECES.map(piece=>piece.sourceId);

const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const finite=(point:Point)=>Number.isFinite(point[0])&&Number.isFinite(point[1]);

function fittedPaths(paths:Point[][],box:Box,orientation:Orientation):Point[][] {
  const all=paths.flat();
  const xs=all.map(point=>point[0]),ys=all.map(point=>point[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const sourceWidth=Math.max(1e-9,orientation==='vertical'?maxY-minY:maxX-minX);
  const sourceHeight=Math.max(1e-9,orientation==='vertical'?maxX-minX:maxY-minY);
  const scaleX=box.width/sourceWidth,scaleY=box.height/sourceHeight,offsetX=box.x,offsetY=box.y;
  return paths.map(path=>path.map(([x,y])=>orientation==='vertical'
    ?[offsetX+(maxY-y)*scaleX,offsetY+(x-minX)*scaleY]
    :[offsetX+(x-minX)*scaleX,offsetY+(maxY-y)*scaleY]));
}

function pathData(points:Point[]) {
  return points.map(([x,y],index)=>`${index?'L':'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
}

function distance(a:Point,b:Point) {return Math.hypot(a[0]-b[0],a[1]-b[1]);}

function joinedClosed(paths:Point[][]):Point[] {
  if(!paths.length)return [];
  const rest=paths.map(path=>path.slice()),joined=rest.shift()!;
  while(rest.length) {
    const start=joined[0],end=joined.at(-1)!;
    let best={index:0,mode:0,distance:Number.POSITIVE_INFINITY};
    rest.forEach((path,index)=>{
      const first=path[0],last=path.at(-1)!;
      [distance(end,first),distance(end,last),distance(start,last),distance(start,first)].forEach((candidate,mode)=>{
        if(candidate<best.distance)best={index,mode,distance:candidate};
      });
    });
    const path=rest.splice(best.index,1)[0];
    if(best.mode===0)joined.push(...path.slice(1));
    else if(best.mode===1)joined.push(...path.slice(0,-1).reverse());
    else if(best.mode===2)joined.unshift(...path.slice(0,-1));
    else joined.unshift(...path.slice(1).reverse());
  }
  if(distance(joined[0],joined.at(-1)!)>1e-5)joined.push(joined[0]);
  return joined;
}

function resampleClosed(points:Point[],count=100):Point[] {
  if(points.length<2)return points;
  const closed=distance(points[0],points.at(-1)!)<=1e-5?points:points.concat([points[0]]);
  const lengths:number[]=[0];
  for(let index=1;index<closed.length;index++)lengths.push(lengths[index-1]+distance(closed[index-1],closed[index]));
  const total=lengths.at(-1)!;
  if(total<=1e-9)return Array.from({length:count},()=>closed[0]);
  const sampled:Point[]=[];
  let segment=1;
  for(let index=0;index<count;index++) {
    const target=total*index/count;
    while(segment<lengths.length-1&&lengths[segment]<target)segment++;
    const before=lengths[segment-1],after=lengths[segment],amount=(target-before)/Math.max(1e-9,after-before);
    const a=closed[segment-1],b=closed[segment];sampled.push([a[0]+(b[0]-a[0])*amount,a[1]+(b[1]-a[1])*amount]);
  }
  return alignClosed(sampled);
}

function alignClosed(points:Point[]):Point[] {
  if(points.length<3)return points;
  let aligned=points.slice();
  const area=aligned.reduce((sum,point,index)=>{const next=aligned[(index+1)%aligned.length];return sum+point[0]*next[1]-next[0]*point[1];},0);
  if(area<0)aligned.reverse();
  const minY=Math.min(...aligned.map(point=>point[1])),maxY=Math.max(...aligned.map(point=>point[1]));
  const minX=Math.min(...aligned.map(point=>point[0])),maxX=Math.max(...aligned.map(point=>point[0])),centre=(minX+maxX)/2;
  let start=0,best=Number.POSITIVE_INFINITY;
  aligned.forEach((point,index)=>{
    if(point[1]>minY+(maxY-minY)*.012)return;
    const score=Math.abs(point[0]-centre)+(point[1]-minY)*4;
    if(score<best){best=score;start=index;}
  });
  return aligned.slice(start).concat(aligned.slice(0,start));
}

function closedPathData(points:Point[]) {return `${pathData(points)}Z`;}

export class Garden {
  private readonly cache=new Map<SourceId,Promise<Sample>>();
  private canonicalCache?:Promise<string>;
  private canonicalMarkup='';
  private samples?:Map<SourceId,Sample>;
  private completed=new Set<number>();
  private reveal=false;
  private active=false;
  private generation=0;
  private frame?:number;
  private revealTimer?:number;
  private morphAnimation?:SVGAnimateElement;
  private labelObserver?:ResizeObserver;

  constructor(
    private root:HTMLElement,
    private kernel:Kernel,
    private options:{reduced:()=>boolean;onFinish:()=>void;onBuild?:(sourceId:number)=>void}
  ) {
    root.addEventListener('click',this.click);
    root.addEventListener('keydown',this.keydown);
  }

  async open(completed:Set<number>=new Set(),reveal=false) {
    this.close();
    this.active=true;
    const version=this.generation;
    this.completed=new Set([...completed].filter(id=>SOURCE_IDS.includes(id as SourceId)));
    this.reveal=reveal;
    this.root.classList.add('garden-content');
    this.root.innerHTML='<div class="garden-loading" role="status"><img src="./cucumber.svg" width="54" height="54" alt=""><p>Gathering your curves&hellip;</p></div>';
    try {
      const [loaded,canonical]=await Promise.all([
        Promise.all(PIECES.map(async piece=>[piece.sourceId,await this.sample(piece.sourceId)] as const)),
        this.canonical()
      ]);
      if(!this.active||version!==this.generation)return;
      this.samples=new Map(loaded);this.canonicalMarkup=canonical;
      this.render();
      this.observeLabels();
      const firstIncomplete=this.root.querySelector<HTMLElement>('[data-garden-build][data-complete="false"]');
      (firstIncomplete??this.root.querySelector<HTMLElement>('[data-garden-build]')??this.root.querySelector<HTMLElement>('[data-garden-done]'))?.focus({preventScroll:true});
      if(this.reveal&&this.completed.has(77))this.startReveal(version);
    } catch {
      if(!this.active||version!==this.generation)return;
      this.root.innerHTML='<div class="garden-loading garden-error" role="alert"><p>Your picture could not gather its curves.</p><button class="button" data-garden-retry>Try again</button></div>';
    }
  }

  close() {
    this.active=false;
    this.generation++;
    if(this.frame!==undefined)cancelAnimationFrame(this.frame);
    if(this.revealTimer!==undefined)clearTimeout(this.revealTimer);
    if(this.morphAnimation){this.morphAnimation.endElement();this.morphAnimation.remove();}
    this.labelObserver?.disconnect();
    this.frame=undefined;this.revealTimer=undefined;
    this.morphAnimation=undefined;
    this.labelObserver=undefined;
    this.root.classList.remove('garden-content');
    this.root.replaceChildren();
  }

  private sample(sourceId:SourceId) {
    let cached=this.cache.get(sourceId);
    if(!cached) {
      cached=(async()=>{
        const response=await this.kernel.run(undefined,{type:'level',sourceId,mode:'puzzle'});
        const paths=response.status==='ok'?response.result?.picture?.paths:undefined;
        if(!paths?.length)throw new Error('Outline unavailable');
        const clean=paths.map(path=>path.points.filter(finite)).filter(points=>points.length>1);
        if(!clean.length)throw new Error('Outline unavailable');
        return {paths:clean};
      })();
      this.cache.set(sourceId,cached);
      void cached.catch(()=>this.cache.delete(sourceId));
    }
    return cached;
  }

  private canonical() {
    if(!this.canonicalCache) {
      this.canonicalCache=(async()=>{
        const response=await fetch(new URL('./cucumber.svg',document.baseURI));
        if(!response.ok)throw new Error('Canonical cucumber unavailable');
        const documentSvg=new DOMParser().parseFromString(await response.text(),'image/svg+xml');
        if(documentSvg.querySelector('parsererror'))throw new Error('Canonical cucumber unavailable');
        const svg=documentSvg.documentElement,body=svg.querySelector('path');
        if(svg.localName!=='svg'||!body)throw new Error('Canonical cucumber unavailable');
        body.classList.add('garden-canonical-body');
        const skin=svg.querySelector('#skin');
        if(skin) {
          skin.id='garden-canonical-skin';
          svg.querySelectorAll('[fill="url(#skin)"]').forEach(element=>element.setAttribute('fill','url(#garden-canonical-skin)'));
        }
        return svg.innerHTML;
      })();
      void this.canonicalCache.catch(()=>{this.canonicalCache=undefined;});
    }
    return this.canonicalCache;
  }

  private render() {
    if(!this.samples)return;
    const count=PIECES.filter(piece=>this.completed.has(piece.sourceId)).length;
    const all=count===PIECES.length;
    const canReveal=this.reveal&&this.completed.has(77);
    const alreadyRevealed=this.completed.has(77)&&!canReveal;
    const status=all
      ?'All six picture curves are built.'
      :`${count} of ${PIECES.length} picture curves built. Choose a faint piece to continue.`;
    const prompt=all
      ?'Six solved curves, gathered into one quiet picture.'
      :'Every colored line is one you built. Faint lines are still waiting.';
    let revealOrder=0;
    const artwork=PIECES.map(piece=>{
      const markup=this.artMarkup(piece,revealOrder);
      if(this.completed.has(piece.sourceId))revealOrder+=this.samples!.get(piece.sourceId)!.paths.length;
      return markup;
    }).join('');
    this.root.innerHTML=`<section class="garden-shell${canReveal&&!this.options.reduced()?' is-reveal-ready':''}${alreadyRevealed?' is-morphing morph-complete show-canonical':''}" aria-labelledby="garden-picture-heading" data-garden-complete="${all}">
      <header class="garden-heading"><p class="eyebrow">YOUR CURVES &middot; ${count} OF ${PIECES.length} BUILT</p><h2 id="garden-picture-heading">A garden from your curves</h2><p>${prompt}</p></header>
      <div class="garden-workspace">
        <div class="garden-board" aria-label="A garden assembled from six picture curves">
          <svg class="garden-paper" viewBox="${FRAME.x} ${FRAME.y} ${FRAME.width} ${FRAME.height}" role="group" aria-labelledby="garden-art-title" aria-describedby="garden-art-description">
            <title id="garden-art-title">A garden from your curves</title><desc id="garden-art-description">${escapeHtml(status)} Moon, leaf, stem, water curves and a cucumber outline appear as they are built.</desc>
            <defs><linearGradient id="garden-water" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#dbe9da"/><stop offset="1" stop-color="#d7e9e5"/></linearGradient></defs>
            <path class="garden-water-wash" d="M36 270C184 245 282 296 408 278S621 246 724 279V382H36Z"/>
            <g class="garden-speckles" aria-hidden="true">${this.speckles()}</g>
            ${artwork}
            <svg class="garden-canonical" x="419" y="7" width="365" height="365" viewBox="0 0 64 64" aria-hidden="true">${this.canonicalMarkup}</svg>
          </svg>
        </div>
      </div>
      <footer class="garden-footer"><p class="garden-status" role="status" aria-live="polite">${status}</p><button class="button primary garden-done" data-garden-done>Done</button></footer>
    </section>`;
    this.root.closest<HTMLDialogElement>('dialog')?.scrollTo({top:0});
  }

  private artMarkup(piece:Piece,revealOrder:number) {
    const sample=this.samples!.get(piece.sourceId)!;
    const paths=fittedPaths(sample.paths,piece.box,piece.orientation);
    const done=this.completed.has(piece.sourceId);
    const action=done?'Revisit':'Build',name=escapeHtml(piece.name),label=escapeHtml(piece.shortName),[labelX,labelY]=piece.labelAt;
    const area=[74,75,77].includes(piece.sourceId)
      ?`<path class="garden-area-hit" d="${closedPathData(joinedClosed(paths))}"/>`
      :`<rect class="garden-area-hit" x="${piece.box.x}" y="${piece.box.y}" width="${piece.box.width}" height="${piece.box.height}"/>`;
    const curvePaths=paths.map((points,index)=>{
      const d=pathData(points);
      return `<path class="garden-piece-hit" d="${d}"/><path class="garden-focus-path" d="${d}"/><path class="garden-art-path" pathLength="1" style="--garden-path-delay:${(revealOrder+index)*100}ms" d="${d}"/>`;
    }).join('');
    const morph=piece.sourceId===77&&done?`<path class="garden-cucumber-morph" data-garden-cucumber-morph d="${closedPathData(resampleClosed(joinedClosed(paths)))}"/>`:'';
    return `<g class="garden-piece garden-piece-${piece.className} ${done?'is-earned':'is-missing'}" role="button" tabindex="0" data-garden-piece="${piece.sourceId}" data-garden-build="${piece.sourceId}" data-complete="${done}" data-garden-complete="${done}" aria-label="${action} ${name}">${area}${curvePaths}${morph}<g class="garden-piece-label" aria-hidden="true"><rect x="${labelX}" y="${labelY}" width="0" height="0" rx="4"/><text x="${labelX}" y="${labelY}">${label}${done?'<tspan class="garden-piece-check" dx="4">&#10003;</tspan>':''}</text></g></g>`;
  }

  private observeLabels() {
    const paper=this.root.querySelector<SVGSVGElement>('.garden-paper');
    if(!paper)return;
    const layout=()=>{
      const width=paper.getBoundingClientRect().width;
      if(!width)return;
      const scale=width/FRAME.width,target=Math.max(10,Math.min(12,width/64));
      paper.style.setProperty('--garden-label-size',`${target/scale}px`);
      const paddingX=5/scale,paddingY=3/scale;
      paper.querySelectorAll<SVGGElement>('.garden-piece-label').forEach(label=>{
        const text=label.querySelector<SVGTextElement>('text'),rect=label.querySelector<SVGRectElement>('rect');
        if(!text||!rect)return;
        const bounds=text.getBBox();
        rect.setAttribute('x',String(bounds.x-paddingX));rect.setAttribute('y',String(bounds.y-paddingY));
        rect.setAttribute('width',String(bounds.width+paddingX*2));rect.setAttribute('height',String(bounds.height+paddingY*2));
        rect.setAttribute('rx',String(5/scale));
      });
    };
    this.labelObserver=new ResizeObserver(layout);this.labelObserver.observe(paper);layout();
  }

  private startReveal(version:number) {
    const shell=this.root.querySelector<HTMLElement>('.garden-shell');
    if(!shell)return;
    const pathCount=this.root.querySelectorAll('.garden-piece.is-earned .garden-art-path').length;
    if(this.options.reduced()) {
      shell.classList.add('is-revealing','is-morphing','morph-complete','show-canonical');
      this.revealMessage();
      return;
    }
    this.frame=requestAnimationFrame(()=>{
      this.frame=requestAnimationFrame(()=>{
        if(!this.active||version!==this.generation)return;
        shell.classList.add('is-revealing');
      });
    });
    this.revealTimer=window.setTimeout(()=>{
      if(!this.active||version!==this.generation)return;
      this.revealTimer=undefined;
      shell.classList.add('trace-complete');
      this.morphCucumber(shell,version);
    },Math.max(760,pathCount*100+620));
  }

  private canonicalBodyPoints(count=100):Point[]|undefined {
    const paper=this.root.querySelector<SVGSVGElement>('.garden-paper');
    const body=this.root.querySelector<SVGPathElement>('.garden-canonical-body');
    const paperMatrix=paper?.getScreenCTM(),bodyMatrix=body?.getScreenCTM();
    if(!paper||!body||!paperMatrix||!bodyMatrix)return undefined;
    const transform=paperMatrix.inverse().multiply(bodyMatrix),length=body.getTotalLength();
    if(!Number.isFinite(length)||length<=0)return undefined;
    return alignClosed(Array.from({length:count},(_,index)=>{
      const point=body.getPointAtLength(length*index/count),mapped=new DOMPoint(point.x,point.y).matrixTransform(transform);
      return [mapped.x,mapped.y] as Point;
    }));
  }

  private morphCucumber(shell:HTMLElement,version:number) {
    const morph=this.root.querySelector<SVGPathElement>('[data-garden-cucumber-morph]');
    const points=this.canonicalBodyPoints();
    if(!morph||!points?.length){shell.classList.add('morph-complete','show-canonical');this.revealMessage();return;}
    const from=morph.getAttribute('d')!,to=closedPathData(points);
    shell.classList.add('is-morphing');
    const animation=document.createElementNS('http://www.w3.org/2000/svg','animate');
    animation.setAttribute('attributeName','d');animation.setAttribute('from',from);animation.setAttribute('to',to);
    animation.setAttribute('dur','500ms');animation.setAttribute('calcMode','spline');animation.setAttribute('keySplines','.4 0 .2 1');animation.setAttribute('fill','freeze');
    morph.append(animation);animation.beginElement();
    this.morphAnimation=animation;
    this.revealTimer=window.setTimeout(()=>{
      if(!this.active||version!==this.generation)return;
      morph.setAttribute('d',to);animation.endElement();animation.remove();this.morphAnimation=undefined;this.revealTimer=undefined;
      shell.classList.add('morph-complete','show-canonical');this.revealMessage();
    },510);
  }

  private revealMessage() {
    this.say(this.completed.size===PIECES.length?'All six curves gather into your finished garden.':'Your cucumber curve joins the garden.');
  }

  private say(message:string) {
    const status=this.root.querySelector<HTMLElement>('.garden-status');
    if(status)status.textContent=message;
  }

  private speckles() {
    return [[44,62],[79,328],[184,371],[300,83],[326,360],[516,70],[624,178],[688,344],[705,102],[559,376]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="1.8"/>`).join('');
  }

  private click=(event:MouseEvent)=>{
    const source=(event.target as Element).closest<SVGGElement>('[data-garden-build]');
    if(source&&this.root.contains(source)){this.activate(Number(source.dataset.gardenBuild));return;}
    const button=(event.target as Element).closest<HTMLButtonElement>('button');
    if(!button||!this.root.contains(button))return;
    if(button.hasAttribute('data-garden-retry')){void this.open(this.completed,this.reveal);return;}
    if(button.hasAttribute('data-garden-done'))this.options.onFinish();
  };

  private keydown=(event:KeyboardEvent)=>{
    if(event.repeat||event.key!=='Enter'&&event.key!==' ')return;
    const source=(event.target as Element).closest<SVGGElement>('[data-garden-build]');
    if(!source||!this.root.contains(source))return;
    event.preventDefault();this.activate(Number(source.dataset.gardenBuild));
  };

  private activate(sourceId:number) {
    if(SOURCE_IDS.includes(sourceId as SourceId))this.options.onBuild?.(sourceId);
  }
}
