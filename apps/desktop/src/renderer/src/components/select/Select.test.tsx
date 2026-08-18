import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Select } from './Select'

describe('Select', () => {
  it('keeps the placeholder until the user chooses an option', async () => {
    const onChange = vi.fn()
    render(
      <Select label="专题" onChange={onChange} placeholder="请选择专题" value="">
        <option value="topic-1">Electron 架构</option>
      </Select>,
    )
    expect(screen.getByLabelText('专题')).toHaveValue('')
    await userEvent.selectOptions(screen.getByLabelText('专题'), 'topic-1')
    expect(onChange).toHaveBeenCalled()
  })
})
