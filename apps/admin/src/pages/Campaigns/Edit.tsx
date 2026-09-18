import { spacing } from '@studycommit/design-tokens'
import { Alert, App, Button, Descriptions, Modal, Space } from 'antd'
import { history, useAccess, useParams } from '@umijs/max'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { AdminPage } from '@/components/AdminPage'
import { ErrorPanel } from '@/components/PageState'
import ForbiddenPage from '@/pages/403'
import { CampaignDraftForm } from './DraftForm'
import {
  mergeEditConfig,
  validateDraftForm,
  valuesFromConfig,
  type DraftFormValues,
} from './draft-form'
import { useWriteAction } from '@/hooks/use-write-action'
import { adminApi } from '@/services/admin-api'
import { isForbidden } from '@/services/api-client'
import type { CampaignDetail, CampaignDraftConfig } from '@/services/types'
import { sameDraftConfig } from '@/utils/confirmed-state'
import { formatDateTime } from '@/utils/format'

export default function CampaignEditPage() {
  const { id } = useParams<{ id: string }>()
  const access = useAccess()
  const { message } = App.useApp()
  const query = useQuery({
    queryKey: ['admin', 'campaign', id],
    queryFn: () => adminApi.getCampaign(id!),
    enabled: Boolean(id),
  })
  const [base, setBase] = useState<CampaignDetail | null>(null)
  const [latest, setLatest] = useState<CampaignDetail | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewBusy, setReviewBusy] = useState(false)
  const intended = useRef<CampaignDraftConfig | null>(null)
  useEffect(() => {
    if (query.data && (!base || base.id !== id)) {
setBase(query.data)
}
  }, [base, id, query.data])
  const campaign = base?.id === id ? base : null
  const write = useWriteAction(campaign?.currentVersion ?? null)
  const stale = Boolean(query.error)
  if (!access.canManageDraft || isForbidden(query.error)) {
return <ForbiddenPage />
}

  const onFinish = async (values: DraftFormValues) => {
    if (!campaign?.draftConfig || stale || !write.canSubmit) {
return
}
    const errors = validateDraftForm(values, 'edit')
    if (Object.keys(errors).length) {
      void message.error(Object.values(errors)[0])
      return
    }
    const expectedVersion = write.expectedVersion()
    if (expectedVersion === null) {
return
}
    const config = mergeEditConfig(campaign.draftConfig, values)
    intended.current = config
    const result = await write.run(() =>
      adminApi.updateDraft({
        id: campaign.id,
        expectedVersion,
        config,
        reason: values.reason.trim(),
      }),
    )
    if (result.status === 'ok') {
      void message.success('草稿已保存')
      history.push(`/campaigns/${campaign.id}`)
    } else if (result.status === 'conflict') {
      const current = await adminApi.getCampaign(campaign.id).catch(() => null)
      setLatest(current)
      write.noteConflictLatest(current?.currentVersion ?? null)
    } else if (!['unknown', 'rate_limited'].includes(result.status)) {
      void message.error(result.error.message)
    }
  }

  const reviewLatest = async () => {
    if (!campaign) {
return
}
    setReviewBusy(true)
    try {
      const current = await adminApi.getCampaign(campaign.id)
      setLatest(current)
      write.noteConflictLatest(current.currentVersion)
      setReviewOpen(true)
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '读取最新版本失败')
    } finally {
      setReviewBusy(false)
    }
  }

  const queryUnknown = async () => {
    if (!campaign || !intended.current) {
return
}
    const outcome = await write.queryUnknown(async () => {
      const current = await adminApi.getCampaign(campaign.id)
      return sameDraftConfig(current.draftConfig, intended.current!) ? 'confirmed' : 'unresolved'
    }, '尚未查到与本次提交一致的草稿，请稍后再查或核对审计日志，不要重复保存。')
    if (outcome === 'confirmed') {
      void message.success('当前草稿与提交内容一致')
      history.push(`/campaigns/${campaign.id}`)
    }
  }

  return (
    <AdminPage
      title={`编辑活动草稿${campaign ? `（v${campaign.currentVersion}）` : ''}`}
      description="更新领取规则与展示文案。"
      breadcrumb={[
        { title: '活动管理', path: '/campaigns' },
        { title: campaign?.name ?? '活动详情', path: id ? `/campaigns/${id}` : undefined },
        { title: '编辑草稿' },
      ]}
    >
      {query.error ? (
        <ErrorPanel error={query.error as Error} onRetry={() => void query.refetch()} />
      ) : null}
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
          message="保存结果待确认"
          description={write.unknown}
          style={{ marginBottom: spacing.md }}
          action={
            <Button onClick={() => void queryUnknown()} loading={write.busy}>
              查询结果
            </Button>
          }
        />
      ) : null}
      {write.conflict ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: spacing.md }}
          message="内容已更新"
          description={`当前输入基于 v${write.conflict.currentVersion}，最新为 v${write.conflict.latestVersion ?? '未知'}。输入已保留，请查看最新内容后人工合并。`}
          action={
            <Button onClick={() => void reviewLatest()} loading={reviewBusy}>
              查看最新版本
            </Button>
          }
        />
      ) : null}
      {campaign?.draftConfig ? (
        <CampaignDraftForm
          mode="edit"
          submitting={write.busy}
          locked={!write.canSubmit || stale}
          onFinish={(values) => void onFinish(values)}
          initialValues={valuesFromConfig(campaign.draftConfig, {
            code: campaign.code,
            type: campaign.type,
            totalBudgetCredits: campaign.totalBudgetCredits,
            totalClaimLimit: campaign.totalClaimLimit,
          })}
        />
      ) : null}
      <Modal
        open={reviewOpen}
        title={`最新草稿 v${latest?.currentVersion ?? '—'}`}
        onCancel={() => setReviewOpen(false)}
        footer={
          <Space>
            <Button onClick={() => setReviewOpen(false)}>返回检查</Button>
            <Button
              type="primary"
              disabled={!latest?.draftConfig || latest.status !== 'draft'}
              onClick={() => {
                if (!latest) {
return
}
                setBase(latest)
                write.applyLatestVersion(latest.currentVersion)
                setReviewOpen(false)
              }}
            >
              已查看，保留当前输入继续合并
            </Button>
          </Space>
        }
      >
        <Alert
          type="warning"
          showIcon
          message="继续后会保留您当前填写的内容，请逐项合并再保存。"
          style={{ marginBottom: spacing.md }}
        />
        {latest?.draftConfig ? (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="内部名称">{latest.draftConfig.name}</Descriptions.Item>
            <Descriptions.Item label="公开标题">{latest.draftConfig.copy.title}</Descriptions.Item>
            <Descriptions.Item label="活动描述">
              {latest.draftConfig.copy.description}
            </Descriptions.Item>
            <Descriptions.Item label="成功文案">
              {latest.draftConfig.copy.successMessage}
            </Descriptions.Item>
            <Descriptions.Item label="领取积分">
              {latest.draftConfig.grantCredits}
            </Descriptions.Item>
            <Descriptions.Item label="每人限领">
              {latest.draftConfig.perUserLimit}
            </Descriptions.Item>
            <Descriptions.Item label="开始时间">
              {formatDateTime(latest.draftConfig.startsAt)}
            </Descriptions.Item>
            <Descriptions.Item label="结束时间">
              {formatDateTime(latest.draftConfig.endsAt)}
            </Descriptions.Item>
            <Descriptions.Item label="有效期">
              {latest.draftConfig.creditValidityDays
                ? `${latest.draftConfig.creditValidityDays} 天`
                : formatDateTime(latest.draftConfig.fixedExpiresAt)}
            </Descriptions.Item>
            <Descriptions.Item label="展示平台">
              {latest.draftConfig.platforms.join('、')}
            </Descriptions.Item>
            <Descriptions.Item label="注册方式限制">
              {latest.draftConfig.eligibility.providers?.join('、') ?? '不限'}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </AdminPage>
  )
}
