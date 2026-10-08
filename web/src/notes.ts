import './notes.css';
import { Kernel } from './engine';
import { CHAPTERS, chapterIndex, EXTRA_PUZZLES, GEOMETRY_PUZZLES, MIXED_PUZZLES, OPTIONAL_PUZZLES, PUZZLE_ORDER, LEVELS, puzzleLabel, escape, fraction, targetHeight, type Op, type Result } from './types';
import learningPath from '../../content/learning-path.json';
import { heightAtFormula, rationalTex, tex } from './views';
import { chapterArt, lesson, move, viewButton, recall, strip, compare, circleSketch, diagramChoices, relationSketch } from './note-diagrams';
import { renderReference } from './reference';
export { chapterArt } from './note-diagrams';

const knownLessons=(source:number)=>new Set(source===0||EXTRA_PUZZLES.includes(source)||MIXED_PUZZLES.includes(source)
  ?[...PUZZLE_ORDER,...GEOMETRY_PUZZLES,...MIXED_PUZZLES]
  :GEOMETRY_PUZZLES.includes(source)
    ?[...PUZZLE_ORDER.slice(0,PUZZLE_ORDER.indexOf(44)+1),...GEOMETRY_PUZZLES.slice(0,GEOMETRY_PUZZLES.indexOf(source)+1)]
    :PUZZLE_ORDER.slice(0,PUZZLE_ORDER.indexOf(source)+1));

// These are reference examples evaluated by the same stateless kernel as play.
// No note may accept a response into the player's state, history or progress.
export class ShapeNotes {
  private examples=new Map<string,Promise<Result>>();
  private version=0;
  private source=0;
  private topic=0;
  private known=new Set<number>();
  private topics=new Set<number>();
  private referenceSource=0;
  private relevant=new Set<number>();
  private heading=document.getElementById('notes-heading')!;
  private content=document.getElementById('notes-content')!;
  private index=document.getElementById('notes-index')!;

  constructor(private kernel:Kernel) {
    this.index.addEventListener('click',event=>{
      const reference=(event.target as Element).closest<HTMLElement>('[data-note-lesson]');
      if(reference){void this.selectLesson(Number(reference.dataset.noteLesson));return;}
      const button=(event.target as Element).closest<HTMLElement>('[data-note]');
      if(button)void this.select(Number(button.dataset.note));
    });
    const referenceAction=(event:Event)=>{
      if((event.target as Element).closest('[data-retry-notes]'))void this.select(this.topic);
      const choice=(event.target as Element).closest<HTMLButtonElement>('[data-note-choice]');
      const comparison=choice?.closest<HTMLElement>('[data-note-comparison]');
      if(choice&&comparison) {
        comparison.querySelectorAll<HTMLButtonElement>('[data-note-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button===choice)));
        comparison.querySelectorAll<HTMLElement>('[data-note-panel]').forEach(panel=>panel.hidden=panel.dataset.notePanel!==choice.dataset.noteChoice);
      }
    };
    this.content.addEventListener('click',referenceAction);
    document.getElementById('hints-content')!.addEventListener('click',referenceAction);
    document.getElementById('ideas-dialog')!.addEventListener('close',()=>this.version++);
  }

  show(source:number) {
    this.source=source;this.index.scrollTop=0;
    // Open the reference at today's lesson, with normal downward reading.
    // Returning from an earlier reference must not reopen at its old bottom.
    document.getElementById('notes-reading')!.scrollTop=0;
    // Scope references to this puzzle, including when replaying an early lesson.
    // Create has the whole book.
    this.known=knownLessons(source);
    const prerequisites=learningPath.lessons.find(lesson=>lesson.id===source)?.prerequisites??[];
    this.relevant=new Set([source,...prerequisites]);
    if(source&&!OPTIONAL_PUZZLES.includes(source)) {
      const button=(id:number)=>`<button data-note-lesson="${id}" aria-controls="notes-heading notes-content" aria-pressed="false"><span class="note-lesson-numbers">${puzzleLabel(id)}</span><span>${escape(LEVELS[id-1].name)}</span></button>`;
      this.index.classList.add('notes-lessons');
      this.index.setAttribute('aria-label','Lesson notes');
      this.index.innerHTML=`<div class="notes-section" role="group" aria-labelledby="notes-current-label"><p id="notes-current-label" class="notes-scope">This lesson</p><div class="notes-buttons">${button(source)}</div></div>`+(prerequisites.length?`<div class="notes-section" role="group" aria-labelledby="notes-related-label"><p id="notes-related-label" class="notes-scope">Related ideas</p><div class="notes-buttons">${prerequisites.map(button).join('')}</div></div>`:'');
      this.index.hidden=false;
      void this.selectLesson(source);
      return;
    }
    this.index.classList.remove('notes-lessons');
    this.index.setAttribute('aria-label','Chapter notes');
    this.topics=new Set(CHAPTERS.flatMap((chapter,i)=>this.known.has(chapter.levels[0])?[i]:[]));
    const choices=CHAPTERS.flatMap((chapter,i)=>this.topics.has(i)?[`<button data-note="${i}" aria-controls="notes-heading notes-content" aria-pressed="false"><span class="note-tab-art ${chapter.color}">${chapterArt(i)}</span><span>${chapter.name}</span></button>`]:[]);
    this.index.innerHTML=choices.join('');
    this.index.hidden=choices.length<2;
    void this.select(MIXED_PUZZLES.includes(source)?9:GEOMETRY_PUZZLES.includes(source)?6:EXTRA_PUZZLES.includes(source)?EXTRA_PUZZLES.indexOf(source)<4?4:5:Math.max(0,chapterIndex(source)));
  }

  private async selectLesson(source:number) {
    if(!this.relevant.has(source))return;
    this.referenceSource=source;
    const topic=Math.max(0,chapterIndex(source));
    this.topics=new Set([topic]);
    this.index.querySelectorAll<HTMLElement>('[data-note-lesson]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.noteLesson)===source)));
    await this.select(topic);
  }

  private async select(topic:number) {
    if(!this.topics.has(topic))return;
    const version=++this.version;this.topic=topic;
    const focused=this.source&&!OPTIONAL_PUZZLES.includes(this.source);
    const referenceSource=focused?this.referenceSource:this.source;
    this.index.querySelectorAll<HTMLElement>('[data-note]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.note)===topic)));
    this.heading.innerHTML='<h3 id="notes-concept">Opening notes…</h3>';
    document.getElementById('notes-reading')!.scrollTop=0;
    this.content.setAttribute('aria-busy','true');
    this.content.innerHTML='<p class="notes-loading">Opening the sketches…</p>';
    try {
      const known=focused?knownLessons(referenceSource):this.known;
      const sketches=new LessonSketches(this.kernel,referenceSource,known,this.examples);
      const reference=await renderReference(topic,known,{example:(source,ops)=>sketches.example(source,ops),circleExample:(x,y,radius,goals)=>sketches.circleExample(x,y,radius,goals)});
      if(version!==this.version)return;
      const template=document.createElement('template');template.innerHTML=reference;
      if(focused) {
        // Earlier lessons already have their own navigation entries. A lesson
        // page contains its relationship once; the complete book keeps recalls.
        template.content.querySelectorAll('.note-recall').forEach(section=>section.remove());
        template.content.querySelectorAll<HTMLElement>('.note-reference').forEach(credit=>credit.hidden=true);
        if(!template.content.querySelector(`[data-reference-lesson="${referenceSource}"]`)) {
          const marker=document.createElement('span');marker.dataset.referenceLesson=String(referenceSource);marker.hidden=true;
          template.content.append(marker);
        }
      }
      const title=template.content.querySelector('h3');
      if(title){title.id='notes-concept';this.heading.replaceChildren(title);}
      // View links belong to the explanation that gives them a purpose.
      // Do not append a second, unexplained navigation row to every lesson.
      this.content.innerHTML=template.innerHTML;
    } catch {
      if(version!==this.version)return;
      this.heading.innerHTML='<h3 id="notes-concept">Notes unavailable</h3>';
      this.content.innerHTML='<p>The sketches could not load.</p><button class="button" data-retry-notes>Try again</button>';
    } finally {if(version===this.version)this.content.setAttribute('aria-busy','false');}
  }

  async hintSketch(source:number) {
    const known=knownLessons(source);
    const topic=MIXED_PUZZLES.includes(source)?9:GEOMETRY_PUZZLES.includes(source)?6:EXTRA_PUZZLES.includes(source)?EXTRA_PUZZLES.indexOf(source)<4?4:5:Math.max(0,chapterIndex(source));
    const sketches=new LessonSketches(this.kernel,source,known,this.examples);
    if(EXTRA_PUZZLES.includes(source)) {
      const op:Op=EXTRA_PUZZLES.indexOf(source)<4?'D':'I',reading=await sketches.example(source,op);
      const name=op==='D'?'slope':'accumulated area';
      return `<h3>Inspect the ${name} first.</h3><p>Follow this puzzle's starting curve through ${move(op)}. Compare the new shape with the required heights before deciding how to change it further.</p>${strip([reading.stages[0],reading.stages.at(-1)!],['Starting curve',op==='D'?'Slope output':'Accumulated output'],[move(op)],false,reading.checkpoints)}<p>${viewButton('flow')} shows the relationship at each position.</p>`;
    }
    const html=await sketches.render(topic);
    const template=document.createElement('template');template.innerHTML=html;
    template.content.querySelectorAll('.note-recall').forEach(el=>el.remove());
    return template.innerHTML;
  }
}

/** Targeted worked sketches belong to explicit hint disclosures. */
class LessonSketches {
  constructor(private kernel:Kernel,private source:number,private known:Set<number>,private examples:Map<string,Promise<Result>>) {}
  example(sourceId:number,ops:string) {
    const key=`${sourceId}:${ops}`;
    let cached=this.examples.get(key);
    if(!cached) {
      cached=(async()=>{
        const initial=await this.kernel.run(undefined,{type:'level',sourceId,mode:'remix'});
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

  async render(topic:number):Promise<string> {
    if(topic===0) {
      const [lower,lift,first,last]=await Promise.all([this.example(1,'H'),this.known.has(2)?this.example(2,'A'):undefined,this.known.has(3)?this.example(3,'AH'):undefined,this.known.has(3)?this.example(3,'HA'):undefined]);
      const basics=`<p>Halving keeps the zeros.${lift?' Raising moves every height equally.':''}</p>
        ${strip(lower.stages,['Start','Lower'],[move('H')])}<p class="note-reference">${lesson(1)}</p>
        ${lift?`${strip(lift.stages,['Start','Higher'],[move('A')])}<p class="note-reference">${lesson(2)}</p>`:''}
        ${first&&last?recall([3],'Why order matters',`<p>Halving after a lift also halves the height you added.</p>${strip([first.stages.at(-1)!,last.stages.at(-1)!],['Lift, then halve','Halve, then lift'],[tex('\\ne')])}`):''}`;
      if(!this.known.has(24))return `<h3>Keep the shape. Change the height.</h3>${first?`<p class="note-takeaway">In ${viewButton('function')}, compare the Height gap row and the height at ${tex('x=0')}. Two orders can fit the same gap but leave different starting heights.</p>`:''}${basics}`;
      const quarter=await this.example(24,'AHH');
      const pieces=`<p>A lift followed by one halve contributes ${tex('\\frac12')}. With two halves after it, it contributes ${tex('\\frac14')}. Lifts at different places can add different pieces.</p>${strip([first!.stages.at(-1)!,quarter.stages.at(-1)!],['Half a lift','Quarter of a lift'],[move('H')])}<p class="note-reference">${lesson(24)}</p>`;
      const guided=this.source>2;
      const follow=`<p class="note-takeaway">In ${viewButton('flow')}, inspect ${tex('x=0')} to follow the starting height through each block.${guided?' The blue gap brackets shrink with a halve and keep their size with a lift.':''}</p>`;
      if(!this.known.has(25))return `<h3>Build a lift in pieces.</h3>${follow}${pieces}${recall([1,2,3],'Scaling and order',basics)}`;
      return `<h3>Fit the gap. Place the curve.</h3><p>A lift moves the ends and peak equally: their height gap stays the same. Halving shrinks that gap. ${guided?'Use the Height gap row':'Compare the peak and the ends'} in ${viewButton('function')} to decide how much to shrink it, then plan where the lifts belong.</p>${follow}${pieces}<p class="note-takeaway">Plan the gap first; the blocks can still interleave. Each halve affects every lift before it. Lifts after it keep their full height.</p>${recall([1,2,3],'Scaling and order',basics)}`;
    }
    if(topic===1) {
      const [roof,reflection]=await Promise.all([this.known.has(8)?this.example(8,'NA'):undefined,this.example(6,'N')]);
      const guided=this.source>2;
      const sign=guided?`<p class="note-takeaway">Here, ${tex(`${heightAtFormula('2')}-${heightAtFormula('0')}`)} is negative when the middle is below the ends. ${viewButton('function')} keeps the gap signed; reflection reverses its sign.</p>`:'';
      const track=guided?`<p class="note-takeaway">In ${viewButton('flow')}, reflection reverses the gap arrow. Halving shrinks the bracket; lifting moves it without changing its size.</p>`:'';
      if(!roof)return `<h3>Turn it over.</h3><p>Zero stays where it is. Every other height changes sign.</p>${strip(reflection.stages,['Below zero','Above zero'],[move('N')])}<p class="note-reference">${lesson(6)}</p>${sign}`;
      const placing=`<p>A bowl becomes a roof. Turn it over first; then lift its middle.</p>
        ${strip(roof.stages,['Bowl','Turned','Raised'],[move('N'),move('A')])}<p class="note-reference">${lesson(8)}</p>
        <p class="note-takeaway">Think in two jobs: shape the curve, then place it.</p>${track}
        ${recall([6],'What reflection keeps',`<p>Zero stays where it is. Every other height changes sign.</p>${strip(reflection.stages,['Below zero','Above zero'],[move('N')])}${sign}`)}`;
      if(!this.known.has(9))return `<h3>Turn, then place.</h3>${placing}`;
      const scaled=await this.example(9,'HNA');
      const fitting=`<p>Halving the bowl shrinks the depth. Turning and lifting afterward sets the peak without undoing that fit.</p>${strip([scaled.stages[0],scaled.stages[1],scaled.stages[3]],['Deep bowl','Fitted depth','Peak placed'],[move('H'),move('N')+move('A')])}<p class="note-reference">${lesson(9)}</p>${track}`;
      if(!this.known.has(26))return `<h3>Fit the depth. Keep the peak.</h3>${fitting}${recall([8],'Turn and lift',placing)}`;
      const raised=await this.example(26,'N');
      return `<h3>Account for the starting height.</h3><p>This bowl’s middle starts above zero. Reflecting carries it below zero too. Fit the depth and place the middle as separate jobs; the fractional lifts from Height still work.</p>${strip(raised.stages,['Raised bowl','Middle below zero'],[move('N')])}<p class="note-takeaway">${guided?'Fit the signed gap':'Compare the middle and ends'} in ${viewButton('function')}, then follow the middle at ${tex('x=2')} in ${viewButton('flow')}. A matching gap can still leave the middle too high or too low.</p>${recall([9],'Fit the depth',fitting)}${recall([8],'A roof from a bowl',placing)}`;
    }
    if(topic===2) {
      const [bowl,roof,fold]=await Promise.all([this.known.has(10)?this.example(10,'HQ'):undefined,this.known.has(4)?this.example(8,'NA'):undefined,this.example(7,'Q')]);
      const folding=`<p>Opposite heights meet when squared: ${tex('(-a)^2=a^2')}.</p>${strip(fold.stages,['Line','Bowl'],[move('Q')])}<p class="note-reference">${lesson(7)}</p>`;
      if(!bowl)return `<h3>A line becomes a bowl.</h3>${folding}`;
      const scaling=await this.squareOrder();
      if(!roof)return `<h3>Fit a bowl.</h3>${scaling}${recall([7],'How a line becomes a bowl',folding)}`;
      const connection=`<p>One puzzle’s finish can be another puzzle’s start.</p>
        ${strip([bowl.stages[0],bowl.stages.at(-1)!,roof.stages.at(-1)!],['Line','Fitted bowl','Arch'],[`<strong>Fit a bowl</strong><small>${lesson(10)}</small>`,`<strong>Turn &amp; lift</strong><small>${lesson(8)}</small>`],true)}
        <p class="note-takeaway">Choose a useful intermediate shape. Build it, then reuse a familiar transformation.</p>
        ${recall([10],'Fitting before squaring',scaling)}${recall([7],'How a line becomes a bowl',folding)}`;
      if(!this.known.has(27))return `<h3>An arch contains a bowl.</h3>${connection}`;
      const shifted=await this.example(27,'AQ');
      const moving=`<p>Squaring folds around the old curve’s zero. Lifting this line moves its zero from ${tex('x=2')} to ${tex('x=1')}; squaring afterward puts the bowl’s bottom there.</p>${strip(shifted.stages,['Original zero','Moved zero','Moved fold'],[move('A'),move('Q')])}<p class="note-reference">${lesson(27)}</p><p class="note-takeaway">These off-center targets have their lowest and highest heights at ${tex('x=1')} and ${tex('x=4')}. ${viewButton('function')} compares their height gap; ${viewButton('flow')} marks the same pair. The positions stay fixed while you edit.</p>`;
      if(!this.known.has(28))return `<h3>Move the zero. Move the fold.</h3>${moving}${recall([4],'Building an arch',connection)}`;
      const shiftedRoof=await this.example(27,'AQNA');
      return `<h3>Move the fold. Then build the arch.</h3><p>Find where the target’s peak belongs. Make a bowl with its bottom at that position, then choose its depth and final height.</p>${strip([shiftedRoof.stages[2],shiftedRoof.stages[4]],['Bottom moved','Peak at the same position'],[move('N')+move('A')])}<p class="note-takeaway">This sketch places the peak. Its depth and height still need fitting to your targets.</p>${recall([27],'Move the zero',moving)}${recall([4],'Building an arch',connection)}`;
    }
    if(topic===3)return this.powerNotes();
    if(topic===4)return this.slopeNotes();
    if(topic===5)return this.areaNotes();
    if(topic===6)return this.source<=47?this.circleNotes():this.relationNotes();
    if(topic===7)return this.waveNotes();
    if(topic===8)return this.stepNotes();
    return this.togetherNotes();
  }

  private async squareOrder():Promise<string> {
    const [before,after]=await Promise.all([this.example(10,'HQ'),this.example(10,'QH')]);
    return '<p>Both orders use the same blocks. A halve before a square is squared too: '+tex('(u/2)^2=u^2/4')+', while halving afterward gives '+tex('u^2/2')+'.</p>'+compare('Which order makes the shallower bowl?',[
      {label:'Halve, then square',stage:before.stages[2],before:before.stages[0]},
      {label:'Square, then halve',stage:after.stages[2],before:after.stages[0]}
    ],[{index:0,x:'0'},{index:1,x:'1'}]);
  }

  private async powerNotes():Promise<string> {
    const flat=await this.example(12,'Q');
    const basics=strip(flat.stages,['Bowl','Flatter middle'],[move('Q')]);
    if(!this.known.has(13))return '<h3>Flatten the middle.</h3><p>Squaring keeps '+tex('0')+' and '+tex('1')+', and lowers heights between them.</p>'+basics;
    const roof=await this.example(13,'QNA');
    const familiar='<p>The turn-and-lift idea still works with a new bowl.</p>'+strip([flat.stages[0],flat.stages.at(-1)!,roof.stages.at(-1)!],['Bowl','Flatter middle','Round roof'],['<strong>Square</strong>','<strong>Turn &amp; lift</strong>'],true);
    if(!this.known.has(29))return '<h3>Reshape, then reuse.</h3>'+familiar+recall([12],'What squaring keeps',basics);
    const sixth=await this.example(29,'Q');
    const powers='<p>A cubic input gives a sixth power when squared: '+tex('(u^3)^2=u^6')+'. A squared bowl gives '+tex('(u^2)^2=u^4')+'. The input matters as well as the block.</p>'+strip(sixth.stages,['Cubic input','Sixth-power bowl'],[move('Q')])+'<p class="note-takeaway">Between '+tex('-1')+' and '+tex('1')+', higher even powers sit closer to zero. Outside that interval they grow faster. Keep the endpoints fitted before flattening.</p>';
    const comparison=compare('Same ends. Different middles.',[
      {label:'Second power',stage:flat.stages[0],before:flat.stages[0]},
      {label:'Fourth power',stage:flat.stages[1],before:flat.stages[0]},
      {label:'Sixth power',stage:sixth.stages[1],before:flat.stages[0]}
    ],[{index:0,x:'0'},{index:1,x:'1'}],['Second power','Chosen power']);
    const earlier=recall([13],'Build a roof from a bowl',familiar);
    if(!this.known.has(30))return '<h3>Flatter comes in more than one shape.</h3>'+powers+comparison+earlier;
    const sixthRoof=await this.example(30,'QNA');
    const broader='<p>The sixth-power bowl can use the same turn-and-lift finish as the earlier flatter roof.</p>'+strip([sixthRoof.stages[1],sixthRoof.stages[2],sixthRoof.stages[3]],['Sixth-power bowl','Turned','Broader roof'],[move('N'),move('A')]);
    const sixthReference=recall([29],'Where the sixth power comes from',powers+comparison);
    if(!this.known.has(31))return '<h3>Reuse the finish on a new bowl.</h3>'+broader+sixthReference+earlier;
    const [eighth,fitted]=await Promise.all([this.example(12,'QQ'),this.example(31,'HH')]);
    const repeated='<p>Squaring a fourth power gives an eighth: '+tex('(u^4)^2=u^8')+'. Once the bowl’s ends are at '+tex('1')+', each square keeps them there while lowering the middle further.</p>'+compare('What changes when you square again?',[
      {label:'Fitted bowl',stage:eighth.stages[0],before:eighth.stages[0]},
      {label:'Square once',stage:eighth.stages[1],before:eighth.stages[0]},
      {label:'Square again',stage:eighth.stages[2],before:eighth.stages[1]}
    ],[{index:0,x:'0'},{index:1,x:'1'}]);
    const fit='<p>Fit the provided bowl before flattening. Heights above '+tex('1')+' grow when squared; an oversized end will not stay put.</p>'+strip([fitted.stages[0],fitted.stages[2]],['Ends above one','Ends fitted to one'],['<strong>Fit the bowl</strong>'])+repeated+'<p class="note-takeaway">The middle and ends do different jobs. Repeated squaring changes their gap; turning and lifting then place the summit.</p>';
    const scaling=recall([10],'Why fitting before squaring matters',await this.squareOrder());
    if(!this.known.has(11))return '<h3>Fit first. Then square again.</h3>'+fit+scaling+recall([30],'Turn and lift the new bowl',broader)+sixthReference;
    const line=await this.example(7,'Q');
    return '<h3>Build the bowl. Choose the finish.</h3><p>The previous puzzle supplied a bowl. Here, construct and fit the bowl from a line before flattening it. The required middle and end heights decide the power, depth and final height; the largest power is not automatically the right choice.</p>'+strip(line.stages,['Line provided','Bowl to work with'],[move('Q')])+'<p class="note-takeaway">Choose an intermediate shape, then reuse the familiar fitting and placement jobs. These sketches are subgoals, not the finished challenge.</p>'+recall([31],'Fit, then flatten again',fit)+scaling+recall([13,30],'Turn and lift',familiar+broader)+sixthReference;
  }

  private async slopeNotes():Promise<string> {
    const reading=await this.example(32,'D');
    const foundation='<p>The fixed station reads the input’s slope. Downhill gives a negative output, flat gives zero, and uphill gives positive.</p>'+strip(reading.stages,['Input curve','Slope output'],[move('D')])+'<p>In '+viewButton('flow')+', inspect the local tangent: its signed rise divided by its horizontal run is the slope. The spatial sketch comes before the station’s output plot. The slider chooses horizontal position, not time.</p>';
    const [before,after]=await Promise.all([this.example(32,'AD'),this.example(32,'DA')]);
    const lift='<p>A lift before the station does not change any slope. A lift after the station changes the output.</p>'+strip([before.stages.at(-1)!,after.stages.at(-1)!],['Lift the input','Lift the output'],[tex('\\ne')]);
    if(!this.known.has(33))return '<h3>Two sides. Two jobs.</h3>'+foundation+lift;
    const turning=await this.example(33,'QD');
    const folded='<p>A straight line has a constant slope. Fold it into a bowl first and the slope can change sign.</p>'+strip(turning.stages,['Line','Bowl','Changing slope'],[move('Q'),move('D')]);
    const reference=recall([32],'Lifting before or after',lift)+recall([32],'Reading change',foundation);
    if(!this.known.has(34))return '<h3>Make a turning point.</h3>'+folded+reference;
    const shifted=await this.example(34,'AQD');
    const moving='<p>Reuse '+lesson(27)+': lifting a line moves its zero before it is squared. Follow that moved turning point through the station.</p>'+strip(shifted.stages.slice(1),['Zero moved','Turning point moved','Slope zero moved'],[move('Q'),move('D')])+compare('Where does the slope change sign?',[
      {label:'Original fold',stage:turning.stages[2],before:turning.stages[2]},
      {label:'Moved fold',stage:shifted.stages[3],before:turning.stages[2]}
    ],[{index:1,x:'1'},{index:2,x:'2'}],['Original slope','New slope']);
    if(!this.known.has(35))return '<h3>Move where the slope changes sign.</h3>'+moving+recall([33],'Make a changing slope',folded)+reference;
    const still=await this.example(35,'QD');
    const three='<p>Squaring this roof makes both zero-height ends flat as well as its middle. The station turns all three flat places into zero slopes.</p>'+strip(still.stages,['Roof','Three flat places','Three zero slopes'],[move('Q'),move('D')])+'<p class="note-takeaway">Use '+viewButton('flow')+' to find the flat places. A zero slope need not change sign: check each side.</p>';
    if(!this.known.has(36))return '<h3>Build the places where change stops.</h3>'+three+recall([34],'Move a turning point',moving)+reference;
    const starting=await this.example(36,'D');
    return '<h3>Plan the input from the output.</h3><p>The bare station produces a straight line. The targets need an output that rises, falls, then rises. Shape how the input’s slope changes, then fit the final height.</p>'+strip([starting.stages[1]],['Starting output and required heights'],[],false,starting.checkpoints)+'<p class="note-takeaway">An input flat place becomes zero immediately after Find slope. Later output blocks can move that zero. A matching height gap does not place every target.</p>'+recall([35],'Three flat places become three zeros',three)+recall([8],'Build the roof that will be squared',strip((await this.example(8,'NA')).stages,['Bowl','Turned','Roof'],[move('N'),move('A')]))+recall([34],'Move a turning point',moving)+reference;
  }

  private async circleNotes():Promise<string> {
    const [small,large]=await Promise.all([this.circleExample('2','0','1/2'),this.circleExample('2','0','3/2')]);
    const both=`<h3>A path has two halves.</h3><p>${tex('h^2=r^2-(x-2)^2')} includes heights above <em>and</em> below zero: ${tex('r')} and ${tex('-r')} have the same square. Pull the slingshot to change the radius; the centre stays put.</p>${diagramChoices('One centre. Two different reaches.',[
      {label:'Smaller radius',html:circleSketch([small],{centre:true,spoke:true})},
      {label:'Larger radius',html:circleSketch([small,large],{centre:true,spoke:true})}
    ])}<p>The cucumber starts on the right, travels counterclockwise, and returns to where it started. ${viewButton('flow')} follows a whole turn, including both heights at the same horizontal position.</p>`;
    if(!this.known.has(44))return both;
    const [original,translated]=await Promise.all([this.circleExample('2','0','1'),this.circleExample('5/2','1/2','1')]);
    const centre=`<h3>Move the centre. Keep the distance.</h3><p>${tex('(a,b)')} is the centre and ${tex('r')} is the radius. Moving the centre carries the whole loop with it; its size stays the same.</p>${diagramChoices('Move the centre, or change the radius?',[
      {label:'Original centre',html:circleSketch([original],{centre:true,spoke:true})},
      {label:'Moved centre',html:circleSketch([original,translated],{centre:true,spoke:true})}
    ])}<p>${tex('(x-a)^2+(h-b)^2=r^2')}</p><p>Every target needs the same distance from the centre. ${viewButton('function')} compares squared distances exactly. Drag the centre or use its arrow keys; exact values live in the recipe.</p>`;
    if(!this.known.has(45))return centre+recall([43],'Why both halves belong',both);
    const diagonal=await this.circleExample('2','0','5/4',[['11/4','1'],['5/4','-1'],['13/4','0']]);
    const reading=diagonal.checkpoints[0];
    const diameter=`<h3>Start with a useful pair.</h3><p>For opposite ends of a diameter, the centre is their midpoint and the radius is half their separation. A diagonal diameter works too.</p>${circleSketch([diagonal],{centre:true,triangle:true,targets:[[2.75,1],[1.25,-1]],diameter:true})}<p class="note-distance-example">${tex(`(${rationalTex(reading.dx!)})^2+(${rationalTex(reading.dy!)})^2=${rationalTex(reading.lhs!)}=r^2`)}</p><p>The coloured legs make a right triangle. Their squares add to the squared radius; ${viewButton('flow')} shows the same comparison for each of your targets.</p>`;
    if(!this.known.has(46))return diameter+recall([44],'Centre and distance',centre);
    const reference=await this.circleExample('2','0','5/4');
    const targets:[number,number][]=[[2,1.25],[3.25,0],[2,-1.25]];
    const intersection=diagramChoices('One pair narrows it down. Two pairs locate it.',[
      {label:'One pair',html:circleSketch([reference],{targets,pairs:[[0,1]]})},
      {label:'Two pairs',html:circleSketch([reference],{targets,pairs:[[0,1],[1,2]],centre:true})}
    ]);
    const chord=`<h3>Equal distances narrow the search.</h3><p>Two targets need not be opposite. Their midpoint alone is <em>not</em> the centre. All possible centres lie on the perpendicular line through that midpoint.</p>${intersection}<p>Choose a pair in ${viewButton('flow')}, then compare another pair. The lines meet at a centre equally far from all three targets. Choose the radius afterward.</p>`;
    if(!this.known.has(47))return chord+recall([45],'Diameter and squared distance',diameter)+recall([44],'Move the centre',centre);
    const final=await this.kernel.run(undefined,{type:'level',sourceId:47,mode:'puzzle'});
    if(!final.result)throw new Error('Circle targets unavailable');
    const finalTargets=final.result.checkpoints.map(point=>[fraction(point.x),targetHeight(point)] as [number,number]);
    const locating='<h3>Find the second line.</h3><p>The target arrangement has changed. Here is one pair and its line of possible centres. Which other pair could narrow it to a single point?</p>'+circleSketch([],{targets:finalTargets,pairs:[[0,1]],bounds:[-2,4,-4,3]})+'<p class="note-takeaway">Compare another pair in '+viewButton('flow')+'. Locate the common centre, then fit the distance. The centre and radius are still yours to find.</p>';
    return locating+recall([46],'How two pairs locate a centre',chord)+recall([45],'Diameter and squared distance',diameter)+recall([44],'Move the centre',centre);
  }

  private async relationNotes():Promise<string> {
    if(this.source===78) {
      const [original,moved]=await Promise.all([this.example(78,'Q'),this.example(78,'AQ')]);
      return '<h3>Move the incoming zero before folding.</h3><p>The widest target pair locates the loop’s centre. The input’s zero must reach that position before Square turns it into the bottom of a bowl.</p>'+compare('Which bowl has its zero at the needed position?',[
        {label:'Original zero',stage:original.stages.at(-1)!},
        {label:'Lift before folding',stage:moved.stages.at(-1)!,before:original.stages.at(-1)!}
      ])+'<p>The bowl is an intermediate shape. Its reflection and height still need choosing; inspect the right side in '+viewButton('flow')+'.</p>';
    }
    if(this.source===71) {
      const [before,after]=await Promise.all([this.example(68,'HH'),this.example(68,'HHQ')]);
      return '<h3>One signed roof can make several visible pieces.</h3><p>Read the zero and the distance from the middle first. The outer heights can be copies of a negative part of that same roof.</p>'+diagramChoices('An independent roof, before and after squaring.',[
        {label:'Signed right side',html:relationSketch(before,'Only its nonnegative region has heights',{bounds:[0,4,-2,2]})},
        {label:'Squared right side',html:relationSketch(after,'Both signs of its magnitude',{before,bounds:[0,4,-2,2]})}
      ])+'<p>Your targets still determine the roof\u2019s centre, scale and final magnitude. Compare them in '+viewButton('function')+'.</p>';
    }
    if([68,69,70].includes(this.source))return '<h3>Read the right side as squared height.</h3><p>Track what the block changes before taking the two square roots. Use '+viewButton('flow')+' to see both stages.</p>';
    const roof=await this.circleRoofLesson();
    if(!this.known.has(66))return '<h3>Build an equation with two heights.</h3>'+roof+recall([43,44],'From centre and radius to a roof',await this.geometryEquationConnection());
    const paired=await this.pairedRoofLesson();
    if(!this.known.has(49))return '<h3>The right side chooses rounded or pointed ends.</h3>'+paired+recall([48],'A roof becomes a loop',roof)+recall([43,44],'Geometry behind the equation',await this.geometryEquationConnection());
    const final=await this.kernel.run(undefined,{type:'level',sourceId:49,mode:'puzzle'});
    if(!final.result)throw new Error('Two-height targets unavailable');
    const targets=final.result.checkpoints.map(point=>[fraction(point.x),targetHeight(point)] as [number,number]);
    const geometry=circleSketch([],{targets,bounds:[-2,4,-3,3]});
    return '<h3>Infer the loop. Then build its equation.</h3><p>The matching heights above and below zero share a horizontal position. That widest pair locates the circle\u2019s centre and radius. A target on zero locates one horizontal edge.</p>'+geometry+'<p class="note-takeaway">Use '+viewButton('function')+' to compare squared heights. In '+viewButton('flow')+', build a roof whose maximum is the squared radius and whose zeros are the circle\u2019s edges. Its scale and block order remain yours to find.</p>'+recall([66],'Rounded or pointed ends',paired)+recall([48],'How one roof supplies two heights',roof);
  }

  private async circleRoofLesson() {
    const [made,wider]=await Promise.all([this.example(48,'QNA'),this.example(48,'QHNA')]);
    if(!made.relation?.solvedLatex)throw new Error('Solved relation unavailable');
    return `<p>A circle with centre ${tex('(2,0)')} and radius ${tex('1')} reaches zero at ${tex('x=1')} and ${tex('x=3')}. The matching roof has those zeros and reaches ${tex('1')} at the centre. The kernel writes the squared-height equation and both solved heights.</p>${compare('How does the roof control the loop?', [{label:'Wider roof',stage:wider.stages.at(-1)!},{label:'Unit roof',stage:made.stages.at(-1)!,before:wider.stages.at(-1)!}])}${relationSketch(made,'The same roof produces an upper and lower branch.')}<p class="note-takeaway">Geometry chooses the roof: its zeros mark the left and right edges, and its peak is the squared radius. Build that nonnegative roof first; the relation supplies both heights.</p>`;
  }

  private async pairedRoofLesson() {
    const [rounded,pointed]=await Promise.all([this.example(66,''),this.example(66,'Q')]);
    if(!rounded.relation?.solvedLatex||!pointed.relation?.solvedLatex)throw new Error('Solved relation unavailable');
    return '<p>With the roof itself on the right, solving for height takes its square root. The two branches bend into rounded ends. Squaring the roof first changes the solved heights to positive and negative copies of the roof, which meet in pointed ends.</p>'+diagramChoices('Same roof. Rounded or pointed ends.',[
      {label:'Roof',html:relationSketch(rounded,'Square-root branches have rounded ends.')},
      {label:'Roof squared',html:relationSketch(pointed,'Copied roof branches meet in points.',{before:rounded})}
    ])+`<p>${tex('h^2=a\\ \\Longrightarrow\\ h=\\pm\\sqrt a')} ${tex('\\qquad')} ${tex('h^2=a^2\\ \\Longrightarrow\\ h=\\pm a\\quad(a\\ge0)')}</p>`+'<p class="note-takeaway">The zeros still locate the ends. The last square on the right side decides whether those ends are rounded or pointed.</p>';
  }

  private async geometryEquationConnection() {
    const example=await this.circleExample('2','0','1');
    return circleSketch([example],{centre:true,spoke:true})+'<p>The centre fixes the roof’s horizontal midpoint. The radius fixes both how far its zeros lie from that midpoint and the roof’s maximum squared height.</p>';
  }

  private async geometryPairRecall() {
    const reference=await this.circleExample('2','0','5/4');
    const targets:[number,number][]=[[2,1.25],[3.25,0],[2,-1.25]];
    return diagramChoices('One pair narrows it down. Two pairs locate it.',[
      {label:'One pair',html:circleSketch([reference],{targets,pairs:[[0,1]]})},
      {label:'Two pairs',html:circleSketch([reference],{targets,pairs:[[0,1],[1,2]],centre:true})}
    ]);
  }

  private async waveNotes():Promise<string> {
    if(this.source===79||this.source===81) {
      const [liftFirst,halveFirst]=await Promise.all([this.example(this.source,'AH'),this.example(this.source,'HA')]);
      const movable=this.source===81;
      return '<h3>Set the phase before the circular projection.</h3><p>A halve also halves any lift that came before it. Compare the input at the target peak: sine reaches its first maximum when the incoming value is '+tex('1')+'.</p>'+compare('The same two blocks reach different input heights.',[
        {label:'Lift, then halve',stage:liftFirst.stages.at(-1)!,before:liftFirst.stages[0]},
        {label:'Halve, then lift',stage:halveFirst.stages.at(-1)!,before:halveFirst.stages[0]}
      ])+'<p>'+(movable?'Place Sine after the input you intend to project. Blocks after it change the output heights instead.':'The fixed Sine station reads the completed input zone.')+' Use '+viewButton('flow')+' to compare the input height with the circular projection. The finishing order remains yours to choose.</p>';
    }
    const turn=await this.example(50,'S');
    const quarter='<p>The sine block reads its input as turns around a circle: '+tex('S(u)=\\sin(\\frac{\\pi u}{2})')+'. Increasing '+tex('u')+' by one advances a quarter-turn, so the heights repeat '+tex('0,1,0,-1,0')+'.</p>'+compare('A line becomes a repeating height.',[
      {label:'Input position',stage:turn.stages[0]},
      {label:'Circle height',stage:turn.stages.at(-1)!,before:turn.stages[0]}
    ])+'<p class="note-takeaway">Use '+viewButton('flow')+' to follow the input value into the circular projection. The block reads height as an angle; time still only controls playback.</p>';
    if(!this.known.has(51))return '<h3>Unfold a circle into a wave.</h3>'+quarter;
    const [phase,lift]=await Promise.all([this.example(51,'AS'),this.example(51,'SA')]);
    const phaseLesson='<p>Phase is the input’s position around the circle. A lift before Sine changes where peaks and zeros occur. The baseline is the wave’s middle height. A lift after Sine raises the wave without moving its peaks sideways; zero crossings can move or disappear.</p>'+compare('Move the phase, or move the baseline?',[{label:'Lift the input',stage:phase.stages.at(-1)!,before:turn.stages.at(-1)!},{label:'Lift the output',stage:lift.stages.at(-1)!,before:turn.stages.at(-1)!}]);
    if(!this.known.has(52))return '<h3>Input lift changes phase. Output lift changes height.</h3>'+phaseLesson+recall([50],'Quarter-turn input',quarter);
    const [period,amplitude]=await Promise.all([this.example(52,'HS'),this.example(52,'SH')]);
    const scaleLesson='<p>The period is the horizontal distance of one repeat. Amplitude is the distance from the middle height to a peak. Halving before Sine makes the input advance half as far over the same horizontal distance, doubling the period. Halving after Sine keeps the zeros and period but halves the amplitude.</p>'+compare('Stretch the period, or shrink the height?',[{label:'Halve the input',stage:period.stages.at(-1)!,before:turn.stages.at(-1)!},{label:'Halve the output',stage:amplitude.stages.at(-1)!,before:turn.stages.at(-1)!}]);
    if(!this.known.has(53))return '<h3>Input scale changes period. Output scale changes amplitude.</h3>'+scaleLesson+recall([51],'Phase and baseline',phaseLesson)+recall([50],'Quarter-turn input',quarter);
    const folded=await this.example(53,'SQ');
    const foldLesson='<p>Squaring after Sine folds every negative lobe above zero. Zeros stay fixed, while peaks of either sign meet at height one. The positive and negative lobes now repeat the same shape, so the repeat distance halves.</p>'+compare('Keep signed lobes, or fold them?',[
      {label:'Signed wave',stage:folded.stages.at(-2)!},
      {label:'Folded lobes',stage:folded.stages.at(-1)!,before:folded.stages.at(-2)!}
    ]);
    if(!this.known.has(54))return '<h3>Fold the lower lobes upward.</h3>'+foldLesson+recall([52],'Period and amplitude',scaleLesson)+recall([51],'Phase and baseline',phaseLesson);
    const [base,small,raised]=await Promise.all([this.example(54,'S'),this.example(54,'SH'),this.example(54,'SA')]);
    const fitting='<p>Amplitude and baseline answer different questions. Scale the output to fit peak-to-trough distance; lift the output to place the middle height.</p>'+compare('Which measurement are you changing?',[{label:'Unfitted wave',stage:base.stages.at(-1)!},{label:'Smaller amplitude',stage:small.stages.at(-1)!,before:base.stages.at(-1)!},{label:'Higher baseline',stage:raised.stages.at(-1)!,before:base.stages.at(-1)!}]);
    if(!this.known.has(55))return '<h3>Fit the range. Then place its middle.</h3>'+fitting+recall([53],'Fold signed lobes',foldLesson)+recall([52],'Period and amplitude',scaleLesson);
    const shiftedFold=await this.example(55,'ASQ');
    return '<h3>Place the lobes before fitting them.</h3><p>First decide where the zeros and lobes belong. A change before sine moves that pattern; squaring afterward can fold selected lobes together. Scaling and lifting the output then fit and place the result.</p>'+strip([shiftedFold.stages[1],shiftedFold.stages[2],shiftedFold.stages[3]],['Input phase moved','Wave shifted','Lobes folded'],[move('S'),move('Q')])+'<p class="note-takeaway">This is a phase-and-fold subgoal, not the finished recipe. Use the targets to decide the phase, period, amplitude and baseline.</p>'+recall([54],'Fit amplitude and baseline',fitting)+recall([53],'Fold signed lobes',foldLesson)+recall([52,51],'Input versus output changes',scaleLesson+phaseLesson)+recall([50],'Quarter-turn input',quarter);
  }

  private async stepNotes():Promise<string> {
    const floor=await this.example(56,'F');
    const floorLesson='<p>A threshold is a position where the input reaches an integer. Floor holds each integer height until the next threshold. In this rising input, the higher step includes the boundary and the lower step leaves it out. A filled endpoint includes the value; an open endpoint leaves it out.</p>'+strip(floor.stages,['Rising input','Floor steps'],[move('F')]);
    if(!this.known.has(57))return '<h3>Round down into steps.</h3>'+floorLesson;
    const ceil=await this.example(57,'C');
    const ceilLesson='<p>Ceiling rounds upward instead. Its jumps occur at the same integer boundaries, but the closed endpoint belongs to the lower side.</p>'+compare('Which way does the input round?',[{label:'Floor',stage:floor.stages.at(-1)!,before:floor.stages[0]},{label:'Ceiling',stage:ceil.stages.at(-1)!,before:ceil.stages[0]}]);
    if(!this.known.has(58))return '<h3>Round up into steps.</h3>'+ceilLesson+recall([56],'How floor holds a value',floorLesson);
    const [turnAfter,turnBefore]=await Promise.all([this.example(58,'FN'),this.example(58,'NF')]);
    const direction='<p>Negating the input changes which integer Floor selects. Negating the finished result changes its sign. Negating both before and after Floor gives Ceiling: '+tex('\\lceil u\\rceil=-\\lfloor-u\\rfloor')+'.</p>'+compare('Negate before or after Floor?', [{label:'Floor, then negate',stage:turnAfter.stages.at(-1)!,before:turnAfter.stages[0]},{label:'Negate, then floor',stage:turnBefore.stages.at(-1)!,before:turnBefore.stages[0]}]);
    if(!this.known.has(59))return '<h3>Negation changes which side owns a step boundary.</h3>'+direction+recall([57],'Floor and ceiling',ceilLesson)+recall([56],'Floor steps',floorLesson);
    const [wide,short]=await Promise.all([this.example(59,'HF'),this.example(59,'FH')]);
    const sizing='<p>Halving before floor takes twice as much input to reach each next integer, so steps become wider. Halving after floor keeps their boundaries and makes their heights smaller.</p>'+compare('Change step width, or step height?',[{label:'Halve before floor',stage:wide.stages.at(-1)!,before:wide.stages[0]},{label:'Halve after floor',stage:short.stages.at(-1)!,before:short.stages[0]}]);
    if(!this.known.has(60))return '<h3>Input scale sets width. Output scale sets height.</h3>'+sizing+recall([58],'Rounding direction',direction);
    const [baseline,shifted,raised]=await Promise.all([this.example(60,'HF'),this.example(60,'AHF'),this.example(60,'HFA')]);
    const shifting='<p>A whole-unit shift directly before floor can equal a lift afterward: '+tex('\\lfloor u+1\\rfloor=\\lfloor u\\rfloor+1')+'. Here the lift is halved first, so floor receives a half-unit phase. The jumps move by half of their two-unit step width instead of merely rising.</p>'+compare('Move the jumps, or raise the steps?',[{label:'Half-step input phase',stage:shifted.stages.at(-1)!,before:baseline.stages.at(-1)!},{label:'Output lift',stage:raised.stages.at(-1)!,before:baseline.stages.at(-1)!}]);
    if(!this.known.has(61))return '<h3>Input lift changes step phase.</h3>'+shifting+recall([59],'Step width and height',sizing)+recall([58],'Rounding direction',direction);
    const projection=await this.example(61,'FS');
    const projecting='<p>Floor supplies integer inputs. Sine reads those integers as quarter-turns, so successive steps project to '+tex('0,1,0,-1')+' and repeat.</p>'+strip(projection.stages,['Input','Integer steps','Circular height'],[move('F'),move('S')])+'<p class="note-takeaway">In '+viewButton('flow')+', separate the jump positions from the four-value circular pattern.</p>';
    if(!this.known.has(62))return '<h3>Project steps around a circle.</h3>'+projecting+recall([60],'Move the jump positions',shifting)+recall([59],'Set step width',sizing);
    const accumulated=await this.example(62,'FSI');
    const area='<p>After the projection, each flat region contributes signed rectangular area. Positive steps make the total rise, zero steps hold it, and negative steps make it fall.</p>'+strip(accumulated.stages,['Input','Integer steps','Signed step heights','Accumulated area'],[move('F'),move('S'),move('I')])+'<p class="note-takeaway">Use '+viewButton('flow')+' to inspect one region at a time. A jump changes the incoming rate immediately; the accumulated curve stays continuous and changes slope.</p>';
    if(!this.known.has(63))return '<h3>Build a continuous path from step area.</h3>'+area+recall([61],'The four-value projection',projecting)+recall([60,59],'Place and size the steps',shifting+sizing);
    return '<h3>Shape what the step area builds.</h3><p>First plan the step regions and their signs. Accumulation turns those constant heights into straight rising, flat or falling pieces. Familiar square, turn and lift relationships can then reshape and place that continuous result.</p>'+strip([accumulated.stages[2],accumulated.stages[3]],['Signed step input','Continuous accumulated path'],[move('I')])+'<p class="note-takeaway">Choose the needed intermediate path before transforming it. The notes leave the final square, reflection and lift choices unresolved.</p>'+recall([62],'Signed step area',area)+recall([61],'Project integer steps',projecting)+recall([60,59,58],'Control the staircase',shifting+sizing+direction);
  }

  private async togetherNotes():Promise<string> {
    if(this.source===85) {
      const [projectThenArea,areaThenProject]=await Promise.all([this.example(50,'FSI'),this.example(50,'FIS')]);
      return '<h3>What does the accumulated curve feed?</h3><p>These independent examples use the same steps. One projects their heights before adding area; the other projects the growing total.</p>'+compare('The two orders give area a different job.',[
        {label:'Project, then accumulate',stage:projectThenArea.stages.at(-1)!},
        {label:'Accumulate, then project',stage:areaThenProject.stages.at(-1)!}
      ])+'<p>Your targets still determine the threshold positions, how quickly each region advances and how the right side supplies both signs of height. Use '+viewButton('flow')+' to connect those intermediate decisions; this is not the fitted recipe.</p>';
    }
    const [water,bamboo]=await Promise.all([this.example(50,'HSH'),this.example(82,'H')]);
    const reference=(id:number)=>`<p class="note-reference">${lesson(id)}</p>`;
    const bambooLesson='<p>A straight line has one constant inclination. Halving its height keeps the zero fixed and halves the rise over every horizontal interval.</p>'+strip(bamboo.stages,['Starting line','Half the rise'],[move('H')])+reference(82);
    const waterLesson='<p>Scaling after sine changes the height and keeps its zeros. The picture frame is already fixed.</p>'+strip([water.stages.at(-2)!,water.stages.at(-1)!],['A wide wave','Half its height'],[move('H')])+reference(72);
    const artLessons:[number,string,string][]=[[82,'Set the inclination of a straight support',bambooLesson],[72,'Fit height inside a fixed frame',waterLesson]];
    if(this.known.has(73)) {
      const anchored=await this.example(37,'I');
      const body='<p>Accumulation stays anchored at zero even when the drawing frame starts later. The frame does not restart the accumulated amount at its left edge.</p>'+strip(anchored.stages,['Input','Area accumulated from zero'],[move('I')])+`<p>${tex('F(x)=\\int_0^x h(u)\\,\\mathrm{d}u')}</p>`+reference(73);
      artLessons.push([73,'The frame keeps the same area anchor',body]);
    }
    if(this.known.has(74)) {
      const moon=await this.example(68,'HH');
      const body="<p>The zeros of the right side set a loop's horizontal edges. Its maximum squared height sets its thickness, so a smaller maximum makes a thinner loop without moving those zeros. At one position, call the right-side value "+tex('a')+'.</p>'+relationSketch(moon,'Zeros set the edges; squared height sets the reach.')+`<p>${tex('h^2=a\\qquad h=\\pm\\sqrt a')}</p>`+reference(74);
      artLessons.push([74,'Zeros and squared height size a loop',body]);
    }
    if(this.known.has(75)) {
      const leaf=await this.example(66,'Q');
      const body='<p>A line can first become a nonnegative roof with two zeros. When the squared-height equation uses the square of that roof, its solved branches are positive and negative copies that meet at those zeros.</p>'+relationSketch(leaf,'Copied roof branches make a pointed outline.')+reference(75);
      artLessons.push([75,'Build a pointed leaf from a roof',body]);
    }
    if(this.known.has(83)) {
      const petal=await this.example(83,'Q');
      const body='<p>Squaring a roof keeps its zero tips and unit peak, but draws fractional shoulders inward. In a squared-height equation, the positive and negative branches become one pointed petal.</p>'+relationSketch(petal,'One solved outline supplies one petal.')+'<p>The garden rotates this same kernel-supplied petal five times around a centre. That repetition is decorative; the puzzle still checks only this one exact construction.</p>'+reference(83);
      artLessons.push([83,'One pointed petal can make a five-petal flower',body]);
    }
    if(this.known.has(76)) {
      const ripple=await this.example(54,'S');
      const body='<p>Input shift and scale place and size the original sine cycle. Output scaling and lifting set its height and middle level. Squaring folds the lobes and can shorten the repeat distance. The fixed frame keeps the useful part without changing its heights.</p>'+strip([ripple.stages.at(-2)!,ripple.stages.at(-1)!],['Input phase','Wave height'],[move('S')])+reference(76);
      artLessons.push([76,'Fit phase, amplitude and baseline',body]);
    }
    if(this.known.has(77)) {
      const [arch,broad,rounded,pointed]=await Promise.all([this.example(8,'NA'),this.example(13,'QNA'),this.example(66,''),this.example(66,'Q')]);
      const roofs=compare('A flatter bowl makes a broader roof.',[
        {label:'Familiar arch',stage:arch.stages.at(-1)!},
        {label:'Broader roof',stage:broad.stages.at(-1)!,before:arch.stages.at(-1)!}
      ],[],['Familiar arch','Broader roof']);
      const ends=diagramChoices('The final right side chooses the cap shape.',[
        {label:'Roof',html:relationSketch(rounded,'Square-root branches round the caps.')},
        {label:'Roof squared',html:relationSketch(pointed,'Copied branches meet in points.',{before:rounded})}
      ]);
      const body='<p>A flatter bowl can become a broader roof after turning and lifting. That controls the body. Separately, leaving a roof unsquared on the right of a squared-height equation makes square-root branches with rounded caps; squaring that final roof would make pointed ends.</p>'+roofs+ends+`<p>At one position, if the right-side roof has value ${tex('a')}, then ${tex('h^2=\\frac a4\\quad\\Longrightarrow\\quad |h|=\\frac{\\sqrt a}{2}')}. The square root belongs to the squared-height relation itself.</p>`+reference(77);
      artLessons.push([77,'Broadness, rounded caps and thickness are separate',body]);
    }
    const visibleArt=artLessons.filter(([id])=>this.known.has(id));
    if(!this.known.has(64)) {
      const current=visibleArt.pop()!;
      return `<h3>${current[1]}.</h3>${current[2]}${visibleArt.reverse().map(([id,title,body])=>recall([id],title,body)).join('')}`;
    }
    const artRecall=visibleArt.reverse().map(([id,title,body])=>recall([id],title,body)).join('');
    const [direct,wave]=await Promise.all([this.example(64,'S'),this.example(64,'DS')]);
    const shaped='<p>The cubic input winds around sine’s circle at an uneven rate. Its slope is a bowl, so differentiating first produces a quadratic phase whose heights still reach the circle at unequal horizontal intervals.</p>'+strip(wave.stages,['Cubic input','Slope hidden inside','Wave from that phase'],[move('D'),move('S')])+compare('Which input controls the peak spacing?',[{label:'Cubic phase directly',stage:direct.stages.at(-1)!},{label:'Slope phase',stage:wave.stages.at(-1)!}])+'<p class="note-takeaway">Use '+viewButton('flow')+' to connect each phase height with its place on the circle. Folding and fitting the resulting wave are later jobs.</p>';
    if(!this.known.has(65))return '<h3>Shape the phase before making the wave.</h3>'+shaped+recall([53,54],'Fold and fit a wave',await this.waveRecall())+recall([66],'How one magnitude supplies two heights',await this.pairedRoofLesson())+artRecall;
    const window=await this.example(65,'AHFSI');
    const building='<p>A shifted and widened floor can isolate one middle region. Sine turns those integer levels into zero, positive, then zero heights; accumulation turns that window into a continuous change.</p>'+strip(window.stages.slice(-4),['Input phase and width','Phased steps','Positive window','Accumulated window'],[move('F'),move('S'),move('I')])+'<p class="note-takeaway">Look for the positive window before accumulating it. Centre and fold the accumulated shape only after that subgoal is visible.</p>';
    if(!this.known.has(67))return '<h3>Build a window, then build from it.</h3>'+building+recall([64],'Shape a sine phase',shaped)+recall([61,62],'Steps, projection and signed area',await this.stepRecall())+recall([66],'Rounded or pointed ends',await this.pairedRoofLesson())+artRecall;
    const start=await this.example(67,'');
    return '<h3>Plan the hidden intermediate shapes.</h3><p>The outside regions must become zero while one inside window stays positive. Follow the accumulated total as its value goes from '+tex('0')+' to '+tex('2')+'. Its midpoint value '+tex('1')+' occurs at the symmetry position '+tex('x=2')+'; centre the accumulated values around '+tex('1')+', then fold them.</p>'+strip([start.stages[0]],['Starting curve and required heights'],[],false,start.checkpoints)+'<p class="note-takeaway">At the final relation, distinguish the built height from its square. The squared-height equation asks for both signs of the same magnitude. Work through the subgoals in '+viewButton('flow')+'; the complete block chain remains hidden.</p>'+recall([65],'Window, area, centre and fold',building)+recall([64],'Shape the sine phase',shaped)+recall([66],'Rounded or pointed ends',await this.pairedRoofLesson())+recall([61,62],'Steps and signed accumulation',await this.stepRecall())+artRecall;
  }

  private async waveRecall() {
    const [wave,folded]=await Promise.all([this.example(53,'S'),this.example(53,'SQ')]);
    return compare('Signed or folded lobes?',[{label:'Signed wave',stage:wave.stages.at(-1)!},{label:'Folded wave',stage:folded.stages.at(-1)!,before:wave.stages.at(-1)!}]);
  }

  private async stepRecall() {
    const result=await this.example(62,'FSI');
    return strip(result.stages.slice(-3),['Steps','Circular projection','Accumulated path'],[move('S'),move('I')]);
  }

  circleExample(x:string,y:string,radius:string,goals:string[][]=[]) {
    const key=`circle:${x}:${y}:${radius}:${JSON.stringify(goals)}`;
    let cached=this.examples.get(key);
    if(!cached) {
      cached=(async()=>{
        const initial=await this.kernel.run(undefined,{type:'level',sourceId:43,mode:'remix'});
        if(!initial.state)throw new Error('Circle example unavailable');
        const state={...initial.state,circle:{x,y,radius},mode:goals.length?'challenge' as const:'remix' as const,goals:goals.map(([x,y])=>({x,y}))};
        const reply=await this.kernel.run(state,{type:'evaluate'});
        if(!reply.result?.circle)throw new Error('Circle example unavailable');
        return reply.result;
      })();
      this.examples.set(key,cached);void cached.catch(()=>this.examples.delete(key));
    }
    return cached;
  }

  private async areaNotes():Promise<string> {
    const ramp=await this.example(37,'I');
    const [inputLift,outputLift]=await Promise.all([this.example(37,'AI'),this.example(37,'IA')]);
    const lifts=compare('More incoming, or more at the start?',[
      {label:'Lift the input',stage:inputLift.stages[2],before:ramp.stages[1]},
      {label:'Lift the output',stage:outputLift.stages[2],before:ramp.stages[1]}
    ],[{index:0,x:'0'},{index:2,x:'2'}],['Original amount','New amount']);
    const basics='<p>The station accumulates signed area from zero: '+tex('F(x)=\\int_0^x h(u)\\,\\mathrm{d}u')+'. Here '+tex('F')+' is the accumulated output; '+tex('u')+' runs over horizontal positions from zero to '+tex('x')+'. Its output starts at zero. Raising the input adds more at every step; raising the output changes where it starts.</p>'+strip(ramp.stages,['Input height','Signed area'],[move('I')])+lifts+'<p>Scrub '+viewButton('flow')+' to follow the input-height arrow and signed-area meter. Solid area adds; hatched area subtracts. The meter measures area from zero to the inspected horizontal position.</p>';
    if(!this.known.has(38))return '<h3>Feed the accumulator.</h3>'+basics;
    const [signed,moved]=await Promise.all([this.example(38,'I'),this.example(38,'AI')]);
    const turning='<p>Positive input height adds area; negative input height subtracts it. The accumulated curve turns where the input crosses zero.</p>'+strip([moved.stages[0],moved.stages[1],moved.stages[2]],['Original crossing','Crossing moved','High point moved'],[move('A'),move('I')])+compare('Move the rate’s zero. Move the amount’s peak.',[
      {label:'Original input',stage:signed.stages[1],before:signed.stages[1]},
      {label:'Raised input',stage:moved.stages[2],before:signed.stages[1]}
    ],[{index:2,x:'2'},{index:3,x:'3'}],['Original amount','New amount'])+'<p>Lifting the finished curve moves every height equally; it leaves the peak’s position unchanged.</p>';
    const reference=recall([37],'How accumulation starts',basics);
    if(!this.known.has(39))return '<h3>Choose where growth turns.</h3>'+turning+reference;
    const shaping=await this.example(39,'NAI');
    const signs='<p>A turned-and-raised bowl has two zero crossings. They divide the input into three regions: taking away, adding, then taking away again.</p>'+strip([shaping.stages[0],shaping.stages[2],shaping.stages[3]],['Bowl','Negative, positive, negative','Fall, rise, fall'],[move('N')+move('A'),move('I')])+'<p class="note-takeaway">Follow both zero crossings through the station: they become the amount’s low and high points. Plan these signs before fitting the final amount.</p>';
    if(!this.known.has(40))return '<h3>Shape the input. Shape what builds up.</h3>'+signs+recall([38],'Why the amount turns',turning)+reference;
    const [inputHalf,outputHalf]=await Promise.all([this.example(40,'HI'),this.example(40,'IH')]);
    const fitting='<p>Halving the input halves every bit of area. Halving the output gives exactly the same accumulated change.</p>'+compare('Does this order change the amount?',[
      {label:'Halve the input',stage:inputHalf.stages[2],before:signed.stages[1]},
      {label:'Halve the output',stage:outputHalf.stages[2],before:signed.stages[1]}
    ],[{index:0,x:'0'},{index:2,x:'2'}],['Original amount','Halved amount'])+'<p>A lift behaves differently: only a lift after the station chooses a nonzero starting amount.</p>'+lifts;
    if(!this.known.has(41))return '<h3>Change and starting amount are separate.</h3>'+fitting+recall([39],'Plan the input signs',signs)+reference;
    const recovery=await this.example(41,'DI');
    const rebuilding='<p>A slope remembers change, not the original starting height. Accumulating that slope rebuilds the shape from zero.</p>'+strip(recovery.stages,['Raised curve','Its slope','Change recovered'],[move('D'),move('I')]);
    if(!this.known.has(42))return '<h3>Recover what changed.</h3>'+rebuilding+recall([40],'Choose a starting amount',fitting)+reference;
    const starting=await this.example(42,'I');
    return '<h3>Design both sides of the machine.</h3><p>The starting bowl is never negative, so its accumulated amount keeps rising. The required heights rise, fall, then rise. Which input signs would create those changes?</p>'+strip([starting.stages[1]],['Starting amount and required heights'],[],false,starting.checkpoints)+'<p class="note-takeaway">First plan the input’s signs and zeros. Then fit how much accumulates, and place the output’s starting height.</p>'+recall([39],'Connect input signs to rises and falls',signs)+recall([40],'Scaling and starting amount',fitting)+recall([41],'Recover a curve from its slope',rebuilding)+reference;
  }
}
