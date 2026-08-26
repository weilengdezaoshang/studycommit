import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CompanionDemo } from './CompanionDemo'

describe('CompanionDemo', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('moves from two-frame arrival into the study pose', () => {
    vi.useFakeTimers()
    const { container } = render(<CompanionDemo onExit={() => undefined} />)

    fireEvent.click(screen.getByRole('button', { name: '开始 25 分钟陪学' }))
    expect(container.querySelector('[data-motion="arriving"]')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1100))
    expect(container.querySelector('[data-motion="settling"]')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(420))
    expect(container.querySelector('[data-motion="studying"]')).toBeInTheDocument()
    expect(screen.getAllByText('一起写字').length).toBeGreaterThan(0)
  })

  it('responds to pause and supports reduced motion', () => {
    vi.useFakeTimers()
    const { container } = render(<CompanionDemo onExit={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: '开始 25 分钟陪学' }))
    act(() => vi.advanceTimersByTime(1100))
    act(() => vi.advanceTimersByTime(420))

    fireEvent.click(screen.getByRole('button', { name: '暂停一下' }))
    expect(container.querySelector('[data-motion="pausing"]')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(300))
    expect(container.querySelector('[data-motion="looking"]')).toBeInTheDocument()
    expect(screen.getByText('我在这里，慢慢来。')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: '减少动态效果' }))
    expect(container.querySelector('.sprite-companion--reduced')).toBeInTheDocument()
  })

  it('turns completion into a companion-delivered keepsake', () => {
    vi.useFakeTimers()
    const { container } = render(<CompanionDemo onExit={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: '开始 25 分钟陪学' }))
    act(() => vi.advanceTimersByTime(1100))
    act(() => vi.advanceTimersByTime(420))

    fireEvent.click(screen.getByRole('button', { name: '演示：完成学习' }))
    expect(container.querySelector('[data-motion="leaving-study"]')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(720))
    expect(container.querySelector('[data-motion="gift-arriving"]')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(850))
    expect(container.querySelector('[data-motion="reward"]')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '接过它的信封' }))
    expect(screen.getByRole('dialog', { name: '学习奖励' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '收进本周手帐' }))
    expect(screen.getByText('本周第 3 次完成')).toBeInTheDocument()
  })
})
