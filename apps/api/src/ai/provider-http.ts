import { lookup as dnsLookup } from 'node:dns'
import { Agent, buildConnector, fetch as undiciFetch } from 'undici'
import { assertConnectedIp, pickSafeConnectAddress } from './provider-endpoint'

/** 禁止跟随重定向,避免校验过的地址被 302 到内网或云元数据。 */
export function providerRequestInit(init: RequestInit): RequestInit {
  return { ...init, redirect: 'error' }
}

type LookupCallback = (err: Error | null, address: string, family: number) => void

/** 把连接钉在已通过安全检查的地址上,避免 connector 再次解析时命中重绑定结果。 */
function pinnedLookup(picked: { address: string; family: number }) {
  return (_hostname: string, options: unknown, callback?: LookupCallback) => {
    const done = typeof options === 'function' ? (options as LookupCallback) : callback
    done?.(null, picked.address, picked.family)
  }
}

/**
 * 正式调用与连接测试共用的 fetch:禁止自动重定向,并在 TCP 连接后校验对端 IP。
 */
export function createProviderFetch(trustedOrigins: string[]): typeof fetch {
  const connector = buildConnector({})
  const agent = new Agent({
    connect(options, callback) {
      const hostname = String(options.hostname ?? options.servername ?? '')
      dnsLookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
        if (error || !addresses) {
          callback(error ?? new Error('lookup failed'), null)
          return
        }
        let picked: { address: string; family: number }
        try {
          picked = pickSafeConnectAddress(hostname, addresses, trustedOrigins)
        } catch (caught) {
          callback(caught as Error, null)
          return
        }
        connector({ ...options, lookup: pinnedLookup(picked) } as never, (connectError, socket) => {
          if (connectError || !socket) {
            callback(connectError ?? new Error('connect failed'), null)
            return
          }
          try {
            assertConnectedIp(hostname, socket.remoteAddress ?? '', trustedOrigins)
          } catch (caught) {
            socket.destroy()
            callback(caught as Error, null)
            return
          }
          callback(null, socket)
        })
      })
    },
  })
  return (async (input: RequestInfo | URL, init?: RequestInit) =>
    undiciFetch(
      input as never,
      {
        ...(init as object),
        redirect: 'error',
        dispatcher: agent,
      } as never,
    )) as unknown as typeof fetch
}
