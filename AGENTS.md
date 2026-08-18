# Git 提交规范

本仓库的所有 Git 提交必须遵循 Conventional Commits，并使用以下格式：

```text
type(模块): 中文描述.
```

示例：

```text
feat(api): 新增统一异常日志配置.
fix(mobile): 修复深色模式按钮文字颜色.
docs(project): 补充后端开发路线说明.
```

## 类型

- `feat`：新增功能。
- `fix`：修复缺陷。
- `docs`：仅修改文档。
- `refactor`：不新增功能、不修复缺陷的代码重构。
- `test`：新增或调整测试。
- `perf`：性能优化。
- `style`：不影响逻辑的格式调整。
- `build`：构建系统或依赖变更。
- `ci`：持续集成配置变更。
- `chore`：其他维护性修改。
- `revert`：撤销已有提交。

## 模块

模块必须对应本次改动涉及的项目区域，使用小写英文：

- `api`：`apps/api` 后端服务。
- `desktop`：`apps/desktop` 桌面端。
- `mobile`：`apps/mobile` 移动端。
- `shared`：共享包或跨端公共代码。
- `infra`：Docker、数据库、Redis 和部署基础设施。
- `project`：仓库级配置、脚本或项目文档。

若某个业务模块已经有明确名称，应优先使用更具体的模块名，例如：

```text
feat(topics): 新增主题归档接口.
fix(auth): 修复刷新令牌失效后未退出登录的问题.
test(logging): 补充敏感字段脱敏测试.
```

一次提交只使用一个最能代表主要改动的模块。不要使用 `all`、`misc`、`other` 等含义模糊的模块名。

## 描述要求

- 必须使用简体中文，清楚说明本次提交完成了什么。
- 使用动宾结构，例如“新增主题创建接口”“修复日志字段泄漏”。
- 保持简洁，不写实现过程、测试结果或无关背景。
- 结尾使用英文句点 `.`，与规定格式保持一致。
- 不使用“修改代码”“更新内容”“处理问题”等模糊描述。
- 不在主题行中添加 issue 编号、作者名或日期；需要时写入提交正文或页脚。

## 破坏性变更

存在不兼容变更时，在类型或模块后添加 `!`，并在正文中使用 `BREAKING CHANGE:` 说明迁移方式：

```text
feat(api)!: 调整主题接口响应结构.

BREAKING CHANGE: 客户端需要从 data.topic 读取主题详情.
```

## 提交边界

- 一个提交只处理一个完整、可独立理解的目标。
- 功能、无关重构和格式化修改不得混在同一个提交中。
- 提交前应运行与改动范围相符的测试、类型检查或构建。
- 不得提交密钥、Token、密码、`.env` 或其他敏感信息。

## 常见错误

以下提交信息不符合规范：

```text
update code
feat: 新增功能
feat(all): 更新项目.
fix(api): 修复问题.
```

应改为能够明确表达类型、模块和结果的提交信息：

```text
feat(api): 新增学习主题创建接口.
fix(logging): 修复请求令牌未脱敏的问题.
```

# 跨端设计变量规范

桌面端和移动端使用的通用设计变量应优先定义在
`packages/design-tokens`，不得在各应用中重复定义含义相同的值。

适合抽离为公共 Design Token 的内容包括：品牌颜色和语义颜色、间距刻度、圆角刻度、基础字号和行高、图标尺寸、动画时长、通用透明度和层级值。

以下内容属于平台实现，默认保留在对应应用中：

- Electron 的 CSS、CSS Variables、hover 和窗口布局；
- React Native 的 StyleSheet、触摸反馈和安全区域；
- 平台专用控件尺寸、阴影、导航及响应式规则。

新增或修改样式前必须先检查公共 Design Tokens：

1. 已存在相同语义的 Token 时，必须复用，不得新增重复值；
2. 两个平台都需要且语义一致时，应先抽离或补充公共 Token；
3. 只有单个平台需要，或交互含义不同时，才定义平台专用 Token；
4. 不得仅因为数值暂时相同就抽离，必须确认设计语义相同；
5. 公共 Token 不得依赖 React、React Native、Electron、DOM 或业务模块；
6. 修改公共 Token 时，必须验证桌面端和移动端的受影响范围。

# 跨端 Hook 抽离规范

桌面端和移动端业务逻辑一致的 Hook，必须抽到 `@studycommit/common`，不得在 `apps/desktop` 和 `apps/mobile` 各写一份。

分层：

- 无 React 的纯函数（计时、校验、reducer、错误文案、幂等键）放 `@studycommit/common/study-session-runtime`。
- 依赖 React 但两端逻辑相同的 Hook 放 `@studycommit/common/study-session-react`。
- 不得把 Hook 写进 `study-session-runtime`，也不得把 React 组件、CSS、React Native 视图放进 `common`。

平台差异（请求客户端、回到前台、是否轮询）通过 Hook 参数传入，例如 `studySessions`、`topics`、`subscribeForeground`、`enablePoll`。各端 `AppShell` 只负责取本端服务并调用公共 Hook。

判断：

1. 两端状态机、命令、冲突处理和返回值相同，就必须抽公共 Hook。
2. 仅订阅方式或客户端不同，仍抽公共 Hook，差异用参数注入。
3. 只有一端需要，或交互语义不同，才留在对应应用内。
4. 新增学习会话 Hook 前，先检查 `@studycommit/common/study-session-react` 是否已有同语义实现。
