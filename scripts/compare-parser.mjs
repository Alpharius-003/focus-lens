import {readFileSync,writeFileSync} from 'node:fs';
import initSql from 'sql.js';
import {unpack} from '../core/web-package.mjs';
import {ReviewStore} from '../core/store.mjs';
import {SqlAdapter} from '../core/sql-adapter.mjs';
import assert from 'node:assert/strict';
const SQL=await initSql();
const open=async path=>new ReviewStore(new SqlAdapter(new SQL.Database(await unpack(new Uint8Array(readFileSync(path))))));
const web=await open('reports/browser-roundtrip.dlreview'),desktop=await open(process.env.REFERENCE_PACKAGE||'../data/134791125-v0.5.1.dlreview');
const meta=web.get('metadata'),ref=desktop.get('metadata');
for(const key of ['matchId','frames','events','decodeErrors','build','duration','positionCoverage'])assert.deepEqual(meta[key],ref[key],key);
assert.deepEqual(web.players(),desktop.players());assert.deepEqual(web.events(),desktop.events());
for(const time of [0,172,200,231,599.9375,1200,meta.duration-1]){assert.deepEqual(web.frame(time),desktop.frame(time),`frame ${time}`);assert.deepEqual(web.entities(time),desktop.entities(time),`entities ${time}`);}
const report={matchId:meta.matchId,build:meta.build,decodeErrors:meta.decodeErrors,frames:meta.frames,events:meta.events,players:web.players().length,parseSeconds:meta.parseSeconds,metadata:'matched',allPlayers:'matched',allEvents:'matched',framesAndEntitiesAt:[0,172,200,231,599.9375,1200,meta.duration-1],result:'passed'};
writeFileSync('reports/parser-parity.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));web.close();desktop.close();
