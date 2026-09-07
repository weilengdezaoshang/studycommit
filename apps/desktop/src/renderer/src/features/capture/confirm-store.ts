import { useSyncExternalStore } from 'react'

/**
 * 截图确认页开关(DE-311):截图完成后由主窗口入口或快捷键推送打开。
 * 模块级单例:同一时刻至多一张待确认截图。
 */

let currentCaptureId: string | null = null

const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) {
    listener()
  }
}

export function openCaptureConfirm(captureId: string): void {
  currentCaptureId = captureId
  emit()
}

export function closeCaptureConfirm(): void {
  currentCaptureId = null
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): string | null {
  return currentCaptureId
}

export function useCaptureConfirmId(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
