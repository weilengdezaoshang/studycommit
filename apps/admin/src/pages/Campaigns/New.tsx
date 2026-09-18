import { spacing } from '@studycommit/design-tokens'
import { Alert, App, Button } from 'antd'
import { history, useAccess } from '@umijs/max'
import { useRef } from 'react'
import { AdminPage } from '@/components/AdminPage'
import ForbiddenPage from '@/pages/403'
import { CampaignDraftForm } from './DraftForm'
import {
  buildDraftConfig,
  emptyDraftValues,
  optionalLimit,
  timezone,
  validateDraftForm,
  type DraftFormValues,
} from './draft-form'
import { useWriteAction } from '@/hooks/use-write-action'
import { adminApi } from '@/services/admin-api'
import { sameDraftConfig } from '@/utils/confirmed-state'

export default function CampaignCreatePage() {
  const access = useAccess()
  const { message } = App.useApp()
  const write = useWriteAction()
  const pending = useRef<Parameters<typeof adminApi.createCampaign>[0] | null>(null)

  if (!access.canManageDraft) {
    return <ForbiddenPage />
  }

  const onFinish = async (values: DraftFormValues) => {
    if (!write.canSubmit) {
return
}
    const errors = validateDraftForm(values, 'create')
    if (Object.keys(errors).length > 0) {
      void message.error(Object.values(errors)[0])
      return
    }
    const payload = {
      code: values.code.trim(),
      type: values.type,
      totalBudgetCredits: optionalLimit(values.totalBudgetCredits),
      totalClaimLimit: optionalLimit(values.totalClaimLimit),
      displayTimezone: timezone,
      config: buildDraftConfig({ ...values, name: values.title.trim() }),
      reason: values.reason.trim(),
    }
    pending.current = payload
    const result = await write.run(() => adminApi.createCampaign(payload))
    if (result.status === 'ok') {
      void message.success('草稿已创建，可在活动详情中发布')
      history.push(`/campaigns/${result.data.id}`)
      return
    }
    if (result.status === 'unknown' || result.status === 'rate_limited') {
return
}
    if (result.status === 'conflict') {
      write.resetAfterSuccess()
      void message.error(result.error.message || '活动代码已存在，请更换后再试')
      return
    }
    if (result.status !== 'failed' || result.error.code !== 'WRITE_LOCKED') {
      void message.error(result.error.message)
    }
  }

  const queryCreated = async () => {
    if (!pending.current) {
return
}
    let foundId: string | null = null
    const outcome = await write.queryUnknown(async () => {
      let cursor: string | null = null
      const seen = new Set<string>()
      do {
        const page = await adminApi.listCampaigns({ limit: 100, cursor })
        const found = page.items.find((item) => item.code === pending.current!.code)
        if (found) {
          const detail = await adminApi.getCampaign(found.id)
          const expected = pending.current!
          if (
            detail.type === expected.type &&
            detail.totalBudgetCredits === expected.totalBudgetCredits &&
            detail.totalClaimLimit === expected.totalClaimLimit &&
            sameDraftConfig(detail.draftConfig, expected.config)
          ) {
            foundId = detail.id
            return 'confirmed'
          }
          return 'unresolved'
        }
        cursor = page.nextCursor
        if (cursor && seen.has(cursor)) {
break
}
        if (cursor) {
seen.add(cursor)
}
      } while (cursor)
      return 'unresolved'
    }, '尚未找到与本次创建内容一致的活动，请稍后查询或核对审计日志，不要重复提交。')
    if (outcome === 'confirmed' && foundId) {
history.push(`/campaigns/${foundId}`)
}
  }

  return (
    <AdminPage
      title="新建活动草稿"
      description="创建积分活动，配置领取规则与展示文案。"
      breadcrumb={[{ title: '活动管理', path: '/campaigns' }, { title: '新建活动草稿' }]}
    >
      {write.failed ? (
        <Alert type="error" showIcon message={write.failed} style={{ marginBottom: spacing.md }} />
      ) : null}
      {write.rateLimited ? (
        <Alert
          type="warning"
          showIcon
          message={`请 ${Math.ceil(write.remainingMs / 1000)} 秒后再试`}
          style={{ marginBottom: spacing.md }}
        />
      ) : null}
      {write.unknown ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: spacing.md }}
          message="创建结果待确认"
          description={write.unknown}
          action={
            <Button loading={write.busy} onClick={() => void queryCreated()}>
              查询结果
            </Button>
          }
        />
      ) : null}
      <CampaignDraftForm
        mode="create"
        submitting={write.busy}
        locked={write.writesLocked}
        onFinish={(values) => void onFinish(values)}
        initialValues={emptyDraftValues()}
      />
    </AdminPage>
  )
}
