import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition'
import type { CaptureOcrPort } from '@studycommit/common/capture-runtime'

/** 移动端离线中文 OCR。模型由 iOS/Android 安装包携带，运行时不上传图片。 */
export const mobileOcrPort: CaptureOcrPort = {
  async recognize(image, signal) {
    if (signal?.aborted) {
      throw new Error('OCR_CANCELLED')
    }
    const result = await TextRecognition.recognize(image.uri, TextRecognitionScript.CHINESE)
    if (signal?.aborted) {
      throw new Error('OCR_CANCELLED')
    }
    return { imageId: image.id, version: image.version, text: result.text.trim() }
  },
}
