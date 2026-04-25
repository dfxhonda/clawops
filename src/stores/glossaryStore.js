import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { DFX_ORG_ID } from '../lib/auth/orgConstants'

export const useGlossaryStore = create((set, get) => ({
  terms: {},
  loading: true,
  error: null,
  channel: null,

  init: async () => {
    set({ loading: true, error: null })
    const { data, error } = await supabase
      .from('glossary_terms')
      .select('*')
      .eq('organization_id', DFX_ORG_ID)
      .eq('is_active', true)
    if (error) { set({ error: error.message, loading: false }); return }
    const terms = Object.fromEntries(data.map(t => [t.term_id, t]))
    set({ terms, loading: false })

    const channel = supabase
      .channel('glossary_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'glossary_terms', filter: `organization_id=eq.${DFX_ORG_ID}` },
        ({ eventType, new: n, old: o }) => {
          set(s => {
            const next = { ...s.terms }
            if (eventType === 'DELETE') delete next[o.term_id]
            else if (n.is_active) next[n.term_id] = n
            else delete next[n.term_id]
            return { terms: next }
          })
        }
      )
      .subscribe()
    set({ channel })
  },

  cleanup: () => {
    const { channel } = get()
    if (channel) supabase.removeChannel(channel)
    set({ channel: null })
  },
}))
