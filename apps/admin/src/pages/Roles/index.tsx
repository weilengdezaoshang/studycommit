import { spacing } from '@studycommit/design-tokens'
import { Alert, App, Button, Card, Form, Input, Select, Table, Typography } from 'antd'
import { useAccess } from '@umijs/max'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import {
  ADMIN_ROLES,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  grantImpact,
  type AdminRole,
} from '@/auth/capabilities'
import { AdminPage } from '@/components/AdminPage'
import { CopyId } from '@/components/CopyId'
import { ErrorPanel } from '@/components/PageState'
import { ReasonActionModal } from '@/components/ReasonActionModal'
import { adminApi } from '@/services/admin-api'
import { runCommand } from '@/services/command'
import type { RoleRow } from '@/services/types'
import { formatDateTime } from '@/utils/format'
import ForbiddenPage from '../403'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default function RolesPage() {
  const access = useAccess()
  const { message } = App.useApp()
  const query = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => adminApi.listRoles(),
    enabled: access.canManageRoles,
  })
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm<{ userId: string; role: AdminRole }>()
  const [busy, setBusy] = useState(false)
  const [unknownText, setUnknownText] = useState<string | null>(null)
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const role = Form.useWatch('role', form) as AdminRole | undefined

  if (!access.canManageRoles) {
    return <ForbiddenPage />
  }

  const grant = async (reason: string) => {
    try {
      const values = await form.validateFields()
      setBusy(true)
      setPendingUserId(values.userId.trim())
      const result = await runCommand(() =>
        adminApi.grantRole({ userId: values.userId.trim(), role: values.role, reason }),
      )
      setBusy(false)
      if (result.status === 'ok') {
        void message.success('已授予角色')
        setOpen(false)
        setUnknownText(null)
        form.resetFields()
        void query.refetch()
        return
      }
      if (result.status === 'unknown') {
        setUnknownText('授权结果待确认。请先查询角色列表，不要重复提交。')
        return
      }
      void message.error(result.error.message)
    } catch {
      setBusy(false)
      void message.warning('请先填写完整的用户 ID 与角色')
    }
  }

  return (
    <AdminPage
      title="管理权限"
      description="授予管理角色。授权后立即生效。"
      extra={
        <Button type="primary" onClick={() => setOpen(true)} disabled={Boolean(unknownText)}>
          授予角色
        </Button>
      }
    >
      <Card className="admin-ledger-panel" title="角色定义" style={{ marginBottom: spacing.md }}>
        <Table
          rowKey="role"
          pagination={false}
          dataSource={ADMIN_ROLES.map((item) => ({
            role: item,
            name: ROLE_LABEL[item],
            description: ROLE_DESCRIPTION[item],
          }))}
          columns={[
            { title: '角色标识', dataIndex: 'role' },
            { title: '角色名称', dataIndex: 'name' },
            { title: '权限说明', dataIndex: 'description' },
          ]}
        />
      </Card>
      <Card className="admin-ledger-panel" title="已授权用户">
        {query.error ? (
          <ErrorPanel error={query.error as Error} onRetry={() => void query.refetch()} />
        ) : null}
        <Table<RoleRow>
          rowKey="userId"
          loading={query.isLoading}
          dataSource={query.data?.items ?? []}
          pagination={
            (query.data?.items.length ?? 0) > 10 ? { pageSize: 10, showSizeChanger: false } : false
          }
          columns={[
            {
              title: '用户 ID',
              dataIndex: 'userId',
              render: (value: string) => <CopyId value={value} />,
            },
            { title: '角色', dataIndex: 'role', render: (value: AdminRole) => ROLE_LABEL[value] },
            {
              title: '授权人',
              dataIndex: 'grantedBy',
              render: (value: string | null) => (value ? <CopyId value={value} /> : '—'),
            },
            { title: '授权原因', dataIndex: 'reason', ellipsis: true },
            {
              title: '授权时间',
              dataIndex: 'createdAt',
              render: (value: string) => formatDateTime(value),
            },
          ]}
        />
      </Card>
      <ReasonActionModal
        open={open}
        title="授予管理角色"
        confirmText="确认授权"
        reasonLabel="授权原因"
        busy={busy}
        unknownText={unknownText}
        impact={
          <div>
            <Form form={form} layout="vertical">
              <Form.Item
                name="userId"
                label="用户 ID"
                extra="请输入完整的用户 UUID，不能使用简写。"
                rules={[
                  { required: true, message: '请输入用户 ID' },
                  { pattern: UUID_PATTERN, message: '必须是完整 UUID' },
                ]}
              >
                <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              </Form.Item>
              <Form.Item
                name="role"
                label="角色"
                rules={[{ required: true, message: '请选择角色' }]}
              >
                <Select
                  options={ADMIN_ROLES.map((item) => ({
                    value: item,
                    label: `${item}（${ROLE_LABEL[item]}）`,
                  }))}
                />
              </Form.Item>
            </Form>
            <Typography.Paragraph type="secondary">
              授权立即生效，请确认权限影响后再提交。
            </Typography.Paragraph>
            {role ? (
              <Alert type="info" showIcon message="权限影响" description={grantImpact(role)} />
            ) : null}
          </div>
        }
        onSubmit={(reason) => void grant(reason)}
        onQueryResult={() => {
          setBusy(true)
          void query
            .refetch()
            .then((result) => {
              const found = result.data?.items.some((item) => item.userId === pendingUserId)
              if (found) {
                setUnknownText(null)
                setOpen(false)
                void message.success('已在角色列表中确认该授权')
                return
              }
              setUnknownText(
                '角色列表中尚未看到该用户，不能据此判定失败。请稍后再查，不要重复提交。',
              )
            })
            .finally(() => setBusy(false))
        }}
        onCancel={() => {
          if (busy) {
return
}
          setOpen(false)
        }}
      />
    </AdminPage>
  )
}
