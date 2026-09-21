const mockDraftLoad = jest.fn()
const mockDraftSave = jest.fn().mockResolvedValue(undefined)
const mockDraftClear = jest.fn().mockResolvedValue(undefined)
const mockCaptureSave = jest.fn()
const mockNavigate = jest.fn()
jest.mock('../../infrastructure/capture/capture-storage', () => ({
  mobileCaptureDraftPort: {
    load: (...args: unknown[]) => mockDraftLoad(...args),
    save: (...args: unknown[]) => mockDraftSave(...args),
    clear: (...args: unknown[]) => mockDraftClear(...args),
  },
  mobileCaptureMediaPort: { remove: jest.fn().mockResolvedValue(undefined) },
}))
jest.mock('../../infrastructure/capture/capture-save', () => ({
  createMobileCaptureSavePort: () => ({ save: (...args: unknown[]) => mockCaptureSave(...args) }),
}))
jest.mock('../../features/papers/papers-store', () => ({
  uuid: () => 'stable-key',
  loadRemote: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('../../components/RichTextEditor', () =>
  jest.requireActual('../../test/mock-rich-editor'),
)
const mockRoute: { params: { scenario: string } } = { params: { scenario: 'preview' } }
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: mockNavigate }),
  useRoute: () => mockRoute,
  usePreventRemove: jest.fn(),
}))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
import { act, fireEvent, render } from '@testing-library/react-native'
import { CaptureScreen } from './CaptureScreen'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { MobileServicesProvider } from '../../core/MobileServicesProvider'
import { captureScenarios, createCaptureState } from '@studycommit/common/capture-runtime'

async function screen(scenario: string) {
  mockRoute.params.scenario = scenario
  return render(
    <ThemeProvider colorScheme="light">
      <MobileServicesProvider>
        <CaptureScreen />
      </MobileServicesProvider>
    </ThemeProvider>,
  )
}
describe('CaptureScreen', () => {
  it.each(captureScenarios.map(([id, title]) => [id, title]))(
    '展示%s对应的%s页面且不创建真实记录',
    async (id) => {
      const view = await screen(id)
      expect(view.getByText('设计预览 · 示例素材与状态')).toBeOnTheScreen()
    },
  )
  it('删除当前图片后同步更新数量和主按钮', async () => {
    const view = await screen('preview')
    await fireEvent.press(view.getByText('删除'))
    expect(view.getByText('已添加 2 张 · 最多 9 张')).toBeOnTheScreen()
    expect(view.getByText('识别文字（2 张）')).toBeOnTheScreen()
  })
  it('重试失败不会假装获得识别结果', async () => {
    const view = await screen('partial')
    await fireEvent.press(view.getByText('重试'))
    expect(view.getByText('识别服务尚未接通，图片已保留')).toBeOnTheScreen()
    expect(view.getByText('识别失败')).toBeOnTheScreen()
  })
})

it('保存成功后延迟自动保存不再恢复已清理草稿', async () => {
  jest.useFakeTimers()
  try {
    mockDraftLoad.mockResolvedValue({
      ...createCaptureState('image'),
      content: '待保存正文',
      page: 'editor',
    })
    mockCaptureSave.mockResolvedValue({ id: 'paper' })
    const view = await screen('')
    await fireEvent.press(await view.findByText('继续编辑'))
    await fireEvent.press(view.getByText('保存'))
    expect(mockDraftClear).toHaveBeenCalledTimes(1)
    const writes = mockDraftSave.mock.calls.length
    await act(async () => {
      jest.advanceTimersByTime(1000)
    })
    expect(mockDraftSave).toHaveBeenCalledTimes(writes)
    expect(mockNavigate).toHaveBeenCalledWith('PaperDetail', { paperId: 'paper' })
    await view.unmount()
  } finally {
    jest.useRealTimers()
  }
})
