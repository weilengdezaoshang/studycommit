import { spacing } from '@studycommit/design-tokens'
import { Alert, Button, Empty, Skeleton, Space } from 'antd'
import { AdminApiError } from '@/services/api-client'

export function PageState({
  loading,
  error,
  empty,
  emptyTitle = '暂无数据',
  emptyDescription,
  emptyAction,
  onRetry,
  children,
  keepChrome,
}: {
  loading?: boolean
  error?: Error | null
  empty?: boolean
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: React.ReactNode
  onRetry?: () => void
  children?: React.ReactNode
  keepChrome?: React.ReactNode
}) {
  if (loading && !keepChrome) {
    return <Skeleton active paragraph={{ rows: 6 }} />
  }

  if (error && !keepChrome) {
    return <ErrorPanel error={error} onRetry={onRetry} />
  }

  return (
    <div>
      {error ? <ErrorPanel error={error} onRetry={onRetry} /> : null}
      {keepChrome}
      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} style={{ marginTop: spacing.md }} />
      ) : null}
      {!loading && empty ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyTitle}>
          {emptyDescription ? (
            <div style={{ color: 'var(--sc-muted)', marginBottom: spacing.smPlus }}>
              {emptyDescription}
            </div>
          ) : null}
          {emptyAction}
        </Empty>
      ) : null}
      {!loading && !empty ? children : null}
    </div>
  )
}

export function ErrorPanel({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const api = error instanceof AdminApiError ? error : null
  const rateLimited = api?.status === 429
  const title = rateLimited ? '操作过于频繁' : api?.status === 403 ? '没有权限' : '暂时无法加载'
  const description = rateLimited
    ? api.retryAfterMs
      ? `请稍后 ${Math.ceil(api.retryAfterMs / 1000)} 秒再试。`
      : '请稍后再试。'
    : error.message
  return (
    <Alert
      type={rateLimited ? 'warning' : 'error'}
      showIcon
      style={{ marginBottom: spacing.md }}
      message={title}
      description={
        <Space direction="vertical" size={8}>
          <span>{description}</span>
          {api?.requestId ? <span>请求编号 {api.requestId}</span> : null}
          {onRetry ? (
            <Button size="small" onClick={onRetry}>
              重试
            </Button>
          ) : null}
        </Space>
      }
    />
  )
}
