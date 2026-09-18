import { ExclamationCircleFilled } from '@ant-design/icons'
import { Button, Card, Col, Row, Space, Typography } from 'antd'
import { history } from '@umijs/max'
import { useQuery } from '@tanstack/react-query'
import { mistLightColors, radii, spacing, typography } from '@studycommit/design-tokens'
import { AdminPage } from '@/components/AdminPage'
import { ErrorPanel } from '@/components/PageState'
import { adminApi } from '@/services/admin-api'
import type { Overview } from '@/services/types'
import { formatCost, formatCredits, formatDateTime, percent } from '@/utils/format'

export default function DashboardPage() {
  const query = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => adminApi.overview(),
  })
  const data = query.data

  return (
    <AdminPage
      title="运营概览"
      description={
        data ? (
          <Space>
            <span>{formatDateTime(data.serverNow, 'YYYY年M月D日 HH:mm')}</span>
            <Button type="link" onClick={() => void query.refetch()} loading={query.isFetching}>
              刷新
            </Button>
          </Space>
        ) : (
          '待处理事项优先，数据以服务端为准。'
        )
      }
    >
      {query.error ? (
        <ErrorPanel error={query.error as Error} onRetry={() => void query.refetch()} />
      ) : null}
      {query.isLoading ? (
        <Card loading />
      ) : data ? (
        <Space direction="vertical" size={spacing.md} style={{ width: '100%' }}>
          <PendingStrip data={data} />
          <Row gutter={[spacing.md, spacing.md]} align="stretch">
            <Col xs={24} lg={16}>
              <CostCard data={data} />
            </Col>
            <Col xs={24} lg={8}>
              <ServiceCard data={data} />
            </Col>
            <Col xs={24} md={12}>
              <Card
                title="今日运行"
                extra={
                  <Button type="link" onClick={() => history.push('/runs')}>
                    查看
                  </Button>
                }
              >
                <Row gutter={spacing.md}>
                  <Col span={8}>
                    <StatBlock label="成功" value={data.ai.runs.completedToday} />
                  </Col>
                  <Col span={8}>
                    <StatBlock
                      label="失败"
                      value={data.ai.runs.failedToday}
                      color={data.ai.runs.failedToday ? mistLightColors.danger : undefined}
                    />
                  </Col>
                  <Col span={8}>
                    <StatBlock label="待完成" value={data.ai.runs.pending} />
                  </Col>
                </Row>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card
                title="活动发放"
                extra={
                  <Button type="link" onClick={() => history.push('/campaigns')}>
                    查看
                  </Button>
                }
              >
                <Row gutter={spacing.md}>
                  <Col span={6}>
                    <StatBlock
                      label="已发布"
                      value={data.campaigns.publishedCount}
                      suffix="个活动"
                    />
                  </Col>
                  <Col span={6}>
                    <StatBlock
                      label="累计发放"
                      value={formatCredits(data.campaigns.totalGrantedCredits)}
                    />
                  </Col>
                  <Col span={6}>
                    <StatBlock
                      label="累计领取"
                      value={formatCredits(data.campaigns.totalClaimCount)}
                      suffix="次"
                    />
                  </Col>
                  <Col span={6}>
                    <StatBlock
                      label="全局冻结"
                      value={formatCredits(data.credits.reservedTotal)}
                      color={data.credits.reservedTotal ? mistLightColors.danger : undefined}
                    />
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>
          <Typography.Paragraph type="secondary">数据以服务端为准。</Typography.Paragraph>
        </Space>
      ) : null}
    </AdminPage>
  )
}

function PendingStrip({ data }: { data: Overview }) {
  return (
    <div
      style={{
        background: mistLightColors.warningSurface,
        borderRadius: radii.md,
        padding: `${spacing.md}px ${spacing.lg}px`,
        display: 'flex',
        alignItems: 'center',
        gap: spacing.lg,
        flexWrap: 'wrap',
      }}
    >
      <Space size={spacing.sm}>
        <ExclamationCircleFilled style={{ color: mistLightColors.warning, fontSize: 28 }} />
        <Typography.Text strong style={{ fontSize: typography.subheading.fontSize }}>
          待处理事项
        </Typography.Text>
      </Space>
      <Button type="link" onClick={() => history.push('/runs')} style={{ paddingInline: 0 }}>
        <StatBlock
          label="超期冻结"
          value={data.ai.runs.longFrozen}
          color={mistLightColors.warning}
          compact
        />
      </Button>
      <Button type="link" onClick={() => history.push('/campaigns')} style={{ paddingInline: 0 }}>
        <StatBlock
          label="待补偿领取"
          value={data.credits.pendingCompensationCount}
          color={mistLightColors.warning}
          compact
        />
      </Button>
      <div style={{ marginLeft: 'auto' }}>
        <Space wrap>
          <Button onClick={() => history.push('/runs')}>查看对账</Button>
          <Button type="primary" onClick={() => history.push('/campaigns')}>
            查看活动
          </Button>
        </Space>
      </div>
    </div>
  )
}

function CostCard({ data }: { data: Overview }) {
  const confirmed = Number(data.ai.cost.confirmedToday)
  const reserved = Number(data.ai.cost.reservedToday)
  const budget = data.ai.cost.dailyBudget === null ? null : Number(data.ai.cost.dailyBudget)
  const used = confirmed + reserved
  const remaining = budget === null ? null : Math.max(0, budget - used)
  const confirmedPct = budget ? percent(confirmed, budget) : 0
  const reservedPct = budget ? percent(reserved, budget) : 0

  return (
    <Card title="今日 AI 成本" style={{ height: '100%' }}>
      <Row gutter={spacing.md}>
        <Col span={8}>
          <StatBlock label="已确认消费" value={formatCost(data.ai.cost.confirmedToday)} large />
        </Col>
        <Col span={8}>
          <StatBlock label="已预留额度" value={formatCost(data.ai.cost.reservedToday)} large />
        </Col>
        <Col span={8}>
          <StatBlock
            label="每日额度上限"
            value={budget === null ? '未设置' : formatCost(data.ai.cost.dailyBudget)}
            large
          />
        </Col>
      </Row>
      {budget === null ? (
        <Typography.Paragraph type="secondary" style={{ marginTop: spacing.md }}>
          未设置每日成本预算。开启计费前须先设置预算并发布价格。
        </Typography.Paragraph>
      ) : budget === 0 ? (
        <Typography.Paragraph type="warning" style={{ marginTop: spacing.md }}>
          每日预算为 0，当前无可用额度。
        </Typography.Paragraph>
      ) : (
        <div style={{ marginTop: spacing.md }}>
          <div
            style={{
              display: 'flex',
              height: 10,
              borderRadius: radii.pill,
              overflow: 'hidden',
              background: mistLightColors.border,
            }}
          >
            <div style={{ width: `${confirmedPct}%`, background: mistLightColors.primary }} />
            <div style={{ width: `${reservedPct}%`, background: mistLightColors.borderStrong }} />
          </div>
          <div style={{ marginTop: spacing.sm, color: mistLightColors.textMuted }}>
            已使用 {percent(used, budget)}%
          </div>
          <Space size="large" wrap style={{ marginTop: spacing.sm }}>
            <span>
              <span style={{ color: mistLightColors.primary }}>●</span> 已确认消费（{confirmedPct}
              %）
            </span>
            <span>
              <span style={{ color: mistLightColors.borderStrong }}>●</span> 已预留额度（
              {reservedPct}%）
            </span>
            <span>剩余额度：{formatCost(remaining ?? 0)}</span>
          </Space>
        </div>
      )}
    </Card>
  )
}

function ServiceCard({ data }: { data: Overview }) {
  return (
    <Card title="服务状态" style={{ height: '100%' }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <ServiceRow
          title={data.ai.enabled ? 'AI 服务已开启' : 'AI 服务已关闭'}
          hint={data.ai.enabled ? '已开启' : '关闭后不受理新的付费运行'}
        />
        <ServiceRow
          title={
            data.ai.activePriceVersion ? `价格 v${data.ai.activePriceVersion}` : '尚未发布价格'
          }
          hint={data.ai.activePriceVersion ? '当前生效价格' : '开启计费前须先发布价格'}
        />
        <ServiceRow title="成本保护" hint="达到上限时停止新受理" />
      </Space>
    </Card>
  )
}

function ServiceRow({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <Typography.Text strong>{title}</Typography.Text>
      <div>
        <Typography.Text type="secondary">{hint}</Typography.Text>
      </div>
    </div>
  )
}

function StatBlock({
  label,
  value,
  suffix,
  color,
  large,
  compact,
}: {
  label: string
  value: string | number
  suffix?: string
  color?: string
  large?: boolean
  compact?: boolean
}) {
  return (
    <div>
      <div style={{ color: mistLightColors.textMuted, fontSize: typography.caption.fontSize }}>
        {label}
      </div>
      <div
        className="tabular-nums"
        style={{
          color: color ?? mistLightColors.text,
          fontSize: large
            ? typography.display.fontSize
            : compact
              ? typography.title.fontSize
              : typography.heading.fontSize,
          lineHeight: large
            ? `${typography.display.lineHeight}px`
            : `${typography.heading.lineHeight}px`,
          fontWeight: 600,
        }}
      >
        {value}
        {suffix ? (
          <Typography.Text
            type="secondary"
            style={{ marginLeft: spacing.xs, fontSize: 14, fontWeight: 400 }}
          >
            {suffix}
          </Typography.Text>
        ) : null}
      </div>
    </div>
  )
}
