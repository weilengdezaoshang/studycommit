# StudyCommit 项目管理文档

本目录将整体开发拆分为后端、Electron 和 React Native 三条工作流。

| 工作流 | 文档 | 核心职责 |
|---|---|---|
| 后端 | [BACKEND_ROADMAP.md](BACKEND_ROADMAP.md) | 云端数据、API、同步、认证、后台任务与 Agent 基座 |
| Electron | [ELECTRON_ROADMAP.md](ELECTRON_ROADMAP.md) | 桌面完整学习闭环、本地存储、深度笔记、知识地图和 Git |
| React Native | [REACT_NATIVE_ROADMAP.md](REACT_NATIVE_ROADMAP.md) | 移动计时、快速记录、轻量笔记、复习和离线同步 |

后端功能的详细数据设计、API 规范、测试策略和配套 Node.js 学习路径见
[后端功能开发与 Node.js 学习指南](BACKEND_DEVELOPMENT_GUIDE.md)。

Electron 首个工程基座任务的范围、路由方案、安全边界、测试策略和初学者学习路径见
[EL-001 Electron 应用壳与路由开发文档](EL-001_APP_SHELL_ROUTING_DEVELOPMENT_GUIDE.md)。

## 优先级定义

| 级别 | 含义 |
|---|---|
| P0-A | 工程与数据基座；不完成则后续功能无法可靠开发 |
| P0-B | 最小学习闭环；第一个可以端到端验收的产品增量 |
| P0-C | MVP 内容闭环；草稿、笔记、关系与复习 |
| P0-D | 跨端同步、离线、冲突与发布质量 |
| P1 | MVP 稳定后建议完成 |
| P2 | 后续增强 |
| Agent | 第二阶段；必须建立在稳定数据、权限和审计之上 |

## 共同里程碑

| 里程碑 | 目标 | 跨端完成标准 |
|---|---|---|
| M0 工程基座 | 三端可以独立启动、构建和测试 | API 健康、Electron 启动、Expo 启动 |
| M1 专题链路 | 第一条真实前后端链路 | 后端 Topic CRUD；桌面和移动端可查看专题 |
| M2 学习闭环 | 完成一次学习并保存结果 | 专题 → 计时 → 收尾 → Learning Log |
| M3 内容闭环 | 学习结果沉淀为知识 | Draft、Note、Relation、Review Card |
| M4 本地优先 | 断网仍可完成核心操作 | SQLite、本地写入、待同步队列、恢复同步 |
| M5 跨端同步 | 桌面和移动端恢复相同状态 | 增量同步、幂等、删除、冲突副本 |
| M6 MVP 验收 | 满足 PRD 发布标准 | 核心功能、异常状态、可访问性和适配通过 |
| M7 增强能力 | 统计、Git、搜索和地图增强 | P1 按价值逐项交付 |
| M8 Agent 基座 | 可追溯的 AI 建议能力 | 检索、队列、引用、审批和审计完整 |

## 推荐执行顺序

```text
后端数据基座
→ Topic API
→ Electron Topic
→ StudySession / LearningLog API
→ Electron 学习闭环
→ React Native 学习闭环
→ 草稿与笔记
→ 复习
→ 本地优先与同步
→ 知识地图和 Git
→ Agent
```

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

## 当前决策与待决策

已经确定：

- Node.js + TypeScript；
- NestJS + Fastify；
- PostgreSQL + pgvector；
- Redis + BullMQ 在出现异步任务后启用；
- Electron + React；
- Expo + React Native；
- 本地数据库是运行时数据源，Markdown 是可读输出。

进入 M4/M5 前必须确认：

- 云同步采用自建 API 还是 Supabase 直连组合；
- Markdown 与本地数据库的主从关系；
- 第一阶段身份系统；
- 一篇笔记是否允许属于多个专题；
- 复习算法先用固定间隔还是直接引入 FSRS。
