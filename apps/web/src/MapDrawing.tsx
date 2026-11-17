import {useEffect,useRef,useState} from 'react';
import type {MutableRefObject} from 'react';

export type DrawingSurface={canvas:HTMLCanvasElement|null;revision:number};
export type MapTransform={x:number;y:number;size:number;scale:number};
type Props={surface:MutableRefObject<DrawingSurface>;transform:MutableRefObject<MapTransform>;ready:boolean};
const resolution=2048;
export default function MapDrawing({surface,transform,ready}:Props){
 const [open,setOpen]=useState(false),[tool,setTool]=useState<'pen'|'eraser'|'pan'>('pen');
 const [color,setColor]=useState('#ffcc80'),[penSize,setPenSize]=useState(3),[eraserSize,setEraserSize]=useState(24);
 const [cursor,setCursor]=useState<{x:number;y:number}|null>(null);
 const active=useRef<{id:number;x:number;y:number}|null>(null);
 const input=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=resolution;
  surface.current={canvas,revision:0};
  return()=>{surface.current={canvas:null,revision:surface.current.revision+1};};
 },[surface]);
 useEffect(()=>{
  const node=input.current;if(!node)return;
  const wheel=(e:WheelEvent)=>{e.preventDefault();node.parentElement?.querySelector('.map-host canvas')?.dispatchEvent(new WheelEvent('wheel',{clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY,deltaX:e.deltaX,cancelable:true}));};
  node.addEventListener('wheel',wheel,{passive:false});return()=>node.removeEventListener('wheel',wheel);
 },[open,tool]);
 const stop=()=>{active.current=null;setCursor(null);};
 const paint=(e:React.PointerEvent<HTMLDivElement>,start=false)=>{
  const {canvas}=surface.current,ctx=canvas?.getContext('2d'),view=transform.current;
  if(!ctx||!ready||view.size<=0||(!start&&active.current?.id!==e.pointerId))return;
  const box=e.currentTarget.getBoundingClientRect(),x=e.clientX-box.left,y=e.clientY-box.top;
  setCursor({x,y});
  const point={id:e.pointerId,x:(x-view.x)/view.size/view.scale*resolution,y:(y-view.y)/view.size/view.scale*resolution};
  const previous=start?point:active.current!;
  ctx.globalCompositeOperation=tool==='eraser'?'destination-out':'source-over';ctx.strokeStyle=ctx.fillStyle=color;
  ctx.lineWidth=(tool==='eraser'?eraserSize:penSize)*resolution/(view.size*view.scale);
  ctx.lineCap=ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(previous.x,previous.y);ctx.lineTo(point.x,point.y);ctx.stroke();
  ctx.beginPath();ctx.arc(point.x,point.y,ctx.lineWidth/2,0,Math.PI*2);ctx.fill();
  active.current=point;surface.current.revision++;
 };
 const clear=()=>{const canvas=surface.current.canvas;canvas?.getContext('2d')?.clearRect(0,0,resolution,resolution);surface.current.revision++;};
 return <>
  {open&&tool!=='pan'&&<div ref={input} className={`drawing-input drawing-${tool}`} aria-label="地图临时画板" data-testid="drawing-input"
   onPointerDown={e=>{if(e.button!==0||!ready)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);paint(e,true);}}
   onPointerMove={e=>{const box=e.currentTarget.getBoundingClientRect();setCursor({x:e.clientX-box.left,y:e.clientY-box.top});paint(e);}}
   onPointerUp={e=>{if(active.current?.id===e.pointerId){paint(e);active.current=null;}if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
   onPointerCancel={stop} onLostPointerCapture={()=>{active.current=null;}} onPointerLeave={()=>{if(!active.current)setCursor(null);}}>
   {cursor&&<span className="drawing-cursor" style={{left:cursor.x,top:cursor.y,width:tool==='eraser'?eraserSize:penSize,height:tool==='eraser'?eraserSize:penSize,borderColor:tool==='eraser'?'#fff':color}}/>}
  </div>}
  <div className="drawing-menu">
   <button className={`drawing-toggle ${open?'active':''}`} aria-expanded={open} aria-controls="drawing-options" disabled={!ready} onClick={()=>{stop();setOpen(v=>!v);}}>✎ 画板</button>
   {open&&<div id="drawing-options" className="drawing-options" role="group" aria-label="画板选项">
    <div className="drawing-tools">{([['pen','画笔'],['eraser','橡皮擦'],['pan','移动地图']] as const).map(([id,label])=><button key={id} aria-pressed={tool===id} onClick={()=>{stop();setTool(id);}}>{label}</button>)}</div>
    <label>画笔颜色<input aria-label="画笔颜色" type="color" value={color} onChange={e=>setColor(e.target.value)}/></label>
    <label>画笔粗细 <output>{penSize}px</output><input aria-label="画笔粗细" type="range" min="1" max="20" value={penSize} onChange={e=>setPenSize(Number(e.target.value))}/></label>
    <label>橡皮擦大小 <output>{eraserSize}px</output><input aria-label="橡皮擦大小" type="range" min="8" max="100" value={eraserSize} onChange={e=>setEraserSize(Number(e.target.value))}/></label>
    <button onClick={clear}>一键清除</button>
    <small>临时笔迹 · 随地图移动和缩放<br/>关闭画板后可操作地图，笔迹保留；切换对局或关闭应用后清空。</small>
   </div>}
  </div>
 </>;
}
