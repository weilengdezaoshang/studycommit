import type { ComponentProps } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { AppHeaderAvatar } from '../components/AppHeaderAvatar'
import { ProfileScreen } from '../screens/profile/ProfileScreen'
import { RecordsScreen } from '../screens/records/RecordsScreen'
import { ReviewScreen } from '../screens/review/ReviewScreen'
import { TodayScreen } from '../screens/today/TodayScreen'
import { TopicsScreen } from '../screens/topics/TopicsScreen'
import { useAppTheme } from '../theme/ThemeProvider'
import { createNavigationTheme } from './navigation.theme'
import type {
  MainTabParamList,
  RecordsStackParamList,
  ReviewStackParamList,
  RootStackParamList,
  TodayStackParamList,
  TopicsStackParamList,
} from './navigation.types'

type IconName = ComponentProps<typeof Ionicons>['name']

const RootStack = createNativeStackNavigator<RootStackParamList>()
const Tabs = createBottomTabNavigator<MainTabParamList>()
const TodayStack = createNativeStackNavigator<TodayStackParamList>()
const TopicsStack = createNativeStackNavigator<TopicsStackParamList>()
const RecordsStack = createNativeStackNavigator<RecordsStackParamList>()
const ReviewStack = createNativeStackNavigator<ReviewStackParamList>()

const tabIcons: Record<
  keyof MainTabParamList,
  { focused: IconName; unfocused: IconName }
> = {
  TodayTab: { focused: 'today', unfocused: 'today-outline' },
  TopicsTab: { focused: 'book', unfocused: 'book-outline' },
  RecordsTab: { focused: 'create', unfocused: 'create-outline' },
  ReviewTab: { focused: 'layers', unfocused: 'layers-outline' },
}

function commonStackOptions(title: string) {
  return {
    title,
    headerRight: () => <AppHeaderAvatar />,
  }
}

function TodayNavigator() {
  return (
    <TodayStack.Navigator>
      <TodayStack.Screen
        component={TodayScreen}
        name="TodayHome"
        options={commonStackOptions('今天')}
      />
    </TodayStack.Navigator>
  )
}

function TopicsNavigator() {
  return (
    <TopicsStack.Navigator>
      <TopicsStack.Screen
        component={TopicsScreen}
        name="TopicsHome"
        options={commonStackOptions('专题')}
      />
    </TopicsStack.Navigator>
  )
}

function RecordsNavigator() {
  return (
    <RecordsStack.Navigator>
      <RecordsStack.Screen
        component={RecordsScreen}
        name="RecordsHome"
        options={commonStackOptions('记录')}
      />
    </RecordsStack.Navigator>
  )
}

function ReviewNavigator() {
  return (
    <ReviewStack.Navigator>
      <ReviewStack.Screen
        component={ReviewScreen}
        name="ReviewHome"
        options={commonStackOptions('复习')}
      />
    </ReviewStack.Navigator>
  )
}

function MainTabs() {
  const theme = useAppTheme()

  return (
    <Tabs.Navigator
      initialRouteName="TodayTab"
      screenOptions={({ route }) => ({
        headerShown: false,
        popToTopOnBlur: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
        tabBarIcon: ({ color, focused, size }) => (
          <Ionicons
            accessibilityElementsHidden
            color={color}
            importantForAccessibility="no-hide-descendants"
            name={focused ? tabIcons[route.name].focused : tabIcons[route.name].unfocused}
            size={size}
          />
        ),
      })}
    >
      <Tabs.Screen
        component={TodayNavigator}
        name="TodayTab"
        options={{ tabBarAccessibilityLabel: '今天，标签页', title: '今天' }}
      />
      <Tabs.Screen
        component={TopicsNavigator}
        name="TopicsTab"
        options={{ tabBarAccessibilityLabel: '专题，标签页', title: '专题' }}
      />
      <Tabs.Screen
        component={RecordsNavigator}
        name="RecordsTab"
        options={{ tabBarAccessibilityLabel: '记录，标签页', title: '记录' }}
      />
      <Tabs.Screen
        component={ReviewNavigator}
        name="ReviewTab"
        options={{ tabBarAccessibilityLabel: '复习，标签页', title: '复习' }}
      />
    </Tabs.Navigator>
  )
}

export function AppNavigator() {
  const theme = useAppTheme()

  return (
    <NavigationContainer theme={createNavigationTheme(theme)}>
      <RootStack.Navigator>
        <RootStack.Screen component={MainTabs} name="MainTabs" options={{ headerShown: false }} />
        <RootStack.Screen
          component={ProfileScreen}
          name="Profile"
          options={{ presentation: 'card', title: '我的' }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  )
}
