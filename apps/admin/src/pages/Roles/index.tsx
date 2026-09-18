import { spacing } from '@studycommit/design-tokens'
import { Alert, App, Button, Card, Form, Input, Select, Table, Typography } from 'antd'
import { useAccess } from '@umijs/max'
import { useQuery } from '@tanstack/react-query'
import { useRef } from 'react'
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
import { useWriteAction } from '@/hooks/use-write-action'
import { adminApi } from '@/services/admin-api'
import { queryClient } from '@/services/query-client'
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
  const write = useWriteAction()
  const [form] = Form.useForm<{ userId: string; role: AdminRole }>()
  const pendingGrant = useRef<{ userId: string; role: AdminRole } | null>(null)
  const role = Form.useWatch('role', form) as AdminRole | undefined

  if (!access.canManageRoles) {
    return <ForbiddenPage />
  }

  const grant = async (reason: string) => {
    if (!write.canSubmit) {
      return
    }
    try {
      const values = await form.validateFields()
      const snapshot = { userId: values.userId.trim(), role: values.role }
      pendingGrant.current = snapshot
      const result = await write.run(() =>
        adminApi.grantRole({ userId: snapshot.userId, role: snapshot.role, reason }),
      )
      if (result.status === 'ok') {
        void message.success('已授予角色')
        form.resetFields()
        void query.refetch()
        return
      }
      if (result.status === 'unknown' || result.status === 'rate_limited') {
        return
      }
      void message.error(result.error.message)
    } catch {
      void message.warning('请先填写完整的用户 ID 与角色')
    }
  }

  const queryUnknown = async () => {
    const pending = pendingGrant.current
    const outcome = await write.queryUnknown(async () => {
      if (!pending) {
        return 'unresolved'
      }
      const latest = await adminApi.listRoles()
      queryClient.setQueryData(['admin', 'roles'], latest)
      const row = latest.items.find((item) => item.userId === pending.userId)
      if (!row) {
        return 'unresolved'
      }
      if (row.role !== pending.role) {
        throw new Error(
          `该用户当前角色为 ${ROLE_LABEL[row.role]}（${row.role}），与本次提交的 ${ROLE_LABEL[pending.role]} 不一致，不能据此判定本次授权成功。请在审计日志中核对该用户。`,
        )
      }
      return 'confirmed'
    }, '角色列表尚未出现与本次提交一致的用户和角色，不能据此判定失败。请稍后再查或核对该用户的审计日志，不要重复提交。')
    if (outcome === 'confirmed') {
      form.resetFields()
      void message.success('已确认本次授权：目标用户已具备提交的角色')
    }
  }

  return (
    <AdminPage
      title="管理权限"
      description="授予管理角色。授权后立即生效。"
      extra={
        <Button
          type="primary"
          disabled={write.writesLocked}
          onClick={() => {
            write.openModal()
          }}
        >
          授予角色
        </Button>
      }
    >
      {write.unknown ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: spacing.md }}
          message="操作结果待确认"
          description={write.unknown}
          action={
            <Button onClick={() => void queryUnknown()} loading={write.busy}>
              查询结果
            </Button>
          }
        />
      ) : null}
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
        open={write.open}
        title="授予管理角色"
        confirmText="确认授权"
        reasonLabel="授权原因"
        busy={write.busy}
        unknownText={write.unknown}
        rateLimitedText={
          write.rateLimited ? `请 ${Math.ceil(write.remainingMs / 1000)} 秒后再试。` : null
        }
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
                <Input
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  disabled={write.busy || Boolean(write.unknown)}
                />
              </Form.Item>
              <Form.Item
                name="role"
                label="角色"
                rules={[{ required: true, message: '请选择角色' }]}
              >
                <Select
                  disabled={write.busy || Boolean(write.unknown)}
                  options={ADMIN_ROLES.map((item) => ({
                    value: item,
                    label: `${item}（${ROLE_LABEL[item]}）`,
                  }))}
                />
              </Form.Item>
            </Form>
            <Typography.Paragraph type="secondary">
              授权立即生效，请确认权限影响后再提交。不能降级最后一名超级管理员。
            </Typography.Paragraph>
            {role ? (
              <Alert type="info" showIcon message="权限影响" description={grantImpact(role)} />
            ) : null}
          </div>
        }
        onSubmit={(reason) => void grant(reason)}
        onQueryResult={() => void queryUnknown()}
        onCancel={() => {
          write.closeModal()
        }}
      />
    </AdminPage>
  )
}
