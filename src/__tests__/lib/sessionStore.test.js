import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { saveSession, loadSession, clearSession, clearAllSessions, _resetDb } from '../../lib/sessionStore'

const FUTURE = Math.floor(Date.now() / 1000) + 3600
const PAST = Math.floor(Date.now() / 1000) - 1

function makeSession(overrides = {}) {
  return { access_token: 'tok-abc', refresh_token: 'ref-abc', expires_at: FUTURE, ...overrides }
}

beforeEach(async () => {
  await _resetDb()
})

describe('sessionStore', () => {
  it('when_saveSession_should_loadSession_return_tokens', async () => {
    await saveSession('S01', makeSession())
    const s = await loadSession('S01')
    expect(s).not.toBeNull()
    expect(s.access_token).toBe('tok-abc')
    expect(s.refresh_token).toBe('ref-abc')
  })

  it('when_session_not_stored_should_return_null', async () => {
    expect(await loadSession('missing')).toBeNull()
  })

  it('when_session_expired_should_return_null', async () => {
    await saveSession('S01', makeSession({ expires_at: PAST }))
    expect(await loadSession('S01')).toBeNull()
  })

  it('when_expires_at_missing_should_return_null', async () => {
    await saveSession('S01', { access_token: 'tok', refresh_token: 'ref' })
    expect(await loadSession('S01')).toBeNull()
  })

  it('when_clearSession_should_remove_only_target_staff', async () => {
    await saveSession('S01', makeSession())
    await saveSession('S02', makeSession())
    await clearSession('S01')
    expect(await loadSession('S01')).toBeNull()
    expect(await loadSession('S02')).not.toBeNull()
  })

  it('when_clearAllSessions_should_remove_all', async () => {
    await saveSession('S01', makeSession())
    await saveSession('S02', makeSession())
    await clearAllSessions()
    expect(await loadSession('S01')).toBeNull()
    expect(await loadSession('S02')).toBeNull()
  })
})
