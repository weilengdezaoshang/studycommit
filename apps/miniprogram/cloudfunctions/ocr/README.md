# ocr 云函数

图片识别云函数：小程序通过 `wx.cloud.callFunction({ name: 'ocr' })` 调用，函数内部完成微信身份校验、服务开关与每日限额检查后，调用腾讯云 `GeneralAccurateOCR` 并返回统一协议结果。腾讯云响应字段只在本目录内消化，客户端只消费 `ok / imageId / version / text / code`。

## 返回协议

成功：

```json
{ "ok": true, "imageId": "string", "version": 1, "text": "string" }
```

失败（无文字不是失败：成功返回 `text: ''`，由客户端标记 empty）：

```json
{
  "ok": false,
  "code": "OCR_UNAUTHENTICATED | OCR_DISABLED | OCR_INVALID_INPUT | OCR_IMAGE_TOO_LARGE | OCR_RATE_LIMITED | OCR_NOT_CONFIGURED | OCR_TIMEOUT | OCR_PROVIDER_FAILED"
}
```

供应商原始异常、RequestId 与凭据不会返回客户端，也不会写进日志。

## 环境变量

非密钥变量已写入 `config.json`，通过微信开发者工具上传时自动生效：

| 变量                 | 值             | 说明                                                                      |
| -------------------- | -------------- | ------------------------------------------------------------------------- |
| `OCR_ENABLED`        | `true`         | 未显式配置为 `true` 一律视为关闭，返回 `OCR_DISABLED`                     |
| `TENCENT_OCR_REGION` | `ap-guangzhou` | 腾讯云 OCR 地域                                                           |
| `OCR_DAILY_LIMIT`    | `50`           | 每个 OPENID 每天调用上限                                                  |
| `OCR_TIMEOUT_MS`     | `12000`        | 单次腾讯云调用超时，必须小于函数超时（`config.json` 的 `timeout: 20` 秒） |

密钥变量只能配置在微信云开发控制台（云函数 → 配置 → 环境变量），禁止写入代码、日志或 Git：

- `TENCENT_SECRET_ID`
- `TENCENT_SECRET_KEY`

### 推荐优先使用角色授权

在腾讯云控制台为该云函数绑定包含 OCR 权限（如 `QcloudOCRFullAccess`）的角色后，平台会向运行环境注入 `TENCENTCLOUD_SECRETID`、`TENCENTCLOUD_SECRETKEY`、`TENCENTCLOUD_SESSIONTOKEN` 临时凭据；代码检测到未配置长期密钥时自动改用这组临时凭据，可完全免配长期密钥。注意绑定角色需确认角色策略包含 OCR 调用权限，否则会以 `OCR_PROVIDER_FAILED` 失败。

## 每日限额与并发安全

配额存放在云数据库集合 `ocr_rate_limits`，文档 `_id` 为 `OPENID_YYYY-MM-DD`（UTC 日期）。占用配额使用条件更新 `where({ _id, count: _.lt(limit) }).update({ count: _.inc(1) })`，由数据库保证原子性：并发调用最多消耗 `limit` 次，超出限额直接返回 `OCR_RATE_LIMITED`，不会调用腾讯云。集合无需额外索引（按 `_id` 命中）。

## 日志

只记录 `imageId`、`version`、耗时与错误码；不记录图片 Base64、OCR 文本、OPENID、SecretId、SecretKey。

## 部署

1. 微信开发者工具打开 `apps/miniprogram`，确认右上角「云开发」已开通并创建环境。
2. 在云开发控制台为 `ocr` 函数配置密钥环境变量（或按上文绑定角色）。
3. 在 `cloudfunctions/ocr` 目录右键「上传并部署：云端安装依赖」（依赖 `wx-server-sdk`、`tencentcloud-sdk-nodejs-ocr`）。
4. 部署后在云开发控制台确认函数超时 ≥ 20 秒、环境变量已生效。

## 本地检查

```bash
node --check apps/miniprogram/cloudfunctions/ocr/index.js
node --check apps/miniprogram/cloudfunctions/ocr/handler.js
node --check apps/miniprogram/cloudfunctions/ocr/ocr-core.js
pnpm --filter @studycommit/miniprogram test:run
```

## 识别图片来源（fileRef 优先）

1. **私有临时云文件（推荐）**：请求携带 `fileRef`（`ocr-temp/...`）。客户端先经 `backend` 云函数 `uploads.stageTemp` 登记归属（`mp_staged_files` 集合，`owner=OPENID`），`wx.cloud.uploadFile` 上传到该私有路径；本函数校验归属后 `downloadFile` 读取，识别结束（成功或失败）即删除文件与登记文档。归属不符返回 `OCR_FORBIDDEN`，不暴露文件存在性。
2. **内联 Base64（兼容保留）**：`imageBase64` ≤ 4 MiB。

失败码新增 `OCR_FORBIDDEN`（图片归属校验失败）；客户端 `OcrService` 将其映射为统一 `FORBIDDEN`。
