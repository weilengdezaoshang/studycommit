# @studycommit/design-tokens

StudyCommit 桌面端与移动端共享的纯 TypeScript 设计变量。

本包只保存跨平台且语义一致的颜色、间距、圆角、基础排版、图标尺寸和动画数值，不包含 React、React Native、Electron、DOM 或业务代码。

```ts
import { lightColors, spacing } from '@studycommit/design-tokens'
```

React Native 可以直接把数值用于样式对象；Electron 应通过 Renderer 内的适配器将它们转换为 CSS Variables。触摸目标、窗口布局、hover、平台阴影等差异应保留在对应应用中。

新增变量前先判断两端的设计语义是否一致。仅仅数值相同，不代表它们应该成为同一个公共 Token。
