import initSqlJs from 'sql.js';
import sqliteWasm from 'sql.js/dist/sql-wasm.wasm?url';
import {SqlAdapter} from './sql-adapter.mjs';
import {ReviewStore} from './store.mjs';
import {DEFAULT_RULES,effectiveEncounters,encounterMetrics,safeCsv} from './analysis.mjs';
import {listLocal,readLocal,saveLocal,deleteLocal} from './local-files.mjs';
import {pack,unpack,sha256,anonymizeStore} from './web-package.mjs';
let SQL,current,currentId,parsing=false;
const progress=(phase,value,extra={})=>postMessage({type:'progress',phase,progress:value,...extra});
async function sql(){return SQL ||= await initSqlJs({locateFile:()=>sqliteWasm});}
function newStore(bytes){const store=new ReviewStore(new SqlAdapter(new SQL.Database(bytes)));if(bytes&&store.get('metadata')?.schemaVersion!==1){store.close();throw new Error('不支持的工程数据库版本');}return store;}
function requireStore(){if(!current)throw new Error('请先打开一场对局');return current;}
async function persist(store,id){await saveLocal({id,metadata:store.get('metadata'),modified:Date.now(),bytes:store.db.database.export()});}
async function adopt(store,id){await persist(store,id);current?.close();current=store;currentId=id;return store.summary();}
async function runtime(){
  // A dedicated Worker owns this runtime; do not let .NET classify our message handler as a pthread.
  globalThis.dotnetSidecar=true;
  const {dotnet}=await import(/* @vite-ignore */ new URL('_framework/dotnet.js',runtimeBase).href);
  const api=await dotnet.withDiagnosticTracing(false).withApplicationArguments([]).create();
  return api;
}
let runtimeBase;
async function importDemo(file,base){
 parsing=true;let store;
 try{
  if(file.size>1024**3)throw new Error('首期浏览器版支持最大 1 GiB 的 .dem 文件');
  const header=new Uint8Array(await file.slice(0,8).arrayBuffer());if(new TextDecoder().decode(header)!=='PBDEMS2\0')throw new Error('文件不是完整的 Source 2 demo，请选择原始 .dem');
  progress('runtime',0);await sql();store=newStore();
  runtimeBase=base;const rt=await runtime();
  const insert={player:store.db.prepare('INSERT OR REPLACE INTO players VALUES (?,?)'),frame:store.db.prepare('INSERT OR REPLACE INTO frames VALUES (?,?,?)'),event:store.db.prepare('INSERT INTO events VALUES (?,?,?,?)'),entity:store.db.prepare('INSERT INTO entity_updates(time,id,category,action,payload) VALUES (?,?,?,?,?)')};
  let count=0,metadata=null;
  store.db.exec('BEGIN');
  rt.setModuleImports('focus-lens',{
   records(lines){for(const line of lines.trimEnd().split('\n')){const record=JSON.parse(line);count++;switch(record.type){case 'player':insert.player.run(record.player.id,JSON.stringify(record.player));break;case 'frame':insert.frame.run(record.time,record.tick,line);break;case 'event':insert.event.run(record.id,record.time,record.kind,line);break;case 'entity':insert.entity.run(record.time,record.entity.id,record.entity.category,record.action,line);break;case 'metadata':metadata=record.metadata;break;} }},
   progress(value){progress('parse',value,{records:count});}
  });
  const exports=await rt.getAssemblyExports('Deadlock.Parser.dll');
  let bytes=new Uint8Array(await file.arrayBuffer());progress('read',0);const hash=await sha256(bytes);
  exports.BrowserBridge.Allocate(bytes.length);const view=exports.BrowserBridge.Input();view.set(bytes);view.dispose();bytes=null;
  progress('parse',0);const result=JSON.parse(await exports.BrowserBridge.Parse(file.name,hash));
  if(!metadata||metadata.decodeErrors!==0||result.decodeErrors!==0)throw new Error('录像未完整解析或含解码错误，未发布部分结果');
  store.set('metadata',metadata);store.db.exec('COMMIT');progress('index',99,{records:count});store.analyze();
  const summary=await adopt(store,crypto.randomUUID());store=null;progress('complete',100);return summary;
 }finally{parsing=false;store?.close();}
}
async function importFile(file,base){if(parsing)throw new Error('已有解析任务');if(file.name.toLowerCase().endsWith('.dem'))return importDemo(file,base);if(!file.name.toLowerCase().endsWith('.dlreview'))throw new Error('请选择 .dem 或 .dlreview');if(file.size>512*1024**2)throw new Error('复盘工程超过 512 MiB 限制');progress('open',0);await sql();const store=newStore(await unpack(new Uint8Array(await file.arrayBuffer())));try{const result=await adopt(store,crypto.randomUUID());progress('complete',100);return result;}catch(e){store.close();throw e;}}
function validAnnotation(a){if(!a||typeof a.id!=='string'||!['bookmark','encounter','manual-encounter'].includes(a.kind)||typeof a.text!=='string'||a.text.length>10000)throw new Error('批注格式无效或超过 10000 字');if(a.kind==='bookmark'&&(!Number.isFinite(a.time)||a.time<0))throw new Error('书签时间无效');if(a.override&&(!Number.isFinite(a.override.start)||!Number.isFinite(a.override.end)||a.override.start<0||a.override.end<a.override.start))throw new Error('片段时间范围无效');return a;}
async function invoke(method,args={}){
 await sql();
 if(method==='list')return listLocal();
 if(method==='deleteMatch'){if(args.id===currentId)throw new Error('请先打开其他对局再删除当前档案');await deleteLocal(args.id);return listLocal();}
 if(method==='import')return importFile(args.file,args.runtimeBase);
 if(method==='open'){const record=await readLocal(args.id);if(!record)throw new Error('本地档案不存在，可能已被清理');const next=newStore(record.bytes);current?.close();current=next;currentId=args.id;return next.summary();}
 const s=requireStore();
 switch(method){
 case 'summary':return s.summary();
 case 'window':{const from=Number(args.from),to=Number(args.to);if(!Number.isFinite(from)||!Number.isFinite(to)||from<0||to<from)throw new Error('时间范围无效');const end=Math.min(to,from+90),frames=s.frames(from,end),prior=s.frame(from);if(prior&&prior.time<from)frames.unshift(prior);return {frames,entities:s.entities(from,args.categories),updates:s.db.prepare('SELECT payload FROM entity_updates WHERE time>? AND time<=? ORDER BY seq').all(from,end).map(r=>JSON.parse(r.payload)).filter(r=>!args.categories?.length||args.categories.includes(r.entity.category))};}
 case 'history':return s.history(args.id);
 case 'encounterMetrics':return encounterMetrics(args.encounter,s.events(),s.players(),s.get('metadata').capabilities);
 case 'annotate':{const result=s.saveAnnotation(validAnnotation(args.annotation));await persist(s,currentId);return result;}
 case 'deleteAnnotation':{const result=s.deleteAnnotation(String(args.id));await persist(s,currentId);return result;}
 case 'analyze':{const rules={...DEFAULT_RULES,...args.rules};if(![2,3,4,5,6].includes(rules.minPerTeam)||!Number.isFinite(rules.gapSeconds)||rules.gapSeconds<3||rules.gapSeconds>60)throw new Error('团战人数须为 2–6，间隔须为 3–60 秒');const result=s.analyze(rules);await persist(s,currentId);return result;}
 case 'exportJson':{const summary=s.summary();return JSON.stringify({...summary,effectiveEncounters:effectiveEncounters(summary.encounters,summary.annotations).map(e=>({...e,playerMetrics:encounterMetrics(e,summary.events,summary.players,summary.metadata.capabilities)}))},null,2);}
 case 'exportCsv':{const names=new Map(s.players().map(p=>[p.id,p.name]));return safeCsv(s.events().filter(e=>!['damage','heal','healing_total'].includes(e.kind)).map(e=>({time:e.time,clock:e.clock,kind:e.kind,actor:names.get(e.actor),target:names.get(e.target),team:e.team,quality:e.quality,source:e.source,detail:JSON.stringify(e.detail)})),['time','clock','kind','actor','target','team','quality','source','detail']);}
 case 'exportPackage':{let copy;try{copy=args.anonymous?newStore(s.db.database.export()):s;if(args.anonymous)anonymizeStore(copy);return await pack(copy.db.database.export(),copy.get('metadata'),!!args.anonymous);}finally{if(copy&&copy!==s)copy.close();}}
 default:throw new Error('Web 版不支持此操作');
 }
}
// Serialize all mutations and reads so imports never race with replay requests.
let queue=Promise.resolve();
self.onmessage=({data:{id,method,args}})=>{queue=queue.then(async()=>{try{const result=await invoke(method,args);postMessage({id,result});}catch(e){const message=e?.name==='QuotaExceededError'?'浏览器本地空间不足，请清理本站档案后重试':e?.message||String(e);postMessage({id,error:message});}});};
