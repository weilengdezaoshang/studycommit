import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { CaptureConfirmOverlay } from './CaptureConfirmOverlay'
import { openCaptureConfirm } from './confirm-store'

const featureFlags = vi.hoisted(() => ({ STUDY_SESSIONS_ENABLED: true }))
vi.mock('../../../../shared/feature-flags', () => featureFlags)

const mockCreatePaper = vi.fn()
const mockCreateSession = vi.fn()
const mockCancel = vi.fn()
const mockPreview = vi.fn()
const mockOcr = vi.fn()
const mockUpload = vi.fn()
const mockRequest = vi.fn()

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
      upload: mockUpload,
      request: mockRequest,
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

/** 正文默认展示，直接核对识别结果。 */
async function findOcrTextarea() {
  return screen.findByLabelText(/识别原文/)
}

describe('CaptureConfirmOverlay', () => {
  beforeEach(() => {
    featureFlags.STUDY_SESSIONS_ENABLED = true
    mockCreatePaper.mockReset()
    mockCreateSession.mockReset()
    mockCancel.mockReset().mockResolvedValue({ ok: true as const, data: true })
    mockPreview.mockReset().mockResolvedValue({ ok: true as const, data: null })
    mockOcr.mockReset()
    mockUpload.mockReset().mockResolvedValue({ ok: true as const, data: { uploadId: 'upload-1' } })
    mockRequest.mockReset()
    installBridge()
  })

  it('陪学关闭时仅保存截图记录且不会创建学习会话', async () => {
    featureFlags.STUDY_SESSIONS_ENABLED = false
    mockOcr.mockResolvedValue({ ok: true, data: { text: '截图原文' } })
    mockCreatePaper.mockResolvedValue({ id: 'paper-1' })
    await renderOverlay()
    await waitFor(() => expect(screen.getByLabelText(/识别原文/)).toHaveValue('截图原文'))
    expect(screen.getByLabelText(/这次要弄懂的问题/)).toHaveValue('')
    expect(screen.getByLabelText(/这次要弄懂的问题/)).not.toBeVisible()
    expect(screen.queryByRole('button', { name: '从这里开始' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /保存图片记录/ }))
    await waitFor(() => expect(mockCreatePaper).toHaveBeenCalledOnce())
    expect(mockCreateSession).not.toHaveBeenCalled()
  })

  it('首次识别失败后重试成功会同步识别原文', async () => {
    mockOcr
      .mockResolvedValueOnce({ ok: false, error: { message: '识别失败' } })
      .mockResolvedValueOnce({ ok: true, data: { text: '启动桌面端和移动端' } })
    await renderOverlay()
    fireEvent.click(await screen.findByRole('button', { name: '重试识别' }))
    expect(await findOcrTextarea()).toHaveValue('启动桌面端和移动端')
    expect(screen.getByRole('button', { name: '仅保存文字' })).toBeEnabled()
  })

  it('空识别结果明确提示未识别到文字', async () => {
    mockOcr.mockResolvedValue({ ok: true, data: { text: '' } })
    await renderOverlay()
    expect(
      await screen.findByText('未识别到文字，请确认文字完整入框，也可以手动输入。'),
    ).toBeVisible()
  })

  it('追加截图的识别不返回时仍显示图片并允许取消', async () => {
    mockOcr
      .mockResolvedValueOnce({ ok: true, data: { text: '第一张文字' } })
      .mockImplementation(() => new Promise(() => {}))
    mockRequest.mockResolvedValue({
      ok: true,
      data: { status: 'completed', captureId: 'second', width: 100, height: 100 },
    })
    mockPreview.mockResolvedValue({ ok: true, data: 'data:image/png;base64,AAA' })
    await renderOverlay()
    await waitFor(() => expect(screen.getByLabelText(/这次要弄懂的问题/)).toHaveValue('第一张文字'))
    fireEvent.click(screen.getByRole('button', { name: '追加截图（1/9）' }))
    expect(await screen.findByAltText('第 2 张截图')).toBeVisible()
    expect(screen.getByRole('button', { name: '追加截图（2/9）' })).toBeEnabled()
    const cancel = screen.getByRole('button', { name: '取消并丢弃截图' })
    expect(cancel).toBeEnabled()
    fireEvent.click(cancel)
    fireEvent.click(screen.getByRole('button', { name: '放弃并关闭' }))
    await waitFor(() => expect(mockCancel).toHaveBeenCalledWith({ captureId: 'second' }))
  })

  it('追加截图等待期间可以取消且迟到的截图被丢弃', async () => {
    mockOcr.mockResolvedValue({ ok: true, data: { text: '文字' } })
    let finish!: (value: unknown) => void
    mockRequest.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    await renderOverlay()
    fireEvent.click(screen.getByRole('button', { name: '追加截图（1/9）' }))
    expect(screen.getByRole('button', { name: '正在选取截图…' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '取消并丢弃截图' }))
    fireEvent.click(screen.getByRole('button', { name: '放弃并关闭' }))
    await act(async () => finish({ ok: true, data: { status: 'completed', captureId: 'late' } }))
    await waitFor(() => expect(mockCancel).toHaveBeenCalledWith({ captureId: 'late' }))
    expect(screen.queryByAltText('第 2 张截图')).not.toBeInTheDocument()
  })

  it('追加失败显示错误而不是静默退出', async () => {
    mockOcr.mockResolvedValue({ ok: true, data: { text: '文字' } })
    mockRequest.mockResolvedValue({
      ok: true,
      data: { status: 'failed', message: '无法获取屏幕画面' },
    })
    await renderOverlay()
    fireEvent.click(screen.getByRole('button', { name: '追加截图（1/9）' }))
    expect(await screen.findByText('无法获取屏幕画面')).toBeVisible()
    expect(screen.getByRole('button', { name: '追加截图（1/9）' })).toBeEnabled()
  })

  it('加载本地 OCR 结果并预填问题建议句', async () => {
    mockOcr.mockResolvedValue({
      ok: true as const,
      data: { text: 'React 调度器为什么用优先级队列', confidence: 88 },
    })

    await renderOverlay()

    expect(await findOcrTextarea()).toHaveValue('React 调度器为什么用优先级队列')
    expect(screen.getByLabelText(/这次要弄懂的问题/)).toHaveValue('React 调度器为什么用优先级队列')
  })

  it('用户编辑后不被迟到的 OCR 结果覆盖', async () => {
    let resolveOcr!: (value: { ok: true; data: { text: string; confidence: number } }) => void
    mockOcr.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveOcr = resolve
        }),
    )

    await renderOverlay()
    const question = screen.getByLabelText(/这次要弄懂的问题/)
    const ocrText = await findOcrTextarea()
    await userEvent.type(question, '用户问题')
    await userEvent.type(ocrText, '用户正文')

    await act(async () => {
      resolveOcr({ ok: true, data: { text: '迟到的识别结果', confidence: 88 } })
    })

    expect(question).toHaveValue('用户问题')
    expect(ocrText).toHaveValue('用户正文')
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
    const ocrText = await findOcrTextarea()
    // 清空预填的问题:验证纯文字保存不携带问题
    await userEvent.clear(screen.getByLabelText(/这次要弄懂的问题/))
    expect(ocrText).toHaveValue('识别到的正文')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '仅保存文字' }))
    })

    expect(mockCreatePaper).toHaveBeenCalledWith({
      content: '识别到的正文',
      questionText: undefined,
      idempotencyKey: expect.any(String),
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
    await findOcrTextarea()
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

  it('截图上传失败时显式提示,可选择重试或不保存截图直接开始', async () => {
    mockOcr.mockResolvedValue({
      ok: true as const,
      data: { text: '识别到的正文', confidence: null },
    })
    mockUpload.mockRejectedValue(new Error('network down'))
    mockCreateSession.mockResolvedValue({
      id: 'b4c9d2e1-2222-4222-8222-222222222222',
    })

    await renderOverlay()
    await findOcrTextarea()
    const question = screen.getByLabelText(/这次要弄懂的问题/)
    await userEvent.clear(question)
    await userEvent.type(question, '什么是事件循环')

    // 上传失败:不创建会话,给出显式提示与两条出路
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '从这里开始' }))
    })
    expect(await screen.findByText(/截图没有保存成功/)).toBeInTheDocument()
    expect(screen.getByText('原因：network down')).toBeVisible()
    expect(mockCreateSession).not.toHaveBeenCalled()

    // 选择不保存截图:会话继续创建且不携带截图
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '不保存截图，直接开始' }))
    })
    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledTimes(1)
    })
    const input = mockCreateSession.mock.calls[0][0] as {
      draftPaper: { questionText: string; screenshotUploadId?: string }
    }
    expect(input.draftPaper.questionText).toBe('什么是事件循环')
    expect(input.draftPaper.screenshotUploadId).toBeUndefined()
    expect(mockUpload).toHaveBeenCalledTimes(1)
  })

  it('截图上传失败后可重试上传并在成功后开始会话', async () => {
    mockOcr.mockResolvedValue({
      ok: true as const,
      data: { text: '识别到的正文', confidence: null },
    })
    mockUpload
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValue({ ok: true as const, data: { uploadId: 'upload-retry' } })
    mockCreateSession.mockResolvedValue({
      id: 'b4c9d2e1-3333-4333-8333-333333333333',
    })

    await renderOverlay()
    await findOcrTextarea()
    const question = screen.getByLabelText(/这次要弄懂的问题/)
    await userEvent.clear(question)
    await userEvent.type(question, '什么是事件循环')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '从这里开始' }))
    })
    expect(await screen.findByText(/截图没有保存成功/)).toBeInTheDocument()

    // 重试上传:成功后携带 uploadId 创建会话
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '重试上传并开始' }))
    })
    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledTimes(1)
    })
    const input = mockCreateSession.mock.calls[0][0] as {
      draftPaper: { screenshotUploadId?: string }
    }
    expect(input.draftPaper.screenshotUploadId).toBe('upload-retry')
  })

  it('取消并丢弃截图调用主进程删除临时文件', async () => {
    mockOcr.mockResolvedValue({ ok: true as const, data: { text: '', confidence: null } })
    openCaptureConfirm(CAPTURE_ID)

    await renderOverlay()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '取消并丢弃截图' }))
    })
    fireEvent.click(screen.getByRole('button', { name: '放弃并关闭' }))

    await waitFor(() => expect(mockCancel).toHaveBeenCalledWith({ captureId: CAPTURE_ID }))
  })
})
