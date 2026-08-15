# RN-002 React Native 设计系统开发文档

| 项目 | 内容 |
|---|---|
| 功能编号 | RN-002 |
| 优先级 | P0-A，RN-003/RN-004 的 UI 前置任务 |
| 当前状态 | 已实现；自动化与双平台 bundle 已通过，发布前保留真机人工验收 |
| 技术基线 | Expo SDK 57、React Native 0.86、React 19、React Navigation 7 |
| 目标 | 建立足够支撑 Topic 页面和学习闭环的精简移动端设计系统 |
| 更新时间 | 2026-08-14 |

## 1. 结论

RN-002 不建设一个追求“大而全”的通用组件库，而是完成下一阶段确定会使用的最小设计系统：

```text
Foundation
├── Color / Typography / Spacing / Radius / Size / Motion
└── Theme

Primitives
├── AppText
├── Button
├── IconButton
├── Card
└── TextField

Patterns
├── LoadingState
├── EmptyState
├── ErrorState
└── OfflineBanner
```

完成后，RN-004 Topic 页面只组合这些组件，不再自行定义按钮、输入框、空状态和错误提示。

## 2. 当前问题

现有移动端已经具备主题、安全区和导航，但还不能称为完整设计系统：

- `tokens.ts` 只有部分颜色、间距、圆角和字号；
- 交互状态缺少明确 token，例如 disabled、pressed、success、warning；
- `ScreenPlaceholder` 仍直接写 `fontSize: 24`、`width: 64` 等数值；
- 头像按钮和错误页分别维护自己的按钮样式；
- 没有统一 Loading、Empty、Error、Offline 表达；
- 没有统一输入框，RN-004 创建专题时会重复实现表单状态；
- 组件测试尚未覆盖禁用、加载、可访问性和最大字体行为。

设计系统要解决的是“同一含义只定义一次”，不是让所有界面长得完全相同。

## 3. 设计原则

### 3.1 内容优先

StudyCommit 是学习追踪与个人知识库，不是营销页面。视觉层级应帮助阅读、记录和复习，避免夸张装饰抢走内容注意力。

### 3.2 语义优先于颜色值

业务组件应使用：

```ts
theme.colors.text
theme.colors.surface
theme.colors.danger
```

而不是：

```ts
'#182426'
'#FFFFFF'
'#B42318'
```

这样深浅色切换、品牌色调整和无障碍对比度修正只需改变 token 映射。

### 3.3 原生交互优先

- 点击使用 `Pressable`；
- 输入使用 `TextInput`；
- 加载使用 `ActivityIndicator`；
- 不自造浏览器式控件；
- 不拦截系统返回和辅助功能行为。

### 3.4 可访问性不是后补项

组件 API 从一开始包含 role、label、hint、disabled、busy 和 error 语义。测试优先通过角色和可访问名称查询组件。

### 3.5 只封装稳定重复项

适合封装：按钮、文字层级、输入框、卡片和状态视图。

暂不封装：TopicRow、NoteCard、ReviewRating 等业务结构。它们要等真实页面出现、重复模式稳定后再提取。

## 4. 本次范围

### 4.1 包含

- 完善 foundation token；
- 统一 light/dark 语义主题；
- `AppText`；
- `Button`；
- `IconButton`；
- `Card`；
- `TextField`；
- Loading、Empty、Error、Offline 状态组件；
- 改造现有占位页面、头像按钮和错误兜底；
- 组件导出入口；
- 组件单元与交互测试；
- 一个仅开发/测试使用的组件展示页方案，不加入正式导航。

### 4.2 不包含

- 自研图标库；
- Web CSS 或桌面端组件共享；
- 动画框架；
- Toast、Modal、Bottom Sheet；
- Date Picker、Select、Markdown Editor；
- Topic、Session、Note 等业务组件；
- Figma 自动同步；
- Storybook 等额外工具链。

### 4.3 为什么本次加入 `TextField`

RN-004 必须创建和编辑专题，RN-102 必须输入学习目标。如果 RN-002 不定义输入框，紧接着的两个任务都会先各写一套 label、错误、disabled 和键盘行为。因此 `TextField` 属于已经确定会复用的基础组件，不是提前设计。

## 5. Token 设计

### 5.1 Token 分层

```text
基础刻度：spacing.md = 16
语义 token：colors.danger = 错误/危险语义
组件组合：Button variant="danger" 使用 colors.danger
业务组件：删除专题按钮使用 Button danger
```

不要建立 `topicDeleteRed` 这种业务专属颜色；设计系统只表达跨业务语义。

### 5.2 计划完善的 token

#### Color

| Token | 用途 |
|---|---|
| `background` | 页面背景 |
| `surface` | 卡片和固定栏 |
| `surfaceMuted` | 次级区域、禁用表面 |
| `text` | 主要正文 |
| `textMuted` | 次要说明 |
| `textDisabled` | 禁用文字 |
| `primary` / `onPrimary` | 主操作与其前景 |
| `primarySurface` / `onPrimarySurface` | 主色浅表面 |
| `border` / `borderStrong` | 普通与强调边框 |
| `danger` / `onDanger` / `dangerSurface` | 错误和危险操作 |
| `success` / `successSurface` | 成功状态 |
| `warning` / `warningSurface` | 警告与离线提示 |
| `scrim` | Modal/抽屉遮罩，后续复用 |

每个 light/dark 主题必须拥有完全相同的语义键。

#### Typography

| Variant | 建议字号/行高 | 用途 |
|---|---|---|
| `display` | 32/40 | 计时结果等少量大数字 |
| `title` | 28/36 | 页面核心标题 |
| `heading` | 24/32 | 区块或空状态标题 |
| `subheading` | 18/26 | 卡片标题 |
| `body` | 16/26 | 正文和输入文字 |
| `bodySmall` | 14/22 | 次要正文 |
| `label` | 13/18 | 标签与导航 |
| `caption` | 12/18 | 元数据 |

字体继续使用系统字体，第一阶段不引入 Web 字体。原因是系统字体启动快、Dynamic Type 行为稳定，并且中英文覆盖可靠。

#### Spacing

保持 4/8dp 节奏：

```ts
0, 4, 8, 12, 16, 24, 32, 40, 48
```

只增加确定需要的 `12/40/48`，避免页面反复出现魔法数。

#### Size

```ts
controlHeight: 48
touchTarget: 48
iconSm: 16
iconMd: 20
iconLg: 24
iconXl: 32
contentMaxWidth: 640
```

统一按 48dp 控件高度满足 Android 最小触控要求，同时覆盖 iOS 44pt 要求。

#### Motion

本阶段只定义 press opacity 和未来动画时长，不加入复杂动画：

```ts
pressedOpacity: 0.76
disabledOpacity: 0.46
durationFast: 150
durationNormal: 220
```

React Native `Pressable` 的按压反馈不改变布局尺寸，避免点击时界面抖动。

## 6. 组件 API

## 6.1 `AppText`

用途：统一字体层级、颜色和 Dynamic Type 行为。

建议 API：

```tsx
<AppText variant="heading">所有专题</AppText>
<AppText variant="body" color="muted">还没有创建专题</AppText>
```

```ts
type AppTextProps = TextProps & {
  color?: 'default' | 'muted' | 'danger' | 'success'
  variant?: TextVariant
  weight?: 'regular' | 'medium' | 'semibold'
}
```

规则：

- 保留 React Native `TextProps`，不阻止 `numberOfLines` 等原生能力；
- 默认允许系统字体缩放；
- 不默认截断文字；
- `heading/title` 自动提供合适的 `accessibilityRole="header"`，但调用方可以覆盖；
- 不允许传自定义 `color` 字符串绕过主题；确有特殊情况先扩充语义色。

## 6.2 `Button`

用途：文字主操作、次操作和危险操作。

```tsx
<Button onPress={createTopic}>创建专题</Button>
<Button variant="secondary">取消</Button>
<Button variant="danger">删除</Button>
<Button loading>保存中</Button>
```

```ts
type ButtonProps = Omit<PressableProps, 'children'> & {
  children: string
  icon?: IoniconsName
  loading?: boolean
  size?: 'medium' | 'large'
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}
```

状态矩阵：

| 状态 | 行为 |
|---|---|
| normal | 可点击，文字和背景对比清晰 |
| pressed | opacity 变化，不缩放布局 |
| disabled | 原生 `disabled` + disabled state + 降低强调 |
| loading | 禁止重复点击，显示 spinner，保留按钮宽度 |

规则：

- 最小高度 48dp；
- Loading 时暴露 `accessibilityState.busy=true`；
- Disabled/Loading 时不触发 `onPress`；
- 图标仅装饰时从屏幕阅读器隐藏；
- 按钮只能有一段简短动作文字，不接受任意复杂 children。

## 6.3 `IconButton`

用途：头像之外的返回、关闭、更多、搜索等图标操作。

```tsx
<IconButton
  accessibilityLabel="搜索专题"
  icon="search-outline"
  onPress={openSearch}
/>
```

约束：

- `accessibilityLabel` 必填；
- 可视图标默认 24dp，点击区域 48×48dp；
- 使用 Ionicons 单一图标家族；
- 支持 default、subtle、danger 三个 variant；
- 头像可继续作为专门业务组件，但应复用相同交互 token。

## 6.4 `Card`

用途：静态内容分组或可点击内容块。

```tsx
<Card>
  <AppText variant="subheading">React Native</AppText>
</Card>

<Card accessibilityLabel="打开 React Native 专题" onPress={openTopic}>
  ...
</Card>
```

```ts
type CardProps = PropsWithChildren<{
  accessibilityLabel?: string
  onPress?: () => void
  padding?: 'none' | 'small' | 'medium' | 'large'
  variant?: 'default' | 'muted' | 'outlined'
}>
```

规则：

- 无 `onPress` 时渲染普通 `View`，不伪装成按钮；
- 有 `onPress` 时使用 `Pressable` 并要求可访问名称；
- 可点击 Card 提供稳定按压反馈；
- 卡片不自动规定内部业务布局。

## 6.5 `TextField`

用途：专题名称、学习目标和简单文本输入。

```tsx
<TextField
  error="专题名称不能为空"
  label="专题名称"
  onChangeText={setName}
  value={name}
/>
```

```ts
type TextFieldProps = TextInputProps & {
  error?: string
  helperText?: string
  label: string
}
```

规则：

- `label` 必填，不用 placeholder 代替标签；
- error 紧邻输入框并使用 alert/live 语义；
- Error 不只用红色边框表达，必须有文字；
- 输入高度至少 48dp；
- 转发 `keyboardType`、`autoCapitalize`、`returnKeyType` 等原生属性；
- disabled 和 read-only 不混为同一状态；
- 多行输入继续使用同一组件，通过 `multiline` 调整最小高度。

## 6.6 状态组件

### `LoadingState`

```tsx
<LoadingState label="正在加载专题" />
```

- 使用 `ActivityIndicator`；
- 可访问 label 表达当前动作；
- 页面级加载超过约 300ms 才展示，避免闪烁逻辑由业务层控制；
- 不使用无限装饰动画。

### `EmptyState`

```tsx
<EmptyState
  actionLabel="创建专题"
  description="创建第一个专题后，可以开始记录学习。"
  onAction={createTopic}
  title="还没有专题"
/>
```

- 必须说明为什么为空；
- 需要时提供一个明确下一步；
- Action 使用统一 Button。

### `ErrorState`

```tsx
<ErrorState
  description="请检查网络后重试。"
  onRetry={reload}
  title="专题加载失败"
/>
```

- 使用 alert 语义通知辅助技术；
- 说明恢复办法；
- retry 为可选，不能展示一个无效按钮。

### `OfflineBanner`

```tsx
<OfflineBanner pendingCount={3} />
```

- 非阻塞，不用全屏弹窗阻止用户学习；
- 同时使用图标和文字，不只依赖颜色；
- 显示“离线可继续使用”和待同步数量；
- RN-003 接入真实网络状态，本阶段只完成展示组件。

## 7. 目录与文件修改

```text
apps/mobile/src/
├── theme/
│   ├── tokens.ts                         # 修改：完善 foundation token
│   ├── theme.ts                          # 修改：主题类型与映射
│   └── ThemeProvider.tsx                 # 保持 API，补测试
├── components/
│   ├── index.ts                          # 新增：公共组件出口
│   ├── AppText.tsx                       # 新增
│   ├── Button.tsx                        # 新增
│   ├── IconButton.tsx                    # 新增
│   ├── Card.tsx                          # 新增
│   ├── TextField.tsx                     # 新增
│   ├── LoadingState.tsx                  # 新增
│   ├── EmptyState.tsx                    # 新增
│   ├── ErrorState.tsx                    # 新增
│   ├── OfflineBanner.tsx                 # 新增
│   ├── ScreenPlaceholder.tsx             # 修改：改用 AppText/token
│   ├── AppHeaderAvatar.tsx               # 修改：复用交互 token
│   └── AppErrorBoundary.tsx              # 修改：复用 AppText/Button 或共享 token
├── screens/
│   └── ...                               # 不新增业务页面
└── test/
    └── render.tsx                        # 保持统一 Provider

apps/mobile/__tests__/
├── AppText.test.tsx
├── Button.test.tsx
├── IconButton.test.tsx
├── Card.test.tsx
├── TextField.test.tsx
├── states.test.tsx
└── theme.test.ts                         # 修改：补齐 token 契约

docs/project-management/
├── REACT_NATIVE_ROADMAP.md               # 修改：状态与当前能力
└── RN-002_DESIGN_SYSTEM_DEVELOPMENT_GUIDE.md
```

## 8. 组件出口为什么重要

组件内部文件可以调整，但业务页面应从统一出口导入：

```tsx
import { AppText, Button, Card, EmptyState } from '../../components'
```

而不是：

```tsx
import { Button } from '../../components/Button'
```

统一出口让后续移动文件、添加埋点或替换内部实现时不需要修改所有页面。但组件内部互相引用时可以直接引用具体文件，避免 index 循环依赖。

## 9. 测试策略

### 9.1 Token 与主题测试

- light/dark 拥有相同语义颜色键；
- typography 每个 variant 都有 fontSize 与 lineHeight；
- 触控尺寸不低于 48；
- disabledOpacity 在 0～1 之间；
- 创建主题不会返回页面业务专属 token。

### 9.2 `Button` 测试

- 展示可访问按钮角色与名称；
- 点击触发一次 `onPress`；
- disabled 不触发；
- loading 显示 busy、隐藏/保留合理 label、阻止重复提交；
- primary/secondary/danger 使用对应主题语义；
- 小屏和字体放大时文字不被固定宽度裁切。

### 9.3 `TextField` 测试

- label 可以定位输入框；
- 输入文字触发 `onChangeText`；
- error 文案出现并具备 alert 语义；
- helper 与 error 不同时造成重复朗读；
- editable=false 时保持正确语义。

### 9.4 状态组件测试

- Loading 有可访问状态说明；
- Empty 的 action 可执行；
- Error 会被辅助技术识别且 retry 可执行；
- Offline 显示待同步数量；
- 没有 action 时不渲染空按钮。

### 9.5 不使用大面积 Snapshot

Snapshot 容易记录大量 React Native 内部结构和样式数组，小改样式会产生巨大 diff，但不一定提升信心。本项目优先测试：

```text
用户看到了什么
→ 用户能否操作
→ 辅助技术读到了什么
→ 组件对外输出什么
```

## 10. 开发流程

确认后按以下顺序实施：

### 步骤 1：锁定 Foundation

1. 完善 color、typography、spacing、size、motion token；
2. 更新 `AppTheme` 类型；
3. 先补 light/dark 契约测试；
4. 验证现有导航主题仍兼容。

### 步骤 2：实现文字与操作原语

1. 实现 `AppText`；
2. 实现 `Button`；
3. 实现 `IconButton`；
4. 测试 normal、pressed、disabled、loading。

### 步骤 3：实现容器与输入

1. 实现 `Card`；
2. 实现 `TextField`；
3. 测试静态/可点击 Card 与输入错误语义。

### 步骤 4：实现状态模式

1. Loading；
2. Empty；
3. Error；
4. Offline；
5. 复用前面的 AppText/Button/Icon token。

### 步骤 5：迁移现有组件

1. `ScreenPlaceholder` 改用 AppText 与 size token；
2. `AppHeaderAvatar` 使用统一触控和 press token；
3. `AppErrorBoundary` 尽可能复用样式规则，但保持 Provider 崩溃时也能独立显示；
4. 确认导航外观和返回行为不变。

### 步骤 6：全量验证

```bash
pnpm --filter @studycommit/mobile typecheck
pnpm --filter @studycommit/mobile test:run
pnpm --filter @studycommit/mobile test:coverage
pnpm typecheck
pnpm test
```

再验证：

- iOS/Android bundle；
- 375pt 小屏；
- 横屏；
- 最大 Dynamic Type；
- light/dark；
- VoiceOver/TalkBack 基础朗读路径。

## 11. 初学者原理课

### 11.1 设计系统不是“样式文件”

设计系统包含三层：

```text
Token：最小设计决定，例如 16dp 间距
Component：可复用交互，例如 Button
Pattern：多个组件组合的状态，例如 ErrorState
```

Token 不知道业务；Button 不知道 Topic；Topic 页面通过组合它们完成业务。

### 11.2 Props 是组件的契约

```tsx
<Button variant="primary" loading={saving} onPress={save}>
  保存
</Button>
```

这里 `variant`、`loading`、`onPress` 和 children 就是 Button 对外承诺支持的能力。组件内部可以从 `Pressable` 改为别的实现，只要契约和用户行为不变，业务页面无需修改。

### 11.3 Composition 优于复制

`EmptyState` 不应该复制一套按钮代码，而应该组合：

```tsx
<AppText variant="heading">还没有专题</AppText>
<AppText color="muted">创建第一个专题开始学习。</AppText>
<Button onPress={onAction}>创建专题</Button>
```

这样 Button 的禁用、触控区和深色模式修复会自动影响所有空状态。

### 11.4 为什么要限制 variant

如果 Button 接受任意颜色和任意高度，每个页面仍然会自行设计，组件只剩一个薄包装。有限的 variant 可以让产品一致，也让测试覆盖所有正式状态。

### 11.5 Dynamic Type 与固定高度

用户可能把系统字体调到最大。按钮设置 `minHeight: 48` 而不是 `height: 48`，文字放大时组件可以长高，不会裁掉文字。

## 12. 验收标准

### 自动化

- [x] 全仓 TypeScript 与 RN-002/既有移动端测试通过；
- [x] 每个公共组件有行为测试；
- [x] Button disabled/loading 不触发重复提交；
- [x] TextField error 具备可访问语义；
- [x] light/dark token 契约一致；
- [x] 覆盖率保持现有阈值以上；
- [x] 无循环依赖和 Metro module resolution 错误。

### 视觉与交互

- [x] 所有设计系统操作控件的样式契约至少 48×48dp；
- [x] 按下反馈仅改变 opacity，不改变布局；
- [ ] Light/dark 文字与背景对比清晰；
- [ ] 最大字体下按钮、输入框和状态组件不裁切；
- [ ] 375pt、横屏和平板宽度布局可用；
- [x] 图标统一使用 Ionicons，不使用 Emoji；
- [x] Loading、Empty、Error、Offline 均非空白状态；
- [x] Offline 不阻断离线可用功能。

### 完成定义

- [x] RN-004 可直接组合组件实现 Topic 正常/空/加载/失败/离线页面；
- [x] 公共出口提供基础按钮和输入框视觉契约；
- [x] 文档与路线图状态同步；
- [x] iOS 和 Android bundle 成功。

人工设备项（最大字体、VoiceOver/TalkBack、375pt/横屏/平板和真实 light/dark 对比）保留为发布前设备矩阵，不以 Jest 或 Metro bundle 代替。

## 13. 风险与控制

| 风险 | 控制方式 |
|---|---|
| 设计系统范围无限扩大 | 只实现 RN-004/RN-101 已确定复用的组件 |
| 抽象过早 | TopicRow 等业务组件留到真实页面中验证后提取 |
| 组件 API 允许任意样式 | 使用有限 variant 和语义 token |
| 为统一而破坏原生能力 | Props 继承 React Native 原生 Props |
| 最大字体破坏布局 | 使用 minHeight、文字换行和人工 Dynamic Type 验收 |
| 状态只用颜色表达 | 强制图标/文字/辅助技术语义共同表达 |
| Error Boundary 依赖已崩溃 Provider | 顶层兜底继续保留独立主题计算能力 |
| 新依赖引发 Metro 问题 | 本阶段不新增 UI 依赖，继续复用 Ionicons 与原生组件 |

## 14. 本次确认点

进入开发前确认以下方案：

1. RN-002 采用精简组件集，不引入 Storybook 或第三方 UI 框架；
2. 首批包含 AppText、Button、IconButton、Card、TextField；
3. 状态模式包含 Loading、Empty、Error、Offline；
4. 使用系统字体、Ionicons 和现有青绿色主题方向；
5. TopicRow、NoteCard 等业务组件留到对应业务任务中实现；
6. RN-002 完成后进入 RN-003 数据访问层，再实现 RN-004 Topic 页面。

确认后按第 10 节开始开发，并在实现每个组件时解释 Props、组合、状态与可访问性原理。
