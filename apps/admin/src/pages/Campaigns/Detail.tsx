import { spacing } from '@studycommit/design-tokens'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Progress,
  Row,
  Space,
  Tabs,
  Typography,
} from 'antd'
import { history, useAccess, useParams } from '@umijs/max'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { AdminPage } from '@/components/AdminPage'
import { CopyId } from '@/components/CopyId'
import { CursorTable } from '@/components/CursorTable'
import { ErrorPanel } from '@/components/PageState'
import { ReasonActionModal } from '@/components/ReasonActionModal'
import { ActionSummary } from '@/components/AdminActionDialog'
import {
  CampaignStatusTag,
  ClaimStatusTag,
  DisplayStatusTag,
  campaignTypeLabel,
} from '@/components/StatusTag'
import ForbiddenPage from '@/pages/403'
import { useCursorList } from '@/hooks/use-cursor-list'
import { useWriteAction } from '@/hooks/use-write-action'
import { adminApi } from '@/services/admin-api'
import { queryClient } from '@/services/query-client'
import { sameDraftConfig } from '@/utils/confirmed-state'
import { isForbidden } from '@/services/api-client'
import type { CampaignClaim, CampaignDetail } from '@/services/types'
import { findClaimAcrossCursors } from '@/utils/find-claim'
import { formatBudget, formatCredits, formatDateTime } from '@/utils/format'

type LifecycleAction = 'publish' | 'pause' | 'resume' | 'end'

const ACTION_META: Record<
  LifecycleAction,
  { title: string; confirm: string; danger?: boolean; impact: string }
> = {
  publish: {
    title: '确认发布活动？',
    confirm: '确认发布',
    impact: '新领取的用户将按此版本执行，已领取的用户不受影响。',
  },
  pause: {
    title: '确认暂停活动？',
    confirm: '确认暂停',
    danger: true,
    impact: '暂停将阻止新领取，但不撤回已发放积分。',
  },
  resume: {
    title: '确认恢复活动？',
    confirm: '确认恢复',
    impact: '恢复后，窗口内且额度未用尽的用户可继续领取。',
  },
  end: {
    title: '结束活动？',
    confirm: '确认结束',
    danger: true,
    impact: '已发放的积分不受影响，结束后无法恢复，请谨慎操作。',
  },
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const access = useAccess()
  const { message } = App.useApp()
  const query = useQuery({
    queryKey: ['admin', 'campaign', id],
    queryFn: () => adminApi.getCampaign(id!),
    enabled: Boolean(id),
  })
  const write = useWriteAction(query.data?.currentVersion ?? null)
  const [action, setAction] = useState<LifecycleAction | null>(null)
  const beforeRef = useRef<{
    version: number
    status: string
    action: LifecycleAction
    config: CampaignDetail['draftConfig']
  } | null>(null)
  const campaign = isForbidden(query.error) ? undefined : query.data
  const stale = Boolean(query.error && campaign)
  const writesDisabled = write.writesLocked || stale || Boolean(write.conflict)

  if (isForbidden(query.error)) {
    return <ForbiddenPage />
  }

  const submitAction = async (reason: string) => {
    if (!campaign || !action || writesDisabled || !write.canSubmit) {
return
}
    const expectedVersion = write.expectedVersion()
    if (expectedVersion === null) {
return
}
    beforeRef.current = {
      version: expectedVersion,
      status: campaign.status,
      action,
      config: campaign.draftConfig,
    }
    const result = await write.run(() =>
      adminApi.transitionCampaign(action, {
        id: campaign.id,
        expectedVersion,
        reason,
      }),
    )
    if (result.status === 'ok') {
      void message.success('操作已完成')
      setAction(null)
      void query.refetch()
      return
    }
    if (result.status === 'conflict') {
      const latest = await adminApi.getCampaign(campaign.id).catch(() => null)
      write.noteConflictLatest(latest?.currentVersion ?? null)
      return
    }
    if (result.status === 'rate_limited') {
return
}
    if (result.status === 'unknown') {
return
}
    if (result.status !== 'failed' || result.error.code !== 'WRITE_LOCKED') {
      void message.error(result.error.message)
    }
  }

  const queryActionResult = async () => {
    if (!campaign || !beforeRef.current) {
return
}
    const result = await write.queryUnknown(async () => {
      const latest = await adminApi.getCampaign(campaign.id)
      const before = beforeRef.current!
      const target =
        before.action === 'end' ? 'ended' : before.action === 'pause' ? 'paused' : 'published'
      const matching =
        latest.status === target &&
        (before.action !== 'publish' ||
          (latest.currentVersion > before.version &&
            before.config !== null &&
            sameDraftConfig(
              latest.versions.find((item) => item.version === latest.currentVersion)?.config ??
                null,
              before.config,
            )))
      if (!matching) {
return 'unresolved'
}
      queryClient.setQueryData(['admin', 'campaign', id], latest)
      return 'confirmed'
    }, '当前活动尚未达到本次操作的目标状态，请稍后查询或核对审计日志，不要重复提交。')
    if (result === 'confirmed') {
      setAction(null)
      void message.info('当前活动状态已符合本次操作目标')
    }
  }

  const viewLatest = async () => {
    if (!campaign) {
return
}
    try {
      const latest = await adminApi.getCampaign(campaign.id)
      queryClient.setQueryData(['admin', 'campaign', id], latest)
      write.applyLatestVersion(latest.currentVersion)
      write.closeModal()
      setAction(null)
      void message.info('已加载最新活动内容，请检查后重新选择操作')
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '读取失败')
    }
  }

  if (query.error && !campaign) {
    const status = (query.error as { status?: number }).status
    if (status === 404) {
      return (
        <AdminPage title="活动不可用">
          <Alert
            type="error"
            showIcon
            message="活动不存在或已不可访问"
            action={<Button onClick={() => history.push('/campaigns')}>返回列表</Button>}
          />
        </AdminPage>
      )
    }
  }

  return (
    <AdminPage
      title={campaign?.name ?? '活动详情'}
      description={
        campaign ? (
          <Space wrap>
            <CampaignStatusTag value={campaign.status} />
            <DisplayStatusTag value={campaign.displayStatus} />
            <span>活动编码 {campaign.code}</span>
            <span>版本 v{campaign.currentVersion}</span>
            <span>{campaignTypeLabel(campaign.type)}</span>
          </Space>
        ) : undefined
      }
      extra={
        campaign ? (
          <LifecycleButtons
            campaign={campaign}
            access={access}
            disabled={writesDisabled}
            onAction={(next) => {
              setAction(next)
              write.openModal()
            }}
          />
        ) : null
      }
      breadcrumb={[
        { title: '活动管理', path: '/campaigns' },
        { title: campaign?.name ?? '活动详情' },
      ]}
    >
      {query.error && campaign ? (
        <ErrorPanel error={query.error as Error} onRetry={() => void query.refetch()} />
      ) : null}
      {stale ? (
        <Alert
          type="warning"
          showIcon
          message="数据可能已过期，写操作已暂停。"
          style={{ marginBottom: spacing.md }}
        />
      ) : null}
      {write.unknown ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: spacing.md }}
          message="操作结果待确认"
          description={write.unknown}
          action={
            <Button loading={write.busy} onClick={() => void queryActionResult()}>
              查询结果
            </Button>
          }
        />
      ) : null}
      {campaign ? (
        <>
          {campaign.status === 'ended' ? (
            <Alert
              type="info"
              showIcon
              message="已结束活动规则只读；待补偿领取仍可按权限处理。"
              style={{ marginBottom: spacing.md }}
            />
          ) : null}
          <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
            <Col xs={24} md={8}>
              <Card>
                <Typography.Text type="secondary">已发放积分</Typography.Text>
                <Typography.Title level={3} className="tabular-nums">
                  {formatCredits(campaign.totalGrantedCredits)}
                  <Typography.Text type="secondary">
                    {' '}
                    / {formatBudget(campaign.totalBudgetCredits)}
                  </Typography.Text>
                </Typography.Title>
                {campaign.totalBudgetCredits ? (
                  <Progress
                    percent={Math.min(
                      100,
                      Math.round(
                        (campaign.totalGrantedCredits / campaign.totalBudgetCredits) * 100,
                      ),
                    )}
                  />
                ) : null}
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card>
                <Typography.Text type="secondary">领取次数</Typography.Text>
                <Typography.Title level={3} className="tabular-nums">
                  {formatCredits(campaign.totalClaimCount)} 次
                </Typography.Title>
                <Typography.Text type="secondary">
                  每次 {formatCredits(campaign.grantCredits)} 积分
                </Typography.Text>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card>
                <Typography.Text type="secondary">领取窗口</Typography.Text>
                <Typography.Title level={5}>
                  {formatDateTime(campaign.startsAt, 'YYYY-MM-DD')} –{' '}
                  {formatDateTime(campaign.endsAt, 'YYYY-MM-DD')}
                </Typography.Title>
                <Typography.Text type="secondary">{campaign.displayTimezone}</Typography.Text>
              </Card>
            </Col>
          </Row>
          <Row gutter={spacing.md}>
            <Col xs={24} xl={16}>
              <Card>
                <Tabs
                  items={[
                    { key: 'rules', label: '活动规则', children: <RulesTab campaign={campaign} /> },
                    {
                      key: 'versions',
                      label: '版本历史',
                      children: <VersionsTab campaign={campaign} />,
                    },
                    {
                      key: 'claims',
                      label: '领取记录',
                      children: <ClaimsTab campaignId={campaign.id} pendingOnly={false} />,
                    },
                    {
                      key: 'pending',
                      label: '待补偿',
                      children: (
                        <ClaimsTab
                          campaignId={campaign.id}
                          pendingOnly
                          canCompensate={access.canCompensate && !writesDisabled}
                          onCompensated={() => void query.refetch()}
                        />
                      ),
                    },
                  ]}
                />
              </Card>
            </Col>
            <Col xs={24} xl={8}>
              <Card title="规则概要" style={{ marginBottom: spacing.md }}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="发放积分">
                    {formatCredits(campaign.grantCredits)} 积分
                  </Descriptions.Item>
                  <Descriptions.Item label="领取限制">
                    每人限领 {campaign.draftConfig?.perUserLimit ?? '—'} 次
                  </Descriptions.Item>
                  <Descriptions.Item label="有效期">
                    {campaign.creditValidityDays
                      ? `${campaign.creditValidityDays} 天`
                      : campaign.fixedExpiresAt
                        ? formatDateTime(campaign.fixedExpiresAt)
                        : '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="领取时间">
                    {formatDateTime(campaign.startsAt, 'YYYY-MM-DD')} –{' '}
                    {formatDateTime(campaign.endsAt, 'YYYY-MM-DD')}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
          </Row>
        </>
      ) : query.error ? (
        <ErrorPanel error={query.error as Error} onRetry={() => void query.refetch()} />
      ) : null}
      {action ? (
        <ReasonActionModal
          open={write.open}
          title={ACTION_META[action].title}
          confirmText={ACTION_META[action].confirm}
          reasonLabel={`${ACTION_META[action].confirm.replace('确认', '')}原因`}
          danger={ACTION_META[action].danger}
          busy={write.busy}
          conflictText={
            write.conflict
              ? `当前版本 v${write.conflict.currentVersion}，最新 v${write.conflict.latestVersion ?? '未知'}。请查看最新后再操作。`
              : null
          }
          unknownText={write.unknown}
          rateLimitedText={
            write.rateLimited ? `请 ${Math.ceil(write.remainingMs / 1000)} 秒后再试。` : null
          }
          impact={
            <div>
              <Typography.Paragraph>{ACTION_META[action].impact}</Typography.Paragraph>
              {campaign ? (
                <ActionSummary
                  items={[
                    { label: '活动名称', value: campaign.name },
                    { label: '版本', value: `v${campaign.currentVersion}` },
                    {
                      label: '积分标准',
                      value: `${formatCredits(campaign.grantCredits)} 积分 / 人`,
                    },
                    { label: '活动预算', value: formatBudget(campaign.totalBudgetCredits) },
                    {
                      label: '活动时间',
                      value: `${formatDateTime(campaign.startsAt, 'YYYY-MM-DD')} – ${formatDateTime(campaign.endsAt, 'YYYY-MM-DD')}`,
                    },
                    ...(action === 'publish' && campaign.totalBudgetCredits === null
                      ? [{ label: '注意', value: '当前总预算为不限，发布前请再次确认。' }]
                      : []),
                  ]}
                />
              ) : null}
            </div>
          }
          onSubmit={(reason) => void submitAction(reason)}
          onViewLatest={() => void viewLatest()}
          onQueryResult={() => void queryActionResult()}
          onCancel={write.closeModal}
        />
      ) : null}
    </AdminPage>
  )
}

function LifecycleButtons({
  campaign,
  access,
  disabled,
  onAction,
}: {
  campaign: CampaignDetail
  access: { canManageDraft?: boolean; canPublish?: boolean }
  disabled?: boolean
  onAction: (action: LifecycleAction) => void
}) {
  return (
    <Space wrap>
      {campaign.status === 'draft' && access.canManageDraft ? (
        <Button disabled={disabled} onClick={() => history.push(`/campaigns/${campaign.id}/edit`)}>
          编辑草稿
        </Button>
      ) : null}
      {campaign.status === 'draft' && access.canPublish ? (
        <Button type="primary" disabled={disabled} onClick={() => onAction('publish')}>
          发布
        </Button>
      ) : null}
      {campaign.status === 'published' && access.canPublish ? (
        <Button disabled={disabled} onClick={() => onAction('pause')}>
          暂停
        </Button>
      ) : null}
      {campaign.status === 'paused' && access.canPublish ? (
        <Button type="primary" disabled={disabled} onClick={() => onAction('resume')}>
          恢复
        </Button>
      ) : null}
      {(campaign.status === 'published' || campaign.status === 'paused') && access.canPublish ? (
        <Button danger disabled={disabled} onClick={() => onAction('end')}>
          结束
        </Button>
      ) : null}
    </Space>
  )
}

function RulesTab({ campaign }: { campaign: CampaignDetail }) {
  const config = campaign.draftConfig
  if (!config) {
return <Typography.Text type="secondary">暂无草稿规则</Typography.Text>
}
  return (
    <Descriptions column={2} bordered size="small">
      <Descriptions.Item label="标题">{config.copy.title}</Descriptions.Item>
      <Descriptions.Item label="描述">{config.copy.description}</Descriptions.Item>
      <Descriptions.Item label="成功文案">{config.copy.successMessage}</Descriptions.Item>
      <Descriptions.Item label="平台">{config.platforms.join('、')}</Descriptions.Item>
      <Descriptions.Item label="每人限领">{config.perUserLimit}</Descriptions.Item>
      <Descriptions.Item label="发放积分">{formatCredits(config.grantCredits)}</Descriptions.Item>
    </Descriptions>
  )
}

function VersionsTab({ campaign }: { campaign: CampaignDetail }) {
  if (!campaign.versions.length) {
    return <Typography.Text type="secondary">草稿尚未发布，没有不可变版本快照。</Typography.Text>
  }
  return (
    <CursorTable
      rowKey="version"
      dataSource={campaign.versions}
      loading={false}
      hasPrev={false}
      hasNext={false}
      onPrev={() => undefined}
      onNext={() => undefined}
      columns={[
        { title: '版本', dataIndex: 'version', render: (value: number) => `v${value}` },
        {
          title: '发放积分',
          render: (_, row) => formatCredits(row.config.grantCredits),
        },
        {
          title: '窗口',
          render: (_, row) =>
            `${formatDateTime(row.config.startsAt, 'YYYY-MM-DD')} – ${formatDateTime(row.config.endsAt, 'YYYY-MM-DD')}`,
        },
        {
          title: '发布时间',
          dataIndex: 'createdAt',
          render: (value: string) => formatDateTime(value),
        },
      ]}
    />
  )
}

function ClaimsTab({
  campaignId,
  pendingOnly,
  canCompensate,
  onCompensated,
}: {
  campaignId: string
  pendingOnly: boolean
  canCompensate?: boolean
  onCompensated?: () => void
}) {
  const { message } = App.useApp()
  const list = useCursorList({
    filters: { campaignId },
    limit: 50,
    fetchPage: ({ cursor, limit }) => adminApi.listClaims({ id: campaignId, cursor, limit }),
  })
  const [claim, setClaim] = useState<CampaignClaim | null>(null)
  const write = useWriteAction()
  const rows = useMemo(
    () =>
      pendingOnly
        ? list.items.filter((item) => item.status === 'pending_compensation')
        : list.items,
    [list.items, pendingOnly],
  )

  const compensate = async (reason: string) => {
    if (!claim) {
return
}
    const result = await write.run(() =>
      adminApi.compensateClaim({ id: campaignId, claimId: claim.claimId, reason }),
    )
    if (result.status === 'ok') {
      void message.success(result.data.status === 'granted' ? '已补偿发放' : '领取状态已更新')
      setClaim(null)
      list.reload()
      onCompensated?.()
      return
    }
    if (result.status === 'unknown' || result.status === 'rate_limited') {
return
}
    if (result.status !== 'failed' || result.error.code !== 'WRITE_LOCKED') {
      void message.error(result.error.message)
    }
  }

  const queryClaim = () =>
    void write.queryUnknown(async () => {
      if (!claim) {
return 'unresolved'
}
      const lookup = await findClaimAcrossCursors(campaignId, claim.claimId, (params) =>
        adminApi.listClaims(params),
      )
      if (lookup.status === 'found' && lookup.claim.status === 'granted') {
        list.reload()
        onCompensated?.()
        return 'confirmed'
      }
      return 'unresolved'
    }, '未能确认补偿结果。可能仍在处理，或尚未出现在已加载的领取记录中。请稍后再查，不要再次发放。')

  return (
    <>
      {list.error ? <ErrorPanel error={list.error} onRetry={list.reload} /> : null}
      {write.unknown ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: spacing.md }}
          message="补偿结果待确认"
          description={write.unknown}
          action={
            <Button onClick={queryClaim} loading={write.busy}>
              查询结果
            </Button>
          }
        />
      ) : null}
      <CursorTable<CampaignClaim>
        rowKey="claimId"
        loading={list.loading}
        dataSource={rows}
        hasPrev={list.hasPrev}
        hasNext={list.hasNext}
        onPrev={list.goPrev}
        onNext={list.goNext}
        emptyText={pendingOnly ? '没有待补偿领取' : '暂无领取记录'}
        columns={[
          {
            title: '领取 ID',
            dataIndex: 'claimId',
            render: (value: string) => <CopyId value={value} />,
          },
          {
            title: '用户',
            dataIndex: 'userId',
            render: (value: string) => <CopyId value={value} />,
          },
          {
            title: '领取时间',
            dataIndex: 'createdAt',
            render: (value: string) => formatDateTime(value),
          },
          {
            title: '应发积分',
            dataIndex: 'grantedCredits',
            render: (value: number | null) => (value === null ? '—' : formatCredits(value)),
          },
          {
            title: '状态',
            dataIndex: 'status',
            render: (value: CampaignClaim['status']) => <ClaimStatusTag value={value} />,
          },
          ...(pendingOnly && canCompensate
            ? [
                {
                  title: '操作',
                  render: (_: unknown, row: CampaignClaim) => (
                    <Button
                      size="small"
                      type="primary"
                      disabled={write.writesLocked}
                      onClick={() => {
                        setClaim(row)
                        write.openModal()
                      }}
                    >
                      补偿发放
                    </Button>
                  ),
                },
              ]
            : []),
        ]}
      />
      <ReasonActionModal
        open={write.open}
        title="补偿待处理领取"
        confirmText="确认补偿"
        reasonLabel="补偿理由"
        busy={write.busy}
        unknownText={write.unknown}
        rateLimitedText={
          write.rateLimited ? `请 ${Math.ceil(write.remainingMs / 1000)} 秒后再试。` : null
        }
        impact={
          claim ? (
            <Descriptions column={1} size="small">
              <Descriptions.Item label="领取 ID">
                <CopyId value={claim.claimId} />
              </Descriptions.Item>
              <Descriptions.Item label="用户">
                <CopyId value={claim.userId} />
              </Descriptions.Item>
            </Descriptions>
          ) : null
        }
        onSubmit={(reason) => void compensate(reason)}
        onQueryResult={queryClaim}
        onCancel={write.closeModal}
      />
    </>
  )
}
