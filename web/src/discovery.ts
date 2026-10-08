import { icon } from './icons';
import { operationTex, tex } from './views';
import { circleEdited } from './circle';
import { OPS, type Op, type Result, type State } from './types';

// These authored comparisons are easy to enumerate. Teach through the actual
// arrangement; completing them alone does not establish understanding.
// Keep classification stable through edits (see docs/learning-path.md).
const discoveryPuzzles = new Set([
  1,2,3,24, 6,8,9, 7,10,27, 12,13,29,30,
  32,33,34,35, 37,38,39,40,41,
  43,44,48,78,68,69,70,66,
  50,51,52,79,81,53,54,80,84,
  56,57,58,59,60,61,62, 82,72,83,
  // The same policy applies to short optional calculus comparisons.
  14,5,16,19,17,20,21
]);

/** Explain an accepted experiment; leave plans for the larger puzzles in Hints. */
export function isDiscovery(state:State) {
  return state.mode==='puzzle'&&discoveryPuzzles.has(state.sourceId);
}

// These describe adjacent stages, never the whole recipe after later blocks.
const pairFindings:Partial<Record<string,string>>={
  AH:'The lift is halved too, leaving half the added height of the reverse order.',
  HA:'The lift comes after Halve, so the added unit stays whole.',
  AN:'Negate reverses the lift too: that added unit now points downward.',
  NA:'Negate turns the shape over; the following lift raises it again.',
  HQ:'Halving before Square quarters the squared result.',
  QH:'Squaring first, then halving, halves the squared result.',
  AQ:'The lift changes which incoming height folds to zero when squared.',
  QA:'The square is nonnegative; this lift puts its zeros one unit above zero.',
  NQ:'Square gives opposite inputs the same result, so this preceding Negate has no effect on it.',
  QN:'Negate turns the squared result below zero. Its zeros stay put.',
  DI:'Accumulating slopes recovers change from the original height at zero.',
  ID:'Find slope recovers the heights that entered Accumulate.',
  AF:'A whole-unit lift before Floor also lifts its rounded result by one.',
  FA:'Lifting after Floor raises the steps without moving their thresholds.',
  HF:'Halving before Floor spreads this line’s thresholds farther apart.',
  FH:'Halving after Floor halves the step heights without moving their thresholds.'
};

type Finding={text:string;indices:number[]};
function explicitFinding(state:State,index:number):string|Finding|undefined {
  const ops=state.nodes.map(node=>node.op),op=ops[index],before=ops.slice(0,index),after=ops.slice(index+1);
  // Height's short experiments track the selected lift through every later
  // halve. This is the authored operation identity, not a curve evaluator.
  if([3,24].includes(state.sourceId)&&op==='A') {
    const halves=after.filter(next=>next==='H').length;
    return halves===0?'No Halve follows this lift: it adds a whole unit to the final height.'
      :halves===1?`One later Halve makes this lift contribute ${tex('\\frac12')} to the final height.`
      :`Two later Halves make this lift contribute ${tex('\\frac14')} to the final height.`;
  }
  // The signed-step lesson compares the order of two movable operations before
  // its fixed accumulator. Describe the actual order, not a recipe to copy.
  if(state.sourceId===62&&ops.includes('F')&&ops.includes('S'))return ops.indexOf('F')<ops.indexOf('S')
    ?'Sine reads rounded inputs. Accumulate follows those step heights as slopes.'
    :'Floor rounds the wave into signed steps. Their signs make the accumulated path rise, hold or fall.';
  if(state.sourceId===61)return `Sine maps the integer steps through the repeating heights ${tex('0,1,0,-1')}.`;
  if(state.sourceId===58)return before.includes('F')
    ?'Negating the rounded steps reverses their heights; each closed endpoint stays at the same horizontal position.'
    :'Negating before Floor reverses the steps and changes which end of each step is closed.';

  const derivative=ops.indexOf('D');
  if(derivative>=0&&op==='A'&&index<derivative&&!after.slice(0,derivative-index-1).some(next=>next==='Q'||next==='I'))
    return 'Lift the input: its slopes stay the same.';
  if(state.sourceId===34&&op==='A'&&index<derivative&&after.slice(0,derivative-index-1).includes('Q'))
    return 'The lift moves the line’s zero. Square folds there; Find slope marks that flat place with zero.';
  if(derivative>=0&&op==='Q')return index<derivative
    ?state.sourceId===35?'Squaring makes the roof’s zero-height ends flat too. Find slope reads three flat places as zeros.'
      :'Squaring makes a flat place at the incoming zero. Find slope reads that flat place as zero.'
    :'Squaring the slopes folds negative values upward. Their zeros stay fixed.';
  if(state.sourceId===41&&op==='A'&&after.join('')==='ID')return 'Accumulate followed by Find slope preserves this input lift.';

  // A neighboring pair describes the actual order even on either side of a
  // station (for example Add then Halve in a sine input).
  const nextPair=pairFindings[op+(after[0]??'')],previousPair=pairFindings[(before.at(-1)??'')+op];
  if(nextPair)return {text:nextPair,indices:[index,index+1]};
  if(previousPair)return {text:previousPair,indices:[index-1,index]};
  const sine=ops.indexOf('S');
  if(sine>=0&&op!=='S') {
    const input=index<sine;
    if(op==='A')return input?'Lifting the input advances the turn and shifts Sine’s wave sideways.'
      :'The lift raises the wave’s baseline without changing its repeat distance.';
    if(op==='H')return input?'The halved input turns half as far over the same horizontal distance. Sine’s wave spreads out.'
      :'Halve shrinks the wave’s height range without changing its repeat distance.';
    if(op==='Q')return input?'A steeper input turns the circle farther over the same distance. The crests crowd closer.'
      :'Squaring the output folds the lobes upward. Their zero positions stay fixed.';
    if(op==='N')return 'Negating after Sine turns its peaks into troughs and keeps its zeros.';
  }

  if(derivative>=0&&op==='A'&&index>derivative&&!before.includes('I'))return 'Lift the output: the new heights rise.';

  const integral=ops.indexOf('I');
  if(integral>=0&&op==='A')return index<integral
    ?state.sourceId===38?'Lifting the input moves its zero, and with it the accumulated path’s turning point.'
      :'Lifting the input adds a strip of positive area over the same distance.'
    :'Lift the output: a new starting height, the same growth.';
  if(integral>=0&&op==='H')return 'Halving the input or the accumulated result halves the change from its starting height.';
  if(integral>=0&&op==='N')return index<integral
    ?'Negating the input reverses which areas add and which subtract.'
    :'Negating the accumulated result reverses its heights.';
  if(op==='S')return 'Sine turns the incoming values around a circle; blocks before it shape the turn, blocks after it shape the heights.';
  return undefined;
}

export function discoveryObservation(state:State,result:Result,selected?:string) {
  if(!isDiscovery(state))return '';
  if(state.circle)return circleEdited(state,result)?`${icon(state.sourceId===43?'resize':'move',16)}<span>${state.sourceId===43?'A larger radius reaches farther in every direction.':'Moving the centre moves the whole loop.'}</span>`:'';
  const edits=state.nodes.filter(node=>node.id!==state.station?.id);
  if(!edits.length)return '';
  const current=edits.find(node=>node.id===selected)??edits.at(-1)!;
  const op=current.op;
  let finding:string|Finding='';
  if(state.sourceId===32) {
    const before=state.nodes.indexOf(current)<state.nodes.findIndex(node=>node.id===state.station!.id);
    finding=op==='N'?before?'Negating the input reverses each slope.':'Negating the output reverses its heights.':before?'Lift the input: its slopes stay the same.':'Lift the output: the new heights rise.';
  }
  else if(state.sourceId===37)finding=state.nodes.indexOf(current)<state.nodes.findIndex(node=>node.id===state.station!.id)?'Taller input: more area over the same distance.':'Lift the output: a new starting height, the same growth.';
  else if(result.relation) {
    const effects:Partial<Record<Op,string>>={
      A:`Adds one to ${tex('h^2')}. Existing real heights move farther from zero; new real heights can appear.`,
      H:`${tex('h^2')} halves; ${tex('|h|')} scales by ${tex('1/\\sqrt2')}.`,
      N:'The sign changes. Real heights appear where the right side is nonnegative.',
      Q:'Squaring the right side gives both signs of the incoming value’s magnitude as real heights.'
    };
    finding=state.sourceId===78&&op==='A'&&state.nodes.indexOf(current)<state.nodes.findIndex(node=>node.id===state.station!.id)
      ?'Lifting the line before Square moves its zero sideways. The fold moves with it.'
      :state.sourceId===83&&op==='Q'
      ?'The tips stay at zero and the peaks keep unit magnitude. Squaring draws the shoulders inward; the two branches form one pointed petal.'
      :state.sourceId===66&&op==='Q'
      ?'The solved heights change from square roots of the roof to positive and negative copies of it. The rounded ends become pointed.'
      :state.sourceId===69&&edits.every(node=>node.op==='H')&&edits.length===2?{text:`Two halves of ${tex('h^2')} make one half of ${tex('|h|')}.`,indices:state.nodes.map((_,i)=>i)}:effects[op]??'';
  } else {
    const effects:Record<Op,string>={
      A:'Every height rises equally. The gaps stay the same.',H:'Heights halve. The zeros stay put.',
      N:'Opposite side of zero. Same distances.',Q:state.sourceId===29?'A cubic squared makes a sixth power.':state.sourceId===12?'Between zero and one, squaring brings heights closer to zero.':'Opposite heights meet above zero.',
      D:'Downhill, flat, uphill become negative, zero, positive.',I:'Positive area adds; negative area subtracts.',
      S:`One input unit is a quarter-turn: ${tex('0,1,0,-1,0')}.`,
      F:'Round down to an integer. Integers stay unchanged.',C:'Round up to an integer. Integers stay unchanged.'
    };
    finding=state.sourceId===82
      ?op==='H'?'The straight line stays planted at zero while its rise over each horizontal interval is halved.':'The straight line rises without changing its inclination, so it no longer starts at zero.'
      :state.sourceId===80&&op==='Q'?'Zero and one stay fixed. Squaring lowers the heights between them, so matching peaks alone does not determine a curve.'
      :explicitFinding(state,state.nodes.indexOf(current))??effects[op];
  }
  if(!finding)return '';
  const {text,indices}=typeof finding==='string'?{text:finding,indices:[state.nodes.indexOf(current)]}:finding;
  const label=indices.map(index=>`Block ${index+1}: ${OPS[state.nodes[index].op].name}`).join('; then ');
  const blocks=indices.map(index=>{const operation=state.nodes[index].op;return `<span class="discovery-operation ${OPS[operation].color}" aria-hidden="true">${operationTex(operation)}</span>`;}).join(`<span class="discovery-order" aria-hidden="true">${icon('arrow',12)}</span>`);
  return `<span class="discovery-operations" role="img" aria-label="${label}" title="${label}">${blocks}</span><span>${text}</span>`;
}
