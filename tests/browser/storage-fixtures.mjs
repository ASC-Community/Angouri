export const STORAGE_KEYS={
  progress:'angouri:vine:v1:progress',
  seeds:'angouri:vine:v1:seeds',
  preferences:'angouri:vine:v1:preferences'
};

// Fixtures use the committed primary records, independently of the app's
// best-effort localStorage mirror. Preferences still belong to localStorage.
async function records(page,operation,key,raw,{mirror=true}={}) {
  return page.evaluate(({operation,key,raw,mirror})=>new Promise((resolve,reject)=>{
    const request=indexedDB.open('angouri:device:v1',1);
    request.onupgradeneeded=()=>{
      if(!request.result.objectStoreNames.contains('records'))request.result.createObjectStore('records',{keyPath:'key'});
    };
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(Error('The fixture database is blocked. Navigate other pages away before resetting storage.'));
    request.onsuccess=()=>{
      const db=request.result;
      db.onversionchange=()=>db.close();
      let transaction;
      try {transaction=db.transaction('records',operation==='read'?'readonly':'readwrite');}
      catch(error){db.close();reject(error);return;}
      const store=transaction.objectStore('records');
      let value=null;
      transaction.onabort=()=>{db.close();reject(transaction.error||Error('The fixture transaction was aborted.'));};
      transaction.onerror=()=>{};
      transaction.oncomplete=()=>{
        db.close();
        try {
          if(operation==='clear')localStorage.clear();
          else if(mirror&&operation==='write')raw===null?localStorage.removeItem(key):localStorage.setItem(key,raw);
          else if(mirror&&operation==='remove')localStorage.removeItem(key);
          resolve(value);
        }catch(error){reject(error);}
      };
      try {
        if(operation==='read')store.get(key).onsuccess=event=>{value=event.target.result?.raw??null;};
        else if(operation==='write')store.put({key,raw});
        else if(operation==='remove')store.delete(key);
        else store.clear();
      }catch(error){try{transaction.abort();}catch{}db.close();reject(error);}
    };
  }),{operation,key,raw,mirror});
}

export const readStorage=(page,key)=>records(page,'read',key);
export const writeStorage=(page,key,raw,options)=>records(page,'write',key,raw,options);
export const removeStorage=(page,key,options)=>records(page,'remove',key,undefined,options);
// Call from /about/ so an active game cannot enqueue another progress write.
export const clearStorage=page=>records(page,'clear');
export const readStoredJSON=async(page,key)=>JSON.parse(await readStorage(page,key));
export const writeStoredJSON=(page,key,value,options)=>writeStorage(page,key,JSON.stringify(value),options);
export const snapshotWithProgress=async(page,capture,field='progress')=>({
  ...await page.evaluate(capture),[field]:await readStorage(page,STORAGE_KEYS.progress)
});

export async function failStorageWrites(page,key) {
  await page.evaluate(key=>{
    window.restoreFixtureStorageWrites?.();
    const put=IDBObjectStore.prototype.put;
    window.restoreFixtureStorageWrites=()=>{IDBObjectStore.prototype.put=put;delete window.restoreFixtureStorageWrites;};
    IDBObjectStore.prototype.put=function(value,...args){
      if(this.name==='records'&&(key===undefined||value?.key===key)) {
        this.transaction.abort();
        throw new DOMException('Fixture storage failure','QuotaExceededError');
      }
      return put.call(this,value,...args);
    };
  },key);
}

export const restoreStorageWrites=page=>page.evaluate(()=>window.restoreFixtureStorageWrites?.());
