import { createMonitor, type MonitorRecord } from '@studycommit/observability'
import { MINIPROGRAM_APP_VERSION, MINIPROGRAM_PLATFORM } from '../constants/app'

function getPageRoute(): string | undefined {
  const pages = getCurrentPages()
  return pages[pages.length - 1]?.route
}

function getContext() {
  const accountInfo = wx.getAccountInfoSync().miniProgram

  return {
    envVersion: accountInfo.envVersion,
    appId: accountInfo.appId,
    page: getPageRoute(),
  }
}

function writeToConsole(record: MonitorRecord): void {
  const prefix = `[StudyCommit][${record.type}]`

  if (record.type === 'error' || record.level === 'error') {
    console.error(prefix, record)
  } else if (record.level === 'warn') {
    console.warn(prefix, record)
  } else {
    console.info(prefix, record)
  }
}

export const monitor = createMonitor({
  platform: MINIPROGRAM_PLATFORM,
  appVersion: MINIPROGRAM_APP_VERSION,
  getContext,
  reporters: [{ report: writeToConsole }],
})
