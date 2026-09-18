import { spacing } from '@studycommit/design-tokens'
import { Button, Empty, Space, Table, Typography } from 'antd'
import type { ColumnsType, TableProps } from 'antd/es/table'

export function CursorTable<T extends object>({
  columns,
  dataSource,
  loading,
  rowKey,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  emptyText,
  onRow,
  scrollX = true,
}: {
  columns: ColumnsType<T>
  dataSource: T[]
  loading?: boolean
  rowKey: TableProps<T>['rowKey']
  hasPrev: boolean
  hasNext: boolean
  onPrev: () => void
  onNext: () => void
  emptyText?: string
  onRow?: TableProps<T>['onRow']
  scrollX?: boolean
}) {
  return (
    <div className="admin-cursor-table">
      <Table<T>
        columns={columns}
        dataSource={dataSource}
        loading={loading}
        rowKey={rowKey}
        pagination={false}
        onRow={onRow}
        scroll={scrollX ? { x: 'max-content' } : undefined}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={emptyText ?? '没有符合条件的结果'}
            />
          ),
        }}
      />
      <div
        className="admin-table-footer"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: spacing.smPlus,
          gap: spacing.smPlus,
          flexWrap: 'wrap',
        }}
      >
        <Typography.Text type="secondary">本次加载 {dataSource.length} 条</Typography.Text>
        <Space>
          <Button disabled={!hasPrev || loading} onClick={onPrev}>
            上一页
          </Button>
          <Button type="primary" ghost disabled={!hasNext || loading} onClick={onNext}>
            下一页
          </Button>
        </Space>
      </div>
    </div>
  )
}
