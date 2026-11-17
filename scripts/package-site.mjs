import {readdirSync,readFileSync,mkdirSync,writeFileSync,statSync}from'node:fs';
import {resolve,join,relative}from'node:path';
import {execFileSync}from'node:child_process';
import {createHash}from'node:crypto';
const root=resolve(import.meta.dirname,'..'),out=join(root,'release');mkdirSync(out,{recursive:true});
const version=JSON.parse(readFileSync(join(root,'package.json'))).version;
const files=readdirSync(join(root,'dist'),{recursive:true}).filter(p=>statSync(join(root,'dist',p)).isFile());
if(files.some(p=>/\.(dem|dlreview|db)$/.test(p)))throw new Error('Private replay data in distribution');
const target=join(out,`focus-lens-web-${version}-static.zip`);
// zip replaces entries in an existing archive, so require a fresh target.
const {rmSync}=await import('node:fs');rmSync(target,{force:true});execFileSync('zip',['-qr',target,'.'],{cwd:join(root,'dist')});
const hash=createHash('sha256').update(readFileSync(target)).digest('hex');writeFileSync(join(out,'SHA256SUMS.txt'),`${hash}  ${relative(out,target)}\n`);
console.log(JSON.stringify({version,files:files.length,zip:target,bytes:statSync(target).size,sha256:hash},null,2));
