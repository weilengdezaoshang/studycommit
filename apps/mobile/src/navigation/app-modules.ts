import type { ComponentProps } from 'react'
import type Ionicons from '@expo/vector-icons/Ionicons'
import type { MainTabParamList } from './navigation.types'

type IconName = ComponentProps<typeof Ionicons>['name']

export type AppTabModule = {
  name: keyof MainTabParamList
  title: string
  accessibilityLabel: string
  icons: { focused: IconName; unfocused: IconName }
}

export const APP_TAB_MODULES: readonly AppTabModule[] = [
  {
    name: 'TodayTab',
    title: '今天',
    accessibilityLabel: '今天，标签页',
    icons: { focused: 'today', unfocused: 'today-outline' },
  },
  {
    name: 'TopicsTab',
    title: '专题',
    accessibilityLabel: '专题，标签页',
    icons: { focused: 'book', unfocused: 'book-outline' },
  },
  {
    name: 'RecordsTab',
    title: '记录',
    accessibilityLabel: '记录，标签页',
    icons: { focused: 'create', unfocused: 'create-outline' },
  },
  {
    name: 'ReviewTab',
    title: '复习',
    accessibilityLabel: '复习，标签页',
    icons: { focused: 'layers', unfocused: 'layers-outline' },
  },
]

export const APP_STACK_HOMES = {
  TodayTab: { name: 'TodayHome', title: '今天' },
  TopicsTab: { name: 'TopicsHome', title: '专题' },
  RecordsTab: { name: 'RecordsHome', title: '记录' },
  ReviewTab: { name: 'ReviewHome', title: '复习' },
} as const
