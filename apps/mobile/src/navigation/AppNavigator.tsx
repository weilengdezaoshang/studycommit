import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { AgentScreen } from '../screens/agent/AgentScreen'
import { HomeScreen } from '../screens/home/HomeScreen'
import { NoteEditorScreen } from '../screens/editor/NoteEditorScreen'
import { PaperDetailScreen } from '../screens/detail/PaperDetailScreen'
import { ProblemsScreen } from '../screens/problems/ProblemsScreen'
import { ReviewScreen } from '../screens/review/ReviewScreen'
import { SearchScreen } from '../screens/search/SearchScreen'
import { TopicsScreen } from '../screens/topics/TopicsScreen'
import { CollectionScreen } from '../screens/collection/CollectionScreen'
import { studyCommitColors } from '@studycommit/design-tokens'
import type { RootStackParamList } from './navigation.types'

const Stack = createNativeStackNavigator<RootStackParamList>()

/* 覆盖层页面均为满屏:自绘顶栏并自行处理状态栏内边距,
   不用 iOS 页签式 modal(顶部会露出一段下层页面的空隙)。 */
const MODAL_PRESENTATION = {
  presentation: 'fullScreenModal',
  headerShown: false,
  animation: 'slide_from_bottom',
} as const

/** 移动端 PRD:首页是唯一一级页面,其余界面均为覆盖层。 */
export function AppNavigator() {
  return (
    <NavigationContainer theme={createNavigationTheme()}>
      <Stack.Navigator>
        <Stack.Screen component={HomeScreen} name="Home" options={{ headerShown: false }} />
        <Stack.Screen component={NoteEditorScreen} name="NoteEditor" options={MODAL_PRESENTATION} />
        <Stack.Screen
          component={PaperDetailScreen}
          name="PaperDetail"
          options={MODAL_PRESENTATION}
        />
        <Stack.Screen
          component={AgentScreen}
          name="Agent"
          options={{ ...MODAL_PRESENTATION, presentation: 'fullScreenModal' }}
        />
        <Stack.Screen component={ReviewScreen} name="Review" options={MODAL_PRESENTATION} />
        <Stack.Screen component={ProblemsScreen} name="Problems" options={MODAL_PRESENTATION} />
        <Stack.Screen component={SearchScreen} name="Search" options={MODAL_PRESENTATION} />
        <Stack.Screen component={TopicsScreen} name="Topics" options={MODAL_PRESENTATION} />
        <Stack.Screen
          component={CollectionScreen}
          name="Collection"
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

function createNavigationTheme() {
  return {
    dark: false,
    colors: {
      primary: studyCommitColors.action,
      background: studyCommitColors.paper,
      card: studyCommitColors.paper,
      text: studyCommitColors.ink,
      border: studyCommitColors.line,
      notification: studyCommitColors.accent,
    },
    fonts: {
      regular: { fontFamily: 'System', fontWeight: '400' },
      medium: { fontFamily: 'System', fontWeight: '500' },
      bold: { fontFamily: 'System', fontWeight: '600' },
      heavy: { fontFamily: 'System', fontWeight: '700' },
    },
  } as const
}
