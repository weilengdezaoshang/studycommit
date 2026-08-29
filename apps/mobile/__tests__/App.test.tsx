import { render, screen } from '@testing-library/react-native'
import App from '../src/App'

describe('<App />', () => {
  it('按移动端 PRD 渲染首页:抽屉入口、快速记录与周历格子', async () => {
    await render(<App />)

    expect(await screen.findByLabelText('打开学习抽屉')).toBeOnTheScreen()
    expect(screen.getByLabelText('记下一张纸页')).toBeOnTheScreen()
    // 周历七格都带"N 张纸页"读屏文案
    expect(screen.getAllByLabelText(/张纸页/).length).toBeGreaterThanOrEqual(7)
  })
})
