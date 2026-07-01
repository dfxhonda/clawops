// SPEC-ADMIN-METER-EDIT-OUT2-FIELDS-01
// AC6: vitest (init/save 単体テスト、OUT2/OUT3 state/init/save/props 追加確認)
// gate_1 confirmed: prize_id_2/prize_id_3 NOT in DB → save patch omits those (patrol mode同)
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

const src = readFileSync(
  resolve(__dirname, '../../admin/pages/AdminBoothEditPage.jsx'),
  'utf-8',
)

describe('SPEC-ADMIN-METER-EDIT-OUT2-FIELDS-01: state declarations', () => {
  it('when_AdminBoothEditPage_should_declare_stock2_setStk2_state', () => {
    expect(src).toContain('stock2,      setStk2')
  })
  it('when_AdminBoothEditPage_should_declare_restock2_setRst2_state', () => {
    expect(src).toContain('restock2,    setRst2')
  })
  it('when_AdminBoothEditPage_should_declare_prizeName2_setPrize2_state', () => {
    expect(src).toContain('prizeName2,  setPrize2')
  })
  it('when_AdminBoothEditPage_should_declare_prizeCost2_setCost2_state', () => {
    expect(src).toContain('prizeCost2,  setCost2')
  })
  it('when_AdminBoothEditPage_should_declare_selectedPrizeId2_state', () => {
    expect(src).toContain('selectedPrizeId2, setSelectedPrizeId2')
  })
  it('when_AdminBoothEditPage_should_declare_stock3_setStk3_state', () => {
    expect(src).toContain('stock3,      setStk3')
  })
  it('when_AdminBoothEditPage_should_declare_restock3_setRst3_state', () => {
    expect(src).toContain('restock3,    setRst3')
  })
  it('when_AdminBoothEditPage_should_declare_prizeName3_setPrize3_state', () => {
    expect(src).toContain('prizeName3,  setPrize3')
  })
  it('when_AdminBoothEditPage_should_declare_prizeCost3_setCost3_state', () => {
    expect(src).toContain('prizeCost3,  setCost3')
  })
  it('when_AdminBoothEditPage_should_declare_selectedPrizeId3_state', () => {
    expect(src).toContain('selectedPrizeId3, setSelectedPrizeId3')
  })
})

describe('SPEC-ADMIN-METER-EDIT-OUT2-FIELDS-01: init from full row', () => {
  it('when_handleRowSelect_should_init_stock2_from_full_stock_2', () => {
    expect(src).toContain('setStk2(full.stock_2 != null ? String(full.stock_2) : \'\')')
  })
  it('when_handleRowSelect_should_init_restock2_from_full_restock_2', () => {
    expect(src).toContain('setRst2(full.restock_2 != null ? String(full.restock_2) : \'\')')
  })
  it('when_handleRowSelect_should_init_prizeName2_from_full_prize_name_2', () => {
    expect(src).toContain('setPrize2(full.prize_name_2 ?? \'\')')
  })
  it('when_handleRowSelect_should_init_prizeCost2_from_full_prize_cost_2', () => {
    expect(src).toContain('setCost2(full.prize_cost_2 != null ? String(full.prize_cost_2) : \'\')')
  })
  it('when_handleRowSelect_should_reset_selectedPrizeId2_to_null', () => {
    expect(src).toContain('setSelectedPrizeId2(null)')
  })
  it('when_handleRowSelect_should_init_stock3_from_full_stock_3', () => {
    expect(src).toContain('setStk3(full.stock_3 != null ? String(full.stock_3) : \'\')')
  })
  it('when_handleRowSelect_should_init_restock3_from_full_restock_3', () => {
    expect(src).toContain('setRst3(full.restock_3 != null ? String(full.restock_3) : \'\')')
  })
  it('when_handleRowSelect_should_init_prizeName3_from_full_prize_name_3', () => {
    expect(src).toContain('setPrize3(full.prize_name_3 ?? \'\')')
  })
  it('when_handleRowSelect_should_init_prizeCost3_from_full_prize_cost_3', () => {
    expect(src).toContain('setCost3(full.prize_cost_3 != null ? String(full.prize_cost_3) : \'\')')
  })
  it('when_handleRowSelect_should_reset_selectedPrizeId3_to_null', () => {
    expect(src).toContain('setSelectedPrizeId3(null)')
  })
})

describe('SPEC-ADMIN-METER-EDIT-OUT2-FIELDS-01: save patch columns', () => {
  it('when_handleSave_should_include_stock_2_in_patch', () => {
    expect(src).toContain('stock_2:      stock2 !== \'\' ? Number(stock2) : null,')
  })
  it('when_handleSave_should_include_restock_2_in_patch', () => {
    expect(src).toContain('restock_2:    restock2 !== \'\' ? Number(restock2) : null,')
  })
  it('when_handleSave_should_include_prize_name_2_in_patch', () => {
    expect(src).toContain('prize_name_2: prizeName2.trim() || null,')
  })
  it('when_handleSave_should_include_prize_cost_2_in_patch', () => {
    expect(src).toContain('prize_cost_2: prizeCost2 !== \'\' ? Number(prizeCost2) : null,')
  })
  it('when_handleSave_should_NOT_include_prize_id_2_column_not_in_db', () => {
    expect(src).not.toContain('prize_id_2')
    expect(src).not.toContain('prize_id_3')
  })
  it('when_handleSave_should_include_stock_3_in_patch', () => {
    expect(src).toContain('stock_3:      stock3 !== \'\' ? Number(stock3) : null,')
  })
  it('when_handleSave_should_include_restock_3_in_patch', () => {
    expect(src).toContain('restock_3:    restock3 !== \'\' ? Number(restock3) : null,')
  })
  it('when_handleSave_should_include_prize_name_3_in_patch', () => {
    expect(src).toContain('prize_name_3: prizeName3.trim() || null,')
  })
  it('when_handleSave_should_include_prize_cost_3_in_patch', () => {
    expect(src).toContain('prize_cost_3: prizeCost3 !== \'\' ? Number(prizeCost3) : null,')
  })
})

describe('SPEC-ADMIN-METER-EDIT-OUT2-FIELDS-01: BoothInputForm props', () => {
  it('when_BoothInputForm_edit_should_receive_stock2_setStk2_prop', () => {
    expect(src).toContain('stock2={stock2} setStk2={setStk2}')
  })
  it('when_BoothInputForm_edit_should_receive_restock2_setRst2_prop', () => {
    expect(src).toContain('restock2={restock2} setRst2={setRst2}')
  })
  it('when_BoothInputForm_edit_should_receive_prizeName2_setPrize2_prop', () => {
    expect(src).toContain('prizeName2={prizeName2} setPrize2={setPrize2}')
  })
  it('when_BoothInputForm_edit_should_receive_prizeCost2_setCost2_prop', () => {
    expect(src).toContain('prizeCost2={prizeCost2} setCost2={setCost2}')
  })
  it('when_BoothInputForm_edit_should_receive_selectedPrizeId2_prop', () => {
    expect(src).toContain('selectedPrizeId2={selectedPrizeId2} setSelectedPrizeId2={setSelectedPrizeId2}')
  })
  it('when_BoothInputForm_edit_should_receive_stock3_setStk3_prop', () => {
    expect(src).toContain('stock3={stock3} setStk3={setStk3}')
  })
  it('when_BoothInputForm_edit_should_receive_restock3_setRst3_prop', () => {
    expect(src).toContain('restock3={restock3} setRst3={setRst3}')
  })
  it('when_BoothInputForm_edit_should_receive_prizeName3_setPrize3_prop', () => {
    expect(src).toContain('prizeName3={prizeName3} setPrize3={setPrize3}')
  })
  it('when_BoothInputForm_edit_should_receive_prizeCost3_setCost3_prop', () => {
    expect(src).toContain('prizeCost3={prizeCost3} setCost3={setCost3}')
  })
  it('when_BoothInputForm_edit_should_receive_selectedPrizeId3_prop', () => {
    expect(src).toContain('selectedPrizeId3={selectedPrizeId3} setSelectedPrizeId3={setSelectedPrizeId3}')
  })
})
