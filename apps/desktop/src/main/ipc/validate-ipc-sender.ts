export interface TrustedIpcFrame {
  url: string
  isDestroyed(): boolean
}

export interface TrustedIpcSenderOptions {
  isDev: boolean
  rendererDevOrigin?: string
}

export function isTrustedIpcSender(
  event: { senderFrame?: TrustedIpcFrame | null },
  options: TrustedIpcSenderOptions,
): boolean {
  const frame = event.senderFrame
  if (!frame || frame.isDestroyed()) {
    return false
  }

  let url: URL
  try {
    url = new URL(frame.url)
  } catch {
    return false
  }

  if (options.isDev && options.rendererDevOrigin) {
    try {
      return url.origin === new URL(options.rendererDevOrigin).origin
    } catch {
      return false
    }
  }

  return url.protocol === 'file:'
}
