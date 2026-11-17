import {readFileSync,writeFileSync,readdirSync,statSync,mkdirSync,cpSync,rmSync} from 'node:fs';
import {resolve,join,basename} from 'node:path';
const root=resolve(import.meta.dirname,'..'),out=join(root,'public/licenses');
const read=p=>readFileSync(join(root,p),'utf8');
rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
cpSync(join(root,'licenses/upstream'),join(out,'upstream'),{recursive:true});
for(const [a,b] of [['LICENSE','Focus-Lens-MIT.txt'],['THIRD_PARTY_NOTICES.md','THIRD_PARTY_NOTICES.md'],['vendor/demofile-net/LICENSE','demofile-net.txt'],['vendor/demofile-net/ACKNOWLEDGEMENTS','demofile-net-ACKNOWLEDGEMENTS.txt']])writeFileSync(join(out,b),read(a));
const lock=JSON.parse(read('package-lock.json')),manifest=[],sections=[];
function collect(dir,prefix=''){
 return readdirSync(dir).flatMap(name=>{const full=join(dir,name),path=prefix+name;if(statSync(full).isDirectory())return collect(full,path+'/');return [{path,text:readFileSync(full,'utf8')}];});
}
for(const [path,entry] of Object.entries(lock.packages)){
 if(!path||entry.dev)continue;
 const pkg=JSON.parse(read(path+'/package.json'));
 let docs=readdirSync(join(root,path)).filter(n=>/^(licen[cs]e|copying|notice)(?:[.\-_]|$)/i.test(n)).flatMap(n=>statSync(join(root,path,n)).isDirectory()?collect(join(root,path,n),n+'/'):[{path:n,text:read(path+'/'+n)}]);
 if(!docs.length&&pkg.name==='@pixi/colord')docs=[{path:'upstream LICENSE.md (omgovich/colord)',text:read('licenses/upstream/colord-MIT.txt')}];
 if(!docs.length)throw new Error('Missing license for '+pkg.name);
 manifest.push({name:pkg.name,version:entry.version,license:entry.license,files:docs.map(d=>d.path)});
 sections.push(`===== ${pkg.name} ${entry.version} (${entry.license}) =====\n`+docs.map(d=>`--- ${d.path} ---\n${d.text}`).join('\n\n'));
}
writeFileSync(join(out,'npm-runtime-licenses.txt'),sections.join('\n\n'));
writeFileSync(join(out,'manifest.json'),JSON.stringify({npm:manifest,parser:[{name:'demofile-net',version:'0.44.1 (modified)',license:'MIT',file:'demofile-net.txt'},{name:'Google.Protobuf',version:'3.22.1',license:'BSD-3-Clause'},{name:'protobuf-net / protobuf-net.Core',version:'3.2.16',license:'Apache-2.0',note:'Full Apache-2.0 text is also included in npm-runtime-licenses.txt (ECharts).'},{name:'Snappier',version:'1.3.1',license:'BSD-3-Clause'},{name:'.NET browser runtime',version:'10.0.15',license:'MIT + third party notices'}]},null,2)+'\n');
writeFileSync(join(out,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Focus Lens · 许可与隐私</title><style>body{max-width:860px;margin:40px auto;padding:0 24px;background:#111918;color:#e4e9df;font:16px/1.8 system-ui}a{color:#95e2cb}li{margin:10px 0}</style><h1>Focus Lens · 许可与隐私</h1><p>独立社区复盘工具，与 Valve / Steam 无隶属或官方背书关系。Deadlock、英雄、技能、装备、地图和应用图标等游戏素材权利属于 Valve；项目的 MIT 许可不授权这些游戏素材。</p><p>录像、工程与笔记在当前浏览器处理、存储。本应用没有录像上传、云解析、账号登录或分析追踪功能。普通工程导出可能包含玩家昵称、Steam ID 和笔记，分享前可使用匿名工程导出。匿名处理不保证无法通过对局过程重新识别玩家。</p><p>静态托管服务仍会收到加载网页所需的请求及 IP 等连接信息，其日志由托管平台管理。清理网站数据会删除本地档案，请先导出备份。</p><p>作者名与 QQ 群号为作者主动公开的社区联系方式，不表示第三方项目作者或 Valve 的认可。</p><ul><li><a href="Focus-Lens-MIT.txt">本项目 MIT 许可</a></li><li><a href="THIRD_PARTY_NOTICES.md">第三方说明与素材来源</a></li><li><a href="demofile-net.txt">demofile-net MIT 许可</a> / <a href="demofile-net-ACKNOWLEDGEMENTS.txt">上游致谢与许可</a></li><li><a href="npm-runtime-licenses.txt">npm 运行依赖完整许可及 NOTICE</a></li><li><a href="manifest.json">组件版本清单</a></li>${readdirSync(join(out,'upstream')).map(f=>`<li><a href="upstream/${f}">${f}</a></li>`).join('')}</ul></html>`);
console.log(`Collected ${manifest.length} npm runtime licenses and parser/runtime notices.`);
