import { useAuth } from '../lib/auth/AuthProvider'
import { DFX_ORG_ID } from '../lib/auth/orgConstants'

export function useCurrentStaff() {
  const { staffId, staffName, staffRole, staffStoreCode, loading } = useAuth()
  return {
    staffId,
    staffName,
    staffRole,
    staffStoreCode,
    organizationId: DFX_ORG_ID,
    loading,
  }
}
