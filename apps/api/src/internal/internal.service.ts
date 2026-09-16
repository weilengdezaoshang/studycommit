import { Injectable, UnauthorizedException } from '@nestjs/common'
import { AuthService } from '../auth/auth.service'
import type { CurrentUser } from '@studycommit/rpc-contracts/auth'

export type MiniprogramExchangeInput = {
  openId: string
  unionId?: string
}

export type MiniprogramExchangeOutput = {
  user: CurrentUser
  tokens: {
    accessToken: string
    refreshToken: string
    expiresAt: string
  }
}

/**
 * 小程序云函数身份交换：
 * 复用现有微信小程序登录的账号模型（openid → 用户，未绑定按产品规则自动建号），
 * 签发与普通登录等价的会话令牌；云函数再以此令牌调用现有业务 API。
 */
@Injectable()
export class InternalService {
  constructor(private readonly authService: AuthService) {}

  async exchangeMiniprogramIdentity(
    input: MiniprogramExchangeInput,
  ): Promise<MiniprogramExchangeOutput> {
    const openId = input.openId.trim()
    if (!openId) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: '缺少微信身份' })
    }
    return this.authService.loginWechatMiniprogramByOpenId(openId, input.unionId ?? null)
  }
}
