import { nativeImage } from 'electron'

/** OCR 专用留白：避免贴边文字被版面分析误判，原始截图仍用于预览与上传。 */
export function prepareOcrImage(bytes: Buffer): Buffer {
  const image = nativeImage.createFromBuffer(bytes)
  if (image.isEmpty()) {
    throw new Error('截图无法解码，请重新截图')
  }
  const { width, height } = image.getSize()
  const border = 24
  const paddedWidth = width + border * 2
  const paddedHeight = height + border * 2
  // 超大图片保持原样，避免仅为补边分配过多内存。
  if (paddedWidth * paddedHeight * 4 > 128 * 1024 * 1024) {
    return bytes
  }
  const bitmap = image.toBitmap()
  const padded = Buffer.alloc(paddedWidth * paddedHeight * 4)
  // 延续截图角落背景，兼容浅色与深色界面。
  padded.fill(bitmap.subarray(0, 4))
  for (let y = 0; y < height; y++) {
    bitmap.copy(
      padded,
      ((y + border) * paddedWidth + border) * 4,
      y * width * 4,
      (y + 1) * width * 4,
    )
  }
  return nativeImage.createFromBitmap(padded, { width: paddedWidth, height: paddedHeight }).toPNG()
}
