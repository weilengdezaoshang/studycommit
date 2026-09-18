import { Alert, Button, Card, Descriptions, Form, Input, Select, Space, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { AdminPage } from '@/components/AdminPage'
import { CopyId } from '@/components/CopyId'
import { CursorTable } from '@/components/CursorTable'
import { ErrorPanel } from '@/components/PageState'
import { ReadOnlyDetailDrawer } from '@/components/ReadOnlyDetailDrawer'
import { ReservationStatusTag, RunStatusTag } from '@/components/StatusTag'
import { useCursorList } from '@/hooks/use-cursor-list'
import { adminApi } from '@/services/admin-api'
import type { RunRow, RunStatus } from '@/services/types'
import { formatCredits, formatDateTime } from '@/utils/format'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default function RunsPage() {
  const [status, setStatus] = useState<RunStatus | null>(null)
  const [runId, setRunId] = useState<string | null>(null)
  const [runIdInput, setRunIdInput] = useState('')
  const invalidRunId = Boolean(runIdInput.trim()) && !UUID_PATTERN.test(runIdInput.trim())
  const [selected, setSelected] = useState<RunRow | null>(null)
  const filters = useMemo(() => ({ status, runId }), [status, runId])
  const list = useCursorList({
    filters,
    fetchPage: ({ cursor, limit, status: filterStatus, runId: filterRunId }) =>
      adminApi.listRuns({ status: filterStatus, runId: filterRunId, cursor, limit }),
  })

  return (
    <AdminPage title="运行对账" description="查看运行状态与冻结记录，便于核对异常。">
      <Card className="admin-ledger-panel">
        <Form className="admin-filter-bar" layout="inline" onFinish={() => undefined}>
          <Form.Item
            label="运行 ID"
            validateStatus={invalidRunId ? 'error' : undefined}
            help={invalidRunId ? '请输入完整的运行 UUID' : undefined}
          >
            <Input
              allowClear
              placeholder="精确 UUID"
              value={runIdInput}
              style={{ width: 280 }}
              onChange={(event) => {
                setRunIdInput(event.target.value)
                if (!event.target.value) {
setRunId(null)
}
              }}
              onPressEnter={() => {
                const value = runIdInput.trim()
                if (!value) {
                  setRunId(null)
                  return
                }
                if (!UUID_PATTERN.test(value)) {
return
}
                setRunId(value)
              }}
            />
          </Form.Item>
          <Form.Item label="状态">
            <Select
              allowClear
              placeholder="全部状态"
              style={{ width: 160 }}
              value={status ?? undefined}
              onChange={(value) => setStatus(value ?? null)}
              options={[
                { value: 'pending', label: '运行中' },
                { value: 'completed', label: '运行成功' },
                { value: 'failed', label: '运行失败' },
              ]}
            />
          </Form.Item>
          <Button
            type="primary"
            disabled={invalidRunId}
            onClick={() => {
              const value = runIdInput.trim()
              if (value && !UUID_PATTERN.test(value)) {
return
}
              setRunId(value || null)
            }}
          >
            查询
          </Button>
        </Form>
        {list.error ? <ErrorPanel error={list.error} onRetry={list.reload} /> : null}
        <CursorTable<RunRow>
          rowKey="runId"
          loading={list.loading}
          dataSource={list.items}
          hasPrev={list.hasPrev}
          hasNext={list.hasNext}
          onPrev={list.goPrev}
          onNext={list.goNext}
          emptyText="没有符合条件的运行"
          onRow={(row) => ({ onClick: () => setSelected(row), style: { cursor: 'pointer' } })}
          columns={[
            {
              title: '运行 ID',
              dataIndex: 'runId',
              render: (value: string) => <CopyId value={value} />,
            },
            {
              title: '用户',
              dataIndex: 'userId',
              render: (value: string) => <CopyId value={value} />,
            },
            {
              title: '执行状态',
              dataIndex: 'status',
              render: (value: RunRow['status']) => <RunStatusTag value={value} />,
            },
            {
              title: '冻结状态',
              render: (_, row) =>
                row.reservation ? <ReservationStatusTag value={row.reservation.status} /> : '—',
            },
            {
              title: '积分',
              render: (_, row) => (row.reservation ? formatCredits(row.reservation.amount) : '—'),
            },
            {
              title: '对账截止',
              render: (_, row) =>
                row.reservation ? formatDateTime(row.reservation.deadlineAt) : '—',
            },
            {
              title: '脱敏错误',
              dataIndex: 'error',
              render: (value: string | null) =>
                value ? <Typography.Text type="danger">{value}</Typography.Text> : '—',
            },
          ]}
        />
      </Card>
      <ReadOnlyDetailDrawer
        title="运行详情"
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        extra={selected ? <Button onClick={() => list.reload()}>刷新状态</Button> : null}
      >
        {selected ? <RunDetail run={selected} /> : null}
      </ReadOnlyDetailDrawer>
    </AdminPage>
  )
}

function RunDetail({ run }: { run: RunRow }) {
  const overdue =
    run.reservation?.status === 'active' &&
    new Date(run.reservation.deadlineAt).getTime() < Date.now()
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Descriptions column={1} size="small">
        <Descriptions.Item label="运行 ID">
          <CopyId value={run.runId} label="复制运行 ID" />
        </Descriptions.Item>
        <Descriptions.Item label="用户">
          <CopyId value={run.userId} />
        </Descriptions.Item>
        <Descriptions.Item label="执行状态">
          <RunStatusTag value={run.status} />
        </Descriptions.Item>
        <Descriptions.Item label="冻结状态">
          {run.reservation ? <ReservationStatusTag value={run.reservation.status} /> : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="积分">
          {run.reservation ? formatCredits(run.reservation.amount) : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="对账截止">
          {run.reservation ? formatDateTime(run.reservation.deadlineAt) : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="创建时间">{formatDateTime(run.createdAt)}</Descriptions.Item>
        <Descriptions.Item label="错误信息">{run.error ?? '—'}</Descriptions.Item>
      </Descriptions>
      {overdue ? <Alert type="error" showIcon message="已超过对账截止时间" /> : null}
      <Typography.Paragraph type="secondary">
        此记录只读，用于核对运行与冻结状态。
      </Typography.Paragraph>
    </Space>
  )
}
