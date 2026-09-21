import { useState } from 'react'
import type { Key } from 'react'
import { useQuery } from '@tanstack/react-query'
import { history, useAccess } from '@umijs/max'
import { App, Button, Card, Input, Select, Space, Table, Tabs, Tag } from 'antd'
import { EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { AdminPage } from '@/components/AdminPage'
import { ErrorPanel } from '@/components/PageState'
import { artworkApi, artworkImage, type Artwork } from '@/services/artworks'
import './artworks.css'
export const artworkStatus = { draft: '草稿', published: '已发布', retired: '已下架' }
export default function ArtworksPage() {
  const access = useAccess()
  const { message } = App.useApp()
  const query = useQuery({ queryKey: ['artworks'], queryFn: artworkApi.list })
  const [status, setStatus] = useState('all'),
    [search, setSearch] = useState(''),
    [style, setStyle] = useState<string>()
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Key[]>([])
  const [dragged, setDragged] = useState<Artwork>()
  const all = query.data?.items ?? []
  const rows = all.filter(
    (a) =>
      (status === 'all' || a.status === status) &&
      (!style || a.style === style) &&
      a.title.toLowerCase().includes(search.trim().toLowerCase()),
  )
  return (
    <AdminPage
      title="画作管理"
      description="管理学习画册中的每一幅风景"
      extra={
        access.canManageDraft && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => history.push('/artworks/new')}
          >
            新建画作
          </Button>
        )
      }
    >
      {query.error && <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />}
      <Card className="admin-ledger-panel artwork-list">
        <div className="artwork-toolbar">
          <Tabs
            activeKey={status}
            onChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
            items={[['all', '全部'], ...Object.entries(artworkStatus)].map(([key, label]) => ({
              key,
              label: `${label} ${key === 'all' ? all.length : all.filter((a) => a.status === key).length}`,
            }))}
          />
          <Space wrap>
            {access.canPublish && selected.length > 0 && (
              <Button
                onClick={async () => {
                  const targets = all.filter(
                    (item) => selected.includes(item.id) && item.status === 'draft',
                  )
                  for (const item of targets) {
await artworkApi.transition(item, 'published', '批量发布')
}
                  setSelected([])
                  await query.refetch()
                  void message.success(`已发布 ${targets.length} 幅画作`)
                }}
              >
                批量发布
              </Button>
            )}
            <Input
              aria-label="搜索画作名称"
              placeholder="搜索画作名称"
              prefix={<SearchOutlined />}
              allowClear
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
            <Select
              aria-label="筛选风格"
              placeholder="全部风格"
              allowClear
              value={style}
              onChange={(v) => {
                setStyle(v)
                setPage(1)
              }}
              style={{ minWidth: 130 }}
              options={[...new Set(all.map((a) => a.style))].map((v) => ({ label: v, value: v }))}
            />
          </Space>
        </div>
        <Table<Artwork>
          rowKey="id"
          loading={query.isLoading}
          dataSource={rows}
          rowSelection={{ selectedRowKeys: selected, onChange: setSelected }}
          onRow={(record) => ({
            draggable: access.canManageDraft && record.status !== 'published',
            onDragStart: () => setDragged(record),
            onDragOver: (event) => event.preventDefault(),
            onDrop: async () => {
              if (
                !dragged ||
                dragged.id === record.id ||
                dragged.status === 'published' ||
                record.status === 'published'
              ) {
return
}
              await Promise.all([
                artworkApi.save({ ...dragged, sortOrder: record.sortOrder }, dragged),
                artworkApi.save({ ...record, sortOrder: dragged.sortOrder }, record),
              ])
              setDragged(undefined)
              await query.refetch()
              void message.success('画作顺序已更新')
            },
          })}
          scroll={{ x: 840 }}
          locale={{ emptyText: '没有符合条件的画作' }}
          pagination={{
            current: page,
            pageSize: 5,
            showSizeChanger: false,
            onChange: setPage,
            showTotal: (total) => `共 ${total} 幅画作`,
          }}
          columns={[
            {
              title: '画作',
              key: 'art',
              render: (_, a) => (
                <button className="artwork-row" onClick={() => history.push(`/artworks/${a.id}`)}>
                  <img src={artworkImage(a.assetKey)} alt="" />
                  <strong>{a.title}</strong>
                </button>
              ),
            },
            { title: '风格', dataIndex: 'style' },
            { title: '拼图规格', render: () => '12 块' },
            { title: '版本', render: (_, a) => `v${a.version}` },
            {
              title: '状态',
              render: (_, a) => (
                <Tag color={a.status === 'published' ? 'success' : undefined}>
                  {artworkStatus[a.status]}
                </Tag>
              ),
            },
            {
              title: '操作',
              render: (_, a) => (
                <Space>
                  <Button
                    type="link"
                    icon={<EditOutlined />}
                    onClick={() => history.push(`/artworks/${a.id}`)}
                  >
                    {access.canManageDraft ? '编辑' : '查看'}
                  </Button>
                  {access.canManageDraft && (
                    <Button
                      type="link"
                      onClick={async () => {
                        const copy = await artworkApi.save({
                          title: `${a.title}副本`,
                          description: a.description,
                          style: a.style,
                          assetKey: a.assetKey,
                          sortOrder: a.sortOrder + 1,
                        })
                        await query.refetch()
                        history.push(`/artworks/${copy.id}`)
                      }}
                    >
                      复制
                    </Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </AdminPage>
  )
}
