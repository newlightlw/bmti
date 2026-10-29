# 核心文档目录

从 [README](../README.md) 了解系统，再按角色选择阅读路径。

## 当前实现与交接

1. [HANDOFF：交接状态与下一步](HANDOFF.md) — 当前版本、验证范围、已知限制。
2. [PRODUCT：产品与画像边界](PRODUCT.md) — 四维、用户流程、如何理解画像。
3. [SCORING：计分、呈现与版本限制](SCORING.md) — 真实代码规则、边界案例、未来改版要求。
4. [ARCHITECTURE：代码与数据地图](ARCHITECTURE.md) — UI、API、数据库、两种运行方式。
5. [DEVELOPMENT：开发与验收](DEVELOPMENT.md) — 独立启动、个人配置、17项单元及10项HTTP测试。
6. [DEPLOYMENT：发布与回滚交接](DEPLOYMENT.md) — 腾讯云与Sites差异、发布责任、服务器专用脚本限制。
7. [CHANGELOG：版本记录](CHANGELOG.md) — 研究版本、呈现修订与仓库交接。
8. [CONTRIBUTING：协作流程](../CONTRIBUTING.md) — 分支、评审、必填修改理由。

## 题库与画像优化：研究资料

以下保留2026-10-28的研究文档。文内“本轮不开发应用”等表述属于当时任务边界；当前已实现网页，以本目录上方的实现文档和代码为准。v0.1中的能力或卡点推断不作为当前画像规则。

| 文档 | 用途 |
| --- | --- |
| [v0.2完整题本与计分示例](research/BMTI_V02_QUESTIONNAIRE_2026-10-28.md) | 32题原文、端点、阈值、缺失与边界样例 |
| [v0.2分组题库](research/BMTI_V02_QUESTION_BANK_2026-10-28.md) | 按四维各8题审阅与试填 |
| [v0.2逐题偏差审查](research/BMTI_V02_AUDIT_2026-10-28.md) | 为什么修改旧题、避免什么偏差 |
| [v0.2画像与认知访谈](research/BMTI_V02_PROFILES_VALIDATION_2026-10-28.md) | 16张角色卡追溯、卡点独立核对、先6人的访谈流程 |
| [v0.1产品概念](research/BMTI_PRODUCT_2026-10-28.md) | 历史设计背景，非当前评分规范 |
| [v0.1题本](research/BMTI_QUESTIONNAIRE_2026-10-28.md) | 历史16道相对选择题，不能换算v0.2得分 |
| [v0.1验证方案](research/BMTI_VALIDATION_2026-10-28.md) | 历史验证设想，当前先做题意访谈 |

研究人员优先读四份v0.2文档；工程人员优先读计分、架构和开发指南。需要联合评审时，使用[题目变更提案](templates/QUESTION_CHANGE.md)、[验证记录](templates/VALIDATION_RECORD.md)和[PR模板](../.github/pull_request_template.md)。

原始UP主文稿、私人目录、生产账号和真实答卷不在本仓库；研究背景链接缺少私人材料不影响项目运行。

名称迁移说明见 [BMTI命名与兼容](NAMING.md)。
