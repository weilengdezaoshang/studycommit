# RN-002 React Native 设计系统完整测试用例

| 项目 | 内容 |
|---|---|
| 对应功能 | RN-002 设计系统 |
| 文档状态 | 自动化测试已实现并通过；人工设备矩阵待发布前执行 |
| 自动化工具 | Jest 29、jest-expo、React Native Testing Library 14 |
| 人工环境 | iOS Simulator、Android Emulator、VoiceOver、TalkBack |
| 更新时间 | 2026-08-14 |

## 1. 测试目标

验证 RN-002 的 Foundation、基础组件和状态模式满足以下目标：

- light/dark 主题契约一致；
- 组件 API 与设计文档一致；
- 正常、按压、禁用、加载、错误状态行为可靠；
- 不发生重复提交或静默失败；
- 屏幕阅读器获得正确角色、名称、状态和提示；
- iOS/Android 触控区、安全区、Dynamic Type 和键盘行为可用；
- 已有导航、错误边界和占位页面不因组件迁移回归；
- RN-004 可以直接使用这些组件实现正常、空、加载、失败和离线页面。

## 2. 测试分层

| 层级 | 标识 | 执行环境 | 适合验证 |
|---|---|---|---|
| 单元测试 | UT | Jest | Token、纯函数、variant 映射 |
| 组件测试 | CT | Jest + RNTL | 渲染、Props、交互、可访问性状态 |
| 集成回归 | IT | Jest + RNTL | 多组件组合、主题 Provider、导航根应用 |
| 人工验收 | MT | 模拟器/真机 | 真实字体、键盘、旋转、触控、屏幕阅读器 |
| 构建检查 | BT | Expo/Metro | iOS/Android 模块解析和 bundle |

## 3. 通用约定

### 3.1 自动化查询优先级

```text
getByRole + accessible name
→ getByLabelText / getByHintText
→ getByText
→ getByTestId（无用户语义时才使用）
```

### 3.2 交互方式

- 点击、输入和清空优先使用 `userEvent`；
- 仅在 User Event 不支持的原生事件中使用 `fireEvent`；
- 每个测试独立 render，不共享组件实例；
- 使用 `renderWithAppProviders` 注入确定的安全区和主题；
- 修改 timer、console 或 mock 后必须恢复；
- 不用大面积 snapshot 代替行为断言。

### 3.3 优先级

| 优先级 | 含义 |
|---|---|
| P0 | 失败则阻止 RN-002 完成 |
| P1 | MVP 发布前必须通过 |
| P2 | 增强质量，允许在后续补充 |

## 4. Foundation：Token 与 Theme

计划文件：`theme.test.ts`、`tokens.test.ts`

| ID | 优先级 | 类型 | 测试场景 | 操作/输入 | 预期结果 |
|---|---|---|---|---|---|
| DS-FND-001 | P0 | UT | Light 主题生成 | `createTheme('light')` | `isDark=false`，返回 light colors |
| DS-FND-002 | P0 | UT | Dark 主题生成 | `createTheme('dark')` | `isDark=true`，返回 dark colors |
| DS-FND-003 | P0 | UT | 无系统偏好 | `createTheme(undefined/null)` | 安全回退到 light，不抛异常 |
| DS-FND-004 | P0 | UT | 颜色契约一致 | 比较 light/dark color keys | 键集合完全相同 |
| DS-FND-005 | P0 | UT | 必需颜色齐全 | 检查颜色对象 | background、surface、text、primary、danger、success、warning 等均存在 |
| DS-FND-006 | P0 | UT | 颜色格式有效 | 遍历 colors | 除透明语义外均为有效颜色字符串 |
| DS-FND-007 | P0 | UT | 页面业务未进入 token | 检查 keys | 不包含 topic、note、review 等业务命名 |
| DS-FND-008 | P0 | UT | Typography variants 齐全 | 遍历 typography | display/title/heading/subheading/body/bodySmall/label/caption 均存在 |
| DS-FND-009 | P0 | UT | Typography 数值有效 | 遍历每个 variant | fontSize > 0，lineHeight ≥ fontSize |
| DS-FND-010 | P1 | UT | 正文可读行高 | 检查 body/bodySmall | lineHeight/fontSize 处于可读范围，目标约 1.4～1.75 |
| DS-FND-011 | P0 | UT | 间距单调递增 | 遍历 spacing | 数值递增且非负 |
| DS-FND-012 | P1 | UT | 间距遵循 4dp 节奏 | 遍历 spacing | 数值为 4 的倍数，允许 zero |
| DS-FND-013 | P0 | UT | 触控尺寸合规 | 检查 sizes.touchTarget/controlHeight | 均 ≥ 48 |
| DS-FND-014 | P0 | UT | 图标尺寸齐全 | 检查 sizes | sm/md/lg/xl 均存在且递增 |
| DS-FND-015 | P1 | UT | 内容最大宽度有效 | 检查 contentMaxWidth | ≥ 320 且适合平板阅读，目标 640 |
| DS-FND-016 | P0 | UT | 圆角有效 | 遍历 radii | 非负且 pill 大于普通圆角 |
| DS-FND-017 | P0 | UT | Press opacity 有效 | 检查 motion/opacity | pressed 介于 0 和 1，且高于 disabled |
| DS-FND-018 | P0 | UT | Disabled opacity 有效 | 检查值 | 介于 0 和 1，控件仍可辨认 |
| DS-FND-019 | P1 | UT | 动画时长有效 | 检查 duration | fast/normal 为正且 normal ≥ fast，目标 150～300ms |
| DS-FND-020 | P0 | CT | ThemeProvider light override | 以 light render probe | hook 返回 light theme |
| DS-FND-021 | P0 | CT | ThemeProvider dark override | 以 dark render probe | hook 返回 dark theme |
| DS-FND-022 | P0 | CT | Hook 在 Provider 外调用 | 直接 render probe | 抛出明确错误，不返回 null theme |
| DS-FND-023 | P1 | IT | Navigation theme 与 AppTheme 同步 | light/dark 分别渲染 | background/card/text/primary 使用对应语义色 |

## 5. `AppText`

计划文件：`AppText.test.tsx`

| ID | 优先级 | 类型 | 测试场景 | 操作/输入 | 预期结果 |
|---|---|---|---|---|---|
| DS-TXT-001 | P0 | CT | 默认文字 | render 默认 props | 正文显示且使用 body variant |
| DS-TXT-002 | P0 | CT | 全部 variant | 参数化 render 8 种 variant | 每种映射正确 fontSize/lineHeight |
| DS-TXT-003 | P0 | CT | 默认颜色 | render 默认 | 使用 theme.colors.text |
| DS-TXT-004 | P0 | CT | Muted 颜色 | `color="muted"` | 使用 textMuted |
| DS-TXT-005 | P0 | CT | Danger 颜色 | `color="danger"` | 使用 danger |
| DS-TXT-006 | P1 | CT | Success 颜色 | `color="success"` | 使用 success |
| DS-TXT-007 | P0 | CT | Weight 映射 | regular/medium/semibold | fontWeight 分别正确 |
| DS-TXT-008 | P0 | CT | 标题角色 | title/heading | 默认暴露 header role |
| DS-TXT-009 | P0 | CT | 正文无错误标题角色 | body/caption | 不错误暴露 header role |
| DS-TXT-010 | P1 | CT | 调用方覆盖角色 | 传 accessibilityRole | 尊重调用方显式值 |
| DS-TXT-011 | P0 | CT | 原生 TextProps 转发 | 传 numberOfLines/selectable | props 正确到原生 Text |
| DS-TXT-012 | P0 | CT | 默认允许字体缩放 | 不传 allowFontScaling | 未被强制设为 false |
| DS-TXT-013 | P1 | CT | 自定义 style 合并 | 传 marginTop/textAlign | 保留 token 样式且应用外部布局样式 |
| DS-TXT-014 | P0 | CT | Dark theme | dark render | 使用 dark 语义色 |
| DS-TXT-015 | P1 | CT | 嵌套文本 | AppText 内嵌 Text | 内容完整，无异常 |
| DS-TXT-016 | P1 | MT | 最大 Dynamic Type | 系统字体最大 | 文字可换行、不裁切、不重叠 |
| DS-TXT-017 | P1 | MT | 中英文混排 | 显示中文、React Native、数字 | 字体正常，无乱码或异常字距 |

## 6. `Button`

计划文件：`Button.test.tsx`

| ID | 优先级 | 类型 | 测试场景 | 操作/输入 | 预期结果 |
|---|---|---|---|---|---|
| DS-BTN-001 | P0 | CT | 默认按钮 | render `创建专题` | role=button，名称为创建专题 |
| DS-BTN-002 | P0 | CT | 正常点击 | user press 一次 | `onPress` 调用一次 |
| DS-BTN-003 | P0 | CT | Disabled 点击 | disabled 后 press | `onPress` 不调用 |
| DS-BTN-004 | P0 | CT | Disabled 语义 | disabled render | accessibilityState.disabled=true |
| DS-BTN-005 | P0 | CT | Loading 点击 | loading 后 press | `onPress` 不调用 |
| DS-BTN-006 | P0 | CT | Loading 语义 | loading render | busy=true，disabled=true |
| DS-BTN-007 | P0 | CT | Loading 指示器 | loading render | 显示 ActivityIndicator/加载状态 |
| DS-BTN-008 | P0 | CT | Loading 名称可理解 | loading render | 屏幕阅读器仍能知道原动作或“保存中” |
| DS-BTN-009 | P0 | CT | Primary variant | render primary | 背景 primary、文字 onPrimary |
| DS-BTN-010 | P0 | CT | Secondary variant | render secondary | surface 背景、明确边框、文字 text |
| DS-BTN-011 | P0 | CT | Ghost variant | render ghost | 无实体背景，文字 primary |
| DS-BTN-012 | P0 | CT | Danger variant | render danger | danger 背景、文字 onDanger |
| DS-BTN-013 | P0 | CT | Light/Dark variants | 参数化两主题 | 均使用对应主题值，不写死 light 色 |
| DS-BTN-014 | P0 | CT | Medium 尺寸 | size=medium | minHeight ≥ 48，padding 使用 token |
| DS-BTN-015 | P0 | CT | Large 尺寸 | size=large | 不小于 medium，文字和 padding 对应定义 |
| DS-BTN-016 | P0 | CT | Pressed 状态 | 调用 style callback pressed=true | opacity 使用 pressed token，尺寸不变 |
| DS-BTN-017 | P0 | CT | Disabled 视觉 | disabled | opacity 使用 disabled token |
| DS-BTN-018 | P0 | CT | Loading 视觉稳定 | normal 与 loading 对比 | 不因 spinner 导致按钮明显宽度跳变 |
| DS-BTN-019 | P1 | CT | 左侧图标 | 传 icon | 图标显示，文字仍为可访问名称 |
| DS-BTN-020 | P1 | CT | 装饰图标不重复朗读 | 传 icon | 图标从辅助树隐藏 |
| DS-BTN-021 | P0 | CT | 原生 Props 转发 | testID/hint/onLongPress | props/事件正常 |
| DS-BTN-022 | P0 | CT | style 合并 | 传 marginTop/alignSelf | 不覆盖内部最小触控和状态样式 |
| DS-BTN-023 | P0 | CT | 快速连续点击约束 | loading 切换后再次 press | 业务 loading 后不重复触发 |
| DS-BTN-024 | P1 | MT | iOS 触控 | 点击按钮边缘 | 可可靠触发，点击区域 ≥44pt |
| DS-BTN-025 | P1 | MT | Android 触控 | 点击按钮边缘 | 可可靠触发，区域 ≥48dp |
| DS-BTN-026 | P1 | MT | 最大字体 | Dynamic Type 最大 | 按钮允许增高，文字不裁切 |
| DS-BTN-027 | P1 | MT | 按压反馈 | 真机/模拟器长按观察 | 反馈及时，无布局位移或抖动 |
| DS-BTN-028 | P1 | MT | VoiceOver/TalkBack | 聚焦 normal/disabled/loading | 正确朗读名称、按钮、禁用/忙碌状态 |

## 7. `IconButton`

计划文件：`IconButton.test.tsx`

| ID | 优先级 | 类型 | 测试场景 | 操作/输入 | 预期结果 |
|---|---|---|---|---|---|
| DS-ICN-001 | P0 | TS | Label 必填 | TypeScript 编译无 label 用法 | 编译失败，契约阻止无名称按钮 |
| DS-ICN-002 | P0 | CT | 可访问按钮 | render label=搜索专题 | role=button，名称正确 |
| DS-ICN-003 | P0 | CT | 点击 | user press | `onPress` 一次 |
| DS-ICN-004 | P0 | CT | Disabled | disabled + press | 不调用，disabled=true |
| DS-ICN-005 | P0 | CT | Loading（若 API 支持） | loading | busy/disabled，阻止点击 |
| DS-ICN-006 | P0 | CT | 触控尺寸 | flatten style | minWidth/minHeight ≥48 |
| DS-ICN-007 | P0 | CT | 默认图标尺寸 | 不传 size | 使用 iconLg 或定义默认值 |
| DS-ICN-008 | P1 | CT | 自定义图标尺寸 | 传允许 size | 图标变化但触控区不缩小 |
| DS-ICN-009 | P0 | CT | Default variant | render | 使用标准前景/表面 |
| DS-ICN-010 | P0 | CT | Subtle variant | render | 使用次级表面，仍具足够对比 |
| DS-ICN-011 | P0 | CT | Danger variant | render | 使用 danger 语义，不只靠颜色标签 |
| DS-ICN-012 | P0 | CT | Pressed | pressed style | opacity 变化，不改变边界 |
| DS-ICN-013 | P0 | CT | 图标辅助树 | 查询辅助节点 | 只朗读按钮 label，不朗读字体 glyph |
| DS-ICN-014 | P0 | CT | Dark theme | dark render | 语义色正确 |
| DS-ICN-015 | P1 | MT | 邻近按钮间距 | 两按钮并列 | 点击目标不重叠，间距 ≥8dp |
| DS-ICN-016 | P1 | MT | VoiceOver/TalkBack | 聚焦按钮 | 朗读“搜索专题，按钮”而非乱码图标 |

## 8. `Card`

计划文件：`Card.test.tsx`

| ID | 优先级 | 类型 | 测试场景 | 操作/输入 | 预期结果 |
|---|---|---|---|---|---|
| DS-CRD-001 | P0 | CT | 静态 Card | 无 onPress | 内容显示，不暴露 button role |
| DS-CRD-002 | P0 | CT | 可点击 Card | 有 onPress + label | 暴露 button role 和名称 |
| DS-CRD-003 | P0 | CT | Card 点击 | user press | `onPress` 一次 |
| DS-CRD-004 | P0 | TS/DEV | 可点击但无 label | 缺少 accessibilityLabel | TypeScript 或开发期警告阻止无名交互卡片 |
| DS-CRD-005 | P0 | CT | Default variant | render | surface、border、radius 使用 token |
| DS-CRD-006 | P0 | CT | Muted variant | render | surfaceMuted 语义正确 |
| DS-CRD-007 | P0 | CT | Outlined variant | render | 透明/页面背景与明确边框符合定义 |
| DS-CRD-008 | P0 | CT | Padding none | render | 无内部 padding |
| DS-CRD-009 | P0 | CT | Padding small | render | 使用 spacing.sm/md 约定 |
| DS-CRD-010 | P0 | CT | Padding medium | render | 使用默认 token |
| DS-CRD-011 | P0 | CT | Padding large | render | 大于 medium |
| DS-CRD-012 | P0 | CT | Pressed 可点击 Card | pressed callback | opacity 变化，布局尺寸不变 |
| DS-CRD-013 | P0 | CT | 子内容组合 | 多个 AppText/View | 内容顺序与 props 保留 |
| DS-CRD-014 | P0 | CT | 外部 style 合并 | margin/alignSelf | 不破坏内部 surface/radius 契约 |
| DS-CRD-015 | P0 | CT | Light/Dark | 两主题 render | surface/border 使用各主题值 |
| DS-CRD-016 | P1 | MT | 最大字体 | 卡片内长标题 | Card 自动增高，无文字溢出 |
| DS-CRD-017 | P1 | MT | 长内容 | 多段正文 | 无固定高度截断，滚动由页面负责 |

## 9. `TextField`

计划文件：`TextField.test.tsx`

| ID | 优先级 | 类型 | 测试场景 | 操作/输入 | 预期结果 |
|---|---|---|---|---|---|
| DS-FLD-001 | P0 | TS | Label 必填 | 无 label 用法 | TypeScript 编译失败 |
| DS-FLD-002 | P0 | CT | Label 与输入关联 | render label=专题名称 | `getByLabelText` 找到 TextInput |
| DS-FLD-003 | P0 | CT | 输入文字 | user type | `onChangeText` 收到完整文本 |
| DS-FLD-004 | P0 | CT | Controlled value | value 更新后 rerender | 显示最新值 |
| DS-FLD-005 | P0 | CT | Placeholder | 传 placeholder | 可显示，但 label 仍存在 |
| DS-FLD-006 | P0 | CT | Helper text | 传 helperText | 显示帮助文案，输入可通过 hint/描述理解 |
| DS-FLD-007 | P0 | CT | Error text | 传 error | error 显示在输入附近 |
| DS-FLD-008 | P0 | CT | Error 语义 | 传 error | error 可被 alert/live 方式识别 |
| DS-FLD-009 | P0 | CT | Error 优先级 | helper + error | 不重复显示冲突说明，error 优先 |
| DS-FLD-010 | P0 | CT | Error 不只依赖颜色 | error | 有错误文字与 invalid 状态 |
| DS-FLD-011 | P0 | CT | Invalid 关联 | error | TextInput 暴露 invalid/对应可访问状态 |
| DS-FLD-012 | P0 | CT | Disabled | editable=false | 不能输入，状态语义正确，视觉降级 |
| DS-FLD-013 | P1 | CT | Read-only（若支持） | readOnly=true | 不可编辑但视觉与 disabled 有区别 |
| DS-FLD-014 | P0 | CT | 控件高度 | 单行 render | minHeight ≥48 |
| DS-FLD-015 | P0 | CT | Multiline | multiline | 使用更高 minHeight，文字顶部对齐 |
| DS-FLD-016 | P0 | CT | 原生属性转发 | keyboardType/returnKeyType/autoCapitalize | props 正确传入 TextInput |
| DS-FLD-017 | P0 | CT | maxLength | 输入超长文本 | 遵循原生 maxLength 行为/props |
| DS-FLD-018 | P0 | CT | Secure text | secureTextEntry | 属性正确传递，不在测试输出暴露业务密码 |
| DS-FLD-019 | P0 | CT | Light/Dark | 两主题 | 文本、placeholder、边框和背景正确 |
| DS-FLD-020 | P0 | CT | Focus style 契约 | focus/blur 事件 | focus 边框状态可区分且回退正常 |
| DS-FLD-021 | P0 | CT | Error + Focus | error 下 focus | danger 语义优先，不丢错误状态 |
| DS-FLD-022 | P1 | CT | 外部 style | 容器 style/输入 style（按 API） | 合并方式明确，不破坏最小高度 |
| DS-FLD-023 | P1 | MT | iOS 键盘 | email/number/default | 出现对应键盘类型 |
| DS-FLD-024 | P1 | MT | Android 键盘 | email/number/default | 出现对应键盘类型 |
| DS-FLD-025 | P1 | MT | 键盘遮挡 | 页面底部输入框聚焦 | 输入框和主要操作不被键盘遮挡（页面集成验证） |
| DS-FLD-026 | P1 | MT | 最大字体 | 标签、输入、错误 | 可换行、不重叠、不裁切 |
| DS-FLD-027 | P1 | MT | VoiceOver/TalkBack 正常 | 聚焦输入 | 朗读 label、输入框、值/提示 |
| DS-FLD-028 | P1 | MT | VoiceOver/TalkBack 错误 | error 后聚焦 | 错误被宣布且可定位到输入框 |
| DS-FLD-029 | P1 | MT | 中文输入法 | 拼音组合输入 | 组合文字不丢失、不重复触发异常处理 |

## 10. `LoadingState`

计划文件：`states.test.tsx`

| ID | 优先级 | 类型 | 测试场景 | 操作/输入 | 预期结果 |
|---|---|---|---|---|---|
| DS-LOD-001 | P0 | CT | 默认加载状态 | render | 显示 ActivityIndicator |
| DS-LOD-002 | P0 | CT | 加载文案 | label=正在加载专题 | 可见且可访问 |
| DS-LOD-003 | P0 | CT | Busy 语义 | render | busy/progressbar 等语义正确 |
| DS-LOD-004 | P0 | CT | Light/Dark | 两主题 | spinner 和文字对比清晰 |
| DS-LOD-005 | P1 | CT | 自定义说明 | 传 description（若 API 支持） | 正确显示，不替代主 label |
| DS-LOD-006 | P1 | MT | 减少动态效果 | 系统 Reduce Motion | 不增加装饰动画，仅保留必要系统进度反馈 |
| DS-LOD-007 | P1 | MT | 居中与滚动页 | 页面内加载 | 不被 header/tab 遮挡，不造成横向溢出 |

## 11. `EmptyState`

计划文件：`states.test.tsx`

| ID | 优先级 | 类型 | 测试场景 | 操作/输入 | 预期结果 |
|---|---|---|---|---|---|
| DS-EMP-001 | P0 | CT | 基本空状态 | title + description | 两者显示，标题为正确层级 |
| DS-EMP-002 | P0 | CT | 带操作 | actionLabel + onAction | 显示一个按钮 |
| DS-EMP-003 | P0 | CT | 操作点击 | user press | onAction 一次 |
| DS-EMP-004 | P0 | CT | 无操作 | 不传 action | 不渲染空按钮或不可用按钮 |
| DS-EMP-005 | P0 | CT | Props 不完整保护 | 只有 actionLabel 或 onAction | 类型契约/开发警告阻止半配置状态 |
| DS-EMP-006 | P0 | CT | 图标装饰语义 | render icon | 不重复朗读 glyph |
| DS-EMP-007 | P0 | CT | Light/Dark | 两主题 | 标题、说明、图标表面正确 |
| DS-EMP-008 | P1 | CT | 长文案 | 长 title/description | 内容完整，可换行 |
| DS-EMP-009 | P1 | MT | 小屏 375pt | render | 无横向溢出，操作可见 |
| DS-EMP-010 | P1 | MT | 最大字体 | render | 页面可滚动，按钮不被裁切 |
| DS-EMP-011 | P1 | MT | VoiceOver/TalkBack 顺序 | 聚焦状态 | 标题→说明→操作顺序合理 |

## 12. `ErrorState`

计划文件：`states.test.tsx`

| ID | 优先级 | 类型 | 测试场景 | 操作/输入 | 预期结果 |
|---|---|---|---|---|---|
| DS-ERR-001 | P0 | CT | 基本错误 | title + description | 错误内容显示 |
| DS-ERR-002 | P0 | CT | Alert 语义 | render | role=alert 或等效 live 语义 |
| DS-ERR-003 | P0 | CT | 带重试 | onRetry | 显示重试按钮 |
| DS-ERR-004 | P0 | CT | 重试点击 | user press | onRetry 一次 |
| DS-ERR-005 | P0 | CT | 无重试 | 不传 onRetry | 不显示无效按钮 |
| DS-ERR-006 | P0 | CT | Retry loading（若 API 支持） | retrying=true | busy/disabled，阻止重复点击 |
| DS-ERR-007 | P0 | CT | 错误不只靠颜色 | render | 有错误标题、说明、图标/语义 |
| DS-ERR-008 | P0 | CT | Danger theme | light/dark | 使用对应 danger 与 dangerSurface |
| DS-ERR-009 | P1 | CT | 错误详情安全 | 传用户文案 | 不自动展示 Error stack/object |
| DS-ERR-010 | P1 | MT | 屏幕阅读器通知 | 状态从 loading 切到 error | 错误被宣布，不需用户猜测 |
| DS-ERR-011 | P1 | MT | 最大字体 | 长错误说明 | 可滚动、重试按钮仍可访问 |

## 13. `OfflineBanner`

计划文件：`states.test.tsx`

| ID | 优先级 | 类型 | 测试场景 | 操作/输入 | 预期结果 |
|---|---|---|---|---|---|
| DS-OFL-001 | P0 | CT | 离线基本文案 | pendingCount 未传/0 | 显示离线可继续使用 |
| DS-OFL-002 | P0 | CT | 单条待同步 | pendingCount=1 | 显示 1 条待同步，语法正确 |
| DS-OFL-003 | P0 | CT | 多条待同步 | pendingCount=3 | 显示 3 条待同步 |
| DS-OFL-004 | P0 | CT | 非法负数保护 | pendingCount=-1 | 归零或开发警告，不显示负数 |
| DS-OFL-005 | P0 | CT | 状态不只靠颜色 | render | 有离线图标和明确文字 |
| DS-OFL-006 | P0 | CT | 图标辅助树 | render | 不重复朗读图标 glyph |
| DS-OFL-007 | P0 | CT | Warning theme | light/dark | warningSurface/文字对比正确 |
| DS-OFL-008 | P0 | CT | 非阻塞 | 与按钮/内容组合 | 下方主要操作仍可点击 |
| DS-OFL-009 | P1 | CT | 可选重试（若 API 支持） | onRetry | 有明确按钮且点击一次 |
| DS-OFL-010 | P1 | MT | 安全区位置 | 顶部/内容区展示 | 不被 header、刘海或状态栏遮挡 |
| DS-OFL-011 | P1 | MT | 最大字体 | render | Banner 可增高，不遮住业务内容 |
| DS-OFL-012 | P1 | MT | 状态恢复 | offline → online | Banner 消失，布局无明显跳动/内容仍在 |

## 14. 公共出口与类型契约

计划文件：`components.exports.test.ts` 或 TypeScript 编译检查

| ID | 优先级 | 类型 | 测试场景 | 操作/输入 | 预期结果 |
|---|---|---|---|---|---|
| DS-API-001 | P0 | UT/TS | 公共出口完整 | 从 `components` 导入全部公共组件 | 编译成功 |
| DS-API-002 | P0 | TS | 不暴露内部 helper | 检查公共出口 | variant resolver 等内部实现未导出 |
| DS-API-003 | P0 | TS | Button variant 限制 | 传非法 variant | 编译失败 |
| DS-API-004 | P0 | TS | AppText variant 限制 | 传非法 variant | 编译失败 |
| DS-API-005 | P0 | TS | Card 可点击契约 | onPress 与 label 组合类型 | 合法组合编译，非法组合失败（如采用 discriminated union） |
| DS-API-006 | P0 | TS | Empty action 契约 | actionLabel/onAction | 必须成对出现 |
| DS-API-007 | P0 | TS | 原生 Props 保留 | 使用 TextProps/PressableProps/TextInputProps | 合法原生属性可编译 |
| DS-API-008 | P1 | UT | 无循环依赖 | Metro/Jest 加载公共出口 | 不出现初始化 undefined 或循环依赖异常 |

## 15. 现有组件迁移与回归

计划文件：现有 `App.test.tsx`、`AppErrorBoundary.test.tsx` 与新增回归断言

| ID | 优先级 | 类型 | 测试场景 | 操作/输入 | 预期结果 |
|---|---|---|---|---|---|
| DS-REG-001 | P0 | IT | App 根渲染 | render App | 默认今天页显示，无 Error Boundary |
| DS-REG-002 | P0 | IT | 四 Tab 切换 | 依次点击今天/专题/记录/复习 | 对应页面显示 |
| DS-REG-003 | P0 | IT | 头像入口 | 点击打开我的 | Profile 页面显示 |
| DS-REG-004 | P0 | IT | ScreenPlaceholder 迁移 | render 各占位页 | 标题、说明、图标仍存在 |
| DS-REG-005 | P0 | IT | Placeholder 使用主题 | light/dark | 无写死浅色回归 |
| DS-REG-006 | P0 | IT | Error Boundary 正常子树 | render 正常内容 | 原样显示 |
| DS-REG-007 | P0 | IT | Error Boundary 捕获 | 子组件抛错 | 兜底页显示 |
| DS-REG-008 | P0 | IT | Error Boundary 重试 | 修复错误后点击重试 | 恢复子内容 |
| DS-REG-009 | P0 | IT | Provider 崩溃独立兜底 | Provider/Theme 子树抛错 | 兜底页不依赖已崩溃 Provider，仍可显示 |
| DS-REG-010 | P0 | IT | Header avatar 触控 | flatten style | 点击区域 ≥48 |
| DS-REG-011 | P0 | IT | Header avatar 朗读 | 查询角色和名称 | “打开我的，按钮”且不重复 W |
| DS-REG-012 | P0 | IT | Screen safe area | deterministic metrics | top/bottom inset 正确 |
| DS-REG-013 | P0 | IT | Tab 管理 bottom inset | includeBottomInset=false 场景 | 不产生双重 bottom padding |
| DS-REG-014 | P1 | MT | iOS 返回 | Profile 返回 | 回到原 Tab 与原状态 |
| DS-REG-015 | P1 | MT | Android 返回 | Profile 硬件返回 | 回到原 Tab，根页面按返回遵循系统行为 |

## 16. 跨组件组合用例

| ID | 优先级 | 类型 | 测试场景 | 操作/输入 | 预期结果 |
|---|---|---|---|---|---|
| DS-CMB-001 | P0 | IT | Empty + Button | 创建专题空状态 | action 可点击且只触发一次 |
| DS-CMB-002 | P0 | IT | Error + Button loading | retrying 状态 | 重试不可重复提交 |
| DS-CMB-003 | P0 | IT | Offline + 正常页面 | Banner + 创建按钮 | Banner 不阻止创建操作 |
| DS-CMB-004 | P0 | IT | Card + AppText | Topic 卡片原型 | 标题/说明层级正确，静态 Card 无错误 role |
| DS-CMB-005 | P0 | IT | Pressable Card + 嵌套内容 | 点击卡片 | 只产生一个可访问点击目标，避免嵌套按钮 |
| DS-CMB-006 | P0 | IT | TextField + Button | 输入专题名并提交 | 输入更新，点击提交收到最新值 |
| DS-CMB-007 | P0 | IT | TextField error + submit | 空值提交 | 显示字段错误，按钮仍可恢复操作 |
| DS-CMB-008 | P0 | IT | Loading → Empty | 模拟状态切换 | Loading 消失，Empty 出现，无同时叠加 |
| DS-CMB-009 | P0 | IT | Loading → Error | 模拟失败 | Loading 消失，Error 被宣布 |
| DS-CMB-010 | P0 | IT | Offline pending count 更新 | 1→3→0 | 文案正确更新，无陈旧值 |
| DS-CMB-011 | P1 | IT | Dark theme 全组件组合 | 展示全部组件 | 所有组件读取同一 ThemeProvider |
| DS-CMB-012 | P1 | IT | Light/Dark rerender | Provider theme 改变 | 组件颜色同步更新，输入值和页面状态不丢失 |

## 17. 人工视觉与设备矩阵

以下用例必须在真实原生环境验证，不能以 Jest 通过替代。

### 17.1 设备矩阵

| ID | 优先级 | 平台/配置 | 验证内容 | 通过标准 |
|---|---|---|---|---|
| DS-MTX-001 | P1 | iPhone 小屏，约 375pt | 全组件展示 | 无横向溢出、裁切、遮挡 |
| DS-MTX-002 | P1 | iPhone 大屏 | 布局和留白 | 内容不过度拉宽，最大宽度生效 |
| DS-MTX-003 | P1 | iPhone 横屏 | 组件与状态页 | 可滚动，安全区正确 |
| DS-MTX-004 | P1 | Android 小屏 | 全组件展示 | 48dp 触控区和文本可用 |
| DS-MTX-005 | P1 | Android 大屏 | 布局和留白 | 无任意拉伸，层级稳定 |
| DS-MTX-006 | P1 | Android 横屏 | 输入与状态页 | 键盘、滚动和系统栏不遮挡 |
| DS-MTX-007 | P1 | iPad/平板 | 长文本/Card | contentMaxWidth 生效，正文不横跨全屏 |
| DS-MTX-008 | P1 | Light mode | 全组件状态 | 文字/图标/边框可辨识 |
| DS-MTX-009 | P1 | Dark mode | 全组件状态 | 不使用简单反色，状态对比充分 |
| DS-MTX-010 | P1 | 最大字体 | 全组件状态 | 文字不裁切，页面可滚动 |
| DS-MTX-011 | P1 | Reduce Motion | loading/press | 无装饰性持续动画，必要反馈保留 |
| DS-MTX-012 | P1 | VoiceOver | 全组件遍历 | 顺序、名称、角色、状态合理 |
| DS-MTX-013 | P1 | TalkBack | 全组件遍历 | 顺序、名称、角色、状态合理 |

### 17.2 视觉状态矩阵

| ID | 优先级 | 组件 | 状态 | 通过标准 |
|---|---|---|---|---|
| DS-VIS-001 | P1 | Button | primary normal/pressed/disabled/loading | 四态明确且不发生布局跳动 |
| DS-VIS-002 | P1 | Button | secondary/ghost/danger | 层级与危险语义正确 |
| DS-VIS-003 | P1 | IconButton | normal/pressed/disabled | 图标清晰、触控区稳定 |
| DS-VIS-004 | P1 | Card | default/muted/outlined/pressed | 表面层级清晰但不过度装饰 |
| DS-VIS-005 | P1 | TextField | normal/focused/error/disabled/read-only | 每态可辨，error 不只靠颜色 |
| DS-VIS-006 | P1 | LoadingState | light/dark | spinner 与说明清晰，布局稳定 |
| DS-VIS-007 | P1 | EmptyState | 有/无 action | 说明清晰，不出现空白页 |
| DS-VIS-008 | P1 | ErrorState | 有/无 retry/loading retry | 恢复路径清楚，无重复提交 |
| DS-VIS-009 | P1 | OfflineBanner | 0/1/多条 pending | 文案准确，不阻塞页面 |
| DS-VIS-010 | P1 | AppText | 全 typography variants | 层级清楚，避免字号过多且不一致 |

## 18. 颜色对比度验收

颜色对比度需要使用对比度工具或计算脚本验证，不能只凭肉眼。

| ID | 优先级 | 组合 | 最低目标 |
|---|---|---|---|
| DS-CLR-001 | P0 | text / background | 4.5:1 |
| DS-CLR-002 | P0 | text / surface | 4.5:1 |
| DS-CLR-003 | P0 | textMuted / background | 普通小字 4.5:1；大 UI 辅助元素至少 3:1 |
| DS-CLR-004 | P0 | onPrimary / primary | 4.5:1 |
| DS-CLR-005 | P0 | onDanger / danger | 4.5:1 |
| DS-CLR-006 | P0 | danger / dangerSurface | 4.5:1（作为正文时） |
| DS-CLR-007 | P0 | success / successSurface | 4.5:1（作为正文时） |
| DS-CLR-008 | P0 | warning text / warningSurface | 4.5:1 |
| DS-CLR-009 | P1 | border / surface | 视觉边界目标至少 3:1，或以其他层级线索补充 |
| DS-CLR-010 | P1 | disabled text / disabled surface | 可辨认但不与 enabled 混淆；不承担关键信息 |
| DS-CLR-011 | P0 | Dark 全部上述组合 | 分别计算，不沿用 light 结论 |

## 19. 构建与质量门禁

| ID | 优先级 | 类型 | 命令/检查 | 预期结果 |
|---|---|---|---|---|
| DS-BLD-001 | P0 | BT | `pnpm --filter @studycommit/mobile typecheck` | 通过 |
| DS-BLD-002 | P0 | BT | `pnpm --filter @studycommit/mobile test:run` | 全部通过 |
| DS-BLD-003 | P0 | BT | `pnpm --filter @studycommit/mobile test:coverage` | 达到 Jest threshold |
| DS-BLD-004 | P0 | BT | `pnpm typecheck` | 全 workspace 通过 |
| DS-BLD-005 | P0 | BT | `pnpm test` | 全 workspace 通过 |
| DS-BLD-006 | P0 | BT | Expo iOS export | bundle 成功，无 module resolution 错误 |
| DS-BLD-007 | P0 | BT | Expo Android export | bundle 成功，无 module resolution 错误 |
| DS-BLD-008 | P0 | BT | `git diff --check` | 无空白和冲突标记问题 |
| DS-BLD-009 | P0 | BT | Metro clean start | `expo start --clear` 无 with-selector/screens 错误 |
| DS-BLD-010 | P1 | BT | Ionicons asset 检查 | 不因总入口导入打包无关图标字体 |
| DS-BLD-011 | P1 | BT | Console 检查 | 无 React key、act、a11y、deprecated 警告 |
| DS-BLD-012 | P1 | BT | 组件公共出口导入 | Metro/Jest 均可解析，无循环依赖 |

## 20. 测试文件映射

| 测试文件 | 覆盖用例前缀 |
|---|---|
| `tokens.test.ts` | DS-FND-005～019、DS-CLR（可计算部分） |
| `theme.test.ts` | DS-FND-001～004、020～023 |
| `AppText.test.tsx` | DS-TXT |
| `Button.test.tsx` | DS-BTN 自动化部分 |
| `IconButton.test.tsx` | DS-ICN 自动化部分 |
| `Card.test.tsx` | DS-CRD 自动化部分 |
| `TextField.test.tsx` | DS-FLD 自动化部分 |
| `states.test.tsx` | DS-LOD、DS-EMP、DS-ERR、DS-OFL |
| `components.exports.test.ts` | DS-API 运行时部分 |
| `design-system.integration.test.tsx` | DS-CMB |
| 现有 `App.test.tsx` | DS-REG-001～005、010～013 |
| 现有 `AppErrorBoundary.test.tsx` | DS-REG-006～009 |
| 人工验收记录 | DS-MTX、DS-VIS、人工 a11y/键盘用例 |

## 21. 预计自动化规模

测试实现时可以用参数化用例减少重复代码，但不能减少行为覆盖。

| 范围 | 预计 Jest test 数 |
|---|---:|
| Foundation / Theme | 20～25 |
| AppText | 12～15 |
| Button | 20～24 |
| IconButton | 10～14 |
| Card | 12～15 |
| TextField | 20～24 |
| 四类状态组件 | 25～32 |
| API / Integration / Regression | 20～28 |
| 合计 | 139～177 |

数量不是完成标准。允许使用 `it.each` 将同一行为矩阵写成一个参数化测试；最终以本文件所有 P0/P1 行为是否被覆盖为准。

## 22. 执行顺序

```text
1. 先写 Foundation 契约测试
2. 实现 token/theme 使其通过
3. 按 AppText → Button → IconButton → Card → TextField 顺序 TDD
4. 实现四类状态组件测试
5. 运行组合与现有导航回归
6. 运行覆盖率和双平台 bundle
7. 执行设备矩阵、Dynamic Type、VoiceOver/TalkBack
8. 回填失败项、修复并复测
```

## 23. RN-002 通过条件

RN-002 只有同时满足以下条件才可标记完成：

- 所有 P0 自动化用例通过；
- 所有 P1 自动化用例通过，或有明确批准的延期记录；
- Jest 全局覆盖率不低于现有门槛：branches 70%、functions 70%、lines/statements 75%；
- 实际结果应尽量保持当前基线以上，而不是以门槛为目标；
- iOS 和 Android bundle 成功；
- 375pt、小屏 Android、横屏、最大字体、light/dark 通过；
- VoiceOver 与 TalkBack 的核心组件路径通过；
- 无错误模块解析、循环依赖、React 警告和可访问性阻断问题；
- RN-004 可以用组件直接构造 Topic 的 Loading/Empty/Error/Offline/Normal 状态。

## 24. 确认点

进入测试代码编写前确认：

1. 以上用例作为 RN-002 的完整测试基线；
2. 自动化优先验证用户行为和可访问语义，不使用大面积 snapshot；
3. Dynamic Type、键盘、VoiceOver/TalkBack 和真实触控不以 Jest 代替；
4. 开发采用测试先行：先写失败测试，再实现组件；
5. P0/P1 用例必须通过后才进入 RN-003。
