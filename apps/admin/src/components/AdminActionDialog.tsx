import { ExclamationCircleOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { Descriptions, Modal } from 'antd'
import type { ReactNode } from 'react'

/** 后台写操作的统一容器：业务页面只提供内容与操作，不重复实现弹窗样式。 */
export function AdminActionDialog({
  open,
  title,
  tone = 'normal',
  busy,
  onClose,
  footer,
  children,
}: {
  open: boolean
  title: string
  tone?: 'normal' | 'warning' | 'danger'
  busy?: boolean
  onClose: () => void
  footer: ReactNode
  children: ReactNode
}) {
  return (
    <Modal
      className={`admin-action-modal admin-action-modal--${tone}`}
      centered
      width={540}
      open={open}
      title={
        <span className="admin-dialog-title">
          <span className="admin-dialog-icon">
            {tone === 'normal' ? <SafetyCertificateOutlined /> : <ExclamationCircleOutlined />}
          </span>
          {title}
        </span>
      }
      onCancel={busy ? undefined : onClose}
      maskClosable={false}
      keyboard={!busy}
      closable={!busy}
      footer={footer}
    >
      {children}
    </Modal>
  )
}

export function ActionSummary({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <div className="admin-action-summary">
      <Descriptions
        column={1}
        size="small"
        items={items.map((item, index) => ({
          key: index,
          label: item.label,
          children: item.value,
        }))}
      />
    </div>
  )
}
