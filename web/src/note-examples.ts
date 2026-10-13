import type { Kernel } from './engine';
import type { ReferenceExamples } from './reference';
import type { Op, Result, State } from './types';

type Reader=()=>boolean;
interface Entry<T> { promise:Promise<T>; readers:Set<Reader>; complete:boolean }
type Cache<T>=Map<string,Entry<T>>;
const cancelled=()=>new Error('Reference request superseded');
export interface NoteExampleReader extends ReferenceExamples { puzzle(sourceId:number):Promise<Result> }

/** Examples never enter the player's state. Only queued reference work can be cancelled. */
export class NoteExamples {
  private starts:Cache<{state:State;result:Result}>=new Map();
  private results:Cache<Result>=new Map();
  private queued:Promise<void>=Promise.resolve();

  constructor(private kernel:Pick<Kernel,'run'>) {}

  forReader(active:Reader):NoteExampleReader {
    return {
      example:(source,ops)=>this.example(source,ops,active),
      circleExample:(x,y,radius,goals=[])=>this.circleExample(x,y,radius,goals,active),
      puzzle:source=>this.cached(this.results,`puzzle:${source}`,active,needed=>this.run(needed,async()=>{
        const reply=await this.kernel.run(undefined,{type:'level',sourceId:source,mode:'puzzle'});
        if(reply.status!=='ok'||!reply.result)throw new Error('Puzzle targets unavailable');
        return reply.result;
      }))
    };
  }

  private cached<T>(cache:Cache<T>,key:string,active:Reader,load:(needed:Reader)=>Promise<T>):Promise<T> {
    if(!active())return Promise.reject(cancelled());
    let entry=cache.get(key);
    if(!entry) {
      const readers=new Set([active]);
      const needed=()=>[...readers].some(reader=>reader());
      entry={readers,complete:false,promise:Promise.resolve().then(()=>{
        if(!needed())throw cancelled();
        return load(needed);
      })};
      const pending=entry;
      cache.set(key,pending);
      void pending.promise.then(()=>{pending.complete=true;readers.clear();},()=>{
        if(cache.get(key)===pending)cache.delete(key);
        readers.clear();
      });
    } else if(!entry.complete) {
      for(const reader of entry.readers)if(!reader())entry.readers.delete(reader);
      entry.readers.add(active);
    }
    return entry.promise.then(value=>{
      if(!active())throw cancelled();
      return value;
    });
  }

  private run<T>(active:Reader,work:()=>Promise<T>):Promise<T> {
    const job=this.queued.then(()=>{
      if(!active())throw cancelled();
      return work();
    });
    // Keep one reference calculation in flight. A closed or superseded reader
    // leaves its current calculation alone and cannot start the next one.
    this.queued=job.then(()=>{},()=>{});
    return job;
  }

  private start(sourceId:number,active:Reader) {
    return this.cached(this.starts,String(sourceId),active,needed=>this.run(needed,async()=>{
      const initial=await this.kernel.run(undefined,{type:'level',sourceId,mode:'remix'});
      if(initial.status!=='ok'||!initial.state||!initial.result)throw new Error('Example unavailable');
      return {state:initial.state,result:initial.result};
    }));
  }

  private example(sourceId:number,ops:string,active:Reader) {
    return this.cached(this.results,`${sourceId}:${ops}`,active,async needed=>{
      const initial=await this.start(sourceId,needed);
      if(!ops)return initial.result;
      const state={...initial.state,nodes:[...ops].map((op,i)=>({id:`note-${i}`,op:op as Op}))};
      return this.run(needed,async()=>{
        const reply=await this.kernel.run(state,{type:'evaluate'});
        if(reply.status!=='ok'||!reply.result)throw new Error('Example unavailable');
        return reply.result;
      });
    });
  }

  private circleExample(x:string,y:string,radius:string,goals:string[][],active:Reader) {
    return this.cached(this.results,`circle:${x}:${y}:${radius}:${JSON.stringify(goals)}`,active,async needed=>{
      const initial=await this.start(43,needed);
      const state={...initial.state,circle:{x,y,radius},mode:goals.length?'challenge' as const:'remix' as const,goals:goals.map(([x,y])=>({x,y}))};
      return this.run(needed,async()=>{
        const reply=await this.kernel.run(state,{type:'evaluate'});
        if(reply.status!=='ok'||!reply.result?.circle)throw new Error('Circle example unavailable');
        return reply.result;
      });
    });
  }
}
