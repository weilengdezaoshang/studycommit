import { fireEvent, render } from '@testing-library/react-native'
import { Linking } from 'react-native'
import { RichTextReader } from './RichTextReader'

describe('RichTextReader', () => {
  it('使用原生组件展示标题、正文、列表和代码块', async () => {
    const view = await render(
      <RichTextReader
        document={{
          version: 1,
          doc: {
            type: 'doc',
            content: [
              {
                type: 'heading',
                attrs: { level: 2 },
                content: [{ type: 'text', text: '核心结论' }],
              },
              {
                type: 'paragraph',
                content: [{ type: 'text', text: '正文可以正常显示', marks: [{ type: 'bold' }] }],
              },
              {
                type: 'bulletList',
                content: [
                  {
                    type: 'listItem',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: '第一项' }] }],
                  },
                ],
              },
              { type: 'codeBlock', content: [{ type: 'text', text: 'const value = 1' }] },
            ],
          },
        }}
      />,
    )
    expect(view.getByText('核心结论')).toBeOnTheScreen()
    expect(view.getByText('正文可以正常显示')).toBeOnTheScreen()
    expect(view.getByText('第一项')).toBeOnTheScreen()
    expect(view.getByText('const value = 1')).toBeOnTheScreen()
  })

  it('点击安全链接时交给系统打开', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
    const view = await render(
      <RichTextReader
        document={{
          version: 1,
          doc: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: '资料',
                    marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
                  },
                ],
              },
            ],
          },
        }}
      />,
    )
    await fireEvent.press(view.getByRole('link'))
    expect(openURL).toHaveBeenCalledWith('https://example.com')
  })
})
