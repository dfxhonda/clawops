// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import PatrolHeader from '../../patrol/components/PatrolHeader'

describe('PatrolHeader', () => {
  it('date input が DOM に存在する', () => {
    const { container } = render(
      <PatrolHeader
        readDate="2026-04-21"
        onDateChange={() => {}}
        machineName="テスト機"
        boothLabel="B01"
        onBack={() => {}}
      />
    )
    expect(container.querySelector('input[type="date"]')).not.toBeNull()
  })

  it('dateLocked=true のとき date input が disabled になる', () => {
    const { container } = render(
      <PatrolHeader
        readDate="2026-04-20"
        onDateChange={() => {}}
        machineName="テスト機"
        dateLocked={true}
      />
    )
    expect(container.querySelector('input[type="date"]').disabled).toBe(true)
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
