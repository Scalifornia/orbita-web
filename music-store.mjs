/** User music stays on this device; no uploads to a server. */
async function database() {
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open('boring-office-music',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('files');
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });
}
async function access(write,file) {
 const db=await database();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction('files',write?'readwrite':'readonly'),store=tx.objectStore('files');
  const request=write?(file?store.put(file,'selected'):store.delete('selected')):store.get('selected');
  tx.oncomplete=()=>resolve(write?true:request.result || null);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });}finally{db.close();}
}
export async function saveMusicFile(file){try{return await access(true,file);}catch{return false;}}
export async function loadMusicFile(){try{return await access(false);}catch{return null;}}
