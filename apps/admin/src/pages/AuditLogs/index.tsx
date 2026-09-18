import { Button, Card, Descriptions, Form, Input, Space } from 'antd'
import { useMemo, useState } from 'react'
import { AdminPage } from '@/components/AdminPage'
import { CopyId } from '@/components/CopyId'
import { CursorTable } from '@/components/CursorTable'
import { ErrorPanel } from '@/components/PageState'
import { ReadOnlyDetailDrawer } from '@/components/ReadOnlyDetailDrawer'
import { useCursorList } from '@/hooks/use-cursor-list'
import { adminApi } from '@/services/admin-api'
import type { AuditLog } from '@/services/types'
import { formatDateTime } from '@/utils/format'

const ACTION_LABEL: Record<string, string> = {
  'admin.grant_role': '授予角色',
  'campaign.create': '创建活动草稿',
  'campaign.update_draft': '更新活动草稿',
  'campaign.publish': '发布活动',
  'campaign.pause': '暂停活动',
  'campaign.resume': '恢复活动',
  'campaign.end': '结束活动',
  'campaign.compensate': '发放补偿',
  'ai.publish_price': '发布价格版本',
  'ai.update_config': '更新服务配置',
}

export default function AuditLogsPage() {
  const [actorUserId, setActorUserId] = useState<string | null>(null)
  const [targetType, setTargetType] = useState<string | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [form] = Form.useForm()
  const filters = useMemo(
    () => ({ actorUserId, targetType, targetId }),
    [actorUserId, targetType, targetId],
  )
  const list = useCursorList({
    filters,
    fetchPage: ({ cursor, limit, actorUserId: actor, targetType: type, targetId: id }) =>
      adminApi.listAuditLogs({ actorUserId: actor, targetType: type, targetId: id, cursor, limit }),
  })
  const [selected, setSelected] = useState<AuditLog | null>(null)

  return (
    <AdminPage title="审计日志" description="按操作人、目标类型和目标 ID 筛选操作记录。">
      <Card className="admin-ledger-panel">
        <Form
          className="admin-filter-bar"
          form={form}
          layout="inline"
          onFinish={(values: { actorUserId?: string; targetType?: string; targetId?: string }) => {
            setActorUserId(values.actorUserId?.trim() || null)
            setTargetType(values.targetType?.trim() || null)
            setTargetId(values.targetId?.trim() || null)
          }}
        >
          <Form.Item name="actorUserId" label="操作人 ID">
            <Input placeholder="请输入操作人 ID" allowClear />
          </Form.Item>
          <Form.Item name="targetType" label="目标类型">
            <Input placeholder="例如 campaign / user" allowClear />
          </Form.Item>
          <Form.Item name="targetId" label="目标 ID">
            <Input placeholder="请输入目标 ID" allowClear />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">
              查询
            </Button>
            <Button
              onClick={() => {
                form.resetFields()
                setActorUserId(null)
                setTargetType(null)
                setTargetId(null)
              }}
            >
              重置
            </Button>
          </Space>
        </Form>
        {list.error ? <ErrorPanel error={list.error} onRetry={list.reload} /> : null}
        <CursorTable<AuditLog>
          rowKey="id"
          loading={list.loading}
          dataSource={list.items}
          hasPrev={list.hasPrev}
          hasNext={list.hasNext}
          onPrev={list.goPrev}
          onNext={list.goNext}
          emptyText="没有符合条件的结果"
          onRow={(row) => ({ onClick: () => setSelected(row), style: { cursor: 'pointer' } })}
          columns={[
            {
              title: '操作时间',
              dataIndex: 'createdAt',
              render: (value: string) => formatDateTime(value),
            },
            {
              title: '操作类型',
              dataIndex: 'action',
              render: (value: string) => ACTION_LABEL[value] ?? value,
            },
            {
              title: '操作人 ID',
              dataIndex: 'actorUserId',
              render: (value: string) => <CopyId value={value} />,
            },
            { title: '目标类型', dataIndex: 'targetType' },
            {
              title: '目标 ID',
              dataIndex: 'targetId',
              render: (value: string) => <CopyId value={value} />,
            },
            { title: '理由', dataIndex: 'reason', ellipsis: true },
          ]}
        />
      </Card>
      <ReadOnlyDetailDrawer
        title="管理操作详情"
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <Descriptions column={1} size="small">
            <Descriptions.Item label="操作类型">
              {ACTION_LABEL[selected.action] ?? selected.action}
            </Descriptions.Item>
            <Descriptions.Item label="目标类型">{selected.targetType}</Descriptions.Item>
            <Descriptions.Item label="目标 ID">
              <CopyId value={selected.targetId} />
            </Descriptions.Item>
            <Descriptions.Item label="操作人 ID">
              <CopyId value={selected.actorUserId} />
            </Descriptions.Item>
            <Descriptions.Item label="操作原因">{selected.reason}</Descriptions.Item>
            <Descriptions.Item label="请求 ID">
              {selected.requestId ? <CopyId value={selected.requestId} label="复制" /> : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="操作时间">
              {formatDateTime(selected.createdAt)} Asia/Shanghai
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </ReadOnlyDetailDrawer>
    </AdminPage>
  )
}
