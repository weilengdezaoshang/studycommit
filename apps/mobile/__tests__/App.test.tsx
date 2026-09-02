import { render, screen } from '@testing-library/react-native'
import App from '../src/App'

describe('<App />', () => {
  it('未登录时先展示登录入口，可切换到注册', async () => {
    await render(<App />)

    expect(await screen.findByText('登录 StudyCommit')).toBeOnTheScreen()
    expect(screen.getByText('继续整理你的学习记录')).toBeOnTheScreen()
    expect(screen.getByPlaceholderText('账号')).toBeOnTheScreen()
    expect(screen.getByPlaceholderText('密码')).toBeOnTheScreen()
    expect(screen.getByText('没有账号？去注册')).toBeOnTheScreen()
    expect(screen.getByText('登录即代表你同意《用户协议》和《隐私政策》')).toBeOnTheScreen()
  })
})
