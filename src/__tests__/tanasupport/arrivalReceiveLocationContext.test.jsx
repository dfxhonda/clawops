// @vitest-environment happy-dom
// SPEC-ARRIVAL-RECEIVE-LOCATION-CONTEXT-01 (D-084): 入庫先初期値は 拠点コンテキスト優先、
// 旧 locs[0]=エイド 自動選択 fallback 廃止 (黙って誤拠点入庫を防ぐ)。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import ArrivalReceiveSheet from '../../tanasupport/components/ArrivalReceiveSheet'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ staffId: 'staff-1' }) }))

// locations は location_name 順で エイド が先頭 (= 旧 locs[0] fallback だと必ずエイドが選ばれた)
const LOCATIONS = [
  { location_id: 'AID01', location_name: 'エイド' },
  { location_id: 'IZK01', location_name: '飯塚' },
  { location_id: 'TKM01', location_name: '田隈' },
]

vi.mock('../../lib/supabase', () => {
  const builder = {
    select() { return builder },
    eq()     { return builder },
    order()  { return builder },
    then(resolve) { return Promise.resolve(resolve({ data: LOCATIONS, error: null })) },
  }
  return { supabase: { from: () => builder } }
})

function renderSheet(props) {
  const order = { order_id: 'o1', destination: props.destination ?? '', case_count: 10, received_quantity: 0 }
  const utils = render(
    <ArrivalReceiveSheet order={order} onDone={vi.fn()} onCancel={vi.fn()} contextLocationId={props.contextLocationId ?? null} />,
  )
  return utils.container.querySelector('select')
}

describe('AC1/AC2/AC3: ArrivalReceiveSheet 入庫先初期値', () => {
  it('AC1: 拠点コンテキストあり → その拠点が初期値 (エイド=locs[0] にならない)', async () => {
    const select = renderSheet({ contextLocationId: 'IZK01', destination: '' })
    await waitFor(() => expect(select.value).toBe('IZK01'))
    expect(select.value).not.toBe('AID01') // 旧 fallback のエイドが選ばれない
  })

  it('AC1: コンテキストは destination 推測より優先', async () => {
    // destination=田隈 は guess=TKM01 だが、コンテキスト IZK01 が勝つ
    const select = renderSheet({ contextLocationId: 'IZK01', destination: '田隈倉庫' })
    await waitFor(() => expect(select.value).toBe('IZK01'))
  })

  it('AC2: コンテキストなし + guess 外れ → 空欄 (locs[0] エイド自動選択なし)', async () => {
    const select = renderSheet({ contextLocationId: null, destination: '謎の倉庫' })
    // 非同期 locations ロード後も空欄のまま
    await waitFor(() => expect(select).toBeTruthy())
    await new Promise(r => setTimeout(r, 0))
    expect(select.value).toBe('')
  })

  it('AC2: コンテキストなし + guess 命中 → guess 拠点', async () => {
    const select = renderSheet({ contextLocationId: null, destination: '飯塚センター' })
    await waitFor(() => expect(select.value).toBe('IZK01'))
  })
})
