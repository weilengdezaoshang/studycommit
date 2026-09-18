import {
  LockOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  FileSearchOutlined,
  GiftOutlined,
} from '@ant-design/icons'
import { Button, Card, Form, Input, Typography, Alert } from 'antd'
import { history, useModel } from '@umijs/max'
import { useState } from 'react'
import { spacing, typography } from '@studycommit/design-tokens'
import { AdminApiError } from '@/services/api-client'
import { adminApi } from '@/services/admin-api'
import { buildAccountLoginBody, validateLoginForm } from '@/services/login'
import { setSession } from '@/services/session'
import { BrandMark } from '@/components/BrandMark'

export default function LoginPage() {
  const { setInitialState } = useModel('@@initialState')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)

  return (
    <div className="admin-login">
      <section className="admin-login-brand" aria-label="运营工作台介绍">
        <BrandMark inverse />
        <div className="admin-login-story">
          <span className="admin-eyebrow">STUDYCOMMIT · 运营工作台</span>
          <Typography.Title level={2}>
            让每一次发放
            <br />
            都有据可查
          </Typography.Title>
          <Typography.Paragraph>
            从活动配置到积分对账，在一个工作台里清晰掌握每一步。
          </Typography.Paragraph>
          <div className="admin-login-features">
            <div>
              <GiftOutlined />
              <span>
                <strong>活动</strong>
                <small>配置规则</small>
              </span>
            </div>
            <div>
              <UserOutlined />
              <span>
                <strong>领取</strong>
                <small>用户参与</small>
              </span>
            </div>
            <div>
              <FileSearchOutlined />
              <span>
                <strong>对账</strong>
                <small>核对记录</small>
              </span>
            </div>
            <div>
              <SafetyCertificateOutlined />
              <span>
                <strong>审计</strong>
                <small>追溯操作</small>
              </span>
            </div>
          </div>
        </div>
        <div className="admin-login-brand-footer">清晰管理 · 有序协作</div>
      </section>
      <main className="admin-login-form">
        <div className="admin-login-mobile-brand">
          <BrandMark />
        </div>
        <Card className="admin-login-card" bordered={false}>
          <div className="admin-login-lock" aria-hidden="true">
            <LockOutlined />
          </div>
          <Typography.Title level={3} style={{ marginBottom: spacing.sm }}>
            管理员登录
          </Typography.Title>
          <Typography.Paragraph type="secondary" className="admin-login-intro">
            欢迎回来，请使用已授权的账号登录。
          </Typography.Paragraph>
          {error ? (
            <Alert
              type={forbidden ? 'warning' : 'error'}
              showIcon
              message={error}
              style={{ marginBottom: spacing.md }}
            />
          ) : null}
          <Form
            layout="vertical"
            requiredMark={false}
            disabled={submitting}
            onFinish={async (values: { account: string; password: string }) => {
              const fieldErrors = validateLoginForm(values)
              if (fieldErrors.account || fieldErrors.password) {
                setError(fieldErrors.account ?? fieldErrors.password ?? '请检查输入')
                return
              }
              setSubmitting(true)
              setError(null)
              setForbidden(false)
              try {
                const login = await adminApi.login(buildAccountLoginBody(values))
                setSession({
                  userId: login.user.id,
                  role: 'viewer',
                  accessToken: login.tokens.accessToken,
                  nickname: login.user.nickname,
                })
                const me = await adminApi.me()
                const session = {
                  userId: me.userId,
                  role: me.role,
                  accessToken: login.tokens.accessToken,
                  nickname: login.user.nickname,
                }
                setSession(session)
                await setInitialState?.({ session })
                history.push('/')
              } catch (caught) {
                setSession(null)
                const api = caught instanceof AdminApiError ? caught : null
                if (api?.status === 403 || api?.code === 'ADMIN_FORBIDDEN') {
                  setForbidden(true)
                  setError('当前账号没有管理权限，请切换已授权账号。')
                } else {
                  setError(
                    api?.message ?? (caught instanceof Error ? caught.message : '账号或密码不正确'),
                  )
                }
              } finally {
                setSubmitting(false)
              }
            }}
          >
            <Form.Item
              name="account"
              label="账号"
              rules={[{ required: true, message: '请输入账号' }]}
            >
              <Input
                prefix={<UserOutlined />}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="管理员账号"
              />
            </Form.Item>
            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                autoComplete="current-password"
                placeholder="密码"
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={submitting} size="large">
              {forbidden ? '切换账号并登录' : '登录'}
            </Button>
          </Form>
          <Typography.Paragraph
            type="secondary"
            style={{
              marginTop: spacing.md,
              fontSize: typography.caption.fontSize,
              textAlign: 'center',
            }}
          >
            <LockOutlined /> 仅限已授权管理员 · 刷新页面后需要重新登录
          </Typography.Paragraph>
        </Card>
      </main>
    </div>
  )
}
