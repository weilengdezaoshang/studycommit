import { fireEvent, render } from '@testing-library/react-native'
import { Notebook } from './Notebook'

jest.mock('../../features/puzzle/PuzzleEntry', () => ({
  PuzzleEntry: () => null,
}))
import { buildHomeViewModel } from '../../features/papers/view-model'
import {
  buildSeedPapers,
  buildSeedTopics,
  buildSeedPaperExtras,
} from '../../features/papers/mock-data'
import type { PapersState } from '../../features/papers/papers-store'

const state: PapersState = {
  papers: buildSeedPapers()
    .slice(0, 2)
    .map((p, i) => ({
      ...p,
      content: `测试记录${i}`,
      createdAt: `2026-09-${String(10 - i).padStart(2, '0')}T10:00:00.000Z`,
      deletedAt: null,
    })),
  topics: buildSeedTopics(),
  extras: buildSeedPaperExtras(),
  source: 'seed',
  syncing: false,
}
const vm = buildHomeViewModel(state, '2026-09-10', { year: 2026, month: 9, day: 10 }, null)
const onOpen = jest.fn()
const onClear = jest.fn()
const props = {
  vm,
  date: null,
  topicId: null,
  bottom: 0,
  onOpen,
  onClear,
  onCreate: jest.fn(),
  onExplain: jest.fn(),
}

describe('Notebook', () => {
  it('默认同时展示不同日期的记录并能打开详情', async () => {
    const view = await render(<Notebook {...props} />)
    expect(view.getByText('测试记录0')).toBeOnTheScreen()
    expect(view.getByText('测试记录1')).toBeOnTheScreen()
    await fireEvent.press(view.getByLabelText('测试记录0'))
    expect(onOpen).toHaveBeenCalledWith(state.papers[0].id)
  })
  it('日期筛选只显示选中日期并提供清除入口', async () => {
    const view = await render(<Notebook {...props} date="2026-09-09" />)
    expect(view.queryByText('测试记录0')).toBeNull()
    expect(view.getByText('测试记录1')).toBeOnTheScreen()
    await fireEvent.press(view.getByText('清除筛选，查看全部记录 ×'))
    expect(onClear).toHaveBeenCalled()
  })
  it('排序切换改变日期组顺序', async () => {
    const view = await render(<Notebook {...props} />)
    await fireEvent.press(view.getByText('筛选与排序'))
    await fireEvent.press(view.getByText('从新到旧 ↓'))
    const records = view.getAllByText(/^测试记录/)
    expect(records[0].props.children).toBe('测试记录1')
  })
})
