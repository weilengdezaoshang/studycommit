import { spacing } from '@studycommit/design-tokens'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Row,
  Skeleton,
  Space,
  Switch,
  Table,
  Typography,
} from 'antd'
import { useAccess } from '@umijs/max'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { AdminPage } from '@/components/AdminPage'
import { ErrorPanel } from '@/components/PageState'
import { ReasonActionModal } from '@/components/ReasonActionModal'
import { useWriteAction } from '@/hooks/use-write-action'
import { adminApi } from '@/services/admin-api'
import { queryClient } from '@/services/query-client'
import { isForbidden, isServerError } from '@/services/api-client'
import type { AiPrice, AiServiceConfig } from '@/services/types'
import { matchesConfigPatch, matchesPrice, type ConfigPatch } from '@/utils/confirmed-state'
import { COST_PATTERN, isValidBudget, isValidCost } from '@/utils/decimal'
import { formatCost, formatCredits, formatDateTime } from '@/utils/format'
import { ProviderConfigCard } from './ProviderConfigCard'
import ForbiddenPage from '../403'

type SwitchKey = 'aiEnabled' | 'paper_explain' | 'costProtectionEnabled'

export default function PricingPage() {
  const access = useAccess()
  const { message } = App.useApp()
  const configQuery = useQuery({
    queryKey: ['admin', 'ai-config'],
    queryFn: () => adminApi.getAiConfig(),
  })
  const priceQuery = useQuery({
    queryKey: ['admin', 'ai-prices'],
    queryFn: () => adminApi.listPrices(),
  })
  const write = useWriteAction(configQuery.data?.version ?? null)
  const pendingPatch = useRef<ConfigPatch | null>(null)
  const config = isForbidden(configQuery.error) ? undefined : configQuery.data
  const prices = priceQuery.error ? [] : (priceQuery.data?.items ?? [])
  const activePrice = prices.find((item) => item.isActive) ?? null
  const loading = configQuery.isLoading
  const configUnknown = Boolean(configQuery.error) || loading || !config
  const readFailed = Boolean(configQuery.error || priceQuery.error)
  const stale = Boolean(configQuery.error && config && isServerError(configQuery.error))
  const mutationsDisabled =
    write.writesLocked || readFailed || loading || stale || Boolean(write.conflict)

  const [pendingSwitch, setPendingSwitch] = useState<{ key: SwitchKey; value: boolean } | null>(
    null,
  )
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const [initialModel, setInitialModel] = useState('')
  const pendingPrice = useRef<{
    value: Pick<AiPrice, 'action' | 'priceCredits' | 'configSnapshot'>
    knownIds: Set<string>
  } | null>(null)
  const [priceForm, setPriceForm] = useState({
    priceCredits: null as number | null,
    estimatedCostPerRun: '',
    maxInputTokens: activePrice?.configSnapshot.maxInputTokens ?? 20000,
    maxOutputTokens: activePrice?.configSnapshot.maxOutputTokens ?? 4000,
  })

  const switchImpact = useMemo(() => {
    if (!pendingSwitch) {
return null
}
    if (pendingSwitch.key === 'aiEnabled' && pendingSwitch.value) {
      if (configUnknown) {
return '配置状态未知，不能开启。'
}
      if (!activePrice) {
return '尚未发布价格，禁止开启计费。'
}
      if (!config?.dailyCostBudget) {
return '未设置每日成本预算，禁止开启计费。'
}
    }
    if (pendingSwitch.key === 'aiEnabled') {
      return pendingSwitch.value
        ? '开启后将按当前生效价格受理新的付费运行。'
        : '关闭仅阻止新受理，已受理任务按既定规则处理。'
    }
    if (pendingSwitch.key === 'paper_explain') {
      return pendingSwitch.value ? '开启论文解读。' : '关闭论文解读，仅阻止新受理。'
    }
    return pendingSwitch.value
      ? '开启成本保护：达到上限时停止新受理。'
      : '关闭成本保护后不再按预算自动停止新受理。'
  }, [activePrice, config?.dailyCostBudget, configUnknown, pendingSwitch])

  if (isForbidden(configQuery.error)) {
    return <ForbiddenPage />
  }

  const submitConfig = async (
    patch: Partial<
      Pick<
        AiServiceConfig,
        'aiEnabled' | 'featureFlags' | 'costProtectionEnabled' | 'dailyCostBudget'
      >
    >,
    reason: string,
  ) => {
    if (mutationsDisabled || !write.canSubmit) {
return
}
    pendingPrice.current = null
    const expectedVersion = write.expectedVersion()
    if (expectedVersion === null) {
      void message.error('配置版本未知，无法提交')
      return
    }
    pendingPatch.current = patch
    const result = await write.run(() =>
      adminApi.updateAiConfig({
        expectedVersion,
        ...patch,
        reason,
      }),
    )
    if (result.status === 'ok') {
      void message.success('已更新')
      setPendingSwitch(null)
      setBudgetOpen(false)
      void configQuery.refetch()
      return
    }
    if (result.status === 'conflict') {
      const latest = await adminApi.getAiConfig().catch(() => null)
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

  const publish = async (reason: string) => {
    if (mutationsDisabled || !write.canSubmit) {
return
}
    if (
      priceForm.priceCredits === null ||
      !Number.isInteger(priceForm.priceCredits) ||
      priceForm.priceCredits < 0 ||
      priceForm.priceCredits > 1_000_000
    ) {
      void message.error('价格须为 0 到 1000000 的整数')
      return
    }
    if (!isValidCost(priceForm.estimatedCostPerRun)) {
      void message.error('成本估算须为最多 6 位小数的数字字符串')
      return
    }
    if (
      !Number.isInteger(priceForm.maxInputTokens) ||
      priceForm.maxInputTokens < 1 ||
      priceForm.maxInputTokens > 1_000_000
    ) {
      void message.error('最大输入 tokens 须为 1 到 1000000 的整数')
      return
    }
    if (
      !Number.isInteger(priceForm.maxOutputTokens) ||
      priceForm.maxOutputTokens < 1 ||
      priceForm.maxOutputTokens > 1_000_000
    ) {
      void message.error('最大输出 tokens 须为 1 到 1000000 的整数')
      return
    }
    const model = (activePrice?.configSnapshot.model ?? initialModel).trim()
    if (!model || model.length > 120) {
      void message.error('请填写已批准的模型标识（1–120 字）')
      return
    }
    const value = {
      action: 'paper_explain' as const,
      priceCredits: priceForm.priceCredits,
      configSnapshot: {
        model,
        maxInputTokens: priceForm.maxInputTokens,
        maxOutputTokens: priceForm.maxOutputTokens,
        estimatedCostPerRun: priceForm.estimatedCostPerRun.trim(),
        currency: 'CNY',
      },
    }
    pendingPatch.current = null
    pendingPrice.current = { value, knownIds: new Set(prices.map((item) => item.id)) }
    const result = await write.run(() => adminApi.publishPrice({ ...value, reason }))
    if (result.status === 'ok') {
      void message.success('新价格版本已发布并立即生效')
      setPublishOpen(false)
      void priceQuery.refetch()
      return
    }
    if (result.status === 'unknown' || result.status === 'rate_limited') {
return
}
    if (result.status !== 'failed' || result.error.code !== 'WRITE_LOCKED') {
      void message.error(result.error.message)
    }
  }

  const switchBlocked =
    pendingSwitch?.key === 'aiEnabled' &&
    pendingSwitch.value &&
    (configUnknown || !activePrice || !config?.dailyCostBudget)

  const queryConfigUnknown = async () => {
    const outcome = await write.queryUnknown(async () => {
      if (pendingPrice.current) {
        const latest = await adminApi.listPrices()
        const pending = pendingPrice.current
        if (
          !latest.items.some(
            (item) => !pending.knownIds.has(item.id) && matchesPrice(item, pending.value),
          )
        ) {
return 'unresolved'
}
        queryClient.setQueryData(['admin', 'ai-prices'], latest)
      } else if (pendingPatch.current) {
        const latest = await adminApi.getAiConfig()
        if (!matchesConfigPatch(latest, pendingPatch.current)) {
return 'unresolved'
}
        queryClient.setQueryData(['admin', 'ai-config'], latest)
      } else {
return 'unresolved'
}
      return 'confirmed'
    }, '尚未查询到与本次提交一致的结果，请稍后再查或核对审计日志，不要重复提交。')
    if (outcome === 'confirmed') {
      setPendingSwitch(null)
      setBudgetOpen(false)
      setPublishOpen(false)
      pendingPatch.current = null
      pendingPrice.current = null
      void message.info('当前数据已符合本次提交目标')
    }
  }
  const viewLatestConfig = async () => {
    try {
      const latest = await adminApi.getAiConfig()
      queryClient.setQueryData(['admin', 'ai-config'], latest)
      write.applyLatestVersion(latest.version)
      write.closeModal()
      setPendingSwitch(null)
      setBudgetOpen(false)
      void message.info('已加载最新配置，请检查后重新确认操作')
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '读取失败')
    }
  }

  return (
    <AdminPage
      title="AI 定价与开关"
      description={
        config ? (
          <Space>
            <span>配置版本 v{config.version}</span>
            <span>价格版本 {activePrice ? `v${activePrice.version}` : '未发布'}</span>
            <Button type="link" onClick={() => void configQuery.refetch()}>
              刷新
            </Button>
          </Space>
        ) : (
          '服务总开关、功能、成本保护与价格版本分开管理。'
        )
      }
    >
      {configQuery.error ? (
        <ErrorPanel error={configQuery.error as Error} onRetry={() => void configQuery.refetch()} />
      ) : null}
      {write.unknown ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: spacing.md }}
          message="操作结果待确认"
          description={write.unknown}
          action={
            <Button onClick={queryConfigUnknown} loading={write.busy}>
              查询结果
            </Button>
          }
        />
      ) : null}
      <div style={{ marginBottom: spacing.md }}>
        <ProviderConfigCard />
      </div>
      <Row gutter={[spacing.md, spacing.md]}>
        <Col xs={24} lg={10}>
          <Card className="admin-setting-card" title="服务开关">
            {loading ? <Skeleton active paragraph={{ rows: 4 }} /> : null}
            {!loading && configUnknown ? (
              <Alert
                type="warning"
                showIcon
                message="配置状态未知，开关已禁用。"
                style={{ marginBottom: spacing.md }}
              />
            ) : null}
            {!loading ? (
              <>
                <SwitchRow
                  label="AI 服务"
                  description="提供 AI 相关功能服务"
                  checked={config?.aiEnabled ?? false}
                  unknown={configUnknown}
                  disabled={!access.canUpdateSwitch || mutationsDisabled}
                  onToggle={(value) => {
                    setPendingSwitch({ key: 'aiEnabled', value })
                    write.openModal()
                  }}
                />
                <SwitchRow
                  label="论文解读"
                  description="论文解读功能"
                  checked={config?.featureFlags?.paper_explain ?? false}
                  unknown={configUnknown}
                  disabled={!access.canUpdateSwitch || mutationsDisabled}
                  onToggle={(value) => {
                    setPendingSwitch({ key: 'paper_explain', value })
                    write.openModal()
                  }}
                />
                <SwitchRow
                  label="成本保护"
                  description="达到上限时停止新受理"
                  checked={config?.costProtectionEnabled ?? false}
                  unknown={configUnknown}
                  disabled={!access.canUpdateSwitch || mutationsDisabled}
                  onToggle={(value) => {
                    setPendingSwitch({ key: 'costProtectionEnabled', value })
                    write.openModal()
                  }}
                />
              </>
            ) : null}
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card className="admin-setting-card" title="预算设置">
            {loading ? (
              <Skeleton active />
            ) : (
              <>
                <Space align="end" wrap>
                  <div>
                    <div>每日预算上限</div>
                    <Input
                      value={budgetInput || config?.dailyCostBudget || ''}
                      onChange={(event) => setBudgetInput(event.target.value)}
                      addonBefore="¥"
                      style={{ width: 240 }}
                      disabled={mutationsDisabled || !access.canUpdateSwitch}
                      placeholder="例如 500.0000"
                    />
                  </div>
                  {access.canUpdateSwitch ? (
                    <Button
                      type="primary"
                      disabled={mutationsDisabled}
                      onClick={() => {
                        setBudgetOpen(true)
                        write.openModal()
                      }}
                    >
                      保存预算
                    </Button>
                  ) : null}
                </Space>
                <Descriptions size="small" column={2} style={{ marginTop: spacing.md }}>
                  <Descriptions.Item label="配置版本">v{config?.version ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="价格版本">
                    {activePrice ? `v${activePrice.version}` : '未发布'}
                  </Descriptions.Item>
                </Descriptions>
              </>
            )}
          </Card>
        </Col>
      </Row>
      <Card
        className="admin-ledger-panel admin-pricing-history"
        title="价格配置历史"
        style={{ marginTop: spacing.md }}
        extra={
          access.canPublishPrice ? (
            <Button
              type="primary"
              disabled={mutationsDisabled || priceQuery.isLoading}
              onClick={() => {
                setPriceForm((prev) => ({
                  ...prev,
                  maxInputTokens: activePrice?.configSnapshot.maxInputTokens ?? prev.maxInputTokens,
                  maxOutputTokens:
                    activePrice?.configSnapshot.maxOutputTokens ?? prev.maxOutputTokens,
                }))
                setPublishOpen(true)
                write.openModal()
              }}
            >
              发布新价格
            </Button>
          ) : null
        }
      >
        {priceQuery.error ? (
          <ErrorPanel error={priceQuery.error as Error} onRetry={() => void priceQuery.refetch()} />
        ) : null}
        <Table<AiPrice>
          rowKey="id"
          pagination={prices.length > 10 ? { pageSize: 10 } : false}
          dataSource={prices}
          columns={[
            { title: '版本', dataIndex: 'version', render: (value: number) => `v${value}` },
            { title: '动作', dataIndex: 'action' },
            {
              title: '积分价格',
              dataIndex: 'priceCredits',
              render: (value: number) => `${formatCredits(value)} 积分`,
            },
            {
              title: '成本估算',
              render: (_, row) =>
                formatCost(row.configSnapshot.estimatedCostPerRun, row.configSnapshot.currency),
            },
            { title: '模型', render: (_, row) => row.configSnapshot.model },
            {
              title: '状态',
              dataIndex: 'isActive',
              render: (active: boolean) => (active ? '生效中' : '已归档'),
            },
            {
              title: '发布时间',
              dataIndex: 'publishedAt',
              render: (value: string | null) => formatDateTime(value),
            },
          ]}
        />
      </Card>
      <ReasonActionModal
        open={write.open && Boolean(pendingSwitch)}
        title="确认修改服务开关"
        confirmText="确认"
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
            <Typography.Paragraph>{switchImpact}</Typography.Paragraph>
            {switchBlocked ? <Alert type="error" message="当前条件不允许开启。" /> : null}
          </div>
        }
        onSubmit={(reason) => {
          if (!pendingSwitch || switchBlocked) {
return
}
          const patch =
            pendingSwitch.key === 'paper_explain'
              ? {
                  featureFlags: {
                    ...(config?.featureFlags ?? {}),
                    paper_explain: pendingSwitch.value,
                  },
                }
              : pendingSwitch.key === 'aiEnabled'
                ? { aiEnabled: pendingSwitch.value }
                : { costProtectionEnabled: pendingSwitch.value }
          void submitConfig(patch, reason)
        }}
        onViewLatest={() => void viewLatestConfig()}
        onQueryResult={queryConfigUnknown}
        onCancel={() => {
          write.closeModal()
          if (!write.unknown && !write.conflict) {
setPendingSwitch(null)
}
        }}
      />
      <ReasonActionModal
        open={write.open && budgetOpen}
        title="保存每日成本预算"
        confirmText="保存预算"
        reasonLabel="设置理由"
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
            预算与价格版本独立。开启计费前必须已设置预算。
          </Typography.Paragraph>
        }
        onSubmit={(reason) => {
          const value = (budgetInput || config?.dailyCostBudget || '').trim()
          if (!isValidBudget(value)) {
            void message.warning('预算须为最多 4 位小数的数字，例如 500.0000')
            return
          }
          void submitConfig({ dailyCostBudget: value }, reason)
        }}
        onViewLatest={() => void viewLatestConfig()}
        onQueryResult={queryConfigUnknown}
        onCancel={() => {
          write.closeModal()
          if (!write.unknown && !write.conflict) {
setBudgetOpen(false)
}
        }}
      />
      <ReasonActionModal
        open={write.open && publishOpen}
        title="发布新价格版本"
        confirmText="确认发布"
        reasonLabel="发布原因"
        busy={write.busy}
        unknownText={write.unknown}
        rateLimitedText={
          write.rateLimited ? `请 ${Math.ceil(write.remainingMs / 1000)} 秒后再试。` : null
        }
        impact={
          <div>
            <Alert
              type="warning"
              showIcon
              message="发布后立即对新请求生效，已受理请求保留原价格。"
              style={{ marginBottom: spacing.md }}
            />
            {priceForm.priceCredits === 0 ? (
              <Alert
                type="error"
                showIcon
                message="零积分价格需要醒目确认：发布后该动作将免费受理。"
                style={{ marginBottom: spacing.md }}
              />
            ) : null}
            <Form layout="vertical">
              <Form.Item label="当前价格">
                {activePrice ? `${activePrice.priceCredits} 积分` : '无'}
              </Form.Item>
              <Form.Item htmlFor="price-credits" label="新价格" required>
                <InputNumber
                  min={0}
                  max={1_000_000}
                  precision={0}
                  step={1}
                  id="price-credits"
                  value={priceForm.priceCredits ?? undefined}
                  onChange={(value) =>
                    setPriceForm((prev) => ({
                      ...prev,
                      priceCredits: typeof value === 'number' ? value : null,
                    }))
                  }
                  addonAfter="积分"
                />
              </Form.Item>
              <Form.Item
                htmlFor="price-cost"
                label="成本估算 (CNY)"
                required
                extra="最多 6 位小数的数字字符串"
              >
                <Input
                  id="price-cost"
                  value={priceForm.estimatedCostPerRun}
                  onChange={(event) =>
                    setPriceForm((prev) => ({ ...prev, estimatedCostPerRun: event.target.value }))
                  }
                  status={
                    priceForm.estimatedCostPerRun &&
                    !COST_PATTERN.test(priceForm.estimatedCostPerRun)
                      ? 'error'
                      : undefined
                  }
                />
              </Form.Item>
              <Form.Item htmlFor="price-model" label="使用模型">
                <Input
                  id="price-model"
                  value={activePrice?.configSnapshot.model ?? initialModel}
                  disabled={Boolean(activePrice)}
                  maxLength={120}
                  placeholder="输入平台已批准的模型标识"
                  onChange={(event) => setInitialModel(event.target.value)}
                />
              </Form.Item>
              <Form.Item htmlFor="price-input-tokens" label="最大输入 tokens">
                <InputNumber
                  min={1}
                  max={1_000_000}
                  precision={0}
                  id="price-input-tokens"
                  value={priceForm.maxInputTokens}
                  onChange={(value) =>
                    setPriceForm((prev) => ({ ...prev, maxInputTokens: value ?? 1 }))
                  }
                />
              </Form.Item>
              <Form.Item htmlFor="price-output-tokens" label="最大输出 tokens">
                <InputNumber
                  min={1}
                  max={1_000_000}
                  precision={0}
                  id="price-output-tokens"
                  value={priceForm.maxOutputTokens}
                  onChange={(value) =>
                    setPriceForm((prev) => ({ ...prev, maxOutputTokens: value ?? 1 }))
                  }
                />
              </Form.Item>
            </Form>
          </div>
        }
        onSubmit={(reason) => void publish(reason)}
        onQueryResult={() => void queryConfigUnknown()}
        onCancel={() => {
          write.closeModal()
          if (!write.unknown) {
setPublishOpen(false)
}
        }}
      />
    </AdminPage>
  )
}

function SwitchRow({
  label,
  description,
  checked,
  unknown,
  disabled,
  onToggle,
}: {
  label: string
  description: string
  checked: boolean
  unknown: boolean
  disabled: boolean
  onToggle: (value: boolean) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: spacing.md,
        marginBottom: spacing.md,
      }}
    >
      <div>
        <Typography.Text strong>{label}</Typography.Text>
        <div>
          <Typography.Text type="secondary">{description}</Typography.Text>
        </div>
      </div>
      <Space>
        <span>{unknown ? '未知' : checked ? '已开启' : '已关闭'}</span>
        <Switch checked={!unknown && checked} disabled={disabled || unknown} onChange={onToggle} />
      </Space>
    </div>
  )
}
