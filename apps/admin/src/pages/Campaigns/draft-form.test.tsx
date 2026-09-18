import { App, ConfigProvider } from 'antd'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CampaignDraftForm } from './DraftForm'
import {
  mergeEditConfig,
  valuesFromConfig,
  validateDraftForm,
  type DraftFormValues,
} from './draft-form'
import type { CampaignDraftConfig } from '@/services/types'
import dayjs from 'dayjs'

afterEach(() => cleanup())

const baseConfig: CampaignDraftConfig = {
  name: '内部运营标识',
  grantCredits: 100,
  creditValidityDays: 30,
  fixedExpiresAt: null,
  perUserLimit: 1,
  startsAt: '2026-09-18T00:00:00+08:00',
  endsAt: '2026-09-30T23:59:00+08:00',
  platforms: ['desktop', 'mobile'],
  eligibility: {
    verifiedFrom: null,
    verifiedTo: null,
    providers: ['phone'],
    requireActiveAccount: true,
  },
  copy: {
    title: '对外标题',
    description: '每天积累一点新知',
    successMessage: '已领取100积分',
  },
}

function renderForm(onFinish: (values: DraftFormValues) => void) {
  return render(
    <ConfigProvider button={{ autoInsertSpace: false }}>
      <App>
        <CampaignDraftForm
          mode="edit"
          onFinish={onFinish}
          initialValues={valuesFromConfig(baseConfig, {
            code: 'autumn-2026',
            type: 'limited_claim',
            totalBudgetCredits: 20000,
            totalClaimLimit: 200,
          })}
        />
      </App>
    </ConfigProvider>,
  )
}

describe('活动草稿真实表单提交', () => {
  it('Antd 提交值不含未注册 name/eligibility，合并后保留原内部名与资格', async () => {
    const onFinish = vi.fn()
    renderForm(onFinish)
    const title = screen.getByLabelText('活动标题') as HTMLInputElement
    fireEvent.change(title, { target: { value: '更新公开标题' } })
    const reason = screen.getByLabelText('操作理由') as HTMLTextAreaElement
    fireEvent.change(reason, { target: { value: '调整展示文案' } })
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))
    await waitFor(() => expect(onFinish).toHaveBeenCalled())
    const submitted = onFinish.mock.calls[0][0] as DraftFormValues
    expect(submitted.name).toBeUndefined()
    expect(submitted.eligibility).toBeUndefined()
    expect(submitted.title).toBe('更新公开标题')
    const merged = mergeEditConfig(baseConfig, submitted as never)
    expect(merged.name).toBe('内部运营标识')
    expect(merged.eligibility.providers).toEqual(['phone'])
    expect(merged.copy.title).toBe('更新公开标题')
  })

  it('空白理由不会调用提交', async () => {
    const onFinish = vi.fn()
    renderForm(onFinish)
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))
    await waitFor(() => expect(onFinish).not.toHaveBeenCalled())
  })

  it('固定截止早于窗口结束时校验失败', () => {
    const errors = validateDraftForm(
      {
        ...valuesFromConfig(baseConfig),
        validityMode: 'fixed',
        creditValidityDays: null,
        fixedExpiresAt: dayjs('2026-09-17T00:00:00+08:00'),
        reason: '校验窗口',
      },
      'edit',
    )
    expect(errors.fixedExpiresAt).toBeTruthy()
  })
})
