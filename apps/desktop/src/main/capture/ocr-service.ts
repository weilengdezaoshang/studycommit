import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * 本地 OCR(DE-311):tesseract.js 在主进程内运行识别(其内部自带 worker 线程,
 * 不阻塞 Renderer);语言模型随应用打包在 resources/ocr-models,离线可用、零网络上传。
 * 接口保持薄抽象,后续如准确率不足可替换 ONNX 方案。
 */

export interface OcrResult {
  text: string
  confidence: number | null
}

export class OcrUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OcrUnavailableError'
  }
}

interface OcrWorkerLike {
  recognize(image: Buffer): Promise<{ data: { text: string; confidence: number } }>
  terminate(): Promise<unknown>
}

type CreateWorkerLike = (
  language: string,
  options: { langPath: string; logger: () => void },
) => Promise<OcrWorkerLike>

export class OcrService {
  private workerPromise: Promise<OcrWorkerLike> | null = null
  private readonly cache = new Map<string, OcrResult>()

  constructor(private readonly modelsDir: string) {}

  /** 按 captureId 识别并缓存;同一张截图不重复识别。 */
  async recognize(captureId: string, filePath: string): Promise<OcrResult> {
    const cached = this.cache.get(captureId)
    if (cached) {
      return cached
    }
    const image = await readFile(filePath)
    const worker = await this.ensureWorker()
    const { data } = await worker.recognize(image)
    const result: OcrResult = {
      text: data.text.trim(),
      confidence: typeof data.confidence === 'number' ? data.confidence : null,
    }
    this.cache.set(captureId, result)
    return result
  }

  /** 丢弃截图时同步丢弃缓存。 */
  forget(captureId: string): void {
    this.cache.delete(captureId)
  }

  async dispose(): Promise<void> {
    const workerPromise = this.workerPromise
    this.workerPromise = null
    if (workerPromise) {
      const worker = await workerPromise.catch(() => null)
      await worker?.terminate().catch(() => undefined)
    }
  }

  private ensureWorker(): Promise<OcrWorkerLike> {
    this.workerPromise ??= this.createWorker()
    return this.workerPromise
  }

  private createWorker(): Promise<OcrWorkerLike> {
    // tesseract.js 由主进程按需加载;缺失时给出可理解的失败而非崩溃
    let createWorker: CreateWorkerLike
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      createWorker = require('tesseract.js').createWorker
    } catch {
      return Promise.reject(new OcrUnavailableError('OCR 组件未安装，无法识别截图文字'))
    }
    return createWorker('chi_sim+eng', {
      langPath: this.modelsDir,
      logger: () => undefined,
    })
  }
}

/** 运行时模型目录:打包后随资源目录,开发时在应用 resources/ 下。 */
export function resolveOcrModelsDir(app: {
  isPackaged: boolean
  getAppPath: () => string
}): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'ocr-models')
  }
  return join(app.getAppPath(), 'resources', 'ocr-models')
}
