import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { StudySessionController } from '@studycommit/common/study-session-react'
import { ProfileScreen } from '../screens/profile/ProfileScreen'
import { TodayScreen } from '../screens/today/TodayScreen'
import { useAppTheme } from '../theme/ThemeProvider'
import { APP_TAB_MODULES } from './app-modules'
import { createNavigationTheme } from './navigation.theme'
import type { RootStackParamList } from './navigation.types'
import {
  RegisteredRecordsStack,
  RegisteredReviewStack,
  RegisteredTodayStack,
  RegisteredTopicsStack,
  Tabs,
  tabScreenOptions,
  useMainTabScreenOptions,
} from './register-app-navigation'

const RootStack = createNativeStackNavigator<RootStackParamList>()

const TAB_STACKS = {
  TopicsTab: RegisteredTopicsStack,
  RecordsTab: RegisteredRecordsStack,
  ReviewTab: RegisteredReviewStack,
} as const

export function AppNavigator({ study }: { study: StudySessionController }) {
  const theme = useAppTheme()

  return (
    <NavigationContainer theme={createNavigationTheme(theme)}>
      <RootStack.Navigator>
        <RootStack.Screen name="MainTabs" options={{ headerShown: false }}>
          {() => <MainTabs study={study} />}
        </RootStack.Screen>
        <RootStack.Screen
          component={ProfileScreen}
          name="Profile"
          options={{ presentation: 'card', title: '我的' }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  )
}

function MainTabs({ study }: { study: StudySessionController }) {
  const screenOptions = useMainTabScreenOptions()

  return (
    <Tabs.Navigator initialRouteName="TodayTab" screenOptions={screenOptions}>
      {APP_TAB_MODULES.map((module) => {
        if (module.name === 'TodayTab') {
          return (
            <Tabs.Screen key={module.name} name={module.name} options={tabScreenOptions(module)}>
              {() => (
                <RegisteredTodayStack>
                  <TodayScreen study={study} />
                </RegisteredTodayStack>
              )}
            </Tabs.Screen>
          )
        }
        const Stack = TAB_STACKS[module.name]
        return (
          <Tabs.Screen
            component={Stack}
            key={module.name}
            name={module.name}
            options={tabScreenOptions(module)}
          />
        )
      })}
    </Tabs.Navigator>
  )
}
