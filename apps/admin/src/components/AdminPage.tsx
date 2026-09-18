import { PageContainer } from '@ant-design/pro-components'
import { Typography } from 'antd'
import { spacing } from '@studycommit/design-tokens'

export function AdminPage({
  title,
  description,
  extra,
  children,
  breadcrumb,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  extra?: React.ReactNode
  children: React.ReactNode
  breadcrumb?: Array<{ title: string; path?: string }>
}) {
  return (
    <PageContainer
      header={{
        title: (
          <Typography.Title level={3} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
        ),
        extra,
        breadcrumb: breadcrumb
          ? {
              items: breadcrumb.map((item) => ({ title: item.title, href: item.path })),
            }
          : undefined,
      }}
      content={
        description ? <div style={{ color: 'var(--sc-muted)' }}>{description}</div> : undefined
      }
      style={{ paddingBlock: 0 }}
    >
      <div className="admin-page-content" style={{ paddingBottom: spacing.lg }}>
        {children}
      </div>
    </PageContainer>
  )
}
