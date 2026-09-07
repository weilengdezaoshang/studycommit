import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { CaptureConfirmOverlay } from './CaptureConfirmOverlay'
import { openCaptureConfirm } from './confirm-store'

const mockCreatePaper = vi.fn()
const mockCreateSession = vi.fn()
const mockCancel = vi.fn()
const mockPreview = vi.fn()
const mockOcr = vi.fn()

vi.mock('../papers/papers-store', () => ({
  papersActions: { createPaper: (...args: unknown[]) => mockCreatePaper(...args) },
}))

vi.mock('../study-session/api/DesktopServicesProvider', () => ({
  useDesktopServices: () => ({
    studySessions: { create: (...args: unknown[]) => mockCreateSession(...args) },
  }),
}))

function installBridge() {
  Object.assign(window.studyCommit, {
    capture: {
      cancel: mockCancel,
      preview: mockPreview,
      ocr: mockOcr,
    },
  })
}

const CAPTURE_ID = '8a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d'

async function renderOverlay() {
  render(<CaptureConfirmOverlay captureId={CAPTURE_ID} />)
  await waitFor(() => {
    expect(mockPreview).toHaveBeenCalledWith({ captureId: CAPTURE_ID })
  })
}

describe('CaptureConfirmOverlay', () => {
  beforeEach(() => {
    mockCreatePaper.mockReset()
    mockCreateSession.mockReset()
    mockCancel.mockReset().mockResolvedValue({ ok: true as const, data: true })
    mockPreview.mockReset().mockResolvedValue({ ok: true as const, data: null })
    mockOcr.mockReset()
    installBridge()
  })

  it('加载本地 OCR 结果并预填问题建议句', async () => {
    mockOcr.mockResolvedValue({
      ok: true as const,
      data: { text: 'React 调度器为什么用优先级队列', confidence: 88 },
    })

    await renderOverlay()

    expect(await screen.findByLabelText(/识别原文/)).toHaveValue('React 调度器为什么用优先级队列')
    expect(screen.getByLabelText(/这次要弄懂的问题/)).toHaveValue('React 调度器为什么用优先级队列')
  })

  it('仅保存文字创建纸页且不绑定截图', async () => {
    mockOcr.mockResolvedValue({
      ok: true as const,
      data: { text: '识别到的正文', confidence: null },
    })
    mockCreatePaper.mockResolvedValue({
      id: 'a4c9d2e1-9999-4999-8999-999999999999',
    })

    await renderOverlay()
    const ocrText = await screen.findByLabelText(/识别原文/)
    // 清空预填的问题:验证纯文字保存不携带问题
    await userEvent.clear(screen.getByLabelText(/这次要弄懂的问题/))
    expect(ocrText).toHaveValue('识别到的正文')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '仅保存文字' }))
    })

    expect(mockCreatePaper).toHaveBeenCalledWith({
      content: '识别到的正文',
      questionText: undefined,
    })
    expect(mockCreateSession).not.toHaveBeenCalled()
  })

  it('从这里开始创建截图问题纸页并开始会话', async () => {
    mockOcr.mockResolvedValue({
      ok: true as const,
      data: { text: '识别到的正文', confidence: null },
    })
    mockCreateSession.mockResolvedValue({
      id: 'b4c9d2e1-1111-4111-8111-111111111111',
    })

    await renderOverlay()
    await screen.findByLabelText(/识别原文/)
    const question = screen.getByLabelText(/这次要弄懂的问题/)
    await userEvent.clear(question)
    await userEvent.type(question, '什么是事件循环')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '从这里开始' }))
    })

    expect(mockCreateSession).toHaveBeenCalledTimes(1)
    const input = mockCreateSession.mock.calls[0][0] as {
      draftPaper: { questionText: string; ocrText?: string; paperId: string }
      idempotencyKey: string
    }
    expect(input.draftPaper.questionText).toBe('什么是事件循环')
    expect(input.draftPaper.ocrText).toBe('识别到的正文')
    expect(input.idempotencyKey).toBeTruthy()
    expect(mockCreatePaper).not.toHaveBeenCalled()
  })

  it('命中敏感信息时给出提示', async () => {
    mockOcr.mockResolvedValue({
      ok: true as const,
      data: { text: '联系电话 13812345678', confidence: null },
    })

    await renderOverlay()

    expect(await screen.findByRole('alert')).toHaveTextContent('检测到疑似敏感信息')
  })

  it('取消并丢弃截图调用主进程删除临时文件', async () => {
    mockOcr.mockResolvedValue({ ok: true as const, data: { text: '', confidence: null } })
    openCaptureConfirm(CAPTURE_ID)

    await renderOverlay()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '取消并丢弃截图' }))
    })

    expect(mockCancel).toHaveBeenCalledWith({ captureId: CAPTURE_ID })
  })
})
