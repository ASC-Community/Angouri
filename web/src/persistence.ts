import type { Artifact, State, View } from './types';
import type { RailSlots } from './rail';

export type Snapshot={state:State;slots:RailSlots};
export interface Seed { id:string;name:string;artifact:Artifact;snapshot?:Snapshot;view?:View;savedAt?:string }
export interface DeletedSeed extends Seed { deletedAt:string;deletedIndex:number }
export const seedStorageLimit=1024*1024;
export const isDeletedSeed=(seed:Seed|DeletedSeed):seed is DeletedSeed=>'deletedAt' in seed&&typeof seed.deletedAt==='string';

// A lock covers only the synchronous read/modify/write, never a kernel request
// or a dialog. No unlocked fallback may report success while losing other tabs.
export class StorageTransactions {
  private pending=new Set<Promise<unknown>>();
  constructor(private locks:Pick<LockManager,'request'>|undefined) {}
  run<T>(key:string,work:()=>T):Promise<T> {
    if(!this.locks)return Promise.reject(new Error('Safe device storage is unavailable. Keep this recipe open and export progress.'));
    const task=this.locks.request(key,work);
    this.pending.add(task);
    void task.then(()=>this.pending.delete(task),()=>this.pending.delete(task));
    return task;
  }
  async idle(){await Promise.allSettled([...this.pending]);}
}

export function readStored(storage:Pick<Storage,'getItem'>,key:string,maxLength=65536):unknown {
  const raw=storage.getItem(key);
  if(raw===null)return undefined;
  if(raw.length>maxLength)throw new Error('The saved data is too large to update safely. Export it before changing it.');
  try{return JSON.parse(raw);}catch{throw new Error('The saved data could not be read. Keep this recipe open and export progress.');}
}

// Old arrays have no IDs. Derive the same ID in every tab until the first
// transaction persists it. Occurrence numbers retain identical old entries.
function legacyId(value:unknown) {
  let hash=0xcbf29ce484222325n;
  for(const character of JSON.stringify(value)){hash^=BigInt(character.codePointAt(0)!);hash=BigInt.asUintN(64,hash*0x100000001b3n);}
  return `legacy-${hash.toString(16)}`;
}
export function readLibrary(value:unknown) {
  if(value!==undefined&&!Array.isArray(value))throw new Error('This saved library cannot be updated by this version. Export progress before continuing.');
  const ids=new Set<string>(),seeds:Seed[]=[],deleted:DeletedSeed[]=[],other:unknown[]=[];
  for(const valueEntry of value??[] as unknown[]) {
    const entry=valueEntry as Seed;
    if(!entry||typeof entry.name!=='string'||entry.name.length>60||entry.artifact?.type!=='creation'){other.push(valueEntry);continue;}
    let id=typeof entry.id==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(entry.id)?entry.id:legacyId(entry);
    if(ids.has(id)){const base=legacyId(entry);let occurrence=1;do{id=`${base}-${occurrence++}`;}while(ids.has(id));}
    ids.add(id);
    const seed={...entry,id};
    if(isDeletedSeed(seed))deleted.push(seed);else seeds.push(seed);
  }
  return {seeds,deleted,other};
}
export type LibraryMutation=
  |{type:'save';seed:Seed}
  |{type:'rename';id:string;name:string}
  |{type:'delete';id:string;at:string}
  |{type:'restore';id:string}
  |{type:'purge';id:string};
export function mutateLibrary(value:unknown,action:LibraryMutation) {
  const {seeds,deleted,other}=readLibrary(value);
  let changed:Seed|undefined;
  if(action.type==='save'||action.type==='restore') {
    if(seeds.length>=12)throw new Error(action.type==='save'?'Your library is full. Delete a saved recipe to make room. Its Undo stays available in Save & open.':'Your library is full. Delete another saved recipe, then retry Undo.');
  }
  if(action.type==='save') {
    if([...seeds,...deleted].some(seed=>seed.id===action.seed.id))throw new Error('This recipe is already saved. Reopen Save & open to see it.');
    changed=action.seed;seeds.push(changed);
  } else if(action.type==='rename'||action.type==='delete') {
    const index=seeds.findIndex(seed=>seed.id===action.id);
    if(index<0)throw new Error('This recipe was deleted in another tab. Undo its deletion before changing it.');
    if(action.type==='rename') {
      const name=action.name.trim().slice(0,60);
      if(!name)throw new Error('Enter a recipe name.');
      changed={...seeds[index],name};seeds[index]=changed;
    } else {
      changed=seeds.splice(index,1)[0];deleted.unshift({...changed,deletedAt:action.at,deletedIndex:index});
    }
  } else {
    const index=deleted.findIndex(seed=>seed.id===action.id);
    if(index<0)throw new Error('This recovery copy changed in another tab. Reopen Save & open to see its current location.');
    const {deletedAt,deletedIndex,...seed}=deleted.splice(index,1)[0];changed=seed;
    if(action.type==='restore')seeds.splice(Number.isInteger(deletedIndex)?Math.max(0,Math.min(deletedIndex,seeds.length)):seeds.length,0,seed);
  }
  // Unknown rows belong to newer/older versions; changing a known row must
  // retain them. Never truncate an oversized active library on read or write.
  const entries=[...seeds,...deleted,...other];
  if(JSON.stringify(entries).length>seedStorageLimit)throw new Error('This library has reached its storage limit. Permanently delete an unwanted recovery copy, then try again.');
  return {entries,changed};
}

export interface CompletionRecord {progressEpoch:string;completed:number[]}
export function completionRecord(value:unknown):CompletionRecord {
  const save=value as Partial<CompletionRecord>|undefined;
  return {progressEpoch:typeof save?.progressEpoch==='string'?save.progressEpoch:'legacy',completed:Array.isArray(save?.completed)?save.completed.filter(id=>Number.isInteger(id)&&id>0):[]};
}
export function mergeCompletions(current:CompletionRecord,epoch:string,additions:Iterable<number>):CompletionRecord {
  return {progressEpoch:current.progressEpoch,completed:[...new Set([...current.completed,...(current.progressEpoch===epoch?additions:[])])]};
}
