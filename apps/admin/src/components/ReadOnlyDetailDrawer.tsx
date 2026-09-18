import { Drawer } from 'antd'
import { useEffect, useState } from 'react'

export function ReadOnlyDetailDrawer({
  title,
  open,
  onClose,
  extra,
  children,
  width = 480,
}: {
  title: React.ReactNode
  open: boolean
  onClose: () => void
  extra?: React.ReactNode
  children: React.ReactNode
  width?: number
}) {
  const [fullScreen, setFullScreen] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)')
    const sync = () => setFullScreen(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  return (
    <Drawer
      className="admin-detail-drawer"
      title={title}
      open={open}
      onClose={onClose}
      extra={extra}
      width={fullScreen ? '100%' : width}
      destroyOnClose
    >
      {children}
    </Drawer>
  )
}
