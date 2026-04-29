import { create } from 'zustand'
import { fetchDashboardData } from '../dashboard/services/dashboardData'

const STALE_MS = 5 * 60 * 1000

export const useDashboardStore = create((set, get) => ({
  data: null,
  fetchedAt: null,
  loading: false,
  error: null,

  getOrFetch: async () => {
    const { data, fetchedAt, loading } = get()
    if (loading) return
    if (data && fetchedAt && Date.now() - fetchedAt < STALE_MS) return
    set({ loading: true, error: null })
    try {
      const result = await fetchDashboardData()
      set({ data: result, fetchedAt: Date.now(), loading: false })
    } catch (e) {
      set({ error: e.message, loading: false })
    }
  },

  invalidate: () => set({ fetchedAt: null }),
}))
