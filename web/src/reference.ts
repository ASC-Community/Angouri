import type { Result } from './types';
import { heightAtFormula, rationalTex, tex } from './views';
import { circleSketch, compare, diagramChoices, lesson, move, recall, relationSketch, strip, viewButton } from './note-diagrams';

export interface ReferenceExamples {
  example(sourceId:number,ops:string):Promise<Result>;
  circleExample(x:string,y:string,radius:string,goals?:string[][]):Promise<Result>;
  cropExample(from:string,to:string):Promise<Result>;
}

const finalDrawing=(result:Result):Result['stages'][number]=>({...result.stages.at(-1)!,points:result.points,paths:result.paths});

const tag=(source:number)=>`<p class="note-reference" data-reference-lesson="${source}">${lesson(source)}</p>`;
const markers=(...sources:number[])=>sources.map(source=>`<span data-reference-lesson="${source}" hidden></span>`).join('');
const current=(title:string,body:string)=>`<h3>${title}</h3>${body}`;

export async function renderReference(topic:number,known:Set<number>,examples:ReferenceExamples):Promise<string> {
  if(topic===0)return heightReference(known,examples);
  if(topic===1)return reflectionReference(known,examples);
  if(topic===2)return squareReference(known,examples);
  if(topic===3)return powerReference(known,examples);
  if(topic===4)return slopeReference(known,examples);
  if(topic===5)return areaReference(known,examples);
  if(topic===6) {
    const geometry=await circleReference(known,examples);
    return known.has(48)?await relationReference(known,examples)+recall([43,44],'Centre and reach',geometry):geometry;
  }
  if(topic===7)return waveReference(known,examples);
  if(topic===8)return stepReference(known,examples);
  return togetherReference(known,examples);
}

async function heightReference(known:Set<number>,examples:ReferenceExamples) {
  const [base,half,doubleHalf,lift,liftHalf,halfLift,quarterLift]=await Promise.all([
    examples.example(50,''),examples.example(50,'H'),examples.example(50,'HH'),
    examples.example(50,'A'),examples.example(50,'AH'),examples.example(50,'HA'),examples.example(50,'AHH')
  ]);
  const scaling='<p>Halving divides every height by two and keeps every zero fixed.</p>'+strip([base.stages[0],half.stages.at(-1)!],['Input height','Halved height'],[move('H')])+tag(1);
  const lifting='<p>Adding one raises every height equally. Differences between two heights stay unchanged.</p>'+strip([base.stages[0],lift.stages.at(-1)!],['Input height','Raised height'],[move('A')])+`<p>${tex('(v+1)-(u+1)=v-u')}</p>`+tag(2);
  const ordering='<p>Operations are read from left to right. A later halve also halves every earlier lift.</p>'+compare('Same blocks. Different results.',[
    {label:'Lift, then halve',stage:liftHalf.stages.at(-1)!,before:base.stages[0]},
    {label:'Halve, then lift',stage:halfLift.stages.at(-1)!,before:base.stages[0]}
  ])+`<p>${tex('\\frac{u+1}{2}')} ${tex('\\ne')} ${tex('\\frac u2+1')}</p>`+(known.has(25)?'':`<p>${viewButton('function')} compares the resulting heights at the same positions.</p>`)+tag(3);
  const pieces='<p>A lift contributes less when more halves follow it. The rule is algebraic and applies to any input curve.</p>'+compare('How much of the lift remains?',[
    {label:'One later halve',stage:liftHalf.stages.at(-1)!,before:half.stages.at(-1)!},
    {label:'Two later halves',stage:quarterLift.stages.at(-1)!,before:doubleHalf.stages.at(-1)!}
  ])+`<p>${tex('\\frac{u+1}{2}-\\frac u2=\\frac12')} ${tex('\\qquad')} ${tex('\\frac{u+1}{4}-\\frac u4=\\frac14')}</p>`+(known.has(25)?'':`<p>${viewButton('flow')} tracks how a lift changes through later operations.</p>`)+tag(24);
  const measurements='<p>A lift changes the baseline but preserves every height difference. A halve scales both the baseline and every height difference.</p>'+compare('Baseline change or scale change?',[
    {label:'Raised',stage:lift.stages.at(-1)!,before:base.stages[0]},
    {label:'Halved',stage:half.stages.at(-1)!,before:base.stages[0]}
  ])+`<p>${tex('(v+1)-(u+1)=v-u')} ${tex('\\qquad')} ${tex('\\frac v2-\\frac u2=\\frac{v-u}{2}')}</p><p>For example, ${tex(`${heightAtFormula('1')}-${heightAtFormula('0')}`)} compares two positions, while ${tex(rationalTex('1/2'))} is an exact scale factor.</p><p>${viewButton('function')} compares exact heights and their signed difference. ${viewButton('flow')} follows the same values through each operation.</p>`+tag(25);
  if(known.has(25))return current('Baseline and height difference are separate.',measurements)+recall([24],'Fractional lift contributions',pieces)+recall([3],'Why order matters',ordering)+recall([1,2],'Scale and lift',scaling+lifting);
  if(known.has(24))return current('A lift can contribute a fraction.',pieces)+recall([3],'Why order matters',ordering)+recall([1,2],'Scale and lift',scaling+lifting);
  if(known.has(3))return current('Order changes the result.',ordering)+recall([2],'Uniform lifting',lifting)+recall([1],'Uniform scaling',scaling);
  if(known.has(2))return current('A lift changes the baseline.',lifting)+recall([1],'Halving every height',scaling);
  return current('Halving scales every height.',scaling);
}

async function reflectionReference(known:Set<number>,examples:ReferenceExamples) {
  const [base,turned,turnedRaised,raisedTurned,smallerTurned]=await Promise.all([
    examples.example(50,''),examples.example(50,'N'),examples.example(50,'NA'),
    examples.example(50,'AN'),examples.example(50,'HN')
  ]);
  const signs='<p>Negation changes every sign and keeps zeros fixed.</p>'+strip([base.stages[0],turned.stages.at(-1)!],['Input height','Negated height'],[move('N')])+`<p>${tex('u\\longmapsto -u')}</p><p>Negation also reverses every signed height difference: ${tex('(-v)-(-u)=-(v-u)')}. ${viewButton('function')} compares that gap at fixed positions.</p>`+tag(6);
  const orientation='<p>Negation controls orientation. A later lift moves the reflected output without changing its shape.</p>'+compare('Turn or move?',[
    {label:'Turned',stage:turned.stages.at(-1)!,before:base.stages[0]},
    {label:'Turned and raised',stage:turnedRaised.stages.at(-1)!,before:turned.stages.at(-1)!}
  ])+tag(8);
  const size='<p>Scaling changes distance from the zero line. Negation changes its side. These effects are independent.</p>'+compare('Change size or side?',[
    {label:'Turned',stage:turned.stages.at(-1)!,before:base.stages[0]},
    {label:'Smaller and turned',stage:smallerTurned.stages.at(-1)!,before:base.stages[0]}
  ])+`<p>${tex('-\\frac u2=\\frac{-u}{2}')}</p>`+tag(9);
  const offset='<p>An existing offset is negated when it enters negation. A lift after negation is not the same operation order.</p>'+compare('Where does the lift act?',[
    {label:'Lift, then negate',stage:raisedTurned.stages.at(-1)!,before:base.stages[0]},
    {label:'Negate, then lift',stage:turnedRaised.stages.at(-1)!,before:base.stages[0]}
  ])+`<p>${tex('-(u+1)=-u-1')} ${tex('\\ne')} ${tex('-u+1')}</p>`+tag(26);
  if(known.has(26))return current('Reflection includes every existing offset.',offset)+recall([9],'Size and orientation',size)+recall([8],'Orientation and baseline',orientation)+recall([6],'Sign reversal',signs);
  if(known.has(9))return current('Scale and reflection have separate effects.',size)+recall([8],'Orientation and baseline',orientation)+recall([6],'Sign reversal',signs);
  if(known.has(8))return current('Orientation and baseline are separate.',orientation)+recall([6],'Sign reversal',signs);
  return current('Reflection reverses signs.',signs);
}

async function squareReference(known:Set<number>,examples:ReferenceExamples) {
  const [shifted,squared,halfBefore,halfAfter,reflected,raised,centred,moved]=await Promise.all([
    examples.example(4,'A'),examples.example(4,'AQ'),examples.example(4,'AHQ'),examples.example(4,'AQH'),
    examples.example(4,'AQN'),examples.example(4,'AQA'),examples.example(50,'Q'),examples.example(50,'AQ')
  ]);
  const folding='<p>Squaring makes opposite heights agree and keeps zero fixed.</p>'+strip([shifted.stages.at(-1)!,squared.stages.at(-1)!],['Offset line','Squared height'],[move('Q')])+`<p>${tex('u^2=(-u)^2')}</p>`+tag(7);
  const order='<p>A scale before squaring is squared too. A scale afterward acts only once.</p>'+compare('Where does the halve act?',[
    {label:'Halve, then square',stage:halfBefore.stages.at(-1)!,before:shifted.stages.at(-1)!},
    {label:'Square, then halve',stage:halfAfter.stages.at(-1)!,before:shifted.stages.at(-1)!}
  ])+`<p>${tex('\\left(\\frac u2\\right)^2=\\frac{u^2}{4}')} ${tex('\\ne')} ${tex('\\frac{u^2}{2}')}</p>`+tag(10);
  const composition='<p>The output of one relationship is the input to the next. Squaring sets a nonnegative shape; output negation or output lifting changes that shape in a different way.</p>'+compare('Same squared input. Different output change.',[
    {label:'Negated square',stage:reflected.stages.at(-1)!,before:squared.stages.at(-1)!},
    {label:'Raised square',stage:raised.stages.at(-1)!,before:squared.stages.at(-1)!}
  ])+tag(4);
  const zero='<p>Squaring folds around the input’s zero. Changing the input moves that landmark; an output change leaves it where it is.</p>'+compare('Where is the fold?',[
    {label:'Unshifted input',stage:centred.stages.at(-1)!,before:centred.stages[0]},
    {label:'Shifted input',stage:moved.stages.at(-1)!,before:centred.stages[0]}
  ])+tag(27);
  const landmarks='<p>Input changes determine where a fold occurs. Output reflection and output lifting preserve that horizontal position.</p>'+compare('One fold, two output changes.',[
    {label:'Reflected output',stage:reflected.stages.at(-1)!,before:squared.stages.at(-1)!},
    {label:'Raised output',stage:raised.stages.at(-1)!,before:squared.stages.at(-1)!}
  ])+`<p>${viewButton('flow')} shows which side of the square each change belongs to.</p>`+tag(28);
  if(known.has(28))return current('Input landmarks survive later output changes.',landmarks)+recall([27],'The input zero sets the fold',zero)+recall([4],'Composing relationships',composition)+recall([10,7],'Square and scale',order+folding);
  if(known.has(27))return current('The input zero sets the fold.',zero)+recall([4],'Composing relationships',composition)+recall([10,7],'Square and scale',order+folding);
  if(known.has(4))return current('One relationship can feed another.',composition)+recall([10],'Scale before or after squaring',order)+recall([7],'Opposite heights meet',folding);
  if(known.has(10))return current('Scaling and squaring do not commute.',order)+recall([7],'Opposite heights meet',folding);
  return current('Squaring folds heights around zero.',folding);
}

async function powerReference(known:Set<number>,examples:ReferenceExamples) {
  const [small,second,fourth,eighth,sixth,raised,raisedSquared,negatedFourth,negatedSixth]=await Promise.all([
    examples.example(4,'H'),examples.example(8,''),examples.example(8,'Q'),
    examples.example(8,'QQ'),examples.example(29,'Q'),examples.example(4,'HA'),
    examples.example(4,'HAQ'),examples.example(8,'QN'),examples.example(29,'QN')
  ]);
  const flatter='<p>For magnitudes between zero and one, squaring moves heights closer to zero while keeping zero and one fixed.</p>'+strip([second.stages.at(-1)!,fourth.stages.at(-1)!],['Squared input','Squared again'],[move('Q')])+`<p>${tex('0<|u|<1\\;\\Longrightarrow\\;u^2<|u|')}</p>`+tag(12);
  const orientation='<p>An even power supplies a nonnegative shape. Negation reverses that shape without changing its zeros.</p>'+strip([fourth.stages.at(-1)!,negatedFourth.stages.at(-1)!],['Even power','Negated even power'],[move('N')])+tag(13);
  const families='<p>The input power matters as well as the square block.</p>'+compare('Same zero and unit height. Different middles.',[
    {label:'Second power',stage:second.stages.at(-1)!,before:small.stages.at(-1)!},
    {label:'Fourth power',stage:fourth.stages.at(-1)!,before:small.stages.at(-1)!},
    {label:'Sixth power',stage:sixth.stages.at(-1)!,before:sixth.stages.at(-2)!}
  ])+`<p>${tex('(u^3)^2=u^6')} ${tex('\\qquad')} ${tex('(u^2)^2=u^4')}</p>`+tag(29);
  const reuse='<p>Higher even powers keep the same sign and zeros. Reflection changes orientation without changing those horizontal landmarks.</p>'+compare('Power landmarks survive reflection.',[
    {label:'Sixth power',stage:sixth.stages.at(-1)!,before:sixth.stages.at(-2)!},
    {label:'Reflected sixth power',stage:negatedSixth.stages.at(-1)!,before:sixth.stages.at(-1)!}
  ])+tag(30);
  const fitting='<p>Squaring shrinks magnitudes below one and grows magnitudes above one.</p>'+compare('Below one or above one?',[
    {label:'Scaled input',stage:second.stages.at(-1)!,before:small.stages.at(-1)!},
    {label:'Raised input',stage:raisedSquared.stages.at(-1)!,before:raised.stages.at(-1)!}
  ])+`<p>${tex('0<|u|<1\\Rightarrow u^2<|u|')} ${tex('\\qquad')} ${tex('|u|>1\\Rightarrow u^2>|u|')}</p>`+compare('Repeated squares add higher even powers.',[
    {label:'Second power',stage:second.stages.at(-1)!,before:small.stages.at(-1)!},
    {label:'Fourth power',stage:fourth.stages.at(-1)!,before:small.stages.at(-1)!},
    {label:'Eighth power',stage:eighth.stages.at(-1)!,before:small.stages.at(-1)!}
  ])+tag(31);
  const choice='<p>Repeated squares preserve zero and one while changing intermediate heights. Each additional square produces a distinct even-power silhouette.</p>'+compare('Compare repeated powers.',[
    {label:'Second power',stage:second.stages.at(-1)!,before:small.stages.at(-1)!},
    {label:'Fourth power',stage:fourth.stages.at(-1)!,before:small.stages.at(-1)!},
    {label:'Eighth power',stage:eighth.stages.at(-1)!,before:small.stages.at(-1)!}
  ]);
  if(known.has(11))return current('Repeated squaring creates a family of shapes.',choice)+recall([31],'Below and above one',fitting)+recall([29,30],'Even-power silhouettes',families+reuse)+recall([12,13],'Squaring and orientation',flatter+orientation);
  if(known.has(31))return current('One is the dividing height for squaring.',fitting)+recall([30],'Orientation keeps power landmarks',reuse)+recall([29],'Power families',families)+recall([12,13],'Squaring and orientation',flatter+orientation);
  if(known.has(30))return current('Even-power landmarks survive reflection.',reuse)+recall([29],'Power families',families)+recall([12,13],'Squaring and orientation',flatter+orientation);
  if(known.has(29))return current('The input power changes the output silhouette.',families)+recall([13],'Orientation of an even power',orientation)+recall([12],'What squaring keeps',flatter);
  if(known.has(13))return current('An even power can be reoriented.',orientation)+recall([12],'What squaring keeps',flatter);
  return current('Squaring changes heights between zero and one.',flatter);
}

async function slopeReference(known:Set<number>,examples:ReferenceExamples) {
  const [line,slope,liftBefore,liftAfter,bowlSlope,movedSlope,waveSlope]=await Promise.all([
    examples.example(50,''),examples.example(50,'D'),examples.example(50,'AD'),examples.example(50,'DA'),
    examples.example(50,'NAQD'),examples.example(50,'NAAQD'),examples.example(4,'AHQNAQD')
  ]);
  const reading='<p>The derivative uses local slope as the new height: downhill is negative, flat is zero and uphill is positive.</p>'+strip([line.stages[0],slope.stages.at(-1)!],['Input curve','Slope output'],[move('D')])+`<p>${viewButton('flow')} shows the incoming tangent at the inspected position.</p>`+tag(32);
  const sides='<p>A lift before differentiation does not change slope. A lift after differentiation raises the slope output.</p>'+compare('Which side receives the lift?',[
    {label:'Lift input',stage:liftBefore.stages.at(-1)!,before:slope.stages.at(-1)!},
    {label:'Lift output',stage:liftAfter.stages.at(-1)!,before:slope.stages.at(-1)!}
  ])+`<p>${tex('\\frac{\\mathrm d}{\\mathrm dx}(u+1)=\\frac{\\mathrm du}{\\mathrm dx}')}</p>`;
  const turning='<p>A squared line has a changing slope. Its flat point becomes a zero of the derivative.</p>'+strip([bowlSlope.stages.at(-2)!,bowlSlope.stages.at(-1)!],['Squared line','Slope'],[move('D')])+tag(33);
  const moving='<p>Changing the input zero before squaring moves the flat point and therefore moves the derivative’s zero.</p>'+compare('Where is the slope zero?',[
    {label:'Unshifted fold',stage:bowlSlope.stages.at(-1)!,before:bowlSlope.stages.at(-2)!},
    {label:'Shifted fold',stage:movedSlope.stages.at(-1)!,before:movedSlope.stages.at(-2)!}
  ])+tag(34);
  const several='<p>Every smooth flat place becomes a derivative zero. A zero may mark a turn or a momentary flattening.</p>'+strip([waveSlope.stages.at(-2)!,waveSlope.stages.at(-1)!],['Several flat places','Derivative zeros'],[move('D')])+tag(35);
  const roles='<p>Input operations determine the tangent field read by differentiation. Output operations change the displayed slope heights afterward.</p>'+sides+tag(36);
  if(known.has(36))return current('The two sides of differentiation have different jobs.',roles)+recall([35],'Flat places become zeros',several)+recall([34],'Moving a flat place',moving)+recall([33],'Changing slope',turning)+recall([32],'Reading slope',reading);
  if(known.has(35))return current('A derivative can have several zeros.',several)+recall([34],'Moving a flat place',moving)+recall([33],'Changing slope',turning)+recall([32],'Reading slope',reading+sides);
  if(known.has(34))return current('Moving a flat place moves a derivative zero.',moving)+recall([33],'Changing slope',turning)+recall([32],'Reading slope',reading+sides);
  if(known.has(33))return current('Curvature makes slope change.',turning)+recall([32],'Reading slope',reading+sides);
  return current('Slope becomes height.',reading+sides);
}

async function areaReference(known:Set<number>,examples:ReferenceExamples) {
  const [line,area,inputLift,outputLift,inputHalf,outputHalf,crossing,movedCrossing,signed,recovered]=await Promise.all([
    examples.example(50,''),examples.example(50,'I'),examples.example(50,'AI'),examples.example(50,'IA'),
    examples.example(50,'HI'),examples.example(50,'IH'),examples.example(4,'HI'),examples.example(4,'HAI'),
    examples.example(4,'QHNAI'),examples.example(50,'ADI')
  ]);
  const basics='<p>Accumulation adds signed area from zero to the inspected position. Its own output starts at zero.</p>'+strip([line.stages[0],area.stages.at(-1)!],['Input height','Accumulated area'],[move('I')])+`<p>${tex('\\int_0^x u(t)\\,\\mathrm dt')} ${viewButton('flow')} shows positive and negative contributions.</p>`+tag(37);
  const turning='<p>Positive input makes the total rise; negative input makes it fall. An input zero is where growth can change direction.</p>'+compare('Move the input zero.',[
    {label:'Original input',stage:crossing.stages.at(-1)!,before:crossing.stages.at(-2)!},
    {label:'Raised input',stage:movedCrossing.stages.at(-1)!,before:movedCrossing.stages.at(-2)!}
  ])+tag(38);
  const signs='<p>Several sign regions produce alternating rise and fall in one continuous accumulated curve.</p>'+strip([signed.stages.at(-2)!,signed.stages.at(-1)!],['Signed input','Continuous total'],[move('I')])+tag(39);
  const scale='<p>Halving either side halves the accumulated change because integration is linear.</p>'+compare('Halve input or output?',[
    {label:'Halve input',stage:inputHalf.stages.at(-1)!,before:line.stages[0]},
    {label:'Halve output',stage:outputHalf.stages.at(-1)!,before:line.stages[0]}
  ])+`<p>${tex('\\int_0^x \\frac{u(t)}2\\,\\mathrm dt=\\frac12\\int_0^x u(t)\\,\\mathrm dt')}</p>`;
  const baseline='<p>A lift after accumulation changes the starting amount. A lift before accumulation changes the rate everywhere.</p>'+compare('Rate change or starting amount?',[
    {label:'Lift input',stage:inputLift.stages.at(-1)!,before:area.stages.at(-1)!},
    {label:'Lift output',stage:outputLift.stages.at(-1)!,before:area.stages.at(-1)!}
  ])+tag(40);
  const recovery='<p>Differentiation removes a constant offset. Accumulating the derivative rebuilds the change from zero.</p>'+strip(recovered.stages.slice(1),['Raised line','Slope','Recovered change'],[move('D'),move('I')])+`<p>${tex('\\int_0^x \\frac{\\mathrm du}{\\mathrm dt}\\,\\mathrm dt=u(x)-u(0)')}</p>`+tag(41);
  const roles='<p>Input signs control where the accumulated result rises or falls. Output scaling and lifting control its size and baseline.</p>'+scale+tag(42);
  if(known.has(42))return current('Input shape and output placement are separate.',roles)+recall([41],'Recovering change',recovery)+recall([40],'Scale and starting amount',scale+baseline)+recall([39,38],'Signs and turning',signs+turning)+recall([37],'Anchored accumulation',basics);
  if(known.has(41))return current('Accumulated slope recovers change from zero.',recovery)+recall([40],'Scale and starting amount',scale+baseline)+recall([39,38],'Signs and turning',signs+turning)+recall([37],'Anchored accumulation',basics);
  if(known.has(40))return current('Change and starting amount are separate.',scale+baseline)+recall([39],'Several sign regions',signs)+recall([38],'Input zeros and turns',turning)+recall([37],'Anchored accumulation',basics);
  if(known.has(39))return current('Signed regions can alternate growth and decline.',signs)+recall([38],'Input zeros and turns',turning)+recall([37],'Anchored accumulation',basics);
  if(known.has(38))return current('The input sign controls growth.',turning)+recall([37],'Anchored accumulation',basics);
  return current('Area becomes accumulated height.',basics);
}

async function circleReference(known:Set<number>,examples:ReferenceExamples) {
  const [small,large,moved]=await Promise.all([
    examples.circleExample('1','1','3/4'),examples.circleExample('1','1','5/4'),examples.circleExample('2','1','5/4')
  ]);
  const circle='<p>A circle contains two heights at most horizontal positions. Every point stays one radius from its centre.</p>'+diagramChoices('One centre. Two radii.',[
    {label:'Smaller radius',html:circleSketch([small],{centre:true,spoke:true,bounds:[-1,3,-1,3]})},
    {label:'Larger radius',html:circleSketch([small,large],{centre:true,spoke:true,bounds:[-1,3,-1,3]})}
  ])+`<p>${tex('(x-a)^2+(h-b)^2=r^2')}</p>`+tag(43);
  const centre='<p>Changing the centre translates the whole circle. Changing the radius changes its reach.</p>'+diagramChoices('Translate or resize?',[
    {label:'Original centre',html:circleSketch([large],{centre:true,spoke:true,bounds:[-1,4,-1,3]})},
    {label:'Moved centre',html:circleSketch([large,moved],{centre:true,spoke:true,bounds:[-1,4,-1,3]})}
  ])+tag(44);
  const diameterTargets:[[number,number],[number,number]]=[[0,.25],[2,1.75]];
  const diameter='<p>The midpoint of a diameter is the centre. Half its length is the radius, including for a diagonal diameter.</p>'+circleSketch([large],{centre:true,triangle:true,diameter:true,targets:diameterTargets,bounds:[-1,3,-1,3]})+`<p>${tex('(\\Delta x)^2+(\\Delta h)^2=(2r)^2')}</p>`+tag(45);
  const targets:[number,number][]=[[1,2.25],[2.25,1],[1,-.25]];
  const bisectors=diagramChoices('How many centres remain possible?',[
    {label:'One target pair',html:circleSketch([],{targets,pairs:[[0,1]],bounds:[-1,3,-1,3]})},
    {label:'Two target pairs',html:circleSketch([large],{targets,pairs:[[0,1],[1,2]],centre:true,bounds:[-1,3,-1,3]})}
  ]);
  const pair='<p>Every point on a pair’s perpendicular bisector is equally far from that pair. Two independent bisectors meet at a circle centre.</p>'+bisectors+tag(46);
  const constellation='<p>Equal distance is the common test for every target in a circle. Different pairs provide independent constraints on the same centre.</p>'+bisectors+`<p>${viewButton('function')} compares squared distances; ${viewButton('flow')} shows the selected pair and its bisector.</p>`+tag(47);
  if(known.has(47))return current('Several pairs constrain one centre.',constellation)+recall([46],'Perpendicular bisectors',pair)+recall([45],'Diameter and midpoint',diameter)+recall([44,43],'Centre and radius',centre+circle);
  if(known.has(46))return current('Two bisectors locate a centre.',pair)+recall([45],'Diameter and midpoint',diameter)+recall([44,43],'Centre and radius',centre+circle);
  if(known.has(45))return current('A diameter reveals centre and radius.',diameter)+recall([44],'Translating a circle',centre)+recall([43],'One centre and one radius',circle);
  if(known.has(44))return current('Centre and radius change different properties.',centre)+recall([43],'One centre and one radius',circle);
  return current('A circle keeps one distance.',circle);
}

async function relationReference(known:Set<number>,examples:ReferenceExamples) {
  const [base,lift,half,quarter,turned,roundedRoof,pointedRoof]=await Promise.all([
    ...['HH','HHA','HHH','HHHH','HHN'].map(ops=>examples.example(68,ops)),
    examples.example(66,''),examples.example(66,'Q')
  ]);
  const diagram=(result:Result,label:string)=>relationSketch(result,label,{before:base,bounds:[0,4,-2,2]});
  const equation='<p>The right side is squared height. At each position, a positive value gives two heights, zero gives one, and a negative value gives no real height.</p>'+diagram(base,'One equation, both heights')+`<p>${tex('h^2=a')} ${tex('\\Longrightarrow')} ${tex('h=\\pm\\sqrt a\\quad(a\\ge0)')}</p>`+tag(48);
  const growth='<p>Adding one on the right increases squared height. The upper branch rises and the lower branch falls; the middle stays fixed. The change in height is not one.</p>'+diagramChoices('The same centre line, a different reach.',[{label:'Before',html:diagram(base,'Before')},{label:'Add one',html:diagram(lift,'Add to squared height')}])+tag(68);
  const scale='<p>Halving squared height scales each height by the square root of one half. Two halves of squared height make one half of height. The horizontal zeros stay fixed.</p>'+diagramChoices('One halve or two?',[
    {label:'Before',html:diagram(base,'Before')},{label:'One halve',html:diagram(half,'Heights scale by one over the square root of two')},{label:'Two halves',html:diagram(quarter,'Heights are halved')}
  ])+`<p>${tex('h^2=a/4\\quad\\Longrightarrow\\quad h=\\pm\\sqrt a/2')}</p>`+tag(69);
  const regions='<p>Negation exchanges the positive and negative regions of the right side. A height can exist only in a nonnegative region. It does not simply turn the visible loop upside down.</p>'+diagramChoices('Change the sign. Change where heights exist.',[{label:'Before',html:diagram(base,'Heights inside the zeros')},{label:'Negate',html:diagram(turned,'Heights outside the zeros')}])+tag(70);
  const magnitudes='<p>The supplied roof is already nonnegative. With that roof on the right, solving takes a square root and the branches have rounded ends. Squaring the roof first makes the solved heights positive and negative copies of it, so they meet in pointed ends.</p>'+diagramChoices('Same roof. Rounded or pointed ends.',[
    {label:'Roof',html:relationSketch(roundedRoof,'Square-root branches have rounded ends.')},
    {label:'Roof squared',html:relationSketch(pointedRoof,'Copied roof branches meet in points.',{before:roundedRoof})}
  ])+`<p>${tex('h^2=a\\ \\Longrightarrow\\ h=\\pm\\sqrt a')} ${tex('\\qquad')} ${tex('h^2=a^2\\ \\Longrightarrow\\ h=\\pm a\\quad(a\\ge0)')}</p>`+tag(66);
  const geometry='<p>The zeros of a circular roof locate the loop’s horizontal edges. Its maximum is the squared radius. Scaling height while keeping those zeros creates a different loop, rather than simply resizing a circle.</p>'+tag(49);
  const synthesis='<p>Several visible pieces may come from one signed shape. Track its zeros, its scale, and which operation makes negative regions visible again.</p>'+tag(71);
  const lessons:[number,string,string][]=[[48,'Positive, zero or negative',equation],[68,'Adding to squared height',growth],[69,'Squared height and scale',scale],[70,'Where real heights exist',regions],[66,'Rounded or pointed ends',magnitudes],[49,'Geometry and the right side',geometry],[71,'Read a loop in parts',synthesis]];
  const visible=lessons.filter(([id])=>known.has(id));
  const currentLesson=visible.pop()!;
  return current(currentLesson[1],currentLesson[2])+visible.reverse().map(([id,title,body])=>recall([id],title,body)).join('');
}

async function waveReference(known:Set<number>,examples:ReferenceExamples) {
  // Hidden future lessons must not delay the reference the player opened.
  const wave=await examples.example(4,'HS');
  const cycle='<p>Sine reads its input as quarter-turns around a circle.</p>'+strip([wave.stages.at(-2)!,wave.stages.at(-1)!],['Scaled input','Circular height'],[move('S')])+`<p>${tex('S(u)=\\sin\\!\\left(\\frac{\\pi u}{2}\\right)')} ${tex('\\qquad')} ${tex('0,1,0,-1,0')}</p>`+tag(50);
  if(!known.has(51))return current('Sine turns input height into circular height.',cycle);
  const [phase,baseline]=await Promise.all([examples.example(4,'HAS'),examples.example(4,'HSA')]);
  const phaseLesson='<p>An input lift changes phase. An output lift changes the baseline while leaving the horizontal peak positions unchanged.</p>'+compare('Phase or baseline?',[
    {label:'Lift input',stage:phase.stages.at(-1)!,before:wave.stages.at(-1)!},
    {label:'Lift output',stage:baseline.stages.at(-1)!,before:wave.stages.at(-1)!}
  ])+tag(51);
  if(!known.has(52))return current('Input and output lifts have different effects.',phaseLesson)+recall([50],'Quarter-turn projection',cycle);
  const [period,amplitude]=await Promise.all([examples.example(4,'HHS'),examples.example(4,'HSH')]);
  const scaleLesson='<p>Input scale changes period. Output scale changes amplitude.</p>'+compare('Period or amplitude?',[
    {label:'Halve input',stage:period.stages.at(-1)!,before:wave.stages.at(-1)!},
    {label:'Halve output',stage:amplitude.stages.at(-1)!,before:wave.stages.at(-1)!}
  ])+tag(52);
  if(!known.has(53))return current('Input and output scale have different effects.',scaleLesson)+recall([51],'Phase and baseline',phaseLesson)+recall([50],'Quarter-turn projection',cycle);
  const folded=await examples.example(4,'HSQ');
  const fold='<p>Squaring a sine output folds negative lobes upward while keeping every zero fixed.</p>'+strip([wave.stages.at(-1)!,folded.stages.at(-1)!],['Signed wave','Squared wave'],[move('Q')])+tag(53);
  const range='<p>Output scaling changes peak-to-trough range. Output lifting changes the middle height.</p>'+compare('Range or middle height?',[
    {label:'Smaller amplitude',stage:amplitude.stages.at(-1)!,before:wave.stages.at(-1)!},
    {label:'Raised baseline',stage:baseline.stages.at(-1)!,before:wave.stages.at(-1)!}
  ])+tag(54);
  const roles='<p>Upstream changes control horizontal phase and period. Downstream changes control folding, amplitude and baseline. The distinctions in the earlier comparisons remain valid when several operations are present.</p>'+tag(55);
  if(known.has(55))return current('Input and output changes control different wave features.',roles)+recall([54],'Amplitude and baseline',range)+recall([53],'Folding lobes',fold)+recall([52,51],'Period and phase',scaleLesson+phaseLesson)+recall([50],'Quarter-turn projection',cycle);
  if(known.has(54))return current('Amplitude and baseline are separate.',range)+recall([53],'Folding lobes',fold)+recall([52,51],'Period and phase',scaleLesson+phaseLesson)+recall([50],'Quarter-turn projection',cycle);
  return current('Squaring folds signed lobes.',fold)+recall([52],'Period and amplitude',scaleLesson)+recall([51],'Phase and baseline',phaseLesson)+recall([50],'Quarter-turn projection',cycle);
}

async function stepReference(known:Set<number>,examples:ReferenceExamples) {
  const [input,floor,ceil,afterTurn,beforeTurn,wide,short,phase,raised,projected,accumulated]=await Promise.all([
    examples.example(4,'H'),examples.example(4,'HF'),examples.example(4,'HC'),examples.example(4,'HFN'),
    examples.example(4,'HNF'),examples.example(4,'HHF'),examples.example(4,'HFH'),examples.example(4,'AHF'),
    examples.example(4,'HFA'),examples.example(4,'HFS'),examples.example(4,'HFSI')
  ]);
  const down='<p>Floor rounds down and holds one integer value between consecutive thresholds. At an exact integer, the rising step owns the closed endpoint.</p>'+strip([input.stages.at(-1)!,floor.stages.at(-1)!],['Scaled input','Floor steps'],[move('F')])+tag(56);
  const up='<p>Ceiling rounds up. It has the same threshold positions as floor, with different heights and endpoint ownership.</p>'+compare('Round down or up?',[
    {label:'Floor',stage:floor.stages.at(-1)!,before:input.stages.at(-1)!},
    {label:'Ceiling',stage:ceil.stages.at(-1)!,before:input.stages.at(-1)!}
  ])+tag(57);
  const direction='<p>Negating after floor turns the finished heights. Negating before floor reverses the rounding direction too.</p>'+compare('Turn heights or reverse rounding?',[
    {label:'Floor, then negate',stage:afterTurn.stages.at(-1)!,before:input.stages.at(-1)!},
    {label:'Negate, then floor',stage:beforeTurn.stages.at(-1)!,before:input.stages.at(-1)!}
  ])+`<p>${tex('\\lceil u\\rceil=-\\lfloor-u\\rfloor')}</p>`+tag(58);
  const sizing='<p>Input scale changes step width. Output scale changes step height.</p>'+compare('Width or height?',[
    {label:'Halve input',stage:wide.stages.at(-1)!,before:input.stages.at(-1)!},
    {label:'Halve output',stage:short.stages.at(-1)!,before:input.stages.at(-1)!}
  ])+tag(59);
  const shifting='<p>An integer shift immediately before floor equals an output lift. Scaling that shift first can make it a fractional phase relative to the step width.</p>'+compare('Phase or output lift?',[
    {label:'Half-step phase',stage:phase.stages.at(-1)!,before:floor.stages.at(-1)!},
    {label:'Output lift',stage:raised.stages.at(-1)!,before:floor.stages.at(-1)!}
  ])+`<p>${tex('\\lfloor u+1\\rfloor=\\lfloor u\\rfloor+1')}</p>`+tag(60);
  const projection='<p>Sine maps integer step heights through the repeating quarter-turn values zero, one, zero and negative one.</p>'+strip([projected.stages.at(-2)!,projected.stages.at(-1)!],['Integer steps','Circular heights'],[move('S')])+tag(61);
  const area='<p>Accumulating constant step heights produces continuous straight pieces. Positive, zero and negative steps make rising, flat and falling pieces.</p>'+strip([accumulated.stages.at(-2)!,accumulated.stages.at(-1)!],['Signed steps','Accumulated path'],[move('I')])+tag(62);
  const continuity='<p>A jump in the incoming step changes the slope of the accumulated path. The accumulated path itself remains continuous.</p>'+strip([accumulated.stages.at(-2)!,accumulated.stages.at(-1)!],['Discontinuous rate','Continuous total'],[move('I')])+`<p>${viewButton('flow')} shows endpoint ownership before accumulation and the total afterward.</p>`+tag(63);
  if(known.has(63))return current('Step accumulation is continuous with sharp corners.',continuity)+recall([62],'Signed step area',area)+recall([61],'Circular projection',projection)+recall([60],'Step phase',shifting)+recall([59,58],'Step size and direction',sizing+direction)+recall([57,56],'Ceiling and floor',up+down);
  if(known.has(62))return current('Signed steps accumulate into straight pieces.',area)+recall([61],'Circular projection',projection)+recall([60],'Step phase',shifting)+recall([59,58],'Step size and direction',sizing+direction)+recall([57,56],'Ceiling and floor',up+down);
  if(known.has(61))return current('Integer steps can drive a circular projection.',projection)+recall([60],'Step phase',shifting)+recall([59,58],'Step size and direction',sizing+direction)+recall([57,56],'Ceiling and floor',up+down);
  if(known.has(60))return current('Input shift sets step phase.',shifting)+recall([59],'Step width and height',sizing)+recall([58],'Rounding direction',direction)+recall([57,56],'Ceiling and floor',up+down);
  if(known.has(59))return current('Input and output scale change different step features.',sizing)+recall([58],'Rounding direction',direction)+recall([57,56],'Ceiling and floor',up+down);
  if(known.has(58))return current('Negation can reverse rounding direction.',direction)+recall([57,56],'Ceiling and floor',up+down);
  if(known.has(57))return current('Floor and ceiling share thresholds.',up)+recall([56],'Floor endpoint ownership',down);
  return current('Floor makes held integer steps.',down);
}

async function togetherReference(known:Set<number>,examples:ReferenceExamples) {
  const [slope,wave,steps,area,circle,fullWave,keptLobe]=await Promise.all([
    examples.example(50,'NAQD'),examples.example(4,'HS'),examples.example(4,'HF'),
    examples.example(4,'HFSI'),examples.circleExample('1','0','3/4'),
    examples.cropExample('0','4'),examples.cropExample('0','2')
  ]);
  const slopeCard=markers(32,34)+'<p>A flat place in an input is a zero in its derivative.</p>'+strip([slope.stages.at(-2)!,slope.stages.at(-1)!],['Input curve','Slope output'],[move('D')]);
  const waveCard=markers(50,54)+'<p>Sine reads input height as a circular phase.</p>'+strip([wave.stages.at(-2)!,wave.stages.at(-1)!],['Input phase','Circular height'],[move('S')]);
  const stepCard=markers(61,62)+'<p>Floor fixes jump positions; sine can map its integer heights; accumulation turns signed regions into a continuous total.</p>'+strip([steps.stages.at(-1)!,area.stages.at(-2)!,area.stages.at(-1)!],['Integer steps','Circular heights','Accumulated total'],[move('S'),move('I')]);
  const relationCard=markers(66)+'<p>A squared-height equation can return positive and negative heights of one magnitude.</p>'+circleSketch([circle],{centre:true,spoke:true,bounds:[-1,3,-2,2]})+`<p>${tex('h^2=\\frac9{16}-(x-1)^2')}</p>`;
  const cropCard='<p>Crop keeps a chosen horizontal interval and removes the rest of the drawing. It does not move the curve or change any retained height.</p>'+strip([finalDrawing(fullWave),finalDrawing(keptLobe)],['Whole wave: 0 to 4','Kept lobe: 0 to 2'],['<strong>Crop</strong>'])+`<p>${tex('0\\le x\\le2')}</p>`+tag(72);
  const moonCard="<p>The zeros of the right side set a loop's horizontal edges. Its maximum squared height sets its thickness, so a smaller maximum makes a thinner loop without moving those zeros. At one position, call the right-side value "+tex('a')+'.</p>'+circleSketch([circle],{centre:true,spoke:true,bounds:[-1,3,-2,2]})+`<p>${tex('h^2=a\\qquad h=\\pm\\sqrt a')}</p>`+tag(74);
  const rippleCard='<p>Changes before sine set phase and period. Changes afterward set amplitude and baseline. Crop then keeps the useful part without changing those fitted heights.</p>'+strip([wave.stages.at(-2)!,wave.stages.at(-1)!],['Input phase','Fitted wave height'],[move('S')])+tag(76);
  const artLessons:[number,string,string][]=[[72,'Crop changes extent, not height',cropCard]];
  if(known.has(73)) {
    const anchored=await examples.example(37,'I');
    const card='<p>Accumulation is still anchored at zero before the finished curve is cropped. The crop changes which part is drawn; it does not restart the accumulated amount at its left edge.</p>'+strip(anchored.stages,['Input','Area accumulated from zero'],[move('I')])+`<p>${tex('F(x)=\\int_0^x h(u)\\,\\mathrm{d}u')}</p>`+tag(73);
    artLessons.push([73,'Cropping does not move the area anchor',card]);
  }
  if(known.has(74))artLessons.push([74,'Zeros and squared height size a loop',moonCard]);
  if(known.has(75)) {
    const paired=await examples.example(66,'Q');
    const card='<p>A line can first become a nonnegative roof with two zeros. When the squared-height equation uses the square of that roof, its solved branches are positive and negative copies that meet at those zeros.</p>'+relationSketch(paired,'Copied roof branches make a pointed outline.')+tag(75);
    artLessons.push([75,'Build a pointed leaf from a roof',card]);
  }
  if(known.has(76))artLessons.push([76,'Fit a wave before framing it',rippleCard]);
  if(known.has(77)) {
    const [arch,broad,rounded,pointed]=await Promise.all([examples.example(8,'NA'),examples.example(13,'QNA'),examples.example(66,''),examples.example(66,'Q')]);
    const roofs=compare('A flatter bowl makes a broader roof.',[
      {label:'Familiar arch',stage:arch.stages.at(-1)!},
      {label:'Broader roof',stage:broad.stages.at(-1)!,before:arch.stages.at(-1)!}
    ],[],['Familiar arch','Broader roof']);
    const ends=diagramChoices('The final right side chooses the cap shape.',[
      {label:'Roof',html:relationSketch(rounded,'Square-root branches round the caps.')},
      {label:'Roof squared',html:relationSketch(pointed,'Copied branches meet in points.',{before:rounded})}
    ]);
    const card='<p>A flatter bowl can become a broader roof after turning and lifting. That controls the body. Separately, leaving a roof unsquared on the right of a squared-height equation makes square-root branches with rounded caps; squaring that final roof would make pointed ends.</p>'+roofs+ends+`<p>At one position, if the right-side roof has value ${tex('a')}, then ${tex('h^2=\\frac a4\\quad\\Longrightarrow\\quad |h|=\\frac{\\sqrt a}{2}')}. The square root belongs to the squared-height relation itself.</p>`+tag(77);
    artLessons.push([77,'Broadness, rounded caps and thickness are separate',card]);
  }
  const visibleArt=artLessons.filter(([id])=>known.has(id));
  if(!known.has(64)) {
    const lesson=visibleArt.pop()!;
    return current(lesson[1],lesson[2])+visibleArt.reverse().map(([id,title,body])=>recall([id],title,body)).join('');
  }
  const artRecall=visibleArt.reverse().map(([id,title,body])=>recall([id],title,body)).join('');
  const reading='<p>A long construction remains a sequence of familiar local relationships. Each Flow card names the incoming curve, the operation and its output.</p>'+viewButton('flow')+tag(64);
  if(known.has(67))return current('Mixed constructions are read one relationship at a time.',reading)+recall([66],'Paired magnitudes',relationCard)+recall([61,62],'Steps, projection and accumulation',stepCard)+recall([50,54],'Phase, amplitude and baseline',waveCard)+recall([32,34],'Slope and flat places',slopeCard)+artRecall;
  if(known.has(65))return current('Earlier relationships remain visible inside a composition.',reading)+recall([61,62],'Steps, projection and accumulation',stepCard)+recall([50,54],'Circular phase and output height',waveCard)+recall([66],'Paired magnitudes',relationCard)+recall([32,34],'Slope and flat places',slopeCard)+artRecall;
  return current('A composition can be inspected stage by stage.',reading)+recall([32,34],'Slope and flat places',slopeCard)+recall([50,54],'Circular phase and output height',waveCard)+recall([66],'Paired magnitudes',relationCard)+artRecall;
}
