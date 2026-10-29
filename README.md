# 同行画像 · HGP

HereToo Growth Profile：一个帮助用户认识成长偏好的独立问卷系统。仓库名为 `bmti`，模型简称仍为 **HGP**；它是待验证的原创模型，不是 MBTI 官方测试或心理诊断。

- **正式用户端：** https://bmti.myassist.cn/
- **管理端：** https://bmti.myassist.cn/admin
- **交接入口：** [当前状态与下一步](docs/HANDOFF.md)
- **核心文档：** [完整阅读目录](docs/README.md)

## 系统可以做什么

用户输入昵称后随机答题，支持上一题、跳过、草稿恢复、重做、报告重载和删除。报告展示八端均分、四维偏好解释与可核对的陪伴建议；四组都达到分类门槛时，另展示16种角色之一。未定角色仍有具体画像，不显示问号。

管理端用独立口令登录，配置每次8—32题、查看题库。默认32题，按八端均衡抽样；当前后台不能编辑题文、评分规则或角色。这些修改通过代码与文档评审完成。

## 五分钟了解项目

| 你要做什么 | 先读 | 主要文件 |
| --- | --- | --- |
| 理解产品、四维与边界 | [产品说明](docs/PRODUCT.md) | `lib/hgp.ts` |
| 优化题库 | [题本与示例](docs/research/HGP_V02_QUESTIONNAIRE_2026-10-28.md)、[偏差审查](docs/research/HGP_V02_AUDIT_2026-10-28.md) | `lib/questions.json`、`tests/fixtures/approved-questions.md` |
| 调整计分 | [计分与版本限制](docs/SCORING.md) | `lib/hgp.ts`、`tests/hgp.test.mjs` |
| 优化画像与解释 | [16角色与访谈](docs/research/HGP_V02_PROFILES_VALIDATION_2026-10-28.md) | `lib/portrait.ts`、`lib/hgp.ts` |
| 本地运行与测试 | [开发指南](docs/DEVELOPMENT.md) | `selfhost/`、`tests/` |
| 协作提交与发布 | [贡献流程](CONTRIBUTING.md)、[部署说明](docs/DEPLOYMENT.md) | `.github/pull_request_template.md` |

## 本地运行：推荐 Node + SQLite

需要 Node **24**、npm；HTTP集成测试另外需要 Python 3。不需要腾讯云账号、生产口令或 Cloudflare 账号。

```sh
git clone https://github.com/newlightlw/bmti.git
cd bmti
npm ci
npm test
npm run test:selfhost
npm run typecheck
npm run build:selfhost
```

按[开发指南：创建个人配置](docs/DEVELOPMENT.md#创建个人配置)生成仓库外的开发环境和管理口令，然后启动：

```sh
node --env-file="$HOME/.config/bmti/development.env" selfhost-dist/server.mjs
```

打开 http://127.0.0.1:5189/ 和 http://127.0.0.1:5189/admin 。独立版修改后需重新构建、重启；没有自动热更新。另一种 Sites/Vinext 开发方式见开发指南。

## 核心目录

```text
app/                  用户界面、管理界面、共享API
lib/hgp.ts            32题抽样、八端计分、四维判断、16角色名
lib/questions.json    当前 HGP-0.2 题库
lib/portrait.ts       个人画像呈现；兼容已有报告
selfhost/             Node 24 + SQLite 运行与部署代码
worker/               Sites / Cloudflare Worker 入口
db/、drizzle/         数据结构与迁移
tests/                计分、题文与HTTP回归
docs/                 交接、设计、运维及研究材料
```

## 当前状态与重要限制

- 测评版本 **HGP-0.2**，32题、八端各4题；呈现修订 **portrait-20261029**。每端至少3个有效答案，缺失不计0。少于24题不能形成完整角色。
- 2026-10-29 已发布腾讯云与旧 Sites 两个站点，数据库相互独立。克隆仓库只获得源码和文档，没有历史答卷或生产权限。
- 当前还没有完整多版本题库路由。记录只存题号列表，读取题文依赖当前题库；发布新题本前必须先解决进行中测试兼容。详见[版本限制](docs/SCORING.md#版本与兼容限制)。
- 报告保存于服务端，浏览器随机 Cookie 标识归属；昵称不是账号，管理端不展示私人答卷。30天内可访问，过期数据在后续开测时清理，没有独立删除定时器。
- 未接入 LLM 或 HereToo 聊天；测试通过不代表人格结构、阈值或陪伴效果已验证。真实研究仍待开展。
- 本轮上传不会自动部署生产。仓库不含管理口令、秘密摘要、数据库、Cookie、真实逐题答案或原始UP主文稿。生产资料由维护者通过私有渠道单独交接。
