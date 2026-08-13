import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

function BrokenPage(): React.JSX.Element {
  throw new Error('Expected render failure')
}

describe('ErrorBoundary', () => {
  it('shows a recoverable error instead of a blank screen', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <ErrorBoundary>
        <BrokenPage />
      </ErrorBoundary>
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '这个页面暂时无法显示' })).toBeInTheDocument()
  })
})
