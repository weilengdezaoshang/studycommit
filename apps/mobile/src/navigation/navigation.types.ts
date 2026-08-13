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
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
