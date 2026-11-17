import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
export const MAX_DATABASE=512*1024**2;
export async function sha256(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function unpack(bytes){let total=0;const files=unzipSync(bytes,{filter:file=>{if(!['manifest.json','analysis.db'].includes(file.name))return false;total+=file.originalSize;if(file.originalSize>MAX_DATABASE||total>MAX_DATABASE+1048576)throw new Error('工程解压后超过 512 MiB 限制');return true;}});const manifest=JSON.parse(strFromU8(files['manifest.json']||new Uint8Array()));const db=files['analysis.db'];if(manifest.format!=='deadlock-review'||manifest.version!==1||!db||db.length!==manifest.files?.['analysis.db']?.bytes||await sha256(db)!==manifest.files['analysis.db'].sha256)throw new Error('工程格式或 SHA256 校验失败');return db;}
export async function pack(db,metadata,anonymized=false){const manifest={format:'deadlock-review',version:1,exportedAt:new Date().toISOString(),anonymized,files:{'analysis.db':{bytes:db.length,sha256:await sha256(db)}},metadata:{build:metadata.build,mapVersion:metadata.mapVersion}};return zipSync({'manifest.json':strToU8(JSON.stringify(manifest,null,2)),'analysis.db':db},{level:6});}
export function anonymizeStore(store){
const players=store.players(),aliases=new Map(players.map((p,i)=>[p.id,`player-${i+1}`]));
const remap=v=>typeof v==='string'?[...aliases].reduce((text,[old,next])=>text.replaceAll(old,next),v):Array.isArray(v)?v.map(remap):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,remap(x)])):v;
store.db.exec('BEGIN');try{for(const table of ['players','frames','events','entity_updates','annotations'])for(const row of store.db.prepare(`SELECT rowid AS _rowid,payload FROM ${table}`).all()){
const p=remap(JSON.parse(row.payload));if(table==='players'){p.name=`玩家 ${players.findIndex(x=>aliases.get(x.id)===p.id)+1}`;p.steamId='';}if(table==='annotations'){p.text='';if(p.override){p.override.note='';p.override.title='人工标记片段';}}
store.db.prepare(`UPDATE ${table} SET payload=? WHERE rowid=?`).run(JSON.stringify(p),row._rowid);
}for(const table of ['players','events','annotations'])for(const row of store.db.prepare(`SELECT rowid AS _rowid,id FROM ${table}`).all())store.db.prepare(`UPDATE ${table} SET id=? WHERE rowid=?`).run(remap(row.id),row._rowid);
for(const row of store.db.prepare('SELECT key,value FROM meta').all())store.set(row.key,remap(JSON.parse(row.value)));
const meta=store.get('metadata');meta.source={bytes:meta.source.bytes,anonymized:true};delete meta.download;store.set('metadata',meta);store.db.exec('COMMIT;VACUUM');}catch(e){store.db.exec('ROLLBACK');throw e;}}
