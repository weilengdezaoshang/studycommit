/** 每日成本预算:固定最多 4 位小数的十进制字符串,禁止浮点 toFixed 改写. */
export const BUDGET_PATTERN = /^\d+(\.\d{1,4})?$/
/** 单次成本估算:最多 6 位小数. */
export const COST_PATTERN = /^\d+(\.\d{1,6})?$/

export function normalizeDecimalInput(value: string): string {
  return value.trim()
}

export function isValidBudget(value: string): boolean {
  return BUDGET_PATTERN.test(normalizeDecimalInput(value))
}

export function isValidCost(value: string): boolean {
  return COST_PATTERN.test(normalizeDecimalInput(value))
}
