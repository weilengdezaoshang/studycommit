import { BadRequestException } from '@nestjs/common'
import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { InternalAuthGuard } from './internal-auth.guard'
import {
  InternalService,
  type MiniprogramExchangeInput,
  type MiniprogramExchangeOutput,
} from './internal.service'

const exchangeInputSchema = z.object({
  openId: z.string().trim().min(1).max(128),
  unionId: z.string().trim().min(1).max(128).optional(),
})

/**
 * 内部接口：仅供受信云函数调用（HMAC 签名守卫），不走用户 JWT 鉴权。
 * 白名单路径唯一：POST /internal/auth/miniprogram/exchange
 */
@Controller('internal/auth/miniprogram')
@UseGuards(InternalAuthGuard)
export class InternalController {
  constructor(private readonly internalService: InternalService) {}

  @Post('exchange')
  async exchange(@Body() body: unknown): Promise<{ data: MiniprogramExchangeOutput }> {
    // 签名合法只代表调用方可信，入参仍需契约校验，避免坏 payload 打到仓储层。
    const parsed = exchangeInputSchema.safeParse(body ?? {})
    if (!parsed.success) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '身份交换参数不完整' })
    }
    const output = await this.internalService.exchangeMiniprogramIdentity(parsed.data)
    return { data: output }
  }
}

export type { MiniprogramExchangeInput }
