import { StyleSheet } from 'react-native'
import type { TemplateSummary } from '@studycommit/rpc-contracts/templates'
import { studyCommitColors } from '@studycommit/design-tokens'

/** 纸张/鼠尾草主题色(与小程序 tokens 对齐)。 */
export const paperColors = studyCommitColors

/** 四种纸页模板的卡片视觉:布局优先阶段以底色与角标区分,后续再画点阵/横线纹理。 */
export type PaperBackground = TemplateSummary['paperBackground']

export function paperTemplateStyle(background: PaperBackground) {
  switch (background) {
    case 'dot':
      return {
        backgroundColor: paperColors.paper,
        borderColor: paperColors.line,
        borderStyle: 'solid' as const,
      }
    case 'rule':
      return {
        backgroundColor: paperColors.surfaceSoft,
        borderColor: paperColors.line,
        borderStyle: 'solid' as const,
      }
    case 'grid':
      return {
        backgroundColor: paperColors.surfaceWarm,
        borderColor: paperColors.lineStrong,
        borderStyle: 'solid' as const,
      }
    default:
      return {
        backgroundColor: paperColors.surfaceSoft,
        borderColor: paperColors.line,
        borderStyle: 'solid' as const,
      }
  }
}

/** 纸页右上角黄色折角(未解决问题标记)。 */
export const questionFoldStyle = StyleSheet.create({
  fold: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 18,
    height: 18,
    borderTopWidth: 9,
    borderRightWidth: 9,
    borderTopColor: paperColors.accent,
    borderRightColor: 'transparent',
    borderTopRightRadius: 7,
  },
})
