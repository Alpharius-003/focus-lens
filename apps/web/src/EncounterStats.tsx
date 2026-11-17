import {useEffect,useState} from 'react';
import {api} from './api';
import type {Encounter,Summary} from './types';
import {heroName} from './TacticalMap';
import {HeroPortrait} from './CombatHud';
type Metric={id:string;team:number;heroId:number;damage:number|null;taken:number|null;healing:number|null;selfHealing:number|null};
const number=(value:number|null)=>value==null?'未知':Math.round(value).toLocaleString();
export default function EncounterStats({encounter,summary,onSelect}:{encounter:Encounter;summary:Summary;onSelect:(id:string)=>void}){
 const [data,setData]=useState<{key:string;rows:Metric[]}|null>(null),[error,setError]=useState('');
 const key=JSON.stringify([summary.metadata.source?.sha256,summary.metadata.parserVersion,encounter.id,encounter.start,encounter.end,encounter.participants]);
 useEffect(()=>{let cancelled=false;setError('');void api.invoke('encounterMetrics',{encounter:{start:encounter.start,end:encounter.end,participants:encounter.participants}}).then(rows=>{if(!cancelled)setData({key,rows});}).catch(e=>{if(!cancelled)setError(String(e.message||e));});return()=>{cancelled=true;};},[key]);
 const rows=data?.key===key?data.rows:null;
 return <div className="encounter-stats" aria-label="参与玩家战斗数据"><h3>参与玩家数据 <small>{encounter.participants.length} 人</small></h3>
 <p className="stats-scope">统计所选片段起止时间；伤害 / 承伤为参与者间英雄生命伤害。治疗为该时段提供的英雄治疗，含自疗；按约 0.1 秒快照记录。</p>
 {error?<p role="alert">{error}</p>:!rows?<p>正在读取片段数据…</p>:<table><thead><tr><th>玩家 ID / 角色</th><th>伤害</th><th>承伤</th><th>治疗</th></tr></thead><tbody>{rows.map(row=>{
  const p=summary.players.find(p=>p.id===row.id),name=p?.name||row.id,hero=heroName(row.heroId);
  return <tr key={row.id} className={`team-${row.team}`} data-player-id={row.id}><td><button className="stats-player" onClick={()=>onSelect(row.id)} title={`${name} · ${hero}`}><HeroPortrait heroId={row.heroId} name={hero}/><span><strong>{name}</strong><small>{hero}</small></span></button></td><td className="stat-damage">{number(row.damage)}</td><td className="stat-taken">{number(row.taken)}</td><td className="stat-healing" title={`其中自我治疗 ${number(row.selfHealing)}`}>{number(row.healing)}</td></tr>;
 })}</tbody></table>}
 {(!summary.metadata.capabilities.healing||!summary.metadata.capabilities.damage)&&<p className="stats-missing">旧工程缺少部分统计数据，重新导入原始 demo 后可补全；未知不表示 0。</p>}
 </div>;
}
