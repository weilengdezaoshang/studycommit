import { spacing } from '@studycommit/design-tokens'
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Select,
  Space,
  Typography,
} from 'antd'
import { useAccess } from '@umijs/max'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { ActionSummary } from '@/components/AdminActionDialog'
import { ErrorPanel } from '@/components/PageState'
import { ReasonActionModal } from '@/components/ReasonActionModal'
import { ProviderStatusTag } from '@/components/StatusTag'
import { useWriteAction } from '@/hooks/use-write-action'
import { adminApi } from '@/services/admin-api'
import { queryClient } from '@/services/query-client'
import { isServerError } from '@/services/api-client'
import type { AiProviderConfig, AiProviderProtocol, AiProviderTestResult } from '@/services/types'
import { matchesProviderConfig } from '@/utils/confirmed-state'
import { formatDateTime } from '@/utils/format'

const PROTOCOL_OPTIONS: Array<{ value: AiProviderProtocol; label: string }> = [
  { value: 'openai', label: 'OpenAI 兼容' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Gemini' },
]

const STATUS_HELP: Record<AiProviderConfig['displayStatus'], string> = {
  unconfigured: '尚未保存平台服务商。未建立数据库配置时，服务端仍可能使用环境变量。',
  configured_unverified: '已保存配置，但尚未对当前版本完成连接测试。',
  connected: '当前已保存配置已通过连接测试。',
  connection_failed: '当前已保存配置最近一次连接测试失败。',
  disabled: '已停用。新请求不会回退到环境变量。',
}

export function ProviderConfigCard() {
  const access = useAccess()
  const { message } = App.useApp()
  const query = useQuery({
    queryKey: ['admin', 'ai-provider'],
    queryFn: () => adminApi.getAiProvider(),
    enabled: access.canManageProvider,
  })
  const write = useWriteAction(query.data?.version ?? null)
  const config = query.data
  const [formOpen, setFormOpen] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)
  const [testing, setTesting] = useState(false)
  const [draftTest, setDraftTest] = useState<AiProviderTestResult | null>(null)
  const [form, setForm] = useState({
    protocol: 'openai' as AiProviderProtocol,
    baseUrl: '',
    model: '',
    apiKey: '',
  })
  const pending = useRef<'save' | 'disable' | null>(null)

  useEffect(() => {
    if (!formOpen || !config) {
return
}
    setForm({
      protocol: config.protocol ?? 'openai',
      baseUrl: config.baseUrl ?? '',
      model: config.model ?? '',
      apiKey: '',
    })
    setDraftTest(null)
  }, [config, formOpen])

  if (!access.canManageProvider) {
    return (
      <Card className="admin-setting-card" title="服务商配置">
        <Typography.Text type="secondary">服务商配置仅超级管理员可查看与修改。</Typography.Text>
      </Card>
    )
  }

  const mutationsDisabled = write.writesLocked || query.isLoading || Boolean(write.conflict)
  const readFailed = Boolean(query.error)

  const submitSave = async (reason: string) => {
    if (!write.canSubmit) {
return
}
    const expectedVersion = write.expectedVersion()
    if (expectedVersion === null) {
      void message.error('配置版本未知，无法提交')
      return
    }
    pending.current = 'save'
    const result = await write.run(() =>
      adminApi.updateAiProvider({
        expectedVersion,
        protocol: form.protocol,
        baseUrl: form.baseUrl.trim() || undefined,
        model: form.model.trim(),
        apiKey: form.apiKey.trim() || undefined,
        reason,
      }),
    )
    if (result.status === 'ok') {
      void message.success('服务商配置已保存')
      setFormOpen(false)
      setDraftTest(null)
      queryClient.setQueryData(['admin', 'ai-provider'], result.data)
      return
    }
    if (result.status === 'conflict') {
      const latest = await adminApi.getAiProvider().catch(() => null)
      write.noteConflictLatest(latest?.version ?? null)
      return
    }
    if (result.status === 'unknown' || result.status === 'rate_limited') {
return
}
    if (result.status !== 'failed' || result.error.code !== 'WRITE_LOCKED') {
      void message.error(result.error.message)
    }
  }

  const submitDisable = async (reason: string) => {
    if (!write.canSubmit) {
return
}
    const expectedVersion = write.expectedVersion()
    if (expectedVersion === null) {
      void message.error('配置版本未知，无法提交')
      return
    }
    pending.current = 'disable'
    const result = await write.run(() => adminApi.disableAiProvider({ expectedVersion, reason }))
    if (result.status === 'ok') {
      void message.success('已停用服务商配置')
      setDisableOpen(false)
      queryClient.setQueryData(['admin', 'ai-provider'], result.data)
      return
    }
    if (result.status === 'conflict') {
      const latest = await adminApi.getAiProvider().catch(() => null)
      write.noteConflictLatest(latest?.version ?? null)
      return
    }
    if (result.status === 'unknown' || result.status === 'rate_limited') {
return
}
    if (result.status !== 'failed' || result.error.code !== 'WRITE_LOCKED') {
      void message.error(result.error.message)
    }
  }

  const testConnection = async () => {
    if (testing || write.busy) {
return
}
    if (!form.model.trim()) {
      void message.warning('请先填写模型')
      return
    }
    if (!form.apiKey.trim() && !config?.hasApiKey) {
      void message.warning('请先填写 API Key')
      return
    }
    setTesting(true)
    try {
      const result = await adminApi.testAiProvider({
        protocol: form.protocol,
        baseUrl: form.baseUrl.trim() || undefined,
        model: form.model.trim(),
        apiKey: form.apiKey.trim() || undefined,
      })
      setDraftTest(result)
      if (result.persisted) {
void query.refetch()
}
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '连接测试失败')
    } finally {
      setTesting(false)
    }
  }

  const queryUnknown = async () => {
    const outcome = await write.queryUnknown(async () => {
      const latest = await adminApi.getAiProvider()
      if (pending.current === 'disable') {
        if (latest.displayStatus !== 'disabled') {
return 'unresolved'
}
      } else if (pending.current === 'save') {
        if (
          !matchesProviderConfig(latest, {
            protocol: form.protocol,
            baseUrl: form.baseUrl.trim() || latest.baseUrl,
            model: form.model.trim(),
            displayStatus: latest.displayStatus === 'disabled' ? 'disabled' : latest.displayStatus,
          })
        ) {
          return 'unresolved'
        }
      } else {
return 'unresolved'
}
      queryClient.setQueryData(['admin', 'ai-provider'], latest)
      return 'confirmed'
    }, '尚未查询到与本次提交一致的结果，请稍后再查或核对审计日志，不要重复提交。')
    if (outcome === 'confirmed') {
      setFormOpen(false)
      setDisableOpen(false)
      void message.info('当前数据已符合本次提交目标')
    }
  }

  const viewLatest = async () => {
    try {
      const latest = await adminApi.getAiProvider()
      queryClient.setQueryData(['admin', 'ai-provider'], latest)
      write.applyLatestVersion(latest.version)
      write.closeModal()
      void message.info('已加载最新配置，请检查后重新确认操作')
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '读取失败')
    }
  }

  return (
    <Card
      className="admin-setting-card"
      title="服务商配置"
      extra={
        <Space>
          <Button type="link" onClick={() => void query.refetch()}>
            刷新
          </Button>
          {config &&
          config.displayStatus !== 'unconfigured' &&
          config.displayStatus !== 'disabled' ? (
            <Button
              danger
              disabled={mutationsDisabled || readFailed}
              onClick={() => {
                setDisableOpen(true)
                write.openModal()
              }}
            >
              停用
            </Button>
          ) : null}
          <Button
            type="primary"
            disabled={mutationsDisabled || readFailed}
            onClick={() => {
              setFormOpen(true)
              write.openModal()
            }}
          >
            {config?.hasApiKey ? '更换配置' : '配置服务商'}
          </Button>
        </Space>
      }
    >
      {query.error ? (
        <ErrorPanel error={query.error as Error} onRetry={() => void query.refetch()} />
      ) : null}
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
      {query.isFetching && !config ? (
        <Typography.Text type="secondary">加载中…</Typography.Text>
      ) : null}
      {config ? (
        <>
          <Space align="center" style={{ marginBottom: spacing.sm }}>
            <ProviderStatusTag value={config.displayStatus} />
            <Typography.Text type="secondary">{STATUS_HELP[config.displayStatus]}</Typography.Text>
          </Space>
          {config.envFallbackActive ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: spacing.md }}
              message="尚未建立数据库配置。当前请求仍可能使用服务端环境变量，直到在此保存或停用。"
            />
          ) : null}
          <Descriptions size="small" column={2}>
            <Descriptions.Item label="协议">{config.protocol ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="模型">{config.model ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="接口地址" span={2}>
              {config.baseUrl ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label="API Key">
              {config.hasApiKey ? (config.apiKeyHint ?? '已配置') : '未配置'}
            </Descriptions.Item>
            <Descriptions.Item label="配置版本">v{config.version}</Descriptions.Item>
            <Descriptions.Item label="最后更新">
              {formatDateTime(config.updatedAt)}
            </Descriptions.Item>
            <Descriptions.Item label="计费模型">
              {config.billedModel ?? '未发布价格'}
            </Descriptions.Item>
          </Descriptions>
          {config.billedModel ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginTop: spacing.md }}
              message={`当前计费请求使用价格版本中的模型 ${config.billedModel}。修改服务商模型不会改变计费所用模型，如需更换请发布新价格版本。`}
            />
          ) : null}
        </>
      ) : null}
      {query.error && isServerError(query.error) ? (
        <Alert
          type="warning"
          showIcon
          message="配置状态未知，写操作已禁用。"
          style={{ marginTop: spacing.md }}
        />
      ) : null}

      <ReasonActionModal
        open={write.open && formOpen}
        title="保存服务商配置"
        confirmText="保存"
        reasonLabel="变更理由"
        busy={write.busy}
        conflictText={
          write.conflict
            ? `当前配置 v${write.conflict.currentVersion}，最新 v${write.conflict.latestVersion ?? '未知'}。`
            : null
        }
        unknownText={write.unknown}
        rateLimitedText={
          write.rateLimited ? `请 ${Math.ceil(write.remainingMs / 1000)} 秒后再试。` : null
        }
        impact={
          <div>
            <ActionSummary
              items={[
                {
                  label: '协议',
                  value: PROTOCOL_OPTIONS.find((item) => item.value === form.protocol)?.label,
                },
                { label: '模型', value: form.model || '—' },
                { label: '接口地址', value: form.baseUrl || '协议默认地址' },
                { label: 'API Key', value: form.apiKey ? '将写入新密钥' : '留空，保持原密钥' },
              ]}
            />
            <Form layout="vertical" style={{ marginTop: spacing.md }}>
              <Form.Item htmlFor="provider-protocol" label="服务商类型" required>
                <Select
                  id="provider-protocol"
                  value={form.protocol}
                  options={PROTOCOL_OPTIONS}
                  onChange={(value) => {
                    setForm((prev) => ({ ...prev, protocol: value }))
                    setDraftTest(null)
                  }}
                />
              </Form.Item>
              <Form.Item
                htmlFor="provider-base-url"
                label="接口地址"
                extra="留空使用协议默认地址。不要在地址中填写密钥。"
              >
                <Input
                  id="provider-base-url"
                  value={form.baseUrl}
                  placeholder="https://api.openai.com/v1"
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, baseUrl: event.target.value }))
                    setDraftTest(null)
                  }}
                />
              </Form.Item>
              <Form.Item htmlFor="provider-model" label="模型" required>
                <Input
                  id="provider-model"
                  value={form.model}
                  maxLength={120}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, model: event.target.value }))
                    setDraftTest(null)
                  }}
                />
              </Form.Item>
              <Form.Item
                htmlFor="provider-api-key"
                label="API Key"
                extra={
                  config?.hasApiKey
                    ? '留空表示保持原密钥。更换必须重新输入。'
                    : '首次保存必须填写。'
                }
              >
                <Input.Password
                  id="provider-api-key"
                  value={form.apiKey}
                  placeholder={config?.hasApiKey ? '已配置，留空保持原值' : '不会在浏览器中持久化'}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, apiKey: event.target.value }))
                    setDraftTest(null)
                  }}
                  autoComplete="new-password"
                />
              </Form.Item>
            </Form>
            <Space align="center" wrap>
              <Button onClick={() => void testConnection()} loading={testing} disabled={write.busy}>
                测试连接
              </Button>
              <Typography.Text type="secondary">
                测试可能产生少量服务商费用，且不会保存或开启 AI 服务。
              </Typography.Text>
            </Space>
            {draftTest ? (
              <Alert
                style={{ marginTop: spacing.md }}
                type={draftTest.ok ? 'success' : 'error'}
                showIcon
                message={draftTest.message}
              />
            ) : null}
          </div>
        }
        onSubmit={(reason) => void submitSave(reason)}
        onViewLatest={() => void viewLatest()}
        onQueryResult={() => void queryUnknown()}
        onCancel={() => {
          write.closeModal()
          if (!write.unknown && !write.conflict) {
setFormOpen(false)
}
        }}
      />
      <ReasonActionModal
        open={write.open && disableOpen}
        title="停用服务商配置"
        confirmText="确认停用"
        reasonLabel="停用原因"
        danger
        busy={write.busy}
        conflictText={
          write.conflict
            ? `当前配置 v${write.conflict.currentVersion}，最新 v${write.conflict.latestVersion ?? '未知'}。`
            : null
        }
        unknownText={write.unknown}
        rateLimitedText={
          write.rateLimited ? `请 ${Math.ceil(write.remainingMs / 1000)} 秒后再试。` : null
        }
        impact={
          <Typography.Paragraph>
            停用后新的 AI
            请求会在预扣积分前失败，且不会自动回退到环境变量。尚未执行的排队请求会失败并退回冻结积分；已经开始调用服务商的请求继续使用开始时的配置。
          </Typography.Paragraph>
        }
        onSubmit={(reason) => void submitDisable(reason)}
        onViewLatest={() => void viewLatest()}
        onQueryResult={() => void queryUnknown()}
        onCancel={() => {
          write.closeModal()
          if (!write.unknown && !write.conflict) {
setDisableOpen(false)
}
        }}
      />
    </Card>
  )
}
