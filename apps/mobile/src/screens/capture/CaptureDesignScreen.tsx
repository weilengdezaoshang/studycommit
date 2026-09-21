import { ScrollView, Text } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { captureScenarios } from '@studycommit/common/capture-runtime'
import { Screen } from '../../components/Screen'
import { NotebookButton, NotebookHeader } from '../../components/notebook/NotebookPrimitives'
import type { RootStackParamList } from '../../navigation/navigation.types'
export function CaptureDesignScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  return (
    <Screen>
      <NotebookHeader title="图片记录 · 设计预览" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text>示例状态用于检查布局，不执行真实识别和保存。键盘状态请在编辑页点击正文。</Text>
        {captureScenarios.map(([scenario, title]) => (
          <NotebookButton
            key={scenario}
            onPress={() => navigation.navigate('Capture', { scenario })}
          >
            {title}
          </NotebookButton>
        ))}
      </ScrollView>
    </Screen>
  )
}
