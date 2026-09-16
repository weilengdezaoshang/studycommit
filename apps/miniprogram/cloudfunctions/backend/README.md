# backend 统一入口云函数

小程序普通业务的唯一云函数入口：客户端通过统一信封 `{version, operation, requestId, idempotencyKey?, payload}` 调用，函数按 operation 白名单路由，完成微信身份解析与 OPENID→用户身份交换后，把请求转发到现有 StudyCommit API（业务校验、幂等与数据写入全部复用现有 API，不在此复制）。

## 环境变量

`config.json` 随部署生效（非密钥）：

| 变量                      | 默认       | 说明                   |
| ------------------------- | ---------- | ---------------------- |
| `CAPTURE_ENABLED`         | `true`     | 采集入口开关           |
| `IMAGE_RECORD_ENABLED`    | `true`     | 纯图片记录开关         |
| `MAX_CAPTURE_IMAGES`      | `9`        | 单次记录图片上限（≤9） |
| `FILE_MAX_BYTES`          | `10485760` | 单文件字节上限         |
| `INTERNAL_API_TIMEOUT_MS` | `10000`    | 内部 API 超时          |

微信云开发控制台配置（密钥，禁止入 Git）：

- `INTERNAL_API_BASE_URL`：现有 API 地址（如 `https://api.studycommit.com/api`）
- `INTERNAL_API_SIGNING_SECRET`：内部 HMAC 签名密钥（与 API 侧一致）

## 身份交换

1. `wx-server-sdk` 上下文取 `OPENID/APPID/UNIONID`（不信任 payload 中的任何身份字段，解析时强制剥除）。
2. `POST {INTERNAL_API_BASE_URL}/internal/auth/miniprogram/exchange`，请求头带
   `x-internal-timestamp` 与 `x-internal-signature = HMAC-SHA256(secret, "{timestamp}\nPOST\n{path}\n{sha256(body)}")`。
3. API 侧复用现有微信小程序账号模型（openid → 用户；未绑定时按现有产品规则自动建号）签发与普通登录等价的会话令牌。
4. 令牌按云函数实例内存缓存至临期前 60 秒；业务转发携带 `Authorization: Bearer {token}` 与 `x-request-id`、`idempotency-key`。

## operation 路由表（白名单）

| 分类                      | operation                                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 会话（exchange/identity） | `auth.login`、`auth.refresh`、`auth.logout`                                                                    |
| 记录                      | `papers.list/get/create/update/organize/moveToInbox/remove/resolveQuestion/restore`                            |
| 箱子                      | `topics.list/create/update/remove`                                                                             |
| 搜索                      | `search.query`                                                                                                 |
| 学习会话                  | `studySessions.create/getActive/get/pause/resume/complete`                                                     |
| 能力开关                  | `capabilities.get`（云函数本地读环境变量）                                                                     |
| 上传                      | `uploads.stage/attach`（云存储暂存 + 服务器侧预签名直传绑定）、`uploads.stageTemp/cleanupTemp`（OCR 临时文件） |

未注册的 operation 直接返回 `INVALID_INPUT`。OCR 使用独立 `ocr` 云函数（私有临时文件协议），不经此入口。

## 上传链路（cloud-function 模式）

```
客户端 uploads.stage（登记 uploadId+OPENID 归属，校验 MIME/大小）
→ wx.cloud.uploadFile 到返回的 cloudPath
→ uploads.attach：云函数校验归属 → downloadFile → 复用现有
   POST /uploads（预签名）→ PUT → POST /uploads/{id}/complete
→ 清理暂存文件与登记文档 → 返回 { uploadId, assetId, status: 'attached' }
```

stage 会先校验 uploadId 的已有归属，防止第三方覆盖占用；`config.json` 内置每天 03:00 的定时触发器 `staged-files-cleanup`，清理超过 24 小时的残留暂存登记与文件。

## 日志

只记录 `operation`、`requestId`、耗时与错误码；不记录 payload、OPENID、令牌或上游错误细节。

## 部署

微信开发者工具在 `cloudfunctions/backend` 右键「上传并部署：云端安装依赖」（仅 `wx-server-sdk`），部署后在云开发控制台配置两个密钥环境变量。
