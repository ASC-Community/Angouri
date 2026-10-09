import type { Kernel } from './engine';
import type { Point } from './types';
import { GardenHitTest } from './garden-hit';
import { collectionPath, ease, resampleLine, type GardenOrigin } from './garden-collection';
import './garden.css';

type SourceId = 72|73|74|75|76|77|82|83;
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
  mirror?:boolean;
  bend?:number;
  labelAt:Point;
}
interface Sample { paths:Point[][] }

// The picture occupies y=0..424; two aligned label rows frame it above and below.
const FRAME:Box={x:0,y:-62,width:760,height:548};
const PIECES:Piece[]=[
  {sourceId:72,name:'Planted bank',shortName:'Bank',description:'the planted bank where the vine grows',className:'bank',box:{x:360,y:334,width:400,height:90},orientation:'horizontal',labelAt:[474,457]},
  {sourceId:73,name:'Climbing vine',shortName:'Vine',description:'the connected vine growing from the bank',className:'stem',box:{x:575,y:76,width:80,height:310},orientation:'vertical',mirror:true,labelAt:[660,-31]},
  {sourceId:74,name:'Moon',shortName:'Moon',description:'a golden moon above the pond',className:'moon',box:{x:112,y:48,width:88,height:88},orientation:'horizontal',labelAt:[100,-31]},
  {sourceId:75,name:'Reed leaf',shortName:'Reed',description:'a pointed reed leaf at the water edge',className:'leaf',box:{x:68,y:281,width:25,height:117},orientation:'vertical',labelAt:[100,457]},
  {sourceId:76,name:'Quiet ripple',shortName:'Ripple',description:'a quiet ring on the pond surface',className:'ripple',box:{x:263,y:346,width:125,height:8},orientation:'horizontal',labelAt:[286,457]},
  {sourceId:77,name:'Cucumber',shortName:'Cucumber',description:'the cucumber hanging from the vine',className:'cucumber',box:{x:548,y:165,width:50,height:150},orientation:'vertical',labelAt:[286,-31]},
  {sourceId:82,name:'Bamboo support',shortName:'Bamboo',description:'a straight bamboo support planted in the bank',className:'support',box:{x:629,y:46,width:13,height:342},orientation:'vertical',mirror:true,labelAt:[660,457]},
  {sourceId:83,name:'Cucumber flower',shortName:'Flower',description:'five copies of your petal joined into a cucumber flower',className:'flower',box:{x:532,y:32,width:36,height:36},orientation:'horizontal',labelAt:[474,-31]}
];
const SOURCE_IDS=PIECES.map(piece=>piece.sourceId);

const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const finite=(point:Point)=>Number.isFinite(point[0])&&Number.isFinite(point[1]);

function fittedPaths(paths:Point[][],{box,orientation,mirror,bend=0}:Piece):Point[][] {
  const all=paths.flat();
  const xs=all.map(point=>point[0]),ys=all.map(point=>point[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const sourceWidth=Math.max(1e-9,orientation==='vertical'?maxY-minY:maxX-minX);
  const sourceHeight=Math.max(1e-9,orientation==='vertical'?maxX-minX:maxY-minY);
  const scaleX=box.width/sourceWidth,scaleY=box.height/sourceHeight,offsetX=box.x,offsetY=box.y;
  return paths.map(path=>path.map(([x,y])=>{
    const position=orientation==='vertical'?(x-minX)/sourceHeight:0;
    return orientation==='vertical'
      ?[offsetX+(mirror?y-minY:maxY-y)*scaleX+bend*position*position,offsetY+(x-minX)*scaleY]
      :[offsetX+(x-minX)*scaleX,offsetY+(maxY-y)*scaleY];
  }));
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

// Decorative interpolation of the earned samples, never validation geometry.
function smoothClosedPath(points:Point[]) {
  const ring=distance(points[0],points.at(-1)!)<1e-5?points.slice(0,-1):points;
  const at=(index:number)=>ring[(index+ring.length)%ring.length];
  return `M${ring[0].join(' ')}`+ring.map((point,index)=>{
    const previous=at(index-1),next=at(index+1),after=at(index+2);
    return `C${point[0]+(next[0]-previous[0])/6} ${point[1]+(next[1]-previous[1])/6} ${next[0]-(after[0]-point[0])/6} ${next[1]-(after[1]-point[1])/6} ${next.join(' ')}`;
  }).join('')+'Z';
}

export class Garden {
  private readonly cache=new Map<SourceId,Promise<Sample>>();
  private canonicalCache?:Promise<string>;
  private canonicalMarkup='';
  private canonicalFrame:Box={x:2,y:5,width:19,height:57};
  private canonicalBend=0;
  private canonicalStalk={tip:[8.8,-1.4] as Point,towardBody:[1.6,2.4] as Point,width:1.6};
  private samples?:Map<SourceId,Sample>;
  private completed=new Set<number>();
  private revealSource?:SourceId;
  private active=false;
  private generation=0;
  private frame?:number;
  private revealTimer?:number;
  private morphAnimation?:SVGAnimateElement;
  private labelObserver?:ResizeObserver;
  private hitTest?:GardenHitTest;
  private pointed?:SVGGElement;
  private collection?:SVGSVGElement;
  private collectionPaths:Point[][]=[];
  private origin?:GardenOrigin;
  private revealReady=false;

  constructor(
    private root:HTMLElement,
    private kernel:Kernel,
    private options:{reduced:()=>boolean;onFinish:()=>void;onBuild?:(sourceId:number)=>void;onRevealComplete?:()=>void}
  ) {
    root.addEventListener('click',this.click);
    (root.closest('dialog')??root).addEventListener('keydown',this.keydown);
    root.addEventListener('pointermove',this.point);
    root.addEventListener('pointerleave',this.clearPoint);
    root.addEventListener('pointercancel',this.clearPoint);
  }

  async open(completed:Set<number>=new Set(),revealSource?:number,origin?:GardenOrigin) {
    this.close();
    this.active=true;
    this.revealReady=false;
    const version=this.generation;
    this.completed=new Set([...completed].filter(id=>SOURCE_IDS.includes(id as SourceId)));
    this.revealSource=SOURCE_IDS.includes(revealSource as SourceId)&&this.completed.has(revealSource!)?revealSource as SourceId:undefined;
    this.origin=origin;
    if(this.revealSource&&!this.options.reduced()) {
      const dialog=this.root.closest('dialog');
      dialog?.classList.add('is-collecting');
      dialog?.style.setProperty('--garden-arrival','0');
      this.collection=document.createElementNS('http://www.w3.org/2000/svg','svg');
      this.collection.classList.add('garden-collection');
      this.collection.setAttribute('aria-hidden','true');
      if(origin)this.collection.innerHTML=origin.paths.map(points=>`<path d="${collectionPath(points)}"/>`).join('');
      this.collection.style.color=origin?.color??'#668c3b';
      this.collection.style.strokeWidth=String(origin?.width??3);
      dialog?.append(this.collection);
    }
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
      this.hitTest=new GardenHitTest(this.root.querySelector<SVGSVGElement>('.garden-paper')!);
      this.observeLabels();
      // Keep the dialog's neutral arrival focus, or the player's deliberate
      // selection while loading. Rendering must not focus or highlight a piece.
      if(this.revealSource)this.startReveal(version);
    } catch {
      if(!this.active||version!==this.generation)return;
      this.endCollection();
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
    this.hitTest=undefined;this.clearPoint();
    this.endCollection();this.origin=undefined;this.collectionPaths=[];
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
        const frame=body.getAttribute('data-body-frame')?.split(' ').map(Number);
        if(frame?.length===4&&frame.every(Number.isFinite))this.canonicalFrame={x:frame[0],y:frame[1],width:frame[2],height:frame[3]};
        this.canonicalBend=Number(body.getAttribute('data-body-bend')??0);
        const stalk=svg.querySelector<SVGPathElement>('[data-cucumber-part="stem"]');
        if(stalk) {
          const length=stalk.getTotalLength(),tip=stalk.getPointAtLength(length),near=stalk.getPointAtLength(Math.max(0,length-.1));
          this.canonicalStalk={tip:[tip.x,tip.y],towardBody:[near.x-tip.x,near.y-tip.y],width:Number(stalk.getAttribute('stroke-width'))};
        }
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
    const canReveal=this.revealSource!==undefined;
    const alreadyRevealed=this.completed.has(77)&&this.revealSource!==77;
    const status=all
      ?'All eight picture curves are built.'
      :`${count} of ${PIECES.length} picture curves built. Choose a faint piece to continue.`;
    const prompt=this.revealSource?`${PIECES.find(piece=>piece.sourceId===this.revealSource)!.name} joins your garden.`:all
      ?'A cucumber vine, rooted by the water. A quiet night in your garden.'
      :'Grow a vine beside the pond, one curve at a time.';
    // Light and ripples belong to the water, behind the planted shoreline.
    const paintOrder:SourceId[]=[74,76,82,72,75,73,83,77];
    const artwork=paintOrder.map(id=>this.artMarkup(PIECES.find(piece=>piece.sourceId===id)!)).join('');
    this.root.innerHTML=`<section class="garden-shell${canReveal&&!this.options.reduced()?' is-reveal-ready':''}${alreadyRevealed?' is-morphing morph-complete show-canonical':''}" aria-labelledby="garden-picture-heading" data-garden-complete="${all}"${canReveal?` data-garden-reveal="${this.revealSource}"`:''}>
      <header class="garden-heading"><p class="eyebrow">YOUR CURVES &middot; ${count} OF ${PIECES.length} BUILT</p><h2 id="garden-picture-heading">${all?'Grown from your curves':'A garden in the making'}</h2><p>${prompt}</p></header>
      <div class="garden-workspace">
        <div class="garden-board" aria-label="A garden assembled from eight picture curves">
          <svg class="garden-paper" viewBox="${FRAME.x} ${FRAME.y} ${FRAME.width} ${FRAME.height}" role="group" aria-labelledby="garden-art-title" aria-describedby="garden-art-description">
            <title id="garden-art-title">The moonlit garden</title><desc id="garden-art-description">${escapeHtml(status)} A cucumber vine grows from the right bank beside a moonlit pond. Its stem connects the leaf and hanging fruit.</desc>
            <defs>
              <linearGradient id="garden-sky" x2=".25" y2="1"><stop stop-color="#102b39"/><stop offset=".65" stop-color="#244854"/><stop offset="1" stop-color="#3b6065"/></linearGradient>
              <linearGradient id="garden-water" x2=".15" y2="1"><stop stop-color="#416a70"/><stop offset=".45" stop-color="#2c515d"/><stop offset="1" stop-color="#142f3d"/></linearGradient>
              <linearGradient id="garden-leaf" x2=".8" y2=".8"><stop stop-color="#a5b47a"/><stop offset=".42" stop-color="#6e8956"/><stop offset="1" stop-color="#345641"/></linearGradient>
              <linearGradient id="garden-moon" x2="1" y2="1"><stop stop-color="#fff2c1"/><stop offset="1" stop-color="#e0be7b"/></linearGradient>
              <linearGradient id="garden-flower" x2=".3" y2="1"><stop stop-color="#f6dd8f"/><stop offset="1" stop-color="#caa852"/></linearGradient>
              <linearGradient id="garden-bank" x2=".3" y2="1"><stop stop-color="#697955"/><stop offset=".35" stop-color="#3d573f"/><stop offset="1" stop-color="#192f2b"/></linearGradient>
              <linearGradient id="garden-soil" x2=".5" y2="1"><stop stop-color="#44593f"/><stop offset="1" stop-color="#142b29"/></linearGradient>
              <linearGradient id="garden-bamboo"><stop stop-color="#b4af7b"/><stop offset=".3" stop-color="#a2a16e"/><stop offset="1" stop-color="#56634c"/></linearGradient>
              <linearGradient id="garden-stone" x2=".6" y2="1"><stop stop-color="#889681"/><stop offset=".4" stop-color="#536959"/><stop offset="1" stop-color="#2b443c"/></linearGradient>
              <radialGradient id="garden-halo"><stop stop-color="#ffefb0" stop-opacity=".2"/><stop offset="1" stop-color="#ffefb0" stop-opacity="0"/></radialGradient>
            </defs>
            <g class="garden-landscape" aria-hidden="true">
              <path fill="url(#garden-sky)" d="M0 0H760V424H0Z"/>
              <path fill="#a6b8af" opacity=".06" d="M0 152Q42 133 90 144Q154 133 219 151Q273 155 314 166Q230 159 164 165Q69 155 0 169ZM284 74Q350 53 404 68Q443 64 485 82Q422 77 382 83Q331 74 284 81Z"/>
              <path fill="#2b5055" d="M0 238C33 222 51 227 76 211C94 196 118 201 134 220C152 215 160 225 178 226C202 208 223 213 237 229C273 217 291 231 312 229C353 207 393 215 421 230C447 213 458 219 470 223C488 194 513 203 530 220C553 198 581 205 596 226C625 220 650 234 671 218C699 183 717 200 731 187C744 171 753 176 760 174V424H0Z"/>
              <path fill="#1b3c3e" d="M0 252Q32 238 67 249Q102 247 143 259C198 271 235 253 278 254S362 267 415 254Q452 241 479 254Q517 254 559 266Q655 272 760 230V424H0Z"/>
              <path fill="#173639" d="M23 253Q26 233 17 225Q32 231 34 247Q37 226 47 218L43 247Q57 233 69 234L51 253ZM357 262L354 244L365 257Q369 239 380 234L375 258L389 248L394 260ZM667 254Q671 236 661 224Q678 232 679 248Q685 225 697 218L689 247Q706 233 717 234L705 256Z"/>
              <path fill="#b8c7b3" opacity=".04" d="M83 242Q255 226 425 245Q511 258 606 247Q431 266 294 252Q177 243 83 249Z"/>
              <path fill="url(#garden-water)" d="M0 283Q157 267 302 287T602 285L760 345V424H0Z"/>
              <path fill="#173b41" opacity=".35" d="M0 285Q80 279 137 286L132 296Q68 286 0 301ZM316 290q53-4 91 7l-16 7q-26-7-79-6Z"/><path d="M0 285Q98 278 176 282M207 287q46 0 82 5M326 293q52 6 77 5M427 306h61M8 311h57m166-8h38m118 18h55M24 370h72m112 19h41m-205 18h60m191-15h42M225 331h39m103-1h72" fill="none" stroke="#9ab1b0" stroke-width="1.2" stroke-linecap="round" opacity=".3"/>
              <path fill="#152f2d" d="M0 380Q22 390 36 393L52 405Q81 400 102 424H0Z"/>
              <path d="M14 414Q18 373 8 351M26 415Q33 382 47 374M39 424Q44 404 64 394" fill="none" stroke="#547258" stroke-width="3" stroke-linecap="round"/>
            </g>
            <g class="garden-speckles" aria-hidden="true">${this.speckles()}</g>
            <path class="garden-label-bands" d="M0 -62H760V0H0ZM0 424H760V486H0Z" aria-hidden="true"/>
            ${artwork}
            ${(()=>{const box=PIECES.find(piece=>piece.sourceId===77)!.box;return `<svg class="garden-canonical" x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" viewBox="0 0 64 64" preserveAspectRatio="none" overflow="visible" aria-hidden="true">${this.canonicalMarkup}</svg>`;})()}
          </svg>
        </div>
      </div>
      <footer class="garden-footer"><p class="garden-status" role="status" aria-live="polite">${status}</p><button class="button primary garden-done" data-garden-done ${canReveal?'disabled':''}>Done</button></footer>
    </section>`;
    this.alignCanonicalBody();
    this.root.closest<HTMLDialogElement>('dialog')?.scrollTo({top:0});
  }

  private artMarkup(piece:Piece) {
    const sample=this.samples!.get(piece.sourceId)!;
    // Decorative placement follows the canonical body's bow. Puzzle equations,
    // targets and validation retain the kernel's original mathematical frame.
    let paths=fittedPaths(sample.paths,piece.sourceId===77?{...piece,bend:this.canonicalBend*piece.box.width/this.canonicalFrame.width}:piece);
    if(piece.sourceId===83) {
      const petal=joinedClosed(fittedPaths(sample.paths,{...piece,box:{x:-7,y:-17,width:14,height:19},orientation:'vertical'}));
      paths=Array.from({length:5},(_,index)=>{
        const angle=(index*72+8)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
        return petal.map(([x,y])=>[550+x*c-y*s,50+x*s+y*c] as Point);
      });
    }
    if(piece.sourceId===this.revealSource)this.collectionPaths=[74,75,77].includes(piece.sourceId)?[joinedClosed(paths)]:paths;
    const done=this.completed.has(piece.sourceId);
    const action=done?'Revisit':'Build',name=escapeHtml(piece.name),label=escapeHtml(piece.shortName),[labelX,labelY]=piece.labelAt;
    const top=labelY<0;
    const silhouette=piece.sourceId===83?paths.map(closedPathData).join(''):piece.sourceId===74?smoothClosedPath(joinedClosed(paths)):[75,77].includes(piece.sourceId)?closedPathData(joinedClosed(paths))
      :piece.sourceId===72?`${pathData(paths[0])}Z`:'';
    const fill=silhouette?`<path class="garden-piece-fill" d="${silhouette}"/>`:'';
    const bankEdge=piece.sourceId===72?pathData(paths[0]):'';
    const vineLeaf=(x:number,y:number,scale:number,angle:number)=>{
      const radians=-angle*Math.PI/180,light=[-Math.cos(radians)+Math.sin(radians),-Math.sin(radians)-Math.cos(radians)];
      const gradient=`garden-leaf-${x}-${y}`,dx=light[0]/Math.SQRT2*.5,dy=light[1]/Math.SQRT2*.5;
      return `<g class="garden-vine-leaf" transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})"><defs><linearGradient id="${gradient}" x1="${.5+dx}" y1="${.5+dy}" x2="${.5-dx}" y2="${.5-dy}"><stop stop-color="#a5b47a"/><stop offset=".45" stop-color="#6e8956"/><stop offset="1" stop-color="#345641"/></linearGradient></defs><path style="fill:url(#${gradient})" d="M0 0C-8-15-26-13-30-2L-35-1L-33 5Q-43 11-36 22L-39 26L-32 29L-31 37L-24 37Q-14 43-4 54L0 61L6 52Q16 45 24 37L31 37L32 29L39 26L36 22Q43 11 33 5L35-1L30-2C26-13 8-15 0 0Z"/><path class="garden-small-vein" d="M0 0Q-2 28 0 54M0 0Q-14 7-29 28M0 0Q-15-2-26 0M0 0Q14 7 29 28M0 0Q15-2 26 0"/><path class="garden-leaf-veinlets" d="M-1 22l-11 5m12 9l11 4M-17 15l-11-1m44 1l12-1M-1 12l7 3"/></g>`;
    };
    // Decorative branches leave the rendered, kernel-sampled stem. This keeps
    // their junctions attached even if its sample density changes.
    const vineNode=(y:number)=>{
      const stem=paths[0],after=stem.findIndex(point=>point[1]>=y);
      if(after<=0)return `${stem[0][0]} ${stem[0][1]}`;
      const a=stem[after-1],b=stem[after],t=(y-a[1])/(b[1]-a[1]);
      return `${a[0]+(b[0]-a[0])*t} ${y}`;
    };
    // The earned sine is a shallow rear arc, seen in perspective. Broken
    // surrounding arcs leave water between them instead of enclosing a badge.
    const rippleArc=piece.sourceId===76?pathData(paths[0]):'';
    const fruit=PIECES.find(piece=>piece.sourceId===77)!.box,body=this.canonicalFrame,stalk=this.canonicalStalk;
    const sx=fruit.width/body.width,sy=fruit.height/body.height;
    const tip=[fruit.x+(stalk.tip[0]-body.x)*sx,fruit.y+(stalk.tip[1]-body.y)*sy];
    const direction=[stalk.towardBody[0]*sx,stalk.towardBody[1]*sy],length=Math.hypot(...direction);
    const joinControl=tip.map((value,index)=>value-direction[index]/length*20);
    const details=piece.sourceId===75?`<g class="garden-reed-details"><path fill="#28483b" d="M72 422Q62 368 67 342Q75 372 78 413Q85 376 99 362Q91 397 86 424ZM56 423Q47 392 33 383Q52 390 65 421Z"/><path class="garden-reed-blade" d="M79 415Q60 377 40 323Q67 335 79 415ZM80 418Q98 377 126 357Q109 393 80 418Z"/><path class="garden-leaf-vein" d="M80.5 291V397"/><path class="garden-reed-stalk" d="M80.5 397Q77 413 73 424M79 421Q58 375 46 335M81 419Q95 387 119 365"/><path fill="#142d2a" d="M54 423Q64 412 72 416L74 405L83 419L99 413L107 424Z"/></g>`
      :piece.sourceId===74?`<g class="garden-moon-texture"><path d="M124 79Q125 66 137 69Q145 70 143 80Q140 89 131 87ZM158 109Q157 95 174 96Q186 103 181 114Q179 124 167 121Z"/><circle cx="145" cy="116" r="3"/><circle cx="171" cy="70" r="4"/></g><g class="garden-moonlight"><circle cx="156" cy="92" r="106" fill="url(#garden-halo)"/><ellipse cx="166" cy="357" rx="111" ry="78" fill="url(#garden-halo)"/>${[[149,286,9],[158,291,5],[139,299,15],[164,299,11],[143,307,24],[149,316,13],[170,317,11],[130,324,17],[153,322,30],[135,334,18],[163,335,35],[123,347,26],[161,348,14],[183,345,23],[131,357,25],[169,358,38],[101,370,31],[145,367,18],[177,371,41],[108,387,53],[181,385,37],[90,399,35],[139,400,33],[186,398,52],[76,413,55],[149,411,56],[219,414,15]].map(([x,y,width],i)=>`<path d="M${x} ${y}q${width*.45} ${i%3-1} ${width} 0" stroke-width="${y<330?1.1:y<380?1.5:1.9}" opacity="${.22+(i%4)*.065}"/>`).join('')}<path d="M237 315h24m12 0h15M251 333h38m17 0h16M228 378h25m39 5h37M351 371h22m31-23h32" opacity=".26"/></g>`
      :piece.sourceId===73?`<g class="garden-stem-details"><path class="garden-stalk" d="M${vineNode(116)}Q568 98 535 100M${vineNode(150)}Q644 103 676 124M575 76Q586 56 611 68T632 90M${vineNode(297)}Q653 275 683 297M${vineNode(245)}Q632 216 646 233M${vineNode(332)}Q613 313 597 317"/><path class="garden-fruit-stalk" style="stroke-width:${stalk.width*sx}" d="M${vineNode(116)}C581 123 ${joinControl.join(' ')} ${tip.join(' ')}"/><path class="garden-tendril" d="M${vineNode(113)}Q622 91 633 99Q641 110 630 113Q621 113 626 105M${vineNode(212)}Q638 200 639 213Q638 223 631 218M588 66q-16-8-10-16t11 2M${vineNode(299)}q35 16 25-2"/>${vineLeaf(535,100,.83,46)}${vineLeaf(676,124,.73,-49)}${vineLeaf(683,297,.72,-48)}${vineLeaf(597,317,.48,55)}<svg class="garden-young-fruit" x="640" y="239" width="18" height="54" viewBox="25.76 8.4 16.72 50.16" overflow="visible" aria-hidden="true">${this.canonicalMarkup.replaceAll('garden-canonical-skin','garden-young-skin').replaceAll('garden-canonical-body','garden-young-body')}</svg><path class="garden-root-contact" d="M641 389Q647 381 654 384L656 375L660 386Q670 386 676 391Z"/><path class="garden-root-grass" d="M652 389q-4-12-13-17m21 18q3-15 11-20"/></g>`
      :piece.sourceId===72?`<g class="garden-bank-details"><defs><clipPath id="garden-bank-surface"><path d="${silhouette}"/></clipPath></defs><path class="garden-wet-edge" d="${bankEdge}"/><g clip-path="url(#garden-bank-surface)"><path class="garden-bank-soil" d="M382 424Q416 403 455 402Q474 385 505 392Q547 363 584 377Q615 366 650 386Q699 383 760 419V424Z"/><path class="garden-planting-pocket" d="M611 362Q625 347 645 354Q659 358 675 373Q697 382 685 397Q665 405 642 396Q622 390 611 373Z"/><path class="garden-earth-cuts" d="M621 367q9-6 17-4m-6 13q12-4 20 0m9-3q9 0 13 6m-20 13q10 2 16-3"/><path class="garden-earth-clods" d="M618 378q4-7 10-4l4 6q-8 3-14-2ZM666 362q7-2 10 4l-5 4-7-3ZM676 389q5-6 10-1l2 5-13 0Z"/></g><path class="garden-bank-lip" d="${bankEdge}"/><path class="garden-grass-blades" d="M462 376Q466 360 460 346Q472 356 473 372Q478 353 491 342Q484 359 479 376ZM519 349Q521 330 514 317Q528 330 527 343Q533 327 545 319Q535 335 533 347ZM582 350Q582 332 574 325Q588 331 590 344Q596 326 606 322Q597 338 598 351ZM695 398Q697 379 687 366Q702 373 704 390Q704 362 716 347Q713 371 711 388Q724 368 739 365Q721 380 718 399Z"/><path class="garden-grass-light" d="M460 346q10 11 13 26M514 317q13 15 13 26M574 325q13 7 16 19M716 347q-5 18-5 37"/><path class="garden-ground-shadow" d="M621 359Q636 350 652 359Q643 363 621 359ZM615 401Q650 392 681 404Q649 412 615 401ZM457 414Q484 405 506 415Z"/><path class="garden-shore-shadow" d="M421 395Q435 377 468 385Q457 401 421 395ZM521 348q15-17 35-9q0 9-35 9Z"/><path class="garden-shore-stone" d="M426 392C422 384 434 376 443 381Q453 388 448 394ZM446 388q1-15 14-10q8 6 2 14ZM520 345q1-12 12-10q12 5 7 12ZM537 341q4-11 14-5l3 7-15 3Z"/><path class="garden-stone" d="M675 401L679 391Q691 386 701 392L711 402Q690 410 675 401ZM461 411L466 404L482 401L493 409Q481 418 461 411ZM706 418L709 406L725 402L743 410L750 421Z"/><path class="garden-stone-rim" d="M426 386Q431 379 439 381M449 382Q453 376 459 379M522 339Q527 333 532 336M541 336q4-3 9 1M681 392Q690 388 700 393M468 405L481 403M712 408L725 405L737 411"/></g>`
      :piece.sourceId===76?`<g class="garden-ripple-echo"><path class="garden-ripple-rear" pathLength="1" d="${rippleArc}" transform="translate(325.5 355) scale(1.2 1.2) translate(-325.5 -355)"/><path class="garden-ripple-outer" pathLength="1" d="${rippleArc}" transform="translate(325.5 355) scale(1.43 1.45) translate(-325.5 -355)"/><path class="garden-ripple-near" d="M268 360C283 367 346 369 372 363M252 365C270 375 362 377 393 364M240 362q-10 5 8 10M405 356q11 6-1 11"/><path class="garden-ripple-centre" d="M316 355q8 2 17 0"/></g>`
      :piece.sourceId===82?'<g class="garden-bamboo-nodes"><path d="M626 93l9-.3m-7 59l9-.3m-7 60l9-.3m-6 63l9-.3m-7 66l9-.3"/></g>'
      :piece.sourceId===83?`<g class="garden-flower-details"><circle cx="550" cy="50" r="4.3"/>${Array.from({length:5},(_,i)=>`<path d="M550 47L550 38" transform="rotate(${i*72+8} 550 50)"/>`).join('')}</g>`:'';
    const flowerBase=piece.sourceId===83?'<g class="garden-flower-base"><path class="garden-flower-pedicel" d="M575 76C567 72 563 66 561 61"/><path class="garden-calyx" d="M556 56L554 63L559 62Q560 68 564 67L563 61L566 58L560 55L560 51Z"/></g>':'';
    const ties=piece.sourceId===73&&this.completed.has(82)?[120,312].map(y=>{
      const x=Number(vineNode(y).split(' ')[0]),pole=629+(y-46)*13/342;
      return `<g class="garden-tie"><path class="garden-tie-back" d="M${x-3} ${y}C${x-5} ${y-6} ${pole+6} ${y-7} ${pole+5} ${y}"/><path class="garden-tie-front" d="M${x-3} ${y}Q${x+4} ${y+7} ${(x+pole)/2} ${y+2}T${pole+5} ${y}"/><path class="garden-tie-tail" d="M${(x+pole)/2} ${y+2}q2 5-1 10m1-10 5 7"/></g>`;
    }).join(''):'';
    const curvePaths=(piece.sourceId===74?[joinedClosed(paths)]:paths).map(points=>{
      const d=piece.sourceId===74?silhouette:pathData(points);
      return `<path class="garden-focus-path" d="${d}"/><path class="garden-art-path" pathLength="1" d="${d}"/>`;
    }).join('');
    const morph=piece.sourceId===77&&done?`<path class="garden-cucumber-morph" data-garden-cucumber-morph d="${closedPathData(resampleClosed(joinedClosed(paths)))}"/>`:'';
    return `<g class="garden-piece garden-piece-${piece.className} ${done?'is-earned':'is-missing'}${piece.sourceId===this.revealSource?' is-new-piece':''}" role="button" tabindex="0" data-garden-piece="${piece.sourceId}" data-garden-build="${piece.sourceId}" data-complete="${done}" data-garden-complete="${done}" aria-label="${action} ${name}"><g class="garden-piece-art">${flowerBase}${fill}${curvePaths}${details}${ties}${morph}</g><g class="garden-piece-label" data-label-row="${top?'top':'bottom'}" aria-hidden="true"><rect x="${labelX}" y="${labelY}" width="0" height="0" rx="4"/><text x="${labelX}" y="${labelY}">${label}${done?'<tspan class="garden-piece-check" dx="4">&#10003;</tspan>':''}</text></g></g>`;
  }

  /** The outline and canonical body use the same piece box, including the reveal. */
  private alignCanonicalBody() {
    const svg=this.root.querySelector<SVGSVGElement>('.garden-canonical');
    const body=svg?.querySelector<SVGPathElement>('.garden-canonical-body');
    if(!svg||!body)return;
    // Work entirely within the artwork. Firefox's nested SVG screen matrix
    // includes a different viewport origin than its descendants' matrices.
    // Their quotient can move the complete cucumber outside the picture.
    let map=new DOMMatrix();
    for(let node:Element|null=body;node&&node!==svg;node=node.parentElement) {
      const transforms=(node as SVGGraphicsElement).transform?.baseVal;
      let local=new DOMMatrix();
      for(let i=0;i<(transforms?.numberOfItems??0);i++)local=local.multiply(transforms!.getItem(i).matrix);
      map=local.multiply(map);
    }
    const bounds=this.canonicalFrame;
    const a=new DOMPoint(bounds.x,bounds.y).matrixTransform(map);
    const b=new DOMPoint(bounds.x+bounds.width,bounds.y+bounds.height).matrixTransform(map);
    svg.setAttribute('viewBox',`${a.x} ${a.y} ${b.x-a.x} ${b.y-a.y}`);
  }

  private observeLabels() {
    const paper=this.root.querySelector<SVGSVGElement>('.garden-paper');
    if(!paper)return;
    const layout=()=>{
      const width=paper.getBoundingClientRect().width;
      if(!width)return;
      // The earned artwork and Revisit name already convey completion. Keep
      // the label names legible when the whole picture is compact.
      paper.classList.toggle('compact-labels',width<480);
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
      this.hitTest?.refresh();
    };
    this.labelObserver=new ResizeObserver(layout);this.labelObserver.observe(paper);layout();
  }

  private startReveal(version:number) {
    const shell=this.root.querySelector<HTMLElement>('.garden-shell');
    if(!shell)return;
    if(this.options.reduced()) {
      shell.classList.add('is-revealing','trace-complete');
      if(this.revealSource===77) {
        const points=this.canonicalBodyPoints();
        if(points)this.root.querySelector('[data-garden-cucumber-morph]')?.setAttribute('d',closedPathData(points));
        shell.classList.add('is-morphing','morph-complete','show-canonical');
      }
      this.revealMessage();
      this.completeReveal();
      return;
    }
    const paper=this.root.querySelector<SVGSVGElement>('.garden-paper')!,overlay=this.collection!;
    const closed=[74,75,77,83].includes(this.revealSource!);
    const sample=this.samples!.get(this.revealSource!)!;
    const fallback=fittedPaths(sample.paths,{...PIECES.find(piece=>piece.sourceId===this.revealSource)!,orientation:'horizontal',mirror:false,
      box:{x:innerWidth*.3,y:innerHeight*.3,width:innerWidth*.4,height:Math.min(180,innerHeight*.25)}});
    const original=this.origin?.paths??fallback;
    const origins=closed?[joinedClosed(original)]:original;
    // Carry the single crafted petal; its four decorative copies bloom with
    // the flower after arrival instead of crossing one another in transit.
    const targets=this.revealSource===83?this.collectionPaths.slice(0,1):this.collectionPaths;
    const paths=targets.map((target,index)=>({
      from:resampleLine(origins[index%origins.length]),to:resampleLine(target)
    }));
    overlay.innerHTML=paths.map(({from})=>`<path d="${collectionPath(from)}"/>`).join('');
    const strokes=Array.from(overlay.querySelectorAll('path'));
    let last:number|undefined,elapsed=0,placed=false;
    const animate=(time:number)=>{
      if(!this.active||version!==this.generation)return;
      // Preserve the visible journey after a slow frame or a backgrounded tab.
      // Wall-clock catch-up would make the picture and moving curve jump ahead.
      last??=time;elapsed+=Math.min(50,Math.max(0,time-last));last=time;
      const travel=ease((elapsed-200)/1100),arrival=ease((elapsed-100)/850);
      const matrix=paper.getScreenCTM();
      this.root.closest('dialog')?.style.setProperty('--garden-arrival',String(arrival));
      if(matrix)paths.forEach(({from,to},index)=>{
        strokes[index].setAttribute('d',collectionPath(to.map(([x,y],i)=>{
          const destination=new DOMPoint(x,y).matrixTransform(matrix);
          return [from[i][0]+(destination.x-from[i][0])*travel,from[i][1]+(destination.y-from[i][1])*travel];
        })));
      });
      // The same continuous outline travels first; colour and connected details
      // appear only when it settles. No whole-picture pop or second drop motion.
      overlay.style.color=travel>.5?'#e5d99f':this.origin?.color??'#668c3b';
      overlay.style.strokeWidth=String((this.origin?.width??3)*(1-travel)+1.6*travel);
      overlay.style.opacity=String((this.origin?1:ease(elapsed/180))*(1-ease((elapsed-1330)/300)));
      if(elapsed>=1300&&!placed) {
        placed=true;shell.classList.add('is-revealing','trace-complete');
        if(this.revealSource===77)this.morphCucumber(shell,version);else this.revealMessage();
      }
      if(elapsed<1700)this.frame=requestAnimationFrame(animate);
      else {this.frame=undefined;this.endCollection();this.hitTest?.refresh();this.completeReveal();}
    };
    this.frame=requestAnimationFrame(animate);
  }

  private endCollection() {
    this.collection?.remove();this.collection=undefined;
    const dialog=this.root.closest('dialog');
    dialog?.classList.remove('is-collecting');dialog?.style.removeProperty('--garden-arrival');
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
      shell.classList.add('morph-complete','show-canonical');this.revealMessage();this.completeReveal();
    },510);
  }

  private revealMessage() {
    const piece=PIECES.find(piece=>piece.sourceId===this.revealSource);
    this.say(this.completed.size===PIECES.length?'All eight curves gather into your finished garden.':`${piece?.name??'Your curve'} is in place. ${this.completed.size} of ${PIECES.length} picture curves built.`);
  }

  private completeReveal() {
    if(!this.active||this.revealReady||this.collection||this.revealTimer!==undefined)return;
    const animations=this.root.getAnimations({subtree:true}).filter(animation=>animation.playState==='running'||animation.pending);
    if(animations.length) {
      const version=this.generation;
      void Promise.allSettled(animations.map(animation=>animation.finished)).then(()=>{if(this.active&&version===this.generation)this.completeReveal();});
      return;
    }
    this.revealReady=true;
    const done=this.root.querySelector<HTMLButtonElement>('[data-garden-done]');if(done)done.disabled=false;
    this.options.onRevealComplete?.();
  }

  private say(message:string) {
    const status=this.root.querySelector<HTMLElement>('.garden-status');
    if(status)status.textContent=message;
  }

  private speckles() {
    return [[44,62],[79,328],[184,371],[300,83],[326,360],[516,70],[624,178],[688,344],[705,102],[559,376]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="1.8"/>`).join('');
  }

  private click=(event:MouseEvent)=>{
    const target=event.target as Element;
    const direct=event.detail===0||target.closest('.garden-piece-label');
    const source=direct?target.closest<SVGGElement>('[data-garden-build]'):target.closest('.garden-paper')?this.hitTest?.at(event.clientX,event.clientY):undefined;
    if(source&&this.root.contains(source)){this.activate(Number(source.dataset.gardenBuild));return;}
    const button=(event.target as Element).closest<HTMLButtonElement>('button');
    if(!button||!this.root.contains(button))return;
    if(button.hasAttribute('data-garden-retry')){void this.open(this.completed,this.revealSource);return;}
    if(button.hasAttribute('data-garden-done'))this.options.onFinish();
  };

  private point=(event:PointerEvent)=>{
    if(event.pointerType==='touch')return;
    const target=event.target as Element;
    const source=target.closest('.garden-piece-label')?.closest<SVGGElement>('[data-garden-piece]')
      ??(target.closest('.garden-paper')?this.hitTest?.at(event.clientX,event.clientY):undefined);
    if(source===this.pointed)return;
    this.clearPoint();this.pointed=source??undefined;
    this.pointed?.classList.add('is-pointed');
    this.root.querySelector('.garden-paper')?.classList.toggle('is-pointing',!!this.pointed);
  };

  private clearPoint=()=>{
    this.pointed?.classList.remove('is-pointed');this.pointed=undefined;
    this.root.querySelector('.garden-paper')?.classList.remove('is-pointing');
  };

  private keydown=(event:KeyboardEvent)=>{
    if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey)return;
    if(event.key==='Tab'&&this.active) {
      // Tab follows the two label rows, independently of SVG paint order.
      // Reordering the artwork would bring water details above the bank.
      const pieces=[...PIECES].sort((a,b)=>a.labelAt[1]-b.labelAt[1]||a.labelAt[0]-b.labelAt[0]);
      const controls=[this.root.closest('dialog')?.querySelector<HTMLElement>('#garden-back'),
        ...pieces.map(piece=>this.root.querySelector<SVGGElement>(`[data-garden-piece="${piece.sourceId}"]`)),
        this.root.querySelector<HTMLElement>('[data-garden-done]')].filter((control):control is HTMLElement|SVGGElement=>!!control&&!control.matches(':disabled'));
      const at=controls.indexOf(event.target as HTMLElement|SVGGElement);
      if(at>=0){event.preventDefault();controls[(at+(event.shiftKey?controls.length-1:1))%controls.length].focus({preventScroll:true});}
      return;
    }
    if(event.repeat||event.key!=='Enter'&&event.key!==' ')return;
    const source=(event.target as Element).closest<SVGGElement>('[data-garden-build]');
    if(!source||!this.root.contains(source))return;
    event.preventDefault();this.activate(Number(source.dataset.gardenBuild));
  };

  private activate(sourceId:number) {
    if(SOURCE_IDS.includes(sourceId as SourceId))this.options.onBuild?.(sourceId);
  }
}
