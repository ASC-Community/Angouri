import './style.css';
import './play.css';
import { renderBrand } from './brand';
import { Kernel } from './engine';
import { icon } from './icons';
import { ShapeNotes, chapterArt } from './notes';
import { functionView, flow, interpolate, path, sizeFlightAnnotations, targetDescription, targetMark, targetStatus, tex, transform, updateFlowProbe, flightView, type Camera, type Flight } from './views';
import { CHAPTERS, chapterIndex, CURVES, curveId, escape, fraction, isCapstone, LEVELS, OPS, PUZZLE_ORDER, type Action, type Artifact, type Op, type Response, type Result, type State, type View } from './types';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const SAVE = 'angouri:vine:v1:progress', PREF = 'angouri:vine:v1:preferences', SEEDS = 'angouri:vine:v1:seeds';
const views: View[] = ['flight','function','flow'];
const clone = <T>(value: T): T => structuredClone(value);
let storageAvailable = true;
function read(key: string): unknown {
  let s: string | null;
  try { s = localStorage.getItem(key); }
  catch { storageAvailable=false; return undefined; }
  try {return s && s.length<=65536 ? JSON.parse(s) : undefined;}catch{return undefined;}
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
const preference = read(PREF) as {view?:unknown;motion?:unknown} | undefined;
const preferredView=canonicalView(preference?.view);
let view: View = isView(preferredView) ? preferredView : 'flight';
let reduced = typeof preference?.motion==='boolean' ? preference.motion : matchMedia('(prefers-reduced-motion: reduce)').matches;
let flight: Flight = {phase:'ready',position:0};
let throwWon=false;
let state: State | undefined, result: Result | undefined;
let camera: Camera = {min:-.8,max:5.2};
let insertionIndex: number | undefined, selectedStage = '';
let probeIndex=40;
let flowScroll={left:0,top:0},resetFlowScroll=false;
type RailSlots=(string|null)[];
type Snapshot={state:State;slots:RailSlots};
let railSlots:RailSlots=[];
let undo: Snapshot[] = [], redo: Snapshot[] = [];
let completed = new Set<number>();
const introStage=()=>state?.mode==='puzzle'&&[1,2].includes(state.sourceId)?state.sourceId:0;
const introActive=()=>introStage()>0;
const displayedView=():View=>introActive()?'flight':view;
const notesOrders=new Set<string>();
let notesOffered=false,notesCue=false;
let notesBlockSet='',bestTargetHits=-1,unsuccessfulRevisions=0;
let initialized = false, pending = 0;
let chain = Promise.resolve();
let notice = {text:'Tap or drag a block.',kind:''};
let morphFrame=0, displayedPoints: Result['points'] | undefined;
interface Seed { name: string; artifact: Artifact; snapshot?:Snapshot; view?:View; savedAt?:string }
const storedSeeds = read(SEEDS);
let seeds: Seed[] = Array.isArray(storedSeeds) ? storedSeeds.slice(0,12).filter((s):s is Seed=>!!s&&typeof s.name==='string'&&s.name.length<=60&&s.artifact?.type==='creation') : [];
const kernel = new Kernel((message)=> { notice={text:message,kind:'error'}; showNotice(); });
const shapeNotes = new ShapeNotes(kernel);

function preferences() { write(PREF,{view,motion:reduced}); }
function progress() { if(state) write(SAVE,{schema:1,type:'save',state,slots:railSlots,completed:[...completed],view,entry:location.hash.slice(0,8192)}); }
function normalizeSlots(next:State,preferred?:RailSlots):RailSlots {
  const ids=next.nodes.map(node=>node.id),size=next.mode==='remix'?ids.length+1:next.limit;
  let slots=(preferred||ids).map(id=>id&&ids.includes(id)?id:null);
  if(JSON.stringify(slots.filter(Boolean))!==JSON.stringify(ids))slots=[...ids];
  while(slots.length>size){const empty=slots.lastIndexOf(null);if(empty<0)break;slots.splice(empty,1);}
  while(slots.length<size)slots.push(null);
  return slots;
}
function showNotice() {
  $('feedback').className=`feedback ${notice.kind}`;
  $('feedback').innerHTML=`${notice.kind==='error'?'':icon('hand',16)}<span>${escape(notice.text)}</span>`;
  $('feedback').hidden=!notice.text||(throwWon&&notice.kind!=='error');
}
function error(message: string) { notice={text:message,kind:'error'}; showNotice(); }
function serial<T>(work: ()=>Promise<T>): Promise<T | undefined> {
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
function updateNotesCue(history:'push'|'keep'|'clear') {
  if(!state||!result||state.mode!=='puzzle'||state.sourceId===1||notesOffered)return false;
  const order=state.nodes.map(node=>node.op).join(''),blockSet=[...order].sort().join('');
  const hits=result.checkpoints.filter(c=>c.hit).length;
  if(blockSet!==notesBlockSet) {notesBlockSet=blockSet;notesOrders.clear();bestTargetHits=-1;unsuccessfulRevisions=0;}
  // Count accepted new orderings, not building, empty-slot moves or Undo/Redo.
  if(hits>bestTargetHits||result.solved)unsuccessfulRevisions=0;
  else if(history==='push'&&!notesOrders.has(order))unsuccessfulRevisions++;
  notesOrders.add(order);bestTargetHits=Math.max(bestTargetHits,hits);
  if(unsuccessfulRevisions<3)return false;
  notesOffered=true;notesCue=true;return true;
}
function accept(reply: Response, history: 'push'|'keep'|'clear' = 'push',slots?:RailSlots,requestedView?:View) {
  requireOk(reply);
  const previousState=state,previousResult=result,previousPoints=displayedPoints||result?.points;
  const previousScroll=$('construction').querySelector('.pipeline')?.scrollLeft||0;
  const previousRects=new Map([...document.querySelectorAll<HTMLElement>('.recipe-part')].map(el=>[el.dataset.part!,el.getBoundingClientRect()]));
  const changed=state && JSON.stringify(state)!==JSON.stringify(reply.state);
  const nextSlots=normalizeSlots(reply.state,history==='clear'?slots:slots||railSlots);
  const layoutChanged=JSON.stringify(nextSlots)!==JSON.stringify(railSlots);
  if(history==='clear') {undo=[];redo=[];resetFlowScroll=true;}
  else if(history==='push'&&state&&(changed||layoutChanged)) {undo.push({state:clone(state),slots:[...railSlots]}); if(undo.length>100)undo.shift(); redo=[];}
  const newSource=!state||state.sourceId!==reply.state.sourceId||state.mode!==reply.state.mode;
  if(newSource||history==='clear') {notesOrders.clear();notesOffered=false;notesCue=false;notesBlockSet='';bestTargetHits=-1;unsuccessfulRevisions=0;}
  state=reply.state;result=reply.result;railSlots=nextSlots;initialized=true;
  if(requestedView&&!introActive())view=requestedView;
  const offeredNotes=updateNotesCue(history);
  const previousOrder=previousState?.nodes.map(node=>node.op).join('')||'',order=state.nodes.map(node=>node.op).join('');
  const repeatNotes=notesCue&&!offeredNotes&&history==='push'&&previousOrder!==order&&[...previousOrder].sort().join('')===[...order].sort().join('');
  $('playground').setAttribute('aria-busy',String(pending>0));
  if(newSource) {
    selectedStage='';
    const guide=result.heightGuide;
    probeIndex=Math.floor(result.points.length/2);
    if(guide) {
      const from=fraction(guide.fromX),to=fraction(guide.toX),middle=result.points[probeIndex][0];
      // Keep the central feature in view; an evenly placed pair keeps the midpoint.
      const position=chapterIndex(state.sourceId)===0?from:Math.abs(from-middle)===Math.abs(to-middle)?middle:Math.abs(from-middle)<Math.abs(to-middle)?from:to;
      probeIndex=result.points.findIndex(point=>point[0]===position);
    }
  }
  if(changed||newSource||history==='clear') {
    flight={phase:'ready',position:0};throwWon=false;
    const [baseMin,baseMax]=LEVELS[state.sourceId-1].y;
    const ys=[...result.points.map(p=>p[1]),...state.goals.map(g=>fraction(g.y))];
    const min=Math.min(0,baseMin,...ys),max=Math.max(0,baseMax,...ys),padding=Math.max((max-min)*.12,.6);
    camera={...camera,min:min<baseMin?min-padding:baseMin,max:max>baseMax?max+padding:baseMax};
  }
  if(!result.stages.some(s=>s.id===selectedStage)) selectedStage='';
  insertionIndex=undefined;
  notice={text:state.nodes.length?'':introActive()?'Choose a block.':'Tap or drag a block.',kind:''};
  progress();render();
  if(repeatNotes&&notesCue)for(const animation of $('ideas-open').getAnimations()) {
    if(animation instanceof CSSAnimation&&animation.animationName==='notes-invite')animation.currentTime=0;
  }
  const added=state.nodes.find(node=>!previousState?.nodes.some(before=>before.id===node.id));
  if(added&&!newSource) {
    const index=railSlots.indexOf(added.id),reveal=state.mode==='remix'&&index===railSlots.length-2?index+1:index;
    document.querySelector<HTMLElement>(`[data-cell="${reveal}"]`)?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
    const scrollDelta=($('construction').querySelector('.pipeline')?.scrollLeft||0)-previousScroll;
    if(scrollDelta)previousRects.forEach((r,id)=>previousRects.set(id,new DOMRect(r.x-scrollDelta,r.y,r.width,r.height)));
  }
  if((changed||layoutChanged)&&!newSource&&previousState&&previousResult&&previousPoints) {
    $('move-announcement').textContent=changed?`${state.nodes.map(n=>OPS[n.op].name).join(', ')||'Recipe cleared'}. Ready to throw.`:'Empty slot moved.';
    animateChange(previousState,previousPoints,previousRects);
  }
  if(offeredNotes)$('move-announcement').textContent+=' Shape notes connect ideas from earlier puzzles.';
  return true as const;
}
function perform(action: Action, history: 'push'|'keep'|'clear'='push',slots?:RailSlots) { return serial(async()=>accept(await kernel.run(state,action),history,slots)); }
function historyMove(back: boolean) {
  return serial(async()=> {
    const source=back?undo:redo, target=source.at(-1);
    if(!target||!state)return;
    const reply=await kernel.run(target.state,{type:'evaluate'});requireOk(reply);
    (back?redo:undo).push({state:clone(state),slots:[...railSlots]});source.pop();accept(reply,'keep',target.slots);
  });
}
function cue(op: Op) {
  if(op==='D')return chapterArt(4).replace('<svg ','<svg class="ingredient-cue" ');
  if(op==='I')return chapterArt(5).replace('<svg ','<svg class="ingredient-cue" ');
  if(op==='Q')return `<svg class="ingredient-cue" viewBox="0 0 36 36" aria-hidden="true"><path d="M2 19H34" stroke="currentColor" opacity=".2"/><path d="M3 32L33 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 3" opacity=".45"/><path d="M3 5Q18 33 33 5" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/></svg>`;
  const transformed: Record<Exclude<Op,'Q'|'D'|'I'>,string>={H:'M3 26Q17 14 33 26',A:'M3 15Q17 0 33 15',N:'M3 19Q17 34 33 19'};
  return `<svg class="ingredient-cue" viewBox="0 0 36 36" aria-hidden="true"><path d="M3 27Q17 1 33 27" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 3" opacity=".4"/><path d="${transformed[op]}" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/></svg>`;
}
function palette() {
  const choosing=introActive();
  const creating=state?.mode==='remix',inventory=creating?{H:1,A:1,N:1,Q:1,D:1,I:1}:state?.inventory || {H:1,A:1};
  $('palette').setAttribute('role','group');
  $('palette').setAttribute('aria-label',choosing?'Choose a block':'Add a block to your recipe');
  $('palette').dataset.count=String(Object.values(inventory).filter(n=>n>0).length);
  // Reserve the whole pile, including a return above condensed or reusable stock.
  $('palette').style.setProperty('--stack-room',String(creating?1:Math.max(0,Math.min(5,Math.max(0,...Object.values(inventory))-1))));
  $('palette').innerHTML=(Object.keys(OPS) as Op[]).filter(op=>(inventory[op]||0)>0).map(op=>{
    const n=inventory[op]!;
    const used=creating||choosing?0:state?.nodes.filter(node=>node.op===op).length || 0;
    const returning=state?.nodes.find(node=>node.id===(drag?.id||selectedStage)&&node.op===op);
    const availability=choosing?'ready':used>=n?'used':!creating&&(state?.nodes.length||0)>=(state?.limit||1)?'full':'ready';
    const disabled=!initialized||availability!=='ready'&&!returning;
    const title=choosing?`Choose ${OPS[op].name}`:returning?'Return the selected block to this stack':availability==='used'?'All copies are in your recipe':availability==='full'?'Recipe full — return a block or Undo':`${OPS[op].description} Tap to add, or drag to a recipe slot.`;
    const remaining=n-used,layers=Math.min(remaining,5)+(returning?1:0),capacity=creating?1:Math.max(0,Math.min(n-1,5));
    return `<div class="ingredient-stack ${OPS[op].color}" style="--stack-capacity:${capacity};--stack-depth:${Math.max(0,layers-1)};--return-layer:${returning?1:0}"><span class="stock-deck" aria-hidden="true">${Array.from({length:Math.max(0,layers-1)},(_,i)=>`<i style="--layer:${i+1}"></i>`).join('')}</span><button class="ingredient ${OPS[op].color} ${returning?'return-ready':''}" data-op="${op}" ${returning?`data-return="${returning.id}"`:''} data-availability="${availability}" data-stock="${creating?'reusable':remaining}" draggable="false" ${disabled?'disabled':''} ${choosing?`aria-pressed="${state?.nodes[0]?.op===op}"`:''} aria-label="${choosing?'Choose '+OPS[op].name:returning?'Return selected '+OPS[op].name+', '+(creating?'reusable stack':`${remaining} available below`):'Add '+OPS[op].name+', '+(creating?'reusable':`${remaining} available`)}" title="${title}"><span class="ingredient-surface"><span class="piece-grip">${icon(returning?'return':disabled?availability==='used'?'check':'lock':'grip',16)}</span><span class="ingredient-face"><span class="op-formula">${tex(OPS[op].formula)}</span><strong>${OPS[op].name}</strong></span>${cue(op)}${creating?`<span class="reusable-mark" aria-hidden="true">${icon('reset',12)}</span>`:''}</span>${remaining>5?`<span class="stock-total" aria-hidden="true">${tex(String(remaining))}</span>`:''}</button></div>`;
  }).join('');
}
function recipe() {
  if(!state||!result)return;
  const previousScroll=$('construction').querySelector('.pipeline')?.scrollLeft||0;
  $('construction').classList.toggle('has-selection',!!selectedStage||insertionIndex!==undefined);
  const cells=railSlots.map((id,index)=>{
    if(!id)return `<button class="empty-slot insert-slot ${insertionIndex===index?'selected':''}" data-cell="${index}" data-empty="${index}" data-insert="${index}" draggable="false" aria-label="${selectedStage?'Move selected block to':'Empty'} slot ${index+1}" aria-pressed="${insertionIndex===index}" aria-describedby="empty-keyboard-help" title="Choose a block for this slot, or drag the empty slot to reposition it"><span class="piece-grip">${icon('grip',12)}</span>${icon('plus',18)}</button>`;
    const node=state!.nodes.find(n=>n.id===id)!,receiving=selectedStage&&selectedStage!==id||insertionIndex!==undefined;
    return `<div class="recipe-part ${OPS[node.op].color} ${selectedStage===node.id?'inspected':''} ${receiving?'receiving-cell':''}" data-cell="${index}" data-part="${node.id}" draggable="false"><button class="part-body" data-stage="${node.id}" aria-label="${receiving?'Move selection to slot '+(index+1):OPS[node.op].name+', slot '+(index+1)}" aria-pressed="${selectedStage===node.id}" aria-describedby="block-keyboard-help" title="${receiving?'Move selection here':OPS[node.op].name+' · drag to move, drag off the recipe to return'}"><span class="piece-grip">${icon('grip',14)}</span><span class="part-formula">${tex(OPS[node.op].formula)}</span></button></div>`;
  }).join('');
  const source=state.mode==='remix'?`<button id="source-choose" class="source-choice" aria-label="Change starting curve" aria-haspopup="dialog" aria-controls="curves-dialog" title="Change starting curve">${tex(result.stages[0].latex)}<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4 3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button>`:tex(result.stages[0].latex);
  $('construction').innerHTML=`<div class="pipeline" role="group" aria-label="${state.mode==='remix'?'Recipe with reusable blocks':`Recipe, ${state.nodes.length} of ${state.limit} slots filled`}"><div class="source-part" aria-label="Starting curve"><span class="source-label">Start</span>${source}</div>${cells}</div>`;
  $('construction').querySelector('.pipeline')!.scrollLeft=previousScroll;
}
function renderLevels() {
  if(!state)return;
  const option=(id:number,chapter:number,step:number)=>{
    const level=LEVELS[id-1],current=state!.mode==='puzzle'&&state!.sourceId===id;
    const challenge=isCapstone(id)?id===PUZZLE_ORDER.at(-1)?'Final challenge':'Chapter challenge':'';
    return `<button class="level-option ${current?'current':''}" data-level="${id}" aria-label="Chapter ${chapter+1}, puzzle ${step+1}: ${level.name}${challenge?', '+challenge:''}${completed.has(id)?', completed':''}" ${current?'aria-current="step"':''}><span class="level-number">${chapter+1}.${step+1}</span><span>${level.name}${challenge?`<small class="challenge-label">${icon('flag',12)}${challenge}</small>`:''}</span><span class="level-completion" aria-hidden="true">${icon(completed.has(id)?'check':current?'target':'arrow',20)}</span></button>`;
  };
  const currentChapter=chapterIndex(state.sourceId);
  $('level-nav').innerHTML=CHAPTERS.map((chapter,i)=>`<details class="chapter-group" name="chapters" ${i===Math.max(0,currentChapter)?'open':''}><summary><span class="chapter-art ${chapter.color}">${chapterArt(i)}</span><span><small>Chapter ${i+1}</small><strong>${chapter.name}</strong></span><span class="chapter-progress" aria-label="${chapter.levels.filter(id=>completed.has(id)).length} of ${chapter.levels.length} puzzles complete">${chapter.levels.filter(id=>completed.has(id)).length} / ${chapter.levels.length}</span>${icon('arrow',16)}</summary><div class="chapter-levels">${chapter.levels.map((id,step)=>option(id,i,step)).join('')}</div></details>`).join('');
}
function renderCurves() {
  $('curve-choices').innerHTML=CURVES.map(curve=>{
    const current=curve.id===curveId(state!.sourceId);
    return `<button class="curve-option ${current?'current':''}" data-source="${curve.id}" aria-pressed="${current}"><svg class="curve-thumbnail" viewBox="0 0 36 36" aria-hidden="true"><path d="M3 3V33H34" class="curve-axis"/><path d="${curve.path}" class="curve-shape"/></svg><span>${curve.name}<span class="curve-formula">${tex(curve.latex)}</span></span><span class="curve-selected" aria-hidden="true">${current?icon('check',18):''}</span></button>`;
  }).join('');
}
function renderScene() {
  if(!state||!result)return;
  const oldFlow=$('scene').querySelector<HTMLElement>('.flow-line');
  if(resetFlowScroll){flowScroll={left:0,top:0};resetFlowScroll=false;}
  else if(oldFlow)flowScroll={left:oldFlow.scrollLeft,top:oldFlow.scrollTop};
  const visibleView=displayedView();
  $('scene').dataset.view=visibleView;$('scene').setAttribute('role',introActive()?'region':'tabpanel');$('scene').setAttribute('aria-labelledby',introActive()?'level-title':`tab-${visibleView}`);
  $('scene').innerHTML=visibleView==='flight'?flightView(state,result,camera,flight):visibleView==='function'?functionView(state,result,flight):flow(state,result,selectedStage,probeIndex,flight);
  if(visibleView==='flight')sizeFlightAnnotations($('scene'));
  if(visibleView==='flow') {
    updateFlowProbe($('scene'),state,result,probeIndex);
    const line=$('scene').querySelector<HTMLElement>('.flow-line')!;
    line.scrollLeft=flowScroll.left;line.scrollTop=flowScroll.top;
  }
  animatePosition();
}
function updatePrimary() {
  const won=throwWon;
  const advancing=won&&state?.mode!=='remix';
  const active=flight.phase==='flying'||flight.phase==='releasing';
  $('rethrow').hidden=!advancing;
  $<HTMLButtonElement>('rethrow').disabled=!initialized||pending>0||active;
  const next=state?.mode==='puzzle'?PUZZLE_ORDER[PUZZLE_ORDER.indexOf(state.sourceId)+1]:undefined;
  const label=advancing?(state?.mode==='puzzle'?next?next===PUZZLE_ORDER.at(-1)?'Final challenge':chapterIndex(next)!==chapterIndex(state.sourceId)?'Next chapter':isCapstone(next)?'Chapter challenge':'Next puzzle':'Finish':'Create'):active?'In flight':flight.phase==='landed'?'Throw again':'Throw';
  $<HTMLButtonElement>('launch').disabled=!initialized||pending>0||active&&!advancing;
  $('launch').innerHTML=advancing?`<span>${label}</span>${icon('arrow',21)}`:`${icon('throw',21)}<span>${label}</span>`;
  $('launch').classList.toggle('continue-ready',advancing);
  $('launch').dataset.action=advancing?'continue':'throw';
  $('launch').setAttribute('aria-label',label);
  $('playground').dataset.phase=flight.phase;
  $('success').hidden=!won;
  if(won)$('success').innerHTML=`<span class="success-medal">${icon('check',22)}<span>${state?.mode==='puzzle'&&state.sourceId===PUZZLE_ORDER.at(-1)?'Final flight!':state?.sourceId===4&&state.nodes.length>4?'Try fewer blocks?':'All targets!'}</span></span>`;
  showNotice();
}
function render() {
  if(!state||!result)return;
  document.querySelector('.game-shell')!.classList.toggle('intro',introActive());
  document.querySelector('.game-shell')!.classList.toggle('landing',introStage()===1);
  // A concurrent edit or view change invalidates the held DOM node.
  if(pointer)finishPointer(undefined,true);
  cancelAnimationFrame(morphFrame);displayedPoints=undefined;
  const active=document.activeElement as HTMLElement|null;
  const focusAttr=['op','insert','stage'].find(k=>active?.dataset[k]!==undefined);
  const focusValue=focusAttr?active?.dataset[focusAttr]:undefined;
  const level=LEVELS[state.sourceId-1];
  const chapter=chapterIndex(state.sourceId),chapterInfo=CHAPTERS[chapter];
  $('level-category').textContent=state.mode==='puzzle'?(chapter<0?'BONUS PUZZLE':`CHAPTER ${chapter+1} · ${chapterInfo.name.toUpperCase()} · ${chapterInfo.levels.indexOf(state.sourceId)+1} OF ${chapterInfo.levels.length}`):state.mode==='remix'?'CREATE':'A SHARED CHALLENGE';
  $('level-title').textContent=state.mode==='puzzle'?level.name:state.mode==='remix'?'Your flight':'Hit their targets';
  $('playground').dataset.mode=state.mode;
  $('playground').dataset.choice=state.nodes.length?'placed':'empty';
  $('nav-create').hidden=state.mode==='remix';
  renderLevels();
  for(const v of views) {$(`tab-${v}`).setAttribute('aria-selected',String(view===v));$(`tab-${v}`).tabIndex=view===v?0:-1;}
  $('level-hint').textContent=state.mode==='remix'?'Explore a curve.':state.mode==='challenge'?'Hit every target.':level.hint;
  $<HTMLButtonElement>('ideas-open').disabled=false;
  if(result.solved)notesCue=false;
  $('ideas-open').classList.toggle('notes-cue',notesCue);
  palette();recipe();
  $<HTMLButtonElement>('undo').disabled=!undo.length;
  $<HTMLButtonElement>('redo').disabled=!redo.length;
  $<HTMLButtonElement>('reset').disabled=!state.nodes.length;
  const restartLabel=state.mode==='remix'?'Clear recipe':state.mode==='challenge'?'Restart challenge':'Restart puzzle';
  $('reset').setAttribute('aria-label',restartLabel);$('reset').title=restartLabel;
  $<HTMLButtonElement>('reset-progress-open').disabled=false;
  $('undo').classList.toggle('retry-cue',flight.phase==='landed'&&!result.solved);
  for(const id of ['share-open','nav-create','favorite-save'])$<HTMLButtonElement>(id).disabled=false;
  updatePrimary();renderScene();
  if(focusAttr&&focusValue!==undefined) {const candidate=document.querySelector<HTMLElement>(`[data-${focusAttr}="${CSS.escape(focusValue)}"]`);if(candidate&&!(candidate as HTMLButtonElement).disabled)candidate.focus({preventScroll:true});}
}
function setView(next: View) {view=next;preferences();progress();render();}
function animateChange(previousState:State, from:Result['points'], rects:Map<string,DOMRect>) {
  if(reduced||!state||!result)return;
  document.querySelectorAll<HTMLElement>('.recipe-part').forEach(el=>{
    const before=rects.get(el.dataset.part!),after=el.getBoundingClientRect();
    if(!previousState.nodes.some(n=>n.id===el.dataset.part))el.classList.add('just-placed');
    else if(before&&Math.abs(before.left-after.left)>2)el.animate([{transform:`translate(${before.left-after.left}px,${before.top-after.top}px)`},{transform:'translate(0,0)'}],{duration:220,easing:'ease-out'});
  });
  if(displayedView()!=='flight')return;
  const to=result.points,start=performance.now(),startX=from[0][0],range=from.at(-1)![0]-startX;
  const previous=to.map(([x])=>interpolate(from,(x-startX)/range)[1]);
  const paint=(time:number)=>{
    const progress=Math.min((time-start)/320,1),t=1-Math.pow(1-progress,3);
    displayedPoints=to.map(([x,y],i)=>[x,previous[i]+(y-previous[i])*t]);
    paintTrajectory(displayedPoints);animatePosition();
    if(progress<1)morphFrame=requestAnimationFrame(paint);else displayedPoints=undefined;
  };
  paint(start);
}
function paintTrajectory(points:Result['points']) {
  $('trajectory')?.setAttribute('d',path(points,state!,camera));
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
  const points=displayedPoints||result.points,xy=interpolate(points,flight.position),[x,y]=transform(state,camera,xy);
  // The kernel supplies the exact initial slope. Project it through the same
  // coordinate map as the curve; a mathematical angle is not a screen angle.
  const start=transform(state,camera,points[0]),ahead=transform(state,camera,[points[0][0]+1,points[0][1]+result.startSlope]);
  const angle=Math.atan2(ahead[1]-start[1],ahead[0]-start[0]),degrees=angle*180/Math.PI;
  const launcherTransform=`translate(${start[0]} ${start[1]}) rotate(${degrees}) translate(-40 12)`;
  $('launcher')?.setAttribute('transform',launcherTransform);
  $('launcher-front')?.setAttribute('transform',launcherTransform);
  const pull=flight.phase==='ready'?1:flight.phase==='releasing'?1-(flight.release||0):0;
  $('cucumber')?.setAttribute('transform',`translate(${(x-68*pull*Math.cos(angle)).toFixed(2)} ${(y-68*pull*Math.sin(angle)).toFixed(2)})`);
  // The artwork points upward. Keep one continuous rotation from the loaded
  // pose through release, then gradually introduce the airborne tumble.
  const tumble=620*flight.position*flight.position;
  $('flight-spin')?.setAttribute('transform',`rotate(${degrees+90+tumble})`);
  const before=transform(state,camera,interpolate(points,Math.max(0,flight.position-.005))),after=transform(state,camera,interpolate(points,Math.min(1,flight.position+.005)));
  $('flight-motion')?.setAttribute('transform',`rotate(${flight.position===0?degrees:Math.atan2(after[1]-before[1],after[0]-before[0])*180/Math.PI})`);
  const pouchX=-52*pull,pouchY=-3-9*pull,pouchScale=.75+.25*pull,pouchAngle=-90*(1-pull);
  const radians=pouchAngle*Math.PI/180;
  // Each band stays attached to an end of the pouch as it turns from loaded to resting.
  for(const [id,forkX,edgeY] of [['band-back',-11,-8],['band-front',12,8]] as const) {
    const endX=pouchX+(3*Math.cos(radians)-edgeY*Math.sin(radians))*pouchScale;
    const endY=pouchY+(3*Math.sin(radians)+edgeY*Math.cos(radians))*pouchScale;
    const middleX=(forkX+endX)/2,middleY=(-8+endY)/2+1.5*(1-pull);
    $(id)?.setAttribute('d',`M${forkX} -8Q${middleX.toFixed(2)} ${middleY.toFixed(2)} ${endX.toFixed(2)} ${endY.toFixed(2)}`);
  }
  $('slingshot-pouch')?.setAttribute('transform',`translate(${pouchX} ${pouchY}) rotate(${pouchAngle}) scale(${pouchScale})`);
  if(displayedView()==='flight')$('flight-trail')?.setAttribute('d',flight.phase==='ready'||flight.phase==='releasing'?'':path([...points.filter(p=>p[0]<xy[0]),xy],state,camera));
  if(displayedView()==='flow') {
    const slider=$<HTMLInputElement>('flow-position'),playing=flight.phase==='releasing'||flight.phase==='flying';
    const index=playing?Math.round(flight.position*(result.points.length-1)):probeIndex;
    slider.disabled=playing;
    slider.closest('.flow-controls')!.classList.toggle('playing',playing);
    if(Number(slider.dataset.probeIndex)!==index)updateFlowProbe($('scene'),state,result,index);
  }
  updateTargets();
}
function finishFlight() {
  flight={phase:'landed',position:1};animatePosition();
  notice={text:state?.mode==='remix'?'':result?.solved?'':introActive()?'Pick another block and try again.':'Adjust a block and try again.',kind:''};
  updatePrimary();$('undo').classList.toggle('retry-cue',!!state?.nodes.length&&!result?.solved);
  $('success').classList.toggle('just-solved',!!result?.solved&&!reduced);
  $('move-announcement').textContent=state?.mode==='remix'?'Throw complete.':result?.solved?'Every target hit. Puzzle solved.':`${result?.checkpoints.filter(c=>c.hit).length} of ${result?.checkpoints.length} targets hit. ${introActive()?'Pick another block':'Adjust your recipe'} and throw again.`;
}
function launch() {
  if(!initialized||pending)return;
  if(introActive()&&!state!.nodes.length)return;
  if(throwWon&&state?.mode!=='remix') {
    const index=PUZZLE_ORDER.indexOf(state!.sourceId),next=PUZZLE_ORDER[index+1];
    if(state!.mode==='puzzle'&&index>=0&&next)goToPuzzle(next,false);
    else if(state!.mode==='puzzle')showEnding();
    else void perform({type:'remix'},'clear');
    return;
  }
  throwCucumber();
}
function throwCucumber(replay=false) {
  if(!initialized||pending)return;
  if(flight.phase==='flying'||flight.phase==='releasing')return;
  cancelAnimationFrame(morphFrame);displayedPoints=undefined;
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
new ResizeObserver(()=>sizeFlightAnnotations($('scene'))).observe($('scene'));

function closeDialogs(){document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(dialog=>dialog.close());}
let leaveAction:(()=>Promise<unknown>)|undefined;
function recipeKey(snapshot:Snapshot) {
  const s=snapshot.state;
  return JSON.stringify([s.mode,s.sourceId,s.goals,s.inventory,s.limit,snapshot.slots.map(id=>id?s.nodes.find(node=>node.id===id)?.op:null)]);
}
function unsavedRecipe() {
  if(!state?.nodes.length)return false;
  const current=recipeKey({state,slots:railSlots});
  return !seeds.some(seed=>{try{return seed.snapshot&&recipeKey(seed.snapshot)===current;}catch{return false;}});
}
function changeWorkspace(action:()=>Promise<unknown>,destination:string,carry=false) {
  if(!unsavedRecipe()){closeDialogs();void action();return;}
  $('leave-description').textContent=carry?'Create carries your blocks over. Save this puzzle recipe to resume it later.':`Save your current recipe before opening ${destination}.`;
  $<HTMLInputElement>('leave-name').value=state?.mode==='puzzle'?LEVELS[state.sourceId-1].name:'My flight';
  $('leave-error').hidden=true;
  open('leave-dialog');leaveAction=action;
}
function goToPuzzle(sourceId:number,protect=true) {
  const next=()=>perform({type:'level',sourceId,mode:'puzzle'},'clear').then(ok=>{if(ok)$(introActive()?'scene':'level-title').focus({preventScroll:true});});
  if(protect)changeWorkspace(next,LEVELS[sourceId-1].name);
  else {closeDialogs();void next();}
}
function showEnding() {
  const count=PUZZLE_ORDER.filter(id=>completed.has(id)).length,all=count===PUZZLE_ORDER.length;
  $('ending-title').textContent=all?'You shaped every flight.':'Your final flight, shaped.';
  $('ending-description').textContent=all?'Heights, shapes, slopes and area. You brought them together. Now make something of your own.':'A familiar shape, found in a new way. More puzzles are waiting whenever you want them.';
  $('ending-progress').textContent=`${count} of ${PUZZLE_ORDER.length} puzzles complete`;
  $('ending-chapters').innerHTML=CHAPTERS.map((chapter,i)=>{
    const done=chapter.levels.filter(id=>completed.has(id)).length,complete=done===chapter.levels.length;
    return `<li class="ending-chapter ${complete?'complete':''}" style="--arrival:${i*90}ms" aria-label="${chapter.name}: ${done} of ${chapter.levels.length} complete"><span class="ending-chapter-art ${chapter.color}">${chapterArt(i)}${complete?`<span class="ending-check">${icon('check',13)}</span>`:''}</span><span>${chapter.name}</span><small>${done} / ${chapter.levels.length}</small></li>`;
  }).join('');
  open('ending-dialog','launch');
}
function focusPart(id:string) {
  const part=document.querySelector<HTMLElement>(`.part-body[data-stage="${CSS.escape(id)}"]`);
  part?.focus({preventScroll:true});part?.scrollIntoView({block:'nearest',inline:'nearest'});
}
function moveCell(from:number,to:number) {
  if(!state)return;
  if(from===to||from<0||to<0||from>=railSlots.length||to>=railSlots.length)return;
  const slots=[...railSlots],id=slots[from];
  // An existing block fills a hole in place; unrelated slots keep their positions.
  if(id&&slots[to]===null){slots[to]=id;slots[from]=null;}
  else {slots.splice(from,1);slots.splice(to,0,id);}
  if(!id)return serial(async()=>{if(!state||!result)return;return accept({status:'ok',state,result},'push',slots);});
  const index=slots.slice(0,to).filter(Boolean).length;
  return perform({type:'move',id,index},'push',slots);
}
function insertIntoSlot(op:Op,index=insertionIndex??railSlots.indexOf(null)) {
  if(index<0||index>=railSlots.length)return;
  // Insert at the indicated slot, shifting only as far as a free slot. Prefer
  // the right; a hole to the left still lets the new block land where dropped.
  const right=railSlots.indexOf(null,index),empty=right<0?railSlots.lastIndexOf(null):right;
  if(empty<0)return;
  const id=crypto.randomUUID(),slots=[...railSlots];
  slots.splice(empty,1);slots.splice(index,0,id);
  selectedStage='';
  return {id,work:perform({type:'insert',op,id,index:slots.slice(0,index).filter(Boolean).length},'push',slots)};
}
function removePart(id:string) {
  const index=state?.nodes.findIndex(n=>n.id===id)??-1;
  const op=state?.nodes[index]?.op;
  return perform({type:'remove',id},'push',railSlots.map(slot=>slot===id?null:slot)).then(accepted=>{
    if(!accepted)return;
    document.querySelector<HTMLElement>(`[data-op="${op}"]`)?.focus({preventScroll:true});
    $('move-announcement').textContent=`${op?OPS[op].name:'Block'} returned to its stack.`;
  });
}
// Manual inspection never changes the recipe or history. Playback temporarily
// owns the slider and restores the last inspected position when it finishes.
$('scene').addEventListener('input',event=>{
  const input=event.target as HTMLInputElement;
  if(input.id!=='flow-position'||input.disabled||!state||!result)return;
  const start=result.points[0][0],end=result.points.at(-1)![0];
  probeIndex=Math.max(0,Math.min(result.points.length-1,Math.round((input.valueAsNumber-start)/(end-start)*(result.points.length-1))));
  updateFlowProbe($('scene'),state,result,probeIndex);
});
document.addEventListener('click',event=>{
  const button=(event.target as Element).closest<HTMLButtonElement>('button');
  if(!button&&!suppressClick&&!(event.target as Element).closest('input,select,textarea,label')&&(event.target as Element).closest('#playground')&&(selectedStage||insertionIndex!==undefined)){selectedStage='';insertionIndex=undefined;render();}
  if(!button||button.disabled||suppressClick)return;
  const d=button.dataset;
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
  if(d.level){goToPuzzle(Number(d.level));return;}
  if(pending)return;
  if(button.id==='source-choose'){renderCurves();open('curves-dialog','source-choose');return;}
  if(d.source){
    closeDialogs();const sourceId=Number(d.source);
    if(state!.mode==='remix'&&sourceId!==curveId(state!.sourceId))void perform({type:'source',sourceId}).then(()=>$('source-choose')?.focus({preventScroll:true}));
    else $('source-choose')?.focus({preventScroll:true});
    return;
  }
  if(d.return){void removePart(d.return);return;}
  if(d.op){
    if(introActive()) {
      if(state!.nodes[0]?.op===d.op)return;
      const op=d.op as Op,id=crypto.randomUUID();
      void serial(async()=>accept(await kernel.run({...state!,nodes:[{id,op}]},{type:'evaluate'}),'push',[id])).then(()=>document.querySelector<HTMLElement>(`[data-op="${op}"]`)?.focus({preventScroll:true}));
      return;
    }
    void insertIntoSlot(d.op as Op)?.work.then(()=>{
      if((event as MouseEvent).detail===0)(document.querySelector<HTMLElement>('[data-op]:not(:disabled)')||$('launch')).focus({preventScroll:true});
    });
  }
  if(d.insert!==undefined){
    if(state!.nodes.some(n=>n.id===selectedStage)){const id=selectedStage;void moveCell(railSlots.indexOf(id),Number(d.insert))?.then(()=>focusPart(id));}
    else if(insertionIndex!==undefined){const to=Number(d.insert);if(insertionIndex!==to)void moveCell(insertionIndex,to);else{insertionIndex=undefined;render();}}
    else if(state!.mode==='remix'||state!.nodes.length<state!.limit){insertionIndex=Number(d.insert);notice={text:'Choose a block.',kind:''};render();document.querySelector<HTMLElement>('[data-op]:not(:disabled)')?.focus({preventScroll:true});}
  }
  if(d.stage){
    if(selectedStage&&selectedStage!==d.stage){const id=selectedStage;void moveCell(railSlots.indexOf(id),railSlots.indexOf(d.stage))?.then(()=>focusPart(id));}
    else if(insertionIndex!==undefined){void moveCell(insertionIndex,railSlots.indexOf(d.stage));}
    else{selectedStage=selectedStage===d.stage?'':d.stage;render();focusPart(d.stage);}
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
  if(target.matches('input,textarea,select')||document.querySelector('dialog[open]'))return;
  if(event.key==='Escape') {
    if(pointer){event.preventDefault();finishPointer(undefined,true);}
    else if(selectedStage||insertionIndex!==undefined){event.preventDefault();selectedStage='';insertionIndex=undefined;render();}
    return;
  }
  if((event.ctrlKey||event.metaKey)&&initialized) {
    if(event.key.toLowerCase()==='z'){event.preventDefault();void historyMove(!event.shiftKey);}
    if(event.key.toLowerCase()==='y'){event.preventDefault();void historyMove(false);}
    return;
  }
  if(target.matches('[role=tab]')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
    event.preventDefault();const index=views.indexOf(view);
    const next=event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowRight'?1:2))%3;
    setView(views[next]);$(`tab-${views[next]}`).focus({preventScroll:true});return;
  }
  if(target.matches('.part-body')&&state&&!pending) {
    const id=target.dataset.stage!,index=railSlots.indexOf(id);
    if(event.key==='ArrowLeft'||event.key==='ArrowRight') {
      event.preventDefault();const to=Math.max(0,Math.min(railSlots.length-1,index+(event.key==='ArrowLeft'?-1:1)));
      if(to!==index){selectedStage=id;void moveCell(index,to)?.then(()=>focusPart(id));}
    }
    if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();void removePart(id);}
  }
  if(target.matches('.empty-slot')&&!pending&&(event.key==='ArrowLeft'||event.key==='ArrowRight')) {
    event.preventDefault();const from=Number(target.dataset.empty),to=Math.max(0,Math.min(railSlots.length-1,from+(event.key==='ArrowLeft'?-1:1)));
    void moveCell(from,to)?.then(()=>document.querySelector<HTMLElement>(`[data-empty="${to}"]`)?.focus({preventScroll:true}));
  }
  if(event.key===' '&&target.id==='scene'){event.preventDefault();launch();}
  if(event.key==='?'){event.preventDefault();open('help-dialog');}
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
  const slots=[...pipeline.querySelectorAll<HTMLElement>('[data-cell]')].filter(el=>{const r=el.getBoundingClientRect();return r.right>bounds.left&&r.left<bounds.right;});
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
  if(introActive())return;
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
    ghost.innerHTML=`<span class="piece-grip">${icon('grip',14)}</span>${op?`<span class="part-formula">${tex(OPS[op].formula)}</span>`:icon('plus',18)}`;
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
          target.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
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

const open=(id:string,returnId='menu-open')=>{if(pointer)finishPointer(undefined,true);closeDialogs();$(returnId).focus({preventScroll:true});$<HTMLDialogElement>(id).showModal();};
document.querySelectorAll<HTMLDialogElement>('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();const e=event as MouseEvent;if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}}));
for(const [button,dialog] of [['help-open','help-dialog'],['menu-open','menu-dialog'],['settings-open','settings-dialog']])$(button).onclick=()=>open(dialog);
$('puzzles-open').onclick=()=>{renderLevels();open('puzzles-dialog');};
$('ideas-open').onclick=()=>{if(!state)return;notesOffered=true;notesCue=false;$('ideas-open').classList.remove('notes-cue');open('ideas-dialog','ideas-open');shapeNotes.show(state.mode==='puzzle'?state.sourceId:0);};
$('menu-version').onclick=()=>open('releases-dialog','menu-version');
$('ending-create').onclick=()=>$('nav-create').click();
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
  if(reset){closeDialogs();requestAnimationFrame(()=>$('scene').focus({preventScroll:true}));$('move-announcement').textContent='Puzzle progress reset. Chapter 1 is ready.';}
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
renderBrand(document.querySelector<HTMLElement>('.brand')!,'./cucumber.svg');
$('axis-help').innerHTML=`${tex('h(x)')} is the height at horizontal position ${tex('x')}. The blocks shape the path; throwing speed does not affect the result.`;
$<HTMLInputElement>('motion-toggle').checked=reduced;document.body.classList.toggle('reduced-motion',reduced);
$<HTMLInputElement>('motion-toggle').onchange=()=>{reduced=$<HTMLInputElement>('motion-toggle').checked;document.body.classList.toggle('reduced-motion',reduced);preferences();if(reduced&&(flight.phase==='flying'||flight.phase==='releasing'))finishFlight();render();};


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
  $('share-description').textContent=kind==='level'?'A fresh start on this puzzle.':kind==='challenge'?'Your flight sets their targets. Your recipe stays hidden.':'Your starting function and blocks, ready to change.';
}
$('share-open').onclick=()=>{const option=$<HTMLSelectElement>('share-kind').options[0];option.disabled=state?.mode!=='puzzle';$<HTMLSelectElement>('share-kind').value=state?.mode==='puzzle'?'level':'creation';open('share-dialog');void updateShare();};
$<HTMLSelectElement>('share-kind').onchange=()=>void updateShare();
$('copy-link').onclick=async()=>{try{await navigator.clipboard.writeText($<HTMLTextAreaElement>('share-link').value);$('share-message').textContent='Copied. A little curiosity is ready to travel.';}catch{$<HTMLTextAreaElement>('share-link').select();$('share-message').textContent='Select and copy the link above.';}};
function download(value:unknown,name:string){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('download-artifact').onclick=()=>{if(sharingArtifact)download(sharingArtifact,`angouri-${sharingArtifact.type}.json`);};
$('download-save').onclick=()=>{if(state)download({schema:1,type:'save',state,slots:railSlots,completed:[...completed],view},'angouri-progress.json');};
function renderSeeds(){
  const dateFormat=new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'});
  $('favorites-list').innerHTML=seeds.length?seeds.map((s,i)=>{
    const saved=s.snapshot?.state,chapter=saved?chapterIndex(saved.sourceId):-1;
    const context=saved?.mode==='puzzle'?chapter<0?'Puzzle':`Puzzle ${chapter+1}.${CHAPTERS[chapter].levels.indexOf(saved.sourceId)+1}`:saved?.mode==='challenge'?'Shared challenge':'Create';
    const date=typeof s.savedAt==='string'?new Date(s.savedAt):undefined;
    const when=date&&Number.isFinite(date.getTime())?`<time datetime="${date.toISOString()}">${escape(dateFormat.format(date))}</time>`:'<span>Date unavailable</span>';
    return `<div class="favorite-row"><div class="favorite-info"><span class="favorite-name">${escape(s.name)}</span><span class="favorite-meta"><span class="favorite-context">${context}</span><span aria-hidden="true">·</span>${when}</span></div><button class="button" data-seed="${i}" aria-label="Open ${escape(s.name)}">${icon('folder',16)} Open</button><button class="icon-button" data-delete-seed="${i}" aria-label="Delete ${escape(s.name)}">${icon('trash',16)}</button></div>`;
  }).join(''):`<div class="empty-library">${icon('folder',32)}<p>Your saved recipes appear here.</p></div>`;
}
$('library-open').onclick=()=>{renderSeeds();open('library-dialog');};
function saveRecipe(name:string) {
  return serial(async()=>{
    if(!state)return;
    if(seeds.length>=12)throw new Error('Your library is full. Export a favourite before making room.');
    const reply=await kernel.run(state,{type:'export',kind:'creation',view});requireOk(reply);
    const next=[...seeds,{name:name.trim().slice(0,60)||'My next great throw',artifact:reply.artifact!,snapshot:{state:clone(state),slots:[...railSlots]},view,savedAt:new Date().toISOString()}];
    if(!write(SEEDS,next))throw new Error('Could not save on this device. Keep this recipe open and export progress from Save & open.');
    seeds=next;renderSeeds();return true;
  });
}
$('favorite-save').onclick=()=>{if(initialized)void saveRecipe($<HTMLInputElement>('seed-name').value).then(saved=>{if(saved)$<HTMLInputElement>('seed-name').value='';});};
function openSeed(seed:Seed) {
  if(!seed.snapshot)return importData(seed.artifact);
  return serial(async()=>{
    const saved=parseSave({schema:1,type:'save',state:seed.snapshot!.state,slots:seed.snapshot!.slots,view:seed.view||view,completed:[...completed]});
    const reply=await kernel.run(saved.state,{type:'evaluate'});requireOk(reply);
    accept(reply,'clear',saved.slots,saved.view);preferences();return true;
  });
}
$('favorites-list').onclick=event=>{const b=(event.target as Element).closest<HTMLElement>('button');if(!b)return;if(b.dataset.deleteSeed!==undefined){seeds.splice(Number(b.dataset.deleteSeed),1);write(SEEDS,seeds);renderSeeds();}if(b.dataset.seed!==undefined){const seed=seeds[Number(b.dataset.seed)];changeWorkspace(()=>openSeed(seed).then(ok=>{if(ok)closeDialogs();}),seed.name);}};
function parseSave(value:unknown) {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Choose an Angouri JSON file.');
  const data={...value,view:canonicalView((value as Record<string,unknown>).view)} as Record<string,unknown>;
  if(data.schema!==1||data.type!=='save'||Object.keys(data).some(k=>!['schema','type','state','slots','completed','view','entry'].includes(k))||data.entry!==undefined&&(typeof data.entry!=='string'||data.entry.length>8192))throw new Error('Unsupported progress file.');
  if(!Array.isArray(data.completed)||data.completed.length>LEVELS.length||!data.completed.every(n=>Number.isInteger(n)&&n>=1&&n<=LEVELS.length)||!isView(data.view)||!data.state)throw new Error('The progress file has invalid fields.');
  if(data.slots!==undefined&&(!Array.isArray(data.slots)||data.slots.length>65||!data.slots.every(id=>id===null||typeof id==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(id))))throw new Error('The saved recipe slots are invalid.');
  return {state:data.state as State,slots:data.slots as RailSlots|undefined,completed:data.completed as number[],view:data.view};
}
function importData(value:unknown) {
  return serial(async()=>{
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Choose an Angouri JSON file.');
    const data={...value,view:canonicalView((value as Record<string,unknown>).view)} as Record<string,unknown>;
    if(data.type==='save'){const save=parseSave(data);const reply=await kernel.run(save.state,{type:'evaluate'});requireOk(reply);completed=new Set(save.completed);accept(reply,'clear',save.slots,save.view);}
    else if(data.type==='level'){
      if(data.schema!==1||Object.keys(data).some(k=>!['schema','type','sourceId','view'].includes(k))||!isView(data.view))throw new Error('Unsupported puzzle link file.');
      const reply=await kernel.run(undefined,{type:'level',sourceId:data.sourceId,mode:'puzzle'});requireOk(reply);accept(reply,'clear',undefined,data.view);
    } else {const reply=await kernel.run(state,{type:'import',artifact:data});requireOk(reply);accept(reply,'clear',undefined,isView(data.view)?data.view:undefined);}
    preferences();return true;
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
  try {
    const fragment=new URLSearchParams(location.hash.slice(1));
    if(saved&&typeof saved==='object'&&(saved as {entry?:unknown}).entry===location.hash&&location.hash)opened=!!await importData(saved);
    if(!opened&&fragment.has('v1'))opened=!!await importData(decode(fragment.get('v1')!));
    else if(!opened&&fragment.has('level'))opened=!!await importData({schema:1,type:'level',sourceId:Number(fragment.get('level')),view:isView(fragment.get('view'))?fragment.get('view'):'flight'});
    else if(!opened&&saved)opened=!!await importData(saved);
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
