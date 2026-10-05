import './notes.css';
import { Kernel } from './engine';
import { icon } from './icons';
import { CHAPTERS, chapterIndex, escape, LEVELS, OPS, PUZZLE_ORDER, type Op, type Result, type Stage } from './types';
import { tex } from './views';

export const chapterArt=(index:number)=>{const chapter=CHAPTERS[index];return `<svg viewBox="0 0 36 36" width="36" height="36" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><path d="M2 ${chapter.zero}H34" opacity=".2"/><path class="chapter-before" d="${chapter.before}" stroke-width="1.4" stroke-dasharray="2.5 2.5" opacity=".5"/><path class="chapter-after" d="${chapter.after}" stroke-width="1.9"/></svg>`;};
const lesson=(sourceId:number)=>{
  const chapter=chapterIndex(sourceId);
  return `${chapter<0?'Bonus':`${chapter+1}.${CHAPTERS[chapter].levels.indexOf(sourceId)+1}`} · ${LEVELS[sourceId-1].name}`;
};
const move=(op:Op)=>`<span class="note-operation ${OPS[op].color}" aria-label="${OPS[op].name}">${tex(OPS[op].formula)}</span>`;
const viewButton=(view:'function'|'flow')=>{const label=view==='function'?'Function':'Flow';return `<button class="note-view-button" data-view="${view}" aria-label="Open ${label} view">${icon(view,16)}<span>${label}</span></button>`;};

// These are reference examples evaluated by the same stateless kernel as play.
// No note may accept a response into the player's state, history or progress.
export class ShapeNotes {
  private examples=new Map<string,Promise<Result>>();
  private version=0;
  private source=0;
  private topic=0;
  private known=new Set<number>();
  private topics=new Set<number>();
  private content=document.getElementById('notes-content')!;
  private index=document.getElementById('notes-index')!;

  constructor(private kernel:Kernel) {
    this.index.addEventListener('click',event=>{
      const button=(event.target as Element).closest<HTMLElement>('[data-note]');
      if(button)void this.select(Number(button.dataset.note));
    });
    this.content.addEventListener('click',event=>{
      if((event.target as Element).closest('[data-retry-notes]'))void this.select(this.topic);
    });
    document.getElementById('ideas-dialog')!.addEventListener('close',()=>this.version++);
  }

  show(source:number) {
    this.source=source;
    // Scope references to this puzzle, including when replaying an early lesson.
    // Create has the whole book.
    this.known=new Set(source===0?PUZZLE_ORDER:PUZZLE_ORDER.slice(0,PUZZLE_ORDER.indexOf(source)+1));
    this.topics=new Set(CHAPTERS.flatMap((chapter,i)=>this.known.has(chapter.levels[0])?[i]:[]));
    const choices=CHAPTERS.flatMap((chapter,i)=>this.topics.has(i)?[`<button data-note="${i}" aria-pressed="false"><span class="note-tab-art ${chapter.color}">${chapterArt(i)}</span><span>${chapter.name}</span></button>`]:[]);
    this.index.innerHTML=choices.join('');
    this.index.hidden=choices.length<2;
    void this.select(Math.max(0,chapterIndex(source)));
  }

  private example(sourceId:number,ops:string) {
    const key=`${sourceId}:${ops}`;
    let cached=this.examples.get(key);
    if(!cached) {
      cached=(async()=>{
        const initial=await this.kernel.run(undefined,{type:'level',sourceId,mode:'puzzle'});
        if(initial.status!=='ok'||!initial.state)throw new Error('Example unavailable');
        const state={...initial.state,nodes:[...ops].map((op,i)=>({id:`note-${i}`,op:op as Op}))};
        const reply=await this.kernel.run(state,{type:'evaluate'});
        if(reply.status!=='ok'||!reply.result)throw new Error('Example unavailable');
        return reply.result;
      })();
      this.examples.set(key,cached);
      void cached.catch(()=>this.examples.delete(key));
    }
    return cached;
  }

  private async select(topic:number) {
    if(!this.topics.has(topic))return;
    const version=++this.version;this.topic=topic;
    this.index.querySelectorAll<HTMLElement>('[data-note]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.note)===topic)));
    this.content.setAttribute('aria-busy','true');
    this.content.innerHTML='<p class="notes-loading">Opening the sketches…</p>';
    try {
      const html=await this.render(topic);
      if(version!==this.version)return;
      const prompt=this.source?`<aside class="note-question"><strong>For ${escape(LEVELS[this.source-1].name)}</strong><p>${escape(LEVELS[this.source-1].hint)}</p></aside>`:'';
      this.content.innerHTML=html+prompt;
    } catch {
      if(version!==this.version)return;
      this.content.innerHTML='<p>The sketches could not load.</p><button class="button" data-retry-notes>Try again</button>';
    } finally {if(version===this.version)this.content.setAttribute('aria-busy','false');}
  }

  private async render(topic:number):Promise<string> {
    if(topic===0) {
      const [lower,lift,first,last]=await Promise.all([this.example(1,'H'),this.known.has(2)?this.example(2,'A'):undefined,this.known.has(3)?this.example(3,'AH'):undefined,this.known.has(3)?this.example(3,'HA'):undefined]);
      const basics=`<p>Halving keeps the zeros.${lift?' Raising moves every height equally.':''}</p>
        ${strip(lower.stages,['Start','Lower'],[move('H')])}<p class="note-reference">${lesson(1)}</p>
        ${lift?`${strip(lift.stages,['Start','Higher'],[move('A')])}<p class="note-reference">${lesson(2)}</p>`:''}
        ${first&&last?`<details><summary>Why order matters</summary><p>Halving after a lift also halves the height you added.</p>${strip([first.stages.at(-1)!,last.stages.at(-1)!],['Lift, then halve','Halve, then lift'],[tex('\\ne')])}<p class="note-reference">${lesson(3)}</p></details>`:''}`;
      if(!this.known.has(24))return `<h3>Keep the shape. Change the height.</h3>${first?`<p class="note-takeaway">In ${viewButton('function')}, compare the Height gap row and the height at ${tex('x=0')}. Two orders can fit the same gap but leave different starting heights.</p>`:''}${basics}`;
      const quarter=await this.example(24,'AHH');
      const pieces=`<p>A lift followed by one halve contributes ${tex('\\frac12')}. With two halves after it, it contributes ${tex('\\frac14')}. Lifts at different places can add different pieces.</p>${strip([first!.stages.at(-1)!,quarter.stages.at(-1)!],['Half a lift','Quarter of a lift'],[move('H')])}<p class="note-reference">${lesson(24)}</p>`;
      const guided=this.source>2;
      const follow=`<p class="note-takeaway">In ${viewButton('flow')}, inspect ${tex('x=0')} to follow the starting height through each block.${guided?' The blue gap brackets shrink with a halve and keep their size with a lift.':''}</p>`;
      if(!this.known.has(25))return `<h3>Build a lift in pieces.</h3>${follow}${pieces}<details><summary>Scaling and order</summary>${basics}</details>`;
      return `<h3>Fit the gap. Place the curve.</h3><p>A lift moves the ends and peak equally: their height gap stays the same. Halving shrinks that gap. ${guided?'Use the Height gap row':'Compare the peak and the ends'} in ${viewButton('function')} to decide how much to shrink it, then plan where the lifts belong.</p>${follow}${pieces}<p class="note-takeaway">Plan the gap first; the blocks can still interleave. Each halve affects every lift before it. Lifts after it keep their full height.</p><details><summary>Scaling and order</summary>${basics}</details>`;
    }
    if(topic===1) {
      const [roof,reflection]=await Promise.all([this.known.has(8)?this.example(8,'NA'):undefined,this.example(6,'N')]);
      const guided=this.source>2;
      const sign=guided?`<p class="note-takeaway">Here, ${tex('h(2)-h(0)')} is negative when the middle is below the ends. ${viewButton('function')} keeps the gap signed; reflection reverses its sign.</p>`:'';
      const track=guided?`<p class="note-takeaway">In ${viewButton('flow')}, reflection reverses the gap arrow. Halving shrinks the bracket; lifting moves it without changing its size.</p>`:'';
      if(!roof)return `<h3>Turn it over.</h3><p>Zero stays where it is. Every other height changes sign.</p>${strip(reflection.stages,['Below zero','Above zero'],[move('N')])}<p class="note-reference">${lesson(6)}</p>${sign}`;
      const placing=`<p>A bowl becomes a roof. Turn it over first; then lift its middle.</p>
        ${strip(roof.stages,['Bowl','Turned','Raised'],[move('N'),move('A')])}<p class="note-reference">${lesson(8)}</p>
        <p class="note-takeaway">Think in two jobs: shape the curve, then place it.</p>${track}
        <details><summary>What reflection keeps</summary><p>Zero stays where it is. Every other height changes sign.</p>${strip(reflection.stages,['Below zero','Above zero'],[move('N')])}<p class="note-reference">${lesson(6)}</p>${sign}</details>`;
      if(!this.known.has(26))return `<h3>Turn, then place.</h3>${placing}`;
      const raised=await this.example(26,'N');
      return `<h3>Account for the starting height.</h3><p>This bowl’s middle starts above zero. Reflecting carries it below zero too. Fit the depth and place the middle as separate jobs; the fractional lifts from Height still work.</p>${strip(raised.stages,['Raised bowl','Middle below zero'],[move('N')])}<p class="note-takeaway">${guided?'Fit the signed gap':'Compare the middle and ends'} in ${viewButton('function')}, then follow the middle at ${tex('x=2')} in ${viewButton('flow')}. A matching gap can still leave the middle too high or too low.</p><details><summary>A roof from a bowl</summary>${placing}</details>`;
    }
    if(topic===2) {
      const [bowl,roof,fold]=await Promise.all([this.known.has(10)?this.example(10,'HQ'):undefined,this.known.has(4)?this.example(8,'NA'):undefined,this.example(7,'Q')]);
      const folding=`<p>Opposite heights meet when squared: ${tex('(-a)^2=a^2')}.</p>${strip(fold.stages,['Line','Bowl'],[move('Q')])}<p class="note-reference">${lesson(7)}</p>`;
      if(!bowl)return `<h3>A line becomes a bowl.</h3>${folding}`;
      if(!roof)return `<h3>Fit a bowl.</h3><p>Halving before squaring makes a shallower bowl than halving afterward.</p>${strip(bowl.stages,['Line','Half height','Fitted bowl'],[move('H'),move('Q')])}<p class="note-reference">${lesson(10)}</p><details><summary>How a line becomes a bowl</summary>${folding}</details>`;
      const connection=`<p>One puzzle’s finish can be another puzzle’s start.</p>
        ${strip([bowl.stages[0],bowl.stages.at(-1)!,roof.stages.at(-1)!],['Line','Fitted bowl','Arch'],[`<strong>Fit a bowl</strong><small>${lesson(10)}</small>`,`<strong>Turn &amp; lift</strong><small>${lesson(8)}</small>`],true)}
        <p class="note-takeaway">Choose a useful intermediate shape. Build it, then reuse a familiar transformation.</p>
        <details><summary>How a line becomes a bowl</summary>${folding}<p>Halving before squaring makes a shallower bowl than halving afterward.</p></details>`;
      if(!this.known.has(27))return `<h3>An arch contains a bowl.</h3>${connection}`;
      const shifted=await this.example(27,'AQ');
      const moving=`<p>Squaring folds around the old curve’s zero. Lifting this line moves its zero from ${tex('x=2')} to ${tex('x=1')}; squaring afterward puts the bowl’s bottom there.</p>${strip(shifted.stages,['Original zero','Moved zero','Moved fold'],[move('A'),move('Q')])}<p class="note-reference">${lesson(27)}</p><p class="note-takeaway">These off-center targets have their lowest and highest heights at ${tex('x=1')} and ${tex('x=4')}. ${viewButton('function')} compares their height gap; ${viewButton('flow')} marks the same pair. The positions stay fixed while you edit.</p>`;
      if(!this.known.has(28))return `<h3>Move the zero. Move the fold.</h3>${moving}<details><summary>Building an arch</summary>${connection}</details>`;
      return `<h3>Move the fold. Then build the arch.</h3><p>Find where the target’s peak belongs. Make a bowl with its bottom at that position, then choose its depth and final height.</p>${moving}<details><summary>Building an arch</summary>${connection}</details>`;
    }
    if(topic===3) {
      const [flat,roof]=await Promise.all([this.example(12,'Q'),this.known.has(13)?this.example(13,'QNA'):undefined]);
      const flattening=`<p>Squaring keeps ${tex('0')} and ${tex('1')}, and lowers heights between them.</p>`;
      if(!roof)return `<h3>Flatten the middle.</h3>${flattening}${strip(flat.stages,['Bowl','Flatter middle'],[move('Q')])}<p class="note-reference">${lesson(12)}</p>`;
      return `<h3>Reshape, then reuse.</h3>${flattening}
        ${strip([flat.stages[0],flat.stages.at(-1)!,roof.stages.at(-1)!],['Bowl','Flatter middle','Round roof'],[`<strong>Square the bowl</strong><small>${lesson(12)}</small>`,`<strong>Turn &amp; lift</strong><small>${lesson(8)}</small>`],true)}
        <p class="note-takeaway">The old turn-and-lift idea still works with a new bowl.</p><p class="note-reference">${lesson(13)}</p>
        ${this.known.has(11)?'<p>For a different summit, decide its shape, depth and final height separately.</p>':''}`;
    }
    if(topic===5)return this.areaNotes();
    const reading=await this.example(14,'D');
    const introduction=`<p>Downhill becomes negative. Flat becomes zero. Uphill becomes positive.</p>${strip(reading.stages,['Bowl','Its slope'],[move('D')])}<p class="note-reference">${lesson(14)}</p>`;
    if(!this.known.has(5))return `<h3>The slope becomes the height.</h3>${introduction}`;
    const slope=await this.example(5,'DHA');
    const fitting=`<p>A slope is another shape you can scale and move.</p>${strip([slope.stages[0],slope.stages[1],slope.stages.at(-1)!],['Curve','Its slope','Fitted height'],[move('D'),`${move('H')}${move('A')}`])}<p class="note-reference">${lesson(5)}</p>`;
    if(!this.known.has(15)) {
      const [before,after]=await Promise.all([this.example(5,'AD'),this.example(5,'DA')]);
      return `<h3>Read change. Then place it.</h3>${fitting}<details><summary>What happens to a lift?</summary><p>Moving a curve upward does not change how steep it is. A lift before the slope block disappears.</p>${strip([before.stages.at(-1)!,after.stages.at(-1)!],['Lift, then slope','Slope, then lift'],[tex('\\ne')])}</details><details><summary>Reading a slope</summary>${introduction}</details>`;
    }
    const [hiddenBowl,arch]=await Promise.all([this.example(15,'D'),this.example(8,'NA')]);
    const familiar=`<p>Recognize what the slope gives you. Then use the shapes you already know.</p>${strip([hiddenBowl.stages[0],hiddenBowl.stages[1],arch.stages.at(-1)!],['S curve','A bowl','An arch'],[`<strong>Read its slope</strong>${move('D')}`,`<strong>Fit, turn &amp; lift</strong><small>${lesson(5)}<br>${lesson(8)}</small>`],true)}<p class="note-takeaway">Read the change. Recognize the shape. Choose how to place it.</p><details><summary>Fit a slope</summary>${fitting}<p>A lift before the slope block disappears; lift the resulting shape instead.</p></details><details><summary>Reading a slope</summary>${introduction}</details>`;
    if(!this.known.has(22))return `<h3>A familiar bowl, hidden in change.</h3>${familiar}`;
    const flat=await this.example(12,'Q');
    return `<h3>Shape the change in stages.</h3><p>Read the slope first. Fit the bowl’s ends to ${tex('1')} and its middle to ${tex('0')}; those heights stay fixed when squared. Heights between them shrink, and squaring again makes them shrink further.</p>${strip([hiddenBowl.stages[1],flat.stages[0],flat.stages[1]],['Slope-built bowl','Fitted bowl','Flatter middle'],[`<strong>Fit the depth</strong>`,`<strong>Reshape</strong><small>${lesson(12)}</small>`],true)}<p class="note-takeaway">Choose the intermediate shape before deciding how to turn and place it.</p><details><summary>A bowl hidden in change</summary>${familiar}</details>`;
  }

  private async areaNotes():Promise<string> {
    const ramp=await this.example(16,'I');
    const building=`<p>Add the signed area from the start to your position: ${tex('F(x)=\\int_0^x h(u)\\,\\mathrm{d}u')}. The new height starts at zero.</p>${strip(ramp.stages,['Flat height','Growing area'],[move('I')])}<p>In ${viewButton('flow')}, move the slider to watch the shaded area grow. Its total becomes the next graph’s height.</p><p class="note-reference">${lesson(16)}</p>`;
    if(!this.known.has(19))return `<h3>Area builds a new height.</h3>${building}`;
    const cancellation=await this.example(19,'I');
    const signed=`<p>Above zero adds area. Below zero takes it away. Equal positive and negative areas bring the new height back to zero.</p>${strip(cancellation.stages,['Positive, then negative','Rise, then fall'],[move('I')])}<p class="note-reference">${lesson(19)}</p>`;
    const basics=`<details><summary>How area grows</summary>${building}</details>`;
    if(!this.known.has(17))return `<h3>Adding and taking away.</h3>${signed}${basics}`;
    const fitted=await this.example(17,'IH');
    const fitting=`<p>Halving the old heights halves every bit of area. Halving the result gives the same shape.</p>${strip(fitted.stages,['Falling line','Area','Fitted area'],[move('I'),move('H')])}<p class="note-reference">${lesson(17)}</p>`;
    const signedReference=`<details><summary>Positive and negative area</summary>${signed}</details>${basics}`;
    if(!this.known.has(20))return `<h3>Fit the area.</h3>${fitting}${signedReference}`;
    const placed=await this.example(20,'IA');
    const placing=`<p>Accumulation always starts at zero. Lift afterward to choose a different starting height. Lifting before accumulation adds more area at every step instead.</p>${strip(placed.stages,['Flat height','From zero','From one'],[move('I'),move('A')])}<p class="note-reference">${lesson(20)}</p>`;
    const fittingReference=`<details><summary>Scaling area</summary>${fitting}</details>${signedReference}`;
    if(!this.known.has(21))return `<h3>Choose where to start.</h3>${placing}${fittingReference}`;
    const rebuilt=await this.example(21,'DI');
    const recovery=`<p>A slope records changes in height. Accumulating those changes rebuilds the shape, starting at zero. The original starting height is lost. In the other direction, the slope of accumulated area returns the original curve.</p>${strip(rebuilt.stages,['Raised arch','Its slope','Shape rebuilt'],[move('D'),move('I')])}<p class="note-reference">${lesson(21)}</p>`;
    const placingReference=`<details><summary>Choose the starting height</summary>${placing}</details>${fittingReference}`;
    if(!this.known.has(18))return `<h3>Build a curve from its slope.</h3>${recovery}${placingReference}`;
    const [bowl,roof]=await Promise.all([this.example(18,'I'),this.example(13,'QNA')]);
    const familiar=`<p>A new route can lead to a shape you already know how to use.</p>${strip([bowl.stages[0],bowl.stages[1],roof.stages.at(-1)!],['S curve','Area-built bowl','Rounded roof'],[`<strong>Build with area</strong>${move('I')}`,`<strong>Fit, turn &amp; place</strong><small>${lesson(13)}</small>`],true)}<p class="note-takeaway">Find the useful shape. Fit its depth. Choose its direction and height.</p><details><summary>Slopes and area</summary>${recovery}</details>${placingReference}`;
    if(!this.known.has(23))return `<h3>Area reveals a familiar shape.</h3>${familiar}`;
    const [sCurve,fold]=await Promise.all([this.example(23,'I'),this.example(7,'Q')]);
    return `<h3>A bowl can build an S curve.</h3><p>The S curve’s slope was a bowl. Area takes you back to an S shape, with a flat middle.</p>${strip(sCurve.stages,['Bowl','Area-built S'],[move('I')])}<p>Before folding, place that middle on zero so opposite heights can meet. Then reuse a familiar finish.</p>${strip(fold.stages,['Opposite heights','Heights meet'],[move('Q')])}<p class="note-reference">${lesson(7)} · ${lesson(27)}</p><details><summary>Familiar shapes built with area</summary>${familiar}</details>`;
  }
}

function strip(stages:Stage[],captions:string[],links:string[],connection=false) {
  const heights=stages.flatMap(stage=>stage.points.map(point=>point[1]));
  const low=Math.min(0,...heights),high=Math.max(0,...heights),pad=Math.max(1,high-low)*.12;
  const min=low-pad,max=high+pad,start=stages[0].points[0][0],end=stages[0].points.at(-1)![0];
  const xy=([x,h]:[number,number])=>[17+(x-start)/(end-start)*142,99-(h-min)/(max-min)*84];
  const path=(points:Stage['points'])=>points.map((point,i)=>`${i?'L':'M'}${xy(point).map(n=>n.toFixed(2)).join(',')}`).join(' ');
  const zero=xy([start,0])[1];
  return `<div class="note-strip ${connection?'note-connection':''}" data-count="${stages.length}">${stages.map((stage,i)=>`${i?`<div class="note-link">${icon('arrow',20)}<span>${links[i-1]}</span></div>`:''}<figure class="note-stage ${connection&&i===1?'shared-shape':''}"><figcaption>${captions[i]}</figcaption><svg class="note-plot" viewBox="0 0 176 116" role="img" aria-label="${escape(captions[i]+': '+stage.expression)}"><path d="M17 10V103" class="note-axis"/><path d="M17 ${zero}H163" class="note-zero-line" data-zero-line/><foreignObject x="0" y="${zero-8}" width="14" height="18"><div xmlns="http://www.w3.org/1999/xhtml" class="note-zero">${tex('0')}</div></foreignObject><path d="${path(stage.points)}" class="note-curve"/>${stage.points.filter((_,j)=>j===0||j===Math.floor(stage.points.length/2)||j===stage.points.length-1).map(point=>{const [x,y]=xy(point);return `<circle cx="${x}" cy="${y}" r="2.8" class="note-point"/>`;}).join('')}</svg><div class="note-formula">${tex(stage.latex)}</div></figure>`).join('')}</div>`;
}
