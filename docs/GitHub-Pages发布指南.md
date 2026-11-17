# GitHub Pages 发布指南

目标仓库： https://github.com/Skn1Siyu/foucus-lens

预期站点： https://skn1siyu.github.io/foucus-lens/

注意仓库名拼写为 **foucus-lens**，与应用名 Focus Lens 不同。工作流按 main 分支发布。检查时（2026-11-17）该公开仓库为空，Pages 尚未启用。本次没有推送、提交或发布到远程。

## 首次上传（推荐使用干净源码包）

不要从父目录 MacDev 执行 git add。父目录包含桌面软件、录像和研究文件；Web 当前还没有自己的 Git 仓库，直接执行 Git 命令会沿用父仓库。

1. 将 release/focus-lens-web-0.1.0-source.zip 解压到一个单独的新目录。包内 focus_lens_web 才是仓库根目录，直接包含 package.json、apps、public、vendor、.github 和 .gitignore。
2. 在 GitHub 打开仓库 Settings → Pages → Build and deployment → Source，选择 **GitHub Actions**。若暂时不能选择，首次推送后再设置，并手动运行工作流。
3. 在解压后的 focus_lens_web 目录打开终端，逐条执行以下命令。用户名与邮箱请使用你希望公开的署名；邮箱可选 GitHub Settings → Emails 提供的 noreply 地址，避免公开私人邮箱。

```sh
git init -b main
git config user.name "EchoSkn1"
git config user.email "替换为你的 GitHub noreply 邮箱"
git remote add origin https://github.com/Skn1Siyu/foucus-lens.git
git add .
git status --short
git diff --cached --stat
git commit -m "Publish Focus Lens Web"
git push -u origin main
```

提交前应确认没有 reports、.tools、node_modules、dist、release、录像、工程、数据库或凭据。GitHub 登录由终端凭据管理器或 GitHub 官方登录完成，不要把 token 写入源码、URL 或配置文件。Git commit 的姓名、邮箱和历史同样会公开。

若远程已经新增文件，先 clone 到单独目录，再复制干净源码包内容进去（含隐藏的 .github 与 .gitignore），按正常提交推送；不要强推覆盖远程。

4. 仓库 Actions → Deploy Focus Lens Web to GitHub Pages，等待 build / deploy 完成。推送成功但没发布时，检查 Pages Source、Actions 是否允许、工作流日志及 main 分支名。配置好 Pages 后也可点 Run workflow。
5. 打开预期站点，保留末尾 `/`。使用 Chrome / Edge 导入自己的本地录像，验证地图、笔记、刷新恢复和工程导出。切换域名会形成新的浏览器本地存储空间，旧站点数据不会自动迁移。

## 发布工作流做什么

.github/workflows/pages.yml 用 Node 22 执行 npm ci、单元测试、许可收集、生产构建及公开文件模式扫描，只将 **dist** 上传为 Pages artifact。不会上传录像、测试报告或开发工具。public/.nojekyll 随站点发布，保留 `_framework` 文件目录。所有运行资源使用相对路径，支持 /foucus-lens/ 子目录。

public/parser 中包含已构建的 .NET 浏览器运行时，工作流直接使用它，不在每次发布安装 .NET。修改 C# 解析器后，开发者需先安装 .NET 10 SDK + wasm-tools，再运行 npm run build:parser、npm test、npm run build，并提交更新后的 public/parser 文件。build-parser 会关闭调试符号、映射本机路径；不要恢复公开绝对路径的构建方式。

当前单线程运行方式无需 Pages 不能自行配置的 COOP / COEP 头；更改为多线程或 SharedArrayBuffer 后必须重新评估。此结论以本机模拟 Pages 子路径、关闭隔离响应头的验收为限，尚未声称公网 Pages、Windows Edge 真机都已验证。

## 许可与素材发布边界

- 保留 LICENSE、THIRD_PARTY_NOTICES.md、vendor/demofile-net/LICENSE / ACKNOWLEDGEMENTS，以及生成的 public/licenses 全部文件。
- 作者名与 QQ 群可以作为自愿社区联系方式展示，不能借此删除第三方署名、冒充官方或附加“必须加群才允许复制代码”等与 MIT 权利矛盾的限制。
- **Valve 图片授权仍需发行者确认**。社区 API 可下载图片并不证明有权再分发；网站与源码包均包含游戏图片。项目 MIT 不覆盖游戏素材。Valve 的视频政策不能直接推导为独立网页图片或商标再分发许可。若无法确认，应取得许可或在正式公开前换成有授权的替代素材，并同步处理源代码仓库中的图片。
- QQ 群号、作者署名和公开仓库帐号是主动公开的信息；第三方许可里的作者名和邮箱应保留。无须发布真实对局截图来证明功能。
- 页面没有录像上传或遥测，但 GitHub 托管仍会接收普通网页访问请求，并按其政策处理连接信息。“本地解析”不代表托管平台完全收不到访问者信息。

## 容量与使用范围

截至检查时，GitHub 文档列出的已发布站点上限为 1 GB、带宽软限制 100 GB/月。本项目静态产物约 50 MB，压缩包约 24 MB；压缩包大小不等于每次访问流量。运行时和图片会消耗托管流量，访问量变大时观察带宽。GitHub Pages 不应作为以商业交易或商业 SaaS 为主要目的的网站；当前免费本地复盘工具与加入 QQ 群本身没有把它变成商业 SaaS。

不要在 Pages 上增加 Steam 密码收集、秘密 API key 或假设前端代码不可见。用户无需安装任何软件；以上开发工具和 Git 只供发布者使用。

## 参考（2026-11-17 检查）

- 上游 MIT：https://github.com/saul/demofile-net/blob/master/LICENSE
- GitHub Pages 自定义工作流：https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- GitHub Pages 限额：https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- GitHub 提交邮箱：https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address
- Valve 视频政策（仅视频，不能据此确认本项目图片授权）：https://store.steampowered.com/video_policy
