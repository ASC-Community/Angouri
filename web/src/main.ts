import './style.css';
import './play.css';
import './crop.css';
import { CropEditor, cropControl, cropEdited, updateCropVerdict, updateCropWindow, probePoints } from './crop';
import { renderBrand } from './brand';
import { Kernel } from './engine';
import { icon } from './icons';
import { adjacentSlot, insertedSlots, movedSlots, normalizeSlots, type RailSlots } from './rail';
import { sizeEquationTables } from './comparison-layout';
import { revealFocusRing, revealRailCell } from './scroll';
import { focusGameControl, guardArrivalFocus, installTabStops, navigateTablist, rememberFocus, restoreFocus } from './keyboard';
import { circleEdited, circleEquation, circleFlow, circleInput, circleRecipe, chooseCircleInspection, decorateCircleFlight, installCircleHandles, resetCircleInspection, sizeCircleControls, updateCircleProbe } from './circle';
import { ShapeNotes, chapterArt } from './notes';
import { puzzleHints, revealHintSpoiler } from './hints';
import { discoveryObservation, isDiscovery } from './discovery';
import { Garden } from './garden';
import { captureFlightGeometry,curveMorph,fadeFlightGeometry } from './edit-transition';
import { gardenOrigin } from './garden-collection';
import { installBlockTooltip } from './block-tooltip';
import { along, drawnPaths, flightPoints, flightStrokes, nearestIndex, strokePosition, sampledPosition, travelledPaths } from './geometry';
import { functionView, flow, cropFlowPath, cucumberPose, interpolate, launcherPose, operationTex, path, sizeFlightAnnotations, sizeFlowAnnotations, targetDescription, targetMark, targetStatus, tex, transform, updateFlowProbe, updateFlowCrop, flightView, type Camera, type Flight } from './views';
import { CHAPTERS, chapterIndex, CURVES, curveId, escape, EXTRA_PUZZLES, GEOMETRY_PUZZLES, MIXED_PUZZLES, OPTIONAL_PUZZLES, fraction, targetHeight, isCapstone, isCircleSource, isMastery, isPicture, LEVELS, OPS, PUZZLE_ORDER, puzzleLabel, type Action, type Artifact, type Circle, type Op, type Response, type Result, type State, type View } from './types';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
installTabStops();
const finishArrivalFocus=guardArrivalFocus();
for(const dialog of document.querySelectorAll<HTMLDialogElement>('dialog:not(#ideas-dialog):not(#garden-dialog)')) {
  const heading=dialog.querySelector(':scope > .dialog-top');if(!heading)continue;
  const body=document.createElement('div');body.className='dialog-content';
  // Opt out of implicit browser scroll-container stops. Reading pages retain
  // an explicit, named keyboard scroller; menu lists focus their own controls.
  const reading=dialog.id==='help-dialog'||dialog.id==='releases-dialog';
  body.tabIndex=-1;
  if(reading){body.classList.add('dialog-reading');body.setAttribute('role','region');body.setAttribute('aria-labelledby',dialog.getAttribute('aria-labelledby')!);}
  while(heading.nextSibling)body.append(heading.nextSibling);
  dialog.append(body);
}
for(const dialog of document.querySelectorAll<HTMLDialogElement>('dialog')) {
  const back=dialog.querySelector<HTMLElement>('.dialog-top button,[autofocus]');
  if(!back)continue;
  back.dataset.backShortcut='';back.setAttribute('aria-keyshortcuts','Backspace');
  const cap=document.createElement('kbd');cap.className='button-hotkey';cap.setAttribute('aria-hidden','true');cap.textContent='⌫';back.append(cap);
}
installBlockTooltip($('palette'));
const SAVE = 'angouri:vine:v1:progress', PREF = 'angouri:vine:v1:preferences', SEEDS = 'angouri:vine:v1:seeds';
const views: View[] = ['flight','function','flow'];
const clone = <T>(value: T): T => structuredClone(value);
let storageAvailable = true;
function read(key: string,maxLength=65536): unknown {
  let s: string | null;
  try { s = localStorage.getItem(key); }
  catch { storageAvailable=false; return undefined; }
  try {return s && s.length<=maxLength ? JSON.parse(s) : undefined;}catch{return undefined;}
}
function write(key: string, value: unknown) {
  let saved=true;
  try { localStorage.setItem(key,JSON.stringify(value)); }
  catch { storageAvailable=false;saved=false; }
  $('save-status').innerHTML = storageAvailable ? '<span class="status-dot"></span> Saved on this device' : 'Session only · Export to keep your progress';
  return saved;
}
const isView = (value: unknown): value is View => views.includes(value as View);
// Migrate the earlier view name without resetting existing recipes or preferences.
const canonicalView = (value: unknown) => value==='equations'?'function':value;
const preference = read(PREF) as {view?:unknown;motion?:unknown;characterShortcuts?:unknown} | undefined;
const preferredView=canonicalView(preference?.view);
let view: View = isView(preferredView) ? preferredView : 'flight';
let reduced = typeof preference?.motion==='boolean' ? preference.motion : matchMedia('(prefers-reduced-motion: reduce)').matches;
let characterShortcuts=preference?.characterShortcuts!==false;
let flight: Flight = {phase:'ready',position:0};
let throwWon=false;
let state: State | undefined, result: Result | undefined;
let camera: Camera = {min:-.8,max:5.2};
let defaultCamera: Camera = {...camera},fullCurve=false;
let insertionIndex: number | undefined, selectedStage = '', discoveryStage = '';
let probeIndex=40;
let flowScroll={left:0,top:0},resetFlowScroll=false;
let flightScroll={left:0,top:0};
let equationScroll=[{left:0,top:0},{left:0,top:0}];
const equationPanels=()=>[...$('scene').querySelectorAll<HTMLElement>('.final-equation,.value-table tbody')];
function rememberEquationScroll(){const panels=equationPanels();if(panels.length)equationScroll=panels.map(el=>({left:el.scrollLeft,top:el.scrollTop}));}
type Snapshot={state:State;slots:RailSlots};
let railSlots:RailSlots=[];
let undo: Snapshot[] = [], redo: Snapshot[] = [];
let completed = new Set<number>();
const introStage=()=>state?.mode==='puzzle'&&[1,2].includes(state.sourceId)?state.sourceId:0;
const introActive=()=>introStage()>0;
const choiceActive=()=>!!state&&state.mode!=='remix'&&!state.circle&&!state.station&&state.limit===1;
const displayedView=():View=>introActive()?'flight':view;
const stepLabel=(id:number)=>{const levels=CHAPTERS[chapterIndex(id)].levels;return `${levels.indexOf(id)+1} OF ${levels.length}`;};
const followingPuzzle=(sourceId:number)=>{const order=PUZZLE_ORDER.includes(sourceId)?PUZZLE_ORDER:GEOMETRY_PUZZLES.includes(sourceId)?GEOMETRY_PUZZLES:MIXED_PUZZLES.includes(sourceId)?MIXED_PUZZLES:EXTRA_PUZZLES;return order[order.indexOf(sourceId)+1];};
const hintOrders=new Set<string>();
let hintOffered=false,hintCue=false;
let hintBlockSet='',bestTargetHits=-1,unsuccessfulRevisions=0;
let initialized = false, pending = 0;
let chain = Promise.resolve();
let notice = {text:'Tap or drag a block.',kind:''};
let morphFrame=0, displayedPoints: Result['points'] | undefined,displayedSlope:number|undefined;
let clearCurveFade:(()=>void)|undefined,clearCurveEnds:(()=>void)|undefined;
function cancelCurveChange(settle=false) {
  cancelAnimationFrame(morphFrame);clearCurveFade?.();clearCurveFade=undefined;clearCurveEnds?.();clearCurveEnds=undefined;
  displayedPoints=undefined;displayedSlope=undefined;delete $('scene').dataset.curveTransition;
  if(settle&&state&&result&&displayedView()==='flight'){paintTrajectory(result.points);animatePosition();}
}
interface Seed { name: string; artifact: Artifact; snapshot?:Snapshot; view?:View; savedAt?:string }
interface DeletedSeed extends Seed { deletedAt:string; deletedIndex:number }
const seedStorageLimit=1024*1024;
const storedSeeds = read(SEEDS,seedStorageLimit);
const libraryEntries:(Seed|DeletedSeed)[]=Array.isArray(storedSeeds)?storedSeeds.filter((s):s is Seed=>!!s&&typeof s.name==='string'&&s.name.length<=60&&s.artifact?.type==='creation'):[];
const isDeletedSeed=(seed:Seed|DeletedSeed):seed is DeletedSeed=>'deletedAt' in seed&&typeof seed.deletedAt==='string';
let seeds:Seed[]=libraryEntries.filter(seed=>!isDeletedSeed(seed)).slice(0,12);
let deletedSeeds:DeletedSeed[]=libraryEntries.filter(isDeletedSeed);
// One write keeps removal and its recovery copy atomic, retaining old arrays.
function writeLibrary(next:Seed[],deleted=deletedSeeds) {
  const entries=[...next,...deleted];
  return JSON.stringify(entries).length<=seedStorageLimit&&write(SEEDS,entries);
}
const kernel = new Kernel((message)=> { notice={text:message,kind:'error'}; showNotice(); });
const shapeNotes = new ShapeNotes(kernel);
const garden = new Garden($('garden-content'),kernel,{reduced:()=>reduced,onFinish:()=>$('garden-back').click(),onBuild:(id:number)=>goToPuzzle(id)});
const circleCommit=(circle:Circle)=>serial(async()=>accept(await kernel.run(state,{type:'circle',...circle})),true);
const cancelCirclePickup=installCircleHandles($('scene'),()=>state?.circle&&result?.circle&&pending===0&&!['flying','releasing'].includes(flight.phase)?{state,result,camera}:undefined,circleCommit,async(snapshot,circle)=>{const reply=await kernel.run(snapshot,{type:'circle',...circle});return reply.status==='ok'?reply.result:undefined;});
let cropPlayback:{flight:Flight;won:boolean}|undefined;
let pictureCelebrated=false;
const cropEditor=new CropEditor($('construction'),()=>state&&result&&pending===0&&!['flying','releasing'].includes(flight.phase)?{state,result}:undefined,
  (snapshot,crop)=>kernel.run(snapshot,{type:'crop',...crop}),
  preview=>{
    cancelCurveChange(true);
    $('scene').removeAttribute('data-crop-pending');
    cropPlayback??={flight:{...flight},won:throwWon};flight={phase:'ready',position:0};throwWon=false;result=preview;
    if(displayedView()==='flight'){
      paintTrajectory(preview.points);
      updateCropWindow($('scene'),preview.crop!,x=>transform(state!,camera,[x,0])[0]);
    }
    else if(displayedView()==='function'){rememberEquationScroll();renderScene();}
    else {
      $('scene').querySelector('.crop-machine .flow-curve')?.setAttribute('d',cropFlowPath(preview));
      updateFlowCrop($('scene'),preview,preview.crop!);
      updateFlowProbe($('scene'),state!,preview,probeIndex);
    }
    preview.checkpoints.forEach((checkpoint,i)=>document.querySelectorAll<HTMLElement>(`[data-target="${i}"]`).forEach(el=>{
      const match=checkpoint.hit?'hit':'miss',changed=el.dataset.match!==match;
      el.dataset.match=match;el.dataset.status='waiting';el.classList.remove('hit','miss','just-hit');el.classList.add('waiting');
      el.setAttribute('aria-label',targetDescription(checkpoint,i,'waiting'));
      const mark=el.querySelector('.target-result');if(mark&&changed)mark.innerHTML=targetMark(match);
    }));
    $('scene').querySelectorAll<HTMLElement>('.target-label').forEach((label,i)=>label.dataset.match=preview.checkpoints[i].hit?'hit':'miss');
    updateCropVerdict($('scene'),preview);
    updatePrimary();animatePosition();
  },
  (crop,previewed)=>{
    cropPlayback=undefined;
    return perform({type:'crop',...crop},'push',undefined,!previewed).then(async ok=>{
      if(ok)return;
      const rejectedNotice=notice;
      await perform({type:'evaluate'},'keep');
      notice=rejectedNotice;showNotice();
    });
  },
  accepted=>{result=accepted;if(cropPlayback){flight=cropPlayback.flight;throwWon=cropPlayback.won;cropPlayback=undefined;}render();},
  (crop,base)=>{
    cancelCurveChange(true);
    cropPlayback??={flight:{...flight},won:throwWon};flight={phase:'ready',position:0};throwWon=false;updatePrimary();animatePosition();
    $('scene').dataset.cropPending='true';
    if(displayedView()==='flow')updateFlowCrop($('scene'),base,{...base.crop!,...crop},true);
    if(displayedView()!=='flight')return;
    updateCropWindow($('scene'),crop,x=>transform(state!,camera,[x,0])[0]);
    if(base.relation)return;
    // A domain drag changes visibility, not the underlying equation. Clip the
    // already acknowledged kernel geometry immediately, without evaluating it.
    const stage=base.stages.at(-1)!,from=fraction(crop.from),to=fraction(crop.to),left=transform(state!,camera,[from,0])[0],right=transform(state!,camera,[to,0])[0];
    $('trajectory')?.setAttribute('d',(stage.paths??[{points:stage.points}]).map(p=>path(p.points,state!,camera)).join(' '));
    const clip=$('scene').querySelector('#crop-preview-clip rect');clip?.setAttribute('x',String(left));clip?.setAttribute('width',String(right-left));
    const origin=along(stage.points,from),before=along(stage.points,Math.max(stage.points[0][0],from-.025)),after=along(stage.points,Math.min(stage.points.at(-1)![0],from+.025));
    const pose=launcherPose(state!,camera,origin,[after[0]-before[0],after[1]-before[1]]),[cx,cy]=transform(state!,camera,origin),fruit=cucumberPose([cx,cy],pose.angle,1);
    $('launcher')?.setAttribute('transform',pose.transform);$('launcher-front')?.setAttribute('transform',pose.transform);
    $('cucumber')?.setAttribute('transform',fruit.transform);
    $('flight-spin')?.setAttribute('transform',`rotate(${fruit.degrees})`);
  });

function preferences() { write(PREF,{view,motion:reduced,characterShortcuts}); }
function progress() { if(state) write(SAVE,{schema:1,type:'save',state,slots:railSlots,completed:[...completed],view,entry:location.hash.slice(0,8192)}); }
let feedbackContent:string|undefined;
function showNotice() {
  $('feedback').className=`feedback ${notice.kind}`;
  const finding=state&&result&&notice.kind!=='error'?discoveryObservation(state,result,discoveryStage):'';
  $('feedback').classList.toggle('discovery-feedback',!!finding);
  const content=finding||`${notice.kind==='error'?'':icon('hand',16)}<span>${escape(notice.text)}</span>`;
  if(content!==feedbackContent){$('feedback').innerHTML=content;feedbackContent=content;}
  const hints=!!state&&state.mode==='puzzle'&&!introActive()&&!isDiscovery(state)&&!throwWon;
  $('hints-open').hidden=!hints;
  const reserveGuidance=introActive()&&throwWon&&notice.kind!=='error';
  $('recipe-guidance').style.visibility=reserveGuidance?'hidden':'';
  $('recipe-guidance').inert=reserveGuidance;
  $('recipe-guidance').setAttribute('aria-hidden',String(reserveGuidance));
  $('feedback').hidden=!(finding||notice.text)||(throwWon&&!reserveGuidance&&notice.kind!=='error')||(hints&&notice.text==='Tap or drag a block.'&&notice.kind!=='error');
  $('recipe-guidance').hidden=$('feedback').hidden&&!hints;
}
function error(message: string) { notice={text:message,kind:'error'}; showNotice(); }
function serial<T>(work: ()=>Promise<T>,retainCirclePreview=false): Promise<T | undefined> {
  cropEditor.cancel();
  if(!retainCirclePreview)cancelCirclePickup();
  pending++; $('playground').setAttribute('aria-busy','true');updatePrimary();
  const task=chain.then(work);
  chain=task.then(()=>{},e=>error(e instanceof Error ? e.message : String(e))).finally(()=>{
    pending--; $('playground').setAttribute('aria-busy',String(!initialized||pending>0));updatePrimary();
  });
  return task.catch(()=>undefined);
}
function requireOk(reply: Response): asserts reply is Response & {state: State; result: Result} {
  if(reply.status!=='ok' || !reply.state || !reply.result) throw new Error(reply.message || 'This move could not be accepted. Your previous recipe is safe.');
}
function updateHintCue(history:'push'|'keep'|'clear') {
  if(!state||!result||state.mode!=='puzzle'||introActive()||isDiscovery(state)||hintOffered)return false;
  const order=state.nodes.map(node=>node.op).join(''),blockSet=[...order].sort().join('');
  const hits=result.checkpoints.filter(c=>c.hit).length;
  if(blockSet!==hintBlockSet) {hintBlockSet=blockSet;hintOrders.clear();bestTargetHits=-1;unsuccessfulRevisions=0;}
  // Count accepted new orderings, not building, empty-slot moves or Undo/Redo.
  if(hits>bestTargetHits||result.solved)unsuccessfulRevisions=0;
  else if(history==='push'&&!hintOrders.has(order))unsuccessfulRevisions++;
  hintOrders.add(order);bestTargetHits=Math.max(bestTargetHits,hits);
  if(unsuccessfulRevisions<3)return false;
  hintOffered=true;hintCue=true;return true;
}
type CellMove={from:number;to:number};
function accept(reply: Response, history: 'push'|'keep'|'clear' = 'push',slots?:RailSlots,requestedView?:View,animateCurve=true,editedId?:string,emptySelection?:number,completeSelection=false,move?:CellMove) {
  requireOk(reply);
  const firstArrival=!state;
  const previousState=state,previousResult=result,previousPoints=displayedPoints||result?.points,previousSlope=displayedSlope??result?.startSlope,previousProbeX=result?probePoints(result)[probeIndex]?.[0]:undefined;
  const previousVisual=animateCurve&&!reduced&&!state?.circle&&displayedView()==='flight'?captureFlightGeometry($('scene')):undefined;
  const previousScroll=$('construction').querySelector('.pipeline')?.scrollLeft||0;
  const previousSlots=[...railSlots];
  const previousRects=new Map([...document.querySelectorAll<HTMLElement>('.recipe-part')].map(el=>[el.dataset.part!,el.querySelector('.recipe-face')!.getBoundingClientRect()]));
  const movingEmpty=move&&previousSlots[move.from]===null?document.querySelector<HTMLElement>(`[data-empty="${move.from}"]`):undefined;
  let emptyRect=movingEmpty?.querySelector('.empty-face')?.getBoundingClientRect();
  const changed=state && JSON.stringify(state)!==JSON.stringify(reply.state);
  const nextSlots=normalizeSlots(reply.state,history==='clear'?slots:slots||railSlots);
  const layoutChanged=JSON.stringify(nextSlots)!==JSON.stringify(railSlots);
  const previewChanged=result?.crop?.from!==reply.result.crop?.from||result?.crop?.to!==reply.result.crop?.to;
  // Blur can report a field that Enter already committed. Replacing controls
  // for that no-op can swallow typing in the next field. A crop can return to
  // its starting bounds while an earlier preview is still displayed, though.
  if(state&&!changed&&!layoutChanged&&!previewChanged&&history!=='clear'&&!requestedView&&!(emptySelection!==undefined&&emptySelection!==insertionIndex)&&!(completeSelection&&(selectedStage||insertionIndex!==undefined))) {
    // Indistinguishable holes do not change the construction or its history,
    // but the focused empty piece still travels to the chosen position.
    if(move&&emptyRect) {
      movingEmpty?.getAnimations({subtree:true}).forEach(animation=>animation.cancel());
      const destination=document.querySelector<HTMLElement>(`[data-empty="${move.to}"]`)!;
      destination.getAnimations({subtree:true}).forEach(animation=>animation.cancel());
      focusEmpty(move.to);revealFocusRing(destination);
      const delta=($('construction').querySelector('.pipeline')?.scrollLeft||0)-previousScroll;
      slideCell(destination,new DOMRect(emptyRect.x-delta,emptyRect.y,emptyRect.width,emptyRect.height),completeSelection);
      fadeEmpty(movingEmpty);
    }
    return true as const;
  }
  if(history==='clear') {
    undo=[];redo=[];resetFlowScroll=true;
    $('construction').querySelectorAll<HTMLElement>('.pipeline,.rail-slots').forEach(rail=>rail.scrollLeft=0);
  }
  else if(history==='push'&&state&&(changed||layoutChanged)) {undo.push({state:clone(state),slots:[...railSlots]}); if(undo.length>100)undo.shift(); redo=[];}
  const newSource=!state||state.sourceId!==reply.state.sourceId||state.mode!==reply.state.mode;
  if(newSource||history==='clear') {hintOrders.clear();hintOffered=false;hintCue=false;hintBlockSet='';bestTargetHits=-1;unsuccessfulRevisions=0;pictureCelebrated=false;}
  if(firstArrival)finishArrivalFocus();
  state=reply.state;result=reply.result;railSlots=nextSlots;initialized=true;
  const added=state.nodes.find(node=>!previousState?.nodes.some(before=>before.id===node.id));
  if(newSource||history==='clear')discoveryStage='';
  // Follow the accepted insertion/move without changing editor selection or
  // focus. A cancelled/rejected pickup never changes the finding.
  const observed=editedId??added?.id??discoveryStage;
  discoveryStage=state.nodes.some(node=>node.id===observed&&node.id!==state!.station?.id)?observed:'';
  if(requestedView&&!introActive())view=requestedView;
  const offeredHint=updateHintCue(history);
  const previousOrder=previousState?.nodes.map(node=>node.op).join('')||'',order=state.nodes.map(node=>node.op).join('');
  const repeatHint=hintCue&&!offeredHint&&history==='push'&&previousOrder!==order&&[...previousOrder].sort().join('')===[...order].sort().join('');
  $('playground').setAttribute('aria-busy',String(pending>0));
  if(newSource) {
    selectedStage='';resetCircleInspection();
    const guide=result.heightGuide;
    probeIndex=Math.floor(probePoints(result).length/2);
    if(guide) {
      const from=fraction(guide.fromX),to=fraction(guide.toX),middle=probePoints(result)[probeIndex][0];
      // Keep the central feature in view; an evenly placed pair keeps the midpoint.
      const position=chapterIndex(state.sourceId)===0?from:Math.abs(from-middle)===Math.abs(to-middle)?middle:Math.abs(from-middle)<Math.abs(to-middle)?from:to;
      probeIndex=nearestIndex(probePoints(result),position);
    }
  }
  if(!newSource&&previousProbeX!==undefined&&!state.circle)probeIndex=nearestIndex(probePoints(result),previousProbeX);
  if(changed||newSource||history==='clear') {
    flight={phase:'ready',position:0};throwWon=false;
    if(result.circle||result.relation) {
      // Geometry edits keep their frame. Refitting on every radius change made
      // the centre and targets appear to move even though their values did not.
      if(newSource||history==='clear'||!previousResult?.circle&&!previousResult?.relation) {
        fullCurve=false;camera=fittedCamera(state.mode!=='remix');defaultCamera={...camera};
      } else if(fullCurve)camera=fittedCamera();
    } else if(hasTargetFrame()) {
      // Later wave/step puzzles need their landmarks to remain legible while
      // an unfinished input may be much taller than the intended output.
      if(newSource||history==='clear') {fullCurve=false;camera=fittedCamera(true);defaultCamera={...camera};}
      else if(fullCurve)camera=fittedCamera();
    } else if(newSource||history==='clear'||!result.crop) {
      const [baseMin,baseMax]=LEVELS[state.sourceId-1].y;
      const ys=[...result.points.map(p=>p[1]),...result.checkpoints.map(targetHeight)];
      const min=Math.min(0,baseMin,...ys),max=Math.max(0,baseMax,...ys),padding=Math.max((max-min)*.12,.6);
      camera={min:min<baseMin?min-padding:baseMin,max:max>baseMax?max+padding:baseMax};
    }
  }
  if(completeSelection||!result.stages.some(s=>s.id===selectedStage)) selectedStage='';
  insertionIndex=completeSelection?undefined:emptySelection;
  notice={text:result.relation&&!result.relation.playback.length?'No real heights yet. Bring the right side to zero or above.':state.circle?'':state.nodes.length?'':choiceActive()?'Choose a block.':'Tap or drag a block.',kind:''};
  progress();render(move&&(completeSelection||movingEmpty)?move.to:emptySelection);
  if(repeatHint&&hintCue)for(const animation of $('hints-open').getAnimations()) {
    if(animation instanceof CSSAnimation&&animation.animationName==='hint-invite')animation.currentTime=0;
  }
  if(added&&!newSource) {
    const previousStock=(previousState!.inventory[added.op]||0)-previousState!.nodes.filter(node=>node.op===added.op).length;
    if(history!=='clear'&&!reduced&&(state.mode==='remix'||previousStock>3))
      document.querySelector(`[data-op="${added.op}"]`)?.closest('.ingredient-stack')?.classList.add('refilling');
    const index=railSlots.indexOf(added.id),reveal=state.mode==='remix'&&index===railSlots.length-2?index+1:index;
    revealRailCell(document.querySelector<HTMLElement>(`[data-cell="${reveal}"]`));
  }
  // Reveal the settled destination before starting the slide. Measuring the
  // travelling block afterward can scroll back toward its departing slot.
  if(document.activeElement instanceof HTMLElement&&document.activeElement.closest('#construction'))revealFocusRing(document.activeElement);
  const scrollDelta=($('construction').querySelector('.pipeline')?.scrollLeft||0)-previousScroll;
  if(scrollDelta)previousRects.forEach((r,id)=>previousRects.set(id,new DOMRect(r.x-scrollDelta,r.y,r.width,r.height)));
  if(scrollDelta&&emptyRect)emptyRect=new DOMRect(emptyRect.x-scrollDelta,emptyRect.y,emptyRect.width,emptyRect.height);
  if((changed||layoutChanged||move)&&!newSource&&previousState&&previousResult&&previousPoints) {
    const moved=state.nodes.find(node=>node.id===editedId);
    $('move-announcement').textContent=state.circle?`Centre ${state.circle.x}, ${state.circle.y}. Radius ${state.circle.radius}. ${result.checkpoints.filter(c=>c.hit).length} targets match.`:changed?`${state.nodes.map(n=>OPS[n.op].name).join(', ')||'Recipe cleared'}. Ready to throw.`:moved?`${OPS[moved.op].name} moved to slot ${railSlots.indexOf(moved.id)+1}.`:'Empty slot moved.';
    animateChange(previousState,previousResult,previousPoints,previousRects,previousSlots,previousSlope!,previousVisual,move,emptyRect,completeSelection);
  }
  if(offeredHint)$('move-announcement').textContent+=' Hints can help with this puzzle.';
  return true as const;
}
function perform(action: Action, history: 'push'|'keep'|'clear'='push',slots?:RailSlots,animateCurve=true) { return serial(async()=>accept(await kernel.run(state,action),history,slots,undefined,animateCurve,typeof action.id==='string'?action.id:undefined)); }
function historyMove(back: boolean) {
  return serial(async()=> {
    const source=back?undo:redo, target=source.at(-1);
    if(!target||!state)return;
    const reply=await kernel.run(target.state,{type:'evaluate'});requireOk(reply);
    (back?redo:undo).push({state:clone(state),slots:[...railSlots]});source.pop();accept(reply,'keep',target.slots);
  });
}
function cue(op: Op) {
  if(op==='D')return chapterArt(chapterIndex(32)).replace('<svg ','<svg class="ingredient-cue" ');
  if(op==='I')return chapterArt(chapterIndex(37)).replace('<svg ','<svg class="ingredient-cue" ');
  if(op==='S')return chapterArt(chapterIndex(50)).replace('<svg ','<svg class="ingredient-cue" ');
  if(op==='F'||op==='C')return `<svg class="ingredient-cue" viewBox="0 0 36 36" aria-hidden="true"><path d="M2 30H34" stroke="currentColor" opacity=".2"/><path class="cue-before" d="M3 30L33 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 3" opacity=".45"/><path class="cue-after" d="${op==='F'?'M3 30H13M13 21H23M23 12H33':'M3 21H13M13 12H23M23 3H33'}" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/></svg>`;
  if(op==='Q')return `<svg class="ingredient-cue" viewBox="0 0 36 36" aria-hidden="true"><path d="M2 19H34" stroke="currentColor" opacity=".2"/><path d="M3 32L33 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 3" opacity=".45"/><path d="M3 5Q18 33 33 5" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/></svg>`;
  const transformed: Record<Exclude<Op,'Q'|'D'|'I'|'S'|'F'|'C'>,string>={H:'M3 26Q17 14 33 26',A:'M3 15Q17 0 33 15',N:'M3 19Q17 34 33 19'};
  return `<svg class="ingredient-cue" viewBox="0 0 36 36" aria-hidden="true"><path d="M3 27Q17 1 33 27" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 3" opacity=".4"/><path d="${transformed[op]}" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/></svg>`;
}
function palette() {
  if(state?.circle){$('palette').innerHTML='';$('palette').dataset.count='0';delete $('palette').dataset.choices;return;}
  const choosing=choiceActive();
  const creating=state?.mode==='remix',inventory=creating?{H:1,A:1,N:1,Q:1,D:1,I:1,S:1,F:1,C:1}:state?.inventory || {H:1,A:1};
  const available=(Object.keys(OPS) as Op[]).filter(op=>(inventory[op]||0)>0);
  $('palette').setAttribute('role','group');
  $('palette').setAttribute('aria-label',choosing?'Choose a block':'Add a block to your recipe');
  $('palette').dataset.count=String(Object.values(inventory).filter(n=>n>0).length);
  // Reserve the whole pile, including a return above condensed or reusable stock.
  $('palette').style.setProperty('--stack-room',String(choosing?0:creating?3:Math.max(0,Math.min(3,Math.max(0,...Object.values(inventory))-1))));
  // A choice changes selection, not the controls themselves. Keeping the same
  // buttons preserves Safari's pointer/pressed state and avoids a hover restart.
  const choices=choosing?available.join(''):undefined;
  if(choices&&$('palette').dataset.choices===choices) {
    for(const button of $('palette').querySelectorAll<HTMLButtonElement>('[data-op]')) {
      button.disabled=!initialized;
      button.setAttribute('aria-pressed',String(state?.nodes[0]?.op===button.dataset.op));
    }
    return;
  }
  if(choices)$('palette').dataset.choices=choices;else delete $('palette').dataset.choices;
  $('palette').innerHTML=available.map((op,shortcutIndex)=>{
    const n=choosing?1:inventory[op]!;
    const used=creating||choosing?0:state?.nodes.filter(node=>node.op===op).length || 0;
    const returning=state?.nodes.find(node=>node.id===(drag?.id||selectedStage)&&node.op===op);
    const availability=choosing?'ready':used>=n?'used':!creating&&(state?.nodes.length||0)>=(state?.limit||1)?'full':'ready';
    const disabled=!initialized||availability!=='ready'&&!returning;
    const title=choosing?OPS[op].description:returning?'Return the selected block to this stack':availability==='used'?'All copies are in your recipe':availability==='full'?'Recipe full — return a block or Undo':`${OPS[op].description} Tap to add, or drag to a recipe slot.`;
    const remaining=n-used,visibleLayers=creating?3:Math.min(remaining,3);
    const layers=visibleLayers+(returning?1:0),capacity=creating?3:Math.max(0,Math.min(n-1,3)),condensed=!creating&&n>3;
    return `<div class="ingredient-stack ${OPS[op].color} ${creating?'reusable-stack':''} ${condensed?'condensed-stack':''} ${creating||remaining>3?'has-more-stock':''}" style="--stack-capacity:${capacity};--stack-depth:${Math.max(0,layers-1)};--return-layer:${returning?1:0}"><span class="stock-deck" aria-hidden="true">${Array.from({length:Math.max(0,layers-1)},(_,i)=>`<i style="--layer:${i+1}"></i>`).join('')}</span><button class="ingredient ${OPS[op].color} ${returning?'return-ready':''}" data-op="${op}" data-shortcut="${shortcutIndex+1}" ${returning?`data-return="${returning.id}"`:''} data-availability="${availability}" data-stock="${creating?'reusable':remaining}" draggable="false" ${disabled?'disabled':''} ${choosing?`aria-pressed="${state?.nodes[0]?.op===op}"`:''} aria-label="${choosing?'Choose '+OPS[op].name:returning?'Return selected '+OPS[op].name+', '+(creating?'reusable stack':`${remaining} available below`):'Place '+OPS[op].name+' block, '+(creating?'reusable':`${remaining} available`)}" ${!choosing&&!returning?'aria-describedby="deck-keyboard-help"':''} aria-keyshortcuts="${[!choosing&&!returning?'ArrowUp Space':'Space',characterShortcuts?String(shortcutIndex+1):''].filter(Boolean).join(' ')}" data-block-name="${OPS[op].name}" data-block-help="${escape(title)}"><span class="ingredient-surface"><span class="piece-grip">${icon(returning?'return':disabled?availability==='used'?'check':'lock':'grip',16)}</span><span class="ingredient-face"><span class="op-formula">${operationTex(op)}</span></span>${cue(op)}<kbd class="button-hotkey" data-character aria-hidden="true">${shortcutIndex+1}</kbd></span></button>${creating||remaining>3?`<span class="${creating?'reusable-mark':'stock-total'}" aria-hidden="true">${tex(creating?'\\infty':String(remaining))}</span>`:''}</div>`;
  }).join('');
}
function recipe() {
  if(!state||!result)return;
  if(state.circle){$('construction').innerHTML=circleRecipe(state,result);return;}
  const previousScroll=$('construction').querySelector('.pipeline')?.scrollLeft||0;
  const zoneScrolls=[...$('construction').querySelectorAll<HTMLElement>('.rail-slots')].map(zone=>zone.scrollLeft);
  $('construction').classList.toggle('has-selection',!!selectedStage||insertionIndex!==undefined);
  const cells=railSlots.map((id,index)=>{
    if(id===state!.station?.id)return '';
    if(!id)return `<button class="empty-slot insert-slot ${insertionIndex===index?'selected':''}" data-cell="${index}" data-empty="${index}" data-insert="${index}" draggable="false" aria-label="${selectedStage?'Move selected block to':'Empty'} slot ${index+1}" aria-pressed="${insertionIndex===index}" aria-describedby="empty-keyboard-help" aria-keyshortcuts="Space ArrowLeft ArrowRight${adjacentSlot(railSlots,state!,index,-1)!==index?' Backspace':''}" title="Choose a block for this slot, or drag the empty slot to reposition it"><span class="empty-face"><span class="piece-grip">${icon('grip',12)}</span>${icon('plus',18)}</span></button>`;
    const node=state!.nodes.find(n=>n.id===id)!,receiving=selectedStage&&selectedStage!==id||insertionIndex!==undefined;
    return `<div class="recipe-part ${OPS[node.op].color} ${selectedStage===node.id?'inspected':''} ${receiving?'receiving-cell':''}" data-cell="${index}" data-part="${node.id}" draggable="false"><button class="part-body" data-stage="${node.id}" aria-label="${receiving?'Move selection to slot '+(index+1):OPS[node.op].name+', slot '+(index+1)}" aria-pressed="${selectedStage===node.id}" aria-describedby="block-keyboard-help" aria-keyshortcuts="Space ArrowLeft ArrowRight ArrowDown Backspace" title="${receiving?'Move selection here':OPS[node.op].name+' · drag to move, drag off the recipe to return'}"><span class="recipe-face"><span class="piece-grip">${icon('grip',14)}</span><span class="part-formula">${operationTex(node.op)}</span></span></button></div>`;
  });
  const source=state.mode==='remix'?`<button id="source-choose" class="source-choice" aria-label="Change starting curve" aria-haspopup="dialog" aria-controls="curves-dialog" title="Change starting curve">${tex((result.relation?'h^2 = ':'h = ')+result.stages[0].latex)}<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4 3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button>`:tex((result.relation?'h^2 = ':'h = ')+result.stages[0].latex);
  const station=state.station;
  const machine=station?`<div class="fixed-station ${OPS[station.op].color}" role="img" aria-label="Fixed ${OPS[station.op].name} station. ${station.before&&station.after?'Blocks can go before or after it.':station.before?'Blocks go before it.':'Blocks go after it.'}"><span class="station-foundation" aria-hidden="true"></span><span class="station-surface"><span class="station-title">${OPS[station.op].name}</span>${operationTex(station.op)}<span class="station-mounts" aria-hidden="true"></span></span></div>`:'';
  const rail=station?`${station.before?`<div class="rail-zone" role="group" aria-label="Before the station"><span class="rail-zone-label">Input</span><div class="rail-slots">${cells.slice(0,station.before).join('')}</div></div>`:''}${machine}${station.after?`<div class="rail-zone" role="group" aria-label="After the station"><span class="rail-zone-label">Output</span><div class="rail-slots">${cells.slice(station.before+1).join('')}</div></div>`:''}`:cells.join('');
  $('construction').innerHTML=`<div class="pipeline ${station?'station-pipeline':''} ${state.mode==='remix'||state.inventory.S?'wide-pieces':''}" role="group" aria-label="${state.mode==='remix'?'Recipe with reusable blocks':station?'Recipe with a fixed transformation station':`Recipe, ${state.nodes.length} of ${state.limit} slots filled`}"><div class="source-part" aria-label="Starting curve"><span class="source-label">Start</span>${source}</div>${rail}${cropControl(state,result)}</div>`;
  $('construction').querySelector('.pipeline')!.scrollLeft=previousScroll;
  $('construction').querySelectorAll<HTMLElement>('.rail-slots').forEach((zone,i)=>zone.scrollLeft=zoneScrolls[i]||0);
}
let levelMenuKey='';
function renderLevels() {
  if(!state)return;
  const key=`${state.mode}:${state.sourceId}:${[...completed].join(',')}`;
  if(key===levelMenuKey)return;
  levelMenuKey=key;
  const option=(id:number)=>{
    const level=LEVELS[id-1],current=state!.mode==='puzzle'&&state!.sourceId===id;
    const challenge=isMastery(id)?id===PUZZLE_ORDER.at(-1)?'Final mastery':'Mastery challenge':isPicture(id)?'Picture piece':isCapstone(id)?'Chapter challenge':'';
    return `<button class="level-option ${current?'current':''}" data-level="${id}" aria-label="Puzzle ${puzzleLabel(id)}: ${level.name}${challenge?', '+challenge:''}${completed.has(id)?', completed':''}" ${current?'aria-current="step"':''}><span class="level-number">${puzzleLabel(id)}</span><span>${level.name}${challenge?`<small class="challenge-label">${icon(isMastery(id)?'mastery':isPicture(id)?'picture':'flag',12)}${challenge}</small>`:''}</span><span class="level-completion" aria-hidden="true">${icon(completed.has(id)?'check':current?'target':'arrow',20)}</span></button>`;
  };
  const currentChapter=chapterIndex(state.sourceId);
  $('level-nav').innerHTML=CHAPTERS.map((chapter,i)=>`<details class="chapter-group" name="chapters" ${i===Math.max(0,currentChapter)?'open':''}><summary><span class="chapter-art ${chapter.color}">${chapterArt(i)}</span><span><small>Chapter ${i+1}</small>${i===9?`<button type="button" id="menu-picture-open" class="note-view-button" data-open-garden aria-haspopup="dialog" aria-controls="garden-dialog">${icon('picture',14)}${chapter.name}</button>`:`<strong>${chapter.name}</strong>`}</span><span class="chapter-progress" aria-label="${chapter.levels.filter(id=>completed.has(id)).length} of ${chapter.levels.length} puzzles complete">${chapter.levels.filter(id=>completed.has(id)).length} / ${chapter.levels.length}</span>${icon('arrow',16)}</summary><div class="chapter-levels">${chapter.levels.map(option).join('')}</div></details>`).join('');
  $('level-nav').insertAdjacentHTML('beforeend',`<details class="chapter-group extra-puzzles" name="chapters" ${currentChapter<0?'open':''}><summary><span class="chapter-art neutral">${icon('puzzles',28)}</span><span><small>Optional collection</small><strong>More shape puzzles</strong></span>${icon('arrow',16)}</summary><div class="chapter-levels">${OPTIONAL_PUZZLES.map(id=>`<button class="level-option" data-level="${id}" ${state!.sourceId===id?'aria-current="step"':''}><span class="level-number">${icon(completed.has(id)?'check':'blocks',18)}</span><span>${LEVELS[id-1].name}</span>${icon('arrow',18)}</button>`).join('')}</div></details>`);
  $<HTMLButtonElement>('puzzles-open').disabled=false;
}
function renderCurves() {
  const option=(curve:typeof CURVES[number])=>{
    const current=curve.id===curveId(state!.sourceId);
    return `<button class="curve-option ${current?'current':''}" data-source="${curve.id}" aria-pressed="${current}"><svg class="curve-thumbnail" viewBox="0 0 36 36" aria-hidden="true"><path d="M3 3V33H34" class="curve-axis"/><path d="${curve.path}" class="curve-shape"/></svg><span>${curve.name}<span class="curve-formula">${tex(curve.latex)}</span></span><span class="curve-selected" aria-hidden="true">${current?icon('check',18):''}</span></button>`;
  };
  $('curve-choices').innerHTML=`<div class="curve-family-heading">${icon('blocks',19)}<span><strong>Block recipes</strong><small>${state?.circle?'Switch to building with blocks.':'Keep your blocks; change the starting equation.'}</small></span></div>${CURVES.filter(curve=>!isCircleSource(curve.id)).map(option).join('')}<section class="circle-curve-family" aria-labelledby="circle-family-title"><div class="curve-family-heading">${icon('move',19)}<span><strong id="circle-family-title">Circle controls</strong><small>Use centre and radius. Replaces your blocks.</small></span></div>${CURVES.filter(curve=>isCircleSource(curve.id)).map(option).join('')}</section>`;
}
function renderScene() {
  if(!state||!result)return;
  cancelCurveChange();
  $('scene').classList.remove('has-flight-callouts');
  $('scene').removeAttribute('data-crop-pending');
  const visibleView=displayedView();
  $('scene').dataset.view=visibleView;$('scene').setAttribute('role',introActive()?'region':'tabpanel');$('scene').setAttribute('aria-labelledby',introActive()?'level-title':`tab-${visibleView}`);
  $('scene').innerHTML=visibleView==='flight'?flightView(state,result,camera,flight):visibleView==='function'?(state.circle?circleEquation(state,result,flight):functionView(state,result,flight)):(state.circle?circleFlow(state,result,probeIndex,flight):flow(state,result,selectedStage,probeIndex,flight));
  if(visibleView==='flight'){sizeFlightAnnotations($('scene'));if(state.circle)decorateCircleFlight($('scene'),state,result,camera);}
  $('scene').scrollTop=visibleView==='flight'?flightScroll.top:0;
  $('scene').scrollLeft=visibleView==='flight'?flightScroll.left:0;
  if(visibleView==='function')sizeEquationTables($('scene'));
  if(visibleView==='function')equationPanels().forEach((panel,i)=>{panel.scrollLeft=equationScroll[i].left;panel.scrollTop=equationScroll[i].top;});
  if(visibleView==='flow') {
    sizeFlowAnnotations($('scene'));
    if(state.circle)updateCircleProbe($('scene'),state,result,probeIndex,camera);else updateFlowProbe($('scene'),state,result,probeIndex);
    const line=$('scene').querySelector<HTMLElement>('.flow-line')!;
    line.scrollLeft=flowScroll.left;line.scrollTop=flowScroll.top;
  }
  animatePosition();
}
function updatePrimary() {
  const won=throwWon;
  const advancing=won&&state?.mode!=='remix';
  const active=flight.phase==='flying'||flight.phase==='releasing';
  // Keep its focus through a pending edit so render can return it to the view
  // tab if the acknowledged construction no longer needs this control.
  $('circle-fit').setAttribute('aria-disabled',String(!initialized||pending>0||active));
  $('rethrow').hidden=!advancing;
  $<HTMLButtonElement>('rethrow').disabled=!initialized||pending>0||active;
  const next=state?.mode==='puzzle'?followingPuzzle(state.sourceId):undefined;
  const label=advancing?(state?.mode==='puzzle'?next?isMastery(next)?next===PUZZLE_ORDER.at(-1)?'Final mastery':'Mastery challenge':chapterIndex(next)!==chapterIndex(state.sourceId)?'Next chapter':isCapstone(next)?'Chapter challenge':'Next puzzle':OPTIONAL_PUZZLES.includes(state.sourceId)?'More puzzles':'Finish':'Create'):active?'In flight':flight.phase==='landed'?'Throw again':'Throw';
  $<HTMLButtonElement>('launch').disabled=!initialized||pending>0||active&&!advancing||!!result&&!flightPoints(result).length;
  $('launch').title=result?.relation&&!result.relation.playback.length?'No real heights yet. Make the right side reach zero or above.':'';
  $('launch').innerHTML=(advancing?`<span>${label}</span>${icon('arrow',21)}`:`${icon('throw',21)}<span>${label}</span>`)+`<kbd class="button-hotkey"${advancing?' data-hotkey="activate"':''} aria-hidden="true">${advancing?'Space':'Enter'}</kbd>`;
  $('launch').setAttribute('aria-keyshortcuts',advancing?'Space':'Enter');
  $('launch').classList.toggle('continue-ready',advancing);
  $('launch').dataset.action=advancing?'continue':'throw';
  $('launch').setAttribute('aria-label',label);
  $('playground').dataset.phase=flight.phase;
  $('success').hidden=!won;
  if(won)$('success').innerHTML=`<span class="success-medal">${icon(state&&isMastery(state.sourceId)?'mastery':'check',22)}<span>${state?.mode==='puzzle'&&isMastery(state.sourceId)?'Mastery earned!':state?.mode==='puzzle'&&isPicture(state.sourceId)?'Picture piece earned!':state?.sourceId===4&&state.nodes.length>4?'Try fewer blocks?':'All targets!'}</span></span>`;
  showNotice();
}
function render(focusCell?:number) {
  if(!state||!result)return;
  // Read before replacing the tray. WebKit can clamp the old Flow scroller
  // during that temporary layout, before its own replacement is rendered.
  document.querySelector('.game-shell')!.classList.remove('loading');
  const recipeContent=document.querySelector<HTMLElement>('.recipe-content')!;
  const recipeScroll=resetFlowScroll?{left:0,top:0}:{left:recipeContent.scrollLeft,top:recipeContent.scrollTop};
  const oldFlow=$('scene').querySelector<HTMLElement>('.flow-line');
  if(resetFlowScroll){flowScroll={left:0,top:0};flightScroll={left:0,top:0};equationScroll=[{left:0,top:0},{left:0,top:0}];resetFlowScroll=false;}
  else {
    if(oldFlow)flowScroll={left:oldFlow.scrollLeft,top:oldFlow.scrollTop};
    if($('scene').dataset.view==='flight')flightScroll={left:$('scene').scrollLeft,top:$('scene').scrollTop};
    rememberEquationScroll();
  }
  document.querySelector('.game-shell')!.classList.toggle('intro',introActive());
  document.querySelector('.game-shell')!.classList.toggle('choice-game',choiceActive());
  document.querySelector('.game-shell')!.classList.toggle('landing',introStage()===1);
  document.querySelector('.game-shell')!.classList.toggle('circle-game',!!state.circle);
  document.querySelector('.game-shell')!.classList.toggle('mastery-game',state.mode==='puzzle'&&isMastery(state.sourceId));
  cancelCirclePickup();
  cropEditor.cancel();
  // A concurrent edit or view change invalidates the held DOM node.
  if(pointer)finishPointer(undefined,true);
  cancelCurveChange();
  const focus=rememberFocus();
  const level=LEVELS[state.sourceId-1];
  const chapter=chapterIndex(state.sourceId),chapterInfo=CHAPTERS[chapter];
  $('level-category').textContent=state.mode==='puzzle'?(chapter<0?'BONUS PUZZLE':`CHAPTER ${chapter+1} · ${chapterInfo.name.toUpperCase()} · ${chapterInfo.levels.indexOf(state.sourceId)+1} OF ${chapterInfo.levels.length}`):state.mode==='remix'?'CREATE':'A SHARED CHALLENGE';
  $('level-title').textContent=state.mode==='puzzle'?level.name:state.mode==='remix'?'Your flight':'Hit their targets';
  $('picture-open').hidden=state.mode!=='puzzle'||chapter!==9;
  $('picture-open').innerHTML=`${icon('picture',14)}The moonlit garden`;
  $('chapter-step').hidden=$('picture-open').hidden;
  if(state.mode==='puzzle'&&chapter===9){
    $('level-category').textContent='CHAPTER 10';
    $('chapter-step').innerHTML=`${isMastery(state.sourceId)?`${icon('mastery',12)} ${state.sourceId===PUZZLE_ORDER.at(-1)?'FINAL MASTERY':'MASTERY CHALLENGE'} · `:''}${stepLabel(state.sourceId)}`;
  }
  $('playground').dataset.mode=state.mode;
  $('playground').dataset.choice=state.nodes.length?'placed':'empty';
  $('nav-create').hidden=state.mode==='remix';
  renderLevels();
  for(const v of views) {$(`tab-${v}`).setAttribute('aria-selected',String(view===v));$(`tab-${v}`).tabIndex=view===v?0:-1;}
  $('level-hint').textContent=state.mode==='remix'?'Explore a curve.':state.mode==='challenge'?'Hit every target.':level.hint;
  $<HTMLButtonElement>('ideas-open').disabled=false;
  if(result.solved)hintCue=false;
  $<HTMLButtonElement>('hints-open').disabled=false;
  $('hints-open').classList.toggle('hint-cue',hintCue);
  // Compare the displayed projection, not just the stored bounds: equal-scale
  // circles can have different bounds yet put every point in the same place.
  if(fullCurve&&!changesCamera(defaultCamera)){fullCurve=false;camera={...defaultCamera};}
  const canFit=!!(result.circle||result.relation||hasTargetFrame());
  const differentFrame=canFit&&changesCamera(fullCurve?defaultCamera:fittedCamera());
  $('circle-fit').hidden=!differentFrame||displayedView()==='function'||!result.circle&&displayedView()==='flow';
  $('circle-fit').setAttribute('aria-label','Full curve');
  $('circle-fit').setAttribute('aria-pressed',String(fullCurve));
  if(result.circle) {
    const {centre:[x,y],radius}=result.circle;
    const outside=x-radius<(camera.minX??-1)||x+radius>(camera.maxX??5)||y-radius<camera.min||y+radius>camera.max;
    $('circle-fit').classList.toggle('needs-fit',outside);
    $('circle-fit').title=fullCurve?'Return to the default view':outside?'Circle extends beyond the view. Show the full curve.':'Show the full curve';
  } else {
    const outside=(result.relation?.playback??result.points).some(([x,y])=>x<(camera.minX??-1)||x>(camera.maxX??5)||y<camera.min||y>camera.max);
    $('circle-fit').classList.toggle('needs-fit',outside);
    $('circle-fit').title=fullCurve?'Return to the default view':outside?'Path extends beyond the view. Show the full curve.':'Show the full curve';
  }
  palette();recipe();
  recipeContent.scrollLeft=recipeScroll.left;recipeContent.scrollTop=recipeScroll.top;
  $<HTMLButtonElement>('undo').disabled=!undo.length;
  $<HTMLButtonElement>('redo').disabled=!redo.length;
  $<HTMLButtonElement>('reset').disabled=state.circle?!circleEdited(state,result):!cropEdited(state)&&!state.nodes.some(node=>node.id!==state!.station?.id);
  const restartLabel=state.mode==='remix'?'Clear recipe':state.mode==='challenge'?'Restart challenge':'Restart puzzle';
  $('reset').setAttribute('aria-label',restartLabel);$('reset').title=`${restartLabel} (⇧+⌫)`;
  $<HTMLButtonElement>('reset-progress-open').disabled=false;
  $('undo').classList.toggle('retry-cue',flight.phase==='landed'&&!result.solved);
  for(const id of ['share-open','nav-create','favorite-save'])$<HTMLButtonElement>(id).disabled=false;
  updatePrimary();renderScene();
  if(focusCell!==undefined)focusSlot(focusCell);
  else if(!restoreFocus(focus)&&focus?.element.id==='circle-fit')$(`tab-${displayedView()}`).focus({preventScroll:true});
}
function setView(next: View) {view=next;preferences();progress();render();}
function hasTargetFrame() {return !!state&&state.mode==='puzzle'&&state.sourceId>=48&&!state.circle&&!result?.relation;}
function fittedCamera(targetsFirst=false):Camera {
  if(!result)return camera;
  if(result.circle){const b=result.circle.bounds;return {min:b.minY,max:b.maxY,minX:b.minX,maxX:b.maxX};}
  if(result.relation){
    // An unfinished curve can be much taller than the intended shape. Keep the
    // required geometry readable on entry; explicit Fit includes the whole path.
    const goals=result.checkpoints.map(g=>[fraction(g.x),targetHeight(g)] as [number,number]);
    const points=targetsFirst&&goals.length?goals:[...result.relation.playback,...goals],ys=points.map(p=>p[1]);
    return {min:Math.min(-1,...ys)-.7,max:Math.max(1,...ys)+.7,minX:-.7,maxX:4.7};
  } else {
    const ys=[0,...result.checkpoints.map(targetHeight),...(targetsFirst?[]:result.points.map(point=>point[1]))];
    const min=Math.floor(Math.min(...ys)),max=Math.ceil(Math.max(...ys)),padding=Math.max((max-min)*.2,.4);
    return {min:min-padding,max:max+padding};
  }
}
function changesCamera(next:Camera) {
  if(!state)return false;
  return ([[0,0],[1,1]] as [number,number][]).some(point=>{
    const before=transform(state!,camera,point),after=transform(state!,next,point);
    return before.some((coordinate,i)=>Math.abs(coordinate-after[i])>1e-7);
  });
}
$('circle-fit').onclick=()=>{
  if($('circle-fit').hidden||!(result?.circle||result?.relation||hasTargetFrame())||pending||['flying','releasing'].includes(flight.phase))return;
  cancelCirclePickup();cropEditor.cancel();fullCurve=!fullCurve;
  camera=fullCurve?fittedCamera():{...defaultCamera};
  render();$('circle-fit').focus({preventScroll:true});
};
function slideCell(cell:HTMLElement,before:DOMRect,keepFocusAtDestination=false) {
  if(reduced)return;
  const face=cell.querySelector<HTMLElement>('.recipe-face,.empty-face')!,after=face.getBoundingClientRect();
  if(Math.abs(before.left-after.left)<=2&&Math.abs(before.top-after.top)<=2)return;
  // Arrow moves carry the focused piece; a Space/tap destination stays put
  // while the painted face arrives. Its button, outline and keycaps never
  // travel back to the source just to participate in that animation.
  const target=keepFocusAtDestination?face:cell;
  target.animate([{transform:`translate(${before.left-after.left}px,${before.top-after.top}px)`},{transform:'translate(0,0)'}],{id:'recipe-move',duration:220,easing:'ease-out'});
}
function fadeEmpty(empty:HTMLElement|null|undefined) {
  if(!reduced&&empty&&empty!==document.activeElement)empty.animate([{opacity:0},{opacity:1}],{id:'recipe-vacancy',duration:220,easing:'ease-out'});
}
function animateChange(previousState:State,previousResult:Result, from:Result['points'], rects:Map<string,DOMRect>,previousSlots:RailSlots,fromSlope:number,previousVisual?:SVGGElement,move?:CellMove,emptyRect?:DOMRect,completeSelection=false) {
  if(reduced||!state||!result)return;
  if(state.circle||previousState.circle)return;
  document.querySelectorAll<HTMLElement>('.recipe-part').forEach(el=>{
    const before=rects.get(el.dataset.part!);
    if(!previousState.nodes.some(n=>n.id===el.dataset.part))el.classList.add('just-placed');
    else if(before) {
      // Continue from the actual painted position if interrupted. Focus, not
      // animation order or DOM order, determines which crossing block is above.
      slideCell(el,before,completeSelection&&Number(el.dataset.cell)===move?.to);
    }
  });
  for(const empty of document.querySelectorAll<HTMLElement>('.empty-slot')) {
    const cell=Number(empty.dataset.cell);
    if(emptyRect&&cell===move?.to)slideCell(empty,emptyRect,completeSelection);
    else if(previousSlots[cell]||emptyRect&&cell===move?.from)fadeEmpty(empty);
  }
  if(displayedView()!=='flight'||!previousVisual)return;
  if(!previousVisual.dataset.fromFade&&previousVisual.querySelector('.curve-change-trajectory')?.getAttribute('d')===$('trajectory')?.getAttribute('d'))return;
  const morph=previousVisual.dataset.fromFade?undefined:curveMorph(previousResult,result,from===previousResult.points?undefined:from);
  if(!morph){clearCurveFade=fadeFlightGeometry($('scene'),previousVisual);return;}
  const to=morph.to,toSlope=result.startSlope,start=performance.now();
  const endPoints=(root:Element)=>[...root.querySelectorAll<SVGCircleElement>('.path-end')].sort((a,b)=>Number(a.getAttribute('cx'))-Number(b.getAttribute('cx')));
  const oldEnds=endPoints(previousVisual),newEnds=endPoints($('flight-svg'));
  const ends=newEnds.map((el,i)=>({el,from:oldEnds[i]?[Number(oldEnds[i].getAttribute('cx')),Number(oldEnds[i].getAttribute('cy'))]:undefined,to:[Number(el.getAttribute('cx')),Number(el.getAttribute('cy'))]}));
  clearCurveEnds=()=>{for(const {el,to} of ends){el.setAttribute('cx',String(to[0]));el.setAttribute('cy',String(to[1]));}};
  $('scene').dataset.curveTransition='morph';
  const paint=(time:number)=>{
    const progress=Math.min((time-start)/320,1),t=1-Math.pow(1-progress,3);
    displayedPoints=to.map(([x,y],i)=>[morph.from[i][0]+(x-morph.from[i][0])*t,morph.from[i][1]+(y-morph.from[i][1])*t]);
    displayedSlope=fromSlope+(toSlope-fromSlope)*t;
    paintTrajectory(displayedPoints,true);animatePosition();
    for(const {el,from,to} of ends)if(from){el.setAttribute('cx',String(from[0]+(to[0]-from[0])*t));el.setAttribute('cy',String(from[1]+(to[1]-from[1])*t));}
    if(progress<1)morphFrame=requestAnimationFrame(paint);else {cancelCurveChange(true);}
  };
  paint(start);
}
function paintTrajectory(points:Result['points'],intermediate=false) {
  $('trajectory')?.setAttribute('d',!intermediate&&(result?.relation||result?.paths)?drawnPaths(result).map(p=>path(p.points,state!,camera)).join(' '):path(points,state!,camera));
}
function updateTargets() {
  if(!state||!result)return;
  let hits=0;
  result.checkpoints.forEach((checkpoint,i)=>{
    const status=targetStatus(checkpoint,state!,flight);if(status==='hit')hits++;
    document.querySelectorAll<HTMLElement>(`[data-target="${i}"]`).forEach(el=>{
      if(el.dataset.status===status)return;
      el.dataset.status=status;el.classList.remove('waiting','hit','miss','just-hit');el.classList.add(status);
      if(status==='hit'&&!reduced)el.classList.add('just-hit');
      if(el.matches('.ring,.equation-verdict,.flow-goal'))el.setAttribute('aria-label',targetDescription(checkpoint,i,status));
      const mark=el.querySelector<HTMLElement>('.target-result');if(mark){mark.innerHTML=targetMark(checkpoint.hit?'hit':'miss');mark.setAttribute('aria-label',status);}
    });
  });
  if(!throwWon&&result.solved&&result.checkpoints.length>0&&hits===result.checkpoints.length) {
    throwWon=true;
    if(state.mode==='puzzle'){completed.add(state.sourceId);progress();renderLevels();}
    updatePrimary();$('success').classList.toggle('just-solved',!reduced);
    $('move-announcement').textContent='Every target hit.';
  }
}
function animatePosition() {
  if(!state||!result)return;
  const points=displayedPoints||flightPoints(result),xy=displayedPoints?interpolate(points,flight.position):sampledPosition(result,flight.position);
  const strokes=flightStrokes(result),size=strokes.length>1?.72:1;
  for(const [index,stroke] of strokes.entries()) {
    const el=(name:string)=>$(index?`${name}-${index}`:name);
    const local=Math.max(0,Math.min(1,(flight.position-stroke.start)/Math.max(.00001,stroke.end-stroke.start)));
    const at=displayedPoints?xy:result.relation?strokePosition(stroke,local):xy;
    const [cx,cy]=transform(state,camera,at),origin=displayedPoints?displayedPoints[0]:stroke.points[0];
    const incoming=displayedPoints??stroke.points;
    const tangent=result.relation&&incoming.length>1?[incoming[1][0]-origin[0],incoming[1][1]-origin[1]] as [number,number]:result.circle?.tangent??[1,displayedSlope??result.startSlope] as [number,number];
    const {angle,degrees,transform:pose}=launcherPose(state,camera,origin,tangent,size);
    el('launcher')?.setAttribute('transform',pose);el('launcher-front')?.setAttribute('transform',pose);
    const queued=flight.position<stroke.start;
    const pull=flight.phase==='ready'?1:flight.phase==='releasing'?index?1:1-(flight.release||0):queued?Math.min(1,(stroke.start-flight.position)/.018):0;
    const fruit=cucumberPose([cx,cy],angle,pull,size);
    el('cucumber')?.setAttribute('transform',fruit.transform);
    el('flight-spin')?.setAttribute('transform',`rotate(${fruit.degrees+620*local*local}) scale(${size})`);
    const before=transform(state,camera,result.relation?strokePosition(stroke,Math.max(0,local-.005)):sampledPosition(result,Math.max(0,flight.position-.005)));
    const after=transform(state,camera,result.relation?strokePosition(stroke,Math.min(1,local+.005)):sampledPosition(result,Math.min(1,flight.position+.005)));
    el('flight-motion')?.setAttribute('transform',`rotate(${local===0?degrees:Math.atan2(after[1]-before[1],after[0]-before[0])*180/Math.PI}) scale(${size})`);
    el('flight-motion')?.setAttribute('visibility',flight.phase==='flying'&&!queued&&flight.position<stroke.end?'visible':'hidden');
    const pouchX=-52*pull,pouchY=-3-9*pull,pouchScale=.75+.25*pull,pouchAngle=-90*(1-pull),radians=pouchAngle*Math.PI/180;
    for(const [name,forkX,edgeY] of [['band-back',-11,-8],['band-front',12,8]] as const) {
      const endX=pouchX+(3*Math.cos(radians)-edgeY*Math.sin(radians))*pouchScale;
      const endY=pouchY+(3*Math.sin(radians)+edgeY*Math.cos(radians))*pouchScale;
      const middleX=(forkX+endX)/2,middleY=(-8+endY)/2+1.5*(1-pull);
      el(name)?.setAttribute('d',`M${forkX} -8Q${middleX.toFixed(2)} ${middleY.toFixed(2)} ${endX.toFixed(2)} ${endY.toFixed(2)}`);
    }
    el('slingshot-pouch')?.setAttribute('transform',`translate(${pouchX} ${pouchY}) rotate(${pouchAngle}) scale(${pouchScale})`);
  }
  if(displayedView()==='flight')$('flight-trail')?.setAttribute('d',flight.phase==='ready'||flight.phase==='releasing'?'':travelledPaths(result,flight.position).map(p=>path(p,state!,camera)).join(' '));
  if(displayedView()==='flow') {
    const slider=$<HTMLInputElement>('flow-position'),playing=flight.phase==='releasing'||flight.phase==='flying';
    const index=playing?(state.circle?Math.round(flight.position*(result.points.length-1)):nearestIndex(probePoints(result),xy[0])):probeIndex;
    slider.disabled=playing;
    slider.closest('.flow-controls')!.classList.toggle('playing',playing);
    if(Number(slider.dataset.probeIndex)!==index){if(state.circle)updateCircleProbe($('scene'),state,result,index,camera);else updateFlowProbe($('scene'),state,result,index);}
  }
  updateTargets();
}
let flightActionFocus:HTMLButtonElement|undefined;
let quickThrowFocus:Element|null|undefined;
// Disabling an active action makes browsers move focus to the document. Restore
// that action after playback only if the player has not chosen another focus.
document.addEventListener('focusin',event=>{
  if(event.target!==flightActionFocus&&event.target!==document.body)flightActionFocus=undefined;
  if(event.target!==quickThrowFocus&&event.target!==document.body)quickThrowFocus=undefined;
});
document.addEventListener('pointerdown',()=>{flightActionFocus=undefined;quickThrowFocus=undefined;});
document.addEventListener('keydown',event=>{if(event.key==='Tab'){flightActionFocus=undefined;quickThrowFocus=undefined;}});
function finishFlight() {
  const quickOrigin=quickThrowFocus;quickThrowFocus=undefined;
  flight={phase:'landed',position:1};animatePosition();
  notice={text:state?.mode==='remix'?'':result?.solved?'':state?.circle?'Adjust the centre or radius.':choiceActive()?'Pick another block and try again.':'Adjust a block and try again.',kind:''};
  updatePrimary();$('undo').classList.toggle('retry-cue',!!state?.nodes.length&&!result?.solved);
  $('success').classList.toggle('just-solved',!!result?.solved&&!reduced);
  $('move-announcement').textContent=state?.mode==='remix'?'Throw complete.':result?.solved?'Every target hit. Puzzle solved.':`${result?.checkpoints.filter(c=>c.hit).length} of ${result?.checkpoints.length} targets hit. ${choiceActive()?'Pick another block':'Adjust your recipe'} and throw again.`;
  if(state?.mode==='puzzle'&&isPicture(state.sourceId)&&result?.solved&&!pictureCelebrated){pictureCelebrated=true;showGarden('launch',state.sourceId);}
  const action=flightActionFocus;flightActionFocus=undefined;
  if(action&&document.activeElement===document.body&&!action.disabled&&!action.hidden&&!document.querySelector('dialog[open]'))action.focus({preventScroll:true});
  if(quickOrigin&&throwWon&&state?.mode!=='remix'&&document.hasFocus()&&!document.querySelector('dialog[open]')&&(document.activeElement===quickOrigin||document.activeElement===document.body))$('launch').focus({preventScroll:true});
}
function launch() {
  if(!initialized||pending)return;
  if(choiceActive()&&!state!.nodes.length)return;
  if(throwWon&&state?.mode!=='remix') {
    const next=followingPuzzle(state!.sourceId);
    if(state!.mode==='puzzle'&&next)goToPuzzle(next,false);
    else if(state!.mode==='puzzle'&&OPTIONAL_PUZZLES.includes(state!.sourceId)){renderLevels();open('puzzles-dialog','launch');}
    else if(state!.mode==='puzzle')showEnding();
    else void perform({type:'remix'},'clear');
    return;
  }
  throwCucumber();
}
function throwCucumber(replay=false,focusNext=false) {
  if(!initialized||pending)return;
  if(flight.phase==='flying'||flight.phase==='releasing')return;
  quickThrowFocus=focusNext?document.activeElement:undefined;
  flightActionFocus=document.activeElement===$('launch')?$<HTMLButtonElement>('launch'):document.activeElement===$('rethrow')?$<HTMLButtonElement>('rethrow'):undefined;
  cancelCirclePickup();
  cropEditor.cancel();
  cancelCurveChange();
  if(displayedView()==='flight')paintTrajectory(result!.points);
  flight={phase:'releasing',position:0,release:0};if(!replay)throwWon=false;notice={text:'',kind:''};$('success').classList.remove('just-solved');updatePrimary();animatePosition();
  $('move-announcement').textContent='Cucumber launched.';
  if(reduced)finishFlight();
}
let lastFrame=performance.now();
function frame(time: number) {
  const dt=Math.min(time-lastFrame,50);lastFrame=time;
  if(initialized&&!document.hidden&&!document.querySelector('dialog[open]')) {
    if(flight.phase==='releasing') {
      flight.release=Math.min(1,(flight.release||0)+dt/160);animatePosition();
      if(flight.release===1){flight={phase:'flying',position:0};updatePrimary();animatePosition();}
    } else if(flight.phase==='flying') {
      flight.position=Math.min(1,flight.position+dt/2600);animatePosition();if(flight.position===1)finishFlight();
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
const sizeInspection=()=>{
  if(!state||!result)return;
  sizeFlightAnnotations($('scene'));sizeFlowAnnotations($('scene'));sizeEquationTables($('scene'));sizeCircleControls($('scene'));
};
new ResizeObserver(sizeInspection).observe($('scene'));
// A fixed content frame need not resize when a newly used KaTeX font arrives.
document.fonts.addEventListener('loadingdone',sizeInspection);

function closeDialogs(){document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(dialog=>dialog.close());}
let leaveAction:(()=>Promise<unknown>)|undefined;
function recipeKey(snapshot:Snapshot) {
  const s=snapshot.state;
  return JSON.stringify([s.mode,s.sourceId,s.goals,s.inventory,s.limit,s.circle,s.crop,snapshot.slots.map(id=>id?s.nodes.find(node=>node.id===id)?.op:null)]);
}
function unsavedRecipe() {
  if(!state||(state.circle?!circleEdited(state,result):!cropEdited(state)&&!state.nodes.some(node=>node.id!==state!.station?.id)))return false;
  const current=recipeKey({state,slots:railSlots});
  return !seeds.some(seed=>{try{return seed.snapshot&&recipeKey(seed.snapshot)===current;}catch{return false;}});
}
function changeWorkspace(action:()=>Promise<unknown>,destination:string,carry=false,explanation?:string) {
  if(!unsavedRecipe()){closeDialogs();void action();return;}
  $('leave-description').textContent=explanation??(carry?'Create carries your construction over. Save this puzzle recipe to resume it later.':`Save your current recipe before opening ${destination}.`);
  $<HTMLInputElement>('leave-name').value=state?.mode==='puzzle'?LEVELS[state.sourceId-1].name:'My flight';
  $('leave-error').hidden=true;
  open('leave-dialog');leaveAction=action;
}
function goToPuzzle(sourceId:number,protect=true) {
  const next=()=>perform({type:'level',sourceId,mode:'puzzle'},'clear').then(ok=>{if(ok)focusGameControl();});
  if(protect)changeWorkspace(next,LEVELS[sourceId-1].name);
  else {closeDialogs();void next();}
}
function showEnding() {
  const count=PUZZLE_ORDER.filter(id=>completed.has(id)).length,all=count===PUZZLE_ORDER.length;
  $('ending-title').textContent=all?'A whole garden of ideas.':'Your garden, shaped.';
  $('ending-description').textContent=all?'Heights, folds, change, accumulation — and a path that comes back. You explored every puzzle. There are still shapes to revisit and flights of your own to make.':'You brought the ideas together. More chapters are waiting whenever you want to explore them.';
  $('ending-progress').textContent=`${count} of ${PUZZLE_ORDER.length} puzzles complete`;
  $('ending-chapters').innerHTML=CHAPTERS.map((chapter,i)=>{
    const done=chapter.levels.filter(id=>completed.has(id)).length,complete=done===chapter.levels.length;
    return `<li class="ending-chapter ${complete?'complete':''}" style="--arrival:${i*90}ms" aria-label="${chapter.name}: ${done} of ${chapter.levels.length} complete"><span class="ending-chapter-art ${chapter.color}">${chapterArt(i)}${complete?`<span class="ending-check">${icon('check',13)}</span>`:''}</span><span>${chapter.name}</span><small>${done} / ${chapter.levels.length}</small></li>`;
  }).join('');
  open('ending-dialog','launch');
}
function focusPart(id:string) {
  const part=document.querySelector<HTMLElement>(`.part-body[data-stage="${CSS.escape(id)}"]`);
  focusRecipeControl(part);
}
function focusEmpty(index:number) {
  const slot=document.querySelector<HTMLElement>(`[data-empty="${index}"]`);
  focusRecipeControl(slot);
}
function focusSlot(index:number) {
  const id=railSlots[index];if(id)focusPart(id);else focusEmpty(index);
}
function focusRecipeControl(control:HTMLElement|null) {
  if(!control)return;
  const dialog=document.querySelector<HTMLDialogElement>('#hints-dialog[open],#ideas-dialog[open]');
  const origin=dialog&&referenceOrigins.get(dialog);
  // If H/N overtook an accepted edit, carry that edit's intended destination
  // into the return bookmark without taking focus out of the modal reference.
  if(origin)origin.focus=rememberFocus(document,control);
  else control.focus({preventScroll:true});
  revealRailCell(control);
}
function moveCell(from:number,to:number,completeSelection=false) {
  if(!state)return;
  if(from===to||from<0||to<0||from>=railSlots.length||to>=railSlots.length)return;
  const id=railSlots[from],slots=movedSlots(railSlots,state,from,to);
  if(!slots)return;
  const emptySelection=!id&&insertionIndex===from?to:undefined;
  const move={from,to};
  if(state.station) {
    const nodes=slots.flatMap(id=>id?[state!.nodes.find(node=>node.id===id)!]:[]);
    return serial(async()=>accept(await kernel.run({...state!,nodes},{type:'evaluate'}),'push',slots,undefined,true,id??undefined,emptySelection,completeSelection,move));
  }
  if(!id)return serial(async()=>{if(!state||!result)return;return accept({status:'ok',state,result},'push',slots,undefined,true,undefined,emptySelection,completeSelection,move);});
  const index=slots.slice(0,to).filter(Boolean).length;
  return serial(async()=>accept(await kernel.run(state,{type:'move',id,index}),'push',slots,undefined,true,id,undefined,completeSelection,move));
}
function insertIntoSlot(op:Op,index=insertionIndex??railSlots.indexOf(null),advance=false) {
  if(!state||index<0||index>=railSlots.length)return;
  // Insert at the indicated slot, shifting only as far as a free slot. Prefer
  // the right; a hole to the left still lets the new block land where dropped.
  const id=crypto.randomUUID(),slots=insertedSlots(railSlots,state,id,index);
  if(!slots)return;
  selectedStage='';
  const place=(reply:Response)=>{
    requireOk(reply);
    const acceptedSlots=normalizeSlots(reply.state,slots);
    const next=advance?[...acceptedSlots.keys()].find(i=>i>index&&acceptedSlots[i]===null)??acceptedSlots.indexOf(null):-1;
    const accepted=accept(reply,'push',acceptedSlots,undefined,true,id,next>=0?next:undefined);
    if(advance&&next<0)focusPart(id);
    return accepted;
  };
  if(state.station) {
    const nodes=slots.flatMap(slot=>slot?[slot===id?{id,op}:state!.nodes.find(node=>node.id===slot)!]:[]);
    return {id,work:serial(async()=>place(await kernel.run({...state!,nodes},{type:'evaluate'})))};
  }
  return {id,work:serial(async()=>place(await kernel.run(state,{type:'insert',op,id,index:slots.slice(0,index).filter(Boolean).length})))};
}
function removePart(id:string,focus:'stack'|'slot'|'previous'='stack') {
  const index=state?.nodes.findIndex(n=>n.id===id)??-1;
  const op=state?.nodes[index]?.op;
  const cell=railSlots.indexOf(id);
  const destination=focus==='previous'?adjacentSlot(railSlots,state!,cell,-1):cell;
  return perform({type:'remove',id},'push',railSlots.map(slot=>slot===id?null:slot)).then(accepted=>{
    if(!accepted)return;
    if(focus!=='stack')focusSlot(destination);else focusRecipeControl(document.querySelector<HTMLElement>(`[data-op="${op}"]`));
    $('move-announcement').textContent=`${op?OPS[op].name:'Block'} returned to its stack.`;
  });
}
// Manual inspection never changes the recipe or history. Playback temporarily
// owns the slider and restores the last inspected position when it finishes.
$('scene').addEventListener('input',event=>{
  const input=event.target as HTMLInputElement;
  if(input.id!=='flow-position'||input.disabled||!state||!result)return;
  if(state.circle){probeIndex=Math.max(0,Math.min(result.points.length-1,Math.round(input.valueAsNumber*(result.points.length-1))));updateCircleProbe($('scene'),state,result,probeIndex,camera);return;}
  probeIndex=nearestIndex(probePoints(result),input.valueAsNumber);
  updateFlowProbe($('scene'),state,result,probeIndex);
});
$('construction').addEventListener('change',event=>{
  const input=event.target as HTMLInputElement,key=input.dataset.circleValue as keyof Circle|undefined;
  if(!key||!state?.circle)return;
  const value=circleInput(input.value);
  if(value===state.circle[key])return;
  void serial(async()=>{if(!state?.circle)return;accept(await kernel.run(state,{type:'circle',...state.circle,[key]:value}));}).then(()=>{const current=document.querySelector<HTMLInputElement>(`[data-circle-value="${key}"]`);if(current&&state?.circle)current.value=state.circle[key];});
});
$('construction').addEventListener('keydown',event=>{
  const input=event.target as HTMLInputElement,key=input.dataset.circleValue as keyof Circle|undefined;
  if(!key||!state?.circle)return;
  if(event.key==='Enter'){event.preventDefault();input.dispatchEvent(new Event('change',{bubbles:true}));}
  if(event.key==='Escape'){event.preventDefault();input.value=state.circle[key];}
});
$('scene').addEventListener('change',event=>{if((event.target as HTMLElement).id==='circle-pair'){chooseCircleInspection(undefined,Number((event.target as HTMLSelectElement).value));renderScene();$('circle-pair')?.focus({preventScroll:true});}});
document.addEventListener('click',event=>{
  const button=(event.target as Element).closest<HTMLButtonElement>('button');
  if(!button&&!suppressClick&&!(event.target as Element).closest('input,select,textarea,label')&&(event.target as Element).closest('#playground')&&(selectedStage||insertionIndex!==undefined)){selectedStage='';insertionIndex=undefined;render();}
  if(!button||button.disabled||suppressClick)return;
  const d=button.dataset;
  if(d.openGarden!==undefined){event.preventDefault();showGarden('menu-picture-open',undefined,'puzzles-dialog');return;}
  if(d.back){
    const returnTo=d.back,dialog=d.backDialog||'menu-dialog';open(dialog);
    // WebKit finishes removing dialog inertness after showModal returns.
    requestAnimationFrame(()=>{if($<HTMLDialogElement>(dialog).open)$(returnTo).focus({preventScroll:true});});
    return;
  }
  if(d.view&&isView(d.view)) {
    const fromNotes=button.classList.contains('note-view-button');
    if(fromNotes)closeDialogs();
    setView(d.view);
    if(fromNotes)requestAnimationFrame(()=>$(`tab-${d.view}`).focus({preventScroll:true}));
    return;
  }
  if(!initialized)return;
  if(d.circleTarget!==undefined){chooseCircleInspection(Number(d.circleTarget));renderScene();document.querySelector<HTMLElement>(`[data-circle-target="${d.circleTarget}"]`)?.focus({preventScroll:true});return;}
  if(d.level){goToPuzzle(Number(d.level));return;}
  if(pending)return;
  if(d.cropAdd!==undefined){void perform({type:'crop',from:'0',to:state!.sourceId===5?'2':'4'});return;}
  if(d.cropClear!==undefined){void perform({type:'crop',clear:true});return;}
  if(button.id==='source-choose'){renderCurves();open('curves-dialog','source-choose');return;}
  if(d.source){
    closeDialogs();const sourceId=Number(d.source);
    if(state!.mode==='remix'&&sourceId!==curveId(state!.sourceId)) {
      const switchSource=()=>perform({type:'source',sourceId}).then(()=>$('source-choose')?.focus({preventScroll:true}));
      if(Boolean(state!.circle)!==isCircleSource(sourceId))changeWorkspace(()=>serial(async()=>{
        const reply=await kernel.run({...state!,nodes:[]},{type:'source',sourceId});accept(reply);$('source-choose')?.focus({preventScroll:true});
      }),CURVES.find(curve=>curve.id===sourceId)!.name,false,isCircleSource(sourceId)?'Circle controls use centre and radius instead of blocks. Save this recipe before its blocks are replaced.':'A block recipe replaces these circle controls. Save the circle recipe before switching.');
      else void switchSource();
    }
    else $('source-choose')?.focus({preventScroll:true});
    return;
  }
  if(d.return){void removePart(d.return);return;}
  if(d.op){
    if(choiceActive()) {
      const op=d.op as Op,nodes=state!.nodes[0]?.op===op?[]:[{id:crypto.randomUUID(),op}];
      void serial(async()=>accept(await kernel.run({...state!,nodes},{type:'evaluate'}),'push',[nodes[0]?.id??null])).then(()=>document.querySelector<HTMLElement>(`[data-op="${op}"]`)?.focus({preventScroll:true}));
      return;
    }
    void insertIntoSlot(d.op as Op)?.work.then(()=>{
      // render() preserves the current logical stack, or a deliberate focus
      // change during evaluation. Only a completely filled rail needs this
      // fallback after every stack has become unavailable.
      if((event as MouseEvent).detail===0&&document.activeElement===document.body)(document.querySelector<HTMLElement>('[data-op]:not(:disabled)')||$('launch')).focus({preventScroll:true});
    });
  }
  if(d.insert!==undefined){
    if(state!.nodes.some(n=>n.id===selectedStage)){const id=selectedStage;void moveCell(railSlots.indexOf(id),Number(d.insert),true)?.then(()=>focusPart(id));}
    else if(insertionIndex!==undefined){const to=Number(d.insert);if(insertionIndex!==to)void moveCell(insertionIndex,to,true)?.then(()=>focusEmpty(to));else{insertionIndex=undefined;render();}}
    else if(state!.mode==='remix'||state!.nodes.length<state!.limit){insertionIndex=Number(d.insert);notice={text:'Choose a block.',kind:''};render();focusEmpty(Number(d.insert));}
  }
  if(d.stage){
    if(selectedStage&&selectedStage!==d.stage){const id=selectedStage;void moveCell(railSlots.indexOf(id),railSlots.indexOf(d.stage),true)?.then(()=>focusPart(id));}
    else if(insertionIndex!==undefined){const to=railSlots.indexOf(d.stage);void moveCell(insertionIndex,to,true)?.then(()=>focusEmpty(to));}
    else{selectedStage=selectedStage===d.stage?'':d.stage;discoveryStage=d.stage;render();focusPart(d.stage);}
  }
});
$('undo').onclick=()=>void historyMove(true);
$('redo').onclick=()=>void historyMove(false);
$('reset').onclick=()=>void perform({type:'reset'});
$('launch').onclick=launch;
$('rethrow').onclick=()=>throwCucumber(true);
$('nav-create').onclick=()=>{if(initialized&&state?.mode!=='remix')changeWorkspace(()=>perform({type:'remix'},'clear',railSlots).then(ok=>{if(ok)$('level-title').focus({preventScroll:true});}),'Create',true);};
document.addEventListener('keydown',event=>{
  const target=event.target as HTMLElement;
  if(event.defaultPrevented||event.isComposing||event.altKey||event.ctrlKey&&event.metaKey||target.matches('input,textarea,select')||target.isContentEditable||document.querySelector('dialog[open]'))return;
  const inPlay=target===document.body||!!target.closest('.game-shell');
  if(event.key==='Escape'&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey) {
    if(pointer){event.preventDefault();finishPointer(undefined,true);}
    else if(selectedStage||insertionIndex!==undefined){event.preventDefault();selectedStage='';insertionIndex=undefined;render();}
    return;
  }
  if(event.ctrlKey||event.metaKey) {
    if(initialized&&event.key.toLowerCase()==='z'){event.preventDefault();void historyMove(!event.shiftKey);}
    if(initialized&&!event.shiftKey&&event.key.toLowerCase()==='y'){event.preventDefault();void historyMove(false);}
    return;
  }
  if(event.shiftKey&&!event.altKey&&['Delete','Backspace'].includes(event.key)&&inPlay) {
    event.preventDefault();
    if(!event.repeat&&!pointer&&!$<HTMLButtonElement>('reset').disabled)void perform({type:'reset'});
    return;
  }
  if(event.key==='Enter'&&!event.altKey&&!event.shiftKey&&inPlay&&!target.closest('a[href]')) {
    event.preventDefault();
    if(!event.repeat&&!pointer&&flight.phase!=='flying'&&flight.phase!=='releasing'&&!$<HTMLButtonElement>('launch').disabled&&(!choiceActive()||state?.nodes.length))throwCucumber(throwWon,true);
    return;
  }
  if(characterShortcuts&&inPlay&&!event.altKey&&!event.shiftKey&&['h','n'].includes(event.key.toLowerCase())) {
    const button=$<HTMLButtonElement>(event.key.toLowerCase()==='h'?'hints-open':'ideas-open');
    if(!event.repeat&&!button.disabled&&button.getClientRects().length){event.preventDefault();(event.key.toLowerCase()==='h'?openHints:openNotes)(rememberFocus());}
    return;
  }
  if(characterShortcuts&&inPlay&&!event.shiftKey&&['z','x','c'].includes(event.key.toLowerCase())) {
    const next=views[['z','x','c'].indexOf(event.key.toLowerCase())],button=$<HTMLButtonElement>(`tab-${next}`);
    if(initialized&&!event.repeat&&!button.disabled&&button.getClientRects().length){
      event.preventDefault();const onView=target.matches('[role=tab]');setView(next);if(onView)button.focus({preventScroll:true});
    }
    return;
  }
  if(characterShortcuts&&inPlay&&!event.shiftKey&&/^[1-9]$/.test(event.key)) {
    // Keep the palette's authored order, including depleted stacks. A number
    // invokes that visible control; it never changes to the next available kind.
    const button=$('palette').querySelectorAll<HTMLButtonElement>('[data-op]')[Number(event.key)-1];
    if(initialized&&!pending&&!event.repeat&&button&&!button.disabled&&button.getClientRects().length) {
      event.preventDefault();
      if(choiceActive()||button.dataset.return)button.click();
      else {
        const advance=insertionIndex!==undefined,placed=insertIntoSlot(button.dataset.op as Op,undefined,advance);
        if(placed&&!advance)void placed.work.then(accepted=>{if(accepted)focusPart(placed.id);});
      }
    }
    return;
  }
  if(characterShortcuts&&inPlay&&event.key==='?'){event.preventDefault();if(!event.repeat)open('help-dialog');return;}
  if(event.shiftKey)return;
  if(navigateTablist(event,views.map(view=>$(`tab-${view}`)),tab=>setView(tab.dataset.view as View)))return;
  if(target.matches('.ingredient:not(:disabled):not([data-return])')&&!choiceActive()&&!pending&&event.key==='ArrowUp') {
    event.preventDefault();
    const placed=insertIntoSlot(target.dataset.op as Op);
    if(placed)void placed.work.then(accepted=>{if(accepted)focusPart(placed.id);});
  }
  if(target.matches('.part-body')&&state&&!pending) {
    const id=target.dataset.stage!,index=railSlots.indexOf(id);
    if(event.key==='ArrowLeft'||event.key==='ArrowRight') {
      event.preventDefault();const to=adjacentSlot(railSlots,state,index,event.key==='ArrowLeft'?-1:1);
      if(to!==index){selectedStage=id;void moveCell(index,to)?.then(()=>focusPart(id));}
    }
    if(event.key==='ArrowDown'||event.key==='Delete'||event.key==='Backspace') {
      event.preventDefault();void removePart(id,event.key==='ArrowDown'?'stack':event.key==='Backspace'?'previous':'slot');
    }
  }
  if(target.matches('.empty-slot')&&!pending&&event.key==='Backspace') {
    event.preventDefault();focusSlot(adjacentSlot(railSlots,state!,Number(target.dataset.empty),-1));
  }
  if(target.matches('.empty-slot')&&!pending&&(event.key==='ArrowLeft'||event.key==='ArrowRight')) {
    event.preventDefault();const from=Number(target.dataset.empty),to=adjacentSlot(railSlots,state!,from,event.key==='ArrowLeft'?-1:1);
    void moveCell(from,to)?.then(()=>focusEmpty(to));
  }
});
document.addEventListener('keydown',event=>{
  if(event.defaultPrevented||event.isComposing||event.repeat||event.key!=='Backspace'||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
  const target=event.target as HTMLElement,dialog=document.querySelector<HTMLDialogElement>('dialog[open]');
  if(!dialog||target.isContentEditable||target.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]),textarea,select'))return;
  const back=dialog.querySelector<HTMLButtonElement>('[data-back-shortcut]:not(:disabled)');
  if(back){event.preventDefault();back.click();}
});

let drag: {op?:Op;id?:string;empty?:number} | undefined, suppressClick=false;
let pointer: {x:number;y:number;pointerId:number;element:HTMLElement;active:boolean} | undefined, ghost:HTMLElement|undefined, cancelledPointer:number|undefined;
function drop(index: number) {
  if(!drag||!state)return;
  if(drag.op)return insertIntoSlot(drag.op,index);
  if(drag.id)return {id:drag.id,work:moveCell(railSlots.indexOf(drag.id),index)};
  if(drag.empty!==undefined)return {id:'',cell:index,work:moveCell(drag.empty,index)};
}
function clearDropHints() {document.querySelectorAll('.drop-target,.suggested-slot,.return-target').forEach(el=>el.classList.remove('drop-target','suggested-slot','return-target'));}
function suggestSlot(event:Event) {
  if(pointer?.active)return;
  clearDropHints();
  if((event.target as Element).closest('[data-op]:not(:disabled):not([data-return])'))document.querySelector(`[data-insert="${insertionIndex??railSlots.indexOf(null)}"]`)?.classList.add('suggested-slot');
}
$('palette').addEventListener('pointerover',suggestSlot);$('palette').addEventListener('focusin',suggestSlot);
$('palette').addEventListener('pointerleave',()=>{if(!pointer?.active)clearDropHints();});$('palette').addEventListener('focusout',()=>{if(!pointer?.active)clearDropHints();});
function dropSlotAt(x:number,y:number):HTMLElement|undefined {
  const pipeline=$('construction').querySelector<HTMLElement>('.pipeline');if(!pipeline)return;
  const bounds=pipeline.getBoundingClientRect();
  if(x<bounds.left||x>bounds.right||y<bounds.top-8||y>bounds.bottom+12)return;
  const slots=[...pipeline.querySelectorAll<HTMLElement>('[data-cell]')].filter(el=>{
    const r=el.getBoundingClientRect(),zone=el.closest('.rail-slots')?.getBoundingClientRect();
    return r.right>Math.max(bounds.left,zone?.left??bounds.left)&&r.left<Math.min(bounds.right,zone?.right??bounds.right)&&(!zone||y>=zone.top&&y<=zone.bottom);
  });
  return slots.sort((a,b)=>Math.abs(a.getBoundingClientRect().left+a.offsetWidth/2-x)-Math.abs(b.getBoundingClientRect().left+b.offsetWidth/2-x))[0];
}
function overRail(x:number,y:number) {
  const r=$('construction').getBoundingClientRect();
  return x>=r.left-8&&x<=r.right+8&&y>=r.top-12&&y<=r.bottom+12;
}
$('playground').addEventListener('pointerdown',event=>{
  if(cancelledPointer!==undefined){cancelledPointer=undefined;suppressClick=false;}
  if(event.button!==0||pointer||!initialized||pending)return;
  const target=event.target as Element,element=target.closest<HTMLElement>('[data-op],[data-part],[data-empty]');
  if(!element||(element as HTMLButtonElement).disabled)return;
  if(choiceActive())return;
  if(element.dataset.return)return;
  // A browser text selection must never turn a piece pickup into native text dragging.
  event.preventDefault();window.getSelection()?.removeAllRanges();
  const button=target.closest<HTMLElement>('button')||element;
  button.focus({preventScroll:true});button.setPointerCapture(event.pointerId);
  pointer={x:event.clientX,y:event.clientY,pointerId:event.pointerId,element,active:false};
});
document.addEventListener('pointermove',event=>{
  if(!pointer||event.pointerId!==pointer.pointerId)return;
  if(!pointer.active&&Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>9){
    pointer.active=true;suppressClick=true;drag={op:pointer.element.dataset.op as Op|undefined,id:pointer.element.dataset.part,empty:pointer.element.dataset.empty===undefined?undefined:Number(pointer.element.dataset.empty)};
    const op=drag.op||state!.nodes.find(n=>n.id===drag!.id)?.op;
    ghost=document.createElement('div');ghost.className=`drag-ghost ${op?OPS[op].color:'empty-ghost'}`;ghost.setAttribute('aria-hidden','true');
    ghost.innerHTML=`<span class="piece-grip">${icon('grip',14)}</span>${op?`<span class="part-formula">${operationTex(op)}</span>`:icon('plus',18)}`;
    document.body.append(ghost);pointer.element.classList.add('dragging');$('playground').classList.add('is-dragging');
    if(drag.id)palette();
    $('move-announcement').textContent=`Moving ${op?OPS[op].name:'empty slot'}. Drop into the recipe${drag.id?' or outside it to return the block to its stack':''}; Escape cancels.`;
  }
  if(pointer.active){
    event.preventDefault();ghost!.style.left=`${event.clientX}px`;ghost!.style.top=`${event.clientY}px`;
    const pipeline=$('construction').querySelector<HTMLElement>('.pipeline')!,r=pipeline.getBoundingClientRect();
    if(event.clientY>=r.top-12&&event.clientY<=r.bottom+12)pipeline.scrollLeft+=event.clientX<r.left+28?-14:event.clientX>r.right-28?14:0;
    clearDropHints();const slot=dropSlotAt(event.clientX,event.clientY),returning=!!drag?.id&&!overRail(event.clientX,event.clientY);
    slot?.classList.add('drop-target');ghost!.classList.toggle('over-slot',!!slot);ghost!.classList.toggle('over-return',returning);
    if(returning){const op=state!.nodes.find(n=>n.id===drag!.id)!.op;document.querySelector(`[data-op="${op}"]`)?.classList.add('return-target');}
  }
},{passive:false});
// Suppress the browser's touch gesture once a piece is picked up. Otherwise a
// completed drag can consume the next tap as the end of a scrolling gesture.
$('playground').addEventListener('touchmove',event=>{if(pointer?.active)event.preventDefault();},{passive:false});
document.addEventListener('dragstart',event=>{if((event.target as Element).closest('.ingredient,.recipe-part'))event.preventDefault();});
function settleGhost(floating:HTMLElement,rect:DOMRect,accepted:boolean,target?:HTMLElement) {
  if(reduced){floating.remove();return;}
  // Aim at the accepted block/stack after layout and scrolling, never the old plus.
  floating.classList.add('settling');
  const duration=accepted?240:180;
  const animation=floating.animate([
    {left:floating.style.left,top:floating.style.top,transform:getComputedStyle(floating).transform,opacity:1},
    {left:`${rect.left+rect.width/2}px`,top:`${rect.top+rect.height/2}px`,width:`${rect.width}px`,height:`${rect.height}px`,transform:'translate(-50%,-50%)',opacity:0}
  ],{duration,easing:'cubic-bezier(.2,.7,.25,1)',fill:'forwards'});
  if(target&&accepted)target.animate([{opacity:.25},{opacity:1}],{duration,easing:'ease-in'});
  void animation.finished.catch(()=>{}).then(()=>floating.remove());
}
function finishPointer(event?:PointerEvent,cancel=false){
  if(!pointer){if(event?.pointerId===cancelledPointer){cancelledPointer=undefined;setTimeout(()=>suppressClick=false,0);}return;}
  if(event&&event.pointerId!==pointer.pointerId)return;
  if(cancel&&!event&&pointer.active)cancelledPointer=pointer.pointerId;
  const slot=pointer.active&&!cancel&&event?dropSlotAt(event.clientX,event.clientY):undefined;
  const returning=pointer.active&&!cancel&&event&&drag?.id&&!overRail(event.clientX,event.clientY);
  const op=drag?.op||state?.nodes.find(n=>n.id===drag?.id)?.op;
  const transfer=returning?{id:'',work:perform({type:'remove',id:drag!.id},'push',railSlots.map(id=>id===drag!.id?null:id))}:slot?drop(Number(slot.dataset.cell)):undefined;
  const floating=ghost,origin=pointer.element.getBoundingClientRect();
  if(floating&&pointer.active){
    if(transfer?.work){
      floating.classList.add('awaiting-acceptance');
      void transfer.work.then(accepted=>{
        const target=accepted?document.querySelector<HTMLElement>(returning?`[data-op="${op}"]`:'cell' in transfer?`[data-empty="${transfer.cell}"]`:`[data-part="${transfer.id}"]`):undefined;
        if(target){
          target.classList.remove('just-placed');target.getAnimations().forEach(animation=>animation.cancel());
          revealRailCell(target);
          if(returning)$('move-announcement').textContent=`${OPS[op!].name} returned to its stack.`;
        }
        settleGhost(floating,target?.getBoundingClientRect()||origin,!!target,target||undefined);
      });
    }else settleGhost(floating,origin,false);
  }else floating?.remove();
  if(pointer.active&&!transfer?.work)$('move-announcement').textContent='Move cancelled.';
  const hadPlacedBlock=!!drag?.id;
  pointer.element.classList.remove('dragging');ghost=undefined;pointer=undefined;drag=undefined;
  if(hadPlacedBlock)palette();
  $('playground').classList.remove('is-dragging');clearDropHints();if(cancelledPointer===undefined)setTimeout(()=>suppressClick=false,0);
}
document.addEventListener('pointerup',event=>finishPointer(event));document.addEventListener('pointercancel',event=>finishPointer(event,true));
window.addEventListener('blur',()=>finishPointer(undefined,true));

const referenceOrigins=new WeakMap<HTMLDialogElement,{focus:ReturnType<typeof rememberFocus>;native:Element|null}>();
const open=(id:string,returnId='menu-open',origin?:ReturnType<typeof rememberFocus>)=>{
  cancelCirclePickup();if(pointer)finishPointer(undefined,true);closeDialogs();
  if(!restoreFocus(origin))$(returnId).focus({preventScroll:true});
  const dialog=$<HTMLDialogElement>(id),native=document.activeElement;
  if(origin)referenceOrigins.set(dialog,{focus:origin,native});else referenceOrigins.delete(dialog);
  dialog.showModal();
  if(!dialog.querySelector('[autofocus]')) {
    const back=dialog.querySelector<HTMLElement>('.dialog-top button');
    const keyboard=document.documentElement.dataset.focusModality==='keyboard';
    if(keyboard&&back) {
      back.focus({preventScroll:true});
      // WebKit can defer focusability until after showModal. Never override a
      // subsequent input or the more specific Back-to-origin restoration.
      requestAnimationFrame(()=>{if(dialog.open&&document.activeElement===dialog&&document.documentElement.dataset.focusModality==='keyboard')back.focus({preventScroll:true});});
    } else dialog.focus({preventScroll:true});
  }
};
for(const id of ['hints-dialog','ideas-dialog'])$(id).addEventListener('close',()=>{
  // Native dialog return handles the usual case. An accepted edit may have
  // replaced the originating block while the reference was opening; resolve
  // that same logical control without overriding a deliberate view change.
  const dialog=$<HTMLDialogElement>(id),origin=referenceOrigins.get(dialog);
  const restore=()=>{
    if(document.querySelector('dialog[open]')||document.activeElement!==document.body&&document.activeElement!==origin?.native&&!dialog.contains(document.activeElement))return true;
    return restoreFocus(origin?.focus);
  };
  if(origin&&!restore())requestAnimationFrame(restore);
});
document.querySelectorAll<HTMLDialogElement>('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();const e=event as MouseEvent;if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}}));
for(const [button,dialog] of [['help-open','help-dialog'],['menu-open','menu-dialog'],['settings-open','settings-dialog']])$(button).onclick=()=>open(dialog);
$('puzzles-open').onclick=()=>{if(!initialized)return;renderLevels();open('puzzles-dialog');};
function openNotes(origin?:ReturnType<typeof rememberFocus>) {if(!state)return;open('ideas-dialog','ideas-open',origin);shapeNotes.show(state.mode==='puzzle'?state.sourceId:0);}
function openHints(origin?:ReturnType<typeof rememberFocus>) {if(!state||!result||state.mode!=='puzzle'||introActive()||isDiscovery(state))return;hintOffered=true;hintCue=false;$('hints-open').classList.remove('hint-cue');$('hints-content').innerHTML=puzzleHints(state,result);open('hints-dialog','hints-open',origin);}
$('ideas-open').onclick=()=>openNotes();
$('hints-open').onclick=()=>openHints();
$('hints-content').onclick=event=>{
  const target=event.target as Element,button=target.closest<HTMLButtonElement>('#hint-more-toggle');
  if(button)revealHintSpoiler(button,$('hint-extra'));
  const sketchButton=target.closest<HTMLButtonElement>('#hint-sketch-toggle');
  if(sketchButton&&state) {
    const panel=$('hint-sketch'),revealed=revealHintSpoiler(sketchButton,panel);
    if(revealed&&!panel.dataset.loaded) {
      const source=state.sourceId;panel.dataset.loaded='loading';panel.setAttribute('aria-busy','true');panel.innerHTML='<p class="notes-loading">Opening the sketch…</p>';
      void shapeNotes.hintSketch(source).then(html=>{
        if(panel.isConnected&&state?.sourceId===source){panel.innerHTML=html;panel.dataset.loaded='true';}
      }).catch(()=>{if(panel.isConnected){delete panel.dataset.loaded;panel.innerHTML='<p>The sketch could not load. Close and reopen it to try again.</p>';}}).finally(()=>panel.setAttribute('aria-busy','false'));
    }
  }
  if(target.closest('#hint-notes'))openNotes(referenceOrigins.get($<HTMLDialogElement>('hints-dialog'))?.focus);
};
$('menu-version').onclick=()=>open('releases-dialog','menu-version');
$('ending-create').onclick=()=>$('nav-create').click();
function showGarden(returnId:string,revealSource?:number,parent?:string) {
  const origin=revealSource&&!reduced?gardenOrigin($('scene').querySelector<SVGPathElement>('#flight-trail,.flow-machine:last-child .flow-curve')):undefined;
  const back=$<HTMLButtonElement>('garden-back');
  back.type=parent?'button':'submit';
  back.setAttribute('aria-label',parent?'Back to puzzle list':'Back to game');back.title=parent?'Back to puzzle list':'Back to game';
  if(parent){back.dataset.back=returnId;back.dataset.backDialog=parent;}
  else {delete back.dataset.back;delete back.dataset.backDialog;}
  open('garden-dialog',parent?'menu-open':returnId);void garden.open(completed,revealSource,origin);
}
$('ending-garden').onclick=()=>showGarden('ending-garden');
$('picture-open').onclick=()=>showGarden('picture-open');
$('garden-dialog').addEventListener('close',()=>{if(!$<HTMLDialogElement>('garden-dialog').open)garden.close();});
$('ending-revisit').onclick=()=>{renderLevels();open('puzzles-dialog');};
$('reset-progress-open').onclick=()=>{$('reset-progress-error').hidden=true;open('reset-progress-dialog');};
$('reset-progress-confirm').onclick=async()=>{
  const confirm=$<HTMLButtonElement>('reset-progress-confirm'),cancel=$<HTMLButtonElement>('reset-progress-cancel');
  confirm.disabled=true;cancel.disabled=true;
  const reset=await serial(async()=>{
    const reply=await kernel.run(undefined,{type:'level',sourceId:1,mode:'puzzle'});requireOk(reply);
    completed=new Set();window.history.replaceState(null,'',location.pathname+location.search);
    accept(reply,'clear');return true;
  });
  confirm.disabled=false;cancel.disabled=false;
  if(reset){closeDialogs();requestAnimationFrame(()=>focusGameControl());$('move-announcement').textContent='Puzzle progress reset. Chapter 1 is ready.';}
  else {$('reset-progress-error').textContent=notice.text;$('reset-progress-error').hidden=false;}
};
$('leave-dialog').addEventListener('close',()=>{leaveAction=undefined;});
$('leave-discard').onclick=()=>{const action=leaveAction;leaveAction=undefined;closeDialogs();if(action)void action();};
$('leave-save').onclick=async()=>{
  const action=leaveAction;if(!action)return;
  const save=$<HTMLButtonElement>('leave-save'),discard=$<HTMLButtonElement>('leave-discard');
  save.disabled=true;discard.disabled=true;
  const saved=await saveRecipe($<HTMLInputElement>('leave-name').value);
  save.disabled=false;discard.disabled=false;
  if(saved&&leaveAction===action){leaveAction=undefined;closeDialogs();void action();}
  else if(!saved){$('leave-error').textContent=notice.text;$('leave-error').hidden=false;}
};
document.querySelectorAll<HTMLElement>('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon!,el.matches('.menu-art,.help-art')?32:18));
renderBrand(document.querySelector<HTMLElement>('.brand')!);
$('axis-help').innerHTML=`The dashed ${operationTex()} in a block stands for its input. ${tex('x')} is horizontal position and ${tex('h')} is height. An equation such as ${tex('h=x')} describes the path; ${tex('h^2=x')} can describe two heights at one position. The blocks shape the path; throwing speed does not affect the result.`;
$<HTMLInputElement>('motion-toggle').checked=reduced;document.body.classList.toggle('reduced-motion',reduced);
$<HTMLInputElement>('motion-toggle').onchange=()=>{reduced=$<HTMLInputElement>('motion-toggle').checked;document.body.classList.toggle('reduced-motion',reduced);preferences();if(reduced&&(flight.phase==='flying'||flight.phase==='releasing'))finishFlight();render();};
function reflectCharacterShortcuts() {
  document.documentElement.dataset.characterShortcuts=String(characterShortcuts);
  $<HTMLInputElement>('character-shortcuts').checked=!characterShortcuts;
  for(const [id,key] of [['hints-open','H'],['ideas-open','N'],['help-open','?'],['tab-flight','Z'],['tab-function','X'],['tab-flow','C']]) {
    if(characterShortcuts)$(id).setAttribute('aria-keyshortcuts',key);else $(id).removeAttribute('aria-keyshortcuts');
  }
  for(const button of $('palette').querySelectorAll<HTMLButtonElement>('[data-op]')) {
    const base=!choiceActive()&&!button.dataset.return?'ArrowUp Space':'Space';
    button.setAttribute('aria-keyshortcuts',[base,characterShortcuts?button.dataset.shortcut:''].filter(Boolean).join(' '));
  }
}
reflectCharacterShortcuts();
$<HTMLInputElement>('character-shortcuts').onchange=()=>{characterShortcuts=!$<HTMLInputElement>('character-shortcuts').checked;reflectCharacterShortcuts();preferences();};


let sharingArtifact: Artifact | {schema:number;type:string;sourceId:number;view:View} | undefined;
let shareVersion=0;
const compact = (value: unknown) => {const bytes=new TextEncoder().encode(JSON.stringify(value));return btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');};
function decode(text:string):unknown {if(text.length>90000)throw new Error('This shared file is too large.');const normalized=text.replace(/-/g,'+').replace(/_/g,'/');const bytes=Uint8Array.from(atob(normalized),c=>c.charCodeAt(0));if(bytes.length>65536)throw new Error('Files must be smaller than 64 KiB.');return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
async function updateShare() {
  if(!state)return;
  const version=++shareVersion;
  const kind=$<HTMLSelectElement>('share-kind').value;
  $('share-message').textContent='';$('share-link').textContent='';$<HTMLTextAreaElement>('share-link').value='Preparing your link…';
  sharingArtifact=undefined;($('copy-link') as HTMLButtonElement).disabled=true;($('download-artifact') as HTMLButtonElement).disabled=true;
  const payload=await serial(async()=>{
    if(kind==='level'&&state?.mode==='puzzle')return {schema:1,type:'level',sourceId:state.sourceId,view};
    const reply=await kernel.run(state,{type:'export',kind:kind==='challenge'?'challenge':'creation',view});requireOk(reply);return reply.artifact!;
  });
  if(version!==shareVersion)return;
  if(!payload){$<HTMLTextAreaElement>('share-link').value='';$('share-message').textContent=notice.text;return;}
  sharingArtifact=payload;
  const url=new URL(location.pathname,location.origin);
  url.hash=payload.type==='level'?`level=${payload.sourceId}&view=${view}`:`v1=${compact(payload)}`;
  const tooLarge=url.href.length>8192;
  $<HTMLTextAreaElement>('share-link').value=tooLarge?'This recipe needs a file to travel. Use Download JSON.':url.href;
  ($('copy-link') as HTMLButtonElement).disabled=tooLarge;($('download-artifact') as HTMLButtonElement).disabled=false;$('download-artifact').hidden=!tooLarge;
  $('share-description').textContent=kind==='level'?'A fresh start on this puzzle.':kind==='challenge'?'Your flight sets their targets. Your recipe stays hidden.':'Your construction, ready to change.';
}
$('share-open').onclick=()=>{const option=$<HTMLSelectElement>('share-kind').options[0];option.disabled=state?.mode!=='puzzle';$<HTMLSelectElement>('share-kind').value=state?.mode==='puzzle'?'level':'creation';open('share-dialog');void updateShare();};
$<HTMLSelectElement>('share-kind').onchange=()=>void updateShare();
$('copy-link').onclick=async()=>{try{await navigator.clipboard.writeText($<HTMLTextAreaElement>('share-link').value);$('share-message').textContent='Copied. A little curiosity is ready to travel.';}catch{$<HTMLTextAreaElement>('share-link').select();$('share-message').textContent='Select and copy the link above.';}};
function download(value:unknown,name:string){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('download-artifact').onclick=()=>{if(sharingArtifact)download(sharingArtifact,`angouri-${sharingArtifact.type}.json`);};
$('download-save').onclick=()=>{if(state)download({schema:1,type:'save',state,slots:railSlots,completed:[...completed],view},'angouri-progress.json');};
let renamingSeed:number|undefined;
function renderSeeds(){
  const dateFormat=new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'});
  const metadata=(s:Seed)=>{
    const saved=s.snapshot?.state,chapter=saved?chapterIndex(saved.sourceId):-1;
    const context=saved?.mode==='puzzle'?chapter<0?'Puzzle':`Puzzle ${puzzleLabel(saved.sourceId)}`:saved?.mode==='challenge'?'Shared challenge':'Create';
    const date=typeof s.savedAt==='string'?new Date(s.savedAt):undefined;
    const when=date&&Number.isFinite(date.getTime())?`<time datetime="${date.toISOString()}">${escape(dateFormat.format(date))}</time>`:'<span>Date unavailable</span>';
    return `<span class="favorite-meta"><span class="favorite-context">${context}</span><span aria-hidden="true">·</span>${when}</span>`;
  };
  $('favorites-list').innerHTML=seeds.length?seeds.map((s,i)=>{
    const meta=metadata(s);
    if(renamingSeed===i)return `<form class="favorite-row favorite-edit" data-rename-form="${i}"><div class="favorite-info"><label for="rename-seed">Recipe name</label><input id="rename-seed" type="text" maxlength="60" required value="${escape(s.name)}" aria-describedby="rename-error">${meta}</div><div class="favorite-actions"><button type="button" class="button" data-cancel-rename="${i}">Cancel</button><button class="button primary" type="submit">${icon('check',16)} Save name</button></div><p id="rename-error" class="reset-progress-error" role="alert" hidden></p></form>`;
    return `<div class="favorite-row"><div class="favorite-info"><span class="favorite-name">${escape(s.name)}</span>${meta}</div><div class="favorite-actions"><button class="button" data-seed="${i}" aria-label="Open ${escape(s.name)}">${icon('folder',16)} Open</button><button class="icon-button" data-rename-seed="${i}" aria-label="Rename ${escape(s.name)}" title="Rename">${icon('rename',16)}</button><button class="icon-button" data-delete-seed="${i}" aria-label="Delete ${escape(s.name)}" title="Delete">${icon('trash',16)}</button></div></div>`;
  }).join(''):deletedSeeds.length?'':`<div class="empty-library">${icon('folder',32)}<p>Your saved recipes appear here.</p></div>`;
  if(deletedSeeds.length)$('favorites-list').insertAdjacentHTML('beforeend',`<section class="deleted-seeds" aria-labelledby="deleted-seeds-title"><h3 id="deleted-seeds-title">Recently deleted</h3>${deletedSeeds.map((seed,i)=>`<div class="deleted-seed-row"><div class="favorite-info"><span class="deleted-seed-name">${escape(seed.name)}</span>${metadata(seed)}</div><button class="button" data-restore-seed="${i}" aria-label="Undo deletion of ${escape(seed.name)}">${icon('undo',16)} Undo</button></div>`).join('')}</section>`);
}
$('library-open').onclick=()=>{renamingSeed=undefined;$('library-error').hidden=true;renderSeeds();open('library-dialog');};
function saveRecipe(name:string) {
  return serial(async()=>{
    if(!state)return;
    if(seeds.length>=12)throw new Error('Your library is full. Delete a saved recipe to make room. Its Undo stays available in Save & open.');
    const reply=await kernel.run(state,{type:'export',kind:'creation',view});requireOk(reply);
    const next=[...seeds,{name:name.trim().slice(0,60)||'My next great throw',artifact:reply.artifact!,snapshot:{state:clone(state),slots:[...railSlots]},view,savedAt:new Date().toISOString()}];
    if(!writeLibrary(next))throw new Error('Could not save on this device. Keep this recipe open and export progress from Save & open.');
    seeds=next;notice={text:'',kind:''};showNotice();renderSeeds();return true;
  });
}
$('seed-save').onsubmit=async event=>{
  event.preventDefault();if(!initialized)return;
  const save=$<HTMLButtonElement>('favorite-save');if(save.getAttribute('aria-disabled')==='true')return;
  $('library-error').hidden=true;save.setAttribute('aria-disabled','true');$('seed-save').setAttribute('aria-busy','true');
  const saved=await saveRecipe($<HTMLInputElement>('seed-name').value);
  save.removeAttribute('aria-disabled');$('seed-save').removeAttribute('aria-busy');
  if(saved)$<HTMLInputElement>('seed-name').value='';
  else {$('library-error').textContent=notice.text;$('library-error').hidden=false;}
};
function openSeed(seed:Seed) {
  if(!seed.snapshot)return importData(seed.artifact);
  return serial(async()=>{
    const saved=parseSave({schema:1,type:'save',state:seed.snapshot!.state,slots:seed.snapshot!.slots,view:seed.view||view,completed:[...completed]});
    const reply=await kernel.run(saved.state,{type:'evaluate'});requireOk(reply);
    accept(reply,'clear',saved.slots,saved.view);preferences();return true;
  });
}
function finishRename(index:number) {
  renamingSeed=undefined;renderSeeds();
  $('favorites-list').querySelector<HTMLButtonElement>(`[data-rename-seed="${index}"]`)?.focus({preventScroll:true});
}
function libraryRowError(button:HTMLElement,text:string) {
  const row=button.closest('.favorite-row,.deleted-seed-row')!;
  let message=row.querySelector<HTMLElement>('.favorite-error');
  if(!message){message=document.createElement('p');message.className='favorite-error reset-progress-error';message.setAttribute('role','alert');row.append(message);}
  message.textContent=text;
}
$('favorites-list').onclick=event=>{
  const b=(event.target as Element).closest<HTMLElement>('button');if(!b)return;
  if(b.dataset.renameSeed!==undefined){
    renamingSeed=Number(b.dataset.renameSeed);renderSeeds();
    const input=$<HTMLInputElement>('rename-seed');input.focus({preventScroll:true});input.select();
  }
  if(b.dataset.cancelRename!==undefined)finishRename(Number(b.dataset.cancelRename));
  if(b.dataset.deleteSeed!==undefined){
    const index=Number(b.dataset.deleteSeed),next=seeds.filter((_,i)=>i!==index);
    const removed={...seeds[index],deletedAt:new Date().toISOString(),deletedIndex:index},deleted=[removed,...deletedSeeds];
    if(writeLibrary(next,deleted)){
      seeds=next;deletedSeeds=deleted;renamingSeed=undefined;$('library-error').hidden=true;notice={text:'',kind:''};showNotice();renderSeeds();
      $('favorites-list').querySelector<HTMLButtonElement>('[data-restore-seed="0"]')!.focus();
      $('library-status').textContent=`${removed.name} deleted. Undo stays available in Recently deleted.`;
    }
    else libraryRowError(b,'Could not delete on this device. Your saved recipe is still here.');
  }
  if(b.dataset.restoreSeed!==undefined){
    if(seeds.length>=12){libraryRowError(b,'Your library is full. Delete another saved recipe, then retry Undo.');return;}
    const index=Number(b.dataset.restoreSeed),{deletedAt,deletedIndex,...seed}=deletedSeeds[index];
    const position=Number.isInteger(deletedIndex)?Math.max(0,Math.min(deletedIndex,seeds.length)):seeds.length;
    const next=[...seeds.slice(0,position),seed,...seeds.slice(position)],deleted=deletedSeeds.filter((_,i)=>i!==index);
    if(writeLibrary(next,deleted)){
      seeds=next;deletedSeeds=deleted;renamingSeed=undefined;$('library-error').hidden=true;notice={text:'',kind:''};showNotice();renderSeeds();
      $('favorites-list').querySelector<HTMLButtonElement>(`[data-seed="${position}"]`)!.focus();
      $('library-status').textContent=`${seed.name} restored.`;
    }
    else libraryRowError(b,'Could not restore on this device. Your recipe is still available here; try Undo again.');
  }
  if(b.dataset.seed!==undefined){const seed=seeds[Number(b.dataset.seed)];changeWorkspace(()=>openSeed(seed).then(ok=>{if(ok)closeDialogs();}),seed.name);}
};
$('favorites-list').addEventListener('submit',event=>{
  const form=(event.target as Element).closest<HTMLFormElement>('[data-rename-form]');if(!form)return;
  event.preventDefault();
  const index=Number(form.dataset.renameForm),input=$<HTMLInputElement>('rename-seed'),name=input.value.trim();
  const fail=(message:string)=>{$('rename-error').textContent=message;$('rename-error').hidden=false;input.focus({preventScroll:true});};
  if(!name){fail('Enter a recipe name.');return;}
  const next=seeds.map((seed,i)=>i===index?{...seed,name}:seed);
  if(!writeLibrary(next)){fail('Could not save the name on this device. Try again.');return;}
  seeds=next;finishRename(index);$('move-announcement').textContent=`Recipe renamed to ${name}.`;
});
$('favorites-list').addEventListener('keydown',event=>{
  if(event.key==='Escape'&&renamingSeed!==undefined){event.preventDefault();event.stopPropagation();finishRename(renamingSeed);}
});
function parseSave(value:unknown) {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Choose an Angouri JSON file.');
  const data={...value,view:canonicalView((value as Record<string,unknown>).view)} as Record<string,unknown>;
  if(data.schema!==1||data.type!=='save'||Object.keys(data).some(k=>!['schema','type','state','slots','completed','view','entry'].includes(k))||data.entry!==undefined&&(typeof data.entry!=='string'||data.entry.length>8192))throw new Error('Unsupported progress file.');
  if(!Array.isArray(data.completed)||data.completed.length>LEVELS.length||!data.completed.every(n=>Number.isInteger(n)&&n>=1&&n<=LEVELS.length)||!isView(data.view)||!data.state)throw new Error('The progress file has invalid fields.');
  if(data.slots!==undefined&&(!Array.isArray(data.slots)||data.slots.length>65||!data.slots.every(id=>id===null||typeof id==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(id))))throw new Error('The saved recipe slots are invalid.');
  return {state:data.state as State,slots:data.slots as RailSlots|undefined,completed:data.completed as number[],view:data.view};
}
function importData(value:unknown,{onEngineFailure,keepDialogs=false}:{onEngineFailure?:(failure:Error)=>void;keepDialogs?:boolean}={}) {
  return serial(async()=>{
    const run=async(snapshot:State|undefined,action:Action)=>{
      let reply:Response;
      try {reply=await kernel.run(snapshot,action);}
      catch(e){onEngineFailure?.(e instanceof Error?e:new Error(String(e)));throw e;}
      if(reply.status==='error')onEngineFailure?.(new Error(reply.message||'The math engine could not open this recipe. Try again.'));
      return reply;
    };
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Choose an Angouri JSON file.');
    const data={...value,view:canonicalView((value as Record<string,unknown>).view)} as Record<string,unknown>;
    if(data.type==='save'){const save=parseSave(data);const reply=await run(save.state,{type:'evaluate'});requireOk(reply);completed=new Set(save.completed);accept(reply,'clear',save.slots,save.view);}
    else if(data.type==='level'){
      if(data.schema!==1||Object.keys(data).some(k=>!['schema','type','sourceId','view'].includes(k))||!isView(data.view))throw new Error('Unsupported puzzle link file.');
      const reply=await run(undefined,{type:'level',sourceId:data.sourceId,mode:'puzzle'});requireOk(reply);accept(reply,'clear',undefined,data.view);
    } else {const reply=await run(state,{type:'import',artifact:data});requireOk(reply);accept(reply,'clear',undefined,isView(data.view)?data.view:undefined);}
    if(!keepDialogs)closeDialogs();preferences();return true;
  });
}
$('import-open').onclick=()=>{closeDialogs();$<HTMLInputElement>('import-file').click();};
$<HTMLInputElement>('import-file').onchange=async()=>{const file=$<HTMLInputElement>('import-file').files?.[0];if(!file)return;try{if(file.size>65536)throw new Error('Files must be smaller than 64 KiB.');await importData(JSON.parse(await file.text()));}catch(e){error(e instanceof Error?e.message:'Could not open this file.');}finally{$<HTMLInputElement>('import-file').value='';}};
async function start() {
  palette();
  const saved=read(SAVE);
  // A new deep link replaces the open workspace, not the chapter record.
  if(saved)try {completed=new Set(parseSave(saved).completed);}catch {/* Invalid saves are handled below. */}
  let opened=false;
  const openInitial=async(value:unknown)=>{
    let failure:Error|undefined;
    const opened=!!await importData(value,{onEngineFailure:error=>{failure=error;},keepDialogs:true});
    // A worker failure says nothing about the validity of the saved workspace.
    // Retry it intact; only invalid input may fall through to a fresh puzzle.
    if(failure)throw failure;
    return opened;
  };
  try {
    const fragment=new URLSearchParams(location.hash.slice(1));
    if(saved&&typeof saved==='object'&&(saved as {entry?:unknown}).entry===location.hash&&location.hash)opened=await openInitial(saved);
    if(!opened&&fragment.has('v1'))opened=await openInitial(decode(fragment.get('v1')!));
    else if(!opened&&fragment.has('level')) {
      const sourceId=Number(fragment.get('level'));
      opened=await openInitial({schema:1,type:'level',sourceId,view:isView(fragment.get('view'))?fragment.get('view'):'flight'});
      // A known puzzle can fail to load transiently. Keep its link and the
      // existing save recoverable instead of accepting puzzle 1 over them.
      if(!opened&&Number.isInteger(sourceId)&&sourceId>=1&&sourceId<=LEVELS.length)
        throw new Error(notice.text||'The requested puzzle could not load. Try again.');
    }
    else if(!opened&&saved)opened=await openInitial(saved);
    if(!opened){const reply=await kernel.run(undefined,{type:'evaluate'});accept(reply,'clear');if(saved||location.hash)error('The saved or shared file could not be opened. A fresh puzzle is ready.');}
  }catch(e){$('scene').innerHTML=`<div class="loading-scene"><img src="./favicon.svg" width="56" height="56" alt=""><p>Getting ready to throw.</p><small>${escape(e instanceof Error?e.message:String(e))}</small><button id="retry-engine" class="button primary">Try again</button></div>`;$('retry-engine').onclick=()=>{kernel.restart();void start();};error('The math engine is unavailable. Your saved progress is still on this device.');}
}
void start();
window.addEventListener('hashchange',()=>{
  try {
    const fragment=new URLSearchParams(location.hash.slice(1));
    if(fragment.has('v1'))void importData(decode(fragment.get('v1')!));
    else if(fragment.has('level'))void importData({schema:1,type:'level',sourceId:Number(fragment.get('level')),view:isView(fragment.get('view'))?fragment.get('view'):'flight'});
  }catch(e){error(e instanceof Error?e.message:'Could not open this shared link.');}
});
// Read-only diagnostics for reproducible loading/latency/recovery checks.
Object.defineProperty(window,'angouri',{value:{get state(){return clone(state);},get slots(){return [...railSlots];},get result(){return clone(result);},get view(){return view;},get flight(){return clone(flight);},get history(){return {undo:undo.length,redo:redo.length};},get measurements(){return clone(kernel.measurements);},restart:()=>kernel.restart(),whenIdle:()=>chain}});
