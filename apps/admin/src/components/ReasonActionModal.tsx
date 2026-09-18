import { spacing } from '@studycommit/design-tokens'
import { Alert, Button, Input, Space, Typography } from 'antd'
import { AdminActionDialog } from './AdminActionDialog'
import { useEffect, useId, useState } from 'react'
import { REASON_MAX, validateReason } from '@/utils/reason'

export function ReasonActionModal({
  open,
  title,
  impact,
  danger,
  confirmText,
  reasonLabel,
  busy,
  conflictText,
  unknownText,
  rateLimitedText,
  onQueryResult,
  onViewLatest,
  onSubmit,
  onCancel,
}: {
  open: boolean
  title: string
  impact?: React.ReactNode
  danger?: boolean
  confirmText: string
  reasonLabel: string
  busy?: boolean
  conflictText?: string | null
  unknownText?: string | null
  rateLimitedText?: string | null
  onQueryResult?: () => void
  onViewLatest?: () => void
  onSubmit: (reason: string) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState('')
  const fieldId = useId()

  useEffect(() => {
    if (open && !conflictText && !unknownText) {
      setReason('')
    }
  }, [open, conflictText, unknownText])

  const error = reason.length === 0 ? null : validateReason(reason)
  const trimmed = reason.trim()
  const canSubmit =
    !busy &&
    !unknownText &&
    !conflictText &&
    !rateLimitedText &&
    trimmed.length >= 1 &&
    trimmed.length <= REASON_MAX

  const footer = (() => {
    if (unknownText) {
      return (
        <Space>
          <Button onClick={onCancel} disabled={busy}>
            关闭
          </Button>
          <Button type="primary" onClick={onQueryResult} loading={busy}>
            查询结果
          </Button>
        </Space>
      )
    }
    if (conflictText) {
      return (
        <Space>
          <Button onClick={onCancel} disabled={busy}>
            关闭
          </Button>
          <Button type="primary" onClick={onViewLatest} loading={busy}>
            查看最新
          </Button>
        </Space>
      )
    }
    return (
      <Space>
        <Button onClick={onCancel} disabled={busy}>
          取消
        </Button>
        <Button
          type="primary"
          danger={danger}
          loading={busy}
          disabled={!canSubmit}
          onClick={() => onSubmit(trimmed)}
        >
          {confirmText}
        </Button>
      </Space>
    )
  })()

  return (
    <AdminActionDialog
      open={open}
      title={unknownText ? '操作结果待确认' : title}
      tone={unknownText || rateLimitedText ? 'warning' : danger ? 'danger' : 'normal'}
      busy={busy}
      onClose={onCancel}
      footer={footer}
    >
      {impact ? (
        <div className="admin-action-impact" style={{ marginBottom: spacing.md }}>
          {impact}
        </div>
      ) : null}
      {conflictText ? (
        <Alert
          type="info"
          showIcon
          message="内容已更新"
          description={conflictText}
          style={{ marginBottom: spacing.md }}
        />
      ) : null}
      {unknownText ? (
        <Alert
          type="warning"
          showIcon
          message="操作结果待确认"
          description={unknownText}
          style={{ marginBottom: spacing.md }}
        />
      ) : null}
      {rateLimitedText ? (
        <Alert
          type="warning"
          showIcon
          message="操作过于频繁"
          description={rateLimitedText}
          style={{ marginBottom: spacing.md }}
        />
      ) : null}
      {!unknownText ? (
        <>
          <label htmlFor={fieldId}>
            <Typography.Text>
              {reasonLabel}
              <span style={{ color: 'var(--sc-danger)' }}> *</span>
            </Typography.Text>
          </label>
          <Input.TextArea
            id={fieldId}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={REASON_MAX}
            showCount
            autoSize={{ minRows: 3, maxRows: 6 }}
            disabled={busy || Boolean(unknownText)}
            placeholder="请输入操作理由"
            style={{ marginTop: spacing.sm }}
            status={error ? 'error' : undefined}
            aria-label={reasonLabel}
          />
          {error ? (
            <Typography.Text type="danger" style={{ fontSize: 12 }}>
              {error}
            </Typography.Text>
          ) : null}
        </>
      ) : null}
    </AdminActionDialog>
  )
}
