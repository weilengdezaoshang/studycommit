import { useEffect, useRef, useState } from 'react'
import { openCaptureConfirm } from './confirm-store'

/** 截图学习入口状态(DE-310/R71):权限拒绝时给出说明,完成后打开确认页。 */
export function useCaptureEntry() {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const inFlight = useRef(false)

  useEffect(() => {
    if (!permissionDenied) {
      return
    }
    let active = true
    const check = async () => {
      try {
        const result = await window.studyCommit.capture.permissionCheck()
        if (active && result.ok && (result.data === 'granted' || result.data === 'not-needed')) {
          setPermissionDenied(false)
          setNotice('屏幕录制权限已允许，请再次点击截图学习')
        }
      } catch {
        // 回到前台时只刷新提示；用户仍可主动重试。
      }
    }
    window.addEventListener('focus', check)
    return () => {
      active = false
      window.removeEventListener('focus', check)
    }
  }, [permissionDenied])

  const start = async () => {
    if (inFlight.current) {
      return
    }
    inFlight.current = true
    setBusy(true)
    setNotice(null)
    setPermissionDenied(false)
    try {
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
    } catch {
      setNotice('截图失败，请重试')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  const openSettings = async () => {
    try {
      const result = await window.studyCommit.capture.openPermissionSettings()
      if (!result.ok) {
        setNotice('无法打开系统设置，请手动前往隐私与安全性中的屏幕录制设置')
      }
    } catch {
      setNotice('无法打开系统设置，请手动前往隐私与安全性中的屏幕录制设置')
    }
  }

  return { busy, notice, permissionDenied, start, openSettings }
}
