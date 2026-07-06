// @vitest-environment node
// SPEC-ANOMALY-METER-P1-COLLECTION-AUDIT-01: collection-save meter audit hook (AC6)
import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpcMock = vi.fn()
const insertMock = vi.fn()
const captureExceptionMock = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({ insert: (...a) => insertMock(...a) }),
    rpc: (...a) => rpcMock(...a),
  },
}))
vi.mock('../lib/sentry', () => ({ Sentry: { captureException: (...a) => captureExceptionMock(...a) } }))

const { saveCollection, auditCollectionMeters } = await import('./collections')

const flush = () => new Promise(r => setTimeout(r, 0))

const baseArgs = {
  storeCode: 'KOS01', collectedAt: '2026-07-14', collectionId: 'KOS01-20260714-01',
  collectedBy: 's1', collectedByName: 'staff', booths: [], rowData: {}, notes: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  insertMock.mockResolvedValue({ error: null })
  rpcMock.mockResolvedValue({ data: { machines_checked: 0, flagged: 0, skipped_booths: 0 }, error: null })
})

describe('auditCollectionMeters', () => {
  it('calls fn_audit_collection_meters with the collection id', async () => {
    await auditCollectionMeters('KOS01-20260714-01')
    expect(rpcMock).toHaveBeenCalledWith('fn_audit_collection_meters', { p_collection_id: 'KOS01-20260714-01' })
    expect(captureExceptionMock).not.toHaveBeenCalled()
  })

  it('swallows an RPC error to Sentry and never throws', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('audit boom') })
    await expect(auditCollectionMeters('X')).resolves.toBeUndefined()
    expect(captureExceptionMock).toHaveBeenCalledTimes(1)
    expect(captureExceptionMock.mock.calls[0][1]).toMatchObject({ tags: { area: 'collection-meter-audit' } })
  })
})

describe('saveCollection audit hook (AC6)', () => {
  it('fires the audit RPC after a successful save', async () => {
    const res = await saveCollection(baseArgs)
    expect(res.error).toBeNull()
    expect(res.data).toEqual({ collectionId: 'KOS01-20260714-01' })
    expect(rpcMock).toHaveBeenCalledWith('fn_audit_collection_meters', { p_collection_id: 'KOS01-20260714-01' })
  })

  it('does NOT fire the audit RPC when the cash_collections insert fails', async () => {
    insertMock.mockResolvedValueOnce({ error: new Error('e1') })
    const res = await saveCollection(baseArgs)
    expect(res.error).toBeTruthy()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('does NOT fire the audit RPC when the booth insert fails', async () => {
    insertMock.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: new Error('e2') })
    const res = await saveCollection(baseArgs)
    expect(res.error).toBeTruthy()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('save still succeeds when the audit RPC errors (failure swallowed, save unaffected)', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('audit boom') })
    const res = await saveCollection(baseArgs)
    expect(res.error).toBeNull()
    expect(res.data).toEqual({ collectionId: 'KOS01-20260714-01' })
    await flush()
    expect(captureExceptionMock).toHaveBeenCalledTimes(1)
  })
})
