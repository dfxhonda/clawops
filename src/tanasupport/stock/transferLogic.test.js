import { describe, it, expect } from 'vitest'
import { deriveOwners, transferQtyError } from './transferLogic'

describe('deriveOwners', () => {
  it('持ち出し(out)は倉庫→担当者 transfer_out になる', () => {
    expect(deriveOwners('out', 'KRM02', 'STAFF-03')).toEqual({
      from: { type: 'location', id: 'KRM02' },
      to: { type: 'staff', id: 'STAFF-03' },
      movementType: 'transfer_out',
    })
  })
  it('帰庫(in)は担当者→倉庫 transfer_in になる', () => {
    expect(deriveOwners('in', 'KRM02', 'STAFF-03')).toEqual({
      from: { type: 'staff', id: 'STAFF-03' },
      to: { type: 'location', id: 'KRM02' },
      movementType: 'transfer_in',
    })
  })
})

describe('transferQtyError', () => {
  it('0以下はERR-STOCK-008', () => {
    expect(transferQtyError(0, 5)?.code).toBe('ERR-STOCK-008')
  })
  it('在庫数超過はERR-STOCK-009', () => {
    expect(transferQtyError(6, 5)?.code).toBe('ERR-STOCK-009')
  })
  it('在庫数ちょうどは許可(null)', () => {
    expect(transferQtyError(5, 5)).toBeNull()
  })
  it('在庫範囲内は許可(null)', () => {
    expect(transferQtyError(3, 5)).toBeNull()
  })
  it('非数はERR-STOCK-008', () => {
    expect(transferQtyError('', 5)?.code).toBe('ERR-STOCK-008')
  })
})
