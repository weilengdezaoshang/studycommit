import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DeskDemoPage } from './DeskDemoPage'

describe('DeskDemoPage', () => {
  it('switches to edit mode and changes an item transform', async () => {
    const user = userEvent.setup()
    render(<DeskDemoPage />)

    await user.click(screen.getByRole('button', { name: '布置' }))
    await user.click(screen.getByRole('button', { name: '陶瓷小猫' }))
    await user.click(screen.getByRole('button', { name: '向右转' }))

    expect(screen.getByRole('button', { name: '陶瓷小猫，已选中' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByLabelText('旋转物品').querySelector('output')).toHaveTextContent('15°')
    expect(screen.getByRole('button', { name: '保存布局' })).toBeEnabled()
  })

  it('stores an item in the collection and places it again', async () => {
    const user = userEvent.setup()
    render(<DeskDemoPage />)

    await user.click(screen.getByRole('button', { name: '布置' }))
    await user.click(screen.getByRole('button', { name: '青釉茶杯' }))
    await user.click(screen.getByRole('button', { name: '收入收藏' }))

    const inventoryItem = screen.getByRole('button', { name: '青釉茶杯' })
    expect(inventoryItem).toBeEnabled()
    await user.click(inventoryItem)
    expect(screen.getByRole('button', { name: '青釉茶杯，已选中' })).toBeInTheDocument()
  })

  it('saves and restores the local demo layout', async () => {
    const user = userEvent.setup()
    const first = render(<DeskDemoPage />)

    await user.click(screen.getByRole('button', { name: '布置' }))
    await user.click(screen.getByRole('button', { name: '植物相框' }))
    await user.click(screen.getByRole('button', { name: '保存布局' }))
    first.unmount()

    render(<DeskDemoPage />)
    await user.click(screen.getByRole('button', { name: '布置' }))
    expect(screen.getByRole('button', { name: '植物相框' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '已保存' })).toBeDisabled()
  })
})
