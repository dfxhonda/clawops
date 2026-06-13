// SPEC-LOCKER-HIGHVALUE-PHASE1-01
// prize_id 紐付け: updateLockerSlot, useLockerState, createLockerPrizeMaster

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

const patrolV2Src = readFileSync(resolve(__dirname, '../../services/patrolV2.js'), 'utf-8')
const lockerStateSrc = readFileSync(resolve(__dirname, '../../hooks/useLockerState.js'), 'utf-8')
const lockerMasterSrc = readFileSync(resolve(__dirname, '../../services/lockerPrizeMaster.js'), 'utf-8')
const lockerModalSrc = readFileSync(resolve(__dirname, '../../clawsupport/components/locker/LockerModal.jsx'), 'utf-8')

describe('SPEC-LOCKER-HIGHVALUE-PHASE1-01 updateLockerSlot prize_id', () => {
  it('when_updateLockerSlot_called_should_include_prize_id_in_update', () => {
    expect(patrolV2Src).toContain('prizeId = null')
    expect(patrolV2Src).toContain('prize_id: prizeId')
  })
})

describe('SPEC-LOCKER-HIGHVALUE-PHASE1-01 useLockerState prize_id threading', () => {
  it('when_fillSlot_called_should_pass_prizeId_to_updateLockerSlot', () => {
    expect(lockerStateSrc).toContain("fillSlot = useCallback(async (slotId, { name, value, prizeId = null }, staffId)")
    expect(lockerStateSrc).toContain('action: \'set\', prizeId')
  })

  it('when_swapSlot_called_should_pass_prizeId_to_updateLockerSlot', () => {
    expect(lockerStateSrc).toContain("swapSlot = useCallback(async (slotId, { name, value, prizeId = null }, staffId)")
    expect(lockerStateSrc).toContain('action: \'swap\', prizeId')
  })

  it('when_wonSlot_called_should_clear_prizeId_null', () => {
    const wonBlock = lockerStateSrc.slice(
      lockerStateSrc.indexOf('wonSlot = useCallback'),
      lockerStateSrc.indexOf('wonSlot = useCallback') + 200,
    )
    expect(wonBlock).toContain("prizeId: null")
  })

  it('when_removeSlot_called_should_clear_prizeId_null', () => {
    const removeBlock = lockerStateSrc.slice(
      lockerStateSrc.indexOf('removeSlot = useCallback'),
      lockerStateSrc.indexOf('removeSlot = useCallback') + 200,
    )
    expect(removeBlock).toContain("prizeId: null")
  })
})

describe('SPEC-LOCKER-HIGHVALUE-PHASE1-01 createLockerPrizeMaster', () => {
  it('when_creating_master_should_insert_to_prize_masters_with_org_id', () => {
    expect(lockerMasterSrc).toContain('prize_masters')
    expect(lockerMasterSrc).toContain('organization_id: CHANGE_ORG_ID')
    expect(lockerMasterSrc).toContain("phase: 'active'")
  })

  it('when_image_provided_should_upload_to_announcements_bucket', () => {
    expect(lockerMasterSrc).toContain("from('announcements')")
    expect(lockerMasterSrc).toContain('locker-prizes/')
  })

  it('when_creating_master_should_write_audit_log', () => {
    expect(lockerMasterSrc).toContain('writeAuditLog')
    expect(lockerMasterSrc).toContain('master_create')
  })
})

describe('SPEC-LOCKER-HIGHVALUE-PHASE1-01 LockerModal prize search UI', () => {
  it('when_empty_slot_should_render_search_input', () => {
    expect(lockerModalSrc).toContain('景品名を検索')
    expect(lockerModalSrc).toContain('searchPrizeMasters')
  })

  it('when_prize_selected_should_call_onFill_with_prizeId', () => {
    expect(lockerModalSrc).toContain('prizeId: selectedPrize.prize_id')
  })

  it('when_manual_mode_should_call_createLockerPrizeMaster', () => {
    expect(lockerModalSrc).toContain('createLockerPrizeMaster')
    expect(lockerModalSrc).toContain('prizeId: master.prize_id')
  })

  it('when_manual_mode_should_have_image_capture_input', () => {
    // iOS Safari: display:none must be on the input itself, not a wrapper
    expect(lockerModalSrc).toContain("capture=\"environment\"")
    expect(lockerModalSrc).toContain("display: 'none'")
  })

  it('when_filled_slot_should_show_action_buttons', () => {
    expect(lockerModalSrc).toContain('当たり — 空にする')
    expect(lockerModalSrc).toContain('景品を変更')
    expect(lockerModalSrc).toContain('撤去する')
  })
})
