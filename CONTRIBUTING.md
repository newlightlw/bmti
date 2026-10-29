# 如何一起优化HGP

## 开始前

读[交接入口](docs/HANDOFF.md)和[计分／版本限制](docs/SCORING.md)。普通研究贡献者不需要生产SSH、管理口令或真实答卷；先在本地隔离环境工作。

```sh
git switch main
git pull --ff-only origin main
git switch -c codex/describe-your-change
```

一个PR集中解决一个可验收问题。题库、评分、画像或后台的重大设计先用Issue或[提案模板](docs/templates/QUESTION_CHANGE.md)说明目标、理由和验证方式；讨论不等于已决定。

## 修改需要附带什么

| 变更 | 同步内容 |
| --- | --- |
| 题文／端点 | 修改理由、旧新对照、维度追溯、研究题本、JSON、独立审阅后的冻结参考、版本与进行中记录方案 |
| 计分／阈值 | 前后案例、边界值、缺失处理、理论或数据依据、版本兼容，不以提高角色命中率为目标 |
| 画像／陪伴解释 | 追溯至实际测量内容，区分分数和能力，不用问卷证明干预匹配有效 |
| 页面／API | 可复现问题、最小修改、相应浏览器或HTTP验证 |
| 数据库／运维 | 追加迁移、隔离验证、备份和具体回滚，不能改已应用迁移 |

## 提交与审核

运行`npm test`、`npm run test:selfhost`、`npm run typecheck`、`npm run build:selfhost`；API／数据改动加隔离HTTP测试，界面改动加浏览器与窄屏检查。失败应注明原因，不靠改弱断言或跳过测试掩盖。

按[PR模板](.github/pull_request_template.md)提交，请负责人核对产品与研究结论。不要提交node_modules、构建产物、数据库、口令、Cookie或真实私人资料。仓库公开不表示拥有测试结果或心理测量有效性的背书。

GitHub合并和生产发布分开。由维护者按[发布指南](docs/DEPLOYMENT.md)执行，并记录线上结果与回滚；当前没有自动部署。新题本发布前先补齐多版本机制。
