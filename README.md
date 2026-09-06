# StudyCommit

> 把零散的学习记录，重新变成可以回到、继续理解和持续复习的知识系统。

![TypeScript、React、Electron、React Native、Expo、NestJS、PostgreSQL 与 Redis](./docs/assets/badges/technology-stack.png)

StudyCommit 是一个跨端学习记录工具：先记下当时真正想到的内容，再通过纸页、箱子、问题和复习，把它们逐步整理成自己的知识网络。

## 核心能力

| 模块           | 当前定位                               | 状态           |
| -------------- | -------------------------------------- | -------------- |
| 纸页与时间线   | 记录当下想法，按日期回到学习现场       | 持续完善       |
| 专题 / 箱子    | 将纸页整理到可持续维护的知识主题       | 开发中         |
| 问题与 Agent   | 保留原始问题，逐步换一种说法帮助理解   | 基础闭环已接入 |
| 跨端数据链路   | 共享 RPC 契约、API、桌面端与移动端服务 | 持续建设       |
| 搜索与月度装订 | 月度装订统计已接入双端，全局搜索开发中 | 装订已上线     |

## 快速开始

### 环境要求

- Node.js 24+
- pnpm 10.15.1+
- macOS 或 Windows
- 移动端开发需要 Xcode 或 Android Studio

```bash
nvm use
corepack enable
pnpm install
```

### 启动桌面端

```bash
pnpm dev:desktop
```

### 启动移动端

```bash
pnpm dev:mobile
pnpm dev:ios       # 需要 Xcode
pnpm dev:android   # 需要 Android Studio
```

### 启动本地后端基础设施

```bash
pnpm backend:setup   # 首次使用
pnpm backend:start
pnpm --filter @studycommit/api db:migrate
```

完整的 macOS、Windows、Docker、模拟器与故障排查说明见 [`docs/DEVELOPMENT_SETUP.md`](docs/DEVELOPMENT_SETUP.md)。

## 项目结构

```text
apps/
├── api/                         # NestJS + Fastify 后端服务
│   ├── drizzle/                 # 数据库迁移
│   ├── src/auth/                # 注册、登录与令牌刷新
│   ├── src/topics/              # 专题领域与接口
│   ├── src/papers/              # 纸页领域与接口
│   ├── src/study-sessions/      # 学习会话生命周期
│   ├── src/learning-logs/       # 学习记录
│   ├── src/ai/                  # AI 能力入口
│   ├── src/database/            # Drizzle Schema 与数据库连接
│   └── src/health/              # 存活与就绪检查
├── desktop/                     # Electron + React 桌面端
│   ├── src/main/                # 主进程、窗口、IPC 与安全存储
│   ├── src/preload/             # Renderer 安全桥接
│   ├── src/renderer/            # React 页面与桌面交互
│   ├── src/shared/              # 桌面端跨进程类型
│   └── e2e/                     # Electron 端到端测试
├── mobile/                      # Expo + React Native 移动端
│   ├── src/navigation/          # 根导航与覆盖层路由
│   ├── src/screens/             # 首页、详情、专题、搜索与 Agent
│   ├── src/features/            # 账号和纸页功能模块
│   ├── src/infrastructure/      # HTTP、鉴权、加密与生命周期
│   ├── src/components/          # 通用移动端组件
│   ├── src/theme/               # 移动端主题实现
│   └── __tests__/               # 移动端测试
└── miniprogram/                 # 微信小程序
    ├── pages/                   # 小程序页面
    ├── components/              # 小程序组件
    ├── services/                # 数据访问服务
    └── styles/                  # 平台样式
common/                          # 跨端共享业务层
├── src/contracts/               # Paper、Topic、Session 与 Log Schema
├── src/ports/                   # 平台能力接口
├── src/services/                # 跨端业务服务
├── src/study-session-runtime/   # 无 React 的会话状态机与纯函数
├── src/study-session-react/     # 桌面端和移动端共享 Hook
└── src/adapters/                # 端口适配器
packages/
├── design-tokens/               # 跨端颜色、间距、圆角与动效变量
├── observability/               # 日志、追踪与敏感字段处理
└── rpc-contracts/               # oRPC / Zod 类型安全契约
infra/
└── postgres/init/               # PostgreSQL 与 pgvector 初始化
docs/
├── prd/                         # 产品需求文档
├── design/                      # 跨端设计规范
├── project-management/          # 开发计划、任务与验收标准
├── assets/                      # README 徽章与官网站点素材
└── prototypes/                  # 交互原型
```

桌面端和移动端的业务逻辑优先通过 `common` 共享，平台专属的窗口、触摸反馈、导航和生命周期保留在对应应用中。

## 工程质量

```bash
pnpm typecheck
pnpm build
pnpm test
pnpm lint
pnpm format:check
```

提交遵循 Conventional Commits，例如：

```text
feat(mobile): 新增纸页问题确认流程.
```

每个改动应同时补齐对应测试、异常状态和文档契约。

## 功能进度

### 已实现

- [x] 账号密码注册、登录与刷新令牌。
- [x] Electron 安全存储与移动端 SecureStore 会话保存。
- [x] 创建、编辑、查看和软删除纸页。
- [x] 按日期浏览纸页时间线与待整理记录。
- [x] 将纸页归类到专题，或重新移回待整理。
- [x] 创建、查询和删除专题，并展示纸页数量与最近活动时间。
- [x] 学习会话开始、暂停、继续、完成与活动会话恢复。
- [x] 会话服务端计时、幂等命令与版本冲突保护。
- [x] 移动端周时间带、今日时间线和快捷记录入口。
- [x] 移动端学习抽屉、热力月历、最近专题和待处理问题入口。
- [x] 移动端纸页详情、问题列表与本地搜索。
- [x] 桌面端纸页时间线、记录列表、详情和学习抽屉。
- [x] 桌面端 AI 解释卡与服务端校准的学习计时器。
- [x] Topic 模块接入 oRPC Contract First 类型安全调用。
- [x] 纸页问题标记解决、重新打开与跨端状态同步。
- [x] 学习片段记录与完成回写纸页的服务端闭环。
- [x] 桌面端头部同步状态胶囊，随真实数据来源切换。
- [x] 桌面端时间线卡片单击后在右侧阅读器直读全文。
- [x] 移动端学习抽屉按箱子筛选首页时间流。
- [x] 注册支持可选昵称，移动端补全协议勾选与退出登录。
- [x] 移动端快速记录图片选择与直传，草稿恢复与创建幂等键。
- [x] 图片纸页资产：按用户隔离的直传会话、私有访问与过期清理任务。
- [x] 月度装订统计接口与桌面端、移动端回顾入口。
- [x] 小程序已登录走真实后端（oRPC REST），未登录回退本地演示数据。

### 持续建设

- [ ] 图片纸页：客户端图片纸页展示与删除联动打磨。
- [ ] 全局搜索接口及双端接入。
- [ ] 桌面端区域截图、本地 OCR 与问题确认流程。
- [ ] 桌面端学习小窗与“记下一点”过程片段。
- [ ] 安全基线：生产环境鉴权收紧与登录注册频控。
- [ ] 建设 Agent 检索、引用、审批、运行记录与审计链路。
- [ ] 完成发布前的异常状态、可访问性、适配和真机验收。

## 参与贡献

1. 先阅读当前基线：[统一产品 PRD](docs/prd/STUDYCOMMIT_UNIFIED_PRODUCT_PRD.md) 与 [V3 剩余技术计划](docs/project-management/STUDYCOMMIT_V3_REMAINING_TECHNICAL_PLAN.md)。旧路线文档已归档至 `docs/archive/`，不得作为开发依据。
2. 保持一个提交只完成一个可独立理解的目标。
3. 提交前运行与改动范围匹配的类型检查、测试或构建。
4. 通过 Issue 反馈问题，或提交带有背景、复现步骤和验证结果的 Pull Request。

## 许可证

项目当前仍处于持续开发阶段，正式公开发布前会补充许可证、发布版本和变更记录。
