import {useEffect,useRef} from 'react';
import * as echarts from 'echarts';
import type {Frame} from './types';
import {teamEconomy,formatClock} from '../../../core/analysis.mjs';
export default function Economy({frames,time,onSeek}:{frames:Frame[];time:number;onSeek:(n:number)=>void}) {
 const host=useRef<HTMLDivElement>(null),chart=useRef<echarts.ECharts|null>(null);
 useEffect(()=>{if(!host.current)return;const c=echarts.init(host.current,undefined,{renderer:'canvas'});chart.current=c;const resize=new ResizeObserver(()=>c.resize());resize.observe(host.current);c.on('click',p=>{if(Array.isArray(p.value))onSeek(Number(p.value[0]));});return()=>{resize.disconnect();c.dispose();};},[onSeek]);
 useEffect(()=>{chart.current?.setOption({animation:false,grid:{left:48,right:24,top:22,bottom:28},tooltip:{trigger:'axis',formatter:(p:any)=>`${formatClock(p[0]?.axisValue)} · 经济差 ${Math.round(p[0]?.value[1]||0).toLocaleString()}`},xAxis:{type:'value',max:frames.at(-1)?.time||1,axisLabel:{color:'#81958f',formatter:formatClock},splitLine:{show:false}},yAxis:{type:'value',axisLabel:{color:'#81958f',formatter:(n:number)=>`${n/1000}k`},splitLine:{lineStyle:{color:'#29413b'}}},series:[{type:'line',showSymbol:false,lineStyle:{color:'#d8b478',width:1.6},areaStyle:{color:'#d8b478',opacity:.09},data:frames.map(f=>{const e=teamEconomy(f);return[f.time,e?.complete?e.difference:null];}),markLine:{symbol:'none',silent:true,lineStyle:{color:'#eff2d5',width:1},label:{show:false},data:[{xAxis:time}]}}]});},[frames,time]);
 return <div ref={host} className="economy-chart" aria-label="团队经济差曲线，点击曲线跳转"/>;
}
