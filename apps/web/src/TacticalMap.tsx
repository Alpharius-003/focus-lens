import 'pixi.js/unsafe-eval';
import {useEffect,useRef,useState} from 'react';
import {Application,Container,Graphics,Text,Sprite,Texture} from 'pixi.js';
import type {Entity,Frame,GameEvent,Player,PlayerState} from './types';
import {mapTextures} from './mapBackground';
import {tacticalTextures} from './mapAssets';
import {mapRect,laneCurves,mapTeamColor,playerLabel,entityVisible,resourceIcon,playerDisplayScale,buffColor} from '../../../core/map.mjs';
import features from '../../../assets/tactical/map-features.json';
import entityTypes from '../../../assets/tactical/entity-types.json';
import heroes from '../../../assets/heroes.json';
import KillFeed from './CombatHud';
import MapDrawing from './MapDrawing';
import type {DrawingSurface,MapTransform} from './MapDrawing';

export const heroName=(id:number)=>(heroes as Record<string,{name:string}>)[id]?.name||`英雄 ${id}`;
const categoryColors:Record<string,number>={boss:0xf5cd72,reward:0x9ce9d1,urn:0xb9e9df,rift:0x9cdfe6,neutral:0xb3c5b7,vending:0xe4d8b5,buff:0xe1b9ef,breakable:0x9fb8a9,pickup:0xddce8e};
type Props={matchKey:string;events:GameEvent[];players:PlayerState[];roster:Player[];entities:Entity[];frames:Frame[];time:number;bounds:{min:number[];max:number[]};build:number;selected:string;onSelect:(id:string)=>void;layers:string[];trail:boolean;height:string;follow:boolean};

export default function TacticalMap(props:Props) {
 const [background,setBackground]=useState(props.build===10932?'surface':'none');
 const [showIds,setShowIds]=useState(false),[showLanes,setShowLanes]=useState(true),[showShops,setShowShops]=useState(true);
 const [error,setError]=useState(''),[zoom,setZoom]=useState(1),[ready,setReady]=useState(false);
 const host=useRef<HTMLDivElement>(null),camera=useRef({x:0,y:0,scale:1});
 const drawing=useRef<DrawingSurface>({canvas:null,revision:0}),transform=useRef<MapTransform>({x:0,y:0,size:0,scale:1});
 const current=useRef({...props,background,showIds,showLanes,showShops});
 current.current={...props,background,showIds,showLanes,showShops};
 useEffect(()=>{setBackground(props.build===10932?'surface':'none');camera.current={x:0,y:0,scale:1};setZoom(1);},[props.build]);
 useEffect(()=>{
  let gone=false,cleanup=()=>{};const app=new Application();
  (async()=>{
   await app.init({resizeTo:host.current!,backgroundAlpha:0,antialias:true,preference:'webgl',resolution:devicePixelRatio,autoDensity:true});
   if(gone){app.destroy(true);return;}
   host.current!.appendChild(app.canvas);app.canvas.setAttribute('aria-label','对局战术地图：英雄头像、队伍基底和资源图标');
   const world=new Container(),mapLayer=new Container(),grid=new Graphics(),lanes=new Graphics(),resources=new Container(),traces=new Graphics(),drawingSprite=new Sprite(),labels=new Container(),playerLayer=new Container();
   // All labels stay below all portraits; selection reorders only the final player layer.
   world.addChild(mapLayer,grid,lanes,resources,traces,drawingSprite,labels,playerLayer);app.stage.addChild(world);
   const [backgrounds,assets]=await Promise.all([mapTextures(),tacticalTextures()]);
   let drawingTexture:Texture|null=null,drawingRevision=-1;
   const dispose=()=>{drawingTexture?.destroy(true);app.destroy(true,{children:true});backgrounds.forEach(t=>t.destroy(true));Object.values(assets.textures).forEach(t=>t.destroy(true));};
   if(gone){dispose();return;}backgrounds.forEach(t=>mapLayer.addChild(new Sprite(t)));
   if(assets.failed.length)setError(`部分内置图标加载失败（${assets.failed.length}）；已使用替代标记`);setReady(true);
   const playerNodes=new Map<string,{node:Container;base:Graphics;portrait:Sprite;status:Graphics;fallback:Text;label:Text}>(),resourceNodes=new Map<string,Sprite>();
   const curves=features.lanes.map(lane=>({color:lane.color,segments:laneCurves(lane)}));
   let drag:{x:number;y:number;cx:number;cy:number}|null=null,moved=false;
   const project=(p:number[],size:number)=>{const {bounds}=current.current;return [(p[0]-bounds.min[0])/(bounds.max[0]-bounds.min[0])*size,(bounds.max[1]-p[1])/(bounds.max[1]-bounds.min[1])*size];};
   const heightVisible=(position:number[])=>{const s=current.current,z=s.players.find(p=>p.id===s.selected)?.position?.[2];return s.height==='all'||z==null||Math.abs(position[2]-z)<Number(s.height);};
   const down=(e:PointerEvent)=>{drag={x:e.clientX,y:e.clientY,cx:camera.current.x,cy:camera.current.y};moved=false;app.canvas.setPointerCapture(e.pointerId);};
   const move=(e:PointerEvent)=>{if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>4)moved=true;camera.current.x=drag.cx+dx;camera.current.y=drag.cy+dy;}};
   const up=(e:PointerEvent)=>{
    if(drag&&!moved){const box=app.canvas.getBoundingClientRect(),x=e.clientX-box.left,y=e.clientY-box.top,size=Math.min(app.screen.width,app.screen.height)-66,cam=camera.current;
     let best='',distance=16*cam.scale*playerDisplayScale(cam.scale);
     const ordered=[...current.current.players].sort((a,b)=>Number(a.id===current.current.selected)-Number(b.id===current.current.selected)).reverse();
     for(const p of ordered){if(!p.position||!heightVisible(p.position))continue;const pos=project(p.position,size),d=Math.hypot(x-(pos[0]*cam.scale+world.x),y-(pos[1]*cam.scale+world.y));if(d<distance){distance=d;best=p.id;}}
     if(best)current.current.onSelect(best);
    }drag=null;
   };
   const cancel=()=>{drag=null;};
   const wheel=(e:WheelEvent)=>{e.preventDefault();const cam=camera.current,old=cam.scale,scale=Math.min(5,Math.max(.7,old*Math.exp(-e.deltaY*.001))),box=app.canvas.getBoundingClientRect(),dx=e.clientX-box.left-app.screen.width/2,dy=e.clientY-box.top-app.screen.height/2;cam.x=dx-(dx-cam.x)*scale/old;cam.y=dy-(dy-cam.y)*scale/old;cam.scale=scale;setZoom(scale);};
   app.canvas.addEventListener('pointerdown',down);app.canvas.addEventListener('pointermove',move);app.canvas.addEventListener('pointerup',up);app.canvas.addEventListener('pointercancel',cancel);app.canvas.addEventListener('wheel',wheel,{passive:false});
   app.ticker.add(()=>{
    const s=current.current,size=Math.min(app.screen.width,app.screen.height)-66,cam=camera.current,xy=(p:number[])=>project(p,size);
    if(s.follow){const p=s.players.find(p=>p.id===s.selected);if(p?.position){const [x,y]=xy(p.position);cam.x=(size/2-x)*cam.scale;cam.y=(size/2-y)*cam.scale;}}
    world.scale.set(cam.scale);world.position.set((app.screen.width-size*cam.scale)/2+cam.x,(app.screen.height-size*cam.scale)/2+cam.y);
    transform.current={x:world.x,y:world.y,size,scale:cam.scale};
    const sketch=drawing.current;
    if(sketch.canvas){
     if(!drawingTexture){drawingTexture=Texture.from(sketch.canvas);drawingSprite.texture=drawingTexture;}
     if(drawingRevision!==sketch.revision){drawingTexture.source.update();drawingRevision=sketch.revision;}
     drawingSprite.width=drawingSprite.height=size;
    }
    const rect=mapRect(s.bounds,size);mapLayer.children.forEach((child,i)=>{child.visible=i===['surface','tunnels','rat'].indexOf(s.background);child.position.set(rect.x,rect.y);child.width=rect.width;child.height=rect.height;});
    grid.clear();if(s.background==='none'){grid.rect(0,0,size,size).fill({color:0x14251f,alpha:.65}).stroke({color:0x4c6454,width:1});for(let i=1;i<12;i++)grid.moveTo(size*i/12,0).lineTo(size*i/12,size).moveTo(0,size*i/12).lineTo(size,size*i/12).stroke({color:0x46604d,width:.5,alpha:.3});}
    lanes.clear();if(s.showLanes)for(const lane of curves){for(const segment of lane.segments){const [a,b,c,d]=segment.map(xy);lanes.moveTo(a[0],a[1]).bezierCurveTo(b[0],b[1],c[0],c[1],d[0],d[1]);}lanes.stroke({color:0x101a15,width:4.5,alpha:.8});for(const segment of lane.segments){const [a,b,c,d]=segment.map(xy);lanes.moveTo(a[0],a[1]).bezierCurveTo(b[0],b[1],c[0],c[1],d[0],d[1]);}lanes.stroke({color:lane.color,width:1.8,alpha:.87});}
    const active=new Set<string>();
    const marker=(id:string,key:string,position:number[],diameter:number,tint:number,alpha=1)=>{
     const texture=assets.textures[key]||assets.textures.npc_marker_neutral_psd;if(!texture)return;active.add(id);let sprite=resourceNodes.get(id);if(!sprite){sprite=new Sprite(texture);sprite.anchor.set(.5);resources.addChild(sprite);resourceNodes.set(id,sprite);}sprite.texture=texture;const [x,y]=xy(position);sprite.position.set(x,y);sprite.width=sprite.height=diameter;sprite.tint=tint;sprite.alpha=alpha;
    };
    if(s.showShops)features.shops.forEach((shop,i)=>{if(heightVisible(shop.position))marker(`shop:${i}`,'shop_psd',shop.position,14,0xcbd5bd,.8);});
    for(const e of s.entities){if(!entityVisible(e)||!s.layers.includes(e.category)||!heightVisible(e.position!))continue;const key=resourceIcon(e,entityTypes),diameter=e.category==='building'?(/Tier3/.test(e.className)?26:/Tier2/.test(e.className)?23:17):e.category==='boss'?24:e.category==='lane'?(/Escort/.test(e.className)?11:5):e.category==='breakable'||e.category==='pickup'?6:13;marker(e.id,key,e.position!,diameter,e.category==='buff'?buffColor(key):e.team===2||e.team===3?mapTeamColor(e.team):categoryColors[e.category]||0xb5d4c5);}
    for(const [id,node] of resourceNodes)if(!active.has(id)){node.destroy();resourceNodes.delete(id);}
    traces.clear();if(s.trail)for(const p of s.players){let previous:PlayerState|undefined;for(const f of s.frames){if(f.time<s.time-8||f.time>s.time)continue;const next=f.players.find(q=>q.id===p.id);if(previous?.position&&next?.position&&heightVisible(next.position)&&previous.alive&&next.alive&&previous.entityId===next.entityId&&Math.hypot(...next.position.map((v,i)=>v-previous!.position![i]))<500){const [x,y]=xy(previous.position),[a,b]=xy(next.position);traces.moveTo(x,y).lineTo(a,b).stroke({width:p.id===s.selected?2:1,color:mapTeamColor(p.team),alpha:.35});}previous=next;}}
    for(const [id,n] of playerNodes)if(!s.players.some(p=>p.id===id)){n.node.destroy({children:true});n.label.destroy();playerNodes.delete(id);}
    for(const p of s.players){
     let n=playerNodes.get(p.id);
     if(!n){const node=new Container(),base=new Graphics(),portrait=new Sprite(),status=new Graphics(),fallback=new Text({text:'?',style:{fontFamily:'Arial',fontSize:14,fill:0xffffff}}),label=new Text({text:'',style:{fontFamily:'Arial',fontSize:10,fontWeight:'600',fill:0xf6f0df,stroke:{color:0x14211b,width:3}}});portrait.anchor.set(.5);fallback.anchor.set(.5);label.anchor.set(.5,0);node.addChild(base,portrait,fallback,status);playerLayer.addChild(node);labels.addChild(label);n={node,base,portrait,status,fallback,label};playerNodes.set(p.id,n);}
     n.node.visible=!!p.position&&heightVisible(p.position);n.label.visible=n.node.visible&&s.showIds;if(!n.node.visible)continue;
     const [x,y]=xy(p.position!),color=mapTeamColor(p.team),chosen=p.id===s.selected,markerScale=playerDisplayScale(cam.scale);n.node.position.set(x,y);n.node.scale.set(markerScale);n.label.scale.set(markerScale);n.node.alpha=p.alive?1:.52;
     n.base.clear();if(chosen)n.base.circle(0,0,16).stroke({color:0xf2d385,width:1.5});n.base.circle(0,0,13).fill(color).stroke({color:0x111b16,width:1.5});
     const texture=assets.textures[`hero:${p.heroId}`];n.portrait.visible=!!texture;n.fallback.visible=!texture;if(texture){n.portrait.texture=texture;n.portrait.width=n.portrait.height=20;}
     n.status.clear();if(!p.alive)n.status.circle(0,0,10).fill({color:0x121c17,alpha:.55}).moveTo(-5,-5).lineTo(5,5).moveTo(-5,5).lineTo(5,-5).stroke({color:0xf7eee0,width:2});
     else if(p.maxHealth>0)n.status.roundRect(-10,-18,20,3,1).fill(0x0d1912).roundRect(-10,-18,20*Math.max(0,Math.min(1,p.health/p.maxHealth)),3,1).fill(color);
     n.label.text=playerLabel(p,s.roster);n.label.position.set(x,y+16*markerScale);
    }
    const chosen=playerNodes.get(s.selected);if(chosen)playerLayer.setChildIndex(chosen.node,playerLayer.children.length-1);
   });
   cleanup=()=>{app.canvas.removeEventListener('pointerdown',down);app.canvas.removeEventListener('pointermove',move);app.canvas.removeEventListener('pointerup',up);app.canvas.removeEventListener('pointercancel',cancel);app.canvas.removeEventListener('wheel',wheel);dispose();};
  })().catch(e=>{if(!gone)setError(`地图渲染失败：${e.message}`);});
  return()=>{gone=true;cleanup();};
 },[]);
 return <><div className="map-shell"><div className="map-host" ref={host} data-testid="tactical-map" data-ready={ready}/>{error&&<p className="map-error" role="alert">{error}</p>}<MapDrawing key={props.matchKey} surface={drawing} transform={transform} ready={ready}/><KillFeed events={props.events} roster={props.roster} time={props.time}/><div className="map-stamp">TACTICAL REPLAY <span>↑ +Y · {background==='none'?'坐标网格':'游戏小地图参考底图'}</span></div><div className="map-controls"><label>底图 <select aria-label="地图底图" value={background} onChange={e=>setBackground(e.target.value)}><option value="surface">地表</option><option value="tunnels">中层隧道</option><option value="rat">底层隧道</option><option value="none">仅坐标网格</option></select></label><button onClick={()=>{camera.current={x:0,y:0,scale:1};setZoom(1);}}>重置视角</button><span>{zoom.toFixed(1)}× · 拖动 / 滚轮缩放</span></div>{background!=='none'&&<div className="map-attribution">Valve · Deadlock API / 参考底图 · 版本待核对</div>}</div><div className="map-display-controls"><label><input type="checkbox" checked={showIds} onChange={e=>setShowIds(e.target.checked)}/>显示玩家 ID</label><label><input type="checkbox" checked={showLanes} onChange={e=>setShowLanes(e.target.checked)}/>显示三路线条</label><label title="参考地图中的固定商店位置，不表示可购买状态"><input type="checkbox" checked={showShops} onChange={e=>setShowShops(e.target.checked)}/>商店参考点</label></div></>;
}
