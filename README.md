# 同行画像 · HGP

独立于HereToo主应用的昵称测试站。用户端 `/`，管理端 `/admin`。题本与计分版本为HGP-0.2，32题原文来自HereToo文档；原创模型仍待用户验证。

## 已实现

- 昵称开测；每次按八端均衡随机抽题并打乱顺序；上一题、题目导航、跳过、重做。
- 同一标签页内保存未提交草稿，刷新回到第一道未回答题；完成后报告可在同一浏览器重载。
- 服务端计算八端均值与四组判断；仅四组都明确才显示对应16画像之一。双高、双低、接近和有效题量不足分别说明，不强配角色。
- 报告含解释、待本人核对的陪伴建议、浏览器打印/保存PDF入口和删除当前记录入口。
- 管理口令登录；8—32题任意整数、四个快捷题量；服务端保存配置、题库筛选预览；配置只影响新测试。
- Sites版使用Cloudflare D1；腾讯云独立版使用SQLite。报告凭随机浏览器Cookie归属，不按昵称检索，不在管理端展示私人答案。

默认32题；每端至少3个有效数值答案才发布均值。少于24题时不能形成完整角色；24题以上也可能由于跳过、并重或接近而未定。

个人画像与16角色分类分别呈现：未形成角色时不显示问号，改为八端得分生成的四维摘要和具体解释，保留略高、同分、双高／双低与信息不足。旧报告重新加载也能获得新解释，不改历史答案、分数及分类阈值。详见[呈现修订](../../docs/HGP_PORTRAIT_FIX_2026-10-29.md)。

## 本地开发

Node >=22.13。

```sh
npm ci
npm run db:generate
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_peaceful_skaar.sql
npm run dev -- --port 5187
```

迁移只需对新的本地数据库应用一次，不重复执行已应用SQL；以后追加迁移，不改历史SQL。Sites发布时应用云端迁移。本地和云端数据库不同。

管理口令使用运行时秘密 `HGP_ADMIN_HASH`，值为高熵管理口令的SHA-256十六进制摘要，不能用昵称或公开信息作为口令。开发时写入未跟踪的根目录 `.dev.vars`，生产用Sites环境变量工具以secret配置，不能放进hosting manifest或前端。源仓库和部署包不得含本机口令文件、`.dev.vars`、数据库、Cookie或测试结果原始数据。

管理登录Cookie最长8小时、HttpOnly、SameSite=Strict，HTTPS下Secure。数据库只存会话token摘要；登出即撤销。登录错误限制为每来源地址15分钟8次；变更请求校验同源Origin。

## 验证

```sh
npm test
npm run typecheck
npm run build
python3 tests/api_smoke.py
```

HTTP检查默认使用`http://127.0.0.1:5187`；可通过`HGP_TEST_URL`指定同一项目的隔离预览。`HGP_ADMIN_PASSWORD_FILE`指定本机私有口令文件，默认`~/.config/heretoo-hgp/admin-access.txt`。文件需含`管理口令：`加口令的一行。HTTP脚本只用合成昵称与答案，最后恢复32题；不要在有真实用户参与的线上运行整套配置变更测试。

单元测试覆盖8—32题均衡抽样、16类型组合、双高/低/中间及缺失、输入校验、题文与独立冻结参考一致。HTTP检查覆盖认证、限流、来源校验、题量、测试快照、报告隔离与重载、幂等提交和删除。浏览器与手机宽度结果见HereToo交接说明。

## 数据与能力边界

- 记录30天内可访问；过期后拒绝读取，在后续开测时清理过期记录，无独立定时清理任务。不宣称到期瞬间物理删除。
- 删除按钮清理当前测试的昵称、题目快照、答案与报告。昵称不是身份凭据；清Cookie或换浏览器不能找回原报告。
- 未接入HereToo聊天、记忆、LLM或第三方成长文稿；报告基于题本规则和固定解释，不是临床诊断或经验证的匹配效果。
- 浏览器打印/保存PDF由浏览器执行，不调用云端文档服务。真实手机设备与用户效果另行验收。

## Sites发布

保留`.openai/hosting.json`中的项目ID和D1绑定；按Sites技能执行source helper同步与打包，再保存部署。同一站点勿重复创建。运行时秘密与源码分开配置。

## 腾讯云独立部署

已发布：[用户端](https://bmti.myassist.cn/)、[管理端](https://bmti.myassist.cn/admin)。使用Node 24、Nginx、systemd与SQLite，复用现有UI和API。完整运维、验证及回滚记录见[部署说明](../../docs/HGP_TENCENT_DEPLOY_2026-10-29.md)。旧Sites站点和数据库独立保留，历史记录未迁移。

```sh
npm ci
npm test
npm run test:selfhost
npm run typecheck
npm run build:selfhost
```

构建输出`selfhost-dist/`，运行入口`node selfhost-dist/server.mjs`。运行前在进程环境设置`HGP_ADMIN_HASH`、`HGP_PUBLIC_ORIGIN`（精确来源，不带尾斜杠）、`HGP_DATABASE_PATH`（仓库外持久路径），可选`PORT`默认8787；只监听本机回环。迁移随构建打包并启动时校验应用，不能改动已应用SQL。环境与数据库不得打进发布包。

部署模板位于`selfhost/deploy/`；现有激活脚本用于本次已核验服务器与域名，依赖带校验清单的发布包及预置私有环境，并非任意服务器的一键安装器。重新构建会重建输出目录，打包时需另行加入部署脚本、发布元数据与`SHA256SUMS`。正式数据位于`/home/liw/.local/share/heretoo-hgp/`，更新发布目录不替换数据。
