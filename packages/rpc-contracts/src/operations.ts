import { oc } from '@orpc/contract'
import { z } from 'zod'

/**
 * 运营引导契约:客户端登录、回前台、进入活动页时拉取;
 * 携带 serverNow 与 configVersion 供缓存时效校验。缓存只用于展示,授权以后端为准。
 */

export const operationsBootstrapOutputSchema = z.object({
  serverNow: z.iso.datetime({ offset: true }),
  /** 服务端配置版本:开关/价格/可见活动任一变化即更新,客户端据此失效缓存。 */
  configVersion: z.string().max(64),
  ai: z.object({
    /** AI 付费生成是否开放受理。 */
    enabled: z.boolean(),
    priceVersion: z.number().int().min(1).nullable(),
  }),
  credits: z.object({
    available: z.number().int().min(0),
    reserved: z.number().int().min(0),
  }),
})
export type OperationsBootstrapOutput = z.infer<typeof operationsBootstrapOutputSchema>

export const operationsContract = {
  bootstrap: oc
    .route({ method: 'GET', path: '/operations/bootstrap', summary: '运营活动与计费引导配置' })
    .output(operationsBootstrapOutputSchema),
}
