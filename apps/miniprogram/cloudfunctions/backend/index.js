const cloud = require('wx-server-sdk')
const { createBackendHandler } = require('./handler')
const { createInternalApiClient, createHttpsSendRequest } = require('./api-client')
const { cleanupStaleStaged, isTimerEvent } = require('./handlers/uploads')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const apiClient = createInternalApiClient({
  env: process.env,
  sendRequest: createHttpsSendRequest(),
  log: console,
})

const businessHandler = createBackendHandler({
  getWXContext: () => cloud.getWXContext(),
  apiClient,
  cloud,
  env: process.env,
  log: console,
})

exports.main = async (event) => {
  // 定时触发器：清理 attach/OCR 失败路径残留的暂存文件与登记文档。
  if (isTimerEvent(event)) {
    return cleanupStaleStaged(cloud.database(), cloud)
  }
  return businessHandler(event)
}
