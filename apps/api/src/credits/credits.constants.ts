/** 积分单次操作与单账户总额上限,防止 JS 安全整数溢出与账务异常。 */
export const MAX_CREDIT_AMOUNT = 1_000_000_000

/**
 * 账务事务统一锁顺序(全部事务必须遵守,死锁重试只做有界退避):
 * ai_service_config → ai_cost_budgets → campaigns → credit_accounts → credit_grants(FEFO)。
 */
export const CREDITS_ERROR = {
  insufficient: {
    code: 'INSUFFICIENT_CREDITS',
    message: '积分余额不足',
  },
  accountMissing: {
    code: 'CREDITS_ACCOUNT_MISSING',
    message: '积分账户不存在',
  },
  reservationNotFound: {
    code: 'CREDITS_RESERVATION_NOT_FOUND',
    message: '冻结记录不存在',
  },
  amountInvalid: {
    code: 'CREDITS_AMOUNT_INVALID',
    message: '积分数量不合法',
  },
  runNotFound: {
    code: 'CREDITS_RUN_NOT_FOUND',
    message: '关联运行记录不存在',
  },
} as const

export type CreditsErrorCode = (typeof CREDITS_ERROR)[keyof typeof CREDITS_ERROR]['code']
