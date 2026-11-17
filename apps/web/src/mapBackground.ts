import {Texture} from 'pixi.js';
import mid from '../../../assets/cursed-apple-mid.png';
import tunnels from '../../../assets/cursed-apple-tunnels.png';
import rat from '../../../assets/cursed-apple-rat.png';
import frame from '../../../assets/cursed-apple-frame.png';

const load=(src:string)=>new Promise<HTMLImageElement>((ok,fail)=>{const image=new Image();image.onload=()=>ok(image);image.onerror=()=>fail(new Error('内置地图素材加载失败'));image.src=src;});
export async function mapTextures(){
 const images=await Promise.all([mid,tunnels,rat,frame].map(load));
 return images.slice(0,3).map(image=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;
  const context=canvas.getContext('2d')!;
  context.drawImage(image,0,0,1024,1024);
  context.globalCompositeOperation='source-in';context.fillStyle='#87958c';context.fillRect(0,0,1024,1024);
  context.globalCompositeOperation='destination-over';context.fillStyle='#28382f';context.fillRect(0,0,1024,1024);
  context.globalCompositeOperation='multiply';context.drawImage(images[3],0,0,1024,1024);
  return Texture.from(canvas);
 });
}
