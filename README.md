# StudyCommit

面向开发者的本地优先学习追踪、个人知识库与间隔复习应用。

## 开发环境

- Node.js 24（运行 `nvm use`）
- pnpm 10.15.1（由 Corepack 管理）
- Electron 43 + React 19
- Expo SDK 57 + React Native 0.86

完整的从零安装、模拟器配置与故障排查见 [开发环境搭建指南](docs/DEVELOPMENT_SETUP.md)。

功能拆分、优先级与里程碑见 [项目管理文档](docs/project-management/README.md)。

## 首次安装

```bash
nvm use
corepack enable
pnpm install
```

## 运行

```bash
pnpm dev:desktop  # Electron 桌面端
pnpm dev:mobile   # Expo 开发服务器
pnpm dev:ios      # iOS Simulator（需要 Xcode）
pnpm dev:android  # Android Emulator（需要 Android Studio）
```

本地后端基础设施（需要 Docker Desktop）：

```bash
cp .env.example .env
pnpm infra:up
pnpm infra:status
```

这会启动 PostgreSQL/pgvector 与 Redis。随后启动 NestJS API：

```bash
pnpm dev:api
curl http://localhost:3000/api/health/live
curl http://localhost:3000/api/health/ready
```

后端脚本支持 macOS、Windows 和 Linux，三个系统使用相同命令。系统内部会自动选择已经安装的容器运行环境：macOS 可使用 Colima，Windows 使用 Docker Desktop，Linux 使用 Docker Engine。

首次使用执行环境准备。macOS 会检查并安装 Colima/Docker CLI；Windows 会检查 Docker Desktop，缺少时调用 winget 并提示完成必要的重启；随后预拉取镜像、安装项目依赖并启动后端：

```bash
pnpm backend:setup
```

安装完成后，日常启动只需要：

```bash
pnpm backend:start
```

按 `Ctrl+C` 停止 API。需要同时关闭 PostgreSQL、Redis 和 Colima 时执行：

```bash
pnpm backend:stop
```

macOS 启动脚本会在本机 `127.0.0.1:7890` 有代理监听时自动配置下载代理。停止命令只关闭本项目容器，不关闭 Colima 或 Docker Desktop，也不会删除数据库 Volume，避免影响其他项目。

首次启动或数据库 Schema 更新后执行迁移：

```bash
pnpm --filter @studycommit/api db:migrate
```

后端测试使用独立的 PostgreSQL 与 Redis，端口分别为 5433 和 6380：

```bash
cp .env.test.example .env.test
pnpm test:infra:up
pnpm test:api
pnpm test:infra:down
```

`test:infra:clean` 只清理测试容器及测试数据；不要用它代替普通的关闭命令。

Agent Worker 尚未初始化。

也可以在 VS Code 中打开“终端 → 运行任务”，选择 `Desktop: Electron` 或 `Mobile: Expo`。

## 验证

```bash
pnpm typecheck
pnpm build
```
