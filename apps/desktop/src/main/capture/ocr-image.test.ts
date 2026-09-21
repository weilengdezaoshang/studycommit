// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
const native = vi.hoisted(() => ({ createFromBuffer: vi.fn(), createFromBitmap: vi.fn() }))
vi.mock('electron', () => ({ nativeImage: native }))
import { prepareOcrImage } from './ocr-image'

describe('OCR 补边', () => {
  it('延续背景色并原样保留每行截图像素', () => {
    const pixels = Buffer.from([250, 250, 250, 255, 0, 0, 0, 255, 10, 20, 30, 255, 40, 50, 60, 255])
    native.createFromBuffer.mockReturnValue({
      isEmpty: () => false,
      getSize: () => ({ width: 2, height: 2 }),
      toBitmap: () => pixels,
    })
    native.createFromBitmap.mockImplementation((bitmap) => ({ toPNG: () => bitmap }))
    const output = prepareOcrImage(Buffer.from('png'))
    expect(native.createFromBitmap).toHaveBeenCalledWith(output, { width: 50, height: 50 })
    expect(output.subarray(0, 4)).toEqual(pixels.subarray(0, 4))
    expect(output.subarray((24 * 50 + 24) * 4, (24 * 50 + 26) * 4)).toEqual(pixels.subarray(0, 8))
    expect(output.subarray((25 * 50 + 24) * 4, (25 * 50 + 26) * 4)).toEqual(pixels.subarray(8))
  })

  it('无法解码时提示重新截图', () => {
    native.createFromBuffer.mockReturnValue({ isEmpty: () => true })
    expect(() => prepareOcrImage(Buffer.from('bad'))).toThrow('截图无法解码，请重新截图')
  })
})
