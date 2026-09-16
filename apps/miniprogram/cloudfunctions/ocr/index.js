const cloud = require('wx-server-sdk')
const tencentcloud = require('tencentcloud-sdk-nodejs-ocr')
const { createOcrHandler } = require('./handler')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = createOcrHandler({
  getWXContext: () => cloud.getWXContext(),
  db: cloud.database(),
  createOcrClient: (credential, region, timeoutSeconds) =>
    new tencentcloud.ocr.v20181119.Client({
      credential,
      region,
      profile: {
        httpProfile: { endpoint: 'ocr.tencentcloudapi.com', reqTimeout: timeoutSeconds },
      },
    }),
  env: process.env,
  log: console,
})
