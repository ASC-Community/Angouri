import './style.css';
import './play.css';
import './crop.css';
import { CropEditor, cropControl, cropEdited, updateCropWindow, probePoints } from './crop';
import { renderBrand } from './brand';
import { Kernel } from './engine';
import { completionRecord, deviceDatabase, DeviceStorageError, mergeCompletions, mutateLibrary, parseStored, readLibrary, seedStorageLimit, StorageTransactions, type CompletionRecord, type DeletedSeed, type LibraryMutation, type Seed, type Snapshot } from './persistence';
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
import { functionView, flow, cropFlowPath, cucumberPose, interpolate, launcherPose, operationTex, path, sizeFlightAnnotations, sizeFlowAnnotations, tex, transform, updateFlowProbe, updateFlowCrop, flightView, type Camera, type Flight } from './views';
import { targetStatus, updateTarget } from './target-presentation';
import { CHAPTERS, chapterIndex, CURVES, curveId, sourceInfo, escape, EXTRA_PUZZLES, GEOMETRY_PUZZLES, MIXED_PUZZLES, OPTIONAL_PUZZLES, fraction, targetHeight, isCapstone, isCircleSource, isMastery, isPicture, LEVELS, OPS, PUZZLE_ORDER, puzzleLabel, type Action, type Artifact, type Circle, type Op, type Response, type Result, type State, type View } from './types';

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
const failedStorage=new Set<string>();
// The exact primary progress bytes that this page must not replace: unreadable
// or unsupported data, a kernel-rejected workspace, a restore still in flight or
// temporarily unavailable, or an unread primary (raw undefined). Neither
// progress writer may replace it; play continues as a session-only draft.
// A deliberate change archives known bytes once, under the candidate's stable
// backup key, in the same transaction that replaces them.
type SaveCandidate={raw:string|undefined;status:'pending'|'unavailable'|'rejected'|'malformed'|'oversized'|'unsupported';reason:string;completion?:CompletionRecord;backup?:string};
let savedCandidate:SaveCandidate|undefined;
const protecting=()=>!!savedCandidate;
// Unread primary bytes cannot be archived, and a restore still in flight is not yet a failure.
const archivable=(candidate:SaveCandidate|undefined):candidate is SaveCandidate=>!!candidate&&candidate.raw!==undefined&&candidate.status!=='pending';
// Exact primary bytes this page may replace: its own committed write or bytes
// the kernel restored. Writers compare them inside each SAVE transaction.
let trustedRaw:string|undefined;
// Only a committed write of the latest progress revision, with no newer write
// queued, claims that progress is saved; never a preference or library write,
// or a verified restore under a newer draft.
let progressSaved=false,progressRevision=0,queuedSaves=0;
function renderStorageStatus() {
  $('save-status').innerHTML=protecting()?'Session only · Saved progress kept unchanged · Export to keep new play':failedStorage.size?'Session only · Export to keep your progress':queuedSaves?'Saving…':progressSaved?'<span class="status-dot"></span> Saved on this device':'Progress stays on this device';
}
function storageStatus(key:string,available:boolean) {
  if(available)failedStorage.delete(key);else failedStorage.add(key);
  renderStorageStatus();
}
function read(key: string,maxLength=65536): unknown {
  let s: string | null;
  try { s = localStorage.getItem(key); }
  catch { storageStatus(key,false); return undefined; }
  try {return s && s.length<=maxLength ? JSON.parse(s) : undefined;}catch{return undefined;}
}
function write(key: string, value: unknown) {
  let saved=true;
  try { localStorage.setItem(key,JSON.stringify(value)); }
  catch { saved=false; }
  storageStatus(key,saved);
  return saved;
}
const isView = (value: unknown): value is View => views.includes(value as View);
// Migrate the earlier view name without resetting existing recipes or preferences.
const canonicalView = (value: unknown) => value==='equations'?'function':value;
const preference = read(PREF) as {view?:unknown;motion?:unknown;characterShortcuts?:unknown} | undefined;
const preferredView=canonicalView(preference?.view);
let view: View = isView(preferredView) ? preferredView : 'flight';
const systemMotion=matchMedia('(prefers-reduced-motion: reduce)');
// An inferred default stays live; only the player's switch becomes a saved override.
let motionOverride=typeof preference?.motion==='boolean'?preference.motion:undefined;
let reduced=motionOverride??systemMotion.matches;
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
let railSlots:RailSlots=[];
let undo: Snapshot[] = [], redo: Snapshot[] = [];
let completed = new Set<number>();
let progressEpoch='legacy';
const pendingWins=new Map<number,string>();
let databaseFactory:IDBFactory|undefined;
try{databaseFactory=window.indexedDB;}catch{}
const storageTransactions=new StorageTransactions(databaseFactory,()=>localStorage);
let storageChannel:BroadcastChannel|undefined;
try{storageChannel=new BroadcastChannel(deviceDatabase);}catch{}
function announceStorage(key:string){try{storageChannel?.postMessage({key});}catch{}}
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
// Persist the URL of acknowledged play, never a newer link still being checked.
let acknowledgedEntry=location.hash;
type WorkspaceIntent={generation:number;entry:string};
let workspaceGeneration=0;
const currentIntent=(intent:WorkspaceIntent)=>intent.generation===workspaceGeneration;
function replaceEntry(entry:string){window.history.replaceState(window.history.state,'',location.pathname+location.search+entry);}
function beginWorkspaceChange(entry=acknowledgedEntry):WorkspaceIntent {
  const intent={generation:++workspaceGeneration,entry};
  const previous=leaveChange;leaveChange=undefined;previous?.cancel();
  if(previous)$<HTMLDialogElement>('leave-dialog').close();
  return intent;
}
// Only the latest navigation becomes the acknowledged workspace and its URL.
function acknowledge(intent:WorkspaceIntent){acknowledgedEntry=intent.entry;replaceEntry(acknowledgedEntry);}
// Superseded work yields nothing, and its failures cannot replace newer feedback.
async function owned<T>(intent:WorkspaceIntent,work:Promise<T>):Promise<T|undefined> {
  try{const value=await work;return currentIntent(intent)?value:undefined;}
  catch(failure){if(currentIntent(intent))throw failure;return undefined;}
}
let chain = Promise.resolve();
let notice = {text:'Tap or drag a block.',kind:''};
let morphFrame=0, displayedPoints: Result['points'] | undefined,displayedSlope:number|undefined;
let clearCurveFade:(()=>void)|undefined,clearCurveEnds:(()=>void)|undefined;
function cancelCurveChange(settle=false) {
  cancelAnimationFrame(morphFrame);clearCurveFade?.();clearCurveFade=undefined;clearCurveEnds?.();clearCurveEnds=undefined;
  displayedPoints=undefined;displayedSlope=undefined;delete $('scene').dataset.curveTransition;
  if(settle&&state&&result&&displayedView()==='flight'){paintTrajectory(result.points);animatePosition();}
}
let seeds:Seed[]=[],deletedSeeds:DeletedSeed[]=[];
async function refreshLibrary(paint=false,owns=()=>true) {
  try {
    const library=readLibrary(parseStored(await storageTransactions.read(SEEDS),seedStorageLimit));
    if(!owns())return false;
    seeds=library.seeds;deletedSeeds=library.deleted;if(paint)renderSeeds();return true;
  }catch{if(owns())storageStatus(SEEDS,false);return false;}
}
async function changeLibrary(action:LibraryMutation) {
  let changed:Seed;
  try {
    changed=await storageTransactions.change(SEEDS,raw=>{
      const mutation=mutateLibrary(parseStored(raw,seedStorageLimit),action);
      return {raw:JSON.stringify(mutation.entries),result:mutation.changed!};
    });
  }catch(error){if(error instanceof DeviceStorageError)storageStatus(SEEDS,false);throw error;}
  storageStatus(SEEDS,true);announceStorage(SEEDS);await refreshLibrary();return changed;
}
const kernel = new Kernel((message)=> { notice={text:message,kind:'error'}; showNotice(); });
const shapeNotes = new ShapeNotes(kernel);
const garden = new Garden($('garden-content'),kernel,{reduced:()=>reduced,onFinish:()=>$('garden-back').click(),onBuild:(id:number)=>goToPuzzle(id),onRevealComplete:()=>{
  pictureCollecting=false;updatePrimary();
  if(gardenDoneFocus&&$<HTMLDialogElement>('garden-dialog').open&&document.hasFocus())$('garden-content').querySelector<HTMLButtonElement>('[data-garden-done]')?.focus({preventScroll:true});
  gardenDoneFocus=false;
}});
const circleCommit=(circle:Circle)=>serial(async()=>accept(await kernel.run(state,{type:'circle',...circle})),true);
const cancelCirclePickup=installCircleHandles($('scene'),()=>state?.circle&&result?.circle&&pending===0&&!['flying','releasing'].includes(flight.phase)?{state,result,camera}:undefined,circleCommit,async(snapshot,circle)=>{const reply=await kernel.run(snapshot,{type:'circle',...circle});return reply.status==='ok'?reply.result:undefined;});
let cropPlayback:{flight:Flight;won:boolean}|undefined;
let pictureCelebrated=false;
let pictureCollecting=false,gardenDoneFocus=false,gardenReturnSource:number|undefined;
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
    preview.checkpoints.forEach((checkpoint,i)=>updateTarget($('scene'),checkpoint,i,'waiting'));
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

function preferences() { write(PREF,{view,...(motionOverride===undefined?{}:{motion:motionOverride}),characterShortcuts}); }
// The latest readable completion record this tab adopted. A recovery of
// unreadable bytes keeps it rather than discarding acknowledged wins.
let acknowledgedCompletion:CompletionRecord={progressEpoch,completed:[]};
function adoptCompletions(record:CompletionRecord) {
  acknowledgedCompletion={progressEpoch:record.progressEpoch,completed:[...record.completed]};
  progressEpoch=record.progressEpoch;
  for(const [id,epoch] of pendingWins)if(epoch!==progressEpoch)pendingWins.delete(id);
  completed=new Set([...record.completed,...pendingWins.keys()]);
}
// An absent record has no completions; otherwise read only fields shaped as a
// supported save writes them. Opaque or foreign values never clear completions.
function readableCompletion(value:unknown):CompletionRecord|undefined {
  if(value===undefined)return completionRecord(undefined);
  if(!value||typeof value!=='object'||Array.isArray(value))return undefined;
  const {progressEpoch:epoch,completed:ids}=value as Record<string,unknown>;
  if(epoch!==undefined&&(typeof epoch!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(epoch)))return undefined;
  if(!Array.isArray(ids)||ids.length>LEVELS.length||!ids.every(id=>Number.isInteger(id)&&id>=1&&id<=LEVELS.length))return undefined;
  return completionRecord(value);
}
// Classify canonical bytes without normalizing them. Structural support is not
// proof that the kernel can restore the workspace.
function inspectSave(raw:string|null):{value?:unknown;failure?:Omit<SaveCandidate,'raw'>} {
  if(raw===null)return {};
  let value:unknown;
  try{value=parseStored(raw);}
  catch(failure){return {failure:{status:raw.length>65536?'oversized':'malformed',reason:failureMessage(failure)}};}
  const completion=readableCompletion(value);
  if(!value||typeof value!=='object'||Array.isArray(value))return {value,failure:{status:'unsupported',reason:'The saved progress is not a progress record.',completion}};
  try{parseSave(value);}catch(failure){return {value,failure:{status:'unsupported',reason:failureMessage(failure),completion}};}
  return {value};
}
function protectSave(candidate:SaveCandidate|undefined){savedCandidate=candidate;if(candidate)progressSaved=false;renderStorageStatus();}
// Readable metadata in newly protected bytes is the latest durable record:
// wins earned from now on belong to its epoch, while earlier ones stay stale.
// Callers adopt only bytes they have just read as canonical.
function protectVerified(candidate:SaveCandidate){protectSave(candidate);if(candidate.completion){adoptCompletions(candidate.completion);renderLevels();}}
// Unknown canonical bytes (another tab's write) are validated outside any
// transaction. A kernel rejection protects them; a temporary failure only
// fails this write, so the next one checks again.
async function verifySave(raw:string) {
  const {value,failure}=inspectSave(raw);
  if(failure){if(!savedCandidate)protectVerified({raw,...failure});return false;}
  let reply:Response;
  try{reply=await kernel.run(parseSave(value).state,{type:'evaluate'},'background');}catch{return false;}
  // Trust covers only these exact bytes; every writer compares them again in its transaction.
  if(reply.status==='ok'&&reply.state&&reply.result){trustedRaw=raw;return true;}
  if(reply.status==='error'||savedCandidate)return false;
  // While the kernel ran, another tab may have replaced these bytes and this
  // tab adopted the newer record. Only bytes still canonical are protected; a
  // failed check protects, trusts and adopts nothing.
  let current:string|null;
  try{current=await storageTransactions.read(SAVE);}catch{return false;}
  if(current===raw&&!savedCandidate)protectVerified({raw,status:'rejected',reason:reply.message||'The saved recipe could not be opened.',completion:readableCompletion(value)});
  return false;
}
const blocked=Symbol('blocked'),stale=Symbol('stale');
type SaveChange<T>=(raw:string|null,archived?:SaveCandidate)=>{raw?:string;result:T};
// Both progress writers queue here, so a write waiting on validation cannot
// land after a later write. The transform never awaits; when canonical bytes
// are neither absent nor trusted it writes nothing, and only bytes verified
// meanwhile, still identical in the next transaction, may be replaced. A
// protected candidate is replaced only by a write granted its archive, while
// its exact bytes are still canonical; the immutable copy commits atomically.
// A write queued behind an authorized archive runs only once that archive
// has committed; it never archives itself.
let saving:Promise<unknown>=Promise.resolve(),archiving=0;
function writeSave<T>(change:SaveChange<T>,archive?:SaveCandidate):Promise<T|typeof blocked|typeof stale> {
  queuedSaves++;if(archive)archiving++;
  const task=saving.then(async()=>{
    for(let check=0;check<2;check++) {
      let unknown:string|undefined,written:string|undefined;
      const result=await storageTransactions.change<T|typeof blocked|typeof stale>(SAVE,raw=>{
        if(savedCandidate) {
          if(!archive||archive!==savedCandidate||!archivable(archive))return {result:blocked};
          // Another tab replaced these bytes; never overwrite or re-archive them under a stale identity.
          if(raw!==archive.raw)return {result:stale};
          const next=change(raw,archive);if(next.raw===undefined)return next;
          written=next.raw;return {...next,backup:{key:archive.backup??=`${SAVE}:recovery:${new Date().toISOString()}:${crypto.randomUUID()}`,raw}};
        }
        if(raw!==null&&raw!==trustedRaw){unknown=raw;return {result:blocked};}
        const next=change(raw);written=next.raw;return next;
      });
      // The transaction committed; these exact bytes are now this page's own.
      if(written!==undefined){trustedRaw=written;if(archive&&savedCandidate===archive)protectSave(undefined);}
      if(unknown===undefined||!await verifySave(unknown))return result;
    }
    return blocked;
  }).finally(()=>{queuedSaves--;if(archive)archiving--;});
  saving=task.catch(()=>{});
  return task;
}
async function savesIdle(){for(;;){const current=saving;await current;await storageTransactions.idle();if(current===saving)return;}}
// A restore result affects only the candidate it was started for. Kernel
// success, current or obsolete, proves those exact bytes restorable; a stale
// failure cannot relabel the candidate a newer start now owns.
function settleSave(candidate:SaveCandidate,intent:WorkspaceIntent,attempt:ImportAttempt) {
  if(savedCandidate!==candidate||candidate.raw===undefined)return;
  if(attempt.kind==='ready'||attempt.kind==='superseded'&&attempt.restorable){trustedRaw=candidate.raw;protectSave(undefined);return;}
  if(!currentIntent(intent)||attempt.kind==='superseded')return;
  candidate.status=attempt.kind==='invalid'?'rejected':'unavailable';candidate.reason=attempt.message;renderStorageStatus();
}
const protectedNotice=()=>archivable(savedCandidate)
  ? 'Your saved progress could not be opened, so it stays unchanged on this device. Your next change keeps a recovery copy of it and saves this recipe.'
  : 'Saved progress could not be read from this device, so it stays unchanged. New play is session only; export progress to keep it.';
const protectedReplacement='Saved progress on this device could not be read, so it cannot be replaced yet. Your current recipe and completions are unchanged; export progress to keep them, then reload.';
const staleNotice='Saved progress changed in another tab, so this tab did not replace it. Your recipe here is unchanged; export progress to keep it, then reload.';
// Startup and restore refreshes adopt only while their navigation still owns the page.
async function refreshCompletions(owns=()=>true) {
  try{const record=readableCompletion(parseStored(await storageTransactions.read(SAVE)));if(!owns())return false;if(record)adoptCompletions(record);return true;}
  catch{if(owns())storageStatus(SAVE,false);return false;}
}
// Only an accepted edit or deliberate workspace change may archive protected
// bytes; view, preference, award and automatic writes leave them exact.
function progress(award?:number,deliberate=false) {
  if(!state)return;
  const archive=deliberate&&archivable(savedCandidate)?savedCandidate:undefined;
  // An earlier save does not cover this newer workspace until it commits.
  const revision=++progressRevision;progressSaved=false;
  // Protected bytes stay exact unless this change, or one already queued, holds the archive.
  if(protecting()&&!archive&&!archiving){renderStorageStatus();return;}
  const snapshot=clone({schema:1,type:'save',state,slots:railSlots,view,entry:acknowledgedEntry.slice(0,8192),confirmed:throwWon});
  const epoch=progressEpoch,additions=[...pendingWins].filter(([,generation])=>generation===epoch).map(([id])=>id);
  void writeSave((raw,archived)=>{
    // Recovery keeps readable completion IDs and their epoch; it is not a reset.
    // Unreadable bytes keep this tab's acknowledged record; a readable one, even
    // of a newer epoch, decides alone.
    const merged=mergeCompletions(archived?archived.completion??acknowledgedCompletion:completionRecord(parseStored(raw)),epoch,additions);
    // A deliberate new throw awards against the latest durable generation,
    // including a reset this tab has not observed. Autosave never does that.
    if(award!==undefined)merged.completed=[...new Set([...merged.completed,award])];
    return {raw:JSON.stringify({...snapshot,...merged}),result:merged};
  },archive).then(async merged=>{
    // A blocked write keeps pending wins and makes no save claim.
    if(merged===stale)error(staleNotice);
    if(merged===blocked||merged===stale){if(!protecting())storageStatus(SAVE,false);else renderStorageStatus();return;}
    for(const id of additions)if(pendingWins.get(id)===epoch)pendingWins.delete(id);
    // The commit acknowledges its exact metadata even if the reread below fails.
    adoptCompletions(merged);
    progressSaved=revision===progressRevision;storageStatus(SAVE,true);announceStorage(SAVE);await refreshCompletions();renderLevels();
  }).catch(()=>storageStatus(SAVE,false));
  renderStorageStatus();
}
function recordCompletion(id:number) {
  pendingWins.set(id,progressEpoch);completed.add(id);progress(id);
}
async function replaceProgress(reply:Response,slots:RailSlots|undefined,nextView:View,ids:number[],entry:string,owns=()=>true) {
  requireOk(reply);
  if(!owns())return false;
  // Confirmed replacement archives protected bytes in its own transaction.
  const archive=archivable(savedCandidate)?savedCandidate:undefined;
  if(protecting()&&!archive)throw new Error(protectedReplacement);
  const record={progressEpoch:crypto.randomUUID(),completed:[...new Set(ids)]};
  const snapshot={schema:1,type:'save',state:reply.state,slots:normalizeSlots(reply.state,slots),view:nextView,entry,confirmed:false,...record};
  const failed='Could not save the new progress on this device. Your current recipe and completions are unchanged. Try again.';
  let written:boolean|typeof blocked|typeof stale;
  const revision=++progressRevision;progressSaved=false;
  const write=writeSave(()=>owns()?{raw:JSON.stringify(snapshot),result:true}:{result:false},archive);renderStorageStatus();
  try{written=await write;}
  catch{storageStatus(SAVE,false);throw new Error(failed);}
  renderStorageStatus();
  if(written===false||written!==true&&!owns())return false;
  if(written===stale)throw new Error(staleNotice);
  if(written===blocked){if(!protecting())storageStatus(SAVE,false);throw new Error(protecting()?protectedReplacement:failed);}
  progressSaved=revision===progressRevision;storageStatus(SAVE,true);announceStorage(SAVE);
  if(!owns())return false;
  pendingWins.clear();if(!await refreshCompletions())adoptCompletions(record);
  return owns();
}
let feedbackContent:string|undefined;
function showNotice() {
  $('feedback').className=`feedback ${notice.kind}`;
  const unavailable=notice.kind!=='error'?emptyPathMessage(result):'';
  const text=unavailable||(insertionIndex!==undefined&&notice.kind!=='error'?'Choose a block.':notice.text);
  const retryIntro=introActive()&&flight.phase==='landed'&&!result?.solved;
  const finding=state&&result&&!unavailable&&notice.kind!=='error'&&!retryIntro?discoveryObservation(state,result,discoveryStage):'';
  $('feedback').classList.toggle('discovery-feedback',!!finding);
  const content=finding||`${notice.kind==='error'?'':icon('hand',16)}<span>${escape(text)}</span>`;
  if(content!==feedbackContent){$('feedback').innerHTML=content;feedbackContent=content;}
  const hints=!!state&&state.mode==='puzzle'&&!introActive()&&!isDiscovery(state)&&!throwWon;
  $('hints-open').hidden=!hints;
  const reserveGuidance=introActive()&&throwWon&&notice.kind!=='error';
  $('recipe-guidance').style.visibility=reserveGuidance?'hidden':'';
  $('recipe-guidance').inert=reserveGuidance;
  $('recipe-guidance').setAttribute('aria-hidden',String(reserveGuidance));
  $('feedback').hidden=!(finding||text)||(throwWon&&!reserveGuidance&&notice.kind!=='error')||(hints&&text==='Tap or drag a block.'&&notice.kind!=='error');
  $('recipe-guidance').hidden=$('feedback').hidden&&!hints;
}
function error(message: string) { notice={text:message,kind:'error'}; showNotice(); }
function emptyPathMessage(value:Result|undefined) {
  if(!value||flightPoints(value).length)return '';
  if(!value.relation)return 'No path to throw yet.';
  return value.crop?.editable
    ? 'No real heights in this crop. Expand or remove Crop, or make the right side zero or positive within it.'
    : 'No real heights in this interval. Make the right side zero or positive.';
}
function serial<T>(work: ()=>Promise<T>,retainCirclePreview=false): Promise<T | undefined> {
  if(pointer)finishPointer(undefined,true);
  cropEditor.cancel();
  if(!retainCirclePreview)cancelCirclePickup();
  pending++; $('playground').setAttribute('aria-busy','true');updatePrimary();
  const task=chain.then(async()=>{const value=await work();await savesIdle();return value;});
  chain=task.then(()=>{},e=>{
    const message=e instanceof Error?e.message:String(e);
    error(message==='Engine interrupted'||message==='Engine recovery failed'
      ? 'That move could not finish. Your previous recipe is unchanged. Try the move again.'
      : message);
  }).finally(()=>{
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
function restoreConfirmedThrow(confirmed:boolean) {
  // A solved preview alone cannot stand in for a deliberate Throw. The saved
  // confirmation belongs to this workspace and is rechecked by the kernel.
  if(!confirmed||state?.mode!=='puzzle'||!completed.has(state.sourceId)||!result?.solved)return;
  flight={phase:'landed',position:1};throwWon=true;
  // Resuming a finished flight must not replay a picture reward or award it again.
  pictureCelebrated=true;pictureCollecting=false;
}
function accept(reply: Response, history: 'push'|'keep'|'clear' = 'push',slots?:RailSlots,requestedView?:View,animateCurve=true,editedId?:string,emptySelection?:number,completeSelection=false,move?:CellMove,options:{persist?:boolean;confirmed?:boolean}={}) {
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
  if(newSource||history==='clear') {hintOrders.clear();hintOffered=false;hintCue=false;hintBlockSet='';bestTargetHits=-1;unsuccessfulRevisions=0;pictureCelebrated=false;pictureCollecting=false;}
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
  if(changed||layoutChanged||newSource||history==='clear') {
    // An edit cancels the flight's pending garden handoff. An open collection
    // owns its gate until the reveal finishes or the dialog closes.
    if(!pictureCelebrated)pictureCollecting=false;
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
  notice={text:emptyPathMessage(result)||(state.circle?'':state.nodes.length?'':choiceActive()?'Choose a block.':'Tap or drag a block.'),kind:''};
  if(history==='clear')restoreConfirmedThrow(options.confirmed===true);
  if(options.persist!==false)progress(undefined,history==='clear'||!!changed||layoutChanged);
  render(move&&(completeSelection||movingEmpty)?move.to:emptySelection);
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
    $('move-announcement').textContent=state.circle?`Centre ${state.circle.x}, ${state.circle.y}. Radius ${state.circle.radius}. ${result.checkpoints.filter(c=>c.hit).length} targets match.`:changed?`${state.nodes.map(n=>OPS[n.op].name).join(', ')||'Recipe cleared'}. ${flightPoints(result).length?'Ready to throw.':'No real path to throw yet.'}`:moved?`${OPS[moved.op].name} moved to slot ${railSlots.indexOf(moved.id)+1}.`:'Empty slot moved.';
    animateChange(previousState,previousResult,previousPoints,previousRects,previousSlots,previousSlope!,previousVisual,move,emptyRect,completeSelection);
  }
  if(offeredHint)$('move-announcement').textContent+=' Hints can help with this puzzle.';
  return true as const;
}
function perform(action: Action, history: 'push'|'keep'|'clear'='push',slots?:RailSlots,animateCurve=true) { return serial(async()=>accept(await kernel.run(state,action),history,slots,undefined,animateCurve,typeof action.id==='string'?action.id:undefined)); }
// Menu, Next, Create and saved recipes do not come from the URL. They detach
// the opening link once accepted, unless any newer navigation claimed the page.
function navigate(action:Action,slots?:RailSlots,intent=beginWorkspaceChange('')) {
  return serial(async()=>{
    if(!currentIntent(intent))return false;
    const reply=await owned(intent,kernel.run(state,action));if(!reply)return false;
    requireOk(reply);acknowledge(intent);return accept(reply,'clear',slots);
  });
}
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
  const replacing=!choosing&&!drag&&state?.nodes.some(node=>node.id===selectedStage);
  const creating=state?.mode==='remix',inventory=creating?{H:1,A:1,N:1,Q:1,D:1,I:1,S:1,F:1,C:1}:state?.inventory || {H:1,A:1};
  const available=(Object.keys(OPS) as Op[]).filter(op=>(inventory[op]||0)>0);
  $('palette').setAttribute('role','group');
  $('palette').setAttribute('aria-label',choosing?'Choose a block':replacing?'Replace the selected block or return it':'Add a block to your recipe');
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
    const availability=choosing?'ready':used>=n?'used':!creating&&!replacing&&(state?.nodes.length||0)>=(state?.limit||1)?'full':'ready';
    const disabled=!initialized||availability!=='ready'&&!returning;
    const title=choosing?OPS[op].description:returning?'Return the selected block to this stack':availability==='used'?'All copies are in your recipe':availability==='full'?'Recipe full — select a block to replace, return a block or Undo':replacing?'Replace the selected block. Its old copy returns to its stack.':`${OPS[op].description} Tap to add, or drag to a recipe slot.`;
    const remaining=n-used,visibleLayers=creating?3:Math.min(remaining,3);
    const layers=visibleLayers+(returning?1:0),capacity=creating?3:Math.max(0,Math.min(n-1,3)),condensed=!creating&&n>3;
    return `<div class="ingredient-stack ${OPS[op].color} ${creating?'reusable-stack':''} ${condensed?'condensed-stack':''} ${creating||remaining>3?'has-more-stock':''}" style="--stack-capacity:${capacity};--stack-depth:${Math.max(0,layers-1)};--return-layer:${returning?1:0}"><span class="stock-deck" aria-hidden="true">${Array.from({length:Math.max(0,layers-1)},(_,i)=>`<i style="--layer:${i+1}"></i>`).join('')}</span><button class="ingredient ${OPS[op].color} ${returning?'return-ready':''}" data-op="${op}" data-shortcut="${shortcutIndex+1}" ${returning?`data-return="${returning.id}"`:''} data-availability="${availability}" data-stock="${creating?'reusable':remaining}" draggable="false" ${disabled?'disabled':''} ${choosing?`aria-pressed="${state?.nodes[0]?.op===op}"`:''} aria-label="${choosing?'Choose '+OPS[op].name:returning?'Return selected '+OPS[op].name+', '+(creating?'reusable stack':`${remaining} available below`):(replacing?'Replace selected block with ':'Place ')+OPS[op].name+' block, '+(creating?'reusable':`${remaining} available`)}" ${!choosing&&!returning?`aria-describedby="${replacing?'replacement':'deck'}-keyboard-help"`:''} aria-keyshortcuts="${['Space',characterShortcuts&&!returning?String(shortcutIndex+1):''].filter(Boolean).join(' ')}" data-block-name="${OPS[op].name}" data-block-help="${escape(title)}"><span class="ingredient-surface"><span class="piece-grip">${icon(returning?'return':disabled?availability==='used'?'check':'lock':'grip',16)}</span><span class="ingredient-face"><span class="op-formula">${operationTex(op)}</span></span>${cue(op)}<kbd class="button-hotkey" data-character aria-hidden="true" ${returning?'hidden':''}>${shortcutIndex+1}</kbd></span></button>${creating||remaining>3?`<span class="${creating?'reusable-mark':'stock-total'}" aria-hidden="true">${tex(creating?'\\infty':String(remaining))}</span>`:''}</div>`;
  }).join('');
}
function emptySlotFace() {return `<span class="empty-face"><span class="piece-grip">${icon('grip',12)}</span>${icon('plus',18)}</span>`;}
function recipe() {
  if(!state||!result)return;
  if(state.circle){$('construction').innerHTML=circleRecipe(state,result);return;}
  const previousScroll=$('construction').querySelector('.pipeline')?.scrollLeft||0;
  const zoneScrolls=[...$('construction').querySelectorAll<HTMLElement>('.rail-slots')].map(zone=>zone.scrollLeft);
  $('construction').classList.toggle('has-selection',!!selectedStage||insertionIndex!==undefined);
  const cells=railSlots.map((id,index)=>{
    if(id===state!.station?.id)return '';
    if(!id)return `<button class="empty-slot insert-slot ${insertionIndex===index?'selected':''}" data-cell="${index}" data-empty="${index}" data-insert="${index}" draggable="false" aria-label="${selectedStage?'Move selected block to':'Empty'} slot ${index+1}" aria-pressed="${insertionIndex===index}" aria-describedby="empty-keyboard-help" aria-keyshortcuts="Space ArrowLeft ArrowRight${adjacentSlot(railSlots,state!,index,-1)!==index?' Backspace':''}" title="Choose a block for this slot, or drag the empty slot to reposition it">${emptySlotFace()}</button>`;
    const node=state!.nodes.find(n=>n.id===id)!,receiving=selectedStage&&selectedStage!==id||insertionIndex!==undefined;
    return `<div class="recipe-part ${OPS[node.op].color} ${selectedStage===node.id?'inspected':''} ${receiving?'receiving-cell':''}" data-cell="${index}" data-part="${node.id}" draggable="false"><button class="part-body" data-stage="${node.id}" aria-label="${receiving?'Move selection to slot '+(index+1):OPS[node.op].name+', slot '+(index+1)}" aria-pressed="${selectedStage===node.id}" aria-describedby="block-keyboard-help" aria-keyshortcuts="Space ArrowLeft ArrowRight ArrowDown Backspace Delete" title="${receiving?'Move selection here':OPS[node.op].name+' · drag to move, drag off the recipe to return'}"><span class="recipe-face"><span class="piece-grip">${icon('grip',14)}</span><span class="part-formula">${operationTex(node.op)}</span></span></button></div>`;
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
  const advancing=won&&!pictureCollecting&&state?.mode!=='remix';
  const active=flight.phase==='flying'||flight.phase==='releasing';
  // Keep its focus through a pending edit so render can return it to the view
  // tab if the acknowledged construction no longer needs this control.
  $('circle-fit').setAttribute('aria-disabled',String(!initialized||pending>0||active));
  $('rethrow').hidden=!advancing;
  $<HTMLButtonElement>('rethrow').disabled=!initialized||pending>0||active;
  const next=state?.mode==='puzzle'?followingPuzzle(state.sourceId):undefined;
  const label=advancing?(state?.mode==='puzzle'?next?isMastery(next)?next===PUZZLE_ORDER.at(-1)?'Final mastery':'Mastery challenge':chapterIndex(next)!==chapterIndex(state.sourceId)?'Next chapter':isCapstone(next)?'Chapter challenge':'Next puzzle':OPTIONAL_PUZZLES.includes(state.sourceId)?'More puzzles':'Finish':'Create'):active?'In flight':flight.phase==='landed'?'Throw again':'Throw';
  $<HTMLButtonElement>('launch').disabled=!initialized||pending>0||pictureCollecting||active&&!advancing||!!result&&!flightPoints(result).length;
  $('launch').title=emptyPathMessage(result);
  $('launch').innerHTML=(advancing?`<span>${label}</span>${icon('arrow',21)}`:`${icon('throw',21)}<span>${label}</span>`)+`<kbd class="button-hotkey"${advancing?' data-hotkey="activate"':''} aria-hidden="true">${advancing?'Space':'Enter'}</kbd>`;
  $('launch').setAttribute('aria-keyshortcuts',advancing?'Space':'Enter');
  $('launch').classList.toggle('continue-ready',advancing);
  $('launch').dataset.action=advancing?'continue':'throw';
  $('launch').setAttribute('aria-label',label);
  $('playground').dataset.phase=flight.phase;
  $('success').hidden=!won;
  if(won)$('success').innerHTML=`<span class="success-medal">${icon(state&&isMastery(state.sourceId)?'mastery':'check',22)}<span>${state?.mode==='puzzle'&&isMastery(state.sourceId)?'Mastery challenge complete!':state?.mode==='puzzle'&&isPicture(state.sourceId)?'Picture piece earned!':'All targets!'}</span></span>`;
  showNotice();
  syncFlightClock();
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
function setView(next: View) {
  if(next===view)return;
  const focused=document.activeElement;
  const focusView=$('scene').contains(focused)||!!focused?.closest('.view-tabs');
  view=next;preferences();progress();render();
  // A view's reader or slider disappears when switching views. Keep keyboard
  // navigation at the new view, while recipe/stack focus stays in the editor.
  if(focusView)$(`tab-${next}`).focus({preventScroll:true});
}
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
function slideCell(cell:HTMLElement,before:DOMRect,keepFocusAtDestination=false,fromEmptySlot=false) {
  if(reduced)return;
  const face=cell.querySelector<HTMLElement>('.recipe-face,.empty-face')!,after=face.getBoundingClientRect();
  if(Math.abs(before.left-after.left)<=2&&Math.abs(before.top-after.top)<=2)return;
  // Arrow moves carry the focused piece; a Space/tap destination stays put
  // while the painted face arrives. Its button, outline and keycaps never
  // travel back to the source just to participate in that animation.
  const target=keepFocusAtDestination?face:cell;
  let underlay:HTMLElement|undefined;
  if(fromEmptySlot) {
    // This slot was empty before the edit. Keep its face in the final layout
    // beneath the travelling block, with no extra control or scroll extent.
    underlay=document.createElement('span');underlay.className='insert-slot slot-underlay';underlay.setAttribute('aria-hidden','true');
    underlay.innerHTML=emptySlotFace();
    Object.assign(underlay.style,{left:`${cell.offsetLeft}px`,top:`${cell.offsetTop}px`,width:`${cell.offsetWidth}px`,height:`${cell.offsetHeight}px`});
    cell.before(underlay);
  }
  const animation=target.animate([{transform:`translate(${before.left-after.left}px,${before.top-after.top}px)`},{transform:'translate(0,0)'}],{id:'recipe-move',duration:220,easing:'ease-out'});
  if(underlay)void animation.finished.then(()=>underlay.remove(),()=>underlay.remove());
}
function fadeEmpty(empty:HTMLElement|null|undefined) {
  if(!reduced&&empty&&empty!==document.activeElement)empty.animate([{opacity:0},{opacity:1}],{id:'recipe-vacancy',duration:220,easing:'ease-out'});
}
function animateChange(previousState:State,previousResult:Result, from:Result['points'], rects:Map<string,DOMRect>,previousSlots:RailSlots,fromSlope:number,previousVisual?:SVGGElement,move?:CellMove,emptyRect?:DOMRect,completeSelection=false) {
  if(reduced||!state||!result)return;
  if(state.circle||previousState.circle)return;
  const remaining=new Set(state.nodes.map(node=>node.id));
  document.querySelectorAll<HTMLElement>('.recipe-part').forEach(el=>{
    const before=rects.get(el.dataset.part!);
    if(!previousState.nodes.some(n=>n.id===el.dataset.part))el.classList.add('just-placed');
    else if(before) {
      // Continue from the actual painted position if interrupted. Focus, not
      // animation order or DOM order, determines which crossing block is above.
      slideCell(el,before,completeSelection&&Number(el.dataset.cell)===move?.to,previousSlots[Number(el.dataset.cell)]===null);
    }
  });
  for(const empty of document.querySelectorAll<HTMLElement>('.empty-slot')) {
    const cell=Number(empty.dataset.cell);
    if(emptyRect&&cell===move?.to)slideCell(empty,emptyRect,completeSelection);
    else if(previousSlots[cell]&&!remaining.has(previousSlots[cell]!)||emptyRect&&cell===move?.from)fadeEmpty(empty);
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
    updateTarget($('scene'),checkpoint,i,status,!reduced);
  });
  if(!throwWon&&result.solved&&result.checkpoints.length>0&&hits===result.checkpoints.length) {
    throwWon=true;
    if(state.mode==='puzzle'&&isPicture(state.sourceId)&&!pictureCelebrated)pictureCollecting=true;
    if(state.mode==='puzzle'){recordCompletion(state.sourceId);renderLevels();}
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
document.addEventListener('pointerdown',()=>{flightActionFocus=undefined;quickThrowFocus=undefined;gardenDoneFocus=false;});
document.addEventListener('keydown',event=>{if(event.key==='Tab'){flightActionFocus=undefined;quickThrowFocus=undefined;gardenDoneFocus=false;}});
function finishFlight() {
  const quickOrigin=quickThrowFocus;quickThrowFocus=undefined;
  flight={phase:'landed',position:1};animatePosition();
  notice={text:state?.mode==='remix'?'':result?.solved?'':state?.circle?'Adjust the centre or radius.':choiceActive()?'Pick another block and try again.':'Adjust a block and try again.',kind:''};
  updatePrimary();$('undo').classList.toggle('retry-cue',!!state?.nodes.length&&!result?.solved);
  $('success').classList.toggle('just-solved',!!result?.solved&&!reduced);
  $('move-announcement').textContent=state?.mode==='remix'?'Throw complete.':result?.solved?'Every target hit. Puzzle solved.':`${result?.checkpoints.filter(c=>c.hit).length} of ${result?.checkpoints.length} targets hit. ${choiceActive()?'Pick another block':'Adjust your recipe'} and throw again.`;
  if(state?.mode==='puzzle'&&isPicture(state.sourceId)&&result?.solved&&!pictureCelebrated){
    const focusDone=!!quickOrigin||!!flightActionFocus&&document.documentElement.dataset.focusModality==='keyboard';
    pictureCelebrated=true;showGarden('launch',state.sourceId,undefined,focusDone);
  }
  const action=flightActionFocus;flightActionFocus=undefined;
  if(action&&document.activeElement===document.body&&!action.disabled&&!action.hidden&&!document.querySelector('dialog[open]'))action.focus({preventScroll:true});
  if(quickOrigin&&throwWon&&state?.mode!=='remix'&&document.hasFocus()&&!document.querySelector('dialog[open]')&&(document.activeElement===quickOrigin||document.activeElement===document.body))$('launch').focus({preventScroll:true});
}
function launch() {
  if(!initialized||pending||pictureCollecting)return;
  if(choiceActive()&&!state!.nodes.length)return;
  if(throwWon&&state?.mode!=='remix') {
    const next=followingPuzzle(state!.sourceId);
    if(state!.mode==='puzzle'&&next)goToPuzzle(next,false);
    else if(state!.mode==='puzzle'&&OPTIONAL_PUZZLES.includes(state!.sourceId)){renderLevels();open('puzzles-dialog','launch');}
    else if(state!.mode==='puzzle')showEnding();
    else void navigate({type:'remix'});
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
let flightFrame:number|undefined,lastFrame=0;
const flightCanAdvance=()=>initialized&&(flight.phase==='releasing'||flight.phase==='flying')&&!document.hidden&&!document.querySelector('dialog[open]');
function syncFlightClock() {
  if(flightCanAdvance()) {
    // A resumed flight starts a fresh time interval; paused time never advances it.
    if(flightFrame===undefined){lastFrame=performance.now();flightFrame=requestAnimationFrame(frame);}
  } else {
    if(flightFrame!==undefined)cancelAnimationFrame(flightFrame);
    flightFrame=undefined;
  }
}
function frame(time: number) {
  const dt=Math.max(0,Math.min(time-lastFrame,50));lastFrame=time;
  if(flightCanAdvance()) {
    if(flight.phase==='releasing') {
      flight.release=Math.min(1,(flight.release||0)+dt/160);animatePosition();
      if(flight.release===1){flight={phase:'flying',position:0};updatePrimary();animatePosition();}
    } else if(flight.phase==='flying') {
      flight.position=Math.min(1,flight.position+dt/2600);animatePosition();if(flight.position===1)finishFlight();
    }
  }
  flightFrame=undefined;
  if(flightCanAdvance())flightFrame=requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange',syncFlightClock);
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('close',syncFlightClock));
const sizeInspection=()=>{
  if(!state||!result)return;
  sizeFlightAnnotations($('scene'));sizeFlowAnnotations($('scene'));sizeEquationTables($('scene'));sizeCircleControls($('scene'));
};
new ResizeObserver(sizeInspection).observe($('scene'));
// A fixed content frame need not resize when a newly used KaTeX font arrives.
document.fonts.addEventListener('loadingdone',sizeInspection);

function closeDialogs(){document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(dialog=>dialog.close());}
type LeaveChange={intent:WorkspaceIntent;proceed:()=>Promise<unknown>;cancel:()=>void};
let leaveChange:LeaveChange|undefined;
function recipeKey(snapshot:Snapshot) {
  const s=snapshot.state;
  return JSON.stringify([s.mode,s.sourceId,s.goals,s.inventory,s.limit,s.circle,s.crop,snapshot.slots.map(id=>id?s.nodes.find(node=>node.id===id)?.op:null)]);
}
async function unsavedRecipe() {
  if(!state||(state.circle?!circleEdited(state,result):!cropEdited(state)&&!state.nodes.some(node=>node.id!==state!.station?.id)))return false;
  if(!await refreshLibrary())return true;
  const current=recipeKey({state,slots:railSlots});
  return !seeds.some(seed=>{try{return seed.snapshot&&recipeKey(seed.snapshot)===current;}catch{return false;}});
}
async function changeWorkspace(action:()=>Promise<unknown>,destination:string,carry=false,explanation?:string,intent=beginWorkspaceChange()) {
  // Wait outside serial: Save & continue must be able to enqueue its own export.
  // A queued accepted edit can be the first unsaved work in this workspace.
  while(pending>0)await chain;
  if(!currentIntent(intent))return false;
  const unsaved=await unsavedRecipe();
  if(!currentIntent(intent))return false;
  if(!unsaved){closeDialogs();return action();}
  $('leave-description').textContent=explanation??(carry?'Create carries your construction over. Save this puzzle recipe to resume it later.':`Save your current recipe before opening ${destination}.`);
  $<HTMLInputElement>('leave-name').value=state?.mode==='puzzle'?LEVELS[state.sourceId-1].name:'My flight';
  $('leave-error').hidden=true;
  return new Promise<unknown>(resolve=>{
    open('leave-dialog');
    leaveChange={intent,proceed:async()=>resolve(currentIntent(intent)?await action():false),cancel:()=>{
      if(currentIntent(intent))replaceEntry(acknowledgedEntry);
      resolve(false);
    }};
  });
}
function goToPuzzle(sourceId:number,protect=true) {
  if(state?.mode==='puzzle'&&state.sourceId===sourceId) {
    closeDialogs();requestAnimationFrame(()=>focusGameControl());return;
  }
  const intent=beginWorkspaceChange('');
  const next=()=>navigate({type:'level',sourceId,mode:'puzzle'},undefined,intent).then(ok=>{if(ok&&currentIntent(intent))focusGameControl();});
  if(protect)changeWorkspace(next,LEVELS[sourceId-1].name,false,undefined,intent);
  else {closeDialogs();void next();}
}
function renderEnding() {
  const count=PUZZLE_ORDER.filter(id=>completed.has(id)).length,all=count===PUZZLE_ORDER.length;
  $('ending-title').textContent=all?'A whole garden of ideas.':'Your garden, shaped.';
  $('ending-description').textContent=all?'Heights, folds, change, accumulation — and a path that comes back. You explored every puzzle. There are still shapes to revisit and flights of your own to make.':'You brought the ideas together. More chapters are waiting whenever you want to explore them.';
  $('ending-progress').textContent=`${count} of ${PUZZLE_ORDER.length} puzzles complete`;
  $('ending-chapters').innerHTML=CHAPTERS.map((chapter,i)=>{
    const done=chapter.levels.filter(id=>completed.has(id)).length,complete=done===chapter.levels.length;
    return `<li class="ending-chapter ${complete?'complete':''}" style="--arrival:${i*90}ms" aria-label="${chapter.name}: ${done} of ${chapter.levels.length} complete"><span class="ending-chapter-art ${chapter.color}">${chapterArt(i)}${complete?`<span class="ending-check">${icon('check',13)}</span>`:''}</span><span>${chapter.name}</span><small>${done} / ${chapter.levels.length}</small></li>`;
  }).join('');
}
function showEnding(){renderEnding();open('ending-dialog','launch');}
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
function nextInsertionSlot(focusedCell?:number) {
  if(!state)return -1;
  if(insertionIndex!==undefined)return insertionIndex;
  const stationId=state.station?.id;
  const last=state.nodes.filter(node=>node.id!==stationId).at(-1)?.id;
  const from=focusedCell??(last?railSlots.indexOf(last):-1);
  if(from<0)return railSlots.indexOf(null);
  // An empty focused slot is an insertion position too, so removing a block
  // can be followed immediately by typing its replacement without selecting it.
  if(railSlots[from]===null)return from;
  const next=adjacentSlot(railSlots,state,from,1);
  // Insert immediately after the cursor. When the only hole is on the left,
  // shifting toward it moves the cursor left too, so its old slot receives
  // the new block. Never restart at the first earlier hole.
  return railSlots.slice(from+1).includes(null)?next:railSlots.slice(0,from).includes(null)?from:-1;
}
function replaceSelected(op:Op) {
  const previous=state?.nodes.find(node=>node.id===selectedStage);
  if(!state||!previous||previous.id===state.station?.id||previous.op===op)return;
  const id=crypto.randomUUID(),slots=railSlots.map(slot=>slot===previous.id?id:slot);
  return {id,work:serial(async()=>{
    const nodes=state!.nodes.map(node=>node.id===previous.id?{id,op}:node);
    return accept(await kernel.run({...state!,nodes},{type:'evaluate'}),'push',slots,undefined,true,id,undefined,true);
  }).then(accepted=>{if(accepted)focusPart(id);return accepted;})};
}
function insertIntoSlot(op:Op,index=nextInsertionSlot(),advance=false) {
  if(!state||index<0||index>=railSlots.length)return;
  // Insert at the indicated slot, shifting only as far as a free slot. Prefer
  // the right; a hole to the left still lets the new block land where dropped.
  const id=crypto.randomUUID(),slots=insertedSlots(railSlots,state,id,index);
  if(!slots)return;
  const place=(reply:Response)=>{
    requireOk(reply);
    selectedStage='';
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
    if(focus!=='stack')focusSlot(Math.min(destination,railSlots.length-1));else focusRecipeControl(document.querySelector<HTMLElement>(`[data-op="${op}"]`));
    $('move-announcement').textContent=`${op?OPS[op].name:'Block'} returned to its stack.`;
  });
}
function resetRecipe() {
  return perform({type:'reset'}).then(accepted=>{
    if(!accepted||state?.circle)return;
    // Restart establishes a new insertion position, including when a fixed
    // station precedes the first editable slot. Pointer focus stays unoutlined.
    focusRecipeControl(choiceActive()?document.querySelector<HTMLElement>('#palette [data-op]:not(:disabled)'):document.querySelector<HTMLElement>('#construction [data-empty]'));
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
  if(event.defaultPrevented||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
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
    const returnTo=d.back,dialog=d.backDialog||'menu-dialog';open(dialog,dialog==='ending-dialog'?'launch':'menu-open');
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
  if(d.cropAdd!==undefined){void perform({type:'crop',from:'0',to:String(sourceInfo(state!.sourceId).endpoint)});return;}
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
    if(selectedStage){void replaceSelected(d.op as Op)?.work;return;}
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
    else if(state!.mode==='remix'||state!.nodes.length<state!.limit){insertionIndex=Number(d.insert);if(notice.kind==='error')notice={text:'',kind:''};render();focusEmpty(Number(d.insert));}
  }
  if(d.stage){
    if(selectedStage&&selectedStage!==d.stage){const id=selectedStage;void moveCell(railSlots.indexOf(id),railSlots.indexOf(d.stage),true)?.then(()=>focusPart(id));}
    else if(insertionIndex!==undefined){const to=railSlots.indexOf(d.stage);void moveCell(insertionIndex,to,true)?.then(()=>focusEmpty(to));}
    else{selectedStage=selectedStage===d.stage?'':d.stage;discoveryStage=d.stage;render();focusPart(d.stage);}
  }
});
$('undo').onclick=()=>void historyMove(true);
$('redo').onclick=()=>void historyMove(false);
$('reset').onclick=()=>void resetRecipe();
$('launch').onclick=launch;
$('rethrow').onclick=()=>throwCucumber(true);
$('nav-create').onclick=()=>{
  if(!initialized||state?.mode==='remix')return;
  const intent=beginWorkspaceChange('');
  changeWorkspace(()=>navigate({type:'remix'},railSlots,intent).then(ok=>{if(ok&&currentIntent(intent))$('level-title').focus({preventScroll:true});}),'Create',true,undefined,intent);
};
document.addEventListener('keydown',event=>{
  const target=event.target as HTMLElement;
  if(event.defaultPrevented||event.isComposing||event.altKey||event.ctrlKey&&event.metaKey||target.matches('input:not([type=range]):not([type=checkbox]):not([type=radio]),textarea,select')||target.isContentEditable||document.querySelector('dialog[open]'))return;
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
    if(!event.repeat&&!pointer&&!$<HTMLButtonElement>('reset').disabled)void resetRecipe();
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
  if(characterShortcuts&&inPlay&&!event.shiftKey&&event.key.toLowerCase()==='m') {
    if(!event.repeat){event.preventDefault();$('menu-open').click();}
    return;
  }
  if(characterShortcuts&&inPlay&&!event.shiftKey&&['z','x','c'].includes(event.key.toLowerCase())) {
    const next=views[['z','x','c'].indexOf(event.key.toLowerCase())],button=$<HTMLButtonElement>(`tab-${next}`);
    if(initialized&&!event.repeat&&!button.disabled&&button.getClientRects().length){
      event.preventDefault();setView(next);
    }
    return;
  }
  if(characterShortcuts&&inPlay&&!event.shiftKey&&/^[1-9]$/.test(event.key)) {
    // Keep the palette's authored order, including depleted stacks. Numbers
    // place or replace that kind; a selected block's return is a separate action.
    const button=$('palette').querySelectorAll<HTMLButtonElement>('[data-op]')[Number(event.key)-1];
    if(initialized&&!pending&&!event.repeat&&button&&!button.disabled&&button.getClientRects().length) {
      event.preventDefault();
      if(choiceActive())button.click();
      else if(selectedStage)void replaceSelected(button.dataset.op as Op)?.work;
      else {
        const cell=target.closest<HTMLElement>('#construction [data-cell]')?.dataset.cell;
        const advance=insertionIndex!==undefined,placed=insertIntoSlot(button.dataset.op as Op,nextInsertionSlot(cell===undefined?undefined:Number(cell)),advance);
        if(placed&&!advance)void placed.work.then(accepted=>{if(accepted)focusPart(placed.id);});
      }
    }
    return;
  }
  if(characterShortcuts&&inPlay&&event.key==='?'){event.preventDefault();if(!event.repeat)open('help-dialog');return;}
  if(event.shiftKey)return;
  if(navigateTablist(event,views.map(view=>$(`tab-${view}`)),tab=>setView(tab.dataset.view as View)))return;
  if(target.matches('.part-body')&&state&&!pending) {
    const id=target.dataset.stage!,index=railSlots.indexOf(id);
    if(event.key==='ArrowLeft'||event.key==='ArrowRight') {
      event.preventDefault();const to=adjacentSlot(railSlots,state,index,event.key==='ArrowLeft'?-1:1);
      if(to!==index)void moveCell(index,to)?.then(()=>focusPart(id));
    }
    if(event.key==='ArrowDown'||event.key==='Delete'||event.key==='Backspace') {
      event.preventDefault();void removePart(id,event.key==='Backspace'?'previous':'slot');
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
function drop(index: number,pickup:typeof drag) {
  if(!pickup||!state)return;
  if(pickup.op)return insertIntoSlot(pickup.op,index);
  if(pickup.id)return {id:pickup.id,work:moveCell(railSlots.indexOf(pickup.id),index)};
  if(pickup.empty!==undefined)return {id:'',cell:index,work:moveCell(pickup.empty,index)};
}
function clearDropHints() {document.querySelectorAll('.drop-target,.suggested-slot,.return-target').forEach(el=>el.classList.remove('drop-target','suggested-slot','return-target'));}
function suggestSlot(event:Event) {
  if(pointer?.active)return;
  clearDropHints();
  if((event.target as Element).closest('[data-op]:not(:disabled):not([data-return])')) {
    const index=selectedStage?railSlots.indexOf(selectedStage):nextInsertionSlot();
    document.querySelector(`#construction [data-cell="${index}"]`)?.classList.add('suggested-slot');
  }
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
  const held=pointer,pickup=drag,floating=ghost,origin=held.element.getBoundingClientRect();
  if(cancel&&!event&&held.active)cancelledPointer=held.pointerId;
  const slot=held.active&&!cancel&&event?dropSlotAt(event.clientX,event.clientY):undefined;
  const returning=held.active&&!cancel&&event&&pickup?.id&&!overRail(event.clientX,event.clientY);
  const op=pickup?.op||state?.nodes.find(n=>n.id===pickup?.id)?.op;
  // Detach this pickup before committing its drop. serial() cancels any still
  // held pickup synchronously, including while its kernel reply is pending.
  pointer=undefined;drag=undefined;ghost=undefined;
  held.element.classList.remove('dragging');$('playground').classList.remove('is-dragging');clearDropHints();
  const transfer=returning?{id:'',work:perform({type:'remove',id:pickup!.id},'push',railSlots.map(id=>id===pickup!.id?null:id))}:slot?drop(Number(slot.dataset.cell),pickup):undefined;
  if(floating&&held.active){
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
  if(held.active&&!transfer?.work)$('move-announcement').textContent='Move cancelled.';
  if(pickup?.id)palette();
  if(cancelledPointer===undefined)setTimeout(()=>suppressClick=false,0);
}
document.addEventListener('pointerup',event=>finishPointer(event));document.addEventListener('pointercancel',event=>finishPointer(event,true));
window.addEventListener('blur',()=>finishPointer(undefined,true));

const referenceOrigins=new WeakMap<HTMLDialogElement,{focus:ReturnType<typeof rememberFocus>;native:Element|null}>();
const open=(id:string,returnId='menu-open',origin?:ReturnType<typeof rememberFocus>)=>{
  cancelCirclePickup();if(pointer)finishPointer(undefined,true);closeDialogs();
  if(!restoreFocus(origin))$(returnId).focus({preventScroll:true});
  const dialog=$<HTMLDialogElement>(id),native=document.activeElement;
  if(origin)referenceOrigins.set(dialog,{focus:origin,native});else referenceOrigins.delete(dialog);
  dialog.showModal();syncFlightClock();
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
      }).catch(()=>{if(panel.isConnected){delete panel.dataset.loaded;panel.innerHTML='<p>The sketch could not load. Close Hints and open it again to retry the sketch.</p>';}}).finally(()=>panel.setAttribute('aria-busy','false'));
    }
  }
  if(target.closest('#hint-notes'))openNotes(referenceOrigins.get($<HTMLDialogElement>('hints-dialog'))?.focus);
};
$('menu-version').onclick=()=>open('releases-dialog','menu-version');
$('ending-create').onclick=()=>$('nav-create').click();
function showGarden(returnId:string,revealSource?:number,parent?:'puzzles-dialog'|'ending-dialog',focusDone=false) {
  const origin=revealSource&&!reduced?gardenOrigin($('scene').querySelector<SVGPathElement>('#flight-trail,.flow-machine:last-child .flow-curve')):undefined;
  const back=$<HTMLButtonElement>('garden-back');
  back.type=parent?'button':'submit';
  const backLabel=parent==='ending-dialog'?'Back to ending':parent?'Back to puzzle list':'Back to game';
  back.setAttribute('aria-label',backLabel);back.title=backLabel;
  if(parent){back.dataset.back=returnId;back.dataset.backDialog=parent;}
  else {delete back.dataset.back;delete back.dataset.backDialog;}
  open('garden-dialog',parent==='ending-dialog'?'launch':parent?'menu-open':returnId);
  gardenDoneFocus=focusDone;gardenReturnSource=revealSource;
  void garden.open(completed,revealSource,origin);
}
$('ending-garden').onclick=()=>showGarden('ending-garden',undefined,'ending-dialog');
$('picture-open').onclick=()=>showGarden('picture-open');
$('garden-dialog').addEventListener('close',()=>{
  if($<HTMLDialogElement>('garden-dialog').open)return;
  const source=gardenReturnSource;gardenReturnSource=undefined;gardenDoneFocus=false;
  garden.close();pictureCollecting=false;updatePrimary();
  if(source!==undefined&&state?.sourceId===source&&throwWon&&!pending&&!document.querySelector('dialog[open]'))$('launch').focus({preventScroll:true});
});
$('ending-revisit').onclick=()=>{renderLevels();open('puzzles-dialog');};
$('reset-progress-open').onclick=()=>{$('reset-progress-error').hidden=true;open('reset-progress-dialog');};
$('reset-progress-confirm').onclick=async()=>{
  const confirm=$<HTMLButtonElement>('reset-progress-confirm'),cancel=$<HTMLButtonElement>('reset-progress-cancel');
  confirm.disabled=true;cancel.disabled=true;
  // Reset opens a fresh first puzzle; any newer navigation supersedes it.
  const intent=beginWorkspaceChange('');
  const reset=await serial(async()=>{
    if(!currentIntent(intent))return false;
    const reply=await owned(intent,kernel.run(undefined,{type:'level',sourceId:1,mode:'puzzle'}));if(!reply)return false;
    requireOk(reply);
    if(!await owned(intent,replaceProgress(reply,undefined,view,[],'',()=>currentIntent(intent))))return false;
    acknowledgedEntry='';window.history.replaceState(null,'',location.pathname+location.search);
    accept(reply,'clear');return true;
  });
  confirm.disabled=false;cancel.disabled=false;
  // A committed reset stays durable, but a newer navigation owns the page's UI.
  if(!currentIntent(intent))return;
  if(reset){closeDialogs();requestAnimationFrame(()=>{if(currentIntent(intent))focusGameControl();});$('move-announcement').textContent='Puzzle progress reset. Chapter 1 is ready.';}
  else {$('reset-progress-error').textContent=notice.text;$('reset-progress-error').hidden=false;}
};
$('leave-dialog').addEventListener('close',()=>{
  if($<HTMLDialogElement>('leave-dialog').open)return;
  const change=leaveChange;leaveChange=undefined;change?.cancel();
});
$('leave-discard').onclick=()=>{const change=leaveChange;leaveChange=undefined;closeDialogs();if(change)void change.proceed();};
$('leave-save').onclick=async()=>{
  const change=leaveChange;if(!change)return;
  const save=$<HTMLButtonElement>('leave-save'),discard=$<HTMLButtonElement>('leave-discard');
  save.disabled=true;discard.disabled=true;
  const saved=await saveRecipe($<HTMLInputElement>('leave-name').value);
  save.disabled=false;discard.disabled=false;
  if(saved&&leaveChange===change){leaveChange=undefined;closeDialogs();void change.proceed();}
  else if(!saved&&leaveChange===change){$('leave-error').textContent=notice.text;$('leave-error').hidden=false;}
};
document.querySelectorAll<HTMLElement>('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon!,el.matches('.menu-art,.help-art')?32:18));
renderBrand(document.querySelector<HTMLElement>('.brand')!);
$('axis-help').innerHTML=`The dashed ${operationTex()} in a block stands for its input. ${tex('x')} is horizontal position and ${tex('h')} is height. An equation such as ${tex('h=x')} describes the path; ${tex('h^2=x')} can describe two heights at one position. The blocks shape the path; throwing speed does not affect the result.`;
function reflectMotionPreference() {
  reduced=motionOverride??systemMotion.matches;
  $<HTMLInputElement>('motion-toggle').checked=reduced;document.body.classList.toggle('reduced-motion',reduced);
  if(reduced&&(flight.phase==='flying'||flight.phase==='releasing'))finishFlight();
  render();
}
reflectMotionPreference();
$<HTMLInputElement>('motion-toggle').onchange=()=>{motionOverride=$<HTMLInputElement>('motion-toggle').checked;preferences();reflectMotionPreference();};
systemMotion.addEventListener('change',()=>{if(motionOverride===undefined)reflectMotionPreference();});
function reflectCharacterShortcuts() {
  document.documentElement.dataset.characterShortcuts=String(characterShortcuts);
  $<HTMLInputElement>('character-shortcuts').checked=!characterShortcuts;
  for(const [id,key] of [['hints-open','H'],['ideas-open','N'],['menu-open','M'],['help-open','?'],['tab-flight','Z'],['tab-function','X'],['tab-flow','C']]) {
    if(characterShortcuts)$(id).setAttribute('aria-keyshortcuts',key);else $(id).removeAttribute('aria-keyshortcuts');
  }
  for(const button of $('palette').querySelectorAll<HTMLButtonElement>('[data-op]')) {
    const base='Space';
    button.setAttribute('aria-keyshortcuts',[base,characterShortcuts&&!button.dataset.return?button.dataset.shortcut:''].filter(Boolean).join(' '));
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
  $<HTMLTextAreaElement>('share-link').value=tooLarge?'This recipe is too large for a link. Choose Download puzzle.':url.href;
  if(tooLarge)$('share-message').textContent='Open the file through Menu → Save & open → Import progress from file.';
  ($('copy-link') as HTMLButtonElement).disabled=tooLarge;($('download-artifact') as HTMLButtonElement).disabled=false;$('download-artifact').hidden=!tooLarge;
  $('share-description').textContent=kind==='level'?'A fresh start on this puzzle.':kind==='challenge'?'Your flight sets their targets. Your recipe stays hidden.':'Your construction, ready to change.';
}
$('share-open').onclick=()=>{const option=$<HTMLSelectElement>('share-kind').options[0];option.disabled=state?.mode!=='puzzle';$<HTMLSelectElement>('share-kind').value=state?.mode==='puzzle'?'level':'creation';open('share-dialog');void updateShare();};
$<HTMLSelectElement>('share-kind').onchange=()=>void updateShare();
$('copy-link').onclick=async()=>{try{await navigator.clipboard.writeText($<HTMLTextAreaElement>('share-link').value);$('share-message').textContent='Copied. A little curiosity is ready to travel.';}catch{$<HTMLTextAreaElement>('share-link').select();$('share-message').textContent='Select and copy the link above.';}};
function download(value:unknown,name:string){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('download-artifact').onclick=()=>{if(sharingArtifact)download(sharingArtifact,`angouri-${sharingArtifact.type}.json`);};
$('download-save').onclick=()=>{if(state)download({schema:1,type:'save',state,slots:railSlots,completed:[...completed],view},'angouri-progress.json');};
let renamingSeed:string|undefined,renameSeed:Seed|undefined,renameDraft='';
function seedControl(id:string,attribute:string) {
  return $('favorites-list').querySelector<HTMLElement>(`[data-library-id="${CSS.escape(id)}"] [${attribute}]`);
}
function renderSeeds(preserveDraft=true){
  const focused=document.activeElement as HTMLElement|null,owned=!!focused&&$('favorites-list').contains(focused);
  const focusId=focused?.closest<HTMLElement>('[data-library-id]')?.dataset.libraryId;
  const focusAttribute=focused?.id==='rename-seed'?'id="rename-seed"':focused?.getAttributeNames().find(name=>/^data-(?:seed|rename-seed|delete-seed|restore-seed|purge-seed|cancel-rename)$/.test(name));
  const selection=focused instanceof HTMLInputElement?[focused.selectionStart,focused.selectionEnd] as const:undefined;
  const draft=$<HTMLInputElement>('rename-seed');if(preserveDraft&&draft&&renamingSeed)renameDraft=draft.value;
  const oldError=$('rename-error'),renameError=oldError&&!oldError.hidden?oldError.textContent:'';
  const dateFormat=new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'});
  const metadata=(s:Seed)=>{
    const saved=s.snapshot?.state,chapter=saved?chapterIndex(saved.sourceId):-1;
    const context=saved?.mode==='puzzle'?chapter<0?'Puzzle':`Puzzle ${puzzleLabel(saved.sourceId)}`:saved?.mode==='challenge'?'Shared challenge':'Create';
    const date=typeof s.savedAt==='string'?new Date(s.savedAt):undefined;
    const when=date&&Number.isFinite(date.getTime())?`<time datetime="${date.toISOString()}">${escape(dateFormat.format(date))}</time>`:'<span>Date unavailable</span>';
    return `<span class="favorite-meta"><span class="favorite-context">${context}</span><span aria-hidden="true">·</span>${when}</span>`;
  };
  const renameForm=(seed:Seed,index:number)=>`<form class="favorite-row favorite-edit" data-library-id="${seed.id}" data-rename-form="${index}"><div class="favorite-info"><label for="rename-seed">Recipe name</label><input id="rename-seed" type="text" maxlength="60" required value="${escape(renameDraft)}" aria-describedby="rename-error">${metadata(seed)}</div><div class="favorite-actions"><button type="button" class="button" data-cancel-rename="${index}">Cancel</button><button class="button primary" type="submit">${icon('check',16)} Save name</button></div><p id="rename-error" class="reset-progress-error" role="alert" ${renameError?'':'hidden'}>${escape(renameError||'')}</p></form>`;
  $('favorites-list').innerHTML=seeds.length?seeds.map((s,i)=>{
    if(renamingSeed===s.id)return renameForm(s,i);
    return `<div class="favorite-row" data-library-id="${s.id}"><div class="favorite-info"><span class="favorite-name">${escape(s.name)}</span>${metadata(s)}</div><div class="favorite-actions"><button class="button" data-seed="${i}" aria-label="Open ${escape(s.name)}">${icon('folder',16)} Open</button><button class="icon-button" data-rename-seed="${i}" aria-label="Rename ${escape(s.name)}" title="Rename">${icon('rename',16)}</button><button class="icon-button" data-delete-seed="${i}" aria-label="Delete ${escape(s.name)}" title="Delete">${icon('trash',16)}</button></div></div>`;
  }).join(''):deletedSeeds.length||renamingSeed?'':`<div class="empty-library">${icon('folder',32)}<p>Your saved recipes appear here.</p></div>`;
  // An external deletion cannot discard a name the player is still editing.
  if(renamingSeed&&renameSeed&&!seeds.some(seed=>seed.id===renamingSeed))$('favorites-list').insertAdjacentHTML('afterbegin',renameForm(renameSeed,-1));
  if(deletedSeeds.length)$('favorites-list').insertAdjacentHTML('beforeend',`<section class="deleted-seeds" aria-labelledby="deleted-seeds-title"><h3 id="deleted-seeds-title">Recently deleted</h3>${deletedSeeds.map((seed,i)=>`<div class="deleted-seed-row" data-library-id="${seed.id}"><div class="favorite-info"><span class="deleted-seed-name">${escape(seed.name)}</span>${metadata(seed)}</div><div class="favorite-actions"><button class="button" data-restore-seed="${i}" aria-label="Undo deletion of ${escape(seed.name)}">${icon('undo',16)} Undo</button><button id="purge-${seed.id}" class="icon-button" data-purge-seed="${i}" aria-label="Permanently delete ${escape(seed.name)}" title="Delete forever" aria-haspopup="dialog" aria-controls="purge-seed-dialog">${icon('trash',16)}</button></div></div>`).join('')}</section>`);
  if(owned&&focusId&&focusAttribute){
    const next=seedControl(focusId,focusAttribute)||$('seed-name');next.focus({preventScroll:true});
    if(selection&&next instanceof HTMLInputElement)next.setSelectionRange(...selection);
  }
}
$('library-open').onclick=()=>{renamingSeed=undefined;renameSeed=undefined;$('library-error').hidden=true;renderSeeds();open('library-dialog');void refreshLibrary(true);};
function saveRecipe(name:string) {
  return serial(async()=>{
    if(!state)return;
    const snapshot={state:clone(state),slots:[...railSlots]},savedView=view;
    const reply=await kernel.run(snapshot.state,{type:'export',kind:'creation',view:savedView});requireOk(reply);
    try {
      await changeLibrary({type:'save',seed:{id:crypto.randomUUID(),name:name.trim().slice(0,60)||'My next great throw',artifact:reply.artifact!,snapshot,view:savedView,savedAt:new Date().toISOString()}});
    }catch(e){
      if(e instanceof DeviceStorageError)throw new Error('Could not save on this device. Keep this recipe open and export progress from Save & open.');
      throw e;
    }
    notice={text:'',kind:''};showNotice();renderSeeds();return true;
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
// A saved recipe is local work; the link that opened earlier work stays behind.
function openSeed(seed:Seed,intent=beginWorkspaceChange('')) {
  if(!seed.snapshot)return importData(seed.artifact,'library',intent);
  return serial(async()=>{
    if(!currentIntent(intent))return false;
    const saved=parseSave({schema:1,type:'save',state:seed.snapshot!.state,slots:seed.snapshot!.slots,view:seed.view||view,completed:[...completed]});
    const reply=await owned(intent,kernel.run(saved.state,{type:'evaluate'}));if(!reply)return false;
    requireOk(reply);acknowledge(intent);
    accept(reply,'clear',saved.slots,saved.view);preferences();return true;
  });
}
function finishRename(id:string) {
  renamingSeed=undefined;renameSeed=undefined;renderSeeds();
  (seedControl(id,'data-rename-seed')||seedControl(id,'data-restore-seed')||$('seed-name')).focus({preventScroll:true});
}
function libraryRowError(id:string,attribute:string,text:string) {
  const button=seedControl(id,attribute);
  if(!button){$('library-error').textContent=text;$('library-error').hidden=false;return;}
  const row=button.closest('.favorite-row,.deleted-seed-row')!;
  let message=row.querySelector<HTMLElement>('.favorite-error');
  if(!message){message=document.createElement('p');message.className='favorite-error reset-progress-error';message.setAttribute('role','alert');row.append(message);}
  message.textContent=text;
}
$('favorites-list').onclick=async event=>{
  const b=(event.target as Element).closest<HTMLElement>('button'),id=b?.closest<HTMLElement>('[data-library-id]')?.dataset.libraryId;if(!b||!id||b.getAttribute('aria-disabled')==='true')return;
  if(b.dataset.renameSeed!==undefined){
    await refreshLibrary();if(!$<HTMLDialogElement>('library-dialog').open)return;const seed=seeds.find(seed=>seed.id===id);if(!seed){renderSeeds();return;}
    renamingSeed=id;renameSeed=seed;renameDraft=seed.name;renderSeeds(false);
    const input=$<HTMLInputElement>('rename-seed');input.focus({preventScroll:true});input.select();
  }
  if(b.dataset.cancelRename!==undefined)finishRename(id);
  if(b.dataset.purgeSeed!==undefined){
    await refreshLibrary();if(!$<HTMLDialogElement>('library-dialog').open)return;const seed=deletedSeeds.find(seed=>seed.id===id);if(!seed){renderSeeds();return;}
    purgingSeed=id;$('purge-seed-description').textContent=`Permanently delete “${seed.name}” from Recently deleted? You cannot undo this.`;
    $('purge-seed-error').hidden=true;open('purge-seed-dialog',b.id);
  }
  if(b.dataset.deleteSeed!==undefined||b.dataset.restoreSeed!==undefined){
    const restoring=b.dataset.restoreSeed!==undefined,attribute=restoring?'data-restore-seed':'data-delete-seed';
    b.setAttribute('aria-disabled','true');
    try{
      const changed=await changeLibrary(restoring?{type:'restore',id}:{type:'delete',id,at:new Date().toISOString()});
      if(renamingSeed===id){renamingSeed=undefined;renameSeed=undefined;}
      $('library-error').hidden=true;notice={text:'',kind:''};showNotice();renderSeeds();
      (seedControl(id,restoring?'data-seed':'data-restore-seed')||$('seed-name')).focus();
      $('library-status').textContent=restoring?`${changed.name} restored.`:`${changed.name} deleted. Undo stays available in Recently deleted.`;
    }catch(e){
      await refreshLibrary();renderSeeds();
      libraryRowError(id,attribute,e instanceof DeviceStorageError?(restoring?'Could not restore on this device. Your recipe is still available here; try Undo again.':'Could not delete on this device. Your saved recipe is still here.'):(e instanceof Error?e.message:String(e)));
    }finally{b.removeAttribute('aria-disabled');}
  }
  if(b.dataset.seed!==undefined){
    // Open claims the page at the click, so a newer navigation during the read wins.
    const intent=beginWorkspaceChange(''),owns=()=>currentIntent(intent);
    await refreshLibrary(false,owns);if(!owns()||!$<HTMLDialogElement>('library-dialog').open)return;const seed=seeds.find(seed=>seed.id===id);
    if(seed)changeWorkspace(()=>openSeed(seed,intent).then(ok=>{if(ok&&owns())closeDialogs();}),seed.name,false,undefined,intent);else renderSeeds();
  }
};
$('favorites-list').addEventListener('submit',async event=>{
  const form=(event.target as Element).closest<HTMLFormElement>('[data-rename-form]');if(!form)return;
  event.preventDefault();
  const id=form.dataset.libraryId!,input=$<HTMLInputElement>('rename-seed'),name=input.value.trim().slice(0,60);
  const fail=(message:string)=>{if(renamingSeed!==id)return;$('rename-error').textContent=message;$('rename-error').hidden=false;$('rename-seed').focus({preventScroll:true});};
  if(!name){fail('Enter a recipe name.');return;}
  try{await changeLibrary({type:'rename',id,name});}
  catch(e){fail(e instanceof DeviceStorageError?'Could not save the name on this device. Try again.':(e instanceof Error?e.message:String(e)));return;}
  if(renamingSeed===id)finishRename(id);else renderSeeds();$('move-announcement').textContent=`Recipe renamed to ${name}.`;
});
$('favorites-list').addEventListener('keydown',event=>{
  if(event.defaultPrevented||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
  if(event.key==='Escape'&&renamingSeed!==undefined){event.preventDefault();event.stopPropagation();finishRename(renamingSeed);}
});
let purgingSeed:string|undefined;
async function returnFromPurge(id:string|undefined) {
  await refreshLibrary();renderSeeds();open('library-dialog');
  requestAnimationFrame(()=>{if($<HTMLDialogElement>('library-dialog').open)(id&&seedControl(id,'data-purge-seed')||$('seed-name')).focus({preventScroll:true});});
}
$('purge-seed-cancel').onclick=()=>returnFromPurge(purgingSeed);
$('purge-seed-confirm').onclick=async()=>{
  const id=purgingSeed;if(!id)return;
  const confirm=$<HTMLButtonElement>('purge-seed-confirm'),cancel=$<HTMLButtonElement>('purge-seed-cancel');
  confirm.disabled=true;cancel.disabled=true;
  try {
    const removed=await changeLibrary({type:'purge',id});
    if(renamingSeed===id){renamingSeed=undefined;renameSeed=undefined;}
    purgingSeed=undefined;await returnFromPurge(undefined);$('library-status').textContent=`${removed.name} permanently deleted.`;
  }catch(e){
    $('purge-seed-error').textContent=e instanceof DeviceStorageError?'Could not delete on this device. The recovery copy is still available. Try again.':(e instanceof Error?e.message:String(e));
    $('purge-seed-error').hidden=false;
  }finally{confirm.disabled=false;cancel.disabled=false;}
};
async function refreshDeviceStorage(key:string|null) {
  if(key===SEEDS||key===null)await refreshLibrary(true);
  if(key===SAVE||key===null){await refreshCompletions();if(initialized){renderLevels();if($<HTMLDialogElement>('ending-dialog').open)renderEnding();}}
}
window.addEventListener('storage',event=>{if(event.key===SEEDS||event.key===SAVE||event.key===null)void refreshDeviceStorage(event.key);});
storageChannel?.addEventListener('message',event=>{if(event.data?.key===SAVE||event.data?.key===SEEDS)void refreshDeviceStorage(event.data.key);});
window.addEventListener('focus',()=>void refreshDeviceStorage(null));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refreshDeviceStorage(null);});

function parseSave(value:unknown) {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Choose an Angouri JSON file.');
  const data={...value,view:canonicalView((value as Record<string,unknown>).view)} as Record<string,unknown>;
  if(data.schema!==1||data.type!=='save'||Object.keys(data).some(k=>!['schema','type','state','slots','completed','view','entry','progressEpoch','confirmed'].includes(k))||data.entry!==undefined&&(typeof data.entry!=='string'||data.entry.length>8192))throw new Error('Unsupported progress file.');
  if(data.progressEpoch!==undefined&&(typeof data.progressEpoch!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(data.progressEpoch))||data.confirmed!==undefined&&typeof data.confirmed!=='boolean')throw new Error('The progress file has invalid fields.');
  if(!Array.isArray(data.completed)||data.completed.length>LEVELS.length||!data.completed.every(n=>Number.isInteger(n)&&n>=1&&n<=LEVELS.length)||!isView(data.view)||!data.state)throw new Error('The progress file has invalid fields.');
  if(data.slots!==undefined&&(!Array.isArray(data.slots)||data.slots.length>65||!data.slots.every(id=>id===null||typeof id==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(id))))throw new Error('The saved recipe slots are invalid.');
  return {state:data.state as State,slots:data.slots as RailSlots|undefined,completed:data.completed as number[],view:data.view,confirmed:data.confirmed===true,progressEpoch:data.progressEpoch as string|undefined};
}
type ImportOrigin='restore'|'link'|'file'|'library';
type PreparedImport={origin:ImportOrigin;reply:Response;slots?:RailSlots;view?:View;completed?:number[];confirmed?:boolean};
type ImportAttempt={kind:'ready';prepared:PreparedImport}|{kind:'invalid';message:string}|{kind:'unavailable';message:string}|{kind:'superseded';restorable?:boolean};
const failureMessage=(failure:unknown)=>failure instanceof Error?failure.message:String(failure);
// A restore attempt reports its kernel outcome to its own saved-work candidate,
// even when a newer navigation has superseded the workspace change.
function prepareImport(value:unknown,origin:ImportOrigin,intent:WorkspaceIntent,candidate?:SaveCandidate):Promise<ImportAttempt|undefined> {
  return serial(async()=>{
    const attempt=await prepareAttempt(value,origin,intent);
    if(candidate)settleSave(candidate,intent,attempt);
    return attempt;
  });
}
async function prepareAttempt(value:unknown,origin:ImportOrigin,intent:WorkspaceIntent):Promise<ImportAttempt> {
  if(!currentIntent(intent))return {kind:'superseded'};
  let snapshot:State|undefined,action:Action,slots:RailSlots|undefined,requestedView:View|undefined,ids:number[]|undefined,confirmed:boolean|undefined;
  try {
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Choose an Angouri JSON file.');
    const data={...value,view:canonicalView((value as Record<string,unknown>).view)} as Record<string,unknown>;
    // Sharing grants no authority to replace local chapter progress. Full
    // saves belong to the explicit file import and trusted local restoration.
    if(origin==='link'&&!['level','creation','challenge'].includes(String(data.type)))throw new Error('This is not a shared puzzle or recipe link. Use Import progress from file for a progress save.');
    if(data.type==='save') {
      const save=parseSave(data);snapshot=save.state;action={type:'evaluate'};
      slots=save.slots;requestedView=save.view;ids=save.completed;confirmed=save.confirmed;
    } else if(data.type==='level') {
      if(data.schema!==1||Object.keys(data).some(k=>!['schema','type','sourceId','view'].includes(k))||!isView(data.view))throw new Error('Unsupported puzzle link file.');
      action={type:'level',sourceId:data.sourceId,mode:'puzzle'};requestedView=data.view;
    } else {snapshot=state;action={type:'import',artifact:data};requestedView=isView(data.view)?data.view:undefined;}
  }catch(failure){return {kind:'invalid',message:failureMessage(failure)};}
  let reply:Response;
  try {reply=await kernel.run(snapshot,action);}
  catch(failure){return currentIntent(intent)?{kind:'unavailable',message:failureMessage(failure)}:{kind:'superseded'};}
  if(!currentIntent(intent))return {kind:'superseded',restorable:reply.status==='ok'&&!!reply.state&&!!reply.result};
  if(reply.status==='error')return {kind:'unavailable',message:reply.message||'The math engine could not open this recipe. Try again.'};
  try {requireOk(reply);}catch(failure){return {kind:'invalid',message:failureMessage(failure)};}
  return {kind:'ready',prepared:{origin,reply,slots,view:requestedView,completed:ids,confirmed}};
}
function acceptPreparedImport(prepared:PreparedImport,intent:WorkspaceIntent,persist=true) {
  return serial(async()=>{
    if(!currentIntent(intent))return false;
    if(prepared.completed&&prepared.origin==='file') {
      if(!await owned(intent,replaceProgress(prepared.reply,prepared.slots,prepared.view??view,prepared.completed,intent.entry,()=>currentIntent(intent))))return false;
    } else if(prepared.origin==='restore')await refreshCompletions(()=>currentIntent(intent));
    if(!currentIntent(intent))return false;
    acknowledge(intent);
    accept(prepared.reply,'clear',prepared.slots,prepared.view,true,undefined,undefined,false,undefined,{persist,confirmed:prepared.confirmed});
    preferences();return true;
  });
}
async function importData(value:unknown,origin:'library'|'file'|'link'='library',intent=beginWorkspaceChange()) {
  const attempt=await prepareImport(value,origin,intent);
  if(!attempt||attempt.kind==='superseded'||!currentIntent(intent))return false;
  if(attempt.kind!=='ready'){replaceEntry(acknowledgedEntry);error(attempt.message);return false;}
  // Invalid files do not cancel an initial load. Claim navigation only after
  // validation, provided no newer navigation arrived while the file was read.
  // An accepted file is local work, so it detaches the link that opened the page.
  const transition=origin==='file'?beginWorkspaceChange(''):intent;
  const commit=()=>acceptPreparedImport(attempt.prepared,transition);
  if(origin==='library')return commit();
  return changeWorkspace(commit,origin==='file'?'this file':'this shared link',false,undefined,transition);
}
function linkValue(entry:string):unknown {
  const fragment=new URLSearchParams(entry.slice(1));
  if(fragment.has('v1')) {
    const value=decode(fragment.get('v1')!);
    if(!value||typeof value!=='object'||!['creation','challenge'].includes(String((value as {type?:unknown}).type)))
      throw new Error('This is not a shared puzzle or recipe link. Use Import progress from file for a progress save.');
    return value;
  }
  if(fragment.has('level'))return {schema:1,type:'level',sourceId:Number(fragment.get('level')),view:isView(fragment.get('view'))?fragment.get('view'):'flight'};
}
$('import-open').onclick=()=>{closeDialogs();$<HTMLInputElement>('import-file').click();};
$<HTMLInputElement>('import-file').onchange=async()=>{
  const file=$<HTMLInputElement>('import-file').files?.[0];if(!file)return;
  const intent={generation:workspaceGeneration,entry:acknowledgedEntry};
  try {
    if(file.size>65536)throw new Error('Files must be smaller than 64 KiB.');
    const value=JSON.parse(await file.text());
    if(currentIntent(intent))await importData(value,'file',intent);
  }catch(failure){if(currentIntent(intent))error(failureMessage(failure));}
  finally{$<HTMLInputElement>('import-file').value='';}
};
async function start(intent=beginWorkspaceChange(location.hash)) {
  palette();
  let raw:string|null,primary=true;
  try{raw=await storageTransactions.read(SAVE);}
  // The compatibility mirror may still open a session draft, but it is not
  // proof of the primary bytes and grants no authority to replace them.
  catch{primary=false;try{raw=localStorage.getItem(SAVE);}catch{raw=null;}}
  // An obsolete startup changes no metadata, status or protection.
  if(!currentIntent(intent))return;
  if(!primary)storageStatus(SAVE,false);
  const inspected=inspectSave(raw),saved=inspected.failure?undefined:inspected.value;
  const completion=inspected.failure?inspected.failure.completion:readableCompletion(inspected.value);
  // An unread primary is unknown, not absent: keep acknowledged completions.
  if(primary&&completion)adoptCompletions(completion);
  const savedFirst=!!saved&&(saved as {entry?:unknown}).entry===intent.entry&&!!intent.entry;
  // The latest startup owns protection for the bytes it just read, installed
  // before any await. Identical bytes keep their candidate and failure evidence.
  let candidate:SaveCandidate|undefined;
  if(!primary)protectSave(savedCandidate?.raw===undefined&&savedCandidate||{raw:undefined,status:'unavailable',reason:'The saved device record could not be read.'});
  else if(raw===null||raw===trustedRaw)protectSave(undefined);
  else {
    candidate=savedCandidate?.raw===raw?savedCandidate:{raw,...inspected.failure??{status:'pending',reason:'',completion}};
    protectSave(candidate);
  }
  await refreshLibrary(false,()=>currentIntent(intent));
  // A new deep link replaces the open workspace, not the chapter record.
  if(primary)await refreshCompletions(()=>currentIntent(intent));
  const savedEntry=saved&&typeof saved==='object'&&(saved as {entry?:unknown}).entry;
  const restoreEntry=typeof savedEntry==='string'&&(!savedEntry||savedEntry.startsWith('#'))?savedEntry:'';
  let invalidMessage='',triedSaved=false;
  const tryOpen=async(value:unknown,origin:ImportOrigin,entry=intent.entry)=>{
    const attempt=await prepareImport(value,origin,intent,origin==='restore'?candidate:undefined);
    if(!attempt||attempt.kind==='superseded'||!currentIntent(intent))return false;
    if(attempt.kind==='unavailable')throw new Error(attempt.message);
    if(attempt.kind==='invalid'){invalidMessage=attempt.message;return false;}
    // A protected candidate leaves every opened workspace session-only.
    const opened=!!await acceptPreparedImport(attempt.prepared,{...intent,entry},origin!=='restore'&&!protecting());
    if(opened&&protecting()&&currentIntent(intent))error(protectedNotice());
    return opened;
  };
  try {
    if(savedFirst) {
      triedSaved=true;if(await tryOpen(saved,'restore'))return;
    }
    if(!currentIntent(intent))return;
    let incoming:unknown;
    try {incoming=linkValue(intent.entry);}catch(failure){invalidMessage=failureMessage(failure);}
    // A different link replaces saved work only after the kernel accepts those
    // bytes. Validate without opening the old workspace; a temporary failure
    // leaves them protected and the link session-only.
    if(incoming!==undefined&&saved&&!triedSaved&&candidate&&savedCandidate===candidate) {
      const check=await prepareImport(saved,'restore',intent,candidate);
      if(!check||check.kind==='superseded'||!currentIntent(intent))return;
    }
    if(incoming!==undefined) {
      if(await tryOpen(incoming,'link'))return;
      if(!currentIntent(intent))return;
      const source=(incoming as {type?:unknown;sourceId?:unknown})?.sourceId;
      if((incoming as {type?:unknown})?.type==='level'&&Number.isInteger(source)&&Number(source)>=1&&Number(source)<=LEVELS.length)
        throw new Error(invalidMessage||'The requested puzzle could not load. Try again.');
    }
    if(!currentIntent(intent))return;
    // A rejected link and a saved workspace are independent candidates. Restore
    // valid local work without rewriting its original durable representation.
    if(saved&&!triedSaved&&await tryOpen(saved,'restore',invalidMessage?restoreEntry:intent.entry)) {
      if(invalidMessage&&!protecting())error('This shared link could not be opened. Your saved recipe is ready.');
      return;
    }
    if(!currentIntent(intent))return;
    if(await tryOpen({schema:1,type:'level',sourceId:1,view},'library',invalidMessage?'':intent.entry)&&invalidMessage&&!protecting())
      error('The saved or shared file could not be opened. A fresh puzzle is ready.');
  }catch(failure){
    if(!currentIntent(intent))return;
    $('scene').innerHTML=`<div class="loading-scene"><img src="./favicon.svg" width="56" height="56" alt=""><p>Getting ready to throw.</p><small>${escape(failureMessage(failure))}</small><button id="retry-engine" class="button primary">Try again</button></div>`;
    $('retry-engine').onclick=()=>{kernel.restart();void start();};
    error('The math engine is unavailable. Your saved progress is still on this device.');
  }
}
void start();
window.addEventListener('hashchange',event=>{
  const intent=beginWorkspaceChange(new URL(event.newURL).hash);
  if(!initialized){void start(intent);return;}
  try {
    const value=linkValue(intent.entry);
    if(value!==undefined)void importData(value,'link',intent);
    else acknowledge(intent);
  }catch(failure){replaceEntry(acknowledgedEntry);error(failureMessage(failure));}
});
// Read-only diagnostics for reproducible loading/latency/recovery checks.
Object.defineProperty(window,'angouri',{value:{get state(){return clone(state);},get slots(){return [...railSlots];},get result(){return clone(result);},get view(){return view;},get flight(){return clone(flight);},get history(){return {undo:undo.length,redo:redo.length};},get measurements(){return clone(kernel.measurements);},restart:()=>kernel.restart(),whenIdle:async()=>{await chain;await savesIdle();}}});
