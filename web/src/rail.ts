import type { State } from './types';

export type RailSlots=(string|null)[];

export function normalizeSlots(state:State,preferred?:RailSlots):RailSlots {
  if(state.circle)return [];
  const ids=state.nodes.map(node=>node.id),station=state.station;
  const size=state.mode==='remix'?ids.length+1:state.limit;
  const fit=(values:RailSlots,count:number)=>{
    const slots=[...values];
    while(slots.length>count){const hole=slots.lastIndexOf(null);if(hole<0)break;slots.splice(hole,1);}
    while(slots.length<count)slots.push(null);
    return slots;
  };
  let slots=(preferred||ids).map(id=>id&&ids.includes(id)?id:null);
  if(JSON.stringify(slots.filter(Boolean))!==JSON.stringify(ids))slots=[...ids];
  if(!station)return fit(slots,size);
  const at=slots.indexOf(station.id);
  return [...fit(slots.slice(0,at),station.before),station.id,...fit(slots.slice(at+1),station.after)];
}

// The fixed machine is a boundary, never a draggable slot. Reordering works on
// the movable positions and then puts the machine back at its reserved index.
const positions=(slots:RailSlots,state:State)=>slots.flatMap((_,i)=>i===state.station?.before?[]:[i]);
export function adjacentSlot(slots:RailSlots,state:State,from:number,direction:number) {
  const cells=positions(slots,state),index=cells.indexOf(from);
  return cells[Math.max(0,Math.min(cells.length-1,index+direction))];
}
export function movedSlots(slots:RailSlots,state:State,from:number,to:number):RailSlots|undefined {
  const cells=positions(slots,state),a=cells.indexOf(from),b=cells.indexOf(to);
  if(a<0||b<0||a===b)return;
  const values=cells.map(i=>slots[i]),id=values[a];
  if(id&&values[b]===null){values[a]=values[b];values[b]=id;}
  else {values.splice(a,1);values.splice(b,0,id);}
  const next=[...slots];cells.forEach((cell,i)=>next[cell]=values[i]);return next;
}
export function insertedSlots(slots:RailSlots,state:State,id:string,to:number):RailSlots|undefined {
  const cells=positions(slots,state),at=cells.indexOf(to);
  if(at<0)return;
  const values=cells.map(i=>slots[i]),right=values.indexOf(null,at),hole=right<0?values.lastIndexOf(null):right;
  if(hole<0)return;
  values.splice(hole,1);values.splice(at,0,id);
  const next=[...slots];cells.forEach((cell,i)=>next[cell]=values[i]);return next;
}
