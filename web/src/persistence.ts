import type { Artifact, State, View } from './types';
import type { RailSlots } from './rail';

export type Snapshot={state:State;slots:RailSlots};
export interface Seed { id:string;name:string;artifact:Artifact;snapshot?:Snapshot;view?:View;savedAt?:string }
export interface DeletedSeed extends Seed { deletedAt:string;deletedIndex:number }
export const seedStorageLimit=1024*1024;
export const isDeletedSeed=(seed:Seed|DeletedSeed):seed is DeletedSeed=>'deletedAt' in seed&&typeof seed.deletedAt==='string';

// IndexedDB is the only authority after each key's first read. Web Locks do
// not make process-local localStorage caches coherent (notably in WebKit).
// Keep raw legacy bytes, including unreadable data, until an explicit change.
export const deviceDatabase='angouri:device:v1',deviceStore='records';
type RawChange<T>={raw?:string|null;result:T;backup?:{key:string;raw:string}};
type LegacyStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export class DeviceStorageError extends Error {}
export class StorageTransactions {
  private pending=new Set<Promise<unknown>>();
  private database:Promise<IDBDatabase>|undefined;
  constructor(private factory:IDBFactory|undefined,private legacy:()=>LegacyStorage) {}
  private open():Promise<IDBDatabase> {
    if(!this.factory)return Promise.reject(new DeviceStorageError('Safe device storage is unavailable. Keep this recipe open and export progress.'));
    if(!this.database)this.database=new Promise<IDBDatabase>((resolve,reject)=>{
      const request=this.factory!.open(deviceDatabase,1);
      let failed=false;
      const fail=()=>{failed=true;this.database=undefined;reject(new DeviceStorageError('Device storage could not be opened. Keep this recipe open and export progress.'));};
      request.onupgradeneeded=()=>request.result.createObjectStore(deviceStore,{keyPath:'key'});
      request.onerror=fail;request.onblocked=fail;
      request.onsuccess=()=>{
        const database=request.result;
        if(failed){database.close();return;}
        database.onversionchange=()=>{database.close();this.database=undefined;};
        resolve(database);
      };
    });
    const opening=this.database;
    void opening.catch(()=>{if(this.database===opening)this.database=undefined;});
    return opening;
  }
  private transact<T>(key:string,change:((raw:string|null)=>RawChange<T>)|undefined):Promise<T|string|null> {
    const task=this.open().then(database=>new Promise<T|string|null>((resolve,reject)=>{
      let transaction:IDBTransaction;
      try{transaction=database.transaction(deviceStore,'readwrite');}
      catch{reject(new DeviceStorageError('Device storage could not be updated.'));return;}
      const store=transaction.objectStore(deviceStore);
      let result:T|string|null=null,raw:string|null=null,write=false,failure:unknown,backup:RawChange<T>['backup'];
      transaction.onabort=()=>reject(failure??new DeviceStorageError('Device storage could not be updated.'));
      transaction.onerror=()=>{}; // onabort reports the final atomic outcome.
      transaction.oncomplete=()=>{
        // A failed mirror must not turn a committed durable save into a reported
        // failure. No later read ever imports this compatibility copy again.
        if(write)try{if(raw===null)this.legacy().removeItem(key);else this.legacy().setItem(key,raw);}catch{}
        resolve(result);
      };
      const request=store.get(key);
      request.onsuccess=()=>{
        const record=request.result as {raw?:unknown}|undefined,existing=record!==undefined;
        try {
          raw=existing?record.raw as string|null:this.legacy().getItem(key);
          if(raw!==null&&typeof raw!=='string')throw new Error();
        }catch{failure=new DeviceStorageError('The saved device record could not be read. Keep this recipe open and export progress.');transaction.abort();return;}
        result=raw;
        if(change)try{const next=change(raw);result=next.result;backup=next.backup;if(next.raw!==undefined){raw=next.raw;write=true;}}
        catch(error){failure=error;transaction.abort();return;}
        // Two tabs racing their first access still migrate only once because
        // both the read and put belong to this same readwrite transaction.
        try{
          // add, rather than put, makes a retained recovery copy immutable.
          if(backup)store.add(backup);
          if(!existing||write){store.put({key,raw});write=true;}
        }catch{failure=new DeviceStorageError('Device storage could not be updated.');try{transaction.abort();}catch{}}
      };
    }));
    return this.track(task);
  }
  private track<T>(task:Promise<T>){
    this.pending.add(task);
    void task.then(()=>this.pending.delete(task),()=>this.pending.delete(task));
    return task;
  }
  read(key:string){return this.transact(key,undefined) as Promise<string|null>;}
  change<T>(key:string,change:(raw:string|null)=>RawChange<T>){return this.transact(key,change) as Promise<T>;}
  list(prefix:string):Promise<{key:string;raw:string}[]> {
    return this.track(this.open().then(database=>new Promise<{key:string;raw:string}[]>((resolve,reject)=>{
      let transaction:IDBTransaction;
      try{transaction=database.transaction(deviceStore,'readonly');}
      catch{reject(new DeviceStorageError('Saved recovery copies could not be read.'));return;}
      const request=transaction.objectStore(deviceStore).getAll(IDBKeyRange.bound(prefix,prefix+'\uffff'));
      transaction.onabort=()=>reject(new DeviceStorageError('Saved recovery copies could not be read.'));
      transaction.oncomplete=()=>resolve(request.result.filter(record=>typeof record.key==='string'&&record.key.startsWith(prefix)&&typeof record.raw==='string'));
    })));
  }
  async idle(){while(this.pending.size)await Promise.allSettled([...this.pending]);}
}

export function parseStored(raw:string|null,maxLength=65536):unknown {
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
