import type { ComponentProps, ReactNode } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { AppHeaderAvatar } from '../components/AppHeaderAvatar'
import { RecordsScreen } from '../screens/records/RecordsScreen'
import { ReviewScreen } from '../screens/review/ReviewScreen'
import { TopicsScreen } from '../screens/topics/TopicsScreen'
import { useAppTheme } from '../theme/ThemeProvider'
import { APP_STACK_HOMES, APP_TAB_MODULES, type AppTabModule } from './app-modules'
import type {
  MainTabParamList,
  RecordsStackParamList,
  ReviewStackParamList,
  TodayStackParamList,
  TopicsStackParamList,
} from './navigation.types'

type IconName = ComponentProps<typeof Ionicons>['name']

export const Tabs = createBottomTabNavigator<MainTabParamList>()
const TodayStack = createNativeStackNavigator<TodayStackParamList>()
const TopicsStack = createNativeStackNavigator<TopicsStackParamList>()
const RecordsStack = createNativeStackNavigator<RecordsStackParamList>()
const ReviewStack = createNativeStackNavigator<ReviewStackParamList>()

export function commonStackOptions(title: string) {
  return {
    title,
    headerRight: () => <AppHeaderAvatar />,
  }
}

export function tabScreenOptions(module: AppTabModule) {
  return {
    tabBarAccessibilityLabel: module.accessibilityLabel,
    title: module.title,
  }
}

export function useMainTabScreenOptions() {
  const theme = useAppTheme()
  return ({ route }: { route: { name: keyof MainTabParamList } }) => {
    const module = APP_TAB_MODULES.find((item) => item.name === route.name)
    return {
      headerShown: false,
      popToTopOnBlur: false,
      tabBarActiveTintColor: theme.colors.primary,
      tabBarInactiveTintColor: theme.colors.textMuted,
      tabBarLabelStyle: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
      tabBarStyle: {
        backgroundColor: theme.colors.surface,
        borderTopColor: theme.colors.border,
      },
      tabBarIcon: ({ color, focused, size }: { color: string; focused: boolean; size: number }) =>
        module ? (
          <TabIcon color={color} focused={focused} icons={module.icons} size={size} />
        ) : null,
    }
  }
}

function TabIcon({
  color,
  focused,
  icons,
  size,
}: {
  color: string
  focused: boolean
  icons: { focused: IconName; unfocused: IconName }
  size: number
}) {
  return (
    <Ionicons
      accessibilityElementsHidden
      color={color}
      importantForAccessibility="no-hide-descendants"
      name={focused ? icons.focused : icons.unfocused}
      size={size}
    />
  )
}

export function RegisteredTodayStack({ children }: { children: ReactNode }) {
  return (
    <TodayStack.Navigator>
      <TodayStack.Screen
        name="TodayHome"
        options={commonStackOptions(APP_STACK_HOMES.TodayTab.title)}
      >
        {() => children}
      </TodayStack.Screen>
    </TodayStack.Navigator>
  )
}

export function RegisteredTopicsStack() {
  return (
    <TopicsStack.Navigator>
      <TopicsStack.Screen
        component={TopicsScreen}
        name="TopicsHome"
        options={commonStackOptions(APP_STACK_HOMES.TopicsTab.title)}
      />
    </TopicsStack.Navigator>
  )
}

export function RegisteredRecordsStack() {
  return (
    <RecordsStack.Navigator>
      <RecordsStack.Screen
        component={RecordsScreen}
        name="RecordsHome"
        options={commonStackOptions(APP_STACK_HOMES.RecordsTab.title)}
      />
    </RecordsStack.Navigator>
  )
}

export function RegisteredReviewStack() {
  return (
    <ReviewStack.Navigator>
      <ReviewStack.Screen
        component={ReviewScreen}
        name="ReviewHome"
        options={commonStackOptions(APP_STACK_HOMES.ReviewTab.title)}
      />
    </ReviewStack.Navigator>
  )
}
