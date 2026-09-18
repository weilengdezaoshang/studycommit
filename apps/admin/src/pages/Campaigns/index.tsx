import { Button, Card, Tabs } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { history, useAccess } from '@umijs/max'
import { useMemo, useState } from 'react'
import { AdminPage } from '@/components/AdminPage'
import { CopyId } from '@/components/CopyId'
import { CursorTable } from '@/components/CursorTable'
import { ErrorPanel } from '@/components/PageState'
import { CampaignStatusTag, DisplayStatusTag, campaignTypeLabel } from '@/components/StatusTag'
import { useCursorList } from '@/hooks/use-cursor-list'
import { adminApi } from '@/services/admin-api'
import type { CampaignStatus, CampaignSummary } from '@/services/types'
import { formatBudget, formatCredits, formatDateTime } from '@/utils/format'

const STATUS_TABS: Array<{ key: string; label: string; status: CampaignStatus | null }> = [
  { key: 'all', label: '全部', status: null },
  { key: 'draft', label: '草稿', status: 'draft' },
  { key: 'published', label: '已发布', status: 'published' },
  { key: 'paused', label: '已暂停', status: 'paused' },
  { key: 'ended', label: '已结束', status: 'ended' },
]

export default function CampaignListPage() {
  const access = useAccess()
  const [tab, setTab] = useState('all')
  const status = useMemo(() => STATUS_TABS.find((item) => item.key === tab)?.status ?? null, [tab])
  const list = useCursorList({
    filters: { status },
    fetchPage: ({ cursor, limit, status: filterStatus }) =>
      adminApi.listCampaigns({ status: filterStatus, cursor, limit }),
  })

  return (
    <AdminPage
      title="活动管理"
      description="管理平台活动的创建、发布与运行状态"
      extra={
        access.canManageDraft ? (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => history.push('/campaigns/new')}
          >
            新建活动草稿
          </Button>
        ) : null
      }
    >
      <Card className="admin-ledger-panel">
        <Tabs
          className="admin-segment-tabs"
          activeKey={tab}
          onChange={setTab}
          items={STATUS_TABS.map((item) => ({ key: item.key, label: item.label }))}
        />
        {list.error ? <ErrorPanel error={list.error} onRetry={list.reload} /> : null}
        <CursorTable<CampaignSummary>
          rowKey="id"
          loading={list.loading}
          dataSource={list.items}
          hasPrev={list.hasPrev}
          hasNext={list.hasNext}
          onPrev={list.goPrev}
          onNext={list.goNext}
          emptyText={tab === 'all' ? '还没有活动' : '没有符合条件的结果'}
          onRow={(row) => ({
            onClick: () => history.push(`/campaigns/${row.id}`),
            style: { cursor: 'pointer' },
          })}
          columns={[
            {
              title: '活动',
              dataIndex: 'name',
              render: (_, row) => (
                <div>
                  <div>{row.name}</div>
                  <CopyId value={row.code} label="复制 code" />
                </div>
              ),
            },
            {
              title: '类型',
              dataIndex: 'type',
              render: (type: CampaignSummary['type']) => campaignTypeLabel(type),
            },
            {
              title: '人工状态',
              dataIndex: 'status',
              render: (value: CampaignSummary['status']) => <CampaignStatusTag value={value} />,
            },
            {
              title: '展示状态',
              dataIndex: 'displayStatus',
              render: (value: CampaignSummary['displayStatus']) => (
                <DisplayStatusTag value={value} />
              ),
            },
            {
              title: '版本',
              dataIndex: 'currentVersion',
              render: (value: number) => (value === 0 ? 'v0' : `v${value}`),
            },
            {
              title: '已发放与预算',
              render: (_, row) => (
                <div className="tabular-nums">
                  {formatCredits(row.totalGrantedCredits)} / {formatBudget(row.totalBudgetCredits)}
                </div>
              ),
            },
            {
              title: '领取窗口',
              render: (_, row) => (
                <div>
                  {formatDateTime(row.startsAt, 'YYYY-MM-DD')} –{' '}
                  {formatDateTime(row.endsAt, 'YYYY-MM-DD')}
                  <div style={{ color: 'var(--sc-muted)', fontSize: 12 }}>
                    {row.displayTimezone}
                  </div>
                </div>
              ),
            },
            {
              title: '详情',
              render: (_, row) => (
                <Button type="link" onClick={() => history.push(`/campaigns/${row.id}`)}>
                  查看
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </AdminPage>
  )
}
