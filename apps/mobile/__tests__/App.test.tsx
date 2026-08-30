import { render, screen } from '@testing-library/react-native'
import App from '../src/App'

describe('<App />', () => {
  it('未登录时先展示登录注册入口(登录即注册)', async () => {
    await render(<App />)

    expect(await screen.findByText('登录 StudyCommit')).toBeOnTheScreen()
    expect(screen.getByText('继续整理你的学习记录')).toBeOnTheScreen()
    expect(screen.getByPlaceholderText('手机号')).toBeOnTheScreen()
    expect(screen.getByPlaceholderText('验证码')).toBeOnTheScreen()
    expect(screen.getByText('登录即代表你同意《用户协议》和《隐私政策》')).toBeOnTheScreen()
  })
})
