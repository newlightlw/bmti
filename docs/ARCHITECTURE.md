# 代码与数据地图

## 运行链路

```text
浏览器：app/experience.tsx、app/admin/panel.tsx
        ↓ 同源 /api/test、/api/admin
共享API：app/api/*/route.ts + lib/server.ts
        ↓
Sites：Cloudflare D1       独立版：Node 24 + SQLite
worker/index.ts           selfhost/server.ts → env.ts → sqlite.ts
```

`lib/bmti.ts`负责抽样、输入与计分；`lib/portrait.ts`负责报告呈现。独立构建将`cloudflare:workers`绑定替换为SQLite环境，复用同一组API而非维护两套评分逻辑。

## 文件索引

| 位置 | 责任 |
| --- | --- |
| `lib/questions.json` | 当前32题，id/text/endpoint |
| `lib/bmti.ts` | 版本、端点、角色名、均衡抽题、`makeReport` |
| `lib/portrait.ts` | `presentPortrait`与旧报告展示 |
| `app/experience.tsx` | 昵称、草稿、导航、报告、打印、删除 |
| `app/admin/panel.tsx` | 管理登录、题量配置、题库预览 |
| `app/api/test/route.ts` | 开测、提交、归属读取、删除 |
| `app/api/admin/route.ts` | 登录、设置、登出 |
| `lib/server.ts` | Cookie、同源检查、口令摘要、会话核验 |
| `db/schema.ts`、`drizzle/` | 数据结构与迁移 |
| `selfhost/` | 静态构建、回环HTTP、SQLite与部署模板 |
| `tests/bmti.test.mjs` | 9项领域与呈现回归；另有3项命名兼容回归 |
| `selfhost/tests/sqlite.test.mjs` | 5项SQLite事务、迁移与持久化测试 |
| `tests/api_smoke.py` | 10项隔离HTTP集成测试 |
| `components/ui/`、`examples/` | Sites模板保留文件，非画像业务核心 |

## API概览

- `GET /api/test`：公开题量、题库数量、版本。
- `GET /api/test?id=...`：当前浏览器拥有且未过期的记录。
- `POST /api/test`：`action=start`或`submit`；严格校验答案。
- `DELETE /api/test?id=...`：只删除当前浏览器拥有的记录。
- `POST /api/admin`：`action=login/settings/logout`；设置需管理员会话。
- `GET /api/admin`：管理员可读配置及题库，不提供私人答卷。
- `GET /api/health`：仅独立Node版的运行与数据库探活。

## 数据与边界

`attempts`保存随机id、owner摘要、昵称、题号列表、答案、报告、创建与过期时间。`settings`保存题量；`admin_sessions`保存token摘要与有效期；`admin_limits`保存登录限流。SQLite另有迁移校验表。

随机访客Cookie不是账号；昵称不参与计分或授权。管理Cookie最长8小时、HttpOnly、SameSite=Strict，HTTPS下Secure；写请求检查Origin。没有在管理端浏览用户记录的功能。

记录30天内可访问；过期拒绝读取，后续开测时物理清理，无独立清理定时器。删除只针对当前记录。独立服务只监听回环，代理覆盖来源地址头；直接对外暴露Node端口不属于当前部署方式。

题号快照不等于完整题文快照，版本限制见[计分文档](SCORING.md#版本与兼容限制)。
