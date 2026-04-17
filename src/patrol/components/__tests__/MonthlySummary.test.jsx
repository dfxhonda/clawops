// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import MonthlySummary from '../MonthlySummary'

const histRows = [
  { read_time: '2026-04-10', in_diff: 130, out_diff_1: 18, play_price: 100, revenue: 13000 },
  { read_time: '2026-04-12', in_diff: 150, out_diff_1: 20, play_price: 100, revenue: 15000 },
]

it('shows 4 summary columns including 今月予測', () => {
  render(<MonthlySummary currRevenue={28000} currRate={13.5} histRows={histRows} />)
  expect(screen.getByText('今月売上')).toBeInTheDocument()
  expect(screen.getByText('今月予測')).toBeInTheDocument()
  expect(screen.getByText('景品代')).toBeInTheDocument()
  expect(screen.getByText('出率')).toBeInTheDocument()
})

it('shows 5 table columns including 払出数 and 払出金額', () => {
  render(<MonthlySummary currRevenue={28000} currRate={13.5} histRows={histRows} />)
  expect(screen.getByText('払出数')).toBeInTheDocument()
  expect(screen.getByText('払出金額')).toBeInTheDocument()
})

it('shows formatted revenue in summary', () => {
  render(<MonthlySummary currRevenue={28000} currRate={13.5} histRows={histRows} />)
  expect(screen.getByText('¥28,000')).toBeInTheDocument()
})
