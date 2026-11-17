import test from 'node:test';
import assert from 'node:assert/strict';
import initSql from 'sql.js';
import {SqlAdapter} from '../core/sql-adapter.mjs';
import {ReviewStore} from '../core/store.mjs';
import {pack,unpack,anonymizeStore} from '../core/web-package.mjs';
const SQL=await initSql();
function fixture(){const s=new ReviewStore(new SqlAdapter(new SQL.Database()));s.set('metadata',{schemaVersion:1,matchId:'123',build:10932,source:{fileName:'private.dem',bytes:10,sha256:'hash'},capabilities:{}});s.db.prepare('INSERT INTO players VALUES (?,?)').run('7656119',JSON.stringify({id:'7656119',name:'Private Nick',steamId:'7656119',team:2}));s.db.prepare('INSERT INTO frames VALUES (?,?,?)').run(1,64,JSON.stringify({time:1,players:[]}));s.db.prepare('INSERT INTO entity_updates(time,id,category,action,payload) VALUES (?,?,?,?,?)').run(1,'entity','boss','update',JSON.stringify({time:1,entity:{id:'entity'}}));s.saveAnnotation({id:'note',kind:'bookmark',text:'private note',time:1});return s;}
test('Desktop-compatible packages preserve database and reject tampering',async()=>{const s=fixture();try{const bytes=s.db.database.export(),encoded=await pack(bytes,s.get('metadata'));assert.deepEqual(await unpack(encoded),bytes);const corrupted=encoded.slice(0,-20);await assert.rejects(()=>unpack(corrupted));}finally{s.close();}});
test('Anonymous export removes names, Steam IDs and notes without mutating source',()=>{const s=fixture(),copy=new ReviewStore(new SqlAdapter(new SQL.Database(s.db.database.export())));try{anonymizeStore(copy);assert.equal(copy.players()[0].name,'玩家 1');assert.equal(copy.players()[0].steamId,'');assert.equal(copy.annotations()[0].text,'');assert.equal(copy.get('metadata').source.fileName,undefined);assert.equal(s.players()[0].name,'Private Nick');assert.equal(s.annotations()[0].text,'private note');}finally{s.close();copy.close();}});
test('Replay window queries and annotation deletion retain expected state',()=>{const s=fixture();try{assert.equal(s.frame(1).time,1);assert.equal(s.frames(0,2).length,1);s.deleteAnnotation('note');assert.deepEqual(s.annotations(),[]);}finally{s.close();}});
