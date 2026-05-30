import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { ADMIN_VIEWABLE_ORG_IDS, DFX_ORG_ID } from '../lib/auth/orgConstants'

// J-PATROL-99_adhoc_admin_cross_org_view (2026-05-30)
// 暫定: ADMIN_VIEWABLE_ORG_IDS で全閲覧可能 org の用語を統合表示。
// Realtime 購読は org 単位の filter が DFX_ORG_ID 互換のままで動作。
//   (DFX を購読、change は init 時の SELECT で取得)

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
      .in('organization_id', ADMIN_VIEWABLE_ORG_IDS)
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
