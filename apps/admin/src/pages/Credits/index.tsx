import { spacing } from '@studycommit/design-tokens'
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Row,
  Space,
  Statistic,
  Tabs,
  Typography,
} from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AdminPage } from '@/components/AdminPage'
import { CopyId } from '@/components/CopyId'
import { CursorTable } from '@/components/CursorTable'
import { ErrorPanel } from '@/components/PageState'
import { ReadOnlyDetailDrawer } from '@/components/ReadOnlyDetailDrawer'
import { GrantStatusTag, LedgerKindTag } from '@/components/StatusTag'
import { useCursorList } from '@/hooks/use-cursor-list'
import { adminApi } from '@/services/admin-api'
import type { CreditGrant, CreditUser, LedgerEntry } from '@/services/types'
import { displayName, formatCredits, formatDateTime, signedAmount } from '@/utils/format'
import { AdminApiError } from '@/services/api-client'

export default function CreditsPage() {
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [users, setUsers] = useState<CreditUser[] | null>(null)
  const [selected, setSelected] = useState<CreditUser | null>(null)

  const searchSeq = useRef(0)
  useEffect(
    () => () => {
      searchSeq.current++
    },
    [],
  )
  const search = async (value: string) => {
    const text = value.trim()
    if (!text) {
      setError(new Error('请输入用户 ID 或昵称前缀'))
      return
    }
    const seq = ++searchSeq.current
    setLoading(true)
    setError(null)
    setUsers(null)
    setSelected(null)
    try {
      const response = await adminApi.searchCreditUsers({ query: text })
      if (seq !== searchSeq.current) {
return
}
      setUsers(response.items)
      setSubmitted(text)
    } catch (caught) {
      if (seq !== searchSeq.current) {
return
}
      setError(caught instanceof Error ? caught : new Error('检索失败'))
      setUsers(null)
      if (caught instanceof AdminApiError && caught.status === 403) {
        setSelected(null)
      }
    } finally {
      if (seq === searchSeq.current) {
setLoading(false)
}
    }
  }

  return (
    <AdminPage title="积分用户" description="按用户 ID 或昵称前缀查询余额、批次和流水。">
      <Card className="admin-ledger-panel">
        <Form
          className="admin-filter-bar"
          layout="inline"
          onFinish={(values: { query: string }) => void search(values.query)}
        >
          <Form.Item name="query" rules={[{ required: true, message: '请输入用户 ID 或昵称前缀' }]}>
            <Input
              allowClear
              placeholder="用户 ID 精确匹配或昵称前缀"
              style={{ width: 320 }}
              onChange={(event) => setQuery(event.target.value)}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            查询
          </Button>
        </Form>
        {error ? (
          <ErrorPanel error={error} onRetry={() => void search(submitted || query)} />
        ) : null}
        {users === null && !loading && !error ? (
          <Empty description="请先搜索用户" />
        ) : (
          <CursorTable<CreditUser>
            rowKey="userId"
            loading={loading}
            dataSource={users ?? []}
            hasPrev={false}
            hasNext={false}
            onPrev={() => undefined}
            onNext={() => undefined}
            emptyText={submitted ? '没有符合条件的结果' : '请先搜索用户'}
            columns={[
              {
                title: '用户',
                dataIndex: 'userId',
                render: (value: string) => <CopyId value={value} />,
              },
              {
                title: '用户名',
                dataIndex: 'nickname',
                render: (value: string | null) => (
                  <span
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {displayName(value)}
                  </span>
                ),
              },
              {
                title: '可用积分',
                dataIndex: 'available',
                render: (value: number) => formatCredits(value),
              },
              {
                title: '冻结积分',
                dataIndex: 'reserved',
                render: (value: number) => formatCredits(value),
              },
              {
                title: '累计发放',
                dataIndex: 'lifetimeGranted',
                render: (value: number) => formatCredits(value),
              },
              {
                title: '操作',
                render: (_, row) => (
                  <Button type="link" onClick={() => setSelected(row)}>
                    查看
                  </Button>
                ),
              },
            ]}
          />
        )}
        {users ? (
          <Typography.Text type="secondary">
            匹配 {users.length} 位用户（用户搜索无游标）
          </Typography.Text>
        ) : null}
      </Card>
      <UserDetailDrawer user={selected} onClose={() => setSelected(null)} />
    </AdminPage>
  )
}

function UserDetailDrawer({ user, onClose }: { user: CreditUser | null; onClose: () => void }) {
  const query = useQuery({
    queryKey: ['admin', 'credit-user', user?.userId],
    queryFn: () => adminApi.getCreditUser(user!.userId),
    enabled: Boolean(user),
    retry: false,
  })
  const denied = query.error instanceof AdminApiError && [401, 403].includes(query.error.status)
  return (
    <ReadOnlyDetailDrawer
      title="用户详情"
      open={Boolean(user)}
      onClose={onClose}
      width={640}
      extra={<Typography.Text type="secondary">只读</Typography.Text>}
    >
      {denied ? (
        <ErrorPanel error={query.error!} />
      ) : user ? (
        <UserDetail
          user={user}
          detail={query.error ? null : (query.data ?? null)}
          loading={query.isLoading}
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : null}
    </ReadOnlyDetailDrawer>
  )
}

function UserDetail({
  user,
  detail,
  loading,
  error,
  onRetry,
}: {
  user: CreditUser
  detail: { user: CreditUser; grants: CreditGrant[] } | null
  loading: boolean
  error: Error | null
  onRetry: () => void
}) {
  const current = detail?.user ?? user
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Typography.Title level={4} style={{ marginBottom: 0 }}>
          {displayName(current.nickname)}
        </Typography.Title>
        <CopyId value={current.userId} />
      </div>
      <Row gutter={spacing.md}>
        <Col span={8}>
          <Statistic title="可用积分" value={formatCredits(current.available)} />
        </Col>
        <Col span={8}>
          <Statistic title="冻结积分" value={formatCredits(current.reserved)} />
        </Col>
        <Col span={8}>
          <Statistic title="累计发放" value={formatCredits(current.lifetimeGranted)} />
        </Col>
      </Row>
      <Alert type="info" message="余额由流水计算，不支持直接修改。" />
      {error ? <ErrorPanel error={error} onRetry={onRetry} /> : null}
      <Tabs
        items={[
          {
            key: 'grants',
            label: '积分批次',
            children: (
              <CursorTable<CreditGrant>
                rowKey="grantId"
                loading={loading}
                dataSource={detail?.grants ?? []}
                hasPrev={false}
                hasNext={false}
                onPrev={() => undefined}
                onNext={() => undefined}
                emptyText="暂无批次"
                columns={[
                  {
                    title: '发放时间',
                    dataIndex: 'createdAt',
                    render: (value: string) => formatDateTime(value, 'YYYY-MM-DD'),
                  },
                  {
                    title: '关联 ID',
                    dataIndex: 'grantId',
                    render: (value: string) => <CopyId value={value} />,
                  },
                  {
                    title: '来源',
                    dataIndex: 'source',
                    render: (value: CreditGrant['source']) =>
                      value === 'campaign' ? '活动' : '管理发放',
                  },
                  {
                    title: '发放积分',
                    dataIndex: 'originalAmount',
                    render: (value: number) => formatCredits(value),
                  },
                  {
                    title: '剩余可用',
                    dataIndex: 'remainingAvailable',
                    render: (value: number) => formatCredits(value),
                  },
                  {
                    title: '冻结积分',
                    dataIndex: 'frozenAmount',
                    render: (value: number) => formatCredits(value),
                  },
                  {
                    title: '过期时间',
                    dataIndex: 'expiresAt',
                    render: (value: string | null) =>
                      value ? formatDateTime(value, 'YYYY-MM-DD') : '—',
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    render: (value: CreditGrant['status']) => <GrantStatusTag value={value} />,
                  },
                ]}
              />
            ),
          },
          {
            key: 'ledger',
            label: '积分流水',
            children: <LedgerTab userId={user.userId} />,
          },
        ]}
      />
    </Space>
  )
}

function LedgerTab({ userId }: { userId: string }) {
  const list = useCursorList({
    filters: { userId },
    fetchPage: ({ cursor, limit }) => adminApi.listLedger({ userId, cursor, limit }),
  })
  return (
    <>
      {list.error ? <ErrorPanel error={list.error} onRetry={list.reload} /> : null}
      <CursorTable<LedgerEntry>
        rowKey="eventId"
        loading={list.loading}
        dataSource={list.items}
        hasPrev={list.hasPrev}
        hasNext={list.hasNext}
        onPrev={list.goPrev}
        onNext={list.goNext}
        emptyText="暂无流水"
        columns={[
          {
            title: '时间',
            dataIndex: 'createdAt',
            render: (value: string) => formatDateTime(value),
          },
          {
            title: '类型',
            dataIndex: 'kind',
            render: (value: LedgerEntry['kind']) => <LedgerKindTag value={value} />,
          },
          {
            title: '可用变化',
            dataIndex: 'deltaAvailable',
            render: (value: number) => <span className="tabular-nums">{signedAmount(value)}</span>,
          },
          {
            title: '冻结变化',
            dataIndex: 'deltaReserved',
            render: (value: number) => <span className="tabular-nums">{signedAmount(value)}</span>,
          },
          {
            title: '关联 ID',
            render: (_, row) => <CopyId value={row.runId ?? row.grantId ?? row.campaignId} />,
          },
        ]}
      />
    </>
  )
}
