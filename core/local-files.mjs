const NAME='focus-lens-web-v1';
function database(){return new Promise((resolve,reject)=>{const request=indexedDB.open(NAME,1);request.onupgradeneeded=()=>request.result.createObjectStore('matches',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
export async function localRequest(mode,fn){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('matches',mode);let result;const request=fn(tx.objectStore('matches'));request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('本地存储已中止'));});}finally{db.close();}}
export async function listLocal(){const rows=await localRequest('readonly',s=>s.getAll());return rows.map(({id,metadata,modified})=>({id,metadata,modified})).sort((a,b)=>b.modified-a.modified);}
export async function readLocal(id){const record=await localRequest('readonly',s=>s.get(id));if(record?.bytes instanceof Blob)record.bytes=new Uint8Array(await record.bytes.arrayBuffer());return record;}
export const saveLocal=record=>localRequest('readwrite',s=>s.put({...record,bytes:new Blob([record.bytes],{type:'application/vnd.sqlite3'})}));
export const deleteLocal=id=>localRequest('readwrite',s=>s.delete(id));
