import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { history, useAccess, useParams } from '@umijs/max'
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Upload,
  Modal,
  Segmented,
  Space,
  Spin,
  Tag,
} from 'antd'
import { ArrowLeftOutlined, DeleteOutlined } from '@ant-design/icons'
import { piecePath } from '@studycommit/common/puzzle-runtime'
import { AdminPage } from '@/components/AdminPage'
import { ErrorPanel } from '@/components/PageState'
import { useUnsavedPrompt } from '@/hooks/use-unsaved-prompt'
import { artworkApi, artworkImage, type Artwork, type ArtworkDraft } from '@/services/artworks'
import { artworkStatus } from './index'
import './artworks.css'

export default function ArtworkEditPage() {
  const { id } = useParams<{ id: string }>()
  const access = useAccess(),
    cache = useQueryClient(),
    { message } = App.useApp()
  const list = useQuery({ queryKey: ['artworks'], queryFn: artworkApi.list })
  const assets = useQuery({ queryKey: ['artwork-assets'], queryFn: artworkApi.assets })
  const [current, setCurrent] = useState<Artwork>(),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>(),
    [picker, setPicker] = useState(false),
    [preview, setPreview] = useState('原画')
  const [transition, setTransition] = useState<'published' | 'retired'>(),
    [reason, setReason] = useState('')
  const [uploading, setUploading] = useState(false)
  const [pendingFile, setPendingFile] = useState<File>()
  const [pendingPreview, setPendingPreview] = useState('')
  const [form] = Form.useForm<ArtworkDraft>()
  const assetKey = Form.useWatch('assetKey', form),
    title = Form.useWatch('title', form)
  useUnsavedPrompt(dirty)
  useEffect(() => {
    if (dirty) {
return
}
    if (id && !list.data) {
return
}
    const found = list.data?.items.find((a) => a.id === id)
    setCurrent(found)
    form.setFieldsValue(
      found ?? {
        title: '',
        description: '',
        style: '水彩',
        assetKey: 'spring-rabbit',
        sortOrder: 0,
      },
    )
    setDirty(false)
  }, [id, list.data, form, dirty])
  const editable = access.canManageDraft && current?.status !== 'published'
  const save = async () => {
    let values: ArtworkDraft
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    setBusy(true)
    setError(undefined)
    try {
      const saved = await artworkApi.save(values, current)
      setCurrent(saved)
      setDirty(false)
      cache.setQueryData<{ items: Artwork[] }>(['artworks'], (old) => ({
        items: [...(old?.items ?? []).filter((a) => a.id !== saved.id), saved],
      }))
      void message.success('画作已保存')
      if (!id) {
history.replace(`/artworks/${saved.id}`)
}
    } catch (e) {
      setError(e instanceof Error ? e : new Error('保存失败'))
    } finally {
      setBusy(false)
    }
  }
  const changeStatus = async () => {
    if (!current || !transition || !reason.trim()) {
return
}
    setBusy(true)
    setError(undefined)
    try {
      const saved = await artworkApi.transition(current, transition, reason.trim())
      setCurrent(saved)
      setTransition(undefined)
      setReason('')
      await cache.invalidateQueries({ queryKey: ['artworks'] })
      void message.success(saved.status === 'published' ? '画作已发布' : '画作已下架')
    } catch (e) {
      setError(e instanceof Error ? e : new Error('操作失败'))
    } finally {
      setBusy(false)
    }
  }
  if (id && list.isLoading) {
return <Spin />
}
  if (list.error) {
return <ErrorPanel error={list.error} onRetry={() => void list.refetch()} />
}
  if (id && list.data && !list.data.items.some((a) => a.id === id)) {
return (
      <Alert
        type="error"
        message="画作不存在"
        action={<Button onClick={() => history.push('/artworks')}>返回列表</Button>}
      />
    )
}
  return (
    <AdminPage
      title={
        <Space>
          {title || '新建画作'}
          <Tag>{artworkStatus[current?.status ?? 'draft']}</Tag>
        </Space>
      }
      breadcrumb={[
        { title: '画作管理', path: '/artworks' },
        { title: id ? '编辑画作' : '新建画作' },
      ]}
      extra={
        <Space wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => history.push('/artworks')}>
            返回列表
          </Button>
          {editable && (
            <Button loading={busy} disabled={!dirty && !!current} onClick={() => void save()}>
              {current?.status === 'retired' ? '保存更改' : '保存草稿'}
            </Button>
          )}
          {access.canPublish && (
            <Button
              type="primary"
              disabled={!current || dirty || busy}
              onClick={() =>
                setTransition(current?.status === 'published' ? 'retired' : 'published')
              }
            >
              {current?.status === 'published' ? '下架画作' : '发布画作'}
            </Button>
          )}
        </Space>
      }
    >
      {error && (
        <Alert
          type="error"
          showIcon
          message={error.message}
          style={{ marginBottom: 'var(--sc-space-md)' }}
        />
      )}
      <div className="artwork-editor">
        <Card title="原画预览">
          <Segmented block options={['原画', '拼图预览']} value={preview} onChange={setPreview} />
          {assetKey &&
            (preview === '原画' ? (
              <img
                className="artwork-preview"
                src={artworkImage(assetKey)}
                alt={title || '原画预览'}
              />
            ) : (
              <svg
                className="artwork-preview"
                viewBox="0 0 400 300"
                role="img"
                aria-label="十二块拼图预览"
              >
                <image href={artworkImage(assetKey)} width="400" height="300" />
                <g fill="none" stroke="white" strokeWidth="1.3">
                  {Array.from({ length: 12 }, (_, i) => (
                    <path key={i} d={piecePath(i)} />
                  ))}
                </g>
              </svg>
            ))}
          <div className="artwork-preview-footer">
            <span>原图 · 4:3 · 12 块</span>
            <Button
              type="link"
              disabled={!editable || current?.hasRewards || busy}
              onClick={() => setPicker(true)}
            >
              从素材库选择原画
            </Button>
          </div>
          {current?.hasRewards && (
            <Alert type="info" message="已有用户获得碎片，原图已锁定。使用其他原画请新建画作。" />
          )}
        </Card>
        <div className="artwork-settings">
          <Card title="基本信息">
            <Form
              form={form}
              layout="vertical"
              disabled={!editable || busy}
              onValuesChange={() => setDirty(true)}
            >
              <Form.Item
                name="title"
                label="画作名称"
                rules={[
                  { required: true, whitespace: true, message: '请输入画作名称' },
                  { max: 80 },
                ]}
              >
                <Input maxLength={80} showCount />
              </Form.Item>
              <Form.Item name="description" label="画作简介" rules={[{ max: 240 }]}>
                <Input.TextArea rows={3} maxLength={240} showCount />
              </Form.Item>
              <Form.Item
                name="style"
                label="风格标签"
                rules={[{ required: true, whitespace: true }, { max: 40 }]}
              >
                <Input maxLength={40} />
              </Form.Item>
              <Form.Item name="sortOrder" label="排序" rules={[{ required: true }]}>
                <InputNumber min={0} max={9999} precision={0} />
              </Form.Item>
              <Form.Item name="assetKey" hidden rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Form>
          </Card>
          <Card title="拼图配置">
            <Descriptions
              column={1}
              items={[
                { key: 'pieces', label: '拼图规格', children: '12 块 · 4 列 × 3 行' },
                { key: 'random', label: '碎片发放', children: '随机且不重复' },
                { key: 'version', label: '配置版本', children: `v${current?.version ?? 1}` },
              ]}
            />
          </Card>
          <Alert
            showIcon
            type="info"
            message={
              current?.status === 'published'
                ? '发布中的画作只读；如需编辑，请先下架。'
                : '保存后可发布。下架后停止新用户选择，已获得的碎片会保留。'
            }
          />
        </div>
      </div>
      <Modal
        title="选择原画"
        open={picker}
        onCancel={() => setPicker(false)}
        footer={null}
        width={800}
      >
        {access.canManageDraft && (
          <Upload
            accept="image/png,image/jpeg,image/webp"
            showUploadList={false}
            beforeUpload={(file) => {
              if (pendingPreview) {
URL.revokeObjectURL(pendingPreview)
}
              setPendingFile(file)
              setPendingPreview(URL.createObjectURL(file))
              return false
            }}
          >
            <Button loading={uploading} style={{ marginBottom: 16 }}>
              上传新原画（自动居中裁切 4:3）
            </Button>
          </Upload>
        )}
        {assets.isLoading && <Spin />}
        {assets.error && <ErrorPanel error={assets.error} onRetry={() => void assets.refetch()} />}
        <div className="artwork-assets">
          {assets.data?.items.map((asset) => (
            <div key={asset.key} className="artwork-asset" data-selected={assetKey === asset.key}>
              <button
                aria-pressed={assetKey === asset.key}
                onClick={() => {
                  form.setFieldsValue({
                    assetKey: asset.key,
                    style: asset.style,
                    ...(!title ? { title: asset.title } : {}),
                  })
                  setDirty(true)
                  setPicker(false)
                }}
              >
                <img loading="lazy" src={artworkImage(asset.key)} alt={asset.title} />
                <span>
                  {asset.title} · {asset.style}
                </span>
              </button>
              {access.canManageDraft && asset.key !== assetKey && (
                <Button
                  danger
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={async () => {
                    try {
                      await artworkApi.deleteAsset(asset.key)
                      await assets.refetch()
                      void message.success('素材已删除')
                    } catch (e) {
                      setError(e instanceof Error ? e : new Error('删除失败'))
                    }
                  }}
                  aria-label={`删除${asset.title}`}
                />
              )}
            </div>
          ))}
        </div>
      </Modal>
      <Modal
        title="确认 4:3 裁切范围"
        open={Boolean(pendingFile)}
        okText="裁切并上传"
        cancelText="重新选择"
        confirmLoading={uploading}
        onCancel={() => {
          if (pendingPreview) {
URL.revokeObjectURL(pendingPreview)
}
          setPendingFile(undefined)
          setPendingPreview('')
        }}
        onOk={async () => {
          if (!pendingFile) {
return
}
          setUploading(true)
          try {
            const values = await form.validateFields(['title', 'style'])
            const asset = await artworkApi.uploadAsset(pendingFile, values.title, values.style)
            await assets.refetch()
            form.setFieldValue('assetKey', asset.key)
            setDirty(true)
            setPicker(false)
            URL.revokeObjectURL(pendingPreview)
            setPendingFile(undefined)
            setPendingPreview('')
            void message.success('原画已按预览范围裁切并上传')
          } catch (e) {
            setError(e instanceof Error ? e : new Error('上传失败'))
          } finally {
            setUploading(false)
          }
        }}
      >
        <p>画面会居中裁切，浅色区域外的内容不会进入拼图。</p>
        {pendingPreview && (
          <img className="artwork-crop-preview" src={pendingPreview} alt="4:3 裁切预览" />
        )}
      </Modal>
      <Modal
        title={transition === 'published' ? '发布画作' : '下架画作'}
        open={!!transition}
        confirmLoading={busy}
        okButtonProps={{ disabled: !reason.trim() }}
        onOk={() => void changeStatus()}
        onCancel={() => {
          if (!busy) {
setTransition(undefined)
}
        }}
        okText="确认"
        cancelText="取消"
      >
        <p>
          {transition === 'published'
            ? '发布后用户可以选择这幅画作进行收集。'
            : '下架后停止新用户选择，已获得的碎片不会删除。'}
        </p>
        <Input.TextArea
          aria-label="操作原因"
          placeholder="填写操作原因，便于审计追溯"
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
        />
        {error && <Alert type="error" message={error.message} />}
      </Modal>
    </AdminPage>
  )
}
