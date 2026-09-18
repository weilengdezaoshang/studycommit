import { spacing } from '@studycommit/design-tokens'
import { Button, Typography, message } from 'antd'

const { Text } = Typography

export function CopyId({
  value,
  label = '复制',
  head = 8,
}: {
  value: string | null | undefined
  label?: string
  head?: number
}) {
  if (!value) {
return <Text type="secondary">—</Text>
}
  const display = value.length <= head + 1 ? value : `${value.slice(0, head)}…`
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs }}>
      <Text code className="tabular-nums">
        {display}
      </Text>
      <Button
        type="link"
        size="small"
        onClick={async (event) => {
          event.stopPropagation()
          try {
            await navigator.clipboard.writeText(value)
            void message.success('已复制完整 ID')
          } catch {
            void message.error('复制失败')
          }
        }}
      >
        {label}
      </Button>
    </span>
  )
}
