# StudyCommit 项目管理文档

本目录集中存放开发计划、任务规划与开发指南。
当前产品与技术的唯一基线是 v3 双端统一方案；旧路线文档已移入
[docs/archive](../archive/README.md)，不得作为开发依据。

## 当前基线

| 文档                                                          | 作用                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------ |
| [统一产品 PRD](../prd/STUDYCOMMIT_UNIFIED_PRODUCT_PRD.md)     | 产品基线：纸页、箱子、问题、学习过程与月度装订的双端统一闭环 |
| [V3 剩余技术计划](STUDYCOMMIT_V3_REMAINING_TECHNICAL_PLAN.md) | 技术基线：已完成清单、缺口表与里程碑任务（BE/DE/MO/SH 编号） |
| [V3 后端开发计划](STUDYCOMMIT_V3_BACKEND_DEVELOPMENT_PLAN.md) | V3 后端方案的原始设计，由剩余技术计划承接                    |
| [V3 代码改造计划](STUDYCOMMIT_V3_CODE_CHANGE_PLAN.md)         | 旧架构到 v3 的代码迁移决策                                   |
| [M1 纸页问题计划](STUDYCOMMIT_M1_PAPER_QUESTION_PLAN.md)      | 最近完成的迭代：问题三态闭环（已实施完成）                   |
| [纸页 V1 数据契约](PAPER_V1_DATA_CONTRACT.md)                 | papers 域数据契约                                            |

## 开发指南（已完成能力的实现参考）

| 端     | 文档                                                                                                                                                                                                                                                                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 后端   | [后端工程指南](BACKEND_DEVELOPMENT_GUIDE.md) · [BE-101 学习会话](BE-101_STUDY_SESSION_DEVELOPMENT_GUIDE.md) · [BE-102 学习记录](BE-102_LEARNING_LOG_DEVELOPMENT_GUIDE.md)                                                                                                                                                                                    |
| 桌面端 | [EL-001 应用壳与路由](EL-001_APP_SHELL_ROUTING_DEVELOPMENT_GUIDE.md) · [EL-001 测试用例](EL-001_TDD_TEST_CASES.md) · [EL-003 模块化 Preload 与主进程 IPC](EL-003_MODULAR_PRELOAD_AND_MAIN_IPC_DEVELOPMENT_GUIDE.md) · [EL-102/103 学习会话](EL-102_EL-103_STUDY_SESSION_DEVELOPMENT_GUIDE.md) · [学习会话页面指南](STUDY_SESSION_PAGES_DEVELOPMENT_GUIDE.md) |
| 移动端 | [RN-000 应用壳与测试](RN-000_APP_SHELL_AND_TESTING_GUIDE.md) · [RN-001 导航](RN-001_NAVIGATION_DEVELOPMENT_GUIDE.md) · [RN-002 设计系统](RN-002_DESIGN_SYSTEM_DEVELOPMENT_GUIDE.md) · [RN-002 测试用例](RN-002_DESIGN_SYSTEM_TEST_CASES.md) · [RN-003 数据访问层](RN-003_DATA_ACCESS_LAYER_DEVELOPMENT_GUIDE.md)                                             |
| 跨端   | [DS-001 跨端设计变量](DS-001_CROSS_PLATFORM_DESIGN_TOKENS_GUIDE.md) · [DS-001 测试用例](DS-001_TDD_TEST_CASES.md) · [通用请求层指南](../../COMMON_REQUEST_LAYER_DEVELOPMENT_GUIDE.md)                                                                                                                                                                        |

## 已归档的旧路线文档

后端/桌面/React Native 三份旧路线图、旧专题与学习会话产品计划、工程缺口快照等
已移至 [docs/archive](../archive/README.md)。其中规划的 Draft、Note、Review Card、
知识地图、SQLite 同步与四 Tab 导航等方向已被 v3 取代或冻结，不得按旧文档开发。

## 任务进入开发的条件

每个任务开始前需要满足：

- 已明确对应 PRD 行为；
- 已明确数据归属和端侧职责；
- 已明确 API 或 Repository 契约；
- 已列出正常、空、加载、失败、离线状态；
- 已明确验收方式。

## 任务完成定义

- 类型检查通过；
- 相关自动化测试通过；
- 正常与异常路径已验证；
- 不静默丢失或覆盖数据；
- 文档/API 契约已同步；
- 达到对应端的可访问性要求；
- 可以由另一端或下一任务消费。
