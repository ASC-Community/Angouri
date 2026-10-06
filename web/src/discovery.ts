import { icon } from './icons';
import { operationTex, tex } from './views';
import { circleEdited } from './circle';
import type { Op, Result, State } from './types';

/** First encounters explain the move the player actually made, not a recipe to try. */
export function isDiscovery(state:State) {
  return state.mode==='puzzle'&&(!state.circle&&!state.station&&state.limit===1||[32,37,43,44,69].includes(state.sourceId));
}
export function discoveryObservation(state:State,result:Result,selected?:string) {
  if(!isDiscovery(state))return '';
  if(state.circle)return circleEdited(state,result)?`${icon(state.sourceId===43?'resize':'move',16)}<span>${state.sourceId===43?'A larger radius reaches farther in every direction.':'Moving the centre moves the whole loop.'}</span>`:'';
  const edits=state.nodes.filter(node=>node.id!==state.station?.id);
  if(!edits.length)return '';
  const current=edits.find(node=>node.id===selected)??edits.at(-1)!;
  const op=current.op;
  let finding='';
  if(state.sourceId===32) {
    const before=state.nodes.indexOf(current)<state.nodes.findIndex(node=>node.id===state.station!.id);
    finding=op==='N'?before?'Negating the input reverses each slope.':'Negating the output reverses its heights.':before?'Lift the input: its slopes stay the same.':'Lift the output: the new heights rise.';
  }
  else if(state.sourceId===37)finding=state.nodes.indexOf(current)<state.nodes.findIndex(node=>node.id===state.station!.id)?'Taller input: more area over the same distance.':'Lift the output: a new starting height, the same growth.';
  else if(result.relation) {
    const effects:Partial<Record<Op,string>>={
      A:`Adds to ${tex('h^2')}. The two heights move apart.`,
      H:`${tex('h^2')} halves; ${tex('|h|')} scales by ${tex('1/\\sqrt2')}.`,
      N:'The sign changes. Real heights appear where the right side is nonnegative.',
      Q:'Squaring restores both signs of the incoming magnitude, including outside the old loop.'
    };
    finding=state.sourceId===69&&edits.every(node=>node.op==='H')&&edits.length===2?`Two halves of ${tex('h^2')} make one half of ${tex('|h|')}.`:effects[op]??'';
  } else {
    const effects:Record<Op,string>={
      A:'Every height rises equally. The gaps stay the same.',H:'Heights halve. The zeros stay put.',
      N:'Opposite side of zero. Same distances.',Q:state.sourceId===29?'A cubic squared makes a sixth power.':state.sourceId===12?'Between zero and one, squaring brings heights closer to zero.':'Opposite heights meet above zero.',
      D:'Downhill, flat, uphill become negative, zero, positive.',I:'Positive area adds; negative area subtracts.',
      S:`One input unit is a quarter-turn: ${tex('0,1,0,-1,0')}.`,
      F:'Down to the whole step. Whole numbers stay put.',C:'Up to the whole step. Whole numbers stay put.'
    };
    finding=effects[op];
  }
  return finding?`<span class="discovery-operation" aria-hidden="true">${operationTex(op)}</span><span>${finding}</span>`:'';
}
