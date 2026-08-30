import { BadRequestException, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AUTH_ERROR } from './auth.constants'

export type WechatMiniSession = { openid: string; unionid: string | null }

const WECHAT_CODE2SESSION_URL = 'https://api.weixin.qq.com/sns/jscode2session'

@Injectable()
export class WechatMiniClient {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async exchangeCode(code: string): Promise<WechatMiniSession> {
    if (this.config.get<string>('AUTH_WECHAT_STUB')) {
      return parseStubSession(code)
    }
    const appId = this.config.get<string>('WECHAT_MINI_APP_ID')
    const secret = this.config.get<string>('WECHAT_MINI_APP_SECRET')
    if (!appId || !secret) {
      throw new HttpException(AUTH_ERROR.wechatUnavailable, HttpStatus.SERVICE_UNAVAILABLE)
    }
    return this.requestSession(appId, secret, code)
  }

  private async requestSession(
    appId: string,
    secret: string,
    code: string,
  ): Promise<WechatMiniSession> {
    let response: Response
    try {
      const url = new URL(WECHAT_CODE2SESSION_URL)
      url.searchParams.set('appid', appId)
      url.searchParams.set('secret', secret)
      url.searchParams.set('js_code', code)
      url.searchParams.set('grant_type', 'authorization_code')
      response = await fetch(url, { signal: AbortSignal.timeout(8_000) })
    } catch {
      throw new HttpException(AUTH_ERROR.wechatUnavailable, HttpStatus.SERVICE_UNAVAILABLE)
    }
    const payload = (await response.json().catch(() => null)) as {
      openid?: unknown
      unionid?: unknown
      errcode?: unknown
    } | null
    if (
      !response.ok ||
      !payload ||
      payload.errcode ||
      typeof payload.openid !== 'string' ||
      !payload.openid
    ) {
      throw new BadRequestException(AUTH_ERROR.wechatCodeInvalid)
    }
    return {
      openid: payload.openid,
      unionid: typeof payload.unionid === 'string' && payload.unionid ? payload.unionid : null,
    }
  }
}

export function parseStubSession(code: string): WechatMiniSession {
  const [openid, unionid] = code.split('|')
  if (!openid) {
    throw new BadRequestException(AUTH_ERROR.wechatCodeInvalid)
  }
  return { openid, unionid: unionid || null }
}
