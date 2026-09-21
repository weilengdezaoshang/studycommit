/** 原生字体别名与 App 的 useFonts 注册名对应；不对正文、输入和数字使用手写字体。 */
export const paperTypography = {
  heading: { fontFamily: 'NotebookHand', fontWeight: '400' as const },
  drawer: { fontFamily: 'NotebookDrawer', fontWeight: '400' as const },
} as const
