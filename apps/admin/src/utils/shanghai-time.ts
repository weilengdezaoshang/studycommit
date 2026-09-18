import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { DISPLAY_TIMEZONE } from './format'

dayjs.extend(utc)
dayjs.extend(timezone)

/** 把服务端 ISO 解析为 Asia/Shanghai 墙钟,供 DatePicker 显示. */
export function parseShanghai(value: string): Dayjs {
  return dayjs(value).tz(DISPLAY_TIMEZONE)
}

/** 把选择器日历值当作上海墙钟,输出带偏移的 ISO. */
export function toShanghaiIso(value: Dayjs): string {
  return dayjs.tz(value.format('YYYY-MM-DD HH:mm:ss'), DISPLAY_TIMEZONE).format()
}

export function isIntegerInRange(value: unknown, min: number, max: number): boolean {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
return false
}
  return value >= min && value <= max
}
