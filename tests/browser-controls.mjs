import{chromium,expect}from'@playwright/test';import{writeFileSync}from'node:fs';import{resolve}from'node:path';
const browser=await chromium.launch({channel:process.env.REVIEW_CHANNEL||'chrome',headless:true});const context=await browser.newContext({viewport:{width:1510,height:1050},acceptDownloads:true});const page=await context.newPage();
const requests=[];page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
const root=resolve(import.meta.dirname,'..');
async function choose(file){const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'＋ 导入录像',exact:true}).click();await(await chooser).setFiles(file);}
try{
await page.goto('http://127.0.0.1:4180');
await choose(root+'/reports/browser-roundtrip.dlreview');await page.locator('.roster').waitFor({timeout:60000});
await expect(page.locator('.player-row')).toHaveCount(12);
await page.getByRole('button',{name:'按经济差变化排序 ↓',exact:true}).click();
let values=await page.locator('.encounter-card').evaluateAll(nodes=>nodes.map(n=>Math.abs(Number(n.getAttribute('data-economy-swing')))));for(let i=1;i<values.length;i++)if(values[i]>values[i-1])throw new Error('Economy order');
await page.getByRole('button',{name:'恢复时间排序',exact:true}).click();
await page.getByRole('slider',{name:'录像时间'}).fill('599.9375');await page.waitForTimeout(1000);
await page.getByRole('button',{name:'✎ 画板',exact:true}).click();await page.getByRole('button',{name:'画笔',exact:true}).click();const box=await page.getByTestId('drawing-input').boundingBox();await page.mouse.move(box.x+200,box.y+200);await page.mouse.down();await page.mouse.move(box.x+350,box.y+270,{steps:12});await page.mouse.up();await page.getByRole('button',{name:'橡皮擦',exact:true}).click();await page.getByRole('slider',{name:'橡皮擦大小',exact:true}).fill('80');await page.getByRole('button',{name:'一键清除',exact:true}).click();await page.getByRole('button',{name:'✎ 画板',exact:true}).click();
await page.getByRole('button',{name:'资源',exact:true}).click();await expect(page.getByText('地图图标说明',{exact:true})).toBeVisible();
await page.getByRole('button',{name:'质量',exact:true}).click();const anonymousDownload=page.waitForEvent('download',{timeout:120000});await page.getByRole('button',{name:'匿名工程',exact:true}).click();await(await anonymousDownload).saveAs(root+'/reports/browser-anonymous.dlreview');
// Failed imports and cancellation retain the currently opened match and its persisted notes.
await choose({name:'broken.dem',mimeType:'application/octet-stream',buffer:Buffer.from('not a demo')});await expect(page.locator('.banner.error')).toContainText('文件不是完整的 Source 2 demo');await expect(page.locator('.player-row')).toHaveCount(12);
await page.locator('.banner.error').getByRole('button',{name:'关闭',exact:true}).click();await choose(process.env.DEMO_FILE||resolve(root,'../research/134791125.dem'));await expect(page.getByRole('button',{name:'取消任务',exact:true})).toBeVisible();await page.getByRole('button',{name:'取消任务',exact:true}).click();await expect(page.locator('.banner.error')).toContainText('解析已取消，原有档案保留',{timeout:60000});await expect(page.locator('.player-row')).toHaveCount(12);
await page.getByRole('button',{name:'笔记',exact:true}).click();await expect(page.getByText('Web 浏览器本地验收',{exact:true})).toBeVisible();
if(requests.some(r=>!['GET','HEAD'].includes(r.method)||!r.url.startsWith('http://127.0.0.1:4180/')))throw new Error('Unexpected network activity');
writeFileSync(root+'/reports/browser-controls.json',JSON.stringify({sort:'passed',drawingControls:'passed',resourceLegend:'passed',anonymousExport:'passed',invalidDemo:'passed',cancelPreservesMatch:'passed',persistedNotes:'passed',uploadRequests:0,externalRequests:0},null,2));
}catch(e){console.log((await page.locator('body').innerText()).slice(-6000));throw e;}finally{await browser.close();}
