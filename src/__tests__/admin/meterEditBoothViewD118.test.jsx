// @vitest-environment happy-dom
// SPEC-METER-EDIT-BOOTH-VIEW-PORT-01 (D-118): 過去メーター編集(AdminMachineListPage)に巡回のブースビュー(2ビュータブ+BoothFlatRows)を移植。
// AC10: ビュー切替 / 初期値(booth) / ブース行描画 を検証。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useParams: () => ({ storeCode: 'KOS01' }),
  useNavigate: () => mockNavigate,
}))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ staffRole: 'admin', loading: false }) }))
vi.mock('../../services/permissions', () => ({ isAdmin: () => true }))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { store_name: 'ドンキ合志' } }) }) }) }),
  },
}))
vi.mock('../../shared/ui/PageHeader', () => ({ PageHeader: () => <div data-testid="page-header" /> }))
vi.mock('../../shared/ui/DateTime', () => ({ default: () => <span /> }))
vi.mock('../../components/StorePickerSheet', () => ({ default: () => <div data-testid="store-picker" /> }))

// KOS01 実データ相当: 複数ブース機械(M02 4ブース / M05 2ブース) + 両替機(changer, 1ブース)。
const MACHINES = [
  {
    machine_code: 'M02', machine_name: 'BUZZクレ', machine_models: { type_id: 'crane' },
    booths: [
      { booth_code: 'KOS01-M02-B01', booth_number: 1 },
      { booth_code: 'KOS01-M02-B02', booth_number: 2 },
      { booth_code: 'KOS01-M02-B03', booth_number: 3 },
      { booth_code: 'KOS01-M02-B04', booth_number: 4 },
    ],
  },
  {
    machine_code: 'M05', machine_name: 'セサミW①', machine_models: { type_id: 'crane' },
    booths: [
      { booth_code: 'KOS01-M05-B01', booth_number: 1 },
      { booth_code: 'KOS01-M05-B02', booth_number: 2 },
    ],
  },
  {
    machine_code: 'CHG', machine_name: '両替機', machine_models: { type_id: 'changer' },
    booths: [{ booth_code: 'KOS01-CHG-B01', booth_number: 1 }],
  },
]

vi.mock('../../services/patrol', () => ({ getPatrolMachines: () => Promise.resolve(MACHINES) }))
vi.mock('../../services/patrolCore', () => ({ getTodayReadingsMap: () => Promise.resolve({ 'KOS01-M02-B01': { read_time: 't' } }) }))
vi.mock('../../services/storeMachineSummary', () => ({ fetchStoreMachineDiffs: () => Promise.resolve({ diffMap: {} }) }))

import AdminMachineListPage from '../../admin/pages/AdminMachineListPage'

beforeEach(() => { mockNavigate.mockReset() })
afterEach(() => cleanup())

describe('AC1/AC2: 2ビュータブ + 初期表示はブースビュー', () => {
  it('店舗選択済みで 機械/ブース タブが出て、初期は booth が選択済み', async () => {
    render(<AdminMachineListPage />)
    const boothTab = await screen.findByTestId('meteredit-view-tab-booth')
    const machineTab = screen.getByTestId('meteredit-view-tab-machine')
    expect(screen.getByTestId('meteredit-view-toggle')).toBeTruthy()
    // AC2: 初期値 booth
    expect(boothTab.getAttribute('aria-selected')).toBe('true')
    expect(machineTab.getAttribute('aria-selected')).toBe('false')
  })
})

describe('AC3/AC5: ブースビューで changer 除く全機械の全ブースがフラット描画', () => {
  it('M02の4ブース + M05の2ブースが並び、両替機ブースは出ない', async () => {
    render(<AdminMachineListPage />)
    // AC5 実証点: M02 4ブース全て
    for (const bc of ['KOS01-M02-B01', 'KOS01-M02-B02', 'KOS01-M02-B03', 'KOS01-M02-B04']) {
      expect(await screen.findByTestId(`booth-row-${bc}`)).toBeTruthy()
    }
    // M05 2ブース全て
    expect(screen.getByTestId('booth-row-KOS01-M05-B01')).toBeTruthy()
    expect(screen.getByTestId('booth-row-KOS01-M05-B02')).toBeTruthy()
    // AC3: changer は除外
    expect(screen.queryByTestId('booth-row-KOS01-CHG-B01')).toBeNull()
  })
})

describe('AC4: ブース行タップで /admin/audit/booth-edit/{booth_code} へ遷移', () => {
  it('ブース行クリックで navigate(booth_code, state付き)', async () => {
    render(<AdminMachineListPage />)
    const row = await screen.findByTestId('booth-row-KOS01-M02-B03')
    fireEvent.click(row)
    expect(mockNavigate).toHaveBeenCalledTimes(1)
    const [path, opts] = mockNavigate.mock.calls[0]
    expect(path).toBe('/admin/audit/booth-edit/KOS01-M02-B03')
    expect(opts.state.storeCode).toBe('KOS01')
    expect(opts.state.booth.booth_code).toBe('KOS01-M02-B03')
    expect(opts.state.machine.machine_code).toBe('M02') // boothFlat から正しい機械が付く
  })
})

describe('AC6/AC7: 機械タブ切替で集約表示 + 並び順トグルはブースビューのみ', () => {
  it('初期(booth)は order-toggle 表示、機械タブへ切替で MachineRow 表示・ブース行/orderトグル消滅', async () => {
    render(<AdminMachineListPage />)
    await screen.findByTestId('booth-row-KOS01-M02-B01')
    // AC7: ブースビューで並び順トグル表示
    expect(screen.getByTestId('meteredit-booth-order-toggle')).toBeTruthy()

    // 機械タブへ切替
    fireEvent.click(screen.getByTestId('meteredit-view-tab-machine'))
    await waitFor(() => expect(screen.getByTestId('machine-row-M02')).toBeTruthy())
    // AC6: 集約(MachineRow)表示
    expect(screen.getByTestId('machine-row-M05')).toBeTruthy()
    // ブース行は消える
    expect(screen.queryByTestId('booth-row-KOS01-M02-B01')).toBeNull()
    // AC7: 機械ビューでは並び順トグル非表示
    expect(screen.queryByTestId('meteredit-booth-order-toggle')).toBeNull()
  })
})

describe('AC9: 入力済みブース数表示が従来どおり', () => {
  it('todayMap に1件あれば「入力済み」バーが出る', async () => {
    render(<AdminMachineListPage />)
    await screen.findByTestId('booth-row-KOS01-M02-B01')
    expect(screen.getByText(/入力済み/)).toBeTruthy()
  })
})

// 構造ロック (FORBIDDEN/D10 の担保はソース確認): 移植先の testid・BoothFlatRows 使用・初期booth・changer除外・十字フリーズ維持。
describe('構造ロック: 移植の要点がソースに存在', () => {
  const src = readFileSync(resolve(__dirname, '../../admin/pages/AdminMachineListPage.jsx'), 'utf-8')
  it('meteredit-* testid と BoothFlatRows 使用', () => {
    for (const id of ['meteredit-view-toggle', 'meteredit-view-tab-machine', 'meteredit-view-tab-booth', 'meteredit-booth-order-toggle', 'meteredit-booth-order-machine', 'meteredit-booth-order-ranking']) {
      expect(src).toContain(id)
    }
    expect(src).toContain('BoothFlatRows')
    expect(src).toContain("import BoothFlatRows from '../../clawsupport/components/MachineRowExpandedBoothList'")
  })
  it('初期 view=booth / boothOrder=machine / changer除外', () => {
    expect(src).toMatch(/useState\('booth'\)/)   // D1
    expect(src).toMatch(/useState\('machine'\)/) // D2
    expect(src).toContain('nonChangerMachines')  // D3 changer除外
    expect(src).toContain('isChanger')
  })
  it('D10: 十字フリーズ構造(table-fixed/colgroup/overflow-auto)を維持', () => {
    expect(src).toContain('table-fixed')
    expect(src).toContain('<colgroup>')
    expect(src).toMatch(/overflow-auto"\s+ref=\{scrollRef\}/)
    expect(src).toContain('width: 160')
    expect(src).toContain('width: 44')
  })
  it('D8: mode トグルは追加しない (meteredit-view-mode-* が無い)', () => {
    expect(src).not.toContain('meteredit-view-mode')
  })
})
