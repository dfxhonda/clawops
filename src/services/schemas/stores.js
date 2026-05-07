import { z } from 'zod'

export const StoreRowSchema = z.object({
  store_code:          z.string(),
  store_name:          z.string(),
  store_name_official: z.string().nullable(),
  locality:            z.string().nullable(),
  locality_kana:       z.string().nullable(),
  is_active:           z.boolean(),
  is_collection_day:   z.boolean(),
  organization_id:     z.string(),
  created_at:          z.string().nullable(),
  updated_at:          z.string().nullable(),
})
