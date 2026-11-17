import {Texture} from 'pixi.js';
const sources = import.meta.glob('../../../assets/tactical/{portraits,icons}/*.{png,svg}', {eager:true, query:'?url', import:'default'}) as Record<string,string>;
export const iconUrl = (key:string) => Object.entries(sources).find(([path]) => path.endsWith(`/icons/${key}.png`) || path.endsWith(`/icons/${key}.svg`))?.[1];
export const portraitUrl = (id:number) => sources[`../../../assets/tactical/portraits/${id}.png`];
export async function tacticalTextures() {
  const textures:Record<string,Texture> = {}, failed:string[] = [];
  await Promise.all(Object.entries(sources).filter(([path]) => !path.endsWith('.svg') || !sources[path.replace(/\.svg$/,'.png')]).map(async([path,url]) => {
    const portrait=path.includes('/portraits/'),key=(portrait?'hero:':'')+path.split('/').at(-1)!.replace(/\.(png|svg)$/,'');
    try {
      const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=url;});
      const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!;
      if(portrait){ctx.beginPath();ctx.arc(64,64,64,0,Math.PI*2);ctx.clip();}
      const ratio=Math.min(128/image.naturalWidth,128/image.naturalHeight);
      ctx.drawImage(image,(128-image.naturalWidth*ratio)/2,(128-image.naturalHeight*ratio)/2,image.naturalWidth*ratio,image.naturalHeight*ratio);
      if(!portrait){ctx.globalCompositeOperation='source-in';ctx.fillStyle='white';ctx.fillRect(0,0,128,128);}
      textures[key]=Texture.from(canvas);
    }catch{failed.push(key);}
  }));
  return {textures,failed};
}
