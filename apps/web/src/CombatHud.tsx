import type {Frame,GameEvent,Player,PlayerState} from './types';
import {portraitUrl} from './mapAssets';
import {abilityStatus,recentKills} from '../../../core/combat.mjs';
import catalog from '../../../assets/abilities/catalog.json';
import itemCatalog from '../../../assets/items/catalog.json';
const itemSources=import.meta.glob('../../../assets/items/*.png',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
const itemsById=itemCatalog.items as Record<string,{id:number;name:string;item_slot_type:string;item_tier:number}>;
export function ItemBar({items}:{items?:number[]}){
 if(!items)return <span className="item-bar item-unknown" aria-label="装备状态未知">装备未知 · 请重新导入 demo</span>;
 return <span className="item-bar" aria-label="实时装备">{items.length?items.map((id,index)=>{
  const item=itemsById[id],src=itemSources[`../../../assets/items/${id}.png`],name=item?.name||`未知装备 #${id}`;
  return <span key={`${id}-${index}`} className={`item-icon item-${item?.item_slot_type||'unknown'}`} data-item-id={id} title={`${name}${item?.item_tier?` · ${item.item_tier} 阶`:''}`}>
   {src?<img src={src} alt={name}/>:<span aria-label={name}>?</span>}
  </span>;
 }):<small>尚未购买装备</small>}</span>;
}
const sources=import.meta.glob('../../../assets/abilities/*.png',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
type Definition={id:number;name:string;passive:boolean;baseCharges:string|number;image?:string|null};
const definitions=catalog.abilities as Record<string,Definition>;
const heroes=catalog.heroes as Record<string,number[]>;
export const abilityUrl=(id:number)=>sources[`../../../assets/abilities/${id}.png`];
export function HeroPortrait({heroId,name,className=''}:{heroId:number;name:string;className?:string}){
 const src=portraitUrl(heroId);
 return <span className={`hero-portrait ${className}`}>{src?<img src={src} alt={name}/>:<span aria-label={`${name}头像缺失`}>?</span>}</span>;
}
export function AbilityBar({player,heroId,frame,time}:{player?:PlayerState;heroId:number;frame:Frame|null;time:number}){
 return <span className="ability-bar" aria-label="角色技能状态">{Array.from({length:4},(_,slot)=>{
  const ability=player?.abilities?.find(a=>a.slot===slot),id=ability?.id??heroes[heroId]?.[slot],definition=definitions[id],src=abilityUrl(id),status=abilityStatus(ability,frame,time,definition);
  const name=definition?.name||`技能 ${slot+1}`;
  const title=`${slot+1} · ${name} · ${status.known?`${status.trained?'已解锁':'未解锁'} / ${status.tier} 阶 · ${status.label}${status.cooldown>0?' 秒冷却':''}${status.charges!=null?` · 剩余 ${status.charges} 次充能${status.recharge>0?` / 下次 ${Math.ceil(status.recharge)} 秒`:''}`:''}`:'状态未知，请重新导入原始 demo'}`;
  return <span key={slot} className={`ability-slot ${!status.known?'unknown':!status.trained?'untrained':status.cooldown>0||status.charges===0&&status.recharge>0?'cooling':''}`} title={title} aria-label={title} data-slot={slot} data-status={status.label}>
   <span className="ability-icon">{src?<img src={src} alt={name}/>:<span>?</span>}<i className="ability-key">{slot+1}</i><b className="ability-cd">{status.label==='就绪'?'':status.label}</b></span>
   <span className="ability-tiers" aria-label={status.known?`${status.tier} 阶强化`:'强化未知'}>{[1,2,3].map(n=><i key={n} className={status.known&&(status.tier??0)>=n?'filled':''}/>)}</span>
   {status.charges!=null&&status.trained&&<span className="ability-charges" aria-label={`剩余 ${status.charges} 次充能`}><span className="charge-pips">{Array.from({length:Math.max(1,Math.min(8,status.charges))},(_,i)=><i key={i} className={i<(status.charges??0)?'filled':''}/>)}</span><b>{status.charges}</b>{status.recharge>0&&<small>{Math.ceil(status.recharge)}s</small>}</span>}
  </span>;
 })}</span>;
}
export default function KillFeed({events,roster,time}:{events:GameEvent[];roster:Player[];time:number}){
 const kills=recentKills(events,time) as GameEvent[];
 if(!kills.length)return null;
 return <div className="kill-feed" aria-label="近期击杀播报">{kills.map(e=>{
  const attacker=roster.find(p=>p.id===e.actor),victim=roster.find(p=>p.id===e.target),aName=attacker?.name||attacker?.id||'环境 / 未知来源',vName=victim?.name||victim?.id||'未知玩家';
  return <div key={e.id} className={`kill-notice killer-team-${attacker?.team||0}`} data-event-id={e.id} aria-label={`${aName} 击杀 ${vName}`} style={{opacity:Math.min(1,Math.max(0,(8-(time-e.time))/1.2))}}>
   <span className="kill-attacker">{attacker&&<HeroPortrait heroId={attacker.heroId} name={aName}/>}<strong title={aName}>{aName}</strong></span>
   <span className="kill-action" title="英雄击杀">✕<small>击杀</small></span>
   <span className={`kill-victim victim-team-${victim?.team||0}`}><strong title={vName}>{vName}</strong>{victim&&<HeroPortrait heroId={victim.heroId} name={vName}/>}</span>
  </div>;
 })}</div>;
}
