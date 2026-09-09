import { useState } from 'react'
import { openCaptureConfirm } from './confirm-store'

/** 截图学习入口状态(DE-310/R71):权限拒绝时给出说明,完成后打开确认页。 */
export function useCaptureEntry() {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)

  const start = async () => {
    if (busy) {
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const permission = await window.studyCommit.capture.permissionCheck()
      if (!(permission.ok && (permission.data === 'granted' || permission.data === 'not-needed'))) {
        setPermissionDenied(true)
        return
      }
      const result = await window.studyCommit.capture.request()
      if (!result.ok) {
        setNotice('截图失败，请重试')
        return
      }
      if (result.data.status === 'completed') {
        openCaptureConfirm(result.data.captureId)
      } else if (result.data.status === 'permission-denied') {
        setPermissionDenied(true)
      } else if (result.data.status === 'failed') {
        setNotice(`截图失败：${result.data.message}`)
      }
      // cancelled:用户主动取消,静默
    } finally {
      setBusy(false)
    }
  }

  return { busy, notice, permissionDenied, start }
}
