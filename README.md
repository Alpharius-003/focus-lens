# Focus Lens Web 0.1.0

无需安装客户端的 Deadlock 本地录像复盘网页。首期面向电脑端 Chrome / Edge。独立开发目录，与父目录桌面版隔离。

用户打开 HTTPS 网站，选择本地 `.dem` 或 `.dlreview` 即可使用。服务器仅分发 HTML、JavaScript、WASM 与游戏图片：不提供录像下载、上传、云解析、账号登录或云存储。

## 现有功能

- React 界面，PixiJS 战术地图、角色头像、阵容、技能等级 / CD / 充能、实时装备、击杀提示、画板及资源图层。
- 原始 `.dem` 在独立 Worker 的 .NET WebAssembly 解析器中完整解码；沿用 review.6 解析字段。
- SQLite WASM 管理快照和事件；IndexedDB Blob 保存当前浏览器的本地对局档案和笔记。原始录像不保存到浏览器档案。
- 交火 / 团战识别、经济排序、伤害 / 承伤 / 治疗、笔记、工程与匿名工程导出，CSV / JSON 导出。
- 与桌面版 `.dlreview` v1 工程兼容。失败或取消不覆盖已打开对局；取消通过终止解析 Worker 立即停止运算。

## 本地试用

当前构建已放在 `dist/`。开发者可运行 `npm run preview`，访问 `http://127.0.0.1:4180`。这只是本机预览服务器；部署后用户只需浏览器。

不要双击 HTML 用 file:// 打开。正式部署使用 HTTPS；HTTP 仅 localhost / 127.0.0.1 用于开发。

## 静态部署

把 **dist 目录里的全部内容** 放到站点根目录，不能只复制 index.html。`deploy/nginx.conf` 提供静态 Nginx 示例；域名、证书与 HTTPS 跳转由服务器现有配置接入。也可使用其他静态托管。

- `.wasm` MIME：`application/wasm`，`.js` / `.mjs`：`text/javascript`。
- 当前单线程解析无需 COOP / COEP；Nginx 示例可保留这些头。CSP 已在 HTML 中设置。
- HTML / JS / WASM 应使用同一版本，发布时完整替换、避免旧新版本缓存混用。
- 所有运行依赖和图片均已内置，不依赖 CDN 或外部接口。
- 只托管 `dist/`，不要公开本项目根目录、测试报告、原始素材研究文件或工具目录。
- 当前支持部署在域名根目录或保留末尾 `/` 的独立子目录；保持文件层级。

## 构建（仅开发者需要安装工具）

```sh
npm ci
npm run build:parser
npm run build
npm run preview
```

解析器构建需要 .NET 10 SDK + wasm-tools 工作负载。脚本优先使用本目录 `.tools/dotnet/dotnet`，也可通过 `DOTNET_PATH` 指定开发机 SDK。用户端无需安装 .NET / Node / Steam / 游戏。

`npm test` 验证工程校验、匿名导出和本地查询；`npm run test:browser` 使用开发机已有 Chrome 验证原始录像完整流程。真实测试样本路径通过 `REVIEW_FILE` 指定，不会随部署包发布。

## 性能与范围

- 首期原始 `.dem` 限制 1 GiB，工程数据库解压限制 512 MiB；实际可用大小取决于用户内存和浏览器本地剩余空间，不能保证任何限制内文件都能成功。
- 当前使用解释执行 / Jiterpreter WASM，首次使用还需加载解析运行时；原始录像与分析数据库在解析期间占用内存，电脑可能明显繁忙。
- 解析完成后重建 Worker，释放 .NET 运行时和原始文件内存。浏览器本地档案用于便捷恢复，清理网站数据会删除它；请导出工程备份。不同浏览器、域名、设备不共享本地档案。
- 未提供 PWA 离线安装或断网启动承诺；网站仍需要能加载静态资源。
- 游戏版本兼容和统计口径沿用桌面版边界。非 build 10932 保留未验证标记，不将所有版本自动视为支持。
- 本机真实验收使用 macOS Chrome；Edge、Windows Chrome / Edge 待真机验证，未声称已测。

## 架构

`apps/web/src`：网页与接口桥；`core/web-worker.mjs`：本地任务和业务；`core/store.mjs`：通用查询；`core/sql-adapter.mjs`：SQLite WASM 适配；`core/local-files.mjs`：IndexedDB；`parser/browser`：浏览器 C# 解析器；`vendor/demofile-net`：独立第三方源码副本；`public/parser`：预编译浏览器运行时；`dist`：可部署站点。

本版本为独立 Web 0.1.0，未修改父目录桌面软件源码、Mac 应用或 Windows 发布包。软件许可 MIT；游戏素材权利属于 Valve，第三方归属见 `THIRD_PARTY_NOTICES.md`。素材再分发授权仍需发布者确认。

## GitHub Pages 与公开前检查

目标仓库 `Skn1Siyu/foucus-lens`。首次公开步骤、Git 提交邮箱、Pages 设置和素材授权边界见 [GitHub Pages 发布指南](docs/GitHub-Pages发布指南.md)，本次检查结论见 [开源与隐私检查](docs/开源与隐私检查.md)。`.github/workflows/pages.yml` 只部署 dist；解析器预编译资源保留在 public/parser。

`npm run build` 自动收集许可并扫描源码、站点中的已知隐私模式；`node scripts/package-source.mjs` 生成排除开发资料的干净源码包。reports/ 里的真实测试截图、日志和工程仅保留在本机，不进入公开包。扫描不保证识别所有形式的敏感数据，提交前仍应审阅暂存文件。
