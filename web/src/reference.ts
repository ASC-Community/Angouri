import type { Result } from './types';
import { heightAtFormula, rationalTex, tex } from './views';
import { circleSketch, compare, diagramChoices, lesson, move, recall, relationSketch, strip, viewButton } from './note-diagrams';

export interface ReferenceExamples {
  example(sourceId:number,ops:string):Promise<Result>;
  circleExample(x:string,y:string,radius:string,goals?:string[][]):Promise<Result>;
}

const tag=(source:number)=>`<p class="note-reference" data-reference-lesson="${source}">${lesson(source)}</p>`;
const markers=(...sources:number[])=>sources.map(source=>`<span data-reference-lesson="${source}" hidden></span>`).join('');
const current=(title:string,body:string)=>`<h3>${title}</h3>${body}`;

export async function renderReference(topic:number,known:Set<number>,examples:ReferenceExamples,{focused=false}:{focused?:boolean}={}):Promise<string> {
  // Select the body before it requests examples. Focused lessons link to their
  // prerequisites separately; complete chapter references retain their recalls.
  if(topic===0)return heightReference(known,examples,focused);
  if(topic===1)return reflectionReference(known,examples,focused);
  if(topic===2)return squareReference(known,examples,focused);
  if(topic===3)return powerReference(known,examples,focused);
  if(topic===4)return slopeReference(known,examples,focused);
  if(topic===5)return areaReference(known,examples,focused);
  if(topic===6) {
    if(!known.has(48))return circleReference(known,examples,focused);
    return await relationReference(known,examples,focused)+(focused?'':recall([43,44],'Centre and reach',await circleReference(known,examples,false)));
  }
  if(topic===7)return waveReference(known,examples,focused);
  if(topic===8)return stepReference(known,examples,focused);
  return togetherReference(known,examples,focused);
}

async function heightReference(known:Set<number>,examples:ReferenceExamples,focused:boolean) {
  const sample={
    base:()=>examples.example(50,''),
    half:()=>examples.example(50,'H'),
    doubleHalf:()=>examples.example(50,'HH'),
    lift:()=>examples.example(50,'A'),
    liftHalf:()=>examples.example(50,'AH'),
    halfLift:()=>examples.example(50,'HA'),
    quarterLift:()=>examples.example(50,'AHH')
  };
  const scaling=async()=>{
    const [base,half]=await Promise.all([sample.base(),sample.half()]);
    return '<p>Halving divides every height by two and keeps every zero fixed.</p>'+strip([base.stages[0],half.stages.at(-1)!],['Input height','Halved height'],[move('H')])+tag(1);
  };
  const lifting=async()=>{
    const [base,lift]=await Promise.all([sample.base(),sample.lift()]);
    return '<p>Adding one raises every height equally. Differences between two heights stay unchanged. Here '+tex('u')+' and '+tex('v')+' are the incoming heights at two fixed positions.</p>'+strip([base.stages[0],lift.stages.at(-1)!],['Input height','Raised height'],[move('A')])+`<p>The added units cancel in the height difference: ${tex('(v+1)-(u+1)=v-u')}.</p>`+tag(2);
  };
  const ordering=async()=>{
    const [liftHalf,base,halfLift]=await Promise.all([sample.liftHalf(),sample.base(),sample.halfLift()]);
    return '<p>Operations are read from left to right. A later halve also halves every earlier lift. Here '+tex('u')+' is the incoming height at one position.</p>'+compare('Same blocks. Different results.',[
    {label:'Lift, then halve',stage:liftHalf.stages.at(-1)!,before:base.stages[0]},
    {label:'Halve, then lift',stage:halfLift.stages.at(-1)!,before:base.stages[0]}
  ])+`<p>The two orders give ${tex('\\frac{u+1}{2}')} and ${tex('\\frac u2+1')}: the first adds half a unit, the second a whole unit.</p>`+(known.has(25)?'':`<p>${viewButton('function')} compares the resulting heights at the same positions.</p>`)+tag(3);
  };
  const pieces=async()=>{
    const [liftHalf,half,quarterLift,doubleHalf]=await Promise.all([sample.liftHalf(),sample.half(),sample.quarterLift(),sample.doubleHalf()]);
    return '<p>A lift contributes less when more halves follow it.</p>'+compare('How much of the lift remains?',[
    {label:'One later halve',stage:liftHalf.stages.at(-1)!,before:half.stages.at(-1)!},
    {label:'Two later halves',stage:quarterLift.stages.at(-1)!,before:doubleHalf.stages.at(-1)!}
  ])+`<p>For incoming height ${tex('u')}, one later halve leaves ${tex('\\frac{u+1}{2}-\\frac u2=\\frac12')} of the lift; two leave ${tex('\\frac{u+1}{4}-\\frac u4=\\frac14')}.</p>`+(known.has(25)?'':`<p>Use ${viewButton('flow')} to trace the lift through later blocks, or ${viewButton('function')} to compare the final heights.</p>`)+tag(24);
  };
  const measurements=async()=>{
    const [lift,base,half]=await Promise.all([sample.lift(),sample.base(),sample.half()]);
    return '<p>A lift changes vertical placement but preserves every height difference. A halve scales every height and height difference.</p>'+compare('Vertical shift or scale change?',[
    {label:'Raised',stage:lift.stages.at(-1)!,before:base.stages[0]},
    {label:'Halved',stage:half.stages.at(-1)!,before:base.stages[0]}
  ])+`<p>For heights ${tex('u')} and ${tex('v')} at two fixed positions, a lift cancels from their difference: ${tex('(v+1)-(u+1)=v-u')}. A halve also halves it: ${tex('\\frac v2-\\frac u2=\\frac{v-u}{2}')}.</p><p>${viewButton('function')} compares exact heights and their signed difference. ${viewButton('flow')} follows the same values through each operation.</p>`+tag(25);
  };
  if(known.has(25))return current('Vertical placement and height difference are separate.',await measurements())+(focused?'':recall([24],'Fractional lift contributions',await pieces())+recall([3],'Why order matters',await ordering())+recall([1,2],'Scale and lift',await scaling()+await lifting()));
  if(known.has(24))return current('A lift can contribute a fraction.',await pieces())+(focused?'':recall([3],'Why order matters',await ordering())+recall([1,2],'Scale and lift',await scaling()+await lifting()));
  if(known.has(3))return current('Order changes the result.',await ordering())+(focused?'':recall([2],'Uniform lifting',await lifting())+recall([1],'Uniform scaling',await scaling()));
  if(known.has(2))return current('A lift raises every height.',await lifting())+(focused?'':recall([1],'Halving every height',await scaling()));
  return current('Halving scales every height.',await scaling());
}

async function reflectionReference(known:Set<number>,examples:ReferenceExamples,focused:boolean) {
  const sample={
    base:()=>examples.example(50,''),
    turned:()=>examples.example(50,'N'),
    turnedRaised:()=>examples.example(50,'NA'),
    raisedTurned:()=>examples.example(50,'AN'),
    smallerTurned:()=>examples.example(50,'HN'),
    bowl:async()=>known.has(8)?await examples.example(8,'HNA'):undefined
  };
  const signs=async()=>{
    const [base,turned]=await Promise.all([sample.base(),sample.turned()]);
    return '<p>Negation changes every sign and keeps zeros fixed.</p>'+strip([base.stages[0],turned.stages.at(-1)!],['Input height','Negated height'],[move('N')])+`<p>For input heights ${tex('u')} and ${tex('v')}, negating both reverses their signed difference: ${tex('(-v)-(-u)=-(v-u)')}. ${viewButton('function')} compares that gap at fixed positions.</p>`+tag(6);
  };
  const orientation=async()=>{
    // Halve the supplied bowl so the reference has a different depth from play.
    const bowl=await sample.bowl();
    return bowl?'<p>Negate turns a bowl into a roof. Add one then raises every height equally, keeping the roof’s shape.</p>'+compare('Compare the two changes.',[
    {label:'Negate',stage:bowl.stages[2],before:bowl.stages[1],description:'The heights change sign. The bottom becomes a peak at the same horizontal position.'},
    {label:'Then Add one',stage:bowl.stages[3],before:bowl.stages[2],description:'Every height rises by one. The peak stays above the same position.'}
  ])+`<p>To follow these changes in your own recipe, use ${viewButton('flow')} to compare the curve before and after each block.</p>`+tag(8):'';
  };
  const size=async()=>{
    const [turned,base,smallerTurned]=await Promise.all([sample.turned(),sample.base(),sample.smallerTurned()]);
    return '<p>Scaling changes distance from the zero line. Negation changes its side. These effects are independent.</p>'+compare('Change size or side?',[
    {label:'Turned',stage:turned.stages.at(-1)!,before:base.stages[0]},
    {label:'Smaller and turned',stage:smallerTurned.stages.at(-1)!,before:base.stages[0]}
  ])+`<p>For incoming height ${tex('u')}, either order gives the same result: ${tex('-\\frac u2=\\frac{-u}{2}')}.</p>`+tag(9);
  };
  const offset=async()=>{
    const [raisedTurned,base,turnedRaised]=await Promise.all([sample.raisedTurned(),sample.base(),sample.turnedRaised()]);
    return '<p>An existing offset is negated when it enters negation. A lift after negation is not the same operation order.</p>'+compare('Where does the lift act?',[
    {label:'Lift, then negate',stage:raisedTurned.stages.at(-1)!,before:base.stages[0]},
    {label:'Negate, then lift',stage:turnedRaised.stages.at(-1)!,before:base.stages[0]}
  ])+`<p>For incoming height ${tex('u')}, lifting first gives ${tex('-(u+1)=-u-1')}; lifting last gives ${tex('-u+1')}.</p>`+tag(26);
  };
  if(known.has(26))return current('Reflection includes every existing offset.',await offset())+(focused?'':recall([9],'Size and orientation',await size())+recall([8],'Turning and vertical placement',await orientation())+recall([6],'Sign reversal',await signs()));
  if(known.has(9))return current('Scale and reflection have separate effects.',await size())+(focused?'':recall([8],'Turning and vertical placement',await orientation())+recall([6],'Sign reversal',await signs()));
  if(known.has(8))return current('Negate turns. Add one lifts.',await orientation())+(focused?'':recall([6],'Sign reversal',await signs()));
  return current('Reflection reverses signs.',await signs());
}

async function squareReference(known:Set<number>,examples:ReferenceExamples,focused:boolean) {
  const sample={
    shifted:()=>examples.example(4,'A'),
    squared:()=>examples.example(4,'AQ'),
    halfBefore:()=>examples.example(4,'AHQ'),
    halfAfter:()=>examples.example(4,'AQH'),
    reflected:()=>examples.example(4,'AQN'),
    raised:()=>examples.example(4,'AQA'),
    centred:()=>examples.example(50,'Q'),
    moved:()=>examples.example(50,'AQ')
  };
  const folding=async()=>{
    const [shifted,squared]=await Promise.all([sample.shifted(),sample.squared()]);
    return '<p>Squaring makes opposite heights agree and keeps zero fixed.</p>'+strip([shifted.stages.at(-1)!,squared.stages.at(-1)!],['Offset line','Squared height'],[move('Q')])+`<p>For any incoming height ${tex('u')}, ${tex('u^2=(-u)^2')}: the original sign no longer matters.</p>`+tag(7);
  };
  const order=async()=>{
    const [halfBefore,shifted,halfAfter]=await Promise.all([sample.halfBefore(),sample.shifted(),sample.halfAfter()]);
    return '<p>A scale before squaring is squared too. A scale afterward acts only once.</p>'+compare('Where does the halve act?',[
    {label:'Halve, then square',stage:halfBefore.stages.at(-1)!,before:shifted.stages.at(-1)!},
    {label:'Square, then halve',stage:halfAfter.stages.at(-1)!,before:shifted.stages.at(-1)!}
  ])+`<p>For incoming height ${tex('u')}, halving first gives ${tex('\\left(\\frac u2\\right)^2=\\frac{u^2}{4}')}; halving last gives ${tex('\\frac{u^2}{2}')}.</p>`+tag(10);
  };
  const composition=async()=>{
    const [reflected,squared,raised]=await Promise.all([sample.reflected(),sample.squared(),sample.raised()]);
    return '<p>The output of one relationship is the input to the next. Squaring sets a nonnegative shape; output negation or output lifting changes that shape in a different way.</p>'+compare('Same squared input. Different output change.',[
    {label:'Negated square',stage:reflected.stages.at(-1)!,before:squared.stages.at(-1)!},
    {label:'Raised square',stage:raised.stages.at(-1)!,before:squared.stages.at(-1)!}
  ])+tag(4);
  };
  const zero=async()=>{
    const [centred,moved]=await Promise.all([sample.centred(),sample.moved()]);
    return '<p>The input’s zero sets the bowl’s bottom. Lifting the line before Square can move that zero sideways. Lifting after Square moves the bowl vertically while its bottom stays at the same horizontal position.</p>'+compare('Where is the fold?',[
    {label:'Unshifted input',stage:centred.stages.at(-1)!,before:centred.stages[0]},
    {label:'Shifted input',stage:moved.stages.at(-1)!,before:centred.stages[0]}
  ])+tag(27);
  };
  const landmarks=async()=>{
    const [reflected,squared,raised]=await Promise.all([sample.reflected(),sample.squared(),sample.raised()]);
    return '<p>Input changes determine where a fold occurs. Output reflection and output lifting preserve that horizontal position.</p>'+compare('One fold, two output changes.',[
    {label:'Reflected output',stage:reflected.stages.at(-1)!,before:squared.stages.at(-1)!},
    {label:'Raised output',stage:raised.stages.at(-1)!,before:squared.stages.at(-1)!}
  ])+`<p>${viewButton('flow')} shows which side of the square each change belongs to.</p>`+tag(28);
  };
  if(known.has(28))return current('Input landmarks survive later output changes.',await landmarks())+(focused?'':recall([27],'The input zero sets the fold',await zero())+recall([4],'Composing relationships',await composition())+recall([10,7],'Square and scale',await order()+await folding()));
  if(known.has(27))return current('The input zero sets the fold.',await zero())+(focused?'':recall([4],'Composing relationships',await composition())+recall([10,7],'Square and scale',await order()+await folding()));
  if(known.has(4))return current('One relationship can feed another.',await composition())+(focused?'':recall([10],'Scale before or after squaring',await order())+recall([7],'Opposite heights meet',await folding()));
  if(known.has(10))return current('Order changes the result of scaling and squaring.',await order())+(focused?'':recall([7],'Opposite heights meet',await folding()));
  return current('Squaring folds heights around zero.',await folding());
}

async function powerReference(known:Set<number>,examples:ReferenceExamples,focused:boolean) {
  // Use u=x/4 instead of the active puzzles' centred input. Every power spans
  // zero to one over the same four-unit domain, so higher powers stay visible.
  const sample={
    small:()=>examples.example(50,'HH'),
    second:()=>examples.example(50,'HHQ'),
    fourth:()=>examples.example(50,'HHQQ'),
    eighth:()=>examples.example(50,'HHQQQ'),
    sixth:()=>examples.example(64,'HHHHHHQ'),
    raised:()=>examples.example(50,'HHA'),
    raisedSquared:()=>examples.example(50,'HHAQ'),
    negatedFourth:()=>examples.example(50,'HHQQN'),
    negatedSixth:()=>examples.example(64,'HHHHHHQN')
  };
  const flatter=async()=>{
    const [second,fourth]=await Promise.all([sample.second(),sample.fourth()]);
    return '<p>Magnitude means distance from zero; '+tex('|u|')+' is the magnitude of '+tex('u')+'. For magnitudes between zero and one, squaring moves heights closer to zero while keeping zero and one fixed.</p>'+strip([second.stages.at(-1)!,fourth.stages.at(-1)!],['Squared input','Squared again'],[move('Q')])+`<p>${tex('0<|u|<1\\;\\Longrightarrow\\;u^2<|u|')}</p>`+tag(12);
  };
  const orientation=async()=>{
    const [fourth,negatedFourth]=await Promise.all([sample.fourth(),sample.negatedFourth()]);
    return '<p>An even power supplies a nonnegative shape. Negation reverses that shape without changing its zeros.</p>'+strip([fourth.stages.at(-1)!,negatedFourth.stages.at(-1)!],['Even power','Negated even power'],[move('N')])+tag(13);
  };
  const families=async()=>{
    const [second,small,fourth,sixth]=await Promise.all([sample.second(),sample.small(),sample.fourth(),sample.sixth()]);
    return `<p>This reference uses the line ${tex('u=x/4')}. Its even powers keep the same zero and unit height, with different heights between them.</p>`+compare('Same zero and unit height. Different powers.',[
    {label:'Second power',stage:second.stages.at(-1)!,before:small.stages.at(-1)!},
    {label:'Fourth power',stage:fourth.stages.at(-1)!,before:small.stages.at(-1)!},
    {label:'Sixth power',stage:sixth.stages.at(-1)!,before:sixth.stages.at(-2)!}
  ])+`<p>For incoming height ${tex('u')}, squaring a cube gives ${tex('(u^3)^2=u^6')}; squaring a square gives ${tex('(u^2)^2=u^4')}.</p>`+tag(29);
  };
  const reuse=async()=>{
    const [sixth,negatedSixth]=await Promise.all([sample.sixth(),sample.negatedSixth()]);
    return '<p>Higher even powers keep the same sign and zeros. Reflection changes orientation without changing those horizontal landmarks.</p>'+compare('Power landmarks survive reflection.',[
    {label:'Sixth power',stage:sixth.stages.at(-1)!,before:sixth.stages.at(-2)!},
    {label:'Reflected sixth power',stage:negatedSixth.stages.at(-1)!,before:sixth.stages.at(-1)!}
  ])+tag(30);
  };
  const fitting=async()=>{
    const [second,small,raisedSquared,raised,fourth,eighth]=await Promise.all([sample.second(),sample.small(),sample.raisedSquared(),sample.raised(),sample.fourth(),sample.eighth()]);
    return '<p>Squaring shrinks magnitudes below one and grows magnitudes above one.</p>'+compare('Below one or above one?',[
    {label:'Scaled input',stage:second.stages.at(-1)!,before:small.stages.at(-1)!},
    {label:'Raised input',stage:raisedSquared.stages.at(-1)!,before:raised.stages.at(-1)!}
  ])+`<p>Here ${tex('|u|')} is the input’s distance from zero: ${tex('0<|u|<1\\Rightarrow u^2<|u|')}, while ${tex('|u|>1\\Rightarrow u^2>|u|')}.</p>`+compare('Repeated squares add higher even powers.',[
    {label:'Second power',stage:second.stages.at(-1)!,before:small.stages.at(-1)!},
    {label:'Fourth power',stage:fourth.stages.at(-1)!,before:small.stages.at(-1)!},
    {label:'Eighth power',stage:eighth.stages.at(-1)!,before:small.stages.at(-1)!}
  ])+tag(31);
  };
  const choice=async()=>{
    const [second,small,fourth,eighth]=await Promise.all([sample.second(),sample.small(),sample.fourth(),sample.eighth()]);
    return '<p>Repeated squares preserve zero and one while changing intermediate heights. Each additional square produces a distinct even-power silhouette.</p>'+compare('Compare repeated powers.',[
    {label:'Second power',stage:second.stages.at(-1)!,before:small.stages.at(-1)!},
    {label:'Fourth power',stage:fourth.stages.at(-1)!,before:small.stages.at(-1)!},
    {label:'Eighth power',stage:eighth.stages.at(-1)!,before:small.stages.at(-1)!}
  ])+tag(11);
  };
  if(known.has(11))return current('Repeated squaring creates a family of shapes.',await choice())+(focused?'':recall([31],'Below and above one',await fitting())+recall([29,30],'Even-power silhouettes',await families()+await reuse())+recall([12,13],'Squaring and orientation',await flatter()+await orientation()));
  if(known.has(31))return current('One is the dividing height for squaring.',await fitting())+(focused?'':recall([30],'Orientation keeps power landmarks',await reuse())+recall([29],'Power families',await families())+recall([12,13],'Squaring and orientation',await flatter()+await orientation()));
  if(known.has(30))return current('Even-power landmarks survive reflection.',await reuse())+(focused?'':recall([29],'Power families',await families())+recall([12,13],'Squaring and orientation',await flatter()+await orientation()));
  if(known.has(29))return current('The input power changes the output silhouette.',await families())+(focused?'':recall([13],'Orientation of an even power',await orientation())+recall([12],'What squaring keeps',await flatter()));
  if(known.has(13))return current('An even power can be reoriented.',await orientation())+(focused?'':recall([12],'What squaring keeps',await flatter()));
  return current('Squaring changes heights between zero and one.',await flatter());
}

async function slopeReference(known:Set<number>,examples:ReferenceExamples,focused:boolean) {
  const sample={
    line:()=>examples.example(50,''),
    slope:()=>examples.example(50,'D'),
    liftBefore:()=>examples.example(50,'AD'),
    liftAfter:()=>examples.example(50,'DA'),
    bowlSlope:()=>examples.example(50,'NAQD'),
    movedSlope:()=>examples.example(50,'NAAQD'),
    waveSlope:()=>examples.example(4,'AHQNAQD')
  };
  const reading=async()=>{
    const [line,slope]=await Promise.all([sample.line(),sample.slope()]);
    return '<p>A tangent is a straight line matching the curve’s direction at one position. Its slope is signed rise divided by horizontal run. The derivative uses that slope as the new height: downhill is negative, flat is zero and uphill is positive.</p>'+strip([line.stages[0],slope.stages.at(-1)!],['Input curve','Slope output'],[move('D')])+`<p>${viewButton('flow')} shows the incoming tangent at the inspected position.</p>`+tag(32);
  };
  const sides=async()=>{
    const [liftBefore,slope,liftAfter]=await Promise.all([sample.liftBefore(),sample.slope(),sample.liftAfter()]);
    return '<p>A lift before differentiation does not change slope. A lift after differentiation raises the slope output.</p>'+compare('Which side receives the lift?',[
    {label:'Lift input',stage:liftBefore.stages.at(-1)!,before:slope.stages.at(-1)!},
    {label:'Lift output',stage:liftAfter.stages.at(-1)!,before:slope.stages.at(-1)!}
  ])+`<p>Writing the incoming height as ${tex('u')}, the input lift disappears: ${tex('\\frac{\\mathrm d}{\\mathrm dx}(u+1)=\\frac{\\mathrm du}{\\mathrm dx}')}.</p>`;
  };
  const turning=async()=>{
    const [bowlSlope]=await Promise.all([sample.bowlSlope()]);
    return '<p>A squared line has a changing slope. Its flat point becomes a zero of the derivative.</p>'+strip([bowlSlope.stages.at(-2)!,bowlSlope.stages.at(-1)!],['Squared line','Slope'],[move('D')])+tag(33);
  };
  const moving=async()=>{
    const [bowlSlope,movedSlope]=await Promise.all([sample.bowlSlope(),sample.movedSlope()]);
    return '<p>Changing the input zero before squaring moves the flat point and therefore moves the derivative’s zero.</p>'+compare('Where is the slope zero?',[
    {label:'Unshifted fold',stage:bowlSlope.stages.at(-1)!,before:bowlSlope.stages.at(-2)!},
    {label:'Shifted fold',stage:movedSlope.stages.at(-1)!,before:movedSlope.stages.at(-2)!}
  ])+tag(34);
  };
  const several=async()=>{
    const [waveSlope]=await Promise.all([sample.waveSlope()]);
    return '<p>Every smooth flat place becomes a derivative zero. A zero may mark a turn or a momentary flattening.</p>'+strip([waveSlope.stages.at(-2)!,waveSlope.stages.at(-1)!],['Several flat places','Derivative zeros'],[move('D')])+tag(35);
  };
  const roles=async()=>{
    return '<p>Input blocks change the slopes read by the station. Output blocks change the resulting heights.</p>'+await sides()+tag(36);
  };
  if(known.has(36))return current('The two sides of differentiation have different jobs.',await roles())+(focused?'':recall([35],'Flat places become zeros',await several())+recall([34],'Moving a flat place',await moving())+recall([33],'Changing slope',await turning())+recall([32],'Reading slope',await reading()));
  if(known.has(35))return current('A derivative can have several zeros.',await several())+(focused?'':recall([34],'Moving a flat place',await moving())+recall([33],'Changing slope',await turning())+recall([32],'Reading slope',await reading()+await sides()));
  if(known.has(34))return current('Moving a flat place moves a derivative zero.',await moving())+(focused?'':recall([33],'Changing slope',await turning())+recall([32],'Reading slope',await reading()+await sides()));
  if(known.has(33))return current('Curvature makes slope change.',await turning())+(focused?'':recall([32],'Reading slope',await reading()+await sides()));
  return current('Slope becomes height.',await reading()+await sides());
}

async function areaReference(known:Set<number>,examples:ReferenceExamples,focused:boolean) {
  const sample={
    line:()=>examples.example(50,''),
    area:()=>examples.example(50,'I'),
    inputLift:()=>examples.example(50,'AI'),
    outputLift:()=>examples.example(50,'IA'),
    inputHalf:()=>examples.example(50,'HI'),
    outputHalf:()=>examples.example(50,'IH'),
    crossing:()=>examples.example(4,'HI'),
    movedCrossing:()=>examples.example(4,'HAI'),
    signed:()=>examples.example(4,'QHNAI'),
    recovered:()=>examples.example(50,'ADI')
  };
  const basics=async()=>{
    const [line,area]=await Promise.all([sample.line(),sample.area()]);
    return '<p>Accumulation adds signed area from zero to the inspected position. Its own output starts at zero. In these formulas, '+tex('u(t)')+' is the incoming height at horizontal position '+tex('t')+'.</p>'+strip([line.stages[0],area.stages.at(-1)!],['Input height','Accumulated area'],[move('I')])+`<p>The total is ${tex('\\int_0^x u(t)\\,\\mathrm dt')}. Use ${viewButton('flow')} to see which areas add and which subtract.</p>`+tag(37);
  };
  const turning=async()=>{
    const [crossing,movedCrossing]=await Promise.all([sample.crossing(),sample.movedCrossing()]);
    return '<p>Positive input makes the total rise; negative input makes it fall. An input zero is where growth can change direction.</p>'+compare('Move the input zero.',[
    {label:'Original input',stage:crossing.stages.at(-1)!,before:crossing.stages.at(-2)!},
    {label:'Raised input',stage:movedCrossing.stages.at(-1)!,before:movedCrossing.stages.at(-2)!}
  ])+tag(38);
  };
  const signs=async()=>{
    const [signed]=await Promise.all([sample.signed()]);
    return '<p>Several sign regions produce alternating rise and fall in one continuous accumulated curve.</p>'+strip([signed.stages.at(-2)!,signed.stages.at(-1)!],['Signed input','Continuous total'],[move('I')])+tag(39);
  };
  const scale=async()=>{
    const [inputHalf,line,outputHalf]=await Promise.all([sample.inputHalf(),sample.line(),sample.outputHalf()]);
    return '<p>Halving either side halves the accumulated change because integration is linear.</p>'+compare('Halve input or output?',[
    {label:'Halve input',stage:inputHalf.stages.at(-1)!,before:line.stages[0]},
    {label:'Halve output',stage:outputHalf.stages.at(-1)!,before:line.stages[0]}
  ])+`<p>For input height ${tex('u(t)')} at position ${tex('t')}, both orders agree: ${tex('\\int_0^x \\frac{u(t)}2\\,\\mathrm dt=\\frac12\\int_0^x u(t)\\,\\mathrm dt')}.</p>`;
  };
  const baseline=async()=>{
    const [inputLift,area,outputLift]=await Promise.all([sample.inputLift(),sample.area(),sample.outputLift()]);
    return '<p>A lift after accumulation changes the starting amount. A lift before accumulation changes the rate everywhere.</p>'+compare('Rate change or starting amount?',[
    {label:'Lift input',stage:inputLift.stages.at(-1)!,before:area.stages.at(-1)!},
    {label:'Lift output',stage:outputLift.stages.at(-1)!,before:area.stages.at(-1)!}
  ])+tag(40);
  };
  const recovery=async()=>{
    const [recovered]=await Promise.all([sample.recovered()]);
    return '<p>Differentiation removes a constant offset. Accumulating the derivative rebuilds the change from zero.</p>'+strip(recovered.stages.slice(1),['Raised line','Slope','Recovered change'],[move('D'),move('I')])+`<p>If ${tex('u')} is the original height, accumulation recovers its change: ${tex('\\int_0^x \\frac{\\mathrm du}{\\mathrm dt}\\,\\mathrm dt=u(x)-u(0)')}.</p>`+tag(41);
  };
  const roles=async()=>{
    return '<p>Input signs control where the accumulated result rises or falls. Output scaling and lifting control its size and starting height.</p>'+await scale()+tag(42);
  };
  if(known.has(42))return current('Input shape and output placement are separate.',await roles())+(focused?'':recall([41],'Recovering change',await recovery())+recall([40],'Scale and starting amount',await scale()+await baseline())+recall([39,38],'Signs and turning',await signs()+await turning())+recall([37],'Anchored accumulation',await basics()));
  if(known.has(41))return current('Accumulated slope recovers change from zero.',await recovery())+(focused?'':recall([40],'Scale and starting amount',await scale()+await baseline())+recall([39,38],'Signs and turning',await signs()+await turning())+recall([37],'Anchored accumulation',await basics()));
  if(known.has(40))return current('Change and starting amount are separate.',await scale()+await baseline())+(focused?'':recall([39],'Several sign regions',await signs())+recall([38],'Input zeros and turns',await turning())+recall([37],'Anchored accumulation',await basics()));
  if(known.has(39))return current('Signed regions can alternate growth and decline.',await signs())+(focused?'':recall([38],'Input zeros and turns',await turning())+recall([37],'Anchored accumulation',await basics()));
  if(known.has(38))return current('The input sign controls growth.',await turning())+(focused?'':recall([37],'Anchored accumulation',await basics()));
  return current('Area becomes accumulated height.',await basics());
}

async function circleReference(known:Set<number>,examples:ReferenceExamples,focused:boolean) {
  const sample={
    small:()=>examples.circleExample('1','1','3/4'),
    large:()=>examples.circleExample('1','1','5/4'),
    moved:()=>examples.circleExample('2','1','5/4')
  };
  const circle=async()=>{
    const [small,large]=await Promise.all([sample.small(),sample.large()]);
    return '<p>Between its left and right edges, a circle has an upper and a lower height at each position. They meet at the edges; beyond them there is no height on the circle. Every point stays one radius from its centre.</p>'+diagramChoices('One centre. Two radii.',[
    {label:'Smaller radius',html:circleSketch([small],{centre:true,spoke:true,bounds:[-1,3,-1,3]})},
    {label:'Larger radius',html:circleSketch([small,large],{centre:true,spoke:true,bounds:[-1,3,-1,3]})}
  ])+`<p>${tex('(x-a)^2+(h-b)^2=r^2')}</p><p>${tex('(a,b)')} is the centre; ${tex('r')} is the distance from the centre to the circle.</p>`+tag(43);
  };
  const centre=async()=>{
    const [large,moved]=await Promise.all([sample.large(),sample.moved()]);
    return '<p>Changing the centre translates the whole circle. Changing the radius changes its reach.</p>'+diagramChoices('Translate or resize?',[
    {label:'Original centre',html:circleSketch([large],{centre:true,spoke:true,bounds:[-1,4,-1,3]})},
    {label:'Moved centre',html:circleSketch([large,moved],{centre:true,spoke:true,bounds:[-1,4,-1,3]})}
  ])+tag(44);
  };
  const diameterTargets:[[number,number],[number,number]]=[[0,.25],[2,1.75]];
  const diameter=async()=>{
    const large=await sample.large();
    return '<p>The midpoint of a diameter is the centre. Half its length is the radius, including for a diagonal diameter.</p>'+circleSketch([large],{centre:true,triangle:true,diameter:true,targets:diameterTargets,bounds:[-1,3,-1,3]})+`<p>${tex('(\\Delta x)^2+(\\Delta h)^2=(2r)^2')}</p>`+tag(45);
  };
  const targets:[number,number][]=[[1,2.25],[2.25,1],[1,-.25]];
  const bisectors=async()=>{
    const large=await sample.large();
    return diagramChoices('How many centres remain possible?',[
    {label:'One target pair',html:circleSketch([],{targets,pairs:[[0,1]],bounds:[-1,3,-1,3]})},
    {label:'Two target pairs',html:circleSketch([large],{targets,pairs:[[0,1],[1,2]],centre:true,bounds:[-1,3,-1,3]})}
  ]);
  };
  const pair=async()=>{
    return '<p>A perpendicular bisector crosses the segment between two targets at its midpoint and at a right angle. Every point on it is equally far from that pair. Two independent bisectors meet at a circle centre.</p>'+await bisectors()+tag(46);
  };
  const constellation=async()=>{
    return '<p>Equal distance is the common test for every target in a circle. Different pairs provide independent constraints on the same centre.</p>'+await bisectors()+`<p>${viewButton('function')} compares squared distances; ${viewButton('flow')} shows the selected pair and its bisector.</p>`+tag(47);
  };
  if(known.has(47))return current('Several pairs constrain one centre.',await constellation())+(focused?'':recall([46],'Perpendicular bisectors',await pair())+recall([45],'Diameter and midpoint',await diameter())+recall([44,43],'Centre and radius',await centre()+await circle()));
  if(known.has(46))return current('Two bisectors locate a centre.',await pair())+(focused?'':recall([45],'Diameter and midpoint',await diameter())+recall([44,43],'Centre and radius',await centre()+await circle()));
  if(known.has(45))return current('A diameter reveals centre and radius.',await diameter())+(focused?'':recall([44],'Translating a circle',await centre())+recall([43],'One centre and one radius',await circle()));
  if(known.has(44))return current('Centre and radius change different properties.',await centre())+(focused?'':recall([43],'One centre and one radius',await circle()));
  return current('A circle keeps one distance.',await circle());
}

async function relationReference(known:Set<number>,examples:ReferenceExamples,focused:boolean) {
  const equation=async()=>{
    const base=await examples.example(68,'HH');
    return '<p>The right side is squared height. At each position, a positive value gives two heights, zero gives one, and a negative value gives no real height. The upper and lower parts are called branches. At one position, call the right-side value '+tex('a')+'.</p>'+relationSketch(base,'One equation, both heights',{before:base,bounds:[0,4,-2,2]})+`<p>${tex('h^2=a')} ${tex('\\Longrightarrow')} ${tex('h=\\pm\\sqrt a\\quad(a\\ge0)')}</p>`+tag(48);
  };
  const growth=async()=>{
    const [base,lift]=await Promise.all(['HH','HHA'].map(ops=>examples.example(68,ops)));
    const diagram=(result:Result,label:string)=>relationSketch(result,label,{before:base,bounds:[0,4,-2,2]});
    return '<p>Adding one on the right increases squared height. The upper branch rises and the lower branch falls; the middle stays fixed. The change in height is not one.</p>'+diagramChoices('The same centre line, a different reach.',[{label:'Before',html:diagram(base,'Before')},{label:'Add one',html:diagram(lift,'Add to squared height')}])+tag(68);
  };
  const scale=async()=>{
    const [base,half,quarter]=await Promise.all(['HH','HHH','HHHH'].map(ops=>examples.example(68,ops)));
    const diagram=(result:Result,label:string)=>relationSketch(result,label,{before:base,bounds:[0,4,-2,2]});
    return '<p>Halving squared height scales each height by the square root of one half. Two halves of squared height make one half of height. The horizontal zeros stay fixed.</p>'+diagramChoices('One halve or two?',[
    {label:'Before',html:diagram(base,'Before')},{label:'One halve',html:diagram(half,'Heights scale by one over the square root of two')},{label:'Two halves',html:diagram(quarter,'Heights are halved')}
  ])+`<p>${tex('h^2=a/4\\quad\\Longrightarrow\\quad h=\\pm\\sqrt a/2')}</p>`+tag(69);
  };
  const regions=async()=>{
    const [base,turned]=await Promise.all(['HH','HHN'].map(ops=>examples.example(68,ops)));
    const diagram=(result:Result,label:string)=>relationSketch(result,label,{before:base,bounds:[0,4,-2,2]});
    return '<p>Negation exchanges the positive and negative regions of the right side. A height can exist only in a nonnegative region. It does not simply turn the visible loop upside down.</p>'+diagramChoices('Change the sign. Change where heights exist.',[{label:'Before',html:diagram(base,'Heights inside the zeros')},{label:'Negate',html:diagram(turned,'Heights outside the zeros')}])+tag(70);
  };
  const magnitudes=async()=>{
    const [roundedRoof,pointedRoof]=await Promise.all([examples.example(66,'H'),examples.example(66,'HQ')]);
    return '<p>This half-height roof is nonnegative. With that roof on the right, solving takes a square root and the branches have rounded ends. Squaring the roof first makes the solved heights positive and negative copies of it, so they meet in pointed ends.</p>'+diagramChoices('Same roof. Rounded or pointed ends.',[
    {label:'Roof',html:relationSketch(roundedRoof,'Square-root branches have rounded ends.')},
    {label:'Roof squared',html:relationSketch(pointedRoof,'Copied roof branches meet in points.',{before:roundedRoof})}
  ])+`<p>${tex('h^2=a\\ \\Longrightarrow\\ h=\\pm\\sqrt a')} ${tex('\\qquad')} ${tex('h^2=a^2\\ \\Longrightarrow\\ h=\\pm a\\quad(a\\ge0)')}</p>`+tag(66);
  };
  const geometry=async()=>'<p>The zeros of a circular roof locate the loop’s horizontal edges. Its maximum is the squared radius. Scaling height while keeping those zeros creates a different loop, rather than simply resizing a circle.</p>'+tag(49);
  const translation=async()=>{
    const [centred,shifted]=await Promise.all([examples.example(48,'QNA'),examples.example(48,'NAQNA')]);
    return '<p>The zero of the expression entering Square becomes the roof’s centre. Moving that zero moves both branches sideways. Adding to the finished squared height changes the reach above and below; it does not move the centre sideways.</p>'+diagramChoices('Move the centre through the input.',[
      {label:'Original zero',html:relationSketch(centred,'A reference loop centred at two.')},
      {label:'Shifted zero',html:relationSketch(shifted,'A reference loop centred at three.',{before:centred})}
    ])+tag(78);
  };
  const synthesis=async()=>'<p>Several visible pieces may come from one signed shape. Track its zeros, its scale, and which operation makes negative regions visible again.</p>'+tag(71);
  const lessons:[number,string,()=>Promise<string>][]=[[48,'Positive, zero or negative',equation],[78,'Move the zero, move the loop',translation],[68,'Adding to squared height',growth],[69,'Squared height and scale',scale],[70,'Where real heights exist',regions],[66,'Rounded or pointed ends',magnitudes],[49,'Geometry and the right side',geometry],[71,'Read a loop in parts',synthesis]];
  const visible=lessons.filter(([id])=>known.has(id));
  const currentLesson=visible.pop()!;
  return current(currentLesson[1],await currentLesson[2]())+(focused?'':(await Promise.all(visible.reverse().map(async([id,title,body])=>recall([id],title,await body())))).join(''));
}

async function changingPhaseReference(examples:ReferenceExamples) {
  const [linear,curved]=await Promise.all([examples.example(50,'HS'),examples.example(50,'HQS')]);
  return '<p>Sine advances a quarter-turn whenever its input rises by one. A straight input reaches successive heights at equal horizontal distances. A steeper input reaches them closer together, so a curved phase can make the crests crowd together.</p>'+strip([curved.stages[2],curved.stages[3]],['Growing input slope','Changing wave spacing'],[move('S')])+compare('Equal height advances need different distances.',[
    {label:'Straight phase',stage:linear.stages.at(-1)!},
    {label:'Curved phase',stage:curved.stages.at(-1)!,before:linear.stages.at(-1)!}
  ])+'<p>Squaring after Sine instead folds the output and preserves its zeros. '+viewButton('flow')+' follows the incoming height into the circle.</p>'+tag(84);
}

async function waveReference(known:Set<number>,examples:ReferenceExamples,focused:boolean) {
  // Hidden future lessons must not delay the reference the player opened.
  const sample={
    wave:()=>examples.example(4,'HS'),
    phase:()=>examples.example(4,'HAS'),
    baseline:()=>examples.example(4,'HSA'),
    period:()=>examples.example(4,'HHS'),
    amplitude:()=>examples.example(4,'HSH'),
    folded:()=>examples.example(4,'HSQ')
  };
  const cycle=async()=>{
    const wave=await sample.wave();
    return '<p>Sine reads its input as quarter-turns around a circle.</p>'+strip([wave.stages.at(-2)!,wave.stages.at(-1)!],['Scaled input','Circular height'],[move('S')])+`<p>For input height ${tex('u')}, the block returns ${tex('S(u)=\\sin\\!\\left(\\frac{\\pi u}{2}\\right)')}. Inputs ${tex('0,1,2,3,4')} give heights ${tex('0,1,0,-1,0')}.</p>`+tag(50);
  };
  if(!known.has(51))return current('Sine turns input height into circular height.',await cycle());

  const phaseLesson=async()=>{
    const [phase,wave,baseline]=await Promise.all([sample.phase(),sample.wave(),sample.baseline()]);
    return '<p>Phase is the input’s position around the circle. Lifting the input shifts the wave sideways. The baseline is the wave’s middle height; lifting the output raises it without moving its peaks sideways. Zero crossings can move or disappear.</p>'+compare('Phase or baseline?',[
    {label:'Lift input',stage:phase.stages.at(-1)!,before:wave.stages.at(-1)!},
    {label:'Lift output',stage:baseline.stages.at(-1)!,before:wave.stages.at(-1)!}
  ])+tag(51);
  };
  if(!known.has(52))return current('Input and output lifts have different effects.',await phaseLesson())+(focused?'':recall([50],'Quarter-turn projection',await cycle()));

  const scaleLesson=async()=>{
    const [period,wave,amplitude]=await Promise.all([sample.period(),sample.wave(),sample.amplitude()]);
    return '<p>The period is the horizontal distance of one repeat. Amplitude is the distance from the middle height to a peak. Halving before Sine doubles the period; halving afterward halves the amplitude.</p>'+compare('Period or amplitude?',[
    {label:'Halve input',stage:period.stages.at(-1)!,before:wave.stages.at(-1)!},
    {label:'Halve output',stage:amplitude.stages.at(-1)!,before:wave.stages.at(-1)!}
  ])+tag(52);
  };
  const inputOrder=async()=>{
    const [shiftScale,scaleShift]=await Promise.all([examples.example(4,'HAHS'),examples.example(4,'HHAS')]);
    return '<p>A halve before sine makes the input advance half as far over the same horizontal distance. It also halves any shift that comes before it. Reversing those two input blocks preserves period but places the peaks differently.</p>'+compare('Same period, different phase.',[
      {label:'Shift then scale input',stage:shiftScale.stages.at(-1)!},
      {label:'Scale then shift input',stage:scaleShift.stages.at(-1)!,before:shiftScale.stages.at(-1)!}
    ])+`<p>Writing Sine as ${tex('S')} and the incoming height as ${tex('u')}, the two orders give different waves: ${tex('S((u+1)/2)\\ne S(u/2+1)')}.</p>`+tag(79);
  };
  const movable=async()=>{
    return '<p>A movable sine block still separates two jobs. Read the expression entering sine in '+viewButton('flow')+': it sets where the wave reaches each quarter-turn. Blocks after sine change those output heights. Removing the fixed station changes the editor, not this relationship.</p>'+await scaleLesson()+tag(81);
  };
  if(!known.has(53)) {
    if(known.has(81))return current('A movable sine still has an input and an output.',await movable())+(focused?'':recall([79],'A scale also changes an earlier shift',await inputOrder())+recall([51],'Phase and baseline',await phaseLesson()));
    if(known.has(79))return current('Input order changes the phase of a wide wave.',await inputOrder())+(focused?'':recall([52],'Period and amplitude',await scaleLesson())+recall([51],'Phase and baseline',await phaseLesson()));
    return current('Input and output scale have different effects.',await scaleLesson())+(focused?'':recall([51],'Phase and baseline',await phaseLesson())+recall([50],'Quarter-turn projection',await cycle()));
  }

  const fold=async()=>{
    const [wave,folded]=await Promise.all([sample.wave(),sample.folded()]);
    return '<p>Squaring a sine output folds negative lobes upward and keeps the zeros fixed. The positive and negative lobes now repeat the same shape, so the repeat distance halves.</p>'+strip([wave.stages.at(-1)!,folded.stages.at(-1)!],['Signed wave','Squared wave'],[move('Q')])+tag(53);
  };
  const range=async()=>{
    const [amplitude,wave,baseline]=await Promise.all([sample.amplitude(),sample.wave(),sample.baseline()]);
    return '<p>Output scaling changes peak-to-trough range. Output lifting changes the middle height.</p>'+compare('Range or middle height?',[
    {label:'Smaller amplitude',stage:amplitude.stages.at(-1)!,before:wave.stages.at(-1)!},
    {label:'Raised baseline',stage:baseline.stages.at(-1)!,before:wave.stages.at(-1)!}
  ])+tag(54);
  };
  const roles=async()=>{
    return '<p>Input shift and scale place and size the original sine cycle. Output scaling and lifting set its height and middle level. Squaring folds the lobes and can shorten the repeat distance.</p>'+tag(55);
  };
  const shoulders=async()=>{
    const [rounded,narrowed]=await Promise.all([examples.example(50,'HSQ'),examples.example(50,'HSQQ')]);
    return '<p>Two curves can agree at every zero and peak yet disagree between them. Squaring preserves zero and one while lowering each height strictly between them. A lift or a halve would move a peak that already fits.</p>'+compare('Same endpoints and peak. Different shoulders.',[
      {label:'Squared wave',stage:rounded.stages.at(-1)!},
      {label:'Squared again',stage:narrowed.stages.at(-1)!,before:rounded.stages.at(-1)!}
    ],[{index:1,x:'1'}])+`<p>At an intermediate height ${tex('a')}, ${tex('0<a<1\\quad\\Longrightarrow\\quad a^2<a')}: that is why the shoulder moves while zero and one stay fixed.</p><p>A single missed point is evidence about shape, not a reason to rebuild everything. In ${viewButton('function')}, note which exact heights already agree; use ${viewButton('flow')} to look for a change that preserves them.</p>`+tag(80);
  };
  const changing=async()=>known.has(84)?await changingPhaseReference(examples):'';
  if(known.has(55))return current('Input and output changes control different wave features.',await roles())+(focused?'':recall([84],'Changing phase changes spacing',await changing())+recall([80],'Agreement at peaks is not agreement between them',await shoulders())+recall([81],'Place the movable sine',await movable())+recall([54],'Amplitude and baseline',await range())+recall([53],'Folding lobes',await fold())+recall([79],'Input shift and scale order',await inputOrder())+recall([52,51],'Period and phase',await scaleLesson()+await phaseLesson())+recall([50],'Quarter-turn projection',await cycle()));
  if(known.has(84))return current('Input slope controls the spacing of quarter-turns.',await changing())+(focused?'':recall([53],'Folding the output preserves its zeros',await fold())+recall([52],'A constant input scale changes period',await scaleLesson()));
  if(known.has(80))return current('Matching peaks does not fix the whole curve.',await shoulders())+(focused?'':recall([53],'Folding signed lobes',await fold()));
  if(known.has(54))return current('Amplitude and baseline are separate.',await range())+(focused?'':recall([53],'Folding lobes',await fold())+recall([52,51],'Period and phase',await scaleLesson()+await phaseLesson())+recall([50],'Quarter-turn projection',await cycle()));
  return current('Squaring folds signed lobes.',await fold())+(focused?'':recall([52],'Period and amplitude',await scaleLesson())+recall([51],'Phase and baseline',await phaseLesson())+recall([50],'Quarter-turn projection',await cycle()));
}

async function stepReference(known:Set<number>,examples:ReferenceExamples,focused:boolean) {
  const sample={
    input:()=>examples.example(4,'H'),
    floor:()=>examples.example(4,'HF'),
    ceil:()=>examples.example(4,'HC'),
    afterTurn:()=>examples.example(4,'HFN'),
    beforeTurn:()=>examples.example(4,'HNF'),
    wide:()=>examples.example(4,'HHF'),
    short:()=>examples.example(4,'HFH'),
    phase:()=>examples.example(4,'AHF'),
    raised:()=>examples.example(4,'HFA'),
    projected:()=>examples.example(4,'HFS'),
    accumulated:()=>examples.example(4,'HFSI')
  };
  const down=async()=>{
    const [input,floor]=await Promise.all([sample.input(),sample.floor()]);
    return '<p>Integers have no fractional part: '+tex('\\ldots,-2,-1,0,1,2,\\ldots')+'. A threshold is a position where the input reaches an integer. Floor rounds down and holds one integer value between consecutive thresholds. At an exact integer input, Floor returns that integer. A filled endpoint includes the value; an open endpoint leaves it out.</p>'+strip([input.stages.at(-1)!,floor.stages.at(-1)!],['Scaled input','Floor steps'],[move('F')])+tag(56);
  };
  const up=async()=>{
    const [floor,input,ceil]=await Promise.all([sample.floor(),sample.input(),sample.ceil()]);
    return '<p>Ceiling rounds up. It has the same threshold positions as floor, with different heights and endpoint ownership.</p>'+compare('Round down or up?',[
    {label:'Floor',stage:floor.stages.at(-1)!,before:input.stages.at(-1)!},
    {label:'Ceiling',stage:ceil.stages.at(-1)!,before:input.stages.at(-1)!}
  ])+tag(57);
  };
  const direction=async()=>{
    const [afterTurn,input,beforeTurn]=await Promise.all([sample.afterTurn(),sample.input(),sample.beforeTurn()]);
    return '<p>Negating the input changes which integer Floor selects. Negating the finished result changes its sign. Negating both before and after Floor gives Ceiling.</p>'+compare('Negate before or after Floor?',[
    {label:'Floor, then negate',stage:afterTurn.stages.at(-1)!,before:input.stages.at(-1)!},
    {label:'Negate, then floor',stage:beforeTurn.stages.at(-1)!,before:input.stages.at(-1)!}
  ])+`<p>${tex('\\lceil u\\rceil=-\\lfloor-u\\rfloor')}</p>`+tag(58);
  };
  const sizing=async()=>{
    const [wide,input,short]=await Promise.all([sample.wide(),sample.input(),sample.short()]);
    return '<p>Input scale changes step width. Output scale changes step height.</p>'+compare('Width or height?',[
    {label:'Halve input',stage:wide.stages.at(-1)!,before:input.stages.at(-1)!},
    {label:'Halve output',stage:short.stages.at(-1)!,before:input.stages.at(-1)!}
  ])+tag(59);
  };
  const shifting=async()=>{
    const [phase,floor,raised]=await Promise.all([sample.phase(),sample.floor(),sample.raised()]);
    return '<p>An integer shift immediately before floor equals an output lift. Scaling that shift first can make it a fractional phase relative to the step width.</p>'+compare('Phase or output lift?',[
    {label:'Half-step phase',stage:phase.stages.at(-1)!,before:floor.stages.at(-1)!},
    {label:'Output lift',stage:raised.stages.at(-1)!,before:floor.stages.at(-1)!}
  ])+`<p>${tex('\\lfloor u+1\\rfloor=\\lfloor u\\rfloor+1')}</p>`+tag(60);
  };
  const projection=async()=>{
    const [projected]=await Promise.all([sample.projected()]);
    return '<p>Sine maps integer step heights through the repeating quarter-turn values zero, one, zero and negative one.</p>'+strip([projected.stages.at(-2)!,projected.stages.at(-1)!],['Integer steps','Circular heights'],[move('S')])+tag(61);
  };
  const area=async()=>{
    const [accumulated]=await Promise.all([sample.accumulated()]);
    return '<p>Accumulating constant step heights produces continuous straight pieces. Positive, zero and negative steps make rising, flat and falling pieces.</p>'+strip([accumulated.stages.at(-2)!,accumulated.stages.at(-1)!],['Signed steps','Accumulated path'],[move('I')])+tag(62);
  };
  const continuity=async()=>{
    const [accumulated]=await Promise.all([sample.accumulated()]);
    return '<p>A jump in the incoming step changes the slope of the accumulated path. The accumulated path itself remains continuous.</p>'+strip([accumulated.stages.at(-2)!,accumulated.stages.at(-1)!],['Discontinuous rate','Continuous total'],[move('I')])+`<p>${viewButton('flow')} shows endpoint ownership before accumulation and the total afterward.</p>`+tag(63);
  };
  if(known.has(63))return current('Step accumulation is continuous with sharp corners.',await continuity())+(focused?'':recall([62],'Signed step area',await area())+recall([61],'Circular projection',await projection())+recall([60],'Step phase',await shifting())+recall([59,58],'Step size and direction',await sizing()+await direction())+recall([57,56],'Ceiling and floor',await up()+await down()));
  if(known.has(62))return current('Signed steps accumulate into straight pieces.',await area())+(focused?'':recall([61],'Circular projection',await projection())+recall([60],'Step phase',await shifting())+recall([59,58],'Step size and direction',await sizing()+await direction())+recall([57,56],'Ceiling and floor',await up()+await down()));
  if(known.has(61))return current('Integer steps can drive a circular projection.',await projection())+(focused?'':recall([60],'Step phase',await shifting())+recall([59,58],'Step size and direction',await sizing()+await direction())+recall([57,56],'Ceiling and floor',await up()+await down()));
  if(known.has(60))return current('Input shift sets step phase.',await shifting())+(focused?'':recall([59],'Step width and height',await sizing())+recall([58],'Rounding direction',await direction())+recall([57,56],'Ceiling and floor',await up()+await down()));
  if(known.has(59))return current('Input and output scale change different step features.',await sizing())+(focused?'':recall([58],'Rounding direction',await direction())+recall([57,56],'Ceiling and floor',await up()+await down()));
  if(known.has(58))return current('Negation changes which side owns a step boundary.',await direction())+(focused?'':recall([57,56],'Ceiling and floor',await up()+await down()));
  if(known.has(57))return current('Floor and ceiling share thresholds.',await up())+(focused?'':recall([56],'Floor endpoint ownership',await down()));
  return current('Floor makes held integer steps.',await down());
}

async function togetherReference(known:Set<number>,examples:ReferenceExamples,focused:boolean) {

  const gate=async()=>gateRegionCard(await examples.example(50,'FSI'));
  // This optional chapter page includes the direct prerequisites; focused
  // lesson navigation presents each prerequisite separately.
  if(known.has(65)&&!known.has(67)&&!known.has(85)) {
    const regions=await examples.example(50,'FSI');
    if(focused)return current('Input regions become rises, plateaus and falls.',gateRegionCard(regions));
    const [shifted,steps,circle]=await Promise.all([examples.example(4,'AHF'),examples.example(4,'HF'),examples.circleExample('1','0','3/4')]);
    const continuity='<p>A jump between constant input heights changes the slope of the accumulated path. The total remains continuous, even where its direction changes.</p>'+strip(regions!.stages.slice(-2),['Held step heights','Continuous accumulated total'],[move('I')])+tag(63);
    const thresholds='<p>A lift that is halved before Floor becomes a half-unit input shift. It moves the jump positions; lifting after Floor would raise the finished steps instead.</p>'+compare('Move the input thresholds.',[
      {label:'Unshifted steps',stage:steps.stages.at(-1)!},
      {label:'Shifted steps',stage:shifted.stages.at(-1)!,before:steps.stages.at(-1)!}
    ])+tag(60);
    return current('Input regions become rises, plateaus and falls.',gateRegionCard(regions))+recall([63],'Step heights become a continuous path',continuity)+recall([60],'Place the thresholds',thresholds)+recall([66],'Paired magnitudes',pairedMagnitudeCard(circle));
  }
  const sample={
    slope:()=>examples.example(50,'NAQD'),
    wave:()=>examples.example(4,'HS'),
    steps:()=>examples.example(4,'HF'),
    area:()=>examples.example(4,'HFSI'),
    circle:()=>examples.circleExample('1','0','3/4'),
    water:()=>examples.example(50,'HSH'),
    bamboo:()=>examples.example(81,'H')
  };
  const slopeCard=async()=>{
    const slope=await sample.slope();
    return markers(32,34)+'<p>A flat place in an input is a zero in its derivative.</p>'+strip([slope.stages.at(-2)!,slope.stages.at(-1)!],['Input curve','Slope output'],[move('D')]);
  };
  const waveCard=async()=>{
    const wave=await sample.wave();
    return markers(50,54)+'<p>Sine reads input height as a circular phase.</p>'+strip([wave.stages.at(-2)!,wave.stages.at(-1)!],['Input phase','Circular height'],[move('S')]);
  };
  const stepCard=async()=>{
    const [steps,area]=await Promise.all([sample.steps(),sample.area()]);
    return markers(61,62)+'<p>Floor fixes jump positions; sine can map its integer heights; accumulation turns signed regions into a continuous total.</p>'+strip([steps.stages.at(-1)!,area.stages.at(-2)!,area.stages.at(-1)!],['Integer steps','Circular heights','Accumulated total'],[move('S'),move('I')]);
  };
  const relationCard=async()=>{
    const circle=await sample.circle();
    return pairedMagnitudeCard(circle);
  };
  const bambooCard=async()=>{
    const bamboo=await sample.bamboo();
    return '<p>A straight line has one constant inclination. Halving its height keeps the zero fixed and halves the rise over every horizontal interval.</p>'+strip(bamboo.stages,['Starting line','Half the rise'],[move('H')])+tag(82);
  };
  const waterCard=async()=>{
    const water=await sample.water();
    return '<p>Scaling after sine changes the height while keeping its zeros in place. The drawing frame is already fixed, so fit the curve with blocks. Create lets you choose your own crop.</p>'+strip([water.stages.at(-2)!,water.stages.at(-1)!],['A wide wave','Half its height'],[move('H')])+tag(72);
  };
  const moonCard=async()=>{
    const circle=await sample.circle();
    return "<p>The zeros of the right side set a loop's horizontal edges. Its maximum squared height sets its thickness, so a smaller maximum makes a thinner loop without moving those zeros. At one position, call the right-side value "+tex('a')+'.</p>'+circleSketch([circle],{centre:true,spoke:true,bounds:[-1,3,-2,2]})+`<p>${tex('h^2=a\\qquad h=\\pm\\sqrt a')}</p>`+tag(74);
  };
  const rippleCard=async()=>{
    const wave=await sample.wave();
    return '<p>Input shift and scale place and size the original sine cycle. Output scaling and lifting set its height and middle level. Squaring folds the lobes and can shorten the repeat distance. The fixed frame keeps the useful part without changing its heights.</p>'+strip([wave.stages.at(-2)!,wave.stages.at(-1)!],['Input phase','Fitted wave height'],[move('S')])+tag(76);
  };
  const artLessons:[number,string,()=>Promise<string>][]=[[82,'Set the inclination of a straight support',bambooCard],[72,'Fit height inside a fixed frame',waterCard]];
  if(known.has(73)) {
    const card=async()=>{
      const anchored=await examples.example(37,'I');
    return '<p>Accumulation stays anchored at zero even when the drawing frame starts later. The frame does not restart the accumulated amount at its left edge. Here '+tex('F')+' is the accumulated output; '+tex('u')+' runs over horizontal positions from zero to '+tex('x')+'.</p>'+strip(anchored.stages,['Input','Area accumulated from zero'],[move('I')])+`<p>${tex('F(x)=\\int_0^x h(u)\\,\\mathrm{d}u')}</p>`+tag(73);
    };
    artLessons.push([73,'The frame keeps the same area anchor',card]);
  }
  if(known.has(74))artLessons.push([74,'Zeros and squared height size a loop',moonCard]);
  if(known.has(75)) {
    const card=async()=>{
      const paired=await examples.example(66,'Q');
    return '<p>A line can first become a nonnegative roof with two zeros. When the squared-height equation uses the square of that roof, its solved branches are positive and negative copies that meet at those zeros.</p>'+relationSketch(paired,'Copied roof branches make a pointed outline.')+tag(75);
    };
    artLessons.push([75,'Build a pointed leaf from a roof',card]);
  }
  if(known.has(83)) {
    const card=async()=>{
      const petal=await examples.example(66,'HQ');
    return '<p>When the right side is the square of a nonnegative roof, the solved heights are positive and negative copies of that roof. This independent example uses a half-height roof: the branches keep its zero tips and meet at their pointed ends.</p>'+relationSketch(petal,'A half-height roof supplies a thinner petal.')+'<p>The garden rotates your completed petal five times around a centre. That repetition is decorative; the puzzle checks one exact construction.</p>'+tag(83);
    };
    artLessons.push([83,'One pointed petal can make a five-petal flower',card]);
  }
  if(known.has(76))artLessons.push([76,'Fit phase, amplitude and baseline',rippleCard]);
  if(known.has(77)) {
    const card=async()=>{
      const [arch,broad,rounded,pointed]=await Promise.all([examples.example(8,'NA'),examples.example(13,'QNA'),examples.example(66,''),examples.example(66,'Q')]);
    const roofs=compare('A flatter bowl makes a broader roof.',[
      {label:'Familiar arch',stage:arch.stages.at(-1)!},
      {label:'Broader roof',stage:broad.stages.at(-1)!,before:arch.stages.at(-1)!}
    ],[],['Familiar arch','Broader roof']);
    const ends=diagramChoices('The final right side chooses the cap shape.',[
      {label:'Roof',html:relationSketch(rounded,'Square-root branches round the caps.')},
      {label:'Roof squared',html:relationSketch(pointed,'Copied branches meet in points.',{before:rounded})}
    ]);
    return '<p>A flatter bowl can become a broader roof after turning and lifting. That controls the body. Separately, leaving a roof unsquared on the right of a squared-height equation makes square-root branches with rounded caps; squaring that final roof would make pointed ends.</p>'+roofs+ends+`<p>At one position, if the right-side roof has value ${tex('a')}, then ${tex('h^2=\\frac a4\\quad\\Longrightarrow\\quad |h|=\\frac{\\sqrt a}{2}')}. The square root belongs to the squared-height relation itself.</p>`+tag(77);
    };
    artLessons.push([77,'Broadness, rounded caps and thickness are separate',card]);
  }
  const visibleArt=artLessons.filter(([id])=>known.has(id));
  if(!known.has(64)) {
    const lesson=visibleArt.pop()!;
    return current(lesson[1],await lesson[2]())+(focused?'':(await Promise.all(visibleArt.reverse().map(async([id,title,body])=>recall([id],title,await body())))).join(''));
  }
  const artRecall=async()=>(await Promise.all(visibleArt.reverse().map(async([id,title,body])=>recall([id],title,await body())))).join('');
  const gateRecall=async()=>known.has(65)?recall([65],'Input regions become rises, plateaus and falls',await gate()):'';
  const reading=async()=>await changingPhaseReference(examples)+tag(64);
  if(known.has(85)) {
    const accumulated=await examples.example(50,'FI');
    const body='<p>Accumulation turns each constant input height into a straight section with that slope. Zero input holds the total still; a larger input makes the total climb more steeply.</p>'+strip([accumulated.stages[1],accumulated.stages[2]],['Different step heights','Different accumulated slopes'],[move('I')])+'<p>A constructed curve can become the input to another operation. Read its slope, its zero positions and its height separately; each relationship answers a different question.</p>'+tag(85);
    return current('Read the roles of intermediate curves.',body)+(focused?'':await gateRecall()+recall([84],'Input slope controls phase spacing',await reading())+recall([66],'The right side supplies paired heights',await relationCard())+recall([60,62],'Thresholds and area',await stepCard())+await artRecall());
  }
  if(known.has(67))return current('Mixed constructions are read one relationship at a time.',await reading())+(focused?'':await gateRecall()+recall([66],'Paired magnitudes',await relationCard())+recall([61,62],'Steps, projection and accumulation',await stepCard())+recall([50,54],'Phase, amplitude and baseline',await waveCard())+recall([32,34],'Slope and flat places',await slopeCard())+await artRecall());
  return current('A composition can be inspected stage by stage.',await reading())+(focused?'':recall([32,34],'Slope and flat places',await slopeCard())+recall([50,54],'Circular phase and output height',await waveCard())+recall([66],'Paired magnitudes',await relationCard())+await artRecall());
}

function gateRegionCard(regions:Result) {
  return '<p>Positive input raises the accumulated total. Zero input makes a flat section; negative input lowers the total. Each stretch contributes its height times its width.</p>'+strip(regions.stages.slice(-2),['Signed input regions','Rises, plateaus and falls'],[move('I')])+tag(65);
}

function pairedMagnitudeCard(circle:Result) {
  return markers(66)+'<p>A squared-height equation can return positive and negative heights of one magnitude.</p>'+circleSketch([circle],{centre:true,spoke:true,bounds:[-1,3,-2,2]})+`<p>${tex('h^2=\\frac9{16}-(x-1)^2')}</p>`;
}
