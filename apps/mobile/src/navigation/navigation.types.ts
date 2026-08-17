import type { NavigatorScreenParams } from '@react-navigation/native'

export type TodayStackParamList = {
  TodayHome: undefined
}

export type TopicsStackParamList = {
  TopicsHome: undefined
}

export type RecordsStackParamList = {
  RecordsHome: undefined
}

export type ReviewStackParamList = {
  ReviewHome: undefined
}

export type MainTabParamList = {
  TodayTab: NavigatorScreenParams<TodayStackParamList>
  TopicsTab: NavigatorScreenParams<TopicsStackParamList>
  RecordsTab: NavigatorScreenParams<RecordsStackParamList>
  ReviewTab: NavigatorScreenParams<ReviewStackParamList>
}

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>
  Profile: undefined
}

declare global {
  // React Navigation 官方类型合并写法。
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
