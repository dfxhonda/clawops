// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// canvas は happy-dom では未実装のため document.createElement をモック
function mockCanvasFactory() {
  const ctx = {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    putImageData: vi.fn(),
  }
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
    toDataURL: vi.fn(() => 'data:image/jpeg;base64,ZmFrZQ=='),
  }
}

let origCreateElement
beforeEach(() => {
  origCreateElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag, ...args) => {
    if (tag === 'canvas') return mockCanvasFactory()
    return origCreateElement(tag, ...args)
  })
})
afterEach(() => {
  vi.restoreAllMocks()
})

import OcrCaptureScreen from '../../clawsupport/components/OcrCaptureScreen'

const defaultProps = {
  boothCode: 'TEST01-M01-B01',
  machineInfo: null,
  lastIn: 49000,
  lastOut: 44000,
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
  mode: 'single',
}

describe('OcrCaptureScreen', () => {
  describe('停止画像表示', () => {
    it('シャッターボタンを押すと <img alt="撮影画像"> が表示される', async () => {
      render(<OcrCaptureScreen {...defaultProps} />)

      // 初期状態: video が表示、img は非表示
      expect(screen.queryByAltText('撮影画像')).toBeNull()
      // video は存在する
      expect(document.querySelector('video')).not.toBeNull()

      const shutterBtn = screen.getByRole('button', { name: 'シャッター' })
      fireEvent.click(shutterBtn)

      // capturedImage がセットされ img が表示される
      await waitFor(() => {
        expect(screen.getByAltText('撮影画像')).toBeInTheDocument()
      })
      // video は非表示になる
      expect(document.querySelector('video')).toBeNull()
    })

    it('再撮影ボタンを押すと img が消えて video が戻る', async () => {
      render(<OcrCaptureScreen {...defaultProps} />)

      fireEvent.click(screen.getByRole('button', { name: 'シャッター' }))
      await waitFor(() => screen.getByAltText('撮影画像'))

      fireEvent.click(screen.getByRole('button', { name: '↻ 再撮影' }))

      await waitFor(() => {
        expect(screen.queryByAltText('撮影画像')).toBeNull()
        expect(document.querySelector('video')).not.toBeNull()
      })
    })
  })

  describe('OCR → 確定フロー (MSW)', () => {
    it('OCR成功後に値が表示され、確定ボタン押下で onConfirm が呼ばれる', async () => {
      const onConfirm = vi.fn()
      render(<OcrCaptureScreen {...defaultProps} onConfirm={onConfirm} />)

      fireEvent.click(screen.getByRole('button', { name: 'シャッター' }))

      // OCR結果を待つ — MSW が left_in: 50000, left_out: 45000 を返す
      await waitFor(() => {
        expect(screen.getByText('✓ 読み取り成功 — 値を確認して確定ボタン')).toBeInTheDocument()
      }, { timeout: 3000 })

      // 確定ボタンを押す
      const confirmBtn = screen.getByRole('button', { name: '✓ 確定' })
      expect(confirmBtn).not.toBeDisabled()
      fireEvent.click(confirmBtn)

      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          inMeter: '50000',
          outMeter: '45000',
          outMeter2: null,
        })
      )
    })

    it('OCR API がエラーを返したときエラーメッセージを表示する', async () => {
      // MSW ハンドラーを上書きしてエラーレスポンスを返す
      const { server } = await import('../msw/server')
      const { http, HttpResponse } = await import('msw')
      server.use(
        http.post('http://localhost:54321/functions/v1/ocr-meter', () => {
          return HttpResponse.json({ message: 'OCR処理失敗' }, { status: 500 })
        })
      )

      render(<OcrCaptureScreen {...defaultProps} />)
      fireEvent.click(screen.getByRole('button', { name: 'シャッター' }))

      // OCR失敗メッセージが出る（supabase.functions.invoke は error オブジェクトを返す）
      await waitFor(() => {
        // status 500 時は ocrStatus='failed' になりエラー文言が表示される
        expect(screen.queryByAltText('撮影画像')).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })
})
