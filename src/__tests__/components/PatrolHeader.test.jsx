// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import PatrolHeader from '../../patrol/components/PatrolHeader'

describe('PatrolHeader', () => {
  it('date input が DOM に存在しない（日付ドロップダウン削除確認）', () => {
    const { container } = render(
      <PatrolHeader
        machineName="テスト機"
        boothLabel="B01"
        onBack={() => {}}
      />
    )
    expect(container.querySelector('input[type="date"]')).toBeNull()
  })

  it('機械名とブースラベルが表示される', () => {
    const { getByText } = render(
      <PatrolHeader machineName="テスト機" boothLabel="B02" />
    )
    expect(getByText('テスト機')).toBeTruthy()
    expect(getByText(/B02/)).toBeTruthy()
  })

  it('badge が渡された場合に表示される', () => {
    const { getByText } = render(
      <PatrolHeader machineName="ガチャ機" badge="ガチャ" />
    )
    expect(getByText('ガチャ')).toBeTruthy()
  })
})
