/** 禁止跟随重定向,避免校验过的地址被 302 到内网或云元数据。 */
export function providerRequestInit(init: RequestInit): RequestInit {
  return { ...init, redirect: 'error' }
}
