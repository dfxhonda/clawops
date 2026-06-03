import { z } from 'zod'

export const PrizeMasterRowSchema = z.object({
  prize_id:               z.string(),
  prize_name:             z.string(),
  // J-SCHEMA-DROP-FIX-01: prize_name_kana 列は DB から削除済、schema から除外。
  aliases:                z.string().nullable(),
  short_name:             z.string().nullable(),
  jan_code:               z.string().nullable(),
  original_cost:          z.number().nullable(),
  category:               z.string().nullable(),
  size:                   z.string().nullable(),
  supplier_id:            z.string().nullable(),
  supplier_name:          z.string().nullable(),
  default_case_quantity:  z.number().nullable(),
  // SPEC-PRIZE-MASTER-STATUS-DEPRECATE-01: status を撤廃、phase に統一
  phase:                  z.enum(['active', 'provisional', 'yobigun', 'dead']).nullable().optional(),
  notes:                  z.string().nullable(),
  image_url:              z.string().nullable(),
  organization_id:        z.string(),
  created_at:             z.string().nullable(),
  updated_at:             z.string().nullable(),
})
